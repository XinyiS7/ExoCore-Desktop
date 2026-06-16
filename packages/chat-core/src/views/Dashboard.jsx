import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversationsApi } from 'exo-shared';

/* ── Tarot Glyph SVGs ── */

const GlyphProjects = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
    <circle cx="12" cy="12" r="10" strokeDasharray="2 4" />
    <circle cx="12" cy="12" r="6" />
    <polygon points="12,4 19,16 5,16" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" fillOpacity="0.3" />
  </svg>
);

const GlyphAgents = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
    <path d="M12 2 L20 12 L12 22 L4 12 Z" strokeLinejoin="round" />
    <path d="M12 6 L16 12 L12 18 L8 12 Z" strokeLinejoin="round" fill="currentColor" fillOpacity="0.05" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="1 3" />
    <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="1 3" />
  </svg>
);

const GlyphGroupchat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
    <circle cx="12" cy="12" r="9" strokeDasharray="4 6" strokeOpacity="0.5" />
    <circle cx="12" cy="6" r="2" />
    <circle cx="17.196" cy="15" r="2" />
    <circle cx="6.804" cy="15" r="2" />
    <path d="M12 8 L16.33 13.5 L7.67 13.5 Z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="0.5" fill="currentColor" />
  </svg>
);

const SearchSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

/* ── Data ── */

const QUICK_NAV = [
  { route: '/projects',    Glyph: GlyphProjects,  label: '项目大厅', sub: '管理本地遗物' },
  { route: '/agent-hub',   Glyph: GlyphAgents,    label: '代理枢纽', sub: '唤醒数字实体' },
  { route: '/groupchat',   Glyph: GlyphGroupchat, label: '群组集会', sub: '协调多方意志' },
];

/* ── Motion helpers ── */

const fadeUp = (delay) => ({
  animation: `fadeUp .6s ${delay}s cubic-bezier(.22,1,.36,1) both`,
});

/* ── Component ── */

