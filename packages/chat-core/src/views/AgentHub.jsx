import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getAgentAvatarUrl } from '../utils/avatar';
import { baseUrl } from 'exo-shared';
import { getAgentHubOrder, isSuperiorType } from '../utils/presets';
import TriggeredNote from '../components/agent/TriggeredNote';
import BackToUpper from '../components/layout/BackButton';

/* ── Motion helper ── */
const fadeUp = (delay) => ({
  animation: `fadeUp .5s ${delay}s cubic-bezier(.22,1,.36,1) both`,
});

/* ── Section header atom ── */
const SectionHead = ({ label }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-[18px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
    <span className="tx-section-normal font-light">
      {label}
    </span>
  </div>
);

/* ── Nav header atom ── */
const NavHead = ({ label, children }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-[12px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
    <span className="tx-nav-mute font-medium uppercase tracking-wider">
      {label}
    </span>
    {children && <span style={{ marginLeft: 'auto' }}>{children}</span>}
  </div>
);

/* ── Corner glyph — engraved calibration marks ── */
const CornerGlyph = ({ hovered }) => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none z-[1] transition-all duration-500"
    viewBox="0 0 280 20"
    preserveAspectRatio="none"
    fill="none"
    stroke="currentColor"
    style={{
      opacity: hovered ? 0.45 : 0.07,
      filter: hovered ? 'drop-shadow(0 0 5px rgba(248,191,116,0.55))' : 'none',
    }}
  >
    <line x1="4" y1="18.5" x2="140" y2="18.5" strokeWidth="0.06" />
    <line x1="0" y1="19" x2="200" y2="19" strokeWidth="0.10" />
    <line x1="8" y1="19.4" x2="75" y2="19.4" strokeWidth="0.04" />
    <line x1="3" y1="0" x2="3" y2="19" strokeWidth="0.07" />
    <line x1="6" y1="5" x2="6" y2="20" strokeWidth="0.07" />
  </svg>
);

/* ── Geometric SVG icons (no lucide) ── */
const IconPrime = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <polygon points="12,3 15,9 21,10 16,15 18,21 12,18 6,21 8,15 3,10 9,9" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);

const IconSuperior = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <polygon points="13,3 10,11 14,11 11,21 17,11 13,11 16,3" strokeLinejoin="round" />
  </svg>
);

const IconStandard = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <rect x="5" y="5" width="14" height="14" rx="1" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

const IconDrag = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const IconLock = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <rect x="7" y="11" width="10" height="9" rx="1" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/* ═══════════════════════════════════════════
   AgentHub
   ═══════════════════════════════════════════ */
