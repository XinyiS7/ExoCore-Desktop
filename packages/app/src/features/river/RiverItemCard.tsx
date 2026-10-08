import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MemoContent } from '../memo/MemoContent';
import { MemoThread } from '../memo/MemoThread';
import { MemoTagsDialog } from '../memo/MemoTagsDialog';
import { useMemoThreadQuery, type MemoWrites } from '../memo/queries';
import type { MemoReplyDrafts } from '../memo/replyDrafts';
import type { ReadingItem, RiverItem, RiverSource } from './types';
import { SOURCE_LABELS } from './types';

/** Decorative, aria-hidden source glyphs for the 42px timeline bead. */
const SOURCE_GLYPHS: Record<RiverSource, string> = {
  memo: '📝', heartbeat: '⚡', diary: '📖', task: '✅', chronicle: '📜',
};

export function RiverItemCard({ item, onRead, onOpenTask, onOpenLegacy, memoWrites, replyDrafts }: { item: RiverItem; onRead: (item: ReadingItem) => void; onOpenTask: (entryId: number) => void; onOpenLegacy: (item: Extract<RiverItem, { source_type: 'chronicle' }>) => void; memoWrites: MemoWrites; replyDrafts: MemoReplyDrafts }) {
  const [threadOpen, setThreadOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const memoRootId = item.source_type === 'memo' ? item.target.memo_id : 0;
  const memoQuery = useMemoThreadQuery(memoRootId, item.source_type === 'memo' && threadOpen);
  const memoContent = (item.source_type === 'memo' && threadOpen && memoQuery.data?.memo.content)
    ? memoQuery.data.memo.content
    : item.preview;
  let subtitle: string;
  switch (item.source_type) {
    case 'memo': subtitle = `${item.source_specific.author} · ${item.source_specific.reply_count} 条直接回复`; break;
    case 'task': subtitle = `${item.source_specific.event_kind === 'created' ? '任务创建' : '任务完成'} · ${item.source_specific.title}`; break;
    case 'diary': subtitle = `Agent ${item.target.preset_id} · Canonical day ${item.target.day}`; break;
    case 'heartbeat': subtitle = `Agent ${item.preset_id} · 最终巡检总结`; break;
    case 'chronicle': subtitle = `${item.source_specific.kind === 'milestone' ? '里程碑' : '时刻'} · Agent ${item.preset_id}`; break;
  }
  const tags = item.source_type === 'memo' ? item.source_specific.tags : item.source_type === 'chronicle' ? item.source_specific.keywords : [];
  const time = item.source_type === 'diary' ? `${item.target.day} · 03:00 排序锚点`
    : item.source_type === 'chronicle' ? item.source_specific.event_time
      : new Date(item.occurred_at).toLocaleString();
  const canRead = item.source_type === 'heartbeat' || item.source_type === 'diary' && item.capabilities.includes('read_full');
  return <article className={`river-item river-item-${item.source_type}`} data-river-identity={`${item.source_type}:${item.source_id}`}>
    <span className="river-item-bead" aria-hidden="true">{SOURCE_GLYPHS[item.source_type]}</span>
    <div className="river-item-card">
      <header className="river-item-head">
        <span className="river-source-label">{SOURCE_LABELS[item.source_type]}</span>
        <time dateTime={item.occurred_at}>{time}{item.time_precision === 'day' ? ' · 日期精度' : ''}</time>
      </header>
      <h2>{subtitle}</h2>
      <div className="river-item-body">
        {item.source_type === 'memo' ? <MemoContent content={memoContent} /> : <p className="river-preview">{item.preview}</p>}
        {tags.length > 0 && <ul className="river-tags" aria-label="标签">{tags.map((tag) => <li key={tag}>#{tag}</li>)}</ul>}
        {item.source_type === 'diary' && <p className="river-precision-note">03:00 仅用于排序，不是真实写作或归档时刻。</p>}
      </div>
      <footer className="river-item-actions">
        {item.source_type === 'task' && <button type="button" onClick={() => onOpenTask(item.target.entry_id)}>查看任务详情</button>}
        {item.source_type === 'chronicle' && item.capabilities.includes('read') && <button type="button" onClick={() => onOpenLegacy(item)}>查看纪事详情</button>}
        {canRead && (item.source_type === 'diary' || item.source_type === 'heartbeat') && <button type="button" className="river-item-btn--primary" onClick={() => onRead(item)}>阅读全文</button>}
        {item.source_type === 'heartbeat' && item.preset_id !== null && <Link className="app-btn app-btn--subtle" to={`/agents/${item.preset_id}/heartbeat?session=${encodeURIComponent(item.target.session_uuid)}`}>查看心跳账本</Link>}
        {item.source_type === 'memo' && item.capabilities.includes('read_thread') && <button type="button" className="river-item-btn--primary" aria-expanded={threadOpen} aria-controls={`memo-thread-${item.target.memo_id}`} onClick={() => setThreadOpen((open) => !open)}>{threadOpen ? '收起讨论' : '展开讨论'}</button>}
        {item.source_type === 'memo' && item.capabilities.includes('edit_tags') && <button type="button" aria-label={`管理 Memo #${item.target.memo_id} 标签`} disabled={memoWrites.busyIds.includes(item.target.memo_id)} onClick={() => setTagsOpen(true)}>标签</button>}
      </footer>
      {item.source_type === 'memo' && item.capabilities.includes('read_thread')
        && <MemoThread rootId={item.target.memo_id} open={threadOpen} writes={memoWrites} replyDrafts={replyDrafts} canReply={item.capabilities.includes('reply')} canEditTags={item.capabilities.includes('edit_tags')} />}
      {item.source_type === 'memo' && tagsOpen && <MemoTagsDialog memoId={item.target.memo_id} rootId={item.target.memo_id} tags={item.source_specific.tags} writes={memoWrites} onClose={() => setTagsOpen(false)} />}
    </div>
  </article>;
}
