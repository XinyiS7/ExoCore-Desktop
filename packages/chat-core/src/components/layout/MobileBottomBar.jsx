import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/* ── Geometric SVG Icons ── */

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.6">
    <path d="M6 22V8a6 6 0 0112 0v14" />
    <path d="M9 22v-8a3 3 0 016 0v8" />
    <line x1="2" y1="22" x2="22" y2="22" />
  </svg>
);

const IconProjects = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.6">
    <circle cx="12" cy="12" r="10" strokeDasharray="2 4" />
    <circle cx="12" cy="12" r="6" />
    <polygon points="12,4 19,16 5,16" />
  </svg>
);

const IconAgents = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.6">
    <path d="M12 2 L20 12 L12 22 L4 12 Z" />
    <path d="M12 6 L16 12 L12 18 L8 12 Z" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IconGroupchat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.6">
    <circle cx="12" cy="12" r="9" strokeDasharray="4 6" />
    <circle cx="12" cy="6" r="2" />
    <circle cx="17.196" cy="15" r="2" />
    <circle cx="6.804" cy="15" r="2" />
    <path d="M12 8 L16.33 13.5 L7.67 13.5 Z" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.6">
    <circle cx="12" cy="12" r="8" strokeDasharray="1 3" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
  </svg>
);

/* ── Nav items ── */
const ITEMS = [
  { route: '/',            Icon: IconHome,      label: '首页' },
  { route: '/projects',    Icon: IconProjects,  label: '项目' },
  { route: '/agent-hub',   Icon: IconAgents,    label: '代理' },
  { route: '/groupchat',   Icon: IconGroupchat, label: '群组' },
  { route: '/settings',    Icon: IconSettings,  label: '设置' },
];

export default function MobileBottomBar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on chat / groupchat routes — maximize mobile viewport for message interfaces
  if (location.pathname.startsWith('/chat/') || location.pathname.startsWith('/groupchat')) return null;

  const isActive = (route) => {
    if (route === '/') return location.pathname === '/';
    if (route === '/projects') return location.pathname.startsWith('/project') || location.pathname === '/projects';
    if (route === '/agent-hub') return location.pathname.startsWith('/agent');
    if (route === '/groupchat') return location.pathname.startsWith('/groupchat');
    if (route === '/settings') return location.pathname.startsWith('/settings');
    return false;
  };

  return (
    <nav
      className="md:hidden flex items-center justify-around fixed bottom-0 left-0 right-0 z-[100]"
      style={{
        height: '60px',
        paddingBottom: 'env(safe-area-inset-bottom)',
        borderTop: '1px solid var(--cinder-line)',
        background: 'var(--cinder-glass-heavy)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {ITEMS.map(({ route, Icon }) => {
        const active = isActive(route);
        return (
          <button
            key={route}
            onClick={() => navigate(route)}
            className="flex items-center justify-center bg-transparent border-none cursor-pointer p-2 transition-all duration-300"
            style={{
              opacity: active ? 1 : 0.85,
              color: active ? 'var(--tx-warm-gold)' : 'var(--tx-warm-ember)',
              fontFamily: 'inherit',
            }}
          >
            <span
              className="block"
              style={{
                width: '22px',
                height: '22px',
                filter: active ? 'drop-shadow(0 0 8px rgba(248,191,116,0.6))' : 'none',
              }}
            >
              <Icon />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
