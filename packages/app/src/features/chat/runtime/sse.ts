import type {
  AssistantTraceEvent,
  CacheSkippedPayload,
  NormalizedSSEEvent,
  PollingEventItem,
  StoppedPayload,
  TelemetryPayload,
  TypedBackendErrorPayload,
} from './types';

/**
 * Incremental SSE Frame Decoder & Event Normalizer
 *
 * Implements Plan §5.2, §9.3:
 * - Decodes arbitrary chunk boundaries and multi-byte UTF-8 split points;
 * - Handles both CRLF (\r\n) and LF (\n);
 * - Correctly joins multiple `data:` lines with \n;
 * - Normalizes payloads by event kind:
 *   - 'content', 'thinking', 'status' -> strings (never [object Object]);
 *   - 'telemetry', 'stopped', 'cache_skipped' -> parsed objects/fallback strings;
 *   - 'error' -> parsed object or safe fallback text;
 *   - 'done' -> literal string '[DONE]';
 * - Malformed canonical payloads surface as event 'malformed' with a visible
 *   nonfatal warning and are NEVER appended to answer text;
 * - Unknown event kinds surface as event 'unknown' with a visible warning.
 */

export class SSEFrameDecoder {
  private buffer = '';
  private decoder = new TextDecoder('utf-8');

  /** Push raw Uint8Array chunk into buffer and return all complete frames. */
  public pushChunk(chunk: Uint8Array): string[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    return this.extractFrames();
  }

  /** Push string chunk directly (useful for testing or string streams). */
  public pushText(text: string): string[] {
    this.buffer += text;
    return this.extractFrames();
  }

  /** Flush remaining decoded text on EOF. */
  public flush(): string[] {
    this.buffer += this.decoder.decode();
    const frames = this.extractFrames();
    // If there is residual data without trailing double newline,
    // evaluate if it has a complete event.
    if (this.buffer.trim().length > 0) {
      frames.push(this.buffer);
      this.buffer = '';
    }
    return frames;
  }

  private extractFrames(): string[] {
    const frames: string[] = [];
    // Normalize CRLF to LF for consistent boundary detection
    this.buffer = this.buffer.replace(/\r\n/g, '\n');

    let boundaryIndex: number;
    while ((boundaryIndex = this.buffer.indexOf('\n\n')) !== -1) {
      const frameText = this.buffer.slice(0, boundaryIndex).trim();
      this.buffer = this.buffer.slice(boundaryIndex + 2);
      if (frameText.length > 0) {
        frames.push(frameText);
      }
    }
    return frames;
  }
}

/** Parse an individual raw SSE frame text into an event name and raw data. */
export function parseRawSSEFrame(frame: string): { event: string; data: string } {
  const lines = frame.split('\n');
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(':')) {
      // Comment line, ignore per SSE spec
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return { event, data: dataLines.join('\n') };
}

/** Parse JSON safely without throwing. */
export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** True when the value is a JSON object (not array, not null). */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function malformed(kind: string, data: string, detail: string): NormalizedSSEEvent {
  return { event: 'malformed', data, warning: `${kind} 事件载荷格式异常：${detail}` };
}

const TRACE_ID_MAX = 128;
const TRACE_ARGUMENT_MAX = 500;
const TRACE_RESULT_MAX = 1000;
const TRACE_ERROR_MAX = 500;

function validTraceIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Array.from(value).length <= TRACE_ID_MAX;
}

function optionalTraceText(
  payload: Record<string, unknown>,
  key: string,
  limit: number,
): { valid: boolean; value?: string | null } {
  if (!(key in payload)) return { valid: true };
  const value = payload[key];
  if (value === null) return { valid: true, value: null };
  return typeof value === 'string' && Array.from(value).length <= limit
    ? { valid: true, value }
    : { valid: false };
}

