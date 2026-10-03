/**
 * CP3 Task payload allowlist (G-FORM / G-DEFER).
 *
 * `buildTaskPayload` maps the real editable fields onto the fields the source
 * serializer accepts; it never emits `status`, `entry_type` on edit, or any
 * read-only field (`id`, `occurrences_done`, `gcal_*`, computed fields,
 * timestamps). Type-specific payloads only carry the fields of their own
 * entry_type — no cross-type scratch fields.
 *
 * Date inputs are date-only `YYYY-MM-DD` strings and are passed through
 * verbatim; nothing here converts through UTC (`toISOString` would shift the
 * local day for non-UTC users). Use `localDateString()` for "today".
 */

import {
  TASK_END_TYPES,
  TASK_GOAL_PERIODS,
  TASK_INTERVAL_UNITS,
  TASK_TYPES,
  type TaskEndType,
  type TaskGoalPeriod,
  type TaskIntervalUnit,
  type TaskType,
} from './types';

export const TASK_TAG_MAX_CODEPOINTS = 50;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Local date-only helper — reads the runtime local clock, never UTC. */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Form-level validation failure; distinct from AppApiError/HTTP errors. */
export class TaskPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskPayloadError';
  }
}

/** HTML number inputs yield strings; builders coerce and validate. */
export type TaskIntegerInput = number | string | null | undefined;

/** Editable form state for one entry; entry_type is read-only on edit. */
export interface TaskFormValues {
  entry_type: TaskType;
  title: string;
  description: string;
  start_date: string;
  tags?: readonly string[] | null;
  is_pinned?: boolean | null;
  /** todo */
  due_date?: string | null;
  /** periodic */
  interval_unit?: TaskIntervalUnit | null;
  interval_value?: TaskIntegerInput;
  end_type?: TaskEndType | null;
  end_count?: TaskIntegerInput;
  end_date?: string | null;
  /** goal */
  goal_count?: TaskIntegerInput;
  goal_period?: TaskGoalPeriod | null;
  cycle_start?: string | null;
  cycle_due?: string | null;
}

/**
 * Allowlisted create payload. `entry_type` is required on create and omitted on
 * edit; `status` and every read-only serializer field are absent by type.
 */
export interface TaskPayload {
  entry_type?: TaskType;
  title: string;
  description: string;
  start_date: string;
  tags: string[];
  is_pinned: boolean;
  due_date?: string | null;
  interval_unit?: TaskIntervalUnit | null;
  interval_value?: number | null;
  end_type?: TaskEndType | null;
  end_count?: number | null;
  end_date?: string | null;
  goal_count?: number | null;
  goal_period?: TaskGoalPeriod | null;
  cycle_start?: string | null;
  cycle_due?: string | null;
}

/** PATCH payload: any allowlisted field subset, never `entry_type`. */
export type TaskPayloadPatch = Partial<Omit<TaskPayload, 'entry_type'>>;

export interface TaskPostponePayload {
  due_date: string;
}

export const TASK_POSTPONE_OPTIONS = ['tomorrow', 'next_week'] as const;
export type TaskPostponeOption = (typeof TASK_POSTPONE_OPTIONS)[number];

function requireChoice<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) {
    throw new TaskPayloadError(`${label}无效，请重新选择。`);
  }
  return value as T;
}

function requireDateOnly(value: string | null | undefined, label: string): string {
  const result = (value ?? '').trim();
  if (result === '') throw new TaskPayloadError(`${label}不能为空。`);
  if (!DATE_ONLY.test(result)) throw new TaskPayloadError(`${label}必须是 YYYY-MM-DD 格式的本地日期。`);
  return result;
}

function optionalDateOnly(value: string | null | undefined, label: string): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  return requireDateOnly(value, label);
}

function requirePositiveInteger(value: TaskIntegerInput, label: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TaskPayloadError(`${label}必须是正整数。`);
  }
  return parsed;
}

/** Trim + exact dedupe, preserving first-seen order; 50-unicode-codepoint limit. */
export function normalizeTaskTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (tag === '') continue;
    if (Array.from(tag).length > TASK_TAG_MAX_CODEPOINTS) {
      throw new TaskPayloadError(`标签「${tag}」超过 ${TASK_TAG_MAX_CODEPOINTS} 个字符，请修改后提交。`);
    }
    if (seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

function finalize(
  payload: Omit<TaskPayload, 'entry_type'>,
  entryType: TaskType,
  editing: boolean,
): TaskPayload {
  // Editing must not attempt an entry_type change (backend rejects it outright).
  return editing ? payload : { ...payload, entry_type: entryType };
}

/**
 * Builds the source CRUD payload for the selected entry_type.
 * `editing === true` omits `entry_type`; `status` is never part of any payload.
 */
export function buildTaskPayload(form: TaskFormValues, editing = false): TaskPayload {
  const entryType = requireChoice(form.entry_type, TASK_TYPES, '任务类型');
  const title = form.title.trim();
  if (title === '') throw new TaskPayloadError('标题不能为空。');
  const base = {
    title,
    description: form.description ?? '',
    start_date: requireDateOnly(form.start_date, '开始日期'),
    tags: normalizeTaskTags(form.tags ?? []),
    is_pinned: form.is_pinned === true,
  };

  if (entryType === 'todo') {
    return finalize({ ...base, due_date: optionalDateOnly(form.due_date, '截止日期') }, 'todo', editing);
  }

  if (entryType === 'periodic') {
    const interval_unit = requireChoice(form.interval_unit, TASK_INTERVAL_UNITS, '重复间隔单位');
    const interval_value = requirePositiveInteger(form.interval_value, '重复间隔次数');
    const end_type = requireChoice(form.end_type, TASK_END_TYPES, '结束方式');
    if (end_type === 'count') {
      return finalize(
        {
          ...base,
          interval_unit,
          interval_value,
          end_type,
          end_count: requirePositiveInteger(form.end_count, '结束次数'),
          end_date: null,
        },
        'periodic',
        editing,
      );
    }
    if (end_type === 'date') {
      return finalize(
        {
          ...base,
          interval_unit,
          interval_value,
          end_type,
          end_count: null,
          end_date: requireDateOnly(form.end_date, '结束日期'),
        },
        'periodic',
        editing,
      );
    }
    // end_type === 'never': both end-specific fields are explicitly null.
    return finalize(
      { ...base, interval_unit, interval_value, end_type, end_count: null, end_date: null },
      'periodic',
      editing,
    );
  }

  const goal_count = requirePositiveInteger(form.goal_count, '目标次数');
  const goal_period = requireChoice(form.goal_period, TASK_GOAL_PERIODS, '目标周期');
  return finalize(
    {
      ...base,
      goal_count,
      goal_period,
      cycle_start: optionalDateOnly(form.cycle_start, '周期开始'),
      cycle_due: optionalDateOnly(form.cycle_due, '周期截止'),
    },
    'goal',
    editing,
  );
}

/**
 * G-DEFER todo shortcut: PATCH `due_date` only. Tomorrow / next week are
 * computed from the runtime local calendar, never from fixed mockup dates or a
 * UTC instant. periodic/goal deferrals must use their native date fields.
 */
export function buildTodoPostponePayload(
  option: TaskPostponeOption,
  today: Date = new Date(),
): TaskPostponePayload {
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  due.setDate(due.getDate() + (option === 'tomorrow' ? 1 : 7));
  return { due_date: localDateString(due) };
}
