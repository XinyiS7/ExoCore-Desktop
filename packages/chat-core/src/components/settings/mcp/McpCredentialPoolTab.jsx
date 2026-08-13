import React, { useState } from 'react';
import { mcpApi } from 'exo-shared';
import {
  Shield, Key, Globe, Plus, Edit2, KeyRound, Trash2,
  RefreshCw, CheckCircle2, XCircle, Lock, Users
} from 'lucide-react';
import { Button } from '../../ui';
import McpCredentialModal from './McpCredentialModal';

export default function McpCredentialPoolTab({
  servers = [],
  serversLoading = false,
  credentials = [],
  credentialsLoading = false,
  assignedAgentsMap = {},
  onRefreshCredentials,
  onRefreshServers,
  onNotify,
  backendPending = false,
}) {
  const [selectedServerFilter, setSelectedServerFilter] = useState('');
  const [serverPublicAliases, setServerPublicAliases] = useState({});
  const [savingServer, setSavingServer] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'overwrite' | 'rename'
  const [editingCredential, setEditingCredential] = useState(null);

  // Initialize/sync public alias local state
  React.useEffect(() => {
    const initial = {};
    servers.forEach(s => {
      initial[s.name] = s.public_credential_alias || '';
    });
    setServerPublicAliases(initial);
  }, [servers]);

  const handleOpenAddModal = () => {
    setModalMode('create');
    setEditingCredential(null);
    setIsModalOpen(true);
  };

  const handleOpenOverwriteModal = (cred) => {
    setModalMode('overwrite');
    setEditingCredential(cred);
    setIsModalOpen(true);
  };

  const handleOpenRenameModal = (cred) => {
    setModalMode('rename');
    setEditingCredential(cred);
    setIsModalOpen(true);
  };

  const handleDeleteCredential = async (alias) => {
    if (!window.confirm(`确定删除 MCP 凭证别名 "${alias}" 吗？`)) return;
    try {
      await mcpApi.deleteMcpCredential(alias);
      onNotify({ type: 'success', msg: `凭证别名 "${alias}" 已成功删除` });
      onRefreshCredentials?.();
    } catch (err) {
      const code = err.body?.code;
      const errorMsg = err.body?.error || err.message;
      if (err.status === 409 || code === 'credential_in_use') {
        onNotify({
          type: 'error',
          msg: `[409 credential_in_use] 该凭证正被公共绑定或 Agent 专属绑定引用，请先前往 Tab 2 解除绑定后再删除。`,
        });
      } else if (code) {
        onNotify({ type: 'error', msg: `[${code}] ${errorMsg}` });
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        onNotify({ type: 'error', msg: '后端接口尚不可用 (Backend Pending: 404)' });
      } else {
        onNotify({ type: 'error', msg: `删除失败: ${errorMsg}` });
      }
    }
  };

  const handleSavePublicBinding = async (serverName) => {
    const aliasValue = serverPublicAliases[serverName] || null;
    setSavingServer(serverName);
    try {
      await mcpApi.updateMcpServerPublicCredential(serverName, aliasValue);
      onNotify({ type: 'success', msg: `Server "${serverName}" 公共凭证绑定已更新` });
      onRefreshServers?.();
    } catch (err) {
      const code = err.body?.code;
      const msg = err.body?.error || err.message;
      if (code) {
        onNotify({ type: 'error', msg: `[${code}] ${msg}` });
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        onNotify({ type: 'error', msg: '后端接口尚不可用 (Backend Pending: 404)' });
      } else {
        onNotify({ type: 'error', msg: `公共绑定保存失败: ${msg}` });
      }
    } finally {
      setSavingServer(null);
    }
  };

  const getStrategyBadge = (strategy) => {
    switch (strategy) {
      case 'none':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border border-slate-500/20 bg-slate-500/5 tx-system-mute">NONE / 无凭证</span>;
      case 'shared':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border border-blue-500/20 bg-blue-500/5 text-blue-400">SHARED / 仅公共</span>;
      case 'per_preset':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border border-purple-500/20 bg-purple-500/5 text-purple-400">PER-PRESET / 专属凭证</span>;
      case 'shared_or_per_preset':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">SHARED OR DEDICATED / 灵活</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border border-cinder-line tx-system-mute">{strategy}</span>;
    }
  };

  const filteredCredentials = selectedServerFilter
    ? credentials.filter(c => c.server_name === selectedServerFilter)
    : credentials;

  return (
    <div className="space-y-8">
      {/* ── Section 1: Public Server Bindings ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-bold tx-system-normal font-mono tracking-wider flex items-center gap-2">
            <Globe size={16} className="tx-system-accent" />
            MCP Server 目录与公共凭证 (Public Server Bindings)
          </h2>
          <p className="text-[11px] tx-system-mute mt-1 font-mono">
            配置各 MCP Server 的全局系统公共凭证。AgentPreset 选择继承公共凭证时将自动解析为对应公共 Alias。
          </p>
        </div>

        {serversLoading ? (
          <div className="flex items-center justify-center h-28">
            <RefreshCw size={18} className="animate-spin tx-system-mute opacity-60" />
          </div>
        ) : servers.length === 0 ? (
          <div className="border border-cinder-line rounded-xl p-6 text-center text-xs tx-system-mute font-mono">
            {backendPending
              ? '后端接口待施工 (404/503)。接口就绪后在此配置 MCP Server 公共凭证。'
              : '本地 Catalog 暂无登记的 MCP Server。'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {servers.map(server => {
              const matchedCreds = credentials.filter(c => c.server_name === server.name);
              const canBindPublic = server.credential_strategy === 'shared' || server.credential_strategy === 'shared_or_per_preset';
              const isSaving = savingServer === server.name;

              return (
                <div
                  key={server.name}
                  className="border border-cinder-line rounded-xl p-4 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold font-mono tx-system-normal">
                        {server.display_name || server.name}
                      </span>
                      <span className="text-[10px] font-mono tx-system-mute">({server.name})</span>
                      {server.available ? (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 size={10} /> AVAILABLE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                          <XCircle size={10} /> BACKEND UNAVAILABLE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStrategyBadge(server.credential_strategy)}
                      {server.credential_required && (
                        <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">
                          CREDENTIAL REQUIRED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {canBindPublic ? (
                      <>
                        <div className="flex flex-col">
                          <label className="text-[9px] font-mono tx-system-mute mb-1">
                            PUBLIC CREDENTIAL ALIAS
                          </label>
                          <select
                            className="bg-black/10 dark:bg-white/10 border border-cinder-line rounded-lg px-3 py-1.5 text-xs font-mono tx-system-normal focus:outline-none min-w-[200px]"
                            value={serverPublicAliases[server.name] || ''}
                            onChange={e => setServerPublicAliases(p => ({ ...p, [server.name]: e.target.value }))}
                          >
                            <option value="" className="bg-exo-pure">— 未绑定公共凭证 (None) —</option>
                            {matchedCreds.map(c => (
                              <option key={c.alias} value={c.alias} className="bg-exo-pure">
                                {c.alias} (•••• {c.last_four || '****'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          className="mt-4"
                          disabled={isSaving}
                          onClick={() => handleSavePublicBinding(server.name)}
                        >
                          {isSaving ? 'SAVING...' : 'BIND PUBLIC'}
                        </Button>
                      </>
                    ) : (
                      <div className="text-xs font-mono tx-system-mute bg-black/5 dark:bg-white/5 px-3 py-2 rounded-lg border border-cinder-line flex items-center gap-2">
                        <Lock size={12} />
                        {server.credential_strategy === 'per_preset'
                          ? '此服务要求 Per-Preset 专属凭证，不使用公共凭证'
                          : '此服务无需凭证'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Credential Pool Table ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tx-system-normal font-mono tracking-wider flex items-center gap-2">
              <Shield size={16} className="tx-system-accent" />
              MCP 密钥凭证池 (Credentials Pool)
            </h2>
            <p className="text-[11px] tx-system-mute mt-1 font-mono">
              集中管理所有 MCP Server 密钥。凭证值为 Write-Only 明文。已分配 Agent 标签为只读引用全景。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="bg-black/10 dark:bg-white/10 border border-cinder-line rounded-lg px-3 py-1.5 text-xs font-mono tx-system-normal focus:outline-none"
              value={selectedServerFilter}
              onChange={e => setSelectedServerFilter(e.target.value)}
            >
              <option value="" className="bg-exo-pure">所有 Server (All Servers)</option>
              {servers.map(s => (
                <option key={s.name} value={s.name} className="bg-exo-pure">
                  {s.display_name || s.name}
                </option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={handleOpenAddModal}>
              <Plus size={14} />
              ADD CREDENTIAL
            </Button>
          </div>
        </div>

        {credentialsLoading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw size={18} className="animate-spin tx-system-mute opacity-60" />
          </div>
        ) : (
          <div className="border border-cinder-line rounded-xl overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-cinder-line text-[10px] font-mono tracking-wider tx-system-mute uppercase">
              <span className="col-span-3">Alias / 别名</span>
              <span className="col-span-2">Server / 服务</span>
              <span className="col-span-2">Last Four / 尾号</span>
              <span className="col-span-3">Assigned Agents (只读)</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            <div className="divide-y divide-cinder-line">
              {filteredCredentials.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs tx-system-mute font-mono">
                  {backendPending
                    ? '后端接口待施工 (404/503)。接口就绪后在此列出已登记的 MCP 凭证。'
                    : '暂无 MCP 凭证记录。点击右上角 "ADD CREDENTIAL" 新增凭证。'}
                </div>
              ) : (
                filteredCredentials.map(cred => {
                  const assignedAgents = assignedAgentsMap[cred.alias] || [];

                  return (
                    <div
                      key={cred.alias}
                      className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-exo-accent/[0.02] transition-colors"
                    >
                      <div className="col-span-3 flex items-center gap-2">
                        <Key size={14} className="tx-system-accent shrink-0" />
                        <span className="text-xs font-mono font-bold tx-system-normal truncate" title={cred.alias}>
                          {cred.alias}
                        </span>
                      </div>
                      <div className="col-span-2 font-mono text-[11px] tx-system-mute truncate">
                        <span className="px-2 py-0.5 rounded border border-cinder-line bg-black/5 dark:bg-white/5">
                          {cred.server_name}
                        </span>
                      </div>
                      <div className="col-span-2 font-mono text-[11px] tx-system-mute">
                        <code>•••• {cred.last_four || '****'}</code>
                      </div>
                      <div className="col-span-3 flex flex-wrap gap-1 items-center">
                        {assignedAgents.length === 0 ? (
                          <span className="text-[10px] font-mono tx-system-mute opacity-50">— 未分配 —</span>
                        ) : (
                          assignedAgents.map(agentName => (
                            <span
                              key={agentName}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border border-chat-accent/20 bg-chat-accent/5 text-chat-accent"
                            >
                              <Users size={9} />
                              {agentName}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenOverwriteModal(cred)}
                          className="p-1.5 tx-system-mute hover:tx-system-accent hover:bg-exo-accent/5 rounded-lg transition-colors"
                          title="重置密钥 (Overwrite Secret)"
                        >
                          <KeyRound size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenRenameModal(cred)}
                          className="p-1.5 tx-system-mute hover:tx-system-accent hover:bg-exo-accent/5 rounded-lg transition-colors"
                          title="修改别名 (Rename Alias)"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteCredential(cred.alias)}
                          className="p-1.5 tx-system-mute hover:text-rose-500 hover:bg-rose-500/5 rounded-lg transition-colors"
                          title="删除凭证 (Delete Credential)"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* McpCredential Modal */}
      <McpCredentialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        credential={editingCredential}
        servers={servers}
        onSaved={onRefreshCredentials}
      />
    </div>
  );
}
