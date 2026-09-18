import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRuntime } from '../features/chat/runtime/useChatRuntime';
import { ensureTestLocalStorage, installFetch, jsonResponse, unmockFetch } from './helpers';

ensureTestLocalStorage();

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function sseDone() {
  return new Response('event: done\ndata: [DONE]\n\n', {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const emptyMessages = () => jsonResponse({ messages: [], total_count: 0, has_more: false });

function postBodies(calls: { url: URL; init?: RequestInit }[]): Record<string, unknown>[] {
  return calls
    .filter((c) => c.init?.method === 'POST' && !c.url.pathname.includes('/stop/'))
    .map((c) => JSON.parse(String(c.init?.body)) as Record<string, unknown>);
}

/** The user's live HUD selection: AGY (Subscription Runtime) endpoint 7. */
const CURRENT_SELECTION = {
  model: 'gemini-3.1-pro-preview',
  endpoint: 7,
  thinkingLevel: 'high',
  cacheEnabled: false,
  sessionType: 'lite' as const,
};

/** A replayed attempt's captured snapshot: same model, old direct endpoint 1. */
const STALE_REPLAY_SNAPSHOT = {
  model: 'gemini-3.1-pro-preview',
  endpoint: 1,
  thinkingLevel: 'high',
  cacheEnabled: false,
  sessionType: 'lite' as const,
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  unmockFetch();
  window.localStorage.clear();
});

describe('V4 dispatch target precedence — current selection outranks a replay snapshot', () => {
  it('dispatches the current AGY selection instead of the stale replay endpoint', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: CURRENT_SELECTION }),
      { wrapper },
    );

    await act(async () => {
      expect(
        await result.current.sendMessage({
          content: 'second attempt via agy',
          dispatchSettings: STALE_REPLAY_SNAPSHOT,
        }),
      ).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));

    const bodies = postBodies(calls);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ model: 'gemini-3.1-pro-preview', endpoint: 7 });

    // The divergence is visible, not silent: notice + console record.
    expect(result.current.runtimeNotice).toContain('端点 7');
    expect(result.current.runtimeNotice).toContain('端点 1');
    expect(warn).toHaveBeenCalledWith(
      '[V4Runtime] stale replay target replaced by current selection',
      expect.objectContaining({
        replayed: { model: 'gemini-3.1-pro-preview', endpoint: 1 },
        current: { model: 'gemini-3.1-pro-preview', endpoint: 7 },
      }),
    );
  });

  it('no divergence: an identical replay snapshot dispatches without notice or warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: CURRENT_SELECTION }),
      { wrapper },
    );

    await act(async () => {
      expect(
        await result.current.sendMessage({
          content: 'same target replay',
          dispatchSettings: { ...CURRENT_SELECTION },
        }),
      ).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));

    expect(postBodies(calls)[0]).toMatchObject({ endpoint: 7 });
    expect(result.current.runtimeNotice).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a null current selection still falls back to the replay snapshot (audio recovery semantics)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: null }),
      { wrapper },
    );

    await act(async () => {
      expect(
        await result.current.sendMessage({
          content: 'snapshot fallback',
          dispatchSettings: STALE_REPLAY_SNAPSHOT,
        }),
      ).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));

    expect(postBodies(calls)[0]).toMatchObject({ model: 'gemini-3.1-pro-preview', endpoint: 1 });
  });

  it('a null current selection with no snapshot stays fail-closed (no POST)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: null }),
      { wrapper },
    );

    await act(async () => {
      expect(await result.current.sendMessage({ content: 'unresolved target' })).toBe('rejected');
    });

    expect(calls).toHaveLength(0);
    expect(result.current.runtimeError?.code).toBe('TARGET_UNRESOLVED');
  });

  it('the legacy undefined harness keeps dispatching without a model/endpoint (seam preserved)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(() => useChatRuntime({ conversationId: 42 }), { wrapper });

    await act(async () => {
      expect(await result.current.sendMessage({ content: 'harness send' })).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));

    const bodies = postBodies(calls);
    expect(bodies).toHaveLength(1);
    expect('model' in bodies[0]).toBe(false);
    expect('endpoint' in bodies[0]).toBe(false);
  });
});
