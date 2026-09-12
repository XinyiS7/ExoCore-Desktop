import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useConversationsQuery, useVisiblePresetsQuery } from './queries';
import { toAppApiError } from './api';
import { ConversationDeleteMenu } from './ConversationDeleteMenu';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { formatDateTime } from './time';

function identityLabel(presetId: number | null, presetName: string | undefined): string {
  if (presetId === null || presetId === undefined) return '未知 Agent';
  return presetName ?? `Agent #${presetId}`;
}

/**
 * Recent ordinary Conversations. Backend order is authoritative — the
 * response array is never mutated or re-sorted client-side (Plan §6.4).
 */
export interface RecentConversationListProps {
  onRequestCreate: () => void;
  /** Optional parent notification after a confirmed/absent deletion. */
  onDeletedConversation?: (deletedId: number) => void;
}

export function RecentConversationList({ onRequestCreate, onDeletedConversation }: RecentConversationListProps) {
  const conversationsQuery = useConversationsQuery();
  const presetsQuery = useVisiblePresetsQuery();

  const presetById = useMemo(() => {
    const map = new Map<number, string>();
    for (const preset of presetsQuery.data ?? []) map.set(preset.id, preset.name);
    return map;
  }, [presetsQuery.data]);

  if (conversationsQuery.isPending) {
    return (
      <div className="app-scroll">
        <LoadingState label="正在加载会话…" />
      </div>
    );
  }

  if (conversationsQuery.isError) {
    const error = toAppApiError(conversationsQuery.error);
    const detail = error.status === 404 ? '会话列表暂不可用。' : error.message;
    return (
      <div className="app-scroll">
        <ErrorState title="会话加载失败" detail={detail} onRetry={() => void conversationsQuery.refetch()} />
      </div>
    );
  }

  const conversations = conversationsQuery.data ?? [];

  if (conversations.length === 0) {
    return (
      <div className="app-scroll">
        <EmptyState
          title="还没有会话"
          hint="创建第一个会话，与 Agent 开始对话。"
          action={
            <button type="button" className="app-btn" onClick={onRequestCreate}>
              <Plus size={16} aria-hidden="true" />
              新建会话
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="app-scroll">
      {presetsQuery.isError ? (
        <div className="app-banner" role="alert">
          Agent 名称加载失败，将显示 Agent 编号。
          <button type="button" className="app-link-btn" onClick={() => void presetsQuery.refetch()}>
            重试
          </button>
        </div>
      ) : null}
      <ul className="app-recent-list" aria-label="最近会话">
        {conversations.map((conversation) => (
          <li key={conversation.id} className="app-recent-item">
            <Link to={`/chat/${conversation.id}`} className="app-recent-row">
              <span className="app-recent-name">{conversation.name || `会话 #${conversation.id}`}</span>
              <span className="app-recent-time">{formatDateTime(conversation.lastMessageAt ?? conversation.createdAt)}</span>
              <span className="app-recent-meta">
                <span className="app-chip">
                  {identityLabel(conversation.agentPresetId, presetById.get(conversation.agentPresetId ?? -1))}
                </span>
                <span className={`app-chip${conversation.projectId === null ? ' app-chip--drift' : ''}`}>
                  {conversation.projectName ?? 'Drift'}
                </span>
              </span>
            </Link>
            <ConversationDeleteMenu
              conversationId={conversation.id}
              conversationName={conversation.name || `会话 #${conversation.id}`}
              onDeleted={onDeletedConversation}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
