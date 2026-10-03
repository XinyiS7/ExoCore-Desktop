import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RiverApiError } from './api';
import { LegacyEventDialog } from './LegacyEventDialog';
import { riverQueryKeys, useRiverQuery } from './queries';
import { OpenTasksShelf } from './OpenTasksShelf';
import { RiverItemCard } from './RiverItemCard';
import { SourceReadingDrawer } from './SourceReadingDrawer';
import { RIVER_SOURCES, SOURCE_LABELS, type ReadingItem, type RiverSource } from './types';
import { MemoComposer } from '../memo/MemoComposer';
import { useMemoWrites } from '../memo/queries';
import { useMemoReplyDrafts } from '../memo/replyDrafts';
import { useTaskActions } from '../tasks/queries';
import { TaskFormDialog } from '../tasks/TaskFormDialog';
import { TaskDetailDialog } from '../tasks/TaskDetailDialog';
import { CalendarCompanion } from '../tasks/CalendarCompanion';
import type { TaskEntry } from '../tasks/types';
import './river.css';

/** One task modal stage across shelf form/detail/calendar; dialogs never nest. */
type DetailOrigin = 'shelf' | 'river' | 'calendar';
type TaskCloseTarget = null | { kind: 'calendar' } | { kind: 'detail'; entryId: number; origin: DetailOrigin };
type TaskStage =
  | { kind: 'calendar' }
  | { kind: 'create'; closeTo: TaskCloseTarget }
  | { kind: 'detail'; entryId: number; origin: DetailOrigin }
  | { kind: 'form'; entry: TaskEntry; closeTo: TaskCloseTarget };

