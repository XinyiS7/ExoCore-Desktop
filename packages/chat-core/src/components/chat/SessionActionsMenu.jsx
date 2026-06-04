import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { conversationsApi } from 'exo-shared';

/**
 * SessionActionsMenu — three-dot dropdown for session list items.
 *
 * Renders a MoreVertical icon button (visible on row hover) that opens a
 * small popover with Rename and Delete actions. Click propagation is
 * stopped so the parent row's onClick (navigation) is not triggered.
 *
 * Props:
 *   session       — the conversation object
 *   onUpdated     — (sessionId, newName) => void — called after rename
 *   onDeleted     — (sessionId) => void — called after delete
 *   openDestructor — ({ title, onDelete }) => void — confirmation modal
 */
export default function SessionActionsMenu({ session, onUpdated, onDeleted, openDestructor }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    // Use mousedown so it fires before the row's onClick
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleRename = () => {
    setOpen(false);
    const newName = prompt('Rename:', session.name);
    if (newName && newName.trim() && newName !== session.name) {
      conversationsApi.updateConversation(session.id, { name: newName.trim() })
        .then(() => onUpdated?.(session.id, newName.trim()))
        .catch(() => {});
    }
  };

  const handleDelete = () => {
    setOpen(false);
    openDestructor?.({
      title: session.name || `Session #${session.id}`,
      onDelete: () => {
        conversationsApi.deleteConversation(session.id)
          .then(() => onDeleted?.(session.id))
          .catch(() => {});
      },
    });
  };

  return (
    <div
      ref={menuRef}
      className="relative shrink-0"
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 text-exo-muted/30 hover:text-exo-muted hover:bg-white/5 rounded transition-all opacity-0 group-hover:opacity-100"
        title="Session actions"
      >
        <MoreVertical size={14} strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-exo-pure border border-exo-mist-12 rounded-[2px] shadow-2xl py-1 z-50 backdrop-blur-xl">
          <button
            onClick={handleRename}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white font-mono uppercase tracking-wider hover:bg-white/5 transition-colors text-left"
          >
            <Edit2 size={11} /> Rename
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-500 font-mono uppercase tracking-wider hover:bg-red-500/10 transition-colors text-left"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
