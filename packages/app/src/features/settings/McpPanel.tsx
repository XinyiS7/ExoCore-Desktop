import { useState, useMemo, useRef, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { useVisiblePresetsQuery } from '../chat/queries';
import {
  useCreateMcpCredentialMutation,
  useDeleteMcpCredentialMutation,
  useMcpCredentialsQuery,
  useMcpServersQuery,
  useOverwriteMcpCredentialMutation,
  usePresetDrawersQuery,
  usePresetMcpServersQuery,
  useRenameMcpCredentialMutation,
  useUpdatePresetDrawerEnabledMutation,
  useUpdatePresetMcpBindingMutation,
} from './queries';
import type {
  McpCredentialCreatePayload,
  McpCredentialItem,
  McpServerItem,
  PresetDrawerItem,
  PresetMcpServerItem,
} from './types';
import type { AgentPresetRow } from '../chat/types';
import { useDialogA11y } from '../chat/dialogA11y';
import { getErrorMessage } from './api';

type TabKey = 'drawers' | 'credentials';

export function McpPanel() {
  useDocumentTitle('MCP与工具抽屉');

  const [activeTab, setActiveTab] = useState<TabKey>('drawers');

  // Agent Presets (exclude 'user' agent_type)
  const presetsQuery = useVisiblePresetsQuery();
  const selectablePresets = useMemo(() => {
    if (!presetsQuery.data || !Array.isArray(presetsQuery.data)) return [];
    return presetsQuery.data.filter((p: AgentPresetRow) => p.agent_type !== 'user');
  }, [presetsQuery.data]);

  // Selected Preset ID for Drawers & Bindings tab
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  // Sync selectedPresetId with first available preset if not yet selected
  const effectivePresetId = useMemo(() => {
    if (selectedPresetId !== null && selectablePresets.some((p) => p.id === selectedPresetId)) {
      return selectedPresetId;
    }
    return selectablePresets[0]?.id ?? null;
  }, [selectedPresetId, selectablePresets]);

  // Track active preset ID across asynchronous mutation completions
  const effectivePresetIdRef = useRef<number | null>(effectivePresetId);
  effectivePresetIdRef.current = effectivePresetId;

  // Drawer and MCP Queries
  const presetDrawersQuery = usePresetDrawersQuery(effectivePresetId);
  const mcpServersQuery = useMcpServersQuery();
  const presetMcpServersQuery = usePresetMcpServersQuery(effectivePresetId);
  const mcpCredentialsQuery = useMcpCredentialsQuery();

  // Mutations
  const updateDrawerMutation = useUpdatePresetDrawerEnabledMutation();
  const updateBindingMutation = useUpdatePresetMcpBindingMutation();
  const createCredentialMutation = useCreateMcpCredentialMutation();
  const renameCredentialMutation = useRenameMcpCredentialMutation();
  const overwriteCredentialMutation = useOverwriteMcpCredentialMutation();
  const deleteCredentialMutation = useDeleteMcpCredentialMutation();

  // Dialog States for Credentials Tab
  const [isCreatingCred, setIsCreatingCred] = useState(false);
  const [renamingCred, setRenamingCred] = useState<McpCredentialItem | null>(null);
  const [overwritingCred, setOverwritingCred] = useState<McpCredentialItem | null>(null);
  const [deletingCred, setDeletingCred] = useState<McpCredentialItem | null>(null);

  // Server Filter for Credentials Tab
  const [serverFilter, setServerFilter] = useState<string>('all');

  // UI status messages
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelSuccess, setPanelSuccess] = useState<string | null>(null);

  // Binding selections draft per server (server_name -> alias); discarded on preset switch
  const [bindingDrafts, setBindingDrafts] = useState<Record<string, string>>({});

  // Helper for duplicate preset name disambiguation
  const getPresetLabel = (p: AgentPresetRow) => `${p.name} (#${p.id})`;

  // Handle drawer enabled toggle (locks only the target row)
  const handleToggleDrawer = async (drawer: PresetDrawerItem) => {
    if (!effectivePresetId) return;
    const targetPresetId = effectivePresetId;
    setPanelError(null);
    setPanelSuccess(null);
    try {
      await updateDrawerMutation.mutateAsync({
        presetId: targetPresetId,
        drawerName: drawer.name,
        enabled: !drawer.enabled,
      });
      if (effectivePresetIdRef.current === targetPresetId) {
        setPanelSuccess(`已${drawer.enabled ? '禁用' : '启用'}抽屉 [${drawer.display_name}]`);
      }
    } catch (err) {
      if (effectivePresetIdRef.current === targetPresetId) {
        setPanelError(getErrorMessage(err));
      }
    }
  };

  // Handle saving dedicated binding for a server
  const handleSaveBinding = async (server: PresetMcpServerItem) => {
    if (!effectivePresetId) return;
    const targetPresetId = effectivePresetId;
    const chosenAlias =
      bindingDrafts[server.server_name] !== undefined
        ? bindingDrafts[server.server_name]
        : server.credential_alias ?? server.resolved_alias ?? '';

    if (!chosenAlias) {
      setPanelError(`服务 [${server.server_name}] 必须选择一个有效凭证别名`);
      return;
    }

    setPanelError(null);
    setPanelSuccess(null);
    try {
      await updateBindingMutation.mutateAsync({
        presetId: targetPresetId,
        serverName: server.server_name,
        payload: {
          mode: 'dedicated',
          credential_alias: chosenAlias,
        },
      });
      setBindingDrafts((prev) => {
        const next = { ...prev };
        delete next[server.server_name];
        return next;
      });
      if (effectivePresetIdRef.current === targetPresetId) {
        setPanelSuccess(`已更新服务 [${server.server_name}] 专属凭证绑定`);
      }
    } catch (err) {
      if (effectivePresetIdRef.current === targetPresetId) {
        setPanelError(getErrorMessage(err));
      }
    }
  };

  const filteredCredentials = useMemo(() => {
    const list = mcpCredentialsQuery.data ?? [];
    if (serverFilter === 'all') return list;
    return list.filter((c) => c.server_name === serverFilter);
  }, [mcpCredentialsQuery.data, serverFilter]);

  return (
    <div className="settings-panel">
      <header className="settings-panel-header">
        <div className="settings-panel-title-wrap">
          <h2 className="settings-panel-title">MCP 与工具抽屉 (Drawers & MCP)</h2>
          <p className="settings-panel-subtitle">
            管理外部工具抽屉（Tool Drawers）的预设授权，以及 Model Context Protocol (MCP) 凭证池。
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="settings-tabs-bar" role="tablist" aria-label="MCP与工具抽屉子导航">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'drawers'}
          className={`settings-tab-btn ${activeTab === 'drawers' ? 'settings-tab-btn--active' : ''}`}
          onClick={() => {
            setActiveTab('drawers');
            setPanelError(null);
            setPanelSuccess(null);
          }}
        >
          <Wrench size={15} aria-hidden="true" />
          <span>抽屉授权与绑定 (Drawers & Bindings)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'credentials'}
          className={`settings-tab-btn ${activeTab === 'credentials' ? 'settings-tab-btn--active' : ''}`}
          onClick={() => {
            setActiveTab('credentials');
            setPanelError(null);
            setPanelSuccess(null);
          }}
        >
          <Server size={15} aria-hidden="true" />
          <span>MCP 凭证池 (Credentials Pool)</span>
        </button>
      </div>

      {/* Global feedback messages */}
      {panelError && (
        <div className="settings-error-banner" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{panelError}</span>
        </div>
      )}
      {panelSuccess && (
        <div className="settings-success-banner" role="status">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>{panelSuccess}</span>
        </div>
      )}

      {/* ── Tab 1: Drawers & Bindings ── */}
      {activeTab === 'drawers' && (
        <div className="settings-tab-content">
          {/* Preset Selector */}
          <div className="settings-field" style={{ marginBottom: 20 }}>
            <label htmlFor="mcp-preset-select" className="settings-field-label">
              选择配置目标 Agent 预设:
            </label>
            {presetsQuery.isLoading ? (
              <p className="settings-field-hint">正在加载 Agent 预设列表...</p>
            ) : selectablePresets.length === 0 ? (
              <p className="settings-field-hint">暂无可配置的 Agent 预设。</p>
            ) : (
              <select
                id="mcp-preset-select"
                className="settings-field-select"
                value={effectivePresetId ?? ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0) {
                    setSelectedPresetId(val);
                    setBindingDrafts({});
                    setPanelError(null);
                    setPanelSuccess(null);
                  }
                }}
              >
                {selectablePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getPresetLabel(p)}
                  </option>
                ))}
              </select>
            )}
            <p className="settings-field-hint">
              抽屉授权与专属 MCP 凭证绑定按 Agent 预设维度独立生效。
            </p>
          </div>

          {/* Section 1: Preset Tool Drawers */}
          <section className="settings-section" style={{ marginBottom: 32 }}>
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">工具抽屉授权矩阵 (Preset Drawers)</h3>
                <p className="settings-section-desc">
                  配置当前预设是否允许访问特定的系统工具抽屉。服务可用、预设授权与凭证就绪为独立状态事实。
                </p>
              </div>
            </div>

            {presetDrawersQuery.isLoading ? (
              <div className="settings-empty-hint">正在加载抽屉授权信息...</div>
            ) : presetDrawersQuery.isError ? (
              <div className="settings-error-banner" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>加载抽屉授权矩阵失败: {getErrorMessage(presetDrawersQuery.error)}</span>
              </div>
            ) : (presetDrawersQuery.data ?? []).length === 0 ? (
              <div className="settings-empty-hint">当前预设暂无登记的工具抽屉。</div>
            ) : (
              <div className="settings-table-wrapper">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>抽屉名称</th>
                      <th>MCP 服务器</th>
                      <th>服务可用性</th>
                      <th>预设授权</th>
                      <th>凭证就绪</th>
                      <th className="settings-actions-cell">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(presetDrawersQuery.data ?? []).map((drawer) => {
                      const isPending =
                        updateDrawerMutation.isPending &&
                        updateDrawerMutation.variables?.drawerName === drawer.name &&
                        updateDrawerMutation.variables?.presetId === effectivePresetId;

                      return (
                        <tr key={drawer.name}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontWeight: 500 }}>{drawer.display_name}</span>
                              <span style={{ fontSize: '0.85em', color: 'var(--v4-text-mute)' }}>
                                {drawer.name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <code>{drawer.server_name}</code>
                          </td>
                          <td>
                            <span
                              className={`settings-badge ${
                                drawer.available ? 'settings-badge--success' : 'settings-badge--neutral'
                              }`}
                            >
                              {drawer.available ? '服务可用' : '服务不可用'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`settings-badge ${
                                drawer.enabled ? 'settings-badge--success' : 'settings-badge--neutral'
                              }`}
                            >
                              {drawer.enabled ? '已授权' : '未授权'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`settings-badge ${
                                drawer.credential_ready
                                  ? 'settings-badge--success'
                                  : 'settings-badge--warning'
                              }`}
                            >
                              {drawer.credential_ready ? '凭证就绪' : '凭证未配置'}
                            </span>
                          </td>
                          <td className="settings-actions-cell">
                            <button
                              type="button"
                              className={`app-btn ${drawer.enabled ? 'app-btn--secondary' : 'app-btn--primary'}`}
                              disabled={isPending}
                              onClick={() => handleToggleDrawer(drawer)}
                              aria-label={`${drawer.enabled ? '禁用' : '授权'}抽屉 ${drawer.display_name}`}
                              style={{ minWidth: 84 }}
                            >
                              {isPending ? (
                                <RefreshCw className="settings-spin-icon" size={13} aria-hidden="true" />
                              ) : null}
                              <span>{drawer.enabled ? '禁用访问' : '授权访问'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 2: Dedicated MCP Bindings */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">专属 MCP 凭证绑定 (Dedicated Bindings)</h3>
                <p className="settings-section-desc">
                  当前后端注册的服务均为 per_preset 策略，每个预设必须绑定自己的专属凭证。
                </p>
              </div>
            </div>

            {presetMcpServersQuery.isLoading ? (
              <div className="settings-empty-hint">正在加载 MCP 绑定状态...</div>
            ) : presetMcpServersQuery.isError ? (
              <div className="settings-error-banner" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>加载预设 MCP 状态失败: {getErrorMessage(presetMcpServersQuery.error)}</span>
              </div>
            ) : (presetMcpServersQuery.data ?? []).length === 0 ? (
              <div className="settings-empty-hint">当前系统暂无活跃的 MCP 服务器。</div>
            ) : (
              <div className="settings-table-wrapper">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>MCP 服务器</th>
                      <th>凭证策略</th>
                      <th>公共凭证状态</th>
                      <th>专属凭证选择</th>
                      <th>就绪状态</th>
                      <th className="settings-actions-cell">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(presetMcpServersQuery.data ?? []).map((server) => {
                      const serverCreds = (mcpCredentialsQuery.data ?? []).filter(
                        (c) => c.server_name === server.server_name,
                      );
                      const currentAlias =
                        bindingDrafts[server.server_name] !== undefined
                          ? bindingDrafts[server.server_name]
                          : server.credential_alias ?? server.resolved_alias ?? '';

                      const isPending =
                        updateBindingMutation.isPending &&
                        updateBindingMutation.variables?.serverName === server.server_name &&
                        updateBindingMutation.variables?.presetId === effectivePresetId;

                      const isChanged =
                        currentAlias !== (server.credential_alias ?? server.resolved_alias ?? '');

                      return (
                        <tr key={server.server_name}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Layers size={14} className="settings-rail-icon" aria-hidden="true" />
                              <strong style={{ fontWeight: 600 }}>{server.server_name}</strong>
                            </div>
                          </td>
                          <td>
                            <span className="settings-badge settings-badge--neutral">
                              {server.credential_strategy}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.9em', color: 'var(--v4-text-mute)' }}>
                              不适用 (per_preset)
                            </span>
                          </td>
                          <td>
                            {serverCreds.length === 0 ? (
                              <span style={{ fontSize: '0.85em', color: 'var(--v4-text-mute)' }}>
                                暂无可绑定的专属凭证
                              </span>
                            ) : (
                              <select
                                className="settings-field-select"
                                style={{ width: 'auto', minWidth: 160, padding: '4px 8px' }}
                                value={currentAlias}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBindingDrafts((prev) => ({
                                    ...prev,
                                    [server.server_name]: val,
                                  }));
                                }}
                                aria-label={`为服务 ${server.server_name} 选择专属凭证`}
                              >
                                <option value="">-- 请选择专属凭证 --</option>
                                {serverCreds.map((c) => (
                                  <option key={c.alias} value={c.alias}>
                                    {c.alias} (•••• {c.last_four})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            <span
                              className={`settings-badge ${
                                server.credential_ready
                                  ? 'settings-badge--success'
                                  : 'settings-badge--warning'
                              }`}
                            >
                              {server.credential_ready ? '凭证就绪' : '凭证未配置'}
                            </span>
                          </td>
                          <td className="settings-actions-cell">
                            <button
                              type="button"
                              className="app-btn app-btn--primary"
                              disabled={isPending || !currentAlias || (!isChanged && Boolean(server.credential_alias))}
                              onClick={() => handleSaveBinding(server)}
                              aria-label={`保存服务 ${server.server_name} 凭证绑定`}
                              style={{ minWidth: 80 }}
                            >
                              {isPending ? (
                                <RefreshCw className="settings-spin-icon" size={13} aria-hidden="true" />
                              ) : null}
                              <span>保存绑定</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Tab 2: Credentials Pool ── */}
      {activeTab === 'credentials' && (
        <div className="settings-tab-content">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">MCP 凭证别名池</h3>
              <p className="settings-section-desc">
                录入并管理第三方工具/平台凭证。凭证值仅单向提交后端机密库存储，前端绝不存储或回显机密明文。
              </p>
            </div>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => setIsCreatingCred(true)}
            >
              <Plus size={14} aria-hidden="true" />
              <span>新建凭证</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="settings-filter-bar">
            <span className="settings-filter-label">按 MCP 服务筛选:</span>
            <select
              className="settings-field-select"
              style={{ width: 'auto', minWidth: 160 }}
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
              aria-label="按 MCP 服务筛选凭证"
            >
              <option value="all">全部服务器</option>
              {(mcpServersQuery.data ?? []).map((s) => (
                <option key={s.name} value={s.name}>
                  {s.display_name} ({s.name})
                </option>
              ))}
            </select>
          </div>

          {/* Credentials Table */}
          {mcpCredentialsQuery.isLoading ? (
            <div className="settings-empty-hint">正在加载 MCP 凭证列表...</div>
          ) : mcpCredentialsQuery.isError ? (
            <div className="settings-error-banner" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>加载凭证列表失败: {getErrorMessage(mcpCredentialsQuery.error)}</span>
            </div>
          ) : filteredCredentials.length === 0 ? (
            <div className="settings-empty-hint">
              {serverFilter === 'all'
                ? '暂无已登记的 MCP 凭证，点击右上角“新建凭证”添加。'
                : `服务 [${serverFilter}] 暂无匹配凭证。`}
            </div>
          ) : (
            <div className="settings-table-wrapper">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>别名 (Alias)</th>
                    <th>所属 MCP 服务</th>
                    <th>机密摘要</th>
                    <th>更新时间</th>
                    <th className="settings-actions-cell">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCredentials.map((cred) => (
                    <tr key={cred.alias}>
                      <td>
                        <strong style={{ fontWeight: 600 }}>{cred.alias}</strong>
                      </td>
                      <td>
                        <code>{cred.server_name}</code>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                          •••• {cred.last_four}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85em', color: 'var(--v4-text-mute)' }}>
                          {cred.updated_at ? new Date(cred.updated_at).toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="settings-actions-cell">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="app-btn app-btn--ghost app-btn--icon"
                            title="重命名别名"
                            aria-label={`重命名凭证 ${cred.alias}`}
                            onClick={() => setRenamingCred(cred)}
                          >
                            <Edit2 size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="app-btn app-btn--ghost app-btn--icon"
                            title="覆写机密值"
                            aria-label={`覆写凭证 ${cred.alias} 机密值`}
                            onClick={() => setOverwritingCred(cred)}
                          >
                            <KeyRound size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="app-btn app-btn--ghost app-btn--icon app-btn--danger"
                            title="删除凭证"
                            aria-label={`删除凭证 ${cred.alias}`}
                            onClick={() => setDeletingCred(cred)}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Create Dialog */}
      {isCreatingCred && (
        <McpCredentialCreateDialog
          availableServers={mcpServersQuery.data ?? []}
          onClose={() => setIsCreatingCred(false)}
          onSave={async (payload) => {
            await createCredentialMutation.mutateAsync(payload);
            setIsCreatingCred(false);
          }}
        />
      )}

      {/* Rename Dialog */}
      {renamingCred && (
        <McpCredentialRenameDialog
          credential={renamingCred}
          onClose={() => setRenamingCred(null)}
          onSave={async (newAlias) => {
            await renameCredentialMutation.mutateAsync({
              oldAlias: renamingCred.alias,
              newAlias,
            });
            setRenamingCred(null);
          }}
        />
      )}

      {/* Overwrite Dialog */}
      {overwritingCred && (
        <McpCredentialOverwriteDialog
          credential={overwritingCred}
          onClose={() => setOverwritingCred(null)}
          onSave={async (secret) => {
            await overwriteCredentialMutation.mutateAsync({
              alias: overwritingCred.alias,
              credentialValue: secret,
            });
            setOverwritingCred(null);
          }}
        />
      )}

      {/* Delete Dialog */}
      {deletingCred && (
        <McpCredentialDeleteDialog
          credential={deletingCred}
          onClose={() => setDeletingCred(null)}
          onConfirm={async () => {
            await deleteCredentialMutation.mutateAsync(deletingCred.alias);
            setDeletingCred(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

interface McpCredentialCreateDialogProps {
  availableServers: McpServerItem[];
  onClose: () => void;
  onSave: (payload: McpCredentialCreatePayload) => Promise<void>;
}

function McpCredentialCreateDialog({
  availableServers,
  onClose,
  onSave,
}: McpCredentialCreateDialogProps) {
  const [alias, setAlias] = useState('');
  const [serverName, setServerName] = useState(availableServers[0]?.name ?? '');
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      setError('请输入凭证别名');
      return;
    }
    if (cleanAlias.includes('/')) {
      setError('凭证别名不能包含斜杠 /');
      return;
    }
    if (!serverName.trim()) {
      setError('请选择所属 MCP 服务');
      return;
    }
    if (!secret) {
      setError('请输入凭证机密值');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        alias: cleanAlias,
        server_name: serverName.trim(),
        credential_value: secret, // Verbatim, never trimmed
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="app-dialog-backdrop">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cred-create-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="app-dialog-header">
            <h3 id="cred-create-title" className="app-dialog-title">
              新建 MCP 凭证
            </h3>
          </div>

          <div className="app-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div className="settings-error-banner" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="settings-field">
              <label htmlFor="cred-create-server" className="settings-field-label">
                所属 MCP 服务 *
              </label>
              <select
                id="cred-create-server"
                className="settings-field-select"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                disabled={saving}
                required
              >
                {availableServers.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.display_name} ({s.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label htmlFor="cred-create-alias" className="settings-field-label">
                凭证别名 (Alias) *
              </label>
              <input
                id="cred-create-alias"
                type="text"
                className="settings-field-input"
                placeholder="例如: galatea-agent-6"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                disabled={saving}
                required
                autoFocus
              />
              <span className="settings-field-hint">
                别名在所属系统内必须唯一，且不能包含斜杠 <code>/</code>。
              </span>
            </div>

            <div className="settings-field">
              <label htmlFor="cred-create-value" className="settings-field-label">
                凭证机密值 (Token / API Key) *
              </label>
              <input
                id="cred-create-value"
                type="password"
                className="settings-field-input"
                placeholder="输入凭证机密字符串..."
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                disabled={saving}
                required
              />
              <span className="settings-field-hint">
                机密字符串原样提交并由服务器安全托管，前端绝不存储或回显明文。
              </span>
            </div>
          </div>

          <div className="app-dialog-actions">
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={saving}>
              {saving ? (
                <RefreshCw className="settings-spin-icon" size={14} aria-hidden="true" />
              ) : null}
              <span>创建凭证</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface McpCredentialRenameDialogProps {
  credential: McpCredentialItem;
  onClose: () => void;
  onSave: (newAlias: string) => Promise<void>;
}

function McpCredentialRenameDialog({
  credential,
  onClose,
  onSave,
}: McpCredentialRenameDialogProps) {
  const [newAlias, setNewAlias] = useState(credential.alias);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = newAlias.trim();
    if (!clean) {
      setError('请输入新的凭证别名');
      return;
    }
    if (clean.includes('/')) {
      setError('凭证别名不能包含斜杠 /');
      return;
    }
    if (clean === credential.alias) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(clean);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="app-dialog-backdrop">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cred-rename-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="app-dialog-header">
            <h3 id="cred-rename-title" className="app-dialog-title">
              重命名 MCP 凭证
            </h3>
          </div>

          <div className="app-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div className="settings-error-banner" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="settings-field">
              <label className="settings-field-label">当前所属服务</label>
              <div style={{ padding: '8px 12px', background: 'var(--v4-panel-2)', borderRadius: 4 }}>
                <code>{credential.server_name}</code>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="cred-rename-input" className="settings-field-label">
                新别名 (Alias) *
              </label>
              <input
                id="cred-rename-input"
                type="text"
                className="settings-field-input"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                disabled={saving}
                required
                autoFocus
              />
              <span className="settings-field-hint">别名不能包含斜杠 /。</span>
            </div>
          </div>

          <div className="app-dialog-actions">
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={saving}>
              {saving ? (
                <RefreshCw className="settings-spin-icon" size={14} aria-hidden="true" />
              ) : null}
              <span>保存别名</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface McpCredentialOverwriteDialogProps {
  credential: McpCredentialItem;
  onClose: () => void;
  onSave: (secret: string) => Promise<void>;
}

function McpCredentialOverwriteDialog({
  credential,
  onClose,
  onSave,
}: McpCredentialOverwriteDialogProps) {
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!secret) {
      setError('请输入新的机密值');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(secret); // Verbatim, never trimmed
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="app-dialog-backdrop">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cred-overwrite-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="app-dialog-header">
            <h3 id="cred-overwrite-title" className="app-dialog-title">
              覆写 MCP 凭证机密值
            </h3>
          </div>

          <div className="app-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div className="settings-error-banner" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="settings-field">
              <label className="settings-field-label">目标凭证别名</label>
              <div style={{ padding: '8px 12px', background: 'var(--v4-panel-2)', borderRadius: 4 }}>
                <strong>{credential.alias}</strong> ({credential.server_name})
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="cred-overwrite-input" className="settings-field-label">
                新的机密值 (Token / API Key) *
              </label>
              <input
                id="cred-overwrite-input"
                type="password"
                className="settings-field-input"
                placeholder="输入新的凭证机密..."
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                disabled={saving}
                required
                autoFocus
              />
              <span className="settings-field-hint">
                新机密原样提交后，后 4 位校验提示将自动刷新，原机密立即作废。
              </span>
            </div>
          </div>

          <div className="app-dialog-actions">
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={saving}>
              {saving ? (
                <RefreshCw className="settings-spin-icon" size={14} aria-hidden="true" />
              ) : null}
              <span>确认覆写</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface McpCredentialDeleteDialogProps {
  credential: McpCredentialItem;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function McpCredentialDeleteDialog({
  credential,
  onClose,
  onConfirm,
}: McpCredentialDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: deleting,
    closeDisabledWhileLocked: true,
  });

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div className="app-dialog-backdrop">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cred-delete-title"
      >
        <div className="app-dialog-header">
          <h3 id="cred-delete-title" className="app-dialog-title">
            删除 MCP 凭证确认
          </h3>
        </div>

        <div className="app-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div className="settings-error-banner" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <p style={{ margin: 0, color: 'var(--v4-text-dim)', lineHeight: 1.5 }}>
            确定要删除凭证 <strong>{credential.alias}</strong> 吗？此操作不可撤销。
          </p>
          <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--v4-text-mute)' }}>
            注意：若该凭证已被 Agent 预设或服务器引用，删除请求将被拒绝 (409 Conflict)，请先解绑后再删除。
          </p>
        </div>

        <div className="app-dialog-actions">
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={onClose}
            disabled={deleting}
          >
            取消
          </button>
          <button
            type="button"
            className="app-btn app-btn--primary app-btn--danger"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <RefreshCw className="settings-spin-icon" size={14} aria-hidden="true" />
            ) : (
              <Trash2 size={14} aria-hidden="true" />
            )}
            <span>确认删除</span>
          </button>
        </div>
      </div>
    </div>
  );
}
