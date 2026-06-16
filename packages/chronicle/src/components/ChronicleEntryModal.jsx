import React, { useState } from 'react';
import { X, Globe, Heart } from 'lucide-react';
import { chronicleApi } from 'exo-shared';

const SCOPE_OPTIONS = [
  { value: '表', label: '表 · 外部', desc: '事业/学业/成就/公开事件', icon: Globe },
  { value: '里', label: '里 · 内部', desc: '人际/情感/内心状态', icon: Heart },
];

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULTS = {
  preset: '',
  event_time: today(),
  content: '',
  scope: '表',
  keywords: '',
};

const toForm = (e) => ({
  preset:      e.preset ?? '',
  event_time:  e.event_time ?? today(),
  content:     e.content ?? '',
  scope:       e.scope || '表',
  keywords:    Array.isArray(e.keywords) ? e.keywords.join(', ') : '',
});

const toPayload = (f) => ({
  preset: f.preset ? Number(f.preset) : null,
  event_time: f.event_time,
  content: f.content.trim(),
  scope: f.scope,
  keywords: f.keywords ? f.keywords.split(',').map(t => t.trim()).filter(Boolean) : [],
});

export default function ChronicleEntryModal({ entry, presets = [], onClose, onSave }) {
  const isEdit = !!entry;
  const [form, setForm] = useState(isEdit ? toForm(entry) : DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.content.trim() || !form.event_time) return;
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form);
      if (isEdit) {
        // PATCH: preset is immutable after creation
        const { preset, ...patch } = payload;
        await chronicleApi.updateChronicleEntry(entry.id, patch);
      } else {
        await chronicleApi.createChronicleEntry(payload);
      }
      onSave();
      onClose();
    } catch (e) {
      const msg = typeof e === 'object' ? Object.values(e).flat().join('; ') : '保存失败，请重试';
      setError(msg || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-transparent border-b border-exo-border/60 focus:border-exo-accent/40 outline-none text-sm text-exo-text pb-1 transition-colors placeholder:text-exo-muted/25';
  const lbl = 'text-[9px] tracking-widest text-exo-muted/35 mb-1.5 block';
  const datePick = 'bg-exo-surface border border-exo-border/40 rounded px-2 py-1.5 text-xs text-exo-text outline-none focus:border-exo-accent/30 transition-colors';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-exo-panel border border-exo-border/60 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-exo-panel z-10">
          <h2 className="text-sm font-light tracking-wide text-exo-text">
            {isEdit ? '编辑大事记' : '新建大事记'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-exo-muted/40 hover:text-exo-muted rounded-lg hover:bg-white/5 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Scope selector */}
          <div>
            <span className={lbl}>范畴 / Scope</span>
            <div className="flex gap-2">
              {SCOPE_OPTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set('scope', s.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all text-center ${
                      form.scope === s.value
                        ? s.value === '表'
                          ? 'border-blue-400/40 bg-blue-400/10 text-blue-400'
                          : 'border-rose-400/40 bg-rose-400/10 text-rose-400'
                        : 'border-white/5 text-exo-muted/50 hover:border-white/10 hover:text-exo-muted'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-[10px] font-bold tracking-widest">{s.label}</span>
                    <span className="text-[8px] opacity-50">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset selector (create only) */}
          {!isEdit && presets.length > 0 && (
            <div>
              <label className={lbl}>关联 Agent Preset</label>
              <select
                value={form.preset}
                onChange={e => set('preset', e.target.value)}
                className={`${datePick} w-full`}
              >
                <option value="">全局（不关联 preset）</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className={lbl}>事件日期 *</label>
            <input
              type="date"
              value={form.event_time}
              onChange={e => set('event_time', e.target.value)}
              className={`${datePick} w-full`}
            />
          </div>

          {/* Content */}
          <div>
            <label className={lbl}>内容 *</label>
            <textarea
              autoFocus
              rows={4}
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="描述这个里程碑事件..."
              className={`${inp} resize-none`}
            />
          </div>

          {/* Keywords */}
          <div>
            <label className={lbl}>关键词（逗号分隔）</label>
            <input
              value={form.keywords}
              onChange={e => set('keywords', e.target.value)}
              placeholder="毕设, 毕业, 答辩"
              className={inp}
            />
          </div>

          {error && <p className="text-xs text-red-400/70">{error}</p>}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button onClick={onClose} className="px-4 py-2 text-xs text-exo-muted/50 hover:text-exo-muted transition-colors">取消</button>
            <button
              onClick={handleSubmit}
              disabled={saving || !form.content.trim() || !form.event_time}
              className="px-5 py-2 text-xs bg-exo-accent/10 text-exo-accent border border-exo-accent/20 rounded-xl hover:bg-exo-accent hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : isEdit ? '保存修改' : '创建大事记'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
