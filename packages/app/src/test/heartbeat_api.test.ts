import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelHeartbeatWakeup,
  createHeartbeatNote,
  fetchHeartbeatEventDetail,
  fetchHeartbeatEvents,
  fetchHeartbeatQueue,
  HeartbeatApiError,
  normalizeHeartbeatEventDetail,
  normalizeHeartbeatEventListItem,
  normalizeHeartbeatEventsResponse,
  normalizeHeartbeatQueueSummary,
  scheduleHeartbeatWakeup,
  toHeartbeatApiError,
  withdrawHeartbeatNote,
} from '../features/heartbeat/api';
import { AppApiError } from '../features/chat/api';
import { installFetch, jsonResponse } from './helpers';

describe('Heartbeat typed read client & normalizers (Plan §3.1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeHeartbeatQueueSummary', () => {
    it('normalizes complete queue response with auto, notes, and wakeups', () => {
      const raw = {
        preset_id: 1,
        auto_enabled: true,
        cadence_mode: 'normal',
        paused_until_utc: '2026-09-30T10:00:00Z',
        paused_until_local: '2026-09-30 12:00',
        next_auto: {
          task_id: 101,
          target_utc: '2026-09-30T09:30:00Z',
          effective_utc: '2026-09-30T09:30:00Z',
          effective_local: '2026-09-30 11:30',
          message: 'routine check',
          resume_check: false,
          status: 'pending',
        },
        pending_notes: [
          {
            id: 1,
            message: 'Hello Alaric',
            created_at: '2026-09-29T14:00:00Z',
            created_local: '2026-09-29 16:00:00',
          },
        ],
        explicit_wakeups: [
          {
            task_id: 201,
            target_utc: '2026-10-01T08:00:00Z',
            effective_utc: '2026-10-01T08:00:00Z',
            effective_local: '2026-10-01 10:00',
            message: 'User wakeup',
            resume_check: false,
            status: 'pending',
          },
        ],
        unshown_explicit_count: 3,
      };

      const result = normalizeHeartbeatQueueSummary(raw);
      expect(result.presetId).toBe(1);
      expect(result.autoEnabled).toBe(true);
      expect(result.cadenceMode).toBe('normal');
      expect(result.pausedUntilUtc).toBe('2026-09-30T10:00:00Z');
      expect(result.pausedUntilLocal).toBe('2026-09-30 12:00');
      expect(result.nextAuto).toEqual({
        taskId: 101,
        targetUtc: '2026-09-30T09:30:00Z',
        effectiveUtc: '2026-09-30T09:30:00Z',
        effectiveLocal: '2026-09-30 11:30',
        message: 'routine check',
        resumeCheck: false,
        status: 'pending',
      });
      expect(result.pendingNotes).toEqual([
        {
          id: 1,
          message: 'Hello Alaric',
          createdAt: '2026-09-29T14:00:00Z',
          createdLocal: '2026-09-29 16:00:00',
        },
      ]);
      expect(result.explicitWakeups).toHaveLength(1);
      expect(result.explicitWakeups[0].taskId).toBe(201);
      expect(result.unshownExplicitCount).toBe(3);
    });

    it('normalizes queue response when auto is disabled and next_auto is null', () => {
      const raw = {
        preset_id: 1,
        auto_enabled: false,
        cadence_mode: 'normal',
        paused_until_utc: null,
        paused_until_local: null,
        next_auto: null,
        pending_notes: [],
        explicit_wakeups: [],
        unshown_explicit_count: 0,
      };

      const result = normalizeHeartbeatQueueSummary(raw);
      expect(result.autoEnabled).toBe(false);
      expect(result.nextAuto).toBeNull();
      expect(result.pendingNotes).toEqual([]);
      expect(result.explicitWakeups).toEqual([]);
    });

    it('throws contractError on malformed queue payload', () => {
      expect(() => normalizeHeartbeatQueueSummary(null)).toThrow(AppApiError);
      expect(() => normalizeHeartbeatQueueSummary({ preset_id: 'bad' })).toThrow(AppApiError);
      expect(() => normalizeHeartbeatQueueSummary({ preset_id: 1 })).toThrow(AppApiError);
    });

    describe('R1-F01: nested queue validation & no coercion', () => {
      // Fresh per-case payload builders; every call returns new objects/arrays so
      // table rows cannot leak mutations into one another.
      const queue = (overrides: Record<string, unknown> = {}) => ({
        preset_id: 1,
        auto_enabled: true,
        cadence_mode: 'normal',
        paused_until_utc: null,
        paused_until_local: null,
        next_auto: null,
        pending_notes: [] as unknown[],
        explicit_wakeups: [] as unknown[],
        unshown_explicit_count: 0,
        ...overrides,
      });

      const nextAuto = (overrides: Record<string, unknown> = {}) => ({
        task_id: 101,
        target_utc: '2026-09-30T09:30:00Z',
        effective_utc: '2026-09-30T09:30:00Z',
        effective_local: '2026-09-30 09:30',
        message: '',
        resume_check: false,
        status: 'pending',
        ...overrides,
      });

      const note = (overrides: Record<string, unknown> = {}) => ({
        id: 1,
        message: 'hi',
        created_at: '2026-09-29T10:00:00Z',
        created_local: '10:00',
        ...overrides,
      });

      const wakeup = (overrides: Record<string, unknown> = {}) => ({
        task_id: 201,
        target_utc: '2026-10-01T08:00:00Z',
        effective_utc: '2026-10-01T08:00:00Z',
        effective_local: '2026-10-01 10:00',
        message: '',
        resume_check: false,
        status: 'pending',
        ...overrides,
      });

      const rejectQueue = (payload: unknown) =>
        expect(() => normalizeHeartbeatQueueSummary(payload)).toThrow(AppApiError);

      it.each<[string, unknown]>([
        ['array as next_auto object', []],
        ['task_id 0 (non-positive)', nextAuto({ task_id: 0 })],
        ['task_id string "101"', nextAuto({ task_id: '101' })],
        ['task_id float 10.5', nextAuto({ task_id: 10.5 })],
        ['resume_check number 1 (truthy non-boolean)', nextAuto({ resume_check: 1 })],
        ['resume_check string "false" (falsy non-boolean)', nextAuto({ resume_check: 'false' })],
        ['target_utc empty string', nextAuto({ target_utc: '' })],
        ['R2: status unknown_status', nextAuto({ status: 'unknown_status' })],
      ])('rejects invalid next_auto (%s)', (_label, next) => {
        rejectQueue(queue({ next_auto: next }));
      });

      it.each<[string, unknown]>([
        ['fast', 'fast'],
        ['empty string', ''],
        ['null', null],
      ])('R2: rejects unknown cadence_mode (%s; not normal, quiet, deep_quiet)', (_label, mode) => {
        rejectQueue(queue({ cadence_mode: mode }));
      });

      it.each<[string, unknown[]]>([
        ['array instead of object item', [[]]],
        ['id 0 (non-positive)', [note({ id: 0 })]],
        ['message 12345 (non-string)', [note({ message: 12345 })]],
        [
          'one malformed among valid items (never injects synthetic id:0)',
          [note({ message: 'valid' }), { id: 'bad-id', message: 'invalid' }],
        ],
      ])('rejects malformed pending_notes (%s) and fails the entire response', (_label, notes) => {
        rejectQueue(queue({ pending_notes: notes }));
      });

      it.each<[string, unknown[]]>([
        ['array instead of object item', [[]]],
        ['R2: status active', [wakeup({ status: 'active' })]],
        ['task_id 0 (non-positive)', [wakeup({ task_id: 0 })]],
        ['resume_check string "false" (non-boolean)', [wakeup({ resume_check: 'false' })]],
      ])('rejects malformed explicit_wakeups (%s) and fails the entire response', (_label, wakeups) => {
        rejectQueue(queue({ explicit_wakeups: wakeups }));
      });

      it.each<[string, number]>([
        ['negative -1', -1],
        ['non-integer 2.5', 2.5],
      ])('rejects negative or non-integer unshown_explicit_count (%s)', (_label, count) => {
        rejectQueue(queue({ unshown_explicit_count: count }));
      });
    });
  });

  describe('normalizeHeartbeatEventsResponse', () => {
    it('normalizes valid events list', () => {
      const raw = {
        events: [
          {
            session_uuid: 'uuid-1',
            preset_id: 1,
            preset_name: 'Alessandro',
            launch_source: 'user',
            domain: 'system',
            status: 'succeeded',
            content: 'Heartbeat completed normally',
            started_at: '2026-09-29T10:00:00Z',
            completed_at: '2026-09-29T10:01:00Z',
          },
        ],
        total_count: 1,
        has_more: false,
      };

      const res = normalizeHeartbeatEventsResponse(raw);
      expect(res.totalCount).toBe(1);
      expect(res.hasMore).toBe(false);
      expect(res.events).toHaveLength(1);
      expect(res.events[0]).toEqual({
        sessionUuid: 'uuid-1',
        presetId: 1,
        presetName: 'Alessandro',
        launchSource: 'user',
        domain: 'system',
        status: 'succeeded',
        content: 'Heartbeat completed normally',
        startedAt: '2026-09-29T10:00:00Z',
        completedAt: '2026-09-29T10:01:00Z',
      });
    });

    it('normalizes single event list item and rejects malformed records', () => {
      const item = normalizeHeartbeatEventListItem({
        session_uuid: 'uuid-abc',
        preset_id: 1,
        preset_name: 'Alaric',
        launch_source: 'user',
        domain: 'system',
        status: 'succeeded',
        content: 'OK',
        started_at: null,
        completed_at: null,
      });
      expect(item.sessionUuid).toBe('uuid-abc');
      expect(() => normalizeHeartbeatEventListItem(null)).toThrow(AppApiError);
      expect(() => normalizeHeartbeatEventListItem({ session_uuid: 'u' })).toThrow(AppApiError);
    });

    it('throws contractError when events array or required fields are missing', () => {
      expect(() => normalizeHeartbeatEventsResponse(null)).toThrow(AppApiError);
      expect(() => normalizeHeartbeatEventsResponse({ events: 'not-array' })).toThrow(AppApiError);
      expect(() =>
        normalizeHeartbeatEventsResponse({
          events: [{ session_uuid: '', preset_id: 1 }],
          total_count: 1,
          has_more: false,
        }),
      ).toThrow(AppApiError);
    });

    describe('R1-F01: event list item scalar & enum validation', () => {
      const validEventItem = {
        session_uuid: 'uuid-1',
        preset_id: 1,
        preset_name: 'Alessandro',
        launch_source: 'user',
        domain: 'system',
        status: 'succeeded',
        content: 'OK',
        started_at: null,
        completed_at: null,
      };

      it('rejects array as event item', () => {
        expect(() => normalizeHeartbeatEventListItem([])).toThrow(AppApiError);
      });

      it('rejects non-positive preset_id in event item', () => {
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, preset_id: 0 })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, preset_id: '1' })).toThrow(AppApiError);
      });

      it('rejects non-string preset_name, domain, or content in event item', () => {
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, preset_name: 123 })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, domain: {} })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, content: null })).toThrow(AppApiError);
      });

      it('rejects empty, non-string, or unknown launch_source and status enums', () => {
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, launch_source: '' })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, launch_source: 1 })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, launch_source: 'server' })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, launch_source: 'cron' })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, status: '' })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, status: false })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, status: 'paused' })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, status: 'unknown' })).toThrow(AppApiError);
      });

      it('rejects non-null non-string dates in event item', () => {
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, started_at: 1727600000 })).toThrow(AppApiError);
        expect(() => normalizeHeartbeatEventListItem({ ...validEventItem, completed_at: true })).toThrow(AppApiError);
      });

      it('rejects entire events response if any event is malformed', () => {
        expect(() =>
          normalizeHeartbeatEventsResponse({
            events: [validEventItem, { ...validEventItem, session_uuid: '' }],
            total_count: 2,
            has_more: false,
          }),
        ).toThrow(AppApiError);
      });

      it('rejects non-integer or negative total_count and non-boolean has_more', () => {
        expect(() =>
          normalizeHeartbeatEventsResponse({
            events: [validEventItem],
            total_count: -1,
            has_more: false,
          }),
        ).toThrow(AppApiError);

        expect(() =>
          normalizeHeartbeatEventsResponse({
            events: [validEventItem],
            total_count: 1,
            has_more: 'false',
          }),
        ).toThrow(AppApiError);
      });
    });
  });

  describe('normalizeHeartbeatEventDetail', () => {
    const validDetail = {
      session_uuid: 'uuid-10',
      preset_id: 1,
      preset_name: 'Alessandro',
      launch_source: 'auto',
      domain: 'assistant',
      status: 'failed',
      content: '',
      started_at: '2026-09-29T12:00:00Z',
      completed_at: '2026-09-29T12:02:00Z',
      seed_message: 'Triggered by timer',
      tool_history: [{ tool_name: 'read_memory', status: 'done' }],
      error_summary: 'Timeout calling upstream',
      finalization_reason: 'max_segments',
      attempt_number: 2,
      wake_up_task_id: 88,
      source_conversation_id: 42,
      acknowledged_at: null,
    };

    it('normalizes full event detail with allowlist fields', () => {
      const detail = normalizeHeartbeatEventDetail(validDetail);
      expect(detail.sessionUuid).toBe('uuid-10');
      expect(detail.seedMessage).toBe('Triggered by timer');
      expect(detail.toolHistory).toEqual([{ tool_name: 'read_memory', status: 'done' }]);
      expect(detail.errorSummary).toBe('Timeout calling upstream');
      expect(detail.finalizationReason).toBe('max_segments');
      expect(detail.attemptNumber).toBe(2);
      expect(detail.wakeUpTaskId).toBe(88);
      expect(detail.sourceConversationId).toBe(42);
      expect(detail.acknowledgedAt).toBeNull();
    });

    describe('R1-F01: event detail scalar & enum validation', () => {
      it('rejects non-positive, string, or float attempt_number', () => {
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, attempt_number: 0 }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, attempt_number: '2' }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, attempt_number: 1.5 }),
        ).toThrow(AppApiError);
      });

      it('R2: rejects non-array or explicit null tool_history', () => {
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, tool_history: {} }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, tool_history: 'invalid' }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, tool_history: null }),
        ).toThrow(AppApiError);
      });

      it('rejects non-positive non-null wake_up_task_id or source_conversation_id', () => {
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, wake_up_task_id: 0 }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, wake_up_task_id: '88' }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, source_conversation_id: -1 }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, source_conversation_id: '42' }),
        ).toThrow(AppApiError);
      });

      it('R2: rejects non-string or explicit null seed_message and error_summary', () => {
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, seed_message: 12345 }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, seed_message: null }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, error_summary: {} }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, error_summary: null }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, acknowledged_at: true }),
        ).toThrow(AppApiError);
      });

      it('R2: rejects unknown non-null finalization_reason', () => {
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, finalization_reason: 'timeout' }),
        ).toThrow(AppApiError);
        expect(() =>
          normalizeHeartbeatEventDetail({ ...validDetail, finalization_reason: 'cancelled' }),
        ).toThrow(AppApiError);
      });

      it('R2: permits valid finalization_reason, null finalization_reason, blank strings, and empty tool_history', () => {
        const detailExplicit = normalizeHeartbeatEventDetail({
          ...validDetail,
          finalization_reason: 'explicit',
          seed_message: '',
          error_summary: '',
          tool_history: [],
        });
        expect(detailExplicit.finalizationReason).toBe('explicit');
        expect(detailExplicit.seedMessage).toBe('');
        expect(detailExplicit.errorSummary).toBe('');
        expect(detailExplicit.toolHistory).toEqual([]);

        const detailNull = normalizeHeartbeatEventDetail({
          ...validDetail,
          finalization_reason: null,
        });
        expect(detailNull.finalizationReason).toBeNull();
      });
    });
  });

  describe('toHeartbeatApiError', () => {
    it('preserves server error code from heartbeat envelope', () => {
      const serverError = {
        status: 409,
        body: {
          error: '纸条已被拆封消费，无法撤回',
          code: 'already_consumed',
        },
      };

      const mapped = toHeartbeatApiError(serverError);
      expect(mapped).toBeInstanceOf(HeartbeatApiError);
      expect(mapped.status).toBe(409);
      expect(mapped.code).toBe('already_consumed');
      expect(mapped.message).toBe('纸条已被拆封消费，无法撤回');
    });

    it('extracts preset_not_found server error', () => {
      const serverError = {
        status: 400,
        body: {
          error: 'preset does not exist',
          code: 'preset_not_found',
        },
      };

      const mapped = toHeartbeatApiError(serverError);
      expect(mapped.code).toBe('preset_not_found');
      expect(mapped.message).toBe('preset does not exist');
    });

    it('handles network TypeError cleanly', () => {
      const networkError = new TypeError('Failed to fetch');
      const mapped = toHeartbeatApiError(networkError);
      expect(mapped.code).toBe('NETWORK_ERROR');
      expect(mapped.message).toContain('网络连接失败');
    });
  });

  describe('API endpoints', () => {
    it('fetchHeartbeatQueue issues GET and returns normalized summary', async () => {
      const { calls } = installFetch([
        {
          test: '/api/heartbeat/queue/',
          method: 'GET',
          handler: (url) => {
            expect(url.searchParams.get('preset_id')).toBe('1');
            return jsonResponse({
              preset_id: 1,
              auto_enabled: true,
              cadence_mode: 'normal',
              paused_until_utc: null,
              paused_until_local: null,
              next_auto: null,
              pending_notes: [],
              explicit_wakeups: [],
              unshown_explicit_count: 0,
            });
          },
        },
      ]);

      const res = await fetchHeartbeatQueue(1);
      expect(res.presetId).toBe(1);
      expect(res.autoEnabled).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.method).toBe('GET');
    });

    it('fetchHeartbeatEvents issues GET with limit and offset and never writes', async () => {
      const { calls } = installFetch([
        {
          test: '/api/heartbeat/events/',
          method: 'GET',
          handler: (url) => {
            expect(url.searchParams.get('preset_id')).toBe('1');
            expect(url.searchParams.get('limit')).toBe('20');
            expect(url.searchParams.get('offset')).toBe('40');
            return jsonResponse({
              events: [],
              total_count: 50,
              has_more: false,
            });
          },
        },
      ]);

      const res = await fetchHeartbeatEvents(1, { limit: 20, offset: 40 });
      expect(res.totalCount).toBe(50);
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.body).toBeUndefined();
    });

    it('fetchHeartbeatEventDetail issues GET and never acknowledges', async () => {
      const sessionUuid = '11111111-2222-3333-4444-555555555555';
      const { calls } = installFetch([
        {
          test: `/api/heartbeat/events/${sessionUuid}/`,
          method: 'GET',
          handler: () =>
            jsonResponse({
              session_uuid: sessionUuid,
              preset_id: 1,
              preset_name: 'Alessandro',
              launch_source: 'auto',
              domain: 'system',
              status: 'succeeded',
              content: 'Execution successful',
              started_at: '2026-09-29T10:00:00Z',
              completed_at: '2026-09-29T10:01:00Z',
              seed_message: '',
              tool_history: [],
              error_summary: '',
              finalization_reason: null,
              attempt_number: 1,
              wake_up_task_id: null,
              source_conversation_id: null,
              acknowledged_at: null,
            }),
        },
      ]);

      const detail = await fetchHeartbeatEventDetail(sessionUuid);
      expect(detail.sessionUuid).toBe(sessionUuid);
      expect(detail.acknowledgedAt).toBeNull();
      expect(calls).toHaveLength(1);
      // Confirmed GET only, no mutations sent
      expect(calls[0].init?.method).toBe('GET');
      expect(calls[0].init?.body).toBeUndefined();
    });
  });

  describe('Heartbeat write operations (CP-B)', () => {
    it('createHeartbeatNote sends POST with preset_id and message', async () => {
      const { calls } = installFetch([
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                id: 42,
                message: 'Hello Alaric',
                created_at: '2026-09-29T15:00:00Z',
                created_local: '2026-09-29 17:00:00',
              },
              201,
            ),
        },
      ]);

      const note = await createHeartbeatNote(1, 'Hello Alaric');
      expect(note).toEqual({
        id: 42,
        message: 'Hello Alaric',
        createdAt: '2026-09-29T15:00:00Z',
        createdLocal: '2026-09-29 17:00:00',
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.method).toBe('POST');
      const body = JSON.parse(calls[0].init?.body as string);
      expect(body).toEqual({
        preset_id: 1,
        message: 'Hello Alaric',
      });
    });

    it('createHeartbeatNote surfaces server error on 400 rejection', async () => {
      installFetch([
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                error: 'message is required',
                code: 'message_required',
              },
              400,
            ),
        },
      ]);

      await expect(createHeartbeatNote(1, '')).rejects.toThrow(HeartbeatApiError);
    });

    it('withdrawHeartbeatNote sends DELETE to note endpoint and completes on 204', async () => {
      const { calls } = installFetch([
        {
          test: '/api/heartbeat/notes/42/',
          method: 'DELETE',
          handler: () => new Response(null, { status: 204 }),
        },
      ]);

      await expect(withdrawHeartbeatNote(42)).resolves.toBeUndefined();
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.method).toBe('DELETE');
    });

    it('withdrawHeartbeatNote surfaces 409 already_consumed code and message', async () => {
      installFetch([
        {
          test: '/api/heartbeat/notes/42/',
          method: 'DELETE',
          handler: () =>
            jsonResponse(
              {
                error: '纸条已被拆封消费，无法撤回',
                code: 'already_consumed',
              },
              409,
            ),
        },
      ]);

      try {
        await withdrawHeartbeatNote(42);
        expect.unreachable('Should have thrown on 409');
      } catch (err) {
        expect(err).toBeInstanceOf(HeartbeatApiError);
        const apiErr = err as HeartbeatApiError;
        expect(apiErr.code).toBe('already_consumed');
        expect(apiErr.message).toBe('纸条已被拆封消费，无法撤回');
      }
    });

    it('scheduleHeartbeatWakeup sends POST with formatted time and resume_check=false', async () => {
      const { calls } = installFetch([
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                task_id: 301,
                target_utc: '2026-10-01T12:00:00Z',
                effective_utc: '2026-10-01T12:00:00Z',
                effective_local: '2026-10-01 14:00',
                message: 'Custom wakeup',
                resume_check: false,
                source: 'user',
                status: 'pending',
              },
              201,
            ),
        },
      ]);

      const wakeup = await scheduleHeartbeatWakeup(1, '2026-10-01 14:00', 'Custom wakeup');
      expect(wakeup).toEqual({
        taskId: 301,
        targetUtc: '2026-10-01T12:00:00Z',
        effectiveUtc: '2026-10-01T12:00:00Z',
        effectiveLocal: '2026-10-01 14:00',
        message: 'Custom wakeup',
        resumeCheck: false,
        status: 'pending',
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.method).toBe('POST');
      const body = JSON.parse(calls[0].init?.body as string);
      expect(body).toEqual({
        preset_id: 1,
        wake_up_at: '2026-10-01 14:00',
        message: 'Custom wakeup',
        resume_check: false,
      });
    });

    it('cancelHeartbeatWakeup sends DELETE to wakeup endpoint and completes on 204', async () => {
      const { calls } = installFetch([
        {
          test: '/api/heartbeat/wakeups/301/',
          method: 'DELETE',
          handler: () => new Response(null, { status: 204 }),
        },
      ]);

      await expect(cancelHeartbeatWakeup(301)).resolves.toBeUndefined();
      expect(calls).toHaveLength(1);
      expect(calls[0].init?.method).toBe('DELETE');
    });

    it('cancelHeartbeatWakeup surfaces 409 cannot_cancel code and message', async () => {
      installFetch([
        {
          test: '/api/heartbeat/wakeups/301/',
          method: 'DELETE',
          handler: () =>
            jsonResponse(
              {
                error: 'task could not be cancelled',
                code: 'cannot_cancel',
              },
              409,
            ),
        },
      ]);

      try {
        await cancelHeartbeatWakeup(301);
        expect.unreachable('Should have thrown on 409');
      } catch (err) {
        expect(err).toBeInstanceOf(HeartbeatApiError);
        const apiErr = err as HeartbeatApiError;
        expect(apiErr.code).toBe('cannot_cancel');
        expect(apiErr.message).toBe('task could not be cancelled');
      }
    });

    it('createHeartbeatNote classifies malformed 201 response as ambiguousWrite', async () => {
      installFetch([
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                id: 'not-a-number',
                message: null,
              },
              201,
            ),
        },
      ]);

      try {
        await createHeartbeatNote(1, 'Hello Alaric');
        expect.unreachable('Should have thrown on malformed 201');
      } catch (err) {
        expect(err).toBeInstanceOf(HeartbeatApiError);
        const apiErr = err as HeartbeatApiError;
        expect(apiErr.code).toBe('CONTRACT');
        expect(apiErr.ambiguousWrite).toBe(true);
      }
    });

    it('scheduleHeartbeatWakeup classifies malformed 201 response as ambiguousWrite', async () => {
      installFetch([
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                task_id: 'bad-id',
                target_utc: null,
              },
              201,
            ),
        },
      ]);

      try {
        await scheduleHeartbeatWakeup(1, '2026-10-01 14:00', 'Custom wakeup');
        expect.unreachable('Should have thrown on malformed 201');
      } catch (err) {
        expect(err).toBeInstanceOf(HeartbeatApiError);
        const apiErr = err as HeartbeatApiError;
        expect(apiErr.code).toBe('CONTRACT');
        expect(apiErr.ambiguousWrite).toBe(true);
      }
    });

    it('scheduleHeartbeatWakeup normalizes real backend response without effective_* fields', async () => {
      installFetch([
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                task_id: 402,
                target_utc: '2026-10-02T10:00:00Z',
                target_local: '2026-10-02 12:00',
                message: 'Morning briefing',
                resume_check: false,
                source: 'user',
                status: 'pending',
              },
              201,
            ),
        },
      ]);

      const wakeup = await scheduleHeartbeatWakeup(1, '2026-10-02 12:00', 'Morning briefing');
      expect(wakeup).toEqual({
        taskId: 402,
        targetUtc: '2026-10-02T10:00:00Z',
        effectiveUtc: '2026-10-02T10:00:00Z',
        effectiveLocal: '2026-10-02 12:00',
        message: 'Morning briefing',
        resumeCheck: false,
        status: 'pending',
      });
    });
  });
});
