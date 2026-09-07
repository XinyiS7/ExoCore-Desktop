import { Edit2, GitBranch, RotateCw } from 'lucide-react';
import type { MessageRole, MessageView } from './types';
import type { OptimisticUserRow, RuntimeAssistantRow } from './runtime/types';
import { MessageContent } from './MessageContent';
import { formatTimeOfDay } from './time';
import { MessageAttachments } from './attachments/MessageAttachments';

const ROLE_LABELS: Record<MessageRole, string> = {
  user: '你',
  assistant: 'Agent',
  system: 'System',
  developer: 'Developer',
};

export interface MessageTimelineProps {
  messages: MessageView[];
  hasOlder: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  optimisticUser?: OptimisticUserRow | null;
  runtimeAssistant?: RuntimeAssistantRow | null;
  isRunActive?: boolean;
  onEditMessage?: (id: number, content: string, isLatestUser: boolean) => void;
  onRegenerateMessage?: (id: number, isLatestUser: boolean) => void;
  onBranchMessage?: (id: number, snippet: string) => void;
}

function MessageRowItem({
  message,
  isLatestUser,
  isRunActive,
  onEditMessage,
  onRegenerateMessage,
  onBranchMessage,
}: {
  message: MessageView;
  isLatestUser: boolean;
  isRunActive?: boolean;
  onEditMessage?: (id: number, content: string, isLatestUser: boolean) => void;
  onRegenerateMessage?: (id: number, isLatestUser: boolean) => void;
  onBranchMessage?: (id: number, snippet: string) => void;
}) {
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const attachmentsMeta = message.attachmentsMeta ?? [];
  const hasReasoning = Boolean(message.reasoningContent);
  const hasContentText = Boolean(message.content?.trim());
  const hasAttachments = attachmentsMeta.length > 0;

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

        {/* Action buttons (disabled during active run, §7.1, §7.4, §7.5) */}
        <div className="app-msg-actions">
          {isUser && onEditMessage && (
            <button
              type="button"
              className="app-msg-action-btn"
              disabled={isRunActive}
              onClick={() => onEditMessage(message.id, message.content, isLatestUser)}
              title="编辑此条消息"
              aria-label="编辑此条消息"
            >
              <Edit2 size={12} aria-hidden="true" />
              编辑
            </button>
          )}
          {isUser && onRegenerateMessage && (
            <button
              type="button"
              className="app-msg-action-btn"
              disabled={isRunActive}
              onClick={() => onRegenerateMessage(message.id, isLatestUser)}
              title="重新生成回答"
              aria-label="重新生成回答"
            >
              <RotateCw size={12} aria-hidden="true" />
              重生成
            </button>
          )}
          {isAssistant && onBranchMessage && (
            <button
              type="button"
              className="app-msg-action-btn"
              disabled={isRunActive}
              onClick={() => onBranchMessage(message.id, message.content)}
              title="从该回答派生新会话"
              aria-label="从该回答派生新会话"
            >
              <GitBranch size={12} aria-hidden="true" />
              分支
            </button>
          )}
        </div>
      </header>

      <div className="app-msg-body">
        {hasContentText ? (
          <MessageContent content={message.content} />
        ) : hasAttachments ? null : (
          <span className="app-muted">（空消息）</span>
        )}
        {/* Honest partial-capability indicators */}
        {hasReasoning ? (
          <span className="app-deferred-chip" title="推理过程内容在后续阶段开放查看">
            推理过程 · P1D 开放
          </span>
        ) : null}
        {hasAttachments ? <MessageAttachments meta={attachmentsMeta} /> : null}
      </div>
    </article>
  );
}

/** Pure message list with optimistic / runtime overlay rendering */
export function MessageTimeline({
  messages,
  hasOlder,
  loadingMore,
  onLoadMore,
  optimisticUser,
  runtimeAssistant,
  isRunActive,
  onEditMessage,
  onRegenerateMessage,
  onBranchMessage,
}: MessageTimelineProps) {
  // Find latest persisted user turn ID to identify historical vs latest turns (§7.4)
  let latestUserMessageId = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      latestUserMessageId = messages[i].id;
      break;
    }
  }

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

      {/* Persisted canonical messages */}
      {messages.map((message) => (
        <MessageRowItem
          key={message.id}
          message={message}
          isLatestUser={message.id === latestUserMessageId}
          isRunActive={isRunActive}
          onEditMessage={onEditMessage}
          onRegenerateMessage={onRegenerateMessage}
          onBranchMessage={onBranchMessage}
        />
      ))}

      {/* Optimistic User Message Overlay (§6.4) */}
      {optimisticUser ? (
        <article
          key={optimisticUser.clientKey}
          className="app-msg app-msg--user app-msg--optimistic"
          data-role="user"
        >
          <header className="app-msg-head">
            <span className="app-msg-role">你</span>
            <span className="app-msg-time">{formatTimeOfDay(optimisticUser.createdAt)}</span>
            <span className="app-muted" style={{ fontSize: '10.5px' }}>
              （发送中…）
            </span>
          </header>
          <div className="app-msg-body">
            {optimisticUser.content ? <MessageContent content={optimisticUser.content} /> : null}
            {optimisticUser.pendingAttachmentIds.length > 0 ? (
              <span className="app-deferred-chip">
                待发送附件 {optimisticUser.pendingAttachmentIds.length} 个
              </span>
            ) : null}
          </div>
        </article>
      ) : null}

      {/* Runtime Assistant Message Overlay (§6.4) */}
      {runtimeAssistant ? (
        <article
          key={runtimeAssistant.clientKey}
          className="app-msg app-msg--assistant app-msg--streaming"
          data-role="assistant"
        >
          <header className="app-msg-head">
            <span className="app-msg-role">Agent</span>
            {runtimeAssistant.isStreaming ? (
              <span className="app-muted" style={{ fontSize: '10.5px' }}>
                {runtimeAssistant.statusText || '生成中…'}
              </span>
            ) : null}
          </header>
          <div className="app-msg-body">
            {runtimeAssistant.content ? (
              <MessageContent content={runtimeAssistant.content} />
            ) : (
              <span className="app-spinner-inline" aria-label="等待回答" />
            )}
            {runtimeAssistant.error ? (
              <div className="app-runtime-error-box" role="alert">
                <span className="app-error-hint">{runtimeAssistant.error.message}</span>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}
    </div>
  );
}
