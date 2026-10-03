import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOpenTasks, fetchRiverPage, normalizeSources } from './api';
import type { RiverFilters } from './types';

export const riverQueryKeys = {
  pages: (filters: RiverFilters) => ['river', 'pages', normalizeSources(filters.sources), filters.presetId ?? null, filters.limit ?? 20] as const,
  shelf: ['river', 'open-tasks'] as const,
};
export function useRiverQuery(filters: RiverFilters) {
  const client = useQueryClient();
  const sourcesKey = normalizeSources(filters.sources).join(',');
  const presetId = filters.presetId ?? null;
  const limit = filters.limit ?? 20;
  const queryKey = useMemo(() => ['river', 'pages', sourcesKey.split(','), presetId, limit] as const, [sourcesKey, presetId, limit]);
  // A traversal belongs to one mounted filter context. Revisiting either sources
  // or preset must not revive an old cursor chain; drawer opens don't unmount it.
  useEffect(() => () => { client.removeQueries({ queryKey, exact: true }); }, [client, queryKey]);
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchRiverPage({ ...filters, cursor: pageParam }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    retry: false,
    // Cursor traversal must restart explicitly, never refetch old boundaries on focus.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
}
export function useOpenTasksQuery() {
  return useQuery({ queryKey: riverQueryKeys.shelf, queryFn: ({ signal }) => fetchOpenTasks(signal), retry: false });
}
