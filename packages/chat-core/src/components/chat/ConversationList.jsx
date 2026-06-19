import React, { useState, useEffect, useMemo } from 'react';
import {
 ChevronDown, ChevronRight, X, Plus, Cpu, Sparkles, Box,
 Folder, FolderOpen, Hash, Edit2,
 ShieldAlert, ChevronLast, PanelLeftClose, PanelLeftOpen, Users,
 Search, MessageSquare
} from 'lucide-react';
import { conversationsApi, projectsApi, getConvProjectId } from 'exo-shared';

const ConversationList = ({
 activeSessionId,
 setActiveSessionId,
 projects = [],
 setProjects,
 refreshKey,
 setRefreshKey,
 openDestructor,
 openNewSession,
 openCreateProject,
 activeFileProjectId,
 setActiveFileProjectId,
 showConvList,
 onClose,
 mode = 'chat', // 'chat' | 'council' | 'project'
 councilSessions = [],
 activeCouncilId,
 setActiveCouncilId,
 onCreateCouncil,
 isMainView = false // Whether it's displayed in the main content area
}) => {
 const [conversations, setConversations] = useState([]);
 const [expandedProjects, setExpandedProjects] = useState(new Set());
 const [showAllProjects, setShowAllProjects] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');

 const handleRenameProject = (proj) => {
 const newName = prompt('Rename project:', proj.name);
 if (!newName || newName === proj.name) return;
 projectsApi.updateProject(proj.id, { name: newName })
  .then(() => setProjects?.(prev => prev.map(p => p.id === proj.id ? { ...p, name: newName } : p)))
  .catch(() => {});
 };

 useEffect(() => {
 conversationsApi.listConversations()
  .then(data => {
  const sortedData = data.sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
  setConversations(sortedData);
  })
  .catch(err => console.error("会话列表获取失败:", err));
 }, [refreshKey]);

 const toggleProject = (projectId) => {
 setExpandedProjects(prev => {
  const newSet = new Set(prev);
  if (newSet.has(projectId)) newSet.delete(projectId); else newSet.add(projectId);
  return newSet;
 });
 };

 const councilInternalIds = new Set(
 (councilSessions || []).flatMap(cs => [
  cs.phase0_conversation_id,
  cs.synthesis_conversation_id,
  ...(cs.participants || []).map(p => p.conversation_id),
 ].filter(Boolean))
 );

 const filteredConversations = conversations.filter(c => 
 c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
 c.id.toString().includes(searchQuery)
 );

 const g045Sessions = filteredConversations.filter(c => c.agent_type === 'g045' && !councilInternalIds.has(c.id));
 const standardSessions = filteredConversations.filter(c => c.agent_type !== 'g045' && getConvProjectId(c) === null && !councilInternalIds.has(c.id));

 const sortedProjects = useMemo(() => {
 if (!projects) return [];
 return [...projects].sort((a, b) => {
  const lastA = conversations.find(c => getConvProjectId(c) === Number(a.id))?.last_message_at || 0;
  const lastB = conversations.find(c => getConvProjectId(c) === Number(b.id))?.last_message_at || 0;
  return new Date(lastB) - new Date(lastA);
 });
 }, [projects, conversations]);

 const visibleProjects = showAllProjects ? sortedProjects : sortedProjects.slice(0, 2);

 // 判断会话是否超过 7 天未活跃
 const isSessionInactive = (conv) => {
 const lastActive = new Date(conv.last_message_at || conv.created_at);
 const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
 return lastActive < weekAgo;
 };

 const SessionItem = ({ conv, icon: Icon }) => {
 const inactive = isSessionInactive(conv);
 return (
 <div
  onClick={() => setActiveSessionId(conv.id)}
  data-session-id={conv.id}
  className={`group relative flex items-center justify-between p-3 rounded-[4px] cursor-pointer transition-all border ${
  activeSessionId === conv.id
   ? 'bg-exo-accent/10 tx-system-accent border-exo-accent/40 shadow-glow-gold'
   : inactive
   ? 'tx-system-mute opacity-40 hover:bg-exo-accent/[0.01] border-dashed border-exo-mist-6'
   : 'tx-system-mute hover:bg-exo-accent/[0.02] border-transparent hover:border-exo-mist-10'
  }`}
 >
  <div className="flex items-center gap-3 overflow-hidden min-w-0">
  <div className={`p-1.5 rounded-[2px] border transition-all ${
   activeSessionId === conv.id ? 'bg-exo-accent/20 border-exo-accent/40' :
   inactive ? 'bg-white/[0.02] border-transparent opacity-30' :
   'bg-white/5 border-transparent group-hover:border-exo-mist-10'
  }`}>
   <Icon size={14} className={activeSessionId === conv.id ? 'tx-system-accent' : inactive ? 'opacity-20 group-hover:opacity-40' : 'opacity-40 group-hover:opacity-100'} />
  </div>
  <div className="flex flex-col min-w-0">
   <span className={`text-sm truncate tracking-wide font-light ${inactive && activeSessionId !== conv.id ? 'opacity-50' : ''}`}>{conv.name || `Session #${conv.id}`}</span>
   {isMainView && <span className="text-[0.5625rem] opacity-40 tracking-tighter">TIMESTAMP: {new Date(conv.last_message_at || conv.created_at).toLocaleString()}</span>}
  </div>
  </div>
  {inactive && activeSessionId !== conv.id && (
  <span className="text-[0.5rem] font-mono tracking-[0.15em] tx-system-mute opacity-20 border border-exo-mist-6 rounded-[2px] px-1.5 py-0.5 flex-shrink-0">休眠</span>
  )}
 </div>
 );
 };

 const containerClasses = isMainView
 ? "flex-1 h-full bg-exo-bg flex flex-col overflow-y-auto scrollbar-hide"
 : `absolute md:relative inset-0 z-[90] w-80 bg-exo-pure/60 backdrop-blur-2xl border-r border-exo-mist-10 flex flex-col flex-shrink-0 shadow-2xl transition-transform duration-300 ${showConvList ? 'translate-x-0' : '-translate-x-full md:hidden'}`;

 return (
 <div className={containerClasses}>
  {/* Search & Header */}
  <div className={`p-8 space-y-6 shrink-0 ${isMainView ? 'max-w-4xl mx-auto w-full' : ''}`}>
  <div className="flex items-center justify-between">
   <h2 className="text-[0.625rem] font-bold tracking-[0.4em] tx-system-accent">
   {mode === 'chat' && 'Nodes Hub'}
   {mode === 'council' && 'Council Hub'}
   {mode === 'project' && 'Project Repos'}
   </h2>
   <div className="flex items-center gap-3">
   <button
    onClick={() => mode === 'council' ? onCreateCouncil() : mode === 'project' ? openCreateProject() : openNewSession()}
    className="p-2 rounded-[4px] bg-exo-accent/10 tx-system-accent border border-exo-accent/20 hover:bg-exo-accent hover:text-black transition-colors"
   >
    <Plus size={18} />
   </button>
   {!isMainView && <button onClick={onClose} className="md:hidden p-2 rounded-[4px] tx-system-mute hover:bg-exo-accent/[0.04]"><X size={18} /></button>}
   </div>
  </div>
  
  <div className="relative group">
   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 tx-system-mute opacity-40 group-focus-within:tx-system-accent transition-colors" />
   <input 
   type="text" 
   placeholder="Search active nodes..."
   value={searchQuery}
   onChange={(e) => setSearchQuery(e.target.value)}
   className="w-full bg-exo-pure border border-exo-mist-10 rounded-[4px] py-2.5 pl-10 pr-4 text-[0.6875rem] font-mono tracking-widest focus:border-exo-accent/40 focus:bg-exo-accent/5 outline-none transition-all placeholder:tx-system-mute opacity-20"
   />
  </div>
  </div>

  <div className={`flex-1 flex flex-col ${isMainView ? 'max-w-4xl mx-auto w-full px-8' : 'px-6'}`}>
   
   {mode === 'chat' && (
   <>
    {/* G045 cognitively superior */}
    {g045Sessions.length > 0 && (
    <div className="flex flex-col shrink-0">
     <div className="text-[0.5625rem] font-mono font-bold tx-system-accent opacity-60 flex items-center gap-2 tracking-[0.3em] px-2 pt-4 pb-2 shrink-0">
     <Sparkles size={12} /> Superior Cognitive
     </div>
     <div className="grid gap-1 pb-4">
     {g045Sessions.map(conv => <SessionItem key={conv.id} conv={conv} icon={Cpu} />)}
     </div>
    </div>
    )}

    {/* Divider: G045 → Projects */}
    {g045Sessions.length > 0 && sortedProjects.length > 0 && (
    <div className="h-px bg-exo-mist-6 shrink-0 my-2" />
    )}

    {/* Projects Zone */}
    {sortedProjects.length > 0 && (
    <div className="flex flex-col shrink-0">
     <div className="text-[0.5625rem] font-mono font-bold tx-system-mute opacity-40 flex items-center gap-2 tracking-[0.3em] px-2 pt-4 pb-2 shrink-0">
     <Box size={12} /> Project Repositories
     </div>
     <div className="flex-1 pb-4">
     <div className="grid gap-2">
      {visibleProjects.map(proj => {
      const isExpanded = expandedProjects.has(proj.id);
      const projSessions = conversations.filter(c => getConvProjectId(c) === Number(proj.id) && c.agent_type !== 'g045');
      return (
       <div key={proj.id} className="space-y-1">
       <div
        onClick={() => toggleProject(proj.id)}
        className={`group flex items-center gap-4 p-3 rounded-[4px] cursor-pointer transition-colors border ${isExpanded ? 'bg-exo-pure border-exo-mist-12' : 'border-transparent hover:bg-exo-accent/[0.02] hover:border-exo-mist-10'}`}
       >
        <div className={`p-2 rounded-[2px] transition-all border ${isExpanded ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-white/5 tx-system-mute border-transparent'}`}>
        {isExpanded ? <FolderOpen size={16}/> : <Folder size={16}/>}
        </div>
        <div className="flex-1 min-w-0">
        <div className="text-sm font-light truncate leading-tight">{proj.name}</div>
        <div className="text-[0.5625rem] font-mono opacity-30 tracking-tighter">{projSessions.length} active nodes</div>
        </div>
        <button
        onClick={(e) => { e.stopPropagation(); handleRenameProject(proj); }}
        className="p-1 tx-system-mute opacity-40 hover:tx-system-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        title="Rename project"
        >
        <Edit2 size={12} />
        </button>
        <ChevronRight size={14} className={`transition-transform opacity-30 ${isExpanded ? 'rotate-90' : ''}`} />
       </div>
       {isExpanded && (
        <div className="pl-4 space-y-1 border-l border-exo-mist-6 ml-6 py-1 animate-fade-in">
        <div
         onClick={() => { setActiveFileProjectId(proj.id); setActiveSessionId(null); onClose(); }}
         className={`flex items-center gap-3 p-2.5 rounded-[4px] cursor-pointer text-[0.625rem] font-mono tracking-[0.2em] transition-all border border-transparent ${
         activeFileProjectId === proj.id
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
          : 'text-blue-400/60 hover:bg-blue-500/5 hover:text-blue-400 hover:border-blue-500/10'
         }`}
        >
         <Box size={14} /> [ Archive_Files ]
        </div>
        {projSessions.map(conv => <SessionItem key={conv.id} conv={conv} icon={Hash} />)}
        </div>
       )}
       </div>
      );
      })}
     </div>
     {sortedProjects.length > 2 && (
      <button
      onClick={() => setShowAllProjects(p => !p)}
      className="text-[0.5625rem] font-mono tracking-[0.2em] tx-system-mute opacity-40 hover:tx-system-accent transition-colors px-2 pt-3"
      >
      {showAllProjects ? '<< Collapse' : '>> Reveal more'}
      </button>
     )}
     </div>
    </div>
    )}

    {/* Divider: Projects → Standard */}
    {sortedProjects.length > 0 && standardSessions.length > 0 && (
    <div className="h-px bg-exo-mist-6 shrink-0 my-2" />
    )}

    {/* Standard Sessions */}
    {standardSessions.length > 0 && (
    <div className="flex flex-col">
     <div className="text-[0.5625rem] font-mono font-bold tx-system-mute opacity-40 flex items-center gap-2 tracking-[0.3em] px-2 pt-4 pb-2 shrink-0">
     <MessageSquare size={12} /> Recent Links
     </div>
     <div className="grid gap-1 pb-8">
     {standardSessions.map(conv => <SessionItem key={conv.id} conv={conv} icon={Hash} />)}
     </div>
    </div>
    )}
   </>
   )}

   {mode === 'council' && (
   <div className="grid gap-3">
    {councilSessions.length === 0 ? (
     <div className="py-20 text-center opacity-10">
     <Users size={48} className="mx-auto mb-4" />
     <p className="text-[0.625rem] font-mono tracking-[0.4em]">No Active Councils</p>
     </div>
    ) : councilSessions.map(cs => (
    <div
     key={cs.id}
     onClick={() => { setActiveCouncilId(cs.id); setActiveSessionId(null); onClose && onClose(); }}
     className={`flex items-center gap-5 p-5 rounded-[4px] cursor-pointer transition-all border ${
     activeCouncilId === cs.id 
      ? 'bg-exo-accent/10 border-exo-accent/40 tx-system-accent shadow-glow-gold' 
      : 'border-transparent hover:bg-exo-accent/[0.02] hover:border-exo-mist-10 tx-system-mute hover:tx-system-normal'
     }`}
    >
     <div className={`p-3 rounded-[2px] transition-all border ${activeCouncilId === cs.id ? 'bg-exo-accent/20 border-exo-accent/40' : 'bg-white/5 border-transparent'}`}>
     <Users size={20} />
     </div>
     <div className="flex-1 min-w-0">
     <div className="text-base font-light truncate mb-1">{cs.topic || cs.arbitrator_preset_name || `Council #${cs.id}`}</div>
     <div className="flex items-center gap-3">
      <span className="text-[0.5625rem] font-mono font-bold tracking-[0.2em] px-2 py-0.5 rounded-[2px] bg-exo-accent/10 border border-exo-accent/30 tx-system-accent">{cs.status}</span>
      <span className="text-[0.5625rem] font-mono opacity-30 tracking-tighter">{new Date(cs.created_at).toLocaleDateString()}</span>
     </div>
     </div>
    </div>
    ))}
   </div>
   )}

   {mode === 'project' && (
    <div className="space-y-6">
    <div className="text-[0.5625rem] font-mono font-bold tx-system-mute opacity-40 flex items-center gap-2 tracking-[0.3em] px-2">
     <Box size={12} /> Project Repositories
    </div>
    <div className="grid gap-3">
     {sortedProjects.map(proj => {
     const isExpanded = expandedProjects.has(proj.id) || mode === 'project';
     const projSessions = conversations.filter(c => getConvProjectId(c) === Number(proj.id));
     return (
      <div key={proj.id} className="space-y-2">
      <div
       onClick={() => toggleProject(proj.id)}
       className={`group flex items-center gap-4 p-4 rounded-[4px] cursor-pointer transition-colors border ${isExpanded ? 'bg-exo-pure border-exo-mist-12 shadow-brutalist' : 'border-transparent hover:bg-exo-accent/[0.02] hover:border-exo-mist-10'}`}
      >
       <div className={`p-2 rounded-[2px] transition-all border ${isExpanded ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-white/5 tx-system-mute border-transparent'}`}>
       {isExpanded ? <FolderOpen size={18}/> : <Folder size={18}/>}
       </div>
       <div className="flex-1 min-w-0">
       <div className="text-base font-light truncate">{proj.name}</div>
       <div className="text-[0.5625rem] font-mono opacity-30 tracking-tighter">{projSessions.length} active nodes</div>
       </div>
       <button
       onClick={(e) => { e.stopPropagation(); handleRenameProject(proj); }}
       className="p-1 tx-system-mute opacity-40 hover:tx-system-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0"
       title="Rename project"
       >
       <Edit2 size={12} />
       </button>
       <ChevronRight size={14} className={`transition-transform opacity-30 ${isExpanded ? 'rotate-90' : ''}`} />
      </div>
      {isExpanded && (
       <div className="pl-6 space-y-1 border-l border-exo-mist-6 ml-8 py-1 animate-fade-in">
        <div
        onClick={() => { setActiveFileProjectId(proj.id); setActiveSessionId(null); onClose(); }}
        className={`flex items-center gap-3 p-3 rounded-[4px] cursor-pointer text-[0.625rem] font-mono tracking-[0.2em] transition-all border border-transparent ${
         activeFileProjectId === proj.id
         ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
         : 'text-blue-400/60 hover:bg-blue-500/5 hover:text-blue-400'
        }`}
        >
        <Box size={14} /> [ ARCHIVE_FILES ]
        </div>
        {projSessions.map(conv => <SessionItem key={conv.id} conv={conv} icon={Hash} />)}
       </div>
      )}
      </div>
     );
     })}
    </div>
    </div>
   )}

   {filteredConversations.length === 0 && (
   <div className="flex flex-col items-center justify-center py-20 opacity-10 text-center gap-6">
    <ShieldAlert size={48} strokeWidth={1} />
    <p className="text-[0.625rem] font-mono tracking-[0.5em] font-light leading-relaxed">No Nodes Detected<br/>Establish Connection</p>
   </div>
   )}
  </div>

 </div>
 );
};

export default ConversationList;
