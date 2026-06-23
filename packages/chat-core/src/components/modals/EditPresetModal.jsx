import React, { useState, useEffect } from 'react';
import { Edit3, Activity, Save } from 'lucide-react';
import { baseUrl, getCsrfToken, MAIN_MODEL_IDS } from 'exo-shared';
import { ModalShell, Button, FIELD_INPUT, FIELD_AREA } from '../ui';

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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={Edit3}
      title={isSystemPromptOnly ? 'SYSTEM PROMPT' : 'CORE CONFIG'}
      subtitle={`Target Entity: ${preset?.name || 'Unknown'}`}
      maxW="lg"
      bodyClassName={isSystemPromptOnly ? 'flex flex-col' : ''}
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.5} />}
            {isSaving ? 'COMMITTING...' : 'COMMIT CHANGES'}
          </Button>
        </div>
      }
    >
      {!isSystemPromptOnly && (
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-3 col-span-2 sm:col-span-1">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Alias / 名称</label>
            <input
              className={FIELD_INPUT}
              placeholder="Entity Name"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="space-y-3 col-span-2 sm:col-span-1">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Neural Model / 模型</label>
            <select
              className={`${FIELD_INPUT} cursor-pointer appearance-none`}
              value={form.default_model}
              onChange={e => setForm(p => ({ ...p, default_model: e.target.value }))}
            >
              {MAIN_MODEL_IDS.map(m => <option key={m} value={m} className="bg-exo-pure">{m}</option>)}
            </select>
          </div>
          <div className="space-y-3 col-span-2">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Operational Context / 描述</label>
            <textarea
              rows={2}
              className={FIELD_AREA}
              placeholder="Briefly describe the entity's purpose..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>
      )}

      <div className={`space-y-3 ${isSystemPromptOnly ? 'flex flex-col h-full' : ''}`}>
        <div className="flex justify-between items-end">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">System Directives / 核心规则</label>
          <span className="text-[0.55rem] font-mono tx-system-accent opacity-60 tracking-widest border border-exo-accent/20 px-2 py-0.5 rounded-full">L3 Access</span>
        </div>
        <textarea
          rows={isSystemPromptOnly ? 20 : 10}
          className={`${FIELD_AREA} ${isSystemPromptOnly ? 'flex-1 min-h-[50vh]' : ''}`}
          placeholder="Inject core personality and behavioral constraints here..."
          value={form.system_prompt}
          onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
        />
      </div>
    </ModalShell>
  );
};

export default EditPresetModal;
