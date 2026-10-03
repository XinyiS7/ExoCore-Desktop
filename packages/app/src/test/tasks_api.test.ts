import { afterEach, describe, expect, it } from 'vitest';
import {
  archiveTask,
  completeTask,
  createTask,
  fetchCalendarSnapshot,
  fetchCompletions,
  fetchTask,
  fetchTasks,
  pushTaskGCal,
  unlinkTaskGCal,
} from '../features/tasks/api';
import {
  buildTaskPayload,
  buildTodoPostponePayload,
  localDateString,
  normalizeTaskTags,
  TaskPayloadError,
} from '../features/tasks/taskPayloads';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

afterEach(unmockFetch);

/** All fields the form must never read back to the source. */
const READONLY_FIELDS = [
  'id',
  'status',
  'occurrences_done',
  'gcal_event_id',
  'gcal_event_link',
  'created_at',
  'updated_at',
  'current_cycle_completions',
  'next_periodic_due',
] as const;

const canonicalEntry = {
  id: 41,
  title: '任务',
  description: '描述',
  entry_type: 'todo',
  status: 'active',
  is_pinned: false,
  start_date: '2026-10-02',
  tags: ['a'],
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
  created_at: '2026-10-02T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
};

const validPayload = {
  entry_type: 'todo' as const,
  title: '任务',
  description: '',
  start_date: '2026-10-02',
  tags: [],
  is_pinned: false,
};

describe('CP3 task payload allowlists', () => {
  it('builds exact todo/periodic/goal create payloads from required native fields only', () => {
    const todo = buildTaskPayload({
      entry_type: 'todo',
      title: ' 买牛奶 ',
      description: '脱脂',
      start_date: '2026-10-02',
      tags: [' 家务 ', '家务', '采购'],
      is_pinned: true,
      due_date: '',
    });
    expect(todo).toEqual({
      entry_type: 'todo',
      title: '买牛奶',
      description: '脱脂',
      start_date: '2026-10-02',
      tags: ['家务', '采购'],
      is_pinned: true,
      due_date: null,
    });

    const periodic = buildTaskPayload({
      entry_type: 'periodic',
      title: '拉伸',
      description: '',
      start_date: '2026-10-02',
      interval_unit: 'week',
      interval_value: '2',
      end_type: 'count',
      end_count: '3',
      end_date: '2026-11-01',
    });
    expect(periodic).toEqual({
      entry_type: 'periodic',
      title: '拉伸',
      description: '',
      start_date: '2026-10-02',
      tags: [],
      is_pinned: false,
      interval_unit: 'week',
      interval_value: 2,
      end_type: 'count',
      end_count: 3,
      end_date: null,
    });

    const goal = buildTaskPayload({
      entry_type: 'goal',
      title: '读书',
      description: '',
      start_date: '2026-10-02',
      goal_count: '3',
      goal_period: 'week',
      cycle_start: '2026-10-01',
      cycle_due: '2026-10-07',
    });
    expect(goal).toEqual({
      entry_type: 'goal',
      title: '读书',
      description: '',
      start_date: '2026-10-02',
      tags: [],
      is_pinned: false,
      goal_count: 3,
      goal_period: 'week',
      cycle_start: '2026-10-01',
      cycle_due: '2026-10-07',
    });

    for (const payload of [todo, periodic, goal]) {
      expect('entry_type' in payload).toBe(true);
      for (const field of READONLY_FIELDS) expect(payload).not.toHaveProperty(field);
    }
  });

  it('omits entry_type and readonly fields on edit and rejects invalid native inputs before any write', () => {
    const edit = buildTaskPayload(
      {
        entry_type: 'periodic',
        title: '改周期',
        description: 'd',
        start_date: '2026-10-02',
        interval_unit: 'month',
        interval_value: '2',
        end_type: 'date',
        end_date: '2026-12-01',
      },
      true,
    );
    expect(edit).toEqual({
      title: '改周期',
      description: 'd',
      start_date: '2026-10-02',
      tags: [],
      is_pinned: false,
      interval_unit: 'month',
      interval_value: 2,
      end_type: 'date',
      end_count: null,
      end_date: '2026-12-01',
    });
    expect('entry_type' in edit).toBe(false);
    for (const field of READONLY_FIELDS) expect(edit).not.toHaveProperty(field);

    expect(() =>
      buildTaskPayload({ entry_type: 'todo', title: '   ', description: '', start_date: '2026-10-02' }),
    ).toThrow(TaskPayloadError);
    expect(() =>
      buildTaskPayload({ entry_type: 'todo', title: 'x', description: '', start_date: '' }),
    ).toThrow(/开始日期/);
    expect(() =>
      buildTaskPayload({
        entry_type: 'periodic',
        title: 'x',
        description: '',
        start_date: '2026-10-02',
        interval_unit: 'week',
        interval_value: '0',
        end_type: 'never',
      }),
    ).toThrow(/正整数/);
    expect(() =>
      buildTaskPayload({
        entry_type: 'goal',
        title: 'x',
        description: '',
        start_date: '2026-10-02',
        goal_count: null,
        goal_period: 'week',
      }),
    ).toThrow(/目标次数/);

    expect(normalizeTaskTags([' a ', 'a', '', 'b'])).toEqual(['a', 'b']);
    expect(() => normalizeTaskTags(['x'.repeat(51)])).toThrow(/50/);
  });

  it('computes tomorrow/next week from the runtime local calendar, including month rollover', () => {
    // 23:30 local — a UTC `toISOString()` computation would already be another day.
    const lateLocal = new Date(2026, 9, 2, 23, 30, 0);
    expect(localDateString(lateLocal)).toBe('2026-10-02');
    expect(buildTodoPostponePayload('tomorrow', lateLocal)).toEqual({ due_date: '2026-10-03' });
    expect(buildTodoPostponePayload('next_week', lateLocal)).toEqual({ due_date: '2026-10-09' });

    const monthEnd = new Date(2026, 9, 31, 23, 59, 0);
    expect(buildTodoPostponePayload('tomorrow', monthEnd)).toEqual({ due_date: '2026-11-01' });
    expect(buildTodoPostponePayload('next_week', monthEnd)).toEqual({ due_date: '2026-11-07' });

    expect(buildTodoPostponePayload('tomorrow', new Date(2026, 11, 31, 22, 0, 0))).toEqual({
      due_date: '2027-01-01',
    });
  });
});

