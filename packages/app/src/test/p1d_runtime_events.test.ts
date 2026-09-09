import { describe, expect, it } from 'vitest';
import { applyNormalizedEvent } from '../features/chat/runtime/events';
import type { NormalizedSSEEvent, RuntimeAssistantRow } from '../features/chat/runtime/types';

const event = (name: NormalizedSSEEvent['event'], data: string, parsedData?: unknown): NormalizedSSEEvent => ({
  event: name,
  data,
  parsedData,
});

const row: RuntimeAssistantRow = {
  kind: 'client_assistant',
  clientKey: 'assistant:1',
  content: 'answer',
  thinking: '',
  isStreaming: true,
};

describe('P1D shared runtime event application', () => {
  it('retains thinking separately from answer content', () => {
    const first = applyNormalizedEvent(row, event('thinking', 'Think A'), row.clientKey).next;
    const second = applyNormalizedEvent(first, event('thinking', ' + B'), row.clientKey).next;
    expect(second).toMatchObject({ content: 'answer', thinking: 'Think A + B' });
  });

  it('normalizes telemetry and isolates malformed counts', () => {
    const good = applyNormalizedEvent(
      row,
      event('telemetry', '', { model_name: 'm', tool_calls: 2, input_chars: 10 }),
      row.clientKey,
    );
    expect(good.next?.telemetry).toEqual({ modelName: 'm', toolCalls: 2, inputChars: 10 });

    const bad = applyNormalizedEvent(
      row,
      event('telemetry', '', { tool_calls: 'two' }),
      row.clientKey,
    );
    expect(bad.next).toBe(row);
    expect(bad.warning).toContain('telemetry');
  });

  it('retains cache-skipped reason outside answer content', () => {
    const result = applyNormalizedEvent(
      row,
      event('cache_skipped', '', { reason: 'future_reason' }),
      row.clientKey,
    );
    expect(result.next).toMatchObject({ content: 'answer', cacheSkippedReason: 'future_reason' });
  });
});
