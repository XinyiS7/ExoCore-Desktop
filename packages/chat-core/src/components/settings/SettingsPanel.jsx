import React, { useState, useEffect } from 'react';
import {
  BookOpen, FolderOpen, Folder, ChevronDown, ChevronRight,
  FileText, Edit3, MessageSquare, Brain, PanelLeftClose, PanelLeftOpen, UserCircle
} from 'lucide-react';
import { baseUrl } from '../../utils/api';
import { getUserTimezone } from '../../utils/time';
import KnowledgeEditModal from '../modals/KnowledgeEditModal';
import ProposalEditPanel from '../memory/ProposalEditPanel';
import MemoryManager from './MemoryManager';

const COMMON_TIMEZONES = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'Europe/Moscow',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'Pacific/Auckland',
  'UTC',
];

const SettingsPanel = ({ projects, presets, openDestructor }) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState('memory');
  const [memSubTab, setMemSubTab] = useState('files');
  const [isCollapsedDesktop, setIsCollapsedDesktop] = useState(false);
  const [nickInput, setNickInput] = useState(() => localStorage.getItem('exo_user_nick') || 'Exo User');
  const [timezone, setTimezone] = useState(() => getUserTimezone());

  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [projectFiles, setProjectFiles] = useState({});
  const [loadingProjects, setLoadingProjects] = useState(new Set());
  const [kfEditTarget, setKfEditTarget] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [expandedConvs, setExpandedConvs] = useState(new Set());
  const [convProposals, setConvProposals] = useState({});
  const [loadingConvs, setLoadingConvs] = useState(new Set());
  const [editingProposal, setEditingProposal] = useState(null);
  const [unresolvedFilter, setUnresolvedFilter] = useState(false);

  useEffect(() => {
    if (memSubTab !== 'proposals' || conversations.length > 0) return;
    setConvLoading(true);
    fetch(`${baseUrl}/api/agents/conversations/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(err => console.error('会话加载失败', err))
      .finally(() => setConvLoading(false));
  }, [memSubTab]);

  const toggleProjectExpand = (pid) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(pid)) { next.delete(pid); return next; }
      next.add(pid);
      if (!projectFiles[pid]) {
        setLoadingProjects(lp => new Set([...lp, pid]));
        fetch(`${baseUrl}/api/core/projects/${pid}/files/`, { credentials: 'include' })
          .then(res => res.json())
          .then(files => {
            const obsidianFiles = files.filter(f => f.source === 'obsidian_sync');
            setProjectFiles(pf => ({ ...pf, [pid]: obsidianFiles }));
          })
          .catch(err => console.error('文件加载失败', err))
          .finally(() => setLoadingProjects(lp => { const n = new Set(lp); n.delete(pid); return n; }));
      }
      return next;
    });
  };

  const toggleConvExpand = (cid) => {
    setExpandedConvs(prev => {
      const next = new Set(prev);
      if (next.has(cid)) { next.delete(cid); return next; }
      next.add(cid);
      if (!convProposals[cid]) {
        setLoadingConvs(lc => new Set([...lc, cid]));
        fetch(`${baseUrl}/api/agents/conversations/${cid}/history_chunks/`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => setConvProposals(cp => ({ ...cp, [cid]: Array.isArray(data.history_chunks) ? data.history_chunks : [] })))
          .catch(err => console.error('Proposals 加载失败', err))
          .finally(() => setLoadingConvs(lc => { const n = new Set(lc); n.delete(cid); return n; }));
      }
      return next;
    });
  };

  const openKfEdit = (fileId) => {
    const numId = typeof fileId === 'string' ? parseInt(fileId.replace(/\D/g, '')) : fileId;
    setKfEditTarget(numId);
  };

  const navBtn = (tab, icon, label) => (
    <button
      onClick={() => setActiveSettingsTab(tab)}
      className={`group flex items-center gap-3 px-3 py-2 text-sm transition-all relative ${
        activeSettingsTab === tab
          ? 'text-exo-accent'
          : 'text-exo-muted hover:text-white'
      }`}
    >
      {activeSettingsTab === tab && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-exo-accent shadow-[0_0_8px_#d4af37]" />
      )}
      <span className={`transition-transform duration-200 ${activeSettingsTab === tab ? 'scale-110' : 'group-hover:translate-x-0.5'}`}>
        {React.cloneElement(icon, { size: 16 })}
      </span>
      <span className="font-medium tracking-wide uppercase text-[11px]">{label}</span>
    </button>
  );

  return (
    <div className="flex-1 h-full flex overflow-hidden bg-exo-bg bg-noise relative">
      <KnowledgeEditModal
        isOpen={kfEditTarget !== null}
        onClose={() => setKfEditTarget(null)}
        knowledgeId={kfEditTarget}
      />

      {/* Desktop Expand Button (Floating) */}
      <button 
        onClick={() => setIsCollapsedDesktop(false)}
        className={`hidden md:flex absolute top-4 left-4 z-[80] p-2 rounded-[2px] bg-exo-pure border border-exo-mist-10 text-exo-muted hover:text-exo-accent transition-all ${isCollapsedDesktop ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}
        title="展开面板"
      >
        <PanelLeftOpen size={16} />
      </button>

      <div className={`hidden md:flex flex-col py-6 px-2 gap-2 shrink-0 bg-exo-pure border-r border-exo-mist-10 transition-all duration-300 overflow-hidden ${isCollapsedDesktop ? 'w-0 opacity-0 border-none px-0' : 'w-52 opacity-100'}`}>
        <div className="flex items-center justify-between px-3 mb-6 shrink-0">
          <span className="text-[10px] font-bold text-exo-muted uppercase tracking-[0.2em] opacity-40">Core Configuration</span>
          <button onClick={() => setIsCollapsedDesktop(true)} className="p-1.5 rounded-[2px] text-exo-muted hover:text-white hover:bg-white/5 transition-colors" title="收起面板">
            <PanelLeftClose size={16} />
          </button>
        </div>
        {navBtn('memory', <BookOpen />, '历史存档 / Archive')}
        {navBtn('memory_mgmt', <Brain />, '神经元 / Neurons')}
        {navBtn('account', <UserCircle />, '操作员 / User')}
      </div>

      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        <div className="flex md:hidden items-center gap-4 px-4 h-14 border-b border-exo-mist-10 bg-exo-pure shrink-0 overflow-x-auto scrollbar-hide">
          {navBtn('memory', <BookOpen />, '存档')}
          {navBtn('memory_mgmt', <Brain />, '记忆')}
          {navBtn('account', <UserCircle />, '用户')}
        </div>
        
        {activeSettingsTab === 'memory' && (
          <>
            {editingProposal ? (
              <ProposalEditPanel
                proposal={editingProposal.proposal}
                conversationName={editingProposal.conversationName}
                conversationId={editingProposal.conversationId}
                onBack={() => setEditingProposal(null)}
              />
            ) : (
              <>
                <div className="flex items-center gap-1 p-4 border-b border-exo-mist-10 shrink-0 bg-exo-pure/50 flex-wrap">
                  <button
                    onClick={() => setMemSubTab('files')}
                    className={`px-4 py-1.5 rounded-[2px] text-[11px] font-bold uppercase tracking-wider transition-all ${memSubTab === 'files' ? 'bg-exo-accent text-exo-pure shadow-brutalist-gold' : 'text-exo-muted hover:text-white hover:bg-white/5 border border-exo-mist-10'}`}
                  >文件库 / Files</button>
                  <button
                    onClick={() => setMemSubTab('proposals')}
                    className={`px-4 py-1.5 rounded-[2px] text-[11px] font-bold uppercase tracking-wider transition-all ${memSubTab === 'proposals' ? 'bg-exo-accent text-exo-pure shadow-brutalist-gold' : 'text-exo-muted hover:text-white hover:bg-white/5 border border-exo-mist-10'}`}
                  >摘要 / Summaries</button>
                  {memSubTab === 'proposals' && (
                    <div className="flex-1" />
                  )}
                  {memSubTab === 'proposals' && (
                    <button
                      onClick={() => setUnresolvedFilter(v => !v)}
                      className={`px-3 py-1.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        unresolvedFilter
                          ? 'bg-exo-accent/10 border border-exo-accent/30 text-exo-accent'
                          : 'text-exo-muted hover:text-white hover:bg-white/5 border border-exo-mist-10'
                      }`}
                    >
                      <span className={unresolvedFilter ? '' : 'opacity-40'}>◈</span>
                      Unresolved / 未竟事宜
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                  {memSubTab === 'files' && (
                    projects.length === 0 ? (
                      <div className="text-center py-24 text-exo-muted font-mono text-[11px] uppercase tracking-widest opacity-30">No active projects found</div>
                    ) : projects.map(proj => {
                      const isExpanded = expandedProjects.has(proj.id);
                      const files = projectFiles[proj.id];
                      const isLoadingFiles = loadingProjects.has(proj.id);
                      return (
                        <div key={proj.id} className="composio-card overflow-hidden">
                          <button
                            onClick={() => toggleProjectExpand(proj.id)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-exo-pure hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <FolderOpen size={14} className="text-exo-accent" /> : <Folder size={14} className="text-exo-muted" />}
                              <span className="text-[13px] font-medium text-exo-text font-display uppercase tracking-tight">{proj.name}</span>
                              {files && <span className="text-[10px] text-exo-muted font-mono opacity-50">[{files.length}]</span>}
                            </div>
                            {isExpanded ? <ChevronDown size={14} className="text-exo-muted" /> : <ChevronRight size={14} className="text-exo-muted" />}
                          </button>
                          {isExpanded && (
                            <div className="bg-exo-pure border-t border-exo-mist-6">
                              {isLoadingFiles ? (
                                <div className="px-4 py-6 text-[10px] text-exo-muted text-center font-mono animate-pulse">Synchronizing...</div>
                              ) : !files || files.length === 0 ? (
                                <div className="px-4 py-6 text-[10px] text-exo-muted/40 text-center font-mono">Empty Obsidian library</div>
                              ) : (
                                files.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(file => (
                                  <button
                                    key={file.id}
                                    onClick={() => openKfEdit(file.id)}
                                    className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-exo-accent/[0.03] transition-colors text-left group border-t border-exo-mist-4 first:border-t-0"
                                  >
                                    <FileText size={12} className="text-exo-muted/40 shrink-0 group-hover:text-exo-accent transition-colors" />
                                    <span className="text-[11px] text-exo-text/70 group-hover:text-exo-text truncate flex-1 font-mono tracking-tight">{file.title || file.name || file.id}</span>
                                    <Edit3 size={11} className="text-exo-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {memSubTab === 'proposals' && (
                    convLoading ? (
                      <div className="text-center py-24 text-exo-muted font-mono text-[11px] uppercase tracking-widest animate-pulse">Retrieving communications...</div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-24 text-exo-muted font-mono text-[11px] uppercase tracking-widest opacity-30">No session logs found</div>
                    ) : conversations.slice().sort((a, b) => {
                        const ta = a.last_message_at || a.created_at || '';
                        const tb = b.last_message_at || b.created_at || '';
                        return tb.localeCompare(ta);
                      }).map(conv => {
                      const isExpanded = expandedConvs.has(conv.id);
                      const chunks = convProposals[conv.id];
                      const isLoadingChunks = loadingConvs.has(conv.id);
                      return (
                        <div key={conv.id} className="composio-card overflow-hidden">
                          <button
                            onClick={() => toggleConvExpand(conv.id)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-exo-pure hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <MessageSquare size={14} className={isExpanded ? 'text-exo-accent' : 'text-exo-muted opacity-40'} />
                              <span className="text-[13px] font-medium text-exo-text truncate font-display uppercase tracking-tight">{conv.name || `SESSION LOG #${conv.id}`}</span>
                              {chunks && <span className="text-[10px] text-exo-muted font-mono opacity-50">[{chunks.length}]</span>}
                            </div>
                            {isExpanded ? <ChevronDown size={14} className="text-exo-muted" /> : <ChevronRight size={14} className="text-exo-muted" />}
                          </button>
                          {isExpanded && (
                            <div className="bg-exo-pure border-t border-exo-mist-6">
                              {isLoadingChunks ? (
                                <div className="px-4 py-6 text-[10px] text-exo-muted text-center font-mono animate-pulse">Extracting memories...</div>
                              ) : !chunks || chunks.length === 0 ? (
                                <div className="px-4 py-6 text-[10px] text-exo-muted/40 text-center font-mono">No history chunks in this session</div>
                              ) : (() => {
                                const filtered = unresolvedFilter ? chunks.filter(c => c.unresolved) : chunks;
                                if (unresolvedFilter && filtered.length === 0) {
                                  return <div className="px-4 py-6 text-[10px] text-exo-muted/40 text-center font-mono">No unresolved items</div>;
                                }
                                return filtered.slice().sort((a, b) => b.id - a.id).map(chunk => (
                                  <button
                                    key={chunk.id}
                                    onClick={() => setEditingProposal({ proposal: chunk, conversationName: conv.name || `Session #${conv.id}`, conversationId: conv.id })}
                                    className="w-full flex items-start gap-4 px-6 py-4 hover:bg-exo-accent/[0.03] transition-colors text-left group border-t border-exo-mist-4 first:border-t-0"
                                  >
                                    <div className="flex flex-col flex-1 overflow-hidden gap-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9px] text-exo-muted/50 font-mono">
                                          #{chunk.id} · idx {chunk.start_index}–{chunk.end_index}
                                        </span>
                                        {chunk.unresolved && (
                                          <span className="text-[8px] px-1.5 py-0.5 bg-exo-accent/10 border border-exo-accent/30 text-exo-accent font-mono uppercase tracking-tighter rounded-[2px]">
                                            Unresolved
                                          </span>
                                        )}
                                        {chunk.topic && (
                                          <span className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-exo-mist-10 text-exo-text/50 font-mono tracking-tighter rounded-[2px]">
                                            {chunk.topic}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[12px] text-exo-text/80 group-hover:text-exo-text line-clamp-2 leading-snug font-mono tracking-tight">
                                        {chunk.summary || 'NULL_CONTENT'}
                                      </span>
                                      {Array.isArray(chunk.keywords) && chunk.keywords.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {chunk.keywords.slice(0, 4).map((kw, ki) => (
                                            <span key={ki} className="text-[8px] font-mono px-1.5 py-0.5 rounded-[2px] bg-exo-accent/5 border border-exo-accent/15 text-exo-accent/60 uppercase">
                                              {kw}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Edit3 size={12} className="text-exo-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeSettingsTab === 'memory_mgmt' && (
          <MemoryManager presets={presets} openDestructor={openDestructor} />
        )}

        {activeSettingsTab === 'account' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-2xl space-y-12">
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-4 bg-exo-accent" />
                  <h3 className="text-[12px] font-bold text-white uppercase tracking-[0.2em] font-display">身份识别 / Identity Core</h3>
                </div>
                <div className="composio-card p-6 space-y-6 bg-exo-pure">
                  <div className="space-y-3">
                    <label className="label-caps opacity-50">Operator Alias / 用户昵称</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={nickInput}
                        onChange={(e) => setNickInput(e.target.value)}
                        className="flex-1 bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:opacity-20"
                        placeholder="ENTER ALIAS..."
                      />
                      <button 
                        onClick={() => {
                          localStorage.setItem('exo_user_nick', nickInput);
                          window.dispatchEvent(new Event('user-nick-updated'));
                        }}
                        className="px-6 py-2 bg-white text-exo-pure rounded-[2px] text-[11px] font-bold uppercase tracking-wider hover:bg-exo-accent transition-all active:scale-95 shadow-brutalist"
                      >
                        Commit
                      </button>
                    </div>
                    <p className="text-[10px] text-exo-muted font-mono leading-relaxed mt-4 p-3 bg-exo-mist-4 border-l border-exo-accent/30 italic">
                      Alias used for neural link identification. Session interactions will maintain "YOU" protocol for operational efficiency.
                    </p>
                  </div>
                  <div className="space-y-3 pt-4">
                    <label className="label-caps opacity-50">Chrono-Sync / 时区</label>
                    <div className="flex gap-2">
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="flex-1 bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23818190' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          paddingRight: '2rem',
                        }}
                      >
                        {COMMON_TIMEZONES.map(tz => (
                          <option key={tz} value={tz} className="bg-exo-pure text-white">{tz}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          localStorage.setItem('exo_user_timezone', timezone);
                          window.dispatchEvent(new Event('user-timezone-updated'));
                        }}
                        className="px-6 py-2 bg-white text-exo-pure rounded-[2px] text-[11px] font-bold uppercase tracking-wider hover:bg-exo-accent transition-all active:scale-95 shadow-brutalist"
                      >
                        Commit
                      </button>
                    </div>
                    <p className="text-[10px] text-exo-muted font-mono leading-relaxed mt-4 p-3 bg-exo-mist-4 border-l border-exo-accent/30 italic">
                      Timestamps across all session logs will reflect this regional configuration. Default: Europe/Berlin (UTC+1 / UTC+2 DST).
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-6 opacity-30">
                  <div className="w-1 h-4 bg-white" />
                  <h3 className="text-[12px] font-bold text-white uppercase tracking-[0.2em] font-display">底层访问 / Neural Access Keys</h3>
                </div>
                <div className="composio-card p-8 border-dashed bg-transparent flex flex-col items-center justify-center opacity-40">
                  <div className="p-4 rounded-full border border-white/10 mb-4">
                    <Brain size={24} className="text-white" />
                  </div>
                  <p className="text-[11px] font-mono text-white text-center uppercase tracking-widest max-w-xs leading-relaxed">
                    External API Integrations (OpenAI, Anthropic) are currently managed via System Environment. Direct console access coming in future builds.
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
