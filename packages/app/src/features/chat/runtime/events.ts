import type { AssistantRunTraceItem, AssistantRunTraceToolItem } from '../types';
import type {
  AssistantTraceEvent,
  CacheSkippedPayload,
  NormalizedSSEEvent,
  RuntimeAssistantRow,
  RuntimeAssistantTrace,
  RuntimeTelemetry,
  TelemetryPayload,
} from './types';

function baseRow(clientKey: string): RuntimeAssistantRow {
  return {
    kind: 'client_assistant',
    clientKey,
    content: '',
    thinking: '',
    isStreaming: true,
  };
}

function optionalNonnegative(value: unknown): number | undefined | 'invalid' {
  if (value === undefined) return undefined;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 'invalid';
}

export function applyAssistantTraceEvent(
  current: RuntimeAssistantTrace | undefined,
  event: AssistantTraceEvent,
): { trace?: RuntimeAssistantTrace; warning?: string } {
  if (!current) {
    if (event.sequence !== 0) return { warning: 'assistant_trace 首个 sequence 不是 0（已隔离）' };
    current = { runId: event.runId, lastSequence: -1, items: [] };
  } else {
    if (event.runId !== current.runId) return { trace: current, warning: 'assistant_trace run_id 发生漂移（已隔离）' };
    if (event.sequence !== current.lastSequence + 1) {
      return { trace: current, warning: 'assistant_trace sequence 非严格递增（已隔离）' };
    }
  }

  // A structurally valid event at the expected sequence is quarantined by
  // advancing sequence even when its item lifecycle is inconsistent. This
  // prevents one bad item from poisoning every later, otherwise valid item.
  const advanced = { ...current, lastSequence: event.sequence };
  const items = current.items;
  if (event.kind === 'thinking') {
    const last = items.at(-1);
    if (last?.kind === 'thinking' && last.itemId === event.itemId) {
      return {
        trace: {
          ...advanced,
          items: [...items.slice(0, -1), { ...last, text: last.text + event.textDelta }],
        },
      };
    }
    if (items.some((item) => item.itemId === event.itemId) || last?.kind === 'thinking') {
      return { trace: advanced, warning: 'assistant_trace thinking item_id 顺序无效（已隔离）' };
    }
    return {
      trace: {
        ...advanced,
        items: [...items, { itemId: event.itemId, order: items.length, kind: 'thinking', text: event.textDelta }],
      },
    };
  }

  if (event.lifecycle === 'started') {
    if (
      items.some((item) => item.itemId === event.itemId) ||
      items.some((item) => item.kind === 'tool' && item.callId === event.callId)
    ) {
      return { trace: advanced, warning: 'assistant_trace tool identity 重复（已隔离）' };
    }
    const tool: AssistantRunTraceToolItem = {
      itemId: event.itemId,
      order: items.length,
      kind: 'tool',
      callId: event.callId,
      lifecycle: 'started',
      toolName: event.toolName,
      ...('argumentPreview' in event ? { argumentPreview: event.argumentPreview } : {}),
      ...('resultSummary' in event ? { resultSummary: event.resultSummary } : {}),
      ...('errorSummary' in event ? { errorSummary: event.errorSummary } : {}),
      ...('durationMs' in event ? { durationMs: event.durationMs } : {}),
    };
    return { trace: { ...advanced, items: [...items, tool] } };
  }

  const index = items.findIndex((item) => item.kind === 'tool' && item.callId === event.callId);
  const existing = index >= 0 ? items[index] : undefined;
  if (
    !existing || existing.kind !== 'tool' ||
    existing.itemId !== event.itemId ||
    existing.toolName !== event.toolName ||
    existing.lifecycle !== 'started'
  ) {
    return { trace: advanced, warning: 'assistant_trace tool lifecycle 或 identity 无效（已隔离）' };
  }
  const terminal: AssistantRunTraceToolItem = {
    ...existing,
    lifecycle: event.lifecycle,
    ...('argumentPreview' in event ? { argumentPreview: event.argumentPreview } : {}),
    ...('resultSummary' in event ? { resultSummary: event.resultSummary } : {}),
    ...('errorSummary' in event ? { errorSummary: event.errorSummary } : {}),
    ...('durationMs' in event ? { durationMs: event.durationMs } : {}),
  };
  const nextItems: AssistantRunTraceItem[] = [...items];
  nextItems[index] = terminal;
  return { trace: { ...advanced, items: nextItems } };
}