/** River surface with Memo interactions. Router/navigation exposure remains CP4-owned. */
export function RiverPage({ presetId }: { presetId?: number }) {
  const [sources, setSources] = useState<readonly RiverSource[]>(RIVER_SOURCES);
  const [reading, setReading] = useState<ReadingItem | null>(null);
  const [taskStage, setTaskStage] = useState<TaskStage | null>(null);
  // One Legacy modal state, page-owned; never a second router/nav surface.
  const [legacyId, setLegacyId] = useState<number | null>(null);
  const client = useQueryClient();
  const memoWrites = useMemoWrites();
  const replyDrafts = useMemoReplyDrafts(memoWrites);
  // One page-lifetime action owner: switching dialogs must never reset the
  // per-entry busy locks into a second concurrent same-entry write.
  const taskActions = useTaskActions();
  const filters = { sources, presetId };
  const query = useRiverQuery(filters);
  const pageRequest = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRequest = useRef(false);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const error = query.error;
  const cursorError = error instanceof RiverApiError && error.code === 'malformed_cursor';
  const message = error instanceof RiverApiError && error.code === 'source_unavailable'
    ? `${error.sourceType ? SOURCE_LABELS[error.sourceType] : '来源'}暂不可用，无法取得完整 River 页面。`
    : error?.message ?? 'River 读取失败。';

  const refresh = async () => {
    if (refreshRequest.current) return;
    refreshRequest.current = true;
    setRefreshing(true);
    try {
      await client.cancelQueries({ queryKey: riverQueryKeys.pages(filters), exact: true });
      await client.resetQueries({ queryKey: riverQueryKeys.pages(filters), exact: true });
    } finally { refreshRequest.current = false; setRefreshing(false); }
  };
  const changeSources = (next: readonly RiverSource[]) => {
    if (refreshRequest.current) return;
    // Re-selecting a previously visited filter starts at page one, not cached cursors.
    client.removeQueries({ queryKey: riverQueryKeys.pages({ sources: next, presetId }), exact: true });
    setSources(next);
  };
  const loadMore = async () => {
    if (pageRequest.current || query.isFetching || !query.hasNextPage || cursorError) return;
    pageRequest.current = true;
    try { await query.fetchNextPage({ cancelRefetch: false }); }
    finally { pageRequest.current = false; }
  };
  // The dialog reports confirmed settlements only. An event_time move must
  // restart the traversal; an ordinary edit refreshes the loaded pages.
  const handleLegacySaved = (moved: boolean) => {
    if (moved) { void refresh(); return; }
    void client.invalidateQueries({ queryKey: riverQueryKeys.pages(filters) });
  };
  const handleLegacyDeleted = () => { setLegacyId(null); void refresh(); };

  return <main className="river-page">
    <div className="river-content-wrap">
      <header className="river-hero"><h1>River flows in you.</h1><p>生活流 · 随手记录与阅读</p></header>
      <section className="river-composer-slot" aria-label="Memo 记录区域"><MemoComposer writes={memoWrites} />
        {Object.values(memoWrites.pending).map((pending) => <div key={pending.memoId} role="alert" className="river-alert river-alert--danger">
          <p>记录已保存，标签未保存 · Memo #{pending.memoId}</p><p>{pending.error}</p>
          <p>待保存标签：{pending.tags.map((tag) => `#${tag}`).join(' ')}</p>
          <button type="button" aria-label={`仅重试 Memo #${pending.memoId} 标签`} disabled={memoWrites.busyIds.includes(pending.memoId)} onClick={() => { void memoWrites.retryTags(pending.memoId).catch(() => {}); }}>仅重试标签</button>
        </div>)}
      </section>
      <OpenTasksShelf
        onOpenCalendar={() => setTaskStage({ kind: 'calendar' })}
        onCreateTask={() => setTaskStage({ kind: 'create', closeTo: null })}
        onOpenTask={(entryId) => setTaskStage({ kind: 'detail', entryId, origin: 'shelf' })}
      />
      <section className="river-stream" aria-label="五源时间流">
        <div className="river-toolbar">
          <div className="river-source-filters" aria-label="来源筛选">
            <button type="button" disabled={refreshing} aria-pressed={sources.length === RIVER_SOURCES.length} onClick={() => { if (sources.length !== RIVER_SOURCES.length) changeSources(RIVER_SOURCES); }}>全部来源</button>
            {RIVER_SOURCES.map((source) => <button type="button" key={source} disabled={refreshing} aria-pressed={sources.includes(source)} onClick={() => {
              const next = sources.length === RIVER_SOURCES.length ? [source] : sources.includes(source) ? sources.filter((entry) => entry !== source) : [...sources, source];
              changeSources(next.length ? next : RIVER_SOURCES);
            }}>{SOURCE_LABELS[source]}</button>)}
          </div>
          <button type="button" className="river-refresh" disabled={refreshing} onClick={() => { void refresh(); }}>{refreshing ? '刷新中…' : '刷新时间流'}</button>
        </div>
        <p className="river-precision-note">按服务端顺序展示；已翻过区间的新记录需刷新，不保证历史快照。{presetId !== undefined && ` 当前 Agent ${presetId} 筛选仅影响 Diary、Heartbeat 与历史纪事；Memo 和 Task 仍为全局。`}</p>
        {query.isPending && <p role="status" className="river-status-note">正在加载 River…</p>}
        {query.isError && !query.data && <div role="alert" className="river-alert river-alert--danger"><p>{message}</p><button type="button" onClick={() => { void refresh(); }}>重新刷新时间流</button></div>}
        {query.isSuccess && items.length === 0 && <p className="river-empty-note">这段时间流暂无记录。</p>}
        <div className="river-items">{items.map((item) => <RiverItemCard key={`${item.source_type}:${item.source_id}`} item={item} onRead={setReading} onOpenTask={(entryId) => setTaskStage({ kind: 'detail', entryId, origin: 'river' })} onOpenLegacy={(chronicleItem) => setLegacyId(chronicleItem.target.id)} memoWrites={memoWrites} replyDrafts={replyDrafts} />)}</div>
        {query.isFetchNextPageError && <div role="alert" className="river-alert river-alert--warn"><p>{message} 已保留先前成功页面，本次遍历未完成。</p>
          {cursorError ? <button type="button" onClick={() => { void refresh(); }}>重新刷新时间流</button>
            : <button type="button" disabled={query.isFetching} onClick={() => { void loadMore(); }}>重试加载更早记录</button>}
        </div>}
        {query.hasNextPage && !query.isFetchNextPageError && <button type="button" className="river-load-more" disabled={query.isFetching || refreshing} onClick={() => { void loadMore(); }}>{query.isFetchingNextPage ? '正在加载更早记录…' : '加载更早记录'}</button>}
        {query.isSuccess && !query.hasNextPage && items.length > 0 && <p className="river-end-note">已到本次遍历末尾。</p>}
      </section>
    </div>
    {reading && <SourceReadingDrawer key={`${reading.source_type}:${reading.source_id}`} item={reading} onClose={() => setReading(null)} />}
    {legacyId !== null && <LegacyEventDialog
      key={`legacy-${legacyId}`}
      eventId={legacyId}
      onClose={() => setLegacyId(null)}
      onSaved={handleLegacySaved}
      onDeleted={handleLegacyDeleted}
      onSourceChanged={() => { void refresh(); }}
    />}
    {taskStage?.kind === 'calendar' && <CalendarCompanion
      onOpenTask={(entryId) => setTaskStage({ kind: 'detail', entryId, origin: 'calendar' })}
      onClose={() => setTaskStage(null)}
    />}
    {taskStage?.kind === 'detail' && <TaskDetailDialog
      key={taskStage.entryId}
      entryId={taskStage.entryId}
      actions={taskActions}
      onClose={() => setTaskStage(taskStage.origin === 'calendar' ? { kind: 'calendar' } : null)}
      onRequestEdit={(entry) => setTaskStage({ kind: 'form', entry, closeTo: { kind: 'detail', entryId: taskStage.entryId, origin: taskStage.origin } })}
    />}
    {taskStage?.kind === 'create' && <TaskFormDialog
      entry={null}
      actions={taskActions}
      onClose={() => setTaskStage(taskStage.closeTo)}
      onSaved={() => setTaskStage(taskStage.closeTo)}
    />}
    {taskStage?.kind === 'form' && <TaskFormDialog
      key={`edit-${taskStage.entry.id}`}
      entry={taskStage.entry}
      actions={taskActions}
      onClose={() => setTaskStage(taskStage.closeTo)}
      onSaved={() => setTaskStage(taskStage.closeTo)}
    />}
  </main>;
}
