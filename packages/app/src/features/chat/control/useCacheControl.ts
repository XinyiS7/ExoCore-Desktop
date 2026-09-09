/**
 * Cache presentation + control hook (Plan Task 3.4, §6.4).
 *
 * Backend truth is the Query; this hook only derives presentation and owns
 * calibration timing:
 * - countdown derives from the CONFIRMED `expires_at` + current time and
 *   never extends TTL locally;
 * - active pages calibrate at most every 30s, pause all timers while the
 *   document is hidden, and clean up on unmount/route change;
 * - renew/release are disabled during runtime uncertainty (pane 5 supplies
 *   `runtimeUncertain`) and while either mutation is unresolved;
 * - an error while a confirmed row exists keeps the last display as stale
 *   (`staleError`), instead of blanking the panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  useCacheStatusQuery,
  useReleaseCacheMutation,
  useRenewCacheMutation,
} from './queries';
import type { CachePresentation, CacheStatusView } from './types';

export interface CacheControlOptions {
  /** Runtime uncertainty projection for rendering. */
  runtimeUncertain?: boolean;
  /** Synchronous runtime guard checked again at the cache command boundary. */
  isRuntimeUncertain?: () => boolean;
  /** Page-owned ref shared with every chat/audio command boundary. */
  operationPendingRef?: MutableRefObject<boolean>;
}

export interface CacheControlApi {
  presentation: CachePresentation;
  /** True when the last refetch failed but a confirmed row is still shown. */
  staleError: boolean;
  /** True while a background calibration/invalidation refetch is in flight. */
  refreshing: boolean;
  renewing: boolean;
  releasing: boolean;
  /** Renew/release excluded while a chat operation or a mutation is open. */
  mutationsLocked: boolean;
  /** Synchronous truth for sibling command boundaries, including same-tick calls. */
  isOperationPending: () => boolean;
  /** Mutation outcome surfaces (error or transient success) for the panel. */
  renewError: unknown;
  releaseError: unknown;
  renewSuccess: boolean;
  releaseSuccess: boolean;
  /** Explicit refresh — called by pane 5 after a chat terminal, renew, release. */
  refresh: () => Promise<unknown>;
  /** Trigger eligible renew (guarded by `mutationsLocked`). */
  renew: () => void;
  /** Release current cache/snapshot (guarded by `mutationsLocked`). */
  release: () => void;
}

type CacheMutationKind = 'renew' | 'release';
type CacheMutationPhase = 'pending' | 'success' | 'error';

interface CacheMutationOutcome {
  invocation: number;
  kind: CacheMutationKind;
  phase: CacheMutationPhase;
  error: unknown;
}

const CALIBRATION_MS = 30_000;
const TICK_MS = 1_000;

function toPresentation(cache: CacheStatusView | undefined): CachePresentation {
  if (!cache) return { state: 'loading' };
  if (cache.active) return { state: 'active', cache };
  if (cache.hasSnapshot) return { state: 'snapshot_only', cache };
  return { state: 'empty', cache };
}

