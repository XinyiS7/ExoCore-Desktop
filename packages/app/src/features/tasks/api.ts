import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import {
  CALENDAR_EVENT_SOURCES,
  TASK_END_TYPES,
  TASK_GOAL_PERIODS,
  TASK_INTERVAL_UNITS,
  TASK_STATUSES,
  TASK_TYPES,
  type CalendarEvent,
  type CalendarSnapshot,
  type CalendarSnapshotKind,
  type CompletionRecord,
  type GCalPushResult,
  type TaskEntry,
  type TaskFilters,
} from './types';
import type { TaskPayload, TaskPayloadPatch } from './taskPayloads';

/**
 * CP3 guarded adapters over the real `/api/tasks/` transport (exo-shared apiFetch).
 * Every envelope is validated at this boundary: a malformed 2xx must surface as a
 * contract error (for POST create/complete it also marks `ambiguousWrite`), never as
 * an empty success.
 *
 * Status/body semantics preserved for callers:
 * - PATCH 200 proves only the LOCAL update; when the entry is linked the backend
 *   attempts a GCal update and downgrades failures to a server warning. UI must not
 *   present PATCH 200 as "remote calendar synced".
 * - DELETE `.../gcal/` returns 204 after clearing local link fields even when the
 *   remote GCal deletion failed; 204 must not be presented as remote removal.
 * - A 204 archive/unlink carries no JSON body and none is assumed here.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw contractError(message, value);
  return value;
}

function text(value: unknown, message: string): string {
  if (typeof value !== 'string') throw contractError(message, value);
  return value;
}

function identity(value: unknown, message: string): string {
  const result = text(value, message);
  if (result === '') throw contractError(message, value);
  return result;
}

function boolean(value: unknown, message: string): boolean {
  if (typeof value !== 'boolean') throw contractError(message, value);
  return value;
}

function dateOnly(value: unknown, message: string): string {
  const result = text(value, message);
  if (!DATE_ONLY.test(result)) throw contractError(message, value);
  return result;
}

function nullableDate(value: unknown, message: string): string | null {
  return value === null ? null : dateOnly(value, message);
}

function nullableText(value: unknown, message: string): string | null {
  return value === null || value === undefined ? null : text(value, message);
}

function choice<T extends string>(value: unknown, values: readonly T[], message: string): T {
  if (!values.includes(value as T)) throw contractError(message, value);
  return value as T;
}

function nullableChoice<T extends string>(value: unknown, values: readonly T[], message: string): T | null {
  return value === null ? null : choice(value, values, message);
}

function integer(value: unknown, minimum: number, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw contractError(message, value);
  }
  return value;
}

function nullableInteger(value: unknown, minimum: number, message: string): number | null {
  return value === null ? null : integer(value, minimum, message);
}

function strings(value: unknown, message: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw contractError(message, value);
  }
  return [...value];
}

function timestamp(value: unknown, message: string): string {
  const result = text(value, message);
  if (Number.isNaN(Date.parse(result))) throw contractError(message, value);
  return result;
}

/** Maps transport/contract failures while preserving HTTP status, body and field map. */
function taskError(cause: unknown, ambiguousWrite = false): AppApiError {
  const error = toAppApiError(cause);
  const body = isRecord(error.body) ? error.body : null;
  const message =
    typeof body?.detail === 'string' && body.detail !== ''
      ? body.detail
      : typeof body?.error === 'string' && body.error !== ''
        ? body.error
        : Object.values(error.fieldErrors)[0] ?? error.message;
  return new AppApiError(message, {
    status: error.status,
    body: error.body,
    code: error.code,
    fieldErrors: error.fieldErrors,
    ambiguousWrite: ambiguousWrite || error.ambiguousWrite,
  });
}

/** POST uncertainty: network/lost response, 5xx, or an unverifiable 2xx envelope. */
function writeTaskError(cause: unknown): AppApiError {
  const error = toAppApiError(cause);
  const uncertain = error.status === null || error.status >= 500 || error.code === 'CONTRACT';
  return taskError(error, uncertain);
}