describe('CP3 task API adapters', () => {
  it('reads list/detail with real filters and refuses a mismatched or malformed envelope', async () => {
    const { calls } = installFetch([
      { test: '/api/tasks/entries/', handler: () => jsonResponse([canonicalEntry]) },
    ]);
    expect(await fetchTasks({ status: 'active', entry_type: 'todo', is_pinned: false })).toEqual([
      canonicalEntry,
    ]);
    expect(calls[0].url.searchParams.get('status')).toBe('active');
    expect(calls[0].url.searchParams.get('entry_type')).toBe('todo');
    expect(calls[0].url.searchParams.get('is_pinned')).toBe('false');

    installFetch([
      { test: /^\/api\/tasks\/entries\/\d+\/$/, handler: () => jsonResponse({ ...canonicalEntry, id: 42 }) },
    ]);
    await expect(fetchTask(41)).rejects.toMatchObject({ code: 'CONTRACT' });

    installFetch([
      {
        test: '/api/tasks/entries/',
        handler: () => jsonResponse([{ ...canonicalEntry, gcal_event_id: undefined }]),
      },
    ]);
    await expect(fetchTasks()).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('completes into a CompletionRecord (not an entry) and reads completions with entry=<id>', async () => {
    const record = {
      id: 3,
      entry: 41,
      completed_at: '2026-10-02T09:00:00Z',
      cycle_start: null,
      note: 'done',
    };
    const { calls } = installFetch([
      { test: '/api/tasks/entries/41/complete/', method: 'POST', handler: () => jsonResponse(record, 201) },
      { test: '/api/tasks/completions/', method: 'GET', handler: () => jsonResponse([record]) },
    ]);
    expect(await completeTask(41, 'done')).toEqual(record);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ note: 'done' });
    expect(await fetchCompletions(41)).toEqual([record]);
    expect(calls[1].url.searchParams.get('entry')).toBe('41');

    // A ScheduleEntry body on the complete endpoint is not a completion record.
    installFetch([
      { test: '/api/tasks/entries/41/complete/', handler: () => jsonResponse(canonicalEntry, 201) },
    ]);
    await expect(completeTask(41)).rejects.toMatchObject({ code: 'CONTRACT', ambiguousWrite: true });

    // A completion belonging to another entry must not be folded into this task.
    installFetch([{ test: '/api/tasks/completions/', handler: () => jsonResponse([{ ...record, entry: 42 }]) }]);
    await expect(fetchCompletions(41)).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('marks network/5xx/malformed create as uncertain but keeps a known 400 definite', async () => {
    installFetch([
      { test: '/api/tasks/entries/', method: 'POST', handler: () => { throw new TypeError('network'); } },
    ]);
    await expect(createTask(validPayload)).rejects.toMatchObject({ status: null, ambiguousWrite: true });

    for (const status of [500, 503]) {
      installFetch([
        { test: '/api/tasks/entries/', method: 'POST', handler: () => jsonResponse({ detail: 'boom' }, status) },
      ]);
      await expect(createTask(validPayload)).rejects.toMatchObject({ status, ambiguousWrite: true });
    }

    const { calls } = installFetch([
      {
        test: '/api/tasks/entries/',
        method: 'POST',
        handler: () => jsonResponse({ title: ['标题重复'] }, 400),
      },
    ]);
    await expect(createTask(validPayload)).rejects.toMatchObject({
      status: 400,
      ambiguousWrite: false,
      message: '标题重复',
    });
    expect(calls).toHaveLength(1);

    installFetch([
      { test: '/api/tasks/entries/', method: 'POST', handler: () => jsonResponse({ accepted: true }, 201) },
    ]);
    await expect(createTask(validPayload)).rejects.toMatchObject({ code: 'CONTRACT', ambiguousWrite: true });
  });

  it('resolves archive and GCal unlink exactly on DELETE 204 without assuming a JSON body', async () => {
    const { calls } = installFetch([
      { test: '/api/tasks/entries/41/', method: 'DELETE', handler: () => jsonResponse(null, 204) },
      { test: '/api/tasks/entries/41/gcal/', method: 'DELETE', handler: () => jsonResponse(null, 204) },
    ]);
    await expect(archiveTask(41)).resolves.toBeUndefined();
    await expect(unlinkTaskGCal(41)).resolves.toBeUndefined();
    expect(calls.map((call) => call.url.pathname)).toEqual([
      '/api/tasks/entries/41/',
      '/api/tasks/entries/41/gcal/',
    ]);
  });

  it('keeps a GCal push 502 visible and rejects an unconfirmed 200', async () => {
    installFetch([
      {
        test: '/api/tasks/entries/41/gcal/',
        method: 'POST',
        handler: () => jsonResponse({ detail: 'GCal sync failed: quota', gcal_synced: false }, 502),
      },
    ]);
    await expect(pushTaskGCal(41)).rejects.toMatchObject({
      status: 502,
      ambiguousWrite: false,
      message: 'GCal sync failed: quota',
    });

    installFetch([
      {
        test: '/api/tasks/entries/41/gcal/',
        method: 'POST',
        handler: () => jsonResponse({ gcal_synced: false, gcal_event_id: '', gcal_event_link: '' }),
      },
    ]);
    await expect(pushTaskGCal(41)).rejects.toMatchObject({ code: 'CONTRACT' });

    installFetch([
      {
        test: '/api/tasks/entries/41/gcal/',
        method: 'POST',
        handler: () =>
          jsonResponse({
            gcal_synced: true,
            gcal_event_id: 'evt_41',
            gcal_event_link: 'https://calendar.google.com/event?eid=evt_41',
          }),
      },
    ]);
    await expect(pushTaskGCal(41)).resolves.toEqual({
      gcal_synced: true,
      gcal_event_id: 'evt_41',
      gcal_event_link: 'https://calendar.google.com/event?eid=evt_41',
    });
  });

  it('normalizes heterogeneous calendar rows, preserves local time strings, and keeps 503 explicit', async () => {
    const exoEvent = {
      id: 'exo_41',
      source: 'exocore',
      title: '[ExoCore] 只读任务',
      start: '2026-10-02',
      end: '2026-10-03',
      all_day: true,
      description: '来自本地',
      location: null,
      html_link: null,
      entry_type: 'todo',
      status: 'active',
      exocore_entry_id: 41,
      calendar_name: null,
      calendar_id: null,
    };
    const gcalEvent = {
      id: 'gcal-1',
      source: 'gcal',
      title: '会议',
      start: '2026-10-02T09:30:00+02:00',
      end: '2026-10-02T10:30:00+02:00',
      all_day: false,
      description: '',
      location: '会议室',
      html_link: 'https://calendar.google.com/event?eid=1',
      entry_type: null,
      status: null,
      exocore_entry_id: null,
      calendar_name: 'Primary',
      calendar_id: 'primary',
    };
    const snapshot = {
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: '2026-10-01',
      window_end: '2026-12-30',
      count: 2,
      events: [exoEvent, gcalEvent],
    };

    const { calls } = installFetch([{ test: '/api/tasks/calendar/', handler: () => jsonResponse(snapshot) }]);
    const result = await fetchCalendarSnapshot('calendar');
    expect(result).toEqual(snapshot);
    expect(result.events[1].start).toBe('2026-10-02T09:30:00+02:00');
    expect(result.events[1].calendar_name).toBe('Primary');
    expect(result.events[0].exocore_entry_id).toBe(41);
    expect(calls[0].url.pathname).toBe('/api/tasks/calendar/');

    installFetch([
      { test: '/api/tasks/calendar/', handler: () => jsonResponse({ ...snapshot, count: 3 }) },
    ]);
    await expect(fetchCalendarSnapshot('calendar')).rejects.toMatchObject({ code: 'CONTRACT' });

    installFetch([
      {
        test: '/api/tasks/calendar/',
        handler: () =>
          jsonResponse({ ...snapshot, count: 1, events: [{ ...exoEvent, exocore_entry_id: null }] }),
      },
    ]);
    await expect(fetchCalendarSnapshot('calendar')).rejects.toMatchObject({ code: 'CONTRACT' });

    installFetch([
      {
        test: '/api/tasks/calendar/',
        handler: () => jsonResponse({ ...snapshot, events: [{ ...gcalEvent, exocore_entry_id: 41 }] }),
      },
    ]);
    await expect(fetchCalendarSnapshot('calendar')).rejects.toMatchObject({ code: 'CONTRACT' });

    installFetch([
      {
        test: '/api/tasks/calendar/today/',
        handler: () =>
          jsonResponse({ detail: 'Today snapshot not yet available. Please retry shortly.' }, 503),
      },
    ]);
    await expect(fetchCalendarSnapshot('today')).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('not yet available'),
    });
  });
});
