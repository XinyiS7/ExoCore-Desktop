import { formatDateTime } from '../chat/time';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { toHeartbeatApiError } from './api';
import type { HeartbeatQueueSummary } from './types';

interface HeartbeatMailboxProps {
  queue: HeartbeatQueueSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
}

export function HeartbeatMailbox({
  queue,
  isLoading,
  isError,
  error,
  onRetry,
}: HeartbeatMailboxProps) {
  if (isLoading) {
    return <LoadingState label="正在加载信箱与唤醒状态…" />;
  }

  if (isError) {
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
          <h3 id="heartbeat-notes-heading" className="heartbeat-subpanel-title">
            待送达小纸条 ({notes.length})
          </h3>
          {notes.length === 0 ? (
            <EmptyState title="暂无待送达小纸条" hint="下一次心跳前发送的小纸条会暂存在这里。" />
          ) : (
            <ul className="heartbeat-list" aria-label="待送达小纸条列表">
              {notes.map((note) => (
                <li key={note.id} className="heartbeat-list-item">
                  <div className="heartbeat-note-content">
                    <p className="heartbeat-note-text">{note.message}</p>
                    <span className="heartbeat-note-time">
                      {note.createdLocal || formatDateTime(note.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 用户预约唤醒 (User explicit wakeups) */}
        <div className="heartbeat-subpanel" aria-labelledby="heartbeat-wakeups-heading">
          <h3 id="heartbeat-wakeups-heading" className="heartbeat-subpanel-title">
            用户预约唤醒 ({wakeups.length})
          </h3>
          {wakeups.length === 0 ? (
            <EmptyState title="暂无预约唤醒" hint="由用户主动预约的唤醒任务会在这里列出。" />
          ) : (
            <>
              <ul className="heartbeat-list" aria-label="用户预约唤醒列表">
                {wakeups.map((w) => (
                  <li key={w.taskId} className="heartbeat-list-item">
                    <div className="heartbeat-wakeup-content">
                      <div className="heartbeat-wakeup-header">
                        <span className="heartbeat-wakeup-time">{w.effectiveLocal}</span>
                        <span className="app-chip app-chip--subtle">{w.status}</span>
                      </div>
                      <p className="heartbeat-wakeup-msg">
                        {w.message || '（无留言）'}
                      </p>
                    </div>
                  </li>
                ))}
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
    </section>
  );
}
