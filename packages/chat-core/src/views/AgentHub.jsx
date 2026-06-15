import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Star, Zap, Cpu, GripVertical } from 'lucide-react';
import { getAgentAvatarUrl } from '../utils/avatar';
import { baseUrl } from 'exo-shared';
import { getAgentHubOrder, isSuperiorType } from '../utils/presets';
import MemoryAnchorTicker from '../components/agent/MemoryAnchorTicker';
import BackToUpper from '../components/layout/BackButton';

const SectionHeader = ({ icon: Icon, label, accent }) => (
  <div className="mb-3">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} strokeWidth={1.5} className={accent} />
      <span className="text-[10px] tracking-[0.3em] text-exo-muted">{label}</span>
    </div>
    <div className="h-px bg-gradient-to-r from-exo-mist-10 to-transparent" />
  </div>
);

const AgentCard = ({ preset, anchors, dragging, dragOver, onDragStart, onDragEnd, onDragOver, onDrop, onClick }) => {
  const avatarUrl = getAgentAvatarUrl(preset.id, preset.name);
  const showTicker = isSuperiorType(preset.agent_type);
  const isDragging = dragging === preset.id;
  const isDragOver = dragOver === preset.id;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(preset.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); onDragOver(preset.id); }}
      onDrop={() => onDrop(preset.id)}
      onClick={() => onClick(preset)}
      className={`relative p-4 bg-exo-panel border rounded-md cursor-pointer transition-all select-none
        ${isDragging ? 'opacity-30 ring-2 ring-exo-accent/20' : 'opacity-100'}
        ${isDragOver ? 'border-exo-accent/50 ring-1 ring-exo-accent/20' : 'border-exo-border'}
        hover:border-exo-accent/30`}
    >
      {/* Drag handle -- top right, hidden on mobile */}
      <div
        className="hidden sm:block absolute top-2 right-2 p-1 text-exo-muted/30 cursor-grab active:cursor-grabbing hover:text-exo-muted/60 transition-colors rounded hover:bg-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} strokeWidth={1.5} />
      </div>

      {/* Avatar + Name + Badge */}
      <div className="flex items-center gap-3 mb-2 pr-6 sm:pr-0">
        <img
          src={avatarUrl}
          alt={preset.name}
          className="w-10 h-10 rounded-[2px] border border-exo-border object-cover bg-exo-bg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{preset.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-[2px] tracking-wider whitespace-nowrap border ${
              preset.agent_type === 'g045'
                ? 'text-exo-accent border-exo-accent/30 bg-exo-accent/10'
                : preset.agent_type === 'superior'
                ? 'text-purple-400 border-purple-400/30 bg-purple-400/10'
                : 'text-blue-400 border-blue-400/30 bg-blue-400/10'
            }`}>
              {preset.agent_type === 'g045' ? 'G045' : preset.agent_type}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {preset.description && (
        <p className="text-xs text-exo-muted/70 italic leading-relaxed line-clamp-2 mb-1">
          {preset.description}
        </p>
      )}

      {/* Anchor ticker for G045 & Superior */}
      {showTicker && (
        <>
          <div className="border-t border-exo-border/50 my-2" />
          <MemoryAnchorTicker anchors={anchors || []} />
        </>
      )}
    </div>
  );
};

export default function AgentHub({ appState, setView, goBack }) {
  const { presets = [] } = appState;
  const [anchorMap, setAnchorMap] = useState({});
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const draggingRef = useRef(null);

  // Fetch anchors for G045 & Superior agents on mount
  const superiorPresetIds = useMemo(
    () => presets.filter((p) => isSuperiorType(p.agent_type)).map((p) => p.id).join(','),
    [presets],
  );
  useEffect(() => {
    const ids = superiorPresetIds ? superiorPresetIds.split(',') : [];
    if (ids.length === 0) return;

    let cancelled = false;

    const fetchAnchors = async () => {
      const map = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(
              `${baseUrl}/api/agents/presets/${id}/triggered-notes/snapshot/`,
              { credentials: 'include' },
            );
            if (!res.ok) return;
            const data = await res.json();
            map[id] = Array.isArray(data) ? data : data.anchors || [];
          } catch (err) {
            console.error(`Failed to fetch anchors for preset ${id}:`, err);
          }
        }),
      );
      if (!cancelled) setAnchorMap(map);
    };

    fetchAnchors();
    return () => {
      cancelled = true;
    };
  }, [superiorPresetIds]);

  // Apply manual ordering from localStorage
  const applyOrder = (list) => {
    const order = getAgentHubOrder();
    return [...list].sort((a, b) => {
      const oA = order[a.id];
      const oB = order[b.id];
      if (oA !== undefined && oB !== undefined) return oA - oB;
      if (oA !== undefined) return -1;
      if (oB !== undefined) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
  };

  // Filter and sort presets into three sections
  const g045Presets = applyOrder(
    presets.filter((p) => p.agent_type === 'g045'),
  );
  const superiorPresets = applyOrder(
    presets.filter((p) => p.agent_type === 'superior'),
  );
  const standardPresets = applyOrder(
    presets.filter(
      (p) => p.agent_type !== 'g045' && p.agent_type !== 'superior',
    ),
  );

  const handleDragStart = (id) => {
    setDragging(id);
    draggingRef.current = id;
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOver(null);
    draggingRef.current = null;
  };

  const handleDragOver = (id) => {
    if (dragOver !== id) setDragOver(id);
  };

  const handleDrop = (dstId, sectionList) => {
    const srcId = draggingRef.current;
    if (!srcId || srcId === dstId) return;

    const ids = sectionList.map((p) => p.id);
    const srcIdx = ids.indexOf(srcId);
    const dstIdx = ids.indexOf(dstId);
    if (srcIdx === -1 || dstIdx === -1) return;

    const newIds = [...ids];
    newIds.splice(srcIdx, 1);
    const adjustedDst = newIds.indexOf(dstId);
    newIds.splice(adjustedDst, 0, srcId);

    // Persist new order to localStorage
    const order = getAgentHubOrder();
    newIds.forEach((id, i) => {
      order[id] = i;
    });
    localStorage.setItem('agentHubOrder', JSON.stringify(order));

    handleDragEnd();
  };

  const handleAgentClick = (preset) => {
    setView('agent_profile', {
      agentId: preset.id,
      agentName: preset.name,
    });
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>
      {/* Back bar — desktop only; mobile uses MobileHeader */}
      <div
        className="hidden md:flex items-center flex-shrink-0 px-4 md:px-12 py-3"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label="Home" onClick={() => goBack()} />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-5xl mx-auto px-4 md:px-12 pt-4 md:pt-12 pb-12 space-y-10">
        {/* G045 Superior Core */}
        {g045Presets.length > 0 && (
          <section>
            <SectionHeader
              icon={Star}
              label="G045 Superior Core"
              accent="text-exo-accent"
            />
            <div className="bg-exo-panel/50 border border-exo-accent/20 rounded-md p-4">
              <div className="grid grid-cols-1 gap-3">
                {g045Presets.map((p) => (
                  <AgentCard
                    key={p.id}
                    preset={p}
                    anchors={anchorMap[p.id]}
                    dragging={dragging}
                    dragOver={dragOver}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(dstId) => handleDrop(dstId, g045Presets)}
                    onClick={handleAgentClick}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Superior Agents */}
        {superiorPresets.length > 0 && (
          <section>
            <SectionHeader
              icon={Zap}
              label="Superior Agents"
              accent="text-purple-400"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {superiorPresets.map((p) => (
                <AgentCard
                  key={p.id}
                  preset={p}
                  anchors={anchorMap[p.id]}
                  dragging={dragging}
                  dragOver={dragOver}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(dstId) => handleDrop(dstId, superiorPresets)}
                  onClick={handleAgentClick}
                />
              ))}
            </div>
          </section>
        )}

        {/* Standard Agents */}
        {standardPresets.length > 0 && (
          <section>
            <SectionHeader
              icon={Cpu}
              label="Standard Agents"
              accent="text-blue-400"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {standardPresets.map((p) => (
                <AgentCard
                  key={p.id}
                  preset={p}
                  dragging={dragging}
                  dragOver={dragOver}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(dstId) => handleDrop(dstId, standardPresets)}
                  onClick={handleAgentClick}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {presets.length === 0 && (
          <div className="text-center py-20 text-exo-muted">
            <p className="font-mono text-sm">No agents configured</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
