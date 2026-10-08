import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Copy, Edit2, GitBranch, RotateCw } from 'lucide-react';
import type { AssistantRunTraceProjection, MessageRole, MessageView } from './types';
import type { OptimisticUserRow, RuntimeAssistantRow } from './runtime/types';
import { MessageContent } from './MessageContent';
import { formatTimeOfDay } from './time';
import { MessageAttachments } from './attachments/MessageAttachments';
import { AssistantRunTrace } from './trace/AssistantRunTrace';
import { MessageVoiceControl } from './tts/MessageVoiceControl';
import { VoiceToolErrors } from './voice/VoiceToolErrors';
import { CollectMessageModal } from '../collection/CollectMessageModal';

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
 * A+ closure: canonical handover proof over the exact `clientTurnId`
 * correlation. Only a drawn `role === 'user'` row carrying the same non-null
 * UUID as this optimistic row counts; content, timestamps, attachments,
 * `indexInSession` and row position are banned as identity evidence. Pure
 * projection — the runtime lifecycle still owns the final cleanup.
 */
function hasExactCanonicalUser(
  messages: MessageView[],
  optimisticUser: OptimisticUserRow | null | undefined,
): boolean {
  if (!optimisticUser) return false;
  return messages.some(
    (message) =>
      message.role === 'user' &&
      typeof message.clientTurnId === 'string' &&
      message.clientTurnId === optimisticUser.clientTurnId,
  );
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
  onCollectMessage?: (message: MessageView) => void;
}

function MessageRowItem({
  message,
  conversationId,
  isLatestUser,
  isRunActive,
  onEditMessage,
  onRegenerateMessage,
  onBranchMessage,
  onCollectMessage,
}: {
  message: MessageView;
  conversationId?: number;
  isLatestUser: boolean;
  isRunActive?: boolean;
  onEditMessage?: (id: number, content: string, isLatestUser: boolean) => void;
  onRegenerateMessage?: (id: number, isLatestUser: boolean) => void;
  onBranchMessage?: (id: number, snippet: string) => void;
  onCollectMessage?: (message: MessageView) => void;
}) {
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const voice = message.voice;
  const attachments = message.attachments;
  const attachmentsMeta = message.attachmentsMeta ?? [];
  const readyAttachments = attachments ? attachments.filter((att) => att.status === 'ready') : [];
  const hasAttachments =
    attachments !== undefined ? readyAttachments.length > 0 : attachmentsMeta.length > 0;
  const hasReasoning = Boolean(message.reasoningContent);
  const hasContentText = Boolean(message.content?.trim());
  const voiceToolErrors = isAssistant ? message.voiceToolErrors ?? [] : [];
  const hasVoiceToolErrors = voiceToolErrors.length > 0;
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyContent = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Graceful fallback
    }
  };

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
          {isUser && hasContentText ? (
            <button
              type="button"
              className="app-msg-action-btn"
              onClick={handleCopyContent}
              title={copied ? '已复制消息内容' : '复制消息内容'}
              aria-label={copied ? '已复制消息内容' : '复制消息内容'}
            >
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied ? '已复制' : '复制'}
            </button>
          ) : null}
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
          {(isUser || isAssistant) && hasContentText ? (
            <button
              type="button"
              className="app-msg-action-btn app-msg-action-btn--collect"
              onClick={() => onCollectMessage?.(message)}
              title="收藏此条消息"
              aria-label="收藏此条消息"
            >
              <Bookmark size={12} aria-hidden="true" />
              收藏
            </button>
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
        ) : hasAttachments || hasVoiceToolErrors ? null : (
          <span className="app-muted">（空消息）</span>
        )}
        {hasAttachments ? (
          <MessageAttachments
            attachments={attachments}
            meta={attachmentsMeta}
            conversationId={conversationId}
          />
        ) : null}
        {hasVoiceToolErrors ? <VoiceToolErrors errors={voiceToolErrors} /> : null}
        {isAssistant && hasContentText ? (
          <div className="app-msg-footer">
            <button
              type="button"
              className="app-msg-action-btn"
              onClick={handleCopyContent}
              title={copied ? '已复制消息内容' : '复制消息内容'}
              aria-label={copied ? '已复制消息内容' : '复制消息内容'}
            >
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        ) : null}
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
  onCollectMessage,
}: MessageTimelineProps) {
  const [collectTarget, setCollectTarget] = useState<MessageView | null>(null);

  const handleCollectMessage = (target: MessageView) => {
    if (onCollectMessage) {
      onCollectMessage(target);
    } else {
      setCollectTarget(target);
    }
  };

  // Find latest persisted user turn ID to identify historical vs latest turns (§7.4)
  let latestUserMessageId = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      latestUserMessageId = messages[i].id;
      break;
    }
  }

  const realtimeTrace = runtimeAssistant ? runtimeTraceProjection(runtimeAssistant) : null;
  const runtimeVoiceErrors = runtimeAssistant?.voiceToolErrors ?? [];

  // A+ closure: once the canonical row carrying this attempt's exact
  // correlation is drawn, the optimistic copy is suppressed (canonical rows
  // keep rendering as before; the runtime overlay/lifecycle is untouched).
  const shownOptimisticUser =
    optimisticUser && !hasExactCanonicalUser(messages, optimisticUser)
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
          onCollectMessage={handleCollectMessage}
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
            ) : runtimeAssistant.thinking ||
              (realtimeTrace?.availability === 'available' && realtimeTrace.items.length) ||
              runtimeVoiceErrors.length > 0 ? null : (
              <span className="app-spinner-inline" aria-label="等待回答" />
            )}
            {runtimeVoiceErrors.length > 0 ? <VoiceToolErrors errors={runtimeVoiceErrors} /> : null}
            {runtimeAssistant.error ? (
              <div className="app-runtime-error-box" role="alert">
                <span className="app-error-hint">{runtimeAssistant.error.message}</span>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}

      {collectTarget ? (
        <CollectMessageModal
          isOpen={Boolean(collectTarget)}
          targetMessage={collectTarget}
          onClose={() => setCollectTarget(null)}
        />
      ) : null}
    </div>
  );
}
