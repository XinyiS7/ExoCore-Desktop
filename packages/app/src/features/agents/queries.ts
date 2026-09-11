import { useQuery } from '@tanstack/react-query';
import { getAgentPreset, listAgentMemory } from './api';

/**
 * Agent-specific Query keys/hooks only (Plan §6.2).
 * Conversations stay on the shared `queryKeys.conversations` family — the
 * Profile lens never introduces a second fetched/stored collection.
 */

export const agentQueryKeys = {
  preset: (id: number) => ['agent-preset', id] as const,
  memory: (presetId: number) => ['agent-memory', presetId] as const,
};

/** Mirrors the accepted V4 route-param pattern (`isValidConversationId`). */
export const isValidPresetId = (value: string | undefined): value is string =>
  value !== undefined && /^[1-9]\d*$/.test(value);

/** Exact preset detail; route-keyed so switching Agents can never mix data. */
export function useAgentPresetQuery(id: number) {
  return useQuery({
    queryKey: agentQueryKeys.preset(id),
    queryFn: () => getAgentPreset(id),
    enabled: id > 0,
    retry: false,
  });
}

/** Memory summary; enabled only after the preset detail is confirmed visible. */
export function useAgentMemoryQuery(presetId: number, enabled: boolean) {
  return useQuery({
    queryKey: agentQueryKeys.memory(presetId),
    queryFn: () => listAgentMemory(presetId),
    enabled: enabled && presetId > 0,
    retry: false,
  });
}
