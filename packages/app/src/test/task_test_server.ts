import type {
  CalendarEvent,
  CalendarSnapshot,
  CompletionRecord,
  TaskEntry,
} from '../features/tasks/types';
import { installFetch, jsonResponse } from './helpers';

/**
 * Memory-only CP3 Task fixture. Never touches a database or the network.
 *
 * `entries` is the canonical Map of ScheduleEntry state: UI actions mutate it
 * exactly the way the real views/serializers do (todo archives on complete,
 * suspend clears the pin, archive is a soft status change, GCal link fields are
 * backend-owned), so tests can assert protocol truth instead of mock echoes.
 * River/open-task projections are derived from that Map on every request.
 */

const DATE_EPOCH = Date.UTC(2026, 9, 2, 12, 0, 0);

function stamp(seconds: number): string {
  return new Date(DATE_EPOCH + seconds * 1000).toISOString();
}

/** Full canonical ScheduleEntry wire object; every field present. */
export function taskEntry(
  overrides: Partial<TaskEntry> & Pick<TaskEntry, 'id' | 'title' | 'entry_type'>,
): TaskEntry {
  return {
    description: '',
    status: 'active',
    is_pinned: false,
    start_date: '2026-10-02',
    tags: [],
    due_date: null,
    interval_unit: null,
    interval_value: null,
    end_type: null,
    end_count: null,
    end_date: null,
    occurrences_done: 0,
    goal_count: null,
    goal_period: null,
    cycle_start: null,
    cycle_due: null,
    gcal_event_id: '',
    gcal_event_link: '',
    current_cycle_completions: 0,
    next_periodic_due: null,
    created_at: stamp(0),
    updated_at: stamp(0),
    ...overrides,
  };
}

/** Full merged-snapshot event; pass the source-specific fields explicitly. */
export function calendarEvent(
  overrides: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'source' | 'title' | 'start' | 'end' | 'all_day'>,
): CalendarEvent {
  return {
    description: '',
    location: null,
    html_link: null,
    entry_type: null,
    status: null,
    exocore_entry_id: null,
    calendar_name: null,
    calendar_id: null,
    ...overrides,
  };
}

/** `count` defaults to the real events length unless a test overrides it. */
export function calendarSnapshot(overrides: Partial<CalendarSnapshot> = {}): CalendarSnapshot {
  const { events = [], ...rest } = overrides;
  return {
    fetched_at: stamp(0),
    window_start: '2026-10-01',
    window_end: '2026-12-30',
    count: events.length,
    ...rest,
    events,
  };
}

export interface TaskTestServer {
  entries: Map<number, TaskEntry>;
  completions: Map<number, CompletionRecord>;
  nextEntryId: number;
  nextCompletionId: number;
  /** Return a Response to override the default mutation; undefined falls through. */
  create?: (body: Record<string, unknown>) => Response | undefined | Promise<Response | undefined>;
  patch?: (id: number, body: Record<string, unknown>, entry: TaskEntry) => Response | undefined | Promise<Response | undefined>;
  complete?: (id: number, body: Record<string, unknown>, entry: TaskEntry) => Response | undefined | Promise<Response | undefined>;
  push?: (id: number, entry: TaskEntry) => Response | undefined | Promise<Response | undefined>;
  unlink?: (id: number, entry: TaskEntry) => Response | undefined | Promise<Response | undefined>;
  calendarError?: number;
  todayError?: number;
  calendarSnapshot: CalendarSnapshot;
  todaySnapshot: CalendarSnapshot;
  riverNextCursor: string | null;
  riverMoreItems: unknown[];
}

