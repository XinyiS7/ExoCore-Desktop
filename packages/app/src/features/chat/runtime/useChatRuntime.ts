import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type AssistantTraceEvent,
  type AttemptPersistence,
  type BlockedReason,
  type CallbackIdentity,
  type ChatRuntimeError,
  type ChatTransport,
  type ChatTurnInput,
  type ConversationDispatchSettings,
  type ConversationTelemetryProjection,
  type DispatchIntent,
  type NormalizedSSEEvent,
  type OperationState,
  type OptimisticUserRow,
  type PollingStatusResponse,
  type ReconcileContext,
  type RuntimeAssistantRow,
  type RuntimeAssistantTrace,
  type RuntimeAttemptOutcome,
  type RuntimeMarker,
  type RuntimeStatus,
  type RuntimeTelemetry,
  type StableOperationOwner,
  type TransportPayload,
  type TurnAcceptance,
} from './types';
import { SSEFrameDecoder, normalizePollingEvent, normalizeSSEEvent, parseRawSSEFrame } from './sse';
import { applyAssistantTraceEvent, applyNormalizedEvent, normalizeRuntimeTelemetry } from './events';
import {
  clearConversationDraft,
  clearRuntimeMarker,
  loadConversationDraft,
  loadTransportPreference,
  readRuntimeMarker,
  saveConversationDraft,
  saveTransportPreference,
  writeRuntimeMarker,
} from './storage';
import {
  classifyRuntimeError,
  fetchChatSSEStream,
  pollChatStatus,
  postChatAsync,
  postChatStop,
  postConversationBranch,
} from './client';
import { applyFreshWindow, fetchFreshWindow, findPersistedMessage } from '../queries';
import { AppApiError } from '../api';
import type { MessagePage } from '../types';
import { classifyAudioAttemptPage } from './attemptPersistence';

export interface UseChatRuntimeOptions {
  conversationId: number;
  isNearBottomRef?: RefObject<boolean>;
  /** Legacy pre-P1D fallback retained for isolated runtime harnesses. */
  thinkingLevel?: string | null;
  /** Current validated HUD values. `null` means target unresolved and blocks dispatch. */
  dispatchSettings?: ConversationDispatchSettings | null;
  /** Synchronous sibling-operation guard (cache/thinking/audio page owners). */
  isExternalOperationPending?: () => boolean;
  /** Live canonical persisted rows (page-level), used for request-side target validation. */
  persistedRowsRef?: RefObject<ReadonlyArray<{ id: number; role: string; indexInSession?: number }>>;
  /** Narrow, attempt-keyed P1C bridge. It reports no parser internals and
   * never owns or relaxes the C1B operation lock. */
  onAttemptOutcome?: (outcome: RuntimeAttemptOutcome) => void;
}

// ── Presentation projections (NEVER safety truths, §3.1/§3.2) ─────────────

function deriveStatus(state: OperationState): RuntimeStatus {
  switch (state.phase) {
    case 'idle':
      return 'idle';
    case 'predispatch':
      return 'submitting';
    case 'live':
      return state.payload.transport === 'sse' ? 'streaming' : 'polling';
    case 'stopping':
      return 'stopping';
    case 'reconciling':
      return 'reconciling';
    case 'blocked':
      // A paused poll of an ACCEPTED run keeps the Stop control surface:
      // status stays polling so the composer derives `runActive` and renders Stop.
      if (blockedStopEligible(state)) return 'polling';
      return state.reason === 'reconcile_failed' ? 'reconcile_error' : 'interrupted';
  }
}

function emptyTelemetryProjection(): ConversationTelemetryProjection {
  return {
    lastTurn: null,
    totals: { acceptedRuns: 0, inputChars: 0, outputChars: 0, toolCalls: 0, cachedInputChars: 0 },
  };
}

/**
 * Does this blocked state represent a paused poll of a server-ACCEPTED run
 * whose Stop control must remain available? Single source for the status
 * projection and stopGeneration eligibility.
 */
function blockedStopEligible(state: OperationState): boolean {
  if (state.phase !== 'blocked' || state.recovery?.kind !== 'resume-poll') return false;
  // After an ACCEPTED stop the pause must not re-offer Stop (duplicate stop
  // POST); a FAILED stop stays retryable. A pending stop POST hides it too.
  const rec = state.recovery;
  return !rec.stopPending && rec.preserveStop !== 'accepted';
}

function cacheSkippedNotice(reason: string): string {
  if (reason === 'platform_not_supported') return '当前平台不支持远端上下文缓存，本轮已使用普通请求。';
  if (reason === 'remote_cache_unavailable') return '远端上下文缓存暂不可用，本轮已使用普通请求。';
  return `本轮未使用上下文缓存（${reason}）。`;
}

function blockedCode(reason: BlockedReason): string {
  switch (reason) {
    case 'uncertain_write':
      return 'UNCERTAIN_WRITE';
    case 'not_found':
      return 'NOT_FOUND';
    case 'poll_failed':
      return 'POLL_FAILED';
    case 'reconcile_failed':
      return 'RECONCILE_FAILED';
  }
}

/** A+ capability gate: the canonical UUID source must exist before a send. */
function hasRandomUuidCapability(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
}

/**
 * A+ ordinary-send correlation id: exactly one canonical UUID per POST
 * attempt. Capability is validated before the epoch/optimistic/marker/POST;
 * without the canonical source the dispatch fails closed instead of minting
 * a speculative non-globally-unique id.
 */
function generateClientTurnId(): string {
  return crypto.randomUUID();
}

