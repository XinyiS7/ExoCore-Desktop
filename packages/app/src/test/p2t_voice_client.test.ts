import { afterEach, describe, expect, it } from 'vitest';
import {
  readMessageVoiceRender,
  startMessageVoiceRender,
} from '../features/chat/tts/api';
import type { TtsOutcome } from '../features/chat/tts/types';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const PATH = '/api/agents/conversations/5/messages/42/tts/';
const CONTENT_URL = '/api/agents/conversations/5/messages/42/tts/content/';

afterEach(() => unmockFetch());

describe('P2T voice client — transport boundary', () => {
  it('POSTs the exact message identity path with an empty {} body', async () => {
    const { calls } = installFetch([
      { test: PATH, method: 'POST', handler: () => jsonResponse({ status: 'generating', retry_after_ms: 1500 }, 202) },
    ]);
    await startMessageVoiceRender(5, 42);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe(PATH);
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.credentials).toBe('include');
    expect((calls[0].init?.headers as Record<string, string>)?.['X-CSRFToken']).toBeDefined();
    // INV-2: identity only — no text, emotion, profile or client cache key.
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({});
  });

  it('GETs the same path and never triggers a POST', async () => {
    const { calls } = installFetch([
      { test: PATH, method: 'GET', handler: () => jsonResponse({ status: 'idle' }) },
    ]);
    await readMessageVoiceRender(5, 42);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe(PATH);
    expect(calls[0].init?.method).toBe('GET');
    expect(calls[0].init?.body).toBeUndefined();
  });

  it('forwards the caller signal on POST and rethrows abort as cancellation', async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | null = null;
    installFetch([
      {
        test: PATH,
        method: 'POST',
        handler: (_url, init) => {
          capturedSignal = init?.signal ?? null;
          return new Promise<Response>((_resolve, reject) => {
            capturedSignal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          });
        },
      },
    ]);
    const pending = startMessageVoiceRender(5, 42, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(capturedSignal).not.toBeNull();
  });

  it('forwards the caller signal on GET and rethrows abort as cancellation', async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | null = null;
    installFetch([
      {
        test: PATH,
        method: 'GET',
        handler: (_url, init) => {
          capturedSignal = init?.signal ?? null;
          return new Promise<Response>((_resolve, reject) => {
            capturedSignal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          });
        },
      },
    ]);
    const pending = readMessageVoiceRender(5, 42, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(capturedSignal).not.toBeNull();
  });
});

type OutcomeCase = {
  name: string;
  method: 'GET' | 'POST';
  status: number;
  body: unknown;
  expected: TtsOutcome;
};

