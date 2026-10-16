import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { CollectionApiError } from './api';
import { BringTargetDialog } from './BringTargetDialog';
import { cardTitle, hasActiveFilters, KIND_LABELS, parseWallFilters, wallFiltersToParams } from './filters';
import { PolaroidCard } from './PolaroidCard';
import { collectionQueryKeys, useCollectionTagsQuery, useCollectionWallQuery } from './queries';
import { COLLECTION_KINDS, type CollectionFilters } from './types';
import './collection.css';

const SEARCH_DEBOUNCE_MS = 300;
/** Narrow flow prefetches the next page from the third-to-last card (Plan §4.2). */
const PREFETCH_FROM_END = 3;
/** #61 D9: one bring-back carries at most five items. */
const BRING_LIMIT = 5;

/** P4 Library: the Collection wall; item detail renders on top through the nested outlet. */
export function CollectionWallPage() {
  const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseWallFilters(searchParams);
  const query = useCollectionWallQuery(filters);
  const tagsQuery = useCollectionTagsQuery();
  const [draftQ, setDraftQ] = useState(filters.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState(false);
  const [current, setCurrent] = useState(0);
  const flowRef = useRef<HTMLDivElement>(null);
  const pageRequest = useRef(false);
  // #61 multi-select exists only to bring items back to chat, in pick order.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<{ id: number; title: string }[]>([]);
  const [limitHit, setLimitHit] = useState(false);
  const [bringing, setBringing] = useState(false);
  const toggle = (id: number, title: string) => {
    setPicked((prev) => {
      if (prev.some((entry) => entry.id === id)) {
        setLimitHit(false);
        return prev.filter((entry) => entry.id !== id);
      }
      if (prev.length >= BRING_LIMIT) {
        setLimitHit(true);
        return prev;
      }
      return [...prev, { id, title }];
    });
  };
  const exitSelecting = () => {
    setSelecting(false);
    setPicked([]);
    setLimitHit(false);
  };

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const error = query.error instanceof CollectionApiError ? query.error : null;
  const cursorError = error?.code === 'malformed_cursor';
  const filtered = hasActiveFilters(filters);

  const applyFilters = (next: CollectionFilters) => {
    setRefreshNotice(false);
    setCurrent(0);
    flowRef.current?.scrollTo?.({ left: 0 });
    setSearchParams(wallFiltersToParams(next), { replace: true });
  };
  const patchFilters = (patch: Partial<CollectionFilters>) => applyFilters({ ...filters, ...patch });

  // Debounced keyword: the URL (and so the traversal) follows the input after a pause.
  const committedQ = filters.q ?? '';
  useEffect(() => {
    if (draftQ.trim() === committedQ) return undefined;
    const timer = window.setTimeout(() => patchFilters({ q: draftQ.trim() || undefined }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // patchFilters closes over the current filters; re-arming on q changes only is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQ, committedQ]);

  const restart = () => {
    void client.resetQueries({ queryKey: collectionQueryKeys.pages(filters), exact: true });
  };

  // A rejected cursor restarts the traversal from page one and says so.
  useEffect(() => {
    if (!cursorError || !query.isFetchNextPageError) return;
    setRefreshNotice(true);
    setCurrent(0);
    flowRef.current?.scrollTo?.({ left: 0 });
    void client.resetQueries({ queryKey: collectionQueryKeys.pages(filters), exact: true });
    // filters are encoded in the active query key; this fires once per rejected cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorError, query.isFetchNextPageError, client]);

  const loadMore = async () => {
    if (pageRequest.current || query.isFetching || !query.hasNextPage) return;
    pageRequest.current = true;
    try { await query.fetchNextPage({ cancelRefetch: false }); }
    finally { pageRequest.current = false; }
  };

  const goTo = (index: number) => {
    const flow = flowRef.current;
    const target = Math.max(0, Math.min(index, items.length - 1));
    setCurrent(target);
    flow?.scrollTo?.({ left: target * flow.clientWidth, behavior: 'smooth' });
    if (target >= items.length - PREFETCH_FROM_END && !query.isFetchNextPageError) void loadMore();
  };
  const onFlowScroll = () => {
    const flow = flowRef.current;
    if (!flow || flow.clientWidth === 0) return;
    const index = Math.round(flow.scrollLeft / flow.clientWidth);
    if (index !== current) {
      setCurrent(index);
      if (index >= items.length - PREFETCH_FROM_END && !query.isFetchNextPageError) void loadMore();
    }
  };
  const onFlowKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
  };

  const linkOutsideText = filters.link && filters.kind !== undefined && filters.kind !== 'text';

  return (
    <main className="library-page">
      <header className="library-header">
        <div className="library-header-row">
          <h1>Library</h1>
          <span className="library-subtitle">藏品 · 留下来回味的东西</span>
          <label className="library-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="关键词匹配"
              aria-label="关键词匹配"
              value={draftQ}
              onChange={(event) => setDraftQ(event.target.value)}
            />
          </label>
          {!selecting && items.length > 0 && (
            <button type="button" className="app-btn library-select-toggle" onClick={() => setSelecting(true)}>
              多选
            </button>
          )}
        </div>
        {selecting && (
          <div className="library-select-bar" role="group" aria-label="多选带回">
            <button type="button" className="app-btn app-btn-ghost" aria-label="退出选择" onClick={exitSelecting}>×</button>
            <strong>已选 {picked.length} / {BRING_LIMIT}</strong>
            <span className="library-note">多选只用于带回聊天</span>
            {limitHit && <span role="status" className="library-note">每次最多带回 5 件</span>}
            <span className="library-select-spacer" />
            <span className="library-note">按选择顺序带回</span>
            <button type="button" className="app-btn app-btn-ghost" disabled={picked.length === 0} onClick={() => { setPicked([]); setLimitHit(false); }}>
              清空
            </button>
            <button type="button" className="app-btn app-btn-primary" disabled={picked.length === 0} onClick={() => setBringing(true)}>
              带回聊天（{picked.length}）
            </button>
          </div>
        )}
        <div className="library-filter-row">
          <div role="tablist" aria-label="类型" className="library-kind-tabs">
            <button type="button" role="tab" aria-selected={!filters.kind} onClick={() => patchFilters({ kind: undefined })}>全部</button>
            {COLLECTION_KINDS.map((kind) => (
              <button key={kind} type="button" role="tab" aria-selected={filters.kind === kind} onClick={() => patchFilters({ kind })}>
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="library-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="library-more-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            筛选
          </button>
          <div id="library-more-filters" className={`library-more-filters${filtersOpen ? ' is-open' : ''}`}>
            <button type="button" className="library-chip" aria-pressed={filters.recent === true} onClick={() => patchFilters({ recent: filters.recent ? undefined : true })}>
              最近 30 天
            </button>
            <label className="library-chip library-month">
              <span>月份</span>
              <input
                type="month"
                aria-label="月份"
                value={filters.month ?? ''}
                onChange={(event) => patchFilters({ month: event.target.value || undefined })}
              />
            </label>
            <button type="button" className="library-chip" aria-pressed={filters.link === true} onClick={() => patchFilters({ link: filters.link ? undefined : true })}>
              含链接
            </button>
            {tagsQuery.data && tagsQuery.data.length > 0 && (
              <div className="library-tags" role="group" aria-label="Tag">
                <span aria-hidden="true">Tag</span>
                {tagsQuery.data.map((tag) => (
                  <button
                    key={tag.normalized_name}
                    type="button"
                    className="library-chip library-chip--tag"
                    aria-pressed={filters.tag === tag.normalized_name}
                    onClick={() => patchFilters({ tag: filters.tag === tag.normalized_name ? undefined : tag.normalized_name })}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}
            {tagsQuery.isError && <span className="library-note">Tag 列表加载失败</span>}
          </div>
        </div>
        {filters.recent && filters.month && (
          <p className="library-note">最近 30 天 ∩ {filters.month}：两个时间筛选同时生效时取交集</p>
        )}
        {linkOutsideText && <p className="library-note">仅文字藏品正文可能含链接</p>}
      </header>

      <section className="library-body" aria-label="藏品">
        <div className="library-live" role="status" aria-live="polite">
          {query.isPending && '正在加载藏品…'}
          {refreshNotice && '列表已刷新'}
        </div>

        {query.isPending && (
          <div className="library-wall" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="polaroid polaroid--skeleton" />)}
          </div>
        )}

        {query.isError && !query.data && (
          <div role="alert" className="library-state">
            <p>藏品加载失败：{query.error.message}</p>
            <button type="button" className="app-btn" onClick={restart}>重试</button>
          </div>
        )}

        {query.isSuccess && items.length === 0 && (
          filtered ? (
            <div className="library-state">
              <p>没有匹配的藏品</p>
              <button type="button" className="app-btn" onClick={() => { setDraftQ(''); applyFilters({}); }}>清除筛选</button>
            </div>
          ) : (
            <div className="library-state">
              <p>还没有藏品</p>
              <p className="library-note">可以从聊天消息上的收藏按钮添加。</p>
            </div>
          )
        )}

        {items.length > 0 && (
          <>
            <div
              ref={flowRef}
              className="library-wall"
              tabIndex={0}
              aria-label="藏品墙"
              onScroll={onFlowScroll}
              onKeyDown={onFlowKey}
            >
              {items.map((item) => (
                <PolaroidCard
                  key={item.id}
                  item={item}
                  to={{ pathname: `/library/items/${item.id}`, search: searchParams.toString() ? `?${searchParams.toString()}` : '' }}
                  selection={
                    selecting
                      ? {
                          order: (() => {
                            const index = picked.findIndex((entry) => entry.id === item.id);
                            return index === -1 ? null : index + 1;
                          })(),
                          onToggle: () => toggle(item.id, cardTitle(item)),
                        }
                      : undefined
                  }
                />
              ))}
            </div>
            <div className="library-stepper">
              <button type="button" aria-label="上一张" disabled={current <= 0} onClick={() => goTo(current - 1)}>‹</button>
              <span>
                {Math.min(current + 1, items.length)} / {items.length}{query.hasNextPage ? '+' : ''}
                {!query.hasNextPage && current >= items.length - 1 ? ' · 已到底' : ''}
              </span>
              <button type="button" aria-label="下一张" disabled={current >= items.length - 1} onClick={() => goTo(current + 1)}>›</button>
            </div>
          </>
        )}

        {query.isFetchNextPageError && !cursorError && (
          <div role="alert" className="library-state library-state--inline">
            <p>加载失败，已保留已加载的藏品。</p>
            <button type="button" className="app-btn" disabled={query.isFetching} onClick={() => { void loadMore(); }}>重试</button>
          </div>
        )}
        {query.hasNextPage && !query.isFetchNextPageError && (
          <button type="button" className="app-btn library-more" disabled={query.isFetching} onClick={() => { void loadMore(); }}>
            {query.isFetchingNextPage ? '正在加载…' : '加载更多'}
          </button>
        )}
        {query.isSuccess && !query.hasNextPage && items.length > 0 && <p className="library-end">已到底</p>}
      </section>
      {bringing && (
        <BringTargetDialog
          itemIds={picked.map((entry) => entry.id)}
          titles={picked.map((entry) => entry.title)}
          onCancel={() => setBringing(false)}
        />
      )}
      <Outlet />
    </main>
  );
}
