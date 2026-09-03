import type { MessageView, MessageRole } from './types';
import { MessageContent } from './MessageContent';
import { formatTimeOfDay } from './time';

const ROLE_LABELS: Record<MessageRole, string> = {
  user: '你',
  assistant: 'Agent',
  system: 'System',
  developer: 'Developer',
};

function MessageRow({ message }: { message: MessageView }) {
  const isAssistant = message.role === 'assistant';
  const attachmentCount = message.attachmentsMeta?.length ?? message.attachmentIds.length;
  const attachmentNames = (message.attachmentsMeta ?? []).map((meta) => meta.display_name).join('、');
  const hasReasoning = Boolean(message.reasoningContent);

  return (
    <article className={`app-msg app-msg--${message.role}`} data-role={message.role}>
      <header className="app-msg-head">
        <span className="app-msg-role">{ROLE_LABELS[message.role] ?? message.role}</span>
        <span className="app-msg-time">{formatTimeOfDay(message.createdAt)}</span>
        {isAssistant && (message.platform || message.modelVersion) ? (
          <span className="app-msg-model">
            {[message.platform, message.modelVersion].filter(Boolean).join(' · ')}
          </span>
        ) : null}
      </header>
      <div className="app-msg-body">
        {message.content ? (
          <MessageContent content={message.content} />
        ) : (
          <span className="app-muted">（空消息）</span>
        )}
        {/* Honest partial-capability indicators — no P1B/P1C controls here. */}
        {hasReasoning ? (
          <span className="app-deferred-chip" title="推理过程内容在后续阶段开放查看">
            推理过程 · P1B 开放
          </span>
        ) : null}
        {attachmentCount > 0 ? (
          <span
            className="app-deferred-chip"
            title={attachmentNames ? `附件：${attachmentNames}` : undefined}
          >
            附件 {attachmentCount} 个 · P1C 开放
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Pure message list — newest-visible-first window rendered oldest → newest. */
export function MessageTimeline({
  messages,
  hasOlder,
  loadingMore,
  onLoadMore,
}: {
  messages: MessageView[];
  hasOlder: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="app-timeline">
      {hasOlder ? (
        <div className="app-timeline-more">
          <button
            type="button"
            className="app-btn app-btn-ghost"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? '加载中…' : '加载更早消息'}
          </button>
        </div>
      ) : null}
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
    </div>
  );
}
