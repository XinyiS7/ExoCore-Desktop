import React from 'react';
import {
  MessageSquare, BrainCircuit, ScrollText, Settings, Hexagon,
  List, Calendar, X
} from 'lucide-react';
import { getUserAvatarUrl } from '../../utils/avatar';

const MobileNavIcon = ({ icon: Icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-9 h-9 flex items-center justify-center rounded-[4px] transition-all ${
      isActive
        ? 'bg-exo-accent/10 border border-exo-accent/30 text-exo-accent'
        : 'text-exo-muted hover:text-exo-text hover:bg-white/5'
    }`}
  >
    <Icon size={18} />
  </button>
);

const MobileSidebar = ({
  currentTab,
  setCurrentTab,
  showConvList,
  setShowConvList,
  isOpen,
  onClose,
  onOpenProfile,
}) => {
  if (!isOpen) return null;

  const userAvatarUrl = getUserAvatarUrl();

  const handleTabClick = (tab) => {
    setCurrentTab(tab);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="md:hidden fixed inset-0 z-[110] bg-transparent"
        onClick={onClose}
      />

      {/* Icon column */}
      <div className="md:hidden fixed inset-y-0 left-0 z-[120] w-12 bg-exo-pure border-r border-exo-mist-8 flex flex-col items-center py-3 gap-1.5">
        {/* Hexagon / Home */}
        <MobileNavIcon
          icon={Hexagon}
          isActive={currentTab === 'home'}
          onClick={() => handleTabClick('home')}
        />

        {/* Divider */}
        <div className="w-6 h-px bg-exo-mist-8 my-1" />

        {/* Chat */}
        <MobileNavIcon
          icon={MessageSquare}
          isActive={currentTab === 'chat'}
          onClick={() => handleTabClick('chat')}
        />

        {/* Agent Hub */}
        <MobileNavIcon
          icon={BrainCircuit}
          isActive={currentTab === 'agent_hub'}
          onClick={() => handleTabClick('agent_hub')}
        />

        {/* Timeline */}
        <MobileNavIcon
          icon={ScrollText}
          isActive={currentTab === 'timeline'}
          onClick={() => handleTabClick('timeline')}
        />

        {/* Calendar */}
        <MobileNavIcon
          icon={Calendar}
          isActive={currentTab === 'calendar'}
          onClick={() => handleTabClick('calendar')}
        />

        {/* List toggle (only in chat/council/project) */}
        {(['chat', 'council', 'project'].includes(currentTab)) && (
          <MobileNavIcon
            icon={List}
            isActive={showConvList}
            onClick={() => { onClose(); setShowConvList(true); }}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <MobileNavIcon
          icon={Settings}
          isActive={currentTab === 'settings'}
          onClick={() => handleTabClick('settings')}
        />

        {/* User avatar */}
        <button
          onClick={() => { onOpenProfile(); onClose(); }}
          className="w-8 h-8 rounded-[4px] border border-exo-mist-10 overflow-hidden flex-shrink-0 hover:border-exo-accent/30 transition-all"
        >
          <img
            src={userAvatarUrl}
            alt="User"
            className="w-full h-full object-cover bg-exo-pure"
          />
        </button>

        {/* Close X */}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[4px] text-exo-muted hover:text-exo-text hover:bg-white/5 transition-all border border-exo-mist-8"
        >
          <X size={14} />
        </button>
      </div>
    </>
  );
};

export default MobileSidebar;
