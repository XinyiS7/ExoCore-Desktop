import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { isG045AgentType } from '../chat/queries';
import { toAppApiError } from '../chat/api';
import { ErrorState, LoadingState } from '../../shared/AsyncState';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { MoreMenu } from '../../shell/PrimaryNavigation';
import { isValidPresetId, useAgentPresetQuery } from '../agents/queries';
import { toHeartbeatApiError } from './api';
import { useHeartbeatQueueQuery } from './queries';
import { HeartbeatMailbox } from './HeartbeatMailbox';
import { HeartbeatLedger } from './HeartbeatLedger';
import { HeartbeatEventDetail } from './HeartbeatEventDetail';
import type { HeartbeatQueueSummary } from './types';

/** Distinct invalid-URL state — no request is issued for bad route params. */
function InvalidAgentState() {
  useDocumentTitle('Agent 不存在');
  return (
    <div className="app-page app-page--center">
      <div className="app-error-page" role="alert">
        <p className="app-error-title">无效的 Agent 地址</p>
        <p className="app-error-hint">Agent 编号必须是正整数。</p>
        <Link className="app-btn" to="/agents">
          Agent Hub
        </Link>
      </div>
    </div>
  );
}

/** 404: the preset is hidden/absent from the visible-only queryset. */
function AgentMissingState() {
  useDocumentTitle('Agent 不存在');
  return (
    <div className="app-error-page" role="alert">
      <p className="app-error-title">Agent 不存在或未公开</p>
      <p className="app-error-hint">返回 Agent Hub 查看可见的 Agent。</p>
      <Link className="app-btn" to="/agents">
        Agent Hub
      </Link>
    </div>
  );
}

/** Non-G045 Agent visited directly: not eligible for heartbeat. */
function AgentNotEligibleState({ presetId }: { presetId: number }) {
  useDocumentTitle('心跳功能不可用');
  return (
    <div className="app-page app-page--center">
      <div className="app-error-page" role="alert">
        <p className="app-error-title">该 Agent 不支持心跳</p>
        <p className="app-error-hint">心跳功能仅适用于阿莱（G045）。</p>
        <Link className="app-btn" to={`/agents/${presetId}`}>
          返回 Agent Profile
        </Link>
      </div>
    </div>
  );
}

export function AgentHeartbeatPage() {
  const { presetId } = useParams();
  if (!isValidPresetId(presetId)) return <InvalidAgentState />;
  return <AgentHeartbeatDetail presetId={Number(presetId)} />;
}

