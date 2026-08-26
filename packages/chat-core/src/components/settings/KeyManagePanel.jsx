import { useState, useEffect, useCallback } from 'react';
import { configApi } from 'exo-shared';
import { RefreshCw, Plus, Edit2, Trash2, Key, Globe, Shield } from 'lucide-react';
import KeyPoolSection from './KeyPoolSection';
import EndpointEditModal from '../modals/EndpointEditModal';
import { Button } from '../ui';
import Toast from './Toast';

export default function KeyManagePanel() {
  const [activeTab, setActiveTab] = useState('endpoints'); // 'endpoints' | 'apikeys'

  // Endpoint State
  const [endpoints, setEndpoints] = useState([]);
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  
  // API Key State
  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [providers, setProviders] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(null);

  const [feedback, setFeedback] = useState(null);
  const clearFeedback = () => setFeedback(null);

  const fetchEndpoints = useCallback(() => {
    setEndpointsLoading(true);
    configApi.listEndpoints()
      .then(data => {
        setEndpoints(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Local mock fallback if backend API is not ready
        setEndpoints([
          { id: 1, name: "DeepSeek 官方", provider: "deepseek", base_url: "https://api.deepseek.com/v1", api_key: 1, payload_format: "openai", cache_transport: "inline_chunk", attachment_transports: ["inline_text"], configured: true, enabled: true },
          { id: 2, name: "Gemini 官方", provider: "gemini", base_url: "", api_key: 2, payload_format: "gemini", cache_transport: "remote_reference", attachment_transports: ["file_uri", "inline_text", "inline_image"], configured: true, enabled: true },
          { id: 3, name: "OpenRouter Gemini", provider: "openrouter", base_url: "https://openrouter.ai/api/v1", api_key: 3, payload_format: "openai", cache_transport: "inline_chunk", attachment_transports: ["inline_text", "inline_image"], configured: true, enabled: true }
        ]);
      })
      .finally(() => setEndpointsLoading(false));
  }, []);

  const fetchProviders = useCallback(() => {
    configApi.getModelCatalog()
      .then(data => {
        setProviders(Array.isArray(data?.providers) ? data.providers : []);
      })
      .catch(error => {
        console.error("Provider templates 加载失败", error);
        setProviders([]);
      });
  }, []);

  const fetchKeys = useCallback(() => {
    setKeysLoading(true);
    configApi.listApiKeys()
      .then(data => {
        setKeys(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Local mock fallback if backend API is not ready
        setKeys([
          { alias: "ds-official-key", platform: "deepseek", last_four: "a1b2", id: 1 },
          { alias: "gem-official-key", platform: "gemini", last_four: "c3d4", id: 2 },
          { alias: "openrouter-key", platform: "openai", last_four: "f5g6", id: 3 }
        ]);
      })
      .finally(() => setKeysLoading(false));
  }, []);

  useEffect(() => {
    fetchEndpoints();
    fetchKeys();
    fetchProviders();
  }, [fetchEndpoints, fetchKeys, fetchProviders]);

  const handleEndpointSaveSuccess = () => {
    fetchEndpoints();
    setFeedback({ type: 'success', msg: '通道端点已成功保存' });
  };

  const handleEditEndpoint = (ep) => {
    setEditingEndpoint(ep);
    setIsModalOpen(true);
  };

  const handleAddEndpoint = () => {
    setEditingEndpoint(null);
    setIsModalOpen(true);
  };

  const handleDeleteEndpoint = async (id, name) => {
    if (!window.confirm(`确定删除端点 "${name}" 吗？这可能会影响使用此端点模型的消息发送。`)) return;
    try {
      await configApi.deleteEndpoint(id);
      setFeedback({ type: 'success', msg: '端点已删除' });
      fetchEndpoints();
    } catch (err) {
      const detail = err.body?.detail || err.message;
      setFeedback({ type: 'error', msg: `删除失败: ${detail}` });
    }
  };

  const isLoading = activeTab === 'endpoints' ? endpointsLoading : keysLoading;

  return (
    <div className="h-full flex flex-col">
      {/* Top navigation tabs */}
      <div className="flex gap-4 border-b border-cinder-line px-8 pt-4 shrink-0 bg-exo-pure/5">
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider transition-all border-b-2 -mb-[1px] ${
            activeTab === 'endpoints'
              ? 'border-chat-accent tx-system-accent font-bold bg-chat-accent/[0.03]'
              : 'tx-system-mute border-transparent hover:tx-system-normal'
          }`}
        >
          <Globe size={14} />
          ENDPOINTS / 端点通道
        </button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider transition-all border-b-2 -mb-[1px] ${
            activeTab === 'apikeys'
              ? 'border-chat-accent tx-system-accent font-bold bg-chat-accent/[0.03]'
              : 'tx-system-mute border-transparent hover:tx-system-normal'
          }`}
        >
          <Key size={14} />
          API KEYS / 密钥池
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw size={20} className="animate-spin tx-system-mute opacity-60" />
          </div>
        ) : activeTab === 'endpoints' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold tx-system-normal font-mono tracking-wider flex items-center gap-2">
                  <Shield size={16} className="tx-system-accent" />
                  端点通道列表 (Endpoints)
                </h2>
                <p className="text-[11px] tx-system-mute mt-1 font-mono">
                  配置模型网络通道（接口地址、格式、密钥），然后在模型分配页面绑定给具体角色。
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={handleAddEndpoint}>
                <Plus size={14} />
                ADD ENDPOINT
              </Button>
            </div>

            {/* Endpoints Table/List */}
            <div className="border border-cinder-line rounded-xl overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-cinder-line text-[10px] font-mono tracking-wider tx-system-mute uppercase">
                <span className="col-span-3">Alias / 名称</span>
                <span className="col-span-2">Provider / 渠道</span>
                <span className="col-span-4">Base URL / 接口</span>
                <span className="col-span-2 text-center">Status / 状态</span>
                <span className="col-span-1 text-right">Actions</span>
              </div>

              <div className="divide-y divide-cinder-line">
                {endpoints.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs tx-system-mute font-mono">
                    暂无已配置的端点通道。点击右上角 "ADD ENDPOINT" 新增。
                  </div>
                ) : (
                  endpoints.map(ep => (
                    <div
                      key={ep.id}
                      className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-exo-accent/[0.02] transition-colors"
                    >
                      <div className="col-span-3 flex flex-col">
                        <span className="text-xs font-mono font-bold tx-system-normal">{ep.name}</span>
                        {ep.payload_format && (
                          <span className="text-[9px] font-mono tx-system-mute mt-0.5 opacity-60">
                            {ep.payload_format.toUpperCase()} · {ep.cache_transport === 'remote_reference' ? 'REMOTE CACHE' : 'INLINE CACHE'}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border border-chat-accent/20 bg-chat-accent/5 tx-system-accent uppercase">
                          {ep.provider}
                        </span>
                      </div>
                      <div className="col-span-4 font-mono text-[11px] tx-system-mute truncate">
                        {ep.base_url || '— 官方直连 (Official) —'}
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-2 font-mono text-[10px]">
                        <span className={`w-1.5 h-1.5 rounded-full ${ep.enabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className={ep.enabled ? 'tx-system-normal' : 'tx-system-mute'}>
                          {ep.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditEndpoint(ep)}
                          className="p-1.5 tx-system-mute hover:tx-system-accent hover:bg-exo-accent/5 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteEndpoint(ep.id, ep.name)}
                          className="p-1.5 tx-system-mute hover:text-rose-500 hover:bg-rose-500/5 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold tx-system-normal font-mono tracking-wider flex items-center gap-2">
                <Key size={16} className="tx-system-accent" />
                系统 API 密钥管理 (Credentials Pool)
              </h2>
              <p className="text-[11px] tx-system-mute mt-1 font-mono">
                登记系统底层与模型通道使用的 API Key。登记完毕后，可将其作为凭证直接分配给端点通道。
              </p>
            </div>
            {/* Reusing simplified KeyPoolSection for keys management */}
            <KeyPoolSection
              platform="all"
              keys={keys}
              loading={keysLoading}
              onKeysChanged={fetchKeys}
            />
          </div>
        )}
      </div>

      {/* Endpoint edit/add Modal popup */}
      <EndpointEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        endpoint={editingEndpoint}
        apiKeys={keys}
        providers={providers}
        onSaved={handleEndpointSaveSuccess}
      />

      <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
    </div>
  );
}
