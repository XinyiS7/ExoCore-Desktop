import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Key, Clock } from 'lucide-react';

const NAV_ITEMS = [
  {
    id: 'keys',
    label: 'Key Manage',
    icon: Key,
    route: '/settings/keys',
    enabled: true,
  },
  {
    id: 'routine',
    label: 'Routine Manage',
    icon: Clock,
    route: '/settings/routine',
    enabled: false,
  },
];

export default function SettingsView() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (route) => location.pathname === route;

  return (
    <div className="flex-1 h-full flex overflow-hidden">
      {/* Left nav (A-layout) */}
      <nav className="w-52 flex-shrink-0 border-r border-white/5 bg-chat-panel/50 py-6 flex flex-col">
        <div className="px-4 mb-4">
          <h1 className="text-sm font-semibold text-chat-text/90 tracking-tight">Settings</h1>
        </div>

        <div className="flex-1 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon, route, enabled }) => (
            <button
              key={id}
              onClick={() => enabled && navigate(route)}
              disabled={!enabled}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all text-left ${
                enabled && isActive(route)
                  ? 'bg-chat-accent/10 text-chat-accent border-l-2 border-chat-accent'
                  : enabled
                    ? 'text-chat-muted hover:text-chat-text hover:bg-white/5'
                    : 'text-chat-muted/25 cursor-not-allowed'
              }`}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span className="font-sans text-[13px]">{label}</span>
              {!enabled && (
                <span className="text-[9px] font-mono uppercase tracking-wider text-chat-muted/20 ml-auto">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Right content area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
