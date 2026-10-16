import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDialogA11y } from '../chat/dialogA11y';
import { isG045AgentType, useConversationsQuery } from '../chat/queries';
import type { ConversationSummary } from '../chat/types';
import { cardDate } from './filters';

interface BringTargetDialogProps {
  /** Item ids in selection order (1–5). */
  itemIds: readonly number[];
  /** Display titles, parallel to `itemIds`. */
  titles: readonly string[];
  onCancel: () => void;
}

function byRecentActivity(a: ConversationSummary, b: ConversationSummary): number {
  const at = a.lastMessageAt ?? a.createdAt;
  const bt = b.lastMessageAt ?? b.createdAt;
  return at < bt ? 1 : at > bt ? -1 : b.id - a.id;
}

/**
 * #61 "带回到哪个会话？": G045 Conversations only, most recent first, Prime
 * preselected. Confirming writes nothing: it hands the ids to the chosen
 * Conversation's composer through router state.
 */
export function BringTargetDialog({ itemIds, titles, onCancel }: BringTargetDialogProps) {
  const navigate = useNavigate();
  const query = useConversationsQuery();
  const targets = useMemo(
    () => (query.data ?? []).filter((c) => isG045AgentType(c.agentType)).sort(byRecentActivity),
    [query.data],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? targets.find((c) => c.isPrime)?.id ?? targets[0]?.id ?? null;
  const dialogRef = useDialogA11y(true, onCancel);

  const confirm = () => {
    if (selected === null) return;
    navigate(`/chat/${selected}`, { state: { collectionCards: [...itemIds] } });
  };

  return (
    <div className="library-confirm-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-bring-title"
        className="app-dialog library-confirm library-bring"
      >
        <div className="app-dialog-body">
          <h2 id="library-bring-title" className="app-h2">带回到哪个会话？</h2>
          <div className="library-bring-items">
            {titles.map((title, index) => (
              <span key={itemIds[index]} className="library-bring-item">{title}</span>
            ))}
          </div>
          {query.isPending ? (
            <p role="status" className="library-state">正在加载会话…</p>
          ) : query.isError ? (
            <div role="alert" className="app-banner app-banner--error">
              会话加载失败：{query.error.message}
              <button type="button" className="app-btn app-btn-xs" onClick={() => void query.refetch()}>重试</button>
            </div>
          ) : targets.length === 0 ? (
            <div className="library-bring-empty">
              <span>还没有可以带回的 G045 会话</span>
              <Link to="/">去 Chat 新建会话</Link>
            </div>
          ) : (
            <fieldset className="library-bring-targets">
              <legend>G045 会话 · 最近活跃在前</legend>
              {targets.map((conv) => (
                <label key={conv.id} className="library-bring-target">
                  <input
                    type="radio"
                    name="library-bring-target"
                    checked={selected === conv.id}
                    onChange={() => setPicked(conv.id)}
                  />
                  <span className="library-bring-target-name">{conv.name?.trim() || `会话 #${conv.id}`}</span>
                  <span className="library-bring-target-time">
                    {conv.lastMessageAt ? cardDate(conv.lastMessageAt) : '还没有消息'}
                  </span>
                  {conv.isPrime ? <span className="library-bring-target-badge">默认</span> : null}
                </label>
              ))}
            </fieldset>
          )}
          {targets.length > 0 ? (
            <p className="library-note">卡片会放进该会话输入框上方的待发区，不改动你的草稿。</p>
          ) : null}
          <div className="app-dialog-actions">
            <button type="button" className="app-btn app-btn-ghost" onClick={onCancel}>取消</button>
            <button type="button" className="app-btn app-btn-primary" disabled={selected === null} onClick={confirm}>
              带回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
