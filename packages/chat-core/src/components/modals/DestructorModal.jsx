import React from 'react';
import { AlertTriangle, Archive, Trash2 } from 'lucide-react';

const DestructorModal = ({ isOpen, onClose, title, description, onArchive, onDelete }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-exo-pure border border-red-500/40 rounded-[2px] w-full max-w-md shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden">
        <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center gap-3 text-red-500">
          <AlertTriangle size={18} className="animate-pulse" />
          <h3 className="font-bold tracking-[0.2em] uppercase text-[11px] font-mono">Destruction Protocol / 销毁协议</h3>
        </div>
        <div className="p-6 space-y-3 text-sm text-white">
          <p className="font-bold text-lg font-display uppercase tracking-tight">{title}</p>
          <p className="text-exo-muted leading-relaxed font-mono text-[12px] opacity-80">{description}</p>
          
          <div className="mt-6 p-3 bg-red-500/5 border-l-2 border-red-500/30">
            <p className="text-[10px] font-mono text-red-500/60 leading-normal uppercase">
              Warning: PURGE is an irreversible operation. All neural weights associated with this entry will be decoupled from the active link.
            </p>
          </div>
        </div>
        <div className="p-4 bg-exo-pure border-t border-exo-mist-10 flex flex-wrap justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-[2px] text-[11px] font-bold uppercase tracking-widest text-exo-muted hover:text-white transition-colors">Abort</button>
          <button onClick={() => { onArchive(); onClose(); }} className="px-5 py-2 rounded-[2px] text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-exo-accent border border-exo-accent/30 hover:bg-exo-accent/10 transition-colors">
            <Archive size={14} /> Archive
          </button>
          <button onClick={() => { onDelete(); onClose(); }} className="px-6 py-2 rounded-[2px] text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 bg-red-600 text-white hover:bg-red-500 transition-all shadow-brutalist active:scale-95">
            <Trash2 size={14} /> Purge
          </button>
        </div>
      </div>
    </div>
  );
};

export default DestructorModal;
