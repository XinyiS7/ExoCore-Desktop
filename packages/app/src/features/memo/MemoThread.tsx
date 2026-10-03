import { useState } from 'react';
import { useMemoThreadQuery, type MemoWrites } from './queries';
import type { Memo } from './types';
import { MemoComposer } from './MemoComposer';
import { MemoContent } from './MemoContent';
import { MemoTagsDialog } from './MemoTagsDialog';
import type { MemoReplyDrafts } from './replyDrafts';

function orderedReplies(rootId: number, replies: Memo[]) {
  const children = new Map<number, Memo[]>();
  [...replies].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id).forEach((memo) => {
    const siblings = children.get(memo.parent_id!) ?? [];
    siblings.push(memo); children.set(memo.parent_id!, siblings);
  });
  const stack = (children.get(rootId) ?? []).map((memo) => ({ memo, depth: 1 })).reverse();
  const rows: { memo: Memo; depth: number }[] = [];
  while (stack.length) {
    const row = stack.pop()!;
    rows.push(row);
    stack.push(...(children.get(row.memo.id) ?? []).map((memo) => ({ memo, depth: row.depth + 1 })).reverse());
  }
  return rows;
}
export function MemoThread({ rootId, open, writes, replyDrafts, canReply, canEditTags }: {
  rootId: number; open: boolean; writes: MemoWrites; replyDrafts: MemoReplyDrafts; canReply: boolean; canEditTags: boolean;
}) {
  const query = useMemoThreadQuery(rootId, open);
  const draft = replyDrafts.get(rootId);
  const sending = draft.saving;
  const [editingTags, setEditingTags] = useState<Memo | null>(null);
  const data = query.data;
  const targets = data ? new Map([data.memo, ...data.replies].map((memo) => [memo.id, memo])) : new Map<number, Memo>();
  // Keep the actual selected identity even if a later read no longer contains it.
  const target = draft.parent ? targets.get(draft.parent.id) ?? draft.parent : data?.memo;
  return <section id={`memo-thread-${rootId}`} className="memo-thread" aria-label={`Memo #${rootId} 讨论`} hidden={!open}>
    {query.isPending && <p role="status">正在加载讨论…</p>}
    {query.isError && <div role="alert"><p>讨论读取失败：{query.error.message}</p><button type="button" onClick={() => { void query.refetch(); }}>重试读取讨论</button></div>}
    {query.isSuccess && data && <>
      <h3>Memo 全文</h3><MemoContent content={data.memo.content} />
      {canReply && <button type="button" disabled={sending} onClick={() => replyDrafts.selectParent(rootId, data.memo)} aria-label={`回复 Memo #${rootId}`}>回复根 Memo</button>}
      {data.replies.length === 0 && <p>暂无回复。</p>}
      {orderedReplies(rootId, data.replies).map(({ memo, depth }) => {
        const parent = targets.get(memo.parent_id!)!;
        return <article key={memo.id} className="memo-reply" data-memo-id={memo.id} data-parent-id={memo.parent_id} data-depth={depth}>
          <header><strong>{memo.author} · #{memo.id}</strong><span className="memo-target">@{parent.author} · Memo #{parent.id}</span><time dateTime={memo.created_at}>{new Date(memo.created_at).toLocaleString()}</time></header>
          <MemoContent content={memo.content} />
          {memo.tags.length > 0 && <ul className="river-tags" aria-label="回复标签">{memo.tags.map((tag) => <li key={tag}>#{tag}</li>)}</ul>}
          {canReply && <button type="button" aria-label={`回复 Memo #${memo.id}`} disabled={sending} onClick={() => replyDrafts.selectParent(rootId, memo)}>回复</button>}
          {canEditTags && <button type="button" aria-label={`管理 Memo #${memo.id} 标签`} disabled={writes.busyIds.includes(memo.id)} onClick={() => setEditingTags(memo)}>标签</button>}
        </article>;
      })}
      {canReply && target && <div className="memo-reply-composer"><p>回复目标：@{target.author} · Memo #{target.id}</p>
        {draft.parent && !targets.has(draft.parent.id) && <p>该目标已不在当前读取结果中，请核对或选择新的回复目标。</p>}
        <MemoComposer writes={writes} parentId={target.id} rootId={rootId} replyControl={replyDrafts.control(rootId, target)} className="memo-composer--reply" />
      </div>}
    </>}
    {editingTags && <MemoTagsDialog memoId={editingTags.id} rootId={rootId} tags={editingTags.tags} writes={writes} onClose={() => setEditingTags(null)} />}
  </section>;
}
