import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, BrainCircuit, FolderKanban, Users } from 'lucide-react';
import { usePresets } from '../../hooks/usePresets';
import { getUserAvatar } from 'exo-shared/profile';

const BOTTOM_ITEMS = [
 { route: '/',   icon: Home,   label: 'Home' },
 { route: '/projects', icon: FolderKanban, label: 'Projects' },
 { route: '/agent-hub', icon: BrainCircuit, label: 'Agents' },
 { route: '/groupchat', icon: Users,   label: 'Group' },
 { route: '/settings', icon: Settings,  label: 'Settings' },
];

export default function MobileBottomBar() {
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
 if (route === '/') return location.pathname === '/';
 if (route === '/projects') return location.pathname.startsWith('/project') || location.pathname === '/projects';
 if (route === '/agent-hub') return location.pathname.startsWith('/agent');
 if (route === '/groupchat') return location.pathname.startsWith('/groupchat');
 if (route === '/settings') return location.pathname.startsWith('/settings');
 return false;
 };

 return (
 <div className="md:hidden flex-shrink-0 h-12 bg-chat-panel border-t border-white/5 flex items-center justify-around px-2">
  {BOTTOM_ITEMS.map(({ route, icon: Icon, label }) => {
  const active = isActive(route);
  return (
   <button
   key={route}
   onClick={() => navigate(route)}
   className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 transition-all duration-150 active:scale-95 ${
    active ? 'text-chat-accent' : 'text-chat-muted opacity-60 hover:opacity-100'
   }`}
   >
   <Icon size={17} strokeWidth={1.5} />
   <span className="text-[8px] font-medium tracking-wider">{label}</span>
   </button>
  );
  })}
  {/* User avatar */}
  <button
  onClick={() => navigate('/user')}
  className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 transition-all duration-150 active:scale-95 ${
   location.pathname === '/user' ? 'text-chat-accent' : 'text-chat-muted opacity-60 hover:opacity-100'
  }`}
  >
  <img
   src={userAvatarUrl}
   className="w-[17px] h-[17px] rounded-sm border border-white/10 object-cover"
   alt="User"
  />
  <span className="text-[8px] font-medium tracking-wider">You</span>
  </button>
 </div>
 );
}
