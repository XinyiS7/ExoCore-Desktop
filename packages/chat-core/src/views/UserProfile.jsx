import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pencil, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import {
 LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
 ResponsiveContainer
} from 'recharts';
import AvatarCropModal from '../components/modals/AvatarCropModal';
import BackToUpper from '../components/layout/BackButton';
import { telemetryApi, MODEL_REGISTRY } from 'exo-shared';
import { setUserAvatar, getUserAvatar } from 'exo-shared/profile';
import { useUserPreset } from '../hooks/useUserPreset';

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
  <p className="text-exo-muted mb-1.5 tracking-widest text-[0.5625rem]">{label}</p>
  {payload.map(p => (
  <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
   <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
   <span className="text-exo-text/70">{p.name}:</span>
   <span className="text-white font-bold">{p.value?.toLocaleString()}</span>
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
   <span className="text-exo-muted truncate max-w-[100px]" title={model}>{model}</span>
   <span className="text-white">{total.toLocaleString()}</span>
   <span className="text-exo-muted">·</span>
   <span className="text-exo-muted">{convTotal} 会话</span>
   <span className="text-exo-muted">·</span>
   <span className="text-exo-muted">均 {avg.toLocaleString()}</span>
   </div>
  );
  })}
 </div>
 );
};

const ChartBlock = ({ title, data, models, valueKey }) => {
 return (
 <div className="shrink-0">
  <p className="text-[0.625rem] font-bold tracking-[0.25em] text-exo-muted mb-3">{title}</p>
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

 if (!user) {
 return (
  <div className="flex-1 flex items-center justify-center text-exo-muted">
  <p className=" text-sm">Loading user profile...</p>
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

  {/* Back bar — desktop only; mobile uses MobileHeader */}
  <div
    className="hidden md:flex items-center flex-shrink-0 px-4 md:px-12 py-3"
    style={{ borderBottom: '1px solid var(--cinder-line)' }}
  >
  <BackToUpper label="Home" onClick={() => goBack()} />
  </div>

  <div className="flex-1 overflow-y-auto">
  {/* Identity Area */}
  <div className="px-4 md:px-12 py-6 border-b border-exo-border">
   <div className="flex flex-wrap gap-4">
   {/* Avatar */}
   <div className="flex-shrink-0">
    <button onClick={() => avatarInputRef.current?.click()} className="group relative">
    <img
     src={avatarUrl}
     alt={user.name}
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
     onBlur={saveName}
     onKeyDown={e => {
      if (e.key === 'Enter') saveName();
      if (e.key === 'Escape') setEditingName(false);
     }}
     className="bg-transparent border-b-2 border-exo-accent text-lg font-medium text-white outline-none py-0.5 min-w-[120px]"
     />
    ) : (
     <h2
     onClick={startEditName}
     className="text-lg font-medium text-white cursor-pointer hover:border-b-2 hover:border-exo-accent/30 transition-all"
     >
     {user.name}
     </h2>
    )}
    <span className="text-[0.625rem] tracking-wider px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
     user
    </span>
    {fieldSaving === 'name' && (
     <span className="text-[0.625rem] text-exo-accent animate-pulse">saving...</span>
    )}
    </div>

    {/* Description / Signature */}
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
     className="bg-transparent border-b-2 border-exo-accent text-sm text-exo-muted italic outline-none py-0.5 w-full"
     placeholder="Personal signature..."
    />
    ) : (
    <p
     onClick={startEditDesc}
     className="text-sm text-exo-muted italic cursor-pointer hover:border-b-2 hover:border-exo-accent/30 transition-all inline-block"
    >
     {user.description || 'Click to add a personal signature...'}
    </p>
    )}
    {fieldSaving === 'description' && (
    <span className="text-[0.625rem] text-exo-accent animate-pulse">saving...</span>
    )}

    {/* Model — editable text string */}
    <div className="flex items-center gap-2">
    <span className="text-[0.625rem] tracking-wider text-exo-muted">Model:</span>
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
     className="bg-transparent border-b-2 border-exo-accent text-xs text-exo-text outline-none py-0.5 min-w-[80px]"
     placeholder="Human"
     />
    ) : (
     <span
     onClick={startEditModel}
     className="text-xs text-exo-text cursor-pointer hover:border-b-2 hover:border-exo-accent/30 transition-all"
     >
     {user.default_model || 'Human'}
     </span>
    )}
    {fieldSaving === 'default_model' && (
     <span className="text-[0.625rem] text-exo-accent animate-pulse">saving...</span>
    )}
    </div>
   </div>

   {/* Action buttons */}
   <div className="flex items-start gap-2 w-full md:w-auto md:self-start">
    <button
    onClick={() => setView('agent_memory', { agentId: userId, agentName: user.name })}
    className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-400 text-xs font-medium hover:bg-purple-500/20 active:scale-95 transition-colors"
    >
    Manage Memory
    </button>
   </div>
   </div>

   {saveError && (
   <p className="text-[0.625rem] text-red-400 mt-2">{saveError}</p>
   )}
  </div>

  {/* Stats Area */}
  <div className="px-4 md:px-12 py-6 flex flex-col gap-5">
   <h3 className="text-[0.625rem] tracking-[0.3em] text-exo-muted mb-1">Usage Statistics</h3>

   {/* Controls row */}
   <div className="flex items-center gap-3 shrink-0">
   <div className="flex items-center border border-exo-border rounded-[3px] overflow-hidden">
    {PLATFORMS.map(p => (
    <button
     key={p.key}
     onClick={() => setPlatform(p.key)}
     className={`px-3 py-1.5 text-[0.625rem] font-bold tracking-widest transition-colors ${
     platform === p.key
      ? 'bg-exo-accent/15 text-exo-accent'
      : 'text-exo-muted hover:text-exo-text'
     }`}
    >
     {p.label}
    </button>
    ))}
   </div>

   <div className="flex items-center border border-exo-border rounded-[3px] overflow-hidden ml-auto">
    <button onClick={prevPeriod} className="px-2 py-1.5 text-exo-muted hover:text-white transition-colors border-r border-exo-border">
    <ChevronLeft size={14} />
    </button>
    <button onClick={toggleMode} className="px-3 py-1.5 text-[0.625rem] font-bold tracking-widest text-exo-text hover:text-exo-accent transition-colors min-w-[80px] text-center">
    {rawData?.is_current
     ? (mode === 'week' ? '本周' : '本月')
     : (mode === 'week'
     ? (rawData?.from === rawData?.to
      ? rawData?.from?.slice(5) ?? ''
      : `${rawData?.from?.slice(5) ?? ''} – ${rawData?.to?.slice(5) ?? ''}`)
     : rawData?.from?.slice(0, 7) ?? '')
    }
    </button>
    <button onClick={nextPeriod} className="px-2 py-1.5 text-exo-muted hover:text-white transition-colors border-l border-exo-border">
    <ChevronRight size={14} />
    </button>
   </div>
   </div>

   {isLoadingStats && (
   <div className="flex-1 flex items-center justify-center text-exo-muted text-[0.6875rem] tracking-widest gap-2 py-24">
    <Activity size={14} className="animate-spin text-exo-accent" /> Loading...
   </div>
   )}

   {!isLoadingStats && statsError && (
   <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-24">
    <p className="text-[0.6875rem] text-exo-muted tracking-widest opacity-60">
    Statistics API unavailable
    </p>
   </div>
   )}

   {!isLoadingStats && !statsError && !hasData && rawData && (
   <div className="flex-1 flex items-center justify-center text-exo-muted text-[0.6875rem] tracking-widest opacity-40 py-24">
    No data for current period
   </div>
   )}

   {!isLoadingStats && !statsError && hasData && (
   <>
    <ChartBlock title="Input Tokens" data={chartData} models={allModels} valueKey="input" />
    <ChartBlock title="Output Tokens" data={chartData} models={allModels} valueKey="output" />
    <ChartBlock title="Cached Tokens" data={chartData} models={allModels} valueKey="cached" />
   </>
   )}
  </div>
  </div>

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
