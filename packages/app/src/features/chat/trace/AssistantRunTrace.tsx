/**
 * V4 Assistant run trace (Plan Task 6 / §6.5) — presentation leaf.
 *
 * Consumes the frozen camel AssistantRunTrace DTOs from `../types`
 * (`AssistantRunTraceProjection` / `AssistantRunTraceItem`). Pure
 * presentation: SSE/polling normalization and runtime wiring are pane-5
 * territory; this component renders whatever ordered projection it is given.
 *
 * Contract:
 * - default collapsed even while streaming (open only via `defaultOpen`);
 * - tool-only history projections are fully supported (no Thinking item
 *   required);
 * - `available` + `items[]` + `truncated` shows an explicit omission notice
 *   (NEVER the legacy-unavailable copy);
 * - legacy rows keep `reasoning` readable with an honest "no tool details"
 *   note; no order/duration/argument fabrication;
 * - null summaries stay sparse (no empty rows);
 * - content is rendered as text/Markdown under existing safety rules — no
 *   secret scanning, no redaction, no truncation on this side.
 */
import type { RuntimeTelemetry } from '../runtime/types';
import type { AssistantRunTraceProjection } from '../types';
import { useState } from 'react';
import { ReasoningPanel } from './ReasoningPanel';
import { ToolCallRow } from './ToolCallRow';
import './trace.css';

export interface AssistantRunTraceProps {
  /** Legacy/compat raw reasoning text (history rows before trace wiring). */
  reasoning?: string | null | undefined;
  /** Canonical ordered projection (frozen DTO). Absent/null → legacy path. */
  projection?: AssistantRunTraceProjection | null;
  /** True while the runtime streams this turn. */
  streaming?: boolean;
  /** Legacy runtime tool count (pre-authoritative-trace runtime rows). */
  telemetry?: RuntimeTelemetry;
  /** History rows that lack an accepted ordered projection. */
  legacyToolDetailsUnavailable?: boolean;
  /** Explicitly open the panel; absent/false keeps it collapsed (§6.5). */
  defaultOpen?: boolean;
}

export function AssistantRunTrace({
  reasoning,
  projection,
  streaming = false,
  telemetry,
  legacyToolDetailsUnavailable = false,
  defaultOpen = false,
}: AssistantRunTraceProps) {
  const available = projection?.availability === 'available';
  const items = available ? projection.items : [];
  const hasReasoning = Boolean(reasoning?.trim());
  const toolCount = telemetry?.toolCalls;

  const showTracePanel =
    available ||
    hasReasoning ||
    (toolCount !== undefined && toolCount > 0) ||
    legacyToolDetailsUnavailable;

  // Component-local disclosure: the user may keep the panel open or closed
  // across streaming rerenders. ``defaultOpen`` only seeds the INITIAL state
  // (default collapsed per Plan §6.5); it never re-closes an open panel.
  const [open, setOpen] = useState<boolean>(defaultOpen);

  if (!showTracePanel) return null;

  const summaryParts: string[] = [];
  if (available) {
    const thinkingCount = items.filter((item) => item.kind === 'thinking').length;
    const toolCountItems = items.length - thinkingCount;
    if (thinkingCount > 0) summaryParts.push(`${thinkingCount} 条思考`);
    if (toolCountItems > 0) summaryParts.push(`${toolCountItems} 个工具调用`);
    if (summaryParts.length === 0) summaryParts.push('运行轨迹');
  } else {
    summaryParts.push('历史轨迹');
  }
  if (streaming) summaryParts.push('运行中');

  return (
    <details
      className="v4-trace"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="v4-trace-summary">{summaryParts.join(' · ')}</summary>

      {available ? (
        <>
          {items.map((item) =>
            item.kind === 'thinking' ? (
              <ReasoningPanel key={item.itemId} text={item.text} />
            ) : (
              <ToolCallRow key={item.itemId} item={item} />
            ),
          )}
          {projection.truncated === true ? (
            <p className="v4-trace-notice" role="note">
              部分轨迹条目因后端安全长度限制被省略，仅保留前 {items.length} 条。
            </p>
          ) : items.length === 0 ? (
            // 与 truncated 互斥：truncated 意味着确实丢弃过内容，不再叠加
            // 空活动文案。
            <p className="app-muted">本回合没有可展示的思考或工具活动。</p>
          ) : null}
        </>
      ) : (
        <>
          {hasReasoning ? <ReasoningPanel text={reasoning as string} streaming={streaming} /> : null}
          {legacyToolDetailsUnavailable ? (
            <p className="v4-trace-notice v4-trace-notice--legacy" role="note">
              此历史消息没有可验证的工具顺序与详情。
            </p>
          ) : null}
          {toolCount !== undefined && toolCount > 0 ? (
            <p className="app-muted">本轮工具调用计数：{toolCount}。</p>
          ) : null}
        </>
      )}
    </details>
  );
}