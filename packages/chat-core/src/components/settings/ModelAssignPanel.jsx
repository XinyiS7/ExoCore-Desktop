import React, { useState, useEffect } from 'react';
import { configApi } from 'exo-shared';
import { Save, Cpu } from 'lucide-react';
import Toast from './Toast';

const MODEL_ROLES = [
 { key: 'sub_agent', label: 'Sub-agent', desc: '后台杂活 · 压实 · 摘要 · 记忆整理' },
 { key: 'vision',  label: 'Vision',  desc: '识图' },
 { key: 'image_gen', label: 'Image Gen', desc: '生图 (tool 类型)' },
 { key: 'web_search', label: 'Web Search', desc: '联网搜索 (SearchAgent)' },
];

export default function ModelAssignPanel() {
 const [modelRoles, setModelRoles] = useState({});
 const [initialRoles, setInitialRoles] = useState({});
 const [modelRegistry, setModelRegistry] = useState([]);
 const [saving, setSaving] = useState(false);
 const [feedback, setFeedback] = useState(null);
 const [loading, setLoading] = useState(true);

 const clearFeedback = () => setFeedback(null);

 useEffect(() => {
 setLoading(true);
 Promise.all([
  configApi.getConfig(),
  configApi.listModels().catch(() => []),
 ])
  .then(([config, models]) => {
  const roles = config.model_roles || {};
  setModelRoles(roles);
  setInitialRoles(roles);
  setModelRegistry(Array.isArray(models) ? models : []);
  })
  .catch(() => {})
  .finally(() => setLoading(false));
 }, []);

 const handleRoleChange = (role, modelId) => {
 setModelRoles(prev => ({ ...prev, [role]: modelId }));
 };

 const isDirty = JSON.stringify(modelRoles) !== JSON.stringify(initialRoles);
 const canSave = isDirty && !saving;

 const handleSave = async () => {
 if (!canSave) return;
 clearFeedback();
 setSaving(true);
 try {
  await configApi.updateConfig({ model_roles: modelRoles });
  setInitialRoles({ ...modelRoles });
  setFeedback({ type: 'success', msg: '模型分配保存成功' });
 } catch (err) {
  setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
 } finally { setSaving(false); }
 };

 const modelsForRole = (roleKey) => {
 if (modelRegistry.length === 0) return [];
 return modelRegistry.filter(m => m.roles && m.roles.includes(roleKey));
 };

 const providerColor = (provider) => {
 const colors = { gemini: '#4285F4', deepseek: '#00CEC9', openai: '#10A37F' };
 return colors[provider] || '#888';
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
  <div className="max-w-2xl px-8 py-8">
  <div className="flex items-center gap-3 mb-2">
   <Cpu size={16} className="text-chat-muted/50" />
   <h2 className="text-sm font-semibold text-chat-text/90 tracking-tight">
   🤖 Model Assign · 模型分配
   </h2>
  </div>
  <p className="text-[10px] text-chat-muted/40 font-mono mb-8 ml-9">
   Agent 主模型走 AgentPreset.default_model，不在此处配置
  </p>

  {/* Role rows */}
  <div className="space-y-1">
   <div className="flex items-center px-3 py-1.5 text-[9px] font-mono tracking-[0.1em] text-chat-muted/40 border-b border-white/[0.04]">
   <span className="w-[110px] flex-shrink-0">Role</span>
   <span className="w-[200px] flex-shrink-0">Description</span>
   <span className="flex-1">Model</span>
   </div>

   {MODEL_ROLES.map(({ key, label, desc }) => {
   const models = modelsForRole(key);
   const currentModelId = modelRoles[key] || '';
   const currentModel = modelRegistry.find(m => m.id === currentModelId);

   return (
    <div
    key={key}
    className="flex items-center px-3 py-2 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
    >
    <span className="w-[110px] flex-shrink-0 font-mono text-[10px] text-chat-text/70">
     {label}
    </span>
    <span className="w-[200px] flex-shrink-0 text-[10px] text-chat-muted/50">
     {desc}
    </span>
    <div className="flex-1 relative">
     <select
     value={currentModelId}
     onChange={e => handleRoleChange(key, e.target.value)}
     className="w-full max-w-[260px] appearance-none bg-chat-bg border border-white/10 rounded px-2.5 py-1.5 text-[10px] font-mono text-chat-text outline-none focus:border-chat-accent/30 transition-colors cursor-pointer"
     >
     <option value="">— 使用默认 —</option>
     {models.map(m => (
      <option key={m.id} value={m.id}>{m.id}</option>
     ))}
     </select>
     {currentModel && (
     <span
      className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
      style={{ backgroundColor: providerColor(currentModel.provider) }}
     />
     )}
    </div>
    </div>
   );
   })}
  </div>

  {modelRegistry.length === 0 && (
   <div className="text-center py-6 text-[10px] text-chat-muted/40 font-mono">
   Model registry 未加载，请检查后端 /api/core/models/
   </div>
  )}

  <div className="flex justify-end mt-6">
   <button
   onClick={handleSave}
   disabled={!canSave}
   className="px-4 py-1.5 bg-chat-accent text-white text-[10px] font-bold tracking-[0.12em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-1.5"
   >
   {saving ? (
    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
   ) : (
    <Save size={12} />
   )}
   Save
   </button>
  </div>

  <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
  </div>
 </div>
 );
}
