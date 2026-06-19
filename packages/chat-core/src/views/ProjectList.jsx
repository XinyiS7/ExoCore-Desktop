import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversationsApi, getConvProjectId, projectsApi } from 'exo-shared';
import BackToUpper from '../components/layout/BackButton';

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
    {/* Top: shortest, offset from left */}
    {/* Top: shortest, offset from left */}
    <line x1="4" y1="14" x2="90" y2="14" strokeWidth="0.06" />
    {/* Middle: ~70% card width, flush left, most prominent */}
    <line x1="0" y1="16" x2="196" y2="16" strokeWidth="0.10" />
    {/* Bottom: thinnest, offset from left, stops before right vertical */}
    <line x1="8" y1="17" x2="75" y2="17" strokeWidth="0.04" />
    {/* Left vertical: tall, near top. Bottom stops above middle horizontal */}
    <line x1="3" y1="0" x2="3" y2="14" strokeWidth="0.07" />
    {/* Right vertical: ~40% card height, crosses top+middle, goes to bottom */}
    <line x1="6" y1="5" x2="6" y2="20" strokeWidth="0.07" />
  </svg>
);

/* ── Three-line menu icon ── */
const IconMenu = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round">
    <line x1="7" y1="10" x2="7" y2="14" />
    <line x1="12" y1="6" x2="12" y2="18" />
    <line x1="17" y1="9" x2="17" y2="15" />
  </svg>
);

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

