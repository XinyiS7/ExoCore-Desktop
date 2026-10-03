import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogA11y } from '../chat/dialogA11y';
import type { TaskActions } from './queries';
import {
  buildTaskPayload,
  localDateString,
  type TaskFormValues,
  type TaskPayload,
} from './taskPayloads';
import { TASK_TYPE_LABELS, errorMessage, isUncertainWrite } from './taskUi';
import {
  TASK_END_TYPES,
  TASK_GOAL_PERIODS,
  TASK_INTERVAL_UNITS,
  TASK_TYPES,
  type TaskEndType,
  type TaskEntry,
  type TaskGoalPeriod,
  type TaskIntervalUnit,
  type TaskType,
} from './types';
import './tasks.css';

export interface TaskFormDialogProps {
  /** Canonical entry to edit; `null` creates a new task. */
  entry: TaskEntry | null;
  /** Page-lifetime action owner shared with the detail dialog. */
  actions: TaskActions;
  onClose: () => void;
  onSaved: (entry: TaskEntry) => void;
}

const END_TYPE_LABELS: Record<TaskEndType, string> = {
  never: '永不结束',
  count: '按次数结束',
  date: '按日期结束',
};

const INTERVAL_UNIT_LABELS: Record<TaskIntervalUnit, string> = {
  day: '天',
  week: '周',
  month: '月',
};

const GOAL_PERIOD_LABELS: Record<TaskGoalPeriod, string> = {
  week: '周',
  month: '月',
};

/**
 * Native ScheduleEntry create/edit form (G-FORM/G-DEFER).
 *
 * - only allowlisted editable fields are rendered/sent; `status`, `entry_type`
 *   on edit, occurrence counters, GCal fields, computed fields and timestamps
 *   are never writable here;
 * - dates stay date-only `YYYY-MM-DD` from the local clock (`localDateString`);
 * - inputs and the written error are retained on a failed write; an ambiguous
 *   create is never retried automatically and is labelled as possibly duplicated;
 * - synchronous ref + hook busy lock prevent same-entry/dialog double submits.
 */