export default function Dashboard({ appState, setView }) {
  const navigate = useNavigate();
  const { presets, refreshKey, setActiveSessionId } = appState;

  const userPreset = useMemo(() => presets?.find(p => p.agent_type === 'user') || null, [presets]);
  const userNick = userPreset?.name || 'Alicia';

  const [recentSessions, setRecentSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [allConversations, setAllConversations] = useState([]);
  const [hoveredNav, setHoveredNav] = useState(null);
  const searchRef = useRef(null);

  /* ── Fetch recent sessions ── */
  useEffect(() => {
    conversationsApi.listConversations()
      .then(data => {
        const sorted = (Array.isArray(data) ? data : []).sort(
          (a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
        );
        setRecentSessions(sorted.slice(0, 3));
      })
      .catch(() => setRecentSessions([]));
  }, [refreshKey]);

  /* ── Session click ── */
  const handleSessionClick = (convo) => {
    setActiveSessionId(convo.id);
    setView('chat', { from: 'home', sessionId: convo.id, sessionTitle: convo.name });
  };

  /* ── Agent name helper ── */
  const getAgentName = (presetId) => {
    const preset = presets?.find(p => p.id === presetId);
    return preset ? preset.name : 'Agent';
  };

  /* ── Time ago helper ── */
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hrs < 1) return '刚刚';
    if (hrs < 24) return `${hrs}h`;
    return `${days}d`;
  };

  /* ── Search ── */
  const handleSearchFocus = () => {
    setShowResults(true);
    if (allConversations.length === 0) {
      conversationsApi.listConversations()
        .then(data => setAllConversations(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  };

  const filteredConversations = searchTerm.trim()
    ? allConversations.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[780px] mx-auto px-10 md:px-10 py-[60px] pb-[100px] md:pb-[120px] flex flex-col gap-16">
        {/* ═══ Hero ═══ */}
        <section style={fadeUp(0)}>
          <div className="flex flex-col gap-6">
            {/* Status line */}
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-px" style={{ background: 'var(--cinder-ember-dim)' }} />
              <span
                className="font-light"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.35em',
                  color: 'var(--cinder-text-faint)',
                }}
              >
                ExoCore · System ready
              </span>
            </div>

            {/* Heading */}
            <h1
              className="font-light leading-tight"
              style={{
                fontSize: 'clamp(26px, 5vw, 44px)',
                letterSpacing: '0.04em',
                color: '#e8ddd0',
              }}
            >
              欢迎回来，<em
                className="not-italic font-normal"
                style={{ color: 'var(--cinder-flame)' }}
              >{userNick}</em>
            </h1>

            {/* Subtitle */}
            <p
              className="font-light max-w-[420px] leading-relaxed"
              style={{
                fontSize: '14px',
                color: 'var(--cinder-text-dim)',
                letterSpacing: '0.04em',
              }}
            >
              神经链路已建立，所有核心待命中。
            </p>

            {/* Search — full-width fading hairline */}
            <div ref={searchRef} className="relative">
              <div
                className="flex items-center gap-2.5 py-2 transition-all duration-300"
                style={{
                  borderBottom: showResults
                    ? '1px solid rgba(255,74,8,0.5)'
                    : '1px solid transparent',
                  borderImage: showResults
                    ? 'linear-gradient(90deg, transparent, rgba(255,74,8,0.5) 20%, rgba(255,74,8,0.5) 80%, transparent) 1'
                    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent) 1',
                  borderImageSlice: 1,
                }}
              >
                <span
                  className="shrink-0 transition-all duration-300 flex items-center"
                  style={{
                    width: '14px',
                    height: '14px',
                    color: showResults && searchTerm
                      ? 'var(--cinder-flame)'
                      : 'var(--cinder-text-faint)',
                    filter: showResults && searchTerm ? 'drop-shadow(0 0 4px rgba(255,74,8,0.4))' : 'none',
                  }}
                >
                  <SearchSvg />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
                  onFocus={handleSearchFocus}
                  placeholder="搜索流转的数据..."
                  className="flex-1 bg-transparent border-none outline-none font-[inherit] font-light"
                  style={{
                    fontSize: '13px',
                    letterSpacing: '0.04em',
                    color: 'var(--cinder-text)',
                  }}
                />
              </div>

              {/* Dropdown */}
              {showResults && filteredConversations.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto"
                  style={{
                    background: 'rgba(10,5,5,0.95)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    backdropFilter: 'blur(24px)',
                  }}
                >
                  {filteredConversations.map(convo => (
                    <button
                      key={convo.id}
                      onClick={() => {
                        setSearchTerm('');
                        setShowResults(false);
                        setActiveSessionId(convo.id);
                        setView('chat', { from: 'home', sessionId: convo.id, sessionTitle: convo.name });
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-exo-accent/[0.02]"
                      style={{ fontFamily: 'inherit', color: 'inherit' }}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ background: 'var(--cinder-ember-dim)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm block truncate" style={{ color: 'var(--cinder-text)' }}>
                          {convo.name || `Session #${convo.id}`}
                        </span>
                        <span className="text-[0.5625rem]" style={{ color: 'var(--cinder-text-faint)' }}>
                          {getAgentName(convo.agent_preset_id)} · {convo.agent_type}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchTerm.trim() && filteredConversations.length === 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 z-50 p-4 text-center"
                  style={{
                    background: 'rgba(10,5,5,0.95)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                  }}
                >
                  <p className="text-xs" style={{ color: 'var(--cinder-text-faint)' }}>未找到匹配的会话</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══ 活跃会话 ═══ */}
        {recentSessions.length > 0 && (
          <section style={fadeUp(0.08)}>
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <div className="w-[18px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
                <span
                  className="font-light"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.3em',
                    color: 'var(--cinder-text-dim)',
                  }}
                >
                  活跃会话
                </span>
              </div>

              <div className="flex flex-col">
                {recentSessions.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => handleSessionClick(convo)}
                    className="flex items-center gap-3.5 py-3 w-full text-left font-[inherit] transition-colors duration-300"
                    style={{
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
                      e.currentTarget.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.01) 50%, transparent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.04) 80%, transparent) 1';
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    {/* Dot indicator */}
                    <span
                      className="w-1 h-1 rounded-full shrink-0 transition-all duration-300"
                      style={{ background: 'var(--cinder-ember-dim)' }}
                    />
                    {/* Name */}
                    <span
                      className="flex-1 font-light truncate"
                      style={{
                        fontSize: '14px',
                        letterSpacing: '0.03em',
                        color: 'var(--cinder-text)',
                      }}
                    >
                      {convo.name || `Session #${convo.id}`}
                    </span>
                    {/* Meta */}
                    <span
                      className="shrink-0 font-light"
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.04em',
                        color: 'var(--cinder-text-faint)',
                      }}
                    >
                      {getAgentName(convo.agent_preset_id)} · {timeAgo(convo.last_message_at || convo.created_at)}
                    </span>
                    {/* Arrow */}
                    <span
                      className="shrink-0 transition-all duration-300"
                      style={{
                        fontSize: '13px',
                        color: 'var(--cinder-text-faint)',
                      }}
                    >
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══ 导航矩阵 ═══ */}
        <section style={fadeUp(0.14)}>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2.5">
              <div className="w-[18px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
              <span
                className="font-light"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  color: 'var(--cinder-text-dim)',
                }}
              >
                导航矩阵
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {QUICK_NAV.map(({ route, Glyph, label, sub }) => {
                const isHovered = hoveredNav === route;
                return (
                <button
                  key={route}
                  onClick={() => navigate(route)}
                  className="
                    group flex flex-col items-center gap-3.5
                    cursor-pointer px-3 py-7 md:py-7
                    font-[inherit] text-left
                    relative overflow-hidden
                    transition-all duration-500
                  "
                  style={{
                    background: isHovered ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                    border: isHovered ? '1px solid rgba(196, 77, 0, 0.25)' : '1px solid rgba(255, 255, 255, 0.02)',
                    borderRadius: '12px',
                    boxShadow: isHovered ? '0 10px 30px rgba(0, 0, 0, 0.5)' : 'none',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                  }}
                  onMouseEnter={() => setHoveredNav(route)}
                  onMouseLeave={() => setHoveredNav(null)}
                >
                  {/* Radial glow on hover */}
                  <span
                    className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                    style={{
                      opacity: isHovered ? 1 : 0,
                      background: 'radial-gradient(circle at center, rgba(196,77,0,0.1) 0%, transparent 70%)',
                    }}
                  />

                  {/* Glyph */}
                  <span
                    className="relative z-[1] flex items-center justify-center transition-all duration-500"
                    style={{
                      width: '44px',
                      height: '44px',
                      opacity: isHovered ? 0.55 : 0.25,
                      color: isHovered ? 'var(--cinder-flame)' : 'var(--cinder-text-faint)',
                      filter: isHovered ? 'drop-shadow(0 0 6px rgba(255,74,8,0.5))' : 'none',
                      transform: isHovered ? 'scale(1.05) translateY(-2px)' : 'none',
                    }}
                  >
                    <Glyph />
                  </span>

                  {/* Label */}
                  <span
                    className="relative z-[1] font-light transition-all duration-300"
                    style={{
                      fontSize: '13px',
                      letterSpacing: isHovered ? '0.1em' : '0.08em',
                      color: isHovered ? 'var(--cinder-flame-dim)' : 'var(--cinder-text-dim)',
                    }}
                  >
                    {label}
                  </span>

                  {/* Sub */}
                  <span
                    className="relative z-[1] font-light transition-all duration-300 hidden md:block"
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.05em',
                      color: isHovered ? 'var(--cinder-text-dim)' : 'var(--cinder-text-faint)',
                    }}
                  >
                    {sub}
                  </span>
                </button>
                );
              })}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
