import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries';
import { formatTimeOfDay } from '../time';
import type { ConversationTimerView } from '../types';
import { formatCountdown } from './timerContext';
import { HourglassSvg, type TimerVisualState } from './TimerHourglass';
import './inlineTags.css';

export interface FloatingTimerBoardProps {
  conversationId: number;
  timers: readonly ConversationTimerView[];
}

interface ParsedTimer {
  timer: ConversationTimerView;
  fireAtMs: number;
  createdAtMs: number;
}

interface TimerDisplayItem extends ParsedTimer {
  remainingMs: number;
  state: TimerVisualState;
  ratio: number;
  displaySeconds: number;
}

const OVERDUE_REFRESH_MS = 3000;

function computeTimerDisplay(item: ParsedTimer, now: number): TimerDisplayItem {
  const remainingMs = Math.max(0, item.fireAtMs - now);
  const state: TimerVisualState = remainingMs <= 0 ? 'done' : 'running';
  const displaySeconds = Math.ceil(remainingMs / 1000);
  const totalMs =
    Number.isFinite(item.createdAtMs) && item.fireAtMs > item.createdAtMs
      ? item.fireAtMs - item.createdAtMs
      : 0;
  const ratio =
    remainingMs <= 0 ? 0 : totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0.5;
  return { ...item, remainingMs, state, ratio, displaySeconds };
}

/**
 * Floating hourglass widget anchored directly above the composer (#130).
 * Shows only the hourglass and a compact countdown by default; clicking opens
 * a lightweight popover with the timer title(s).
 */
export function FloatingTimerBoard({ conversationId, timers }: FloatingTimerBoardProps) {
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLElement>(null);
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const parsedTimers = useMemo<ParsedTimer[]>(() => {
    const out: ParsedTimer[] = [];
    for (const timer of timers) {
      const fireAtMs = Date.parse(timer.fireAt);
      if (!Number.isFinite(fireAtMs)) continue;
      out.push({ timer, fireAtMs, createdAtMs: Date.parse(timer.createdAt) });
    }
    out.sort((a, b) => a.fireAtMs - b.fireAtMs || a.timer.id - b.timer.id);
    return out;
  }, [timers]);

  useEffect(() => {
    setOpen(false);
  }, [conversationId]);

  useEffect(() => {
    if (parsedTimers.length === 0) {
      setOpen(false);
      return undefined;
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [parsedTimers.length]);

  const items = useMemo(
    () => parsedTimers.map((item) => computeTimerDisplay(item, now)),
    [parsedTimers, now],
  );

  const hasOverdue = items.some((item) => item.remainingMs <= 0);
  useEffect(() => {
    if (!hasOverdue) return undefined;
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
    }, OVERDUE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [hasOverdue, conversationId, queryClient]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  const lead = items[0];
  const extraCount = items.length - 1;
  const leadText = formatCountdown(lead.displaySeconds);
  const ariaLabel =
    extraCount > 0
      ? `进行中的计时器共 ${items.length} 个，最近 ${leadText}，点击查看详情`
      : `计时器倒计时 ${leadText}，点击查看标题`;

  return (
    <aside className="app-itag-tfloat" aria-label="计时器浮窗" ref={rootRef}>
      <div className="app-itag-tfloat-anchor">
        {open ? (
          <div
            id={popoverId}
            className="app-itag-tfloat-popover"
            role="region"
            aria-label="计时器详情"
          >
            {items.map((item) => {
              const fireTime = formatTimeOfDay(item.timer.fireAt);
              return (
                <div
                  key={item.timer.id}
                  className={`app-itag-tfloat-row app-itag-tfloat-row--${item.state}`}
                  data-itag="timer-float-item"
                >
                  <HourglassSvg state={item.state} ratio={item.ratio} />
                  <div className="app-itag-tfloat-meta">
                    <span className="app-itag-tfloat-title">{item.timer.title}</span>
                    {fireTime ? (
                      <span className="app-itag-tfloat-sub">
                        {item.remainingMs <= 0 ? '即将触发' : `${fireTime} 到点`}
                      </span>
                    ) : null}
                  </div>
                  {items.length > 1 ? (
                    <span className="app-itag-tfloat-row-time">
                      {formatCountdown(item.displaySeconds)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          className={`app-itag-tfloat-pill app-itag-tfloat-pill--${lead.state}${open ? ' is-open' : ''}`}
          data-itag="timer-float"
          data-timer-state={lead.state}
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-label={ariaLabel}
          onClick={() => setOpen((prev) => !prev)}
        >
          <HourglassSvg state={lead.state} ratio={lead.ratio} />
          <span className="app-itag-tfloat-time">{leadText}</span>
          {extraCount > 0 ? <span className="app-itag-tfloat-count">+{extraCount}</span> : null}
        </button>
      </div>
    </aside>
  );
}
