import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePresets } from '../../hooks/usePresets';
import { getUserAvatar } from 'exo-shared/profile';

/* ── Sidebar SVG icons ── */

const LogoSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8">
    <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" />
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
          className="flex items-center justify-center w-[22px] h-[22px] mb-[18px] cursor-pointer"
          style={{ color: 'var(--cinder-ember-dim)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--cinder-flame)'}
          onMouseLeave={e => e.currentTarget.style.color = ''}
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
                transition-all duration-300
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
                textShadow: active
                  ? '0 0 10px rgba(255,74,8,0.4)'
                  : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.color = 'var(--cinder-flame)';
                  e.currentTarget.style.textShadow = '0 0 8px rgba(255,74,8,0.3)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.color = '';
                  e.currentTarget.style.textShadow = '';
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
            transition-all duration-300
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
            e.currentTarget.style.textShadow = '0 0 8px rgba(255,74,8,0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '';
            e.currentTarget.style.textShadow = '';
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
          className="cursor-pointer transition-all duration-300"
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
              e.currentTarget.style.boxShadow = '0 0 8px rgba(255,74,8,0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '';
              e.currentTarget.style.boxShadow = '';
            }}
          />
        </button>
      </div>
    </nav>
  );
}
