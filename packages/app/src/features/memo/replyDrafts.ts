import { useRef, useState } from 'react';
import { AppApiError } from '../chat/api';
import type { MemoWrites } from './queries';
import type { Memo } from './types';
import { extractMemoTags } from './tags';

export interface MemoComposerControl {
  content: string;
  saving: boolean;
  error: string | null;
  changeContent: (content: string) => void;
  submit: () => Promise<void>;
}
export function memoWriteError(cause: unknown) {
  return cause instanceof AppApiError && cause.ambiguousWrite
    ? '保存结果不确定，请先刷新核对，再决定是否重新提交，避免重复记录。'
    : `记录未保存：${cause instanceof Error ? cause.message : '请求失败'}。草稿已保留。`;
}
type ReplyParent = Pick<Memo, 'id' | 'author'>;
interface ReplyDraft {
  content: string;
  saving: boolean;
  error: string | null;
  parent: ReplyParent | null;
}
const emptyDraft: ReplyDraft = { content: '', saving: false, error: null, parent: null };

/** River-page ownership, not card ownership: traversal/filter rebuilds may unmount cards.
 * Only interacted threads have records. No storage, queued POSTs or cross-page persistence. */
export function useMemoReplyDrafts(writes: MemoWrites) {
  const current = useRef<Record<number, ReplyDraft>>({});
  const [drafts, setDrafts] = useState<Record<number, ReplyDraft>>({});
  const get = (rootId: number) => drafts[rootId] ?? emptyDraft;
  const update = (rootId: number, patch: Partial<ReplyDraft>) => {
    const next = { ...current.current, [rootId]: { ...(current.current[rootId] ?? emptyDraft), ...patch } };
    current.current = next;
    setDrafts(next);
  };
  const selectParent = (rootId: number, parent: ReplyParent) => {
    if (!current.current[rootId]?.saving) update(rootId, { parent: { id: parent.id, author: parent.author } });
  };
  const control = (rootId: number, defaultParent: ReplyParent): MemoComposerControl => ({
    ...get(rootId),
    changeContent: (content) => {
      if (!current.current[rootId]?.saving) update(rootId, { content });
    },
    submit: async () => {
      const draft = current.current[rootId] ?? emptyDraft;
      const extracted = extractMemoTags(draft.content);
      if (draft.saving || !draft.content.trim() || extracted.error) return;
      const parent = draft.parent ?? defaultParent;
      // Synchronous page-owned lock survives every remount of this reply composer.
      update(rootId, { saving: true, error: null, parent: { id: parent.id, author: parent.author } });
      try {
        await writes.save({ content: draft.content, tags: extracted.tags, parentId: parent.id, rootId,
          onCreated: () => update(rootId, { content: '' }),
        });
      } catch (cause) { update(rootId, { error: memoWriteError(cause) }); }
      finally { update(rootId, { saving: false }); }
    },
  });
  return { get, selectParent, control };
}
export type MemoReplyDrafts = ReturnType<typeof useMemoReplyDrafts>;
