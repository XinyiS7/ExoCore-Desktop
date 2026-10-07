import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { useChatRuntime } from '../features/chat/runtime/useChatRuntime';
import { useComposeAttachments } from '../features/chat/attachments/useComposeAttachments';
import { ChatComposer } from '../features/chat/ChatComposer';
import { loadConversationDraft } from '../features/chat/runtime/storage';
import type { ConversationDispatchSettings } from '../features/chat/runtime/types';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

function createWrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const SETTINGS: ConversationDispatchSettings = {
  model: 'gemini-3.8-flash',
  endpoint: 7,
  thinkingLevel: 'medium',
  cacheEnabled: true,
  sessionType: 'full',
};

beforeEach(() => {
  localStorage.clear();
  window.localStorage.setItem('exo:v4:chat-transport', 'async');
});

afterEach(() => {
  cleanup();
  unmockFetch();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('V4 Send Failure Recovery & Draft Protection (Plan R1)', () => {
  describe('1. Synchronous 422 Admission Preflight Rejection (Target C1)', () => {
    it('rejects synchronously on 422 preflight, leaves inputs intact, and shows persistent banner error', async () => {
      installFetch([
        {
          test: '/api/agents/chat/42/',
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                code: 'runtime_attachment_type_unsupported',
                message: 'Subscription Runtime accepts PNG, JPEG, and WebP images only',
              },
              422,
            ),
        },
      ]);

      const { result } = renderHook(
        () =>
          useChatRuntime({
            conversationId: 42,
            dispatchSettings: SETTINGS,
          }),
        { wrapper: createWrapper() },
      );

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.sendMessage({
          content: '兽舍档案',
          pendingAttachments: [950],
        });
      });

      expect(outcome).toBe('rejected');
      expect(result.current.runtimeError).toEqual(
        expect.objectContaining({
          code: 'runtime_attachment_type_unsupported',
          message: 'Subscription Runtime accepts PNG, JPEG, and WebP images only',
          retryClass: 'safe',
        }),
      );
      expect(result.current.status).toBe('idle');
    });
  });

  describe('2. In-generation deterministic failure without user row persistence (Target C2 - Accident Scenario)', () => {
    it('restores text, compose entries, and draft when async generator fails before persisting user message', async () => {
      installFetch([
        {
          test: '/api/agents/chat/42/',
          method: 'POST',
          handler: () => jsonResponse({ message_id: 'token-acc-1', status: 'processing' }),
        },
        {
          test: '/api/agents/chat/42/status/',
          method: 'GET',
          handler: () =>
            jsonResponse({
              status: 'error',
              cursor: 0,
              error_message: {
                code: 'project_rules_unreadable',
                message: '规则文件读取失败',
              },
              events: [],
            }),
        },
        {
          test: '/api/agents/chat/42/',
          method: 'GET',
          // Server messages window is empty — zero user messages written
          handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
        },
        {
          test: '/api/agents/conversations/42/control/cache/',
          method: 'GET',
          handler: () => jsonResponse({ conversation_id: 42, cache_enabled: true }),
        },
      ]);

      const { result } = renderHook(
        () =>
          useChatRuntime({
            conversationId: 42,
            dispatchSettings: SETTINGS,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        const sendPromise = result.current.sendMessage({
          content: '事故重现：打了一大堆字',
          pendingAttachments: [950],
        });
        await sendPromise;
      });

      // Wait for polling status error and reconcile
      await waitFor(() => {
        expect(result.current.restoredTurn).not.toBeNull();
      });

      expect(result.current.restoredTurn).toEqual(
        expect.objectContaining({
          conversationId: 42,
          text: '事故重现：打了一大堆字',
          attachmentIds: [950],
        }),
      );

      // Verify draft was restored to localStorage
      expect(loadConversationDraft(42)).toBe('事故重现：打了一大堆字');

      // Verify persistent banner error survived releaseUi
      expect(result.current.runtimeError).toEqual(
        expect.objectContaining({
          code: 'project_rules_unreadable',
          message: '规则文件读取失败',
          retryClass: 'safe',
        }),
      );

      // Verify optimistic row is cleaned up (no ghost message)
      expect(result.current.optimisticUser).toBeNull();
      expect(result.current.runtimeAssistant).toBeNull();
    });
  });

  describe('3. In-generation failure WITH user row persistence (Target C3 - Existing Semantics)', () => {
    it('maintains existing semantics and does not restore composer when user message was already persisted', async () => {
      let dispatchedClientTurnId: string | undefined;

      installFetch([
        {
          test: '/api/agents/chat/42/',
          method: 'POST',
          handler: (_url, req) => {
            const body = JSON.parse(req?.body ? String(req.body) : '{}') as { client_turn_id?: string };
            dispatchedClientTurnId = body.client_turn_id;
            return jsonResponse({ message_id: 'token-persisted-1', status: 'processing' });
          },
        },
        {
          test: '/api/agents/chat/42/status/',
          method: 'GET',
          handler: () =>
            jsonResponse({
              status: 'error',
              cursor: 0,
              error_message: { code: 'model_overloaded', message: '服务繁忙' },
              events: [],
            }),
        },
        {
          test: '/api/agents/chat/42/',
          method: 'GET',
          // Server messages window HAS the user row persisted with matching client_turn_id
          handler: () => {
            const userMsg = {
              id: 2001,
              role: 'user',
              content: '已成功落库的消息',
              reasoning_content: null,
              platform: null,
              model_version: null,
              token_count: null,
              index_in_session: 1,
              attachment_ids: [],
              attachments_meta: null,
              created_at: new Date().toISOString(),
              client_turn_id: dispatchedClientTurnId ?? null,
            };
            return jsonResponse({ messages: [userMsg], total_count: 1, has_more: false });
          },
        },
        {
          test: '/api/agents/conversations/42/control/cache/',
          method: 'GET',
          handler: () => jsonResponse({ conversation_id: 42, cache_enabled: true }),
        },
      ]);

      const { result } = renderHook(
        () =>
          useChatRuntime({
            conversationId: 42,
            dispatchSettings: SETTINGS,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.sendMessage({
          content: '已成功落库的消息',
        });
      });

      // Wait for reconcile to complete
      await waitFor(() => {
        expect(result.current.status).toBe('idle');
      });

      // Should NOT restore turn or overwrite draft
      expect(result.current.restoredTurn).toBeNull();
      expect(loadConversationDraft(42)).toBe('');
    });
  });

  describe('4. Text Merging when User Types during Generation (Target C4)', () => {
    it('merges failed text before newly typed text so neither is lost', async () => {
      let triggerPollError: () => void = () => {};

      installFetch([
        {
          test: '/api/agents/chat/42/',
          method: 'POST',
          handler: () => jsonResponse({ message_id: 'token-merge-1', status: 'processing' }),
        },
        {
          test: '/api/agents/chat/42/status/',
          method: 'GET',
          handler: () =>
            new Promise((resolve) => {
              triggerPollError = () => {
                resolve(
                  jsonResponse({
                    status: 'error',
                    cursor: 0,
                    error_message: { code: 'gen_err', message: '生成失败' },
                    events: [],
                  }),
                );
              };
            }),
        },
        {
          test: '/api/agents/chat/42/',
          method: 'GET',
          handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
        },
        {
          test: '/api/agents/conversations/42/control/cache/',
          method: 'GET',
          handler: () => jsonResponse({ conversation_id: 42, cache_enabled: true }),
        },
      ]);

      let restoredTurnProp: { token: number; conversationId: number; text: string; attachmentIds: number[] } | null = null;

      function TestHarness() {
        const [, setTick] = useState(0);
        const runtime = useChatRuntime({ conversationId: 42, dispatchSettings: SETTINGS });
        restoredTurnProp = runtime.restoredTurn;
        const compose = useComposeAttachments(42);
        return (
          <div>
            <button
              data-testid="send-btn"
              onClick={() => void runtime.sendMessage({ content: '第一段初始文字' })}
            >
              Send
            </button>
            <button
              data-testid="force-rerender-btn"
              onClick={() => setTick((t) => t + 1)}
            >
              Rerender
            </button>
            <ChatComposer
              conversationId={42}
              status={runtime.status}
              busy={runtime.busy}
              dispatchSettings={SETTINGS}
              targetNotice={null}
              projectId={null}
              pendingProjectInsert={null}
              onProjectInsertConsumed={() => {}}
              onSend={runtime.sendMessage}
              onStop={() => void runtime.stopGeneration()}
              editingTarget={null}
              onCancelEdit={() => {}}
              onConfirmEdit={async () => 'rejected'}
              compose={compose}
              attachmentManager={{
                rows: [],
                loading: false,
                notice: null,
                frozenInCache: false,
                deletePending: false,
                isDeletePending: () => false,
                refresh: async () => {},
                remove: async () => {},
                dismissNotice: () => {},
              }}
              recorder={{
                status: 'idle',
                recordingSeconds: 0,
                blob: null,
                blobUrl: null,
                error: null,
                errorMessage: '',
                mimeType: null,
                start: async () => {},
                stop: () => {},
                cancel: () => {},
                fail: () => {},
              }}
              audioGate={{ state: 'supported', target: { model: 'gemini-3.8-flash', endpoint: 7 } }}
              audioRecovery={{
                state: null,
                uploading: false,
                uploadError: null,
                dismissUploadError: () => {},
                retryDecision: { enabled: false, reason: '' },
                onRuntimeOutcome: () => {},
                retry: async () => 'rejected',
                abandon: () => {},
                sendRecorded: async () => 'rejected',
                isUploading: () => false,
                hasSnapshot: () => false,
                purgeAttachmentId: () => {},
              }}
              onRetryAudio={() => {}}
              restoredTurn={runtime.restoredTurn}
            />
          </div>
        );
      }

      const { getByTestId, getByRole } = render(<TestHarness />, { wrapper: createWrapper() });
      const textarea = getByRole('textbox') as HTMLTextAreaElement;

      // User sends initial text
      await act(async () => {
        getByTestId('send-btn').click();
      });

      // User types new text while generation is pending
      act(() => {
        fireEvent.change(textarea, { target: { value: '第二段后续补充' } });
      });

      // Server error arrives
      await act(async () => {
        triggerPollError();
      });

      await waitFor(() => {
        expect(restoredTurnProp).not.toBeNull();
      });

      // Verified: merged text contains both lines
      await waitFor(() => {
        expect(textarea.value).toBe('第一段初始文字\n\n第二段后续补充');
      });
      expect(loadConversationDraft(42)).toBe('第一段初始文字\n\n第二段后续补充');

      // F-01 verification: force parent rerender multiple times; text and draft must NOT duplicate!
      act(() => {
        getByTestId('force-rerender-btn').click();
      });
      act(() => {
        getByTestId('force-rerender-btn').click();
      });
      expect(textarea.value).toBe('第一段初始文字\n\n第二段后续补充');
      expect(loadConversationDraft(42)).toBe('第一段初始文字\n\n第二段后续补充');
    });
  });

  describe('5. Conversation Switching before Failure (Target C5)', () => {
    it('restores draft to the original conversation without contaminating the newly selected conversation', async () => {
      let triggerError: () => void = () => {};

      installFetch([
        {
          test: '/api/agents/chat/42/',
          method: 'POST',
          handler: () => jsonResponse({ message_id: 'token-switch-1', status: 'processing' }),
        },
        {
          test: '/api/agents/chat/42/status/',
          method: 'GET',
          handler: () =>
            new Promise((resolve) => {
              triggerError = () => {
                resolve(
                  jsonResponse({
                    status: 'error',
                    cursor: 0,
                    error_message: { code: 'err_c5', message: '失败' },
                    events: [],
                  }),
                );
              };
            }),
        },
        {
          test: '/api/agents/chat/42/',
          method: 'GET',
          handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
        },
        {
          test: '/api/agents/chat/43/',
          method: 'GET',
          handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
        },
        {
          test: '/api/agents/conversations/42/control/cache/',
          method: 'GET',
          handler: () => jsonResponse({ conversation_id: 42, cache_enabled: true }),
        },
        {
          test: '/api/agents/conversations/43/control/cache/',
          method: 'GET',
          handler: () => jsonResponse({ conversation_id: 43, cache_enabled: true }),
        },
      ]);

      function TestHarness({ conversationId }: { conversationId: number }) {
        const runtime = useChatRuntime({
          conversationId,
          dispatchSettings: SETTINGS,
        });
        const compose = useComposeAttachments(conversationId);
        return (
          <div>
            <button
              data-testid="send-btn"
              onClick={() => void runtime.sendMessage({ content: '会话42的重要内容' })}
            >
              Send
            </button>
            <ChatComposer
              conversationId={conversationId}
              status={runtime.status}
              busy={runtime.busy}
              dispatchSettings={SETTINGS}
              targetNotice={null}
              projectId={null}
              pendingProjectInsert={null}
              onProjectInsertConsumed={() => {}}
              onSend={runtime.sendMessage}
              onStop={() => void runtime.stopGeneration()}
              editingTarget={null}
              onCancelEdit={() => {}}
              onConfirmEdit={async () => 'rejected'}
              compose={compose}
              attachmentManager={{
                rows: [],
                loading: false,
                notice: null,
                frozenInCache: false,
                deletePending: false,
                isDeletePending: () => false,
                refresh: async () => {},
                remove: async () => {},
                dismissNotice: () => {},
              }}
              recorder={{
                status: 'idle',
                recordingSeconds: 0,
                blob: null,
                blobUrl: null,
                error: null,
                errorMessage: '',
                mimeType: null,
                start: async () => {},
                stop: () => {},
                cancel: () => {},
                fail: () => {},
              }}
              audioGate={{ state: 'supported', target: { model: 'gemini-3.8-flash', endpoint: 7 } }}
              audioRecovery={{
                state: null,
                uploading: false,
                uploadError: null,
                dismissUploadError: () => {},
                retryDecision: { enabled: false, reason: '' },
                onRuntimeOutcome: () => {},
                retry: async () => 'rejected',
                abandon: () => {},
                sendRecorded: async () => 'rejected',
                isUploading: () => false,
                hasSnapshot: () => false,
                purgeAttachmentId: () => {},
              }}
              onRetryAudio={() => {}}
              restoredTurn={runtime.restoredTurn}
            />
          </div>
        );
      }

      const { getByTestId, getByRole, rerender } = render(<TestHarness conversationId={42} />, {
        wrapper: createWrapper(),
      });
      const textarea = getByRole('textbox') as HTMLTextAreaElement;

      // 1. User sends in conversation 42
      await act(async () => {
        getByTestId('send-btn').click();
      });

      // Draft for 42 was cleared upon send
      expect(loadConversationDraft(42)).toBe('');

      // 2. During generation, user switches to conversation 43
      rerender(<TestHarness conversationId={43} />);

      // On conversation 43: input and draft are untouched
      expect(textarea.value).toBe('');
      expect(loadConversationDraft(43)).toBe('');

      // 3. Server reports failure for conversation 42
      await act(async () => {
        triggerError();
      });

      // 4. Assert:
      // Conversation 42 draft was restored in localStorage
      await waitFor(() => {
        expect(loadConversationDraft(42)).toBe('会话42的重要内容');
      });
      // Conversation 43's input and draft remain clean and uncontaminated
      expect(textarea.value).toBe('');
      expect(loadConversationDraft(43)).toBe('');

      // 5. Switching back to conversation 42 populates the restored draft into composer
      rerender(<TestHarness conversationId={42} />);
      await waitFor(() => {
        expect(textarea.value).toBe('会话42的重要内容');
      });
    });
  });

  describe('6. Non-deterministic Interruption (Target C6 - Uncertainty Invariant)', () => {
    it('does NOT restore composer or draft on EOF without terminal', async () => {
      window.localStorage.setItem('exo:v4:chat-transport', 'sse');
      installFetch([
        {
          test: '/api/agents/chat/42/',
          method: 'POST',
          // EOF without done frame
          handler: () =>
            new Response('event: thinking\ndata: 正在思考...\n\n', {
              headers: { 'Content-Type': 'text/event-stream' },
            }),
        },
        {
          test: '/api/agents/chat/42/',
          method: 'GET',
          handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
        },
        {
          test: '/api/agents/conversations/42/control/cache/',
          method: 'GET',
          handler: () => jsonResponse({ conversation_id: 42, cache_enabled: true }),
        },
      ]);

      const { result } = renderHook(
        () =>
          useChatRuntime({
            conversationId: 42,
            dispatchSettings: SETTINGS,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        void result.current.sendMessage({ content: '可能会在后端异步写入的消息' });
      });

      // Wait for turn to reconcile and finish
      await waitFor(() => {
        expect(result.current.status).toBe('idle');
      });

      // Invariant: Non-deterministic interruption must NOT auto-restore composer or draft
      expect(result.current.restoredTurn).toBeNull();
      expect(loadConversationDraft(42)).toBe('');
    });
  });

  describe('7. Exclusion of Audio Turns (Target C7)', () => {
    it('skips ordinary recovery when turn carried an audio attemptKey', async () => {
      installFetch([
        {
          test: '/api/agents/chat/42/',
          method: 'POST',
          handler: () => jsonResponse({ message_id: 'token-audio-1', status: 'processing' }),
        },
        {
          test: '/api/agents/chat/42/status/',
          method: 'GET',
          handler: () =>
            jsonResponse({
              status: 'error',
              cursor: 0,
              error_message: { code: 'audio_failed', message: '语音处理失败' },
              events: [],
            }),
        },
        {
          test: '/api/agents/chat/42/',
          method: 'GET',
          handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
        },
        {
          test: '/api/agents/conversations/42/control/cache/',
          method: 'GET',
          handler: () => jsonResponse({ conversation_id: 42, cache_enabled: true }),
        },
      ]);

      const attemptOutcomeSpy = vi.fn();
      const { result } = renderHook(
        () =>
          useChatRuntime({
            conversationId: 42,
            dispatchSettings: SETTINGS,
            onAttemptOutcome: attemptOutcomeSpy,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        void result.current.sendMessage({
          content: '带录音的消息',
          attemptKey: 'audio:rec-snapshot-1',
        });
      });

      await waitFor(() => {
        expect(attemptOutcomeSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            attemptKey: 'audio:rec-snapshot-1',
            terminal: 'error',
          }),
        );
      });

      // Ordinary restoredTurn must stay null (audio recovery takes ownership)
      expect(result.current.restoredTurn).toBeNull();
    });
  });

  describe('8. Compose Attachments Deduplication & Merging (Target C8)', () => {
    it('restores entries by attachmentId and skips duplicates if user added items while waiting', () => {
      const { result } = renderHook(() => useComposeAttachments(42));

      const file1 = new File(['file1 content'], 'doc1.txt', { type: 'text/plain' });
      const file2 = new File(['file2 content'], 'doc2.txt', { type: 'text/plain' });

      // Simulate stashed entries from earlier submission
      const stashedEntries = [
        {
          clientId: 1,
          file: file1,
          preview: null,
          name: 'doc1.txt',
          type: 'text/plain',
          size: 100,
          status: 'ok' as const,
          attachmentId: 101,
          diagnostics: [],
        },
      ];

      // Simulate user adding entry 102 in the current composer
      act(() => {
        result.current.restoreEntries([
          {
            clientId: 2,
            file: file2,
            preview: null,
            name: 'doc2.txt',
            type: 'text/plain',
            size: 200,
            status: 'ok',
            attachmentId: 102,
            diagnostics: [],
          },
        ]);
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.getSuccessfulIds()).toEqual([102]);

      // Now restore stashedEntries (containing 101) + duplicate 102
      act(() => {
        result.current.restoreEntries([
          ...stashedEntries,
          {
            clientId: 99,
            file: file2,
            preview: null,
            name: 'doc2.txt',
            type: 'text/plain',
            size: 200,
            status: 'ok',
            attachmentId: 102, // Duplicate!
            diagnostics: [],
          },
        ]);
      });

      // Should contain 102 and 101, without duplicate 102
      expect(result.current.entries).toHaveLength(2);
      expect(result.current.getSuccessfulIds()).toEqual(expect.arrayContaining([101, 102]));
    });
  });
});
