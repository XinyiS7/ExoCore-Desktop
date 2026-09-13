import { useEffect, useState, useMemo } from 'react';
import {
  Cpu,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Check,
  Save,
  RotateCcw,
} from 'lucide-react';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { useModelCatalogQuery } from '../../shared/modelCatalog';
import { useUpdateRoleConfigMutation } from './queries';
import type { MainRoleDraft, RoleConfigPayload, SupportRoleDraft } from './types';
import { getErrorMessage } from './api';
import type { ModelCatalogModel, ModelCatalogEndpoint } from 'exo-shared/models';

interface SupportRoleMeta {
  key: 'general_sub_agent' | 'vision_helper' | 'grounding' | 'image_gen';
  title: string;
  description: string;
}

const SUPPORT_ROLE_DEFS: SupportRoleMeta[] = [
  {
    key: 'general_sub_agent',
    title: '通用子代理 (General Sub-Agent)',
    description: '负责执行多步拆解、常规子任务与背景资料探索。',
  },
  {
    key: 'vision_helper',
    title: '视觉解析助手 (Vision Helper)',
    description: '负责图像识别、截屏分析与多模态输入解析。',
  },
  {
    key: 'grounding',
    title: '联网搜索助手 (Grounding)',
    description: '负责外部事实查证与网络检索。',
  },
  {
    key: 'image_gen',
    title: '图像生成助手 (Image Gen)',
    description: '负责根据提示词生成图像与视觉产物。',
  },
];

/**
 * Filter endpoints eligible for a model.
 * Requirements (Plan D10, §7.8):
 * - configured === true
 * - enabled === true
 * - execution_type === 'direct_api'
 * - execution_adapter === 'internal_http'
 * - model.compatible_endpoint_ids.includes(endpoint.id)
 * Ineligible endpoints are NEVER offered as selectable candidates.
 */
function getEligibleEndpoints(
  modelName: string,
  models: ModelCatalogModel[],
  endpoints: ModelCatalogEndpoint[],
): ModelCatalogEndpoint[] {
  const model = models.find((m) => m.name === modelName);
  if (!model) return [];
  return endpoints.filter(
    (ep) =>
      ep.configured &&
      ep.enabled &&
      ep.execution_type === 'direct_api' &&
      ep.execution_adapter === 'internal_http' &&
      model.compatible_endpoint_ids.includes(ep.id),
  );
}

/**
 * Filter style shadow models for a given endpoint ID.
 * Requirements (Plan §7.8):
 * - abilities.includes('fc')
 * - compatible_endpoint_ids.includes(endpointId)
 */
function getEligibleShadowModels(
  endpointId: number,
  models: ModelCatalogModel[],
): ModelCatalogModel[] {
  if (!endpointId || endpointId <= 0) return [];
  return models.filter(
    (m) =>
      Array.isArray(m.abilities) &&
      m.abilities.includes('fc') &&
      Array.isArray(m.compatible_endpoint_ids) &&
      m.compatible_endpoint_ids.includes(endpointId),
  );
}

function cloneRoleConfig(source: RoleConfigPayload): RoleConfigPayload {
  return {
    main: source.main.map((m, idx) => ({
      model: m.model,
      default_endpoint: m.default_endpoint,
      style_shadow: m.style_shadow ?? null,
      position: typeof m.position === 'number' ? m.position : idx,
    })),
    support: {
      general_sub_agent: { ...source.support.general_sub_agent },
      vision_helper: { ...source.support.vision_helper },
      grounding: { ...source.support.grounding },
      image_gen: { ...source.support.image_gen },
    },
  };
}

