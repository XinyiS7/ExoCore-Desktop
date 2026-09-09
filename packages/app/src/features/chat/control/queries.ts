/**
 * P1D stable query-key families and server-state orchestration (Plan Task 1,
 * §6.3–§6.6). Server reads rely first on exact keys + request state; no
 * writable mirror exists anywhere (Plan §6.3).
 */
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCacheStatus,
  fetchProjectDetail,
  fetchProjectFiles,
  fetchProjectTree,
  patchConversationThinkingLevel,
  releaseCache,
  renewCache,
} from './api';
import type { ProjectTreeEntry, ProjectTreeRequest, ThinkingLevel } from './types';
import { queryKeys as chatQueryKeys } from '../queries';

export const controlQueryKeys = {
  cache: (conversationId: number) => ['control', 'cache', conversationId] as const,
  projectDetail: (projectId: number) => ['control', 'project', projectId] as const,
  projectFiles: (projectId: number) => ['control', 'project-files', projectId] as const,
  projectTreeRoot: (projectId: number) => ['control', 'project-tree-root', projectId] as const,
  /** Single Query-owned combined-tree source: path → fetched level children. */
  projectTreeLevels: (projectId: number) => ['control', 'project-tree-levels', projectId] as const,
  projectTreeLevel: (projectId: number, path: string) =>
    ['control', 'project-tree-level', projectId, path] as const,
};

const isPositiveId = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

// ── Cache ────────────────────────────────────────────────────────────────────

/**
 * Backend cache truth. No `refetchInterval` here — calibration timing is owned
 * by `useCacheControl` (at most 30s, hidden-aware) so polling never outlives
 * the page. `refetch()` is also invoked after terminal/renew/release.
 */
export function useCacheStatusQuery(conversationId: number) {
  return useQuery({
    queryKey: controlQueryKeys.cache(conversationId),
    queryFn: () => fetchCacheStatus(conversationId),
    enabled: isPositiveId(conversationId),
    retry: false,
  });
}

/**
 * Eligible renew — success refetches the exact cache row; failure (404/409/
 * network) retains displayed truth until that refetch (Plan §6.4).
 */
export function useRenewCacheMutation(_conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ownerConversationId: number) => renewCache(ownerConversationId),
    onSuccess: async (_result, ownerConversationId) => {
      await queryClient.invalidateQueries({ queryKey: controlQueryKeys.cache(ownerConversationId) });
    },
  });
}

/**
 * Release — success refetches and describes possible background snapshot
 * rebuild (Plan D4); 404/error is never converted to success.
 */
export function useReleaseCacheMutation(_conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ownerConversationId: number) => releaseCache(ownerConversationId),
    onSuccess: async (_result, ownerConversationId) => {
      await queryClient.invalidateQueries({ queryKey: controlQueryKeys.cache(ownerConversationId) });
    },
  });
}

// ── Conversation thinking patch (backend truth, Plan §6.3) ───────────────────

export function useConversationThinkingMutation(conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (level: ThinkingLevel) => patchConversationThinkingLevel(conversationId, level),
    onSuccess: async () => {
      // Confirm the exact Conversation row from backend; thinking_level does
      // not appear in list rows, so the conversations family stays untouched.
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversation(conversationId) });
    },
  });
}

// ── Project context (gated by positive project id; Drift issues zero requests) ─

export function useProjectDetailQuery(projectId: number | null) {
  return useQuery({
    queryKey: controlQueryKeys.projectDetail(projectId ?? 0),
    queryFn: () => fetchProjectDetail(projectId as number),
    enabled: isPositiveId(projectId),
    retry: false,
  });
}

export function useProjectFilesQuery(projectId: number | null) {
  return useQuery({
    queryKey: controlQueryKeys.projectFiles(projectId ?? 0),
    queryFn: () => fetchProjectFiles(projectId as number),
    enabled: isPositiveId(projectId),
    retry: false,
  });
}

/**
 * Root recursive tree — shared by drawer and autocomplete (single fetch for
 * both consumers). Backend itself caches the scan for 30s; a matching stale
 * window keeps autocomplete snappy without a second request owner. Existing
 * consumers keep this hook; new combined-tree consumers use `useProjectTree`.
 */
