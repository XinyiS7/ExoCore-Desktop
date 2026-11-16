import { createContext } from 'react';
import { parseInlineTags } from './parse';

export type TimerTerminalResolution = 'fired' | 'cancelled' | null;

export interface TimerTimelineContextValue {
  createdAt: string;
  resolveLaterOutcome: (title: string | null) => TimerTerminalResolution;
}

export const DEFAULT_TIMER_TITLE = '计时器';

export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function normalizeTimerTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : DEFAULT_TIMER_TITLE;
}

/**
 * Checks messages emitted AFTER the `<timer>` message for matching
 * `<timer_fired>` or `<timer cancel="...">` tags so historical timers render
 * immediately settled instead of spinning at `00:00`.
 */
export function findLaterTimerResolution(
  laterMessages: readonly { content: string }[],
  title: string | null,
): TimerTerminalResolution {
  const targetTitle = normalizeTimerTitle(title);
  for (const msg of laterMessages) {
    if (!msg.content.includes('<timer')) continue;
    for (const seg of parseInlineTags(msg.content)) {
      if (seg.type !== 'tag') continue;
      if (seg.tag.kind === 'timer_fired' && normalizeTimerTitle(seg.tag.title) === targetTitle) {
        return 'fired';
      }
      if (seg.tag.kind === 'timer_cancel' && normalizeTimerTitle(seg.tag.title) === targetTitle) {
        return 'cancelled';
      }
    }
  }
  return null;
}

export const TimerTimelineContext = createContext<TimerTimelineContextValue | null>(null);
