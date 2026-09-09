import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft } from 'lucide-react';
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
import { useConversationControls } from './controls/useConversationControls';
import { ProjectFilesDrawer } from './project/ProjectFilesDrawer';
import { TacticalHud } from './hud/TacticalHud';
import { HudStateStrip } from './hud/HudStateStrip';
import { useCacheControl } from './control/useCacheControl';
import { useAura } from './aura/useAura';
import { AuraStage } from './aura/AuraStage';

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
  // P1D: one live catalog and one Conversation-local control owner. The
  // ref-backed lock closes same-tick HUD changes at runtime/audio boundaries.
  const catalogQuery = useModelCatalogQuery();
  const activePreset =
    conversationQuery.data?.agentPresetId != null && presetsQuery.data
      ? (presetsQuery.data.find((p) => p.id === conversationQuery.data?.agentPresetId) ?? null)
      : null;
  const controlLockRef = useRef(false);
  const cacheOperationPendingRef = useRef(false);
  const thinkingOperationPendingRef = useRef(false);
  const controls = useConversationControls({
    conversationId: id,
    conversation: conversationQuery.data,
    preset: activePreset,
    presetReady:
      conversationQuery.data?.agentPresetId == null || presetsQuery.data !== undefined,
    catalog: catalogQuery.data,
    lockedRef: controlLockRef,
    externalOperationPendingRef: cacheOperationPendingRef,
    thinkingOperationPendingRef,
  });
  const audioGate = useAudioTargetGate(catalogQuery.data, controls.target);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingAnchor = useRef<{ top: number; height: number } | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const scrollRouteRef = useRef<{
    conversationId: number;
    initialized: boolean;
    userScrolled: boolean;
    canonicalRevision: number | null;
  }>({ conversationId: id, initialized: false, userScrolled: false, canonicalRevision: null });
  if (scrollRouteRef.current.conversationId !== id) {
    scrollRouteRef.current = {
      conversationId: id,
      initialized: false,
      userScrolled: false,
      canonicalRevision: null,
    };
    isNearBottomRef.current = true;
  }
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);
  const persistedRowsRef = useRef<ReadonlyArray<MessageView>>([]);
  /** Caller-side route identity for branch navigation guards (§6.3). */
  const pageEpochRef = useRef(0);
  const pageConversationIdRef = useRef(id);
  pageConversationIdRef.current = id;
  const projectInsertKeyRef = useRef(0);
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);
  const [hudOpen, setHudOpen] = useState(false);
  const [controlNotice, setControlNotice] = useState<string | null>(null);
  const [pendingProjectInsert, setPendingProjectInsert] = useState<{
    key: number;
    path: string;
    conversationId: number;
    projectId: number;
  } | null>(null);
  const aura = useAura(id, {
    theme: 'dark',
    onStorageWarning: setControlNotice,
  });
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
    setProjectDrawerOpen(false);
    setHudOpen(false);
    setControlNotice(null);
    setPendingProjectInsert(null);
    setIsAwayFromBottom(false);
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
    telemetryProjection,
    runtimeNotice,
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
    dismissRuntimeNotice,
    retryDraftCleanup,
    branchFrom,
    isOperationPending,
  } = useChatRuntime({
    conversationId: id,
    isNearBottomRef,
    dispatchSettings: controls.dispatchSettings,
    persistedRowsRef,
    onAttemptOutcome: audioRecovery.onRuntimeOutcome,
    isExternalOperationPending: () =>
      cacheOperationPendingRef.current ||
      thinkingOperationPendingRef.current ||
      audioRecovery.isUploading(),
    onNavigateToConversation: (conversationId: number) => {
      // At most one later navigation, only after the exact source clear
      // returned `cleared` AND this route caller is still current (§6.2).
      if (pageEpochRef.current === 0) return;
      navigate(`/chat/${conversationId}`);
    },
  });
  const thinkingPending = thinkingOperationPendingRef.current;
  const cacheControl = useCacheControl(id, {
    runtimeUncertain: busy || audioRecovery.isUploading() || thinkingPending,
    isRuntimeUncertain: () =>
      isOperationPending() || audioRecovery.isUploading() || thinkingOperationPendingRef.current,
    operationPendingRef: cacheOperationPendingRef,
  });
  const controlsPending = thinkingPending || cacheControl.isOperationPending();
  controlLockRef.current = busy || audioRecovery.isUploading();

  const handleRetryAudio = () => {
    void audioRecovery.retry({
      dispatchOrdinary: sendMessage,
      dispatchReplacement: retryRecoveredTurn,
      runtimeBusy: busy || controlsPending,
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

  // Track the sole timeline scroll owner. Reaching bottom consumes the exact
  // pending canonical reconciliation; repeated scroll events are no-ops once
  // the runtime advances its synchronous stage out of `idle`.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    scrollRouteRef.current.userScrolled = true;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceToBottom < 80;
    isNearBottomRef.current = nearBottom;
    setIsAwayFromBottom(!nearBottom);
    if (nearBottom && hasPendingReconcile) void applyPendingReconcile();
  }, [applyPendingReconcile, hasPendingReconcile]);

  // First canonical page: after layout, initialize this route identity at the
  // latest row exactly once unless the user has already interacted with the
  // scroll owner. Later canonical replacements follow only a near-bottom
  // reader; older-page prepends retain the anchor path below.
  useLayoutEffect(() => {
    if (merged === undefined) return;
    const el = scrollRef.current;
    const route = scrollRouteRef.current;
    if (!el || route.conversationId !== id) return;

    if (!route.initialized) {
      route.initialized = true;
      route.canonicalRevision = pagesQuery.dataUpdatedAt;
      if (route.userScrolled) return;
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true;
      setIsAwayFromBottom(false);
      return;
    }

    const rowsChanged = route.canonicalRevision !== pagesQuery.dataUpdatedAt;
    route.canonicalRevision = pagesQuery.dataUpdatedAt;
    if (
      rowsChanged &&
      pendingAnchor.current === null &&
      !pagesQuery.isFetchingNextPage &&
      isNearBottomRef.current
    ) {
      el.scrollTop = el.scrollHeight;
      setIsAwayFromBottom(false);
    }
  }, [id, merged, pagesQuery.dataUpdatedAt, pagesQuery.isFetchingNextPage]);

  // Auto-scroll when new content streams in only if the reader stayed near
  // bottom. Scrolled-up reading position is never displaced.
  useEffect(() => {
    if (
      scrollRouteRef.current.initialized &&
      isNearBottomRef.current &&
      scrollRef.current
    ) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAwayFromBottom(false);
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
  const endpointLabel =
    controls.compatibleEndpoints.find((endpoint) => endpoint.id === controls.target.endpoint)?.name ?? '';
  const cacheSummary =
    cacheControl.presentation.state === 'loading'
      ? '缓存读取中'
      : cacheControl.presentation.state === 'error'
        ? '缓存不可用'
        : cacheControl.presentation.state === 'active'
          ? `缓存 ${Math.max(0, cacheControl.presentation.cache.remainingSeconds ?? 0)}s`
          : cacheControl.presentation.state === 'snapshot_only'
            ? '本地快照'
            : '无缓存';

  const handleLoadMore = () => {
    const el = scrollRef.current;
    if (!el || pendingAnchor.current !== null || pagesQuery.isFetchingNextPage) return;
    pendingAnchor.current = { top: el.scrollTop, height: el.scrollHeight };
    void pagesQuery.fetchNextPage();
  };

  const handleScrollToLatest = async () => {
    // U-06: move the sole timeline scroll owner to its CURRENT bottom
    // immediately — never wait on the pending canonical fetch. The pending
    // reconciliation is consumed next, exactly once; a canonical replacement
    // landing later follows the reader only while it stays near bottom.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    isNearBottomRef.current = true;
    setIsAwayFromBottom(false);
    if (hasPendingReconcile) await applyPendingReconcile();
  };

  // Request-side action-target guards (§5.1/§5.5, C1B-R1-05): every
  // edit/regenerate/branch dispatch re-validates the target against the
  // CURRENT canonical persisted rows of this conversation before POST.
  const handleEditMessage = (msgId: number, content: string, isLatestUser: boolean) => {
    if (busy || controlsPending) return;
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
    if (busy || controlsPending) return;
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
    if (busy || controlsPending) return;
    if (!findPersistedMessage(merged?.rows, truncateModal.targetId, 'user')) return;
    if (truncateModal.actionType === 'edit') {
      startEdit(truncateModal.targetId, truncateModal.targetContent);
    } else {
      void regenerate(truncateModal.targetId);
    }
  };

  const handleBranchMessage = (msgId: number, snippet: string) => {
    if (busy || controlsPending) return;
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
      <AuraStage
        paletteId={aura.selectedId}
        theme="dark"
        generating={status === 'streaming' || status === 'polling'}
      />
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
        <HudStateStrip
          model={controls.target.model}
          endpointLabel={endpointLabel}
          thinkingLabel={controls.thinkingLevel}
          transport={transport}
          cacheSummary={cacheSummary}
          cacheReleaseEligible={
            cacheControl.presentation.state === 'active' ||
            cacheControl.presentation.state === 'snapshot_only'
          }
          cacheReleaseDisabled={cacheControl.mutationsLocked}
          cacheReleasing={cacheControl.releasing}
          onReleaseCache={cacheControl.release}
          auraLabel={aura.palettes.find((palette) => palette.id === aura.selectedId)?.label ?? '默认'}
          onOpen={() => setHudOpen(true)}
        />
        {conversation?.projectId ? (
          <button
            type="button"
            className="app-btn app-btn-ghost app-btn-sm"
            onClick={() => setProjectDrawerOpen(true)}
            aria-label="打开项目文件"
          >
            项目文件
          </button>
        ) : null}
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
        <div className="app-scroll-stage">
          {/* The sole timeline scroll owner; the stage stays a passive flex
              wrapper so the floating affordance anchors to the timeline
              viewport bottom, above the actual composer, with no secondary
              scroll owner and no hard-coded composer height. */}
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
                  isRunActive={busy || controlsPending}
                  onEditMessage={handleEditMessage}
                  onRegenerateMessage={handleRegenerateMessage}
                  onBranchMessage={handleBranchMessage}
                />
              )
            ) : null}
          </div>

          {isAwayFromBottom ? (
            <button
              type="button"
              className="app-scroll-latest"
              onClick={() => void handleScrollToLatest()}
              aria-label="返回最新消息"
              title="返回最新消息"
            >
              <ArrowDown size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      {runtimeNotice || controlNotice || controls.storageWarning ? (
        <div className="app-runtime-notice" role="status">
          <span>{runtimeNotice ?? controlNotice ?? controls.storageWarning}</span>
          <button
            type="button"
            onClick={() => {
              dismissRuntimeNotice();
              setControlNotice(null);
              controls.dismissStorageWarning();
            }}
            aria-label="关闭控制提示"
          >
            ×
          </button>
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
        onApplyPendingReconcile={() => void handleScrollToLatest()}
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
          busy={busy || controlsPending}
          dispatchSettings={controls.dispatchSettings}
          targetNotice={controls.targetNotice}
          projectId={conversation.projectId}
          pendingProjectInsert={pendingProjectInsert}
          onProjectInsertConsumed={() => setPendingProjectInsert(null)}
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

      <TacticalHud
        key={id}
        open={hudOpen}
        onClose={() => setHudOpen(false)}
        runtimeUncertain={busy || audioRecovery.isUploading() || controlsPending}
        target={controls.target}
        onTargetChange={controls.setTarget}
        transport={transport}
        onTransportChange={setTransport}
        thinkingLevel={conversation?.thinkingLevel ?? null}
        thinkingSaveState={controls.thinkingSaveState}
        onThinkingChange={controls.saveThinkingLevel}
        onThinkingRetry={controls.retryThinkingSave}
        cacheControl={cacheControl}
        cacheEnabled={controls.preferences.cacheEnabled}
        onCacheEnabledChange={controls.setCacheEnabled}
        sessionType={controls.preferences.sessionType}
        onSessionTypeChange={controls.setSessionType}
        memoryInjectionEnabled={controls.preferences.memoryInjectionEnabled}
        onMemoryInjectionChange={controls.setMemoryInjectionEnabled}
        isG045={conversation?.agentType === 'g045'}
        aura={aura}
        telemetry={telemetryProjection}
        onStorageWarning={setControlNotice}
      />

      <ProjectFilesDrawer
        projectId={conversation?.projectId ?? null}
        isOpen={projectDrawerOpen}
        onClose={() => setProjectDrawerOpen(false)}
        onInsertPath={(path) => {
          if (!conversation?.projectId) return;
          setPendingProjectInsert({
            key: ++projectInsertKeyRef.current,
            path,
            conversationId: id,
            projectId: conversation.projectId,
          });
          setProjectDrawerOpen(false);
        }}
      />

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
        locked={busy || controlsPending}
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
