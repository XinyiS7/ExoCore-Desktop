import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isValidPresetId } from '../agents/queries';
import {
  cancelHeartbeatWakeup,
  createHeartbeatNote,
  fetchHeartbeatEventDetail,
  fetchHeartbeatEvents,
  fetchHeartbeatQueue,
  scheduleHeartbeatWakeup,
  toHeartbeatApiError,
  withdrawHeartbeatNote,
} from './api';
import type {
  HeartbeatEventDetail,
  HeartbeatEventsResponse,
  HeartbeatQueueSummary,
} from './types';

/**
 * Stable query keys for Heartbeat features (Plan §3.2).
 */
export const heartbeatQueryKeys = {
  queue: (presetId: number) => ['agent-heartbeat', presetId, 'queue'] as const,
  events: (presetId: number, limit: number, offset: number) =>
    ['agent-heartbeat', presetId, 'events', limit, offset] as const,
  eventDetail: (presetId: number, sessionUuid: string | null) =>
    ['agent-heartbeat', presetId, 'event', sessionUuid] as const,
};

/**
 * Reads queue summary for the given preset (next_auto, pending_notes, explicit_wakeups).
 * Guarded: only launches when presetId is valid and enabled is true.
 */
export function useHeartbeatQueueQuery(presetId: number, enabled = true) {
  const valid = isValidPresetId(String(presetId));
  return useQuery<HeartbeatQueueSummary>({
    queryKey: heartbeatQueryKeys.queue(presetId),
    queryFn: () => fetchHeartbeatQueue(presetId),
    enabled: enabled && valid,
  });
}

/**
 * Reads paginated HeartbeatEvent ledger list.
 * Guarded: only launches when presetId is valid and enabled is true.
 */
export function useHeartbeatEventsQuery(
  presetId: number,
  limit = 20,
  offset = 0,
  enabled = true,
) {
  const valid = isValidPresetId(String(presetId));
  return useQuery<HeartbeatEventsResponse>({
    queryKey: heartbeatQueryKeys.events(presetId, limit, offset),
    queryFn: () => fetchHeartbeatEvents(presetId, { limit, offset }),
    enabled: enabled && valid,
    placeholderData: keepPreviousData,
  });
}

/**
 * Reads single HeartbeatEvent detail by sessionUuid.
 * Guarded: only launches when presetId is valid, sessionUuid is non-empty, and enabled is true.
 */
export function useHeartbeatEventDetailQuery(
  presetId: number,
  sessionUuid: string | null,
  enabled = true,
) {
  const valid = isValidPresetId(String(presetId));
  const hasUuid = Boolean(sessionUuid && sessionUuid.trim() !== '');
  return useQuery<HeartbeatEventDetail>({
    queryKey: heartbeatQueryKeys.eventDetail(presetId, sessionUuid),
    queryFn: () => fetchHeartbeatEventDetail(sessionUuid!),
    enabled: enabled && valid && hasUuid,
  });
}

/**
 * Mutation to leave a pending note for next heartbeat (CP-B).
 * Invalidates current preset queue query on success, or upon ambiguous write.
 */
export function useCreateHeartbeatNoteMutation(presetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => createHeartbeatNote(presetId, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
    },
  });
}

/**
 * Mutation to withdraw a pending note before consumption (CP-B).
 * Invalidates current preset queue query on success or already-consumed/not-found.
 */
export function useWithdrawHeartbeatNoteMutation(presetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) => withdrawHeartbeatNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
    },
    onError: (cause) => {
      const err = toHeartbeatApiError(cause);
      if (
        err.status === 404 ||
        err.status === 409 ||
        err.code === 'note_not_found' ||
        err.code === 'already_consumed'
      ) {
        void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
      }
    },
  });
}

/**
 * Mutation to schedule a user-designated wakeup (CP-B).
 * Invalidates current preset queue query on success.
 */
export function useScheduleHeartbeatWakeupMutation(presetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wakeUpAt, message }: { wakeUpAt: string; message: string }) =>
      scheduleHeartbeatWakeup(presetId, wakeUpAt, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
    },
  });
}

/**
 * Mutation to cancel a user-designated wakeup (CP-B).
 * Invalidates current preset queue query on success or 404/409.
 */
export function useCancelHeartbeatWakeupMutation(presetId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => cancelHeartbeatWakeup(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
    },
    onError: (cause) => {
      const err = toHeartbeatApiError(cause);
      if (
        err.status === 404 ||
        err.status === 409 ||
        err.code === 'cannot_cancel' ||
        err.code === 'task_not_found'
      ) {
        void queryClient.invalidateQueries({ queryKey: heartbeatQueryKeys.queue(presetId) });
      }
    },
  });
}
