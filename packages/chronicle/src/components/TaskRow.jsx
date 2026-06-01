// src/components/tasks/TaskRow.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Circle, RefreshCw, Target, ChevronDown, ChevronUp,
  MoreHorizontal, Check, ExternalLink, Pin, PinOff,
  Edit2, Pause, Play, Trash2,
} from 'lucide-react';
import { fetchCompletions } from '../../utils/tasksApi';

const TYPE_CFG = {
  todo:     { Icon: Circle,    label: 'Todo', color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
  periodic: { Icon: RefreshCw, label: '周期', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  goal:     { Icon: Target,    label: '目标', color: 'text-exo-accent', bg: 'bg-exo-accent/10' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const today = todayStr();
  const tom   = new Date(); tom.setDate(tom.getDate() + 1);
  const tomStr = tom.toISOString().slice(0, 10);
  if (dateStr === today)  return { label: '今天',      urgent: true,  overdue: false };
  if (dateStr === tomStr) return { label: '明天',      urgent: false, overdue: false };
  if (dateStr < today)    return { label: dateStr.slice(5), urgent: true, overdue: true };
  return                         { label: dateStr.slice(5), urgent: false, overdue: false };
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors hover:bg-white/5 ${
        danger ? 'text-red-400/70 hover:text-red-400' : 'text-exo-muted/70 hover:text-exo-text'
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

export default function TaskRow({
  entry, isExpanded, onToggleExpand,
  onEdit, onComplete, onUpdate, onDelete,
  onSuspend, onResume, onGcalSync, onGcalUnsync,
}) {
  const {
    id, entry_type, title, status, is_pinned,
    due_date, next_periodic_due,
    current_cycle_completions, goal_count,
    description, start_date, tags,
    gcal_event_id, gcal_event_link,
  } = entry;

  const cfg = TYPE_CFG[entry_type] || TYPE_CFG.todo;
  const [menuOpen, setMenuOpen]           = useState(false);
  const [completions, setCompletions]     = useState(null);
  const [loadingCompletions, setLoadingC] = useState(false);
  const [completing, setCompleting]       = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  // Lazy-load completions when expanded
  useEffect(() => {
    if (!isExpanded || completions !== null) return;
    setLoadingC(true);
    fetchCompletions(id)
      .then(data => setCompletions(Array.isArray(data) ? data : []))
      .catch(() => setCompletions([]))
      .finally(() => setLoadingC(false));
  }, [isExpanded, id, completions]);

  const handleComplete = (e) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(true);
    onComplete(id).finally(() => setCompleting(false));
  };

  // Overdue indicator
  const today = todayStr();
  const isOverdue =
    (entry_type === 'todo'     && due_date          && due_date          < today) ||
    (entry_type === 'periodic' && next_periodic_due && next_periodic_due < today);

  // Meta info per type
  const renderMeta = () => {
    if (entry_type === 'todo') {
      const d = fmtDate(due_date);
      if (!d) return null;
      return (
        <span className={`text-[11px] ${d.overdue ? 'text-amber-400/80' : d.urgent ? 'text-amber-300/60' : 'text-exo-muted/40'}`}>
          {d.overdue ? '⚠ ' : ''}due {d.label}
        </span>
      );
    }
    if (entry_type === 'periodic') {
      const d = fmtDate(next_periodic_due);
      if (!d) return null;
      return (
        <span className={`text-[11px] ${d.overdue ? 'text-amber-400/80' : 'text-exo-muted/40'}`}>
          {d.overdue ? '⚠ 逾期  ' : ''}下次: {d.label}
        </span>
      );
    }
    if (entry_type === 'goal') {
      const done  = current_cycle_completions ?? 0;
      const total = goal_count ?? 1;
      const pct   = Math.min(done / total, 1);
      const done_ = done >= total;
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${done_ ? 'bg-green-500/60' : 'bg-exo-accent'}`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <span className={`text-[11px] ${done_ ? 'text-green-400/60' : 'text-exo-muted/40'}`}>
            {done}/{total}{done_ ? ' ✓' : ''}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* ── Collapsed row ── */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors group/row ${isExpanded ? 'bg-white/[0.02]' : ''}`}
        onClick={() => onToggleExpand(id)}
      >
        {/* Overdue bar */}
        <div className={`w-0.5 h-7 rounded-full flex-shrink-0 ${isOverdue ? 'bg-amber-400/60' : 'bg-transparent'}`} />

        {/* Type icon */}
        <div className={`p-1.5 rounded-lg flex-shrink-0 ${cfg.bg}`}>
          <cfg.Icon size={13} className={cfg.color} />
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <span className={`text-sm font-light truncate ${status === 'suspended' ? 'text-exo-muted/30 line-through' : 'text-exo-text/90'}`}>
            {is_pinned && <span className="text-exo-accent/50 mr-1 text-xs">📌</span>}
            {title}
          </span>
          <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          {renderMeta()}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleComplete}
            disabled={completing || status === 'suspended'}
            title="打卡"
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-exo-muted/30 hover:border-exo-accent/40 hover:text-exo-accent transition-all text-[11px] disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Check size={11} />
          </button>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(p => !p)}
              className="p-1.5 rounded-lg text-exo-muted/20 hover:text-exo-muted hover:bg-white/5 transition-all"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-exo-panel border border-exo-border/60 rounded-xl shadow-2xl py-1 min-w-[148px]">
                <MenuItem icon={Edit2}             label="编辑"       onClick={() => { setMenuOpen(false); onEdit(entry); }} />
                <MenuItem icon={is_pinned ? PinOff : Pin} label={is_pinned ? '取消置顶' : '置顶'} onClick={() => { setMenuOpen(false); onUpdate(id, { is_pinned: !is_pinned }); }} />
                <div className="h-px bg-white/5 my-1" />
                {gcal_event_id
                  ? <MenuItem icon={Trash2}       label="取消 GCal 链接" onClick={() => { setMenuOpen(false); onGcalUnsync(id); }} />
                  : <MenuItem icon={ExternalLink} label="推送到 GCal"     onClick={() => { setMenuOpen(false); onGcalSync(id); }} />
                }
                <div className="h-px bg-white/5 my-1" />
                {status === 'suspended'
                  ? <MenuItem icon={Play}  label="恢复"           onClick={() => { setMenuOpen(false); onResume(id); }} />
                  : <MenuItem icon={Pause} label="挂起"           onClick={() => { setMenuOpen(false); onSuspend(id); }} />
                }
                <MenuItem icon={Trash2} label="删除" onClick={() => { setMenuOpen(false); onDelete(id); }} danger />
              </div>
            )}
          </div>

          <div className="text-exo-muted/20 group-hover/row:text-exo-muted/40 transition-colors">
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {isExpanded && (
        <div className="px-5 pb-4 pt-2 border-t border-white/5 bg-white/[0.01] space-y-3">
          {description && (
            <p className="text-xs text-exo-muted/60 leading-relaxed">{description}</p>
          )}

          <div className="flex flex-wrap gap-3 text-[9px] text-exo-muted/30 uppercase tracking-widest">
            <span>开始 {start_date}</span>
            {tags?.length > 0 && (
              <span className="flex gap-1">
                {tags.map(t => (
                  <span key={t} className="bg-white/5 px-1.5 py-0.5 rounded">#{t}</span>
                ))}
              </span>
            )}
          </div>

          {/* Completion history */}
          <div>
            <div className="text-[9px] uppercase tracking-widest text-exo-muted/25 mb-1.5">打卡记录</div>
            {loadingCompletions && <div className="text-xs text-exo-muted/25">加载中...</div>}
            {!loadingCompletions && completions?.length === 0 && (
              <div className="text-xs text-exo-muted/20">暂无记录</div>
            )}
            {completions?.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center gap-2 text-[11px] text-exo-muted/35 py-0.5">
                <Check size={9} className="text-exo-accent/30 flex-shrink-0" />
                <span>{c.completed_at.slice(0, 16).replace('T', ' ')}</span>
                {c.note && <span className="text-exo-muted/25 truncate">"{c.note}"</span>}
              </div>
            ))}
          </div>

          {/* GCal link */}
          {gcal_event_link && (
            <a
              href={gcal_event_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-exo-muted/40 hover:text-exo-accent transition-colors"
            >
              <ExternalLink size={9} />
              在 Google Calendar 查看
            </a>
          )}
        </div>
      )}
    </div>
  );
}
