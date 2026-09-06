import { describe, expect, it } from 'vitest';
import {
  SSEFrameDecoder,
  normalizePollingEvent,
  normalizeSSEEvent,
  parseRawSSEFrame,
} from '../features/chat/runtime/sse';

describe('P1B SSE Frame Decoder & Event Normalizer (§9.3)', () => {
  it('handles arbitrary chunk boundaries, CRLF and LF, and multi-byte UTF-8 split across chunks', () => {
    const decoder = new SSEFrameDecoder();
    const encoder = new TextEncoder();

    // Chinese characters: "西娅，圣光与你同在" (multi-byte UTF-8)
    const fullText = 'event: content\r\ndata: 西娅，圣光与你同在\r\n\r\n';
    const bytes = encoder.encode(fullText);

    // Split right in the middle of a 3-byte UTF-8 sequence
    const splitIndex = 25; // somewhere inside "西娅"
    const part1 = bytes.slice(0, splitIndex);
    const part2 = bytes.slice(splitIndex);

    const frames1 = decoder.pushChunk(part1);
    expect(frames1).toHaveLength(0); // Not completed yet

    const frames2 = decoder.pushChunk(part2);
    expect(frames2).toHaveLength(1);

    const { event, data } = parseRawSSEFrame(frames2[0]);
    expect(event).toBe('content');
    const normalized = normalizeSSEEvent(event, data);
    expect(normalized.data).toBe('西娅，圣光与你同在');
  });

  it('joins multiple data lines with \\n and ignores comment lines', () => {
    const frame = ': heartbeat ping\nevent: thinking\ndata: line 1\ndata: line 2\ndata: line 3';
    const { event, data } = parseRawSSEFrame(frame);
    expect(event).toBe('thinking');
    expect(data).toBe('line 1\nline 2\nline 3');

    const normalized = normalizeSSEEvent(event, data);
    expect(normalized.event).toBe('thinking');
    expect(normalized.data).toBe('line 1\nline 2\nline 3');
  });

  it('normalizes payloads strictly by event kind: content/thinking/status to strings, structured to objects', () => {
    // 1. content JSON string vs plain string
    const norm1 = normalizeSSEEvent('content', JSON.stringify('Hello World'));
    expect(norm1.data).toBe('Hello World');

    const norm2 = normalizeSSEEvent('content', 'Hello Raw');
    expect(norm2.data).toBe('Hello Raw');

    // 2. status is string-only on the wire (R2-03): an object payload is a
    //    visible nonfatal malformed event and never exposes message/args.
    const statusPayload = JSON.stringify({ message: '正在检索记忆', tool: 'smart_read' });
    const normStatus = normalizeSSEEvent('status', statusPayload);
    expect(normStatus.event).toBe('malformed');
    expect(normStatus.warning).toBeTruthy();
    expect(normStatus.event).not.toBe('status');

    // 3. telemetry
    const telPayload = JSON.stringify({
      platform: 'deepseek',
      model_name: 'v4-flash',
      input_chars: 100,
      output_chars: 50,
      tool_calls: 2,
    });
    const normTel = normalizeSSEEvent('telemetry', telPayload);
    expect(normTel.event).toBe('telemetry');
    expect(normTel.parsedData).toMatchObject({
      platform: 'deepseek',
      model_name: 'v4-flash',
      input_chars: 100,
      output_chars: 50,
    });

    // 4. stopped
    const normStopped = normalizeSSEEvent('stopped', JSON.stringify({ partial: true }));
    expect(normStopped.event).toBe('stopped');
    expect(normStopped.parsedData).toEqual({ partial: true });

    // 5. done
    const normDone = normalizeSSEEvent('done', '[DONE]');
    expect(normDone.event).toBe('done');
    expect(normDone.data).toBe('[DONE]');

    // 6. cache_skipped
    const normCache = normalizeSSEEvent('cache_skipped', JSON.stringify({ reason: 'platform_not_supported' }));
    expect(normCache.event).toBe('cache_skipped');
    expect(normCache.parsedData).toEqual({ reason: 'platform_not_supported' });
  });

  it('unknown or malformed events are categorized as "unknown" and NEVER treated as content', () => {
    const normUnknown = normalizeSSEEvent('random_event_x', 'foo bar payload');
    expect(normUnknown.event).toBe('unknown');
    expect(normUnknown.data).toBe('foo bar payload');
  });

  it('flushes residual frames on EOF', () => {
    const decoder = new SSEFrameDecoder();
    decoder.pushText('event: content\ndata: final words');
    // Without double newline, flush should yield the frame
    const flushed = decoder.flush();
    expect(flushed).toHaveLength(1);
    const { event, data } = parseRawSSEFrame(flushed[0]);
    expect(event).toBe('content');
    expect(data).toBe('final words');
  });
});

describe('P1B R1-04 strict normalization additions', () => {
  it('reports a JSON-object content payload as malformed — never answer content', () => {
    const norm = normalizeSSEEvent('content', JSON.stringify({ text: 'bogus' }));
    expect(norm.event).toBe('malformed');
    expect(norm.warning).toMatch(/载荷是 JSON 对象/);
    // Malformed events are never classified as content; the event boundary
    // (applyNormalizedEvent) never appends them to answer text.
    expect(norm.event).not.toBe('content');
  });

  it('reports a non-object telemetry payload as malformed with warning, not a silent empty object', () => {
    const norm = normalizeSSEEvent('telemetry', 'plain string');
    expect(norm.event).toBe('malformed');
    expect(norm.warning).toBeTruthy();
  });

  it('normalizes polling events into the same vocabulary', () => {
    // structured telemetry delta stays object; content object is malformed
    const tel = normalizePollingEvent({ event_type: 'telemetry', delta: { platform: 'deepseek' } });
    expect(tel.event).toBe('telemetry');
    expect(tel.parsedData).toEqual({ platform: 'deepseek' });

    const badContent = normalizePollingEvent({ event_type: 'content', delta: { x: 1 } });
    expect(badContent.event).toBe('malformed');
    expect(badContent.warning).toBeTruthy();

    const strContent = normalizePollingEvent({ event_type: 'content', delta: 'hi' });
    expect(strContent.event).toBe('content');
    expect(strContent.data).toBe('hi');

    const unknown = normalizePollingEvent({ event_type: 'brand_new_kind', delta: 'x' });
    expect(unknown.event).toBe('unknown');
    expect(unknown.warning).toMatch(/未知轮询事件类型/);

    const malformedItem = normalizePollingEvent({ delta: 'x' } as never);
    expect(malformedItem.event).toBe('malformed');
  });
});
