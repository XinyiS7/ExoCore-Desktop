import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogA11y } from '../chat/dialogA11y';
import { useTaskCompletionsQuery, useTaskQuery, type TaskActions } from './queries';
import { buildTodoPostponePayload, type TaskPostponeOption } from './taskPayloads';
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  errorMessage,
  isUncertainWrite,
} from './taskUi';
import type { TaskEntry } from './types';
import './tasks.css';

export interface TaskDetailDialogProps {
  entryId: number;
  /** Page-lifetime action owner shared with the form dialog. */
  actions: TaskActions;
  onClose: () => void;
  /** Opens the same native source form used by creation, pre-filled from this entry. */
  onRequestEdit: (entry: TaskEntry) => void;
}

const INTERVAL_UNIT_LABELS: Record<string, string> = { day: '天', week: '周', month: '月' };
const GOAL_PERIOD_LABELS: Record<string, string> = { week: '周', month: '月' };
const END_TYPE_LABELS: Record<string, string> = {
  never: '永不结束',
  count: '按次数结束',
  date: '按日期结束',
};

/**
 * Single ScheduleEntry detail used by the shelf, task River cards and the
 * Calendar companion (same source entry id, no second Task state store).
 *
 * - status/fields shown here always come from the canonical entry query; a
 *   completion is followed by a re-read instead of locally assuming a terminal
 *   archive (todo archives, periodic/goal may stay open);
 * - completion records are a real `GET /api/tasks/completions/?entry=<id>`;
 * - every source action keeps its own busy/uncertain semantics; errors and the
 *   completion note survive a failed write and the dialog cannot be closed
 *   while a mutation is in flight.
 */
