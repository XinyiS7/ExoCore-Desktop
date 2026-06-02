import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Edit2, Trash2, Globe, Heart } from 'lucide-react';

const SCOPE_ICONS = {
  '表': { Icon: Globe, color: 'text-blue-400/70', label: '表 · 外部' },
  '里': { Icon: Heart, color: 'text-rose-400/70', label: '里 · 内部' },
};

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

export default function ChronicleEntryRow({ entry, onEdit, onDelete }) {
  const { id, event_time, content, scope, keywords, preset_name } = entry;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const scopeCfg = SCOPE_ICONS[scope] || { Icon: Globe, color: 'text-exo-muted/40', label: scope || '未分类' };
  const ScopeIcon = scopeCfg.Icon;

  return (
    <div className="group flex items-start gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors border-b border-white/5">
      {/* Scope indicator */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
        <div className={`p-1.5 rounded-lg ${scope === '里' ? 'bg-rose-400/10' : 'bg-blue-400/10'}`}>
          <ScopeIcon size={14} className={scopeCfg.color} />
        </div>
        <span className="text-[8px] uppercase tracking-widest text-exo-muted/30 font-mono">{event_time?.slice(0, 7) || ''}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-exo-muted/40 font-mono">
            {scopeCfg.label}
          </span>
          <span className="text-[10px] text-exo-muted/30 font-mono">{event_time}</span>
          {preset_name && (
            <span className="text-[10px] text-exo-muted/20 font-mono">via {preset_name}</span>
          )}
        </div>
        <p className="text-sm text-exo-text/80 leading-relaxed whitespace-pre-wrap">{content}</p>
        {keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {keywords.map(k => (
              <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-exo-accent/5 text-exo-accent/50 font-mono">
                #{k}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(p => !p)}
          className="p-1.5 rounded-lg text-exo-muted/20 hover:text-exo-muted hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-exo-panel border border-exo-border/60 rounded-xl shadow-2xl py-1 min-w-[120px]">
            <MenuItem icon={Edit2} label="编辑" onClick={() => { setMenuOpen(false); onEdit(entry); }} />
            <MenuItem icon={Trash2} label="删除" onClick={() => { setMenuOpen(false); onDelete(id); }} danger />
          </div>
        )}
      </div>
    </div>
  );
}
