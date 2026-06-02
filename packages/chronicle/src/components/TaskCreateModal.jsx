// src/components/tasks/TaskCreateModal.jsx
import React, { useState } from 'react';
import { X, Pin } from 'lucide-react';
import { tasksApi } from 'exo-shared';
const createEntry = tasksApi.createTask;
const updateEntry = tasksApi.updateTask;

const TYPES        = [{ value: 'todo', label: 'Todo' }, { value: 'periodic', label: '周期任务' }, { value: 'goal', label: '目标' }];
const UNITS        = [{ value: 'day', label: '天' }, { value: 'week', label: '周' }, { value: 'month', label: '月' }];
const GOAL_PERIODS = [{ value: 'week', label: '每周' }, { value: 'month', label: '每月' }];
const END_TYPES    = [{ value: 'never', label: '永不' }, { value: 'count', label: '次数' }, { value: 'date', label: '日期' }];

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULTS = {
  todo:     { entry_type: 'todo',     title: '', description: '', start_date: today(), tags: '', due_date: '', is_pinned: false },
  periodic: { entry_type: 'periodic', title: '', description: '', start_date: today(), tags: '', interval_unit: 'day', interval_value: 1, end_type: 'never', end_count: '', end_date: '', is_pinned: false },
  goal:     { entry_type: 'goal',     title: '', description: '', start_date: today(), tags: '', goal_count: 3, goal_period: 'week', cycle_start: today(), cycle_due: '', is_pinned: false },
};

const toForm = (e) => ({
  entry_type:     e.entry_type,
  title:          e.title          ?? '',
  description:    e.description    ?? '',
  start_date:     e.start_date     ?? today(),
  tags:           Array.isArray(e.tags) ? e.tags.join(', ') : '',
  due_date:       e.due_date       ?? '',
  interval_unit:  e.interval_unit  ?? 'day',
  interval_value: e.interval_value ?? 1,
  end_type:       e.end_type       ?? 'never',
  end_count:      e.end_count      ?? '',
  end_date:       e.end_date       ?? '',
  goal_count:     e.goal_count     ?? 3,
  goal_period:    e.goal_period    ?? 'week',
  cycle_start:    e.cycle_start    ?? today(),
  cycle_due:      e.cycle_due      ?? '',
  is_pinned:      e.is_pinned      ?? false,
});

const toPayload = (f) => {
  const tags = f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const base = { title: f.title.trim(), description: f.description.trim(), start_date: f.start_date, tags, is_pinned: f.is_pinned };
  if (f.entry_type === 'todo') return { ...base, entry_type: 'todo', due_date: f.due_date || null };
  if (f.entry_type === 'periodic') return {
    ...base, entry_type: 'periodic',
    interval_unit:  f.interval_unit,
    interval_value: Number(f.interval_value),
    end_type:       f.end_type,
    end_count:      f.end_type === 'count' && f.end_count ? Number(f.end_count) : null,
    end_date:       f.end_type === 'date'  && f.end_date  ? f.end_date          : null,
  };
  if (f.entry_type === 'goal') return {
    ...base, entry_type: 'goal',
    goal_count:  Number(f.goal_count),
    goal_period: f.goal_period,
    cycle_start: f.cycle_start,
    cycle_due:   f.cycle_due || null,
  };
};