export function useProjectTreeRootQuery(
  projectId: number | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: controlQueryKeys.projectTreeRoot(projectId ?? 0),
    queryFn: () => fetchProjectTree(projectId as number, { kind: 'root' }),
    enabled: isPositiveId(projectId) && (options.enabled ?? true),
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * ONE shared combined-tree owner for drawer AND autocomplete (Plan §6.6).
 *
 * Two queries combine into a single derived view:
 *  - `projectTreeRoot` — the recursive SERVER root tree (never mutated);
 *  - `projectTreeLevels` — the Query-owned record of exact single-level
 *    children fetched for shell dirs (one immutable `setQueryData` per
 *    successful level load).
 *
 * `combine` re-derives the presentation tree (server root + level children,
 * deeper merges compose by path) so every consumer of this hook sees the
 * exact same combined data. No local overlay, no generic synchronizer.
 */
export interface ProjectTreeView {
  /** Combined presentation tree: root server entries with level merges. */
  entries: ProjectTreeEntry[];
  rootPending: boolean;
  rootError: unknown;
  refetchRoot: () => Promise<unknown>;
}

export function useProjectTree(
  projectId: number | null,
  options: { enabled?: boolean } = {},
) {
  const enabled = isPositiveId(projectId) && (options.enabled ?? true);
  return useQueries({
    queries: [
      {
        queryKey: controlQueryKeys.projectTreeRoot(projectId ?? 0),
        queryFn: () => fetchProjectTree(projectId as number, { kind: 'root' }),
        enabled,
        staleTime: 30_000,
        retry: false,
      },
      {
        // Synthetic owner of the combined-children record: queryFn performs
        // no network I/O; the record is written by successful shell loads.
        queryKey: controlQueryKeys.projectTreeLevels(projectId ?? 0),
        queryFn: () => ({} as Record<string, ProjectTreeEntry[]>),
        enabled,
        staleTime: Infinity,
        retry: false,
      },
    ],
    combine: ([root, levels]) =>
      ({
        entries: root.data
          ? mergeLevelChildren(root.data.entries, levels.data ?? {})
          : [],
        rootPending: root.isPending,
        rootError: root.error,
        refetchRoot: () => root.refetch(),
      }) as ProjectTreeView,
  });
}

/**
 * Immutable combine of a directory tree with a path→fetched-children
 * record. RECURSIVE ROOT CHILDREN ARE BACKEND TRUTH: a level record may only
 * fill a SHELL (`entries === null`) — it never overrides server children, so
 * a refreshed recursive root wins over a stale level cache. Deeper merges
 * compose: fetched level children are recursively merged too.
 */
export function mergeLevelChildren(
  entries: ProjectTreeEntry[],
  levels: Record<string, ProjectTreeEntry[]>,
): ProjectTreeEntry[] {
  return entries.map((entry) => {
    if (entry.type !== 'dir') return entry;
    if (entry.entries !== null) {
      // Backend recursive children are canonical — level data never replaces
      // them; recurse only to apply deeper SHELL fills inside them.
      return { ...entry, entries: mergeLevelChildren(entry.entries, levels) };
    }
    const fetched = levels[entry.path];
    if (fetched) {
      return { ...entry, entries: mergeLevelChildren(fetched, levels) };
    }
    return entry;
  });
}

/**
 * One exact single-level expansion for a directory shell whose children are
 * not present in the root recursive response (Plan §6.6). Keyed by project +
 * exact path so two conversations can never share a level page.
 */
export function useProjectTreeLevelQuery(projectId: number | null, path: string | null) {
  const request: ProjectTreeRequest | null =
    path !== null && path !== '' ? { kind: 'level', path } : null;
  return useQuery({
    queryKey: controlQueryKeys.projectTreeLevel(projectId ?? 0, request?.path ?? ''),
    queryFn: () =>
      fetchProjectTree(projectId as number, request as ProjectTreeRequest),
    enabled: isPositiveId(projectId) && request !== null,
    retry: false,
  });
}