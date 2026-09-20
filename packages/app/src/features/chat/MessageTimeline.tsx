import { Edit2, GitBranch, RotateCw } from 'lucide-react';
import type { AssistantRunTraceProjection, MessageRole, MessageView } from './types';
import type { OptimisticUserRow, RuntimeAssistantRow } from './runtime/types';
import { MessageContent } from './MessageContent';
import { formatTimeOfDay } from './time';
import { MessageAttachments } from './attachments/MessageAttachments';
import { AssistantRunTrace } from './trace/AssistantRunTrace';
import { MessageVoiceControl } from './tts/MessageVoiceControl';

function runtimeTraceProjection(row: RuntimeAssistantRow): AssistantRunTraceProjection | null {
  if (!row.assistantTrace) return null;
  return {
    version: 1,
    availability: 'available',
    items: row.assistantTrace.items.map((item) =>
      item.kind === 'tool' && item.lifecycle === 'started' && !row.isStreaming
        ? { ...item, lifecycle: 'incomplete' }
        : item,
    ),
  };
}

const ROLE_LABELS: Record<MessageRole, string> = {
  user: '你',
  assistant: 'Agent',
  system: 'System',
  developer: 'Developer',
};

/**
 * Issue #2 closure: canonical replacement proof over the `indexInSession`
 * order. A numeric pre-send boundary hands over on any strictly later user
 * row. `null` (the dispatch-time snapshot was loaded and contained no user
 * turn) can only prove the session's first user turn — an unresolved history
 * never reaches this projection because the dispatch is rejected first.
 * Pure projection — the runtime lifecycle still owns the final cleanup.
 */
function hasCanonicalUserReplacement(
  messages: MessageView[],
  optimisticUser: OptimisticUserRow | null | undefined,
): boolean {
  if (!optimisticUser) return false;
  const boundary = optimisticUser.priorUserIndexInSession;
  if (boundary !== null) {
    return messages.some(
      (message) => message.role === 'user' && message.indexInSession > boundary,
    );
  }
  // `null`: the only provable replacement is the session's first user turn —
  // every visible user row must be that first turn (`indexInSession` 0).
  let sawUserTurn = false;
  for (const message of messages) {
    if (message.role !== 'user') continue;
    sawUserTurn = true;
    if (message.indexInSession !== 0) return false;
  }
  return sawUserTurn;
}

export interface MessageTimelineProps {
  messages: MessageView[];
  /**
   * Conversation identity for row-level actions that need it (P2T voice).
   * Optional so existing direct-render tests keep working unchanged (D12).
   */
  conversationId?: number;
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
  conversationId,
  isLatestUser,
  isRunActive,
  onEditMessage,
  onRegenerateMessage,
  onBranchMessage,
}: {
  message: MessageView;
  conversationId?: number;
  isLatestUser: boolean;
  isRunActive?: boolean;
  onEditMessage?: (id: number, content: string, isLatestUser: boolean) => void;
  onRegenerateMessage?: (id: number, isLatestUser: boolean) => void;
  onBranchMessage?: (id: number, snippet: string) => void;
}) {
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const voice = message.voice;
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

        {/* Action buttons (disabled during active run, §7.1, §7.4, §7.5).
            The P2T voice control is deliberately NOT run-locked (D7) and shares
            this cluster instead of adding a second `margin-left: auto` column. */}
        <div className="app-msg-actions">
          {conversationId !== undefined &&
          isAssistant &&
          voice !== null &&
          voice !== undefined &&
          voice.available ? (
            <MessageVoiceControl
              conversationId={conversationId}
              messageId={message.id}
              voice={voice}
            />
          ) : null}
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
        {isAssistant && (message.assistantRunTrace || hasReasoning) ? (
          <AssistantRunTrace
            reasoning={message.reasoningContent}
            projection={message.assistantRunTrace}
            legacyToolDetailsUnavailable={
              message.assistantRunTrace?.availability === 'legacy_unavailable' ||
              (!message.assistantRunTrace && hasReasoning)
            }
          />
        ) : null}
        {hasContentText ? (
          <MessageContent content={message.content} />
        ) : hasAttachments ? null : (
          <span className="app-muted">（空消息）</span>
        )}
        {hasAttachments ? <MessageAttachments meta={attachmentsMeta} /> : null}
      </div>
    </article>
  );
}

/** Pure message list with optimistic / runtime overlay rendering */
export function MessageTimeline({
  messages,
  conversationId,
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

  const realtimeTrace = runtimeAssistant ? runtimeTraceProjection(runtimeAssistant) : null;

  // Issue #2 closure: once the canonical replacement exists, the optimistic
  // user row is no longer drawn (canonical rows keep rendering as before).
  const shownOptimisticUser =
    optimisticUser && !hasCanonicalUserReplacement(messages, optimisticUser)
      ? optimisticUser
      : null;

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
          conversationId={conversationId}
          isLatestUser={message.id === latestUserMessageId}
          isRunActive={isRunActive}
          onEditMessage={onEditMessage}
          onRegenerateMessage={onRegenerateMessage}
          onBranchMessage={onBranchMessage}
        />
      ))}

      {/* Optimistic User Message Overlay (§6.4) */}
      {shownOptimisticUser ? (
        <article
          key={shownOptimisticUser.clientKey}
          className="app-msg app-msg--user app-msg--optimistic"
          data-role="user"
        >
          <header className="app-msg-head">
            <span className="app-msg-role">你</span>
            <span className="app-msg-time">{formatTimeOfDay(shownOptimisticUser.createdAt)}</span>
            <span className="app-muted" style={{ fontSize: '10.5px' }}>
              （发送中…）
            </span>
          </header>
          <div className="app-msg-body">
            {shownOptimisticUser.content ? <MessageContent content={shownOptimisticUser.content} /> : null}
            {shownOptimisticUser.pendingAttachmentIds.length > 0 ? (
              <span className="app-deferred-chip">
                待发送附件 {shownOptimisticUser.pendingAttachmentIds.length} 个
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
            <AssistantRunTrace
              reasoning={runtimeAssistant.thinking}
              projection={realtimeTrace}
              telemetry={runtimeAssistant.telemetry}
              streaming={runtimeAssistant.isStreaming}
            />
            {runtimeAssistant.content ? (
              <MessageContent content={runtimeAssistant.content} />
            ) : runtimeAssistant.thinking || (realtimeTrace?.availability === 'available' && realtimeTrace.items.length) ? null : (
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