export default function AgentHub({ appState, setView, goBack }) {
  const { presets = [] } = appState;
  const [anchorMap, setAnchorMap] = useState({});
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const draggingRef = useRef(null);

  /* ── Fetch anchors for G045 & Superior agents ── */
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
    return () => { cancelled = true; };
  }, [superiorPresetIds]);

  /* ── Ordering ── */
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

  const g045Presets = applyOrder(presets.filter((p) => p.agent_type === 'g045'));
  const superiorPresets = applyOrder(presets.filter((p) => p.agent_type === 'superior'));
  const standardPresets = applyOrder(
    presets.filter((p) => p.agent_type !== 'g045' && p.agent_type !== 'superior' && p.agent_type !== 'user'),
  );

  /* ── Drag handlers ── */
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

    const order = getAgentHubOrder();
    newIds.forEach((id, i) => { order[id] = i; });
    localStorage.setItem('agentHubOrder', JSON.stringify(order));

    handleDragEnd();
  };

  const handleAgentClick = (preset) => {
    setView('agent_profile', { agentId: preset.id, agentName: preset.name });
  };

  /* ── Type badge style ── */
  const typeBadgeStyle = (type) => {
    if (type === 'g045') return {
      background: 'rgba(255,74,8,0.12)',
      color: 'var(--cinder-flame)',
      border: '1px solid rgba(255,74,8,0.25)',
    };
    if (type === 'superior') return {
      background: 'rgba(168,122,255,0.08)',
      color: 'rgb(188,148,255)',
      border: '1px solid rgba(168,122,255,0.2)',
    };
    return {
      background: 'rgba(100,160,220,0.08)',
      color: 'rgb(130,180,230)',
      border: '1px solid rgba(100,160,220,0.2)',
    };
  };

  /* ── Render ── */
  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>

      {/* ═══ Fixed back bar — desktop only; mobile uses MobileHeader ═══ */}
      <div
        className="hidden md:flex items-center flex-shrink-0 px-4 md:px-12 py-3"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label="Home" onClick={() => goBack()} />
      </div>

      {/* ═══ Scrollable content ═══ */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-[900px] mx-auto px-6 md:px-10 py-[40px] md:py-[60px] pb-[100px] flex flex-col gap-14">

          {/* ═══ Header ═══ */}
          <section style={fadeUp(0)}>
            <SectionHead label="Agent Hub" />
            <p className="tx-decoration-mute mt-1.5 ml-[28px]">
              Digital entities...
            </p>
          </section>

          {/* ═══ G045 The Prime ═══ */}
          {g045Presets.length > 0 && (
            <section style={fadeUp(0.06)}>
              <NavHead label="THE PRIME" />
              <div className="mt-3 flex flex-col gap-3">
                {g045Presets.map((p) => {
                  const anchors = anchorMap[p.id];
                  const avatarUrl = getAgentAvatarUrl(p.id, p.name);
                  const isHovered = hoveredCard === `g045-${p.id}`;
                  const isDragging = dragging === p.id;
                  const isDragOver = dragOver === p.id;

                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(p.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => { e.preventDefault(); handleDragOver(p.id); }}
                      onDrop={() => handleDrop(p.id, g045Presets)}
                      onClick={() => handleAgentClick(p)}
                      className="relative cursor-pointer transition-all duration-400 select-none tx-card-sm"
                      style={{
                        ...(isDragging
                          ? { opacity: 0.3 }
                          : { opacity: 1 }),
                        padding: '20px 24px',
                        background: isHovered ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${isDragOver ? 'rgba(255,74,8,0.35)' : isHovered ? 'rgba(196,77,0,0.3)' : 'rgba(166,61,0,0.12)'}`,
                        borderRadius: '6px',
                        boxShadow: isHovered ? '0 0 40px rgba(255,74,8,0.08), 0 8px 32px rgba(0,0,0,0.5)' : 'none',
                        transform: isHovered ? 'translateY(-1px)' : 'none',
                      }}
                      onMouseEnter={() => setHoveredCard(`g045-${p.id}`)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      {/* Breathing glow */}
                      <span
                        className="absolute inset-0 pointer-events-none transition-opacity duration-700 rounded-[6px]"
                        style={{
                          opacity: isHovered ? 1 : 0.3,
                          background: 'radial-gradient(ellipse at 30% 50%, rgba(196,77,0,0.06) 0%, transparent 70%)',
                          animation: 'breatheSlow 4s ease-in-out infinite',
                        }}
                      />

                      {/* Corner glyph */}
                      <CornerGlyph hovered={isHovered} />

                      {/* Drag handle */}
                      <div
                        className="hidden sm:block absolute top-3 right-3 p-1 cursor-grab active:cursor-grabbing transition-opacity duration-300 z-[2] rounded"
                        style={{
                          opacity: isHovered ? 0.5 : 0,
                          color: 'var(--cinder-text-faint)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.color = 'var(--cinder-flame)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = String(isHovered ? 0.5 : 0); e.currentTarget.style.color = 'var(--cinder-text-faint)'; }}
                      >
                        <IconDrag size={14} />
                      </div>

                      <div className="relative z-[1]">
                        {/* Avatar + Name + Lock */}
                        <div className="flex items-center gap-3 mb-2 pr-6 sm:pr-0">
                          <img
                            src={avatarUrl}
                            alt={p.name}
                            className="w-10 h-10 shrink-0 object-cover"
                            style={{
                              borderRadius: '2px',
                              border: '1px solid rgba(255,255,255,0.06)',
                              background: 'var(--cinder-base)',
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="tx-section-normal font-light truncate">
                                {p.name}
                              </span>
                              <span
                                className="tracking-wider whitespace-nowrap"
                                style={{
                                  fontSize: '9px',
                                  padding: '2px 6px',
                                  borderRadius: '2px',
                                  ...typeBadgeStyle(p.agent_type),
                                }}
                              >
                                G045
                              </span>
                              <span style={{ color: 'var(--cinder-ember-dim)', display: 'flex', alignItems: 'center' }} title="Immutable">
                                <IconLock size={10} />
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {p.description && (
                          <p className="tx-subtitle-mute italic line-clamp-2 mb-2">
                            {p.description}
                          </p>
                        )}

                        {/* Divider + Memory anchor ticker */}
                        {isSuperiorType(p.agent_type) && (
                          <>
                            <div
                              className="my-3"
                              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                            />
                            <TriggeredNote anchors={anchors || []} />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ Superior Agents ═══ */}
          {superiorPresets.length > 0 && (
            <section style={fadeUp(0.12)}>
              <NavHead label="SUPERIOR" />
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {superiorPresets.map((p, i) => {
                  const anchors = anchorMap[p.id];
                  const avatarUrl = getAgentAvatarUrl(p.id, p.name);
                  const isHovered = hoveredCard === `sup-${p.id}`;
                  const isDragging = dragging === p.id;
                  const isDragOver = dragOver === p.id;

                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(p.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => { e.preventDefault(); handleDragOver(p.id); }}
                      onDrop={() => handleDrop(p.id, superiorPresets)}
                      onClick={() => handleAgentClick(p)}
                      className="relative cursor-pointer transition-all duration-400 select-none tx-card-sm"
                      style={{
                        ...(isDragging
                          ? { opacity: 0.3 }
                          : { opacity: 1 }),
                        padding: '16px 20px',
                        background: isHovered ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${isDragOver ? 'rgba(255,74,8,0.35)' : isHovered ? 'rgba(196,77,0,0.3)' : 'rgba(166,61,0,0.12)'}`,
                        borderRadius: '6px',
                        boxShadow: isHovered ? '0 8px 32px rgba(0,0,0,0.5)' : 'none',
                        transform: isHovered ? 'translateY(-1px)' : 'none',
                        marginLeft: i % 2 === 1 ? '16px' : '0',
                      }}
                      onMouseEnter={() => setHoveredCard(`sup-${p.id}`)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      {/* Hover glow */}
                      <span
                        className="absolute inset-0 pointer-events-none transition-opacity duration-500 rounded-[6px]"
                        style={{
                          opacity: isHovered ? 1 : 0,
                          background: 'radial-gradient(ellipse at 30% 50%, rgba(196,77,0,0.06) 0%, transparent 70%)',
                        }}
                      />

                      <CornerGlyph hovered={isHovered} />

                      {/* Drag handle */}
                      <div
                        className="hidden sm:block absolute top-2 right-2 p-1 cursor-grab active:cursor-grabbing transition-opacity duration-300 z-[2] rounded"
                        style={{ opacity: isHovered ? 0.4 : 0, color: 'var(--cinder-text-faint)' }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--cinder-flame)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = String(isHovered ? 0.4 : 0); e.currentTarget.style.color = 'var(--cinder-text-faint)'; }}
                      >
                        <IconDrag size={13} />
                      </div>

                      <div className="relative z-[1]">
                        {/* Avatar + Name + Badge */}
                        <div className="flex items-center gap-2.5 mb-2 pr-5 sm:pr-0">
                          <img
                            src={avatarUrl}
                            alt={p.name}
                            className="w-9 h-9 shrink-0 object-cover"
                            style={{
                              borderRadius: '2px',
                              border: '1px solid rgba(255,255,255,0.06)',
                              background: 'var(--cinder-base)',
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="tx-section-normal font-light truncate">
                                {p.name}
                              </span>
                              <span
                                className="tracking-wider whitespace-nowrap"
                                style={{
                                  fontSize: '8px',
                                  padding: '1px 5px',
                                  borderRadius: '2px',
                                  ...typeBadgeStyle(p.agent_type),
                                }}
                              >
                                superior
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {p.description && (
                          <p className="tx-subtitle-mute italic line-clamp-2 mb-2">
                            {p.description}
                          </p>
                        )}

                        {/* Memory anchor ticker */}
                        <div
                          className="mt-2"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
                        >
                          <TriggeredNote anchors={anchors || []} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ Standard Agents ═══ */}
          {standardPresets.length > 0 && (
            <section style={fadeUp(0.18)}>
              <NavHead label="STANDARD" />
              <div className="mt-3 flex flex-wrap gap-2">
                {standardPresets.map((p) => {
                  const avatarUrl = getAgentAvatarUrl(p.id, p.name);
                  const isHovered = hoveredCard === `std-${p.id}`;
                  const isDragging = dragging === p.id;
                  const isDragOver = dragOver === p.id;

                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(p.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => { e.preventDefault(); handleDragOver(p.id); }}
                      onDrop={() => handleDrop(p.id, standardPresets)}
                      onClick={() => handleAgentClick(p)}
                      className="flex items-center gap-2 cursor-pointer transition-all duration-300 select-none shrink-0"
                      style={{
                        ...(isDragging ? { opacity: 0.3 } : { opacity: 1 }),
                        padding: '8px 14px',
                        background: isHovered ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${isDragOver ? 'rgba(255,74,8,0.35)' : isHovered ? 'rgba(196,77,0,0.25)' : 'rgba(166,61,0,0.08)'}`,
                        borderRadius: '4px',
                        boxShadow: isHovered ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
                        transform: isHovered ? 'translateY(-1px)' : 'none',
                      }}
                      onMouseEnter={() => setHoveredCard(`std-${p.id}`)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <img
                        src={avatarUrl}
                        alt={p.name}
                        className="w-6 h-6 shrink-0 object-cover"
                        style={{
                          borderRadius: '2px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'var(--cinder-base)',
                        }}
                      />
                      <span className="tx-body-normal font-light truncate">
                        {p.name}
                      </span>
                      <span
                        className="tracking-wider whitespace-nowrap"
                        style={{
                          fontSize: '7px',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          ...typeBadgeStyle(p.agent_type),
                        }}
                      >
                        std
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ Empty state ═══ */}
          {presets.length === 0 && (
            <section style={fadeUp(0.1)} className="text-center py-20">
              <p className="tx-body-mute font-light">
                No agents configured
              </p>
              <p className="tx-body-mute opacity-50 font-light mt-2">
                Run init_g045 to create the prime agent
              </p>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