/** Convert the accepted snake_case wire event into one strict internal DTO. */
export function normalizeAssistantTraceEvent(value: unknown): AssistantTraceEvent | null {
  if (!isJsonObject(value)) return null;
  const runId = value.run_id;
  const sequence = value.sequence;
  const itemId = value.item_id;
  if (
    value.version !== 1 ||
    !validTraceIdentity(runId) ||
    !Number.isInteger(sequence) ||
    (sequence as number) < 0 ||
    !validTraceIdentity(itemId)
  ) return null;

  if (value.kind === 'thinking') {
    return value.lifecycle === 'delta' && typeof value.text_delta === 'string' && value.text_delta.length > 0
      ? {
          version: 1,
          runId,
          sequence: sequence as number,
          itemId,
          kind: 'thinking',
          lifecycle: 'delta',
          textDelta: value.text_delta,
        }
      : null;
  }
  if (value.kind !== 'tool') return null;
  const callId = value.call_id;
  const toolName = value.tool_name;
  const lifecycle = value.lifecycle;
  const argument = optionalTraceText(value, 'argument_preview', TRACE_ARGUMENT_MAX);
  const result = optionalTraceText(value, 'result_summary', TRACE_RESULT_MAX);
  const error = optionalTraceText(value, 'error_summary', TRACE_ERROR_MAX);
  const duration = value.duration_ms;
  if (
    !validTraceIdentity(callId) ||
    !validTraceIdentity(toolName) ||
    (lifecycle !== 'started' && lifecycle !== 'succeeded' && lifecycle !== 'failed') ||
    !argument.valid || !result.valid || !error.valid ||
    ('duration_ms' in value && duration !== null &&
      (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0))
  ) return null;
  return {
    version: 1,
    runId,
    sequence: sequence as number,
    itemId,
    kind: 'tool',
    callId,
    lifecycle,
    toolName,
    ...('argument_preview' in value ? { argumentPreview: argument.value } : {}),
    ...('result_summary' in value ? { resultSummary: result.value } : {}),
    ...('error_summary' in value ? { errorSummary: error.value } : {}),
    ...('duration_ms' in value ? { durationMs: duration as number | null } : {}),
  };
}

/**
 * Normalizes a raw SSE event by event kind according to Plan §5.2.
 * Canonical payload violations return event 'malformed' (never content);
 * unknown event names return event 'unknown' with a visible warning.
 */
export function normalizeSSEEvent(event: string, data: string): NormalizedSSEEvent {
  const parsed = safeJsonParse(data);

  switch (event) {
    case 'content': {
      // Server may send literal string or JSON-encoded string.
      // A JSON object is NOT content: report malformed, never append raw JSON.
      if (isJsonObject(parsed)) {
        return malformed('content', data, '载荷是 JSON 对象而非文本');
      }
      const text = typeof parsed === 'string' ? parsed : data;
      return { event: 'content', data: text };
    }

    case 'thinking': {
      if (isJsonObject(parsed)) {
        return malformed('thinking', data, '载荷是 JSON 对象而非文本');
      }
      const text = typeof parsed === 'string' ? parsed : data;
      return { event: 'thinking', data: text };
    }

    case 'status': {
      // Current backend emits status as a plain string (incl. tool progress
      // rendered by _format_tool_status). Object/array/number/null payloads
      // are malformed — never expose args or raw JSON as status text.
      if (typeof parsed === 'string') {
        return { event: 'status', data: parsed, parsedData: parsed };
      }
      return malformed('status', data, '载荷必须是字符串');
    }

    case 'telemetry': {
      if (!isJsonObject(parsed)) {
        return malformed('telemetry', data, '载荷应为 JSON 对象');
      }
      return {
        event: 'telemetry',
        data,
        parsedData: parsed as TelemetryPayload,
      };
    }

    case 'cache_skipped': {
      if (!isJsonObject(parsed)) {
        return malformed('cache_skipped', data, '载荷应为 JSON 对象');
      }
      return {
        event: 'cache_skipped',
        data,
        parsedData: parsed as unknown as CacheSkippedPayload,
      };
    }

    case 'assistant_trace': {
      const trace = normalizeAssistantTraceEvent(parsed);
      return trace
        ? { event: 'assistant_trace', data: '', parsedData: trace }
        : malformed('assistant_trace', data, '字段、边界或生命周期无效');
    }

    case 'done': {
      return { event: 'done', data: '[DONE]' };
    }

    case 'stopped': {
      if (isJsonObject(parsed)) {
        return {
          event: 'stopped',
          data,
          parsedData: parsed as StoppedPayload,
        };
      }
      // Legacy/bare stopped frame: keep the terminal, flag nonfatal warning.
      return {
        event: 'stopped',
        data,
        parsedData: { partial: false },
        warning: 'stopped 事件载荷不是 JSON 对象，按完整停止处理',
      };
    }

    case 'error': {
      if (isJsonObject(parsed)) {
        return {
          event: 'error',
          data,
          parsedData: parsed as TypedBackendErrorPayload,
        };
      }
      // Legacy/bare error remains a safe fallback (§5.2).
      return {
        event: 'error',
        data,
        parsedData: { message: data },
      };
    }

    default: {
      return {
        event: 'unknown',
        data,
        parsedData: parsed,
        warning: `收到未知事件类型: ${event}`,
      };
    }
  }
}