export function TaskFormDialog({ entry, actions, onClose, onSaved }: TaskFormDialogProps) {
  const editing = entry !== null;
  const [entryType, setEntryType] = useState<TaskType>(entry?.entry_type ?? 'todo');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [startDate, setStartDate] = useState(entry?.start_date ?? localDateString());
  const [tags, setTags] = useState<string[]>(() => [...(entry?.tags ?? [])]);
  const [isPinned, setIsPinned] = useState(entry?.is_pinned ?? false);
  const [dueDate, setDueDate] = useState(entry?.due_date ?? '');
  const [intervalUnit, setIntervalUnit] = useState<TaskIntervalUnit>(entry?.interval_unit ?? 'day');
  const [intervalValue, setIntervalValue] = useState(entry?.interval_value != null ? String(entry.interval_value) : '1');
  const [endType, setEndType] = useState<TaskEndType>(entry?.end_type ?? 'never');
  const [endCount, setEndCount] = useState(entry?.end_count != null ? String(entry.end_count) : '1');
  const [endDate, setEndDate] = useState(entry?.end_date ?? '');
  const [goalCount, setGoalCount] = useState(entry?.goal_count != null ? String(entry.goal_count) : '1');
  const [goalPeriod, setGoalPeriod] = useState<TaskGoalPeriod>(entry?.goal_period ?? 'week');
  const [cycleStart, setCycleStart] = useState(entry?.cycle_start ?? '');
  const [cycleDue, setCycleDue] = useState(entry?.cycle_due ?? '');
  const [clientError, setClientError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const busyKey = entry?.id ?? 0;
  const busy = saving || actions.busyEntryIds.includes(busyKey);
  const close = () => { if (!busy) onClose(); };
  const dialogRef = useDialogA11y(true, close, { locked: busy, closeDisabledWhileLocked: true });

  const buildForm = (): TaskFormValues => ({
    entry_type: entryType,
    title,
    description,
    start_date: startDate,
    tags,
    is_pinned: isPinned,
    due_date: entryType === 'todo' ? (dueDate.trim() === '' ? null : dueDate) : undefined,
    interval_unit: entryType === 'periodic' ? intervalUnit : undefined,
    interval_value: entryType === 'periodic' ? intervalValue : undefined,
    end_type: entryType === 'periodic' ? endType : undefined,
    end_count: entryType === 'periodic' && endType === 'count' ? endCount : undefined,
    end_date: entryType === 'periodic' && endType === 'date' ? endDate : undefined,
    goal_count: entryType === 'goal' ? goalCount : undefined,
    goal_period: entryType === 'goal' ? goalPeriod : undefined,
    cycle_start: entryType === 'goal' ? (cycleStart.trim() === '' ? null : cycleStart) : undefined,
    cycle_due: entryType === 'goal' ? (cycleDue.trim() === '' ? null : cycleDue) : undefined,
  });

  const submit = async () => {
    if (inFlight.current || busy) return;
    let payload: TaskPayload;
    try {
      payload = buildTaskPayload(buildForm(), editing);
    } catch (cause) {
      setClientError(errorMessage(cause, '表单校验失败。'));
      setWriteError(null);
      return;
    }
    setClientError(null);
    setWriteError(null);
    setUncertain(false);
    inFlight.current = true;
    setSaving(true);
    try {
      const saved = entry !== null ? await actions.patch(entry.id, payload) : await actions.create(payload);
      onSaved(saved);
    } catch (cause) {
      const uncertainWrite = isUncertainWrite(cause);
      const suffix = uncertainWrite
        ? editing
          ? ' 保存结果不确定，请先刷新核对；本次不会自动重试。'
          : ' 保存结果不确定，请先刷新核对（可能已创建）；本次不会自动重试。'
        : '';
      setWriteError(`${errorMessage(cause, '保存失败，请稍后重试。')}${suffix}`);
      setUncertain(uncertainWrite);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const heading = entry !== null ? `编辑任务 · ${entry.title}` : '新建待办';
  const submitLabel = saving
    ? '保存中…'
    : uncertain
      ? editing ? '再次保存' : '再次保存（可能重复）'
      : editing ? '保存修改' : '创建任务';

  return createPortal(
    <div
      className="app-overlay task-overlay"
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="app-dialog task-dialog task-form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h2 id="task-form-title" className="app-h2">{heading}</h2>
          <button type="button" className="app-icon-btn" aria-label="关闭任务表单" disabled={busy} onClick={close}>关闭</button>
        </div>
        <div className="app-dialog-body">
          {clientError && <div className="app-banner app-banner--error" role="alert">{clientError}</div>}
          {writeError && <div className="app-banner app-banner--error" role="alert">{writeError}</div>}

          <div className="app-field">
            <span className="app-field-label">任务类型 <span className="app-required">*</span></span>
            {editing
              ? <p className="task-readonly-value">{TASK_TYPE_LABELS[entryType]}（任务类型创建后不可更改，来源契约拒绝变更）</p>
              : <select className="app-input" aria-label="任务类型" value={entryType} disabled={busy} onChange={(event) => setEntryType(event.target.value as TaskType)}>
                {TASK_TYPES.map((type) => <option key={type} value={type}>{TASK_TYPE_LABELS[type]}</option>)}
              </select>}
          </div>

          <label className="app-field" htmlFor="task-form-title-input">
            <span className="app-field-label">标题 <span className="app-required">*</span></span>
            <input id="task-form-title-input" className="app-input" type="text" value={title} disabled={busy} maxLength={200}
              onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="app-field" htmlFor="task-form-description">
            <span className="app-field-label">描述</span>
            <textarea id="task-form-description" className="app-input" value={description} disabled={busy}
              onChange={(event) => setDescription(event.target.value)} />
          </label>

          <div className="task-field-grid">
            <label className="app-field" htmlFor="task-form-start">
              <span className="app-field-label">开始日期（本地） <span className="app-required">*</span></span>
              <input id="task-form-start" className="app-input" type="date" value={startDate} disabled={busy}
                onChange={(event) => setStartDate(event.target.value)} />
            </label>
            {entryType === 'todo' && <label className="app-field" htmlFor="task-form-due">
              <span className="app-field-label">截止日期（可空）</span>
              <input id="task-form-due" className="app-input" type="date" value={dueDate} disabled={busy}
                onChange={(event) => setDueDate(event.target.value)} />
            </label>}
          </div>
          <p className="task-readonly-note">日期按运行时本地日历保存为 YYYY-MM-DD，不经 UTC 换算。</p>

          {entryType === 'periodic' && <section className="task-section" aria-label="周期设置">
            <h3>周期设置</h3>
            <p className="task-readonly-note">周期从开始日期起算，按固定间隔重复；修改开始日期会移动整个周期基准。周期任务没有可编辑的单一 due_date，延期必须在此原生字段上处理。</p>
            <div className="task-field-grid">
              <label className="app-field" htmlFor="task-form-interval-unit">
                <span className="app-field-label">每</span>
                <select id="task-form-interval-unit" className="app-input" value={intervalUnit} disabled={busy}
                  onChange={(event) => setIntervalUnit(event.target.value as TaskIntervalUnit)}>
                  {TASK_INTERVAL_UNITS.map((unit) => <option key={unit} value={unit}>{INTERVAL_UNIT_LABELS[unit]}</option>)}
                </select>
              </label>
              <label className="app-field" htmlFor="task-form-interval-value">
                <span className="app-field-label">间隔数值（正整数）</span>
                <input id="task-form-interval-value" className="app-input" type="number" min={1} step={1} value={intervalValue} disabled={busy}
                  onChange={(event) => setIntervalValue(event.target.value)} />
              </label>
              <label className="app-field" htmlFor="task-form-end-type">
                <span className="app-field-label">结束方式</span>
                <select id="task-form-end-type" className="app-input" value={endType} disabled={busy}
                  onChange={(event) => setEndType(event.target.value as TaskEndType)}>
                  {TASK_END_TYPES.map((type) => <option key={type} value={type}>{END_TYPE_LABELS[type]}</option>)}
                </select>
              </label>
              {endType === 'count' && <label className="app-field" htmlFor="task-form-end-count">
                <span className="app-field-label">结束次数（正整数）</span>
                <input id="task-form-end-count" className="app-input" type="number" min={1} step={1} value={endCount} disabled={busy}
                  onChange={(event) => setEndCount(event.target.value)} />
              </label>}
              {endType === 'date' && <label className="app-field" htmlFor="task-form-end-date">
                <span className="app-field-label">结束日期</span>
                <input id="task-form-end-date" className="app-input" type="date" value={endDate} disabled={busy}
                  onChange={(event) => setEndDate(event.target.value)} />
              </label>}
            </div>
            {entry !== null && <p className="task-readonly-value">
              已登记完成次数（来源维护，不可回写）：{entry.occurrences_done}
              {entry.next_periodic_due ? ` · 下次周期日期 ${entry.next_periodic_due}` : ''}
            </p>}
          </section>}

          {entryType === 'goal' && <section className="task-section" aria-label="目标设置">
            <h3>目标设置</h3>
            <p className="task-readonly-note">目标在当前周期内计数；一次完成不会立即关闭周期。cycle_start / cycle_due 是周期边界字段，均可留空，留空不会被自动初始化（创建时也不会补默认值）；仅当 cycle_due 已设置时，午夜任务才可能滚动/升级周期，未设置 cycle_due 时不会自动滚动。</p>
            <div className="task-field-grid">
              <label className="app-field" htmlFor="task-form-goal-count">
                <span className="app-field-label">每周期目标次数（正整数）</span>
                <input id="task-form-goal-count" className="app-input" type="number" min={1} step={1} value={goalCount} disabled={busy}
                  onChange={(event) => setGoalCount(event.target.value)} />
              </label>
              <label className="app-field" htmlFor="task-form-goal-period">
                <span className="app-field-label">目标周期</span>
                <select id="task-form-goal-period" className="app-input" value={goalPeriod} disabled={busy}
                  onChange={(event) => setGoalPeriod(event.target.value as TaskGoalPeriod)}>
                  {TASK_GOAL_PERIODS.map((period) => <option key={period} value={period}>每{GOAL_PERIOD_LABELS[period]}</option>)}
                </select>
              </label>
              <label className="app-field" htmlFor="task-form-cycle-start">
                <span className="app-field-label">周期开始</span>
                <input id="task-form-cycle-start" className="app-input" type="date" value={cycleStart} disabled={busy}
                  onChange={(event) => setCycleStart(event.target.value)} />
              </label>
              <label className="app-field" htmlFor="task-form-cycle-due">
                <span className="app-field-label">周期截止</span>
                <input id="task-form-cycle-due" className="app-input" type="date" value={cycleDue} disabled={busy}
                  onChange={(event) => setCycleDue(event.target.value)} />
              </label>
            </div>
            {entry !== null && <p className="task-readonly-value">当前周期完成数（来源维护）：{entry.current_cycle_completions}</p>}
          </section>}

          <div className="task-field-grid">
            <div className="app-field task-tag-field">
              <span className="app-field-label">标签（每行一个标签，原样保留逗号与换行，不含 #）</span>
              <div className="task-tag-rows" role="group" aria-label="标签列表">
                {tags.map((tag, index) => (
                  <div key={index} className="task-tag-row">
                    <textarea
                      className="app-input task-tag-input"
                      aria-label={`标签 ${index + 1}`}
                      rows={1}
                      value={tag}
                      disabled={busy}
                      onChange={(event) => setTags((current) => current.map((item, itemIndex) => (
                        itemIndex === index ? event.target.value : item
                      )))}
                    />
                    <button
                      type="button"
                      className="app-btn app-btn-ghost"
                      aria-label={`删除标签 ${index + 1}`}
                      disabled={busy}
                      onClick={() => setTags((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >删除</button>
                  </div>
                ))}
                <div className="task-actions">
                  <button type="button" className="app-btn app-btn-ghost" disabled={busy}
                    onClick={() => setTags((current) => [...current, ''])}>＋ 添加标签</button>
                </div>
                {tags.length === 0 && <p className="task-readonly-note">暂无标签；每个输入行对应一个标签元素，不会被逗号或换行拆分。</p>}
              </div>
            </div>
            <label className="task-check-row" htmlFor="task-form-pinned">
              <input id="task-form-pinned" type="checkbox" checked={isPinned} disabled={busy}
                onChange={(event) => setIsPinned(event.target.checked)} />
              <span>置顶（is_pinned，沿来源协议）</span>
            </label>
          </div>

          {editing && <p className="task-readonly-note">
            状态、完成计数、GCal 关联与时间戳由来源动作与后端维护，此表单不回写；不存在的 priority 字段不会被提交。
          </p>}

          <div className="app-dialog-actions">
            <button type="button" className="app-btn app-btn-ghost" disabled={busy} onClick={close}>取消</button>
            <button type="button" className="app-btn app-btn--primary" disabled={busy} onClick={() => { void submit(); }}>{submitLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
