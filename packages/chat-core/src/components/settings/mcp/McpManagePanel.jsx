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
  // Per-source reachability flags; banner derived from them
  const [serversDown, setServersDown] = useState(false);
  const [credentialsDown, setCredentialsDown] = useState(false);

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
      setServersDown(false);
    } catch (err) {
      console.warn('MCP Servers fetch failed:', err.status, err.body?.code || err.message);
      const code = err.body?.code;
      if (code) {
        setFeedback({ type: 'error', msg: `[${code}] ${err.body?.error || err.message}` });
        setServersDown(false);
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        setServersDown(true);
      } else {
        setServersDown(false);
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
      setCredentialsDown(false);
    } catch (err) {
      console.warn('MCP Credentials fetch failed:', err.status, err.body?.code || err.message);
      const code = err.body?.code;
      if (code) {
        setFeedback({ type: 'error', msg: `[${code}] ${err.body?.error || err.message}` });
        setCredentialsDown(false);
      } else if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        setCredentialsDown(true);
      } else {
        setCredentialsDown(false);
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
      console.warn('Failed to derive preset bindings mapping:', err.status, err.body?.code || err.message);
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

  // Backend reachability banner
  const backendPending = serversDown || credentialsDown;

  const handleRefreshAll = useCallback(() => {
    fetchServers();
    fetchCredentials();
    fetchAllPresetBindings();
  }, [fetchServers, fetchCredentials, fetchAllPresetBindings]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Backend Pending Top Notice Banner */}
      {backendPending && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 sm:px-6 sm:py-2.5 text-[11px] font-mono text-amber-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-amber-500" />
            <span className="leading-tight">
              <strong>后端待施工 (404/503)</strong>: MCP 接口尚未就绪，已进入只读保护态。
            </span>
          </div>
          <span className="text-[10px] tx-system-mute font-mono hidden sm:inline">ReactSheet §10</span>
        </div>
      )}

      {/* Top Navigation Tabs (PWA-first sleek segmented control) */}
      <div className="border-b border-cinder-line px-3.5 pt-3 sm:px-6 sm:pt-4 shrink-0 bg-exo-pure/5">
        <div className="flex gap-2 max-w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-mono tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'credentials'
                ? 'border-chat-accent tx-system-accent font-bold bg-chat-accent/[0.06]'
                : 'tx-system-mute border-transparent hover:tx-system-normal hover:bg-white/[0.02]'
            }`}
          >
            <Key size={14} className="shrink-0" />
            <span>凭证池与公共绑定</span>
            {credentials.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-chat-accent/15 text-chat-accent font-bold">
                {credentials.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-mono tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'agents'
                ? 'border-chat-accent tx-system-accent font-bold bg-chat-accent/[0.06]'
                : 'tx-system-mute border-transparent hover:tx-system-normal hover:bg-white/[0.02]'
            }`}
          >
            <UserCheck size={14} className="shrink-0" />
            <span>Agent 授权与绑定</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 py-4 sm:px-6 sm:py-6">
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
