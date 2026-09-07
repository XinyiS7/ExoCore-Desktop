import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MessageView } from '../types';
import type {
  AttemptPersistence,
  ChatTurnInput,
  RuntimeAttemptOutcome,
  TurnAcceptance,
} from '../runtime/types';
import { audioUploadErrorMessage, uploadAttachments } from '../attachments/api';
import type { AudioTarget } from '../attachments/types';
import { MAX_AUDIO_BYTES } from './types';

export interface AudioTurnSnapshot {
  conversationId: number;
  attemptKey: string;
  originalText: string;
  /** Immutable complete order: ordinary compose IDs followed by uploaded audio. */
  attachmentIds: number[];
  audioAttachmentIds: number[];
  persistence: AttemptPersistence;
  terminal: RuntimeAttemptOutcome['terminal'] | 'dispatching';
}

export type AudioRecoveryState =
  | { kind: 'active'; snapshot: AudioTurnSnapshot }
  | { kind: 'retired'; reason: 'deleted_attachment' }
  | null;

export type AudioRetryDecision =
  | { enabled: true; mode: 'ordinary' }
  | { enabled: true; mode: 'replace'; editMessageId: number }
  | { enabled: false; reason: string };

export function purgeAudioRecoveryAttachment(
  state: AudioRecoveryState,
  attachmentId: number,
): AudioRecoveryState {
  if (!state || state.kind !== 'active' || !state.snapshot.attachmentIds.includes(attachmentId)) {
    return state;
  }
  // Retire the whole retry rather than retaining a sendable partial snapshot.
  // The retired state deliberately contains no attachment IDs.
  return { kind: 'retired', reason: 'deleted_attachment' };
}

