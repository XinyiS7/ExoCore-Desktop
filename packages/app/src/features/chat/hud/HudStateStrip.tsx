/**
 * P1D top-bar state strip (Plan Task 3.1, D2).
 *
 * Compact READ-ONLY summary + labelled HUD trigger. The strip never reflows
 * the message stream: it is a single inline row that ellipsizes. Values are
 * summaries of pane-5-owned runtime/preference state; the expanded Tactical
 * HUD owns all interaction.
 */
import { useRef } from 'react';
import type { ChatTransport } from '../runtime/types';
import { useStripFit } from './useStripFit';

export interface HudStateStripProps {
  /** Effective target model name ('' while unresolved). */
  model: string;
  /** Effective endpoint label ('' while unresolved). */
  endpointLabel: string;
  thinkingLabel: string;
  transport: ChatTransport;
  /** Short cache text for the strip ('' hides it), e.g. `120s` or `快照`. */
  cacheSummary: string;
  /** Full cache description for the tooltip. */
  cacheDetail: string;
  cacheReleaseEligible: boolean;
  cacheReleaseDisabled: boolean;
  cacheReleasing: boolean;
  onReleaseCache: () => void;
  onOpen: () => void;
}

export function HudStateStrip({
  model,
  endpointLabel,
  thinkingLabel,
  transport,
  cacheSummary,
  cacheDetail,
  cacheReleaseEligible,
  cacheReleaseDisabled,
  cacheReleasing,
  onReleaseCache,
  onOpen,
}: HudStateStripProps) {
  // The strip shows only the model; the full target stays in the tooltip, the
  // HUD and each assistant message head.
  const targetText = model ? (endpointLabel ? `${model} · ${endpointLabel}` : model) : '目标未解析';
  const stripRef = useRef<HTMLDivElement>(null);
  // When the items cannot all show in full, keep model, thinking and cache.
  // The countdown ticks every second, so only its length re-measures.
  const compact = useStripFit(
    stripRef,
    [model, thinkingLabel, transport, cacheSummary.length, cacheReleaseEligible].join('|'),
  );
  const showCache = cacheSummary !== '' || cacheReleaseEligible;
  return (
    <div
      ref={stripRef}
      className={`v4-strip${compact ? ' v4-strip--compact' : ''}`}
      role="group"
      aria-label="会话状态摘要"
    >
      <span className="v4-strip-item" title={`执行目标：${targetText}`}>
        {model || '目标未解析'}
      </span>
      <span className="v4-strip-item" title={`思考级别：${thinkingLabel}`}>
        {thinkingLabel}
      </span>
      <span className="v4-strip-item v4-strip-item--optional" title={`传输模式：${transport === 'sse' ? '实时（SSE）' : '可恢复（轮询）'}`}>
        {transport === 'sse' ? 'SSE' : '轮询'}
      </span>
      {showCache ? (
        <span className="v4-strip-cache" title={cacheDetail}>
          {cacheSummary ? <span className="v4-strip-item">{cacheSummary}</span> : null}
          {cacheReleaseEligible ? (
            <button
              type="button"
              className="v4-strip-cache-release"
              onClick={onReleaseCache}
              disabled={cacheReleaseDisabled}
              aria-label="释放上下文缓存"
              title={cacheReleasing ? '正在释放上下文缓存' : '释放上下文缓存'}
            >
              −
            </button>
          ) : null}
        </span>
      ) : null}
      <button
        type="button"
        className="app-btn app-btn-ghost app-btn-sm v4-strip-trigger"
        onClick={onOpen}
        title="打开战术面板"
      >
        more
      </button>
    </div>
  );
}