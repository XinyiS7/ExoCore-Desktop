import React, { useState, useEffect } from 'react';
import { configApi, getCompatibleEndpoints, changeTargetModel } from 'exo-shared';
import { Save, Cpu, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Toast from './Toast';
import { Button } from '../ui';

// Other background support roles (excluding main)
const OTHER_MODEL_ROLES = [
  { key: 'general_sub_agent', label: 'Sub-agent', desc: '后台异步代理 · 压实摘要 · 记忆整理 · 影子系统 · 日历任务' },
  { key: 'vision_helper', label: 'Vision Helper', desc: '识图看图助手模型 (处理视觉辅助路径)' },
  { key: 'grounding', label: 'Grounding', desc: '联网搜索辅助模型 (SearchAgent 端点配对)' },
  { key: 'image_gen', label: 'Image Gen', desc: '图像生成模型 (生成 tool 调用端点)' },
];

const ROLE_REQUIRED_ABILITIES = {
  general_sub_agent: ['fc'],
  vision_helper: ['vision'],
  grounding: ['grounding'],
  image_gen: ['image_gen'],
};

const MOCK_CATALOG = {
  models: [
    { name: "gemini-2.5-flash", family: "gemini", abilities: ["fc", "vision", "grounding", "context_cache"], compatible_endpoint_ids: [2, 3] },
    { name: "gemini-2.5-pro", family: "gemini", abilities: ["fc", "vision", "grounding", "context_cache"], compatible_endpoint_ids: [2, 3] },
    { name: "deepseek-v4-flash", family: "deepseek", abilities: ["fc", "thinking"], compatible_endpoint_ids: [1] },
    { name: "deepseek-v4-pro", family: "deepseek", abilities: ["fc", "thinking"], compatible_endpoint_ids: [1] },
    { name: "gemini-3-pro-image", family: "gemini", abilities: ["image_gen"], compatible_endpoint_ids: [2] }
  ],
  endpoints: [
    { id: 1, name: "DeepSeek 官方", provider: "deepseek", payload_format: "openai", cache_transport: "inline_chunk", attachment_transports: ["inline_text"], configured: true, enabled: true },
    { id: 2, name: "Gemini 官方", provider: "gemini", payload_format: "gemini", cache_transport: "remote_reference", attachment_transports: ["file_uri", "inline_text", "inline_image"], configured: true, enabled: true },
    { id: 3, name: "OpenRouter Gemini", provider: "openrouter", payload_format: "openai", cache_transport: "inline_chunk", attachment_transports: ["inline_text", "inline_image"], configured: true, enabled: true }
  ],
  roles: [
    { role: "main", model: "deepseek-v4-pro", endpoint: 1, style_shadow: "deepseek-v4-flash" },
    { role: "main", model: "gemini-2.5-pro", endpoint: 2, style_shadow: "gemini-2.5-flash" },
    { role: "general_sub_agent", model: "deepseek-v4-flash", endpoint: 1 },
    { role: "vision_helper", model: "gemini-2.5-flash-lite", endpoint: 2 },
    { role: "grounding", model: "gemini-2.5-flash", endpoint: 2 },
    { role: "image_gen", model: "gemini-3-pro-image", endpoint: 2 }
  ]
};

export default function ModelAssignPanel() {
  const [catalog, setCatalog] = useState(null);
  
  // States for dynamic Main Agent Models Registry list
  const [mainRoles, setMainRoles] = useState([]); // Array of { model, endpoint, style_shadow }
  const [initialMainRoles, setInitialMainRoles] = useState([]);

  // States for background support roles (1-to-1 map)
  const [otherRoles, setOtherRoles] = useState({}); // roleKey -> { model, endpoint }
  const [initialOtherRoles, setInitialOtherRoles] = useState({});

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rowStatus, setRowStatus] = useState({}); // roleKey -> transition helper text

  const clearFeedback = () => setFeedback(null);

  const fetchCatalog = () => {
    setLoading(true);
    configApi.getModelCatalog()
      .then(data => {
        setCatalog(data);
        initializeState(data);
      })
      .catch(() => {
        setCatalog(MOCK_CATALOG);
        initializeState(MOCK_CATALOG);
      })
      .finally(() => setLoading(false));
  };

  const initializeState = (data) => {
    // 1. Extract main role configs
    let mains = [];
    if (data.roles) {
      if (Array.isArray(data.roles)) {
        mains = data.roles.filter(r => r.role === 'main');
      } else {
        mains = data.roles.main || [];
      }
    }
    const mainEntries = mains.map((mr, idx) => ({
      model: mr.model || '',
      endpoint: mr.default_endpoint || mr.endpoint || null,
      style_shadow: mr.style_shadow || 'auto',
      position: mr.position ?? idx
    }));
    // Sort by position to preserve user ordering
    mainEntries.sort((a, b) => a.position - b.position);
    setMainRoles(mainEntries);
    setInitialMainRoles(JSON.parse(JSON.stringify(mainEntries)));

    // 2. Extract 1-to-1 helper role configs
    const others = {};
    OTHER_MODEL_ROLES.forEach(({ key }) => {
      let found = null;
      if (data.roles) {
        if (Array.isArray(data.roles)) {
          found = data.roles.find(r => r.role === key);
        } else if (data.roles.support) {
          found = data.roles.support[key];
        }
      }
      others[key] = {
        model: found?.model || '',
        endpoint: found?.default_endpoint || found?.endpoint || null
      };
    });
    setOtherRoles(others);
    setInitialOtherRoles(JSON.parse(JSON.stringify(others)));
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Handlers for Main Models Registry
  const handleAddMainRole = () => {
    setMainRoles(prev => [...prev, { model: '', endpoint: null, style_shadow: 'auto' }]);
  };

  const handleRemoveMainRole = (index) => {
    setMainRoles(prev => prev.filter((_, i) => i !== index));
  };

  const handleMainModelChange = (index, nextModel) => {
    setMainRoles(prev => {
      const copy = [...prev];
      const currentPair = copy[index];
      // Resolve transition using helper functions
      const result = changeTargetModel(catalog, currentPair, nextModel);
      copy[index] = {
        model: result.model,
        endpoint: result.endpoint,
        style_shadow: currentPair.style_shadow || ''
      };
      return copy;
    });
  };

  const handleMainFieldChange = (index, field, value) => {
    setMainRoles(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value
      };
      return copy;
    });
  };

  // Handlers for Other Support Roles
  const handleOtherModelChange = (roleKey, nextModel) => {
    const currentPair = otherRoles[roleKey] || { model: '', endpoint: null };
    const result = changeTargetModel(catalog, currentPair, nextModel);
    
    setOtherRoles(prev => ({
      ...prev,
      [roleKey]: { model: result.model, endpoint: result.endpoint }
    }));

    // Update row status info message
    let statusText = '';
    if (result.status === 'switched') {
      statusText = `已自动切换端点: ${result.changedTo?.name || result.endpoint}`;
    } else if (result.status === 'requires_select') {
      statusText = '请手动选择兼容端点。';
    } else if (result.status === 'no_endpoints') {
      statusText = '警告：当前无已启用端点与该模型兼容。';
    }
    
    setRowStatus(prev => ({ ...prev, [roleKey]: statusText }));
  };

  const handleOtherEndpointChange = (roleKey, endpointId) => {
    const numericId = endpointId ? Number(endpointId) : null;
    setOtherRoles(prev => ({
      ...prev,
      [roleKey]: { ...prev[roleKey], endpoint: numericId }
    }));
    setRowStatus(prev => ({ ...prev, [roleKey]: '' }));
  };

  const isDirty = JSON.stringify(mainRoles) !== JSON.stringify(initialMainRoles) || 
                  JSON.stringify(otherRoles) !== JSON.stringify(initialOtherRoles);
                  
  const canSave = isDirty && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    clearFeedback();

    // ── Validation ──
    if (mainRoles.length === 0) {
      setFeedback({ type: 'error', msg: '请至少配置一个主模型角色 (Main Role)' });
      return;
    }
    for (let i = 0; i < mainRoles.length; i++) {
      if (!mainRoles[i].model || !mainRoles[i].endpoint) {
        setFeedback({ type: 'error', msg: `主模型配置不完整 (第 ${i + 1} 行)，请确保模型和端点已选择` });
        return;
      }
    }
    for (const r of OTHER_MODEL_ROLES) {
      const otherVal = otherRoles[r.key];
      if (!otherVal || !otherVal.model || !otherVal.endpoint) {
        setFeedback({ type: 'error', msg: `辅助角色 "${r.label}" 配置不完整，必须配齐所有辅助模型与端点` });
        return;
      }
    }

    setSaving(true);
    try {
      // Compile final payload into the new nested structure { main, support }
      const payload = {
        main: mainRoles.map((mr, idx) => ({
          model: mr.model,
          default_endpoint: mr.endpoint,
          style_shadow: (mr.style_shadow === 'auto' || !mr.style_shadow) ? null : mr.style_shadow,
          position: mr.position ?? idx
        })),
        support: {}
      };
      
      OTHER_MODEL_ROLES.forEach(({ key }) => {
        payload.support[key] = {
          model: otherRoles[key]?.model || '',
          default_endpoint: otherRoles[key]?.endpoint || null
        };
      });
      
      await configApi.updateModelRoles(payload);
      
      setInitialMainRoles(JSON.parse(JSON.stringify(mainRoles)));
      setInitialOtherRoles(JSON.parse(JSON.stringify(otherRoles)));
      setFeedback({ type: 'success', msg: '主/子模型角色映射配置已保存' });
      setRowStatus({});
    } catch (err) {
      if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        // Fallback mock success
        setInitialMainRoles(JSON.parse(JSON.stringify(mainRoles)));
        setInitialOtherRoles(JSON.parse(JSON.stringify(otherRoles)));
        setFeedback({ type: 'success', msg: '配置已保存 (本地 Mock 分支)' });
        setRowStatus({});
      } else {
        setFeedback({ type: 'error', msg: err.body?.detail || err.message || '保存失败' });
      }
    } finally {
      setSaving(false);
    }
  };

  const getEligibleModels = (roleKey) => {
    if (!catalog || !Array.isArray(catalog.models)) return [];
    const requiredAbilities = ROLE_REQUIRED_ABILITIES[roleKey] || [];
    return catalog.models.filter(m =>
      requiredAbilities.every(ab => m.abilities.includes(ab))
    );
  };

  // Get models that have function calling (fc) ability for style_shadow selector
  const getFcModels = () => {
    if (!catalog || !Array.isArray(catalog.models)) return [];
    return catalog.models.filter(m => m.abilities.includes('fc'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="inline-block w-5 h-5 border-2 border-chat-muted/20 border-t-chat-muted/40 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-4xl px-8 py-8 space-y-10">
        
        {/* Section 1: Main Agent Models Registry (List) */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Cpu size={16} className="tx-system-accent" />
            <h2 className="tx-subtitle-normal text-sm font-bold tracking-wider font-mono">
              👑 Main Agent Models Registry / 主模型预设配置
            </h2>
          </div>
          <p className="text-[11px] tx-system-mute mb-4 ml-7 font-mono">
            在这里登记允许在 Agent 预设中作为 “主模型” 选择的模型系列。每一条目包含主模型、数据通道和用于影子改写代理的 Style Shadow 搭配。
          </p>

          <div className="border border-cinder-line rounded-xl overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-cinder-line text-[10px] font-mono tracking-wider tx-system-mute uppercase">
              <span className="col-span-4">Model Name / 模型名称</span>
              <span className="col-span-4">Default Endpoint / 数据端点</span>
              <span className="col-span-3">Style Shadow / 风格影子模型</span>
              <span className="col-span-1 text-right">Delete</span>
            </div>

            <div className="divide-y divide-cinder-line">
              {mainRoles.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs tx-system-mute font-mono">
                  暂无登记的主模型。点击下方 "+ ADD MAIN MODEL" 开始登记。
                </div>
              ) : (
                mainRoles.map((mr, idx) => {
                  const compatibleEndpoints = mr.model
                    ? getCompatibleEndpoints(catalog, mr.model)
                    : [];
                  
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-4 px-4 py-3.5 items-center">
                      {/* Model Select */}
                      <div className="col-span-4">
                        <select
                          value={mr.model}
                          onChange={e => handleMainModelChange(idx, e.target.value)}
                          className="w-full appearance-none bg-chat-bg border border-cinder-line rounded px-2.5 py-1.5 text-xs font-mono tx-system-normal outline-none focus:border-chat-accent/30 cursor-pointer"
                        >
                          <option value="">— 选择模型 —</option>
                          {catalog.models.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Endpoint Select */}
                      <div className="col-span-4">
                        <select
                          value={mr.endpoint || ''}
                          onChange={e => handleMainFieldChange(idx, 'endpoint', e.target.value ? Number(e.target.value) : null)}
                          disabled={!mr.model}
                          className="w-full appearance-none bg-chat-bg border border-cinder-line rounded px-2.5 py-1.5 text-xs font-mono tx-system-normal outline-none focus:border-chat-accent/30 cursor-pointer disabled:opacity-40"
                        >
                          {!mr.model ? (
                            <option value="">— 请先选择模型 —</option>
                          ) : (
                            <>
                              <option value="">— 选择通道 —</option>
                              {compatibleEndpoints.map(ep => (
                                <option key={ep.id} value={ep.id}>
                                  {ep.name} ({ep.provider})
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>

                      {/* Style Shadow Select */}
                      <div className="col-span-3">
                        <select
                          value={mr.style_shadow || 'auto'}
                          onChange={e => handleMainFieldChange(idx, 'style_shadow', e.target.value)}
                          className="w-full appearance-none bg-chat-bg border border-cinder-line rounded px-2.5 py-1.5 text-xs font-mono tx-system-normal outline-none focus:border-chat-accent/30 cursor-pointer"
                        >
                          <option value="auto">Auto / 自动 (通用 sub-agent)</option>
                          {getFcModels().map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => handleRemoveMainRole(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-500/5 rounded-lg transition-colors"
                          title="注销此主模型"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 flex justify-start">
            <Button variant="ghost" size="sm" onClick={handleAddMainRole} className="!text-chat-accent hover:!bg-chat-accent/5">
              <Plus size={12} />
              ADD MAIN MODEL / 登记新主模型
            </Button>
          </div>
        </div>

        {/* Section 2: Background Support Roles */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Cpu size={16} className="tx-system-mute" />
            <h2 className="tx-subtitle-normal text-sm font-bold tracking-wider font-mono">
              🛡️ Support Role Defaults / 后台与辅助角色默认绑定
            </h2>
          </div>
          <p className="text-[11px] tx-system-mute mb-4 ml-7 font-mono">
            配置系统在执行特定辅助职责时的全局默认通道与模型。
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-mono tracking-wider tx-system-mute border-b border-cinder-line uppercase">
              <span className="col-span-3">Role / 辅助角色</span>
              <span className="col-span-4">Model / 模型</span>
              <span className="col-span-5">Default Endpoint / 默认端点</span>
            </div>

            {OTHER_MODEL_ROLES.map(({ key, label, desc }) => {
              const models = getEligibleModels(key);
              const currentPair = otherRoles[key] || { model: '', endpoint: null };
              const compatibleEndpoints = currentPair.model
                ? getCompatibleEndpoints(catalog, currentPair.model)
                : [];
              const statusMsg = rowStatus[key];

              return (
                <div
                  key={key}
                  className="grid grid-cols-12 gap-4 px-4 py-3 items-start border-b border-cinder-line/30 hover:bg-exo-accent/[0.01] transition-colors"
                >
                  <div className="col-span-3 flex flex-col pr-2">
                    <span className="text-xs font-bold tx-system-normal font-mono">{label}</span>
                    <span className="text-[10px] tx-system-mute mt-1 leading-normal">
                      {desc}
                    </span>
                  </div>

                  {/* Model Select */}
                  <div className="col-span-4">
                    <select
                      value={currentPair.model}
                      onChange={e => handleOtherModelChange(key, e.target.value)}
                      className="w-full appearance-none bg-chat-bg border border-cinder-line rounded px-2.5 py-1.5 text-xs font-mono tx-system-normal outline-none focus:border-chat-accent/30 cursor-pointer"
                    >
                      <option value="">— 选择模型 —</option>
                      {models.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Endpoint Select */}
                  <div className="col-span-5 flex flex-col gap-2">
                    <select
                      value={currentPair.endpoint || ''}
                      onChange={e => handleOtherEndpointChange(key, e.target.value)}
                      disabled={!currentPair.model}
                      className="w-full appearance-none bg-chat-bg border border-cinder-line rounded px-2.5 py-1.5 text-xs font-mono tx-system-normal outline-none focus:border-chat-accent/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {!currentPair.model ? (
                        <option value="">— 请先选择模型 —</option>
                      ) : (
                        <>
                          <option value="">— 选择通道 —</option>
                          {compatibleEndpoints.map(ep => (
                            <option key={ep.id} value={ep.id}>
                              {ep.name} ({ep.provider})
                            </option>
                          ))}
                        </>
                      )}
                    </select>

                    {statusMsg && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono tx-system-mute text-amber-500 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                        <AlertCircle size={10} />
                        <span>{statusMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-4 border-t border-cinder-line">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
            {saving ? (
              <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save Configuration
          </Button>
        </div>

        <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
      </div>
    </div>
  );
}
