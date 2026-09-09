/**
 * V4 ToolCall row (Plan Task 6 / §6.5) — one ordered tool trace item.
 *
 * Sparse by contract: `argumentPreview` / `resultSummary` / `errorSummary`
 * rows render ONLY when the backend supplied a non-null bounded value; no
 * empty rows, no fabricated text. Lifecycle is displayed verbatim, with
 * `incomplete` shown honestly for started-without-terminal tools.
 *
 * Content renders as text/Markdown under MessageContent safety rules — never
 * scanned, redacted or truncated on this side (backend owns bounds).
 */
import type { AssistantRunTraceToolItem } from '../types';
import { MessageContent } from '../MessageContent';
import './trace.css';

const LIFECYCLE_LABEL: Record<AssistantRunTraceToolItem['lifecycle'], string> = {
  started: '调用中',
  succeeded: '完成',
  failed: '失败',
  incomplete: '中断',
};

export function ToolCallRow({ item }: { item: AssistantRunTraceToolItem }) {
  return (
    <div className="v4-trace-tool" data-testid={`v4-trace-tool-${item.order}`}>
      <span className="v4-trace-tool-name">{item.toolName}</span>
      <span
        className={`v4-trace-tool-badge v4-trace-tool-badge--${item.lifecycle}`}
      >
        {LIFECYCLE_LABEL[item.lifecycle]}
      </span>
      {item.durationMs != null ? (
        <span className="v4-trace-tool-meta">{item.durationMs}ms</span>
      ) : null}
      {item.argumentPreview ? (
        <div className="v4-trace-tool-field">
          <span className="v4-trace-tool-field-label">参数</span>
          <MessageContent content={item.argumentPreview} />
        </div>
      ) : null}
      {item.resultSummary ? (
        <div className="v4-trace-tool-field">
          <span className="v4-trace-tool-field-label">结果</span>
          <MessageContent content={item.resultSummary} />
        </div>
      ) : null}
      {item.errorSummary ? (
        <div className="v4-trace-tool-field v4-trace-tool-field--error">
          <span className="v4-trace-tool-field-label">错误</span>
          <MessageContent content={item.errorSummary} />
        </div>
      ) : null}
    </div>
  );
}