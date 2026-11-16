import { useContext, useEffect, useId, useState } from 'react';
import type { InlineTag } from './parse';
import { formatCountdown, TimerTimelineContext } from './timerContext';

export type TimerVisualState = 'running' | 'done' | 'cancelled' | 'idle';

export function HourglassSvg({
  state,
  ratio,
}: {
  state: TimerVisualState;
  ratio: number;
}) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const topClipId = `${uid}-hg-top`;
  const botClipId = `${uid}-hg-bot`;

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const topHeight = clampedRatio * 6.8;
  const topY = 11.4 - topHeight;
  const botFill = state === 'cancelled' ? 0.35 : 1 - clampedRatio;
  const botY = 19.6 - botFill * 6.4;

  return (
    <svg
      className="app-itag-hourglass-svg"
      viewBox="0 0 20 24"
      width="16"
      height="19"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={topClipId}>
          <path d="M5.4 4.5 H14.6 L10.7 11.4 H9.3 Z" />
        </clipPath>
        <clipPath id={botClipId}>
          <path d="M9.3 12.6 H10.7 L14.6 19.5 H5.4 Z" />
        </clipPath>
      </defs>

      {/* Top & bottom caps */}
      <rect className="app-itag-hg-cap" x="3.5" y="2" width="13" height="2.1" rx="1" />
      <rect className="app-itag-hg-cap" x="3.5" y="19.9" width="13" height="2.1" rx="1" />

      {/* Upper chamber sand */}
      {topHeight > 0.05 ? (
        <g clipPath={`url(#${topClipId})`}>
          <rect className="app-itag-hg-sand" x="4" y={topY} width="12" height={topHeight + 0.4} />
        </g>
      ) : null}

      {/* Lower chamber sand mound */}
      {botFill > 0.01 ? (
        <g clipPath={`url(#${botClipId})`}>
          <path
            className="app-itag-hg-sand"
            d={`M4 ${(botY + 0.5).toFixed(2)} Q10 ${(botY - 0.9).toFixed(2)} 16 ${(botY + 0.5).toFixed(2)} L16 20 L4 20 Z`}
          />
        </g>
      ) : null}

      {/* Trickling sand stream while running */}
      {state === 'running' ? (
        <line
          className="app-itag-hourglass-stream"
          x1="10"
          y1="11.5"
          x2="10"
          y2={Math.max(12.2, Number(botY.toFixed(2)))}
        />
      ) : null}

      {/* Glass bulb outline */}
      <path
        className="app-itag-hg-glass"
        d="M5.2 4.3 L14.8 4.3 L10.75 11.5 C10.45 12 10.45 12 10.75 12.5 L14.8 19.7 L5.2 19.7 L9.25 12.5 C9.55 12 9.55 12 9.25 11.5 Z"
        fill="none"
      />
    </svg>
  );
}

type TimerRelatedTag =
  | Extract<InlineTag, { kind: 'timer' }>
  | Extract<InlineTag, { kind: 'timer_cancel' }>
  | Extract<InlineTag, { kind: 'timer_fired' }>;

function ActiveTimerChip({ tag }: { tag: Extract<InlineTag, { kind: 'timer' }> }) {
  const ctx = useContext(TimerTimelineContext);
  const [now, setNow] = useState(() => Date.now());

  const laterOutcome = ctx ? ctx.resolveLaterOutcome(tag.title) : null;
  const createdMs = ctx ? Date.parse(ctx.createdAt) : Number.NaN;
  const durationMs = tag.seconds * 1000;
  const hasTimestamp = Number.isFinite(createdMs) && durationMs > 0;
  const fireAtMs = hasTimestamp ? createdMs + durationMs : Number.NaN;

  let state: TimerVisualState;
  let ratio = 1;
  let displaySeconds = tag.seconds;

  if (laterOutcome === 'cancelled') {
    state = 'cancelled';
    ratio = 0.5;
  } else if (laterOutcome === 'fired') {
    state = 'done';
    ratio = 0;
    displaySeconds = 0;
  } else if (ctx && hasTimestamp) {
    const remainingMs = Math.max(0, fireAtMs - now);
    if (remainingMs <= 0) {
      state = 'done';
      ratio = 0;
      displaySeconds = 0;
    } else {
      state = 'running';
      ratio = Math.max(0, Math.min(1, remainingMs / durationMs));
      displaySeconds = Math.ceil(remainingMs / 1000);
    }
  } else {
    state = 'idle';
    ratio = 1;
    displaySeconds = tag.seconds;
  }

  useEffect(() => {
    if (state !== 'running') return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, fireAtMs]);

  const titleSuffix = tag.title ? ` · ${tag.title}` : '';
  const label =
    state === 'cancelled'
      ? `已取消${titleSuffix}`
      : state === 'done'
        ? `已结束${titleSuffix}`
        : `倒计时 ${formatCountdown(displaySeconds)}${titleSuffix}`;

  return (
    <span
      className={`app-itag-chip app-itag-timer app-itag-timer--${state}`}
      data-itag="timer"
      data-timer-state={state}
      title={tag.title ?? undefined}
    >
      <HourglassSvg state={state} ratio={ratio} />
      <span className="app-itag-timer-text">{label}</span>
    </span>
  );
}

export function TimerHourglass({ tag }: { tag: TimerRelatedTag }) {
  if (tag.kind === 'timer_cancel') {
    return (
      <span
        className="app-itag-chip app-itag-timer app-itag-timer--cancelled"
        data-itag="timer-cancel"
        data-timer-state="cancelled"
      >
        <HourglassSvg state="cancelled" ratio={0.5} />
        <span className="app-itag-timer-text">已取消 · {tag.title}</span>
      </span>
    );
  }

  if (tag.kind === 'timer_fired') {
    return (
      <span
        className="app-itag-chip app-itag-timer app-itag-timer--done"
        data-itag="timer-fired"
        data-timer-state="done"
        title={tag.fireAt}
      >
        <HourglassSvg state="done" ratio={0} />
        <span className="app-itag-timer-text">计时到点{tag.title ? ` · ${tag.title}` : ''}</span>
      </span>
    );
  }

  return <ActiveTimerChip tag={tag} />;
}
