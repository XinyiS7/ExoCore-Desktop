import { useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { AppApiError } from '../chat/api';
import { riverQueryKeys } from '../river/queries';
import {
  archiveTask,
  completeTask,
  createTask,
  fetchCalendarSnapshot,
  fetchCompletions,
  fetchTask,
  fetchTasks,
  patchTask,
  pushTaskGCal,
  resumeTask,
  suspendTask,
  unlinkTaskGCal,
} from './api';
import type { CalendarSnapshotKind, TaskFilters } from './types';
import type { TaskPayload, TaskPayloadPatch } from './taskPayloads';

/**
 * CP3 Task queries and page-lived action sync.
 *
 * Cache policy (Detailed Plan CP3 / frozen behavior D.23): every confirmed write
 * invalidates the Task detail/list/completions families, the River shelf and the
 * loaded River traversal. Create/complete restart the River home traversal because
 * they produce new events at the home boundary; ordinary updates keep the existing
 * cursor windows and source ordering. Nothing here writes optimistic terminal state —
 * the server's own status/fields are always re-read.
 */

export const taskQueryKeys = {
  list: (filters: TaskFilters = {}) =>
    ['tasks', 'list', filters.status ?? null, filters.entry_type ?? null, filters.is_pinned ?? null] as const,
  detail: (id: number) => ['tasks', 'detail', id] as const,
  completions: (entryId: number) => ['tasks', 'completions', entryId] as const,
  calendar: (kind: CalendarSnapshotKind) => ['tasks', 'calendar', kind] as const,
};

/** GET `/api/tasks/entries/` — full Task list (includes archived; goal included). */
export function useTasksQuery(filters: TaskFilters = {}) {
  const { status, entry_type, is_pinned } = filters;
  return useQuery({
    queryKey: taskQueryKeys.list({ status, entry_type, is_pinned }),
    queryFn: ({ signal }) => fetchTasks({ status, entry_type, is_pinned }, signal),
    retry: false,
  });
}

/** GET one entry; disabled for absent/non-positive ids. */
export function useTaskQuery(id: number | null) {
  return useQuery({
    queryKey: taskQueryKeys.detail(id ?? 0),
    queryFn: ({ signal }) => fetchTask(id as number, signal),
    enabled: id !== null && id > 0,
    retry: false,
  });
}

/** GET `/api/tasks/completions/?entry=<id>` (bare array); disabled without a real id. */
export function useTaskCompletionsQuery(entryId: number | null) {
  return useQuery({
    queryKey: taskQueryKeys.completions(entryId ?? 0),
    queryFn: ({ signal }) => fetchCompletions(entryId as number, signal),
    enabled: entryId !== null && entryId > 0,
    retry: false,
  });
}

/**
 * GET the generated snapshot only. Refetch re-reads the 07/14/21 job output; it never
 * rebuilds the snapshot, so consumers must show the snapshot's own `fetched_at`.
 */
export function useCalendarSnapshotQuery(kind: CalendarSnapshotKind) {
  return useQuery({
    queryKey: taskQueryKeys.calendar(kind),
    queryFn: ({ signal }) => fetchCalendarSnapshot(kind, signal),
    retry: false,
  });
}

/** Sentinel busy key for a create in flight (ScheduleEntry pks are always positive). */
const CREATE_ACTION_KEY = 0;
const RIVER_PAGES_PREFIX = ['river', 'pages'] as const;

async function invalidateTaskFacts(
  client: QueryClient,
  entryId: number | null,
  restartRiver: boolean,
): Promise<void> {
  const jobs: Promise<unknown>[] = [
    client.invalidateQueries({ queryKey: ['tasks', 'list'] }),
    client.invalidateQueries({
      queryKey: entryId === null ? ['tasks', 'detail'] : ['tasks', 'detail', entryId],
    }),
    client.invalidateQueries({
      queryKey: entryId === null ? ['tasks', 'completions'] : ['tasks', 'completions', entryId],
    }),
    client.invalidateQueries({ queryKey: riverQueryKeys.shelf }),
  ];
  if (restartRiver) {
    // Create/complete add events at the home boundary: discard the old cursor chain
    // and start a fresh traversal (same rule as memo root POST).
    await client.cancelQueries({ queryKey: RIVER_PAGES_PREFIX });
    jobs.push(client.resetQueries({ queryKey: RIVER_PAGES_PREFIX }));
  } else {
    // Updates do not move the created event time: re-read the already-open cursor
    // windows in place, preserving the traversal and server source ordering (G1).
    jobs.push(client.invalidateQueries({ queryKey: RIVER_PAGES_PREFIX }));
  }
  await Promise.all(jobs);
}

/**
 * Page-lifetime action helper (no global store, no persistent queue, no optimistic
 * terminal state). It serializes same-entry writes, sends them to the real source
 * endpoints, then re-reads canonical Task/River facts. On an ambiguous create/complete
 * it refreshes facts but still rejects, so the caller can tell the user to verify.
 */
export function useTaskActions() {
  const client = useQueryClient();
  const busyRef = useRef(new Set<number>());
  const [busyEntryIds, setBusyEntryIds] = useState<readonly number[]>([]);

  const markBusy = (key: number, busy: boolean) => {
    if (busy) busyRef.current.add(key);
    else busyRef.current.delete(key);
    setBusyEntryIds([...busyRef.current]);
  };

  const run = async <T,>(key: number, restartRiver: boolean, action: () => Promise<T>): Promise<T> => {
    if (busyRef.current.has(key)) throw new AppApiError('该任务已有操作正在进行，请稍后。');
    markBusy(key, true);
    try {
      const result = await action();
      await invalidateTaskFacts(client, key === CREATE_ACTION_KEY ? null : key, restartRiver);
      return result;
    } catch (cause) {
      if (cause instanceof AppApiError && cause.ambiguousWrite) {
        try {
          await invalidateTaskFacts(client, key === CREATE_ACTION_KEY ? null : key, restartRiver);
        } catch {
          /* canonical re-read failure must not mask the actionable write error */
        }
      }
      throw cause;
    } finally {
      markBusy(key, false);
    }
  };

  return {
    /** Entry ids with an in-flight action; `0` means a create is in flight. */
    busyEntryIds,
    create: (payload: TaskPayload) => run(CREATE_ACTION_KEY, true, () => createTask(payload)),
    patch: (id: number, payload: TaskPayloadPatch) => run(id, false, () => patchTask(id, payload)),
    complete: (id: number, note?: string) => run(id, true, () => completeTask(id, note)),
    suspend: (id: number) => run(id, false, () => suspendTask(id)),
    resume: (id: number) => run(id, false, () => resumeTask(id)),
    archive: (id: number) => run(id, false, () => archiveTask(id)),
    pushGCal: (id: number) => run(id, false, () => pushTaskGCal(id)),
    unlinkGCal: (id: number) => run(id, false, () => unlinkTaskGCal(id)),
  };
}

export type TaskActions = ReturnType<typeof useTaskActions>;
