import { useEffect, useState, useMemo } from 'react';
import { Clock, Users, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useVisiblePresetsQuery } from '../chat/queries';
import type { AgentPresetRow } from '../chat/types';
import { useSystemConfigQuery, useUpdateSystemConfigMutation } from './queries';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { ErrorState, LoadingState } from '../../shared/AsyncState';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function isValidG045Id(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}

export function RoutinePanel() {
  useDocumentTitle('例行设置');

  const presetsQuery = useVisiblePresetsQuery();
  const configQuery = useSystemConfigQuery();
  const updateMutation = useUpdateSystemConfigMutation();

  // Extract g045 agents from canonical presets
  const g045Agents = useMemo(() => {
    if (!presetsQuery.data || !Array.isArray(presetsQuery.data)) return [];
    return presetsQuery.data.filter((p: AgentPresetRow) => p.agent_type === 'g045');
  }, [presetsQuery.data]);

  // Contract invariant: exactly one valid G045 preset may exist
  const isContractError = useMemo(() => {
    if (g045Agents.length >= 2) return true;
    if (g045Agents.length === 1) {
      return !isValidG045Id(g045Agents[0].id);
    }
    return false;
  }, [g045Agents]);

  const canonicalG045 = g045Agents.length === 1 && !isContractError ? g045Agents[0] : null;

  // Local draft of canonical g045 enabled state
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync draft from config when loaded (unless user is editing)
  useEffect(() => {
    if (configQuery.data && !hasUserEdited && canonicalG045) {
      const raw =
        configQuery.data.self_check_preset_ids ??
        configQuery.data.deep_org_preset_ids ??
        [];
      const valid = Array.isArray(raw)
        ? raw.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
        : [];
      setIsEnabled(valid.includes(canonicalG045.id));
    }
  }, [configQuery.data, hasUserEdited, canonicalG045]);

  const handleToggle = () => {
    setHasUserEdited(true);
    setSaveSuccess(false);
    setSaveError(null);
    setIsEnabled((prev) => !prev);
  };

  const handleSave = async () => {
    if (!canonicalG045 || isContractError) return;
    setSaveSuccess(false);
    setSaveError(null);

    const targetIds = isEnabled ? [canonicalG045.id] : [];

    try {
      await updateMutation.mutateAsync({
        self_check_preset_ids: targetIds,
        deep_org_preset_ids: targetIds,
      });
      await configQuery.refetch();
      setHasUserEdited(false);
      setSaveSuccess(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : '保存例行配置失败，请检查网络后重试';
      setSaveError(msg);
    }
  };

  if (presetsQuery.isPending || configQuery.isPending) {
    return (
      <div className="settings-panel">
        <LoadingState label="加载例行配置与代理列表..." />
      </div>
    );
  }

  if (presetsQuery.isError || configQuery.isError) {
    const err = presetsQuery.error || configQuery.error;
    return (
      <div className="settings-panel">
        <ErrorState
          title="无法加载例行任务配置"
          detail={err instanceof Error ? err.message : '请检查网络连接'}
          onRetry={() => {
            presetsQuery.refetch();
            configQuery.refetch();
          }}
        />
      </div>
    );
  }

  const config = configQuery.data || {};
  const activeStart = typeof config.active_start === 'string' ? config.active_start : null;
  const activeEnd = typeof config.active_end === 'string' ? config.active_end : null;
  const weekday =
    typeof config.deep_org_weekday === 'number' &&
    config.deep_org_weekday >= 0 &&
    config.deep_org_weekday <= 6
      ? WEEKDAYS[config.deep_org_weekday]
      : null;
  const hour =
    typeof config.deep_org_hour === 'number' &&
    config.deep_org_hour >= 0 &&
    config.deep_org_hour <= 23
      ? `${String(config.deep_org_hour).padStart(2, '0')}:00`
      : null;

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h1 className="settings-panel-title">后台例行</h1>
        <p className="settings-panel-desc">
          配置自检与深度整理共用的 G045 助手，并查看当前的系统调度时间窗口。
        </p>
      </div>

      <div className="settings-card-stack">
        {/* Status Banners */}
        {saveSuccess ? (
          <div className="app-banner" role="status" style={{ borderLeftColor: 'var(--v4-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="var(--v4-accent)" />
              <span style={{ color: 'var(--v4-text)' }}>例行任务配置保存成功</span>
            </div>
          </div>
        ) : null}

        {saveError ? (
          <div className="app-banner app-banner--error" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} color="var(--v4-danger)" />
              <span>{saveError}</span>
            </div>
          </div>
        ) : null}

        {/* G045 Agent Selection Card */}
        <section className="settings-card" aria-labelledby="g045-heading">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Users size={18} />
            </div>
            <div>
              <h2 id="g045-heading" className="settings-card-title">
                Self Check & Deep Organize 参与助手
              </h2>
              <p className="settings-card-desc">
                自检任务与深度整理共用同一选定的 G045 智能助手；仅系统唯一 G045 预设支持参与后台例行。
              </p>
            </div>
          </div>

          {isContractError ? (
            <div className="app-banner app-banner--error" role="alert" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} color="var(--v4-danger)" />
                <span>系统契约异常：系统仅支持唯一的 G045 助手，当前预设数据异常（存在多个 G045 或非法 ID），已阻止例行配置更改。</span>
              </div>
            </div>
          ) : !canonicalG045 ? (
            <div className="routine-agent-checklist" role="group" aria-label="G045 助手状态">
              <p className="app-muted" style={{ padding: '16px 0', textAlign: 'center' }}>
                当前系统无可用 G045 助手预设
              </p>
            </div>
          ) : (
            <>
              <div className="routine-agent-checklist" role="group" aria-label="G045 助手启用设置">
                <label className={`routine-agent-row${isEnabled ? ' routine-agent-row--checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={handleToggle}
                    className="routine-agent-checkbox"
                  />
                  <div className="routine-agent-info">
                    <span className="routine-agent-name">{canonicalG045.name}</span>
                    {canonicalG045.description ? (
                      <span className="routine-agent-desc">{canonicalG045.description}</span>
                    ) : null}
                  </div>
                  <span className="app-phase-chip app-phase-chip--g045">G045</span>
                </label>
              </div>

              <div className="settings-card-actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="app-btn app-btn--primary"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  <Save size={14} aria-hidden="true" />
                  <span>{updateMutation.isPending ? '保存中...' : '保存例行配置'}</span>
                </button>
              </div>
            </>
          )}
        </section>

        {/* Schedule Preview Card (Read-only) */}
        <section className="settings-card" aria-labelledby="schedule-heading">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Clock size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 id="schedule-heading" className="settings-card-title">
                  调度计划预览
                </h2>
                <span className="app-chip">只读展示</span>
              </div>
              <p className="settings-card-desc">
                系统自检与深度整理执行时间窗口（时间设置当前不可用，由后台配置调度）
              </p>
            </div>
          </div>

          <div className="schedule-preview-grid">
            <div className="schedule-preview-item">
              <span className="schedule-preview-label">每日活跃区间 (Active Window)</span>
              <span className="schedule-preview-val">
                {activeStart && activeEnd ? `${activeStart} – ${activeEnd}` : '未配置 (未知)'}
              </span>
            </div>

            <div className="schedule-preview-item">
              <span className="schedule-preview-label">每周深度整理 (Deep Organize)</span>
              <span className="schedule-preview-val">
                {weekday && hour ? `${weekday} ${hour}` : '未配置 (未知)'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
