import React, { useState, useEffect, useRef } from 'react';
import { baseUrl, getCsrfToken, MAIN_MODEL_IDS, configApi, useProfile } from 'exo-shared';
import { setAgentAvatar } from 'exo-shared/profile';
import EditPresetModal from '../components/modals/EditPresetModal';
import AvatarCropModal from '../components/modals/AvatarCropModal';
import SessionActionsMenu from '../components/chat/SessionActionsMenu';
import BackToUpper from '../components/layout/BackButton';
import { Button } from '../components/ui';

/* ── Motion helper ── */
const fadeUp = (delay) => ({
  animation: `fadeUp .5s ${delay}s cubic-bezier(.22,1,.36,1) both`,
});

/* ── Section head atom ── */
const SectionHead = ({ label, className = "tx-section-normal" }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-[18px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
    <span className={className}>
      {label}
    </span>
  </div>
);

/* ── Geometric SVG icons ── */
const IconRename = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="0.7" strokeLinecap="round">
    <line x1="7" y1="10" x2="7" y2="14" />
    <line x1="12" y1="6" x2="12" y2="18" />
    <line x1="17" y1="9" x2="17" y2="15" />
  </svg>
);

const IconCreate = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <line x1="4" y1="19" x2="20" y2="19" />
    <polygon points="12,5 13,11 19,12 13,13 12,19 11,13 5,12 11,11" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1.2" />
    <line x1="7.5" y1="16" x2="5.5" y2="14" />
    <line x1="16.5" y1="16" x2="18.5" y2="14" />
  </svg>
);

const IconMemory = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="4" x2="12" y2="9" />
    <line x1="12" y1="15" x2="12" y2="20" />
    <line x1="4" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="20" y2="12" />
  </svg>
);

