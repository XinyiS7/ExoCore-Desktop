import React, { useState, useEffect, useCallback } from 'react';
import { mcpApi } from 'exo-shared';
import { Key, UserCheck, AlertTriangle } from 'lucide-react';
import { usePresets } from '../../../hooks/usePresets';
import Toast from '../Toast';
import McpCredentialPoolTab from './McpCredentialPoolTab';
import McpAgentAccessTab from './McpAgentAccessTab';

export default function McpManagePanel() {
  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' | 'agents'
  const { presets } = usePresets();

  // ── Global Resources ──
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [credentials, setCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [assignedAgentsMap, setAssignedAgentsMap] = useState({});
  const [selectedPresetId, setSelectedPresetId] = useState(null);

  // ── Status & Feedback ──
  const [feedback, setFeedback] = useState(null);
  const [backendPending, setBackendPending] = useState(false);

  const clearFeedback = () => setFeedback(null);
  const handleNotify = useCallback((toast) => setFeedback(toast), []);

  // Initialize selected preset
  useEffect(() => {
    if (presets && presets.length > 0 && !selectedPresetId) {
      setSelectedPresetId(presets[0].id);
    }
  }, [presets, selectedPresetId]);

  // ── Fetch Servers ──
  const fetchServers = useCallback(async () => {
    setServersLoading(true);
    try {
      const data = await mcpApi.listMcpServers();
      const list = Array.isArray(data) ? data : (data?.servers || []);
      setServers(list);
      setBackendPending(false);
    } catch (err) {
      console.warn('MCP Servers fetch failed:', err);
      const code = err.body?.code;
      if (code) {
        setFeedback({ type: 'error', msg: `[${code}] ${err.body?.error || err.message}` });
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        setBackendPending(true);
      }
      setServers([]);
    } finally {
      setServersLoading(false);
    }
  }, []);

  // ── Fetch Credentials ──
  const fetchCredentials = useCallback(async () => {
    setCredentialsLoading(true);
    try {
      const data = await mcpApi.listMcpCredentials();
      const list = Array.isArray(data) ? data : (data?.credentials || []);
      setCredentials(list);
      setBackendPending(false);
    } catch (err) {
      console.warn('MCP Credentials fetch failed:', err);
      const code = err.body?.code;
      if (code) {
        setFeedback({ type: 'error', msg: `[${code}] ${err.body?.error || err.message}` });
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        setBackendPending(true);
      }
      setCredentials([]);
    } finally {
      setCredentialsLoading(false);
    }
  }, []);

  // ── Derive Assigned Agents Map across all presets ──
  const fetchAllPresetBindings = useCallback(async () => {
    if (!presets || presets.length === 0) return;

    try {
      const results = await Promise.allSettled(
        presets.map(p => mcpApi.getPresetMcpCredentials(p.id))
      );

      const mapping = {}; // { [alias]: [presetName1, presetName2] }

      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value) {
          const presetName = presets[idx].name;
          const serversList = Array.isArray(res.value) ? res.value : (res.value?.servers || []);
          serversList.forEach(s => {
            if (s.mode === 'dedicated' && s.credential_alias) {
              if (!mapping[s.credential_alias]) {
                mapping[s.credential_alias] = [];
              }
              if (!mapping[s.credential_alias].includes(presetName)) {
                mapping[s.credential_alias].push(presetName);
              }
            }
          });
        }
      });

      setAssignedAgentsMap(mapping);
    } catch (err) {
      console.warn('Failed to derive preset bindings mapping:', err);
    }
  }, [presets]);

  // Initial load
  useEffect(() => {
    fetchServers();
    fetchCredentials();
  }, [fetchServers, fetchCredentials]);

  useEffect(() => {
    fetchAllPresetBindings();
  }, [fetchAllPresetBindings, credentials]);

  const handleRefreshAll = useCallback(() => {
    fetchServers();
    fetchCredentials();
    fetchAllPresetBindings();
  }, [fetchServers, fetchCredentials, fetchAllPresetBindings]);

  return (
    <div className="h-full flex flex-col">
      {/* Backend Pending Top Notice Banner */}
      {backendPending && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-2.5 text-xs font-mono text-amber-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>
              <strong>Backend Pending (后端待施工)</strong>: 当前 Django 接口 <code>/api/agents/mcp-credentials/</code> 尚未上线，前端呈现为 404 / 503 保护态。
            </span>
          </div>
          <span className="text-[10px] tx-system-mute font-mono">ReactSheet §10</span>
        </div>
      )}

      {/* Top navigation tabs (2-Tab Structure) */}
      <div className="flex gap-4 border-b border-cinder-line px-8 pt-4 shrink-0 bg-exo-pure/5">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider transition-all border-b-2 -mb-[1px] ${
            activeTab === 'credentials'
              ? 'border-chat-accent tx-system-accent font-bold bg-chat-accent/[0.03]'
              : 'tx-system-mute border-transparent hover:tx-system-normal'
          }`}
        >
          <Key size={14} />
          CREDENTIAL POOL & PUBLIC BINDINGS / 凭证池与公共绑定
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider transition-all border-b-2 -mb-[1px] ${
            activeTab === 'agents'
              ? 'border-chat-accent tx-system-accent font-bold bg-chat-accent/[0.03]'
              : 'tx-system-mute border-transparent hover:tx-system-normal'
          }`}
        >
          <UserCheck size={14} />
          AGENT VISITOR ACCESS / AGENT 授权与绑定
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === 'credentials' ? (
          <McpCredentialPoolTab
            servers={servers}
            serversLoading={serversLoading}
            credentials={credentials}
            credentialsLoading={credentialsLoading}
            assignedAgentsMap={assignedAgentsMap}
            onRefreshCredentials={handleRefreshAll}
            onRefreshServers={fetchServers}
            onNotify={handleNotify}
            backendPending={backendPending}
          />
        ) : (
          <McpAgentAccessTab
            presets={presets}
            selectedPresetId={selectedPresetId}
            onSelectPresetId={setSelectedPresetId}
            credentials={credentials}
            onNotify={handleNotify}
            onRefreshBindings={handleRefreshAll}
            backendPending={backendPending}
          />
        )}
      </div>

      <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
    </div>
  );
}
