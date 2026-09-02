import React, { useState, useRef, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotificationContext } from '../../contexts/NotificationContext';
import NotificationCard from './NotificationCard';

export default function NotificationPanel() {
  const { notifications } = useNotificationContext();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (notifications.length === 0) return null;

  return (
    <>
      {/* Collapsed badge */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[9999] flex items-center gap-1.5 px-3 py-2
                   bg-neutral-950/90 backdrop-blur-xl border border-white/10
                   rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                   hover:border-white/20 transition-all duration-200"
        aria-label={`${notifications.length} 条通知`}
      >
        <Bell size={16} className="text-orange-400" />
        <span className="text-xs font-mono text-neutral-200 min-w-[1.25rem] text-center">
          {notifications.length}
        </span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-32 md:bottom-20 right-4 md:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-80 max-h-[70vh]
                     flex flex-col
                     bg-neutral-950/95 backdrop-blur-xl
                     border border-white/10 rounded-2xl
                     shadow-[0_16px_64px_rgba(0,0,0,0.5)]
                     animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
            <span className="text-xs font-mono tracking-wider text-neutral-400">
              通知 ({notifications.length})
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Card list */}
          <div className="overflow-y-auto flex-1">
            {notifications.map((n) => (
              <NotificationCard key={n.id} item={n} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
