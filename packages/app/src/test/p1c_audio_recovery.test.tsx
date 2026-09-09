import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decideAudioRetry,
  purgeAudioRecoveryAttachment,
  useAudioRecovery,
  type AudioRecoveryState,
} from '../features/chat/audio/audioRecoveryMachine';
import { classifyAudioAttemptPersistence } from '../features/chat/runtime/attemptPersistence';
import type { MessageView } from '../features/chat/types';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const dispatchSettings = {
  model: 'gemini-audio',
  endpoint: 7,
  thinkingLevel: 'medium',
  cacheEnabled: true,
  sessionType: 'lite' as const,
  memoryInjectionEnabled: true,
};

const message = (id: number, indexInSession: number, attachmentIds: number[]): MessageView => ({
  id,
  role: 'user',
  content: 'canonical',
  reasoningContent: null,
  platform: null,
  modelVersion: null,
  tokenCount: null,
  indexInSession,
  attachmentIds,
  attachmentsMeta: null,
  createdAt: '2026-09-07T00:00:00Z',
});

function recoveryState(persistence: ReturnType<typeof classifyAudioAttemptPersistence>): AudioRecoveryState {
  return {
    kind: 'active',
    snapshot: {
      conversationId: 42,
      attemptKey: 'attempt-1',
      originalText: '完整原文',
      dispatchSettings,
      attachmentIds: [11, 22],
      audioAttachmentIds: [22],
      persistence,
      terminal: 'error',
    },
  };
}

afterEach(() => unmockFetch());

