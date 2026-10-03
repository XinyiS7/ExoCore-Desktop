import { X } from 'lucide-react';
import { formatDateTime } from '../chat/time';
import { ErrorState, LoadingState } from '../../shared/AsyncState';
import { toHeartbeatApiError } from './api';
import { useHeartbeatEventDetailQuery } from './queries';

interface HeartbeatEventDetailProps {
  presetId: number;
  sessionUuid: string;
  onClose: () => void;
}

function formatLaunchSource(source: string): string {
  switch (source) {
    case 'user':
      return '用户指定';
    case 'auto':
      return '自动心跳';
    case 'agent':
      return 'Agent 发起';
    case 'notification':
      return '通知唤醒';
    default:
      return source;
  }
}

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'succeeded':
      return 'app-chip app-chip--success';
    case 'failed':
      return 'app-chip app-chip--danger';
    case 'running':
      return 'app-chip app-chip--accent';
    default:
      return 'app-chip app-chip--subtle';
  }
}

export function HeartbeatEventDetail({
  presetId,
  sessionUuid,
  onClose,
}: HeartbeatEventDetailProps) {
  const detailQuery = useHeartbeatEventDetailQuery(presetId, sessionUuid);
  const detailError = detailQuery.isError ? toHeartbeatApiError(detailQuery.error) : null;

  return (
    <aside
      className="heartbeat-detail-panel"
      role="region"
      aria-label="心跳记录详情"
    >
      <div className="heartbeat-detail-header">
        <div className="heartbeat-detail-title-group">
          <h3 className="heartbeat-detail-title">心跳记录详情</h3>
          <span className="heartbeat-detail-uuid" title={sessionUuid}>
            {sessionUuid}
          </span>
        </div>
        <button
          type="button"
          className="app-btn app-btn-ghost heartbeat-detail-close"
          onClick={onClose}
          aria-label="关闭详情"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="heartbeat-detail-scroll">
        {detailQuery.isPending ? (
          <LoadingState label="正在加载心跳记录详情…" />
        ) : detailError ? (
          <ErrorState
            title={
              detailError.status === 404 ? '心跳记录不存在' : '心跳记录详情加载失败'
            }
            detail={
              detailError.status === 404
                ? '该 Session 在心跳账本中没有对应记录。'
                : detailError.message
            }
            onRetry={() => void detailQuery.refetch()}
          />
        ) : detailQuery.data && detailQuery.data.presetId === presetId ? (
          <div className="heartbeat-detail-content">
            <div className="heartbeat-detail-meta">
              <div className="heartbeat-meta-row">
                <span className={statusBadgeClass(detailQuery.data.status)}>
                  {detailQuery.data.status}
                </span>
                <span className="app-chip app-chip--subtle">
                  {formatLaunchSource(detailQuery.data.launchSource)}
                </span>
                {detailQuery.data.domain ? (
                  <span className="app-chip app-chip--subtle">
                    {detailQuery.data.domain}
                  </span>
                ) : null}
                <span className="app-chip app-chip--subtle">
                  第 {detailQuery.data.attemptNumber} 次尝试
                </span>
              </div>

              <dl className="agent-facts heartbeat-detail-facts">
                <div className="agent-fact">
                  <dt className="agent-fact-label">开始时间</dt>
                  <dd className="agent-fact-value">
                    {formatDateTime(detailQuery.data.startedAt) || '未记录'}
                  </dd>
                </div>
                <div className="agent-fact">
                  <dt className="agent-fact-label">完成时间</dt>
                  <dd className="agent-fact-value">
                    {formatDateTime(detailQuery.data.completedAt) || '未记录'}
                  </dd>
                </div>
                {detailQuery.data.finalizationReason ? (
                  <div className="agent-fact">
                    <dt className="agent-fact-label">完结原因</dt>
                    <dd className="agent-fact-value">
                      {detailQuery.data.finalizationReason}
                    </dd>
                  </div>
                ) : null}
                {detailQuery.data.wakeUpTaskId ? (
                  <div className="agent-fact">
                    <dt className="agent-fact-label">WakeUp Task ID</dt>
                    <dd className="agent-fact-value">
                      #{detailQuery.data.wakeUpTaskId}
                    </dd>
                  </div>
                ) : null}
                {detailQuery.data.sourceConversationId ? (
                  <div className="agent-fact">
                    <dt className="agent-fact-label">来源会话 ID</dt>
                    <dd className="agent-fact-value">
                      #{detailQuery.data.sourceConversationId}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {/* 执行总结 / Content */}
            <div className="heartbeat-detail-section">
              <h4 className="heartbeat-detail-section-title">执行总结</h4>
              <div className="heartbeat-detail-text">
                {detailQuery.data.content || '（无总结内容）'}
              </div>
            </div>

            {/* Seed Message */}
            {detailQuery.data.seedMessage ? (
              <div className="heartbeat-detail-section">
                <h4 className="heartbeat-detail-section-title">
                  触发消息 (Seed Message)
                </h4>
                <div className="heartbeat-detail-text heartbeat-seed-box">
                  {detailQuery.data.seedMessage}
                </div>
              </div>
            ) : null}

            {/* Error Summary */}
            {detailQuery.data.errorSummary ? (
              <div className="heartbeat-detail-section">
                <h4 className="heartbeat-detail-section-title heartbeat-error-title">
                  错误摘要
                </h4>
                <pre className="heartbeat-detail-error">
                  {detailQuery.data.errorSummary}
                </pre>
              </div>
            ) : null}

            {/* Tool History */}
            {Array.isArray(detailQuery.data.toolHistory) &&
            detailQuery.data.toolHistory.length > 0 ? (
              <div className="heartbeat-detail-section">
                <h4 className="heartbeat-detail-section-title">
                  工具调用记录 ({detailQuery.data.toolHistory.length})
                </h4>
                <ul className="heartbeat-tool-list" aria-label="工具调用记录">
                  {detailQuery.data.toolHistory.map((item, idx) => {
                    const toolObj =
                      typeof item === 'object' && item !== null
                        ? (item as Record<string, unknown>)
                        : null;
                    const toolName =
                      toolObj && typeof toolObj.tool_name === 'string'
                        ? toolObj.tool_name
                        : toolObj && typeof toolObj.name === 'string'
                          ? toolObj.name
                          : `Step #${idx + 1}`;
                    return (
                      <li key={idx} className="heartbeat-tool-item">
                        <span className="heartbeat-tool-name">{toolName}</span>
                        <pre className="heartbeat-tool-body">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : detailQuery.data ? (
          <div className="heartbeat-detail-content" role="alert">
            <div className="heartbeat-detail-section">
              <h4 className="heartbeat-detail-section-title">记录归属不匹配</h4>
              <p className="heartbeat-detail-text">
                该心跳会话属于 Agent #{detailQuery.data.presetId}，不属于当前 Agent #{presetId}；已阻止展示其余内容。
              </p>
              <p className="app-muted">
                请从 Agent #{detailQuery.data.presetId} 的心跳账本打开该记录。
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