// ── Normalizers (exported for focused tests) ──────────────────────────────

/** Exact `ScheduleEntrySerializer` shape; all fields are mandatory in the response. */
export function normalizeTaskEntry(value: unknown): TaskEntry {
  const row = record(value, '任务数据格式异常');
  return {
    id: integer(row.id, 1, '任务编号异常'),
    title: text(row.title, '任务标题异常'),
    description: text(row.description, '任务描述异常'),
    entry_type: choice(row.entry_type, TASK_TYPES, '任务类型异常'),
    status: choice(row.status, TASK_STATUSES, '任务状态异常'),
    is_pinned: boolean(row.is_pinned, '任务置顶字段异常'),
    start_date: dateOnly(row.start_date, '任务开始日期异常'),
    tags: strings(row.tags, '任务标签异常'),
    due_date: nullableDate(row.due_date, '任务截止日期异常'),
    interval_unit: nullableChoice(row.interval_unit, TASK_INTERVAL_UNITS, '任务周期单位异常'),
    interval_value: nullableInteger(row.interval_value, 1, '任务周期数值异常'),
    end_type: nullableChoice(row.end_type, TASK_END_TYPES, '任务结束方式异常'),
    end_count: nullableInteger(row.end_count, 1, '任务结束次数异常'),
    end_date: nullableDate(row.end_date, '任务结束日期异常'),
    occurrences_done: integer(row.occurrences_done, 0, '任务完成次数异常'),
    goal_count: nullableInteger(row.goal_count, 1, '目标任务次数异常'),
    goal_period: nullableChoice(row.goal_period, TASK_GOAL_PERIODS, '目标任务周期异常'),
    cycle_start: nullableDate(row.cycle_start, '目标周期开始异常'),
    cycle_due: nullableDate(row.cycle_due, '目标周期截止异常'),
    gcal_event_id: text(row.gcal_event_id, 'GCal 事件编号异常'),
    gcal_event_link: text(row.gcal_event_link, 'GCal 链接异常'),
    current_cycle_completions: integer(row.current_cycle_completions, 0, '目标周期完成数异常'),
    next_periodic_due: nullableDate(row.next_periodic_due, '周期下次日期异常'),
    created_at: timestamp(row.created_at, '任务创建时间异常'),
    updated_at: timestamp(row.updated_at, '任务更新时间异常'),
  };
}

/** `CompletionRecordSerializer` shape; the record must belong to the requested entry. */
export function normalizeCompletionRecord(value: unknown, entryId: number): CompletionRecord {
  const row = record(value, '完成记录格式异常');
  const entry = integer(row.entry, 1, '完成记录任务编号异常');
  if (entry !== entryId) throw contractError('完成记录与任务不一致', value);
  return {
    id: integer(row.id, 1, '完成记录编号异常'),
    entry,
    completed_at: timestamp(row.completed_at, '完成时间异常'),
    cycle_start: nullableDate(row.cycle_start, '完成周期异常'),
    note: text(row.note, '完成备注异常'),
  };
}

/** One `calendar_schedule.json` / `today_snapshot.json` event; exo rows keep Task identity. */
export function normalizeCalendarEvent(value: unknown): CalendarEvent {
  const row = record(value, '日历事件格式异常');
  const source = choice(row.source, CALENDAR_EVENT_SOURCES, '日历事件来源异常');
  const exocore_entry_id = nullableInteger(row.exocore_entry_id, 1, '日历任务编号异常');
  // Editability follows exocore_entry_id: only ExoCore rows address a Task detail.
  if (source === 'exocore' && exocore_entry_id === null) {
    throw contractError('ExoCore 日历事件缺少任务编号', value);
  }
  if (source === 'gcal' && exocore_entry_id !== null) {
    throw contractError('GCal 日历事件不应携带任务编号', value);
  }
  return {
    id: identity(row.id, '日历事件编号异常'),
    source,
    title: text(row.title, '日历事件标题异常'),
    start: text(row.start, '日历事件开始时间异常'),
    end: text(row.end, '日历事件结束时间异常'),
    all_day: boolean(row.all_day, '日历事件全天标记异常'),
    description: text(row.description, '日历事件描述异常'),
    location: nullableText(row.location, '日历事件地点异常'),
    html_link: nullableText(row.html_link, '日历事件链接异常'),
    entry_type: nullableChoice(row.entry_type, TASK_TYPES, '日历事件任务类型异常'),
    status: nullableChoice(row.status, TASK_STATUSES, '日历事件任务状态异常'),
    exocore_entry_id,
    calendar_name: nullableText(row.calendar_name, '日历名称异常'),
    calendar_id: nullableText(row.calendar_id, '日历编号异常'),
  };
}

