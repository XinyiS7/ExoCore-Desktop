import React, { useState, useEffect, useCallback } from 'react';
import { configApi } from 'exo-shared';
import { Save, AlertCircle, Shield } from 'lucide-react';
import Toast from './Toast';

const ROLES = ['system', 'session', 'sub_agent', 'background'];

const ROLE_LABELS = {
  system:     'System',
  session:    'Session',
  sub_agent:  'Sub-agent',
  background: 'Background',
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

  useEffect(() => {
    const next = buildInitial();
    setAssignments(next);
    setInitial(next);
    setFeedback(null);
  }, [platform, keyMapForPlatform, buildInitial]);

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
        /* Table layout */
        <div className="text-[10px]">
          {/* Table header */}
          <div className="grid grid-cols-[100px_1fr_140px] gap-2 px-2 pb-1.5 text-chat-muted/40 font-mono uppercase tracking-[0.1em]">
            <span>Role</span>
            <span>Assigned Keys</span>
            <span>Default</span>
          </div>

          {ROLES.map(role => {
            const ra = assignments[role];
            const selectedArr = [...ra.selectedKeys];
            const isEmpty = selectedArr.length === 0;
            const isSystemRole = role === 'system';

            return (
              <div
                key={role}
                className={`grid grid-cols-[100px_1fr_140px] gap-2 items-center px-2 py-2 border-t transition-colors ${
                  isSystemRole && isEmpty && dirty
                    ? 'border-red-500/10 bg-red-500/[0.03]'
                    : 'border-white/[0.03]'
                }`}
              >
                {/* Role name */}
                <div className="min-w-0">
                  <span className="text-chat-text/70 font-mono text-[10px]">
                    {ROLE_LABELS[role]}
                  </span>
                  {isSystemRole && (
                    <span className="text-[8px] text-chat-accent/50 font-mono ml-1">*</span>
                  )}
                  {isSystemRole && isEmpty && dirty && (
                    <span className="text-[8px] text-red-400/60 block">
                      <AlertCircle size={9} className="inline mr-0.5" />needs key
                    </span>
                  )}
                </div>

                {/* Key chips */}
                <div className="flex flex-wrap gap-1">
                  {aliasOptions.map(alias => {
                    const checked = ra.selectedKeys.has(alias);
                    return (
                      <button
                        key={alias}
                        onClick={() => toggleKey(role, alias)}
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

                {/* Default selector */}
                <div>
                  {selectedArr.length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedArr.map(alias => (
                        <button
                          key={alias}
                          onClick={() => setDefault(role, alias)}
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
                  ) : selectedArr.length === 1 ? (
                    <span className="text-chat-accent/60 font-mono text-[9px]">{selectedArr[0]}</span>
                  ) : (
                    <span className="text-chat-muted/30 font-mono text-[9px]">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
    </div>
  );
}