export function ModelRolesPanel() {
  useDocumentTitle('模型角色');

  const catalogQuery = useModelCatalogQuery();
  const updateRoleConfigMutation = useUpdateRoleConfigMutation();

  const [draft, setDraft] = useState<RoleConfigPayload | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const models = useMemo(() => catalogQuery.data?.models ?? [], [catalogQuery.data?.models]);
  const endpoints = useMemo(
    () => catalogQuery.data?.endpoints ?? [],
    [catalogQuery.data?.endpoints],
  );

  // Sync draft from catalog truth when not dirty
  useEffect(() => {
    if (catalogQuery.data?.roles && !isDirty) {
      const serverRoles = catalogQuery.data.roles;
      const initialDraft: RoleConfigPayload = {
        main: (serverRoles.main ?? []).map((m, idx) => ({
          model: m.model,
          default_endpoint: m.default_endpoint,
          style_shadow: m.style_shadow ?? null,
          position: typeof m.position === 'number' ? m.position : idx,
        })),
        support: {
          general_sub_agent: {
            model: serverRoles.support.general_sub_agent.model,
            default_endpoint: serverRoles.support.general_sub_agent.default_endpoint,
          },
          vision_helper: {
            model: serverRoles.support.vision_helper.model,
            default_endpoint: serverRoles.support.vision_helper.default_endpoint,
          },
          grounding: {
            model: serverRoles.support.grounding.model,
            default_endpoint: serverRoles.support.grounding.default_endpoint,
          },
          image_gen: {
            model: serverRoles.support.image_gen.model,
            default_endpoint: serverRoles.support.image_gen.default_endpoint,
          },
        },
      };
      setDraft(initialDraft);
    }
  }, [catalogQuery.data?.roles, isDirty]);

  // Main role operations
  const handleAddMainRole = () => {
    if (!draft) return;
    const defaultModel = models[0]?.name ?? '';
    const eligible = getEligibleEndpoints(defaultModel, models, endpoints);
    const defaultEp = eligible[0]?.id ?? 0;

    const newRole: MainRoleDraft = {
      model: defaultModel,
      default_endpoint: defaultEp,
      style_shadow: null,
      position: draft.main.length,
    };

    setDraft({
      ...draft,
      main: [...draft.main, newRole],
    });
    setIsDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleRemoveMainRole = (index: number) => {
    if (!draft || draft.main.length <= 1) return;
    const newMain = draft.main.filter((_, idx) => idx !== index);
    // Re-index positions
    const reindexed = newMain.map((item, idx) => ({ ...item, position: idx }));
    setDraft({
      ...draft,
      main: reindexed,
    });
    setIsDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleMoveMainRole = (index: number, direction: 'up' | 'down') => {
    if (!draft) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draft.main.length) return;

    const newMain = [...draft.main];
    const temp = newMain[index];
    newMain[index] = newMain[targetIndex];
    newMain[targetIndex] = temp;

    const reindexed = newMain.map((item, idx) => ({ ...item, position: idx }));
    setDraft({
      ...draft,
      main: reindexed,
    });
    setIsDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleMainRoleChange = (
    index: number,
    field: keyof MainRoleDraft,
    value: string | number | null,
  ) => {
    if (!draft) return;
    const newMain = [...draft.main];
    const current = { ...newMain[index] };

    if (field === 'model') {
      current.model = String(value);
      // Auto-select first eligible endpoint for new model if current endpoint is incompatible
      const eligible = getEligibleEndpoints(current.model, models, endpoints);
      const isStillEligible = eligible.some((ep) => ep.id === current.default_endpoint);
      if (!isStillEligible) {
        current.default_endpoint = eligible[0]?.id ?? 0;
      }
      if (current.style_shadow) {
        const eligibleShadows = getEligibleShadowModels(current.default_endpoint, models);
        if (!eligibleShadows.some((m) => m.name === current.style_shadow)) {
          current.style_shadow = null;
        }
      }
    } else if (field === 'default_endpoint') {
      current.default_endpoint = Number(value);
      if (current.style_shadow) {
        const eligibleShadows = getEligibleShadowModels(current.default_endpoint, models);
        if (!eligibleShadows.some((m) => m.name === current.style_shadow)) {
          current.style_shadow = null;
        }
      }
    } else if (field === 'style_shadow') {
      current.style_shadow = value ? String(value) : null;
    }

    newMain[index] = current;
    setDraft({
      ...draft,
      main: newMain,
    });
    setIsDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSupportRoleChange = (
    roleKey: 'general_sub_agent' | 'vision_helper' | 'grounding' | 'image_gen',
    field: keyof SupportRoleDraft,
    value: string | number,
  ) => {
    if (!draft) return;
    const currentSupport = { ...draft.support };
    const targetRole = { ...currentSupport[roleKey] };

    if (field === 'model') {
      targetRole.model = String(value);
      const eligible = getEligibleEndpoints(targetRole.model, models, endpoints);
      const isStillEligible = eligible.some((ep) => ep.id === targetRole.default_endpoint);
      if (!isStillEligible) {
        targetRole.default_endpoint = eligible[0]?.id ?? 0;
      }
    } else if (field === 'default_endpoint') {
      targetRole.default_endpoint = Number(value);
    }

    currentSupport[roleKey] = targetRole;
    setDraft({
      ...draft,
      support: currentSupport,
    });
    setIsDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleReset = () => {
    if (catalogQuery.data?.roles) {
      const serverRoles = catalogQuery.data.roles;
      setDraft(
        cloneRoleConfig({
          main: (serverRoles.main ?? []).map((m, idx) => ({
            model: m.model,
            default_endpoint: m.default_endpoint,
            style_shadow: m.style_shadow ?? null,
            position: typeof m.position === 'number' ? m.position : idx,
          })),
          support: {
            general_sub_agent: {
              model: serverRoles.support.general_sub_agent.model,
              default_endpoint: serverRoles.support.general_sub_agent.default_endpoint,
            },
            vision_helper: {
              model: serverRoles.support.vision_helper.model,
              default_endpoint: serverRoles.support.vision_helper.default_endpoint,
            },
            grounding: {
              model: serverRoles.support.grounding.model,
              default_endpoint: serverRoles.support.grounding.default_endpoint,
            },
            image_gen: {
              model: serverRoles.support.image_gen.model,
              default_endpoint: serverRoles.support.image_gen.default_endpoint,
            },
          },
        }),
      );
      setIsDirty(false);
      setSaveError(null);
      setSaveSuccess(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    if (draft.main.length < 1) {
      setSaveError('至少需要配置一个主模型角色');
      return;
    }

    // Validate all main roles have eligible endpoints and shadows
    for (let i = 0; i < draft.main.length; i++) {
      const role = draft.main[i];
      if (!role.model.trim()) {
        setSaveError(`主模型角色 #${i + 1} 尚未选择模型`);
        return;
      }
      const eligible = getEligibleEndpoints(role.model, models, endpoints);
      if (!eligible.some((ep) => ep.id === role.default_endpoint)) {
        setSaveError(`主模型角色 #${i + 1} 当前绑定的通道端点不可用，请重新选择有效端点`);
        return;
      }
      if (role.style_shadow) {
        const eligibleShadows = getEligibleShadowModels(role.default_endpoint, models);
        if (!eligibleShadows.some((m) => m.name === role.style_shadow)) {
          setSaveError(`主模型角色 #${i + 1} 的风格阴影模型当前不可用，请重新选择或设为无`);
          return;
        }
      }
    }

    // Validate all support roles have eligible endpoints
    for (const def of SUPPORT_ROLE_DEFS) {
      const role = draft.support[def.key];
      if (!role.model.trim()) {
        setSaveError(`辅助角色 [${def.title}] 尚未选择模型`);
        return;
      }
      const eligible = getEligibleEndpoints(role.model, models, endpoints);
      if (!eligible.some((ep) => ep.id === role.default_endpoint)) {
        setSaveError(`辅助角色 [${def.title}] 当前绑定的通道端点不可用，请重新选择有效端点`);
        return;
      }
    }

    setSaveError(null);
    try {
      await updateRoleConfigMutation.mutateAsync(draft);
      setIsDirty(false);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    }
  };

  return (
    <div className="settings-panel">
      <header className="settings-panel-header">
        <div className="settings-panel-title-wrap">
          <h2 className="settings-panel-title">模型角色分配 (Model Roles)</h2>
          <p className="settings-panel-subtitle">
            配置系统主对话模型与各辅助专职角色的底层模型及通道映射，整包生效。
          </p>
        </div>
        <div className="settings-panel-actions">
          {isDirty && (
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={handleReset}
              disabled={updateRoleConfigMutation.isPending}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>放弃修改</span>
            </button>
          )}
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={handleSave}
            disabled={!isDirty || updateRoleConfigMutation.isPending || !draft}
          >
            {updateRoleConfigMutation.isPending ? (
              <RefreshCw className="settings-spin-icon" size={14} aria-hidden="true" />
            ) : (
              <Save size={14} aria-hidden="true" />
            )}
            <span>保存角色配置</span>
          </button>
        </div>
      </header>

      {/* Notifications */}
      {saveSuccess && (
        <div className="settings-alert settings-alert--success" role="status">
          <Check size={16} aria-hidden="true" />
          <span>模型角色配置已成功更新并生效。</span>
        </div>
      )}

      {saveError && (
        <div className="settings-alert settings-alert--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>保存失败: {saveError}</span>
        </div>
      )}

      {catalogQuery.isLoading && (
        <div className="settings-loading-card">
          <RefreshCw className="settings-spin-icon" size={18} aria-hidden="true" />
          <span>加载模型目录与角色配置中...</span>
        </div>
      )}

      {catalogQuery.isError && (
        <div className="settings-alert settings-alert--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>模型目录加载失败: {getErrorMessage(catalogQuery.error)}</span>
          <button
            type="button"
            className="app-btn app-btn--secondary settings-btn--retry"
            onClick={() => catalogQuery.refetch()}
          >
            重试
          </button>
        </div>
      )}

      {!catalogQuery.isLoading && !catalogQuery.isError && draft && (
        <div className="settings-roles-container">
          {/* ── Section 1: Main Roles ── */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">主模型角色 (Main Roles)</h3>
                <p className="settings-section-desc">
                  主对话核心模型池，支持设置排序与外观阴影模型。至少需配置一个主角色。
                </p>
              </div>
              <button
                type="button"
                className="app-btn app-btn--secondary"
                onClick={handleAddMainRole}
                disabled={models.length === 0}
              >
                <Plus size={14} aria-hidden="true" />
                <span>添加主角色</span>
              </button>
            </div>

            <div className="settings-roles-list">
              {draft.main.map((role, idx) => {
                const eligibleEps = getEligibleEndpoints(
                  role.model,
                  models,
                  endpoints,
                );
                const isEndpointEligible = eligibleEps.some((ep) => ep.id === role.default_endpoint);
                const eligibleShadows = getEligibleShadowModels(role.default_endpoint, models);
                const isShadowEligible =
                  !role.style_shadow || eligibleShadows.some((m) => m.name === role.style_shadow);

                return (
                  <div key={idx} className="settings-role-card">
                    <div className="settings-role-card-header">
                      <div className="settings-role-badge-wrap">
                        <span className="settings-role-index">#{idx + 1}</span>
                        <span className="settings-role-title">主模型角色</span>
                      </div>
                      <div className="settings-role-actions">
                        <button
                          type="button"
                          className="app-icon-btn"
                          aria-label={`上移角色 #${idx + 1}`}
                          disabled={idx === 0}
                          onClick={() => handleMoveMainRole(idx, 'up')}
                        >
                          <ChevronUp size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="app-icon-btn"
                          aria-label={`下移角色 #${idx + 1}`}
                          disabled={idx === draft.main.length - 1}
                          onClick={() => handleMoveMainRole(idx, 'down')}
                        >
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="app-icon-btn app-icon-btn--danger"
                          aria-label={`删除角色 #${idx + 1}`}
                          disabled={draft.main.length <= 1}
                          onClick={() => handleRemoveMainRole(idx)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="settings-role-fields">
                      {/* Model Selector */}
                      <div className="settings-field-group">
                        <label htmlFor={`main-role-model-${idx}`} className="settings-field-label">
                          基础模型
                        </label>
                        <select
                          id={`main-role-model-${idx}`}
                          className="settings-field-select"
                          value={role.model}
                          onChange={(e) => handleMainRoleChange(idx, 'model', e.target.value)}
                        >
                          {models.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Endpoint Selector */}
                      <div className="settings-field-group">
                        <label
                          htmlFor={`main-role-endpoint-${idx}`}
                          className="settings-field-label"
                        >
                          通道端点 (Endpoint)
                        </label>
                        <select
                          id={`main-role-endpoint-${idx}`}
                          className="settings-field-select"
                          value={role.default_endpoint}
                          onChange={(e) =>
                            handleMainRoleChange(idx, 'default_endpoint', Number(e.target.value))
                          }
                        >
                          {eligibleEps.length === 0 ? (
                            <option value={0}>无兼容的可用端点</option>
                          ) : (
                            eligibleEps.map((ep) => (
                              <option key={ep.id} value={ep.id}>
                                {ep.name} ({ep.provider})
                              </option>
                            ))
                          )}
                        </select>
                        {!isEndpointEligible && (
                          <div className="settings-field-warning" role="alert">
                            当前绑定的通道端点不可用、已禁用或与模型不兼容，请重新选择有效端点。
                          </div>
                        )}
                      </div>

                      {/* Style Shadow Selector */}
                      <div className="settings-field-group">
                        <label
                          htmlFor={`main-role-shadow-${idx}`}
                          className="settings-field-label"
                        >
                          风格阴影模型 (可选)
                        </label>
                        <select
                          id={`main-role-shadow-${idx}`}
                          className="settings-field-select"
                          value={role.style_shadow ?? ''}
                          onChange={(e) =>
                            handleMainRoleChange(
                              idx,
                              'style_shadow',
                              e.target.value ? e.target.value : null,
                            )
                          }
                        >
                          <option value="">无 (跟随主模型风格)</option>
                          {eligibleShadows.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        {!isShadowEligible && (
                          <div className="settings-field-warning" role="alert">
                            当前风格阴影模型 ({role.style_shadow}) 不支持函数调用 (FC) 或与当前通道端点不兼容，请重新选择或设为无。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Section 2: Support Roles ── */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">辅助与专职角色 (Support Roles)</h3>
                <p className="settings-section-desc">
                  涵盖通用子代理、视觉解析、联网搜索和图像生成等四个标准专职支持角色。
                </p>
              </div>
            </div>

            <div className="settings-roles-list">
              {SUPPORT_ROLE_DEFS.map((def) => {
                const currentRole = draft.support[def.key];
                const eligibleEps = getEligibleEndpoints(
                  currentRole.model,
                  models,
                  endpoints,
                );
                const isEndpointEligible = eligibleEps.some(
                  (ep) => ep.id === currentRole.default_endpoint,
                );

                return (
                  <div key={def.key} className="settings-role-card settings-role-card--support">
                    <div className="settings-role-card-header">
                      <div className="settings-role-badge-wrap">
                        <Cpu size={16} aria-hidden="true" className="settings-role-icon" />
                        <span className="settings-role-title">{def.title}</span>
                      </div>
                      <span className="settings-role-card-desc">{def.description}</span>
                    </div>

                    <div className="settings-role-fields">
                      {/* Model Selector */}
                      <div className="settings-field-group">
                        <label
                          htmlFor={`support-role-model-${def.key}`}
                          className="settings-field-label"
                        >
                          专职模型
                        </label>
                        <select
                          id={`support-role-model-${def.key}`}
                          className="settings-field-select"
                          value={currentRole.model}
                          onChange={(e) => handleSupportRoleChange(def.key, 'model', e.target.value)}
                        >
                          {models.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Endpoint Selector */}
                      <div className="settings-field-group">
                        <label
                          htmlFor={`support-role-endpoint-${def.key}`}
                          className="settings-field-label"
                        >
                          绑定端点 (Endpoint)
                        </label>
                        <select
                          id={`support-role-endpoint-${def.key}`}
                          className="settings-field-select"
                          value={currentRole.default_endpoint}
                          onChange={(e) =>
                            handleSupportRoleChange(
                              def.key,
                              'default_endpoint',
                              Number(e.target.value),
                            )
                          }
                        >
                          {eligibleEps.length === 0 ? (
                            <option value={0}>无兼容的可用端点</option>
                          ) : (
                            eligibleEps.map((ep) => (
                              <option key={ep.id} value={ep.id}>
                                {ep.name} ({ep.provider})
                              </option>
                            ))
                          )}
                        </select>
                        {!isEndpointEligible && (
                          <div className="settings-field-warning" role="alert">
                            当前绑定的通道端点不可用、已禁用或与模型不兼容，请重新选择有效端点。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
