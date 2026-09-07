import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toAppApiError } from './api';
import {
  findPersistedMessage,
  isValidConversationId,
  useConversationQuery,
  useMessagePagesQuery,
  useVisiblePresetsQuery,
} from './queries';
import { MessageTimeline } from './MessageTimeline';
import type { MessageView } from './types';
import { MoreMenu } from '../../shell/PrimaryNavigation';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { useChatRuntime } from './runtime/useChatRuntime';
import { ChatComposer } from './ChatComposer';
import { RuntimeStatusBanner } from './RuntimeStatusBanner';
import { TruncateConfirmModal } from './TruncateConfirmModal';
import { BranchConfirmModal } from './BranchConfirmModal';
import { useComposeAttachments } from './attachments/useComposeAttachments';
import { useUserAttachmentManager } from './attachments/useUserAttachmentManager';
import { useAudioRecorder } from './audio/useAudioRecorder';
import { useAudioTargetGate, useModelCatalogQuery } from './audio/audioTarget';
import { useAudioRecovery } from './audio/audioRecoveryMachine';

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

export function ConversationPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const invalid = !isValidConversationId(conversationId);
  const id = invalid ? 0 : Number(conversationId);

  const conversationQuery = useConversationQuery(id);
  const presetsQuery = useVisiblePresetsQuery();
  const pagesQuery = useMessagePagesQuery(id);
  const merged = pagesQuery.data;

  // P1C: compose attachment lifecycle (Task 2) — conversation-keyed so route
  // departure clears entries, aborts uploads and revokes previews.
  const compose = useComposeAttachments(id);
  const audioRecovery = useAudioRecovery(id, merged?.rows ?? []);
  // P1C: the manager's 204 callback synchronously purges both sendable owners
  // before history/list refresh. This closes the Phase A cross-owner seam.
  const attachmentManager = useUserAttachmentManager(id, {
    onDeleted: (attachmentId) => {
      compose.purgeAttachmentId(attachmentId);
      audioRecovery.purgeAttachmentId(attachmentId);
    },
    isDeleteBlocked: audioRecovery.isUploading,
  });
  // P1C: recorder lifecycle (AUD-F, Task 3).
  const recorder = useAudioRecorder();
  // P1C: live catalog + automatic target gate (Task 3.2).
  const catalogQuery = useModelCatalogQuery();
  const audioPreset =
    conversationQuery.data?.agentPresetId != null && presetsQuery.data
      ? (presetsQuery.data.find((p) => p.id === conversationQuery.data?.agentPresetId) ?? null)
      : null;
  const audioGate = useAudioTargetGate(
    catalogQuery.data,
    audioPreset ?? (conversationQuery.data ? { default_model: null } : null),
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingAnchor = useRef<{ top: number; height: number } | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const persistedRowsRef = useRef<ReadonlyArray<MessageView>>([]);
  /** Caller-side route identity for branch navigation guards (§6.3). */
  const pageEpochRef = useRef(0);
  const pageConversationIdRef = useRef(id);
  pageConversationIdRef.current = id;
  /**
   * R5-A2: per-invocation branch caller token. Modal close, replacement or
   * route switch REVOKES it — a revoked caller must never navigate, even if
   * a later clear-retry succeeds. Created fresh on every confirm.
   */
  const branchCallerTokenRef = useRef<{ revoked: boolean } | null>(null);

  // Canonical persisted rows only — runtime overlays never qualify as targets.
  persistedRowsRef.current = merged?.rows ?? [];

  // Route switch: invalidate the page-level caller identity and reset branch /
  // truncation modal targets so an old target cannot appear in another
  // Conversation (§6.3).
  useEffect(() => {
    pageEpochRef.current += 1;
    // R5-A2: route switch revokes the pending branch invocation.
    if (branchCallerTokenRef.current) branchCallerTokenRef.current.revoked = true;
    branchCallerTokenRef.current = null;
    setTruncateModal((prev) => ({ ...prev, isOpen: false }));
    setBranchModal({ isOpen: false, targetMessage: null });
  }, [id]);

  // Runtime lifecycle hook (single authoritative owner for send/edit/regenerate/
  // branch + transport + reconciliation; C1B intervention §3).
  const {
    transport,
    setTransport,
    status,
    busy,
    optimisticUser,
    runtimeAssistant,
    runtimeError,
    protocolWarning,
    hasPendingReconcile,
    draftCleanupFailed,
    sendMessage,
    retryRecoveredTurn,
    stopGeneration,
    editingTarget,
    startEdit,
    cancelEdit,
    confirmEdit,
    regenerate,
    resumePolling,
    retrySync,
    applyPendingReconcile,
    acknowledgeUncertain,
    retryReread,
    retryStorage,
    dismissTransient,
    retryDraftCleanup,
    branchFrom,
  } = useChatRuntime({
    conversationId: id,
    isNearBottomRef,
    thinkingLevel: conversationQuery.data?.thinkingLevel ?? null,
    persistedRowsRef,
    onAttemptOutcome: audioRecovery.onRuntimeOutcome,
    onNavigateToConversation: (conversationId: number) => {
      // At most one later navigation, only after the exact source clear
      // returned `cleared` AND this route caller is still current (§6.2).
      if (pageEpochRef.current === 0) return;
      navigate(`/chat/${conversationId}`);
    },
  });

  const handleRetryAudio = () => {
    void audioRecovery.retry({
      dispatchOrdinary: sendMessage,
      dispatchReplacement: retryRecoveredTurn,
      runtimeBusy: busy,
      deletePending: attachmentManager.isDeletePending(),
    });
  };

  // Modal states
  const [truncateModal, setTruncateModal] = useState<{
    isOpen: boolean;
    targetId: number;
    targetContent: string;
    actionType: 'edit' | 'regenerate';
  }>({
    isOpen: false,
    targetId: 0,
    targetContent: '',
    actionType: 'edit',
  });

  const [branchModal, setBranchModal] = useState<{
    isOpen: boolean;
    targetMessage: { id: number; snippet: string } | null;
  }>({
    isOpen: false,
    targetMessage: null,
  });

  const presetById = useMemo(() => {
    const map = new Map<number, string>();
    for (const preset of presetsQuery.data ?? []) map.set(preset.id, preset.name);
    return map;
  }, [presetsQuery.data]);

  // Track scroll position to determine near-bottom state
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;
  }, []);

  // Auto-scroll when new content streams in and user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [optimisticUser, runtimeAssistant?.content]);

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

  const handleLoadMore = () => {
    const el = scrollRef.current;
    if (!el || pendingAnchor.current !== null || pagesQuery.isFetchingNextPage) return;
    pendingAnchor.current = { top: el.scrollTop, height: el.scrollHeight };
    void pagesQuery.fetchNextPage();
  };

  const handleApplyPendingReconcile = async () => {
    await applyPendingReconcile();
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    isNearBottomRef.current = true;
  };

  // Request-side action-target guards (§5.1/§5.5, C1B-R1-05): every
  // edit/regenerate/branch dispatch re-validates the target against the
  // CURRENT canonical persisted rows of this conversation before POST.
  const handleEditMessage = (msgId: number, content: string, isLatestUser: boolean) => {
    if (busy) return;
    if (!findPersistedMessage(merged?.rows, msgId, 'user')) return;
    if (isLatestUser) {
      startEdit(msgId, content);
    } else {
      setTruncateModal({
        isOpen: true,
        targetId: msgId,
        targetContent: content,
        actionType: 'edit',
      });
    }
  };

  const handleRegenerateMessage = (msgId: number, isLatestUser: boolean) => {
    if (busy) return;
    if (!findPersistedMessage(merged?.rows, msgId, 'user')) return;
    if (isLatestUser) {
      void regenerate(msgId);
    } else {
      setTruncateModal({
        isOpen: true,
        targetId: msgId,
        targetContent: '',
        actionType: 'regenerate',
      });
    }
  };

  const handleConfirmTruncate = () => {
    if (busy) return;
    if (!findPersistedMessage(merged?.rows, truncateModal.targetId, 'user')) return;
    if (truncateModal.actionType === 'edit') {
      startEdit(truncateModal.targetId, truncateModal.targetContent);
    } else {
      void regenerate(truncateModal.targetId);
    }
  };

  const handleBranchMessage = (msgId: number, snippet: string) => {
    if (busy) return;
    if (!findPersistedMessage(merged?.rows, msgId, 'assistant')) return;
    // R5-A2: opening a new invocation revokes any still-pending one.
    if (branchCallerTokenRef.current) branchCallerTokenRef.current.revoked = true;
    branchCallerTokenRef.current = null;
    setBranchModal({
      isOpen: true,
      targetMessage: { id: msgId, snippet },
    });
  };

  const handleConfirmBranch = async (msgId: number) => {
    // R5-A2: per-invocation caller token captured BEFORE confirmation; every
    // await revalidates token + page identity, so close/replacement/route
    // switch can never let a stale caller navigate.
    const callerToken = { revoked: false };
    branchCallerTokenRef.current = callerToken;
    const callerEpoch = pageEpochRef.current;
    const callerConv = pageConversationIdRef.current;
    if (!findPersistedMessage(merged?.rows, msgId, 'assistant')) {
      throw new Error('该助手消息已不在当前会话中，无法创建分支。');
    }
    const res = await branchFrom(msgId, callerToken);
    if (
      callerToken.revoked ||
      callerEpoch !== pageEpochRef.current ||
      callerConv !== pageConversationIdRef.current
    ) {
      return; // stale caller — source result is complete; never navigate
    }
    // Recent was refreshed inside branchFrom (positive refresh on
    // success/ambiguity); navigation is the only page-side act left.
    navigate(`/chat/${res.conversationId}`);
  };

  return (
    <div className="app-page app-page--detail">
      <header className="app-topbar app-topbar--detail">
        <Link to="/" className="app-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Chat Home
        </Link>
        <div className="app-topbar-title app-topbar-title--detail">
          <h1 className="app-h1">
            {conversation?.name ?? (conversationQuery.isPending ? '加载中…' : `会话 #${id}`)}
          </h1>
          <span className="app-topbar-sub">
            <span className="app-chip">{agentLabel}</span>
            <span className={`app-chip${conversation?.projectId === null ? ' app-chip--drift' : ''}`}>
              {conversation?.projectName ?? 'Drift'}
            </span>
            {presetsQuery.isError ? (
              <button
                type="button"
                className="app-link-btn"
                onClick={() => void presetsQuery.refetch()}
              >
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
        <div className="app-scroll" ref={scrollRef} onScroll={handleScroll}>
          {pagesQuery.isPending && merged === undefined ? (
            <LoadingState label="正在加载消息…" />
          ) : null}

          {pagesQuery.isError ? (
            toAppApiError(pagesQuery.error).status === 404 ? (
              <ErrorState
                title="消息历史不可用"
                detail="该会话的消息历史不存在（404）。"
                onRetry={() => void pagesQuery.refetch()}
              />
            ) : (
              <ErrorState
                title="消息加载失败"
                detail={toAppApiError(pagesQuery.error).message}
                onRetry={() => void pagesQuery.refetch()}
              />
            )
          ) : null}

          {merged !== undefined && !pagesQuery.isError ? (
            merged.rows.length === 0 && !merged.hasOlder && !optimisticUser && !runtimeAssistant ? (
              <EmptyState
                title="还没有消息"
                hint="这个会话还没有内容。在下方输入消息开始对话。"
              />
            ) : (
              <MessageTimeline
                messages={merged.rows}
                hasOlder={merged.hasOlder}
                loadingMore={pagesQuery.isFetchingNextPage}
                onLoadMore={handleLoadMore}
                optimisticUser={optimisticUser}
                runtimeAssistant={runtimeAssistant}
                isRunActive={busy}
                onEditMessage={handleEditMessage}
                onRegenerateMessage={handleRegenerateMessage}
                onBranchMessage={handleBranchMessage}
              />
            )
          ) : null}
        </div>
      ) : null}

      {/* Runtime Status / Warning / Error Banners */}
      <RuntimeStatusBanner
        status={status}
        statusText={runtimeAssistant?.statusText}
        error={runtimeError}
        protocolWarning={protocolWarning}
        hasPendingReconcile={hasPendingReconcile}
        draftCleanupFailed={draftCleanupFailed}
        onApplyPendingReconcile={() => void handleApplyPendingReconcile()}
        onRetrySync={() => void retrySync()}
        onRetryStop={() => void stopGeneration()}
        onRetryReread={() => void retryReread()}
        onRetryStorage={() => void retryStorage()}
        onResumePolling={resumePolling}
        onAcknowledgeUncertain={acknowledgeUncertain}
        onDismissTransient={dismissTransient}
        onRetryDraftCleanup={retryDraftCleanup}
      />

      {/* Composer (Always accessible at bottom of conversation view) */}
      {conversation !== undefined ? (
        <ChatComposer
          conversationId={id}
          status={status}
          busy={busy}
          transport={transport}
          onTransportChange={setTransport}
          onSend={sendMessage}
          onStop={() => void stopGeneration()}
          editingTarget={editingTarget}
          onCancelEdit={cancelEdit}
          onConfirmEdit={confirmEdit}
          compose={compose}
          attachmentManager={attachmentManager}
          recorder={recorder}
          audioGate={audioGate}
          audioRecovery={audioRecovery}
          onRetryAudio={handleRetryAudio}
        />
      ) : null}

      {/* Confirmation Modals */}
      <TruncateConfirmModal
        isOpen={truncateModal.isOpen}
        targetMessageId={truncateModal.targetId}
        actionType={truncateModal.actionType}
        onConfirm={handleConfirmTruncate}
        onClose={() => setTruncateModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <BranchConfirmModal
        isOpen={branchModal.isOpen}
        targetMessage={branchModal.targetMessage}
        locked={busy}
        onConfirm={handleConfirmBranch}
        onClose={() => {
          // R5-A2: explicit modal close revokes the per-invocation caller — a
          // later clear-retry may unlock but must NOT navigate.
          if (branchCallerTokenRef.current) branchCallerTokenRef.current.revoked = true;
          branchCallerTokenRef.current = null;
          setBranchModal({ isOpen: false, targetMessage: null });
        }}
      />
    </div>
  );
}
