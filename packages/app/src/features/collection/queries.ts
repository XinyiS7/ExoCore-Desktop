import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCollectionItem,
  listCollectionItems,
  listCollectionTags,
  mergeViewIntoDetail,
  recordCollectionView,
} from './api';
import type { CollectionDetail, CollectionFilters } from './types';

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
export function useRecordCollectionView() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: recordCollectionView,
    retry: false,
    onSuccess: (view, id) => {
      client.setQueryData<CollectionDetail>(
        collectionQueryKeys.detail(id),
        (detail) => (detail ? mergeViewIntoDetail(detail, view) : detail),
      );
    },
  });
}
