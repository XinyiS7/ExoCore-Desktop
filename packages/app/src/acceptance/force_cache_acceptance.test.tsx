import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useChatRuntime } from '../features/chat/runtime/useChatRuntime';
import { fetchChatSSEStream, postChatAsync } from '../features/chat/runtime/client';
import { installFetch, jsonResponse, unmockFetch } from '../test/helpers';

beforeEach(() => window.localStorage.clear());
afterEach(() => { unmockFetch(); window.localStorage.clear(); });
const settings = { model: 'deepseek-v4-flash', endpoint: 7, thinkingLevel: 'medium', cacheEnabled: false, sessionType: 'full' as const };
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}
for (const transport of ['sse', 'async']) {
  it(`${transport}: force is one-shot and never changes cache preference or the following turn`, async () => {
    window.localStorage.setItem('exo:v4:chat-transport', transport);
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => transport === 'async'
        ? jsonResponse({ message_id: 'abcd1234', status: 'processing' })
        : new Response('event: done\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } }) },
      { test: '/api/agents/chat/42/status/', handler: () => jsonResponse({ status: 'done', events: [], cursor: 0 }) },
      { test: '/api/agents/chat/42/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);
    const { result } = renderHook(() => useChatRuntime({ conversationId: 42, dispatchSettings: settings }), { wrapper });
    await act(async () => { expect(await result.current.sendMessage({ content: 'first', pendingAttachments: [71], forceCacheRebuild: true, dispatchSettings: settings })).toBe('accepted'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    await act(async () => { expect(await result.current.sendMessage({ content: 'second', pendingAttachments: [72], dispatchSettings: settings })).toBe('accepted'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    const bodies = calls.filter(c => c.init?.method === 'POST').map(c => JSON.parse(String(c.init?.body)));
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ force_cache_rebuild: true, cache_enabled: false, pending_attachments: [71] });
    expect(bodies[1]).toMatchObject({ cache_enabled: false, pending_attachments: [72], content: 'second' });
    expect(bodies[1]).not.toHaveProperty('force_cache_rebuild');
  });
}
for (const value of [null, 0, 1, 'true', {}]) {
  it(`rejects invalid wire force ${JSON.stringify(value)} before network on both transports`, async () => {
    const { calls } = installFetch([]);
    for (const send of [fetchChatSSEStream, postChatAsync]) {
      await expect(send({ conversationId: 42, content: 'invalid', forceCacheRebuild: value as boolean })).rejects.toMatchObject({ code: 'VALIDATION' });
    }
    expect(calls).toHaveLength(0);
  });
}
