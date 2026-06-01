import React, { useState, useEffect } from 'react';
import { GitFork, X, Activity, Check } from 'lucide-react';

const BranchSessionModal = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-exo-pure border border-exo-mist-10 rounded-[2px] w-full max-w-md shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-exo-mist-10 flex items-center justify-between bg-exo-pure/50">
          <div className="flex flex-col">
            <h3 className="font-bold tracking-[0.2em] text-white flex items-center gap-2 font-mono text-sm uppercase">
              <GitFork size={18} className="text-exo-accent" /> Branch Context
            </h3>
            <span className="text-[9px] text-exo-muted font-mono uppercase tracking-widest opacity-40 mt-1">Forking Active Neural Stream</span>
          </div>
          <button onClick={onClose} className="p-2 text-exo-muted hover:text-white transition-colors"><X size={18}/></button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-[12px] text-exo-muted leading-relaxed font-mono italic opacity-70">
            Determine target entry point. New session branch will inherit previous context weights without affecting the primary stream.
          </p>
          
          <div className="space-y-3">
            <label className="label-caps opacity-50">Branch Alias / 新会话名称</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="USE DEFAULT IF NULL..." 
              className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:opacity-20"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') onConfirm(e.target.value); }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-exo-mist-10 flex justify-end gap-3 bg-exo-pure/80 backdrop-blur-md">
          <button 
            onClick={onClose} 
            className="px-6 py-2 rounded-[2px] text-[11px] font-bold uppercase tracking-widest text-exo-muted hover:text-white transition-colors"
          >
            Abort
          </button>
          <button 
            onClick={() => onConfirm(name)} 
            disabled={isSubmitting} 
            className="px-8 py-2 bg-white text-exo-pure rounded-[2px] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-3"
          >
            {isSubmitting ? <Activity size={14} className="animate-spin" /> : <GitFork size={14} />} Confirm Branch
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchSessionModal;
