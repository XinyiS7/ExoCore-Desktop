import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useVisiblePresetsQuery } from '../chat/queries';
import { agentQueryKeys } from '../agents/queries';
import { fetchDailyUsage, patchUserPreset } from './api';
import { resolveUserProfile, type ResolveUserProfileResult } from './projection';
import type { TelemetryUsageResponse, UpdateUserPresetInput, UsageMode } from './types';

export const accountQueryKeys = {
  usage: (mode: UsageMode, from: string) => ['usage', mode, from] as const,
};

/**
 * Resolves user profile from the canonical visible presets Query (Plan §3 D4).
 */
export function useUserProfileQuery() {
  const presetsQuery = useVisiblePresetsQuery();
  const resolution: ResolveUserProfileResult = resolveUserProfile(presetsQuery.data ?? []);

  return {
    presetsQuery,
    resolution,
    user: resolution.status === 'ok' ? resolution.user : null,
  };
}

/**
 * Mutation updating user preset fields with strict invalidation (Plan §3 D4).
 */
export function useUpdateUserProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: UpdateUserPresetInput }) =>
      patchUserPreset(id, fields),
    onSuccess: (updated) => {
      // Invalidate canonical presets list
      void queryClient.invalidateQueries({ queryKey: queryKeys.presets });
      // Invalidate agent detail cache for this preset if cached
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.preset(updated.id) });
    },
  });
}

/**
 * Telemetry usage Query (Plan §3 D6).
 */
export function useUsageQuery(mode: UsageMode, from: string) {
  return useQuery<TelemetryUsageResponse>({
    queryKey: accountQueryKeys.usage(mode, from),
    queryFn: () => fetchDailyUsage(mode, from),
    enabled: Boolean(from),
    retry: false,
  });
}
