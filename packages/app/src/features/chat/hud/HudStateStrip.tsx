/**
 * P1D top-bar state strip (Plan Task 3.1, D2).
 *
 * Compact READ-ONLY summary + labelled HUD trigger. The strip never reflows
 * the message stream: it is a single inline row that ellipsizes. Values are
 * summaries of pane-5-owned runtime/preference state; the expanded Tactical
 * HUD owns all interaction.
 */
import type { ChatTransport } from '../runtime/types';

export interface HudStateStripProps {
  /** Effective target model name ('' while unresolved). */
  model: string;
  /** Effective endpoint label ('' while unresolved). */
  endpointLabel: string;
  thinkingLabel: string;
  transport: ChatTransport;
  /** Cache summary produced by the cache control owner. */
  cacheSummary: string;
  cacheReleaseEligible: boolean;
  cacheReleaseDisabled: boolean;
  cacheReleasing: boolean;
  onReleaseCache: () => void;
  auraLabel: string;
  onOpen: () => void;
}

export function HudStateStrip({
  model,
  endpointLabel,
  thinkingLabel,
  transport,
  cacheSummary,
  cacheReleaseEligible,
  cacheReleaseDisabled,
  cacheReleasing,
  onReleaseCache,
  auraLabel,
  onOpen,
}: HudStateStripProps) {
  const targetText = model ? (endpointLabel ? `${model} · ${endpointLabel}` : model) : '目标未解析';
  return (
    <div className="v4-strip" role="group" aria-label="会话状态摘要">
      <span className="v4-strip-item" title={`执行目标：${targetText}`}>
        {targetText}
      </span>
      <span className="v4-strip-item" title={`思考级别：${thinkingLabel}`}>
        思考 {thinkingLabel}
      </span>
      <span className="v4-strip-item" title={`传输模式：${transport === 'sse' ? '实时（SSE）' : '可恢复（轮询）'}`}>
        {transport === 'sse' ? 'SSE' : '轮询'}
      </span>
      <span className="v4-strip-cache">
        <span className="v4-strip-item" title={cacheSummary}>
          {cacheSummary}
        </span>
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
      {auraLabel ? (
        <span className="v4-strip-item" title={`氛围：${auraLabel}`}>
          ✦ {auraLabel}
        </span>
      ) : null}
      <button type="button" className="app-btn app-btn-ghost app-btn-sm v4-strip-trigger" onClick={onOpen}>
        战术面板
      </button>
    </div>
  );
}