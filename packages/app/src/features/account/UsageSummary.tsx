import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { toAppApiError } from '../chat/api';
import { computeUsageTotals, formatNumber, getInitialAnchor, shiftPeriod } from './projection';
import { useUsageQuery } from './queries';
import type { UsageMode } from './types';

export function UsageSummary() {
  const [mode, setMode] = useState<UsageMode>('week');
  const [anchor, setAnchor] = useState<string>(() => getInitialAnchor('week'));

  const usageQuery = useUsageQuery(mode, anchor);

  const handleModeChange = (newMode: UsageMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setAnchor(getInitialAnchor(newMode));
  };

  const handlePrev = () => {
    setAnchor((prev) => shiftPeriod(prev, mode, -1));
  };

  const handleNext = () => {
    setAnchor((prev) => shiftPeriod(prev, mode, 1));
  };

  const data = usageQuery.data;

  const totals = useMemo(() => {
    return computeUsageTotals(data?.daily ?? []);
  }, [data]);

  // Flatten detail rows: preserve backend order
  const detailRows = useMemo(() => {
    if (!data?.daily) return [];
    const rows: Array<{
      key: string;
      date: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      conversationCount: number;
    }> = [];

    for (let dayIdx = 0; dayIdx < data.daily.length; dayIdx++) {
      const day = data.daily[dayIdx];
      for (let modelIdx = 0; modelIdx < day.models.length; modelIdx++) {
        const m = day.models[modelIdx];
        rows.push({
          key: `${day.date}-${m.model}-${dayIdx}-${modelIdx}`,
          date: day.date,
          model: m.model,
          inputTokens: m.input_tokens,
          outputTokens: m.output_tokens,
          cachedTokens: m.cached_tokens,
          conversationCount: m.conversation_count,
        });
      }
    }

    return rows;
  }, [data]);

  const hasData = detailRows.length > 0;

  return (
    <section className="account-section" aria-labelledby="usage-heading">
      <div className="account-section-head">
        <div>
          <h2 id="usage-heading" className="app-h2">
            用量统计
          </h2>
          <span className="app-topbar-sub">Token 与会话用量明细</span>
        </div>

        <div className="usage-period-controls">
          <div className="usage-mode-toggle" role="radiogroup" aria-label="统计周期类型">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'week'}
              className={`usage-mode-btn${mode === 'week' ? ' usage-mode-btn--active' : ''}`}
              onClick={() => handleModeChange('week')}
            >
              周用量
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'month'}
              className={`usage-mode-btn${mode === 'month' ? ' usage-mode-btn--active' : ''}`}
              onClick={() => handleModeChange('month')}
            >
              30 日用量
            </button>
          </div>

          <div className="usage-nav-controls">
            <button
              type="button"
              className="app-icon-btn"
              onClick={handlePrev}
              aria-label="上一周期"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="usage-period-label">
              {data ? `${data.from} ~ ${data.to}` : anchor}
            </span>
            <button
              type="button"
              className="app-icon-btn"
              onClick={handleNext}
              aria-label="下一周期"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {usageQuery.isPending ? (
        <LoadingState label="正在加载用量数据…" />
      ) : usageQuery.isError ? (
        <ErrorState
          title="用量数据加载失败"
          detail={toAppApiError(usageQuery.error).message}
          onRetry={() => void usageQuery.refetch()}
        />
      ) : (
        <>
          {/* Summary Cards: 0 is real number 0 */}
          <div className="usage-summary-grid" aria-label="用量汇总">
            <div className="usage-metric-card">
              <span className="usage-metric-label">输入 Token</span>
              <span className="usage-metric-value">{formatNumber(totals.totalInput)}</span>
            </div>
            <div className="usage-metric-card">
              <span className="usage-metric-label">输出 Token</span>
              <span className="usage-metric-value">{formatNumber(totals.totalOutput)}</span>
            </div>
            <div className="usage-metric-card">
              <span className="usage-metric-label">缓存 Token</span>
              <span className="usage-metric-value">{formatNumber(totals.totalCached)}</span>
            </div>
            <div className="usage-metric-card">
              <span className="usage-metric-label">会话次数</span>
              <span className="usage-metric-value">
                {formatNumber(totals.totalConversations)}
              </span>
            </div>
          </div>

          {/* Details table or True Empty State */}
          {!hasData ? (
            <EmptyState
              title="当前周期暂无用量记录"
              hint="所选时间段内未产生任何模型的 Token 或会话消耗。"
            />
          ) : (
            <div className="usage-table-wrap">
              <table className="usage-table" aria-label="模型用量明细">
                <thead>
                  <tr>
                    <th scope="col">日期</th>
                    <th scope="col">模型</th>
                    <th scope="col" className="usage-num-cell">
                      输入 Token
                    </th>
                    <th scope="col" className="usage-num-cell">
                      输出 Token
                    </th>
                    <th scope="col" className="usage-num-cell">
                      缓存 Token
                    </th>
                    <th scope="col" className="usage-num-cell">
                      会话数
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row) => (
                    <tr key={row.key}>
                      <td className="usage-date-cell">{row.date}</td>
                      <td className="usage-model-cell" title={row.model}>
                        {row.model}
                      </td>
                      <td className="usage-num-cell">{formatNumber(row.inputTokens)}</td>
                      <td className="usage-num-cell">{formatNumber(row.outputTokens)}</td>
                      <td className="usage-num-cell">{formatNumber(row.cachedTokens)}</td>
                      <td className="usage-num-cell">
                        {formatNumber(row.conversationCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
