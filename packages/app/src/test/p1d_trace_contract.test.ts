import { afterEach, describe, expect, it } from 'vitest';
import { fetchMessagePage, normalizeAssistantRunTrace } from '../features/chat/api';
import { applyNormalizedEvent } from '../features/chat/runtime/events';
import { normalizePollingEvent, normalizeSSEEvent } from '../features/chat/runtime/sse';
import type { RuntimeAssistantRow } from '../features/chat/runtime/types';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const baseRow: RuntimeAssistantRow = {
  kind: 'client_assistant',
  clientKey: 'assistant:1',
  content: 'answer',
  thinking: 'legacy duplicate',
  isStreaming: true,
};

const thinking = (sequence: number, itemId: string, text: string, runId = 'run-1') => ({
  version: 1,
  run_id: runId,
  sequence,
  item_id: itemId,
  kind: 'thinking',
  lifecycle: 'delta',
  text_delta: text,
});
const tool = (
  sequence: number,
  lifecycle: 'started' | 'succeeded' | 'failed',
  over: Record<string, unknown> = {},
) => ({
  version: 1,
  run_id: 'run-1',
  sequence,
  item_id: 'item-tool',
  kind: 'tool',
  call_id: 'call-1',
  lifecycle,
  tool_name: 'memory_search',
  argument_preview: 'mode=mixed',
  result_summary: null,
  error_summary: null,
  duration_ms: lifecycle === 'started' ? null : 12,
  ...over,
});

function applyWire(prev: RuntimeAssistantRow | null, wire: object) {
  return applyNormalizedEvent(
    prev,
    normalizeSSEEvent('assistant_trace', JSON.stringify(wire)),
    'assistant:1',
  );
}

afterEach(() => unmockFetch());

describe('P1D accepted assistant trace wire boundary', () => {
  it('normalizes SSE and polling into the same internal DTO', () => {
    const wire = tool(0, 'started');
    const sse = normalizeSSEEvent('assistant_trace', JSON.stringify(wire));
    const polling = normalizePollingEvent({ event_type: 'assistant_trace', delta: wire });
    expect(sse).toEqual(polling);
    expect(sse).toMatchObject({
      event: 'assistant_trace',
      parsedData: {
        runId: 'run-1', itemId: 'item-tool', callId: 'call-1',
        sequence: 0, lifecycle: 'started', toolName: 'memory_search',
      },
    });
  });

  it.each([
    { ...thinking(0, 'i', 'x'), version: 2 },
    { ...thinking(0, '', 'x') },
    { ...thinking(-1, 'i', 'x') },
    { ...thinking(0, 'i', ''), lifecycle: 'delta' },
    { ...tool(0, 'started'), call_id: '' },
    { ...tool(0, 'started'), lifecycle: 'incomplete' },
    { ...tool(0, 'started'), duration_ms: -1 },
    { ...tool(0, 'started'), argument_preview: 'x'.repeat(501) },
  ])('isolates malformed wire fields without answer or terminal contamination', (wire) => {
    const normalized = normalizeSSEEvent('assistant_trace', JSON.stringify(wire));
    expect(normalized.event).toBe('malformed');
    const applied = applyNormalizedEvent(baseRow, normalized, baseRow.clientKey);
    expect(applied.next).toBe(baseRow);
    expect(applied.next?.content).toBe('answer');
    expect(applied.next?.terminalKind).toBeUndefined();
    expect(applied.warning).toContain('assistant_trace');
  });
});