describe('P2T voice client — D3 outcome matrix', () => {
  const cases: OutcomeCase[] = [
    {
      name: 'POST 200 playable maps content_url verbatim',
      method: 'POST',
      status: 200,
      body: { status: 'playable', content_url: CONTENT_URL, duration_ms: 3200 },
      expected: { phase: 'playable', playable: { contentUrl: CONTENT_URL, durationMs: 3200 } },
    },
    {
      name: 'GET 200 playable maps the same way',
      method: 'GET',
      status: 200,
      body: { status: 'playable', content_url: CONTENT_URL, duration_ms: 0 },
      expected: { phase: 'playable', playable: { contentUrl: CONTENT_URL, durationMs: 0 } },
    },
    {
      name: 'POST 202 generating honors retry_after_ms',
      method: 'POST',
      status: 202,
      body: { status: 'generating', retry_after_ms: 1500 },
      expected: { phase: 'generating', retryAfterMs: 1500 },
    },
    {
      name: 'GET 202 generating honors retry_after_ms',
      method: 'GET',
      status: 202,
      body: { status: 'generating', retry_after_ms: 900 },
      expected: { phase: 'generating', retryAfterMs: 900 },
    },
    {
      name: 'POST 202 generating honors a non-default interval (2700)',
      method: 'POST',
      status: 202,
      body: { status: 'generating', retry_after_ms: 2700 },
      expected: { phase: 'generating', retryAfterMs: 2700 },
    },
    {
      name: 'GET 200 idle stays idle (stable backend reset)',
      method: 'GET',
      status: 200,
      body: { status: 'idle' },
      expected: { phase: 'idle' },
    },
    {
      name: 'POST 404 is unavailable/not_found',
      method: 'POST',
      status: 404,
      body: { error: 'not_found', message: 'Conversation or message not found.' },
      expected: { phase: 'unavailable', code: 'not_found' },
    },
    {
      name: 'GET 404 is unavailable/not_found',
      method: 'GET',
      status: 404,
      body: { error: 'not_found', message: 'Conversation or message not found.' },
      expected: { phase: 'unavailable', code: 'not_found' },
    },
    {
      name: '422 ineligible_message is unavailable',
      method: 'POST',
      status: 422,
      body: { error: 'ineligible_message', message: 'Only assistant messages with text can be rendered.' },
      expected: { phase: 'unavailable', code: 'ineligible_message' },
    },
    {
      name: '422 no_active_profile is unavailable',
      method: 'POST',
      status: 422,
      body: { error: 'no_active_profile', message: 'Agent preset has no active voice profile.' },
      expected: { phase: 'unavailable', code: 'no_active_profile' },
    },
    {
      name: '503 runtime_offline is retryable with backend copy',
      method: 'POST',
      status: 503,
      body: { status: 'failed_retryable', code: 'runtime_offline', message: 'Voice runtime is offline.' },
      expected: { phase: 'failed_retryable', code: 'runtime_offline', message: 'Voice runtime is offline.' },
    },
    {
      name: 'GET 503 runtime_offline is retryable',
      method: 'GET',
      status: 503,
      body: { status: 'failed_retryable', code: 'runtime_offline', message: 'Voice runtime is offline.' },
      expected: { phase: 'failed_retryable', code: 'runtime_offline', message: 'Voice runtime is offline.' },
    },
    {
      name: '504 generation_timeout is retryable',
      method: 'GET',
      status: 504,
      body: { status: 'failed_retryable', code: 'generation_timeout', message: 'Voice generation timed out.' },
      expected: { phase: 'failed_retryable', code: 'generation_timeout', message: 'Voice generation timed out.' },
    },
    {
      name: '500 generation_failed is retryable',
      method: 'POST',
      status: 500,
      body: { status: 'failed_retryable', code: 'generation_failed', message: 'Voice generation failed.' },
      expected: { phase: 'failed_retryable', code: 'generation_failed', message: 'Voice generation failed.' },
    },
    {
      name: 'unknown backend code degrades to the status-implied code',
      method: 'POST',
      status: 500,
      body: { status: 'failed_retryable', code: 'corrupt_artifact', message: 'internal' },
      expected: { phase: 'failed_retryable', code: 'generation_failed', message: 'internal' },
    },
    {
      name: '404 never guesses a playable state from its body',
      method: 'GET',
      status: 404,
      body: { status: 'playable', content_url: CONTENT_URL, duration_ms: 3200 },
      expected: { phase: 'unavailable', code: 'not_found' },
    },
    {
      name: 'malformed 200 body is a contract failure, never silent success',
      method: 'POST',
      status: 200,
      body: {},
      expected: { phase: 'failed_retryable', code: 'contract', message: null },
    },
    {
      name: 'malformed 202 body is a contract failure',
      method: 'POST',
      status: 202,
      body: { status: 'queued' },
      expected: { phase: 'failed_retryable', code: 'contract', message: null },
    },
    {
      name: 'playable without content_url cannot fabricate a resource identity',
      method: 'POST',
      status: 200,
      body: { status: 'playable', duration_ms: 3200 },
      expected: { phase: 'failed_retryable', code: 'contract', message: null },
    },
    {
      name: 'a 2xx failed_retryable body is never painted as success',
      method: 'GET',
      status: 200,
      body: { status: 'failed_retryable', code: 'runtime_offline', message: 'Voice runtime is offline.' },
      expected: { phase: 'failed_retryable', code: 'runtime_offline', message: 'Voice runtime is offline.' },
    },
  ];

  it.each(cases)('$name', async ({ method, status, body, expected }) => {
    installFetch([{ test: PATH, method, handler: () => jsonResponse(body, status) }]);
    const call = method === 'POST' ? startMessageVoiceRender(5, 42) : readMessageVoiceRender(5, 42);
    await expect(call).resolves.toEqual(expected);
  });

  it('treats a non-JSON 2xx body as a contract failure', async () => {
    installFetch([
      { test: PATH, method: 'POST', handler: () => new Response('<html>proxy</html>', { status: 200 }) },
    ]);
    await expect(startMessageVoiceRender(5, 42)).resolves.toEqual({
      phase: 'failed_retryable',
      code: 'contract',
      message: null,
    });
  });

  it('maps a network failure to retryable with the transport message', async () => {
    installFetch([
      {
        test: PATH,
        method: 'POST',
        handler: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    ]);
    const outcome = await startMessageVoiceRender(5, 42);
    expect(outcome).toMatchObject({ phase: 'failed_retryable', code: 'network' });
    if (outcome.phase === 'failed_retryable') expect(outcome.message).toBeTruthy();
  });

  it('keeps a non-JSON 5xx body retryable with null copy', async () => {
    installFetch([
      { test: PATH, method: 'GET', handler: () => new Response('gateway error', { status: 502 }) },
    ]);
    await expect(readMessageVoiceRender(5, 42)).resolves.toEqual({
      phase: 'failed_retryable',
      code: 'generation_failed',
      message: null,
    });
  });
});

describe('P2T voice client — F1 malformed required generating timing', () => {
  // Generalized beyond the original five reports: every malformed shape is
  // swept across BOTH actions because start/read share one decoder.
  const malformed = [
    { label: 'missing', wire: '{"status":"generating"}' },
    { label: 'null', wire: '{"status":"generating","retry_after_ms":null}' },
    { label: 'wrong type (string)', wire: '{"status":"generating","retry_after_ms":"1500"}' },
    { label: 'wrong type (boolean)', wire: '{"status":"generating","retry_after_ms":true}' },
    { label: 'zero', wire: '{"status":"generating","retry_after_ms":0}' },
    { label: 'negative', wire: '{"status":"generating","retry_after_ms":-250}' },
    { label: 'nonfinite', wire: '{"status":"generating","retry_after_ms":1e999}' },
  ];
  const cases = (['POST', 'GET'] as const).flatMap((method) =>
    malformed.map((entry) => ({ name: `${method} ${entry.label}`, method, wire: entry.wire })),
  );

  it.each(cases)('$name → failed_retryable/contract with no invented schedule', async ({ method, wire }) => {
    const { calls } = installFetch([
      {
        test: PATH,
        method,
        handler: () =>
          new Response(wire, { status: 202, headers: { 'Content-Type': 'application/json' } }),
      },
    ]);
    const call = method === 'POST' ? startMessageVoiceRender(5, 42) : readMessageVoiceRender(5, 42);
    await expect(call).resolves.toEqual({ phase: 'failed_retryable', code: 'contract', message: null });
    expect(calls).toHaveLength(1);
  });

  it.each(['POST', 'GET'] as const)(
    'keeps an arbitrary positive finite interval (%s)',
    async (method) => {
      installFetch([
        {
          test: PATH,
          method,
          handler: () => jsonResponse({ status: 'generating', retry_after_ms: 2700 }, 202),
        },
      ]);
      const call = method === 'POST' ? startMessageVoiceRender(5, 42) : readMessageVoiceRender(5, 42);
      await expect(call).resolves.toEqual({ phase: 'generating', retryAfterMs: 2700 });
    },
  );
});
