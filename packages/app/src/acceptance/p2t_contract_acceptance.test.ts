import { afterEach, expect, it, vi } from 'vitest';
import { fetchMessagePage } from '../features/chat/api';
import { startMessageVoiceRender, readMessageVoiceRender } from '../features/chat/tts/api';

afterEach(() => vi.unstubAllGlobals());
function wire(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const start = startMessageVoiceRender;
const read = readMessageVoiceRender;

it('T1 real read boundary preserves text and strips malformed/private voice fields', async () => {
  const voices = [
    { available: true, directed: false, cached: true, emotion: 'private' },
    { available: true, directed: 'false', cached: true },
    null,
    { available: true, directed: true, cached: false },
  ];
  wire(200, { messages: voices.map((voice, i) => ({
    id: 71 + i, role: i === 3 ? 'user' : 'assistant', content: `canonical-${i}`,
    created_at: '2026-09-12T00:00:00Z', attachment_ids: [], voice,
  })), total_count: 4, has_more: false });
  const page = await fetchMessagePage(19, 0);
  expect(page.messages.map(m => m.content)).toEqual(voices.map((_, i) => `canonical-${i}`));
  expect(page.messages.map(m => m.voice)).toEqual([
    { available: true, directed: false, cached: true }, null, null, null,
  ]);
});

it.each([['POST', start], ['GET', read]] as const)('T2 %s identity and signal traverse real transport', async (method, invoke) => {
  const fetch = wire(200, { status: 'idle' });
  const controller = new AbortController();
  await invoke(19, 71, controller.signal);
  const call = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(new URL(call[0], window.location.origin).pathname).toBe('/api/agents/conversations/19/messages/71/tts/');
  expect(call[1].signal).toBe(controller.signal);
  expect(call[1].method ?? 'GET').toBe(method);
  expect(call[1].body).toBe(method === 'POST' ? '{}' : undefined);
});

it.each([
  [200, { status: 'playable', content_url: '/api/voice.wav', duration_ms: 0 }, 'playable', undefined],
  [202, { status: 'generating', retry_after_ms: 2700 }, 'generating', undefined],
  [200, { status: 'idle' }, 'idle', undefined],
  [404, { status: 'playable', content_url: '/wrong.wav', error: 'not_found' }, 'unavailable', 'not_found'],
  [422, { error: 'ineligible_message' }, 'unavailable', 'ineligible_message'],
  [422, { error: 'no_active_profile' }, 'unavailable', 'no_active_profile'],
  [503, { code: 'runtime_offline' }, 'failed_retryable', 'runtime_offline'],
  [504, { code: 'generation_timeout' }, 'failed_retryable', 'generation_timeout'],
  [500, { code: 'generation_failed' }, 'failed_retryable', 'generation_failed'],
  [200, { status: 'playable', content_url: 42 }, 'failed_retryable', 'contract'],
  [202, [], 'failed_retryable', 'contract'],
  [200, { status: 'mystery' }, 'failed_retryable', 'contract'],
] as const)('T3 response %s %j maps truthfully', async (status, body, phase, code) => {
  wire(status, body);
  const result = await read(19, 71);
  expect(result.phase).toBe(phase);
  if (code) expect(result).toMatchObject({ code });
  if (phase === 'generating') expect(result).toMatchObject({ retryAfterMs: 2700 });
  if (phase === 'playable') expect(result).toMatchObject({ playable: { contentUrl: '/api/voice.wav', durationMs: 0 } });
});

it.each([undefined, null, '1500', 0, -1])('T3 malformed generating interval %j is contract failure, not invented polling', async (interval) => {
  wire(202, { status: 'generating', retry_after_ms: interval });
  await expect(read(19, 71)).resolves.toMatchObject({ phase: 'failed_retryable', code: 'contract' });
});

it('T3 network failure stays retryable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  await expect(start(19, 71)).resolves.toMatchObject({ phase: 'failed_retryable', code: 'network' });
});
it.each([start, read])('T2 abort is propagated rather than painted as failure', async invoke => {
  const error = new DOMException('aborted', 'AbortError');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
  await expect(invoke(19, 71)).rejects.toBe(error);
});