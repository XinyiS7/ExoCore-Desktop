import React, { useState, useEffect } from 'react';
import { Edit3, X, Activity, Save } from 'lucide-react';
import { baseUrl, getCsrfToken, AVAILABLE_MODELS } from '../../utils/api';

const EditPresetModal = ({ isOpen, onClose, preset, onSaved, mode }) => {
  const [form, setForm] = useState({ name: '', description: '', default_model: '', system_prompt: '' });
  const [isSaving, setIsSaving] = useState(false);
  const isSystemPromptOnly = mode === 'system_prompt';

  useEffect(() => {
    if (preset) {
      setForm({
        name: preset.name || '',
        description: preset.description || '',
        default_model: preset.default_model || '',
        system_prompt: preset.system_prompt || '',
      });
    }
  }, [preset]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${baseUrl}/api/agents/presets/${preset.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        alert('保存失败，请检查后端接口。');
      }
    } catch (err) {
      console.error('Preset 保存失败', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-exo-pure border border-exo-mist-10 rounded-[2px] w-full max-w-2xl flex flex-col max-h-[90vh] shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-exo-mist-10 bg-exo-pure/50">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-[0.2em]">
              <Edit3 size={16} className="text-exo-accent" /> {isSystemPromptOnly ? 'System Prompt / 系统提示词' : 'Core Config / 内核配置'}
            </h2>
            <span className="text-[9px] text-exo-muted font-mono uppercase tracking-widest opacity-40 mt-1">Preset Mapping: {preset?.name}</span>
          </div>
          <button onClick={onClose} className="p-2 text-exo-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 scrollbar-hide">
          {!isSystemPromptOnly && (
            <>
              <div className="space-y-2">
                <label className="label-caps opacity-50">Alias / 名称</label>
                <input
                  className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="label-caps opacity-50">Operational Context / 描述</label>
                <textarea
                  rows={2}
                  className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all resize-none"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="label-caps opacity-50">Default Neural Model / 默认模型</label>
                <select
                  className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all cursor-pointer"
                  value={form.default_model}
                  onChange={e => setForm(p => ({ ...p, default_model: e.target.value }))}
                >
                  {AVAILABLE_MODELS.map(m => <option key={m} value={m} className="bg-exo-pure">{m}</option>)}
                </select>
              </div>
            </>
          )}
          <div className={`space-y-2 ${isSystemPromptOnly ? 'h-full' : ''}`}>
            <div className="flex justify-between items-center">
              <label className="label-caps opacity-50">System Directives / 系统提示词</label>
              <span className="text-[9px] font-mono text-exo-accent opacity-40 uppercase tracking-tighter">L3 Access Required</span>
            </div>
            <textarea
              rows={isSystemPromptOnly ? 20 : 10}
              className={`w-full bg-black/80 border border-exo-mist-10 rounded-[2px] px-4 py-3 text-[13px] text-white focus:border-exo-accent/40 outline-none transition-all resize-y font-mono leading-relaxed ${isSystemPromptOnly ? 'flex-1 min-h-[50vh]' : ''}`}
              value={form.system_prompt}
              onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-exo-mist-10 bg-exo-pure/80 backdrop-blur-md">
          <button onClick={onClose} className="px-6 py-2 rounded-[2px] text-[11px] font-bold uppercase tracking-widest text-exo-muted hover:text-white transition-colors">
            Abort
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-2 bg-white text-exo-pure rounded-[2px] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-3"
          >
            {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? 'COMMITTING...' : 'COMMIT CHANGES'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPresetModal;
