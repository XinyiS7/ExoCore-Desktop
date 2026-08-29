import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Activity, Folder, Check, MessageSquare } from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';
import { sortPresets, isG045Type } from '../../utils/presets';
import { ModalShell, Button, FIELD_INPUT } from '../ui';

const NewSessionModal = ({ isOpen, onClose, projects, presets, initialContext, onSuccess }) => {
  const sortedPresets = useMemo(() => sortPresets(presets), [presets, isOpen]);
  const [name, setName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [permissionProjectIds, setPermissionProjectIds] = useState([]);
  const [sessionType, setSessionType] = useState("lite");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
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

  const currentPreset = sortedPresets.find(p => p.id === parseInt(selectedPresetId));
  const isG045 = isG045Type(currentPreset?.agent_type);

  const handleBelongingProject = (pid) => {
    setSelectedProjectId(prev => prev === String(pid) ? "" : String(pid));
  };

  const handlePermissionProject = (pid) => {
    if (!isG045) return;
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
    const isG045Preset = isG045Type(currentPreset?.agent_type);
    const frozenIds = isG045Preset
      ? permissionProjectIds.filter(id => id !== Number(effectiveProjectId))
      : [];
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
        if (sessionId && onSuccess) onSuccess(sessionId);
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

  const cardBase = 'group p-4 rounded-lg border cursor-pointer flex justify-between items-center transition-all';
  const cardSelected = 'border-exo-accent/40 bg-exo-accent/5';
  const cardIdle = 'border-exo-mist-10/30 bg-black/[0.02] dark:bg-white/[0.02] hover:border-exo-mist-10/50';
  const optSelected = 'border-exo-accent/40 bg-exo-accent/5 tx-system-normal';
  const optIdle = 'border-exo-mist-10/30 bg-black/[0.02] dark:bg-white/[0.02] tx-system-mute hover:border-exo-mist-10/50';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={Activity}
      title="NODE INITIALIZATION"
      subtitle="Establishing secure neural link"
      maxW="md"
      bodyClassName="space-y-8"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Activity size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={1.5} />}
            {isSubmitting ? 'COMMITTING...' : 'COMMIT LINK'}
          </Button>
        </div>
      }
    >
      {/* Alias */}
      <div className="space-y-3">
        <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Session Alias / 会话名称</label>
        <input
          className={FIELD_INPUT}
          placeholder="AUTO-GENERATED IF NULL..."
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* Agent Selection */}
      <div className="space-y-3">
        <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Neural Core / 选择 Agent</label>
        <div className="grid grid-cols-1 gap-2">
          {sortedPresets.map(preset => {
            const isSelected = parseInt(selectedPresetId) === preset.id;
            const g045 = isG045Type(preset.agent_type);
            return (
              <div
                key={preset.id}
                onClick={() => {
                  setSelectedPresetId(String(preset.id));
                  if (!g045) setPermissionProjectIds([]);
                }}
                className={`${cardBase} ${isSelected ? cardSelected : cardIdle}`}
              >
                <div className="flex flex-col gap-1">
                  <span className={`text-[13px] font-bold tracking-tight ${isSelected && g045 ? 'tx-system-accent' : 'tx-system-normal'}`}>{preset.name}</span>
                  <span className="text-[0.625rem] opacity-40 font-mono tracking-widest">{preset.default_model}</span>
                </div>
                {isSelected ? (
                  <div className={`p-1 rounded-full ${g045 ? 'bg-exo-accent text-exo-pure' : 'bg-exo-mist-20 text-exo-pure'}`}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-exo-mist-10/50 group-hover:border-exo-mist-10" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Session Type — hidden for g045 */}
      {!isG045 && (
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Protocol Mode / 会话模式</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'full', label: 'Full Protocol', icon: Activity, desc: 'Context cache + full history context' },
              { value: 'lite', label: 'Lite Protocol', icon: MessageSquare, desc: 'Reduced overhead, lightweight' },
            ].map(({ value, label, icon: Icon, desc }) => (
              <div
                key={value}
                onClick={() => setSessionType(value)}
                className={`p-4 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${sessionType === value ? optSelected : optIdle}`}
              >
                <Icon size={16} className={sessionType === value ? 'tx-system-accent' : ''} />
                <div className="flex flex-col">
                  <span className="text-[0.7rem] font-mono tracking-[0.15em]">{label}</span>
                  <span className="text-[0.6rem] opacity-40 font-mono">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 所属 Project — single select */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">所属 Project / 归属项目</label>
          <span className="text-[0.55rem] tx-system-mute font-mono tracking-tighter opacity-50">[Optional · Single]</span>
        </div>
        <div className="max-h-40 overflow-y-auto border border-exo-mist-10/30 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-2 space-y-1 scrollbar-hide">
          {projects.length === 0 && (
            <div className="text-center py-4 text-[0.625rem] font-mono tx-system-mute opacity-30 italic">No project clusters found</div>
          )}
          {projects.map(proj => {
            const isSelected = selectedProjectId === String(proj.id);
            return (
              <div
                key={proj.id}
                onClick={() => handleBelongingProject(proj.id)}
                className={`px-4 py-2.5 rounded-lg text-[0.7rem] font-mono cursor-pointer flex justify-between items-center transition-all border ${
                  isSelected
                    ? 'bg-exo-accent/10 tx-system-normal border-exo-accent/20'
                    : 'tx-system-mute opacity-60 hover:tx-system-normal hover:bg-exo-accent/[0.04] border-transparent'
                }`}
              >
                <div className="flex items-center gap-3"><Folder size={12} className={isSelected ? 'tx-system-accent' : 'opacity-40'}/> {proj.name}</div>
                {isSelected && <Check size={12} className="tx-system-accent" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* 权限 Project — multi select, G045 only */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">权限 Project / 权限项目</label>
          <span className={`text-[0.55rem] font-mono tracking-tighter ${isG045 ? 'tx-system-accent opacity-60' : 'tx-system-mute opacity-30'}`}>
            {isG045 ? '[Multi-Select Enabled]' : '[G045 Only]'}
          </span>
        </div>
        <div
          aria-disabled={!isG045}
          className={`max-h-40 overflow-y-auto border border-exo-mist-10/30 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-2 space-y-1 scrollbar-hide ${!isG045 ? 'opacity-40 pointer-events-none' : ''}`}
        >
          {projects.length === 0 && (
            <div className="text-center py-4 text-[0.625rem] font-mono tx-system-mute opacity-30 italic">No project clusters found</div>
          )}
          {projects.map(proj => {
            const isSelected = permissionProjectIds.includes(proj.id);
            return (
              <div
                key={proj.id}
                onClick={() => handlePermissionProject(proj.id)}
                className={`px-4 py-2.5 rounded-lg text-[0.7rem] font-mono cursor-pointer flex justify-between items-center transition-all border ${
                  isSelected
                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                    : 'tx-system-mute opacity-60 hover:tx-system-normal hover:bg-exo-accent/[0.04] border-transparent'
                }`}
              >
                <div className="flex items-center gap-3"><Folder size={12} className={isSelected ? 'text-purple-400' : 'opacity-40'}/> {proj.name}</div>
                {isSelected && <Check size={12} className="text-purple-400" />}
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
};

export default NewSessionModal;
