import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Hash } from 'lucide-react';
import { baseUrl, getConvProjectId } from '../../../utils/api';

export default function ProjectHome({ appState, setView }) {
  const { openNewSession, setActiveSessionId } = appState;
  const [unassignedSessions, setUnassignedSessions] = useState([]);

  useEffect(() => {
    fetch(`${baseUrl}/api/agents/conversations/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const unassigned = (Array.isArray(data) ? data : [])
          .filter(c => getConvProjectId(c) === null)
          .sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
        setUnassignedSessions(unassigned);
      })
      .catch(() => setUnassignedSessions([]));
  }, [appState.refreshKey]);

  const handleSessionClick = (session) => {
    setActiveSessionId(session.id);
    setView('chat', { sessionId: session.id, sessionTitle: session.name });
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-exo-bg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-exo-mist-8 px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-[0.3em] text-exo-muted">Chat Without Project</h2>
          <p className="text-[9px] text-exo-muted/50 mt-0.5">{unassignedSessions.length} unassigned sessions</p>
        </div>
        <button
          onClick={() => openNewSession()}
          className="flex items-center gap-2 px-4 py-2 bg-exo-accent/10 border border-exo-accent/30 rounded-md text-exo-accent text-xs font-medium hover:bg-exo-accent/20 active:scale-95 transition-all"
        >
          <Plus size={14} strokeWidth={1.5} />
          New Chat
        </button>
      </div>

      {/* Unassigned Sessions List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-6">
        {unassignedSessions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-exo-muted">
            <div className="text-center">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs font-mono">No unassigned sessions</p>
              <p className="text-[10px] text-exo-muted/50 mt-1">Create a new chat or select a project</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {unassignedSessions.map(s => (
              <button
                key={s.id}
                onClick={() => handleSessionClick(s)}
                className="group flex items-center gap-3 w-full p-3 bg-exo-pure border border-exo-mist-8 rounded-md hover:border-exo-accent/30 transition-all text-left"
              >
                <div className="p-2 rounded-md bg-white/[0.03] border border-exo-mist-10 text-exo-muted group-hover:text-exo-accent group-hover:border-exo-accent/20 transition-all">
                  <Hash size={14} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{s.name || `Session #${s.id}`}</p>
                  <p className="text-[9px] text-exo-muted mt-0.5">
                    {s.agent_type || 'standard'} · {new Date(s.created_at).toLocaleDateString()}
                    {s.agent_type && (
                      <span className={`ml-1.5 px-1 py-0.5 rounded-[1px] text-[7px] font-mono uppercase ${
                        s.agent_type === 'g045'
                          ? 'bg-exo-accent/10 text-exo-accent'
                          : s.agent_type === 'superior'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-blue-500/10 text-blue-400'
                      }`}>{s.agent_type}</span>
                    )}
                  </p>
                </div>
                <span className="text-exo-muted/30 text-xs group-hover:text-exo-accent/60 transition-colors">&rarr;</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
