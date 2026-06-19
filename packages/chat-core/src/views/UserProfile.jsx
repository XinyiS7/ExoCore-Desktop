import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pencil, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import AvatarCropModal from '../components/modals/AvatarCropModal';
import EditPresetModal from '../components/modals/EditPresetModal';
import BackToUpper from '../components/layout/BackButton';
import { telemetryApi, MODEL_REGISTRY } from 'exo-shared';
import { setUserAvatar, getUserAvatar } from 'exo-shared/profile';
import { useUserPreset } from '../hooks/useUserPreset';

// ─── Motion helper ──────────────────────────────────────────────────────────────
const fadeUp = (delay) => ({
  animation: `fadeUp .5s ${delay}s cubic-bezier(.22,1,.36,1) both`,
});

// ─── Section head atom ──────────────────────────────────────────────────────────
const SectionHead = ({ label, children }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-[18px] h-px" style={{ background: 'var(--cinder-line-glow)' }} />
    <span className="tx-section-normal font-light">
      {label}
    </span>
    {children && <span style={{ marginLeft: 'auto' }}>{children}</span>}
  </div>
);

// ─── Chart helpers ──────────────────────────────────────────────────────────────
const MODEL_COLOR_MAP = Object.fromEntries(MODEL_REGISTRY.map(m => [m.id, m.color]));
const DEFAULT_COLOR = '#94a3b8';
const modelColor = (model) => MODEL_COLOR_MAP[model] ?? DEFAULT_COLOR;

const PLATFORM_KEYS = ['all', ...new Set(MODEL_REGISTRY.map(m => m.platform))];
const PLATFORM_LABELS = { all: '全部', gemini: 'Gemini', deepseek: 'DeepSeek' };
const PLATFORMS = PLATFORM_KEYS.map(key => ({ key, label: PLATFORM_LABELS[key] ?? key }));

const modelMatchesPlatform = (model, platform) => {
  if (platform === 'all') return true;
  return MODEL_REGISTRY.find(m => m.id === model)?.platform === platform;
};

