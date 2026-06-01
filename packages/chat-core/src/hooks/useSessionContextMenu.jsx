import { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import React from 'react';
import { baseUrl, getCsrfToken } from '../utils/api';

/**
 * Reusable right-click/long-press context menu for session items.
 *
 * Usage:
 *   const { contextMenu, containerRef } = useSessionContextMenu({
 *     sessions, setSessions, activeSessionId, setActiveSessionId, openDestructor,
 *   });
 *   <div ref={containerRef}>
 *     {sessions.map(s => <button data-session-id={s.id} ... />)}
 *   </div>
 *   <SessionContextMenuOverlay contextMenu={contextMenu} actions={menuActions} />
 */

const SessionContextMenuOverlay = React.memo(({ contextMenu, actions }) => {
  if (!contextMenu) return null;
  return (
    <div
      className="fixed z-[9999] w-40 bg-exo-pure border border-exo-mist-12 rounded-[2px] shadow-2xl overflow-hidden text-[11px] py-1 backdrop-blur-xl"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <div
        onClick={(e) => actions.handleRename(e, contextMenu.conv)}
        className="px-4 py-2.5 hover:bg-white/5 flex items-center gap-2 text-white font-mono uppercase tracking-widest transition-colors cursor-pointer"
      >
        <Edit2 size={12} /> Rename
      </div>
      <div
        onClick={(e) => actions.handleDelete(e, contextMenu.conv)}
        className="px-4 py-2.5 hover:bg-red-500/10 flex items-center gap-2 text-red-500 font-mono uppercase tracking-widest transition-colors cursor-pointer"
      >
        <Trash2 size={12} /> Purge
      </div>
    </div>
  );
});
SessionContextMenuOverlay.displayName = 'SessionContextMenuOverlay';

export default function useSessionContextMenu({
  sessions,
  setSessions,
  activeSessionId,
  setActiveSessionId,
  openDestructor,
}) {
  const [contextMenu, setContextMenu] = useState(null); // { conv, x, y } | null
  const containerRef = useRef(null);
  const closeHandlerRef = useRef(null);
  const sessionsRef = useRef(sessions);

  // Keep sessions ref in sync so the native listener always sees the latest data
  sessionsRef.current = sessions;

  // Native contextmenu listener on the container (event delegation)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onCtx = (e) => {
      const row = e.target.closest('[data-session-id]');
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      const sid = Number(row.dataset.sessionId);
      const conv = sessionsRef.current.find(c => c.id === sid);
      if (!conv) return;
      const menuW = 160, menuH = 88;
      let x = e.clientX;
      let y = e.clientY;
      if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
      if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
      setContextMenu({ conv, x, y });
    };
    el.addEventListener('contextmenu', onCtx);
    return () => el.removeEventListener('contextmenu', onCtx);
  }, []); // stable — uses sessionsRef for data

  // Close context menu on outside interaction (delayed to avoid right-click mousedown race)
  useEffect(() => {
    if (!contextMenu) {
      if (closeHandlerRef.current) {
        document.removeEventListener('click', closeHandlerRef.current);
        document.removeEventListener('scroll', closeHandlerRef.current, true);
        closeHandlerRef.current = null;
      }
      return;
    }
    const timer = setTimeout(() => {
      const close = () => setContextMenu(null);
      closeHandlerRef.current = close;
      document.addEventListener('click', close);
      document.addEventListener('scroll', close, true);
    }, 0);
    return () => clearTimeout(timer);
  }, [contextMenu]);

  const menuActions = {
    handleRename: (e, conv) => {
      e.stopPropagation();
      setContextMenu(null);
      const newName = prompt('Rename:', conv.name);
      if (newName && newName !== conv.name) {
        fetch(`${baseUrl}/api/agents/conversations/${conv.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
          credentials: 'include',
          body: JSON.stringify({ name: newName }),
        }).then(r => {
          if (r.ok && setSessions) {
            setSessions(p => p.map(c => c.id === conv.id ? { ...c, name: newName } : c));
          }
        });
      }
    },
    handleDelete: (e, conv) => {
      e.stopPropagation();
      setContextMenu(null);
      openDestructor({
        title: conv.name,
        onDelete: () => {
          fetch(`${baseUrl}/api/agents/conversations/${conv.id}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() },
            credentials: 'include',
          }).then(r => {
            if (r.ok) {
              if (setSessions) {
                setSessions(p => p.filter(c => c.id !== conv.id));
              }
              if (activeSessionId === conv.id && setActiveSessionId) {
                setActiveSessionId(null);
              }
            }
          });
        },
      });
    },
  };

  return { contextMenu, containerRef, menuActions, SessionContextMenuOverlay };
}