export default function TaskCreateModal({ entry, onClose, onSave }) {
  const isEdit = !!entry;
  const [form, setForm]     = useState(isEdit ? toForm(entry) : DEFAULTS.todo);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.start_date) return;
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form);
      const result  = isEdit ? await updateEntry(entry.id, payload) : await createEntry(payload);
      onSave(result);
      onClose();
    } catch (e) {
      const msg = typeof e === 'object' ? Object.values(e).flat().join('; ') : '保存失败，请重试';
      setError(msg || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-transparent border-b border-exo-border/60 focus:border-exo-accent/40 outline-none text-sm text-exo-text pb-1 transition-colors placeholder:text-exo-muted/25';
  const lbl = 'text-[9px] uppercase tracking-widest text-exo-muted/35 mb-1.5 block';
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
          <h2 className="text-sm font-light tracking-wide text-exo-text">{isEdit ? '编辑任务' : '新建任务'}</h2>
          <button onClick={onClose} className="p-1.5 text-exo-muted/40 hover:text-exo-muted rounded-lg hover:bg-white/5 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Type selector */}
          <div>
            <span className={lbl}>类型</span>
            <div className="flex gap-1">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => !isEdit && setForm(DEFAULTS[t.value])}
                  disabled={isEdit}
                  className={`flex-1 py-2 text-xs rounded-xl border transition-all ${
                    form.entry_type === t.value
                      ? 'border-exo-accent/40 bg-exo-accent/10 text-exo-accent'
                      : 'border-white/5 text-exo-muted/50 hover:border-white/10 hover:text-exo-muted disabled:opacity-25 disabled:cursor-not-allowed'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Common fields */}
          <div>
            <label className={lbl}>标题 *</label>
            <input autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="任务标题" className={inp} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>开始日期 *</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={`${datePick} w-full`} />
            </div>
            <div>
              <label className={lbl}>标签（逗号分隔）</label>
              <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="健康, 运动" className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>描述</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="可选" className={inp} />
          </div>

          {/* is_pinned toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('is_pinned', !form.is_pinned)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                form.is_pinned
                  ? 'border-exo-accent/40 bg-exo-accent/10 text-exo-accent'
                  : 'border-white/5 text-exo-muted/50 hover:border-white/10 hover:text-exo-muted'
              }`}
            >
              <Pin size={12} className={form.is_pinned ? 'fill-exo-accent' : ''} />
              {form.is_pinned ? '已置顶' : '置顶 / Pin'}
            </button>
            <span className="text-[9px] text-exo-muted/30">置顶任务始终显示在列表顶部</span>
          </div>

          {/* ── Todo fields ── */}
          {form.entry_type === 'todo' && (
            <div>
              <label className={lbl}>截止日期</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={datePick} />
            </div>
          )}

          {/* ── Periodic fields ── */}
          {form.entry_type === 'periodic' && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>重复间隔</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-exo-muted/50">每</span>
                  <input
                    type="number" min="1" value={form.interval_value}
                    onChange={e => set('interval_value', e.target.value)}
                    className={`${datePick} w-16 text-center`}
                  />
                  <select value={form.interval_unit} onChange={e => set('interval_unit', e.target.value)} className={datePick}>
                    {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>结束方式</label>
                <div className="flex gap-1.5 flex-wrap">
                  {END_TYPES.map(et => (
                    <button
                      key={et.value} onClick={() => set('end_type', et.value)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        form.end_type === et.value
                          ? 'border-exo-accent/40 bg-exo-accent/10 text-exo-accent'
                          : 'border-white/5 text-exo-muted/50 hover:border-white/10'
                      }`}
                    >{et.label}</button>
                  ))}
                </div>
                {form.end_type === 'count' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-exo-muted/50">共</span>
                    <input type="number" min="1" value={form.end_count} onChange={e => set('end_count', e.target.value)} placeholder="次数" className={`${datePick} w-20 text-center`} />
                    <span className="text-xs text-exo-muted/50">次</span>
                  </div>
                )}
                {form.end_type === 'date' && (
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={`${datePick} mt-2`} />
                )}
              </div>
            </div>
          )}

          {/* ── Goal fields ── */}
          {form.entry_type === 'goal' && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>目标频率</label>
                <div className="flex items-center gap-2">
                  <select value={form.goal_period} onChange={e => set('goal_period', e.target.value)} className={datePick}>
                    {GOAL_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <span className="text-xs text-exo-muted/50">完成</span>
                  <input type="number" min="1" value={form.goal_count} onChange={e => set('goal_count', e.target.value)} className={`${datePick} w-16 text-center`} />
                  <span className="text-xs text-exo-muted/50">次</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>周期开始</label>
                  <input type="date" value={form.cycle_start} onChange={e => set('cycle_start', e.target.value)} className={`${datePick} w-full`} />
                </div>
                <div>
                  <label className={lbl}>周期截止</label>
                  <input type="date" value={form.cycle_due} onChange={e => set('cycle_due', e.target.value)} className={`${datePick} w-full`} />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400/70">{error}</p>}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
            <button onClick={onClose} className="px-4 py-2 text-xs text-exo-muted/50 hover:text-exo-muted transition-colors">取消</button>
            <button
              onClick={handleSubmit}
              disabled={saving || !form.title.trim()}
              className="px-5 py-2 text-xs bg-exo-accent/10 text-exo-accent border border-exo-accent/20 rounded-xl hover:bg-exo-accent hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : isEdit ? '保存修改' : '创建任务'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
