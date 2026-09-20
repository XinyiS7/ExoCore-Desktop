import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRuntime } from '../features/chat/runtime/useChatRuntime';
import type { MessageView } from '../features/chat/types';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const canonicalUser = (ids: number[]) => ({
  id: 101,
  role: 'user',
  content: 'voice text',
  reasoning_content: null,
  platform: null,
  model_version: null,
  token_count: null,
  index_in_session: 2,
  attachment_ids: ids,
  attachments_meta: null,
  created_at: '2026-09-07T00:00:00Z',
});

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  unmockFetch();
  window.localStorage.clear();
});

describe('P1C C1B runtime bridge', () => {
  it('serializes the complete IDs and reports exact persistence from canonical identity', async () => {
    const outcomes = vi.fn();
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () =>
          new Response('event: error\ndata: {"code":"service_unavailable","message":"down"}\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      },
      {
        test: '/api/agents/chat/42/',
        handler: () =>
          jsonResponse({ messages: [canonicalUser([11, 22])], total_count: 1, has_more: false }),
      },
    ]);

    const { result } = renderHook(() => {
      const persistedRowsRef = useRef<ReadonlyArray<MessageView>>([]);
      return useChatRuntime({
        conversationId: 42,
        persistedRowsRef,
        onAttemptOutcome: outcomes,
      });
    }, { wrapper });

    await act(async () => {
      expect(
        await result.current.sendMessage({
          content: 'voice text',
          pendingAttachments: [11, 22],
          attemptKey: 'attempt-exact',
        }),
      ).toBe('accepted');
    });

    await waitFor(() => {
      expect(outcomes).toHaveBeenCalledWith({
        attemptKey: 'attempt-exact',
        terminal: 'error',
        persistence: { kind: 'exact_persisted', messageId: 101, indexInSession: 2 },
      });
    });
    const post = calls.find((call) => call.init?.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({
      content: 'voice text',
      pending_attachments: [11, 22],
    });
  });

  it('preserves exact original binding when a recovery replacement is safely rejected', async () => {
    const outcomes = vi.fn();
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
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () => jsonResponse({ error: 'request rejected' }, 400),
      },
    ]);
    const { result } = renderHook(() => {
      const persistedRowsRef = useRef<ReadonlyArray<MessageView>>(persisted);
      return useChatRuntime({ conversationId: 42, persistedRowsRef, onAttemptOutcome: outcomes });
    }, { wrapper });
    const turn = { content: 'voice text', pendingAttachments: [11, 22], attemptKey: 'attempt-replace' };

    await act(async () => {
      expect(await result.current.retryRecoveredTurn(turn, 101)).toBe('rejected');
    });
    expect(outcomes).toHaveBeenLastCalledWith({
      attemptKey: 'attempt-replace',
      terminal: 'rejected',
      persistence: { kind: 'exact_persisted', messageId: 101, indexInSession: 2 },
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ edit_message_id: 101 });
  });

  it('preserves exact original binding when replacement is blocked before POST', async () => {
    const outcomes = vi.fn();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (String(key).startsWith('exo:v4:chat-runtime:')) throw new DOMException('blocked', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });
    const { calls } = installFetch([]);
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
    const { result } = renderHook(() => {
      const persistedRowsRef = useRef<ReadonlyArray<MessageView>>(persisted);
      return useChatRuntime({ conversationId: 42, persistedRowsRef, onAttemptOutcome: outcomes });
    }, { wrapper });

    await act(async () => {
      expect(await result.current.retryRecoveredTurn({
        content: 'voice text',
        pendingAttachments: [11, 22],
        attemptKey: 'attempt-storage',
      }, 101)).toBe('rejected');
    });
    expect(calls).toHaveLength(0);
    expect(outcomes).toHaveBeenLastCalledWith({
      attemptKey: 'attempt-storage',
      terminal: 'rejected',
      persistence: { kind: 'exact_persisted', messageId: 101, indexInSession: 2 },
    });
  });

  it('permits attachment-only ordinary send while edit remains attachment-free', async () => {
    const bodies: Record<string, unknown>[] = [];
    installFetch([
      {
        test: '/api/agents/chat/43/',
        method: 'POST',
        handler: (_url, init) => {
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return new Response('event: done\ndata: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          });
        },
      },
      {
        test: '/api/agents/chat/43/',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    const persisted = [{ id: 7, role: 'user' }];
    const { result } = renderHook(() => {
      const persistedRowsRef = useRef(persisted);
      return useChatRuntime({ conversationId: 43, persistedRowsRef });
    }, { wrapper });

    await act(async () => {
      expect(await result.current.sendMessage({ content: '', pendingAttachments: [31] })).toBe('accepted');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => result.current.startEdit(7, 'old'));
    await act(async () => {
      expect(await result.current.confirmEdit('changed')).toBe('accepted');
    });

    expect(bodies[0]).toMatchObject({ content: '', pending_attachments: [31] });
    expect(bodies[1]).toMatchObject({ content: 'changed', edit_message_id: 7 });
    expect(bodies[1]).not.toHaveProperty('pending_attachments');
  });
});