function AgentHeartbeatDetail({ presetId }: { presetId: number }) {
  const presetQuery = useAgentPresetQuery(presetId);
  const preset = presetQuery.data;
  const isG045 = preset ? isG045AgentType(preset.agent_type) : false;

  // Only launch Heartbeat queue query if confirmed G045
  const queueQuery = useHeartbeatQueueQuery(presetId, isG045);

  const [selectedSessionUuid, setSelectedSessionUuid] = useState<string | null>(null);

  // Clear selection if route preset changes
  useEffect(() => {
    setSelectedSessionUuid(null);
  }, [presetId]);

  const pageTitle = preset?.name
    ? `${preset.name} · Heartbeat Ledger`
    : 'Heartbeat Ledger';
  useDocumentTitle(pageTitle);

  if (presetQuery.isPending) {
    return (
      <div className="app-page">
        <header className="app-topbar app-topbar--detail">
          <Link to={`/agents/${presetId}`} className="app-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Agent Profile
          </Link>
          <div className="app-topbar-title app-topbar-title--detail">
            <h1 className="app-h1">Heartbeat Ledger</h1>
          </div>
        </header>
        <div className="app-scroll">
          <LoadingState label="正在加载 Agent 详情…" />
        </div>
      </div>
    );
  }

  if (presetQuery.isError) {
    const is404 = toAppApiError(presetQuery.error).status === 404;
    return (
      <div className="app-page">
        <header className="app-topbar app-topbar--detail">
          <Link to="/agents" className="app-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Agent Hub
          </Link>
        </header>
        <div className="app-scroll">
          {is404 ? (
            <AgentMissingState />
          ) : (
            <ErrorState
              title="Agent 详情加载失败"
              detail={toAppApiError(presetQuery.error).message}
              onRetry={() => void presetQuery.refetch()}
            />
          )}
        </div>
      </div>
    );
  }

  if (!isG045) {
    return <AgentNotEligibleState presetId={presetId} />;
  }

  return (
    <div className="app-page">
      <header className="app-topbar app-topbar--detail">
        <Link to={`/agents/${presetId}`} className="app-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Agent Profile
        </Link>
        <div className="app-topbar-title app-topbar-title--detail">
          <h1 className="app-h1">Heartbeat Ledger</h1>
          <span className="app-topbar-sub">
            <span className="app-chip agent-chip-clamp">{preset?.name || `Agent #${presetId}`}</span>
            <span className="app-phase-chip app-phase-chip--g045">g045</span>
          </span>
        </div>
        <MoreMenu className="app-more--top" />
      </header>

      <div className="app-scroll">
        <div className="heartbeat-page">
          {/* Section A: Heartbeat 状态 (one next-auto-heartbeat display) */}
          <HeartbeatStatusSection
            queue={queueQuery.data}
            isLoading={queueQuery.isPending}
            isError={queueQuery.isError}
            error={queueQuery.error}
            onRetry={() => void queueQuery.refetch()}
          />

          {/* Section B: 心跳信箱与用户指定唤醒 */}
          <HeartbeatMailbox
            presetId={presetId}
            queue={queueQuery.data}
            isLoading={queueQuery.isPending}
            isError={queueQuery.isError}
            error={queueQuery.error}
            onRetry={() => void queueQuery.refetch()}
          />

          {/* Section C: Heartbeat Ledger list & detail */}
          <div className="heartbeat-ledger-split">
            <div className="heartbeat-ledger-main">
              <HeartbeatLedger
                presetId={presetId}
                selectedSessionUuid={selectedSessionUuid}
                onSelectSession={setSelectedSessionUuid}
              />
            </div>
            {selectedSessionUuid ? (
              <HeartbeatEventDetail
                presetId={presetId}
                sessionUuid={selectedSessionUuid}
                onClose={() => setSelectedSessionUuid(null)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface HeartbeatStatusSectionProps {
  queue: HeartbeatQueueSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
}

function HeartbeatStatusSection({
  queue,
  isLoading,
  isError,
  error,
  onRetry,
}: HeartbeatStatusSectionProps) {
  if (isLoading) {
    return (
      <section className="heartbeat-section" aria-labelledby="heartbeat-status-title">
        <h2 id="heartbeat-status-title" className="app-h2">
          心跳状态
        </h2>
        <LoadingState label="正在加载心跳状态…" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="heartbeat-section" aria-labelledby="heartbeat-status-title">
        <h2 id="heartbeat-status-title" className="app-h2">
          心跳状态
        </h2>
        <ErrorState
          title="心跳状态加载失败"
          detail={toHeartbeatApiError(error).message}
          onRetry={onRetry}
        />
      </section>
    );
  }

  if (!queue) return null;

  // Plan §2.2:
  // - auto_enabled=true 且 next_auto != null：显示 next_auto.effective_local；
  // - 自动心跳关闭：显示“自动心跳未启用”；
  // - 自动心跳开启但尚无 row：显示“尚未排定”；
  // - paused_until_local 非空时，可在次级文案显示“暂停至 …”，但不得显示第二个“下一次”主时间；
  // - 用户指定唤醒在下方单独展示，不参与该主时间计算。
  let nextAutoText: string;
  if (!queue.autoEnabled) {
    nextAutoText = '自动心跳未启用';
  } else if (queue.nextAuto && queue.nextAuto.effectiveLocal) {
    nextAutoText = queue.nextAuto.effectiveLocal;
  } else {
    nextAutoText = '尚未排定';
  }

  return (
    <section className="heartbeat-section" aria-labelledby="heartbeat-status-title">
      <div className="heartbeat-section-heading">
        <h2 id="heartbeat-status-title" className="app-h2">
          心跳状态
        </h2>
      </div>

      <div className="heartbeat-status-card">
        <span className="heartbeat-status-label">下次自动心跳</span>
        <span className="heartbeat-main-time">{nextAutoText}</span>
        {queue.pausedUntilLocal ? (
          <span className="heartbeat-sub-hint">
            暂停至 {queue.pausedUntilLocal}
          </span>
        ) : null}
      </div>
    </section>
  );
}