describe('P1D ordered runtime assistant trace', () => {
  it('accumulates Thinking/Tool/Thinking order and suppresses legacy thinking duplication', () => {
    let row: RuntimeAssistantRow | null = baseRow;
    row = applyWire(row, thinking(0, 'think-1', 'A')).next;
    expect(row?.thinking).toBe('');
    row = applyNormalizedEvent(
      row,
      { event: 'thinking', data: 'A', parsedData: 'A' },
      baseRow.clientKey,
    ).next;
    expect(row?.thinking).toBe('');
    row = applyWire(row, thinking(1, 'think-1', 'B')).next;
    row = applyWire(row, tool(2, 'started')).next;
    row = applyWire(row, tool(3, 'succeeded')).next;
    row = applyWire(row, thinking(4, 'think-2', 'C')).next;

    expect(row?.content).toBe('answer');
    expect(row?.assistantTrace).toEqual({
      runId: 'run-1',
      lastSequence: 4,
      items: [
        { itemId: 'think-1', order: 0, kind: 'thinking', text: 'AB' },
        {
          itemId: 'item-tool', order: 1, kind: 'tool', callId: 'call-1',
          lifecycle: 'succeeded', toolName: 'memory_search', argumentPreview: 'mode=mixed',
          resultSummary: null, errorSummary: null, durationMs: 12,
        },
        { itemId: 'think-2', order: 2, kind: 'thinking', text: 'C' },
      ],
    });
  });

  it('warns on run/sequence/lifecycle violations and quarantines one expected malformed item', () => {
    const terminalWithoutStart = applyWire(baseRow, tool(0, 'failed'));
    expect(terminalWithoutStart.warning).toContain('lifecycle');
    expect(terminalWithoutStart.next?.thinking).toBe('legacy duplicate');
    expect(terminalWithoutStart.next?.assistantTrace).toMatchObject({ lastSequence: 0, items: [] });

    const started = applyWire(baseRow, tool(0, 'started')).next;
    const repeatedTerminal = applyWire(started, tool(1, 'succeeded')).next;
    const badLifecycle = applyWire(repeatedTerminal, tool(2, 'failed'));
    expect(badLifecycle.warning).toContain('lifecycle');
    expect(badLifecycle.next?.assistantTrace?.lastSequence).toBe(2);
    expect(badLifecycle.next?.assistantTrace?.items[0]).toMatchObject({ lifecycle: 'succeeded' });

    const afterQuarantine = applyWire(badLifecycle.next, thinking(3, 'think-2', 'safe'));
    expect(afterQuarantine.warning).toBeUndefined();
    expect(afterQuarantine.next?.assistantTrace?.items).toHaveLength(2);

    const gap = applyWire(afterQuarantine.next, thinking(5, 'think-2', 'gap'));
    expect(gap.warning).toContain('sequence');
    expect(gap.next?.assistantTrace?.lastSequence).toBe(3);

    const drift = applyWire(afterQuarantine.next, thinking(4, 'think-2', 'drift', 'run-2'));
    expect(drift.warning).toContain('run_id');
    expect(drift.next?.assistantTrace?.runId).toBe('run-1');
  });
});

describe('P1D historical assistant trace normalization', () => {
  const available = {
    version: 1,
    availability: 'available',
    items: [
      { item_id: 't1', order: 0, kind: 'thinking', text: 'why' },
      {
        item_id: 'u1', order: 1, kind: 'tool', call_id: 'c1', lifecycle: 'incomplete',
        tool_name: 'memory_search', argument_preview: null, duration_ms: null,
      },
    ],
    truncated: true,
  };

  it('preserves available items and the optional truncated indicator', () => {
    expect(normalizeAssistantRunTrace(available)).toEqual({
      version: 1,
      availability: 'available',
      items: [
        { itemId: 't1', order: 0, kind: 'thinking', text: 'why' },
        {
          itemId: 'u1', order: 1, kind: 'tool', callId: 'c1', lifecycle: 'incomplete',
          toolName: 'memory_search', argumentPreview: null, durationMs: null,
        },
      ],
      truncated: true,
    });
    expect(normalizeAssistantRunTrace({
      version: 1, availability: 'legacy_unavailable', reason: 'ordering_unavailable',
    })).toEqual({ version: 1, availability: 'legacy_unavailable', reason: 'ordering_unavailable' });
  });

  it('fails closed on duplicate/unsorted identity and non-assistant trace data', async () => {
    expect(normalizeAssistantRunTrace({
      ...available,
      items: [available.items[1], available.items[0]],
    })).toBeNull();
    expect(normalizeAssistantRunTrace({
      ...available,
      items: [available.items[0], { ...available.items[0], order: 1 }],
    })).toBeNull();
    expect(normalizeAssistantRunTrace({
      version: 1,
      availability: 'available',
      items: Array.from({ length: 201 }, (_, order) => ({
        item_id: `item-${order}`, order, kind: 'thinking', text: 'x',
      })),
      truncated: true,
    })).toBeNull();

    installFetch([{
      test: '/api/agents/chat/7/',
      handler: () => jsonResponse({
        messages: [{
          id: 1, role: 'user', content: 'hello', reasoning_content: null,
          assistant_run_trace: available, platform: null, model_version: null,
          token_count: null, index_in_session: 0, attachment_ids: [],
          attachments_meta: [], created_at: '2026-09-01T00:00:00Z',
        }],
        total_count: 1, has_more: false,
      }),
    }]);
    const page = await fetchMessagePage(7, 0);
    expect(page.messages[0].assistantRunTrace).toBeNull();
    expect(page.messages[0].content).toBe('hello');
  });
});
