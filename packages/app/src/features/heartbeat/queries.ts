import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isValidPresetId } from '../agents/queries';
import {
  fetchHeartbeatEventDetail,
  fetchHeartbeatEvents,
  fetchHeartbeatQueue,
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
