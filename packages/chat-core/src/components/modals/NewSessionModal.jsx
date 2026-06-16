import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Activity, Folder, Check, MessageSquare, Code2 } from 'lucide-react';
import { baseUrl, getCsrfToken, conversationsApi } from 'exo-shared';
import { sortPresets, isSuperiorType } from '../../utils/presets';

const NewSessionModal = ({ isOpen, onClose, projects, presets, initialContext, onSuccess, setActiveSessionId, setView }) => {
 const sortedPresets = useMemo(() => sortPresets(presets), [presets, isOpen]);
 const [name, setName] = useState("");
 const [selectedPresetId, setSelectedPresetId] = useState("");
 const [selectedProjectId, setSelectedProjectId] = useState("");  // 所属 project — single, optional
 const [permissionProjectIds, setPermissionProjectIds] = useState([]); // 权限 project — multi
 const [sessionType, setSessionType] = useState("lite");
 const [isSubmitting, setIsSubmitting] = useState(false);

 useEffect(() => {
 if (!isOpen) return;
 console.log('[DEBUG] NewSessionModal useEffect — initialContext:', JSON.stringify(initialContext), 'projectId:', initialContext?.projectId, 'type:', typeof initialContext?.projectId);
 setName("");
 setSessionType("lite");
 setSelectedProjectId(initialContext?.projectId ? String(initialContext.projectId) : "");
 setPermissionProjectIds([]);

 if (initialContext?.presetId && sortedPresets.find(p => p.id === initialContext.presetId)) {
  setSelectedPresetId(String(initialContext.presetId));
 } else if (sortedPresets.length > 0) {
  setSelectedPresetId(String(sortedPresets[0].id));
 } else {
  setSelectedPresetId("");
 }
 }, [isOpen, initialContext, sortedPresets]);

 if (!isOpen) return null;

 const currentPreset = sortedPresets.find(p => p.id === parseInt(selectedPresetId));
 const isG045 = isSuperiorType(currentPreset?.agent_type);

 const handleBelongingProject = (pid) => {
 setSelectedProjectId(prev => prev === String(pid) ? "" : String(pid));
 };

 const handlePermissionProject = (pid) => {
 if (!isG045) return; // disabled for Standard
 setPermissionProjectIds(prev =>
  prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
 );
 };

 const handleSubmit = async () => {
 if (!selectedPresetId) return alert("System Error: No Agent selected.");
 setIsSubmitting(true);
 const effectiveProjectId = selectedProjectId ||
  (initialContext?.projectId ? String(initialContext.projectId) : "");
 const projectId = effectiveProjectId ? Number(effectiveProjectId) : 0;

 // Build frozen_project_ids (Superior/G045 only)
 const isG045Preset = isSuperiorType(currentPreset?.agent_type);
 const frozenIds = isG045Preset
  ? permissionProjectIds.filter(id => id !== Number(effectiveProjectId))
  : [];

 // Payload matches SuperiorSessionInitSerializer
 const payload = {
  preset_id: parseInt(selectedPresetId),
  name: name.trim() || undefined,
  project_id: projectId,
  frozen_project_ids: frozenIds,
  thinking_level: 'auto',
  temperature: 1.0,
 };

 try {
  const res = await fetch(`${baseUrl}/api/agents/sessions/init/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
  body: JSON.stringify(payload),
  credentials: 'include'
  });
  const data = await res.json();
  if (res.ok) {
  const sessionId = data.data?.session_id;
  if (sessionId && onSuccess) {
   onSuccess(sessionId);
  }
  onClose();
  } else {
  alert("创建失败: " + JSON.stringify(data));
  }
 } catch (e) {
  alert("网络错误。");
 } finally {
  setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
  <div className="bg-exo-pure border border-exo-mist-10 rounded-[2px] w-full max-w-lg shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
  {/* Header */}
  <div className="px-6 py-4 border-b border-exo-mist-10 flex items-center justify-between bg-exo-pure/50">
   <div className="flex flex-col">
   <h3 className="font-bold tracking-[0.2em] text-white flex items-center gap-2 text-sm">
    <Activity size={16} className="text-exo-accent" /> Node Initialization
   </h3>
   <span className="text-[0.5625rem] text-exo-muted tracking-widest opacity-40 mt-1">Establishing Secure Neural Link</span>
   </div>
   <button onClick={onClose} className="p-2 text-exo-muted hover:text-white transition-colors"><X size={18}/></button>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide max-h-[70vh]">
   {/* Alias */}
   <div className="space-y-3">
   <label className="label-caps">Session Alias / 会话名称</label>
   <input 
    type="text" 
    value={name} 
    onChange={e => setName(e.target.value)} 
    placeholder="AUTO-GENERATED IF NULL..." 
    className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:opacity-20" 
   />
   </div>

   {/* Agent Selection */}
   <div className="space-y-3">
   <label className="label-caps">Neural Core / 选择 Agent</label>
   <div className="grid grid-cols-1 gap-2">
    {sortedPresets.map(preset => {
    const isSelected = parseInt(selectedPresetId) === preset.id;
    return (
     <div 
     key={preset.id} 
     onClick={() => {
      setSelectedPresetId(String(preset.id));
      if (!isSuperiorType(preset.agent_type)) {
      setPermissionProjectIds([]);
      }
     }}
     className={`
      group p-4 rounded-[2px] border cursor-pointer flex justify-between items-center transition-all
      ${isSelected
      ? (isSuperiorType(preset.agent_type) ? 'bg-exo-accent/10 border-exo-accent/60' : 'bg-white/5 border-white/40 shadow-brutalist')
      : 'bg-black/30 border-exo-mist-10 text-exo-muted hover:border-exo-mist-20'}
     `}
     >
     <div className="flex flex-col gap-1">
      <span className={`text-[13px] font-bold tracking-tight ${isSelected ? (isSuperiorType(preset.agent_type) ? 'text-exo-accent' : 'text-white') : ''}`}>{preset.name}</span>
      <span className="text-[0.625rem] opacity-40 font-mono tracking-widest">{preset.default_model}</span>
     </div>
     {isSelected ? (
      <div className={`p-1 rounded-full ${isSuperiorType(preset.agent_type) ? 'bg-exo-accent text-exo-pure' : 'bg-white text-exo-pure'}`}>
      <Check size={12} strokeWidth={3} />
      </div>
     ) : (
      <div className="w-4 h-4 rounded-full border border-exo-mist-10 group-hover:border-exo-mist-20" />
     )}
     </div>
    );
    })}
   </div>
   </div>

   {/* Session Type — hidden for Superior/G045 */}
   {!isG045 && (
   <div className="space-y-3">
    <label className="label-caps">Protocol Mode / 会话模式</label>
    <div className="grid grid-cols-2 gap-3">
    {[
     { value: 'full', label: 'Full Protocol', icon: Activity, desc: 'Context cache + full memory injection' },
     { value: 'lite', label: 'Lite Protocol', icon: MessageSquare, desc: 'Reduced overhead, lightweight' },
    ].map(({ value, label, icon: Icon, desc }) => (
     <div
     key={value}
     onClick={() => setSessionType(value)}
     className={`
      p-4 rounded-[2px] border cursor-pointer flex items-center gap-3 transition-all
      ${sessionType === value
      ? 'bg-exo-accent/10 border-exo-accent/60 text-white shadow-brutalist-gold'
      : 'bg-black/30 border-exo-mist-10 text-exo-muted hover:border-exo-mist-20'}
     `}
     >
     <Icon size={16} className={sessionType === value ? 'text-exo-accent' : ''} />
     <div className="flex flex-col">
      <span className="text-[0.6875rem] font-bold tracking-widest">{label}</span>
      <span className="text-[0.5625rem] opacity-40 font-mono">{desc}</span>
     </div>
     </div>
    ))}
    </div>
   </div>
   )}

   {/* 所属 Project — single select, always shown */}
   <div className="space-y-3">
   <label className="label-caps flex justify-between items-center">
    <span>所属 Project / 归属项目</span>
    <span className="text-[0.5625rem] text-exo-muted font-mono tracking-tighter opacity-60">
    [Optional · Single]
    </span>
   </label>
   <div className="max-h-40 overflow-y-auto border border-exo-mist-10 rounded-[2px] bg-black/40 p-2 space-y-1 scrollbar-hide">
    {projects.length === 0 && (
    <div className="text-center py-4 text-[0.625rem] font-mono text-exo-muted/30 italic">No project clusters found</div>
    )}
    {projects.map(proj => {
    const isSelected = selectedProjectId === String(proj.id);
    return (
     <div
     key={proj.id}
     onClick={() => handleBelongingProject(proj.id)}
     className={`
      px-4 py-2.5 rounded-[2px] text-[0.6875rem] font-mono cursor-pointer flex justify-between items-center transition-all
      ${isSelected
      ? 'bg-exo-accent/10 text-white border border-exo-accent/20'
      : 'text-exo-muted/60 hover:text-white hover:bg-exo-accent/[0.04] border border-transparent'}
     `}
     >
     <div className="flex items-center gap-3"><Folder size={12} className={isSelected ? 'text-exo-accent' : 'opacity-40'}/> {proj.name}</div>
     {isSelected && <Check size={12} className="text-exo-accent" />}
     </div>
    );
    })}
   </div>
   </div>

   {/* 权限 Project — multi select, enabled for Superior/G045, disabled for Standard */}
   <div className="space-y-3">
   <label className="label-caps flex justify-between items-center">
    <span>权限 Project / 权限项目</span>
    <span className={`text-[0.5625rem] font-mono tracking-tighter ${
    isG045 ? 'text-exo-accent opacity-60' : 'text-exo-muted/30'
    }`}>
    {isG045 ? '[Multi-Select Enabled]' : '[Superior/G045 Only]'}
    </span>
   </label>
   <div
    aria-disabled={!isG045}
    className={`max-h-40 overflow-y-auto border border-exo-mist-10 rounded-[2px] bg-black/40 p-2 space-y-1 scrollbar-hide ${
    !isG045 ? 'opacity-40 pointer-events-none' : ''
    }`}
   >
    {projects.length === 0 && (
    <div className="text-center py-4 text-[0.625rem] font-mono text-exo-muted/30 italic">No project clusters found</div>
    )}
    {projects.map(proj => {
    const isSelected = permissionProjectIds.includes(proj.id);
    return (
     <div
     key={proj.id}
     onClick={() => handlePermissionProject(proj.id)}
     className={`
      px-4 py-2.5 rounded-[2px] text-[0.6875rem] font-mono cursor-pointer flex justify-between items-center transition-all
      ${isSelected
      ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
      : 'text-exo-muted/60 hover:text-white hover:bg-exo-accent/[0.04] border border-transparent'}
     `}
     >
     <div className="flex items-center gap-3"><Folder size={12} className={isSelected ? 'text-purple-400' : 'opacity-40'}/> {proj.name}</div>
     {isSelected && <Check size={12} className="text-purple-400" />}
     </div>
    );
    })}
   </div>
   </div>
  </div>

  {/* Footer */}
  <div className="p-4 border-t border-exo-mist-10 flex justify-end gap-3 bg-exo-pure/80 backdrop-blur-md">
   <button 
   onClick={onClose} 
   className="px-6 py-2 rounded-[2px] text-[0.6875rem] font-bold tracking-widest text-exo-muted hover:text-white transition-colors"
   >
   Abort
   </button>
   <button 
   onClick={handleSubmit} 
   disabled={isSubmitting} 
   className="px-8 py-2 bg-white text-exo-pure rounded-[2px] text-[0.6875rem] font-bold tracking-[0.2em] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-3"
   >
   {isSubmitting ? <Activity size={14} className="animate-spin" /> : <Plus size={14} />} Commit Link
   </button>
  </div>
  </div>
 </div>
 );
};

export default NewSessionModal;