export function normalizeRuntimeTelemetry(value: unknown): RuntimeTelemetry | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const payload = value as TelemetryPayload;
  const inputChars = optionalNonnegative(payload.input_chars);
  const outputChars = optionalNonnegative(payload.output_chars);
  const cachedInputChars = optionalNonnegative(payload.cached_input_chars);
  const toolCalls = optionalNonnegative(payload.tool_calls);
  if (
    inputChars === 'invalid' ||
    outputChars === 'invalid' ||
    cachedInputChars === 'invalid' ||
    toolCalls === 'invalid' ||
    (toolCalls !== undefined && !Number.isInteger(toolCalls)) ||
    (payload.platform !== undefined && typeof payload.platform !== 'string') ||
    (payload.model_name !== undefined && typeof payload.model_name !== 'string')
  ) {
    return null;
  }
  return {
    ...(payload.platform !== undefined ? { platform: payload.platform } : {}),
    ...(payload.model_name !== undefined ? { modelName: payload.model_name } : {}),
    ...(inputChars !== undefined ? { inputChars } : {}),
    ...(outputChars !== undefined ? { outputChars } : {}),
    ...(toolCalls !== undefined ? { toolCalls } : {}),
    ...(cachedInputChars !== undefined ? { cachedInputChars } : {}),
  };
}

/**
 * One pure event application boundary shared by SSE and async polling.
 * Structured metadata is retained on the runtime overlay and never appended
 * to answer content. Terminal transitions remain controller-owned.
 */
export function applyNormalizedEvent(
  prev: RuntimeAssistantRow | null,
  ev: NormalizedSSEEvent,
  clientKey: string,
): { next: RuntimeAssistantRow | null; warning?: string } {
  switch (ev.event) {
    case 'content': {
      if (ev.data.length === 0) return { next: prev, warning: '收到空的 content 事件载荷' };
      const row = prev ?? baseRow(clientKey);
      return { next: { ...row, content: row.content + ev.data } };
    }

    case 'status': {
      const row = prev ?? baseRow(clientKey);
      return { next: { ...row, statusText: ev.data } };
    }

    case 'thinking': {
      if (ev.data.length === 0) return { next: prev, warning: '收到空的 thinking 事件载荷' };
      const row = prev ?? baseRow(clientKey);
      // Backend keeps legacy thinking for V3 compatibility. Once structured
      // trace exists, consuming it again would double-display the same text.
      if (row.assistantTrace && row.assistantTrace.items.length > 0) return { next: row };
      return { next: { ...row, thinking: row.thinking + ev.data } };
    }

    case 'assistant_trace': {
      const payload = ev.parsedData as AssistantTraceEvent | undefined;
      if (!payload) return { next: prev, warning: 'assistant_trace 事件字段无效（已隔离）' };
      const row = prev ?? baseRow(clientKey);
      const applied = applyAssistantTraceEvent(row.assistantTrace, payload);
      if (!applied.trace) return { next: row, warning: applied.warning };
      return {
        next: {
          ...row,
          thinking: applied.trace.items.length > 0 ? '' : row.thinking,
          assistantTrace: applied.trace,
        },
        ...(applied.warning ? { warning: applied.warning } : {}),
      };
    }

    case 'telemetry': {
      const telemetry = normalizeRuntimeTelemetry(ev.parsedData);
      if (!telemetry) return { next: prev, warning: 'telemetry 事件字段无效（已隔离）' };
      const row = prev ?? baseRow(clientKey);
      return { next: { ...row, telemetry } };
    }

    case 'cache_skipped': {
      const payload = ev.parsedData as Partial<CacheSkippedPayload> | undefined;
      if (!payload || typeof payload.reason !== 'string' || payload.reason.length === 0) {
        return { next: prev, warning: 'cache_skipped 事件字段无效（已隔离）' };
      }
      const row = prev ?? baseRow(clientKey);
      return { next: { ...row, cacheSkippedReason: payload.reason } };
    }

    case 'unknown':
    case 'malformed':
      return { next: prev, warning: ev.warning ?? '收到无法识别的协议事件（已忽略）' };

    default:
      return { next: prev };
  }
}
