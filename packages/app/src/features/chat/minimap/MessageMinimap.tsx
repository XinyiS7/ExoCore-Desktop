/**
 * Floating user-message minimap with search (#72 U5), in the style of
 * Obsidian's Floating TOC. Front-end only: it lists and searches the user
 * rows already loaded into the timeline and can load older pages.
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { MessageView } from '../types';
import { useMessageMinimap, type MinimapEntry } from './useMessageMinimap';

export interface MessageMinimapProps {
  messages: MessageView[];
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The header toggle; clicks on it are not treated as outside clicks. */
  toggleRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  hasOlder: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

function EntryText({ entry }: { entry: MinimapEntry }) {
  if (!entry.hit) return <>{entry.head}</>;
  const { before, match, after, leadingCut, trailingCut } = entry.hit;
  return (
    <>
      {leadingCut ? '…' : ''}
      {before}
      <mark className="app-minimap-hit">{match}</mark>
      {after}
      {trailingCut ? '…' : ''}
    </>
  );
}

export function MessageMinimap({
  messages,
  scrollRef,
  toggleRef,
  open,
  onClose,
  hasOlder,
  loadingMore,
  onLoadMore,
}: MessageMinimapProps) {
  const { query, setQuery, entries, loadedCount, activeId, jumpTo } = useMessageMinimap(
    messages,
    scrollRef,
    open,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onClose, toggleRef]);

  if (!open) return null;

  const searching = query.trim() !== '';
  const loadOlderButton = hasOlder ? (
    <button
      type="button"
      className="app-btn app-btn-ghost app-btn-sm app-minimap-older"
      disabled={loadingMore}
      onClick={onLoadMore}
    >
      {loadingMore ? '加载中…' : '加载更早消息'}
    </button>
  ) : null;

  return (
    <div
      ref={panelRef}
      className="app-minimap"
      role="dialog"
      aria-label="用户消息导航"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
          toggleRef.current?.focus();
        }
      }}
    >
      <input
        ref={inputRef}
        type="search"
        className="app-minimap-search"
        placeholder="搜索我的消息"
        aria-label="搜索用户消息"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {searching && entries.length === 0 ? (
        <div className="app-minimap-empty">
          <p>已加载的 {loadedCount} 条中未找到</p>
          {loadOlderButton}
        </div>
      ) : (
        <ol className="app-minimap-list">
          {loadOlderButton ? <li className="app-minimap-older-row">{loadOlderButton}</li> : null}
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`app-minimap-item${entry.id === activeId ? ' app-minimap-item--active' : ''}`}
                aria-current={entry.id === activeId ? 'location' : undefined}
                onClick={() => jumpTo(entry.id)}
              >
                <EntryText entry={entry} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="app-minimap-foot">仅搜索已加载的 {loadedCount} 条</p>
    </div>
  );
}
