import React, { useState, useEffect } from 'react';
import { configApi, agentsApi } from 'exo-shared';
import { Save, Clock, Users, ChevronDown, ChevronRight } from 'lucide-react';
import Toast from './Toast';
import { Button } from '../ui';

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** Sort presets: g045 first, then superior. Within each group, checked items first. */
function sortPresets(presets, checkedIds) {
 const checkedSet = new Set(checkedIds);
 return [...presets].sort((a, b) => {
 // g045 before superior
 const aG045 = a.agent_type === 'g045' || a.agent_type === 'superior' ? 0 : 2;
 const bG045 = b.agent_type === 'g045' || b.agent_type === 'superior' ? 0 : 2;
 if (aG045 !== bG045) return aG045 - bG045;

 // Checked before unchecked
 const aChecked = checkedSet.has(a.id) ? 0 : 1;
 const bChecked = checkedSet.has(b.id) ? 0 : 1;
 return aChecked - bChecked;
 });
}

/** Agent checkbox list — expandable panel */
function AgentCheckList({ presets, checkedIds, onToggle, expanded }) {
 if (!expanded) return null;

 const sorted = sortPresets(presets, checkedIds);
 const g045List = sorted.filter(p => p.agent_type === 'g045');
 const superiorList = sorted.filter(p => p.agent_type !== 'g045');

 return (
  <div className="mt-2 p-3 bg-chat-bg border border-cinder-line rounded">
   {g045List.length > 0 && (
   <>
    <div className="tx-decoration-mute mb-1.5">G045</div>
   {g045List.map(p => (
   <label
    key={p.id}
     className="flex items-center gap-2 py-1 px-1 cursor-pointer tx-system-normal hover:tx-system-accent transition-colors"
   >
    <span
    onClick={() => onToggle(p.id)}
    className={`w-3 h-3 rounded-[2px] border flex items-center justify-center flex-shrink-0 transition-colors ${
      checkedIds.includes(p.id) ? 'bg-chat-accent border-chat-accent' : 'border-cinder-line'
    }`}
    >
    {checkedIds.includes(p.id) && (
     <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
     <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
     </svg>
    )}
    </span>
    <span onClick={() => onToggle(p.id)}>{p.name}</span>
   </label>
   ))}
  </>
  )}
  {superiorList.length > 0 && (
  <>
    <div className="tx-decoration-mute mt-2 mb-1.5">Superior</div>
   {superiorList.map(p => (
   <label
    key={p.id}
     className="flex items-center gap-2 py-1 px-1 cursor-pointer tx-system-normal hover:tx-system-accent transition-colors"
   >
    <span
    onClick={() => onToggle(p.id)}
    className={`w-3 h-3 rounded-[2px] border flex items-center justify-center flex-shrink-0 transition-colors ${
      checkedIds.includes(p.id) ? 'bg-chat-accent border-chat-accent' : 'border-cinder-line'
    }`}
    >
    {checkedIds.includes(p.id) && (
     <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
     <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
     </svg>
    )}
    </span>
    <span onClick={() => onToggle(p.id)}>{p.name}</span>
   </label>
   ))}
  </>
  )}
  {sorted.length === 0 && (
   <p className="tx-decoration-mute text-center py-2">No agents available</p>
  )}
 </div>
 );
}