const EDITABLE_KEYS = [
  'title',
  'description',
  'start_date',
  'tags',
  'is_pinned',
  'due_date',
  'interval_unit',
  'interval_value',
  'end_type',
  'end_count',
  'end_date',
  'goal_count',
  'goal_period',
  'cycle_start',
  'cycle_due',
] as const;

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const padded = (value: number) => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${padded(shifted.getUTCMonth() + 1)}-${padded(shifted.getUTCDate())}`;
}

export function installTaskServer(initial: TaskEntry[] = []) {
  const entries = new Map<number, TaskEntry>(initial.map((entry) => [entry.id, entry]));
  const completions = new Map<number, CompletionRecord>();
  const server: TaskTestServer = {
    entries,
    completions,
    nextEntryId: initial.reduce((max, entry) => Math.max(max, entry.id), 0) + 1,
    nextCompletionId: 1,
    calendarSnapshot: calendarSnapshot(),
    todaySnapshot: calendarSnapshot(),
    riverNextCursor: null,
    riverMoreItems: [],
  };

  const cycleCount = (entry: TaskEntry): number =>
    entry.cycle_start === null
      ? 0
      : [...completions.values()].filter(
          (record) => record.entry === entry.id && record.cycle_start === entry.cycle_start,
        ).length;

  const nextPeriodicDue = (entry: TaskEntry): string | null => {
    if (entry.entry_type !== 'periodic' || !entry.interval_unit || !entry.interval_value) return null;
    const step = entry.interval_value * entry.occurrences_done;
    if (entry.interval_unit === 'day') return shiftDate(entry.start_date, step);
    if (entry.interval_unit === 'week') return shiftDate(entry.start_date, step * 7);
    const [year, month, day] = entry.start_date.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1 + step, day));
    const padded = (value: number) => String(value).padStart(2, '0');
    return `${shifted.getUTCFullYear()}-${padded(shifted.getUTCMonth() + 1)}-${padded(shifted.getUTCDate())}`;
  };

  /** Serializer projection: computed fields are read-time facts, never stored. */
  const projected = (entry: TaskEntry): TaskEntry => ({
    ...entry,
    current_cycle_completions: cycleCount(entry),
    next_periodic_due: nextPeriodicDue(entry),
  });

  const openTaskItems = () =>
    [...entries.values()]
      .filter((entry) => entry.status === 'active' || entry.status === 'escalated')
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        const left = a.due_date ?? a.cycle_due ?? a.start_date;
        const right = b.due_date ?? b.cycle_due ?? b.start_date;
        return left.localeCompare(right);
      })
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        entry_type: entry.entry_type,
        status: entry.status,
        is_pinned: entry.is_pinned,
        start_date: entry.start_date,
        tags: entry.tags,
        due_date: entry.due_date,
        cycle_due: entry.cycle_due,
        next_periodic_due: nextPeriodicDue(entry),
      }));

  const riverItems = () => {
    const created = [...entries.values()].map((entry) => ({
      source_type: 'task',
      source_id: `created:${entry.id}`,
      occurred_at: entry.created_at,
      time_precision: 'instant',
      preset_id: null,
      preview: '任务已创建',
      capabilities: [],
      target: { type: 'task', entry_id: entry.id },
      source_specific: {
        event_kind: 'created',
        title: entry.title,
        entry_type: entry.entry_type,
        status: entry.status,
        is_pinned: entry.is_pinned,
        start_date: entry.start_date,
        due_date: entry.due_date,
        cycle_start: entry.cycle_start,
        cycle_due: entry.cycle_due,
      },
    }));
    const completed = [...completions.values()].map((record) => {
      const entry = entries.get(record.entry);
      return {
        source_type: 'task',
        source_id: `completed:${record.id}`,
        occurred_at: record.completed_at,
        time_precision: 'instant',
        preset_id: null,
        preview: '任务已完成',
        capabilities: [],
        target: { type: 'task', entry_id: record.entry },
        source_specific: {
          event_kind: 'completed',
          title: entry?.title ?? '',
          entry_type: entry?.entry_type ?? 'todo',
          status: entry?.status ?? 'active',
          is_pinned: entry?.is_pinned ?? false,
          start_date: entry?.start_date ?? '2026-10-02',
          due_date: entry?.due_date ?? null,
          cycle_start: entry?.cycle_start ?? null,
          cycle_due: entry?.cycle_due ?? null,
          completion_id: record.id,
          completion_note: record.note,
          completion_cycle_start: record.cycle_start,
        },
      };
    });
    return [...created, ...completed].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  };

  const readBody = (init?: RequestInit): Record<string, unknown> => {
    if (!init?.body) return {};
    const parsed: unknown = JSON.parse(String(init.body));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  };

  const idFrom = (url: URL, segment: number): number => Number(url.pathname.split('/')[segment]);

  const { calls } = installFetch([
    {
      test: '/api/core/river/',
      handler: (url) =>
        url.searchParams.has('cursor')
          ? jsonResponse({ items: server.riverMoreItems, next_cursor: null })
          : jsonResponse({ items: riverItems(), next_cursor: server.riverNextCursor }),
    },
    { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: openTaskItems() }) },
    {
      test: '/api/tasks/entries/',
      method: 'GET',
      handler: () => jsonResponse([...entries.values()].map(projected)),
    },
    {
      test: '/api/tasks/entries/',
      method: 'POST',
      handler: async (_url, init) => {
        const body = readBody(init);
        const override = await server.create?.(body);
        if (override) return override;
        const id = server.nextEntryId++;
        const entry = taskEntry({
          id,
          title: String(body.title ?? ''),
          description: String(body.description ?? ''),
          entry_type: (body.entry_type as TaskEntry['entry_type']) ?? 'todo',
          start_date: String(body.start_date ?? ''),
          tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
          is_pinned: body.is_pinned === true,
          due_date: (body.due_date as string | null) ?? null,
          interval_unit: (body.interval_unit as TaskEntry['interval_unit']) ?? null,
          interval_value: (body.interval_value as number | null) ?? null,
          end_type: (body.end_type as TaskEntry['end_type']) ?? null,
          end_count: (body.end_count as number | null) ?? null,
          end_date: (body.end_date as string | null) ?? null,
          goal_count: (body.goal_count as number | null) ?? null,
          goal_period: (body.goal_period as TaskEntry['goal_period']) ?? null,
          cycle_start: (body.cycle_start as string | null) ?? null,
          cycle_due: (body.cycle_due as string | null) ?? null,
          created_at: stamp(id),
          updated_at: stamp(id),
        });
        entries.set(id, entry);
        return jsonResponse(projected(entry), 201);
      },
    },
    {
      test: '/api/tasks/completions/',
      method: 'GET',
      handler: (url) => {
        const entryId = Number(url.searchParams.get('entry'));
        return jsonResponse(
          [...completions.values()].filter((record) => record.entry === entryId).sort((a, b) => b.id - a.id),
        );
      },
    },
    {
      test: '/api/tasks/calendar/',
      method: 'GET',
      handler: () =>
        server.calendarError
          ? jsonResponse({ detail: 'Calendar snapshot not yet available. Please retry shortly.' }, server.calendarError)
          : jsonResponse(server.calendarSnapshot),
    },
    {
      test: '/api/tasks/calendar/today/',
      method: 'GET',
      handler: () =>
        server.todayError
          ? jsonResponse({ detail: 'Today snapshot not yet available. Please retry shortly.' }, server.todayError)
          : jsonResponse(server.todaySnapshot),
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/$/,
      method: 'GET',
      handler: (url) => {
        const entry = entries.get(idFrom(url, 4));
        return entry ? jsonResponse(projected(entry)) : jsonResponse({ detail: 'Not found.' }, 404);
      },
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/$/,
      method: 'PATCH',
      handler: async (url, init) => {
        const id = idFrom(url, 4);
        const entry = entries.get(id);
        if (!entry) return jsonResponse({ detail: 'Not found.' }, 404);
        const body = readBody(init);
        const override = await server.patch?.(id, body, entry);
        if (override) return override;
        if ('entry_type' in body && body.entry_type !== entry.entry_type) {
          return jsonResponse({ entry_type: ['Cannot change entry_type after creation.'] }, 400);
        }
        const merged: TaskEntry = { ...entry };
        for (const key of EDITABLE_KEYS) {
          if (key in body) (merged as unknown as Record<string, unknown>)[key] = body[key];
        }
        merged.updated_at = new Date(Date.parse(entry.updated_at) + 1000).toISOString();
        entries.set(id, merged);
        return jsonResponse(projected(merged));
      },
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/$/,
      method: 'DELETE',
      handler: (url) => {
        const id = idFrom(url, 4);
        const entry = entries.get(id);
        if (!entry) return jsonResponse({ detail: 'Not found.' }, 404);
        // Soft-archive: keep the row, clear the backend-owned GCal link.
        entries.set(id, { ...entry, status: 'archived', gcal_event_id: '', gcal_event_link: '' });
        return jsonResponse(null, 204);
      },
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/complete\/$/,
      method: 'POST',
      handler: async (url, init) => {
        const id = idFrom(url, 4);
        const entry = entries.get(id);
        if (!entry) return jsonResponse({ detail: 'Not found.' }, 404);
        const body = readBody(init);
        const override = await server.complete?.(id, body, entry);
        if (override) return override;
        if (entry.status !== 'active' && entry.status !== 'escalated') {
          return jsonResponse({ detail: `Cannot check in on a '${entry.status}' entry.` }, 400);
        }
        const completionId = server.nextCompletionId++;
        const record: CompletionRecord = {
          id: completionId,
          entry: id,
          completed_at: stamp(10000 + completionId),
          cycle_start: entry.cycle_start,
          note: typeof body.note === 'string' ? body.note : '',
        };
        completions.set(record.id, record);
        if (entry.entry_type === 'todo') {
          entries.set(id, { ...entry, status: 'archived' });
        } else if (entry.entry_type === 'periodic') {
          entries.set(id, { ...entry, occurrences_done: entry.occurrences_done + 1 });
        }
        return jsonResponse(record, 201);
      },
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/suspend\/$/,
      method: 'POST',
      handler: (url) => {
        const id = idFrom(url, 4);
        const entry = entries.get(id);
        if (!entry) return jsonResponse({ detail: 'Not found.' }, 404);
        const suspended: TaskEntry = { ...entry, status: 'suspended', is_pinned: false };
        entries.set(id, suspended);
        return jsonResponse(projected(suspended));
      },
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/resume\/$/,
      method: 'POST',
      handler: (url) => {
        const id = idFrom(url, 4);
        const entry = entries.get(id);
        if (!entry) return jsonResponse({ detail: 'Not found.' }, 404);
        const resumed: TaskEntry = { ...entry, status: 'active' };
        entries.set(id, resumed);
        return jsonResponse(projected(resumed));
      },
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/gcal\/$/,
      method: 'POST',
      handler: async (url) => {
        const id = idFrom(url, 4);
        const entry = entries.get(id);
        if (!entry) return jsonResponse({ detail: 'Not found.' }, 404);
        const override = await server.push?.(id, entry);
        if (override) return override;
        const linked = {
          ...entry,
          gcal_event_id: `evt_${id}`,
          gcal_event_link: `https://calendar.google.com/event?eid=evt_${id}`,
        };
        entries.set(id, linked);
        return jsonResponse({
          gcal_synced: true,
          gcal_event_id: linked.gcal_event_id,
          gcal_event_link: linked.gcal_event_link,
        });
      },
    },
    {
      test: /^\/api\/tasks\/entries\/\d+\/gcal\/$/,
      method: 'DELETE',
      handler: async (url) => {
        const id = idFrom(url, 4);
        const entry = entries.get(id);
        if (!entry) return jsonResponse({ detail: 'Not found.' }, 404);
        const override = await server.unlink?.(id, entry);
        if (override) return override;
        if (!entry.gcal_event_id) return jsonResponse({ detail: 'Entry is not linked to GCal.' }, 400);
        entries.set(id, { ...entry, gcal_event_id: '', gcal_event_link: '' });
        return jsonResponse(null, 204);
      },
    },
  ]);

  return { server, calls };
}
