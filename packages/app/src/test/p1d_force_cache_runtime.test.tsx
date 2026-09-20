import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRuntime } from '../features/chat/runtime/useChatRuntime';
import { useAudioRecovery } from '../features/chat/audio/audioRecoveryMachine';
import type { MessageView } from '../features/chat/types';
import type { ChatTurnInput } from '../features/chat/runtime/types';
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

const DISPATCH_SETTINGS = {
  model: 'deepseek-v4-flash',
  endpoint: 7,
  thinkingLevel: 'medium',
  cacheEnabled: true,
  sessionType: 'full' as const,
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  unmockFetch();
  window.localStorage.clear();
});

describe('P1D Force Cache Send — runtime capture (SSE + async share semantics)', () => {
  it('ordinary send omits force_cache_rebuild (SSE)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: DISPATCH_SETTINGS }),
      { wrapper },
    );
    await act(async () => {
      expect(await result.current.sendMessage({ content: 'plain', dispatchSettings: DISPATCH_SETTINGS })).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    const bodies = postBodies(calls);
    expect(bodies).toHaveLength(1);
    expect('force_cache_rebuild' in bodies[0]).toBe(false);
    expect(bodies[0]).toMatchObject({ content: 'plain' });
  });

  it('explicit force send serializes force_cache_rebuild=true with its attachments (SSE)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: DISPATCH_SETTINGS }),
      { wrapper },
    );
    await act(async () => {
      expect(
        await result.current.sendMessage({
          content: '',
          pendingAttachments: [11, 22],
          forceCacheRebuild: true,
          dispatchSettings: DISPATCH_SETTINGS,
        }),
      ).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    const bodies = postBodies(calls);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      content: '',
      pending_attachments: [11, 22],
      force_cache_rebuild: true,
      cache_enabled: true,
    });
  });

  it('explicit force send shares identical semantics over async transport', async () => {
    window.localStorage.setItem('exo:v4:chat-transport', 'async');
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'abcd1234', status: 'processing' }),
      },
      { test: '/api/agents/chat/42/status/', handler: () => jsonResponse({ status: 'done', events: [], cursor: 0 }) },
      { test: '/api/agents/chat/42/', handler: () => emptyMessages() },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: DISPATCH_SETTINGS }),
      { wrapper },
    );
    await act(async () => {
      expect(
        await result.current.sendMessage({
          content: 'voice rebuild',
          pendingAttachments: [3],
          forceCacheRebuild: true,
          dispatchSettings: DISPATCH_SETTINGS,
        }),
      ).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    const bodies = postBodies(calls);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      content: 'voice rebuild',
      pending_attachments: [3],
      force_cache_rebuild: true,
    });
  });

  it('historical edit/recovery replacement never serializes force even when the turn flags it', async () => {
    const persisted: MessageView[] = [{
      id: 101,
      role: 'user',
      content: 'voice text',
      reasoningContent: null,
      platform: null,
      modelVersion: null,
      tokenCount: null,
      indexInSession: 2,
      attachmentIds: [11, 22],
      attachmentsMeta: null,
      createdAt: '2026-09-07T00:00:00Z',
      clientTurnId: null,
    }];
    const { calls } = installFetch([
      { test: '/api/agents/chat/42/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/42/', handler: () => jsonResponse({ messages: [persisted[0]], total_count: 1, has_more: false }) },
    ]);
    const { result } = renderHook(() => {
      const persistedRowsRef = useRef<ReadonlyArray<MessageView>>(persisted);
      return useChatRuntime({ conversationId: 42, persistedRowsRef });
    }, { wrapper });
    await act(async () => {
      expect(
        await result.current.retryRecoveredTurn(
          {
            content: 'voice text',
            pendingAttachments: [11, 22],
            forceCacheRebuild: true,
            attemptKey: 'attempt-edit',
          },
          101,
        ),
      ).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    const bodies = postBodies(calls);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ content: 'voice text', edit_message_id: 101, pending_attachments: [11, 22] });
    expect('force_cache_rebuild' in bodies[0]).toBe(false);
  });

  it('operation lock is not relaxed: a force send is rejected while another turn holds the runtime', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () => new Promise<Response>(() => {}),
      },
    ]);
    const { result } = renderHook(
      () => useChatRuntime({ conversationId: 42, dispatchSettings: DISPATCH_SETTINGS }),
      { wrapper },
    );
    // First turn claims the runtime synchronously (idle → predispatch) and
    // stays in flight on a never-resolving POST.
    await act(async () => {
      void result.current.sendMessage({ content: 'first', dispatchSettings: DISPATCH_SETTINGS });
    });
    await act(async () => {
      // Same-tick guard: the union lock is the ONLY source — force or not,
      // a second dispatch must be rejected before any POST leaves the tab.
      expect(
        await result.current.sendMessage({
          content: 'second',
          forceCacheRebuild: true,
          dispatchSettings: DISPATCH_SETTINGS,
        }),
      ).toBe('rejected');
    });
    expect(postBodies(calls)).toHaveLength(1);
  });

  it('conversation switch resets the lock; a force send on the new route dispatches only there', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () => new Promise<Response>(() => {}),
      },
      { test: '/api/agents/chat/43/', method: 'POST', handler: () => sseDone() },
      { test: '/api/agents/chat/43/', handler: () => emptyMessages() },
    ]);
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useChatRuntime({ conversationId: id, dispatchSettings: DISPATCH_SETTINGS }),
      { initialProps: { id: 42 }, wrapper },
    );
    // Stale in-flight turn on 42 (never resolves; lock is asserted per route).
    await act(async () => {
      void result.current.sendMessage({ content: 'stale A', dispatchSettings: DISPATCH_SETTINGS });
    });
    // Route switch must NOT inherit A's in-flight lock: the route effect
    // resets the union to idle before any new dispatch is possible.
    act(() => rerender({ id: 43 }));
    expect(result.current.busy).toBe(false);
    await act(async () => {
      expect(
        await result.current.sendMessage({
          content: 'rebuild B',
          pendingAttachments: [9],
          forceCacheRebuild: true,
          dispatchSettings: DISPATCH_SETTINGS,
        }),
      ).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    const postCalls = calls.filter((c) => c.init?.method === 'POST');
    expect(postCalls.map((c) => c.url.pathname)).toEqual(['/api/agents/chat/42/', '/api/agents/chat/43/']);
    // The stale in-flight turn keeps its ordinary body; the new route's force
    // intent lands exactly once, on the new conversation only.
    const staleBody = JSON.parse(String(postCalls[0].init?.body)) as Record<string, unknown>;
    expect('force_cache_rebuild' in staleBody).toBe(false);
    const nextBody = JSON.parse(String(postCalls[1].init?.body)) as Record<string, unknown>;
    expect(nextBody).toMatchObject({ content: 'rebuild B', pending_attachments: [9], force_cache_rebuild: true });
  });

  it('recorded audio dispatch forwards explicit force to the exact turn; retry replays ordinary semantics', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/conversations/42/attachments/',
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              results: [{ input_index: 0, status: 'ok', attachment: { id: 22, display_name: 'recording.webm', mime_type: 'audio/webm' }, diagnostics: [] }],
              attachments: [],
              failures: [],
            },
            201,
          ),
      },
    ]);
    const dispatch = vi.fn(async (_turn: ChatTurnInput) => 'accepted' as const);
    const retryDispatch = vi.fn(async (_turn: ChatTurnInput) => 'accepted' as const);
    const { result } = renderHook(() => useAudioRecovery(42, []));
    await act(async () => {
      await result.current.sendRecorded({
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        target: { model: 'deepseek-v4-flash', endpoint: 7 },
        dispatchSettings: DISPATCH_SETTINGS,
        content: 'with force',
        attachmentIds: [11],
        forceCacheRebuild: true,
        dispatch,
      });
    });
    const attemptKey = result.current.state?.kind === 'active' ? result.current.state.snapshot.attemptKey : null;
    expect(attemptKey).toBeTruthy();
    expect(dispatch).toHaveBeenCalledWith({
      content: 'with force',
      pendingAttachments: [11, 22],
      forceCacheRebuild: true,
      dispatchSettings: DISPATCH_SETTINGS,
      attemptKey,
    });

    // Safely-rejected attempt → retry (ordinary mode) replays exact content and
    // IDs but NEVER the one-shot force flag (V3 parity: retry = ordinary send).
    act(() => {
      result.current.onRuntimeOutcome({
        attemptKey: attemptKey as string,
        terminal: 'rejected',
        persistence: { kind: 'proven_absent' },
      });
    });
    await waitFor(() => expect(result.current.retryDecision).toMatchObject({ enabled: true, mode: 'ordinary' }));
    await act(async () => {
      await result.current.retry({
        dispatchOrdinary: retryDispatch,
        dispatchReplacement: vi.fn(),
        runtimeBusy: false,
        deletePending: false,
      });
    });
    expect(retryDispatch).toHaveBeenCalledTimes(1);
    const retried = retryDispatch.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(retried).toMatchObject({ content: 'with force', pendingAttachments: [11, 22], dispatchSettings: DISPATCH_SETTINGS });
    expect('forceCacheRebuild' in retried).toBe(false);
    // One upload, zero re-upload (snapshot replay).
    expect(calls.filter((c) => c.init?.method === 'POST')).toHaveLength(1);
  });
});