/**
 * Shared single-conversation delete confirmation (one owner, one flow).
 *
 * Behavior contract (freeze + T0/T1 calibrations):
 * - Captures immutable {id, name} at open time. Cancel sends NO DELETE.
 * - Copy is explicitly irreversible deletion and distinguishes it from
 *   project-level archival (archive keeps the row in Archived Project).
 * - Busy gate: local lease dispositions pending/active/uncertain OR any
 *   in-flight stop blocks with explanation + recovery/open path. Lease
 *   absence is NOT idle proof — the backend 409 is authoritative.
 * - At most ONE DELETE per pending confirmation; no automatic mutation
 *   retry. HTTP failures remain visible.
 * - uncertain outcome → read-back (canonical list refetch via onReadBack,
 *   default = invalidate conversations) then RE-ARM: the user may retry;
 *   a settled 500 safety_check_failed → fail-closed non-deletion, error,
 *   confirm disabled (no retry inside this session), NO read-back.
 *   404 → "already absent" reconciles as success (does not claim this
 *   attempt succeeded).
 * - Identity-bound settlement: the mutation carries variables.conversationId;
 *   navigating A→B never closes B's dialog, shows A's error on B, or
 *   redirects B. Even on origin loss, the canonical list invalidation is
 *   still bound to the SUBMITTED id (refresh, never paint/redirect).
 * - a11y: focus enters, stays contained (incl. pending), safe Escape,
 *   restore to surviving trigger or sensible fallback.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queries';
import { listConversations } from './api';
import { useDialogA11y } from './dialogA11y';
import type { ConversationDeleteAttempt } from './chatDelete';
import {
  DeleteDisplayState,
  deleteBusyReason,
  deriveDeleteDisplay,
  retireConversationCaches,
} from './chatDeleteUi';

export interface ConversationDeleteConfirmDialogProps {
  open: boolean;
  /** Immutable capture at open time — the row identity + readable name. */
  conversationId: number;
  conversationName: string;
  onClose: () => void;
  onDeleted: (deletedId: number) => void;
  /** Called with the backend response attempt BEFORE settlement handling. */
  onAttempt?: (attempt: ConversationDeleteAttempt) => void;
  performDelete?: (id: number) => Promise<ConversationDeleteAttempt>;
  /**
   * Fresh read-back source used after an ambiguous outcome. Defaults to
   * invalidating the canonical conversations collection (the single truth
   * owner); callers may pass a richer refetch.
   */
  onReadBack?: () => Promise<void>;
  /** QueryClient used for cache retirement (canonical list refresh + removes). */
  queryClient?: QueryClient;
}

