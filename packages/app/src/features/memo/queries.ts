import { useRef, useState } from 'react';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { createMemo, createMemoReply, fetchMemoThread, replaceMemoTags } from './api';
import type { Memo, MemoThreadData, PendingMemoTags } from './types';
import type { RiverPageData } from '../river/types';
import { AppApiError } from '../chat/api';

export const memoQueryKeys = { thread: (rootId: number) => ['memo', 'thread', rootId] as const };
export function useMemoThreadQuery(rootId: number, enabled = true) {
  return useQuery({ queryKey: memoQueryKeys.thread(rootId), queryFn: ({ signal }) => fetchMemoThread(rootId, signal), enabled, retry: false });
}
/** Page-lifetime write state: independent retry records, never a persistent queue. */
export function useMemoWrites() {
  const client = useQueryClient();
  const pendingRef = useRef<Record<number, PendingMemoTags>>({});
  const [pending, setPending] = useState<Record<number, PendingMemoTags>>({});
  const busyRef = useRef(new Set<number>());
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const setRetry = (id: number, value: PendingMemoTags | null) => {
    const next = { ...pendingRef.current };
    if (value) next[id] = value; else delete next[id];
    pendingRef.current = next;
    setPending(next);
  };
  const publish = async (memo: Memo, rootId: number) => {
    await client.cancelQueries({ queryKey: memoQueryKeys.thread(rootId), exact: true });
    client.setQueryData<MemoThreadData>(memoQueryKeys.thread(rootId), (old) => {
      if (!old) return old;
      if (memo.parent_id === null) return { ...old, memo };
      const replies = [...old.replies.filter((reply) => reply.id !== memo.id), memo];
      return { ...old, replies };
    });
    const thread = client.getQueryData<MemoThreadData>(memoQueryKeys.thread(rootId));
    client.setQueriesData<InfiniteData<RiverPageData>>({ queryKey: ['river', 'pages'] }, (old) => old && ({ ...old,
      pages: old.pages.map((page) => ({ ...page, items: page.items.map((item) => item.source_type === 'memo' && item.target.memo_id === rootId
        ? { ...item, source_specific: { ...item.source_specific,
          ...(memo.parent_id === null ? { tags: memo.tags } : {}),
          ...(thread ? { reply_count: thread.replies.filter((reply) => reply.parent_id === rootId).length } : {}),
        } } : item) })),
    }));
    await client.invalidateQueries({ queryKey: memoQueryKeys.thread(rootId), exact: true });
  };
  const patchTags = async (memoId: number, tags: string[], rootId: number, keepRetryOnError: boolean) => {
    if (busyRef.current.has(memoId)) throw new AppApiError('此条标签正在保存，请稍后。');
    busyRef.current.add(memoId); setBusyIds([...busyRef.current]);
    try {
      const memo = await replaceMemoTags(memoId, tags);
      await publish(memo, rootId);
      setRetry(memoId, null);
    } catch (cause) {
      if (keepRetryOnError) setRetry(memoId, { memoId, tags: [...tags], rootId, error: cause instanceof Error ? cause.message : '标签保存失败' });
      throw cause;
    } finally { busyRef.current.delete(memoId); setBusyIds([...busyRef.current]); }
  };
  const save = async ({ content, tags, parentId, rootId, onCreated }: {
    content: string; tags: string[]; parentId?: number; rootId?: number; onCreated: (memo: Memo) => void;
  }) => {
    const memo = parentId === undefined ? await createMemo(content) : await createMemoReply(parentId, content);
    // Only a confirmed POST id reaches this point; clear that captured draft now.
    onCreated(memo);
    const root = rootId ?? memo.id;
    await publish(memo, root);
    if (parentId === undefined) {
      await client.cancelQueries({ queryKey: ['river', 'pages'] });
      await client.resetQueries({ queryKey: ['river', 'pages'] });
    }
    if (tags.length) {
      try { await patchTags(memo.id, tags, root, true); }
      catch { /* body is already saved: retry context owns this partial failure */ }
    }
    return memo;
  };
  const retryTags = async (memoId: number) => {
    const target = pendingRef.current[memoId];
    if (target) await patchTags(memoId, target.tags, target.rootId, true);
  };
  const editTags = (memoId: number, tags: string[], rootId: number) => patchTags(memoId, tags, rootId, false);
  return { save, pending, busyIds, retryTags, editTags };
}
export type MemoWrites = ReturnType<typeof useMemoWrites>;
