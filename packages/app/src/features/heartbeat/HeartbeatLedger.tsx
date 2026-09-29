import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateTime } from '../chat/time';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { toHeartbeatApiError } from './api';
import { useHeartbeatEventsQuery } from './queries';
import type { HeartbeatEventListItem } from './types';

interface HeartbeatLedgerProps {
  presetId: number;
  selectedSessionUuid: string | null;
  onSelectSession: (uuid: string) => void;
}

const PAGE_SIZE = 20;

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

export function HeartbeatLedger({
  presetId,
  selectedSessionUuid,
  onSelectSession,
}: HeartbeatLedgerProps) {
  const [offset, setOffset] = useState(0);

  // Reset pagination if preset changes
  useEffect(() => {
    setOffset(0);
  }, [presetId]);

  const eventsQuery = useHeartbeatEventsQuery(presetId, PAGE_SIZE, offset);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalCount = eventsQuery.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasMore = eventsQuery.data?.hasMore ?? false;
  const canPrev = offset > 0;
  const canNext = hasMore || offset + PAGE_SIZE < totalCount;

  return (
    <section className="heartbeat-section" aria-labelledby="heartbeat-ledger-title">
      <div className="heartbeat-section-heading">
        <h2 id="heartbeat-ledger-title" className="app-h2">
          心跳账本
        </h2>
        {totalCount > 0 ? (
          <span className="app-muted heartbeat-ledger-count">
            共 {totalCount} 条记录
          </span>
        ) : null}
      </div>

      {eventsQuery.isPending ? (
        <LoadingState label="正在加载心跳记录…" />
      ) : eventsQuery.isError ? (
        <ErrorState
          title="心跳账本加载失败"
          detail={toHeartbeatApiError(eventsQuery.error).message}
          onRetry={() => void eventsQuery.refetch()}
        />
      ) : eventsQuery.data.events.length === 0 ? (
        <EmptyState
          title="暂无心跳记录"
          hint="心跳任务触发执行后，执行记录会完整呈现在这里。"
        />
      ) : (
        <div className="heartbeat-ledger-container">
          <ul className="heartbeat-ledger-list" aria-label="心跳事件记录列表">
            {eventsQuery.data.events.map((event: HeartbeatEventListItem) => {
              const isSelected = event.sessionUuid === selectedSessionUuid;
              return (
                <li key={event.sessionUuid} className="heartbeat-ledger-item">
                  <button
                    type="button"
                    className={`heartbeat-ledger-row ${
                      isSelected ? 'heartbeat-ledger-row--selected' : ''
                    }`}
                    onClick={() => onSelectSession(event.sessionUuid)}
                    aria-pressed={isSelected}
                  >
                    <div className="heartbeat-ledger-row-header">
                      <span className={statusBadgeClass(event.status)}>
                        {event.status}
                      </span>
                      <span className="app-chip app-chip--subtle">
                        {formatLaunchSource(event.launchSource)}
                      </span>
                      {event.domain ? (
                        <span className="app-chip app-chip--subtle">
                          {event.domain}
                        </span>
                      ) : null}
                      <span className="heartbeat-ledger-time">
                        {formatDateTime(event.completedAt || event.startedAt)}
                      </span>
                    </div>
                    <p className="heartbeat-ledger-summary">
                      {event.content || '（无摘要）'}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Pagination controls */}
          <div className="heartbeat-pagination" aria-label="心跳账本分页">
            <button
              type="button"
              className="app-btn app-btn-ghost heartbeat-pagination-btn"
              disabled={!canPrev}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              aria-label="上一页"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              上一页
            </button>
            <span className="heartbeat-pagination-info">
              第 {currentPage} 页 / 共 {totalPages} 页
            </span>
            <button
              type="button"
              className="app-btn app-btn-ghost heartbeat-pagination-btn"
              disabled={!canNext}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              aria-label="下一页"
            >
              下一页
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