function sameOrderedIds(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function decideAudioRetry(
  state: AudioRecoveryState,
  canonicalRows: readonly MessageView[],
): AudioRetryDecision {
  if (!state) return { enabled: false, reason: '没有待恢复的语音发送。' };
  if (state.kind === 'retired') {
    return { enabled: false, reason: '所需附件已删除，本次恢复已停用。' };
  }
  const { snapshot } = state;
  if (snapshot.persistence.kind === 'proven_absent') return { enabled: true, mode: 'ordinary' };
  if (snapshot.persistence.kind === 'unknown') {
    return { enabled: false, reason: `${snapshot.persistence.reason} 请使用明确的历史编辑操作。` };
  }

  const exactPersistence = snapshot.persistence;
  const bound = canonicalRows.find(
    (row) =>
      row.id === exactPersistence.messageId &&
      row.role === 'user' &&
      sameOrderedIds(row.attachmentIds, snapshot.attachmentIds),
  );
  if (!bound) {
    return { enabled: false, reason: '已绑定的原始消息不再匹配，请使用明确的历史编辑操作。' };
  }
  const hasLaterUserTurn = canonicalRows.some(
    (row) => row.role === 'user' && row.indexInSession > bound.indexInSession,
  );
  if (hasLaterUserTurn) {
    return { enabled: false, reason: '原始语音后已有新的用户消息；为避免截断后续对话，请使用明确的历史编辑操作。' };
  }
  return { enabled: true, mode: 'replace', editMessageId: bound.id };
}

interface SendRecordedInput {
  blob: Blob;
  mimeType: string;
  target: AudioTarget;
  content: string;
  attachmentIds: number[];
  dispatch: (turn: ChatTurnInput) => Promise<TurnAcceptance>;
}

interface RetryInput {
  dispatchOrdinary: (turn: ChatTurnInput) => Promise<TurnAcceptance>;
  dispatchReplacement: (turn: ChatTurnInput, editMessageId: number) => Promise<TurnAcceptance>;
  runtimeBusy: boolean;
  deletePending: boolean;
}

let nextAttempt = 1;

export function useAudioRecovery(conversationId: number, canonicalRows: readonly MessageView[]) {
  const [state, setState] = useState<AudioRecoveryState>(null);
  const stateRef = useRef<AudioRecoveryState>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadingRef = useRef(false);
  const retryingRef = useRef(false);
  const uploadEpochRef = useRef(0);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const conversationRef = useRef(conversationId);
  conversationRef.current = conversationId;

  useEffect(() => {
    // Route departure invalidates the upload even when a transport/mock ignores
    // AbortSignal. A -> B -> A therefore cannot revive A's old completion.
    uploadEpochRef.current += 1;
    uploadControllerRef.current?.abort();
    uploadControllerRef.current = null;
    uploadingRef.current = false;
    retryingRef.current = false;
    setUploading(false);
    setUploadError(null);
    stateRef.current = null;
    setState(null);
    return () => {
      uploadEpochRef.current += 1;
      uploadControllerRef.current?.abort();
      uploadControllerRef.current = null;
      uploadingRef.current = false;
      retryingRef.current = false;
    };
  }, [conversationId]);

  const onRuntimeOutcome = useCallback((outcome: RuntimeAttemptOutcome) => {
    const current = stateRef.current;
    if (!current || current.kind !== 'active' || current.snapshot.attemptKey !== outcome.attemptKey) return;
    const next: AudioRecoveryState =
      outcome.terminal === 'done'
        ? null
        : {
            kind: 'active',
            snapshot: { ...current.snapshot, terminal: outcome.terminal, persistence: outcome.persistence },
          };
    stateRef.current = next;
    setState(next);
  }, []);

  const sendRecorded = useCallback(async (input: SendRecordedInput): Promise<TurnAcceptance> => {
    if (uploadingRef.current || retryingRef.current) return 'rejected';
    if (input.blob.size <= 0 || input.blob.size > MAX_AUDIO_BYTES) {
      setUploadError(input.blob.size > MAX_AUDIO_BYTES ? '语音超过 10 MiB 上限' : '录音内容为空，请重试');
      return 'rejected';
    }
    if (!Number.isInteger(input.target.endpoint) || input.target.endpoint <= 0 || !input.target.model.trim()) {
      setUploadError('语音上传缺少目标配置');
      return 'rejected';
    }
    if (input.attachmentIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      setUploadError('附件参数包含无效编号');
      return 'rejected';
    }

    const boundConversation = conversationRef.current;
    const uploadEpoch = ++uploadEpochRef.current;
    const uploadController = new AbortController();
    uploadControllerRef.current?.abort();
    uploadControllerRef.current = uploadController;
    uploadingRef.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const file = new File([input.blob], `recording-${Date.now()}.webm`, { type: input.mimeType });
      const outcome = await uploadAttachments(boundConversation, [file], input.target, uploadController.signal);
      if (
        uploadEpochRef.current !== uploadEpoch ||
        uploadController.signal.aborted ||
        conversationRef.current !== boundConversation
      ) return 'rejected';
      const results = outcome.payload.results;
      const matches = Array.isArray(results)
        ? results.filter((item) => item.input_index === 0)
        : [];
      const row = matches.length === 1 && results?.length === 1 ? matches[0] : null;
      const audioId = row?.attachment?.id;
      if (
        !row ||
        (row.status !== 'ok' && row.status !== 'ok_degraded') ||
        !Number.isInteger(audioId) ||
        (audioId as number) <= 0
      ) {
        setUploadError(audioUploadErrorMessage({
          status: outcome.status,
          body: outcome.payload,
          message: '语音上传失败',
        }));
        return 'rejected';
      }

      const attemptKey = `audio:${boundConversation}:${Date.now()}:${nextAttempt++}`;
      const attachmentIds = [...input.attachmentIds, audioId as number];
      const snapshot: AudioTurnSnapshot = {
        conversationId: boundConversation,
        attemptKey,
        originalText: input.content.trim(),
        attachmentIds,
        audioAttachmentIds: [audioId as number],
        persistence: { kind: 'unknown', reason: '发送结果尚未完成对齐。' },
        terminal: 'dispatching',
      };
      // Snapshot exists before the C1B dispatch. The uploaded audio ID is never
      // uploaded again by retry; all retries replay this complete ID set.
      const nextState: AudioRecoveryState = { kind: 'active', snapshot };
      stateRef.current = nextState;
      setState(nextState);
      // Final ownership check immediately before handing the turn to C1B.
      if (
        uploadEpochRef.current !== uploadEpoch ||
        uploadController.signal.aborted ||
        conversationRef.current !== boundConversation
      ) return 'rejected';
      return await input.dispatch({
        content: snapshot.originalText,
        pendingAttachments: [...snapshot.attachmentIds],
        attemptKey,
      });
    } catch (cause) {
      if (
        uploadEpochRef.current === uploadEpoch &&
        !uploadController.signal.aborted &&
        conversationRef.current === boundConversation
      ) {
        setUploadError(audioUploadErrorMessage(cause as Error));
      }
      return 'rejected';
    } finally {
      if (uploadEpochRef.current === uploadEpoch) {
        uploadControllerRef.current = null;
        uploadingRef.current = false;
        if (conversationRef.current === boundConversation) setUploading(false);
      }
    }
  }, []);

  const retryDecision = useMemo(() => decideAudioRetry(state, canonicalRows), [state, canonicalRows]);

  const retry = useCallback(async (input: RetryInput): Promise<TurnAcceptance> => {
    if (retryingRef.current || uploadingRef.current || input.runtimeBusy || input.deletePending) return 'rejected';
    const current = stateRef.current;
    const decision = decideAudioRetry(current, canonicalRows);
    if (!current || current.kind !== 'active' || !decision.enabled) return 'rejected';
    retryingRef.current = true;
    const nextState: AudioRecoveryState = {
      kind: 'active',
      snapshot: { ...current.snapshot, terminal: 'dispatching' },
    };
    stateRef.current = nextState;
    setState(nextState);
    const turn: ChatTurnInput = {
      content: current.snapshot.originalText,
      pendingAttachments: [...current.snapshot.attachmentIds],
      attemptKey: current.snapshot.attemptKey,
    };
    try {
      return decision.mode === 'ordinary'
        ? await input.dispatchOrdinary(turn)
        : await input.dispatchReplacement(turn, decision.editMessageId);
    } finally {
      retryingRef.current = false;
    }
  }, [canonicalRows]);

  const purgeAttachmentId = useCallback((id: number) => {
    const next = purgeAudioRecoveryAttachment(stateRef.current, id);
    stateRef.current = next;
    setState(next);
  }, []);

  const abandon = useCallback(() => {
    stateRef.current = null;
    setState(null);
  }, []);
  const dismissUploadError = useCallback(() => setUploadError(null), []);
  const isUploading = useCallback(() => uploadingRef.current, []);
  const hasSnapshot = useCallback(() => stateRef.current?.kind === 'active', []);

  return {
    state,
    uploading,
    uploadError,
    retryDecision,
    onRuntimeOutcome,
    sendRecorded,
    retry,
    purgeAttachmentId,
    abandon,
    dismissUploadError,
    isUploading,
    hasSnapshot,
  };
}

export type AudioRecoveryApi = ReturnType<typeof useAudioRecovery>;