const IconLock = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <rect x="7" y="11" width="10" height="9" rx="1" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/* ═══════════════════════════════════════════
   AgentProfile
   ═══════════════════════════════════════════ */
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
  const [mainModels, setMainModels] = useState(null);

  const nameInputRef = useRef(null);
  const descInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (preset) refresh();
  }, [preset?.id]);

  useEffect(() => {
    let ignore = false;
    configApi.getModelCatalog().then(catalog => {
      if (ignore) return;
      let mainRolesList = [];
      if (catalog?.roles) {
        if (Array.isArray(catalog.roles)) {
          mainRolesList = catalog.roles.filter(r => r.role === 'main');
        } else {
          mainRolesList = catalog.roles.main || [];
        }
      }
      const mainNames = [...new Set(mainRolesList.map(r => r.model))];
      setMainModels(mainNames.length > 0 ? mainNames : MAIN_MODEL_IDS);
    }).catch(() => {
      if (!ignore) setMainModels(MAIN_MODEL_IDS);
    });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (preset) setModelDraft(preset.default_model || '');
  }, [preset?.id]);

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

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);
  useEffect(() => {
    if (editingDesc && descInputRef.current) descInputRef.current.focus();
  }, [editingDesc]);

  if (!preset) {
    return (
      <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>
        <div
          className="hidden md:flex items-center flex-shrink-0 px-4 md:px-12 py-3"
          style={{ borderBottom: '1px solid var(--cinder-line)' }}
        >
          <BackToUpper label="Agent Hub" onClick={() => goBack()} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="tx-body-mute">
            Agent not found
          </p>
        </div>
      </div>
    );
  }

  const isG045 = preset.agent_type === 'g045';
  const isSuperior = preset.agent_type === 'superior';
  const showMemoryBtn = isG045 || isSuperior;

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
    if (!trimmed || trimmed === preset.name) { setEditingName(false); return; }
    setSavingField('name');
    try { await patchPreset({ name: trimmed }); setEditingName(false); }
    catch { }
    finally { setSavingField(null); }
  };

  const handleDescSave = async () => {
    const trimmed = descDraft.trim();
    if (trimmed === (preset.description || '')) { setEditingDesc(false); return; }
    setSavingField('description');
    try { await patchPreset({ description: trimmed }); setEditingDesc(false); }
    catch { }
    finally { setSavingField(null); }
  };

  const handleModelChange = (e) => setModelDraft(e.target.value);
  const handleModelBlur = () => {
    if (modelDraft !== (preset.default_model || '')) {
      patchPreset({ default_model: modelDraft }).catch(() => setModelDraft(preset.default_model || ''));
    }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();
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
    if (appState.activeSessionId === sessionId) appState.setActiveSessionId(null);
  };

  const formatLastActive = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const bannerTint = (() => {
    const m = (preset.default_model || '').toLowerCase();
    if (m.includes('claude')) return 'rgba(100,50,150,0.03)';
    if (m.includes('gpt') || m.includes('openai')) return 'rgba(50,100,200,0.03)';
    return 'rgba(196,77,0,0.03)';
  })();

  const typeBadgeStyle = isG045
    ? { background: 'rgba(255,74,8,0.12)', color: 'var(--cinder-flame)', border: '1px solid rgba(255,74,8,0.25)' }
    : isSuperior
    ? { background: 'rgba(168,122,255,0.08)', color: 'rgb(188,148,255)', border: '1px solid rgba(168,122,255,0.2)' }
    : { background: 'rgba(100,160,220,0.08)', color: 'rgb(130,180,230)', border: '1px solid rgba(100,160,220,0.2)' };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div
        className="hidden md:flex items-center flex-shrink-0 px-4 md:px-12 py-3"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label="Agent Hub" onClick={() => goBack()} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 md:px-10 py-[32px] pb-[120px] flex flex-col gap-8">

          {/* Banner */}
          <section style={fadeUp(0)}>
            <div
              className="relative"
              style={{
                minHeight: '100px',
                background: bannerTint,
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid var(--cinder-line)',
                borderRadius: '4px 4px 0 0',
              }}
            />
            <div className="flex justify-center" style={{ marginTop: '-36px' }}>
              <button
                onClick={handleAvatarClick}
                className="group relative"
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <img
                  src={avatarUrl}
                  alt={preset.name}
                  className="w-full h-full object-cover rounded-full"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 0 16px rgba(255,74,8,0.15)',
                    background: 'var(--cinder-base)',
                  }}
                />
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <IconRename size={16} />
                </div>
              </button>
            </div>
          </section>

          {/* ═══ Identity ═══ */}
          <section style={fadeUp(0.06)} className="flex flex-col items-center gap-2 -mt-2">
            {/* Agent Name -> tx-section-normal */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
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
                  className="tx-section-normal text-center outline-none"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--cinder-flame)',
                    padding: '2px 0',
                    minWidth: '120px',
                  }}
                />
              ) : (
                <h2
                  onClick={() => { setNameDraft(preset.name); setEditingName(true); }}
                  className="tx-section-normal cursor-pointer transition-colors duration-300"
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-flame)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = ''; }}
                >
                  {preset.name}
                </h2>
              )}
              {isG045 && (
                <span style={{ color: 'var(--cinder-ember-dim)', display: 'flex', alignItems: 'center' }} title="Immutable">
                  <IconLock size={12} />
                </span>
              )}
              <span
                className="tx-decoration-mute tracking-wider whitespace-nowrap"
                style={{ padding: '2px 8px', borderRadius: '2px', ...typeBadgeStyle }}
              >
                {preset.agent_type === 'g045' ? 'G045' : preset.agent_type}
              </span>
              {savingField === 'name' && (
                <span className="tx-decoration-accent" style={{ animation: 'breathe 1s ease-in-out infinite' }}>
                  saving...
                </span>
              )}
            </div>

            {/* Bios -> tx-subtitle-normal */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
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
                  placeholder="Add a description..."
                  className="tx-subtitle-normal italic text-center outline-none w-full min-w-[200px]"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--cinder-flame)',
                    padding: '2px 0',
                  }}
                />
              ) : (
                <p
                  onClick={() => { setDescDraft(preset.description || ''); setEditingDesc(true); }}
                  className="tx-subtitle-normal italic cursor-pointer transition-colors duration-300"
                  style={{ opacity: preset.description ? 1 : 0.5 }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-flame-dim)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = ''; }}
                >
                  {preset.description || 'Click to add a description...'}
                </p>
              )}
              {savingField === 'description' && (
                <span className="tx-decoration-accent" style={{ animation: 'breathe 1s ease-in-out infinite' }}>
                  saving...
                </span>
              )}
            </div>

            {/* Model & ModelName Selector -> tx-decoration-normal */}
            <div className="flex items-center gap-2 mt-1">
              <span className="tx-decoration-normal">
                Model:
              </span>
              <select
                value={modelDraft}
                onChange={handleModelChange}
                onBlur={handleModelBlur}
                className="tx-decoration-normal outline-none cursor-pointer transition-all duration-300"
                style={{
                  background: 'var(--cinder-glass)',
                  border: '1px solid var(--cinder-line)',
                  borderRadius: '12px',
                  padding: '4px 12px',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                }}
              >
                {!preset.default_model && <option value="">Select a model...</option>}
                {(mainModels ?? MAIN_MODEL_IDS).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {savingField === 'default_model' && (
                <span className="tx-decoration-accent" style={{ animation: 'breathe 1s ease-in-out infinite' }}>
                  saving...
                </span>
              )}
            </div>

            {saveError && (
              <p className="tx-decoration-accent" style={{ opacity: 0.7, marginTop: '4px' }}>{saveError}</p>
            )}
          </section>

          {/* ═══ Action buttons -> tx-decoration-normal ═══ */}
          <section style={fadeUp(0.1)} className="flex items-center gap-4 justify-center">
            <Button variant="primary" onClick={() => openNewSession({ presetId: preset.id })}>
              <IconCreate size={14} /> New Session
            </Button>
            {showMemoryBtn && (
              <Button variant="primary" className="!border-purple-400/25 !text-purple-300 hover:!bg-purple-400/5 hover:!border-purple-400/50" onClick={() => setView('agent_memory', { agentId: preset.id, agentName: preset.name })}>
                <IconMemory size={14} /> Manage Memory
              </Button>
            )}
          </section>

          {/* ═══ [SYSTEM PROMPT] Box ═══ */}
          <section style={fadeUp(0.14)}>
            <div style={{ background: 'none', border: 'none', padding: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="tx-system-mute" style={{ opacity: 0.5 }}>[</span>
                <span className="tx-system-mute">
                  SYSTEM PROMPT
                </span>
                <span className="tx-system-mute" style={{ opacity: 0.5 }}>]</span>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="ml-auto flex items-center cursor-pointer transition-colors duration-400"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    color: 'var(--cinder-text-dim)',
                    opacity: 0.6,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.color = 'var(--cinder-flame)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.color = 'var(--cinder-text-dim)';
                  }}
                >
                  <IconRename size={14} />
                </button>
              </div>

              {/* Prompt itself -> tx-system-normal */}
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full text-left font-[inherit] cursor-pointer transition-all duration-300"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <p
                  className={preset?.system_prompt ? 'tx-system-normal' : 'tx-system-mute'}
                  style={{ opacity: preset?.system_prompt ? 1 : 0.5 }}
                >
                  {preset?.system_prompt
                    ? preset.system_prompt.slice(0, 200) + (preset.system_prompt.length > 200 ? '...' : '')
                    : 'No system prompt configured. Click the edit icon to add one.'}
                </p>
              </button>
            </div>
          </section>

          {/* ═══ Threads (Sessions) ═══ */}
          <section style={fadeUp(0.24)}>
            <div className="flex items-center justify-between mb-1">
              {/* THREADS -> tx-nav-accent */}
              <SectionHead label="THREADS" className="tx-nav-accent" />
              {sessions.length > 0 && (
                <span className="tx-decoration-mute">
                  {sessions.length} sessions
                </span>
              )}
            </div>

            {sessionsLoading ? (
              <p className="tx-system-normal py-4">
                Loading sessions...
              </p>
            ) : sessions.length === 0 ? (
              <p className="tx-system-normal py-4">
                No sessions yet.
              </p>
            ) : (
              <div className="flex flex-col">
                {sessions.map((s, i) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-3 w-full transition-colors duration-300"
                    onClick={() => handleSessionClick(s)}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderImage = 'linear-gradient(90deg, transparent, rgba(255,74,8,0.35) 20%, rgba(255,74,8,0.35) 80%, transparent) 1';
                      e.currentTarget.style.background = 'var(--cinder-glass)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderImage = 'none';
                      e.currentTarget.style.borderBottom = '1px solid var(--cinder-line)';
                      e.currentTarget.style.background = 'none';
                    }}
                    style={{
                      ...fadeUp(0.26 + i * 0.03),
                      cursor: 'pointer',
                      padding: '12px 0',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--cinder-line)',
                    }}
                  >
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ background: 'var(--cinder-ember-dim)' }}
                    />
                    {/* 会话列表名称 -> tx-system-normal */}
                    <span className="tx-system-normal flex-1 truncate">
                      {s.name || `Session #${s.id}`}
                    </span>
                    <span className="tx-decoration-mute shrink-0">
                      {formatLastActive(s.last_message_at)}
                      {s.message_count != null && ` · ${s.message_count} msgs`}
                    </span>
                    <SessionActionsMenu
                      session={s}
                      onUpdated={handleSessionRename}
                      onDeleted={handleSessionDelete}
                      openDestructor={appState.openDestructor}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

      {/* ════════════ 隔离线 ════════════ */}
      <div className="h-px opacity-20 my-2" style={{ background: 'linear-gradient(90deg, transparent, var(--tx-neutral-40) 50%, transparent)' }} />

      {/* 6. Danger Zone (沉底，压小层级) */}
      {!isG045 && (
        <section style={fadeUp(0.22)} className="pt-2">
          <div className="flex items-center justify-between opacity-45 hover:opacity-100 transition-opacity duration-300">

            {/* 左侧：Tier 切换器，缩成小配置文件样式 */}
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rotate-45" style={{ background: 'var(--tx-warm-ember)' }} />
              <span className="tx-decoration-normal uppercase tracking-wider text-[10px]">
                Tier Configuration:
              </span>
              <select
                value={preset.agent_type}
                onChange={(e) => {
                  const newType = e.target.value;
                  if (newType !== preset.agent_type) {
                    patchPreset({ agent_type: newType }).catch(() => {});
                  }
                }}
                className="tx-decoration-normal outline-none cursor-pointer bg-transparent border-none p-0 text-[11px] text-orange-600/70 hover:text-orange-500"
              >
                <option value="superior">Superior</option>
                <option value="standard">Standard</option>
              </select>
            </div>

            {/* 右侧：极致纤细的抹除按钮，剥离边框，只有微弱下划线 */}
            <button
              onClick={() => {
                appState.openDestructor?.({
                  title: preset.name,
                  onDelete: async () => {
                    try {
                      await fetch(`${baseUrl}/api/agents/presets/${preset.id}/`, {
                        method: 'DELETE',
                        headers: { 'X-CSRFToken': getCsrfToken() },
                        credentials: 'include',
                      });
                      refreshPresets();
                      goBack();
                    } catch (err) {
                      console.error('Failed to delete preset', err);
                    }
                  },
                });
              }}
              className="tx-decoration-normal cursor-pointer bg-transparent border-none p-0 text-[10px] tracking-widest uppercase transition-all duration-300"
              style={{
                color: 'var(--tx-warm-flame)',
                borderBottom: '1px dashed rgba(231, 77, 2, 0.25)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--tx-warm-gold)';
                e.currentTarget.style.borderBottomColor = 'var(--tx-warm-gold)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--tx-warm-flame)';
                e.currentTarget.style.borderBottomColor = 'rgba(231, 77, 2, 0.25)';
              }}
            >
          [ ERASE ENTITY // 抹除 ]
        </button>
      </div>
    </section>
  )}
</div>

        </div>

      <EditPresetModal
        isOpen={showEditModal}
        preset={preset}
        mode="system_prompt"
        onClose={() => setShowEditModal(false)}
        onSaved={() => { refreshPresets(); setShowEditModal(false); }}
      />

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