export function useChatRuntime({
  conversationId,
  isNearBottomRef,
  thinkingLevel,
  dispatchSettings,
  isExternalOperationPending,
  persistedRowsRef,
  onAttemptOutcome,
}: UseChatRuntimeOptions) {
  const queryClient = useQueryClient();

  // ── The ONE authoritative state (union + sync mirror) ────────────────────
  const [opState, setOpState] = useState<OperationState>({ phase: 'idle' });
  const opStateRef = useRef<OperationState>({ phase: 'idle' });
  const epochRef = useRef(0);
  const activeConversationIdRef = useRef(conversationId);
  activeConversationIdRef.current = conversationId;

  // ── Presentation-only state (overlay rows / warnings / safe errors) ──────
  const [optimisticUser, setOptimisticUser] = useState<OptimisticUserRow | null>(null);
  const [runtimeAssistant, setRuntimeAssistant] = useState<RuntimeAssistantRow | null>(null);
  const activeTraceRef = useRef<RuntimeAssistantTrace | null>(null);
  const [telemetryProjection, setTelemetryProjection] = useState<ConversationTelemetryProjection>(
    emptyTelemetryProjection,
  );
  const lastCountedTelemetryRef = useRef<{ epoch: number; telemetry: RuntimeTelemetry } | null>(null);
  const [protocolWarning, setProtocolWarning] = useState<string | null>(null);
  const [runtimeNotice, setRuntimeNotice] = useState<string | null>(null);
  const [transientError, setTransientError] = useState<ChatRuntimeError | null>(null);
  const [stopError, setStopError] = useState<ChatRuntimeError | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ id: number; content: string } | null>(null);
  const [restoredTurn, setRestoredTurn] = useState<{
    token: number;
    conversationId: number;
    text: string;
    attachmentIds: number[];
    collectionItemIds: number[];
  } | null>(null);
  const stashedDraftRef = useRef<string>('');
  const inFlightTurnRef = useRef<{
    epoch: number;
    conversationId: number;
    clientTurnId?: string;
    content: string;
    pendingAttachments: number[];
    collectionItems: number[];
    isAudioTurn: boolean;
  } | null>(null);
  const inFlightTurnsRef = useRef<Map<number, {
    epoch: number;
    conversationId: number;
    clientTurnId?: string;
    content: string;
    pendingAttachments: number[];
    collectionItems: number[];
    isAudioTurn: boolean;
  }>>(new Map());
  const lastTerminalErrorRef = useRef<ChatRuntimeError | null>(null);

  const [transport, setTransportState] = useState<ChatTransport>(loadTransportPreference);

  // ── In-memory transport continuation (never durable safety) ──────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);
  const pollCursorRef = useRef(0);
  const foregroundEventRef = useRef(0);
  const onAttemptOutcomeRef = useRef(onAttemptOutcome);
  onAttemptOutcomeRef.current = onAttemptOutcome;
  const activeAttemptRef = useRef<{
    epoch: number;
    attemptKey: string;
    attachmentIds: number[];
    /** Persistence known before this dispatch. Exact replacements must retain
     * their original binding when the replacement itself writes nothing. */
    predispatchPersistence: AttemptPersistence;
  } | null>(null);

  const emitAttemptOutcome = useCallback(
    (identity: CallbackIdentity, terminal: RuntimeAttemptOutcome['terminal'], persistence: AttemptPersistence) => {
      const attempt = activeAttemptRef.current;
      if (!attempt || attempt.epoch !== identity.epoch) return;
      onAttemptOutcomeRef.current?.({ attemptKey: attempt.attemptKey, terminal, persistence });
      if (terminal === 'done') activeAttemptRef.current = null;
    },
    [],
  );

  const persistenceAfterNoWrite = useCallback((identity: CallbackIdentity): AttemptPersistence => {
    const attempt = activeAttemptRef.current;
    if (!attempt || attempt.epoch !== identity.epoch) return { kind: 'proven_absent' };
    return attempt.predispatchPersistence;
  }, []);

  const isNearBottomRefLocal = isNearBottomRef;
  const persistedRows = persistedRowsRef;

  /** Identity recheck: captured {epoch, conversationId} must still be current. */
  const isCurrentIdentity = useCallback(
    (epoch: number, convId: number) =>
      epochRef.current === epoch && activeConversationIdRef.current === convId,
    [],
  );

  /**
   * Fresh phase read. TS keeps sticky `ref.current` narrowing across awaits;
   * a function call breaks that narrowing so identity checks after awaits stay
   * honest (the union is the ONLY lock source).
   */
  const phaseNow = useCallback((): OperationState['phase'] => opStateRef.current.phase, []);

  /**
   * The ONE transition boundary. Every state change flows through here; the
   * identity check makes a late callback from a departed route/epoch a no-op.
   */
  const transition = useCallback(
    (next: OperationState): OperationState | null => {
      if (next.phase !== 'idle') {
        if (!isCurrentIdentity(next.identity.epoch, next.identity.stableOwner.conversationId)) {
          return null;
        }
      }
      opStateRef.current = next;
      setOpState(next);
      return next;
    },
    [isCurrentIdentity],
  );

  // ── Derived projections from the single union ────────────────────────────
  const status = useMemo(() => deriveStatus(opState), [opState]);
  const busy = opState.phase !== 'idle';
  const isOperationPending = useCallback(() => phaseNow() !== 'idle', [phaseNow]);
  const hasPendingReconcile =
    opState.phase === 'reconciling' && opState.reconcile.waitForLatest && opState.reconcile.stage === 'idle';

  const observeRuntimeTelemetry = useCallback((epoch: number, telemetry: RuntimeTelemetry) => {
    const counted = lastCountedTelemetryRef.current;
    const prior = counted?.epoch === epoch ? counted.telemetry : undefined;
    lastCountedTelemetryRef.current = { epoch, telemetry };
    const value = (
      row: RuntimeTelemetry | undefined,
      key: 'inputChars' | 'outputChars' | 'toolCalls' | 'cachedInputChars',
    ) => row?.[key] ?? 0;
    setTelemetryProjection((current) => ({
      lastTurn: { ...telemetry },
      totals: {
        acceptedRuns: current.totals.acceptedRuns + (prior ? 0 : 1),
        inputChars: current.totals.inputChars - value(prior, 'inputChars') + value(telemetry, 'inputChars'),
        outputChars: current.totals.outputChars - value(prior, 'outputChars') + value(telemetry, 'outputChars'),
        toolCalls: current.totals.toolCalls - value(prior, 'toolCalls') + value(telemetry, 'toolCalls'),
        cachedInputChars:
          current.totals.cachedInputChars - value(prior, 'cachedInputChars') + value(telemetry, 'cachedInputChars'),
      },
    }));
  }, []);

  const runtimeError = useMemo<ChatRuntimeError | null>(() => {
    if (transientError) return transientError;
    const st = opState;
    if (st.phase === 'stopping' && stopError) return stopError;
    if (st.phase === 'blocked') {
      const retryClass =
        st.reason === 'uncertain_write' || st.reason === 'not_found' ? 'uncertain' : 'recoverable';
      return { code: blockedCode(st.reason), message: st.message, retryClass };
    }
    return null;
  }, [opState, transientError, stopError]);

  // ── Local reader/timer teardown (never issues an automatic stop, §5.4) ───
  const cancelLocalReaders = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (pollControllerRef.current) {
      pollControllerRef.current.abort();
      pollControllerRef.current = null;
    }
    if (pollingTimeoutRef.current !== null) {
      window.clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  /** Identity-checked full route UI release. */
  const releaseUi = useCallback(
    (
      identity: CallbackIdentity,
      options?: { retainStoppedTrace?: boolean; retainedTrace?: RuntimeAssistantTrace },
    ): boolean => {
      if (!isCurrentIdentity(identity.epoch, identity.stableOwner.conversationId)) return false;
      setOptimisticUser(null);
      if (options?.retainedTrace && options.retainedTrace.items.length > 0) {
        activeTraceRef.current = options.retainedTrace;
        setRuntimeAssistant({
          kind: 'client_assistant',
          clientKey: `assistant:${identity.epoch}`,
          content: '',
          statusText: '已停止生成',
          thinking: '',
          assistantTrace: options.retainedTrace,
          isStreaming: false,
          terminalKind: 'stopped',
        });
      } else if (options?.retainStoppedTrace) {
        setRuntimeAssistant((prev) => {
          const traceToRetain = options?.retainedTrace ?? prev?.assistantTrace ?? activeTraceRef.current;
          if (traceToRetain && traceToRetain.items.length > 0) {
            activeTraceRef.current = traceToRetain;
            return {
              kind: 'client_assistant',
              clientKey: prev?.clientKey ?? `assistant:${identity.epoch}`,
              content: '',
              statusText: '已停止生成',
              thinking: '',
              assistantTrace: traceToRetain,
              // CP-C: live-only voice failures must survive the stopped
              // trace-only retention; the noncanonical content is stripped.
              ...(prev?.voiceToolErrors && prev.voiceToolErrors.length > 0
                ? { voiceToolErrors: prev.voiceToolErrors }
                : {}),
              isStreaming: false,
              terminalKind: 'stopped',
            };
          }
          activeTraceRef.current = null;
          return null;
        });
      } else {
        activeTraceRef.current = null;
        setRuntimeAssistant(null);
      }
      setProtocolWarning(null);
      setTransientError(null);
      setStopError(null);
      opStateRef.current = { phase: 'idle' };
      setOpState({ phase: 'idle' });
      return true;
    },
    [isCurrentIdentity],
  );

  // ── Route entry: interpret an unsettled marker left by an earlier visit ──
  const interpretMarker = useCallback(
    (marker: RuntimeMarker) => {
      const stableOwner: StableOperationOwner = {
        conversationId: marker.conversationId,
        operation: marker.operation,
        transport: marker.transport,
        startedAt: marker.startedAt,
      };
      const identity: CallbackIdentity = {
        epoch: epochRef.current,
        stableOwner,
        destructive: marker.operation === 'edit' || marker.operation === 'regenerate',
      };
      if (marker.transport === 'async' && marker.asyncToken) {
        // Fresh async re-entry: clean overlay, replay same token from cursor 0.
        pollCursorRef.current = 0;
        transition({
          phase: 'live',
          identity,
          payload: { transport: 'async', token: marker.asyncToken, cursor: 0 },
        });
        setRuntimeAssistant({
          kind: 'client_assistant',
          clientKey: `assistant:${identity.epoch}`,
          content: '',
          statusText: '正在恢复会话进度…',
          thinking: '',
          isStreaming: true,
        });
        startPollingLoopRef.current(identity);
        return;
      }
      // An SSE run or an unacknowledged POST: the outcome cannot be observed
      // any more. Lock until the user acknowledges; never auto-resend.
      if (marker.operation === 'branch') {
        // §6.2: branch re-entry refreshes Recent without POST.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      transition({
        phase: 'blocked',
        identity,
        reason: 'uncertain_write',
        message:
          '上一次操作结果不确定（可能在提交时发生了页面刷新或网络中断）。消息可能已发送成功；确认后将解除锁定并同步最新消息，不会自动重发。',
        recovery: { kind: 'ack' },
      });
    },
    [transition, queryClient],
  );

  // ── Reconciliation: fetch → apply → release (§7, §8.1) ──────────────────
  const runReconcileStages = useCallback(
    async (
      identity: CallbackIdentity,
      ctx: ReconcileContext,
      errorPayload?: ChatRuntimeError,
    ) => {
      const convId = identity.stableOwner.conversationId;
      const isCurrent = isCurrentIdentity(identity.epoch, convId);
      if (isCurrent && opStateRef.current.phase !== 'reconciling') return;

      // 1) FETCH canonical newest window — network only; failure keeps the last
      //    displayed Query state (old data, marker and lock all remain).
      if (isCurrent) {
        transition({ phase: 'reconciling', identity, reconcile: { ...ctx, stage: 'fetching' } });
      }
      let page: MessagePage;
      try {
        page = await fetchFreshWindow(convId);
      } catch {
        if (!isCurrent) return;
        if (opStateRef.current.phase !== 'reconciling') return;
        emitAttemptOutcome(identity, 'reconcile_failed', {
          kind: 'unknown',
          reason: '消息历史对齐失败，无法确认语音消息是否已保存。',
        });
        transition({
          phase: 'blocked',
          identity,
          reason: 'reconcile_failed',
          message: '消息历史对齐失败，请点击重试。',
          recovery: { kind: 'reconcile-retry', context: ctx },
        });
        return;
      }
      if (isCurrent && opStateRef.current.phase !== 'reconciling') return;

      if (ctx.outcome !== 'done') {
        const terminal: RuntimeAttemptOutcome['terminal'] =
          ctx.outcome === 'stopped'
            ? 'stopped'
            : ctx.outcome === 'error'
              ? 'error'
              : 'interrupted';
        emitAttemptOutcome(identity, terminal, classifyAudioAttemptPage(page, activeAttemptRef.current?.attachmentIds ?? []));
      }

      // 2) APPLY — the single append/destructive Query owner.
      if (isCurrent) {
        transition({ phase: 'reconciling', identity, reconcile: { ...ctx, stage: 'applying' } });
      }
      try {
        applyFreshWindow(queryClient, convId, page, identity.destructive);
      } catch {
        if (!isCurrent) return;
        transition({
          phase: 'blocked',
          identity,
          reason: 'reconcile_failed',
          message: '消息历史对齐失败，请点击重试。',
          recovery: { kind: 'reconcile-retry', context: ctx },
        });
        return;
      }
      if (isCurrent && opStateRef.current.phase !== 'reconciling') return;

      if (ctx.outcome === 'not_found') {
        // The async token is gone server-side: canonical history is synced,
        // the marker stays (without the dead token, so a reload asks for
        // acknowledgement instead of re-polling) until the user acknowledges.
        if (isCurrent) {
          writeRuntimeMarker({ ...identity.stableOwner });
          transition({
            phase: 'blocked',
            identity,
            reason: 'not_found',
            message: '异步会话凭据已失效或后台服务已重置。消息历史已同步；确认后将解除锁定，不会自动重发。',
            recovery: { kind: 'ack' },
          });
        }
        return;
      }

      const inFlight =
        inFlightTurnsRef.current.get(convId) ??
        (inFlightTurnRef.current?.conversationId === convId ? inFlightTurnRef.current : null);
      const isDeterministicError =
        ctx.outcome === 'error' && (errorPayload?.retryClass ?? lastTerminalErrorRef.current?.retryClass) !== 'uncertain';
      const wasUserPersisted = Boolean(
        inFlight &&
          typeof inFlight.clientTurnId === 'string' &&
          page.messages.some(
            (m) =>
              m.role === 'user' &&
              typeof m.clientTurnId === 'string' &&
              m.clientTurnId === inFlight.clientTurnId,
          ),
      );
      const shouldRestoreFailedTurn = Boolean(
        isDeterministicError &&
          inFlight &&
          !inFlight.isAudioTurn &&
          !wasUserPersisted,
      );

      if (shouldRestoreFailedTurn && inFlight) {
        saveConversationDraft(convId, inFlight.content);
        if (isCurrent) {
          setRestoredTurn({
            token: Date.now(),
            conversationId: convId,
            text: inFlight.content,
            attachmentIds: inFlight.pendingAttachments,
            collectionItemIds: inFlight.collectionItems,
          });
        }
      }
      if (ctx.outcome === 'done' || wasUserPersisted || shouldRestoreFailedTurn) {
        inFlightTurnsRef.current.delete(convId);
        if (inFlightTurnRef.current?.conversationId === convId) {
          inFlightTurnRef.current = null;
        }
      }

      // 3) RELEASE — the outcome is settled; drop this operation's marker.
      clearRuntimeMarker(convId, identity.stableOwner.startedAt);
      if (!isCurrent) return;
      releaseUi(identity, { retainStoppedTrace: ctx.outcome === 'stopped' });
      if (shouldRestoreFailedTurn) {
        const errPayload = errorPayload ?? lastTerminalErrorRef.current;
        setTransientError({
          code: errPayload?.code || 'GENERATION_ERROR',
          message: errPayload?.message || '后台生成遇到错误，文字与附件已放回输入框',
          retryClass: 'safe',
          status: errPayload?.status ?? null,
          raw: errPayload?.raw,
        });
      } else if (isDeterministicError) {
        // The composer is not restored (the user row is persisted, or this
        // was an edit/regenerate), so the banner is the only place the
        // reason stays visible after releaseUi drops the overlay.
        const errPayload = errorPayload ?? lastTerminalErrorRef.current;
        setTransientError({
          code: errPayload?.code || 'GENERATION_ERROR',
          message: errPayload?.message || '后台生成遇到错误。',
          retryClass: 'safe',
          status: errPayload?.status ?? null,
          raw: errPayload?.raw,
        });
      }
    },
    [isCurrentIdentity, transition, queryClient, releaseUi, emitAttemptOutcome],
  );

  /** Terminal → ordered reconciliation, deferred while the reader is scrolled up. */
  const handleTerminal = useCallback(
    (kind: 'done' | 'stopped' | 'error', errorPayload?: ChatRuntimeError) => {
      const cur = opStateRef.current;
      if (cur.phase !== 'live' && cur.phase !== 'stopping') return;
      if (!isCurrentIdentity(cur.identity.epoch, cur.identity.stableOwner.conversationId)) return;
      lastTerminalErrorRef.current = kind === 'error' ? (errorPayload ?? null) : null;
      cancelLocalReaders();
      const { identity } = cur;
      if (kind === 'done') {
        emitAttemptOutcome(identity, 'done', {
          kind: 'unknown',
          reason: '成功终态无需恢复绑定。',
        });
      }
      if (kind === 'error') {
        setRuntimeAssistant((prev) =>
          prev ? { ...prev, isStreaming: false, terminalKind: 'error', error: errorPayload } : prev,
        );
      } else if (kind === 'stopped') {
        setRuntimeAssistant((prev) =>
          prev ? { ...prev, isStreaming: false, terminalKind: 'stopped', statusText: '已停止生成' } : prev,
        );
      } else {
        setRuntimeAssistant((prev) => (prev ? { ...prev, isStreaming: false, terminalKind: 'done' } : prev));
      }
      const ctx: ReconcileContext = {
        outcome: kind === 'done' ? 'done' : kind === 'stopped' ? 'stopped' : 'error',
        waitForLatest: !(isNearBottomRefLocal?.current ?? true),
        stage: 'idle',
      };
      transition({ phase: 'reconciling', identity, reconcile: ctx });
      // Backend cache truth may change at every terminal. Refetch only the
      // exact Conversation cache row; Query remains the sole read owner.
      void queryClient.invalidateQueries({ queryKey: ['control', 'cache', identity.stableOwner.conversationId] });
      if (!ctx.waitForLatest) void runReconcileStagesRef.current(identity, ctx);
    },
    [cancelLocalReaders, isCurrentIdentity, transition, isNearBottomRefLocal, emitAttemptOutcome, queryClient],
  );

  /** Async `not_found`: reconcile canonical FIRST, then ask for acknowledgement (§5.3). */
  const handleNotFound = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'live' && cur.phase !== 'stopping') return;
    if (!isCurrentIdentity(cur.identity.epoch, cur.identity.stableOwner.conversationId)) return;
    cancelLocalReaders();
    const { identity } = cur;
    const ctx: ReconcileContext = {
      outcome: 'not_found',
      waitForLatest: !(isNearBottomRefLocal?.current ?? true),
      stage: 'idle',
    };
    transition({ phase: 'reconciling', identity, reconcile: ctx });
    if (!ctx.waitForLatest) void runReconcileStagesRef.current(identity, ctx);
  }, [cancelLocalReaders, isCurrentIdentity, transition, isNearBottomRefLocal]);

  // ── Polling loop (async transport) ───────────────────────────────────────
  // Refs first so polling callbacks can reference them regardless of definition order.
  const handleTerminalRef = useRef(handleTerminal);
  handleTerminalRef.current = handleTerminal;
  const handleNotFoundRef = useRef(handleNotFound);
  handleNotFoundRef.current = handleNotFound;

  const applyPollEvents = useCallback(
    async (identity: CallbackIdentity, res: PollingStatusResponse) => {
      if (!isCurrentIdentity(identity.epoch, identity.stableOwner.conversationId)) {
        if (res.status === 'error') {
          const errorPayload = classifyRuntimeError(res.error_message ?? '后台生成遇到错误', 'terminal_persisted');
          const ctx: ReconcileContext = {
            outcome: 'error',
            waitForLatest: false,
            stage: 'idle',
          };
          void runReconcileStagesRef.current(identity, ctx, errorPayload);
        }
        return;
      }
      const cur = opStateRef.current;
      if (cur.phase !== 'live' && cur.phase !== 'stopping') return;

      for (const item of res.events) {
        const normalized = normalizePollingEvent(item);
        if (normalized.event === 'done' || normalized.event === 'stopped' || normalized.event === 'error') {
          continue;
        }
        if (normalized.event === 'assistant_trace' && normalized.parsedData) {
          const applied = applyAssistantTraceEvent(
            activeTraceRef.current ?? undefined,
            normalized.parsedData as AssistantTraceEvent,
          );
          if (applied.trace) {
            activeTraceRef.current = applied.trace;
          }
        }
        if (normalized.event === 'telemetry') {
          const telemetry = normalizeRuntimeTelemetry(normalized.parsedData);
          if (telemetry) observeRuntimeTelemetry(identity.epoch, telemetry);
        }
        setRuntimeAssistant((prev) => {
          const result = applyNormalizedEvent(prev, normalized, `assistant:${identity.epoch}`);
          if (result.warning) setProtocolWarning(result.warning);
          if (result.next?.cacheSkippedReason && result.next.cacheSkippedReason !== prev?.cacheSkippedReason) {
            setRuntimeNotice(cacheSkippedNotice(result.next.cacheSkippedReason));
          }
          return result.next;
        });
      }

      if (res.status === 'done') {
        handleTerminalRef.current('done');
        return;
      }
      if (res.status === 'stopped') {
        handleTerminalRef.current('stopped');
        return;
      }
      if (res.status === 'error') {
        handleTerminalRef.current(
          'error',
          classifyRuntimeError(res.error_message ?? '后台生成遇到错误', 'terminal_persisted'),
        );
        return;
      }
      if (res.status === 'not_found') {
        handleNotFoundRef.current();
        return;
      }
      // Continue polling only while the operation is live/stopping.
      const cur2 = opStateRef.current;
      if (cur2.phase !== 'live' && cur2.phase !== 'stopping') return;
      if (epochRef.current !== identity.epoch) return;
      pollingTimeoutRef.current = window.setTimeout(() => startPollingLoopRef.current(identity), 500);
    },
    [isCurrentIdentity, handleTerminalRef, handleNotFoundRef, observeRuntimeTelemetry],
  );

  /** Start/continue the poll loop for one identity (fresh or resumed). */
  const startPollingLoop = useCallback(
    (identity: CallbackIdentity) => {
      const convId = identity.stableOwner.conversationId;

      const pollStep = async () => {
        const st = opStateRef.current;
        if (st.phase !== 'live' && st.phase !== 'stopping') return;
        if (!isCurrentIdentity(st.identity.epoch, convId)) return;
        if (st.payload.transport !== 'async') return;
        const token = st.payload.token;
        const cursor = pollCursorRef.current;
        const identityNow = st.identity;
        const foregroundEventAtStart = foregroundEventRef.current;

        pollControllerRef.current = new AbortController();
        let res: PollingStatusResponse;
        try {
          res = await pollChatStatus(convId, token, cursor, pollControllerRef.current.signal);
        } catch (err) {
          if (!isCurrentIdentity(identityNow.epoch, convId)) return;
          if (opStateRef.current.phase !== 'live' && opStateRef.current.phase !== 'stopping') return;
          const classified = classifyRuntimeError(err, 'recoverable');
          if (classified.code === 'ABORTED') return;
          // Transient poll failure: token/cursor retained in memory; exact
          // resume is exposed — never discard the only recovery token (§5.3).
          // Capture stopping so resume restores it (no duplicate Stop).
          const curSt = opStateRef.current;
          const preserveStop = curSt.phase === 'stopping' ? curSt.stopOutcome : undefined;
          transition({
            phase: 'blocked',
            identity: identityNow,
            reason: 'poll_failed',
            message: classified.message,
            recovery: { kind: 'resume-poll', token, ...(preserveStop ? { preserveStop } : {}) },
          });
          // A suspended GET can reject after the foreground event already ran.
          // Consume that event once; a failed replacement GET without a new
          // foreground event remains blocked (no event-independent retry loop).
          if (document.visibilityState === "visible" && foregroundEventRef.current !== foregroundEventAtStart) {
            resumePollingRef.current();
          }
          return;
        }
        if (!isCurrentIdentity(identityNow.epoch, convId)) {
          if (res.status === 'error') {
            const errorPayload = classifyRuntimeError(res.error_message ?? '后台生成遇到错误', 'terminal_persisted');
            const ctx: ReconcileContext = {
              outcome: 'error',
              waitForLatest: false,
              stage: 'idle',
            };
            void runReconcileStagesRef.current(identityNow, ctx, errorPayload);
          }
          return;
        }
        if (opStateRef.current.phase !== 'live' && opStateRef.current.phase !== 'stopping') return;
        if (opStateRef.current.identity.epoch !== identityNow.epoch) return;
        pollCursorRef.current = res.cursor;
        await applyPollEventsRef.current(identityNow, res);
      };

      if (epochRef.current === identity.epoch) {
        void pollStep();
      }
    },
    [isCurrentIdentity, transition],
  );

  // ── SSE consumption loop (§5.2) — shared event boundary ──────────────────
  const consumeSSE = useCallback(
    async (identity: CallbackIdentity, res: Response) => {
      const convId = identity.stableOwner.conversationId;
      const reader = res.body?.getReader();
      if (!reader) {
        handleTerminalRef.current('error', {
          code: 'STREAM_FAILED',
          message: '无法读取服务器数据流',
          retryClass: 'uncertain',
        });
        return;
      }
      const decoder = new SSEFrameDecoder();
      let terminalEncountered = false;

      const liveContext = () => {
        const st = opStateRef.current;
        return (
          (st.phase === 'live' || st.phase === 'stopping') &&
          isCurrentIdentity(identity.epoch, convId)
        );
      };

      const consumeFrame = (normalized: NormalizedSSEEvent): boolean => {
        if (terminalEncountered) return false;
        if (!liveContext()) return true; // stale — stop consuming
        if (normalized.event === 'done') {
          terminalEncountered = true;
          handleTerminalRef.current('done');
          return true;
        }
        if (normalized.event === 'stopped') {
          terminalEncountered = true;
          handleTerminalRef.current('stopped');
          return true;
        }
        if (normalized.event === 'error') {
          terminalEncountered = true;
          handleTerminalRef.current(
            'error',
            classifyRuntimeError(normalized.parsedData ?? normalized.data, 'terminal_persisted'),
          );
          return true;
        }
        if (normalized.event === 'assistant_trace' && normalized.parsedData) {
          const applied = applyAssistantTraceEvent(
            activeTraceRef.current ?? undefined,
            normalized.parsedData as AssistantTraceEvent,
          );
          if (applied.trace) {
            activeTraceRef.current = applied.trace;
          }
        }
        if (normalized.event === 'telemetry') {
          const telemetry = normalizeRuntimeTelemetry(normalized.parsedData);
          if (telemetry) observeRuntimeTelemetry(identity.epoch, telemetry);
        }
        setRuntimeAssistant((prev) => {
          const result = applyNormalizedEvent(prev, normalized, `assistant:${identity.epoch}`);
          if (result.warning) setProtocolWarning(result.warning);
          if (result.next?.cacheSkippedReason && result.next.cacheSkippedReason !== prev?.cacheSkippedReason) {
            setRuntimeNotice(cacheSkippedNotice(result.next.cacheSkippedReason));
          }
          return result.next;
        });
        return false;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (!liveContext()) {
            void reader.cancel();
            return;
          }
          if (done) {
            const residualFrames = decoder.flush();
            for (const frame of residualFrames) {
              const { event, data } = parseRawSSEFrame(frame);
              if (consumeFrame(normalizeSSEEvent(event, data))) return;
            }
            if (!terminalEncountered) {
              handleTerminalRef.current('error', {
                code: 'STREAM_INTERRUPTED',
                message: '数据流异常中断 (EOF without terminal)',
                retryClass: 'uncertain',
              });
            }
            return;
          }
          const frames = decoder.pushChunk(value);
          for (const frame of frames) {
            const { event, data } = parseRawSSEFrame(frame);
            if (consumeFrame(normalizeSSEEvent(event, data))) return;
          }
        }
      } catch (streamErr) {
        if (!liveContext()) return;
        const classified = classifyRuntimeError(streamErr, 'uncertain');
        if (classified.code === 'ABORTED') return;
        handleTerminalRef.current('error', classified);
      }
    },
    [isCurrentIdentity, observeRuntimeTelemetry],
  );

  // ── Stop (§5.4) — stop-before-abort; accepted stop is not terminal ──────
  /** Stop raced a finished run: reconcile canonical, never invent 'stopped'. */
  const reconcileAfterStopRace = useCallback(
    (identity: CallbackIdentity) => {
      cancelLocalReaders();
      setRuntimeAssistant((prev) =>
        prev ? { ...prev, isStreaming: false, statusText: '生成已结束（停止请求竞态）' } : prev,
      );
      const ctx: ReconcileContext = {
        outcome: 'interrupted',
        waitForLatest: !(isNearBottomRefLocal?.current ?? true),
        stage: 'idle',
      };
      transition({ phase: 'reconciling', identity, reconcile: ctx });
      if (!ctx.waitForLatest) void runReconcileStagesRef.current(identity, ctx);
    },
    [cancelLocalReaders, isNearBottomRefLocal, transition],
  );

  const stopGeneration = useCallback(async () => {
    const cur = opStateRef.current;
    const canStop =
      cur.phase === 'live' ||
      (cur.phase === 'stopping' && cur.stopOutcome === 'failed') ||
      (cur.phase === 'blocked' && blockedStopEligible(cur));
    if (!canStop) return;

    // A paused poll of an ACCEPTED run keeps Stop reachable: one exact stop
    // POST from here; the run drains to terminal after the poll resumes.
    if (cur.phase === 'blocked') {
      const rec = cur.recovery;
      if (rec?.kind !== 'resume-poll') return;
      const { identity } = cur;
      const convId = identity.stableOwner.conversationId;
      transition({
        phase: 'stopping',
        identity,
        payload: { transport: 'async', token: rec.token, cursor: pollCursorRef.current },
        stopOutcome: 'accepted',
      });
      setStopError(null);
      setRuntimeAssistant((prev) => (prev ? { ...prev, statusText: '正在停止生成…' } : prev));
      try {
        const res = await postChatStop(convId, rec.token);
        if (!isCurrentIdentity(identity.epoch, convId)) return;
        const cur2 = opStateRef.current;
        if (cur2.phase !== 'stopping' || cur2.identity.epoch !== identity.epoch) return;
        if (res.status === 'not_found') {
          reconcileAfterStopRace(identity);
          return;
        }
        // Accepted stop: back to the pause; resuming drains to terminal and
        // never re-offers a duplicate Stop.
        transition({
          phase: 'blocked',
          identity,
          reason: cur.reason,
          message: '停止请求已发送。继续轮询后将同步剩余内容。',
          recovery: { ...rec, preserveStop: 'accepted', stopPending: true },
        });
      } catch (err) {
        if (!isCurrentIdentity(identity.epoch, convId)) return;
        const cur3 = opStateRef.current;
        if (cur3.phase !== 'stopping' || cur3.identity.epoch !== identity.epoch) return;
        const classified = classifyRuntimeError(err, 'recoverable');
        // Failed stop: back to the pause with Stop visible and retryable.
        transition({
          phase: 'blocked',
          identity,
          reason: cur.reason,
          message: `停止请求失败：${classified.message}（可再次点击停止；生成仍在进行）。`,
          recovery: { ...rec, stopPending: false },
        });
      }
      return;
    }

    const { identity } = cur;
    const convId = identity.stableOwner.conversationId;
    const token = cur.payload.transport === 'async' ? cur.payload.token : undefined;

    transition({ ...cur, phase: 'stopping', stopOutcome: 'accepted' });
    setStopError(null);
    try {
      const res = await postChatStop(convId, token);
      if (!isCurrentIdentity(identity.epoch, convId)) return;
      const cur2 = opStateRef.current;
      if (cur2.phase !== 'stopping' || cur2.identity.epoch !== identity.epoch) return;
      if (res.status === 'not_found') {
        reconcileAfterStopRace(identity);
        return;
      }
      // Accepted stop request: keep consuming until terminal/reconciliation.
      if (cur2.payload.transport === 'sse') {
        setRuntimeAssistant((prev) => (prev ? { ...prev, statusText: '正在停止生成…' } : prev));
      }
    } catch (err) {
      if (!isCurrentIdentity(identity.epoch, convId)) return;
      const cur3 = opStateRef.current;
      if (cur3.phase !== 'stopping' || cur3.identity.epoch !== identity.epoch) return;
      const classified = classifyRuntimeError(err, 'recoverable');
      // Stop failure stays visible and retryable; the run keeps streaming.
      setStopError({
        code: 'STOP_FAILED',
        message:
          classified.code === 'STOP_CONTRACT'
            ? `停止结果不确定：${classified.message}（可重试）`
            : `停止请求失败：${classified.message}（可重试，生成仍在进行）`,
        retryClass: 'recoverable',
      });
      transition({ ...cur3, stopOutcome: 'failed' });
    }
  }, [isCurrentIdentity, transition, reconcileAfterStopRace]);

  // ── Dispatch failure handling (send/edit/regenerate) ─────────────────────
  const handleDispatchFailure = useCallback(
    (dispatchErr: unknown, identity: CallbackIdentity): TurnAcceptance => {
      const classified = classifyRuntimeError(dispatchErr, 'uncertain');
      if (classified.retryClass === 'safe') {
        // A rejected replacement wrote nothing new, but its original user
        // Message still exists. Preserve that exact binding; only an initial
        // ordinary send can become proven-absent here.
        emitAttemptOutcome(identity, 'rejected', persistenceAfterNoWrite(identity));
        // Proved-safe rejection: nothing was written; draft/action preserved.
        clearRuntimeMarker(identity.stableOwner.conversationId, identity.stableOwner.startedAt);
        releaseUi(identity);
        setTransientError(classified);
        return 'rejected';
      }
      // Uncertain outcome (network/malformed/contract): the marker stays and
      // explicit acknowledgement is the only unlock.
      emitAttemptOutcome(identity, 'rejected', {
        kind: 'unknown',
        reason: '发送结果不确定，需先完成消息历史对齐。',
      });
      transition({
        phase: 'blocked',
        identity,
        reason: 'uncertain_write',
        message: classified.message,
        recovery: { kind: 'ack' },
      });
      return 'rejected';
    },
    [releaseUi, transition, emitAttemptOutcome, persistenceAfterNoWrite],
  );

  // ── Core dispatch (send / edit / regenerate) ─────────────────────────────
  const executeTurn = useCallback(
    async (
      turn: ChatTurnInput,
      operation: 'send' | 'edit' | 'regenerate',
      editMessageId?: number,
    ): Promise<TurnAcceptance> => {
      // Synchronous same-tick guards: runtime union remains authoritative for
      // chat; the page-owned cache action is the one excluded sibling command.
      if (phaseNow() !== 'idle' || isExternalOperationPending?.()) return 'rejected';

      const trimmedContent = turn.content.trim();
      const pendingAttachments = turn.pendingAttachments ?? [];
      const collectionItems = turn.collectionItems ?? [];
      // Explicit Force Cache send is an ordinary-send-only intent: destructive
      // (edit/regenerate) turns can never carry it — 编辑历史消息不得误触
      // force rebuild. Retries replay exact content/attachments, never the
      // one-shot force flag.
      const forceCacheRebuild = operation === 'send' && turn.forceCacheRebuild === true;
      // `undefined` is a compatibility seam for pre-P1D isolated runtime
      // harnesses. Production passes either a validated settings object or
      // explicit null; null fails closed before any marker or POST.
      //
      // Precedence: the page-validated CURRENT selection outranks a replayed
      // attempt's captured snapshot. A stale snapshot must never silently
      // dispatch the target the user has since switched away from — an AGY
      // selection would otherwise replay as the old direct endpoint and reach
      // the wire as a plain disconnect. `null` still fails closed; the
      // snapshot only covers a null current selection (audio retry/recovery),
      // and the legacy `undefined` harness keeps its old behavior.
      const currentSettings = dispatchSettings;
      const replayedSettings = turn.dispatchSettings;
      const effectiveSettings =
        currentSettings === undefined
          ? replayedSettings
          : currentSettings ?? replayedSettings ?? null;
      const staleReplayTarget =
        currentSettings &&
        replayedSettings &&
        (replayedSettings.model !== currentSettings.model ||
          replayedSettings.endpoint !== currentSettings.endpoint)
          ? { replayed: replayedSettings, current: currentSettings }
          : null;
      if (effectiveSettings === null) {
        setTransientError({
          code: 'TARGET_UNRESOLVED',
          message: '当前模型或端点尚未就绪，请在战术控制面板中重新选择。',
          retryClass: 'safe',
        });
        return 'rejected';
      }
      if (
        effectiveSettings !== undefined &&
        (!effectiveSettings.model.trim() ||
          !Number.isInteger(effectiveSettings.endpoint) ||
          effectiveSettings.endpoint <= 0 ||
          (effectiveSettings.sessionType !== 'full' && effectiveSettings.sessionType !== 'lite'))
      ) {
        setTransientError({ code: 'TARGET_INVALID', message: '当前模型或端点不可用，请重新选择。', retryClass: 'safe' });
        return 'rejected';
      }
      const capturedSettings = effectiveSettings
        ? { ...effectiveSettings, model: effectiveSettings.model.trim() }
        : undefined;
      if (pendingAttachments.some((id) => !Number.isInteger(id) || id <= 0)) {
        setTransientError({ code: 'ATTACHMENT_INVALID', message: '附件参数包含无效编号。', retryClass: 'safe' });
        return 'rejected';
      }
      const destructive = operation === 'edit' || operation === 'regenerate';
      // #61: brought-back cards ride ordinary sends only (never edit/regenerate).
      if (collectionItems.length > 0 && operation !== 'send') return 'rejected';
      let predispatchPersistence: AttemptPersistence = { kind: 'proven_absent' };

      if (destructive) {
        if (!editMessageId || !Number.isInteger(editMessageId) || editMessageId <= 0) {
          setTransientError({ code: 'TARGET_INVALID', message: '目标消息编号无效。', retryClass: 'safe' });
          return 'rejected';
        }
        const target = findPersistedMessage(persistedRows?.current, editMessageId, 'user');
        if (!target) {
          setTransientError({
            code: 'TARGET_INVALID',
            message: '目标消息已不存在或不是您的消息，无法编辑/重生成。',
            retryClass: 'safe',
          });
          return 'rejected';
        }
        if (turn.attemptKey) {
          const canonicalTarget = persistedRows?.current?.find((row) => row.id === target.id);
          predispatchPersistence =
            typeof canonicalTarget?.indexInSession === 'number'
              ? {
                  kind: 'exact_persisted',
                  messageId: target.id,
                  indexInSession: canonicalTarget.indexInSession,
                }
              : {
                  kind: 'unknown',
                  reason: '无法保留原始消息的精确位置，请先重新加载历史。',
                };
        }
      }
      if (
        operation !== 'regenerate' &&
        trimmedContent.length === 0 &&
        pendingAttachments.length === 0 &&
        collectionItems.length === 0
      ) {
        return 'rejected';
      }
      // Historical edit/regenerate never receives or consumes newly composed
      // IDs. Recovery replacement is the sole explicit exception because it
      // replays the exact already-bound snapshot.
      if (destructive && pendingAttachments.length > 0 && !turn.attemptKey) return 'rejected';

      // A+ closure: an ordinary-send correlation id requires the platform's
      // canonical UUID source. Without it the send fails closed here — before
      // the epoch, optimistic row, marker or POST — with a visible retryable
      // error while the draft stays with the user.
      if (operation === 'send' && !hasRandomUuidCapability()) {
        setTransientError({
          code: 'CLIENT_TURN_ID_UNAVAILABLE',
          message: '当前环境缺少安全随机数能力（crypto.randomUUID 不可用），消息未发送；请升级浏览器或改用安全上下文后重试。',
          retryClass: 'safe',
        });
        return 'rejected';
      }

      cancelLocalReaders();
      epochRef.current += 1;
      const epoch = epochRef.current;
      const convId = activeConversationIdRef.current;
      const startedAt = Date.now();
      const stableOwner: StableOperationOwner = { conversationId: convId, operation, transport, startedAt };
      const identity: CallbackIdentity = { epoch, stableOwner, destructive };
      const intent: DispatchIntent = {
        operation,
        content: trimmedContent,
        editMessageId,
        dispatchSettings: capturedSettings,
        pendingAttachments: [...pendingAttachments],
        collectionItems: [...collectionItems],
        forceCacheRebuild,
        attemptKey: turn.attemptKey,
      };

      // idle → predispatch is synchronous; double click/Enter cannot pass.
      transition({ phase: 'predispatch', identity, intent });
      activeAttemptRef.current = turn.attemptKey
        ? {
            epoch,
            attemptKey: turn.attemptKey,
            attachmentIds: [...pendingAttachments],
            predispatchPersistence,
          }
        : null;

      // A+ closure: each ordinary send attempt mints exactly one correlation
      // id here — shared by the optimistic row and this attempt's POST — so
      // the canonical handover rests purely on exact history-row equality.
      let clientTurnIdForPost: string | undefined;
      if (operation === 'send') {
        clientTurnIdForPost = generateClientTurnId();
        const inFlightData = {
          epoch,
          conversationId: convId,
          clientTurnId: clientTurnIdForPost,
          content: trimmedContent,
          pendingAttachments: [...pendingAttachments],
          collectionItems: [...collectionItems],
          isAudioTurn: Boolean(turn.attemptKey),
        };
        inFlightTurnRef.current = inFlightData;
        inFlightTurnsRef.current.set(convId, inFlightData);
        setOptimisticUser({
          kind: 'client_user',
          clientKey: `user:${epoch}`,
          content: trimmedContent,
          createdAt: new Date().toISOString(),
          pendingAttachmentIds: [...pendingAttachments],
          clientTurnId: clientTurnIdForPost,
        });
      } else {
        inFlightTurnRef.current = null;
        inFlightTurnsRef.current.delete(convId);
        setOptimisticUser(null);
      }
      activeTraceRef.current = null;
      setRuntimeAssistant({
        kind: 'client_assistant',
        clientKey: `assistant:${epoch}`,
        content: '',
        thinking: '',
        isStreaming: true,
      });
      setTransientError(null);
      setStopError(null);
      setProtocolWarning(null);
      setRestoredTurn(null);
      // A stale replay target is replaced (not replayed) and made visible here,
      // after the notice reset, so the divergence is diagnosable without log
      // archaeology.
      setRuntimeNotice(
        staleReplayTarget
          ? `已按当前选择派发（${staleReplayTarget.current.model} @ 端点 ${staleReplayTarget.current.endpoint}）；重放快照中的旧目标（${staleReplayTarget.replayed.model} @ 端点 ${staleReplayTarget.replayed.endpoint}）已过期`
          : null,
      );
      if (staleReplayTarget) {
        console.warn('[V4Runtime] stale replay target replaced by current selection', {
          replayed: {
            model: staleReplayTarget.replayed.model,
            endpoint: staleReplayTarget.replayed.endpoint,
          },
          current: {
            model: staleReplayTarget.current.model,
            endpoint: staleReplayTarget.current.endpoint,
          },
        });
      }

      // Best-effort in-flight marker so a reload can recognise an unsettled
      // run; a storage failure never blocks the POST.
      writeRuntimeMarker({ ...stableOwner });

      // Exactly one POST per dispatch.
      if (transport === 'sse') {
        try {
          abortControllerRef.current = new AbortController();
          const res = await fetchChatSSEStream({
            conversationId: convId,
            content: operation === 'regenerate' ? '' : trimmedContent,
            thinkingLevel: capturedSettings?.thinkingLevel ?? thinkingLevel ?? null,
            model: capturedSettings?.model,
            endpoint: capturedSettings?.endpoint,
            cacheEnabled: capturedSettings?.cacheEnabled,
            sessionType: capturedSettings?.sessionType,
            memoryInjectionEnabled: capturedSettings?.memoryInjectionEnabled,
            editMessageId: destructive ? editMessageId : undefined,
            clientTurnId: clientTurnIdForPost,
            pendingAttachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
            collectionItems: collectionItems.length > 0 ? collectionItems : undefined,
            forceCacheRebuild,
            signal: abortControllerRef.current.signal,
          });
          if (!isCurrentIdentity(epoch, convId)) return 'rejected';
          if (phaseNow() !== 'predispatch') return 'rejected';
          // Request ACCEPTED: the draft is consumed; edit mode ends.
          clearConversationDraft(convId);
          if (operation === 'edit') setEditingTarget(null);
          transition({
            phase: 'live',
            identity,
            payload: { transport: 'sse', readerId: epoch },
          });
          void consumeSSE(identity, res);
          return 'accepted';
        } catch (dispatchErr) {
          if (!isCurrentIdentity(epoch, convId)) return 'rejected';
          if (phaseNow() !== 'predispatch') return 'rejected';
          return handleDispatchFailure(dispatchErr, identity);
        }
      }

      // Async transport
      try {
        abortControllerRef.current = new AbortController();
        const ack = await postChatAsync({
          conversationId: convId,
          content: operation === 'regenerate' ? '' : trimmedContent,
          thinkingLevel: capturedSettings?.thinkingLevel ?? thinkingLevel ?? null,
          model: capturedSettings?.model,
          endpoint: capturedSettings?.endpoint,
          cacheEnabled: capturedSettings?.cacheEnabled,
          sessionType: capturedSettings?.sessionType,
          memoryInjectionEnabled: capturedSettings?.memoryInjectionEnabled,
          editMessageId: destructive ? editMessageId : undefined,
          clientTurnId: clientTurnIdForPost,
          pendingAttachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
          collectionItems: collectionItems.length > 0 ? collectionItems : undefined,
          forceCacheRebuild,
          signal: abortControllerRef.current.signal,
        });
        if (!isCurrentIdentity(epoch, convId)) return 'rejected';
        if (phaseNow() !== 'predispatch') return 'rejected';
        clearConversationDraft(convId);
        if (operation === 'edit') setEditingTarget(null);
        // The token lets a reload resume polling this run.
        writeRuntimeMarker({ ...stableOwner, asyncToken: ack.message_id });
        pollCursorRef.current = 0;
        transition({
          phase: 'live',
          identity,
          payload: { transport: 'async', token: ack.message_id, cursor: 0 },
        });
        startPollingLoop(identity);
        return 'accepted';
      } catch (dispatchErr) {
        if (!isCurrentIdentity(epoch, convId)) return 'rejected';
        if (phaseNow() !== 'predispatch') return 'rejected';
        return handleDispatchFailure(dispatchErr, identity);
      }
    },
    [
      isCurrentIdentity,
      transition,
      transport,
      thinkingLevel,
      dispatchSettings,
      isExternalOperationPending,
      persistedRows,
      cancelLocalReaders,
      handleDispatchFailure,
      consumeSSE,
      startPollingLoop,
      phaseNow,
    ],
  );

  // ── Public commands ──────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (turn: ChatTurnInput): Promise<TurnAcceptance> => executeTurn(turn, 'send'),
    [executeTurn],
  );

  const confirmEdit = useCallback(
    (newContent: string): Promise<TurnAcceptance> => {
      if (!editingTarget) return Promise.resolve('rejected');
      return executeTurn({ content: newContent }, 'edit', editingTarget.id);
    },
    [editingTarget, executeTurn],
  );

  const regenerate = useCallback(
    (messageId: number): Promise<TurnAcceptance> => executeTurn({ content: '' }, 'regenerate', messageId),
    [executeTurn],
  );

  const retryRecoveredTurn = useCallback(
    (turn: ChatTurnInput, editMessageId: number): Promise<TurnAcceptance> =>
      executeTurn(turn, 'edit', editMessageId),
    [executeTurn],
  );

  const startEdit = useCallback((messageId: number, initialContent: string) => {
    stashedDraftRef.current = loadConversationDraft(activeConversationIdRef.current);
    setEditingTarget({ id: messageId, content: initialContent });
  }, []);

  const cancelEdit = useCallback(() => {
    if (stashedDraftRef.current) {
      saveConversationDraft(activeConversationIdRef.current, stashedDraftRef.current);
    }
    stashedDraftRef.current = '';
    setEditingTarget(null);
  }, []);

  /** Transient polling failure → exact resume from the retained in-memory cursor. */
  const resumePolling = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'blocked' || cur.reason !== 'poll_failed') return;
    const rec = cur.recovery;
    if (!rec || rec.kind !== 'resume-poll') return;
    const { identity } = cur;
    if (!isCurrentIdentity(identity.epoch, identity.stableOwner.conversationId)) return;
    const payload: TransportPayload = { transport: 'async', token: rec.token, cursor: pollCursorRef.current };
    // When the pause was captured mid-stop, resume STOPPING (with its
    // stopOutcome) — an accepted stop stays accepted (no duplicate POST) and
    // a failed one stays retryable.
    transition(
      rec.preserveStop
        ? { phase: 'stopping', identity, payload, stopOutcome: rec.preserveStop }
        : { phase: 'live', identity, payload },
    );
    startPollingLoop(identity);
  }, [transition, startPollingLoop, isCurrentIdentity]);

  /** Reconciliation retry after a fetch/apply failure — retries the failed step. */
  const retrySync = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'blocked' || cur.reason !== 'reconcile_failed') return;
    const rec = cur.recovery;
    if (!rec || rec.kind !== 'reconcile-retry') return;
    const { identity } = cur;
    transition({ phase: 'reconciling', identity, reconcile: rec.context });
    void runReconcileStagesRef.current(identity, rec.context);
  }, [transition]);

  /** Scrolled-up hold → exactly one fresh offset-0 canonical application. */
  const applyPendingReconcile = useCallback(async (): Promise<void> => {
    const cur = opStateRef.current;
    if (cur.phase !== 'reconciling' || !cur.reconcile.waitForLatest || cur.reconcile.stage !== 'idle') return;
    const { identity, reconcile } = cur;
    await runReconcileStagesRef.current(identity, reconcile);
  }, []);

  /**
   * Explicit acknowledgement of an uncertain/not_found outcome. Canonical
   * (or Recent for branch) refresh happens FIRST, then the marker is cleared
   * and the route unlocks.
   */
  const acknowledgeUncertain = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'blocked') return;
    if (cur.reason !== 'uncertain_write' && cur.reason !== 'not_found') return;
    if (cur.recovery?.kind !== 'ack') return;
    const { identity } = cur;
    if (identity.stableOwner.operation === 'branch') {
      // §6.2: Recent is the canonical discovery path for a possibly-created
      // branch Conversation; no branch POST is ever re-issued.
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      clearRuntimeMarker(identity.stableOwner.conversationId, identity.stableOwner.startedAt);
      releaseUi(identity);
      return;
    }
    // send/edit/regenerate: canonical refresh → clear → identity-checked unlock.
    const ctx: ReconcileContext = { outcome: 'ack_refresh', waitForLatest: false, stage: 'idle' };
    transition({ phase: 'reconciling', identity, reconcile: ctx });
    void runReconcileStagesRef.current(identity, ctx);
  }, [transition, queryClient, releaseUi]);

  const dismissTransient = useCallback(() => {
    setTransientError(null);
  }, []);

  const dismissRuntimeNotice = useCallback(() => setRuntimeNotice(null), []);

  const setTransport = useCallback((t: ChatTransport) => {
    setTransportState(t);
    saveTransportPreference(t);
  }, []);

  // ── Branch: same operation identity + lock (§6.1/§6.2/§11.1 #3, #6) ──────
  const branchFrom = useCallback(
    async (messageId: number): Promise<{ conversationId: number }> => {
      const phaseBeforeBranch = phaseNow();
      if (phaseBeforeBranch !== 'idle') {
        throw new Error('当前有其他操作进行中，请稍后再试');
      }
      if (!Number.isInteger(messageId) || messageId <= 0) {
        throw new Error('无效的消息编号');
      }
      const target = findPersistedMessage(persistedRows?.current, messageId, 'assistant');
      if (!target) {
        throw new Error('只能从已持久化的助手消息创建分支。');
      }

      cancelLocalReaders();
      epochRef.current += 1;
      const epoch = epochRef.current;
      const convId = activeConversationIdRef.current;
      const stableOwner: StableOperationOwner = {
        conversationId: convId,
        operation: 'branch',
        transport: 'sse',
        startedAt: Date.now(),
      };
      const identity: CallbackIdentity = { epoch, stableOwner, destructive: false };
      const intent: DispatchIntent = { operation: 'branch', content: '', branchFromMessageId: messageId };

      transition({ phase: 'predispatch', identity, intent });
      setTransientError(null);
      writeRuntimeMarker({ ...stableOwner });

      try {
        const result = await postConversationBranch({
          conversationId: convId,
          branchFromMessageId: messageId,
        });
        // Source-result completion runs FIRST and independently of caller
        // validity: Recent refresh + marker clear; a route switch / modal
        // close must never leave the source marker behind.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        clearRuntimeMarker(convId, stableOwner.startedAt);
        if (!isCurrentIdentity(epoch, convId)) return result;
        if (phaseNow() !== 'predispatch') throw new Error('操作状态已变化，请重试。');
        releaseUi(identity);
        return { conversationId: result.conversationId };
      } catch (err) {
        const classified = classifyRuntimeError(err, 'uncertain');
        const uiEligible = isCurrentIdentity(epoch, convId) && phaseNow() === 'predispatch';
        if (classified.retryClass === 'safe') {
          clearRuntimeMarker(convId, stableOwner.startedAt);
          if (uiEligible) releaseUi(identity);
          throw err;
        }
        // Ambiguous/malformed/network: a new Conversation may exist
        // server-side — refresh Recent regardless; the marker stays and the
        // route locks until acknowledged.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        if (uiEligible) {
          transition({
            phase: 'blocked',
            identity,
            reason: 'uncertain_write',
            message: '分支结果不确定：会话可能已创建。最近会话已刷新；本次操作已锁定，确认后可解除。',
            recovery: { kind: 'ack' },
          });
        }
        const causeMsg = err instanceof Error && err.message ? err.message : '分支结果不确定，请在“最近会话”中确认。';
        throw new AppApiError(`${causeMsg} 结果不确定：会话可能已创建。最近会话已刷新；本次操作已锁定，确认后可解除。`, {
          code: 'UNCERTAIN_BRANCH',
          ambiguousWrite: true,
          body: err,
        });
      }
    },
    [isCurrentIdentity, transition, persistedRows, queryClient, releaseUi, cancelLocalReaders, phaseNow],
  );

  // ── Route/reload effect: unconditional local reset + marker interpretation ──
  useEffect(() => {
    const convId = conversationId;

    // 1) Reset ONLY route-local presentation + authoritative baseline before
    //    loading this Conversation's own marker (direct chat→chat navigation).
    epochRef.current += 1;
    opStateRef.current = { phase: 'idle' };
    setOpState({ phase: 'idle' });
    setOptimisticUser(null);
    setRuntimeAssistant(null);
    activeTraceRef.current = null;
    lastCountedTelemetryRef.current = null;
    setTelemetryProjection(emptyTelemetryProjection());
    setProtocolWarning(null);
    setRuntimeNotice(null);
    setTransientError(null);
    setStopError(null);
    setEditingTarget(null);
    setRestoredTurn(null);
    stashedDraftRef.current = '';
    activeAttemptRef.current = null;
    pollCursorRef.current = 0;

    // 2) Interpret an unsettled marker from an earlier visit/reload.
    const marker = readRuntimeMarker(convId);
    if (marker) interpretMarker(marker);

    // 3) Unconditional local teardown (never an automatic stop): cancel local
    //    readers/timers and invalidate the epoch. The marker of an unsettled
    //    run is left in place so re-entry resumes or asks for acknowledgement.
    return () => {
      cancelLocalReadersRef.current();
      epochRef.current += 1;
      opStateRef.current = { phase: 'idle' };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Foreground recovery observes the same retained run as the manual button.
  // resumePolling transitions the synchronous union before starting a GET, so
  // event bursts cannot acquire parallel polling chains. No mount-time retry.
  useEffect(() => {
    const convId = conversationId;
    let attached = true;
    const onForeground = () => {
      // The operation epoch changes on every send, not just route changes.
      // Bind listeners to the route; resumePolling checks the current run.
      if (!attached || document.visibilityState !== "visible" || activeConversationIdRef.current !== convId) return;
      foregroundEventRef.current += 1;
      resumePollingRef.current();
    };
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground);
    window.addEventListener("online", onForeground);
    return () => {
      attached = false;
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("pageshow", onForeground);
      window.removeEventListener("online", onForeground);
    };
  }, [conversationId]);

  // Latest-ref bridges so mount/unmount callbacks never close over stale values.
  const resumePollingRef = useRef(resumePolling);
  resumePollingRef.current = resumePolling;
  const startPollingLoopRef = useRef(startPollingLoop);
  startPollingLoopRef.current = startPollingLoop;
  const applyPollEventsRef = useRef(applyPollEvents);
  applyPollEventsRef.current = applyPollEvents;
  const runReconcileStagesRef = useRef(runReconcileStages);
  runReconcileStagesRef.current = runReconcileStages;
  const cancelLocalReadersRef = useRef(cancelLocalReaders);
  cancelLocalReadersRef.current = cancelLocalReaders;

  return {
    transport,
    setTransport,
    status,
    busy,
    isOperationPending,
    optimisticUser,
    runtimeAssistant,
    telemetryProjection,
    runtimeNotice,
    runtimeError,
    protocolWarning,
    hasPendingReconcile,
    restoredTurn,
    sendMessage,
    retryRecoveredTurn,
    stopGeneration,
    editingTarget,
    startEdit,
    cancelEdit,
    confirmEdit,
    regenerate,
    resumePolling,
    retrySync,
    applyPendingReconcile,
    acknowledgeUncertain,
    dismissTransient,
    dismissRuntimeNotice,
    branchFrom,
  };
}