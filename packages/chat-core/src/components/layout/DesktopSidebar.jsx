import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePresets } from '../../hooks/usePresets';
import { getUserAvatar } from 'exo-shared/profile';

/* ── Sidebar SVG icons ── */

const LogoSvg = () => (
  <svg viewBox="0 0 64 64" fill="none">
    <defs>
      <radialGradient id="sbar-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FF2E2E" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="#B30F0F" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#050505" stop-opacity="0"/>
      </radialGradient>
    </defs>
    {/* Outer hex shell */}
    <polygon points="46.5,7 61,32 46.5,57 17.5,57 3,32 17.5,7"
             fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.7"/>
    {/* Inner nested hex */}
    <polygon points="32,14 50,25 50,39 32,50 14,39 14,25"
             fill="none" stroke="currentColor" stroke-width="0.6" stroke-opacity="0.25"/>
    {/* Core glow */}
    <circle cx="32" cy="32" r="20" fill="url(#sbar-glow)" opacity="0.6"/>
    {/* Floating EXO octagon */}
    <path d="M32 4 L42 22 L60 32 L42 42 L32 60 L22 42 L4 32 L22 22 Z"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="0.85"
          transform="translate(32 32) scale(0.6) translate(-32 -32)"/>
    {/* Inner diamond */}
    <path d="M32 16 L38 32 L32 48 L26 32 Z" fill="currentColor" opacity="0.5"
          transform="translate(32 32) scale(0.6) translate(-32 -32)"/>
    {/* Central core */}
    <circle cx="32" cy="32" r="3" fill="#050505" stroke="currentColor" stroke-width="0.7"/>
  </svg>
);

/* ── Nav items ── */
const NAV_ITEMS = [
  { route: '/projects',  label: '项目' },
  { route: '/agent-hub', label: '代理' },
  { route: '/groupchat', label: '群组' },
];

export default function DesktopSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { presets } = usePresets();
  const userPreset = useMemo(() => presets?.find(p => p.agent_type === 'user') || null, [presets]);
  const userNick = userPreset?.name || 'user';
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => getUserAvatar());

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'exo_user_avatar') {
        setUserAvatarUrl(getUserAvatar());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const isActive = (route) => {
    if (route === '/projects') return location.pathname.startsWith('/project') || location.pathname === '/projects';
    if (route === '/agent-hub') return location.pathname.startsWith('/agent');
    if (route === '/groupchat') return location.pathname.startsWith('/groupchat');
    return false;
  };

  return (
    <nav
      className="
        hidden md:flex flex-col items-center justify-between
        w-16 flex-shrink-0 z-10 relative
        glass-panel
      "
      style={{
        boxShadow: '2px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Right edge hairline */}
      <div
        className="absolute top-0 bottom-0 right-0 w-px"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.04) 80%, transparent)',
        }}
      />

      {/* Top: logo + nav */}
      <div className="flex flex-col items-center pt-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-[28px] h-[28px] mb-[18px] cursor-pointer transition-colors duration-200"
          style={{ color: 'var(--cinder-ember-dim)' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--cinder-flame)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--cinder-ember-dim)';
          }}
        >
          <LogoSvg />
        </button>

        {NAV_ITEMS.map(({ route, label }) => {
          const active = isActive(route);
          return (
            <button
              key={route}
              onClick={() => navigate(route)}
              className="
                relative bg-transparent border-none cursor-pointer font-[inherit]
                px-1 py-3
                transition-colors duration-200
              "
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: '11px',
                fontWeight: 300,
                letterSpacing: '0.3em',
                minHeight: '80px',
                color: active
                  ? 'var(--cinder-flame)'
                  : 'var(--cinder-text-faint)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.color = 'var(--cinder-flame)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.color = 'var(--cinder-text-faint)';
                }
              }}
            >
              {label}
              {/* Active indicator */}
              {active && (
                <span
                  className="absolute right-0"
                  style={{
                    top: '18%',
                    height: '64%',
                    width: '1px',
                    background: 'var(--cinder-flame)',
                    boxShadow: '0 0 6px rgba(255,74,8,0.6)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom: settings + avatar */}
      <div className="flex flex-col items-center pb-4">
        <button
          onClick={() => navigate('/settings')}
          className="
            relative bg-transparent border-none cursor-pointer font-[inherit]
            px-1 py-3
            transition-colors duration-200
          "
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: '9px',
            fontWeight: 300,
            letterSpacing: '0.3em',
            minHeight: '80px',
            color: location.pathname.startsWith('/settings')
              ? 'var(--cinder-flame)'
              : 'var(--cinder-text-faint)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--cinder-flame)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--cinder-text-faint)';
          }}
        >
          设置
        </button>

        <div
          className="w-[14px] my-2.5"
          style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }}
        />

        <button
          onClick={() => navigate('/user')}
          className="cursor-pointer transition-colors duration-200"
          title={userNick}
        >
          <img
            src={userAvatarUrl}
            className="w-7 h-7 object-cover"
            style={{
              borderRadius: '1px',
              border: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
            }}
            alt="User"
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255,74,8,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
            }}
          />
        </button>
      </div>
    </nav>
  );
}
