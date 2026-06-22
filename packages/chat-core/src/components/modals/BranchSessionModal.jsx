import React, { useState, useEffect } from 'react';
import { GitFork, X, Activity, Check } from 'lucide-react';

const BranchSessionModal = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
 const [name, setName] = useState("");
 const [sessionType, setSessionType] = useState("lite");

 useEffect(() => {
 if (isOpen) {
  setName("");
  setSessionType("lite");
 }
 }, [isOpen]);

 const handleConfirm = () => {
 onConfirm({ name, sessionType });
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-cinder-glass-heavy backdrop-blur-md animate-in fade-in duration-200">
  <div className="bg-exo-pure border border-exo-mist-10 rounded-[2px] w-full max-w-md shadow-[0_0_60px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">
  {/* Header */}
  <div className="px-6 py-4 border-b border-exo-mist-10 flex items-center justify-between bg-exo-pure/50">
   <div className="flex flex-col">
   <h3 className="font-bold tracking-[0.2em] tx-system-normal flex items-center gap-2 text-sm">
    <GitFork size={18} className="tx-system-accent" /> Branch Context
   </h3>
   <span className="text-[0.6625rem] tx-system-mute tracking-widest opacity-40 mt-1">Forking Active Neural Stream</span>
   </div>
   <button onClick={onClose} className="p-2 tx-system-mute hover:tx-system-normal transition-colors"><X size={18}/></button>
  </div>
  
  {/* Content */}
  <div className="p-6 space-y-6">
   <p className="text-[12px] tx-system-mute leading-relaxed italic opacity-70">
   Determine target entry point. New session branch will inherit previous context weights without affecting the primary stream.
   </p>
   
   <div className="space-y-3">
   <label className="label-caps opacity-50">Branch Alias / 新会话名称</label>
   <input
    type="text"
    value={name}
    onChange={e => setName(e.target.value)}
    placeholder="USE DEFAULT IF NULL..."
    className="w-full bg-cinder-glass-heavy border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm tx-system-normal focus:border-exo-accent/40 outline-none transition-all placeholder:opacity-20"
    autoFocus
    onKeyDown={e => { if (e.key === 'Enter') onConfirm({ name, sessionType }); }}
   />
   </div>

   <div className="space-y-3">
   <label className="label-caps opacity-50">Session Type / 会话类型</label>
   <div className="grid grid-cols-2 gap-3">
    {[
    { value: 'full', label: 'Full', desc: 'Context cache + memory' },
    { value: 'lite', label: 'Lite', desc: 'Lightweight, reduced overhead' },
    ].map(({ value, label, desc }) => (
    <button
     key={value}
     onClick={() => setSessionType(value)}
     className={`px-4 py-2.5 rounded-[2px] border text-[0.725rem] tracking-wider transition-all
     ${sessionType === value
      ? 'bg-exo-accent/10 border-exo-accent/60 tx-system-normal'
      : 'bg-cinder-glass-heavy border-exo-mist-10 tx-system-mute opacity-60 hover:border-exo-mist-20'}`}
    >
     <span className="block text-[0.7875rem] font-bold">{label}</span>
     <span className="block text-[0.6rem] opacity-50 mt-0.5">{desc}</span>
    </button>
    ))}
   </div>
   </div>
  </div>

  {/* Footer */}
  <div className="p-4 border-t border-exo-mist-10 flex justify-end gap-3 bg-exo-pure/80 backdrop-blur-md">
   <button 
   onClick={onClose} 
   className="px-6 py-2 rounded-[2px] text-[0.7875rem] font-bold tracking-widest tx-system-mute hover:tx-system-normal transition-colors"
   >
   Abort
   </button>
   <button 
   onClick={handleConfirm}
   disabled={isSubmitting} 
   className="px-8 py-2 bg-white text-exo-pure rounded-[2px] text-[0.7875rem] font-bold tracking-[0.2em] hover:bg-exo-accent transition-colors shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-3"
   >
   {isSubmitting ? <Activity size={14} className="animate-spin" /> : <GitFork size={14} />} Confirm Branch
   </button>
  </div>
  </div>
 </div>
 );
};

export default BranchSessionModal;