describe('P1C audio recovery snapshot and persistence machine', () => {
  it('classifies only exact ordered canonical attachment identity', () => {
    expect(classifyAudioAttemptPersistence([message(5, 2, [11, 22])], [11, 22], true)).toEqual({
      kind: 'exact_persisted',
      messageId: 5,
      indexInSession: 2,
    });
    expect(classifyAudioAttemptPersistence([message(5, 2, [22, 11])], [11, 22], true)).toEqual({
      kind: 'proven_absent',
    });
    expect(classifyAudioAttemptPersistence([], [11, 22], false)).toMatchObject({ kind: 'unknown' });
    expect(
      classifyAudioAttemptPersistence([message(5, 2, [11, 22]), message(6, 4, [11, 22])], [11, 22], true),
    ).toMatchObject({ kind: 'unknown' });
  });

  it('allows exact replacement only while no later user turn exists', () => {
    const exact = recoveryState({ kind: 'exact_persisted', messageId: 5, indexInSession: 2 });
    expect(decideAudioRetry(exact, [message(5, 2, [11, 22])])).toEqual({
      enabled: true,
      mode: 'replace',
      editMessageId: 5,
    });
    expect(decideAudioRetry(exact, [message(5, 2, [11, 22]), message(9, 4, [])])).toMatchObject({
      enabled: false,
    });
  });

  it('uploads audio once, snapshots the complete turn, and retries with zero re-upload', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/conversations/42/attachments/',
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              results: [
                {
                  input_index: 0,
                  status: 'ok',
                  attachment: { id: 22, display_name: 'recording.webm', mime_type: 'audio/webm' },
                  diagnostics: [],
                },
              ],
            },
            201,
          ),
      },
    ]);
    const firstDispatch = vi.fn(async () => 'rejected' as const);
    const retryDispatch = vi.fn(async () => 'accepted' as const);
    const replaceDispatch = vi.fn(async () => 'accepted' as const);
    const { result } = renderHook(() => useAudioRecovery(42, []));

    await act(async () => {
      await result.current.sendRecorded({
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        target: { model: 'gemini-audio', endpoint: 7 },
        dispatchSettings,
        content: '  完整原文  ',
        attachmentIds: [11],
        dispatch: firstDispatch,
      });
    });
    const snapshot = result.current.state?.kind === 'active' ? result.current.state.snapshot : null;
    expect(snapshot).toMatchObject({
      originalText: '完整原文',
      attachmentIds: [11, 22],
      audioAttachmentIds: [22],
    });
    expect(firstDispatch).toHaveBeenCalledWith({
      content: '完整原文',
      pendingAttachments: [11, 22],
      dispatchSettings,
      attemptKey: snapshot?.attemptKey,
    });

    act(() => {
      result.current.onRuntimeOutcome({
        attemptKey: snapshot?.attemptKey ?? '',
        terminal: 'rejected',
        persistence: { kind: 'proven_absent' },
      });
    });
    await waitFor(() => expect(result.current.retryDecision).toMatchObject({ enabled: true, mode: 'ordinary' }));
    await act(async () => {
      await result.current.retry({
        dispatchOrdinary: retryDispatch,
        dispatchReplacement: replaceDispatch,
        runtimeBusy: false,
        deletePending: false,
      });
    });

    expect(retryDispatch).toHaveBeenCalledWith({
      content: '完整原文',
      pendingAttachments: [11, 22],
      dispatchSettings,
      attemptKey: snapshot?.attemptKey,
    });
    expect(replaceDispatch).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.init?.method === 'POST')).toHaveLength(1);

    // Delete-204 callback semantics: purge and an immediate retry in the same
    // turn cannot reuse the deleted audio ID from a stale render closure.
    await act(async () => {
      result.current.purgeAttachmentId(22);
      expect(
        await result.current.retry({
          dispatchOrdinary: retryDispatch,
          dispatchReplacement: replaceDispatch,
          runtimeBusy: false,
          deletePending: false,
        }),
      ).toBe('rejected');
    });
    expect(retryDispatch).toHaveBeenCalledTimes(1);
  });

  it('invalidates a delayed audio upload across A-B-A without dispatching chat', async () => {
    let resolveUpload: ((response: Response) => void) | null = null;
    installFetch([
      {
        test: '/api/agents/conversations/42/attachments/',
        method: 'POST',
        handler: () => new Promise<Response>((resolve) => { resolveUpload = resolve; }),
      },
    ]);
    const dispatch = vi.fn(async () => 'accepted' as const);
    const { result, rerender } = renderHook(({ id }) => useAudioRecovery(id, []), {
      initialProps: { id: 42 },
    });

    let pending!: Promise<'accepted' | 'rejected'>;
    act(() => {
      pending = result.current.sendRecorded({
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        target: { model: 'gemini-audio', endpoint: 7 },
        dispatchSettings,
        content: 'old turn',
        attachmentIds: [11],
        dispatch,
      });
    });
    rerender({ id: 7 });
    rerender({ id: 42 });
    await act(async () => {
      resolveUpload?.(jsonResponse({
        results: [{ input_index: 0, status: 'ok', attachment: { id: 22 }, diagnostics: [] }],
      }, 201));
      await pending;
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.current.state).toBeNull();
    expect(result.current.uploading).toBe(false);
  });

  it('aborts and invalidates a delayed audio upload on unmount', async () => {
    let resolveUpload: ((response: Response) => void) | null = null;
    const uploadSignal: { current: AbortSignal | null } = { current: null };
    installFetch([
      {
        test: '/api/agents/conversations/42/attachments/',
        method: 'POST',
        handler: (_url, init) => {
          uploadSignal.current = init?.signal as AbortSignal;
          return new Promise<Response>((resolve) => { resolveUpload = resolve; });
        },
      },
    ]);
    const dispatch = vi.fn(async () => 'accepted' as const);
    const { result, unmount } = renderHook(() => useAudioRecovery(42, []));
    let pending!: Promise<'accepted' | 'rejected'>;
    act(() => {
      pending = result.current.sendRecorded({
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        target: { model: 'gemini-audio', endpoint: 7 },
        dispatchSettings,
        content: 'old turn',
        attachmentIds: [],
        dispatch,
      });
    });
    unmount();
    expect(uploadSignal.current?.aborted).toBe(true);
    await act(async () => {
      resolveUpload?.(jsonResponse({
        results: [{ input_index: 0, status: 'ok', attachment: { id: 22 }, diagnostics: [] }],
      }, 201));
      await pending;
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('purging a required deleted ID retires recovery without retaining a partial send', () => {
    const state = recoveryState({ kind: 'proven_absent' });
    expect(purgeAudioRecoveryAttachment(state, 22)).toEqual({
      kind: 'retired',
      reason: 'deleted_attachment',
    });
    expect(purgeAudioRecoveryAttachment(state, 999)).toBe(state);
  });
});