export function useCacheControl(
  conversationId: number,
  options: CacheControlOptions = {},
): CacheControlApi {
  const {
    runtimeUncertain = false,
    isRuntimeUncertain,
    operationPendingRef: suppliedPendingRef,
  } = options;
  const localPendingRef = useRef(false);
  const operationPendingRef = suppliedPendingRef ?? localPendingRef;
  const cacheQuery = useCacheStatusQuery(conversationId);
  const renewMutation = useRenewCacheMutation(conversationId);
  const releaseMutation = useReleaseCacheMutation(conversationId);

  // Mutation ownership is exact by Conversation, not by the mounted observer.
  // The same hook instance survives /chat/A -> /chat/B route-param changes, while
  // old network operations may still settle. Keep every in-flight invocation
  // bound to its origin so A never blocks or announces work in B, and A's later
  // completion can never release B's unrelated operation.
  const activeConversationRef = useRef(conversationId);
  activeConversationRef.current = conversationId;
  const mutationInvocationRef = useRef(0);
  const pendingOwnersRef = useRef(new Map<number, number>()); // invocation -> Conversation
  const [outcomesByConversation, setOutcomesByConversation] = useState(
    () => new Map<number, CacheMutationOutcome>(),
  );

  const hasPendingFor = useCallback((ownerConversationId: number) => {
    for (const pendingOwner of pendingOwnersRef.current.values()) {
      if (pendingOwner === ownerConversationId) return true;
    }
    return false;
  }, []);

  // The page shares a plain boolean ref with runtime/control command boundaries.
  // Project only the CURRENT Conversation into it; the full owner set stays here.
  operationPendingRef.current = hasPendingFor(conversationId);

  // Countdown tick — derived from confirmed expiry, restarted whenever the
  // confirmed row changes so stale tick state cannot outlive a refetch.
  const [now, setNow] = useState<number>(() => Date.now());
  const cache = cacheQuery.data;
  const active = Boolean(cache?.active && cache?.expiresAt);
  const expiresAtMs = useMemo(() => {
    if (!cache?.expiresAt) return null;
    const t = Date.parse(cache.expiresAt);
    return Number.isFinite(t) ? t : null;
  }, [cache?.expiresAt]);

  useEffect(() => {
    if (!active || expiresAtMs === null) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [active, expiresAtMs]);

  // Calibration — at most every 30s, paused while the document is hidden,
  // and only when a confirmed row exists (nothing to calibrate otherwise).
  // Deps are VALUE-stable: useQuery's result object is recreated every render
  // (getOptimisticResult), so depending on it would reset this interval on
  // every countdown tick and 30s calibration would never fire.
  const lastCalibrationRef = useRef<number>(0);
  const isCacheError = cacheQuery.isError;
  const refetchCache = cacheQuery.refetch;
  useEffect(() => {
    if (isCacheError) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const elapsed = Date.now() - lastCalibrationRef.current;
      if (elapsed < CALIBRATION_MS) return;
      lastCalibrationRef.current = Date.now();
      void refetchCache();
    }, CALIBRATION_MS);
    return () => window.clearInterval(id);
  }, [isCacheError, refetchCache, conversationId]);
  // Route change / unmount drops the page-scoped calibration gate.
  useEffect(() => {
    lastCalibrationRef.current = 0;
  }, [conversationId]);

  const refresh = useCallback(() => {
    lastCalibrationRef.current = Date.now();
    return cacheQuery.refetch();
  }, [cacheQuery]);

  const isOperationPending = useCallback(
    () => hasPendingFor(activeConversationRef.current),
    [hasPendingFor],
  );
  const commandLocked = useCallback(
    () => runtimeUncertain || Boolean(isRuntimeUncertain?.()) || isOperationPending(),
    [isOperationPending, isRuntimeUncertain, runtimeUncertain],
  );
  const mutationsLocked = commandLocked();

  const settleOutcome = useCallback(
    (
      ownerConversationId: number,
      invocation: number,
      kind: CacheMutationKind,
      phase: 'success' | 'error',
      error: unknown,
    ) => {
      setOutcomesByConversation((current) => {
        const owned = current.get(ownerConversationId);
        if (!owned || owned.invocation !== invocation || owned.kind !== kind) return current;
        const next = new Map(current);
        next.set(ownerConversationId, { invocation, kind, phase, error });
        return next;
      });
    },
    [],
  );

  const runMutation = useCallback(
    (kind: CacheMutationKind, mutate: (ownerConversationId: number) => Promise<unknown>) => {
      if (commandLocked()) return;
      const ownerConversationId = activeConversationRef.current;
      const invocation = ++mutationInvocationRef.current;
      pendingOwnersRef.current.set(invocation, ownerConversationId);
      // Same-tick sibling commands see the new owner before React can rerender.
      operationPendingRef.current = hasPendingFor(activeConversationRef.current);
      setOutcomesByConversation((current) => {
        const next = new Map(current);
        // A new cache command replaces the previous transient success/error notice
        // for this Conversation, matching mutation-observer presentation semantics.
        next.set(ownerConversationId, {
          invocation,
          kind,
          phase: 'pending',
          error: null,
        });
        return next;
      });

      void mutate(ownerConversationId)
        .then(() => settleOutcome(ownerConversationId, invocation, kind, 'success', null))
        .catch((error) => settleOutcome(ownerConversationId, invocation, kind, 'error', error))
        .finally(() => {
          pendingOwnersRef.current.delete(invocation);
          // Recompute for whichever Conversation owns the page NOW. Finishing A
          // while B is pending can therefore never clear B's synchronous guard.
          operationPendingRef.current = hasPendingFor(activeConversationRef.current);
        });
    },
    [commandLocked, hasPendingFor, operationPendingRef, settleOutcome],
  );

  const renew = useCallback(() => {
    runMutation('renew', (ownerConversationId) => renewMutation.mutateAsync(ownerConversationId));
  }, [renewMutation, runMutation]);

  const release = useCallback(() => {
    runMutation('release', (ownerConversationId) => releaseMutation.mutateAsync(ownerConversationId));
  }, [releaseMutation, runMutation]);

  const countdownSeconds = useMemo(() => {
    if (!active || expiresAtMs === null) return null;
    return Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
  }, [active, expiresAtMs, now]);

  const presentation: CachePresentation = useMemo(() => {
    if (!cache) {
      if (cacheQuery.isError) {
        return { state: 'error', message: toApiMessage(cacheQuery.error) };
      }
      return { state: 'loading' };
    }
    const base = toPresentation(cache);
    if (base.state === 'active') {
      return {
        state: 'active',
        cache: {
          ...cache,
          // Presentation countdown (validated nonnegative) — never locally
          // extends the confirmed backend expiry.
          remainingSeconds: countdownSeconds ?? cache.remainingSeconds,
        },
      };
    }
    return base;
  }, [cache, cacheQuery.isError, cacheQuery.error, countdownSeconds]);

  const currentOutcome = outcomesByConversation.get(conversationId);
  const renewing = currentOutcome?.kind === 'renew' && currentOutcome.phase === 'pending';
  const releasing = currentOutcome?.kind === 'release' && currentOutcome.phase === 'pending';
  const renewError =
    currentOutcome?.kind === 'renew' && currentOutcome.phase === 'error'
      ? currentOutcome.error
      : null;
  const releaseError =
    currentOutcome?.kind === 'release' && currentOutcome.phase === 'error'
      ? currentOutcome.error
      : null;
  const renewSuccess = currentOutcome?.kind === 'renew' && currentOutcome.phase === 'success';
  const releaseSuccess = currentOutcome?.kind === 'release' && currentOutcome.phase === 'success';

  return {
    presentation,
    staleError: Boolean(cache && cacheQuery.isError),
    refreshing: cacheQuery.isFetching,
    renewing,
    releasing,
    mutationsLocked,
    isOperationPending,
    renewError,
    releaseError,
    renewSuccess,
    releaseSuccess,
    refresh,
    renew,
    release,
  };
}

function toApiMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '缓存状态读取失败';
}

/** Pure helper for tests — no hook. */
export function deriveCachePresentation(cache: CacheStatusView | undefined): CachePresentation {
  return toPresentation(cache);
}
