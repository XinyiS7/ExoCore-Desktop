import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '../chat/time';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { toHeartbeatApiError } from './api';
import {
  heartbeatQueryKeys,
  useCancelHeartbeatWakeupMutation,
  useWithdrawHeartbeatNoteMutation,
} from './queries';
import { LeaveHeartbeatNoteDialog } from './LeaveHeartbeatNoteDialog';
import { ScheduleHeartbeatDialog } from './ScheduleHeartbeatDialog';
import type { HeartbeatQueueSummary } from './types';

interface HeartbeatMailboxProps {
  presetId: number;
  queue: HeartbeatQueueSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
}

function wakeupBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'app-chip--accent';
    case 'retryable_failed':
      return 'app-chip--warn';
    case 'succeeded':
      return 'app-chip--success';
    case 'cancelled':
    case 'dead':
      return 'app-chip--subtle';
    default:
      return 'app-chip--subtle';
  }
}

export function HeartbeatMailbox({
  presetId,
  queue,
  isLoading,
  isError,
  error,
  onRetry,
}: HeartbeatMailboxProps) {
  const queryClient = useQueryClient();
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isWakeupDialogOpen, setIsWakeupDialogOpen] = useState(false);

  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [noteNotice, setNoteNotice] = useState<{ id: number; message: string } | null>(null);

  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [wakeupNotice, setWakeupNotice] = useState<{ id: number; message: string } | null>(null);

  const withdrawMutation = useWithdrawHeartbeatNoteMutation(presetId);
  const cancelMutation = useCancelHeartbeatWakeupMutation(presetId);

  if (isLoading) {
    return <LoadingState label="正在加载信箱与唤醒状态…" />;
  }

  if (isError && !queue) {
    return (
      <ErrorState
        title="信箱数据加载失败"
        detail={toHeartbeatApiError(error).message}
        onRetry={onRetry}
      />
    );
  }

  if (!queue) {
    return null;
  }

  const notes = queue.pendingNotes;
  const wakeups = queue.explicitWakeups;

  function handleWithdrawNote(noteId: number) {
    setWithdrawingId(noteId);
    setNoteNotice(null);
    withdrawMutation.mutate(noteId, {
      onSuccess: () => {
        setWithdrawingId(null);
        setNoteNotice(null);
      },
      onError: (err) => {
        setWithdrawingId(null);
        const apiErr = toHeartbeatApiError(err);
        const msg =
          apiErr.code === 'already_consumed'
            ? '纸条已被拆封，无法撤回'
            : apiErr.status === 404 || apiErr.code === 'note_not_found'
              ? '小纸条不存在或已被消费'
              : apiErr.message || '撤回失败';
        setNoteNotice({ id: noteId, message: msg });
        if (
          apiErr.code === 'already_consumed' ||
          apiErr.code === 'note_not_found' ||
          apiErr.status === 404 ||
          apiErr.status === 409
        ) {
          void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
        }
      },
    });
  }

  function handleCancelWakeup(taskId: number) {
    setCancellingId(taskId);
    setWakeupNotice(null);
    cancelMutation.mutate(taskId, {
      onSuccess: () => {
        setCancellingId(null);
        setWakeupNotice(null);
      },
      onError: (err) => {
        setCancellingId(null);
        const apiErr = toHeartbeatApiError(err);
        const msg =
          apiErr.code === 'cannot_cancel'
            ? '任务无法取消或已在执行中'
            : apiErr.message || '取消预约失败';
        setWakeupNotice({ id: taskId, message: msg });
        if (apiErr.code === 'cannot_cancel' || apiErr.status === 404 || apiErr.status === 409) {
          void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
        }
      },
    });
  }

  return (
    <section className="heartbeat-section" aria-labelledby="heartbeat-mailbox-title">
      <div className="heartbeat-section-heading">
        <h2 id="heartbeat-mailbox-title" className="app-h2">
          心跳信箱与用户指定唤醒
        </h2>
      </div>

      <div className="heartbeat-mailbox-grid">
        {/* 小纸条 (Pending notes) */}
        <div className="heartbeat-subpanel" aria-labelledby="heartbeat-notes-heading">
          <div className="heartbeat-subpanel-head">
            <h3 id="heartbeat-notes-heading" className="heartbeat-subpanel-title">
              待送达小纸条 ({notes.length})
            </h3>
            <button
              type="button"
              className="app-btn app-btn--subtle app-btn--sm heartbeat-subpanel-action"
              onClick={() => setIsNoteDialogOpen(true)}
            >
              <Plus size={14} aria-hidden="true" />
              给下一次心跳留言
            </button>
          </div>

          {notes.length === 0 ? (
            <EmptyState title="暂无待送达小纸条" hint="下一次心跳前发送的小纸条会暂存在这里。" />
          ) : (
            <ul className="heartbeat-list" aria-label="待送达小纸条列表">
              {notes.map((note) => (
                <li key={note.id} className="heartbeat-list-item heartbeat-list-item--actionable">
                  <div className="heartbeat-note-content">
                    <p className="heartbeat-note-text">{note.message}</p>
                    <span className="heartbeat-note-time">
                      {note.createdLocal || formatDateTime(note.createdAt)}
                    </span>
                    {noteNotice && noteNotice.id === note.id ? (
                      <span className="heartbeat-action-notice heartbeat-action-notice--danger" role="alert">
                        {noteNotice.message}
                      </span>
                    ) : null}
                  </div>
                  <div className="heartbeat-item-actions">
                    <button
                      type="button"
                      className="app-btn app-btn--subtle app-btn--sm heartbeat-item-btn"
                      onClick={() => handleWithdrawNote(note.id)}
                      disabled={withdrawingId !== null}
                      aria-label={`撤回小纸条 #${note.id}`}
                    >
                      {withdrawingId === note.id ? '撤回中…' : '撤回'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 用户预约唤醒 (User explicit wakeups) */}
        <div className="heartbeat-subpanel" aria-labelledby="heartbeat-wakeups-heading">
          <div className="heartbeat-subpanel-head">
            <h3 id="heartbeat-wakeups-heading" className="heartbeat-subpanel-title">
              用户预约唤醒 ({wakeups.length})
            </h3>
            <button
              type="button"
              className="app-btn app-btn--subtle app-btn--sm heartbeat-subpanel-action"
              onClick={() => setIsWakeupDialogOpen(true)}
            >
              <Plus size={14} aria-hidden="true" />
              预约唤醒
            </button>
          </div>

          {wakeups.length === 0 ? (
            <EmptyState title="暂无预约唤醒" hint="由用户主动预约的唤醒任务会在这里列出。" />
          ) : (
            <>
              <ul className="heartbeat-list" aria-label="用户预约唤醒列表">
                {wakeups.map((w) => {
                  const isCancelable = w.status === 'pending' || w.status === 'retryable_failed';
                  return (
                    <li key={w.taskId} className="heartbeat-list-item heartbeat-list-item--actionable">
                      <div className="heartbeat-wakeup-content">
                        <div className="heartbeat-wakeup-header">
                          <span className="heartbeat-wakeup-time">{w.effectiveLocal}</span>
                          <span className={`app-chip ${wakeupBadgeClass(w.status)}`}>{w.status}</span>
                        </div>
                        <p className="heartbeat-wakeup-msg">
                          {w.message || '（无留言）'}
                        </p>
                        {wakeupNotice && wakeupNotice.id === w.taskId ? (
                          <span className="heartbeat-action-notice heartbeat-action-notice--danger" role="alert">
                            {wakeupNotice.message}
                          </span>
                        ) : null}
                      </div>
                      {isCancelable ? (
                        <div className="heartbeat-item-actions">
                          <button
                            type="button"
                            className="app-btn app-btn--subtle app-btn--sm heartbeat-item-btn"
                            onClick={() => handleCancelWakeup(w.taskId)}
                            disabled={cancellingId !== null}
                            aria-label={`取消唤醒预约 #${w.taskId}`}
                          >
                            {cancellingId === w.taskId ? '取消中…' : '取消'}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {queue.unshownExplicitCount > 0 ? (
                <p className="app-muted heartbeat-unshown-hint">
                  另有 {queue.unshownExplicitCount} 条预约未展开
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {isNoteDialogOpen ? (
        <LeaveHeartbeatNoteDialog
          presetId={presetId}
          onClose={() => setIsNoteDialogOpen(false)}
        />
      ) : null}

      {isWakeupDialogOpen ? (
        <ScheduleHeartbeatDialog
          presetId={presetId}
          onClose={() => setIsWakeupDialogOpen(false)}
        />
      ) : null}
    </section>
  );
}
