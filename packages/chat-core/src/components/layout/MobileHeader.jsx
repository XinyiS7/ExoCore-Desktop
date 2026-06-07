import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LABEL_MAP = {
  '/': 'Dashboard',
  '/agent-hub': 'Agent Hub',
  '/projects': 'Projects',
  '/settings': 'Settings',
  '/user': 'User Profile',
  '/groupchat': 'Groupchats',
};

/** Derive a human-readable back label from the previous route */
function getBackLabel(location) {
  const state = location.state || {};
  if (state.from === 'agent' && state.agentName) return state.agentName;
  if (state.from === 'project' && state.projectName) return state.projectName;
  if (state.from === 'projects') return 'Project Hub';
  // Fallback: use path-based labels
  const path = location.pathname;
  if (path.startsWith('/agent/')) return 'Agent';
  if (path.startsWith('/project/')) return 'Project';
  if (path.startsWith('/groupchat/')) return 'Groupchat';
  if (path.startsWith('/chat/')) return 'Sessions';
  for (const [route, label] of Object.entries(LABEL_MAP)) {
    if (path === route) return label;
  }
  return 'Back';
}

export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on dashboard (home page) and top-level routes
  const isHome = location.pathname === '/';
  if (isHome) return null;

  const backLabel = getBackLabel(location);

  return (
    <div className="md:hidden flex-shrink-0 h-10 bg-chat-panel border-b border-white/5 flex items-center px-3 gap-2">
      <button
        onClick={() => navigate(-1)}
        className="p-1 text-chat-muted hover:text-chat-accent active:scale-90 transition-all"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
      </button>
      <span className="text-xs font-medium text-chat-text truncate">{backLabel}</span>
    </div>
  );
}
