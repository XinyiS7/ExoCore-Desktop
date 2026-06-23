import React, { useState, useEffect, useCallback, useRef } from 'react';
import { configApi } from 'exo-shared';
import { Save, AlertCircle, Shield, ChevronDown } from 'lucide-react';
import Toast from './Toast';
import { Button } from '../ui';

const ROLES = ['system', 'main_session', 'sub_agent', 'vision', 'image_gen', 'web_search'];

const ROLE_LABELS = {
 system:  'System',
 main_session:'Main Session',
 sub_agent: 'Sub-agent',
 vision:  'Vision',
 image_gen: 'Image Gen',
 web_search: 'Web Search',
};

/** Deep-compare two role assignment objects. */
function isEqual(a, b) {
 for (const role of ROLES) {
 const aKeys = [...(a[role]?.selectedKeys || [])].sort().join(',');
 const bKeys = [...(b[role]?.selectedKeys || [])].sort().join(',');
 if (aKeys !== bKeys) return false;
 if ((a[role]?.defaultAlias ?? null) !== (b[role]?.defaultAlias ?? null)) return false;
 }
 return true;
}

export default function RoleKeyMapSection({ platform, keys, keyMapForPlatform, onSaved }) {
 const buildInitial = useCallback(() => {
 const state = {};
 for (const role of ROLES) {
  const roleData = keyMapForPlatform?.[role];
  if (roleData && typeof roleData === 'object' && Array.isArray(roleData.keys)) {
  state[role] = {
   selectedKeys: new Set(roleData.keys),
   defaultAlias: roleData.default || null,
  };
  } else if (typeof roleData === 'string' && roleData) {
  state[role] = { selectedKeys: new Set([roleData]), defaultAlias: roleData };
  } else {
  state[role] = { selectedKeys: new Set(), defaultAlias: null };
  }
 }
 return state;
 }, [keyMapForPlatform]);

 const [assignments, setAssignments] = useState(buildInitial);
 const [initial, setInitial] = useState(buildInitial);
 const [saving, setSaving] = useState(false);
 const [feedback, setFeedback] = useState(null);
 const [openRole, setOpenRole] = useState(null); // which role's dropdown is open
 const dropdownRef = useRef(null);

 useEffect(() => {
 const next = buildInitial();
 setAssignments(next);
 setInitial(next);
 setFeedback(null);
 }, [platform, keyMapForPlatform, buildInitial]);

 // Close dropdown on outside click
 useEffect(() => {
 if (!openRole) return;
 const handler = (e) => {
  if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
  setOpenRole(null);
  }
 };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, [openRole]);

 const clearFeedback = () => setFeedback(null);
 const aliasOptions = keys.map(k => k.alias).sort();

 const dirty = !isEqual(assignments, initial);
 const systemHasKey = assignments.system?.selectedKeys?.size > 0;
 const canSave = dirty && systemHasKey && !saving;

 const toggleKey = (role, alias) => {
 setAssignments(prev => {
  const roleData = { ...prev[role], selectedKeys: new Set(prev[role].selectedKeys) };
  if (roleData.selectedKeys.has(alias)) {
  roleData.selectedKeys.delete(alias);
  if (roleData.defaultAlias === alias) {
   roleData.defaultAlias = roleData.selectedKeys.size === 1
   ? [...roleData.selectedKeys][0]
   : roleData.selectedKeys.size > 0
    ? [...roleData.selectedKeys][0]
    : null;
  }
  } else {
  roleData.selectedKeys.add(alias);
  if (roleData.selectedKeys.size === 1) roleData.defaultAlias = alias;
  }
  return { ...prev, [role]: roleData };
 });
 };

 const setDefault = (role, alias) => {
 setAssignments(prev => ({
  ...prev,
  [role]: { ...prev[role], defaultAlias: alias },
 }));
 };

 const handleSave = async () => {
 if (!canSave) return;
 clearFeedback();
 setSaving(true);
 try {
  const config = await configApi.getConfig();
  const fullKeyMap = config.key_map || {};
  const platformMap = {};
  for (const role of ROLES) {
  const ra = assignments[role];
  platformMap[role] = { keys: [...ra.selectedKeys].sort(), default: ra.defaultAlias || null };
  }
  await configApi.updateKeyMap({ ...fullKeyMap, [platform]: platformMap });
  setFeedback({ type: 'success', msg: 'Key Map 保存成功' });
  setInitial(buildInitial());
  onSaved?.();
 } catch (err) {
  setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
 } finally { setSaving(false); }
 };

 const toggleDropdown = (role) => {
 setOpenRole(prev => prev === role ? null : role);
 };

 return (
  <div className="bg-chat-panel border border-cinder-line rounded-lg p-3 space-y-3">
   {/* Header */}
   <div className="flex items-center justify-between">
   <div className="flex items-center gap-2">
    <Shield size={13} className="tx-system-mute" />
    <span className="tx-decoration-normal">Key Map</span>
    {dirty && <span className="tx-decoration-mute">(modified)</span>}
   </div>
    <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
     {saving ? (
     <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
     ) : (
     <Save size={11} />
     )}
     Save
    </Button>
   </div>

   {aliasOptions.length === 0 ? (
   <div className="text-center py-4 tx-decoration-mute">
    No keys available. Create keys in the Key Pool section first.
   </div>
   ) : (
  <div className="space-y-1" ref={dropdownRef}>
   {ROLES.map(role => {
   const ra = assignments[role];
   const selectedArr = [...ra.selectedKeys];
   const isEmpty = selectedArr.length === 0;
   const isSystemRole = role === 'system';
   const isOpen = openRole === role;

   return (
    <div key={role} className="relative">
    {/* Single row: Role + Dropdown */}
    <div
     className={`flex items-center gap-2 px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
     isSystemRole && isEmpty && dirty
      ? 'border-red-500/10 bg-red-500/[0.03]'
      : isOpen
      ? 'border-chat-accent/20 bg-chat-bg'
      : 'border-transparent hover:border-exo-mist-10 bg-chat-bg'
     }`}
     onClick={() => toggleDropdown(role)}
    >
      {/* Role label */}
      <span className="tx-system-normal w-[120px] flex-shrink-0 select-none">
      {ROLE_LABELS[role]}
      {isSystemRole && <span className="tx-system-accent ml-0.5">*</span>}
      </span>

      {/* Selected value display */}
      <span className={`flex-1 min-w-0 truncate select-none ${
      isEmpty ? 'tx-system-mute' : 'tx-system-normal'
      }`}>
      {isEmpty ? '—' : selectedArr.join(', ')}
      </span>

      {/* Warning for empty system role */}
      {isSystemRole && isEmpty && dirty && (
      <span className="text-[0.7rem] text-red-600 font-mono flex items-center gap-0.5 flex-shrink-0">
       <AlertCircle size={9} /> required
      </span>
      )}

      {/* Chevron */}
      <ChevronDown
      size={12}
      className={`tx-system-mute transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
      />
    </div>

    {/* Dropdown */}
     {isOpen && (
      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-chat-bg border border-cinder-line rounded-md shadow-xl p-2 space-y-1.5">
      {/* Key checkboxes */}
      <div className="flex flex-wrap gap-1">
       {aliasOptions.map(alias => {
       const checked = ra.selectedKeys.has(alias);
       return (
        <button
        key={alias}
        onClick={(e) => { e.stopPropagation(); toggleKey(role, alias); }}
         className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border tx-decoration-normal transition-all ${
         checked
         ? 'bg-chat-accent/8 border-chat-accent/20'
         : 'bg-transparent border-cinder-line tx-decoration-mute hover:tx-decoration-normal hover:border-exo-mist-12'
        }`}
        >
        <span className={`w-2.5 h-2.5 rounded-[2px] border flex items-center justify-center flex-shrink-0 ${
         checked ? 'bg-chat-accent border-chat-accent' : 'border-cinder-line'
        }`}>
         {checked && (
         <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
         </svg>
         )}
        </span>
        {alias}
        </button>
       );
       })}
      </div>

      {/* Default selector — only show when multiple keys selected */}
      {selectedArr.length > 1 && (
       <div className="border-t border-cinder-line pt-1.5">
       <span className="tx-decoration-mute px-1">Default</span>
       <div className="flex flex-wrap gap-1 mt-1">
        {selectedArr.map(alias => (
        <button
         key={alias}
         onClick={(e) => { e.stopPropagation(); setDefault(role, alias); }}
         className={`inline-flex items-center gap-1 tx-decoration-normal transition-colors ${
         ra.defaultAlias === alias ? '' : 'tx-decoration-mute hover:tx-decoration-normal'
         }`}
        >
         <span className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
         ra.defaultAlias === alias ? 'border-chat-accent' : 'border-cinder-line'
         }`}>
         {ra.defaultAlias === alias && (
          <span className="w-1 h-1 rounded-full bg-chat-accent" />
         )}
         </span>
         {alias}
        </button>
        ))}
       </div>
       </div>
      )}
      </div>
     )}
    </div>
   );
   })}
  </div>
  )}

  <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
 </div>
 );
}