export default function RoutinePanel() {
 const [config, setConfig] = useState({});
 const [presets, setPresets] = useState([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [feedback, setFeedback] = useState(null);
 const clearFeedback = () => setFeedback(null);

 const [selfDeepOrgIds, setSelfDeepOrgIds] = useState([]);
 const [heartbeatIds, setHeartbeatIds] = useState([]);
 const [expandedAgents, setExpandedAgents] = useState({ scdo: false, hb: false });

 useEffect(() => {
 setLoading(true);
 Promise.all([
  configApi.getConfig(),
  agentsApi.listPresets().catch(() => []),
 ])
  .then(([cfg, allPresets]) => {
  setConfig(cfg);
  setSelfDeepOrgIds(cfg.self_check_preset_ids || []);
  setHeartbeatIds(cfg.heartbeat_preset_ids || []);

  const relevant = (Array.isArray(allPresets) ? allPresets : [])
   .filter(p => p.agent_type === 'g045' || p.agent_type === 'superior');
  setPresets(relevant);
  })
  .catch(() => {})
  .finally(() => setLoading(false));
 }, []);

 const toggleSelfDeepOrg = (presetId) => {
 setSelfDeepOrgIds(prev =>
  prev.includes(presetId) ? prev.filter(id => id !== presetId) : [...prev, presetId]
 );
 };

 const toggleHeartbeat = (presetId) => {
 setHeartbeatIds(prev =>
  prev.includes(presetId) ? prev.filter(id => id !== presetId) : [...prev, presetId]
 );
 };

 const toggleExpand = (key) => {
 setExpandedAgents(prev => ({ ...prev, [key]: !prev[key] }));
 };

 const handleSave = async () => {
 clearFeedback();
 setSaving(true);
 try {
  await configApi.updateConfig({
  self_check_preset_ids: selfDeepOrgIds,
  deep_org_preset_ids: selfDeepOrgIds,
  heartbeat_preset_ids: heartbeatIds,
  });
  setFeedback({ type: 'success', msg: '后台任务配置保存成功' });
 } catch (err) {
  setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
 } finally { setSaving(false); }
 };

 const schedulePreview = () => {
 const c = config;
 const day = WEEKDAY_NAMES[c.deep_org_weekday] || '?';
 const hour = c.deep_org_hour != null ? `${String(c.deep_org_hour).padStart(2, '0')}:00` : '?';
 return (
  <span>
  Active: <span style={{color:'var(--tx-neutral-40)'}}>{c.active_start || '?'} – {c.active_end || '?'}</span>
  {' · '}Heartbeat: <span style={{color:'var(--tx-neutral-40)'}}>{c.heartbeat_base_hours || '?'}–{(c.heartbeat_base_hours || 0) + (c.heartbeat_random_hours || 0)}h (day) / {c.night_heartbeat_base_hours || '?'}–{(c.night_heartbeat_base_hours || 0) + (c.heartbeat_random_hours || 0)}h (night)</span>
  {' · '}Deep Org: <span style={{color:'var(--tx-neutral-40)'}}>{day} {hour}</span>
  </span>
 );
 };

 if (loading) {
 return (
  <div className="flex items-center justify-center h-64">
  <span className="inline-block w-5 h-5 border-2 border-chat-muted/20 border-t-chat-muted/40 rounded-full animate-spin" />
  </div>
 );
 }

 return (
 <div className="flex-1 h-full overflow-y-auto">
  <div className="max-w-2xl px-8 py-8">
   <h2 className="tx-subtitle-normal mb-6">
    ⚡ Routine · 后台任务
   </h2>

  {/* ── Group A: Self Check & Deep Organize ── */}
  <div className="mb-5">
   <div className="flex items-center justify-between">
   <div className="flex items-center gap-2.5 min-w-0">
    <span className="text-sm">🔍🧹</span>
    <div className="min-w-0">
         <span className="tx-system-normal font-medium">Self Check & Deep Organize</span>
         <span className="tx-system-mute ml-2 hidden sm:inline">自检 + 深度整理 · 共用 Agent 列表</span>
    </div>
   </div>
   <div className="flex items-center gap-2 flex-shrink-0 ml-3">
      <Button variant="ghost" size="sm">
     <Clock size={10} /> 时间设置
      </Button>
     <Button variant="ghost" size="sm"
     onClick={() => toggleExpand('scdo')}
      className={expandedAgents.scdo ? 'border-exo-accent/15 bg-exo-accent/[0.04]' : ''}
     >
     <Users size={10} /> Agent 管理
     {expandedAgents.scdo ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
     </Button>
   </div>
   </div>
   <AgentCheckList
   presets={presets}
   checkedIds={selfDeepOrgIds}
   onToggle={toggleSelfDeepOrg}
   expanded={expandedAgents.scdo}
   />
  </div>

  {/* ── Group B: Heartbeat ── */}
  <div className="mb-5">
   <div className="flex items-center justify-between">
   <div className="flex items-center gap-2.5 min-w-0">
    <span className="text-sm">💓</span>
    <div className="min-w-0">
         <span className="tx-system-normal font-medium">Heartbeat</span>
         <span className="tx-system-mute ml-2 hidden sm:inline">主动互动 · 活跃窗口内定时发起对话</span>
    </div>
   </div>
   <div className="flex items-center gap-2 flex-shrink-0 ml-3">
      <Button variant="ghost" size="sm">
     <Clock size={10} /> 时间设置
      </Button>
     <Button variant="ghost" size="sm"
     onClick={() => toggleExpand('hb')}
      className={expandedAgents.hb ? 'border-exo-accent/15 bg-exo-accent/[0.04]' : ''}
     >
     <Users size={10} /> Agent 管理
     {expandedAgents.hb ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
     </Button>
   </div>
   </div>
   <AgentCheckList
   presets={presets}
   checkedIds={heartbeatIds}
   onToggle={toggleHeartbeat}
   expanded={expandedAgents.hb}
   />
  </div>

  {/* ── Schedule Preview ── */}
   <div className="p-3 bg-chat-bg border border-cinder-line rounded mb-6">
    <div className="flex items-center gap-2 mb-1.5">
    <span className="text-sm">⏱️</span>
    <span className="tx-decoration-normal">Schedule Preview</span>
    <span className="tx-decoration-mute ml-1">(时间设置接口待上线)</span>
    </div>
    <p className="tx-decoration-normal leading-relaxed">{schedulePreview()}</p>
   </div>

  <div className="flex justify-end">
    <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
    {saving ? (
      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
    ) : (
      <Save size={12} />
    )}
    Save
    </Button>
  </div>

  <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
  </div>
 </div>
 );
}
