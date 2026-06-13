import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Hexagon, BrainCircuit, FolderKanban, Users,
  Settings
} from 'lucide-react';
import { usePresets } from '../../hooks/usePresets';
import { getUserAvatar } from 'exo-shared/profile';

const NavIcon = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 w-full px-3 py-2.5"
  >
    <div className="p-1.5 shrink-0">
      <Icon size={18} strokeWidth={1.5} />
    </div>
  </button>
);

const NAV_ITEMS = [
  { route: '/projects',  icon: FolderKanban, label: 'Projects' },
  { route: '/agent-hub', icon: BrainCircuit,  label: 'Agents' },
  { route: '/groupchat', icon: Users,         label: 'Groupchat' },
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
    if (route === '/projects') return location.pathname.startsWith('/project');
    if (route === '/agent-hub') return location.pathname.startsWith('/agent');
    if (route === '/groupchat') return location.pathname.startsWith('/groupchat');
    return false;
  };

  return (
    <div className="hidden md:flex h-full flex-col items-center justify-between z-[100] flex-shrink-0 w-16">
      <div className="flex flex-col items-center w-full space-y-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-3 py-2 w-full"
        >
          <div className="p-1.5 shrink-0">
            <Hexagon size={18} strokeWidth={1.5} />
          </div>
        </button>

        <div className="w-8 h-px" />

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

      <div className="flex flex-col items-center gap-3 w-full">
        <NavIcon
          icon={Settings}
          label="Settings"
          isActive={location.pathname === '/settings'}
          onClick={() => navigate('/settings')}
        />

        <button
          onClick={() => navigate('/user')}
          className="flex items-center gap-3 w-full px-3 py-1"
          title={userNick}
        >
          <img
            src={userAvatarUrl}
            className="w-8 h-8 object-cover"
            alt="User"
          />
        </button>
      </div>
    </div>
  );
}
