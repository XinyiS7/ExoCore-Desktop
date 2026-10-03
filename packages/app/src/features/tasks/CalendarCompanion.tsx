import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppApiError } from '../chat/api';
import { useDialogA11y } from '../chat/dialogA11y';
import { useCalendarSnapshotQuery, useTasksQuery } from './queries';
import { localDateString } from './taskPayloads';
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from './taskUi';
import type { CalendarEvent, TaskEntry } from './types';
import {
  eventDays,
  eventLocalRangeText,
  instantLocalClock,
  isTimedValue,
  parseTimedInstant,
  shiftMonth,
  sourceOffsetToken,
} from './calendarDates';
import './tasks.css';

export interface CalendarCompanionProps {
  /** Opens the same ScheduleEntry detail used by the shelf and River task cards. */
  onOpenTask: (entryId: number) => void;
  onClose: () => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const pad2 = (value: number) => String(value).padStart(2, '0');

function dueText(task: TaskEntry): string {
  if (task.entry_type === 'todo') return task.due_date ? `截止 ${task.due_date}` : '未设置截止日期';
  if (task.entry_type === 'periodic') return task.next_periodic_due ? `下次 ${task.next_periodic_due}` : '周期待定';
  return task.cycle_due ? `周期截止 ${task.cycle_due}` : '目标周期未设置';
}

function CalendarEventRow({ event, onOpenTask }: { event: CalendarEvent; onOpenTask: (entryId: number) => void }) {
  const timed = !event.all_day && isTimedValue(event.start);
  const startClock = timed ? instantLocalClock(event.start) : null;
  const timeLabel = event.all_day ? '全天' : startClock ?? event.start;
  const localRange = timed ? eventLocalRangeText(event) : null;
  const sourceOffset = timed ? sourceOffsetToken(event.start) : null;
  const exoEntryId = event.source === 'exocore' ? event.exocore_entry_id : null;
  return <li className="task-calendar-event">
    <div className="task-calendar-event-main">
      <span className="task-calendar-event-time">{timeLabel}</span>
      <div>
        <p className="task-calendar-event-title">{event.title}</p>
        {event.description !== '' && <p className="task-calendar-event-description">{event.description}</p>}
        <p className="task-readonly-note">
          {event.all_day
            ? `日期 ${event.start} → ${event.end}（全天，结束日排他）`
            : `本地时区 ${localRange ?? event.start}${sourceOffset !== null ? ` · 来源偏移 ${sourceOffset}` : ''} · 原始 ${event.start} → ${event.end}`}
        </p>
        <p className="task-readonly-note">
          {event.source === 'gcal'
            ? `GCal${event.calendar_name ? ` · ${event.calendar_name}` : ''}（只读，不可编辑 Task）`
            : `ExoCore · ${event.entry_type ? TASK_TYPE_LABELS[event.entry_type] : '任务'}${event.status ? ` · ${TASK_STATUS_LABELS[event.status]}` : ''}`}
        </p>
        {event.location !== null && event.location !== '' && <p className="task-readonly-note">地点：{event.location}</p>}
      </div>
    </div>
    <div className="task-actions">
      {exoEntryId !== null
        ? <button type="button" onClick={() => onOpenTask(exoEntryId)}>打开任务详情</button>
        : event.html_link !== null && event.html_link !== ''
          ? <a className="app-link-btn" href={event.html_link} target="_blank" rel="noreferrer">在 Google Calendar 打开</a>
          : <span className="task-readonly-note">无可打开链接</span>}
    </div>
  </li>;
}

/**
 * Read-only Calendar companion over the generated 90-day / 48h snapshots.
 *
 * - the month grid and day lists come from the snapshot files only (no
 *   date-range API, no fabricated recurrence); heartbeat/diary are never
 *   invented as calendar events;
 * - `fetched_at` / `window_start` / `window_end` are always shown; a missing
 *   snapshot (503) is an explicit unavailability, and days outside the window
 *   are "not covered", never "empty";
 * - all-day exclusive ends are folded back one day for display; timed values
 *   are converted to the browser-local timezone and explicitly labelled
 *   本地时区, with the original values and source offset kept visible;
 * - half-open ranges are clipped to the snapshot window with no arbitrary day
 *   cap (an event longer than any fixed bound still covers the whole window);
 * - ExoCore rows open the real entry id in the shared detail dialog; pure GCal
 *   rows stay read-only with their real html_link.
 */
export function CalendarCompanion({ onOpenTask, onClose }: CalendarCompanionProps) {
  const dialogRef = useDialogA11y(true, onClose);
  const calendar = useCalendarSnapshotQuery('calendar');
  const today = useCalendarSnapshotQuery('today');
  const tasks = useTasksQuery();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  const windowStart = calendar.data?.window_start ?? null;
  const windowEnd = calendar.data?.window_end ?? null;

  useEffect(() => {
    if (!calendar.data || month !== null) return;
    const localToday = localDateString();
    const inWindow = localToday >= calendar.data.window_start && localToday <= calendar.data.window_end;
    const initial = inWindow ? localToday : calendar.data.window_start;
    setSelectedDay(initial);
    setMonth(initial.slice(0, 7));
  }, [calendar.data, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const bounds = calendar.data
      ? { start: calendar.data.window_start, end: calendar.data.window_end }
      : null;
    for (const event of calendar.data?.events ?? []) {
      for (const day of eventDays(event, bounds)) {
        const bucket = map.get(day) ?? [];
        bucket.push(event);
        map.set(day, bucket);
      }
    }
    for (const bucket of map.values()) {
      // All-day first, then by real instant when both sides have one; the same
      // instant written with different source offsets therefore orders equal.
      bucket.sort((a, b) => {
        if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
        const left = parseTimedInstant(a.start)?.getTime();
        const right = parseTimedInstant(b.start)?.getTime();
        if (left !== undefined && right !== undefined && left !== right) return left - right;
        return a.start.localeCompare(b.start);
      });
    }
    return map;
  }, [calendar.data]);

  const minMonth = windowStart?.slice(0, 7) ?? null;
  const maxMonth = windowEnd?.slice(0, 7) ?? null;
  const activeMonth = month ?? minMonth ?? localDateString().slice(0, 7);
  const clampedMonth = minMonth !== null && activeMonth < minMonth
    ? minMonth
    : maxMonth !== null && activeMonth > maxMonth
      ? maxMonth
      : activeMonth;

  const grid = useMemo(() => {
    const [year, monthNumber] = clampedMonth.split('-').map(Number);
    const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const cells: Array<string | null> = [];
    for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(`${clampedMonth}-${pad2(day)}`);
    return cells;
  }, [clampedMonth]);

  const selectedInWindow = selectedDay !== null
    && windowStart !== null
    && windowEnd !== null
    && selectedDay >= windowStart
    && selectedDay <= windowEnd;
  const selectedEvents = selectedDay !== null ? eventsByDay.get(selectedDay) ?? [] : [];

  const localToday = localDateString();
  const todayInWindow = windowStart !== null && windowEnd !== null && localToday >= windowStart && localToday <= windowEnd;
  const todayCovered = today.data !== undefined && localToday >= today.data.window_start && localToday <= today.data.window_end;
  const todayEvents = useMemo(() => {
    if (!today.data) return [];
    const bounds = { start: today.data.window_start, end: today.data.window_end };
    return today.data.events
      .filter((event) => eventDays(event, bounds).includes(localToday))
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [today.data, localToday]);

  const calendarUnavailable = calendar.error instanceof AppApiError && calendar.error.status === 503;
  const todayUnavailable = today.error instanceof AppApiError && today.error.status === 503;

  return createPortal(
    <div className="app-overlay task-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="app-dialog task-dialog task-calendar-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-calendar-title"
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h2 id="task-calendar-title" className="app-h2">日历陪伴视图</h2>
          <button type="button" className="app-icon-btn" aria-label="关闭日历" onClick={onClose}>关闭</button>
        </div>
        <div className="app-dialog-body">
          <p className="task-readonly-note">
            快照由后台 07:00 / 14:00 / 21:00 任务生成；此处的重新读取只重读文件，不会重新生成快照，也不代表任务操作后日历已即时同步。
          </p>

          {calendar.isPending && <p role="status">正在读取日历快照…</p>}
          {calendar.isError && <div role="alert">
            <p>{calendarUnavailable
              ? '日历快照尚不可用（后台尚未生成或文件缺失）。这不代表该区间没有任何日程。'
              : `日历快照读取失败：${calendar.error.message}`}</p>
            <button type="button" onClick={() => { void calendar.refetch(); }}>重新读取日历快照</button>
          </div>}

          {calendar.isSuccess && <>
            <p className="task-readonly-note">
              生成时间：{new Date(calendar.data.fetched_at).toLocaleString()} · 覆盖 {calendar.data.window_start} → {calendar.data.window_end}（含当日）· 共 {calendar.data.count} 条 · 全天事件的结束日为排他，已按覆盖天数正确折算。
            </p>
            <p className="task-readonly-note">
              快照在生成时抓取 GCal；若当时抓取失败，快照会静默缺少相应 GCal 事件（缺失 ≠ 该时段没有日程）。
            </p>
            <div className="task-actions">
              <button type="button" onClick={() => { void calendar.refetch(); }}>重新读取快照</button>
            </div>

            <div className="task-calendar-toolbar">
              <button type="button" disabled={minMonth === null || clampedMonth <= minMonth} onClick={() => setMonth(shiftMonth(clampedMonth, -1))}>上个月</button>
              <strong aria-live="polite">{clampedMonth.replace('-', ' 年 ')} 月</strong>
              <div className="task-actions">
                <button type="button" disabled={!todayInWindow} onClick={() => {
                  setSelectedDay(localToday);
                  setMonth(localToday.slice(0, 7));
                }}>今天</button>
                <button type="button" disabled={maxMonth === null || clampedMonth >= maxMonth} onClick={() => setMonth(shiftMonth(clampedMonth, 1))}>下个月</button>
              </div>
            </div>

            <div className="task-calendar-grid" role="group" aria-label="月份栅格">
              {WEEKDAYS.map((label) => <span key={label} className="task-calendar-weekday" aria-hidden="true">{label}</span>)}
              {grid.map((day, index) => {
                if (day === null) return <span key={`pad-${index}`} className="task-calendar-cell is-pad" aria-hidden="true" />;
                const covered = windowStart !== null && windowEnd !== null && day >= windowStart && day <= windowEnd;
                const dayEvents = eventsByDay.get(day) ?? [];
                return <button
                  key={day}
                  type="button"
                  className={`task-calendar-cell${day === selectedDay ? ' is-selected' : ''}${covered ? '' : ' is-outside'}`}
                  disabled={!covered}
                  aria-pressed={day === selectedDay}
                  aria-label={`${day}${covered ? `，${dayEvents.length} 条事件` : '，不在快照覆盖范围'}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <span className="task-calendar-daynum">{Number(day.slice(8))}</span>
                  <span className="task-calendar-chips">
                    {dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`task-calendar-chip task-calendar-chip--${event.source}`}>{event.title}</span>)}
                    {dayEvents.length > 3 && <span className="task-calendar-more">+{dayEvents.length - 3}</span>}
                  </span>
                </button>;
              })}
            </div>

            <section className="task-section" aria-label="选中日事件">
              <h3>{selectedDay ?? '选择日期'}</h3>
              {selectedDay !== null && !selectedInWindow && <p className="task-readonly-note">该日期不在快照覆盖范围内（未覆盖 ≠ 无事件）。</p>}
              {selectedInWindow && selectedEvents.length === 0 && <p>该日期在快照覆盖范围内，暂无事件。</p>}
              {selectedEvents.length > 0 && <ul className="task-calendar-events">
                {selectedEvents.map((event) => <CalendarEventRow key={event.id} event={event} onOpenTask={onOpenTask} />)}
              </ul>}
            </section>

            <p className="task-readonly-note">
              快照不含 goal 任务；periodic 仅显示下一次到期日，不展开未来重复规则。目标、已暂停与已归档任务请查看下方全量任务列表。
            </p>
          </>}

          <section className="task-section" aria-label="今日快照">
            <h3>今日 / 近 48 小时快照</h3>
            {today.isPending && <p role="status">正在读取今日快照…</p>}
            {today.isError && <div role="alert">
              <p>{todayUnavailable
                ? '今日快照尚不可用（后台尚未生成或文件缺失）。这不代表今天没有任何日程。'
                : `今日快照读取失败：${today.error.message}`}</p>
              <button type="button" onClick={() => { void today.refetch(); }}>重新读取今日快照</button>
            </div>}
            {today.isSuccess && <>
              <p className="task-readonly-note">生成时间：{new Date(today.data.fetched_at).toLocaleString()} · 覆盖 {today.data.window_start} → {today.data.window_end} · 共 {today.data.count} 条。</p>
              <div className="task-actions">
                <button type="button" onClick={() => { void today.refetch(); }}>重新读取今日快照</button>
              </div>
              {!todayCovered && <p className="task-readonly-note">该快照窗口未覆盖今天（未覆盖 ≠ 今天没有日程）。</p>}
              {todayCovered && (todayEvents.length === 0
                ? <p>今日在快照覆盖范围内，暂无事件。</p>
                : <ul className="task-calendar-events">
                  {todayEvents.map((event) => <CalendarEventRow key={event.id} event={event} onOpenTask={onOpenTask} />)}
                </ul>)}
            </>}
          </section>

          <section className="task-section" aria-label="全量任务列表">
            <h3>全量任务列表</h3>
            <p className="task-readonly-note">按最新来源接口读取，包含 goal、已暂停与已归档任务；状态可能比上方快照更新。操作后快照由后台任务重建，不在此处伪造即时同步。</p>
            {tasks.isPending && <p role="status">正在读取任务列表…</p>}
            {tasks.isError && <div role="alert">
              <p>任务列表读取失败：{tasks.error.message}</p>
              <button type="button" onClick={() => { void tasks.refetch(); }}>重试任务列表</button>
            </div>}
            {tasks.isSuccess && (tasks.data.length === 0
              ? <p>暂无任务。</p>
              : <ul className="task-list">
                {tasks.data.map((task) => <li key={task.id} className="task-list-row">
                  <div>
                    <p className="task-list-title">{task.is_pinned && <span aria-label="已置顶">📌 </span>}{task.title}</p>
                    <p className="task-readonly-note">{TASK_TYPE_LABELS[task.entry_type]} · {TASK_STATUS_LABELS[task.status]} · {dueText(task)} · 开始 {task.start_date}</p>
                  </div>
                  <button type="button" onClick={() => onOpenTask(task.id)}>打开任务详情</button>
                </li>)}
              </ul>)}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
