import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { conversationsApi, projectsApi, getConvProjectId } from 'exo-shared';
import WorkDirModal from '../components/project/WorkDirModal';
import BackToUpper from '../components/layout/BackButton';

/* ── SVG Icons ── */
const IconCreate = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <line x1="4" y1="19" x2="20" y2="19" />
    <polygon points="12,5 13,11 19,12 13,13 12,19 11,13 5,12 11,11" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1.2" />
    <line x1="7.5" y1="16" x2="5.5" y2="14" />
    <line x1="16.5" y1="16" x2="18.5" y2="14" />
  </svg>
);

const IconPolygon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <polygon points="12,3 21,12 12,21 3,12" strokeLinejoin="round" />
    <polygon points="12,7 17,12 12,17 7,12" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1.5" />
    <line x1="12" y1="3" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const IconRename = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="0.7" strokeLinecap="round">
    <line x1="7" y1="10" x2="7" y2="14" />
    <line x1="12" y1="6" x2="12" y2="18" />
    <line x1="17" y1="9" x2="17" y2="15" />
  </svg>
);

/* ── Motion helper ── */
const fadeUp = (delay) => ({
  animation: `fadeUp .5s ${delay}s cubic-bezier(.22,1,.36,1) both`,
});

/* ── Section header atom ── */
const SectionHead = ({ label, children }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-[18px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
    <span className="tx-section-normal font-light">
      {label}
    </span>
    {children && <span style={{ marginLeft: 'auto' }}>{children}</span>}
  </div>
);

/* ── Icon button atom ── */
const IconBtn = ({ children, title, onClick, size = 'md', style: baseStyle }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex items-center justify-center cursor-pointer transition-colors duration-400"
    style={{
      background: 'none',
      border: 'none',
      padding: size === 'sm' ? '2px' : '4px',
      color: 'var(--cinder-text-faint)',
      opacity: 0.35,
      ...(baseStyle || {}),
    }}
    onMouseEnter={e => {
      e.currentTarget.style.opacity = '1';
      e.currentTarget.style.color = baseStyle?.color || 'var(--cinder-flame)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.opacity = baseStyle?.opacity != null ? String(baseStyle.opacity) : '0.35';
      e.currentTarget.style.color = baseStyle?.color || 'var(--cinder-text-faint)';
      e.currentTarget.style.filter = 'none';
    }}
  >
    {children}
  </button>
);

/* ── Thread row atom — breathing gradient line ── */
const ThreadRow = ({ session, agentName, onClick, onRename, onDelete, openDestructor }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuContentRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      const hitTrigger = triggerRef.current?.contains(e.target);
      const hitMenu = menuContentRef.current?.contains(e.target);
      if (!hitTrigger && !hitMenu) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleRename = () => {
    setMenuOpen(false);
    const newName = prompt('Rename:', session.name);
    if (newName && newName.trim() && newName !== session.name) {
      conversationsApi.updateConversation(session.id, { name: newName.trim() })
        .then(() => onRename?.(session.id, newName.trim()))
        .catch(() => {});
    }
  };

  const handleDelete = () => {
    setMenuOpen(false);
    openDestructor?.({
      title: session.name || `Session #${session.id}`,
      onDelete: () => {
        conversationsApi.deleteConversation(session.id)
          .then(() => onDelete?.(session.id))
          .catch(() => {});
      },
    });
  };

  return (
    <div className="group flex items-center gap-3 w-full transition-colors duration-300"
      style={{
        padding: '12px 0',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid transparent',
        borderImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.04) 80%, transparent) 1',
        borderImageSlice: 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,74,8,0.35) 20%, rgba(255,74,8,0.35) 80%, transparent) 1';
        e.currentTarget.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.006) 50%, transparent)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.04) 80%, transparent) 1';
        e.currentTarget.style.background = 'none';
      }}
    >
      {/* Dot */}
      <span
        className="w-1 h-1 rounded-full shrink-0 transition-all duration-300"
        style={{ background: 'var(--cinder-ember-dim)' }}
      />
      {/* Name + click */}
      <button
        onClick={(e) => { e.stopPropagation(); onClick(session); }}
        className="flex-1 text-left font-[inherit] bg-transparent border-none cursor-pointer min-w-0"
        style={{ color: 'inherit', padding: 0 }}
      >
        <span className="tx-system-normal font-light truncate block">
          {session.name || `Session #${session.id}`}
        </span>
      </button>
      {/* Meta */}
      <span className="shrink-0 tx-decoration-mute font-light">
        {agentName} · {new Date(session.created_at).toLocaleDateString()}
      </span>
      {/* Actions — icon-rename triggers dropdown (rename + delete), portal to body */}
      <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
        <button
          ref={triggerRef}
          className="opacity-0 group-hover:opacity-50 hover:opacity-100! flex items-center shrink-0 transition-colors duration-300 cursor-pointer p-0.5"
          style={{
            color: 'var(--cinder-text-faint)',
            background: 'none',
            border: 'none',
          }}
          title="Session actions"
          onClick={() => setMenuOpen(v => !v)}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--cinder-flame)';
          }}
          onMouseLeave={e => {
            if (!menuOpen) {
              e.currentTarget.style.color = 'var(--cinder-text-faint)';
            }
          }}
        >
          <IconRename size={14} />
        </button>

        {menuOpen && createPortal(
          <div ref={menuContentRef}
            style={{
              position: 'fixed',
              top: (() => { const r = triggerRef.current?.getBoundingClientRect(); return r ? r.bottom + 4 : 0; })(),
              right: (() => { const r = triggerRef.current?.getBoundingClientRect(); return r ? window.innerWidth - r.right : 0; })(),
              background: 'rgba(10,8,6,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '2px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
              padding: '4px 0',
              minWidth: '130px',
              zIndex: 9999,
            }}
          >
            <button
              onClick={handleRename}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 font-[inherit] text-left cursor-pointer transition-colors duration-200"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '11px',
                letterSpacing: '0.05em',
                color: 'var(--cinder-text)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ fontSize: '10px', opacity: 0.5 }}>✎</span> Rename
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 font-[inherit] text-left cursor-pointer transition-colors duration-200"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '11px',
                letterSpacing: '0.05em',
                color: 'var(--cinder-flame)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,74,8,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ fontSize: '11px' }}>×</span> Delete
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

/* ── File chip — borderless ── */
const FileChip = ({ file, onDelete }) => {
  const ext = (file.name || file.file_name || '').split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <div className="group flex items-center gap-2 shrink-0 cursor-pointer transition-all duration-300"
      style={{ padding: '4px 0', background: 'none', border: 'none' }}>
      <span className="tx-decoration-mute shrink-0 transition-colors duration-300 font-light">
        {ext.substring(0, 3)}
      </span>
      <span className="tx-body-normal whitespace-nowrap transition-colors duration-300 font-light">
        {file.name || file.file_name || `File #${file.id}`}
      </span>
      <span className="tx-decoration-mute transition-colors duration-300 font-light">
        {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ProjectDetail
   ═══════════════════════════════════════════ */
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
  const [hoveredCrystal, setHoveredCrystal] = useState(false);
  const fileInputRef = useRef(null);

  /* ── Fetch sessions ── */
  useEffect(() => {
    if (!projectId) return;
    conversationsApi.listConversations()
      .then(data => {
        const projectSessions = (Array.isArray(data) ? data : [])
          .filter(c => getConvProjectId(c) === Number(projectId))
          .sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
        setSessions(projectSessions);
      })
      .catch(() => setSessions([]));
  }, [projectId, appState.refreshKey]);

  /* ── Fetch project files ── */
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
    setView('chat', { from: 'project', sessionId: session.id, sessionTitle: session.name, projectId, projectName: project?.name });
  };

  const handleSessionRename = (sessionId, newName) => {
    setSessions(prev => prev.map(c => c.id === sessionId ? { ...c, name: newName } : c));
  };

  const handleSessionDelete = (sessionId) => {
    setSessions(prev => prev.filter(c => c.id !== sessionId));
  };

  /* ── Not found ── */
  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-light" style={{ fontSize: '13px', color: 'var(--cinder-text-faint)', letterSpacing: '0.06em' }}>
          Project not found
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>

      {/* ═══ Fixed back bar — desktop only; mobile uses MobileHeader ═══ */}
      <div
        className="hidden md:flex items-center flex-shrink-0 px-6 md:px-10 py-3"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label="Project Hall" onClick={() => goBack()} />
      </div>

      {/* ═══ Scrollable content ═══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 md:px-10 py-[32px] pb-[120px] flex flex-col gap-8">

        {/* ═══ Header — project name + actions ═══ */}
        <section style={fadeUp(0)}>
          <div className="flex items-center gap-4">
            {/* Project name — centered */}
            <span
              className="flex-1 font-light text-center whitespace-nowrap tx-section-accent"
              style={{
                animation: 'breatheSlow 4s ease-in-out infinite',
              }}
            >
              {project.name}
            </span>

            {/* Actions — rename project + new session */}
            <div className="flex items-center gap-4">
              <IconBtn title="重命名项目" onClick={() => {
                const newName = prompt('Rename project:', project.name);
                if (newName && newName.trim() && newName !== project.name) {
                  projectsApi.updateProject(projectId, { name: newName.trim() })
                    .then(() => appState.setProjects?.(prev =>
                      prev.map(p => p.id === projectId ? { ...p, name: newName.trim() } : p)
                    ))
                    .catch(() => {});
                }
              }}>
                <IconRename size={16} />
              </IconBtn>
              <IconBtn title="新建会话" onClick={() => openNewSession({ projectId })}>
                <IconCreate size={16} />
              </IconBtn>
            </div>
          </div>
        </section>

        {/* ═══ System Prompt Crystal ═══ */}
        <section style={fadeUp(0.08)}
          onMouseEnter={() => setHoveredCrystal(true)}
          onMouseLeave={() => setHoveredCrystal(false)}
        >
          <div style={{ background: 'none', border: 'none', padding: 0 }}>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="tx-decoration-mute opacity-50">[</span>
              <span className="tx-decoration-mute font-light">
                SYSTEM PROMPT
              </span>
              <span className="tx-decoration-mute opacity-50">]</span>
              {!editingPrompt ? (
                <button
                  onClick={() => { setPromptDraft(project?.prompt || ''); setEditingPrompt(true); }}
                  className="ml-auto flex items-center cursor-pointer transition-all duration-400"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    color: hoveredCrystal ? 'var(--cinder-flame)' : 'var(--cinder-text-faint)',
                    opacity: hoveredCrystal ? 0.6 : 0,
                    filter: hoveredCrystal ? 'drop-shadow(0 0 4px rgba(255,74,8,0.3))' : 'none',
                  }}
                >
                  <IconPolygon size={14} />
                </button>
              ) : (
                <div className="flex items-center gap-3 ml-auto">
                  {savingPrompt && (
                    <span className="font-light" style={{ fontSize: '9px', color: 'var(--cinder-text-faint)' }}>
                      Saving...
                    </span>
                  )}
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
                    className="font-light cursor-pointer transition-colors duration-300"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.06em',
                      color: 'var(--cinder-flame)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                  >
                    Done
                  </button>
                  <button
                    onClick={() => setEditingPrompt(false)}
                    className="font-light cursor-pointer transition-colors duration-300"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.06em',
                      color: 'var(--cinder-text-faint)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-text-dim)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--cinder-text-faint)'; }}
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
                rows={4}
                className="w-full font-[inherit] font-light resize-none outline-none transition-all duration-300"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,74,8,0.3)',
                  padding: '8px 0',
                  fontSize: '13px',
                  lineHeight: '1.7',
                  letterSpacing: '0.03em',
                  color: 'rgba(205, 180, 150, 0.85)',
                }}
              />
            ) : (
              <p
                className={`font-light tx-body-normal ${project?.prompt ? 'text-[rgba(205,180,150,0.75)]' : 'tx-body-mute opacity-50'}`}
                style={{
                  lineHeight: '1.7',
                }}
              >
                {project?.prompt || 'No project prompt configured. Click the diamond icon to add one.'}
              </p>
            )}
          </div>
        </section>

        {/* ═══ Resources: Files + WorkDir ═══ */}
        <section style={fadeUp(0.14)} className="flex flex-col gap-4">
          <SectionHead label="RESOURCES" />
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

          {/* Files row: [polygon] | file chips */}
          <div className="flex items-center gap-3">
            {isUploading ? (
              <span className="font-light shrink-0" style={{ fontSize: '9px', color: 'var(--cinder-text-faint)' }}>Uploading...</span>
            ) : (
              <IconBtn title="上传文件" size="sm" onClick={() => fileInputRef.current?.click()}>
                <IconPolygon size={15} />
              </IconBtn>
            )}
            {files.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {files.map(f => (
                  <FileChip key={f.id} file={f} onDelete={handleDeleteFile} />
                ))}
                <div
                  className="flex items-center gap-2 shrink-0 cursor-pointer transition-colors duration-300"
                  style={{ padding: '4px 0', opacity: 0.4 }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--cinder-text-faint)' }}>+</span>
                  <span className="font-light" style={{ fontSize: '12px', color: 'var(--cinder-text-faint)' }}>Upload</span>
                </div>
              </div>
            ) : (
              <span className="font-light" style={{ fontSize: '12px', color: 'var(--cinder-text-faint)', opacity: 0.5 }}>
                No files uploaded
              </span>
            )}
          </div>

          {/* Workdir row: [polygon · flame if valid] | path */}
          <div className="flex items-center gap-3" style={{ padding: '6px 0' }}>
            <IconBtn
              title="编辑工作目录"
              size="sm"
              onClick={() => setShowWorkDirModal(true)}
              style={project?.work_dir ? { color: 'var(--cinder-flame)', opacity: 0.7 } : undefined}
            >
              <IconPolygon size={15} />
            </IconBtn>
            <span className={`font-light ${project?.work_dir ? 'tx-code-normal' : 'tx-code-mute'}`}>
              {project?.work_dir || '~ / (no working directory)'}
            </span>
          </div>
        </section>

        {/* ═══ Threads (Sessions) ═══ */}
        <section style={fadeUp(0.2)}>
          <div className="flex items-center justify-between mb-1">
            <SectionHead label="THREADS" />
            {sessions.length > 0 && (
              <span className="font-light" style={{ fontSize: '9px', letterSpacing: '0.04em', color: 'var(--cinder-text-faint)' }}>
                {sessions.length} sessions
              </span>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-light" style={{ fontSize: '12px', color: 'var(--cinder-text-faint)', letterSpacing: '0.06em' }}>
                No sessions in this project
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {sessions.map((s, i) => (
                <div key={s.id} style={fadeUp(0.22 + i * 0.04)}>
                  <ThreadRow
                    session={s}
                    agentName={(appState.presets?.find(p => p.id === s.agent_preset_id))?.name || s.agent_type || 'Agent'}
                    onClick={handleSessionClick}
                    onRename={handleSessionRename}
                    onDelete={handleSessionDelete}
                    openDestructor={openDestructor}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* WorkDir Modal */}
        <WorkDirModal
          projectId={projectId}
          currentWorkDir={project?.work_dir || ''}
          setProjects={appState.setProjects}
          isOpen={showWorkDirModal}
          onClose={() => setShowWorkDirModal(false)}
        />
      </div>
    </div>
  );
}
