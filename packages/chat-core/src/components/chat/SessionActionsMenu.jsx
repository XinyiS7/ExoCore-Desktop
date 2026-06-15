import React, { useState, useRef, useEffect } from 'react';
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
 * small popover with Rename and Delete actions. Click propagation is
 * stopped so the parent row's onClick (navigation) is not triggered.
 *
 * Props:
 * session  — the conversation object
 * onUpdated  — (sessionId, newName) => void — called after rename
 * onDeleted  — (sessionId) => void — called after delete
 * openDestructor — ({ title, onDelete }) => void — confirmation modal
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
  className="p-1.5 rounded transition-all"
  title="Session actions"
  style={{ color: 'var(--cinder-text-dim)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.opacity = '1'; }}
  onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.background = ''; e.currentTarget.style.opacity = ''; }}
  >
  <IconMenu size={14} />
  </button>

  {open && (
  <div className="absolute right-0 top-full mt-1 w-36 bg-exo-pure/80 backdrop-blur-xl border border-white/[0.06] rounded-[2px] shadow-lg py-1 z-50">
   <button
   onClick={handleRename}
   className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white font-mono tracking-wider hover:bg-white/5 transition-colors text-left"
   >
   <Edit2 size={11} strokeWidth={1} /> Rename
   </button>
   <button
   onClick={handleDelete}
   className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-500 font-mono tracking-wider hover:bg-red-500/10 transition-colors text-left"
   >
   <Trash2 size={11} strokeWidth={1} /> Delete
   </button>
  </div>
  )}
 </div>
 );
}
