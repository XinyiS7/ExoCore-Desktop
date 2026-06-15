import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, Pencil } from 'lucide-react';
import { baseUrl, getCsrfToken, MAIN_MODEL_IDS, useProfile } from 'exo-shared';
import { setAgentAvatar } from 'exo-shared/profile';
import EditPresetModal from '../components/modals/EditPresetModal';
import AvatarCropModal from '../components/modals/AvatarCropModal';
import SessionActionsMenu from '../components/chat/SessionActionsMenu';
import BackToUpper from '../components/layout/BackButton';

export default function AgentProfile({ appState, setView, goBack, viewParams }) {
 const { presets, setActiveSessionId, openNewSession, refreshKey, refreshPresets } = appState;
 const preset = presets.find(p => p.id === viewParams.agentId);

 const { agentAvatars, refresh } = useProfile();
 const avatarUrl = agentAvatars[viewParams.agentId] ||
 `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(preset?.name || viewParams.agentId)}`;
 const [editingName, setEditingName] = useState(false);
 const [nameDraft, setNameDraft] = useState('');
 const [editingDesc, setEditingDesc] = useState(false);
 const [descDraft, setDescDraft] = useState('');
 const [savingField, setSavingField] = useState(null);
 const [saveError, setSaveError] = useState(null);
 const [sessions, setSessions] = useState([]);
 const [sessionsLoading, setSessionsLoading] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [cropFile, setCropFile] = useState(null);
 const [modelDraft, setModelDraft] = useState(preset?.default_model || '');

 const nameInputRef = useRef(null);
 const descInputRef = useRef(null);
 const fileInputRef = useRef(null);

 // Avatar updates via shared useProfile — refresh when preset changes
 useEffect(() => {
 if (preset) refresh();
 }, [preset?.id]);

 // Sync modelDraft when preset loads
 useEffect(() => {
 if (preset) setModelDraft(preset.default_model || '');
 }, [preset?.id]);

 // Fetch sessions filtered by this preset
 useEffect(() => {
 if (!preset) return;
 const controller = new AbortController();
 let ignore = false;
 setSessionsLoading(true);

 fetch(`${baseUrl}/api/agents/conversations/`, { credentials: 'include', signal: controller.signal })
  .then(res => res.json())
  .then(data => {
  if (ignore) return;
  const agentSessions = (Array.isArray(data) ? data : [])
   .filter(c => c.agent_preset_id === preset.id)
   .sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
  setSessions(agentSessions);
  setSessionsLoading(false);
  })
  .catch(err => {
  if (err.name !== 'AbortError') {
   setSessions([]);
   setSessionsLoading(false);
  }
  });

 return () => { ignore = true; controller.abort(); };
 }, [preset?.id, refreshKey]);

 // Focus name input when editing starts
 useEffect(() => {
 if (editingName && nameInputRef.current) nameInputRef.current.focus();
 }, [editingName]);

 // Focus desc input when editing starts
 useEffect(() => {
 if (editingDesc && descInputRef.current) descInputRef.current.focus();
 }, [editingDesc]);

 if (!preset) {
 return (
  <div className="flex-1 flex items-center justify-center text-exo-muted">
  <p className=" text-sm">Agent not found</p>
  </div>
 );
 }

 const typeBadgeClass = preset.agent_type === 'g045'
 ? 'bg-exo-accent/15 text-exo-accent border border-exo-accent/30'
 : preset.agent_type === 'superior'
  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';

 const showMemoryBtn = preset.agent_type === 'g045' || preset.agent_type === 'superior';

 const patchPreset = async (fields) => {
 setSavingField(Object.keys(fields)[0]);
 const res = await fetch(`${baseUrl}/api/agents/presets/${preset.id}/`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
  credentials: 'include',
  body: JSON.stringify(fields),
 });
 if (!res.ok) {
  setSaveError(`Failed to save (${res.status})`);
  throw new Error(`Failed to save (${res.status})`);
 }
 refreshPresets();
 setSaveError(null);
 setSavingField(null);
 };

 const handleNameSave = async () => {
 const trimmed = nameDraft.trim();
 if (!trimmed || trimmed === preset.name) {
  setEditingName(false);
  return;
 }
 setSavingField('name');
 try {
  await patchPreset({ name: trimmed });
  setEditingName(false);
 } catch {
  // keep editor open, error already set by patchPreset
 } finally {
  setSavingField(null);
 }
 };

 const handleDescSave = async () => {
 const trimmed = descDraft.trim();
 if (trimmed === (preset.description || '')) {
  setEditingDesc(false);
  return;
 }
 setSavingField('description');
 try {
  await patchPreset({ description: trimmed });
  setEditingDesc(false);
 } catch {
  // keep editor open, error already set by patchPreset
 } finally {
  setSavingField(null);
 }
 };

 const handleModelChange = (e) => {
 setModelDraft(e.target.value);
 };

 const handleModelBlur = () => {
 if (modelDraft !== (preset.default_model || '')) {
  patchPreset({ default_model: modelDraft }).catch(() => setModelDraft(preset.default_model || ''));
 }
 };

 const handleAvatarClick = () => {
 fileInputRef.current?.click();
 };

 const handleFileChange = (e) => {
 const file = e.target.files?.[0];
 if (file) setCropFile(file);
 e.target.value = '';
 };

 const handleCropConfirm = (dataUrl) => {
 setAgentAvatar(preset.id, dataUrl);
 refresh();
 setCropFile(null);
 };

 const handleSessionClick = (session) => {
 setActiveSessionId(session.id);
 setView('chat', { from: 'agent', sessionId: session.id, agentId: preset.id, agentName: preset.name, sessionTitle: session.name });
 };

 const handleSessionRename = (sessionId, newName) => {
 setSessions(prev => prev.map(c => c.id === sessionId ? { ...c, name: newName } : c));
 };

 const handleSessionDelete = (sessionId) => {
 setSessions(prev => prev.filter(c => c.id !== sessionId));
 if (appState.activeSessionId === sessionId) {
  appState.setActiveSessionId(null);
 }
 };

 const formatLastActive = (dateStr) => {
 if (!dateStr) return '';
 const d = new Date(dateStr);
 const now = new Date();
 const diffMs = now - d;
 const diffMin = Math.floor(diffMs / 60000);
 if (diffMin < 1) return 'just now';
 if (diffMin < 60) return `${diffMin}m ago`;
 const diffHr = Math.floor(diffMin / 60);
 if (diffHr < 24) return `${diffHr}h ago`;
 const diffDay = Math.floor(diffHr / 24);
 if (diffDay < 7) return `${diffDay}d ago`;
 return d.toLocaleDateString();
 };

 return (
 <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>
  {/* Hidden file input for avatar upload */}
  <input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={handleFileChange}
  />

  {/* Back bar — desktop only; mobile uses MobileHeader */}
  <div
    className="hidden md:flex items-center flex-shrink-0 px-4 md:px-12 py-3"
    style={{ borderBottom: '1px solid var(--cinder-line)' }}
  >
  <BackToUpper label="Agent Hub" onClick={() => goBack()} />
  </div>

  <div className="flex-1 overflow-y-auto">
  {/* Profile Area */}
  <div className="px-4 md:px-12 py-6 border-b border-exo-border">
   {/* Avatar + Info + Buttons row */}
   <div className="flex flex-wrap gap-4">
   {/* Avatar */}
   <div className="flex-shrink-0">
    <button onClick={handleAvatarClick} className="group relative">
    <img
     src={avatarUrl}
     alt={preset.name}
     className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-md border border-exo-border object-cover bg-exo-bg"
    />
    <div className="absolute inset-0 rounded-md bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
     <Pencil size={16} className="text-white" />
    </div>
    </button>
   </div>

   {/* Info column */}
   <div className="flex-1 min-w-0 min-[480px]:min-w-[200px] space-y-2.5">
    {/* Name + Badge */}
    <div className="flex items-center gap-3 flex-wrap">
    {editingName ? (
     <input
     ref={nameInputRef}
     value={nameDraft}
     onChange={e => setNameDraft(e.target.value)}
     onBlur={handleNameSave}
     onKeyDown={e => {
      if (e.key === 'Enter') handleNameSave();
      if (e.key === 'Escape') setEditingName(false);
     }}
     className="bg-transparent border-b-2 border-exo-accent text-lg font-medium text-white outline-none py-0.5 min-w-[120px]"
     />
    ) : (
     <h2
     onClick={() => { setNameDraft(preset.name); setEditingName(true); }}
     className="text-lg font-medium text-white cursor-pointer hover:border-b-2 hover:border-exo-accent/30 transition-all"
     >
     {preset.name}
     </h2>
    )}
    <span className={`text-[10px] tracking-wider px-2 py-0.5 rounded ${typeBadgeClass}`}>
     {preset.agent_type}
    </span>
    {savingField === 'name' && (
     <span className="text-[10px] text-exo-accent animate-pulse">saving...</span>
    )}
    </div>

    {/* Description */}
    {editingDesc ? (
    <input
     ref={descInputRef}
     value={descDraft}
     onChange={e => setDescDraft(e.target.value)}
     onBlur={handleDescSave}
     onKeyDown={e => {
     if (e.key === 'Enter') handleDescSave();
     if (e.key === 'Escape') setEditingDesc(false);
     }}
     className="bg-transparent border-b-2 border-exo-accent text-sm text-exo-muted italic outline-none py-0.5 w-full"
     placeholder="Add a description..."
    />
    ) : (
    <p
     onClick={() => { setDescDraft(preset.description || ''); setEditingDesc(true); }}
     className="text-sm text-exo-muted italic cursor-pointer hover:border-b-2 hover:border-exo-accent/30 transition-all inline-block"
    >
     {preset.description || 'Click to add a description...'}
    </p>
    )}
    {savingField === 'description' && (
    <span className="text-[10px] text-exo-accent animate-pulse">saving...</span>
    )}

    {/* Model */}
    <div className="flex items-center gap-2">
    <span className="text-[10px] tracking-wider text-exo-muted">Model:</span>
    <select
     value={modelDraft}
     onChange={handleModelChange}
     onBlur={handleModelBlur}
     className="bg-exo-panel border border-exo-border rounded px-2 py-1 text-xs text-exo-text outline-none focus:border-exo-accent/40 transition-colors cursor-pointer"
    >
     {!preset.default_model && <option value="">Select a model...</option>}
     {MAIN_MODEL_IDS.map(m => (
     <option key={m} value={m}>{m}</option>
     ))}
    </select>
    {savingField === 'default_model' && (
     <span className="text-[10px] text-exo-accent animate-pulse">saving...</span>
    )}
    </div>
   </div>

   {/* Action buttons — desktop: inline right; mobile: full-width wrap below */}
   <div className="flex items-start gap-2 w-full md:w-auto md:self-start">
    <button
    onClick={() => openNewSession({ presetId: preset.id })}
    className="flex items-center gap-2 px-4 py-2 bg-exo-accent/10 border border-exo-accent/30 rounded-md text-exo-accent text-xs font-medium hover:bg-exo-accent/20 active:scale-95 transition-all"
    >
    <Plus size={14} strokeWidth={1.5} />
    New Session
    </button>
    {showMemoryBtn && (
    <button
     onClick={() => setView('agent_memory', { agentId: preset.id, agentName: preset.name })}
     className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-400 text-xs font-medium hover:bg-purple-500/20 active:scale-95 transition-all"
    >
     Manage Memory
    </button>
    )}
   </div>
   </div>

   {saveError && (
   <p className="text-[10px] text-red-400 mt-2">{saveError}</p>
   )}

   {/* System Prompt Bar */}
   <div className="mt-4">
   <button
    onClick={() => setShowEditModal(true)}
    className="w-full group flex items-center gap-2 bg-exo-panel border border-exo-border rounded-md px-4 py-2.5 hover:border-exo-accent/30 transition-all text-left"
   >
    <Pencil size={14} className="text-exo-muted group-hover:text-exo-accent transition-colors flex-shrink-0" />
    <div className="flex-1 min-w-0">
    <p className="text-xs text-exo-text/60 truncate">
     {preset.system_prompt
     ? preset.system_prompt.slice(0, 120) + (preset.system_prompt.length > 120 ? '...' : '')
     : 'No system prompt configured.'}
    </p>
    </div>
    <span className="text-[10px] text-exo-muted group-hover:text-exo-accent transition-colors flex-shrink-0">Click to edit</span>
   </button>
   </div>
  </div>

  {/* Sessions List */}
  <div className="px-4 md:px-12 py-6">
   <h3 className="text-[10px] tracking-[0.3em] text-exo-muted mb-4">Sessions</h3>
   {sessionsLoading ? (
   <p className="text-xs text-exo-muted">Loading sessions...</p>
   ) : sessions.length === 0 ? (
   <p className="text-xs text-exo-muted">No sessions yet.</p>
   ) : (
   <div className="space-y-2">
    {sessions.map(s => (
    <button
     key={s.id}
     data-session-id={s.id}
     onClick={() => handleSessionClick(s)}
     className="group flex items-center gap-3 w-full p-3 bg-exo-panel border border-exo-border rounded-md hover:border-exo-accent/30 transition-all text-left"
    >
     <div className="p-2 rounded-md bg-exo-accent/5 border border-exo-border text-exo-accent group-hover:shadow-glow-gold transition-all">
     <MessageSquare size={14} strokeWidth={1.5} />
     </div>
     <div className="flex-1 min-w-0">
     <p className="text-xs font-medium text-white truncate">{s.name || `Session #${s.id}`}</p>
     <p className="text-[10px] text-exo-muted mt-0.5">
      {formatLastActive(s.last_message_at)}
      {s.message_count != null && ` · ${s.message_count} msgs`}
     </p>
     </div>
     <SessionActionsMenu
     session={s}
     onUpdated={handleSessionRename}
     onDeleted={handleSessionDelete}
     openDestructor={appState.openDestructor}
     />
    </button>
    ))}
   </div>
   )}
  </div>
  </div>

  {/* EditPresetModal for system prompt editing */}
  <EditPresetModal
  isOpen={showEditModal}
  preset={preset}
  mode="system_prompt"
  onClose={() => setShowEditModal(false)}
  onSaved={() => { refreshPresets(); setShowEditModal(false); }}
  />

  {/* AvatarCropModal */}
  {cropFile && (
  <AvatarCropModal
   file={cropFile}
   onConfirm={handleCropConfirm}
   onCancel={() => setCropFile(null)}
  />
  )}

 </div>
 );
}
