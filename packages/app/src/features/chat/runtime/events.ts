import type { NormalizedSSEEvent, RuntimeAssistantRow } from './types';

/**
 * Shared normalized-event application boundary (C1B-R1-04).
 *
 * Both the SSE consumption loop and the async polling loop route their
 * normalized events through this single pure function so content/status/
 * structured/unknown/malformed semantics cannot drift between transports.
 *
 * - 'content' appends to answer text;
 * - 'status' updates the latest status text;
 * - 'thinking' / 'telemetry' / 'cache_skipped' are retained internally but
 *   never exposed as visible answer content in P1B (P1D owns that surface);
 * - 'unknown' / 'malformed' never touch answer text; they surface a nonfatal
 *   protocol warning through the returned `warning` field;
 * - terminal events ('done' / 'stopped' / 'error') are NOT handled here —
 *   the controller owns terminal transitions and reconciliation.
 */
export function applyNormalizedEvent(
  prev: RuntimeAssistantRow | null,
  ev: NormalizedSSEEvent,
  clientKey: string,
): { next: RuntimeAssistantRow | null; warning?: string } {
  switch (ev.event) {
    case 'content': {
      if (ev.data.length === 0) {
        return { next: prev, warning: '收到空的 content 事件载荷' };
      }
      if (!prev) {
        return {
          next: {
            kind: 'client_assistant',
            clientKey,
            content: ev.data,
            isStreaming: true,
          },
        };
      }
      return { next: { ...prev, content: prev.content + ev.data } };
    }

    case 'status': {
      if (!prev) {
        return {
          next: {
            kind: 'client_assistant',
            clientKey,
            content: '',
            statusText: ev.data,
            isStreaming: true,
          },
        };
      }
      return { next: { ...prev, statusText: ev.data } };
    }

    case 'thinking':
    case 'telemetry':
    case 'cache_skipped': {
      // Retained internally for correctness; no visible P1B surface.
      return { next: prev };
    }

    case 'unknown':
    case 'malformed': {
      return {
        next: prev,
        warning: ev.warning ?? '收到无法识别的协议事件（已忽略）',
      };
    }

    default: {
      return { next: prev };
    }
  }
}
