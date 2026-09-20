import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from 'exo-shared/api';
import { queryKeys } from '../chat/queries';
import { toAppApiError } from '../chat/api';
import {
  AssistantMessageArrivedV1,
  validateArrivalEvent,
  validateArrivalPage,
} from './contract';
import {
  commitCursor,
  consumeArrivalsByMessageIds,
  ingestArrivals,
  initializeStorage,
  loadInstallationStorage,
  NOTIFICATIONS_STORAGE_KEY,
  StoredArrivalRecord,
} from './storage';
import {
  ignoreAssistantArrival,
} from './subscription';
import { NotificationContext, NotificationContextValue } from './notificationContext';

const POLL_INTERVAL_MS = 15000;

function formatSyncError(err: unknown): string {
  const appErr = toAppApiError(err);
  if (appErr.status === 400) {
    return '请求参数无效 (400)';
  }
  if (appErr.status && appErr.status >= 500) {
    return '服务端同步异常';
  }
  if (appErr.code === 'CONTRACT') {
    return '到达数据格式异常';
  }
  if (appErr.message?.includes('网络连接失败')) {
    return '网络连接不可用';
  }
  return appErr.message || '消息同步异常';
}

export function NotificationRuntime({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [unreadMap, setUnreadMap] = useState<Record<string, StoredArrivalRecord>>({});
  const [activeIndication, setActiveIndication] = useState<AssistantMessageArrivedV1 | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [repairNeeded, setRepairNeeded] = useState<boolean>(false);

  const isPollingRef = useRef(false);
  const lastActiveIndicationDedupeRef = useRef<string | null>(null);
  const corruptedOnMountRef = useRef(false);

  // Parse current route to identify exact conversation focus
  const match = location.pathname.match(/^\/chat\/([1-9]\d*)$/);
  const currentConversationId = match ? Number(match[1]) : null;

  // Sync state from storage
  const syncFromStorage = useCallback(() => {
    const outcome = loadInstallationStorage();
    if (outcome.status === 'ok') {
      setUnreadMap(outcome.storage.unreadMap);
      setSyncError(null);
    } else if (outcome.status === 'unavailable') {
      setSyncError('本地存储不可用');
    } else if (outcome.status === 'corrupted') {
      setSyncError('本地缓存已损坏并隔离');
      const init = initializeStorage();
      if (init.status === 'ok') {
        setUnreadMap(init.storage.unreadMap);
      }
    }
  }, []);

  // Initialize storage and listen for multi-tab updates
  useEffect(() => {
    const outcome = loadInstallationStorage();
    if (outcome.status === 'corrupted') {
      corruptedOnMountRef.current = true;
      setSyncError('本地缓存已损坏并隔离');
    } else if (outcome.status === 'unavailable') {
      setSyncError('本地存储不可用');
    } else {
      const init = initializeStorage();
      if (init.status === 'ok') {
        setUnreadMap(init.storage.unreadMap);
      } else {
        setSyncError('本地存储不可用');
      }
    }

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === NOTIFICATIONS_STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, [syncFromStorage]);

  // Listen for typed messages from Service Worker (Plan D9, D10)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const onSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'ASSISTANT_ARRIVAL_HANDOFF' && data.version === 1 && data.event) {
        let ev: AssistantMessageArrivedV1;
        try {
          ev = validateArrivalEvent(data.event);
        } catch {
          return;
        }

        const ingestRes = ingestArrivals([ev], 'push');
        if (ingestRes.status === 'ok') {
          setUnreadMap(ingestRes.storage.unreadMap);
        } else if (ingestRes.status === 'unavailable') {
          setSyncError('本地存储不可用');
        }

        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        void queryClient.invalidateQueries({ queryKey: queryKeys.messages(ev.conversation_id) });

        if (ev.conversation_id !== currentConversationId) {
          if (ev.dedupe_key !== lastActiveIndicationDedupeRef.current) {
            lastActiveIndicationDedupeRef.current = ev.dedupe_key;
            setActiveIndication(ev);
          }
        }
      } else if (data.type === 'NOTIFICATION_NAVIGATE' && data.version === 1 && data.target) {
        if (
          data.target.kind === 'conversation_message' &&
          typeof data.target.conversation_id === 'number' &&
          Number.isInteger(data.target.conversation_id) &&
          data.target.conversation_id > 0 &&
          typeof data.target.message_id === 'number' &&
          Number.isInteger(data.target.message_id) &&
          data.target.message_id > 0
        ) {
          setActiveIndication(null);
          navigate(`/chat/${data.target.conversation_id}`);
        }
      } else if (data.type === 'SUBSCRIPTION_REPAIR_NEEDED' && data.version === 1) {
        setRepairNeeded(true);
      }
    };

    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, [currentConversationId, navigate, queryClient]);

  // Main single-flight polling logic (D4, D1-R1-02)
  const poll = useCallback(async () => {
    if (isPollingRef.current) {
      return;
    }
    if (corruptedOnMountRef.current) {
      corruptedOnMountRef.current = false;
      return;
    }
    isPollingRef.current = true;

    try {
      const loadOutcome = loadInstallationStorage();
      if (loadOutcome.status === 'corrupted') {
        setSyncError('本地缓存已损坏并隔离');
        initializeStorage();
        return;
      }
      if (loadOutcome.status === 'unavailable') {
        setSyncError('本地存储不可用');
        return;
      }
      if (loadOutcome.status === 'absent') {
        const init = initializeStorage();
        if (init.status !== 'ok') {
          setSyncError('本地存储不可用');
          return;
        }
      }

      const activeStorageOutcome = loadInstallationStorage();
      if (activeStorageOutcome.status !== 'ok') {
        setSyncError('本地存储不可用');
        return;
      }

      let currentCursor = activeStorageOutcome.storage.lastContiguousCursor;
      let hasMore = true;
      let isBootstrap = currentCursor === null;
      let hasError = false;

      while (hasMore) {
        // Bootstrap: first run omits `after` query param entirely
        const params: Record<string, string | number> = { limit: 50 };
        if (!isBootstrap && currentCursor !== null) {
          params.after = currentCursor;
        }

        const raw = await apiFetch('/api/push/assistant-arrivals/', { params });
        const page = validateArrivalPage(raw);

        if (isBootstrap) {
          // Bootstrap commits high-water cursor without creating historical unread records
          const commitRes = commitCursor(page.next_cursor);
          if (commitRes.status !== 'ok') {
            setSyncError('游标保存失败');
            hasError = true;
            break;
          }
          currentCursor = page.next_cursor;
          hasMore = page.has_more;
          isBootstrap = false;
        } else {
          // Incremental page: ingest arrivals and atomically commit next_cursor
          if (page.events.length > 0) {
            const ingestRes = ingestArrivals(page.events, 'poll', page.next_cursor);
            if (ingestRes.status !== 'ok') {
              setSyncError('事件保存失败');
              hasError = true;
              break; // Stop pagination on write failure; preserve prior cursor
            }
            setUnreadMap(ingestRes.storage.unreadMap);

            // Invalidate conversations list for updated timestamps and sorting
            void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });

            // Invalidate non-current message queries for background conversations
            for (const ev of page.events) {
              if (ev.conversation_id !== currentConversationId) {
                void queryClient.invalidateQueries({ queryKey: queryKeys.messages(ev.conversation_id) });

                // Show non-modal shell indication if user is elsewhere and focused
                if (document.hasFocus() && ev.dedupe_key !== lastActiveIndicationDedupeRef.current) {
                  lastActiveIndicationDedupeRef.current = ev.dedupe_key;
                  setActiveIndication(ev);
                }
              }
            }
          } else {
            // Empty page: advance cursor if next_cursor progressed
            const commitRes = commitCursor(page.next_cursor);
            if (commitRes.status !== 'ok') {
              setSyncError('游标保存失败');
              hasError = true;
              break;
            }
          }

          currentCursor = page.next_cursor;
          hasMore = page.has_more;
        }
      }

      if (!hasError) {
        setSyncError(null);
      }
    } catch (err) {
      // Propagate error visibly without masking; cursor remains preserved
      setSyncError(formatSyncError(err));
    } finally {
      isPollingRef.current = false;
    }
  }, [currentConversationId, queryClient]);

  // Polling triggers: 15s timer when visible, immediate on mount / visible / online
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (timerId === null) {
        timerId = setInterval(() => {
          if (document.visibilityState === 'visible') {
            void poll();
          }
        }, POLL_INTERVAL_MS);
      }
    };

    const stopTimer = () => {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void poll();
        startTimer();
      } else {
        stopTimer();
      }
    };

    const onOnline = () => {
      if (document.visibilityState === 'visible') {
        void poll();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    if (document.visibilityState === 'visible') {
      void poll();
      startTimer();
    }

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [poll]);

  // Consume exact arrivals (called by ConversationPage after canonical message IDs are confirmed)
  const consumeExactArrivals = useCallback((conversationId: number, messageIds: Set<number>) => {
    if (messageIds.size === 0) return;

    const res = consumeArrivalsByMessageIds(conversationId, messageIds);
    if (res.status === 'ok') {
      setUnreadMap(res.storage.unreadMap);
    } else {
      setSyncError(`未读清理失败: ${res.error}`);
    }
  }, []);

  // Route-entry unread snapshot (P2D closure #1): entering an exact
  // conversation route with document focus consumes that conversation's
  // durable unread snapshot as of the first focused moment of this entry —
  // independent of whether the arrival message IDs are still inside the
  // canonical newest window. The entry reaches its terminal state as soon as
  // one attempt completes successfully (including an empty snapshot); only
  // failures keep the focus retry alive. Leaving and re-entering the route is
  // a fresh entry. Persisted state delta: zero — the only state is a closure
  // flag scoped to this effect run.
  useEffect(() => {
    if (currentConversationId === null) return;
    const entryConversationId = currentConversationId;
    let settled = false;

    function settle() {
      settled = true;
      window.removeEventListener('focus', attempt);
    }

    function attempt() {
      if (settled) return;
      if (!document.hasFocus()) return;

      const loadOutcome = loadInstallationStorage();
      if (loadOutcome.status === 'unavailable') {
        setSyncError('本地存储不可用');
        return;
      }
      if (loadOutcome.status === 'corrupted') {
        setSyncError('本地缓存已损坏并隔离');
        return;
      }
      if (loadOutcome.status === 'absent') {
        settle(); // Nothing durable exists yet; this entry is complete.
        return;
      }

      const snapshotMessageIds = new Set<number>();
      for (const record of Object.values(loadOutcome.storage.unreadMap)) {
        if (record.event.conversation_id === entryConversationId) {
          snapshotMessageIds.add(record.event.message_id);
        }
      }
      if (snapshotMessageIds.size === 0) {
        settle();
        return;
      }

      // The exact-consume mutation re-reads the latest storage internally and
      // removes only these snapshot message IDs; arrivals ingested meanwhile
      // keep their distinct IDs and stay unread.
      const consumeRes = consumeArrivalsByMessageIds(entryConversationId, snapshotMessageIds);
      if (consumeRes.status === 'ok') {
        settle();
        setUnreadMap(consumeRes.storage.unreadMap);
      } else {
        setSyncError(`未读清理失败: ${consumeRes.error}`);
      }
    }

    window.addEventListener('focus', attempt);
    attempt();
    return () => settle();
  }, [currentConversationId]);

  // Ignore shell indication (calls explicit ignore endpoint if allowed).
  // UI state is bound to one target event identity (D3-R2-02): a newer indication
  // never inherits a stale request's busy/error, and an older completion never
  // closes or annotates the current indication.
  type IgnoreUiState =
    | { eventId: number; phase: 'busy' }
    | { eventId: number; phase: 'error'; error: string };

  const [ignoreState, setIgnoreState] = useState<IgnoreUiState | null>(null);

  const handleIgnore = useCallback(async () => {
    if (!activeIndication) return;
    const target = activeIndication;
    if (!target.ignore?.allowed) {
      // Not eligible for ignore — just dismiss this specific indication silently
      setActiveIndication((current) =>
        current && current.event_id === target.event_id ? null : current,
      );
      setIgnoreState((prev) => (prev && prev.eventId === target.event_id ? null : prev));
      return;
    }

    const eventId = target.event_id;
    setIgnoreState({ eventId, phase: 'busy' });
    const res = await ignoreAssistantArrival(eventId);

    // Completion is identity-guarded: only the targeted event may be closed or
    // annotated. A newer indication is never touched by this older request.
    setActiveIndication((current) => {
      if (current && current.event_id === eventId && res.ok) {
        return null;
      }
      return current;
    });
    setIgnoreState((prev) => {
      if (prev && prev.eventId !== eventId) {
        // A newer request owns the slot; preserve its state untouched.
        return prev;
      }
      if (res.ok) {
        return null;
      }
      return { eventId, phase: 'error', error: res.error || '忽略失败' };
    });
  }, [activeIndication]);

  // Dismiss without ignore (just hide indication)
  const dismissIndication = useCallback(() => {
    setActiveIndication(null);
    setIgnoreState(null);
  }, []);

  // Ignore UI state projections, rendered only when bound to the ACTIVE indication
  const ignoreBusy =
    ignoreState?.phase === 'busy' &&
    ignoreState.eventId === activeIndication?.event_id;
  const ignoreError =
    ignoreState?.phase === 'error' &&
    ignoreState.eventId === activeIndication?.event_id
      ? ignoreState.error
      : null;

  // Computed projections
  const unreadCount = useMemo(() => Object.keys(unreadMap).length, [unreadMap]);

  const { unreadByConversation, pendingArrivalsByConversation } = useMemo(() => {
    const counts: Record<number, number> = {};
    const arrivals: Record<number, AssistantMessageArrivedV1[]> = {};

    for (const record of Object.values(unreadMap)) {
      const cid = record.event.conversation_id;
      counts[cid] = (counts[cid] || 0) + 1;
      if (!arrivals[cid]) {
        arrivals[cid] = [];
      }
      arrivals[cid].push(record.event);
    }

    return { unreadByConversation: counts, pendingArrivalsByConversation: arrivals };
  }, [unreadMap]);

  const contextValue = useMemo<NotificationContextValue>(() => ({
    unreadCount,
    unreadByConversation,
    pendingArrivalsByConversation,
    activeIndication,
    dismissIndication,
    consumeExactArrivals,
    syncError,
    retrySync: () => void poll(),
    repairNeeded,
    setRepairNeeded,
  }), [
    unreadCount,
    unreadByConversation,
    pendingArrivalsByConversation,
    activeIndication,
    dismissIndication,
    consumeExactArrivals,
    syncError,
    poll,
    repairNeeded,
  ]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Non-blocking Shell Sync Banner (D4, D1-R2-01) */}
      {syncError ? (
        <div className="shell-sync-banner" role="status" aria-live="polite">
          <div className="shell-sync-banner__message">
            <span>消息同步暂不可用: {syncError}</span>
          </div>
          <button
            type="button"
            className="shell-sync-banner__retry"
            aria-label="重试同步"
            onClick={() => void poll()}
          >
            重试
          </button>
        </div>
      ) : null}

      {/* Non-modal Shell Indication for other routes (D6) */}
      {activeIndication && activeIndication.conversation_id !== currentConversationId ? (
        <div className="shell-indication" role="alert" aria-live="polite">
          <div className="shell-indication-header">
            <span className="shell-indication-agent">收到来自 {activeIndication.agent.name} 的新回复</span>
            {activeIndication.title_hint ? (
              <span className="shell-indication-title">{activeIndication.title_hint}</span>
            ) : null}
          </div>
          <div className="shell-indication-body">
            {activeIndication.preview.text}
          </div>
          {ignoreError ? (
            <div className="shell-indication-error" role="status">
              <span>{ignoreError}</span>
            </div>
          ) : null}
          <div className="shell-indication-actions">
            {activeIndication.ignore?.allowed ? (
              <button
                type="button"
                className="shell-indication-btn"
                aria-label="忽略通知"
                disabled={ignoreBusy}
                onClick={() => void handleIgnore()}
              >
                {ignoreBusy ? '处理中...' : '忽略'}
              </button>
            ) : (
              <button
                type="button"
                className="shell-indication-btn"
                aria-label="关闭提示"
                onClick={dismissIndication}
              >
                关闭
              </button>
            )}
            <button
              type="button"
              className="shell-indication-btn shell-indication-btn--primary"
              aria-label="查看通知"
              onClick={() => {
                const targetConvId = activeIndication.conversation_id;
                setActiveIndication(null);
                setIgnoreState(null);
                navigate(`/chat/${targetConvId}`);
              }}
            >
              查看
            </button>
          </div>
        </div>
      ) : null}
    </NotificationContext.Provider>
  );
}
