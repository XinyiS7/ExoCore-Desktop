import { Link } from 'react-router-dom';
import { isG045AgentType, useVisiblePresetsQuery } from '../chat/queries';
import { toAppApiError } from '../chat/api';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { MoreMenu } from '../../shell/PrimaryNavigation';
import { orderVisiblePresets } from './projection';

/**
 * Agent Hub (L1, Chat area) — deterministic browse surface (Plan D3/§4.1).
 * Read-only: no create/delete/edit controls, no drag order, no Memory
 * fan-out, no lifecycle actions. Cards navigate to the canonical Profile.
 */
export function AgentHubPage() {
  useDocumentTitle('Agent Hub');
  const presetsQuery = useVisiblePresetsQuery();

  return (
    <div className="app-page">
      <header className="app-topbar">
        <div className="app-topbar-title">
          <h1 className="app-h1">Agent Hub</h1>
          <span className="app-topbar-sub">可见 Agent 预设 · 只读浏览</span>
        </div>
        <div className="app-topbar-actions">
          <MoreMenu className="app-more--top" />
        </div>
      </header>

      <div className="app-scroll">
        {presetsQuery.isPending ? (
          <LoadingState label="正在加载 Agent…" />
        ) : presetsQuery.isError ? (
          <ErrorState
            title="Agent 列表加载失败"
            detail={toAppApiError(presetsQuery.error).message}
            onRetry={() => void presetsQuery.refetch()}
          />
        ) : (presetsQuery.data ?? []).length === 0 ? (
          <EmptyState title="暂无可见 Agent" hint="后端未返回任何可见的 Agent 预设。" />
        ) : (
          <ul className="agent-hub-grid" aria-label="Agent 预设列表">
            {orderVisiblePresets(presetsQuery.data ?? []).map((preset) => (
              <li key={preset.id}>
                <Link to={`/agents/${preset.id}`} className="agent-card">
                  <span className="agent-card-name">
                    {preset.name || `Agent #${preset.id}`}
                    {isG045AgentType(preset.agent_type) ? (
                      <span className="app-phase-chip app-phase-chip--g045">g045</span>
                    ) : null}
                  </span>
                  <span className="agent-card-type">{preset.agent_type}</span>
                  <span className="agent-card-desc">{preset.description ?? '暂无描述'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
