import React, { useState, useEffect, useCallback } from 'react';
import { mcpApi } from 'exo-shared';
import {
  UserCheck, Layers, Key, AlertTriangle,
  RefreshCw, CheckCircle2, XCircle
} from 'lucide-react';
import { Button } from '../../ui';

export default function McpAgentAccessTab({
  presets = [],
  selectedPresetId,
  onSelectPresetId,
  credentials = [],
  onNotify,
  onRefreshBindings,
  backendPending = false,
}) {
  const [drawers, setDrawers] = useState([]);
  const [drawersLoading, setDrawersLoading] = useState(false);
  const [presetMcpServers, setPresetMcpServers] = useState([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [bindingForms, setBindingForms] = useState({});
  const [savingServer, setSavingServer] = useState(null);

  // Fetch preset-specific drawers and MCP server bindings
  const fetchPresetData = useCallback(async (presetId) => {
    if (!presetId) return;
    setDrawersLoading(true);
    setMcpLoading(true);

    try {
      const drawerData = await mcpApi.getPresetDrawers(presetId);
      const list = Array.isArray(drawerData) ? drawerData : (drawerData?.drawers || []);
      setDrawers(list);
    } catch (err) {
      console.warn('Preset drawers fetch failed:', err.status, err.body?.code || err.message);
      const code = err.body?.code;
      if (code) {
        onNotify?.({ type: 'error', msg: `[${code}] ${err.body?.error || err.message}` });
      } else if ((err.status === 404 || err.message?.includes('Failed to fetch')) && !backendPending) {
        onNotify?.({ type: 'error', msg: '后端接口尚不可用 (Backend Pending: 404)' });
      }
      setDrawers([]);
    } finally {
      setDrawersLoading(false);
    }

    try {
      const mcpData = await mcpApi.getPresetMcpCredentials(presetId);
      const list = Array.isArray(mcpData) ? mcpData : (mcpData?.servers || []);
      setPresetMcpServers(list);

      const forms = {};
      list.forEach(item => {
        const defaultMode = item.credential_strategy === 'per_preset' ? 'dedicated' : (item.mode || 'inherit_public');
        forms[item.server_name] = {
          mode: defaultMode,
          credential_alias: item.credential_alias || '',
        };
      });
      setBindingForms(forms);
    } catch (err) {
      console.warn('Preset MCP credentials fetch failed:', err.status, err.body?.code || err.message);
      const code = err.body?.code;
      if (code) {
        onNotify?.({ type: 'error', msg: `[${code}] ${err.body?.error || err.message}` });
      } else if ((err.status === 404 || err.message?.includes('Failed to fetch')) && !backendPending) {
        onNotify?.({ type: 'error', msg: '后端接口尚不可用 (Backend Pending: 404)' });
      }
      setPresetMcpServers([]);
    } finally {
      setMcpLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    if (selectedPresetId) {
      fetchPresetData(selectedPresetId);
    }
  }, [selectedPresetId, fetchPresetData]);

  // Drawer Toggle with optimistic update & rollback on error (REQ 4.1)
  const handleToggleDrawer = async (drawerName, currentEnabled) => {
    if (!selectedPresetId) return;
    const newEnabled = !currentEnabled;

    // Optimistic UI update
    setDrawers(prev =>
      prev.map(d => (d.name === drawerName ? { ...d, enabled: newEnabled } : d))
    );

    try {
      await mcpApi.updatePresetDrawer(selectedPresetId, drawerName, newEnabled);
      onNotify?.({ type: 'success', msg: `Drawer "${drawerName}" 授权已更新为 ${newEnabled ? '启用' : '禁用'}` });
    } catch (err) {
      // Rollback on failure
      setDrawers(prev =>
        prev.map(d => (d.name === drawerName ? { ...d, enabled: currentEnabled } : d))
      );
      const code = err.body?.code;
      const msg = err.body?.error || err.message;
      if (code) {
        onNotify?.({ type: 'error', msg: `[${code}] Drawer 授权更新失败: ${msg}` });
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        onNotify?.({ type: 'error', msg: '后端接口尚不可用 (Backend Pending: 404)' });
      } else {
        onNotify?.({ type: 'error', msg: `Drawer 授权更新失败: ${msg}` });
      }
    }
  };

  // Save Preset MCP Server Credential Binding
  const handleSavePresetBinding = async (serverName, strategy) => {
    if (!selectedPresetId) return;
    const form = bindingForms[serverName] || { mode: 'inherit_public', credential_alias: '' };
    
    // Per-strategy payload validation
    let payload;
    if (strategy === 'per_preset') {
      if (!form.credential_alias) {
        onNotify?.({ type: 'error', msg: `该服务要求专属凭证 (per_preset)，请先在下拉列表中选择一个凭证别名。` });
        return;
      }
      payload = { mode: 'dedicated', credential_alias: form.credential_alias };
    } else if (strategy === 'shared') {
      payload = { mode: 'inherit_public', credential_alias: null };
    } else if (strategy === 'shared_or_per_preset') {
      if (form.mode === 'dedicated' && !form.credential_alias) {
        onNotify?.({ type: 'error', msg: `已选择专属凭证模式，请指定凭证别名。` });
        return;
      }
      payload = {
        mode: form.mode,
        credential_alias: form.mode === 'dedicated' ? form.credential_alias : null,
      };
    } else {
      return;
    }

    setSavingServer(serverName);
    try {
      await mcpApi.updatePresetMcpCredential(selectedPresetId, serverName, payload);
      onNotify?.({ type: 'success', msg: `Agent MCP "${serverName}" 凭证绑定已成功保存` });
      fetchPresetData(selectedPresetId);
      onRefreshBindings?.();
    } catch (err) {
      const code = err.body?.code;
      const msg = err.body?.error || err.message;
      if (code) {
        onNotify?.({ type: 'error', msg: `[${code}] ${msg}` });
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        onNotify?.({ type: 'error', msg: '后端接口尚不可用 (Backend Pending: 404)' });
      } else {
        onNotify?.({ type: 'error', msg: `绑定保存失败: ${msg}` });
      }
    } finally {
      setSavingServer(null);
    }
  };

  const selectedPreset = presets.find(p => p.id === selectedPresetId);

  return (
    <div className="space-y-8">
      {/* ── Preset Selector Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cinder-line">
        <div>
          <h2 className="text-sm font-bold tx-system-normal font-mono tracking-wider flex items-center gap-2">
            <UserCheck size={16} className="tx-system-accent" />
            Agent 访问授权与凭证绑定 (Preset Access & Bindings)
          </h2>
          <p className="text-[11px] tx-system-mute mt-1 font-mono">
            选择目标 Agent 人设，管理其 Tool Drawer 授权以及在各 MCP 服务下的凭证配置（唯一写入入口）。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-xs font-mono tx-system-mute uppercase shrink-0">SELECT PRESET:</label>
          <select
            className="bg-black/10 dark:bg-white/10 border border-cinder-line rounded-lg px-3 py-1.5 text-xs font-mono tx-system-normal focus:outline-none min-w-[200px]"
            value={selectedPresetId || ''}
            onChange={e => onSelectPresetId?.(Number(e.target.value))}
          >
            {presets.map(p => (
              <option key={p.id} value={p.id} className="bg-exo-pure">
                {p.name} ({p.agent_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Section 1: Preset Tool Drawer Visitor Access (Checkboxes) ── */}
      <div className="border border-cinder-line rounded-xl p-5 bg-black/[0.01] dark:bg-white/[0.01] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono tracking-wider tx-system-normal flex items-center gap-2 uppercase">
            <Layers size={14} className="tx-system-accent" />
            1. Tool Drawer Visitor 授权 ({selectedPreset?.name || 'Agent'})
          </h3>
          <span className="text-[10px] font-mono tx-system-mute">
            勾选决定该 Agent 是否具有对应 Tool Drawer 的调用权限
          </span>
        </div>

        {drawersLoading ? (
          <div className="flex items-center justify-center h-24">
            <RefreshCw size={16} className="animate-spin tx-system-mute opacity-60" />
          </div>
        ) : drawers.length === 0 ? (
          <div className="text-xs font-mono tx-system-mute p-6 text-center border border-cinder-line rounded-lg">
            {backendPending
              ? '后端接口待施工 (GET /api/agents/presets/<id>/drawers/ 404/503)'
              : '暂无可用 Tool Drawer 登记。'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {drawers.map(drawer => (
              <div
                key={drawer.name}
                className={`border rounded-lg p-4 transition-all flex items-start justify-between gap-3 ${
                  drawer.enabled
                    ? 'border-chat-accent/40 bg-chat-accent/[0.02]'
                    : 'border-cinder-line opacity-75'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold tx-system-normal">
                      {drawer.display_name || drawer.name}
                    </span>
                    <span className="text-[9px] font-mono tx-system-mute">({drawer.name})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {drawer.available ? (
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 size={9} /> Available
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                        <XCircle size={9} /> Backend Unavailable
                      </span>
                    )}

                    {!drawer.credential_ready && (
                      <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 flex items-center gap-1" title="凭证未就绪：Heartbeat 与 go_to 调用将在网络层 Fail Closed">
                        <AlertTriangle size={9} /> Credential Not Ready
                      </span>
                    )}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={Boolean(drawer.enabled)}
                    onChange={() => handleToggleDrawer(drawer.name, drawer.enabled)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-black/20 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-chat-accent"></div>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Preset MCP Server Credential Bindings ── */}
      <div className="border border-cinder-line rounded-xl p-5 bg-black/[0.01] dark:bg-white/[0.01] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono tracking-wider tx-system-normal flex items-center gap-2 uppercase">
            <Key size={14} className="tx-system-accent" />
            2. MCP Server 凭证绑定配置 ({selectedPreset?.name || 'Agent'})
          </h3>
          <span className="text-[10px] font-mono tx-system-mute">
            配置该 Agent 调用具体 MCP Server 时的凭证解析来源
          </span>
        </div>

        {mcpLoading ? (
          <div className="flex items-center justify-center h-24">
            <RefreshCw size={16} className="animate-spin tx-system-mute opacity-60" />
          </div>
        ) : presetMcpServers.length === 0 ? (
          <div className="text-xs font-mono tx-system-mute p-6 text-center border border-cinder-line rounded-lg">
            {backendPending
              ? '后端接口待施工 (GET /api/agents/presets/<id>/mcp-credentials/ 404/503)'
              : '暂无可配置的 MCP Server。'}
          </div>
        ) : (
          <div className="space-y-4">
            {presetMcpServers.map(item => {
              const form = bindingForms[item.server_name] || { mode: 'inherit_public', credential_alias: '' };
              const matchedCreds = credentials.filter(c => c.server_name === item.server_name);
              const isPerPresetOnly = item.credential_strategy === 'per_preset';
              const isSharedOnly = item.credential_strategy === 'shared';
              const isNone = item.credential_strategy === 'none';
              const isSaving = savingServer === item.server_name;

              return (
                <div
                  key={item.server_name}
                  className="border border-cinder-line rounded-lg p-4 bg-black/5 dark:bg-white/5 space-y-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold tx-system-normal">
                        {item.server_name}
                      </span>
                      {item.resolved_source && (
                        <span className="text-[9px] font-mono text-chat-accent bg-chat-accent/10 px-2 py-0.5 rounded border border-chat-accent/20">
                          RESOLVED: {item.resolved_source.toUpperCase()} ({item.resolved_alias || 'NONE'})
                        </span>
                      )}
                    </div>
                    <div>
                      {item.credential_ready ? (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                          <CheckCircle2 size={11} /> READY
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-rose-400">
                          <AlertTriangle size={11} /> NOT READY
                        </span>
                      )}
                    </div>
                  </div>

                  {!isNone ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      {/* Mode Selection with Per-Strategy Lock */}
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[9px] font-mono tx-system-mute">MODE / 凭证模式</label>
                        <select
                          className="w-full bg-black/10 dark:bg-white/10 border border-cinder-line rounded-lg px-3 py-1.5 text-xs font-mono tx-system-normal focus:outline-none disabled:opacity-60"
                          value={form.mode}
                          disabled={isPerPresetOnly || isSharedOnly}
                          onChange={e => {
                            const newMode = e.target.value;
                            setBindingForms(p => ({
                              ...p,
                              [item.server_name]: {
                                mode: newMode,
                                credential_alias: newMode === 'inherit_public' ? '' : (p[item.server_name]?.credential_alias || ''),
                              },
                            }));
                          }}
                        >
                          {!isPerPresetOnly && (
                            <option value="inherit_public" className="bg-exo-pure">
                              inherit_public (继承公共凭证)
                            </option>
                          )}
                          {!isSharedOnly && (
                            <option value="dedicated" className="bg-exo-pure">
                              dedicated (专属凭证)
                            </option>
                          )}
                        </select>
                        {isPerPresetOnly && (
                          <p className="text-[9px] font-mono tx-system-mute">
                            🔒 策略要求 Per-Preset 专属凭证
                          </p>
                        )}
                        {isSharedOnly && (
                          <p className="text-[9px] font-mono tx-system-mute">
                            🌐 策略仅支持继承公共凭证
                          </p>
                        )}
                      </div>

                      {/* Alias Selection (disabled when inherit_public) */}
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[9px] font-mono tx-system-mute">DEDICATED ALIAS / 专属凭证</label>
                        <select
                          className="w-full bg-black/10 dark:bg-white/10 border border-cinder-line rounded-lg px-3 py-1.5 text-xs font-mono tx-system-normal focus:outline-none disabled:opacity-40"
                          value={form.credential_alias}
                          disabled={form.mode !== 'dedicated'}
                          onChange={e => setBindingForms(p => ({
                            ...p,
                            [item.server_name]: { ...p[item.server_name], credential_alias: e.target.value },
                          }))}
                        >
                          <option value="" className="bg-exo-pure">
                            {form.mode === 'dedicated' ? '— 选择专属凭证 (Dedicated Alias) —' : '— 自动继承公共凭证 (null) —'}
                          </option>
                          {matchedCreds.map(c => (
                            <option key={c.alias} value={c.alias} className="bg-exo-pure">
                              {c.alias} (•••• {c.last_four || '****'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Save Button */}
                      <div className="md:col-span-2">
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          disabled={isSaving}
                          onClick={() => handleSavePresetBinding(item.server_name, item.credential_strategy)}
                        >
                          {isSaving ? 'SAVING...' : 'SAVE'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-mono tx-system-mute">
                      ⚪ 当前 Server 策略为 none，无凭证绑定需求。
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
