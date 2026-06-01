import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrainCircuit, FolderKanban, Building2, CheckSquare, Search, ArrowRight, MessageSquare } from 'lucide-react';
import CalendarWidget from '../components/CalendarWidget';
import { conversationsApi } from 'exo-shared';
import useSessionContextMenu from '../hooks/useSessionContextMenu';

const WELCOME_SENTENCES = [
  'Neural link established. All systems nominal.',
  'Welcome back, Operator. The cores await.',
  'Cognitive engines online. Ready for input.',
  'ExoCore grid stable. Proceed with intent.',
  'Synaptic pathways clear. What shall we build?',
];

const QUICK_LINKS = [
  { id: 'agent_hub', icon: BrainCircuit, label: '代理中枢', desc: 'Agent 管理与配置' },
  { id: 'project', icon: FolderKanban, label: '工程项目', desc: '长线任务与文件' },
  { id: 'council', icon: Building2, label: '理事会', desc: '多 Agent 协同' },
  { id: 'task', icon: CheckSquare, label: '任务与时序', desc: '日程与时间线' },
];

export default function Dashboard({ appState, setView }) {
  const userNick = localStorage.getItem('exo_user_nick') || 'Exo User';
  const { presets, refreshKey, setActiveSessionId } = appState;
  const [recentSessions, setRecentSessions] = useState([]);
  const [greeting] = useState(
    () => WELCOME_SENTENCES[Math.floor(Math.random() * WELCOME_SENTENCES.length)]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [allConversations, setAllConversations] = useState([]);
  const searchRef = useRef(null);

  // Combined sessions for context menu lookup (updates both state arrays on change)
  const allSessions = useMemo(() => [...recentSessions, ...allConversations], [recentSessions, allConversations]);
  const setAllSessions = (updater) => {
    if (typeof updater === 'function') {
      setRecentSessions(prev => updater(prev));
      setAllConversations(prev => updater(prev));
    }
  };

  const { contextMenu, containerRef, menuActions, SessionContextMenuOverlay } = useSessionContextMenu({
    sessions: allSessions,
    setSessions: setAllSessions,
    activeSessionId: appState.activeSessionId,
    setActiveSessionId: appState.setActiveSessionId,
    openDestructor: appState.openDestructor,
  });

  useEffect(() => {
    conversationsApi.listConversations()
      .then(data => {
        const sorted = (Array.isArray(data) ? data : []).sort(
          (a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
        );
        setRecentSessions(sorted.slice(0, 3));
      })
      .catch(() => setRecentSessions([]));
  }, [refreshKey]);

  const handleSessionClick = (convo) => {
    setActiveSessionId(convo.id);
    setView('chat', { sessionId: convo.id, sessionTitle: convo.name });
  };

  const getAgentName = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    return preset ? preset.name : 'Agent';
  };

  const handleSearchFocus = () => {
    setShowResults(true);
    if (allConversations.length === 0) {
      conversationsApi.listConversations()
        .then(data => setAllConversations(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  };

  const filteredConversations = searchTerm.trim()
    ? allConversations.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 h-full overflow-y-auto bg-exo-bg scrollbar-hide">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-exo-accent/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20 flex flex-col gap-14 relative z-10">
        {/* Hero */}
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-exo-accent/40" />
            <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-exo-accent/60">ExoCore // System.Ready</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-light leading-ultra-tight tracking-tight text-white">
            Welcome back, <span className="text-exo-accent font-medium">{userNick.toUpperCase()}</span>
          </h1>
          <p className="text-base text-exo-muted max-w-xl font-light">{greeting}</p>

          {/* Search bar */}
          <div className="pt-2 max-w-md relative" ref={searchRef}>
            <div className="flex items-center gap-3 px-4 py-3 bg-exo-pure border border-exo-mist-10 rounded-md transition-all group focus-within:border-exo-accent/40">
              <Search size={16} className="text-exo-muted group-focus-within:text-exo-accent transition-colors shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
                onFocus={handleSearchFocus}
                placeholder="搜索会话..."
                className="flex-1 bg-transparent text-sm text-exo-text placeholder:text-exo-muted outline-none border-none p-0"
              />
            </div>
            {showResults && filteredConversations.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-exo-pure border border-exo-mist-8 rounded-md shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
                {filteredConversations.map(convo => (
                  <button
                    key={convo.id}
                    data-session-id={convo.id}
                    onClick={() => {
                      setSearchTerm('');
                      setShowResults(false);
                      setActiveSessionId(convo.id);
                      setView('chat', { sessionId: convo.id, sessionTitle: convo.name });
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-all text-left"
                  >
                    <MessageSquare size={14} className="text-exo-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white truncate block">{convo.name || `Session #${convo.id}`}</span>
                      <span className="text-[9px] text-exo-muted">{getAgentName(convo.agent_preset_id)} · {convo.agent_type}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults && searchTerm.trim() && filteredConversations.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-exo-pure border border-exo-mist-8 rounded-md p-4 text-center z-50">
                <p className="text-xs text-exo-muted">No sessions found</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3">
              <div className="h-px w-6 bg-exo-accent/30" />
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-exo-muted">Recent Sessions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentSessions.map(convo => (
                <button
                  key={convo.id}
                  data-session-id={convo.id}
                  onClick={() => handleSessionClick(convo)}
                  className="group flex items-center gap-4 p-5 bg-exo-pure border border-exo-mist-10 rounded-md hover:border-exo-accent/30 hover:shadow-glow-gold transition-all text-left"
                >
                  <div className="p-2.5 rounded-md bg-exo-accent/5 border border-exo-mist-10 text-exo-accent group-hover:shadow-glow-gold transition-all">
                    <MessageSquare size={18} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{convo.name || `Session #${convo.id}`}</p>
                    <p className="text-[10px] font-mono text-exo-muted mt-0.5">
                      {getAgentName(convo.agent_preset_id)} · {convo.agent_type || 'chat'}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-exo-mist-20 group-hover:text-exo-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          {QUICK_LINKS.map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className="group flex flex-col items-center gap-3 p-6 bg-exo-pure border border-exo-mist-10 rounded-md hover:border-exo-accent/30 transition-all text-center"
            >
              <div className="p-3 rounded-md bg-white/[0.03] border border-exo-mist-10 text-exo-accent group-hover:shadow-glow-gold transition-all">
                <Icon size={22} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-exo-accent transition-colors">{label}</p>
                <p className="text-[10px] text-exo-muted mt-0.5 font-mono uppercase tracking-wider">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Calendar */}
        <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3">
            <div className="h-px w-6 bg-exo-accent/30" />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-exo-muted">Calendar</span>
          </div>
          <div className="bg-exo-pure border border-exo-mist-10 rounded-md p-1">
            <CalendarWidget />
          </div>
        </div>
      </div>

      <SessionContextMenuOverlay contextMenu={contextMenu} actions={menuActions} />
    </div>
  );
}
