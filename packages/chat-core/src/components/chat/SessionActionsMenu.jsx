import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Trash2 } from 'lucide-react';
import { conversationsApi } from 'exo-shared';

/* ── icon-rename.svg — three vertical lines ── */
const IconMenu = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round">
    <line x1="7" y1="10" x2="7" y2="14" />
    <line x1="12" y1="6" x2="12" y2="18" />
    <line x1="17" y1="9" x2="17" y2="15" />
  </svg>
);

/**
 * SessionActionsMenu — three-dot dropdown for session list items.
 *
 * Renders a MoreVertical icon button (visible on row hover) that opens a
 * small popover with Rename and Delete actions. The dropdown is rendered
 * via createPortal to document.body so it escapes any parent stacking
 * contexts (e.g. CSS transform animations) and overflow clipping.
 *
 * Props:
 * session  — the conversation object
 * onUpdated  — (sessionId, newName) => void — called after rename
 * onDeleted  — (sessionId) => void — called after delete
 * openDestructor — ({ title, onDelete }) => void — confirmation modal
 */
export default function SessionActionsMenu({ session, onUpdated, onDeleted, openDestructor }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close on outside click — check both trigger and dropdown (portal)
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      const hitTrigger = triggerRef.current?.contains(e.target);
      const hitDropdown = dropdownRef.current?.contains(e.target);
      if (!hitTrigger && !hitDropdown) {
        setOpen(false);
      }
    };
    // Use mousedown so it fires before the row's onClick
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Update menu position on window resize/scroll while open
  const recalcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    recalcPosition();
    window.addEventListener('resize', recalcPosition);
    window.addEventListener('scroll', recalcPosition, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', recalcPosition);
      window.removeEventListener('scroll', recalcPosition, { capture: true });
    };
  }, [open, recalcPosition]);

  const handleToggle = () => {
    setOpen(prev => {
      if (!prev && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuPos({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
      return !prev;
    });
  };

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
    <div className="shrink-0">
      <button
        ref={triggerRef}
        onClick={e => { e.stopPropagation(); handleToggle(); }}
        className="p-1.5 rounded transition-colors"
        title="Session actions"
        style={{ color: 'var(--cinder-text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-text)'; e.currentTarget.style.background = 'var(--cinder-glass)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--cinder-text-faint)'; e.currentTarget.style.background = 'none'; }}
      >
        <IconMenu size={14} />
      </button>

      {open && menuPos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 9999,
            background: 'var(--cinder-glass-heavy)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid var(--cinder-line)',
            borderRadius: '2px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          }}
          className="w-36 py-1"
        >
          <button
            onClick={handleRename}
            className="w-full flex items-center gap-2 px-3 py-2 text-[0.6875rem] font-mono tracking-wider transition-colors text-left"
            style={{ color: 'var(--cinder-text)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--cinder-glass)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <Edit2 size={11} strokeWidth={1} /> Rename
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-[0.6875rem] font-mono tracking-wider transition-colors text-left"
            style={{ color: 'var(--cinder-flame)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-text)'; e.currentTarget.style.background = 'var(--cinder-glass)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--cinder-flame)'; e.currentTarget.style.background = 'none'; }}
          >
            <Trash2 size={11} strokeWidth={1} /> Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
