import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BackToUpper from './BackButton';

/**
 * MobileHeader — unified back-navigation shell (mobile only).
 *
 * The "picture frame" model: this shell always shows the correct
 * back button for every route. Individual views do NOT need to
 * implement their own mobile back navigation.
 *
 * Desktop: each L2 view keeps its own back bar (hidden md:flex).
 * Mobile: MobileHeader is the single source of back navigation.
 */

/** Resolve back label + target from the current route + location state. */
function resolveBack(pathname, state) {
  // ── Dashboard (L0) — no back ──
  if (pathname === '/') return null;

  // ── L1 halls → Home ──
  const L1 = ['/projects', '/agent-hub', '/groupchat', '/settings', '/user'];
  if (L1.includes(pathname)) return { label: 'Home', to: '/' };

  // ── L2: project detail → Project Hall ──
  if (/^\/project\/\d+/.test(pathname)) return { label: 'Project Hall', to: '/projects' };

  // ── L2: agent memory → Agent Profile ──
  const memMatch = pathname.match(/^\/agent\/(\d+)\/memory/);
  if (memMatch) return { label: 'Agent', to: `/agent/${memMatch[1]}` };

  // ── L2: agent profile → Agent Hub ──
  const agentMatch = pathname.match(/^\/agent\/(\d+)/);
  if (agentMatch) return { label: 'Agent Hub', to: '/agent-hub' };

  // ── Chat — dynamic back based on where user came from ──
  if (/^\/chat\/\d+/.test(pathname)) {
    if (state?.from === 'agent') {
      const to = state.agentId ? `/agent/${state.agentId}` : '/agent-hub';
      return { label: state.agentName || 'Agent', to };
    }
    if (state?.from === 'project') {
      const to = state.projectId ? `/project/${state.projectId}` : '/projects';
      return { label: state.projectName || 'Project', to };
    }
    if (state?.from === 'projects') return { label: 'Project Hall', to: '/projects' };
    return { label: 'Home', to: '/' };
  }

  // ── Groupchat detail → Groupchat List ──
  if (/^\/groupchat\/\d+/.test(pathname)) return { label: 'Groupchat', to: '/groupchat' };

  // ── Settings sub-pages → Settings ──
  if (/^\/settings\/.+/.test(pathname)) return { label: 'Settings', to: '/settings' };

  // ── Fallback ──
  return { label: 'Home', to: '/' };
}

export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const back = useMemo(
    () => resolveBack(location.pathname, location.state),
    [location.pathname, location.state],
  );

  if (!back) return null;

  return (
    <div
      className="md:hidden flex-shrink-0 flex items-center px-3"
      style={{
        height: '40px',
        borderBottom: '1px solid var(--cinder-line)',
      }}
    >
      <BackToUpper
        label={back.label}
        onClick={() => navigate(back.to, { state: {} })}
      />
    </div>
  );
}
