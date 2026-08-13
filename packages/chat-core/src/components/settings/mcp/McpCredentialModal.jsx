import React, { useState, useEffect } from 'react';
import { mcpApi } from 'exo-shared';
import { Save, Shield, KeyRound, Edit2, AlertCircle } from 'lucide-react';
import { ModalShell, Button, FIELD_INPUT } from '../../ui';

/**
 * Modal for creating, overwriting, or renaming MCP secret credentials.
 * Mode:
 * - 'create': alias + server_name + credential_value
 * - 'overwrite': credential_value only for existing alias
 * - 'rename': new alias for existing alias
 */
export default function McpCredentialModal({
  isOpen,
  onClose,
  mode = 'create', // 'create' | 'overwrite' | 'rename'
  credential = null, // { alias, server_name, last_four }
  servers = [], // available server list [{ name, display_name }]
  onSaved,
}) {
  const [alias, setAlias] = useState('');
  const [serverName, setServerName] = useState('');
  const [credentialValue, setCredentialValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setCredentialValue('');
      if (mode === 'create') {
        setAlias('');
        setServerName(servers[0]?.name || '');
      } else if (credential) {
        setAlias(credential.alias || '');
        setServerName(credential.server_name || '');
      }
    } else {
      // Security: Clean sensitive state on close
      setCredentialValue('');
      setAlias('');
      setServerName('');
      setErrorMsg('');
    }
  }, [isOpen, mode, credential, servers]);

  const handleSave = async () => {
    setErrorMsg('');

    if (mode === 'create') {
      if (servers.length === 0) {
        setErrorMsg('MCP Server 目录不可用（后端待施工），暂时无法新增凭证');
        return;
      }
      if (!alias.trim()) {
        setErrorMsg('请输入凭证别名 (Alias)');
        return;
      }
      if (alias.includes('/')) {
        setErrorMsg('凭证别名不得包含 "/" 字符');
        return;
      }
      if (!serverName) {
        setErrorMsg('请选择所属 MCP 服务 (Server Name)');
        return;
      }
      if (!credentialValue.trim()) {
        setErrorMsg('请输入凭证密钥 (Secret Key / Token)');
        return;
      }
    } else if (mode === 'overwrite') {
      if (!credentialValue.trim()) {
        setErrorMsg('请输入新的凭证密钥 (Secret Key / Token)');
        return;
      }
    } else if (mode === 'rename') {
      if (!alias.trim()) {
        setErrorMsg('请输入新的凭证别名');
        return;
      }
      if (alias.includes('/')) {
        setErrorMsg('凭证别名不得包含 "/" 字符');
        return;
      }
      if (alias === credential?.alias) {
        setErrorMsg('别名未做修改');
        return;
      }
    }

    setIsSaving(true);
    try {
      if (mode === 'create') {
        await mcpApi.createMcpCredential({
          alias: alias.trim(),
          server_name: serverName,
          credential_value: credentialValue.trim(),
        });
      } else if (mode === 'overwrite') {
        await mcpApi.overwriteMcpCredential(credential.alias, credentialValue.trim());
      } else if (mode === 'rename') {
        await mcpApi.updateMcpCredentialAlias(credential.alias, alias.trim());
      }

      // Security: Clear credential_value in state immediately
      setCredentialValue('');
      setAlias('');
      onSaved();
      onClose();
    } catch (err) {
      console.error('MCP Credential Save Failed:', err.status, err.body?.code || err.message);
      // Security: Clear sensitive input on error
      setCredentialValue('');

      const responseCode = err.body?.code;
      const responseMsg = err.body?.error || err.message;

      if (responseCode) {
        setErrorMsg(`[${responseCode}] ${responseMsg}`);
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        setErrorMsg('后端接口尚不可用 (Backend Pending: 404/Network Error)');
      } else {
        setErrorMsg(`保存失败: ${responseMsg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getModalTitle = () => {
    if (mode === 'create') return 'NEW MCP CREDENTIAL / 新增凭证';
    if (mode === 'overwrite') return 'OVERWRITE SECRET / 重置密钥';
    return 'RENAME ALIAS / 修改别名';
  };

  const getModalIcon = () => {
    if (mode === 'create') return Shield;
    if (mode === 'overwrite') return KeyRound;
    return Edit2;
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={getModalIcon()}
      title={getModalTitle()}
      subtitle={
        mode === 'create'
          ? 'Add write-only credential secret to global pool'
          : `Target Alias: ${credential?.alias || alias}`
      }
      maxW="md"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            CANCEL / 取消
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <Save size={14} strokeWidth={1.5} />
            {isSaving ? 'COMMITTING...' : 'SUBMIT / 提交'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 mb-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Mode: Create */}
        {mode === 'create' && (
          <>
            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">
                Credential Alias / 凭证别名 (Unique)
              </label>
              <input
                className={FIELD_INPUT}
                placeholder="e.g. moonlight-alessandro"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[10px] font-mono tx-system-mute">
                全局唯一标识符，不得包含斜杠 (/)。
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">
                MCP Server / 所属服务
              </label>
              {servers.length > 0 ? (
                <select
                  className={`${FIELD_INPUT} cursor-pointer appearance-none`}
                  value={serverName}
                  onChange={e => setServerName(e.target.value)}
                >
                  {servers.map(s => (
                    <option key={s.name || s.server_name} value={s.name || s.server_name} className="bg-exo-pure">
                      {s.display_name || s.name || s.server_name} ({s.name || s.server_name})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono">
                  ⚠️ MCP Server 目录不可用（后端待施工 404/503）。接口就绪后方可新增凭证。
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">
                Credential Value / 凭证密钥 (Secret Key / Token)
              </label>
              <input
                type="password"
                className={FIELD_INPUT}
                placeholder="Write-only opaque secret value..."
                value={credentialValue}
                onChange={e => setCredentialValue(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-[10px] font-mono text-amber-500/80">
                🔒 密钥为 write-only。提交后前端不会回显或再次读取明文。
              </p>
            </div>
          </>
        )}

        {/* Mode: Overwrite */}
        {mode === 'overwrite' && (
          <>
            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-cinder-line rounded-lg font-mono text-xs space-y-1">
              <div className="tx-system-mute text-[10px]">TARGET CREDENTIAL ALIAS</div>
              <div className="tx-system-accent font-bold">{credential?.alias}</div>
              <div className="tx-system-mute text-[10px] pt-1">SERVER: {credential?.server_name}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">
                New Credential Value / 新凭证密钥
              </label>
              <input
                type="password"
                className={FIELD_INPUT}
                placeholder="Enter replacement secret value..."
                value={credentialValue}
                onChange={e => setCredentialValue(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-[10px] font-mono text-amber-500/80">
                🔒 重置操作将覆盖原密钥。新密钥值同样为 write-only。
              </p>
            </div>
          </>
        )}

        {/* Mode: Rename */}
        {mode === 'rename' && (
          <>
            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-cinder-line rounded-lg font-mono text-xs space-y-1">
              <div className="tx-system-mute text-[10px]">CURRENT ALIAS</div>
              <div className="tx-system-normal font-bold">{credential?.alias}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">
                New Alias / 新凭证别名
              </label>
              <input
                className={FIELD_INPUT}
                placeholder="New alias name..."
                value={alias}
                onChange={e => setAlias(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[10px] font-mono tx-system-mute">
                此修改仅改动别名标识符，原密钥值保持不变。
              </p>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
