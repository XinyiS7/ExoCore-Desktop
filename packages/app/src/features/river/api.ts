import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import { RIVER_SOURCES, type OpenTask, type RiverFilters, type RiverItem, type RiverPageData, type RiverSource } from './types';

export class RiverApiError extends AppApiError {
  readonly sourceType: RiverSource | null;
  constructor(cause: AppApiError) {
    const body = cause.body;
    const fields = isRecord(body) ? body : {};
    super(typeof fields.error === 'string' ? fields.error : cause.message, {
      status: cause.status, body, code: typeof fields.code === 'string' ? fields.code : cause.code,
    });
    this.sourceType = RIVER_SOURCES.includes(fields.source_type as RiverSource) ? fields.source_type as RiverSource : null;
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw contractError('River 数据格式异常', value);
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw contractError('River 文本字段异常', value);
  return value;
}
function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw contractError('River 日期字段异常', value);
  return result;
}
function nullableDate(value: unknown): string | null { return value === null ? null : date(value); }
function integer(value: unknown, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw contractError('River 数值字段异常', value);
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw contractError('River 布尔字段异常', value);
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw contractError('River 列表字段异常', value);
  return [...value];
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw contractError('River 来源字段异常', value);
  return value as T;
}
export function normalizeSources(sources?: readonly RiverSource[]): RiverSource[] {
  return RIVER_SOURCES.filter((source) => !sources?.length || sources.includes(source));
}
export function normalizeRiverItem(value: unknown): RiverItem {
  const row = record(value);
  const source = choice(row.source_type, RIVER_SOURCES);
  const target = record(row.target);
  if (target.type !== source) throw contractError('River 来源与定位不一致', value);
  const specific = record(row.source_specific);
  const occurred_at = text(row.occurred_at);
  if (Number.isNaN(Date.parse(occurred_at))) throw contractError('River 时间字段异常', value);
  const base = {
    source_id: text(row.source_id), occurred_at,
    time_precision: choice(row.time_precision, ['day', 'instant'] as const),
    preset_id: row.preset_id === null ? null : integer(row.preset_id),
    preview: text(row.preview), capabilities: strings(row.capabilities),
  };
  switch (source) {
    case 'memo': return { ...base, source_type: source, target: { type: source, memo_id: integer(target.memo_id) }, source_specific: {
      author: text(specific.author), tags: strings(specific.tags), reply_count: integer(specific.reply_count, 0),
    } };
    case 'heartbeat':
      if (base.preset_id === null) throw contractError('Heartbeat 缺少 Agent 身份', value);
      return { ...base, source_type: source, target: { type: source, session_uuid: text(target.session_uuid) }, source_specific: {
        launch_source: text(specific.launch_source), domain: text(specific.domain), status: text(specific.status),
      } };
    case 'diary': {
      const preset_id = integer(target.preset_id);
      const day = date(target.day);
      if (base.preset_id !== preset_id || specific.day !== day) throw contractError('Diary 定位不一致', value);
      return { ...base, source_type: source, target: { type: source, preset_id, day }, source_specific: { day } };
    }
    case 'task': {
      const event_kind = choice(specific.event_kind, ['created', 'completed'] as const);
      return { ...base, source_type: source, target: { type: source, entry_id: integer(target.entry_id) }, source_specific: {
        event_kind, title: text(specific.title), entry_type: choice(specific.entry_type, ['todo', 'periodic', 'goal'] as const),
        status: text(specific.status), is_pinned: boolean(specific.is_pinned), start_date: date(specific.start_date),
        due_date: nullableDate(specific.due_date), cycle_start: nullableDate(specific.cycle_start), cycle_due: nullableDate(specific.cycle_due),
        ...(event_kind === 'completed' ? { completion_id: integer(specific.completion_id), completion_note: text(specific.completion_note), completion_cycle_start: nullableDate(specific.completion_cycle_start) } : {}),
      } };
    }
    case 'chronicle': return { ...base, source_type: source, target: { type: source, id: integer(target.id) }, source_specific: {
      event_time: date(specific.event_time), kind: choice(specific.kind, ['milestone', 'moment'] as const),
      scope: specific.scope === null ? null : text(specific.scope), keywords: strings(specific.keywords),
    } };
  }
}
export function normalizeRiverPage(value: unknown): RiverPageData {
  const row = record(value);
  if (!Array.isArray(row.items) || !(row.next_cursor === null || typeof row.next_cursor === 'string' && row.next_cursor.length > 0)) {
    throw contractError('River 分页格式异常', value);
  }
  return { items: row.items.map(normalizeRiverItem), next_cursor: row.next_cursor as string | null };
}
export function normalizeOpenTasks(value: unknown): OpenTask[] {
  const envelope = record(value);
  if (!Array.isArray(envelope.items)) throw contractError('任务条带格式异常', value);
  return envelope.items.map((value) => {
    const row = record(value);
    return {
      id: integer(row.id), title: text(row.title), description: text(row.description),
      entry_type: choice(row.entry_type, ['todo', 'periodic', 'goal'] as const), status: choice(row.status, ['active', 'escalated'] as const),
      is_pinned: boolean(row.is_pinned), start_date: date(row.start_date), tags: strings(row.tags),
      due_date: nullableDate(row.due_date), cycle_due: nullableDate(row.cycle_due), next_periodic_due: nullableDate(row.next_periodic_due),
    };
  });
}
export async function fetchRiverPage({ cursor, ...filters }: RiverFilters & { cursor?: string | null } = {}, signal?: AbortSignal): Promise<RiverPageData> {
  try {
    const raw: unknown = await apiFetch('/api/core/river/', { method: 'GET', signal, params: {
      cursor: cursor ?? undefined, sources: normalizeSources(filters.sources).join(','), preset_id: filters.presetId, limit: filters.limit ?? 20,
    } });
    return normalizeRiverPage(raw);
  } catch (cause) { throw new RiverApiError(toAppApiError(cause)); }
}
export async function fetchOpenTasks(signal?: AbortSignal): Promise<OpenTask[]> {
  try { return normalizeOpenTasks(await apiFetch('/api/core/river/open-tasks/', { method: 'GET', signal })); }
  catch (cause) { throw new RiverApiError(toAppApiError(cause)); }
}