/* ── Component ── */
export default function ProjectList({ appState, setView, goBack }) {
  const navigate = useNavigate();
  const { projects, openCreateProject, setActiveSessionId, openDestructor, setProjects } = appState;
  const [conversations, setConversations] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [menuProjectId, setMenuProjectId] = useState(null);
  const menuRef = useRef(null);

  // Close project card menu on outside click
  useEffect(() => {
    if (!menuProjectId) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuProjectId(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuProjectId]);

  const handleDeleteProject = (proj) => {
    setMenuProjectId(null);
    openDestructor?.({
      title: proj.name,
      description: 'Delete project and all its sessions. This cannot be undone.',
      onDelete: () => {
        projectsApi.deleteProject(proj.id).then(() => {
          setProjects(prev => prev.filter(p => p.id !== proj.id));
        }).catch(() => {});
      },
    });
  };

  /* ── Fetch all conversations ── */
  useEffect(() => {
    conversationsApi.listConversations()
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => setConversations([]));
  }, [appState.refreshKey]);

  /* ── Derive data ── */
  const projectSessionCount = (projId) =>
    conversations.filter(c => getConvProjectId(c) === Number(projId)).length;

  // Sort projects by most recent conversation activity
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const lastA = conversations.find(c => getConvProjectId(c) === Number(a.id))?.last_message_at || 0;
      const lastB = conversations.find(c => getConvProjectId(c) === Number(b.id))?.last_message_at || 0;
      return new Date(lastB) - new Date(lastA);
    });
  }, [projects, conversations]);

  // Unassigned (wandering) sessions
  const unassignedSessions = useMemo(() => {
    return conversations
      .filter(c => getConvProjectId(c) === null)
      .sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
  }, [conversations]);

  /* ── Agent name helper ── */
  const getAgentName = (conv) => {
    const preset = appState.presets?.find(p => p.id === conv.agent_preset_id);
    return preset ? preset.name : conv.agent_type || 'Agent';
  };

  /* ── Time ago ── */
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hrs < 1) return '刚刚';
    if (hrs < 24) return `${hrs}h`;
    return `${days}d`;
  };

  /* ── Handlers ── */
  const handleProjectClick = (proj) => {
    navigate(`/project/${proj.id}`);
  };

  const handleSessionClick = (convo) => {
    setActiveSessionId(convo.id);
    setView('chat', { from: 'projects', sessionId: convo.id, sessionTitle: convo.name });
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>
      {/* ═══ Fixed back bar — desktop only ═══ */}
      <div
        className="hidden md:flex items-center flex-shrink-0 px-6 md:px-10 py-3"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label="Home" onClick={() => goBack()} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 md:px-10 py-[32px] pb-[100px] md:pb-[120px] flex flex-col gap-16">

        {/* ═══ Header ═══ */}
        <section style={fadeUp(0)}>
          <div className="flex items-start justify-between">
            <div>
              <SectionHead label="Project Hall" />
              <p className="tx-decoration-mute mt-1.5 ml-[28px]">
                Synchronizing artifacts...
              </p>
            </div>
            {/* New project — icon-create SVG */}
            <button
              onClick={() => openCreateProject()}
              className="flex items-center justify-center cursor-pointer transition-colors duration-400"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                color: 'var(--cinder-text-dim)',
                opacity: 0.6,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.color = 'var(--cinder-flame)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.color = 'var(--cinder-text-dim)';
                e.currentTarget.style.filter = 'none';
              }}
              title="New Project"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="4" y1="19" x2="20" y2="19"/>
                <polygon points="12,5 13,11 19,12 13,13 12,19 11,13 5,12 11,11" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="1.2"/>
                <line x1="7.5" y1="16" x2="5.5" y2="14"/>
                <line x1="16.5" y1="16" x2="18.5" y2="14"/>
              </svg>
            </button>
          </div>
        </section>

        {/* ═══ Project Cards ═══ */}
        {sortedProjects.length > 0 && (
          <section className="flex flex-col gap-2.5">
            {sortedProjects.map((proj, i) => {
              const count = projectSessionCount(proj.id);
              return (
                <div
                  key={proj.id}
                  onClick={() => handleProjectClick(proj)}
                  className="flex items-center justify-between cursor-pointer relative overflow-hidden transition-colors duration-300 group"
                  style={{
                    ...fadeUp(0.05 * i),
                    padding: '18px 24px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(166,61,0,0.12)',
                    borderRadius: '6px',
                    maxWidth: '520px',
                    width: '100%',
                    ...(i % 2 === 0 ? { marginRight: 'auto', marginLeft: '0' } : { marginLeft: 'auto', marginRight: '0' }),
                  }}
                  onMouseEnter={e => {
                    setHoveredCard(proj.id);
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    setHoveredCard(null);
                    e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {/* Hover glow */}
                  <span
                    className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                    style={{
                      opacity: hoveredCard === proj.id ? 1 : 0,
                      background: 'radial-gradient(ellipse at 30% 50%, rgba(196,77,0,0.08) 0%, transparent 70%)',
                    }}
                  />

                  {/* Corner glyph */}
                  <CornerGlyph hovered={hoveredCard === proj.id} />

                  {/* Project name */}
                  <span className="relative z-[1] tx-system-normal font-light">
                    {proj.name}
                  </span>

                  {/* Meta: thread count + arrow */}
                  <span className="flex items-center gap-2 relative z-[1]">
                    <span className="tx-subtitle-accent font-light">
                      {count} Threads
                    </span>
                    <span className="tx-decoration-mute">
                      →
                    </span>
                  </span>

                  {/* Three-line menu */}
                  <div className="relative z-[2]" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuProjectId(menuProjectId === proj.id ? null : proj.id)}
                      className="p-1.5 rounded transition-colors"
                      title="Project actions"
                      style={{ color: 'var(--cinder-text-dim)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--cinder-text-dim)'; e.currentTarget.style.background = 'none'; e.currentTarget.style.opacity = '0.5'; }}
                    >
                      <IconMenu size={14} />
                    </button>

                    {menuProjectId === proj.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-36 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.06] rounded-[2px] shadow-lg py-1 z-50"
                      >
                        <button
                          onClick={() => handleDeleteProject(proj)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[0.6875rem] text-red-500 font-mono tracking-wider hover:bg-red-500/10 transition-colors text-left"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ═══ Empty state ═══ */}
        {sortedProjects.length === 0 && (
          <section style={fadeUp(0.08)} className="text-center py-16">
            <p className="tx-body-mute">
              尚未创建项目
            </p>
            <button
              onClick={() => openCreateProject()}
              className="mt-4 tx-body-mute cursor-pointer hover:tx-body-accent transition-colors duration-300"
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 0',
              }}
            >
              + 创建第一个项目
            </button>
          </section>
        )}

        {/* ═══ Wandering Threads ═══ */}
        {unassignedSessions.length > 0 && (
          <section style={fadeUp(0.2)}>
            {/* Hairline divider with UNASSIGNED tag */}
            <div className="relative mb-5">
              <div
                className="h-px w-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent)',
                }}
              />
              <span className="absolute left-0 bg-[#050505] pr-2 tx-decoration-mute">
                UNASSIGNED
              </span>
            </div>

            {/* Session rows */}
            <div className="flex flex-col">
              {unassignedSessions.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => handleSessionClick(s)}
                  className="flex items-center gap-3 py-2.5 w-full text-left font-[inherit] transition-colors duration-300"
                  style={{
                    ...fadeUp(0.25 + 0.04 * i),
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid transparent',
                    borderImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.04) 80%, transparent) 1',
                    borderImageSlice: 1,
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,74,8,0.35) 20%, rgba(255,74,8,0.35) 80%, transparent) 1';
                    e.currentTarget.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.008) 50%, transparent)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.04) 80%, transparent) 1';
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  {/* Dot */}
                  <span
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{ background: 'var(--cinder-ember-dim)' }}
                  />
                  {/* Name */}
                  <span className="flex-1 tx-system-normal font-light truncate">
                    {s.name || `Session #${s.id}`}
                  </span>
                  {/* Meta */}
                  <span className="shrink-0 tx-decoration-mute">
                    {getAgentName(s)} · {timeAgo(s.last_message_at || s.created_at)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
    </div>
  );
}