/**
 * Normalizes one polling event item (§5.3) into the SAME normalized event
 * vocabulary used by the SSE boundary. `delta` may be a string (content/
 * status/thinking) or a JSON object for structured event kinds. Malformed
 * items become nonfatal 'malformed'/'unknown' events, never answer text.
 */
export function normalizePollingEvent(item: PollingEventItem): NormalizedSSEEvent {
  if (!item || typeof item !== 'object' || typeof item.event_type !== 'string') {
    return { event: 'malformed', data: '', warning: '轮询事件项格式异常（缺少 event_type）' };
  }
  const kind = item.event_type;

  switch (kind) {
    case 'content': {
      if (typeof item.delta === 'string') {
        return { event: 'content', data: item.delta };
      }
      return malformed('content', JSON.stringify(item.delta), 'delta 不是文本');
    }

    case 'status': {
      // Status is string-only on the wire; structured objects are malformed.
      if (typeof item.delta === 'string') {
        return { event: 'status', data: item.delta, parsedData: item.delta };
      }
      return malformed('status', JSON.stringify(item.delta), '载荷必须是字符串');
    }

    case 'thinking': {
      if (typeof item.delta === 'string') {
        return { event: 'thinking', data: item.delta };
      }
      return malformed('thinking', JSON.stringify(item.delta), 'delta 不是文本');
    }

    case 'telemetry': {
      if (isJsonObject(item.delta)) {
        return { event: 'telemetry', data: '', parsedData: item.delta as TelemetryPayload };
      }
      return malformed('telemetry', JSON.stringify(item.delta), 'delta 应为 JSON 对象');
    }

    case 'cache_skipped': {
      if (isJsonObject(item.delta)) {
        return { event: 'cache_skipped', data: '', parsedData: item.delta as unknown as CacheSkippedPayload };
      }
      return malformed('cache_skipped', JSON.stringify(item.delta), 'delta 应为 JSON 对象');
    }

    case 'assistant_trace': {
      const trace = normalizeAssistantTraceEvent(item.delta);
      return trace
        ? { event: 'assistant_trace', data: '', parsedData: trace }
        : malformed('assistant_trace', JSON.stringify(item.delta), '字段、边界或生命周期无效');
    }

    case 'stopped': {
      return normalizeSSEEvent('stopped', typeof item.delta === 'string' ? item.delta : JSON.stringify(item.delta));
    }

    case 'error': {
      return normalizeSSEEvent('error', typeof item.delta === 'string' ? item.delta : JSON.stringify(item.delta));
    }

    default: {
      return {
        event: 'unknown',
        data: JSON.stringify(item.delta),
        parsedData: item.delta,
        warning: `收到未知轮询事件类型: ${kind}`,
      };
    }
  }
}
