import React, { useState, useEffect, useCallback } from 'react';
import { configApi } from 'exo-shared';
import { Save, AlertCircle, Shield } from 'lucide-react';
import Toast from './Toast';

const ROLES = ['system', 'session', 'sub_agent', 'background'];

const ROLE_LABELS = {
  system:     'System Default',
  session:    'Session Default',
  sub_agent:  'Sub-agent Default',
  background: 'Background Default',
};

const ROLE_REQUIRED = {
  system:     true,
  session:    false,
  sub_agent:  false,
  background: false,
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
  // Build initial state from props
  const buildInitial = useCallback(() => {
    const state = {};
    for (const role of ROLES) {
      const roleData = keyMapForPlatform?.[role];
      // Handle both new format {keys, default} and legacy string format
      if (roleData && typeof roleData === 'object' && Array.isArray(roleData.keys)) {
        state[role] = {
          selectedKeys: new Set(roleData.keys),
          defaultAlias: roleData.default || null,
        };
      } else if (typeof roleData === 'string' && roleData) {
        // Legacy: single alias string
        state[role] = {
          selectedKeys: new Set([roleData]),
          defaultAlias: roleData,
        };
      } else {
        state[role] = {
          selectedKeys: new Set(),
          defaultAlias: null,
        };
      }
    }
    return state;
  }, [keyMapForPlatform]);

  const [assignments, setAssignments] = useState(buildInitial);
  const [initial, setInitial] = useState(buildInitial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Reset when platform or keyMapForPlatform changes
  useEffect(() => {
    const next = buildInitial();
    setAssignments(next);
    setInitial(next);
    setFeedback(null);
  }, [platform, keyMapForPlatform, buildInitial]);

  const clearFeedback = () => setFeedback(null);

  const aliasOptions = keys.map(k => k.alias).sort();

  // ── Derived ──
  const dirty = !isEqual(assignments, initial);
  const systemHasKey = assignments.system?.selectedKeys?.size > 0;
  const canSave = dirty && systemHasKey && !saving;

  // ── Handlers ──
  const toggleKey = (role, alias) => {
    setAssignments(prev => {
      const roleData = { ...prev[role], selectedKeys: new Set(prev[role].selectedKeys) };
      if (roleData.selectedKeys.has(alias)) {
        roleData.selectedKeys.delete(alias);
        // If removing the default, pick another or clear
        if (roleData.defaultAlias === alias) {
          roleData.defaultAlias = roleData.selectedKeys.size === 1
            ? [...roleData.selectedKeys][0]
            : roleData.selectedKeys.size > 0
              ? [...roleData.selectedKeys][0]
              : null;
        }
      } else {
        roleData.selectedKeys.add(alias);
        // If this is the first key, auto-set as default
        if (roleData.selectedKeys.size === 1) {
          roleData.defaultAlias = alias;
        }
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

  // ── Save ──
  const handleSave = async () => {
    if (!canSave) return;
    clearFeedback();
    setSaving(true);
    try {
      // Get full key_map to preserve other platforms
      const config = await configApi.getConfig();
      const fullKeyMap = config.key_map || {};

      // Build platform entry
      const platformMap = {};
      for (const role of ROLES) {
        const ra = assignments[role];
        const sortedKeys = [...ra.selectedKeys].sort();
        platformMap[role] = {
          keys: sortedKeys,
          default: ra.defaultAlias || null,
        };
      }

      await configApi.updateKeyMap({ ...fullKeyMap, [platform]: platformMap });
      setFeedback({ type: 'success', msg: 'Key Map 保存成功' });
      // Update initial so dirty resets
      setInitial(buildInitial());
      onSaved?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-chat-panel border border-white/5 rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-chat-muted/50" />
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-chat-text/80">
            Key Map
          </span>
          {dirty && (
            <span className="text-[9px] font-mono text-chat-accent/60 animate-fade-in">
              (modified)
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-1.5 bg-chat-accent text-white text-[10px] font-bold uppercase tracking-[0.15em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-1.5"
        >
          {saving ? (
            <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={12} />
          )}
          Save Key Map
        </button>
      </div>

      {/* Empty state */}
      {aliasOptions.length === 0 && (
        <div className="text-center py-6 text-[11px] text-chat-muted/40 font-mono">
          No keys available. Create keys in the Key Pool section first.
        </div>
      )}

      {/* Role rows */}
      {aliasOptions.length > 0 && (
        <div className="space-y-3">
          {ROLES.map(role => {
            const ra = assignments[role];
            const isRequired = ROLE_REQUIRED[role];
            const selectedArr = [...ra.selectedKeys];
            const isEmpty = selectedArr.length === 0;
            const isSystemRole = role === 'system';

            return (
              <div
                key={role}
                className={`rounded-lg border p-3.5 space-y-2.5 transition-colors ${
                  isSystemRole && isEmpty && dirty
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-white/5 bg-chat-bg'
                }`}
              >
                {/* Role label */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-chat-text/70">
                    {ROLE_LABELS[role]}
                  </span>
                  {isRequired && (
                    <span className="text-[9px] font-mono text-chat-accent/60 uppercase tracking-wider">
                      (required)
                    </span>
                  )}
                  {isSystemRole && isEmpty && dirty && (
                    <span className="text-[9px] font-mono text-red-400/70 flex items-center gap-1">
                      <AlertCircle size={10} /> needs at least 1 key
                    </span>
                  )}
                </div>

                {/* Key checkboxes */}
                <div className="flex flex-wrap gap-2">
                  {aliasOptions.map(alias => {
                    const checked = ra.selectedKeys.has(alias);
                    const isDefault = ra.defaultAlias === alias;
                    return (
                      <label
                        key={alias}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-mono cursor-pointer transition-all select-none ${
                          checked
                            ? isDefault
                              ? 'bg-chat-accent/10 border-chat-accent/30 text-chat-accent'
                              : 'bg-chat-accent/5 border-chat-accent/15 text-chat-text/70'
                            : 'bg-transparent border-white/5 text-chat-muted/50 hover:border-white/15'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKey(role, alias)}
                          className="sr-only"
                        />
                        <span className={`w-3 h-3 rounded-[2px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked
                            ? 'bg-chat-accent border-chat-accent'
                            : 'border-white/20'
                        }`}>
                          {checked && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span>{alias}</span>
                      </label>
                    );
                  })}
                  {aliasOptions.length === 0 && (
                    <span className="text-[10px] text-chat-muted/40 italic">No keys available</span>
                  )}
                </div>

                {/* Default selector — only show when at least one key selected */}
                {selectedArr.length > 1 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-chat-muted/50 flex-shrink-0">
                      Default:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedArr.map(alias => (
                        <label
                          key={`def-${alias}`}
                          className="flex items-center gap-1 cursor-pointer select-none"
                        >
                          <input
                            type="radio"
                            name={`default-${platform}-${role}`}
                            checked={ra.defaultAlias === alias}
                            onChange={() => setDefault(role, alias)}
                            className="sr-only"
                          />
                          <span className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                            ra.defaultAlias === alias
                              ? 'border-chat-accent'
                              : 'border-white/20'
                          }`}>
                            {ra.defaultAlias === alias && (
                              <span className="w-1.5 h-1.5 rounded-full bg-chat-accent" />
                            )}
                          </span>
                          <span className={`text-[10px] font-mono transition-colors ${
                            ra.defaultAlias === alias
                              ? 'text-chat-accent'
                              : 'text-chat-muted/50'
                          }`}>
                            {alias}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      <Toast
        type={feedback?.type}
        message={feedback?.msg}
        onClose={clearFeedback}
      />
    </div>
  );
}
