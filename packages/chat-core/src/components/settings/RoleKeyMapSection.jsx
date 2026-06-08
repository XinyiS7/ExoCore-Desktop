import React, { useState, useEffect, useCallback, useRef } from 'react';
import { configApi } from 'exo-shared';
import { Save, AlertCircle, Shield, ChevronDown } from 'lucide-react';
import Toast from './Toast';

const ROLES = ['system', 'main_session', 'sub_agent', 'vision', 'image_gen', 'web_search'];

const ROLE_LABELS = {
  system:      'System',
  main_session:'Main Session',
  sub_agent:   'Sub-agent',
  vision:      'Vision',
  image_gen:   'Image Gen',
  web_search:  'Web Search',
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
    <div className="bg-chat-panel border border-white/5 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={13} className="text-chat-muted/50" />
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-chat-text/70">Key Map</span>
          {dirty && <span className="text-[8px] font-mono text-chat-accent/50">(modified)</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-3 py-1.5 bg-chat-accent text-white text-[9px] font-bold uppercase tracking-[0.12em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-1"
        >
          {saving ? (
            <span className="inline-block w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={11} />
          )}
          Save
        </button>
      </div>

      {aliasOptions.length === 0 ? (
        <div className="text-center py-4 text-[10px] text-chat-muted/40 font-mono">
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
                        : 'border-transparent hover:border-white/5 bg-chat-bg'
                  }`}
                  onClick={() => toggleDropdown(role)}
                >
                  {/* Role label */}
                  <span className="text-[10px] font-mono text-chat-text/70 w-[72px] flex-shrink-0 select-none">
                    {ROLE_LABELS[role]}
                    {isSystemRole && <span className="text-chat-accent/50 ml-0.5">*</span>}
                  </span>

                  {/* Selected value display */}
                  <span className={`flex-1 min-w-0 text-xs font-mono truncate select-none ${
                    isEmpty ? 'text-chat-muted/30' : 'text-chat-text/80'
                  }`}>
                    {isEmpty ? '—' : selectedArr.join(', ')}
                  </span>

                  {/* Warning for empty system role */}
                  {isSystemRole && isEmpty && dirty && (
                    <span className="text-[8px] text-red-400/60 font-mono flex items-center gap-0.5 flex-shrink-0">
                      <AlertCircle size={9} /> required
                    </span>
                  )}

                  {/* Chevron */}
                  <ChevronDown
                    size={12}
                    className={`text-chat-muted/30 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Dropdown */}
                {isOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-chat-panel border border-white/10 rounded-md shadow-xl p-2 space-y-1.5">
                    {/* Key checkboxes */}
                    <div className="flex flex-wrap gap-1">
                      {aliasOptions.map(alias => {
                        const checked = ra.selectedKeys.has(alias);
                        return (
                          <button
                            key={alias}
                            onClick={(e) => { e.stopPropagation(); toggleKey(role, alias); }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] border text-[9px] font-mono transition-all ${
                              checked
                                ? 'bg-chat-accent/8 border-chat-accent/20 text-chat-accent'
                                : 'bg-transparent border-white/[0.06] text-chat-muted/40 hover:border-white/15'
                            }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-[2px] border flex items-center justify-center flex-shrink-0 ${
                              checked ? 'bg-chat-accent border-chat-accent' : 'border-white/15'
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
                      <div className="border-t border-white/[0.04] pt-1.5">
                        <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-chat-muted/40 px-1">Default</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedArr.map(alias => (
                            <button
                              key={alias}
                              onClick={(e) => { e.stopPropagation(); setDefault(role, alias); }}
                              className={`inline-flex items-center gap-1 text-[9px] font-mono transition-colors ${
                                ra.defaultAlias === alias ? 'text-chat-accent' : 'text-chat-muted/40 hover:text-chat-muted/70'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
                                ra.defaultAlias === alias ? 'border-chat-accent' : 'border-white/15'
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
