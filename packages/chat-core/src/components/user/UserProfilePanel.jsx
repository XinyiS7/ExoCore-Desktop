import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Check, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { getUserAvatarUrl } from '../utils/avatar';
import AvatarCropModal from './modals/AvatarCropModal';
import { baseUrl, MODEL_REGISTRY } from '../utils/api';

// ─── Derived from MODEL_REGISTRY — edit models in src/utils/api.js ───────────
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-exo-panel border border-exo-border rounded-[3px] px-3 py-2 text-[11px] font-mono shadow-xl">
      <p className="text-exo-muted mb-1.5 uppercase tracking-widest text-[9px]">{label}</p>
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

// ─── Stats summary below chart ────────────────────────────────────────────────
const ChartSummary = ({ data, models, valueKey, label }) => {
  if (!data?.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
      {models.map(model => {
        const total = data.reduce((s, d) => s + (d[`${model}_${valueKey}`] ?? 0), 0);
        const convTotal = data.reduce((s, d) => s + (d[`${model}_convs`] ?? 0), 0);
        const avg = convTotal > 0 ? Math.round(total / convTotal) : 0;
        if (total === 0) return null;
        return (
          <div key={model} className="flex items-center gap-2 text-[10px] font-mono">
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

// ─── Main component ───────────────────────────────────────────────────────────
const UserProfilePanel = ({ isOpen, onClose }) => {
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => getUserAvatarUrl());
  const [cropFile, setCropFile] = useState(null);
  const [userNick, setUserNick] = useState(() => localStorage.getItem('exo_user_nick') || 'Exo User');
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState('');
  const avatarInputRef = useRef(null);

  // Stats state
  const [platform, setPlatform] = useState('all');
  const [mode, setMode] = useState('week'); // 'week' | 'month'
  const [anchor, setAnchor] = useState(() => new Date());
  const [rawData, setRawData] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(false);

  // Hover summary state
  const [activeInputPoint, setActiveInputPoint] = useState(null);
  const [activeOutputPoint, setActiveOutputPoint] = useState(null);
  const [activeCachedPoint, setActiveCachedPoint] = useState(null);

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(false);
    try {
      const params = new URLSearchParams({ mode, from: toDateStr(anchor) });
      const res = await fetch(`${baseUrl}/api/telemetry/usage/?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('stats_unavailable');
      const data = await res.json();
      setRawData(data);
    } catch {
      setStatsError(true);
      setRawData(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [anchor, mode]);

  useEffect(() => {
    if (isOpen) fetchStats();
  }, [isOpen, fetchStats]);

  // ── Avatar ──
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    e.target.value = '';
  };

  // ── Nick edit ──
  const startEditNick = () => {
    setNickDraft(userNick);
    setEditingNick(true);
  };
  const saveNick = () => {
    const v = nickDraft.trim();
    if (v) {
      localStorage.setItem('exo_user_nick', v);
      setUserNick(v);
      window.dispatchEvent(new Event('user-nick-updated'));
    }
    setEditingNick(false);
  };

  // ── Period nav ──
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
    setMode(m => m === 'week' ? 'month' : 'week');
    setAnchor(new Date());
  };

  // ── Derive chart data ──
  const { chartData, allModels } = React.useMemo(() => {
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
        point[`${model}_input`]  = entry?.input_tokens  ?? 0;
        point[`${model}_output`] = entry?.output_tokens ?? 0;
        point[`${model}_cached`] = entry?.cached_tokens ?? 0;
        point[`${model}_convs`]  = entry?.conversation_count ?? 0;
      });
      return point;
    });

    return { chartData: data, allModels: models };
  }, [rawData, platform]);

  const hasData = chartData.length > 0 && allModels.length > 0;

  // ── Close on backdrop ──
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onConfirm={(dataUrl) => {
            localStorage.setItem('exo_user_avatar_url', dataUrl);
            setUserAvatarUrl(dataUrl);
            setCropFile(null);
            window.dispatchEvent(new Event('user-avatar-updated'));
          }}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[150] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdrop}
      >
        {/* Panel */}
        <div
          className={`absolute inset-y-0 left-0 w-[400px] max-w-[95vw] bg-exo-panel border-r border-exo-border flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-14 border-b border-exo-border flex items-center justify-between px-5 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-exo-muted">User Profile</span>
            <button onClick={onClose} className="p-1.5 text-exo-muted hover:text-white transition-colors rounded">
              <X size={16} />
            </button>
          </div>

          {/* ── Identity section ── */}
          <div className="px-6 py-5 border-b border-exo-border shrink-0">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="relative shrink-0 cursor-pointer group"
                onClick={() => avatarInputRef.current?.click()}
              >
                <img
                  src={userAvatarUrl}
                  className="w-16 h-16 rounded-[4px] border border-exo-border object-cover bg-exo-bg group-hover:border-exo-accent/40 transition-all"
                  alt={userNick}
                />
                <div className="absolute inset-0 rounded-[4px] bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={16} className="text-white" />
                </div>
                <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                {editingNick ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nickDraft}
                      onChange={e => setNickDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveNick(); if (e.key === 'Escape') setEditingNick(false); }}
                      className="flex-1 bg-exo-bg border border-exo-border rounded-[3px] px-3 py-1.5 text-[13px] text-white font-bold outline-none focus:border-exo-accent/50 min-w-0"
                    />
                    <button onClick={saveNick} className="p-1.5 text-exo-accent hover:text-white transition-colors">
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startEditNick}
                    className="text-left group/nick"
                    title="点击修改名称"
                  >
                    <p className="text-[15px] font-bold text-white group-hover/nick:text-exo-accent transition-colors truncate">{userNick}</p>
                    <p className="text-[10px] text-exo-muted font-mono uppercase tracking-widest mt-0.5 opacity-60">EXO-CORE AUTH · 点击修改</p>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Stats section ── */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">

            {/* Controls row */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Platform selector */}
              <div className="flex items-center border border-exo-border rounded-[3px] overflow-hidden">
                {PLATFORMS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPlatform(p.key)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      platform === p.key
                        ? 'bg-exo-accent/15 text-exo-accent'
                        : 'text-exo-muted hover:text-exo-text'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Period navigator */}
              <div className="flex items-center border border-exo-border rounded-[3px] overflow-hidden ml-auto">
                <button
                  onClick={prevPeriod}
                  className="px-2 py-1.5 text-exo-muted hover:text-white transition-colors border-r border-exo-border"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={toggleMode}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-exo-text hover:text-exo-accent transition-colors min-w-[80px] text-center"
                  title={mode === 'week' ? '切换为按月显示' : '切换为按周显示'}
                >
                  {rawData?.is_current
                    ? (mode === 'week' ? '本周' : '本月')
                    : (mode === 'week'
                      ? (rawData?.from === rawData?.to
                        ? rawData?.from?.slice(5) ?? ''
                        : `${rawData?.from?.slice(5) ?? ''} – ${rawData?.to?.slice(5) ?? ''}`)
                      : rawData?.from?.slice(0, 7) ?? '')
                  }
                </button>
                <button
                  onClick={nextPeriod}
                  className="px-2 py-1.5 text-exo-muted hover:text-white transition-colors border-l border-exo-border"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Loading / Error / No data */}
            {isLoadingStats && (
              <div className="flex-1 flex items-center justify-center text-exo-muted font-mono text-[11px] uppercase tracking-widest gap-2">
                <Activity size={14} className="animate-spin text-exo-accent" /> Loading...
              </div>
            )}

            {!isLoadingStats && statsError && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-[11px] text-exo-muted font-mono uppercase tracking-widest opacity-60">
                  统计接口暂未接入
                </p>
                <p className="text-[10px] text-exo-muted/40 font-mono">
                  需要后端实现 GET /api/core/stats/usage/
                </p>
              </div>
            )}

            {!isLoadingStats && !statsError && !hasData && rawData && (
              <div className="flex-1 flex items-center justify-center text-exo-muted font-mono text-[11px] uppercase tracking-widest opacity-40">
                当前周期暂无数据
              </div>
            )}

            {!isLoadingStats && !statsError && hasData && (
              <>
                {/* Input tokens chart */}
                <ChartBlock
                  title="Input Tokens"
                  data={chartData}
                  models={allModels}
                  valueKey="input"
                  onActivate={setActiveInputPoint}
                  activePoint={activeInputPoint}
                />

                {/* Output tokens chart */}
                <ChartBlock
                  title="Output Tokens"
                  data={chartData}
                  models={allModels}
                  valueKey="output"
                  onActivate={setActiveOutputPoint}
                  activePoint={activeOutputPoint}
                />

                {/* Cached tokens chart */}
                <ChartBlock
                  title="Cached Tokens"
                  data={chartData}
                  models={allModels}
                  valueKey="cached"
                  onActivate={setActiveCachedPoint}
                  activePoint={activeCachedPoint}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Single chart block ───────────────────────────────────────────────────────
const ChartBlock = ({ title, data, models, valueKey, onActivate, activePoint }) => {
  return (
    <div className="shrink-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-exo-muted mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          onMouseMove={(e) => { if (e.activePayload) onActivate(e.activePayload); }}
          onMouseLeave={() => onActivate(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#818190', fontSize: 9, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#818190', fontSize: 9, fontFamily: 'monospace' }}
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

      {/* Summary row — shown on hover or always */}
      <ChartSummary
        data={data}
        models={models}
        valueKey={valueKey}
        label={title}
      />
    </div>
  );
};

export default UserProfilePanel;
