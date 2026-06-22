import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversationsApi, getConvProjectId, projectsApi } from 'exo-shared';
import BackToUpper from '../components/layout/BackButton';

/* ── Corner glyph — 刻蚀在晶体边缘的能量槽 ── */
const CornerGlyph = ({ hovered }) => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none z-[1] transition-all duration-500"
    viewBox="0 0 280 20"
    preserveAspectRatio="none"
    fill="none"
    stroke="currentColor"
    style={{
      opacity: hovered ? 0.75 : 0.08, /* 显著增强 hover 时的能量线亮度 */
      color: hovered ? 'var(--tx-warm-gold)' : 'var(--tx-neutral-40)',
      filter: hovered ? 'drop-shadow(0 0 4px rgba(248,191,116,0.6))' : 'none',
    }}
  >
    <line x1="4" y1="14" x2="90" y2="14" strokeWidth="0.06" />
    <line x1="0" y1="16" x2="196" y2="16" strokeWidth="0.10" />
    <line x1="8" y1="17" x2="75" y2="17" strokeWidth="0.04" />
    <line x1="3" y1="0" x2="3" y2="14" strokeWidth="0.07" />
    <line x1="6" y1="5" x2="6" y2="20" strokeWidth="0.07" />
  </svg>
);

/* ── 三线菜单 ── */
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
const SectionHead = ({ label, className = "tx-section-normal" }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-[18px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
    <span className={className}>
      {label}
    </span>
  </div>
);

export default function ProjectList({ appState, setView, goBack }) {
  const navigate = useNavigate();
  const { projects, openCreateProject, setActiveSessionId, openDestructor, setProjects } = appState;
  const [conversations, setConversations] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [menuProjectId, setMenuProjectId] = useState(null);
  const menuRef = useRef(null);

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

  useEffect(() => {
    conversationsApi.listConversations()
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => setConversations([]));
  }, [appState.refreshKey]);

  const projectSessionCount = (projId) =>
    conversations.filter(c => getConvProjectId(c) === Number(projId)).length;

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const lastA = conversations.find(c => getConvProjectId(c) === Number(a.id))?.last_message_at || 0;
      const lastB = conversations.find(c => getConvProjectId(c) === Number(b.id))?.last_message_at || 0;
      return new Date(lastB) - new Date(lastA);
    });
  }, [projects, conversations]);

  const unassignedSessions = useMemo(() => {
    return conversations
      .filter(c => getConvProjectId(c) === null)
      .sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
  }, [conversations]);

  const getAgentName = (conv) => {
    const preset = appState.presets?.find(p => p.id === conv.agent_preset_id);
    return preset ? preset.name : conv.agent_type || 'Agent';
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hrs < 1) return '刚刚';
    if (hrs < 24) return `${hrs}h`;
    return `${days}d`;
  };

  const handleProjectClick = (proj) => {
    navigate(`/project/${proj.id}`);
  };

  const handleSessionClick = (convo) => {
    setActiveSessionId(convo.id);
    setView('chat', { from: 'projects', sessionId: convo.id, sessionTitle: convo.name });
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>
      <div
        className="hidden md:flex items-center flex-shrink-0 px-6 md:px-10 py-3"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label="Home" onClick={() => goBack()} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 md:px-10 py-[32px] pb-[100px] md:pb-[120px] flex flex-col gap-12">

          {/* ═══ Header ═══ */}
          <section style={fadeUp(0)}>
            <div className="flex items-start justify-between">
              <div>
                <SectionHead label="Project Hall" className="tx-section-normal" />
                <p className="tx-decoration-mute mt-1.5 ml-[28px]">
                  Synchronizing artifacts...
                </p>
              </div>
              <button
                onClick={() => openCreateProject()}
                className="flex items-center justify-center cursor-pointer transition-colors duration-400"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  color: 'var(--tx-neutral-40)',
                  opacity: 0.6,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = 'var(--tx-warm-flame)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.color = 'var(--tx-neutral-40)';
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

          {/* ═══ Project Cards 流 ═══ */}
          {sortedProjects.length > 0 && (
            <section className="flex flex-col gap-3 items-center w-full">
              {sortedProjects.map((proj, i) => {
                const count = projectSessionCount(proj.id);
                // 高级微错落逻辑：不再左右对撞，而是维持中央流，奇数往左微调 12px，偶数往右微调 12px
                const offsetStyle = i % 2 === 0
                  ? { transform: 'translateX(12px)' }
                  : { transform: 'translateX(-12px)' };

                return (
                  <div
                    key={proj.id}
                    onClick={() => handleProjectClick(proj)}
                    className="flex items-center justify-between cursor-pointer relative overflow-hidden transition-all duration-300 group"
                    style={{
                      ...fadeUp(0.05 * i),
                      padding: '16px 20px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(166,61,0,0.12)',
                      borderRadius: '4px',
                      maxWidth: '560px',
                      width: '100%',
                      ...offsetStyle
                    }}
                    onMouseEnter={e => {
                      setHoveredCard(proj.id);
                      e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                      e.currentTarget.style.borderColor = 'rgba(248,191,116,0.25)'; /* 边界燃动 */
                      // hover 叠加轻微抬升与原本的交错偏置
                      e.currentTarget.style.transform = `${i % 2 === 0 ? 'translateX(12px)' : 'translateX(-12px)'} translateY(-1px)`;
                    }}
                    onMouseLeave={e => {
                      setHoveredCard(null);
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      e.currentTarget.style.borderColor = 'rgba(166,61,0,0.12)';
                      e.currentTarget.style.transform = i % 2 === 0 ? 'translateX(12px)' : 'translateX(-12px)';
                    }}
                  >
                    {/* Hover 核心弥散发光层 */}
                    <span
                      className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                      style={{
                        opacity: hoveredCard === proj.id ? 1 : 0,
                        background: 'radial-gradient(ellipse at 10% 50%, rgba(196,77,0,0.12) 0%, transparent 80%)',
                      }}
                    />

                    <CornerGlyph hovered={hoveredCard === proj.id} />

                    {/* 项目名 -> tx-system-accent (高对比琥珀金) */}
                    <span className="relative z-[1] tx-system-accent truncate max-w-[65%]">
                      {proj.name}
                    </span>

                    {/* 辅助元数据与操作组 -> 优雅推至右侧对齐 */}
                    <div className="flex items-center gap-4 relative z-[1] ml-auto">
                      {/* Threads 统计数 -> 降级为更细致、神秘的机器刻度 tx-decoration-mute */}
                      <span className="tx-decoration-mute whitespace-nowrap">
                        {count} THREADS
                      </span>

                      {/* 独立菜单操作 */}
                      <div onClick={e => e.stopPropagation()} className="flex items-center">
                        <button
                          onClick={() => setMenuProjectId(menuProjectId === proj.id ? null : proj.id)}
                          className="p-1 transition-colors opacity-40 group-hover:opacity-80"
                          title="Project actions"
                          style={{ color: 'var(--tx-neutral-20)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--tx-warm-gold)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx-neutral-20)'; }}
                        >
                          <IconMenu size={13} />
                        </button>

                        {menuProjectId === proj.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-4 top-full mt-1 w-32 bg-cinder-glass-heavy backdrop-blur-xl border border-white/[0.06] rounded-[2px] shadow-2xl py-1 z-50"
                          >
                            <button
                              onClick={() => handleDeleteProject(proj)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.6875rem] text-red-400 font-mono tracking-wider hover:bg-red-500/10 transition-colors text-left"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                              DELETE
                            </button>
                          </div>
                        )}
                      </div>
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
                className="mt-4 tx-body-mute cursor-pointer hover:text-[var(--tx-warm-gold)] transition-colors duration-300"
                style={{ background: 'none', border: 'none', padding: '8px 0' }}
              >
                + 创建第一个项目
              </button>
            </section>
          )}

          {/* ═══ 流浪会话段落 (Unassigned) ═══ */}
          {unassignedSessions.length > 0 && (
            <section style={fadeUp(0.2)}>
              <div className="relative mb-5">
                <div
                  className="h-px w-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.04) 80%, transparent)',
                  }}
                />
                <span className="absolute left-0 bg-cinder-base pr-2 tx-decoration-mute">
                  UNASSIGNED
                </span>
              </div>

              <div className="flex flex-col">
                {unassignedSessions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => handleSessionClick(s)}
                    className="flex items-center gap-3 py-2.5 w-full text-left font-[inherit] transition-all duration-300"
                    style={{
                      ...fadeUp(0.25 + 0.04 * i),
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid transparent',
                      borderImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.03) 80%, transparent) 1',
                      borderImageSlice: 1,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,74,8,0.3) 20%, rgba(255,74,8,0.3) 80%, transparent) 1';
                      e.currentTarget.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.005) 50%, transparent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.03) 80%, transparent) 1';
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ background: 'var(--tx-warm-ember)' }}
                    />
                    <span className="flex-1 tx-system-normal truncate">
                      {s.name || `Session #${s.id}`}
                    </span>
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