const toDateStr = (d) => d.toISOString().slice(0, 10);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-exo-panel border border-exo-border rounded-[3px] px-3 py-2 text-[0.6875rem] shadow-xl">
      <p className="tx-body-mute mb-1.5 tracking-widest text-[0.5625rem]">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="tx-body-normal opacity-70">{p.name}:</span>
          <span className="tx-body-normal font-bold">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const ChartSummary = ({ data, models, valueKey }) => {
  if (!data?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
      {models.map(model => {
        const total = data.reduce((s, d) => s + (d[`${model}_${valueKey}`] ?? 0), 0);
        const convTotal = data.reduce((s, d) => s + (d[`${model}_convs`] ?? 0), 0);
        const avg = convTotal > 0 ? Math.round(total / convTotal) : 0;
        if (total === 0) return null;
        return (
          <div key={model} className="flex items-center gap-2 text-[0.625rem] ">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: modelColor(model) }} />
            <span className="tx-body-mute truncate max-w-[100px]" title={model}>{model}</span>
            <span className="tx-body-normal">{total.toLocaleString()}</span>
            <span className="tx-body-mute">·</span>
            <span className="tx-body-mute">{convTotal} 会话</span>
            <span className="tx-body-mute">·</span>
            <span className="tx-body-mute">均 {avg.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
};

const ChartBlock = ({ title, data, models, valueKey }) => {
  return (
    <div className="shrink-0">
      <p className="text-[0.625rem] font-bold tracking-[0.25em] tx-body-mute mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#818190', fontSize: 9, fontFamily: 'var(--font-code)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#818190', fontSize: 9, fontFamily: 'var(--font-code)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} />
          {models.map(model => (
            <Line
              key={model}
              type="monotone"
              dataKey={`${model}_${valueKey}`}
              name={model}
              stroke={modelColor(model)}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <ChartSummary data={data} models={models} valueKey={valueKey} />
    </div>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────────
export default function UserProfile({ appState, setView, goBack }) {
  const { presets, refreshPresets } = appState;

  // User identity — resolved from AgentPreset with agent_type='user'
  const { userPreset, updateUserPreset, saving: hookSaving, error: saveError } = useUserPreset(presets, refreshPresets);

  const user = userPreset;
  const userId = user?.id;

  // Avatar — unified user avatar via shared profile module
  const [avatarUrl, setAvatarUrl] = useState(() => getUserAvatar());

  useEffect(() => {
    setAvatarUrl(getUserAvatar());
  }, [userId]);

  // Editable fields
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [editingModel, setEditingModel] = useState(false);
  const [modelDraft, setModelDraft] = useState('');
  const [fieldSaving, setFieldSaving] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [cropFile, setCropFile] = useState(null);
  const avatarInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const descInputRef = useRef(null);
  const modelInputRef = useRef(null);

  // Sync modelDraft when user changes
  useEffect(() => {
    setModelDraft(user?.default_model || 'Human');
  }, [user?.id, user?.default_model]);

  // Focus inputs on edit
  useEffect(() => { if (editingName && nameInputRef.current) nameInputRef.current.focus(); }, [editingName]);
  useEffect(() => { if (editingDesc && descInputRef.current) descInputRef.current.focus(); }, [editingDesc]);
  useEffect(() => { if (editingModel && modelInputRef.current) modelInputRef.current.focus(); }, [editingModel]);

  // Cross-tab sync for avatar
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'exo_user_avatar') {
        setAvatarUrl(e.newValue || '');
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ─── Stats state ───
  const [platform, setPlatform] = useState('all');
  const [mode, setMode] = useState('week');
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
  });
  const [rawData, setRawData] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(false);

  // ─── Patch user preset ───
  const patchUser = async (fields) => {
    if (!user) return;
    setFieldSaving(Object.keys(fields)[0]);
    try {
      await updateUserPreset(fields);
    } finally {
      setFieldSaving(null);
    }
  };

  // ─── Fetch stats ───
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(false);
    try {
      const data = await telemetryApi.getDailyUsage({ mode, from: toDateStr(anchor) });
      setRawData(data);
    } catch {
      setStatsError(true);
      setRawData(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [anchor, mode]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Avatar ───
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    e.target.value = '';
  };

  const handleCropConfirm = (dataUrl) => {
    setUserAvatar(dataUrl);
    setAvatarUrl(dataUrl);
    setCropFile(null);
  };

  // ─── Name edit ───
  const startEditName = () => {
    if (!user) return;
    setNameDraft(user.name);
    setEditingName(true);
  };
  const saveName = () => {
    const v = nameDraft.trim();
    if (!v || v === user?.name) { setEditingName(false); return; }
    patchUser({ name: v });
    setEditingName(false);
  };

  // ─── Description / Signature edit ───
  const startEditDesc = () => {
    setDescDraft(user?.description || '');
    setEditingDesc(true);
  };
  const saveDesc = () => {
    const v = descDraft.trim();
    if (v === (user?.description || '')) { setEditingDesc(false); return; }
    patchUser({ description: v });
    setEditingDesc(false);
  };

  // ─── Model edit ───
  const startEditModel = () => {
    setModelDraft(user?.default_model || 'Human');
    setEditingModel(true);
  };
  const saveModel = () => {
    const v = modelDraft.trim();
    if (!v || v === (user?.default_model || 'Human')) { setEditingModel(false); return; }
    patchUser({ default_model: v });
    setEditingModel(false);
  };

  // ─── Period nav ───
  const prevPeriod = () => setAnchor(a => {
    const d = new Date(a);
    mode === 'week' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1);
    return d;
  });
  const nextPeriod = () => setAnchor(a => {
    const d = new Date(a);
    mode === 'week' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1);
    return d;
  });
  const toggleMode = () => {
    setMode(m => {
      const next = m === 'week' ? 'month' : 'week';
      setAnchor(a => {
        const d = new Date(a);
        if (next === 'month') { d.setDate(1); }
        else { const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); }
        return d;
      });
      return next;
    });
  };

  // ─── Derive chart data ───
  const { chartData, allModels } = useMemo(() => {
    if (!rawData?.daily) return { chartData: [], allModels: [] };
    const modelSet = new Set();
    rawData.daily.forEach(day => {
      (day.models || []).forEach(m => {
        if (modelMatchesPlatform(m.model, platform)) modelSet.add(m.model);
      });
    });
    const models = Array.from(modelSet);
    const data = rawData.daily.map(day => {
      const point = { date: day.date };
      models.forEach(model => {
        const entry = (day.models || []).find(m => m.model === model);
        point[`${model}_input`] = entry?.input_tokens ?? 0;
        point[`${model}_output`] = entry?.output_tokens ?? 0;
        point[`${model}_cached`] = entry?.cached_tokens ?? 0;
        point[`${model}_convs`] = entry?.conversation_count ?? 0;
      });
      return point;
    });
    return { chartData: data, allModels: models };
  }, [rawData, platform]);

  const hasData = chartData.length > 0 && allModels.length > 0;

  // ─── Banner tint (model-based) ───
  const bannerTint = (() => {
    const m = (user?.default_model || '').toLowerCase();
    if (m.includes('claude')) return 'rgba(100,50,150,0.03)';
    if (m.includes('gpt') || m.includes('openai')) return 'rgba(50,100,200,0.03)';
    return 'rgba(20, 184, 166, 0.03)';
  })();

  // ─── Type badge style ───
  const typeBadgeStyle = {
    background: 'rgba(20, 184, 166, 0.1)',
    color: 'rgb(45, 212, 191)',
    border: '1px solid rgba(20, 184, 166, 0.2)',
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center tx-body-mute">
        <p className="text-sm">Loading user profile...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>
      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {/* ═══ Fixed back bar — desktop only; mobile uses MobileHeader ═══ */}
      <div
        className="hidden md:flex items-center flex-shrink-0 px-4 md:px-12 py-3"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label="Home" onClick={() => goBack()} />
      </div>

      {/* ═══ Scrollable content ═══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-6 md:px-10 py-[32px] pb-[120px] flex flex-col gap-8">

          {/* ═══ Header Banner ═══ */}
          <section style={fadeUp(0)}>
            <div
              className="relative"
              style={{
                minHeight: '100px',
                background: bannerTint,
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                borderRadius: '4px 4px 0 0',
              }}
            />

            {/* Avatar riding the banner bottom edge */}
            <div className="flex justify-center" style={{ marginTop: '-36px' }}>
              <button
                onClick={() => avatarInputRef.current?.click()}
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
                  alt={user.name}
                  className="w-full h-full object-cover rounded-full"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 0 16px rgba(20,184,166,0.15)',
                    background: 'var(--cinder-base)',
                  }}
                />
                {/* Edit overlay */}
                <div
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Pencil size={16} />
                </div>
              </button>
            </div>
          </section>

          {/* ═══ Identity — name + description + model ═══ */}
          <section style={fadeUp(0.06)} className="flex flex-col items-center gap-2 -mt-2">
            {/* Name */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="tx-section-normal font-light text-center outline-none"
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
                  onClick={startEditName}
                  className="tx-section-normal font-light cursor-pointer transition-colors duration-300"
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--cinder-flame)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '';
                  }}
                >
                  {user.name}
                </h2>
              )}
              <span
                className="tx-decoration-mute tracking-wider whitespace-nowrap"
                style={{ padding: '2px 8px', borderRadius: '2px', ...typeBadgeStyle }}
              >
                user
              </span>
              {fieldSaving === 'name' && (
                <span className="tx-decoration-accent font-light" style={{ animation: 'breathe 1s ease-in-out infinite' }}>
                  saving...
                </span>
              )}
            </div>

            {/* Description */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {editingDesc ? (
                <input
                  ref={descInputRef}
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  onBlur={saveDesc}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveDesc();
                    if (e.key === 'Escape') setEditingDesc(false);
                  }}
                  placeholder="Add a description..."
                  className="tx-body-mute font-light italic text-center outline-none w-full min-w-[200px]"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--cinder-flame)',
                    padding: '2px 0',
                  }}
                />
              ) : (
                <p
                  onClick={startEditDesc}
                  className="tx-body-mute font-light italic cursor-pointer transition-colors duration-300"
                  style={{ opacity: user.description ? 1 : 0.5 }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--cinder-flame-dim)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '';
                  }}
                >
                  {user.description || 'Click to add a personal signature...'}
                </p>
              )}
              {fieldSaving === 'description' && (
                <span className="tx-decoration-accent font-light" style={{ animation: 'breathe 1s ease-in-out infinite' }}>
                  saving...
                </span>
              )}
            </div>

            {/* Model — free-text label (user type is conceptual, not an AI model) */}
            <div className="flex items-center gap-2 mt-1">
              <span className="tx-decoration-mute font-light">
                Model:
              </span>
              {editingModel ? (
                <input
                  ref={modelInputRef}
                  value={modelDraft}
                  onChange={e => setModelDraft(e.target.value)}
                  onBlur={saveModel}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveModel();
                    if (e.key === 'Escape') { setModelDraft(user.default_model || 'Human'); setEditingModel(false); }
                  }}
                  className="tx-system-normal font-light text-center outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(20,184,166,0.2)',
                    borderRadius: '12px',
                    padding: '4px 12px',
                    minWidth: '80px',
                  }}
                  placeholder="Human"
                />
              ) : (
                <span
                  onClick={startEditModel}
                  className="tx-system-normal font-light cursor-pointer transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(20,184,166,0.12)',
                    borderRadius: '12px',
                    padding: '4px 12px',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(20,184,166,0.35)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(20,184,166,0.12)';
                  }}
                >
                  {user.default_model || 'Human'}
                </span>
              )}
              {fieldSaving === 'default_model' && (
                <span className="tx-decoration-accent font-light" style={{ animation: 'breathe 1s ease-in-out infinite' }}>
                  saving...
                </span>
              )}
            </div>

            {saveError && (
              <p className="tx-decoration-accent" style={{ opacity: 0.7, marginTop: '4px' }}>{saveError}</p>
            )}
          </section>

          {/* ═══ Action buttons ═══ */}
          <section style={fadeUp(0.1)} className="flex items-center gap-4 justify-center">
            <button
              onClick={() => setView('agent_memory', { agentId: userId, agentName: user.name })}
              className="flex items-center gap-2 font-light cursor-pointer transition-colors duration-300"
              style={{
                background: 'none',
                border: '1px solid rgba(168,122,255,0.15)',
                borderRadius: '6px',
                padding: '8px 20px',
                fontSize: '12px',
                letterSpacing: '0.05em',
                color: 'rgb(168,148,220)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'rgb(188,168,240)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgb(168,148,220)';
              }}
            >
              <Activity size={14} />
              Manage Memory
            </button>
          </section>

          {/* ═══ System Prompt Crystal ═══ */}
          <section style={fadeUp(0.14)}>
            <div style={{ background: 'none', border: 'none', padding: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="tx-system-mute" style={{ opacity: 0.5 }}>[</span>
                <span className="tx-system-mute font-light">
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
                  <Pencil size={14} />
                </button>
              </div>

              {/* Prompt preview */}
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full text-left font-[inherit] cursor-pointer transition-all duration-300"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                <p
                  className={user?.system_prompt ? 'tx-body-normal font-light' : 'tx-body-mute font-light'}
                  style={{ opacity: user?.system_prompt ? 1 : 0.5 }}
                >
                  {user?.system_prompt
                    ? user.system_prompt.slice(0, 200) + (user.system_prompt.length > 200 ? '...' : '')
                    : 'No system prompt configured. Click the edit icon to add one.'}
                </p>
              </button>
            </div>
          </section>

          {/* ═══ Usage Statistics ═══ */}
          <section style={fadeUp(0.24)}>
            <div className="flex items-center justify-between mb-3">
              <SectionHead label="USAGE STATISTICS" />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3 shrink-0 mb-4">
              <div className="flex items-center border border-exo-border rounded-[3px] overflow-hidden">
                {PLATFORMS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPlatform(p.key)}
                    className={`px-3 py-1.5 text-[0.625rem] font-bold tracking-widest transition-colors ${
                      platform === p.key
                        ? 'bg-exo-accent/15 tx-body-accent'
                        : 'tx-body-mute hover:tx-body-normal'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center border border-exo-border rounded-[3px] overflow-hidden ml-auto">
                <button onClick={prevPeriod} className="px-2 py-1.5 tx-body-mute hover:tx-body-normal transition-colors border-r border-exo-border">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={toggleMode} className="px-3 py-1.5 text-[0.625rem] font-bold tracking-widest tx-body-normal hover:tx-body-accent transition-colors min-w-[80px] text-center">
                  {rawData?.is_current
                    ? (mode === 'week' ? '本周' : '本月')
                    : (mode === 'week'
                      ? (rawData?.from === rawData?.to
                        ? rawData?.from?.slice(5) ?? ''
                        : `${rawData?.from?.slice(5) ?? ''} – ${rawData?.to?.slice(5) ?? ''}`)
                      : rawData?.from?.slice(0, 7) ?? '')
                  }
                </button>
                <button onClick={nextPeriod} className="px-2 py-1.5 tx-body-mute hover:tx-body-normal transition-colors border-l border-exo-border">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {isLoadingStats && (
              <div className="flex items-center justify-center tx-body-mute text-[0.6875rem] tracking-widest gap-2 py-24">
                <Activity size={14} className="animate-spin tx-body-accent" /> Loading...
              </div>
            )}

            {!isLoadingStats && statsError && (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-24">
                <p className="text-[0.6875rem] tx-body-mute tracking-widest opacity-60">
                  Statistics API unavailable
                </p>
              </div>
            )}

            {!isLoadingStats && !statsError && !hasData && rawData && (
              <div className="flex items-center justify-center tx-body-mute text-[0.6875rem] tracking-widest opacity-40 py-24">
                No data for current period
              </div>
            )}

            {!isLoadingStats && !statsError && hasData && (
              <div className="flex flex-col gap-5">
                <ChartBlock title="Input Tokens" data={chartData} models={allModels} valueKey="input" />
                <ChartBlock title="Output Tokens" data={chartData} models={allModels} valueKey="output" />
                <ChartBlock title="Cached Tokens" data={chartData} models={allModels} valueKey="cached" />
              </div>
            )}
          </section>

        </div>
      </div>

      {/* EditPresetModal for system prompt */}
      <EditPresetModal
        isOpen={showEditModal}
        preset={user}
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
