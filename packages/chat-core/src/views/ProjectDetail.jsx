import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, MessageSquare, FileText, Upload, Trash2, Hash, FolderOpen, ChevronUp } from 'lucide-react';
import { conversationsApi, projectsApi, getConvProjectId } from 'exo-shared';
import WorkDirModal from '../../../components/project/WorkDirModal';
import useSessionContextMenu from '../../../hooks/useSessionContextMenu';

export default function ProjectDetail({ appState, setView, goBack, viewParams }) {
  const { projects, openNewSession, openDestructor, setActiveSessionId } = appState;
  const projectId = viewParams.projectId;
  const project = projects.find(p => p.id === projectId);

  const [sessions, setSessions] = useState([]);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [showWorkDirModal, setShowWorkDirModal] = useState(false);
  const fileInputRef = useRef(null);

  const { contextMenu, containerRef: sessionsContainerRef, menuActions, SessionContextMenuOverlay } = useSessionContextMenu({
    sessions,
    setSessions,
    activeSessionId: appState.activeSessionId,
    setActiveSessionId: appState.setActiveSessionId,
    openDestructor,
  });

  // Fetch sessions belonging to this project
  useEffect(() => {
    if (!projectId) return;
    conversationsApi.listConversations()
      .then(data => {
        const projectSessions = (Array.isArray(data) ? data : [])
          .filter(c => getConvProjectId(c) === Number(projectId))
          .sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
        console.log('[DEBUG] ProjectDetail — projectId:', projectId, 'type:', typeof projectId);
        console.log('[DEBUG] ProjectDetail — filtered sessions:', projectSessions.length, 'sample:', projectSessions.slice(0, 2).map(s => ({ id: s.id, project: s.project, projectType: typeof s.project })));
        setSessions(projectSessions);
      })
      .catch(() => setSessions([]));
  }, [projectId, appState.refreshKey]);

  // Fetch project files
  const fetchFiles = () => {
    if (!projectId) return;
    projectsApi.listProjectFiles(projectId)
      .then(data => setFiles(Array.isArray(data) ? data : []))
      .catch(() => setFiles([]));
  };

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await projectsApi.uploadProjectFile(projectId, formData);
      fetchFiles();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = (file) => {
    openDestructor({
      title: file.name || file.file_name,
      onDelete: () => {
        projectsApi.deleteProjectFile(projectId, file.id)
          .then(() => fetchFiles())
          .catch(() => {});
      },
    });
  };

  const handleSessionClick = (session) => {
    setActiveSessionId(session.id);
    setView('chat', { sessionId: session.id, sessionTitle: session.name });
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return 'IMG';
    if (mimeType?.startsWith('text/')) return 'TXT';
    if (mimeType?.includes('pdf')) return 'PDF';
    return 'FILE';
  };

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-exo-muted">
        <p className="font-mono text-sm">Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-exo-bg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-exo-mist-8 px-4 md:px-8 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-white truncate">{project.name}</h2>
          <p className="text-[10px] text-exo-muted mt-0.5">{sessions.length} sessions · {files.length} files</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWorkDirModal(true)}
            className={`p-2 rounded-md border transition-all ${
              project?.work_dir ? 'text-green-400 border-green-400/30 hover:bg-green-400/10' : 'text-exo-muted border-transparent hover:text-white hover:bg-white/5'
            }`}
            title="工作目录设置"
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={() => goBack()}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 text-exo-muted hover:text-white hover:bg-white/5 rounded-md transition-all text-xs font-mono uppercase tracking-wider"
            title="Fold"
          >
            <ChevronUp size={14} strokeWidth={1.5} />
            Fold
          </button>
          <button
            onClick={() => openNewSession({ projectId })}
            className="flex items-center gap-2 px-4 py-2 bg-exo-accent/10 border border-exo-accent/30 rounded-md text-exo-accent text-xs font-medium hover:bg-exo-accent/20 active:scale-95 transition-all whitespace-nowrap"
          >
            <Plus size={14} strokeWidth={1.5} />
            New Chat
          </button>
        </div>
      </div>

      {/* Project Prompt */}
      <div className="flex-shrink-0 border-b border-exo-mist-8 px-4 md:px-8 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Project Prompt</span>
          {!editingPrompt ? (
            <button
              onClick={() => { setPromptDraft(project?.prompt || ''); setEditingPrompt(true); }}
              className="text-[10px] text-exo-muted hover:text-exo-accent transition-colors font-mono uppercase tracking-wider"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {savingPrompt && <span className="text-[9px] text-exo-muted animate-pulse">Saving...</span>}
              <button
                onClick={async () => {
                  if (promptDraft === (project?.prompt || '')) { setEditingPrompt(false); return; }
                  setSavingPrompt(true);
                  try {
                    await projectsApi.updateProject(projectId, { prompt: promptDraft });
                    appState.setProjects?.(prev =>
                      prev.map(p => p.id === projectId ? { ...p, prompt: promptDraft } : p)
                    );
                  } catch (e) {
                    console.error('Failed to save prompt', e);
                  } finally {
                    setSavingPrompt(false);
                    setEditingPrompt(false);
                  }
                }}
                className="text-[10px] text-exo-accent hover:text-white transition-colors font-mono uppercase tracking-wider"
              >
                Done
              </button>
              <button
                onClick={() => setEditingPrompt(false)}
                className="text-[10px] text-exo-muted hover:text-white transition-colors font-mono uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {editingPrompt ? (
          <textarea
            autoFocus
            value={promptDraft}
            onChange={e => setPromptDraft(e.target.value)}
            placeholder="Define project context, conventions, and goals..."
            rows={3}
            className="w-full bg-exo-pure border border-exo-mist-10 rounded-[2px] px-3 py-2 text-xs text-white font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:text-exo-muted/30 resize-none"
          />
        ) : (
          <p className="text-xs text-exo-muted/60 italic leading-relaxed">
            {project?.prompt || 'No project prompt configured. Click Edit to add one.'}
          </p>
        )}
      </div>

      {/* Content: Sessions (left) + Files (right) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sessions List */}
        <div ref={sessionsContainerRef} className="flex-1 md:w-1/2 md:flex-none overflow-y-auto scrollbar-hide border-b md:border-b-0 md:border-r border-exo-mist-8 p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Sessions</p>
            {sessions.length > 0 && (
              <span className="text-[9px] text-exo-muted font-mono">{sessions.length} total</span>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12 text-exo-muted">
              <MessageSquare size={20} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs font-mono">No sessions in this project</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sessions.map(s => (
                <button
                  key={s.id}
                  data-session-id={s.id}
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

        {/* Files List */}
        <div className="flex-1 md:w-1/2 md:flex-none overflow-y-auto scrollbar-hide p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Files</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 text-[10px] text-exo-muted hover:text-exo-accent transition-colors font-mono uppercase tracking-wider"
            >
              <Upload size={12} />
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          </div>

          {files.length === 0 ? (
            <div className="text-center py-12 text-exo-muted">
              <FileText size={20} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs font-mono">No files uploaded</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {files.map(f => (
                <div
                  key={f.id}
                  className="group flex items-center gap-3 p-3 bg-exo-pure border border-exo-mist-8 rounded-md hover:border-exo-mist-20 transition-all"
                >
                  <div className="p-2 rounded-md bg-white/[0.03] border border-exo-mist-10 text-exo-muted text-[9px] font-mono font-bold w-9 h-9 flex items-center justify-center shrink-0">
                    {getFileIcon(f.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{f.name || f.file_name || `File #${f.id}`}</p>
                    <p className="text-[9px] text-exo-muted mt-0.5">
                      {f.source || 'MANUAL'} · {f.size ? `${(f.size / 1024).toFixed(1)} KB` : 'unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={f.file || f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-exo-muted hover:text-exo-accent transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <FileText size={12} />
                    </a>
                    <button
                      onClick={() => handleDeleteFile(f)}
                      className="p-1.5 text-exo-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WorkDirModal
        projectId={projectId}
        currentWorkDir={project?.work_dir || ''}
        setProjects={appState.setProjects}
        isOpen={showWorkDirModal}
        onClose={() => setShowWorkDirModal(false)}
      />

      <SessionContextMenuOverlay contextMenu={contextMenu} actions={menuActions} />
    </div>
  );
}
