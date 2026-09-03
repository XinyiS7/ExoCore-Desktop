import { useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toAppApiError } from './api';
import {
  isValidConversationId,
  useConversationQuery,
  useMessagePagesQuery,
  useVisiblePresetsQuery,
} from './queries';
import { MessageTimeline } from './MessageTimeline';
import { MoreMenu } from '../../shell/PrimaryNavigation';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';

/** Distinct invalid-URL state — no request is issued for bad route params. */
function InvalidConversationState() {
  return (
    <div className="app-page app-page--center">
      <div className="app-error-page" role="alert">
        <p className="app-error-title">无效的会话地址</p>
        <p className="app-error-hint">会话编号必须是正整数。</p>
        <Link className="app-btn" to="/">
          Chat Home
        </Link>
      </div>
    </div>
  );
}

function ErrorDetail({ error }: { error: unknown }) {
  const appError = toAppApiError(error);
  if (appError.status === 404) {
    return (
      <div className="app-error-page" role="alert">
        <p className="app-error-title">会话不存在或已被删除</p>
        <p className="app-error-hint">返回 Chat Home 查看其他会话。</p>
        <Link className="app-btn" to="/">
          Chat Home
        </Link>
      </div>
    );
  }
  return null;
}

/**
 * Canonical conversation read path (Plan Task 7):
 * Recent / direct URL / create-success all resolve into this one component.
 * No composer, no runtime mutation endpoint — P1B owns sending.
 */
export function ConversationPage() {
  const { conversationId } = useParams();
  const invalid = !isValidConversationId(conversationId);
  const id = invalid ? 0 : Number(conversationId);

  const conversationQuery = useConversationQuery(id);
  const presetsQuery = useVisiblePresetsQuery();
  const pagesQuery = useMessagePagesQuery(id);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingAnchor = useRef<{ top: number; height: number } | null>(null);

  const presetById = useMemo(() => {
    const map = new Map<number, string>();
    for (const preset of presetsQuery.data ?? []) map.set(preset.id, preset.name);
    return map;
  }, [presetsQuery.data]);

  // Preserve scroll position when older rows are prepended (Plan Task 7.7).
  useLayoutEffect(() => {
    if (pagesQuery.isFetchingNextPage || pendingAnchor.current === null) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = pendingAnchor.current.top + (el.scrollHeight - pendingAnchor.current.height);
    }
    pendingAnchor.current = null;
  }, [pagesQuery.isFetchingNextPage, pagesQuery.data?.pageCount]);

  if (invalid) return <InvalidConversationState />;

  const conversation = conversationQuery.data;
  const agentLabel =
    conversation?.agentPresetId === null || conversation?.agentPresetId === undefined
      ? '未知 Agent'
      : (presetById.get(conversation.agentPresetId) ?? `Agent #${conversation.agentPresetId}`);
  const merged = pagesQuery.data;

  const handleLoadMore = () => {
    const el = scrollRef.current;
    if (!el || pendingAnchor.current !== null || pagesQuery.isFetchingNextPage) return;
    pendingAnchor.current = { top: el.scrollTop, height: el.scrollHeight };
    void pagesQuery.fetchNextPage();
  };

  return (
    <div className="app-page app-page--detail">
      <header className="app-topbar app-topbar--detail">
        <Link to="/" className="app-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Chat Home
        </Link>
        <div className="app-topbar-title app-topbar-title--detail">
          <h1 className="app-h1">{conversation?.name ?? (conversationQuery.isPending ? '加载中…' : `会话 #${id}`)}</h1>
          <span className="app-topbar-sub">
            <span className="app-chip">{agentLabel}</span>
            <span className={`app-chip${conversation?.projectId === null ? ' app-chip--drift' : ''}`}>
              {conversation?.projectName ?? 'Drift'}
            </span>
            {presetsQuery.isError ? (
              <button type="button" className="app-link-btn" onClick={() => void presetsQuery.refetch()}>
                Agent 名称加载失败，重试
              </button>
            ) : null}
          </span>
        </div>
        <MoreMenu className="app-more--top" />
      </header>

      {conversationQuery.isPending ? (
        <div className="app-scroll">
          <LoadingState label="正在加载会话…" />
        </div>
      ) : null}

      {conversationQuery.isError ? (
        <div className="app-scroll">
          {toAppApiError(conversationQuery.error).status === 404 ? (
            <ErrorDetail error={conversationQuery.error} />
          ) : (
            <ErrorState
              title="会话加载失败"
              detail={toAppApiError(conversationQuery.error).message}
              onRetry={() => void conversationQuery.refetch()}
            />
          )}
        </div>
      ) : null}

      {conversation !== undefined ? (
        <div className="app-scroll" ref={scrollRef}>
          {pagesQuery.isPending && merged === undefined ? (
            <LoadingState label="正在加载消息…" />
          ) : null}

          {pagesQuery.isError ? (
            toAppApiError(pagesQuery.error).status === 404 ? (
              <ErrorState title="消息历史不可用" detail="该会话的消息历史不存在（404）。" onRetry={() => void pagesQuery.refetch()} />
            ) : (
              <ErrorState
                title="消息加载失败"
                detail={toAppApiError(pagesQuery.error).message}
                onRetry={() => void pagesQuery.refetch()}
              />
            )
          ) : null}

          {merged !== undefined && !pagesQuery.isError ? (
            merged.rows.length === 0 && !merged.hasOlder ? (
              <EmptyState
                title="还没有消息"
                hint="这个会话还没有内容。发送消息功能将在 P1B 阶段开放。"
              />
            ) : (
              <MessageTimeline
                messages={merged.rows}
                hasOlder={merged.hasOlder}
                loadingMore={pagesQuery.isFetchingNextPage}
                onLoadMore={handleLoadMore}
              />
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
