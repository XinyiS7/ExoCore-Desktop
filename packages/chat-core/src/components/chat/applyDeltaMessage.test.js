import { describe, it, expect } from 'vitest';
import { applyDeltaToMessage } from './applyDeltaMessage';

const baseMsg = () => ({
  content: 'hello',
  reasoning_content: '',
  status_text: 'working',
  reasoning_steps: [],
  new_anchors: [],
});

describe('applyDeltaToMessage — dict deltas must never enter the message body', () => {
  it('string content delta appends to content and clears status_text', () => {
    const m = applyDeltaToMessage(baseMsg(), ' world', 'content');
    expect(m.content).toBe('hello world');
    expect(m.status_text).toBeNull();
  });

  it('telemetry dict leaves the message untouched', () => {
    const m = applyDeltaToMessage(baseMsg(), { input_chars: 12, output_chars: 3 }, 'telemetry');
    expect(m.content).toBe('hello');
    expect(m.status_text).toBe('working');
  });

  it('cache_skipped dict leaves the message untouched', () => {
    const m = applyDeltaToMessage(baseMsg(), { reason: 'no cache' }, 'cache_skipped');
    expect(m.content).toBe('hello');
  });

  it('assistant_trace dict leaves the message untouched', () => {
    const m = applyDeltaToMessage(baseMsg(), { sequence: 0 }, 'assistant_trace');
    expect(m.content).toBe('hello');
  });

  it('unknown dict event type is ignored (no [object Object])', () => {
    const m = applyDeltaToMessage(baseMsg(), { weird: true }, 'future_dict_event');
    expect(m.content).toBe('hello');
  });

  it('thinking / status / anchor_created behavior unchanged', () => {
    const m = applyDeltaToMessage(baseMsg(), 'thinking...', 'thinking');
    expect(m.reasoning_content).toBe('thinking...');
    expect(m.status_text).toBeNull();

    const m2 = applyDeltaToMessage(baseMsg(), 'tool running', 'status');
    expect(m2.status_text).toBe('tool running');

    const m3 = applyDeltaToMessage(baseMsg(), JSON.stringify({ id: 'a' }), 'anchor_created');
    expect(m3.new_anchors).toEqual([{ id: 'a' }]);
  });
});
