import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, Edit2, Plus, ChevronRight } from 'lucide-react';
import { conversationsApi, projectsApi, getConvProjectId } from 'exo-shared';
import ProjectHome from './ProjectHome';
import ProjectDetail from './ProjectDetail';

export default function ProjectList({ appState, setView, goBack, viewParams }) {
 const { projects, setProjects, openCreateProject } = appState;
 const [conversations, setConversations] = useState([]);

 // Fetch all conversations to count sessions per project
 useEffect(() => {
 conversationsApi.listConversations()
  .then(data => setConversations(Array.isArray(data) ? data : []))
  .catch(() => setConversations([]));
 }, [appState.refreshKey]);

 const projectSessionCount = (projId) =>
 conversations.filter(c => getConvProjectId(c) === Number(projId)).length;

 const sortedProjects = [...projects].sort((a, b) => {
 const lastA = conversations.find(c => getConvProjectId(c) === Number(a.id))?.last_message_at || 0;
 const lastB = conversations.find(c => getConvProjectId(c) === Number(b.id))?.last_message_at || 0;
 return new Date(lastB) - new Date(lastA);
 });

 const handleRenameProject = (proj) => {
 const newName = prompt('Rename project:', proj.name);
 if (!newName || newName === proj.name) return;
 projectsApi.updateProject(proj.id, { name: newName })
  .then(() => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, name: newName } : p)))
  .catch(() => {});
 };

 // If a project is selected in viewParams, show its detail
 const selectedProjectId = viewParams?.projectId || null;

 return (
 <div className="flex-1 h-full flex bg-exo-bg overflow-hidden">
  {/* === Left Panel: Project Sidebar === */}
  <div className={`${selectedProjectId ? 'hidden md:flex' : 'flex'} md:flex w-full md:w-72 lg:w-80 flex-shrink-0 flex-col border-r border-exo-mist-8 h-full`}>
  {/* Sidebar Header */}
  <div className="flex-shrink-0 px-5 py-4 border-b border-exo-mist-8 flex items-center justify-between">
   <div>
   <h2 className="text-[10px] font-mono font-bold tracking-[0.4em] text-exo-accent">Project Repos</h2>
   <p className="text-[9px] text-exo-muted mt-0.5">{sortedProjects.length} repositories</p>
   </div>
   <button
   onClick={() => openCreateProject()}
   className="p-2 rounded-[4px] bg-exo-accent/10 text-exo-accent border border-exo-accent/20 hover:bg-exo-accent hover:text-black transition-all"
   title="New project"
   >
   <Plus size={16} />
   </button>
  </div>

  {/* Project List */}
  <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-1">
   {sortedProjects.length === 0 && (
   <div className="text-center py-12 text-exo-muted">
    <Folder size={24} className="mx-auto mb-2 opacity-20" />
    <p className="text-[10px] font-mono tracking-wider">No projects</p>
   </div>
   )}
   {sortedProjects.map(proj => {
   const isSelected = selectedProjectId === proj.id;
   const sessionCount = projectSessionCount(proj.id);
   return (
    <div key={proj.id}>
    <button
     onClick={() => {
     if (isSelected) {
      goBack();
     } else {
      setView('project', { projectId: proj.id });
     }
     }}
     className={`group flex items-center gap-3 w-full p-3 rounded-md transition-all text-left ${
     isSelected
      ? 'bg-exo-accent/10 border border-exo-accent/20 text-exo-accent'
      : 'border border-transparent hover:bg-white/[0.03] hover:border-exo-mist-10 text-exo-muted hover:text-white'
     }`}
    >
     <div className={`p-2 rounded-md transition-all shrink-0 ${
     isSelected ? 'bg-exo-accent/10 text-exo-accent' : 'bg-white/5 text-exo-muted'
     }`}>
     {isSelected ? <FolderOpen size={16} /> : <Folder size={16} />}
     </div>
     <div className="flex-1 min-w-0">
     <p className="text-sm font-medium truncate">{proj.name}</p>
     <p className="text-[9px] text-exo-muted/50 font-mono">{sessionCount} sessions</p>
     </div>
     <button
     onClick={(e) => { e.stopPropagation(); handleRenameProject(proj); }}
     className="p-1 text-exo-muted/30 hover:text-exo-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0"
     title="Rename"
     >
     <Edit2 size={11} />
     </button>
     <ChevronRight size={12} className="text-exo-muted/30 group-hover:text-exo-accent/60 transition-all shrink-0" />
    </button>
    </div>
   );
   })}
  </div>
  </div>

  {/* === Right Panel: Content === */}
  <div className={`${selectedProjectId ? 'flex' : 'hidden md:flex'} md:flex flex-1 min-w-0 h-full flex-col`}>
  {selectedProjectId ? (
   <ProjectDetail appState={appState} setView={setView} goBack={goBack} viewParams={viewParams} />
  ) : (
   <ProjectHome appState={appState} setView={setView} />
  )}
  </div>
 </div>
 );
}