export function TaskDetailDialog({ entryId, actions, onClose, onRequestEdit }: TaskDetailDialogProps) {
  const query = useTaskQuery(entryId);
  const completions = useTaskCompletionsQuery(entryId);
  const entry = query.data;
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const inFlight = useRef(false);
  const busy = pending !== null || actions.busyEntryIds.includes(entryId);
  const close = () => { if (!busy) onClose(); };
  const dialogRef = useDialogA11y(true, close, { locked: busy, closeDisabledWhileLocked: true });

  const run = async (
    label: string,
    action: () => Promise<unknown>,
    options: { success: string; errorPrefix?: string; clearNote?: boolean },
  ) => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    setPending(label);
    setMessage(null);
    try {
      await action();
      if (options.clearNote) setNote('');
      setMessage({ kind: 'info', text: options.success });
    } catch (cause) {
      const uncertain = isUncertainWrite(cause) ? ' 操作结果不确定，请先刷新核对；本次不会自动重试。' : '';
      setMessage({ kind: 'error', text: `${options.errorPrefix ?? ''}${errorMessage(cause)}${uncertain}` });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const postpone = (option: TaskPostponeOption) => {
    void run('postpone', () => actions.patch(entryId, buildTodoPostponePayload(option)), {
      success: option === 'tomorrow'
        ? '已延期到明天（本地 due_date 更新）。'
        : '已延期到下周（本地 due_date 更新）。',
    });
  };

  const canComplete = entry !== undefined && (entry.status === 'active' || entry.status === 'escalated');
  const linked = entry !== undefined && entry.gcal_event_id !== '';

  return createPortal(
    <div
      className="app-overlay task-overlay"
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="app-dialog task-dialog task-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h2 id="task-detail-title" className="app-h2">
            任务详情{entry ? ` · ${entry.title}` : ` #${entryId}`}
          </h2>
          <button type="button" className="app-icon-btn" aria-label="关闭任务详情" disabled={busy} onClick={close}>关闭</button>
        </div>

        <div className="app-dialog-body">
          {message && <div className={message.kind === 'error' ? 'app-banner app-banner--error' : 'app-banner'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</div>}

          {query.isPending && <p role="status">正在读取任务…</p>}
          {query.isError && <div role="alert">
            <p>任务读取失败：{query.error.message}</p>
            <button type="button" onClick={() => { void query.refetch(); }}>重试读取任务</button>
          </div>}

          {entry && <>
            <div className="task-meta">
              <span className={`task-badge task-badge--type-${entry.entry_type}`}>{TASK_TYPE_LABELS[entry.entry_type]}</span>
              <span className={`task-badge task-badge--status-${entry.status}`}>{TASK_STATUS_LABELS[entry.status]}</span>
              {entry.is_pinned && <span className="task-badge task-badge--pinned">已置顶</span>}
              {entry.tags.map((tag) => <span key={tag} className="task-badge">#{tag}</span>)}
            </div>
            <p className="task-description">{entry.description || '（无描述）'}</p>

            <dl className="task-facts">
              <div><dt>开始日期</dt><dd>{entry.start_date}</dd></div>
              {entry.entry_type === 'todo' && <div><dt>截止日期</dt><dd>{entry.due_date ?? '未设置'}</dd></div>}
              {entry.entry_type === 'periodic' && <>
                <div><dt>周期</dt><dd>每 {entry.interval_value} {INTERVAL_UNIT_LABELS[entry.interval_unit ?? ''] ?? entry.interval_unit}</dd></div>
                <div><dt>结束方式</dt><dd>{END_TYPE_LABELS[entry.end_type ?? ''] ?? entry.end_type}{entry.end_type === 'count' ? ` · ${entry.end_count} 次` : entry.end_type === 'date' ? ` · ${entry.end_date}` : ''}</dd></div>
                <div><dt>已登记完成</dt><dd>{entry.occurrences_done}</dd></div>
                <div><dt>下次周期日期</dt><dd>{entry.next_periodic_due ?? '—'}</dd></div>
              </>}
              {entry.entry_type === 'goal' && <>
                <div><dt>目标</dt><dd>每{GOAL_PERIOD_LABELS[entry.goal_period ?? ''] ?? entry.goal_period} {entry.goal_count} 次</dd></div>
                <div><dt>当前周期</dt><dd>{entry.cycle_start ?? '—'} → {entry.cycle_due ?? '—'}</dd></div>
                <div><dt>本周期完成数</dt><dd>{entry.current_cycle_completions}</dd></div>
              </>}
              <div><dt>更新时间</dt><dd>{new Date(entry.updated_at).toLocaleString()}</dd></div>
            </dl>

            <section className="task-section" aria-label="记录完成">
              <h3>记录完成</h3>
              {canComplete ? <>
                <label className="app-field" htmlFor="task-complete-note">
                  <span className="app-field-label">完成备注（可空）</span>
                  <textarea id="task-complete-note" className="app-input" value={note} disabled={busy}
                    onChange={(event) => setNote(event.target.value)} />
                </label>
                <button type="button" className="app-btn app-btn--primary" disabled={busy}
                  onClick={() => {
                    const submitted = note.trim();
                    void run('complete', () => actions.complete(entryId, submitted === '' ? undefined : submitted), {
                      success: '已提交完成记录。状态以来源重新读取为准；更新完成后周期/目标任务可能仍留在未完成列表。',
                      clearNote: true,
                    });
                  }}>
                  {pending === 'complete' ? '记录完成中…' : '记录完成'}
                </button>
              </> : <p className="task-readonly-note">
                {entry.status === 'suspended' ? '任务已暂停，恢复后可继续记录完成。' : entry.status === 'archived' ? '任务已归档，不再接受完成打卡。' : '当前状态不可打卡。'}
              </p>}
            </section>

            <section className="task-section" aria-label="来源动作">
              <h3>来源动作</h3>
              <div className="task-actions">
                {(entry.status === 'active' || entry.status === 'escalated') && <button type="button" disabled={busy}
                  onClick={() => { void run('suspend', () => actions.suspend(entryId), { success: '已暂停该任务（来源同时清除置顶）。' }); }}>暂停任务</button>}
                {entry.status === 'suspended' && <button type="button" disabled={busy}
                  onClick={() => { void run('resume', () => actions.resume(entryId), { success: '已恢复为进行中。' }); }}>恢复任务</button>}
                <button type="button" disabled={busy}
                  onClick={() => { void run('pin', () => actions.patch(entryId, { is_pinned: !entry.is_pinned }), { success: entry.is_pinned ? '已取消置顶。' : '已置顶。' }); }}>
                  {entry.is_pinned ? '取消置顶' : '置顶'}
                </button>
                <button type="button" disabled={busy} onClick={() => { if (!busy) onRequestEdit(entry); }}>编辑任务</button>
                {entry.status !== 'archived' && <button type="button" className="task-danger-button" disabled={busy} onClick={() => setConfirmArchive(true)}>归档（软归档）</button>}
              </div>
              {confirmArchive && <div className="task-confirm" role="alert">
                <p>归档会把任务设为 archived（软归档，数据保留，可在日历页全量任务列表查看），不是物理删除；若已关联 GCal，会同时清除本地关联并尽力删除远端事件。</p>
                <div className="task-actions">
                  <button type="button" className="task-danger-button" disabled={busy}
                    onClick={() => { setConfirmArchive(false); void run('archive', () => actions.archive(entryId), { success: '已软归档（archived）。数据保留；GCal 本地关联已清除（远端删除为尽力而为）。' }); }}>确认归档</button>
                  <button type="button" disabled={busy} onClick={() => setConfirmArchive(false)}>取消归档</button>
                </div>
              </div>}
              <p className="task-readonly-note">状态、置顶、归档等动作经真实来源接口；每次成功都会重新读取 Task 详情/列表、shelf 与 River。PATCH 200 只代表本地记录更新，若已关联 GCal，远端更新失败只会记录服务端警告。</p>
            </section>

            <section className="task-section" aria-label="Google Calendar 同步">
              <h3>Google Calendar（单向推送）</h3>
              {linked ? <>
                <p>本地记录已关联 GCal。
                  {entry.gcal_event_link !== '' && <> <a href={entry.gcal_event_link} target="_blank" rel="noreferrer">在 Google Calendar 打开</a></>}
                </p>
                <p className="task-readonly-note">解除关联会清除本地字段；远端事件删除为尽力而为，成功返回（204）不代表远端一定已删除，请到 Google Calendar 核实。</p>
                <button type="button" disabled={busy}
                  onClick={() => { void run('unlink', () => actions.unlinkGCal(entryId), { success: '本地 GCal 关联已清除。远端事件删除为尽力而为，请到 Google Calendar 核实。', errorPrefix: '解除 GCal 关联失败：' }); }}>
                  解除 GCal 关联
                </button>
              </> : <>
                <p>未关联 GCal。推送是 ExoCore → GCal 单向，不会自动双向同步。</p>
                <button type="button" disabled={busy}
                  onClick={() => { void run('push', () => actions.pushGCal(entryId), { success: '已推送至 Google Calendar。', errorPrefix: 'GCal 推送失败：' }); }}>
                  推送到 Google Calendar
                </button>
              </>}
            </section>

            <section className="task-section" aria-label="日期调整">
              <h3>日期调整</h3>
              {entry.entry_type === 'todo' ? <>
                <div className="task-actions">
                  <button type="button" disabled={busy} onClick={() => postpone('tomorrow')}>延期到明天</button>
                  <button type="button" disabled={busy} onClick={() => postpone('next_week')}>延期到下周</button>
                </div>
                <p className="task-readonly-note">按运行时本地日期计算并 PATCH due_date；没有 /defer/ 接口，也不使用固定示例日期。</p>
              </> : <>
                <p className="task-readonly-note">
                  {entry.entry_type === 'periodic'
                    ? '周期任务没有单一 due_date 可延期；修改开始日期会移动整个周期基准，请在原生表单中编辑。'
                    : '目标任务的周期边界为 cycle_start / cycle_due，完成只在周期内计数；一次完成不会立即关闭周期，午夜任务负责滚动。请在原生表单中编辑。'}
                </p>
                <button type="button" disabled={busy} onClick={() => { if (!busy) onRequestEdit(entry); }}>打开原生编辑表单</button>
              </>}
            </section>

            <section className="task-section" aria-label="完成记录">
              <h3>完成记录（GET entry={entryId}）</h3>
              {completions.isPending && <p role="status">正在读取完成记录…</p>}
              {completions.isError && <div role="alert">
                <p>完成记录读取失败：{completions.error.message}</p>
                <button type="button" onClick={() => { void completions.refetch(); }}>重试完成记录</button>
              </div>}
              {completions.isSuccess && (completions.data.length === 0
                ? <p>暂无完成记录。</p>
                : <ul className="task-completions">
                  {completions.data.map((record) => <li key={record.id} className="task-completion">
                    <p>{new Date(record.completed_at).toLocaleString()}{record.cycle_start ? ` · 周期 ${record.cycle_start}` : ''}</p>
                    {record.note !== '' && <p>{record.note}</p>}
                  </li>)}
                </ul>)}
            </section>
          </>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
