import { useState, type FormEvent } from 'react';
import { Key, Plus, RefreshCw, Server, AlertCircle, Edit2, Trash2, KeyRound } from 'lucide-react';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { useModelCatalogQuery } from '../../shared/modelCatalog';
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useCreateEndpointMutation,
  useDeleteApiKeyMutation,
  useDeleteEndpointMutation,
  useEndpointsQuery,
  useOverwriteApiKeyMutation,
  useRenameApiKeyMutation,
  useUpdateEndpointMutation,
} from './queries';
import type { ApiKeyRow, EndpointRow } from './types';
import { useDialogA11y } from '../chat/dialogA11y';
import { toAppApiError } from '../chat/api';
import { getErrorMessage } from './api';

type TabKey = 'endpoints' | 'keys';

export function KeysPanel() {
  useDocumentTitle('密钥与端点');

  const [activeTab, setActiveTab] = useState<TabKey>('endpoints');

  // Endpoints data & catalog
  const endpointsQuery = useEndpointsQuery();
  const catalogQuery = useModelCatalogQuery();
  const apiKeysQuery = useApiKeysQuery();

  // Dialog states
  const [editingEndpoint, setEditingEndpoint] = useState<EndpointRow | 'new' | null>(null);
  const [deletingEndpoint, setDeletingEndpoint] = useState<EndpointRow | null>(null);
  const [endpointError, setEndpointError] = useState<string | null>(null);

  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [renamingKey, setRenamingKey] = useState<ApiKeyRow | null>(null);
  const [overwritingKey, setOverwritingKey] = useState<ApiKeyRow | null>(null);
  const [deletingKey, setDeletingKey] = useState<ApiKeyRow | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Platform filter for Keys tab
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>('all');

  // Mutations
  const createEndpointMutation = useCreateEndpointMutation();
  const updateEndpointMutation = useUpdateEndpointMutation();
  const deleteEndpointMutation = useDeleteEndpointMutation();

  const createKeyMutation = useCreateApiKeyMutation();
  const renameKeyMutation = useRenameApiKeyMutation();
  const overwriteKeyMutation = useOverwriteApiKeyMutation();
  const deleteKeyMutation = useDeleteApiKeyMutation();

  const providers = catalogQuery.data?.providers ?? [];
  const platforms = Array.from(
    new Set([
      ...providers.map((p) => String(p.id)),
      ...(apiKeysQuery.data ?? []).map((k) => k.platform),
    ]),
  );

  const filteredKeys = (apiKeysQuery.data ?? []).filter(
    (k) => selectedPlatformFilter === 'all' || k.platform === selectedPlatformFilter,
  );

  return (
    <div className="settings-panel">
      <header className="settings-panel-header">
        <div className="settings-panel-title-wrap">
          <h2 className="settings-panel-title">通道端点与 API 密钥</h2>
          <p className="settings-panel-subtitle">
            配置模型通道端点与底层 API 密钥池，密钥均经过服务器脱敏保护。
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="settings-tabs-bar" role="tablist" aria-label="密钥与端点子导航">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'endpoints'}
          className={`settings-tab-btn ${activeTab === 'endpoints' ? 'settings-tab-btn--active' : ''}`}
          onClick={() => {
            setActiveTab('endpoints');
            setEndpointError(null);
          }}
        >
          <Server size={15} aria-hidden="true" />
          <span>通道端点 (Endpoints)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'keys'}
          className={`settings-tab-btn ${activeTab === 'keys' ? 'settings-tab-btn--active' : ''}`}
          onClick={() => {
            setActiveTab('keys');
            setKeyError(null);
          }}
        >
          <Key size={15} aria-hidden="true" />
          <span>密钥池 (API Keys)</span>
        </button>
      </div>

      {/* ── Endpoints Tab Content ── */}
      {activeTab === 'endpoints' && (
        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">可用通道端点</h3>
              <p className="settings-section-desc">
                端点将 Provider 协议与对应的 API 密钥组合，供各模型角色解析和调用。
              </p>
            </div>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => {
                setEditingEndpoint('new');
                setEndpointError(null);
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>新建端点</span>
            </button>
          </div>

          {endpointError && (
            <div className="settings-alert settings-alert--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{endpointError}</span>
            </div>
          )}

          {endpointsQuery.isLoading && (
            <div className="settings-loading-card">
              <RefreshCw className="settings-spin-icon" size={18} aria-hidden="true" />
              <span>加载通道端点列表中...</span>
            </div>
          )}

          {endpointsQuery.isError && (
            <div className="settings-alert settings-alert--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>端点列表加载失败: {toAppApiError(endpointsQuery.error).message}</span>
              <button
                type="button"
                className="app-btn app-btn--secondary settings-btn--retry"
                onClick={() => endpointsQuery.refetch()}
              >
                重试
              </button>
            </div>
          )}

          {!endpointsQuery.isLoading && !endpointsQuery.isError && (
            <div className="settings-table-wrapper">
              {endpointsQuery.data?.length === 0 ? (
                <div className="settings-empty-hint">暂无已配置通道端点，请点击上方按钮新建。</div>
              ) : (
                <table className="settings-table" aria-label="通道端点列表">
                  <thead>
                    <tr>
                      <th scope="col">端点名称</th>
                      <th scope="col">供应商 (Provider)</th>
                      <th scope="col">绑定密钥别名</th>
                      <th scope="col">运行时类型</th>
                      <th scope="col">状态</th>
                      <th scope="col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpointsQuery.data?.map((ep) => (
                      <tr key={ep.id}>
                        <td className="settings-table-cell-bold">{ep.name}</td>
                        <td>
                          <span className="settings-provider-tag">{ep.provider}</span>
                        </td>
                        <td>{ep.api_key_alias || <span className="settings-dim-text">免配置 / Managed</span>}</td>
                        <td className="settings-dim-text">
                          {ep.execution_type} / {ep.execution_adapter}
                        </td>
                        <td>
                          <div className="settings-status-chips">
                            <span
                              className={`settings-chip ${
                                ep.configured ? 'settings-chip--success' : 'settings-chip--warning'
                              }`}
                            >
                              {ep.configured ? '已配置' : '未完整'}
                            </span>
                            <span
                              className={`settings-chip ${
                                ep.enabled ? 'settings-chip--active' : 'settings-chip--inactive'
                              }`}
                            >
                              {ep.enabled ? '已启用' : '已禁用'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="settings-row-actions">
                            <button
                              type="button"
                              className="settings-action-icon-btn"
                              aria-label={`编辑端点 ${ep.name}`}
                              title="编辑端点"
                              onClick={() => {
                                setEditingEndpoint(ep);
                                setEndpointError(null);
                              }}
                            >
                              <Edit2 size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="settings-action-icon-btn settings-action-icon-btn--danger"
                              aria-label={`删除端点 ${ep.name}`}
                              title="删除端点"
                              onClick={() => {
                                setDeletingEndpoint(ep);
                                setEndpointError(null);
                              }}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Keys Tab Content ── */}
      {activeTab === 'keys' && (
        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">API 密钥池</h3>
              <p className="settings-section-desc">
                添加各模型供应商的 API 密钥凭据。密钥原文提交后绝不回显或在客户端存储。
              </p>
            </div>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => {
                setIsCreatingKey(true);
                setKeyError(null);
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>新建密钥</span>
            </button>
          </div>

          {keyError && (
            <div className="settings-alert settings-alert--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{keyError}</span>
            </div>
          )}

          {/* Platform filter chips */}
          <div className="settings-filter-bar" role="group" aria-label="按平台筛选密钥">
            <button
              type="button"
              className={`settings-filter-chip ${selectedPlatformFilter === 'all' ? 'settings-filter-chip--active' : ''}`}
              onClick={() => setSelectedPlatformFilter('all')}
            >
              全部 ({apiKeysQuery.data?.length ?? 0})
            </button>
            {platforms.map((plat) => {
              const count = (apiKeysQuery.data ?? []).filter((k) => k.platform === plat).length;
              return (
                <button
                  key={plat}
                  type="button"
                  className={`settings-filter-chip ${selectedPlatformFilter === plat ? 'settings-filter-chip--active' : ''}`}
                  onClick={() => setSelectedPlatformFilter(plat)}
                >
                  {plat} ({count})
                </button>
              );
            })}
          </div>

          {apiKeysQuery.isLoading && (
            <div className="settings-loading-card">
              <RefreshCw className="settings-spin-icon" size={18} aria-hidden="true" />
              <span>加载 API 密钥列表中...</span>
            </div>
          )}

          {apiKeysQuery.isError && (
            <div className="settings-alert settings-alert--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>API 密钥列表加载失败: {toAppApiError(apiKeysQuery.error).message}</span>
              <button
                type="button"
                className="app-btn app-btn--secondary settings-btn--retry"
                onClick={() => apiKeysQuery.refetch()}
              >
                重试
              </button>
            </div>
          )}

          {!apiKeysQuery.isLoading && !apiKeysQuery.isError && (
            <div className="settings-table-wrapper">
              {filteredKeys.length === 0 ? (
                <div className="settings-empty-hint">暂无匹配的 API 密钥，请点击上方按钮新建。</div>
              ) : (
                <table className="settings-table" aria-label="API 密钥列表">
                  <thead>
                    <tr>
                      <th scope="col">别名 (Alias)</th>
                      <th scope="col">适用平台</th>
                      <th scope="col">脱敏尾缀</th>
                      <th scope="col">更新时间</th>
                      <th scope="col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeys.map((k) => (
                      <tr key={k.alias}>
                        <td className="settings-table-cell-bold">{k.alias}</td>
                        <td>
                          <span className="settings-provider-tag">{k.platform}</span>
                        </td>
                        <td className="settings-code-text">
                          {k.last_four ? `****${k.last_four}` : '****'}
                        </td>
                        <td className="settings-dim-text">
                          {k.updated_at ? new Date(k.updated_at).toLocaleString() : '-'}
                        </td>
                        <td>
                          <div className="settings-row-actions">
                            <button
                              type="button"
                              className="settings-action-icon-btn"
                              aria-label={`重命名密钥 ${k.alias}`}
                              title="修改别名"
                              onClick={() => {
                                setRenamingKey(k);
                                setKeyError(null);
                              }}
                            >
                              <Edit2 size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="settings-action-icon-btn"
                              aria-label={`覆写密钥内容 ${k.alias}`}
                              title="覆写密钥明文"
                              onClick={() => {
                                setOverwritingKey(k);
                                setKeyError(null);
                              }}
                            >
                              <KeyRound size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="settings-action-icon-btn settings-action-icon-btn--danger"
                              aria-label={`删除密钥 ${k.alias}`}
                              title="删除密钥"
                              onClick={() => {
                                setDeletingKey(k);
                                setKeyError(null);
                              }}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Endpoint Create/Edit Dialog ── */}
      {editingEndpoint && (
        <EndpointEditDialog
          endpoint={editingEndpoint === 'new' ? null : editingEndpoint}
          availableProviders={providers}
          availableKeys={apiKeysQuery.data ?? []}
          onClose={() => setEditingEndpoint(null)}
          onSave={async (payload) => {
            if (editingEndpoint === 'new') {
              await createEndpointMutation.mutateAsync(payload);
            } else {
              await updateEndpointMutation.mutateAsync({
                id: editingEndpoint.id,
                payload,
              });
            }
            setEditingEndpoint(null);
          }}
        />
      )}

      {/* ── Endpoint Delete Dialog ── */}
      {deletingEndpoint && (
        <EndpointDeleteDialog
          endpoint={deletingEndpoint}
          onClose={() => setDeletingEndpoint(null)}
          onConfirm={async () => {
            try {
              await deleteEndpointMutation.mutateAsync(deletingEndpoint.id);
              setDeletingEndpoint(null);
            } catch (err) {
              const appErr = toAppApiError(err);
              setEndpointError(
                appErr.status === 409
                  ? '该端点仍被模型角色引用，无法删除 (409 Conflict)'
                  : getErrorMessage(err),
              );
              setDeletingEndpoint(null);
            }
          }}
        />
      )}

      {/* ── Key Create Dialog ── */}
      {isCreatingKey && (
        <ApiKeyCreateDialog
          availablePlatforms={platforms}
          onClose={() => setIsCreatingKey(false)}
          onSave={async (payload) => {
            await createKeyMutation.mutateAsync(payload);
            setIsCreatingKey(false);
          }}
        />
      )}

      {/* ── Key Rename Dialog ── */}
      {renamingKey && (
        <ApiKeyRenameDialog
          apiKey={renamingKey}
          onClose={() => setRenamingKey(null)}
          onSave={async (newAlias) => {
            await renameKeyMutation.mutateAsync({
              oldAlias: renamingKey.alias,
              payload: { alias: newAlias },
            });
            setRenamingKey(null);
          }}
        />
      )}

      {/* ── Key Overwrite Dialog ── */}
      {overwritingKey && (
        <ApiKeyOverwriteDialog
          apiKey={overwritingKey}
          onClose={() => setOverwritingKey(null)}
          onSave={async (newSecret) => {
            await overwriteKeyMutation.mutateAsync({
              alias: overwritingKey.alias,
              payload: { key_value: newSecret },
            });
            setOverwritingKey(null);
          }}
        />
      )}

      {/* ── Key Delete Dialog ── */}
      {deletingKey && (
        <ApiKeyDeleteDialog
          apiKey={deletingKey}
          onClose={() => setDeletingKey(null)}
          onConfirm={async () => {
            try {
              await deleteKeyMutation.mutateAsync(deletingKey.alias);
              setDeletingKey(null);
            } catch (err) {
              setKeyError(getErrorMessage(err));
              setDeletingKey(null);
            }
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents / Accessible Dialogs
// ─────────────────────────────────────────────────────────────────────────────

interface EndpointEditDialogProps {
  endpoint: EndpointRow | null;
  availableProviders: Array<{ id: string | number; display_name: string; execution_type: string; requires_endpoint_api_key?: boolean }>;
  availableKeys: ApiKeyRow[];
  onClose: () => void;
  onSave: (payload: { name: string; provider: string; api_key_alias: string | null; enabled: boolean }) => Promise<void>;
}

function EndpointEditDialog({
  endpoint,
  availableProviders,
  availableKeys,
  onClose,
  onSave,
}: EndpointEditDialogProps) {
  const isEdit = endpoint !== null;
  const defaultProvider = endpoint?.provider || (availableProviders[0] ? String(availableProviders[0].id) : '');

  const [name, setName] = useState(endpoint?.name ?? '');
  const [provider, setProvider] = useState(defaultProvider);
  const [apiKeyAlias, setApiKeyAlias] = useState<string>(endpoint?.api_key_alias ?? '');
  const [enabled, setEnabled] = useState(endpoint?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  const selectedProviderProfile = availableProviders.find((p) => String(p.id) === provider);
  const isManaged =
    selectedProviderProfile?.execution_type === 'managed_runtime' ||
    selectedProviderProfile?.requires_endpoint_api_key === false;

  const matchingKeys = availableKeys.filter((k) => k.platform === provider);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入端点名称');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        provider: provider.trim(),
        api_key_alias: isManaged ? null : apiKeyAlias.trim() || null,
        enabled,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="app-dialog-overlay" role="presentation" onClick={(e) => !saving && e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="endpoint-dialog-title"
      >
        <header className="app-dialog-header">
          <h2 id="endpoint-dialog-title" className="app-h2">
            {isEdit ? '编辑通道端点' : '新建通道端点'}
          </h2>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="app-dialog-body settings-form-body">
            {error && (
              <div className="settings-alert settings-alert--error" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="settings-form-group">
              <label htmlFor="ep-name" className="settings-form-label">端点名称 *</label>
              <input
                id="ep-name"
                type="text"
                className="settings-form-input"
                placeholder="例如: DeepSeek 官方通道"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="settings-form-group">
              <label htmlFor="ep-provider" className="settings-form-label">供应商 Provider *</label>
              <select
                id="ep-provider"
                className="settings-form-select"
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  setProvider(newProvider);
                  const targetProviderProfile = availableProviders.find(
                    (p) => String(p.id) === newProvider,
                  );
                  const targetIsManaged =
                    targetProviderProfile?.execution_type === 'managed_runtime' ||
                    targetProviderProfile?.requires_endpoint_api_key === false;
                  if (targetIsManaged) {
                    setApiKeyAlias('');
                  } else {
                    const isKeyValid = availableKeys.some(
                      (k) => k.platform === newProvider && k.alias === apiKeyAlias,
                    );
                    if (!isKeyValid) {
                      setApiKeyAlias('');
                    }
                  }
                }}
                disabled={saving}
              >
                {availableProviders.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.display_name} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-form-group">
              <label htmlFor="ep-key-alias" className="settings-form-label">绑定 API Key 别名</label>
              {isManaged ? (
                <div className="settings-info-box">
                  该 Provider 为托管运行时 (Managed Runtime)，免配置且不接受 API Key。
                </div>
              ) : (
                <select
                  id="ep-key-alias"
                  className="settings-form-select"
                  value={apiKeyAlias}
                  onChange={(e) => setApiKeyAlias(e.target.value)}
                  disabled={saving}
                >
                  <option value="">（不绑定，未完整状态）</option>
                  {matchingKeys.map((k) => (
                    <option key={k.alias} value={k.alias}>
                      {k.alias} (尾缀 ****{k.last_four})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="settings-form-checkbox-row">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  disabled={saving}
                />
                <span>启用此端点通道</span>
              </label>
            </div>
          </div>
          <footer className="app-dialog-footer">
            <button type="button" className="app-btn app-btn--secondary" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={saving}>
              {saving ? '保存中...' : isEdit ? '保存修改' : '创建端点'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

interface EndpointDeleteDialogProps {
  endpoint: EndpointRow;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function EndpointDeleteDialog({ endpoint, onClose, onConfirm }: EndpointDeleteDialogProps) {
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  return (
    <div className="app-dialog-overlay" role="presentation" onClick={(e) => !saving && e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-ep-title"
      >
        <header className="app-dialog-header">
          <h2 id="delete-ep-title" className="app-h2">确认删除端点</h2>
        </header>
        <div className="app-dialog-body">
          <p className="settings-dialog-copy">
            确定要删除通道端点 <strong>{endpoint.name}</strong> 吗？
          </p>
          <p className="settings-dialog-subcopy">
            若该端点已被模型角色引用，系统将拒绝删除并返回 409 Conflict。
          </p>
        </div>
        <footer className="app-dialog-footer">
          <button type="button" className="app-btn app-btn--secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="app-btn app-btn--danger"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onConfirm();
            }}
          >
            {saving ? '删除中...' : '确认删除'}
          </button>
        </footer>
      </div>
    </div>
  );
}

interface ApiKeyCreateDialogProps {
  availablePlatforms: string[];
  onClose: () => void;
  onSave: (payload: { alias: string; platform: string; key_value: string }) => Promise<void>;
}

function ApiKeyCreateDialog({ availablePlatforms, onClose, onSave }: ApiKeyCreateDialogProps) {
  const [alias, setAlias] = useState('');
  const [platform, setPlatform] = useState(availablePlatforms[0] ?? '');
  // Secret hygiene: secret stored only in local component state, cleared on unmount/close
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!alias.trim()) {
      setError('请输入别名');
      return;
    }
    if (alias.includes('/')) {
      setError('别名中不得包含 / 字符');
      return;
    }
    if (secret.trim().length < 8) {
      setError('API Key 长度至少需 8 个字符');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        alias: alias.trim(),
        platform: platform.trim(),
        key_value: secret.trim(),
      });
      setSecret('');
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="app-dialog-overlay" role="presentation" onClick={(e) => !saving && e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-key-title"
      >
        <header className="app-dialog-header">
          <h2 id="create-key-title" className="app-h2">新建 API 密钥</h2>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="app-dialog-body settings-form-body">
            {error && (
              <div className="settings-alert settings-alert--error" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="settings-form-group">
              <label htmlFor="key-alias" className="settings-form-label">密钥别名 (Alias) *</label>
              <input
                id="key-alias"
                type="text"
                className="settings-form-input"
                placeholder="例如: deepseek-work-key"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="settings-form-group">
              <label htmlFor="key-platform" className="settings-form-label">适用平台 (Platform) *</label>
              <select
                id="key-platform"
                className="settings-form-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={saving}
              >
                {availablePlatforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="settings-form-group">
              <label htmlFor="key-value" className="settings-form-label">密钥内容 (Key Value) *</label>
              <input
                id="key-value"
                type="password"
                className="settings-form-input"
                placeholder="sk-..."
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                disabled={saving}
                autoComplete="off"
                required
              />
              <span className="settings-form-hint">
                密钥内容仅本次在内存中提交至安全保管库，系统绝不回显或在客户端留存。
              </span>
            </div>
          </div>
          <footer className="app-dialog-footer">
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={() => {
                setSecret('');
                onClose();
              }}
              disabled={saving}
            >
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={saving}>
              {saving ? '保存中...' : '创建密钥'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

interface ApiKeyRenameDialogProps {
  apiKey: ApiKeyRow;
  onClose: () => void;
  onSave: (newAlias: string) => Promise<void>;
}

function ApiKeyRenameDialog({ apiKey, onClose, onSave }: ApiKeyRenameDialogProps) {
  const [newAlias, setNewAlias] = useState(apiKey.alias);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim()) {
      setError('请输入新别名');
      return;
    }
    if (newAlias.includes('/')) {
      setError('别名中不得包含 / 字符');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(newAlias.trim());
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="app-dialog-overlay" role="presentation" onClick={(e) => !saving && e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-key-title"
      >
        <header className="app-dialog-header">
          <h2 id="rename-key-title" className="app-h2">重命名密钥别名</h2>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="app-dialog-body settings-form-body">
            {error && (
              <div className="settings-alert settings-alert--error" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <div className="settings-form-group">
              <label htmlFor="rename-alias" className="settings-form-label">新别名 *</label>
              <input
                id="rename-alias"
                type="text"
                className="settings-form-input"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>
          <footer className="app-dialog-footer">
            <button type="button" className="app-btn app-btn--secondary" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={saving}>
              {saving ? '保存中...' : '确认重命名'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

interface ApiKeyOverwriteDialogProps {
  apiKey: ApiKeyRow;
  onClose: () => void;
  onSave: (newSecret: string) => Promise<void>;
}

function ApiKeyOverwriteDialog({ apiKey, onClose, onSave }: ApiKeyOverwriteDialogProps) {
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (secret.trim().length < 8) {
      setError('API Key 长度至少需 8 个字符');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(secret.trim());
      setSecret('');
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="app-dialog-overlay" role="presentation" onClick={(e) => !saving && e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overwrite-key-title"
      >
        <header className="app-dialog-header">
          <h2 id="overwrite-key-title" className="app-h2">覆写密钥内容</h2>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="app-dialog-body settings-form-body">
            <p className="settings-dialog-copy">
              为别名 <strong>{apiKey.alias}</strong> 录入新的密钥明文内容。
            </p>
            {error && (
              <div className="settings-alert settings-alert--error" role="alert">
                <AlertCircle size={15} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <div className="settings-form-group">
              <label htmlFor="overwrite-val" className="settings-form-label">新密钥内容 *</label>
              <input
                id="overwrite-val"
                type="password"
                className="settings-form-input"
                placeholder="sk-..."
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                disabled={saving}
                autoComplete="off"
                required
              />
            </div>
          </div>
          <footer className="app-dialog-footer">
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={() => {
                setSecret('');
                onClose();
              }}
              disabled={saving}
            >
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={saving}>
              {saving ? '保存中...' : '确认覆写'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

interface ApiKeyDeleteDialogProps {
  apiKey: ApiKeyRow;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function ApiKeyDeleteDialog({ apiKey, onClose, onConfirm }: ApiKeyDeleteDialogProps) {
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogA11y(true, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  return (
    <div className="app-dialog-overlay" role="presentation" onClick={(e) => !saving && e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-key-title"
      >
        <header className="app-dialog-header">
          <h2 id="delete-key-title" className="app-h2">确认删除 API 密钥</h2>
        </header>
        <div className="app-dialog-body">
          <p className="settings-dialog-copy">
            确定要删除密钥 <strong>{apiKey.alias}</strong> ({apiKey.platform}) 吗？
          </p>
          <p className="settings-dialog-subcopy settings-dialog-subcopy--danger">
            注意：该操作将级联删除所有使用相同物理密钥的同名行，并清理系统配置中的兜底密钥！
          </p>
        </div>
        <footer className="app-dialog-footer">
          <button type="button" className="app-btn app-btn--secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="app-btn app-btn--danger"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onConfirm();
            }}
          >
            {saving ? '删除中...' : '确认级联删除'}
          </button>
        </footer>
      </div>
    </div>
  );
}
