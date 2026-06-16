import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Key, Clock, Bell, Palette, Database, Cpu, ArrowLeft } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';

const NAV_ITEMS = [
 {
 id: 'keys',
 label: 'Key Manage',
 icon: Key,
 route: '/settings/keys',
 enabled: true,
 },
 {
 id: 'models',
 label: 'Model Assign',
 icon: Cpu,
 route: '/settings/models',
 enabled: true,
 },
 {
 id: 'notifications',
 label: 'Notifications',
 icon: Bell,
 route: '/settings/notifications',
 enabled: true,
 },
 {
 id: 'appearance',
 label: 'Appearance',
 icon: Palette,
 route: '/settings/appearance',
 enabled: true,
 },
 {
 id: 'routine',
 label: 'Routine',
 icon: Clock,
 route: '/settings/routine',
 enabled: true,
 },
 {
 id: 'memory',
 label: 'Memory',
 icon: Database,
 route: '/settings/memory',
 enabled: true,
 },
];

export default function SettingsView() {
 const navigate = useNavigate();
 const location = useLocation();
 const [navVisible, setNavVisible] = useState(true);

 const isActive = (route) => location.pathname === route;

 const handleNavClick = (route, enabled) => {
 if (!enabled) return;
 navigate(route);
 // On mobile: collapse nav after selection
 setNavVisible(false);
 };

 return (
 <div className="flex-1 h-full flex overflow-hidden">
  {/* Left nav — hidden on mobile when collapsed */}
  <nav className={`w-52 flex-shrink-0 border-r border-white/5 bg-chat-bg py-6 flex flex-col md:flex ${navVisible ? 'flex' : 'hidden'}`}>
  <div className="px-4 mb-4">
   <h1 className="text-sm font-semibold text-chat-text/90 tracking-tight">Settings</h1>
  </div>

  <div className="flex-1 space-y-0.5 px-2">
   {NAV_ITEMS.map(({ id, label, icon: Icon, route, enabled }) => (
   <button
    key={id}
    onClick={() => handleNavClick(route, enabled)}
    disabled={!enabled}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all text-left ${
    enabled && isActive(route)
     ? 'bg-chat-accent/10 text-chat-accent border-l-2 border-chat-accent'
     : enabled
     ? 'text-chat-muted hover:text-chat-text hover:bg-exo-accent/[0.04]'
     : 'text-chat-muted/25 cursor-not-allowed'
    }`}
   >
    <Icon size={16} strokeWidth={1.5} />
    <span className="font-sans text-[13px]">{label}</span>
    {!enabled && (
    <span className="text-[9px] tracking-wider text-chat-muted/20 ml-auto">
     soon
    </span>
    )}
   </button>
   ))}
  </div>
  </nav>

  {/* Right content area */}
  <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
  {/* Mobile back button — visible when nav is hidden on mobile */}
  {!navVisible && (
   <div className="md:hidden flex-shrink-0 h-10 bg-chat-panel border-b border-white/5 flex items-center px-3">
   <button
    onClick={() => setNavVisible(true)}
    className="p-1 text-chat-muted hover:text-chat-accent active:scale-90 transition-all flex items-center gap-2"
   >
    <ArrowLeft size={16} strokeWidth={1.5} />
    <span className="text-xs font-medium text-chat-text">Settings Menu</span>
   </button>
   </div>
  )}

  <div className="flex-1 min-h-0 overflow-hidden">
   <ErrorBoundary>
   <Outlet />
   </ErrorBoundary>
  </div>
  </div>
 </div>
 );
}
