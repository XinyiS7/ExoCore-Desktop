import React, { useState, useEffect } from 'react';
import { UserPlus, Activity, Save } from 'lucide-react';
import { baseUrl, getCsrfToken, MAIN_MODEL_IDS, configApi } from 'exo-shared';
import { ModalShell, Button, FIELD_INPUT, FIELD_AREA } from '../ui';

const AGENT_TYPES = [
  { value: 'standard', label: 'Standard', desc: '常规代理' },
  { value: 'superior', label: 'Superior', desc: '高级代理 · 支持记忆/自检' },
];

const CreatePresetModal = ({ isOpen, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', agent_type: 'standard', description: '', default_model: '', system_prompt: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [models, setModels] = useState(MAIN_MODEL_IDS);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ name: '', agent_type: 'standard', description: '', default_model: models[0] || MAIN_MODEL_IDS[0] || '', system_prompt: '' });
    setError(null);
    setIsSaving(false);

    configApi.getModelCatalog()
      .then(catalog => {
        let mainRolesList = [];
        if (catalog?.roles) {
          if (Array.isArray(catalog.roles)) {
            mainRolesList = catalog.roles.filter(r => r.role === 'main');
          } else {
            mainRolesList = catalog.roles.main || [];
          }
        }
        const mainNames = [...new Set(mainRolesList.map(r => r.model))];
        if (mainNames.length > 0) {
          setModels(mainNames);
          setForm(p => ({ ...p, default_model: p.default_model || mainNames[0] }));
        }
      })
      .catch(() => {
        setModels(MAIN_MODEL_IDS);
      });
  }, [isOpen]);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('名称不能为空'); return; }
    if (!form.system_prompt.trim()) { setError('系统提示词不能为空'); return; }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/agents/presets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          agent_type: form.agent_type,
          description: form.description.trim(),
          default_model: form.default_model,
          system_prompt: form.system_prompt.trim(),
        }),
      });
      if (res.ok) {
        onCreated?.();
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || errData.name || '创建失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={UserPlus}
      title="NEW AGENT"
      subtitle="Register a new AgentPreset"
      maxW="lg"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || !form.name.trim() || !form.system_prompt.trim()}>
            {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.5} />}
            {isSaving ? 'INITIALIZING...' : 'INITIALIZE'}
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Name + Model */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3 col-span-2 sm:col-span-1">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Alias / 名称</label>
            <input
              className={FIELD_INPUT}
              placeholder="Agent name..."
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="space-y-3 col-span-2 sm:col-span-1">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Neural Model / 模型</label>
            <select
              className={`${FIELD_INPUT} cursor-pointer appearance-none`}
              value={form.default_model}
              onChange={e => setForm(p => ({ ...p, default_model: e.target.value }))}
            >
              {models.map(m => <option key={m} value={m} className="bg-exo-pure">{m}</option>)}
            </select>
          </div>
        </div>

        {/* Agent Type */}
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Agent Type / 代理类型</label>
          <div className="grid grid-cols-2 gap-3">
            {AGENT_TYPES.map(opt => (
              <button
                key={opt.value}
                onClick={() => setForm(p => ({ ...p, agent_type: opt.value }))}
                className={`px-4 py-3 rounded-lg border text-left transition-all ${
                  form.agent_type === opt.value
                    ? 'border-exo-accent/40 bg-exo-accent/5 tx-system-accent'
                    : 'border-transparent bg-black/[0.02] dark:bg-white/[0.02] tx-system-mute hover:border-exo-mist-10/40 hover:tx-system-normal'
                }`}
              >
                <span className="block text-[0.7rem] font-mono tracking-[0.15em]">{opt.label}</span>
                <span className="block text-[0.6rem] opacity-50 mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Operational Context / 描述</label>
          <textarea
            rows={2}
            className={FIELD_AREA}
            placeholder="Agent 的简要描述..."
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* System Prompt */}
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">System Directives / 系统提示词</label>
          <textarea
            rows={8}
            className={FIELD_AREA}
            placeholder="You are a helpful assistant..."
            value={form.system_prompt}
            onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
          />
        </div>

        {error && (
          <div className="text-[0.7rem] font-mono text-red-500 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default CreatePresetModal;
