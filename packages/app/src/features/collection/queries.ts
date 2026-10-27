import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import {
  addCollectionComment,
  CollectionApiError,
  deleteCollectionComment,
  deleteCollectionItem,
  getCollectionItem,
  listCollectionItems,
  listCollectionTags,
  mergeViewIntoDetail,
  patchCollectionItem,
  recordCollectionView,
  retryCollectionRepresentation,
} from './api';
import type {
  CollectionDetail,
  CollectionFilters,
  CollectionItemPatch,
  CollectionPage,
  RepresentationKind,
} from './types';

export const COLLECTION_PAGE_LIMIT = 24;

/** Canonical filter tuple: one key per distinct server query, independent of object shape. */
function filterKey(filters: CollectionFilters) {
  return [
    filters.kind ?? null,
    filters.tag || null,
    filters.q || null,
    filters.recent === true,
    filters.month || null,
    filters.link === true,
  ] as const;
}

export const collectionQueryKeys = {
  all: ['collection'] as const,
  pages: (filters: CollectionFilters) => ['collection', 'pages', ...filterKey(filters)] as const,
  detail: (id: number) => ['collection', 'detail', id] as const,
  tags: ['collection', 'tags'] as const,
};

export function useCollectionWallQuery(filters: CollectionFilters) {
  const client = useQueryClient();
  const [kind, tag, q, recent, month, link] = filterKey(filters);
  const queryKey = useMemo(
    () => ['collection', 'pages', kind, tag, q, recent, month, link] as const,
    [kind, tag, q, recent, month, link],
  );
  // A traversal belongs to one mounted filter context (same as River): leaving
  // a filter or the wall drops its cursor chain instead of reviving it later.
  useEffect(() => () => { client.removeQueries({ queryKey, exact: true }); }, [client, queryKey]);
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => listCollectionItems(
      { kind: kind ?? undefined, tag: tag ?? undefined, q: q ?? undefined, recent, month: month ?? undefined, link },
      pageParam,
      COLLECTION_PAGE_LIMIT,
      signal,
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    retry: false,
    // Cursor traversal restarts explicitly, never refetches old boundaries on focus.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
}

export function useCollectionItemQuery(id: number) {
  return useQuery({
    queryKey: collectionQueryKeys.detail(id),
    queryFn: ({ signal }) => getCollectionItem(id, signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCollectionTagsQuery() {
  return useQuery({
    queryKey: collectionQueryKeys.tags,
    queryFn: ({ signal }) => listCollectionTags(signal),
    retry: false,
  });
}

/** Explicit human view; on success the returned count lands in the cached detail at once. */
export function useRecordCollectionView(mutationKey?: readonly unknown[]) {
  const client = useQueryClient();
  return useMutation({
    mutationKey,
    mutationFn: recordCollectionView,
    retry: false,
    onSuccess: (view, id) => {
      const detail = client.getQueryData<CollectionDetail>(collectionQueryKeys.detail(id));
      if (!detail) return;
      const merged = mergeViewIntoDetail(detail, view);
      if (merged) client.setQueryData(collectionQueryKeys.detail(id), merged);
      else void client.invalidateQueries({ queryKey: collectionQueryKeys.detail(id), exact: true });
    },
  });
}

/** Location entries that already sent their view, per client (survives StrictMode remounts). */
const recordedEntries = new WeakMap<QueryClient, Set<string>>();

/**
 * One human view per route location entry (Plan §8): sent once the detail first
 * rendered; refetch, edit refresh, playback and remounts of the same entry never
 * resend, and a failure is not retried. Returns the view request status.
 */
export function useRecordViewOnce(id: number, entryKey: string, ready: boolean) {
  const client = useQueryClient();
  const mutationKey = useMemo(() => ['collection', 'view', entryKey, id] as const, [entryKey, id]);
  const { mutate } = useRecordCollectionView(mutationKey);
  useEffect(() => {
    if (!ready) return;
    let entries = recordedEntries.get(client);
    if (!entries) recordedEntries.set(client, (entries = new Set()));
    const token = `${entryKey}:${id}`;
    if (entries.has(token)) return;
    entries.add(token);
    mutate(id);
  }, [client, entryKey, id, mutate, ready]);
  const statuses = useMutationState({ filters: { mutationKey, exact: true }, select: (mutation) => mutation.state.status });
  return statuses.at(-1);
}

type WallData = InfiniteData<CollectionPage, string | null>;

function updateWallPages(client: QueryClient, update: (page: CollectionPage) => CollectionPage) {
  client.setQueriesData<WallData>({ queryKey: ['collection', 'pages'] }, (data) =>
    data ? { ...data, pages: data.pages.map(update) } : data,
  );
}

/** Server-confirmed edit (no optimistic write): detail replaced, wall card patched in place. */
export function usePatchCollectionItem(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: CollectionItemPatch) => patchCollectionItem(id, patch),
    retry: false,
    onSuccess: (detail, patch) => {
      client.setQueryData(collectionQueryKeys.detail(id), detail);
      updateWallPages(client, (page) => ({
        ...page,
        items: page.items.map((item) => (item.id === id ? {
          ...item,
          title: detail.title,
          description: detail.description,
          collection_context: detail.collection_context,
          tags: detail.tags,
          updated_at: detail.updated_at,
        } : item)),
      }));
      if (patch.tags !== undefined) void client.invalidateQueries({ queryKey: collectionQueryKeys.tags });
    },
  });
}

/** Permanent delete; an already-missing item (404) settles the same way as 204. */
export function useDeleteCollectionItem(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await deleteCollectionItem(id);
      } catch (error) {
        if (error instanceof CollectionApiError && error.code === 'collection_item_not_found') return;
        throw error;
      }
    },
    retry: false,
    onSuccess: () => {
      // The open detail observer closes itself; its cache entry then ages out unobserved.
      updateWallPages(client, (page) => ({ ...page, items: page.items.filter((item) => item.id !== id) }));
      void client.invalidateQueries({ queryKey: collectionQueryKeys.tags });
    },
  });
}

/** Server-confirmed comment write: the returned detail replaces the cached one. */
export function useAddCollectionComment(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addCollectionComment(id, body),
    retry: false,
    onSuccess: (detail) => { client.setQueryData(collectionQueryKeys.detail(id), detail); },
  });
}

/** Server-confirmed delete of one of Alicia's comments (no optimistic removal). */
export function useDeleteCollectionComment(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => deleteCollectionComment(id, commentId),
    retry: false,
    onSuccess: (detail) => { client.setQueryData(collectionQueryKeys.detail(id), detail); },
  });
}

/** Retry a failed + retryable derivation; 409 `derivation_not_retryable` refreshes the detail. */
export function useRetryRepresentation(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (kind: RepresentationKind) => retryCollectionRepresentation(id, kind),
    retry: false,
    onSuccess: (detail) => { client.setQueryData(collectionQueryKeys.detail(id), detail); },
    onError: (error) => {
      if (error instanceof CollectionApiError && error.code === 'derivation_not_retryable') {
        void client.invalidateQueries({ queryKey: collectionQueryKeys.detail(id), exact: true });
      }
    },
  });
}
