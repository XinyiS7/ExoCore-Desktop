import { afterEach, describe, expect, it } from 'vitest';
import { fetchChatSSEStream, postChatAsync } from '../features/chat/runtime/client';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

afterEach(() => unmockFetch());

const SSE = () =>
  new Response('data: {"event":"done"}\n\n', {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

function bodyOf(call: { init?: RequestInit } | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.init?.body)) as Record<string, unknown>;
}

/**
 * V4 Force Cache Send — client wire contract (capability recovery).
 * Invariant: `force_cache_rebuild=true` is serialized ONLY for an explicit
 * force entry; ordinary sends omit the field entirely (both transports).
 */
describe('P1D force cache wire contract', () => {
  it('serializes force_cache_rebuild=true only for explicit true (SSE)', async () => {
    const { calls } = installFetch([{ test: '/api/agents/chat/42/', method: 'POST', handler: () => SSE() }]);
    await fetchChatSSEStream({ conversationId: 42, content: 'rebuild', forceCacheRebuild: true });
    expect(bodyOf(calls[0]).force_cache_rebuild).toBe(true);
    expect(bodyOf(calls[0]).content).toBe('rebuild');
  });

  it('serializes force_cache_rebuild=true only for explicit true (async)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => jsonResponse({ message_id: 'abcd1234', status: 'processing' }) },
    ]);
    await postChatAsync({ conversationId: 42, content: 'rebuild', forceCacheRebuild: true });
    expect(bodyOf(calls[0]).force_cache_rebuild).toBe(true);
  });

  it('ordinary sends omit force_cache_rebuild entirely (SSE + async, no drift)', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: (url) =>
          url.searchParams.get('mode') === 'async'
            ? jsonResponse({ message_id: 'wxyz5678', status: 'processing' })
            : SSE(),
      },
    ]);
    await fetchChatSSEStream({ conversationId: 42, content: 'plain' });
    await postChatAsync({ conversationId: 42, content: 'plain', pendingAttachments: [3] });
    expect('force_cache_rebuild' in bodyOf(calls[0])).toBe(false);
    expect('force_cache_rebuild' in bodyOf(calls[1])).toBe(false);
    // Ordinary attachment send keeps its own field and nothing else new.
    expect(bodyOf(calls[1])).toMatchObject({ content: 'plain', pending_attachments: [3] });
  });

  it('explicit false behaves like an ordinary send — never serializes', async () => {
    const { calls } = installFetch([{ test: '/api/agents/chat/42/', method: 'POST', handler: () => SSE() }]);
    await fetchChatSSEStream({ conversationId: 42, content: 'x', forceCacheRebuild: false });
    expect('force_cache_rebuild' in bodyOf(calls[0])).toBe(false);
  });

  it('non-boolean force flag is a VALIDATION rejection before any dispatch', async () => {
    const { calls } = installFetch([{ test: '/api/agents/chat/42/', method: 'POST', handler: () => SSE() }]);
    await expect(
      fetchChatSSEStream({ conversationId: 42, content: 'x', forceCacheRebuild: 'yes' as unknown as boolean }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      postChatAsync({ conversationId: 42, content: 'x', forceCacheRebuild: 1 as unknown as boolean }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(calls).toHaveLength(0);
  });

  it('force flag coexists with pending_attachments on the same turn (SSE)', async () => {
    const { calls } = installFetch([{ test: '/api/agents/chat/42/', method: 'POST', handler: () => SSE() }]);
    await fetchChatSSEStream({ conversationId: 42, content: '', pendingAttachments: [7], forceCacheRebuild: true });
    expect(bodyOf(calls[0])).toMatchObject({ content: '', pending_attachments: [7], force_cache_rebuild: true });
  });
});