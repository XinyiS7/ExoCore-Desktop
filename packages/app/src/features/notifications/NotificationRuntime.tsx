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
  isAckSent,
  recordAckOutcome,
  retryPendingAcks,
  sendRegisterAck,
} from './subscription';
import { isValidRegisterAck, isValidAckOutcome } from './workerContract';
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
          // Runtime ACK envelope validation: require paired valid register_ack and ack_outcome
          if (isValidRegisterAck(data.register_ack) && isValidAckOutcome(data.ack_outcome)) {
            recordAckOutcome(data.register_ack, 'navigate', data.ack_outcome);
          }
          setActiveIndication(null);
          navigate(`/chat/${data.target.conversation_id}`);
        }
      } else if (
        data.type === 'SW_ACK_RESULT' &&
        data.version === 1 &&
        (data.action === 'navigate' || data.action === 'dismiss') &&
        isValidRegisterAck(data.register_ack) &&
        isValidAckOutcome(data.outcome)
      ) {
        recordAckOutcome(data.register_ack, data.action, data.outcome);
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
      void retryPendingAcks();
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

    const matchingArrivals: AssistantMessageArrivedV1[] = [];
    for (const record of Object.values(unreadMap)) {
      if (record.event.conversation_id === conversationId && messageIds.has(record.event.message_id)) {
        matchingArrivals.push(record.event);
      }
    }

    const res = consumeArrivalsByMessageIds(conversationId, messageIds);
    if (res.status === 'ok') {
      setUnreadMap(res.storage.unreadMap);
      for (const ev of matchingArrivals) {
        if (ev.register_ack && !isAckSent(ev.register_ack, 'navigate')) {
          void sendRegisterAck(ev.register_ack, 'navigate');
        }
      }
    } else {
      setSyncError(`未读清理失败: ${res.error}`);
    }
  }, [unreadMap]);

  // Dismiss shell indication
  const dismissIndication = useCallback(() => {
    if (activeIndication?.register_ack) {
      void sendRegisterAck(activeIndication.register_ack, 'dismiss');
    }
    setActiveIndication(null);
  }, [activeIndication]);

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
          <div className="shell-indication-actions">
            <button
              type="button"
              className="shell-indication-btn"
              aria-label="忽略通知"
              onClick={dismissIndication}
            >
              忽略
            </button>
            <button
              type="button"
              className="shell-indication-btn shell-indication-btn--primary"
              aria-label="查看通知"
              onClick={() => {
                const targetConvId = activeIndication.conversation_id;
                if (activeIndication.register_ack) {
                  void sendRegisterAck(activeIndication.register_ack, 'navigate');
                }
                setActiveIndication(null);
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
