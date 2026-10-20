import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { MessageView } from '../types';
import { headExcerpt, matchExcerpt, type MatchExcerpt } from './excerpt';

export interface MinimapEntry {
  id: number;
  head: string;
  hit: MatchExcerpt | null;
}

const FLASH_CLASS = 'app-msg--flash';
const FLASH_MS = 1600;

function messageElement(container: HTMLElement | null, id: number): HTMLElement | null {
  return container?.querySelector<HTMLElement>(`[data-message-id="${id}"]`) ?? null;
}

/**
 * State for the user-message minimap (#72 U5): front-end search over the
 * already-loaded user rows, the row currently in view, and jump-to-message.
 */
export function useMessageMinimap(
  messages: MessageView[],
  scrollRef: RefObject<HTMLDivElement | null>,
  open: boolean,
) {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const flashed = useRef<HTMLElement | null>(null);

  const userRows = useMemo(
    () => messages.filter((m) => m.role === 'user' && m.content?.trim()),
    [messages],
  );

  const entries = useMemo<MinimapEntry[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return userRows.map((m) => ({ id: m.id, head: headExcerpt(m.content), hit: null }));
    return userRows.flatMap((m) => {
      const hit = matchExcerpt(m.content, trimmed);
      return hit ? [{ id: m.id, head: headExcerpt(m.content), hit }] : [];
    });
  }, [userRows, query]);

  // Track the user row nearest the top third of the viewport while open.
  useEffect(() => {
    const container = scrollRef.current;
    if (!open || !container) return;
    const update = () => {
      const probe = container.getBoundingClientRect().top + container.clientHeight / 3;
      let current: number | null = null;
      for (const row of userRows) {
        const el = messageElement(container, row.id);
        if (el && el.getBoundingClientRect().top <= probe) current = row.id;
      }
      setActiveId(current ?? userRows[0]?.id ?? null);
    };
    update();
    container.addEventListener('scroll', update, { passive: true });
    return () => container.removeEventListener('scroll', update);
  }, [open, scrollRef, userRows]);

  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const jumpTo = useCallback(
    (id: number) => {
      const el = messageElement(scrollRef.current, id);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashed.current?.classList.remove(FLASH_CLASS);
      // Restart the animation when the same row is chosen twice.
      void el.offsetWidth;
      el.classList.add(FLASH_CLASS);
      flashed.current = el;
      flashTimer.current = window.setTimeout(() => el.classList.remove(FLASH_CLASS), FLASH_MS);
      setActiveId(id);
    },
    [scrollRef],
  );

  return { query, setQuery, entries, loadedCount: userRows.length, activeId, jumpTo };
}
