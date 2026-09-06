import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type BlockedReason,
  type CallbackIdentity,
  type ChatRuntimeError,
  type ChatTransport,
  type ConstrainedAfter,
  type DispatchIntent,
  type NormalizedSSEEvent,
  type OperationState,
  type OptimisticUserRow,
  type PollingStatusResponse,
  type RecoveryDescriptor,
  type ReconcileContext,
  type RuntimeAssistantRow,
  type RuntimeStatus,
  type StableOperationOwner,
  type SuspendedOperation,
  type TransportPayload,
  type TurnAcceptance,
  type V4RuntimeLease,
} from './types';
import { SSEFrameDecoder, normalizePollingEvent, normalizeSSEEvent, parseRawSSEFrame } from './sse';
import { applyNormalizedEvent } from './events';
import {
  clearConversationDraft,
  clearRuntimeLease,
  loadConversationDraft,
  loadTransportPreference,
  persistRuntimeLease,
  readRuntimeLease,
  saveConversationDraft,
  saveTransportPreference,
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

export interface UseChatRuntimeOptions {
  conversationId: number;
  isNearBottomRef?: RefObject<boolean>;
  /** Canonical Conversation thinking_level ('' or null => 'auto', §5.1). */
  thinkingLevel?: string | null;
  /** Live canonical persisted rows (page-level), used for request-side target validation. */
  persistedRowsRef?: RefObject<ReadonlyArray<{ id: number; role: string }>>;
  /**
   * Identity-checked branch navigation continuation (§6.2 outcome matrix):
   * invoked at most once, only after the exact source-marker clear returns
   * `cleared` AND caller identity is still current.
   */
  onNavigateToConversation?: (conversationId: number) => void;
}

// ── Presentation projections (NEVER safety truths, §3.1/§3.2) ─────────────

function deriveStatus(state: OperationState): RuntimeStatus {
  switch (state.phase) {
    case 'idle':
      return 'idle';
    case 'storage_blocked_read':
      return 'interrupted';
    case 'predispatch':
      return 'submitting';
    case 'live':
      return state.payload.transport === 'sse' ? 'streaming' : 'polling';
    case 'stopping':
      return 'stopping';
    case 'reconciling':
      return 'reconciling';
    case 'blocked':
      // R5-B1: an ACCEPTED run (durability/transient recovery pending) keeps
      // the Stop control surface: status stays streaming/polling so the
      // composer derives `runActive` and renders Stop. Decide-only projection.
      if (blockedStopEligible(state)) {
        return state.snapshot.transport === 'sse' ? 'streaming' : 'polling';
      }
      return state.reason === 'reconcile_failed' ? 'reconcile_error' : 'interrupted';
  }
}

/**
 * R6-02: exact stable operation owner — conversationId + operation +
 * transport + startedAt. Mutable snapshot fields (disposition/updatedAt/
 * token/cursor) never participate in ownership. Every own-owner decision
 * uses this single predicate; a mismatch is adopted/interpreted, never
 * force-written and never continues an old operation.
 */
function sameStableOwner(
  a: { conversationId: number; operation: string; transport: string; startedAt: number },
  b: { conversationId: number; operation: string; transport: string; startedAt: number },
): boolean {
  return (
    a.conversationId === b.conversationId &&
    a.operation === b.operation &&
    a.transport === b.transport &&
    a.startedAt === b.startedAt
  );
}

/**
 * R5-B1/B4: does this blocked state represent a server-ACCEPTED run whose
 * Stop control must remain available? True for durability retries of an
 * active lease (persist-retry) and for paused poll loops (resume-poll),
 * unless a stop POST is already pending. Single source for both the status
 * projection and stopGeneration eligibility.
 */
function blockedStopEligible(state: OperationState): boolean {
  if (state.phase !== 'blocked' || !state.recovery) return false;
  const rec = state.recovery;
  if (rec.kind === 'resume-poll') {
    // R5-B4: after an ACCEPTED stop the pause must NOT re-offer Stop (that
    // would duplicate the stop POST); a FAILED stop stays retryable through
    // the pause. A pending stop POST hides it as well.
    return !rec.stopPending && rec.preserveStop !== 'accepted';
  }
  if (rec.kind === 'persist-retry') {
    if (rec.next.disposition !== 'active' || rec.stopPending) return false;
    // R6-01: the captured continuation may carry an ALREADY-ACCEPTED stop
    // (any of begin-poll/continue-live/resume-poll); re-offering Stop would
    // duplicate the stop POST.
    if ('preserveStop' in rec.onPersisted && rec.onPersisted.preserveStop === 'accepted') {
      return false;
    }
    return true;
  }
  return false;
}

function blockedCode(reason: BlockedReason): string {
  switch (reason) {
    case 'uncertain_write':
      return 'UNCERTAIN_WRITE';
    case 'not_found':
      return 'NOT_FOUND';
    case 'storage_unavailable':
      return 'STORAGE_UNAVAILABLE';
    case 'clear_blocked':
      return 'STORAGE_CLEAR_FAILED';
    case 'poll_failed':
      return 'POLL_FAILED';
    case 'reconcile_failed':
      return 'RECONCILE_FAILED';
  }
}

function makeLease(
  owner: StableOperationOwner,
  disposition: V4RuntimeLease['disposition'],
  updatedAt?: number,
  extra?: Partial<Pick<V4RuntimeLease, 'asyncToken' | 'cursor'>>,
): V4RuntimeLease {
  return {
    version: 1,
    operation: owner.operation,
    conversationId: owner.conversationId,
    transport: owner.transport,
    startedAt: owner.startedAt,
    updatedAt: updatedAt ?? Date.now(),
    disposition,
    ...extra,
  };
}

export function useChatRuntime({
  conversationId,
  isNearBottomRef,
  thinkingLevel,
  persistedRowsRef,
  onNavigateToConversation,
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
  const [protocolWarning, setProtocolWarning] = useState<string | null>(null);
  const [transientError, setTransientError] = useState<ChatRuntimeError | null>(null);
  const [stopError, setStopError] = useState<ChatRuntimeError | null>(null);
  const [draftCleanupFailed, setDraftCleanupFailed] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{ id: number; content: string } | null>(null);
  const stashedDraftRef = useRef<string>('');

  const [transport, setTransportState] = useState<ChatTransport>(loadTransportPreference);

  // ── In-memory transport continuation (never durable safety) ──────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);
  const pollCursorRef = useRef(0);
  const pendingPollRef = useRef<{ res: PollingStatusResponse; identity: CallbackIdentity } | null>(null);
  const suspendedSseResponseRef = useRef<Response | null>(null);
  const onNavigateToConversationRef = useRef(onNavigateToConversation);
  onNavigateToConversationRef.current = onNavigateToConversation;

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
      if (next.phase !== 'idle' && next.phase !== 'storage_blocked_read') {
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
  const hasPendingReconcile =
    opState.phase === 'reconciling' && opState.reconcile.waitForLatest && opState.reconcile.stage === 'idle';

  const runtimeError = useMemo<ChatRuntimeError | null>(() => {
    if (transientError) return transientError;
    const st = opState;
    if (st.phase === 'stopping' && stopError) return stopError;
    if (st.phase === 'storage_blocked_read') {
      return { code: 'STORAGE_BLOCKED_READ', message: `${st.reason}。请重试。`, retryClass: 'recoverable' };
    }
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

  /** Identity-checked full route UI release. Only legal after marker clear.
   * Independent draft-cleanup failure (ancillary, §4.4) deliberately SURVIVES
   * the operation unlock — it is cleared only by its own successful retry or
   * by a fresh route entry. */
  const releaseUi = useCallback(
    (identity: CallbackIdentity): boolean => {
      if (!isCurrentIdentity(identity.epoch, identity.stableOwner.conversationId)) return false;
      setOptimisticUser(null);
      setRuntimeAssistant(null);
      setProtocolWarning(null);
      setTransientError(null);
      setStopError(null);
      pendingPollRef.current = null;
      suspendedSseResponseRef.current = null;
      opStateRef.current = { phase: 'idle' };
      setOpState({ phase: 'idle' });
      return true;
    },
    [isCurrentIdentity],
  );

  // ── Suspended-operation synthesis ────────────────────────────────────────
  const makeSuspended = useCallback(
    (identity: CallbackIdentity, pendingSnapshot: V4RuntimeLease, postSent: boolean, onPersisted?: ConstrainedAfter): SuspendedOperation => ({
      identity,
      intent: {
        operation: identity.stableOwner.operation,
        content: '',
      },
      pendingSnapshot,
      postSent,
      onPersisted,
    }),
    [],
  );

  // ── Interpreting a durable lease (route entry / conflict adoption / reread) ──
  const interpretLease = useCallback(
    (lease: V4RuntimeLease, convId: number) => {
      const stableOwner: StableOperationOwner = {
        conversationId: convId,
        operation: lease.operation,
        transport: lease.transport,
        startedAt: lease.startedAt,
      };
      const identity: CallbackIdentity = {
        epoch: epochRef.current,
        stableOwner,
        destructive: lease.operation === 'edit' || lease.operation === 'regenerate',
      };
      if (lease.disposition === 'active' && lease.transport === 'async' && lease.asyncToken) {
        // Fresh async re-entry: clean overlay, replay same token from cursor 0.
        pollCursorRef.current = 0;
        transition({
          phase: 'live',
          identity,
          payload: { transport: 'async', token: lease.asyncToken, cursor: 0 },
          snapshot: lease,
        });
        setRuntimeAssistant({
          kind: 'client_assistant',
          clientKey: `assistant:${identity.epoch}`,
          content: '',
          statusText: '正在恢复会话进度…',
          isStreaming: true,
        });
        startPollingLoopRef.current(identity);
        return;
      }
      // pending / uncertain / sse-active: non-executable duplicate-write
      // protection; explicit acknowledgement is the only unlock path.
      if (lease.operation === 'branch') {
        // §6.2: branch pending/uncertain re-entry refreshes Recent without POST.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      transition({
        phase: 'blocked',
        identity,
        reason: 'uncertain_write',
        snapshot: lease,
        message:
          '上一次操作结果不确定（可能在提交时发生了页面刷新或网络中断）。消息可能已发送成功；确认后将解除锁定并同步最新消息，不会自动重发。',
        recovery: { kind: 'ack' },
      });
    },
    [transition, queryClient],
  );

  /** Adopt-or-reread: conflict outcomes never guess ownership (§4/§5). */
  const adoptOrReread = useCallback(
    (identity?: CallbackIdentity) => {
      const convId = identity ? identity.stableOwner.conversationId : activeConversationIdRef.current;
      const outcome = readRuntimeLease(convId);
      if (outcome.state === 'valid') {
        interpretLease(outcome.lease, convId);
        return;
      }
      if (outcome.state === 'quarantined') {
        if (identity) releaseUi(identity);
        else {
          opStateRef.current = { phase: 'idle' };
          setOpState({ phase: 'idle' });
        }
        setTransientError({
          code: 'QUARANTINED',
          message: `检测到损坏或无法识别的运行状态记录（${outcome.reason}），无法恢复，已自动清除，不影响发送新消息。`,
          retryClass: 'safe',
        });
        return;
      }
      if (outcome.state === 'absent') {
        if (identity) releaseUi(identity);
        else {
          opStateRef.current = { phase: 'idle' };
          setOpState({ phase: 'idle' });
        }
        return;
      }
      transition({
        phase: 'storage_blocked_read',
        conversationId: convId,
        reason: outcome.reason,
        suspendedOperation: null,
      });
    },
    [interpretLease, releaseUi, transition],
  );

  // ── Constrained success continuations (§4.1) ─────────────────────────────
  const executeAfter = useCallback(
    (identity: CallbackIdentity, after: ConstrainedAfter, latestSnapshot: V4RuntimeLease) => {
      if (!isCurrentIdentity(identity.epoch, identity.stableOwner.conversationId)) return;
      const cur = opStateRef.current;
      // A captured continuation may be executed from either a `blocked`
      // recovery (user retry) or a `storage_blocked_read` suspension (exact
      // reread re-attach). Everything else must still be current-route.
      const inRecovery = cur.phase === 'blocked' || cur.phase === 'storage_blocked_read';
      switch (after.kind) {
        case 'unlock': {
          releaseUi(identity);
          break;
        }
        case 'continue-live': {
          if (!inRecovery) return;
          const res = suspendedSseResponseRef.current;
          suspendedSseResponseRef.current = null;
          // R6-01: an accepted stop travels through this continuation too —
          // the resumed transport only observes terminal output.
          if (after.preserveStop) {
            transition({
              phase: 'stopping',
              identity,
              payload: { transport: 'sse', readerId: identity.epoch },
              snapshot: latestSnapshot,
              stopOutcome: after.preserveStop,
            });
          } else {
            transition({
              phase: 'live',
              identity,
              payload: { transport: 'sse', readerId: identity.epoch },
              snapshot: latestSnapshot,
            });
          }
          if (res) consumeSSERef.current(identity, res);
          break;
        }
        case 'begin-poll': {
          if (!inRecovery) return;
          pollCursorRef.current = 0;
          const payload = {
            transport: 'async' as const,
            token: latestSnapshot.asyncToken as string,
            cursor: 0,
          };
          // R6-01: accepted stopping stays authoritative through the initial
          // activation recovery; polling resumes only to drain output.
          if (after.preserveStop) {
            transition({
              phase: 'stopping',
              identity,
              payload,
              snapshot: latestSnapshot,
              stopOutcome: after.preserveStop,
            });
          } else {
            transition({
              phase: 'live',
              identity,
              payload,
              snapshot: latestSnapshot,
            });
          }
          startPollingLoopRef.current(identity);
          break;
        }
        case 'resume-poll': {
          if (!inRecovery) return;
          const payload =
            latestSnapshot.transport === 'async'
              ? {
                  transport: 'async' as const,
                  token: latestSnapshot.asyncToken as string,
                  cursor: pollCursorRef.current,
                }
              : { transport: 'sse' as const, readerId: identity.epoch };
          const nextPollState: OperationState =
            // R5-B4: if the recovery was captured while stopping, restore
            // STOPPING — never live — so an accepted stop is preserved and no
            // duplicate Stop POST can be issued.
            after.preserveStop
              ? {
                  phase: 'stopping',
                  identity,
                  payload,
                  snapshot: latestSnapshot,
                  stopOutcome: after.preserveStop,
                }
              : { phase: 'live', identity, payload, snapshot: latestSnapshot };
          transition(nextPollState);
          const pending = pendingPollRef.current;
          if (pending && pending.identity.epoch === identity.epoch) {
            pendingPollRef.current = null;
            void applyPollEventsRef.current(identity, latestSnapshot, pending.res);
          } else {
            startPollingLoopRef.current(identity);
          }
          break;
        }
        case 'ack-refresh': {
          if (cur.phase !== 'blocked') return;
          const ctx: ReconcileContext = { outcome: 'ack_refresh', waitForLatest: false, stage: 'idle' };
          transition({ phase: 'reconciling', identity, snapshot: latestSnapshot, reconcile: ctx });
          void runReconcileStagesRef.current(identity, latestSnapshot, ctx);
          break;
        }
        case 'branch-navigate': {
          releaseUi(identity);
          // R5-A2: an explicit modal close/replacement or route switch revokes
          // the per-invocation caller token; the source result is complete but
          // navigation must NOT happen for a revoked caller.
          if (after.callerToken?.revoked) return;
          onNavigateToConversationRef.current?.(after.conversationId);
          break;
        }
      }
    },
    [isCurrentIdentity, releaseUi, transition],
  );

  // ── Persist outcome dispatcher (exact outcomes → constrained continuation) ──
  const handlePersistOutcome = useCallback(
    (
      out: ReturnType<typeof persistRuntimeLease>,
      identity: CallbackIdentity,
      expectedPrior: V4RuntimeLease | null,
      next: V4RuntimeLease,
      onPersisted: ConstrainedAfter,
      failMessage: string,
    ) => {
      if (out.state === 'persisted') {
        executeAfter(identity, onPersisted, out.snapshot);
        return;
      }
      if (out.state === 'mutation_unavailable') {
        // Verified expected prior remains; exact mutation retry is legal.
        transition({
          phase: 'blocked',
          identity,
          reason: 'storage_unavailable',
          snapshot: expectedPrior ?? next,
          message: failMessage,
          recovery: { kind: 'persist-retry', expectedPrior, next, onPersisted },
        });
        return;
      }
      if (out.state === 'conflict') {
        // R5-B3: conflict never guesses ownership — adopt or reread. The
        // null-prior re-attach exists ONLY for the reread-ABSENT path (the
        // slot is genuinely empty there); an in-place conflict means a real
        // owner (possibly our own prior marker) and is adopted instead.
        adoptOrReread(identity);
        return;
      }
      transition({
        phase: 'storage_blocked_read',
        conversationId: identity.stableOwner.conversationId,
        reason: out.reason,
        suspendedOperation: makeSuspended(identity, next, true, onPersisted),
      });
    },
    [executeAfter, transition, adoptOrReread, makeSuspended],
  );

  // ── Reconciliation: FOUR separated effects (§7, §8.1) ────────────────────
  const runReconcileStages = useCallback(
    async (identity: CallbackIdentity, snapshot: V4RuntimeLease, ctx: ReconcileContext) => {
      if (!isCurrentIdentity(identity.epoch, identity.stableOwner.conversationId)) return;
      const convId = identity.stableOwner.conversationId;
      const cur = opStateRef.current;
      if (cur.phase !== 'reconciling') return;

      // 1) FETCH canonical newest window — network only; failure keeps the last
      //    displayed Query state (old data, marker and lock all remain).
      transition({ phase: 'reconciling', identity, snapshot, reconcile: { ...ctx, stage: 'fetching' } });
      let page: MessagePage;
      try {
        page = await fetchFreshWindow(convId);
      } catch {
        if (!isCurrentIdentity(identity.epoch, convId)) return;
        if (opStateRef.current.phase !== 'reconciling') return;
        transition({
          phase: 'blocked',
          identity,
          reason: 'reconcile_failed',
          snapshot,
          message: '消息历史对齐失败，请点击重试。',
          recovery: { kind: 'reconcile-retry', context: ctx },
        });
        return;
      }
      if (!isCurrentIdentity(identity.epoch, convId)) return;
      if (opStateRef.current.phase !== 'reconciling') return;

      // 2) APPLY — the single append/destructive Query owner (no marker/UI).
      transition({ phase: 'reconciling', identity, snapshot, reconcile: { ...ctx, stage: 'applying' } });
      try {
        applyFreshWindow(queryClient, convId, page, identity.destructive);
      } catch {
        if (!isCurrentIdentity(identity.epoch, convId)) return;
        transition({
          phase: 'blocked',
          identity,
          reason: 'reconcile_failed',
          snapshot,
          message: '消息历史对齐失败，请点击重试。',
          recovery: { kind: 'reconcile-retry', context: ctx },
        });
        return;
      }
      if (!isCurrentIdentity(identity.epoch, convId)) return;
      if (opStateRef.current.phase !== 'reconciling') return;

      // 3) MARKER — one conditional transition; never clear → write (§5).
      transition({ phase: 'reconciling', identity, snapshot, reconcile: { ...ctx, stage: 'clearing' } });

      if (ctx.outcome === 'not_found') {
        // not_found: FIRST reconcile canonical, THEN replace active → uncertain
        // with the exact conditional transition (no marker gap, §11.1 #4).
        const uncertain: V4RuntimeLease = { ...snapshot, disposition: 'uncertain', updatedAt: Date.now() };
        const up = persistRuntimeLease(snapshot, uncertain);
        if (up.state === 'persisted') {
          transition({
            phase: 'blocked',
            identity,
            reason: 'not_found',
            snapshot: up.snapshot,
            message: '异步会话凭据已失效或后台服务已重置。消息历史已同步；确认后将解除锁定，不会自动重发。',
            recovery: { kind: 'ack' },
          });
          return;
        }
        if (up.state === 'mutation_unavailable') {
          transition({
            phase: 'blocked',
            identity,
            reason: 'storage_unavailable',
            snapshot,
            message: '无法写入凭据失效标记（浏览器存储不可用）。请重试存储操作。',
            recovery: { kind: 'persist-retry', expectedPrior: snapshot, next: uncertain, onPersisted: { kind: 'ack-refresh' } },
          });
          return;
        }
        if (up.state === 'conflict') {
          adoptOrReread(identity);
          return;
        }
        transition({
          phase: 'storage_blocked_read',
          conversationId: convId,
          reason: up.reason,
          suspendedOperation: makeSuspended(identity, snapshot, true),
        });
        return;
      }

      const clearOut = clearRuntimeLease(snapshot);
      if (clearOut.state === 'cleared') {
        // 4) RELEASE — completeness: only after the exact marker cleared.
        releaseUi(identity);
        return;
      }
      if (clearOut.state === 'mutation_unavailable') {
        // Canonical data applied: drop the noncanonical overlay (R2-01) but the
        // lock is carried by the union — never by stale overlay rows.
        setOptimisticUser(null);
        setRuntimeAssistant(null);
        setProtocolWarning(null);
        transition({
          phase: 'blocked',
          identity,
          reason: 'clear_blocked',
          snapshot,
          message: '无法清除上次运行标记（浏览器存储不可用）。请重试清理后再继续，避免重复发送。',
          recovery: { kind: 'clear-retry', expectedPrior: snapshot, onCleared: { kind: 'unlock' } },
        });
        return;
      }
      if (clearOut.state === 'conflict') {
        adoptOrReread(identity);
        return;
      }
      transition({
        phase: 'storage_blocked_read',
        conversationId: convId,
        reason: clearOut.reason,
        suspendedOperation: makeSuspended(identity, snapshot, true),
      });
    },
    [isCurrentIdentity, transition, queryClient, adoptOrReread, releaseUi, makeSuspended],
  );

  /** Terminal → ordered reconciliation, deferred while the reader is scrolled up. */
  const handleTerminal = useCallback(
    (kind: 'done' | 'stopped' | 'error', errorPayload?: ChatRuntimeError) => {
      const cur = opStateRef.current;
      if (cur.phase !== 'live' && cur.phase !== 'stopping') return;
      if (!isCurrentIdentity(cur.identity.epoch, cur.identity.stableOwner.conversationId)) return;
      cancelLocalReaders();
      const { identity, snapshot } = cur;
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
      transition({ phase: 'reconciling', identity, snapshot, reconcile: ctx });
      if (!ctx.waitForLatest) void runReconcileStagesRef.current(identity, snapshot, ctx);
    },
    [cancelLocalReaders, isCurrentIdentity, transition, isNearBottomRefLocal],
  );

  /** Async `not_found`: reconcile canonical FIRST, then durable uncertain (§5.3). */
  const handleNotFound = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'live' && cur.phase !== 'stopping') return;
    if (!isCurrentIdentity(cur.identity.epoch, cur.identity.stableOwner.conversationId)) return;
    cancelLocalReaders();
    const { identity, snapshot } = cur;
    const ctx: ReconcileContext = {
      outcome: 'not_found',
      waitForLatest: !(isNearBottomRefLocal?.current ?? true),
      stage: 'idle',
    };
    transition({ phase: 'reconciling', identity, snapshot, reconcile: ctx });
    if (!ctx.waitForLatest) void runReconcileStagesRef.current(identity, snapshot, ctx);
  }, [cancelLocalReaders, isCurrentIdentity, transition, isNearBottomRefLocal]);

  // ── Polling loop (async transport) ───────────────────────────────────────
  // Refs first so polling callbacks can reference them regardless of definition order.
  const handleTerminalRef = useRef(handleTerminal);
  handleTerminalRef.current = handleTerminal;
  const handleNotFoundRef = useRef(handleNotFound);
  handleNotFoundRef.current = handleNotFound;

  const applyPollEvents = useCallback(
    async (identity: CallbackIdentity, snapshot: V4RuntimeLease, res: PollingStatusResponse) => {
      if (!isCurrentIdentity(identity.epoch, identity.stableOwner.conversationId)) return;
      const cur = opStateRef.current;
      if (cur.phase !== 'live' && cur.phase !== 'stopping') return;
      // Preserve the authoritative phase (a user stop must stay 'stopping').
      const nextState: OperationState =
        cur.phase === 'stopping'
          ? { phase: 'stopping', identity, payload: cur.payload, snapshot, stopOutcome: cur.stopOutcome }
          : { phase: 'live', identity, payload: cur.payload, snapshot };
      transition(nextState);

      for (const item of res.events) {
        const normalized = normalizePollingEvent(item);
        if (normalized.event === 'done' || normalized.event === 'stopped' || normalized.event === 'error') {
          continue;
        }
        setRuntimeAssistant((prev) => {
          const result = applyNormalizedEvent(prev, normalized, `assistant:${identity.epoch}`);
          if (result.warning) setProtocolWarning(result.warning);
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
    [isCurrentIdentity, transition, handleTerminalRef, handleNotFoundRef],
  );

  const applyPollResult = useCallback(
    async (identity: CallbackIdentity, prevSnapshot: V4RuntimeLease, res: PollingStatusResponse) => {
      // Cursor advance is persisted FIRST (conditional, exact prior); only a
      // `persisted` outcome may continue consuming (§4.3/§5 polling row).
      const next: V4RuntimeLease = { ...prevSnapshot, cursor: res.cursor, updatedAt: Date.now() };
      const up = persistRuntimeLease(prevSnapshot, next);
      if (up.state !== 'persisted') {
        pollCursorRef.current = res.cursor;
        pendingPollRef.current = { res, identity };
        // R5-B4: capture an in-flight stopping state so the durability retry
        // resumes STOPPING (with its stopOutcome) instead of dropping to live.
        const curSt = opStateRef.current;
        const preserveStop = curSt.phase === 'stopping' ? curSt.stopOutcome : undefined;
        handlePersistOutcomeRef.current(
          up,
          identity,
          prevSnapshot,
          next,
          preserveStop ? { kind: 'resume-poll', preserveStop } : { kind: 'resume-poll' },
          '无法保存轮询进度（浏览器存储不可用）。请重试存储操作。',
        );
        return;
      }
      pollCursorRef.current = res.cursor;
      await applyPollEventsRef.current(identity, next, res);
    },
    [],
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

        pollControllerRef.current = new AbortController();
        let res: PollingStatusResponse;
        try {
          res = await pollChatStatus(convId, token, cursor, pollControllerRef.current.signal);
        } catch (err) {
          if (!isCurrentIdentity(identityNow.epoch, convId)) return;
          if (opStateRef.current.phase !== 'live' && opStateRef.current.phase !== 'stopping') return;
          const classified = classifyRuntimeError(err, 'recoverable');
          if (classified.code === 'ABORTED') return;
          // Transient poll failure: lease/token/cursor all retained; exact
          // resume is exposed — never discard the only recovery token (§5.3).
          // R5-B4: capture stopping so resume restores it (no duplicate Stop).
          const curSt = opStateRef.current;
          const preserveStop = curSt.phase === 'stopping' ? curSt.stopOutcome : undefined;
          transition({
            phase: 'blocked',
            identity: identityNow,
            reason: 'poll_failed',
            snapshot: opStateRef.current.snapshot,
            message: classified.message,
            recovery: preserveStop ? { kind: 'resume-poll', preserveStop } : { kind: 'resume-poll' },
          });
          return;
        }
        if (!isCurrentIdentity(identityNow.epoch, convId)) return;
        if (opStateRef.current.phase !== 'live' && opStateRef.current.phase !== 'stopping') return;
        if (opStateRef.current.identity.epoch !== identityNow.epoch) return;
        await applyPollResultRef.current(identityNow, opStateRef.current.snapshot, res);
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
        setRuntimeAssistant((prev) => {
          const result = applyNormalizedEvent(prev, normalized, `assistant:${identity.epoch}`);
          if (result.warning) setProtocolWarning(result.warning);
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
    [isCurrentIdentity],
  );

  // ── Stop (§5.4) — stop-before-abort; accepted stop is not terminal ──────
  const stopGeneration = useCallback(async () => {
    const cur = opStateRef.current;
    const canStop =
      cur.phase === 'live' ||
      (cur.phase === 'stopping' && cur.stopOutcome === 'failed') ||
      (cur.phase === 'blocked' && blockedStopEligible(cur));
    if (!canStop) return;

    // R5-B2: an ACCEPTED run paused on durability (persist-retry) or a
    // transient poll pause (resume-poll) keeps Stop reachable. One exact
    // stop POST from here; the run resumes via the captured continuation
    // after the storage retry — never a re-POST of the send.
    if (cur.phase === 'blocked') {
      const rec = cur.recovery;
      if (!rec || (rec.kind !== 'persist-retry' && rec.kind !== 'resume-poll')) return;
      const { identity } = cur;
      const convId = identity.stableOwner.conversationId;
      // The durable lease may still be `pending`; the real token lives in the
      // captured recovery/snapshot, never in a tokenless write.
      const token =
        rec.kind === 'persist-retry'
          ? rec.next.asyncToken
          : cur.snapshot.transport === 'async'
            ? cur.snapshot.asyncToken
            : undefined;
      const payload: TransportPayload =
        cur.snapshot.transport === 'async'
          ? {
              transport: 'async',
              token: (rec.kind === 'persist-retry' ? rec.next.asyncToken : cur.snapshot.asyncToken) ?? '',
              cursor: pollCursorRef.current,
            }
          : { transport: 'sse', readerId: identity.epoch };

      transition({
        phase: 'stopping',
        identity,
        payload,
        snapshot: cur.snapshot,
        stopOutcome: 'accepted',
      });
      setStopError(null);
      setRuntimeAssistant((prev) => (prev ? { ...prev, statusText: '正在停止生成…' } : prev));
      try {
        const res = await postChatStop(convId, token);
        if (!isCurrentIdentity(identity.epoch, convId)) return;
        const cur2 = opStateRef.current;
        if (cur2.phase !== 'stopping' || cur2.identity.epoch !== identity.epoch) return;
        if (res.status === 'not_found') {
          // Terminal race: generation finished before stop. Reconcile canonical
          // and show the honest persisted outcome — never invent 'stopped'.
          cancelLocalReaders();
          setRuntimeAssistant((prev) =>
            prev ? { ...prev, isStreaming: false, statusText: '生成已结束（停止请求竞态）' } : prev,
          );
          const ctx: ReconcileContext = {
            outcome: 'interrupted',
            waitForLatest: !(isNearBottomRefLocal?.current ?? true),
            stage: 'idle',
          };
          transition({ phase: 'reconciling', identity, snapshot: cur2.snapshot, reconcile: ctx });
          if (!ctx.waitForLatest) void runReconcileStagesRef.current(identity, cur2.snapshot, ctx);
          return;
        }
        // Accepted stop: return to blocked with stopPending — banner keeps the
        // storage retry, Stop stays hidden (no duplicate POST), and the
        // durability retry resumes the captured continuation to drain to
        // terminal (stopped). A previously-failed stop is rewritten to
        // ACCEPTED in the continuation so the resumed phase never re-offers
        // a duplicate Stop.
        // R6-01: EVERY accepted-operation continuation (begin-poll,
        // continue-live, resume-poll) and the direct resume-poll recovery
        // carries the accepted stop into its resume — the transport may only
        // drain to terminal, never re-enable a duplicate Stop.
        const nextRec: RecoveryDescriptor =
          rec.kind === 'persist-retry' &&
          (rec.onPersisted.kind === 'continue-live' ||
            rec.onPersisted.kind === 'begin-poll' ||
            rec.onPersisted.kind === 'resume-poll')
            ? {
                ...rec,
                stopPending: true,
                onPersisted: { ...rec.onPersisted, preserveStop: 'accepted' },
              }
            : rec.kind === 'resume-poll'
              ? { ...rec, stopPending: true, preserveStop: 'accepted' }
              : { ...rec, stopPending: true };
        transition({
          phase: 'blocked',
          identity,
          reason: cur.reason,
          snapshot: cur.snapshot,
          message: '停止请求已发送。恢复浏览器存储后将继续同步剩余内容；请重试存储操作。',
          recovery: nextRec,
        });
      } catch (err) {
        if (!isCurrentIdentity(identity.epoch, convId)) return;
        const cur3 = opStateRef.current;
        if (cur3.phase !== 'stopping' || cur3.identity.epoch !== identity.epoch) return;
        const classified = classifyRuntimeError(err, 'recoverable');
        // Failed stop: return to blocked WITHOUT stopPending → Stop is visible
        // and retryable; the run is still active server-side.
        transition({
          phase: 'blocked',
          identity,
          reason: cur.reason,
          snapshot: cur.snapshot,
          message: `停止请求失败：${classified.message}（可再次点击停止；生成仍在进行）。请重试存储操作。`,
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
        // Terminal race: generation finished before stop. Reconcile canonical
        // and show the honest persisted outcome — never invent 'stopped'.
        cancelLocalReaders();
        setRuntimeAssistant((prev) =>
          prev ? { ...prev, isStreaming: false, statusText: '生成已结束（停止请求竞态）' } : prev,
        );
        const ctx: ReconcileContext = {
          outcome: 'interrupted',
          waitForLatest: !(isNearBottomRefLocal?.current ?? true),
          stage: 'idle',
        };
        transition({ phase: 'reconciling', identity, snapshot: cur2.snapshot, reconcile: ctx });
        if (!ctx.waitForLatest) void runReconcileStagesRef.current(identity, cur2.snapshot, ctx);
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
  }, [isCurrentIdentity, transition, cancelLocalReaders, isNearBottomRefLocal]);

  // ── Draft cleanup (independent ancillary recovery, §4.4) ─────────────────
  const attemptDraftClear = useCallback((convId: number) => {
    // R5-P2b: a LATER successful clear (e.g. the next accepted send) also
    // resets the warning — it must not stick after the storage recovers.
    if (clearConversationDraft(convId)) setDraftCleanupFailed(false);
    else setDraftCleanupFailed(true);
  }, []);

  // ── Dispatch failure handling (send/edit/regenerate) ─────────────────────
  const handleDispatchFailure = useCallback(
    (dispatchErr: unknown, identity: CallbackIdentity, pendingSnapshot: V4RuntimeLease): TurnAcceptance => {
      const classified = classifyRuntimeError(dispatchErr, 'uncertain');
      if (classified.retryClass === 'safe') {
        // Proved-safe synchronous rejection: conditional clear, unlock only
        // after `cleared`; draft/action preserved (§4.2/§5).
        const clearOut = clearRuntimeLease(pendingSnapshot);
        if (clearOut.state === 'cleared') {
          releaseUi(identity);
          setTransientError(classified);
          return 'rejected';
        }
        if (clearOut.state === 'mutation_unavailable') {
          transition({
            phase: 'blocked',
            identity,
            reason: 'clear_blocked',
            snapshot: pendingSnapshot,
            message: '请求被拒绝，但运行标记清理失败；已锁定，请重试清理。',
            recovery: { kind: 'clear-retry', expectedPrior: pendingSnapshot, onCleared: { kind: 'unlock' } },
          });
          return 'rejected';
        }
        if (clearOut.state === 'conflict') {
          adoptOrReread(identity);
          return 'rejected';
        }
        transition({
          phase: 'storage_blocked_read',
          conversationId: identity.stableOwner.conversationId,
          reason: clearOut.reason,
          suspendedOperation: makeSuspended(identity, pendingSnapshot, true),
        });
        return 'rejected';
      }
      // Uncertain outcome (network/malformed/contract): conditional
      // pending → uncertain replacement; explicit ack is the only unlock.
      const uncertain: V4RuntimeLease = { ...pendingSnapshot, disposition: 'uncertain', updatedAt: Date.now() };
      const up = persistRuntimeLease(pendingSnapshot, uncertain);
      if (up.state === 'persisted') {
        transition({
          phase: 'blocked',
          identity,
          reason: 'uncertain_write',
          snapshot: uncertain,
          message: classified.message,
          recovery: { kind: 'ack' },
        });
        return 'rejected';
      }
      if (up.state === 'mutation_unavailable') {
        transition({
          phase: 'blocked',
          identity,
          reason: 'storage_unavailable',
          snapshot: pendingSnapshot,
          message: '无法写入不确定性标记（浏览器存储不可用）。请重试存储操作。',
          recovery: { kind: 'persist-retry', expectedPrior: pendingSnapshot, next: uncertain, onPersisted: { kind: 'ack-refresh' } },
        });
        return 'rejected';
      }
      if (up.state === 'conflict') {
        adoptOrReread(identity);
        return 'rejected';
      }
      transition({
        phase: 'storage_blocked_read',
        conversationId: identity.stableOwner.conversationId,
        reason: up.reason,
        suspendedOperation: makeSuspended(identity, pendingSnapshot, true),
      });
      return 'rejected';
    },
    [releaseUi, transition, adoptOrReread, makeSuspended],
  );

  // ── Upgrade-persist failure handling (POST accepted) ─────────────────────
  const handleUpgradePersistFailure = useCallback(
    (
      up: ReturnType<typeof persistRuntimeLease>,
      identity: CallbackIdentity,
      expectedPrior: V4RuntimeLease,
      next: V4RuntimeLease,
      onPersisted: ConstrainedAfter,
    ) => {
      if (up.state === 'persisted') {
        executeAfter(identity, onPersisted, up.snapshot);
        return;
      }
      handlePersistOutcome(up, identity, expectedPrior, next, onPersisted, '消息已发送但恢复凭据保存失败；请勿重复发送（本页仍受防重锁保护）。');
    },
    [executeAfter, handlePersistOutcome],
  );

  // ── Pre-dispatch pending failure (§4.2) ──────────────────────────────────
  const handlePendingFailure = useCallback(
    (
      pendingOutcome: ReturnType<typeof persistRuntimeLease>,
      identity: CallbackIdentity,
      intent: DispatchIntent,
      pendingSnapshot: V4RuntimeLease,
    ): TurnAcceptance => {
      if (pendingOutcome.state === 'mutation_unavailable') {
        // Verified absence + failed set: zero POST, draft/action preserved,
        // safe full-transaction retry via Send again (§4.2). R5-P2a: a
        // presentation-only code (not STORAGE_UNAVAILABLE) so the banner
        // renders the dismiss action — no dead generic storage retry.
        setOptimisticUser(null);
        setRuntimeAssistant(null);
        releaseUi(identity);
        setTransientError({
          code: 'TURN_STORAGE_BLOCKED',
          message: '无法保存运行状态（浏览器存储不可用），消息未发送。可点击重试后再次发送。',
          retryClass: 'safe',
        });
        return 'rejected';
      }
      if (pendingOutcome.state === 'precondition_unavailable') {
        setOptimisticUser(null);
        setRuntimeAssistant(null);
        transition({
          phase: 'storage_blocked_read',
          conversationId: identity.stableOwner.conversationId,
          reason: pendingOutcome.reason,
          suspendedOperation: { identity, intent, pendingSnapshot, postSent: false },
        });
        return 'rejected';
      }
      if (pendingOutcome.state === 'conflict') {
        // A lease already owns this Conversation: adopt, never dispatch.
        setOptimisticUser(null);
        setRuntimeAssistant(null);
        adoptOrReread(identity);
        return 'rejected';
      }
      return 'rejected';
    },
    [releaseUi, transition, adoptOrReread],
  );

  // ── Core dispatch (send / edit / regenerate) ─────────────────────────────
  const executeTurn = useCallback(
    async (
      content: string,
      operation: 'send' | 'edit' | 'regenerate',
      editMessageId?: number,
    ): Promise<TurnAcceptance> => {
      // Synchronous same-tick guard: the ONLY lock is the union itself.
      if (phaseNow() !== 'idle') return 'rejected';

      const trimmedContent = content.trim();
      const destructive = operation === 'edit' || operation === 'regenerate';

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
      }
      if (operation !== 'regenerate' && trimmedContent.length === 0) return 'rejected';

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
        thinkingLevel: thinkingLevel ?? null,
      };
      const pendingSnapshot = makeLease(stableOwner, 'pending', startedAt);

      // idle → predispatch is synchronous; double click/Enter cannot pass.
      transition({ phase: 'predispatch', identity, intent, pendingSnapshot });

      if (operation === 'send') {
        setOptimisticUser({
          kind: 'client_user',
          clientKey: `user:${epoch}`,
          content: trimmedContent,
          createdAt: new Date().toISOString(),
        });
      } else {
        setOptimisticUser(null);
      }
      setRuntimeAssistant({
        kind: 'client_assistant',
        clientKey: `assistant:${epoch}`,
        content: '',
        isStreaming: true,
      });
      setTransientError(null);
      setStopError(null);
      setProtocolWarning(null);

      // 1) Durable pending against verified ABSENCE before any POST.
      const pendingOutcome = persistRuntimeLease(null, pendingSnapshot);
      if (pendingOutcome.state !== 'persisted') {
        return handlePendingFailure(pendingOutcome, identity, intent, pendingSnapshot);
      }

      // 2) Exactly one POST per completed transaction.
      if (transport === 'sse') {
        try {
          abortControllerRef.current = new AbortController();
          const res = await fetchChatSSEStream({
            conversationId: convId,
            content: operation === 'regenerate' ? '' : trimmedContent,
            thinkingLevel: thinkingLevel ?? null,
            editMessageId: destructive ? editMessageId : undefined,
            signal: abortControllerRef.current.signal,
          });
          if (!isCurrentIdentity(epoch, convId)) return 'rejected';
          if (phaseNow() !== 'predispatch') return 'rejected';
          // Request ACCEPTED: draft cleanup is ancillary (§4.4); edit mode ends.
          attemptDraftClear(convId);
          if (operation === 'edit') setEditingTarget(null);
          const activeSnapshot = makeLease(stableOwner, 'active', Date.now());
          const up = persistRuntimeLease(pendingSnapshot, activeSnapshot);
          if (up.state === 'persisted') {
            transition({
              phase: 'live',
              identity,
              payload: { transport: 'sse', readerId: epoch },
              snapshot: activeSnapshot,
            });
            void consumeSSE(identity, res);
            return 'accepted';
          }
          // Upgrade failure: stream suspended until the exact persist succeeds.
          suspendedSseResponseRef.current = res;
          handleUpgradePersistFailure(up, identity, pendingSnapshot, activeSnapshot, { kind: 'continue-live' });
          return 'accepted';
        } catch (dispatchErr) {
          if (!isCurrentIdentity(epoch, convId)) return 'rejected';
          if (phaseNow() !== 'predispatch') return 'rejected';
          return handleDispatchFailure(dispatchErr, identity, pendingSnapshot);
        }
      }

      // Async transport
      try {
        abortControllerRef.current = new AbortController();
        const ack = await postChatAsync({
          conversationId: convId,
          content: operation === 'regenerate' ? '' : trimmedContent,
          thinkingLevel: thinkingLevel ?? null,
          editMessageId: destructive ? editMessageId : undefined,
          signal: abortControllerRef.current.signal,
        });
        if (!isCurrentIdentity(epoch, convId)) return 'rejected';
        if (phaseNow() !== 'predispatch') return 'rejected';
        attemptDraftClear(convId);
        if (operation === 'edit') setEditingTarget(null);
        // COMPLETE atomic active snapshot — token + nonnegative cursor 0 in ONE
        // conditional write; no tokenless active data, ever (§11.1 #1).
        const activeSnapshot = makeLease(stableOwner, 'active', Date.now(), {
          asyncToken: ack.message_id,
          cursor: 0,
        });
        const up = persistRuntimeLease(pendingSnapshot, activeSnapshot);
        if (up.state === 'persisted') {
          pollCursorRef.current = 0;
          transition({
            phase: 'live',
            identity,
            payload: { transport: 'async', token: ack.message_id, cursor: 0 },
            snapshot: activeSnapshot,
          });
          startPollingLoop(identity);
          return 'accepted';
        }
        handleUpgradePersistFailure(up, identity, pendingSnapshot, activeSnapshot, { kind: 'begin-poll' });
        return 'accepted';
      } catch (dispatchErr) {
        if (!isCurrentIdentity(epoch, convId)) return 'rejected';
        if (phaseNow() !== 'predispatch') return 'rejected';
        return handleDispatchFailure(dispatchErr, identity, pendingSnapshot);
      }
    },
    [
      isCurrentIdentity,
      transition,
      transport,
      thinkingLevel,
      persistedRows,
      cancelLocalReaders,
      handlePendingFailure,
      handleDispatchFailure,
      handleUpgradePersistFailure,
      consumeSSE,
      startPollingLoop,
      attemptDraftClear,
      phaseNow,
    ],
  );

  // ── Public commands ──────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (content: string): Promise<TurnAcceptance> => executeTurn(content, 'send'),
    [executeTurn],
  );

  const confirmEdit = useCallback(
    (newContent: string): Promise<TurnAcceptance> => {
      if (!editingTarget) return Promise.resolve('rejected');
      return executeTurn(newContent, 'edit', editingTarget.id);
    },
    [editingTarget, executeTurn],
  );

  const regenerate = useCallback(
    (messageId: number): Promise<TurnAcceptance> => executeTurn('', 'regenerate', messageId),
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
    const { identity, snapshot } = cur;
    if (snapshot.transport !== 'async' || !snapshot.asyncToken) return;
    // R5-B4: when the pause was captured mid-stop, resume STOPPING (with its
    // stopOutcome) — an accepted stop stays accepted (no duplicate POST) and
    // a failed one stays retryable.
    if (rec.preserveStop) {
      transition({
        phase: 'stopping',
        identity,
        payload: { transport: 'async', token: snapshot.asyncToken, cursor: pollCursorRef.current },
        snapshot,
        stopOutcome: rec.preserveStop,
      });
      startPollingLoop(identity);
      return;
    }
    transition({
      phase: 'live',
      identity,
      payload: { transport: 'async', token: snapshot.asyncToken, cursor: pollCursorRef.current },
      snapshot,
    });
    startPollingLoop(identity);
  }, [transition, startPollingLoop]);

  /** Reconciliation retry after a fetch/apply failure — retries the failed step. */
  const retrySync = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'blocked' || cur.reason !== 'reconcile_failed') return;
    const rec = cur.recovery;
    if (!rec || rec.kind !== 'reconcile-retry') return;
    const { identity, snapshot } = cur;
    transition({ phase: 'reconciling', identity, snapshot, reconcile: rec.context });
    void runReconcileStagesRef.current(identity, snapshot, rec.context);
  }, [transition]);

  /** Scrolled-up hold → exactly one fresh offset-0 canonical application. */
  const applyPendingReconcile = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'reconciling' || !cur.reconcile.waitForLatest || cur.reconcile.stage !== 'idle') return;
    const { identity, snapshot, reconcile } = cur;
    void runReconcileStagesRef.current(identity, snapshot, reconcile);
  }, []);

  /** Exact storage mutation retry for verified-prior failures (§4.2). */
  const retryStorage = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'blocked') return;
    const rec = cur.recovery;
    if (!rec) return;
    const { identity, snapshot } = cur;

    if (rec.kind === 'persist-retry') {
      const out = persistRuntimeLease(rec.expectedPrior, rec.next);
      if (out.state === 'persisted') {
        executeAfter(identity, rec.onPersisted, out.snapshot);
        return;
      }
      if (out.state === 'mutation_unavailable') {
        transition({
          phase: 'blocked',
          identity,
          reason: 'storage_unavailable',
          snapshot,
          message: '浏览器存储仍不可用，操作未完成。请重试。',
          recovery: rec,
        });
        return;
      }
      if (out.state === 'conflict') {
        // R5-B3: conflict → adopt/reread — never guess, never force-overwrite.
        adoptOrReread(identity);
        return;
      }
      transition({
        phase: 'storage_blocked_read',
        conversationId: identity.stableOwner.conversationId,
        reason: out.reason,
        suspendedOperation: makeSuspended(identity, rec.next, true, rec.onPersisted),
      });
      return;
    }

    if (rec.kind === 'clear-retry') {
      const out = clearRuntimeLease(rec.expectedPrior);
      if (out.state === 'cleared') {
        executeAfter(identity, rec.onCleared, snapshot);
        return;
      }
      if (out.state === 'mutation_unavailable') {
        transition({
          phase: 'blocked',
          identity,
          reason: 'clear_blocked',
          snapshot,
          message: '浏览器存储仍不可用，操作未完成。请重试。',
          recovery: rec,
        });
        return;
      }
      if (out.state === 'conflict') {
        adoptOrReread(identity);
        return;
      }
      transition({
        phase: 'storage_blocked_read',
        conversationId: identity.stableOwner.conversationId,
        reason: out.reason,
        suspendedOperation: makeSuspended(identity, rec.expectedPrior, true),
      });
    }
  }, [transition, executeAfter, adoptOrReread, makeSuspended]);

  /** storage_blocked_read → exact reread resolves absent/valid/quarantined/unavailable. */
  const retryReread = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'storage_blocked_read') return;
    const convId = cur.conversationId;
    const outcome = readRuntimeLease(convId);
    if (outcome.state === 'valid') {
      const s = cur.suspendedOperation;
      // R5-B3: an ACCEPTED-operation suspension carries its captured
      // continuation (begin-poll/continue-live/resume-poll). If the reread
      // finds OUR OWN pending marker (identity + startedAt match), the
      // durability upgrade is completed with the exact captured token and the
      // operation CONTINUES — an accepted run is never demoted to an
      // acknowledge-lock.
      if (
        s?.postSent &&
        s.onPersisted &&
        outcome.lease.disposition === 'pending' &&
        sameStableOwner(outcome.lease, s.identity.stableOwner)
      ) {
        const up = persistRuntimeLease(outcome.lease, s.pendingSnapshot);
        if (up.state === 'persisted') {
          executeAfter(s.identity, s.onPersisted, up.snapshot);
          return;
        }
        if (up.state === 'mutation_unavailable') {
          transition({
            phase: 'blocked',
            identity: s.identity,
            reason: 'storage_unavailable',
            snapshot: outcome.lease,
            message: '浏览器存储仍不可用，操作未完成。请重试。',
            recovery: { kind: 'persist-retry', expectedPrior: outcome.lease, next: s.pendingSnapshot, onPersisted: s.onPersisted },
          });
          return;
        }
        if (up.state === 'conflict') {
          adoptOrReread(s.identity);
          return;
        }
        transition({
          phase: 'storage_blocked_read',
          conversationId: convId,
          reason: up.reason,
          suspendedOperation: s,
        });
        return;
      }
      interpretLease(outcome.lease, convId);
      return;
    }
    if (outcome.state === 'absent') {
      if (cur.suspendedOperation && cur.suspendedOperation.postSent) {
        const s = cur.suspendedOperation;
        // R5-B3: an ACCEPTED-operation suspension carries its captured
        // continuation (begin-poll/continue-live/resume-poll). Reread-absent
        // re-attaches the exact token-bearing snapshot and CONTINUES — never
        // collapses to uncertain, never releases idle with the token lost.
        if (s.onPersisted) {
          const up2 = persistRuntimeLease(null, s.pendingSnapshot);
          if (up2.state === 'persisted') {
            executeAfter(s.identity, s.onPersisted, up2.snapshot);
            return;
          }
          if (up2.state === 'mutation_unavailable') {
            transition({
              phase: 'storage_blocked_read',
              conversationId: convId,
              reason: '仍无法写入运行状态（存储不可用）',
              suspendedOperation: s,
            });
            return;
          }
          if (up2.state === 'conflict') {
            adoptOrReread(s.identity);
            return;
          }
          transition({
            phase: 'storage_blocked_read',
            conversationId: convId,
            reason: up2.reason,
            suspendedOperation: s,
          });
          return;
        }
        // Re-establish duplicate protection for the possibly-POSTed run; never
        // idle-by-assumption (§3.1). The resumed marker requires acknowledgement.
        const up = persistRuntimeLease(null, s.pendingSnapshot);
        if (up.state === 'persisted') {
          transition({
            phase: 'blocked',
            identity: s.identity,
            reason: 'uncertain_write',
            snapshot: s.pendingSnapshot,
            message: '操作结果不确定：存储暂时不可用后已恢复。确认后将解除锁定并同步最新消息，不会自动重发。',
            recovery: { kind: 'ack' },
          });
          return;
        }
        if (up.state === 'mutation_unavailable') {
          transition({
            phase: 'storage_blocked_read',
            conversationId: convId,
            reason: '仍无法写入运行状态（存储不可用）',
            suspendedOperation: s,
          });
          return;
        }
        if (up.state === 'conflict') {
          adoptOrReread(s.identity);
          return;
        }
        transition({
          phase: 'storage_blocked_read',
          conversationId: convId,
          reason: up.reason,
          suspendedOperation: s,
        });
        return;
      }
      // Nothing was ever persisted and no POST left this tab: idle is real.
      opStateRef.current = { phase: 'idle' };
      setOpState({ phase: 'idle' });
      return;
    }
    if (outcome.state === 'quarantined') {
      opStateRef.current = { phase: 'idle' };
      setOpState({ phase: 'idle' });
      setTransientError({
        code: 'QUARANTINED',
        message: `检测到损坏或无法识别的运行状态记录（${outcome.reason}），无法恢复，已自动清除，不影响发送新消息。`,
        retryClass: 'safe',
      });
      return;
    }
    transition({
      phase: 'storage_blocked_read',
      conversationId: convId,
      reason: outcome.reason,
      suspendedOperation: cur.suspendedOperation,
    });
  }, [interpretLease, transition, adoptOrReread, executeAfter]);

  /**
   * Explicit acknowledgement of an uncertain/not_found outcome. Canonical
   * (or Recent for branch) refresh happens FIRST; unlock only after the exact
   * marker clear returns `cleared` (§6.6/R2-01).
   */
  const acknowledgeUncertain = useCallback(() => {
    const cur = opStateRef.current;
    if (cur.phase !== 'blocked') return;
    if (cur.reason !== 'uncertain_write' && cur.reason !== 'not_found') return;
    if (cur.recovery?.kind !== 'ack') return;
    const { identity, snapshot } = cur;
    if (identity.stableOwner.operation === 'branch') {
      // §6.2: Recent is the canonical discovery path for a possibly-created
      // branch Conversation; no branch POST is ever re-issued.
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      const clearOut = clearRuntimeLease(snapshot);
      if (clearOut.state === 'cleared') {
        releaseUi(identity);
        return;
      }
      if (clearOut.state === 'mutation_unavailable') {
        transition({
          phase: 'blocked',
          identity,
          reason: 'clear_blocked',
          snapshot,
          message: '无法清除运行标记（浏览器存储不可用）。请重试清理后再继续，避免重复发送。',
          recovery: { kind: 'clear-retry', expectedPrior: snapshot, onCleared: { kind: 'unlock' } },
        });
        return;
      }
      if (clearOut.state === 'conflict') {
        adoptOrReread(identity);
        return;
      }
      transition({
        phase: 'storage_blocked_read',
        conversationId: identity.stableOwner.conversationId,
        reason: clearOut.reason,
        suspendedOperation: makeSuspended(identity, snapshot, true),
      });
      return;
    }
    // send/edit/regenerate: canonical refresh → exact clear → identity-checked unlock.
    const ctx: ReconcileContext = { outcome: 'ack_refresh', waitForLatest: false, stage: 'idle' };
    transition({ phase: 'reconciling', identity, snapshot, reconcile: ctx });
    void runReconcileStagesRef.current(identity, snapshot, ctx);
  }, [transition, queryClient, releaseUi, adoptOrReread, makeSuspended]);

  const dismissTransient = useCallback(() => {
    setTransientError(null);
  }, []);

  /** Draft cleanup retry — touches ONLY the exact draft key, never the lease. */
  const retryDraftCleanup = useCallback(() => {
    if (!clearConversationDraft(activeConversationIdRef.current)) return;
    setDraftCleanupFailed(false);
  }, []);

  const setTransport = useCallback((t: ChatTransport) => {
    setTransportState(t);
    saveTransportPreference(t);
  }, []);

  // ── Branch: same operation identity + lock (§6.1/§6.2/§11.1 #3, #6) ──────
  const branchFrom = useCallback(
    async (messageId: number, callerToken?: { revoked: boolean }): Promise<{ conversationId: number }> => {
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
      const startedAt = Date.now();
      const stableOwner: StableOperationOwner = {
        conversationId: convId,
        operation: 'branch',
        transport: 'sse',
        startedAt,
      };
      const identity: CallbackIdentity = { epoch, stableOwner, destructive: false };
      const intent: DispatchIntent = { operation: 'branch', content: '', branchFromMessageId: messageId };
      const pendingSnapshot = makeLease(stableOwner, 'pending', startedAt);

      transition({ phase: 'predispatch', identity, intent, pendingSnapshot });
      setTransientError(null);

      const pendingOutcome = persistRuntimeLease(null, pendingSnapshot);
      if (pendingOutcome.state !== 'persisted') {
        if (pendingOutcome.state === 'mutation_unavailable') {
          releaseUi(identity);
          // R5-P2a: presentation-only code (not STORAGE_UNAVAILABLE) so the
          // banner renders the dismiss action — zero dead generic retry here.
          setTransientError({
            code: 'BRANCH_STORAGE_BLOCKED',
            message: '无法保存运行状态（浏览器存储不可用），分支未创建。可重试后再试。',
            retryClass: 'safe',
          });
          throw new Error('无法保存运行状态（浏览器存储不可用），分支未创建。');
        }
        if (pendingOutcome.state === 'precondition_unavailable') {
          transition({
            phase: 'storage_blocked_read',
            conversationId: convId,
            reason: pendingOutcome.reason,
            suspendedOperation: { identity, intent, pendingSnapshot, postSent: false },
          });
          throw new Error('无法读取运行状态（浏览器存储不可用）。');
        }
        releaseUi(identity);
        adoptOrReread(identity);
        throw new Error('检测到其他进行中的操作，分支未创建。');
      }

      try {
        const result = await postConversationBranch({
          conversationId: convId,
          branchFromMessageId: messageId,
        });
        // R5-A1: SOURCE-RESULT COMPLETION runs FIRST and independently of
        // caller validity — recent refresh + exact conditional clear of the
        // captured source marker; a route switch / modal close must never
        // leave the source pending nor skip the positive Recent refresh.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        const clearOut = clearRuntimeLease(pendingSnapshot);
        if (!isCurrentIdentity(epoch, convId)) {
          // STALE CALLER: the source result is already complete above
          // (cleared, or preserved for re-entry on conflict/unavailable).
          // Zero current-route mutation, zero navigation.
          return result;
        }
        if (phaseNow() !== 'predispatch') throw new Error('操作状态已变化，请重试。');
        if (clearOut.state === 'cleared') {
          releaseUi(identity);
          return { conversationId: result.conversationId };
        }
        if (clearOut.state === 'mutation_unavailable') {
          transition({
            phase: 'blocked',
            identity,
            reason: 'clear_blocked',
            snapshot: pendingSnapshot,
            message: '分支已创建，但运行标记清理失败；已锁定，请重试清理。',
            recovery: {
              kind: 'clear-retry',
              expectedPrior: pendingSnapshot,
              onCleared: {
                kind: 'branch-navigate',
                conversationId: result.conversationId,
                callerToken,
              },
            },
          });
          throw new AppApiError('分支已创建，但运行标记清理失败；已锁定，请重试清理。', {
            code: 'BRANCH_CLEAR_FAILED',
            status: null,
          });
        }
        if (clearOut.state === 'conflict') {
          adoptOrReread(identity);
          throw new AppApiError('分支已创建；运行状态已被接管，请在“最近会话”中确认。', {
            code: 'BRANCH_CLEAR_CONFLICT',
            status: null,
            ambiguousWrite: true,
          });
        }
        transition({
          phase: 'storage_blocked_read',
          conversationId: convId,
          reason: clearOut.reason,
          suspendedOperation: makeSuspended(identity, pendingSnapshot, true),
        });
        throw new AppApiError('分支已创建，但无法确认运行状态；请在“最近会话”中确认。', {
          code: 'BRANCH_CLEAR_UNKNOWN',
          status: null,
          ambiguousWrite: true,
        });
      } catch (err) {
        // R5: control-flow errors thrown by OUR success path (branch created
        // but the clear could not complete) already transitioned the state;
        // they must never be re-handled as dispatch outcomes (which would
        // overwrite the marker into `uncertain`).
        if (
          err instanceof AppApiError &&
          (err.code === 'BRANCH_CLEAR_FAILED' ||
            err.code === 'BRANCH_CLEAR_CONFLICT' ||
            err.code === 'BRANCH_CLEAR_UNKNOWN')
        ) {
          throw err;
        }
        const classified = classifyRuntimeError(err, 'uncertain');
        const uiEligible = isCurrentIdentity(epoch, convId) && phaseNow() === 'predispatch';
        if (classified.retryClass === 'safe') {
          // Safe rejection: conditional clear of the exact source marker —
          // DATA completion runs even for a stale caller; UI does not.
          const clearOut = clearRuntimeLease(pendingSnapshot);
          if (!uiEligible) throw err;
          if (clearOut.state === 'cleared') {
            releaseUi(identity);
            throw err;
          }
          if (clearOut.state === 'mutation_unavailable') {
            transition({
              phase: 'blocked',
              identity,
              reason: 'clear_blocked',
              snapshot: pendingSnapshot,
              message: '分支请求被拒绝，但运行标记清理失败；已锁定，请重试清理。',
              recovery: { kind: 'clear-retry', expectedPrior: pendingSnapshot, onCleared: { kind: 'unlock' } },
            });
            throw new AppApiError(`分支请求被拒绝，但运行标记清理失败；已锁定，请重试清理。`, {
              code: 'BRANCH_CLEAR_FAILED',
              status: null,
            });
          }
          if (clearOut.state === 'conflict') {
            adoptOrReread(identity);
            throw err;
          }
          transition({
            phase: 'storage_blocked_read',
            conversationId: convId,
            reason: clearOut.reason,
            suspendedOperation: makeSuspended(identity, pendingSnapshot, true),
          });
          throw err;
        }
        // Ambiguous/malformed/network: conditional pending → uncertain and
        // Recent refresh (DATA completion, caller-independent); the durable
        // lock + ack UI only when this route still owns the caller.
        // R6-03: the positive Recent refresh is OUTCOME-INDEPENDENT — a new
        // Conversation may exist server-side regardless of how the marker
        // transition lands; marker non-success controls lock/recovery only.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        const uncertain: V4RuntimeLease = { ...pendingSnapshot, disposition: 'uncertain', updatedAt: Date.now() };
        const up = persistRuntimeLease(pendingSnapshot, uncertain);
        if (up.state === 'persisted') {
          if (uiEligible) {
            transition({
              phase: 'blocked',
              identity,
              reason: 'uncertain_write',
              snapshot: uncertain,
              message: '分支结果不确定：会话可能已创建。最近会话已刷新；本次操作已锁定，确认后可解除。',
              recovery: { kind: 'ack' },
            });
          }
        } else if (up.state === 'mutation_unavailable') {
          if (uiEligible) {
            transition({
              phase: 'blocked',
              identity,
              reason: 'storage_unavailable',
              snapshot: pendingSnapshot,
              message: '无法写入不确定性标记（浏览器存储不可用）。请重试存储操作。',
              recovery: { kind: 'persist-retry', expectedPrior: pendingSnapshot, next: uncertain, onPersisted: { kind: 'ack-refresh' } },
            });
          }
        } else if (up.state === 'conflict') {
          if (uiEligible) adoptOrReread(identity);
        } else if (uiEligible) {
          transition({
            phase: 'storage_blocked_read',
            conversationId: convId,
            reason: up.reason,
            suspendedOperation: makeSuspended(identity, pendingSnapshot, true),
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
    [
      isCurrentIdentity,
      transition,
      persistedRows,
      queryClient,
      releaseUi,
      adoptOrReread,
      makeSuspended,
      cancelLocalReaders,
      phaseNow,
    ],
  );

  // ── Route/reload effect: unconditional local reset + lease interpretation ──
  useEffect(() => {
    const convId = conversationId;

    // 1) Reset ONLY route-local presentation + authoritative baseline before
    //    loading this Conversation's own lease (direct chat→chat navigation).
    epochRef.current += 1;
    opStateRef.current = { phase: 'idle' };
    setOpState({ phase: 'idle' });
    setOptimisticUser(null);
    setRuntimeAssistant(null);
    setProtocolWarning(null);
    setTransientError(null);
    setStopError(null);
    setDraftCleanupFailed(false);
    setEditingTarget(null);
    stashedDraftRef.current = '';
    pollCursorRef.current = 0;
    pendingPollRef.current = null;
    suspendedSseResponseRef.current = null;

    // 2) Interpret this Conversation's durable lease.
    const outcome = readRuntimeLease(convId);
    if (outcome.state === 'valid') {
      interpretLease(outcome.lease, convId);
    } else if (outcome.state === 'quarantined') {
      setTransientError({
        code: 'QUARANTINED',
        message: `检测到损坏或无法识别的运行状态记录（${outcome.reason}），无法恢复，已自动清除，不影响发送新消息。`,
        retryClass: 'safe',
      });
    } else if (outcome.state === 'unavailable') {
      transition({
        phase: 'storage_blocked_read',
        conversationId: convId,
        reason: outcome.reason,
        suspendedOperation: null,
      });
    }

    // 3) Unconditional local teardown (never an automatic stop): cancel local
    //    readers/timers and invalidate the epoch. An in-flight SSE run whose
    //    outcome can no longer be observed becomes uncertain for re-entry via
    //    one conditional replacement (no zero-marker gap). The old Conversation's
    //    own lease is preserved for later recovery.
    return () => {
      const current = opStateRef.current;
      cancelLocalReadersRef.current();
      epochRef.current += 1;
      if (
        current.phase !== 'idle' &&
        current.phase !== 'storage_blocked_read' &&
        current.identity.stableOwner.conversationId === convId &&
        (current.phase === 'live' || current.phase === 'stopping') &&
        current.identity.stableOwner.transport === 'sse'
      ) {
        // R5-P2c: consume the cleanup outcome — `conflict` means a newer lease
        // already owns the slot (leaving it is correct), storage-unavailable/
        // precondition preserve the captured prior (safe: re-entry reads it as
        // pending/uncertain). No unhandled or uninspected path.
        const out = persistRuntimeLease(current.snapshot, {
          ...current.snapshot,
          disposition: 'uncertain',
          updatedAt: Date.now(),
        });
        if (out.state === 'conflict' || out.state === 'precondition_unavailable') {
          // preserve the owner the storage reports — never guess.
        }
      }
      opStateRef.current = { phase: 'idle' };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Latest-ref bridges so mount/unmount callbacks never close over stale values.
  const startPollingLoopRef = useRef(startPollingLoop);
  startPollingLoopRef.current = startPollingLoop;
  const applyPollEventsRef = useRef(applyPollEvents);
  applyPollEventsRef.current = applyPollEvents;
  const applyPollResultRef = useRef(applyPollResult);
  applyPollResultRef.current = applyPollResult;
  const handlePersistOutcomeRef = useRef(handlePersistOutcome);
  handlePersistOutcomeRef.current = handlePersistOutcome;
  const runReconcileStagesRef = useRef(runReconcileStages);
  runReconcileStagesRef.current = runReconcileStages;
  const consumeSSERef = useRef(consumeSSE);
  consumeSSERef.current = consumeSSE;
  const cancelLocalReadersRef = useRef(cancelLocalReaders);
  cancelLocalReadersRef.current = cancelLocalReaders;

  return {
    transport,
    setTransport,
    status,
    busy,
    optimisticUser,
    runtimeAssistant,
    runtimeError,
    protocolWarning,
    hasPendingReconcile,
    draftCleanupFailed,
    sendMessage,
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
    retryReread,
    retryStorage,
    dismissTransient,
    retryDraftCleanup,
    branchFrom,
  };
}