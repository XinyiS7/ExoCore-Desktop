import React, { useEffect } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';

/**
 * Auto-dismissing toast notification.
 *
 * Props:
 *  - type: 'success' | 'error'
 *  - message: string
 *  - onClose: () => void — called after auto-dismiss or manual close
 *  - duration: ms (default 2500)
 */
export default function Toast({ type, message, onClose, duration = 2500 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[9999] px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg shadow-2xl border flex items-center gap-3 animate-fade-in max-w-[calc(100vw-2rem)] min-w-[240px] sm:min-w-[260px] ${
      type === 'success'
        ? 'bg-green-900/90 border-green-500/30 text-green-200'
        : 'bg-red-900/90 border-red-500/30 text-red-200'
    }`}>
      <span className="flex-shrink-0">
        {type === 'success'
          ? <Check size={16} />
          : <AlertCircle size={16} />
        }
      </span>
      <span className="flex-1 text-sm font-mono">{message}</span>
      <button
        onClick={onClose}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
}
