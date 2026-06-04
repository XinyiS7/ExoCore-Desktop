import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Hexagon, BrainCircuit, FolderKanban, Database,
  Settings
} from 'lucide-react';
import { getUserAvatarUrl } from '../../utils/avatar';

const NavIcon = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-3 py-2.5 transition-all group/nav relative ${
      isActive ? 'text-chat-accent' : 'text-chat-muted hover:text-chat-text'
    }`}
  >
    <div className={`p-1.5 rounded-md transition-all shrink-0 ${
      isActive ? 'bg-chat-accent/10' : 'group-hover/nav:bg-white/5'
    }`}>
      <Icon size={18} strokeWidth={1.5} />
    </div>
    {isActive && (
      <div className="absolute right-0 w-0.5 h-5 bg-chat-accent rounded-l-full" />
    )}
    {/* Hover tooltip */}
    <div className="absolute left-14 px-2 py-1 bg-chat-panel border border-white/10 rounded text-[10px] text-chat-accent opacity-0 group-hover/nav:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
      {label}
    </div>
  </button>
);

const NAV_ITEMS = [
  { route: '/projects',  icon: FolderKanban, label: 'Projects' },
  { route: '/agent-hub', icon: BrainCircuit,  label: 'Agents' },
  { route: '/memory',    icon: Database,      label: 'Memory' },
];

export default function DesktopSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userAvatarUrl = getUserAvatarUrl();
  const userNick = localStorage.getItem('exo_user_nick') || 'Exo User';

  const isActive = (route) => {
    if (route === '/projects') return location.pathname.startsWith('/project');
    if (route === '/agent-hub') return location.pathname.startsWith('/agent');
    if (route === '/memory') return location.pathname.startsWith('/memory');
    return false;
  };

  return (
    <div className="hidden md:flex h-full flex-col items-center justify-between z-[100] bg-chat-panel border-r border-white/5 py-6 flex-shrink-0 w-16">
      {/* Top section: Logo + Nav */}
      <div className="flex flex-col items-center w-full space-y-4">
        {/* Logo — returns to dashboard */}
        <button
          onClick={() => navigate('/')}
          className={`flex items-center gap-3 px-3 py-2 w-full group/logo ${
            location.pathname === '/' ? 'text-chat-accent' : 'text-chat-muted hover:text-chat-accent/70'
          }`}
        >
          <div className={`p-1.5 rounded-md border transition-all shrink-0 ${
            location.pathname === '/'
              ? 'border-chat-accent/40 bg-chat-accent/5'
              : 'border-white/5 group-hover/logo:border-chat-accent/30'
          }`}>
            <Hexagon size={18} strokeWidth={1.5} />
          </div>
        </button>

        <div className="w-8 h-px bg-white/5" />

        {/* Nav items */}
        <div className="flex flex-col items-center w-full gap-0.5">
          {NAV_ITEMS.map(({ route, icon, label }) => (
            <NavIcon
              key={route}
              icon={icon}
              label={label}
              isActive={isActive(route)}
              onClick={() => navigate(route)}
            />
          ))}
        </div>
      </div>

      {/* Bottom: Settings + User */}
      <div className="flex flex-col items-center gap-3 w-full">
        <NavIcon
          icon={Settings}
          label="Settings"
          isActive={location.pathname === '/settings'}
          onClick={() => navigate('/settings')}
        />

        {/* User avatar */}
        <button
          onClick={() => navigate('/user')}
          className="flex items-center gap-3 w-full px-3 py-1 hover:bg-white/5 transition-all"
          title={userNick}
        >
          <img
            src={userAvatarUrl}
            className="w-8 h-8 rounded-md border border-white/10 object-cover bg-chat-panel hover:border-chat-accent/30 transition-all"
            alt="User"
          />
        </button>
      </div>
    </div>
  );
}