export function normalizeCalendarSnapshot(value: unknown): CalendarSnapshot {
  const row = record(value, '日历快照格式异常');
  if (!Array.isArray(row.events)) throw contractError('日历快照事件格式异常', value);
  const events = row.events.map(normalizeCalendarEvent);
  const count = integer(row.count, 0, '日历快照计数异常');
  if (count !== events.length) throw contractError('日历快照计数与事件数不一致', value);
  return {
    fetched_at: timestamp(row.fetched_at, '日历快照生成时间异常'),
    window_start: dateOnly(row.window_start, '日历快照窗口开始异常'),
    window_end: dateOnly(row.window_end, '日历快照窗口结束异常'),
    count,
    events,
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** GET `/api/tasks/entries/` (bare array; backend order/queryset is authoritative). */
export async function fetchTasks(filters: TaskFilters = {}, signal?: AbortSignal): Promise<TaskEntry[]> {
  try {
    const raw: unknown = await apiFetch('/api/tasks/entries/', {
      method: 'GET',
      signal,
      params: { status: filters.status, entry_type: filters.entry_type, is_pinned: filters.is_pinned },
    });
    if (!Array.isArray(raw)) throw contractError('任务列表格式异常', raw);
    return raw.map(normalizeTaskEntry);
  } catch (cause) {
    throw taskError(cause);
  }
}

/** GET `/api/tasks/entries/<id>/`. */
export async function fetchTask(id: number, signal?: AbortSignal): Promise<TaskEntry> {
  try {
    const entry = normalizeTaskEntry(await apiFetch(`/api/tasks/entries/${id}/`, { method: 'GET', signal }));
    if (entry.id !== id) throw contractError('任务详情定位不一致', entry);
    return entry;
  } catch (cause) {
    throw taskError(cause);
  }
}

/** GET `/api/tasks/completions/?entry=<id>` (bare array, newest first). */
export async function fetchCompletions(entryId: number, signal?: AbortSignal): Promise<CompletionRecord[]> {
  try {
    const raw: unknown = await apiFetch('/api/tasks/completions/', {
      method: 'GET',
      signal,
      params: { entry: entryId },
    });
    if (!Array.isArray(raw)) throw contractError('完成记录格式异常', raw);
    return raw.map((value) => normalizeCompletionRecord(value, entryId));
  } catch (cause) {
    throw taskError(cause);
  }
}

const CALENDAR_PATHS: Record<CalendarSnapshotKind, string> = {
  calendar: '/api/tasks/calendar/',
  today: '/api/tasks/calendar/today/',
};

/**
 * GET the read-only generated snapshot. This only re-reads the file written by the
 * 07/14/21 background job — it never regenerates it and must not be presented as
 * "snapshot refreshed by the action". 503 (file absent) stays a visible failure.
 */
export async function fetchCalendarSnapshot(
  kind: CalendarSnapshotKind,
  signal?: AbortSignal,
): Promise<CalendarSnapshot> {
  try {
    return normalizeCalendarSnapshot(await apiFetch(CALENDAR_PATHS[kind], { method: 'GET', signal }));
  } catch (cause) {
    throw taskError(cause);
  }
}

// ── Writes ────────────────────────────────────────────────────────────────

/** POST `/api/tasks/entries/` — 201 ScheduleEntry. */
export async function createTask(payload: TaskPayload): Promise<TaskEntry> {
  try {
    return normalizeTaskEntry(await apiFetch('/api/tasks/entries/', { method: 'POST', body: payload }));
  } catch (cause) {
    throw writeTaskError(cause);
  }
}

/**
 * PATCH `/api/tasks/entries/<id>/` — 200 local ScheduleEntry.
 * Does not claim a GCal remote update even when the entry is linked.
 */
export async function patchTask(id: number, payload: TaskPayloadPatch): Promise<TaskEntry> {
  try {
    const entry = normalizeTaskEntry(
      await apiFetch(`/api/tasks/entries/${id}/`, { method: 'PATCH', body: payload }),
    );
    if (entry.id !== id) throw contractError('任务更新返回身份不一致', entry);
    return entry;
  } catch (cause) {
    throw taskError(cause);
  }
}

/** POST `/api/tasks/entries/<id>/complete/` — 201 CompletionRecord, not a ScheduleEntry. */
export async function completeTask(id: number, note?: string): Promise<CompletionRecord> {
  try {
    const raw: unknown = await apiFetch(`/api/tasks/entries/${id}/complete/`, {
      method: 'POST',
      body: note ? { note } : {},
    });
    return normalizeCompletionRecord(raw, id);
  } catch (cause) {
    throw writeTaskError(cause);
  }
}

/** POST `/api/tasks/entries/<id>/suspend/` — 200 ScheduleEntry (status suspended). */
export async function suspendTask(id: number): Promise<TaskEntry> {
  try {
    const entry = normalizeTaskEntry(await apiFetch(`/api/tasks/entries/${id}/suspend/`, { method: 'POST' }));
    if (entry.id !== id) throw contractError('暂停操作返回身份不一致', entry);
    return entry;
  } catch (cause) {
    throw taskError(cause);
  }
}

/** POST `/api/tasks/entries/<id>/resume/` — 200 ScheduleEntry (status active). */
export async function resumeTask(id: number): Promise<TaskEntry> {
  try {
    const entry = normalizeTaskEntry(await apiFetch(`/api/tasks/entries/${id}/resume/`, { method: 'POST' }));
    if (entry.id !== id) throw contractError('恢复操作返回身份不一致', entry);
    return entry;
  } catch (cause) {
    throw taskError(cause);
  }
}

/** DELETE `/api/tasks/entries/<id>/` — 204 soft-archive; no JSON body is read. */
export async function archiveTask(id: number): Promise<void> {
  try {
    await apiFetch(`/api/tasks/entries/${id}/`, { method: 'DELETE' });
  } catch (cause) {
    throw taskError(cause);
  }
}

/**
 * POST `/api/tasks/entries/<id>/gcal/` — one-way push/update.
 * Validates `{gcal_synced: true, gcal_event_id, gcal_event_link}`; a 502 stays an
 * explicit error carrying the backend `detail`.
 */
export async function pushTaskGCal(id: number): Promise<GCalPushResult> {
  try {
    const row = record(await apiFetch(`/api/tasks/entries/${id}/gcal/`, { method: 'POST' }), 'GCal 推送响应格式异常');
    if (row.gcal_synced !== true) throw contractError('GCal 推送未确认', row);
    const gcal_event_id = identity(row.gcal_event_id, 'GCal 事件编号异常');
    return {
      gcal_synced: true,
      gcal_event_id,
      gcal_event_link: text(row.gcal_event_link, 'GCal 链接异常'),
    };
  } catch (cause) {
    throw taskError(cause);
  }
}

/**
 * DELETE `/api/tasks/entries/<id>/gcal/` — 204 after clearing the local link.
 * The backend clears local fields even if the remote deletion failed, so 204 must
 * not be presented as confirmed remote removal. No JSON body is read.
 */
export async function unlinkTaskGCal(id: number): Promise<void> {
  try {
    await apiFetch(`/api/tasks/entries/${id}/gcal/`, { method: 'DELETE' });
  } catch (cause) {
    throw taskError(cause);
  }
}
