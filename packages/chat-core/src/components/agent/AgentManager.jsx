import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit, Cpu, Hash, Edit3, Trash2,
  GripVertical, Play, Sparkles, Clock, Camera
} from 'lucide-react';
import { baseUrl } from 'exo-shared';
import { getAgentAvatarUrl } from '../../utils/avatar';
import EditPresetModal from '../modals/EditPresetModal';
import { Button } from '../ui';
import AvatarCropModal from '../modals/AvatarCropModal';
import TriggeredNote from './TriggeredNote';
import { getAgentHubOrder, isSuperiorType } from '../../utils/presets';

const AgentManager = ({ openNewSession, openDestructor, setCurrentTab, presets, refreshPresets }) => {
  const [editTarget, setEditTarget] = useState(null);
  const [anchorCache, setAnchorCache] = useState({});
  const [cardOrder, setCardOrder] = useState(() => getAgentHubOrder());
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const applyOrder = (list) =>
    [...list].sort((a, b) => {
      const orderA = cardOrder[a.id] !== undefined ? cardOrder[a.id] : a.id;
      const orderB = cardOrder[b.id] !== undefined ? cardOrder[b.id] : b.id;
      return orderA - orderB;
    });

  const g045Presets = applyOrder(presets.filter(p => isSuperiorType(p.agent_type)));
  const standardPresets = applyOrder(presets.filter(p => !isSuperiorType(p.agent_type) && p.agent_type !== 'user'));

  const handleDrop = (srcId, dstId, list) => {
    if (srcId === dstId) return;
    const ids = list.map(p => p.id);
    const newIds = [...ids];
    newIds.splice(newIds.indexOf(srcId), 1);
    newIds.splice(newIds.indexOf(dstId), 0, srcId);
    const newOrder = { ...cardOrder };
    newIds.forEach((id, idx) => { newOrder[id] = idx; });
    setCardOrder(newOrder);
    localStorage.setItem('agentHubOrder', JSON.stringify(newOrder));
  };

  useEffect(() => {
    g045Presets.forEach(p => {
      if (anchorCache[p.id] !== undefined) return;
      fetch(`${baseUrl}/api/agents/presets/${p.id}/triggered-notes/snapshot/`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => setAnchorCache(prev => ({ ...prev, [p.id]: Array.isArray(data) ? data : [] })))
        .catch(() => setAnchorCache(prev => ({ ...prev, [p.id]: [] })));
    });
  }, [g045Presets.map(p => p.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const AgentCard = ({ preset, isG045, list }) => {
    const isDraggingThis = dragging === preset.id;
    const isDragOver = dragOver === preset.id && !isDraggingThis;
    const avatarInputRef = useRef(null);
    const [avatarUrl, setAvatarUrl] = useState(() => getAgentAvatarUrl(preset.id, preset.name));
    const [cropFile, setCropFile] = useState(null);

    const handleAvatarChange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCropFile(file);
      e.target.value = '';
    };

    return (
      <>
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onConfirm={(dataUrl) => {
            localStorage.setItem(`exo_agent_avatar_${preset.id}`, dataUrl);
            setAvatarUrl(dataUrl);
            setCropFile(null);
          }}
          onCancel={() => setCropFile(null)}
        />
      )}
      <div
        className={`
          relative flex flex-col p-6 rounded-[2px] border transition-all animate-fade-in overflow-hidden
          ${isG045
            ? 'bg-exo-accent/[0.03] border-exo-accent/30 shadow-[0_0_30px_rgba(212,175,55,0.05)]'
            : 'bg-exo-pure border-exo-mist-10 hover:border-exo-mist-20'
          }
          ${isDraggingThis ? 'opacity-40 scale-[0.98]' : ''}
          ${isDragOver ? (isG045 ? 'border-exo-accent shadow-glow-sharp' : 'border-white/40 shadow-brutalist') : ''}
        `}
        draggable
        onDragStart={() => setDragging(preset.id)}
        onDragEnd={() => { setDragging(null); setDragOver(null); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(preset.id); }}
        onDrop={() => { handleDrop(dragging, preset.id, list); setDragging(null); setDragOver(null); }}
      >
        <div className="mb-6">
          {/* Row 1: grip + avatar + name */}
          <div className="flex items-center gap-4 mb-3">
            <div className="cursor-grab tx-system-mute opacity-30 hover:tx-system-accent transition-colors shrink-0"><GripVertical size={18} /></div>

            {/* Avatar */}
            <div
              className="relative shrink-0 cursor-pointer group/avatar"
              onClick={() => avatarInputRef.current?.click()}
              title="Calibration / 重调头像"
            >
              <img src={avatarUrl} className={`w-14 h-14 rounded-[2px] border object-cover transition-transform group-hover/avatar:scale-105 ${isG045 ? 'border-exo-accent/40 shadow-glow-gold' : 'border-exo-mist-20'}`} alt="Avatar" />
              <div className="absolute inset-0 rounded-[2px] bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={16} className="tx-system-normal" />
              </div>
              <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h3 className={`text-lg font-bold flex items-center gap-2 tracking-tight ${isG045 ? 'tx-system-accent' : 'tx-system-normal'}`}>
                <span className="truncate">{preset.name}</span>
                {isG045 && <Sparkles size={14} className="tx-system-accent animate-pulse-glow shrink-0" />}
              </h3>
              <p className="text-[0.625rem] tx-system-mute tracking-[0.1em] truncate opacity-60">Model: {preset.default_model}</p>
            </div>
          </div>

          {/* Row 2: action buttons — always on its own row, never collides with avatar */}
          <div className="flex items-center gap-2 pl-10">
            <button
              onClick={() => setEditTarget(preset)}
              className="p-2 tx-system-mute hover:tx-system-normal border border-exo-mist-10 rounded-[2px] hover:bg-exo-accent/[0.04] transition-colors" title="Edit Core"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={() => {
                openDestructor({
                  title: `Target Core: [${preset.name}]`,
                  description: "Decommissioning this core will prevent new session forks. Select archive for history preservation or purge for complete data erasure.",
                  onArchive: () => alert("Archive protocol initiated."),
                  onDelete: () => alert("Purge protocol initiated.")
                });
              }}
              className="p-2 text-red-500/50 hover:text-red-500 border border-red-900/20 rounded-[2px] hover:bg-red-500/10 transition-colors" title="Destroy Core"
            >
              <Trash2 size={14} />
            </button>
            <div className="w-px h-8 bg-exo-mist-10 mx-1"></div>
            <Button variant="primary"
              onClick={() => {
                openNewSession({ presetId: preset.id });
                setCurrentTab('chat');
              }}
            >
              <Play size={12} fill="currentColor" /> Initiate
            </Button>
          </div>
        </div>

        <p className="text-[13px] tx-system-mute opacity-80 mb-6 line-clamp-2 leading-relaxed font-mono tracking-tight italic">
          {preset.description || "No operational context defined for this node."}
        </p>

        {isG045 && (
          <div className="mt-auto pt-4 border-t border-exo-accent/20">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[0.625rem] font-bold tx-system-accent tracking-[0.2em] flex items-center gap-2">
                <Clock size={12} className="animate-pulse" /> Active Neural Trace
              </div>
              <span className="text-[0.5625rem] tx-system-accent opacity-40 tracking-tighter">[L3_SYNC_ACTIVE]</span>
            </div>
            <TriggeredNote anchors={anchorCache[preset.id] || []} />
          </div>
        )}
      </div>
      </>
    );
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-exo-bg bg-noise p-8 lg:p-12 scrollbar-hide">
      <EditPresetModal
        isOpen={!!editTarget}
        preset={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={refreshPresets}
      />
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-exo-accent" />
            <div className="text-[0.625rem] tracking-[0.5em] tx-system-accent">ExoCore Agent Cluster // Management.Console</div>
          </div>
          <h2 className="text-4xl font-light tx-system-normal tracking-tight flex items-center gap-4">
            <BrainCircuit className="tx-system-accent" size={36} /> Central Neural Hub
          </h2>
          <p className="tx-system-mute text-lg max-w-3xl font-light leading-tight-12">
            Configure system-wide agent protocols. Adjust core weights, model mapping, and monitor active memory synchronizations.
          </p>
        </div>

        {g045Presets.length > 0 && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 border-b border-exo-accent/30 pb-3">
              <div className="p-1.5 bg-exo-accent/10 border border-exo-accent/30 rounded-[2px]">
                <Cpu size={16} className="tx-system-accent" />
              </div>
              <h3 className="text-[12px] font-bold tx-system-normal tracking-[0.3em]">Superior Neural Cores (G045)</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-exo-accent/20 to-transparent" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {g045Presets.map(p => <AgentCard key={p.id} preset={p} isG045={true} list={g045Presets} />)}
            </div>
          </div>
        )}

        {standardPresets.length > 0 && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3 border-b border-exo-mist-10 pb-3">
              <div className="p-1.5 bg-white/5 border border-exo-mist-10 rounded-[2px]">
                <Hash size={16} className="tx-system-mute" />
              </div>
              <h3 className="text-[12px] font-bold tx-system-normal tracking-[0.3em]">Subordinate Logical Modules</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {standardPresets.map(p => <AgentCard key={p.id} preset={p} isG045={false} list={standardPresets} />)}
            </div>
          </div>
        )}
        
        <div className="h-20" /> {/* Bottom spacer */}
      </div>
    </div>
  );
};

export default AgentManager;