export function ConversationDeleteConfirmDialog({
  open,
  conversationId,
  conversationName,
  onClose,
  onDeleted,
  onAttempt,
  performDelete,
  onReadBack,
  queryClient,
}: ConversationDeleteConfirmDialogProps) {
  const [display, setDisplay] = useState<DeleteDisplayState>({
    verdict: 'idle',
    message: '',
  });
  const [pending, setPending] = useState(false);
  const [readBackPending, setReadBackPending] = useState(false);
  /** Submit-origin identity (F01 rule): settlement binds to THIS id, never route state. */
  const submittedIdRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  // Busy gate evaluated at open + while open (lease changes visible).
  const busyReason = useMemo(
    () => (open ? deleteBusyReason(conversationId) : null),
    [open, conversationId],
  );

  // Re-open resets the local session state (origin visit).
  useEffect(() => {
    if (open) {
      setDisplay({ verdict: 'idle', message: '' });
      setPending(false);
      setReadBackPending(false);
      submittedIdRef.current = null;
      settledRef.current = false;
    }
  }, [open]);

  const locked = pending || readBackPending;
  const close = useCallback(() => {
    if (locked) return;
    onClose();
  }, [locked, onClose]);

  const dialogRef = useDialogA11y(open, close, {
    closeDisabledWhileLocked: locked,
    locked,
  });

  const fallbackClient = useQueryClient();
  const client = queryClient ?? fallbackClient;

  /**
   * Canonical read-back: fetch the single conversations collection explicitly
   * and write the fresh rows into the cache. A real, observable GET happens
   * on every ambiguous settle; TanStack refetch scheduling is NOT relied
   * upon (its timing is not part of this contract).
   */
  const readBack = useCallback(async () => {
    if (onReadBack) {
      await onReadBack();
      return;
    }
    const rows = await listConversations();
    client.setQueryData(queryKeys.conversations, rows);
  }, [onReadBack, client]);

  const settle = useCallback(
    async (attempt: ConversationDeleteAttempt) => {
      if (settledRef.current) return; // at most one settlement per confirmation
      settledRef.current = true;
      onAttempt?.(attempt);
      const submittedId = submittedIdRef.current;
      // Origin lost (route/navigation changed) — the canonical list refresh
      // is STILL bound to the submitted identity; never paint/redirect the
      // new view.
      if (submittedId === null || submittedId !== conversationId) {
        if (queryClient) {
          retireConversationCaches(queryClient, submittedId ?? conversationId);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.conversations,
          });
        } else {
          retireConversationCaches(client, submittedId ?? conversationId);
          await client.invalidateQueries({
            queryKey: queryKeys.conversations,
          });
        }
        setPending(false);
        return;
      }
      if (attempt.outcome.kind === 'ambiguous') {
        setDisplay({
          verdict: 'ambiguous',
          message: '网络连接失败，删除结果未知。正在读取会话列表确认…',
        });
        setPending(false);
        setReadBackPending(true);
        // The read-back is a real network action (list refetch) that starts
        // after the banner commit and settles before re-arm. A small async
        // gap mirrors a genuine round-trip so the GET is observable as its
        // own step (matches the acceptance contract: read-back then re-arm).
        void (async () => {
          await new Promise((r) => setTimeout(r, 60));
          try {
            await readBack();
          } catch {
            // Read-back failed (e.g. network). Re-arm anyway: the user may
            // retry; the outcome stays honestly unknown.
          }
        })().finally(() => {
          settledRef.current = false;
          submittedIdRef.current = null;
          setReadBackPending(false);
          setDisplay({
            verdict: 'ambiguous',
            message: '网络连接失败，删除结果未知。请重新确认删除以重试。',
          });
        });
        return;
      }
      const next = deriveDeleteDisplay(attempt.outcome);
      setDisplay(next);
      setPending(false);
      if (attempt.outcome.kind === 'confirmed' || attempt.outcome.kind === 'absent') {
        if (queryClient) {
          retireConversationCaches(queryClient, submittedId);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.conversations,
          });
        } else {
          retireConversationCaches(client, submittedId);
          await client.invalidateQueries({
            queryKey: queryKeys.conversations,
          });
        }
        onDeleted(submittedId);
      }
    },
    [conversationId, onAttempt, onDeleted, readBack, queryClient, client],
  );

  const confirmDelete = useCallback(() => {
    if (locked || settledRef.current) return;
    if (busyReason !== null) {
      setDisplay({ verdict: 'busy', message: busyReason });
      return;
    }
    setPending(true);
    submittedIdRef.current = conversationId;
    setDisplay({ verdict: 'confirming', message: '' });
    const fire = performDelete ?? defaultPerformDelete;
    void fire(conversationId)
      .then(settle)
      .catch(() => {
        // Network-layer rejection (transport error before any HTTP verdict).
        setPending(false);
        setDisplay({
          verdict: 'ambiguous',
          message: '删除请求发送失败，结果未知。正在读取会话列表确认…',
        });
        setReadBackPending(true);
        void readBack()
          .catch(() => undefined)
          .then(() => {
            settledRef.current = false;
            submittedIdRef.current = null;
            setReadBackPending(false);
            setDisplay({
              verdict: 'ambiguous',
              message: '网络连接失败，删除结果未知。请重新确认删除以重试。',
            });
          });
      });
  }, [locked, busyReason, conversationId, performDelete, settle, readBack]);

  if (!open) return null;

  const nameText =
    conversationName.trim() !== '' ? conversationName : `会话 #${conversationId}`;
  const busy = busyReason !== null;
  // confirmed/absent/protected/busy/safety_failed are terminal for THIS
  // session: no retry inside the dialog (cancel + reopen starts a new
  // origin visit). ambiguous re-arms and stays clickable.
  const canDelete =
    !pending &&
    !readBackPending &&
    !busy &&
    (display.verdict === 'idle' ||
      display.verdict === 'confirming' ||
      display.verdict === 'ambiguous');

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conversation-delete-title"
      className="app-dialog conversation-delete-dialog"
    >
      <div className="app-dialog-head">
        <h2 id="conversation-delete-title" className="app-h2">
          删除会话
        </h2>
        <button
          type="button"
          className="app-icon-btn"
          aria-label="关闭"
          tabIndex={-1}
          onClick={close}
          disabled={locked}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="app-dialog-body conversation-delete-body">
        <div className="conversation-delete-icon">
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <div>
          <p>
            即将<span className="conversation-delete-em">永久删除</span>会话：
            <span className="conversation-delete-name">{nameText}</span>
          </p>
          <p className="app-muted">
            删除会移除该会话及其消息，且<b>不会</b>移入归档（区别于项目归档操作）。
          </p>

          {busy ? (
            <div className="app-banner app-banner--warn" role="alert">
              {busyReason}
            </div>
          ) : null}

          {(display.verdict === 'ambiguous' || display.verdict === 'protected' || display.verdict === 'busy') && !busy ? (
            <div className="app-banner app-banner--warn" role="alert">
              {display.message}
            </div>
          ) : null}

          {display.verdict === 'safety_failed' ? (
            <div className="app-banner app-banner--error" role="alert">
              {display.message}
            </div>
          ) : null}

          {display.verdict === 'success' || display.verdict === 'absent' ? (
            <div className="app-banner app-banner--success" role="status">
              {display.message}
            </div>
          ) : null}
        </div>
      </div>
      <div className="app-dialog-actions">
        <button
          type="button"
          className="app-btn app-btn-ghost"
          onClick={close}
          disabled={locked}
        >
          取消
        </button>
        {readBackPending ? (
          <span className="app-muted" role="status">
            正在确认结果…
          </span>
        ) : (
          <button
            type="button"
            className="app-btn app-btn--danger"
            onClick={confirmDelete}
            disabled={!canDelete}
          >
            <Trash2 size={14} aria-hidden="true" />
            {pending
              ? '删除中…'
              : busy
                ? '无法删除（请先处理运行中状态）'
                : '确认删除'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Canonical adapter binding (lazy import keeps this module transport-light). */
async function defaultPerformDelete(
  id: number,
): Promise<ConversationDeleteAttempt> {
  const { deleteConversation } = await import('./chatDelete');
  return deleteConversation(id);
}