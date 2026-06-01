import React, { useState, useEffect } from 'react';
import {
  MessageSquare, BrainCircuit, ScrollText, Settings, Hexagon,
  PanelLeftOpen, PanelLeftClose, List,
  LayoutGrid, Calendar
} from 'lucide-react';
import { getUserAvatarUrl } from '../../utils/avatar';

const NavIcon = ({ icon: Icon, isActive, onClick, title, label, isExpanded, showLabel = true }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full p-2.5 transition-all group/nav relative ${
      isActive
        ? 'text-exo-accent'
        : 'text-exo-muted hover:text-exo-text'
    }`}
  >
    <div className={`p-2 rounded-xl transition-all shrink-0 ${
      isActive 
        ? 'bg-exo-accent/10 shadow-[0_0_15px_rgba(255,215,0,0.1)]' 
        : 'group-hover/nav:bg-white/5'
    }`}>
      <Icon size={20} className={isActive ? 'drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]' : ''} />
    </div>
    
    {showLabel && (
      <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden hidden md:block ${
        isExpanded ? 'opacity-100 w-32' : 'opacity-0 w-0'
      }`}>
        {label}
      </span>
    )}

    {/* Tooltip for collapsed state */}
    {!isExpanded && (
      <div className="absolute left-14 px-2 py-1 bg-exo-panel border border-exo-border rounded text-[10px] text-exo-accent opacity-0 group-hover/nav:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] tracking-widest uppercase hidden md:block">
        {title}
      </div>
    )}

    {isActive && (
      <div className="absolute right-0 w-0.5 h-6 bg-exo-accent rounded-l-full shadow-[0_0_10px_rgba(255,215,0,0.8)] md:block hidden" />
    )}
  </button>
);

const Sidebar = ({ currentTab, setCurrentTab, showConvList, setShowConvList, isExpanded, setIsExpanded, onOpenProfile }) => {
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => getUserAvatarUrl());
  const [userNick, setUserNick] = useState(() => localStorage.getItem('exo_user_nick') || 'Exo User');

  useEffect(() => {
    const handleNick = () => setUserNick(localStorage.getItem('exo_user_nick') || 'Exo User');
    const handleAvatar = () => setUserAvatarUrl(getUserAvatarUrl());
    window.addEventListener('storage', handleNick);
    window.addEventListener('user-nick-updated', handleNick);
    window.addEventListener('user-avatar-updated', handleAvatar);
    return () => {
      window.removeEventListener('storage', handleNick);
      window.removeEventListener('user-nick-updated', handleNick);
      window.removeEventListener('user-avatar-updated', handleAvatar);
    };
  }, []);

  return (
    <>
    <div 
      className={`
        h-full flex flex-col items-center justify-between z-[100] transition-all duration-500 ease-out
        ${isExpanded ? 'w-56' : 'w-16'}
        bg-exo-pure border-r border-exo-mist-8
        py-6 flex-shrink-0
        relative group
      `}
    >
      {/* Decorative Top Accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-exo-accent/20 to-transparent" />

      <div className="flex flex-col items-center w-full space-y-4">
        {/* Logo Section */}
        <div className="flex items-center w-full px-2">
          <button
            onClick={() => { setCurrentTab('home'); }}
            className={`flex items-center gap-3 p-2 group/logo transition-all flex-1 min-w-0`}
          >
            <div className={`p-2 rounded-[4px] border transition-all shrink-0 ${
              currentTab === 'home' 
                ? 'border-exo-accent/40 bg-exo-accent/5 text-exo-accent shadow-glow-gold' 
                : 'border-exo-mist-10 text-exo-muted group-hover/logo:border-exo-accent/30 group-hover/logo:text-exo-accent/70'
            }`}>
              <Hexagon size={20} className={currentTab === 'home' ? 'animate-pulse-glow drop-shadow-[0_0_2px_#fff]' : ''} />
            </div>
            <span className={`text-[10px] font-bold tracking-[0.3em] text-exo-accent uppercase transition-all duration-300 overflow-hidden ${
              isExpanded ? 'opacity-100 w-32' : 'opacity-0 w-0'
            }`}>
              ExoCore
            </span>
          </button>
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-exo-muted hover:text-exo-accent transition-colors self-center mb-2"
        >
          {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        <div className="w-full h-px bg-exo-mist-6 mx-2" />

        <div className="flex flex-col items-center w-full gap-1">
          <NavIcon icon={LayoutGrid} title="概览" label="控制中心" isActive={currentTab === 'home'} isExpanded={isExpanded} onClick={() => setCurrentTab('home')} />
          <NavIcon icon={MessageSquare} title="会话" label="即时会话" isActive={currentTab === 'chat'} isExpanded={isExpanded} onClick={() => { setCurrentTab('chat'); setShowConvList(true); }} />
          <NavIcon icon={BrainCircuit} title="Agent" label="代理中心" isActive={currentTab === 'agent_hub'} isExpanded={isExpanded} onClick={() => { setCurrentTab('agent_hub'); }} />
          <NavIcon icon={ScrollText} title="时间线" label="时间线" isActive={currentTab === 'timeline'} isExpanded={isExpanded} onClick={() => { setCurrentTab('timeline'); }} />
          <NavIcon icon={Calendar} title="日历" label="日历" isActive={currentTab === 'calendar'} isExpanded={isExpanded} onClick={() => setCurrentTab('calendar')} />
          
          {/* List Toggle for Chat/Council Mode */}
          {(['chat', 'council', 'project'].includes(currentTab)) && (
            <button
              onClick={() => setShowConvList(!showConvList)}
              className={`flex items-center gap-3 w-full p-2.5 transition-all group/list relative ${
                showConvList ? 'text-exo-accent' : 'text-exo-muted hover:text-exo-text'
              }`}
            >
              <div className={`p-2 rounded-[4px] transition-all shrink-0 ${
                showConvList ? 'bg-exo-accent/10' : 'group-hover/list:bg-white/5'
              }`}>
                <List size={20} />
              </div>
              <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden hidden md:block ${
                isExpanded ? 'opacity-100 w-32' : 'opacity-0 w-0'
              }`}>
                {showConvList ? '隐藏列表' : '显示列表'}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 w-full">
        <NavIcon icon={Settings} title="设置" label="系统配置" isActive={currentTab === 'settings'} isExpanded={isExpanded} onClick={() => setCurrentTab('settings')} />

        {/* User Profile Section */}
        <div className="w-full h-px bg-exo-mist-6 my-2" />
        
        <div
          className="relative cursor-pointer group/avatar flex items-center gap-3 w-full p-1 rounded-[4px] transition-all hover:bg-white/5 px-3"
          onClick={onOpenProfile}
        >
          <div className="relative shrink-0">
            <img
              src={userAvatarUrl}
              className="w-10 h-10 rounded-[4px] border border-exo-mist-10 object-cover bg-exo-pure group-hover/avatar:border-exo-accent/30 transition-all"
              alt="User"
            />
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${
            isExpanded ? 'opacity-100 w-32' : 'opacity-0 w-0'
          }`}>
            <p className="text-xs font-bold text-exo-accent/80 truncate">{userNick}</p>
            <p className="text-[10px] text-exo-muted truncate tracking-tighter opacity-70">EXO-CORE AUTH</p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
