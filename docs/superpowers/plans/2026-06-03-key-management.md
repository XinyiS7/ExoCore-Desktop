# Key Management + Chat Controls Drawer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Settings → Key Manage page (CRUD API keys per platform + 4 role slots) and expand ChatArea's controls panel into a drawer with per-session key-alias selection stored in localStorage.

**Architecture:** Settings uses nested routes (`/settings` layout + `/settings/keys` content). KeyManagePanel fetches keys via a custom hook, renders 4 independent RoleSlot sub-components per platform tab. ChatArea gains a ControlsDrawer that reads `key_map` from SystemConfig and persists the user's alias choice to localStorage keyed by session ID.

**Tech Stack:** React 19, React Router v6, Tailwind CSS (chat-* palette), exo-shared apiFetch + apiFetch wrapper

**Spec:** `docs/superpowers/specs/2026-06-03-key-management-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/endpoints/config.js` | Modify | Add apikeys CRUD + key-map API wrappers |
| `packages/chat-core/src/hooks/useApiKeys.js` | Create | Data hook: GET apikeys, expose CRUD helpers |
| `packages/chat-core/src/components/settings/RoleSlot.jsx` | Create | Single role-slot form (alias + masked key + save/delete) |
| `packages/chat-core/src/components/settings/KeyManagePanel.jsx` | Create | Platform tabs + 4 RoleSlots, routes at /settings/keys |
| `packages/chat-core/src/views/SettingsView.jsx` | Replace | A-layout: left nav list + `<Outlet />` |
| `packages/chat-core/src/components/chat/ControlsDrawer.jsx` | Create | Expanded drawer: model/thinking/temp + key-alias dropdown + color placeholder |
| `packages/chat-core/src/components/chat/ChatArea.jsx` | Modify | Replace inline controlsExpanded row with ControlsDrawer |
| `packages/chat-core/src/App.jsx` | Modify | Nest settings routes for /settings → /settings/keys |
| `packages/chat-core/src/components/settings/SettingsPanel.jsx` | Delete | No remaining callers |

---

### Task 1: Add API endpoint wrappers to shared config

**Files:**
- Modify: `packages/shared/src/endpoints/config.js`

- [ ] **Step 1: Add apikeys CRUD + key-map functions**

Read the current file at `packages/shared/src/endpoints/config.js`. Add the following exports below the existing `listModels()` function:

```js
// ── API Keys (§5.3) ──

/** GET /api/core/apikeys/ — list keys, optional ?platform= filter */
export function listApiKeys(platform) {
  const params = platform ? { platform } : undefined;
  return apiFetch('/api/core/apikeys/', { method: 'GET', params });
}

/** POST /api/core/apikeys/ — create a new key */
export function createApiKey({ alias, platform, key_value }) {
  return apiFetch('/api/core/apikeys/', { method: 'POST', body: { alias, platform, key_value } });
}

/** PATCH /api/core/apikeys/<id>/ — update alias only */
export function updateApiKeyAlias(id, alias) {
  return apiFetch(`/api/core/apikeys/${id}/`, { method: 'PATCH', body: { alias } });
}

/** PUT /api/core/apikeys/<id>/overwrite/ — overwrite key_value */
export function overwriteApiKey(id, key_value) {
  return apiFetch(`/api/core/apikeys/${id}/overwrite/`, { method: 'PUT', body: { key_value } });
}

/** DELETE /api/core/apikeys/<id>/ — cascade delete same-value keys */
export function deleteApiKey(id) {
  return apiFetch(`/api/core/apikeys/${id}/`, { method: 'DELETE' });
}

// ── Key Map (§5.4) ──

/** PUT /api/core/config/key-map/ — assign keys to roles per platform */
export function updateKeyMap(keyMap) {
  return apiFetch('/api/core/config/key-map/', { method: 'PUT', body: keyMap });
}
```

- [ ] **Step 2: Verify no other file imports the old config endpoint shape incorrectly**

Run: `grep -r "from 'exo-shared'" packages/chat-core/src/ --include="*.jsx" --include="*.js" | grep -i config`

Expected: only existing imports of `getConfig`, `updateConfig`, `listModels` remain valid; new exports are additive.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/endpoints/config.js
git commit -m "feat(shared): add apikeys CRUD + key-map API wrappers"
```

---

### Task 2: Create useApiKeys hook

**Files:**
- Create: `packages/chat-core/src/hooks/useApiKeys.js`

- [ ] **Step 1: Write the hook**

```js
import { useState, useEffect, useCallback } from 'react';
import { configApi } from 'exo-shared';

export function useApiKeys(platform) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKeys = useCallback(() => {
    if (!platform) return;
    setLoading(true);
    setError(null);
    configApi.listApiKeys(platform)
      .then(data => setKeys(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('useApiKeys fetch failed:', err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, [platform]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  return { keys, loading, error, refresh: fetchKeys };
}
```

- [ ] **Step 2: Verify the hook file is syntactically valid**

Run: `npx eslint packages/chat-core/src/hooks/useApiKeys.js` (if eslint is configured)

If not, just verify with a quick node parse — the file is straightforward.

- [ ] **Step 3: Commit**

```bash
git add packages/chat-core/src/hooks/useApiKeys.js
git commit -m "feat(chat-core): add useApiKeys hook"
```

---

### Task 3: Create RoleSlot component

**Files:**
- Create: `packages/chat-core/src/components/settings/RoleSlot.jsx`

Each role slot is an independent form unit: displays role label, alias input, masked key input, and a save/delete button. Handles its own create/update/delete lifecycle.

- [ ] **Step 1: Write RoleSlot.jsx**

```jsx
import React, { useState } from 'react';
import { configApi } from 'exo-shared';
import { Save, Trash2, AlertCircle, Check } from 'lucide-react';

/**
 * A single role slot for key management.
 *
 * Props:
 *  - role        : 'system' | 'session' | 'sub_agent' | 'background'
 *  - platform    : 'gemini' | 'deepseek'
 *  - existing    : { id, alias, last_four } | null (null = empty slot, needs creation)
 *  - onSaved     : () => void — callback after successful save/delete, triggers parent refresh
 */
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

export default function RoleSlot({ role, platform, existing, onSaved }) {
  const isRequired = ROLE_REQUIRED[role];
  const label = ROLE_LABELS[role];

  // Form state
  const [alias, setAlias] = useState(existing?.alias || '');
  const [keyValue, setKeyValue] = useState('');        // full key, only when user is typing
  const [maskedDisplay, setMaskedDisplay] = useState(   // ...last4 display
    existing?.last_four ? `...${existing.last_four}` : ''
  );
  const [showKeyInput, setShowKeyInput] = useState(false); // toggle key overwrite field

  // UI state
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);       // { type: 'success'|'error', msg }

  // Pre-validation
  const aliasEmpty = alias.trim() === '';
  const keyNeeded = !existing || showKeyInput;           // need key_value if creating OR overwriting
  const keyEmpty = keyNeeded && keyValue.trim() === '';
  const canSave = !aliasEmpty && !keyEmpty && !saving;

  // ── Key input masking: as user types, update display to "...last4" ──
  const handleKeyChange = (e) => {
    const val = e.target.value;
    setKeyValue(val);
    if (val.length >= 4) {
      setMaskedDisplay(`...${val.slice(-4)}`);
    } else if (val.length > 0) {
      setMaskedDisplay(`...${val}`);
    } else {
      setMaskedDisplay('');
    }
  };

  const clearFeedback = () => setFeedback(null);

  // ── Save handler ──
  const handleSave = async () => {
    clearFeedback();
    if (!canSave) return;
    setSaving(true);

    try {
      if (!existing) {
        // ── Create new key ──
        const created = await configApi.createApiKey({
          alias: alias.trim(),
          platform,
          key_value: keyValue.trim(),
        });
        // No key-map update here — parent handles that or we do it separately.
        // For now, creating a key stores it. Key-map assignment is done after.
        setKeyValue('');
        setShowKeyInput(false);
        setFeedback({ type: 'success', msg: '保存成功' });
        onSaved?.();
      } else if (showKeyInput) {
        // ── Overwrite key value ──
        await configApi.overwriteApiKey(existing.id, keyValue.trim());
        setKeyValue('');
        setShowKeyInput(false);
        setFeedback({ type: 'success', msg: 'Key 已更新' });
        onSaved?.();
      } else {
        // ── Update alias only ──
        await configApi.updateApiKeyAlias(existing.id, alias.trim());
        setFeedback({ type: 'success', msg: 'Alias 已更新' });
        onSaved?.();
      }
    } catch (err) {
      const msg = err.body?.detail || err.body?.error || err.message || '保存失败';
      setFeedback({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete handler ──
  const handleDelete = async () => {
    if (!existing) return;
    if (!window.confirm(`删除 key "${existing.alias}"？这将级联删除所有同值 key。`)) return;
    clearFeedback();
    setSaving(true);
    try {
      await configApi.deleteApiKey(existing.id);
      setAlias('');
      setMaskedDisplay('');
      setFeedback({ type: 'success', msg: '删除成功' });
      onSaved?.();
    } catch (err) {
      const msg = err.body?.detail || err.body?.error || err.message || '删除失败';
      setFeedback({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-chat-panel border border-white/5 rounded-lg p-5 space-y-4">
      {/* Role header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-chat-text/80">
            {label}
          </span>
          {isRequired && (
            <span className="text-[9px] font-mono text-chat-accent/70 uppercase tracking-wider">
              (required)
            </span>
          )}
        </div>
        {existing && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="p-1 text-chat-muted/40 hover:text-red-400 transition-colors disabled:opacity-30"
            title="删除此 key"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Alias input */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-chat-muted/60">
          Alias {isRequired && '*'}
        </label>
        <input
          type="text"
          value={alias}
          onChange={e => { setAlias(e.target.value); clearFeedback(); }}
          placeholder={isRequired ? '必填，例如：我的主力key' : '选填'}
          maxLength={50}
          className="w-full px-3 py-2 bg-chat-bg border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 transition-colors placeholder:text-chat-muted/30 font-mono"
        />
      </div>

      {/* Key input */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-chat-muted/60">
          Key {!existing && '*'}
        </label>

        {!existing || showKeyInput ? (
          <input
            type="password"
            value={keyValue}
            onChange={handleKeyChange}
            placeholder="粘贴 API Key..."
            autoComplete="off"
            className="w-full px-3 py-2 bg-chat-bg border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 transition-colors placeholder:text-chat-muted/30 font-mono"
          />
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-chat-bg border border-white/10 rounded text-sm text-chat-muted font-mono select-all">
              {maskedDisplay || '—'}
            </code>
            <button
              onClick={() => { setShowKeyInput(true); setKeyValue(''); setMaskedDisplay(''); clearFeedback(); }}
              className="text-[10px] font-mono uppercase tracking-wider text-chat-accent/60 hover:text-chat-accent transition-colors whitespace-nowrap px-2 py-1"
            >
              覆盖
            </button>
          </div>
        )}

        {/* Inline validation hint */}
        {aliasEmpty && (
          <p className="text-[10px] text-red-400/70 font-mono flex items-center gap-1">
            <AlertCircle size={10} /> Alias is required
          </p>
        )}
        {!aliasEmpty && keyNeeded && keyValue.trim() === '' && (
          <p className="text-[10px] text-red-400/70 font-mono flex items-center gap-1">
            <AlertCircle size={10} /> Key is required
          </p>
        )}
      </div>

      {/* Save button + feedback */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-5 py-2 bg-chat-accent text-white text-xs font-bold uppercase tracking-[0.15em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-2"
        >
          {saving ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          保存
        </button>

        {feedback && (
          <span className={`text-[11px] font-mono flex items-center gap-1 ${
            feedback.type === 'success' ? 'text-green-400' : 'text-red-400'
          }`}>
            {feedback.type === 'success' ? <Check size={12} /> : <AlertCircle size={12} />}
            {feedback.msg}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/RoleSlot.jsx
git commit -m "feat(chat-core): add RoleSlot component for key management"
```

---

### Task 4: Create KeyManagePanel component

**Files:**
- Create: `packages/chat-core/src/components/settings/KeyManagePanel.jsx`

This is the top-tab (B-layout) panel rendered at `/settings/keys`. It determines available platforms from the model registry, shows a platform tab bar, and renders 4 RoleSlots under the selected platform tab.

- [ ] **Step 1: Write KeyManagePanel.jsx**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { configApi, MODEL_REGISTRY } from 'exo-shared';
import { useApiKeys } from '../../hooks/useApiKeys';
import RoleSlot from './RoleSlot';
import { RefreshCw } from 'lucide-react';

/**
 * Derive unique platform list from model registry.
 * Falls back to ['gemini', 'deepseek'] if registry is empty.
 */
function getPlatforms() {
  const providers = [...new Set(MODEL_REGISTRY.map(m => m.provider))];
  return providers.length > 0 ? providers : ['gemini', 'deepseek'];
}

export default function KeyManagePanel() {
  const platforms = getPlatforms();
  const [activePlatform, setActivePlatform] = useState(platforms[0] || 'gemini');
  const { keys, loading, refresh } = useApiKeys(activePlatform);

  // Key map from SystemConfig (for display: which key is assigned to which role)
  const [keyMap, setKeyMap] = useState({});

  const fetchKeyMap = useCallback(() => {
    configApi.getConfig()
      .then(config => setKeyMap(config.key_map || {}))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchKeyMap(); }, [fetchKeyMap]);

  // Build a lookup: role → existing key object
  const roleKeyMap = keyMap[activePlatform] || {};

  const getExistingForKey = (role) => {
    const ref = roleKeyMap[role];  // can be int (id) or string (alias)
    if (ref === null || ref === undefined) return null;

    // Try matching by id first, then by alias
    const byId = keys.find(k => k.id === ref);
    if (byId) return byId;
    const byAlias = keys.find(k => k.alias === ref);
    if (byAlias) return byAlias;

    return null;
  };

  const roles = ['system', 'session', 'sub_agent', 'background'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-chat-muted/40" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Platform tabs */}
      <div className="flex gap-0 border-b border-white/5 px-6 pt-2">
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-5 py-2.5 text-xs font-mono uppercase tracking-[0.15em] transition-all border-b-2 -mb-[1px] ${
              activePlatform === p
                ? 'text-chat-accent border-chat-accent bg-chat-accent/5'
                : 'text-chat-muted/50 border-transparent hover:text-chat-muted hover:border-chat-muted/20'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Role slots */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {roles.map(role => (
          <RoleSlot
            key={`${activePlatform}-${role}`}
            role={role}
            platform={activePlatform}
            existing={getExistingForKey(role)}
            onSaved={() => {
              refresh();
              fetchKeyMap();
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/KeyManagePanel.jsx
git commit -m "feat(chat-core): add KeyManagePanel with platform tabs and role slots"
```

---

### Task 5: Rewrite SettingsView as A-layout shell

**Files:**
- Replace: `packages/chat-core/src/views/SettingsView.jsx`

The new SettingsView is the A-layout container: vertical left nav + `<Outlet />` for the right content area. It no longer contains profile or placeholder sections.

- [ ] **Step 1: Read the current file, then write the replacement**

Current file at `packages/chat-core/src/views/SettingsView.jsx` — read it to confirm content, then overwrite:

```jsx
import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Key, Clock } from 'lucide-react';

const NAV_ITEMS = [
  {
    id: 'keys',
    label: 'Key Manage',
    icon: Key,
    route: '/settings/keys',
    enabled: true,
  },
  {
    id: 'routine',
    label: 'Routine Manage',
    icon: Clock,
    route: '/settings/routine',
    enabled: false,
  },
];

export default function SettingsView() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (route) => location.pathname === route;

  return (
    <div className="flex-1 h-full flex overflow-hidden">
      {/* Left nav (A-layout) */}
      <nav className="w-52 flex-shrink-0 border-r border-white/5 bg-chat-panel/50 py-6 flex flex-col">
        <div className="px-4 mb-4">
          <h1 className="text-sm font-semibold text-chat-text/90 tracking-tight">Settings</h1>
        </div>

        <div className="flex-1 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon, route, enabled }) => (
            <button
              key={id}
              onClick={() => enabled && navigate(route)}
              disabled={!enabled}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all text-left ${
                enabled && isActive(route)
                  ? 'bg-chat-accent/10 text-chat-accent border-l-2 border-chat-accent'
                  : enabled
                    ? 'text-chat-muted hover:text-chat-text hover:bg-white/5'
                    : 'text-chat-muted/25 cursor-not-allowed'
              }`}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span className="font-sans text-[13px]">{label}</span>
              {!enabled && (
                <span className="text-[9px] font-mono uppercase tracking-wider text-chat-muted/20 ml-auto">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Right content area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/views/SettingsView.jsx
git commit -m "feat(chat-core): rewrite SettingsView as A-layout shell with left nav"
```

---

### Task 6: Update App.jsx settings routing for nested routes

**Files:**
- Modify: `packages/chat-core/src/App.jsx`

- [ ] **Step 1: Read the current App.jsx settings route section (lines 198-200, 219-220)**

Currently:
```jsx
function SettingsRoute() {
  return <SettingsView />;
}
```

And:
```jsx
<Route path="settings" element={<SettingsRoute />} />
```

- [ ] **Step 2: Replace the SettingsRoute function and add nested routes**

Replace the `SettingsRoute` function (line 198-200):

```jsx
function SettingsRoute() {
  return <SettingsView />;
}
```

Keep it the same — SettingsView now renders `<Outlet />` so it works as a layout route.

Replace the `<Route path="settings">` line (line 220):

```jsx
<Route path="settings" element={<SettingsRoute />}>
  <Route index element={<Navigate to="keys" replace />} />
  <Route path="keys" element={<KeyManageRoute />} />
  <Route path="routine" element={<RoutinePlaceholderRoute />} />
</Route>
```

Add these route wrapper functions before `export default function App()`:

```jsx
function KeyManageRoute() {
  return <KeyManagePanel />;
}

function RoutinePlaceholderRoute() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <Clock size={32} className="text-chat-muted/20 mx-auto" />
        <p className="text-sm text-chat-muted/40 font-mono">Routine Manage</p>
        <p className="text-[10px] text-chat-muted/20 font-mono uppercase tracking-widest">Coming soon</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add missing imports at top of App.jsx**

Add these imports near the existing view imports (around line 23):

```jsx
import KeyManagePanel from './components/settings/KeyManagePanel';
import { Navigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
```

Note: `Navigate` is already available via `useNavigate` import — change the import line to:

```jsx
import { Routes, Route, useNavigate, useParams, useLocation, Outlet, Navigate } from 'react-router-dom';
```

- [ ] **Step 4: Commit**

```bash
git add packages/chat-core/src/App.jsx
git commit -m "feat(chat-core): add nested routes for settings keys/routine"
```

---

### Task 7: Create ControlsDrawer component

**Files:**
- Create: `packages/chat-core/src/components/chat/ControlsDrawer.jsx`

This is the expanded drawer that replaces the inline `controlsExpanded` row in ChatArea. It contains model/thinking/temp selectors from the current controls, plus the new key-alias dropdown and a disabled color-scheme row.

- [ ] **Step 1: Write ControlsDrawer.jsx**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { configApi, MODEL_REGISTRY, MAIN_MODEL_IDS } from 'exo-shared';
import { Cpu, Key, Palette } from 'lucide-react';

/**
 * Controls drawer shown above the chat input when SlidersHorizontal is clicked.
 *
 * Props:
 *  - currentModel    : string — currently selected model ID
 *  - thinkingLevel   : string — "off"|"auto"|"low"|"medium"|"high"
 *  - temperature     : number
 *  - chatMode        : string — "sse"|"async"
 *  - sessionId       : number — active session ID
 *  - lastTelemetry   : object | null — latest SSE telemetry event
 *  - sessionTelemetryRef : ref — accumulated session totals
 *  - telemetryExpanded : boolean
 *  - setTelemetryExpanded : fn
 *  - onPreferenceChange : fn({ model?, thinking_level?, temperature? }) — calls parent updatePreference
 *  - onChatModeChange   : fn(mode)
 */
export default function ControlsDrawer({
  currentModel,
  thinkingLevel,
  temperature,
  chatMode,
  sessionId,
  lastTelemetry,
  sessionTelemetryRef,
  telemetryExpanded,
  setTelemetryExpanded,
  onPreferenceChange,
  onChatModeChange,
}) {
  // ── Key alias state ──
  const [aliases, setAliases] = useState([]);
  const [selectedAlias, setSelectedAlias] = useState('');

  // Determine platform from current model
  const platform = MODEL_REGISTRY.find(m => m.id === currentModel)?.provider || '';

  // Load key_map + aliases
  const loadKeyData = useCallback(async () => {
    if (!sessionId || !platform) return;
    try {
      const [config, keys] = await Promise.all([
        configApi.getConfig(),
        configApi.listApiKeys(platform),
      ]);
      const keyMap = config.key_map || {};
      const platformMap = keyMap[platform] || {};

      // Build alias list from keys
      const aliasList = (Array.isArray(keys) ? keys : []).map(k => k.alias);
      setAliases(aliasList);

      // Determine default: localStorage override > session default > system default
      const stored = localStorage.getItem(`exo_session_key_${sessionId}`);
      if (stored && aliasList.includes(stored)) {
        setSelectedAlias(stored);
        return;
      }

      // Resolve session default (may be id or alias)
      const sessionRef = platformMap.session;
      const systemRef = platformMap.system;
      const resolveAlias = (ref) => {
        if (!ref) return null;
        const byId = keys.find(k => k.id === ref);
        if (byId) return byId.alias;
        const byAlias = keys.find(k => k.alias === ref);
        if (byAlias) return byAlias.alias;
        return typeof ref === 'string' ? ref : null;
      };

      const def = resolveAlias(sessionRef) || resolveAlias(systemRef) || aliasList[0] || '';
      setSelectedAlias(def);
    } catch {
      // Silently fail — key selector will show empty
    }
  }, [sessionId, platform]);

  useEffect(() => { loadKeyData(); }, [loadKeyData]);

  // Persist alias choice to localStorage
  const handleAliasChange = (alias) => {
    setSelectedAlias(alias);
    if (sessionId) {
      localStorage.setItem(`exo_session_key_${sessionId}`, alias);
    }
  };

  return (
    <div className="px-4 pt-3 pb-1 border-t border-exo-mist-10 bg-exo-pure/60 backdrop-blur-md space-y-3 animate-fade-in">
      {/* Row 1: Model + Thinking + Temp + Chat Mode */}
      <div className="flex items-center gap-3 text-exo-muted flex-wrap">
        <Cpu size={10} className="text-exo-muted/25 flex-shrink-0" />

        <select
          value={currentModel}
          onChange={e => onPreferenceChange({ model: e.target.value })}
          className="bg-transparent outline-none text-[11px] font-sans text-white/50 cursor-pointer max-w-[140px] truncate hover:text-white/80 transition-colors"
        >
          {MAIN_MODEL_IDS.map(m => (
            <option key={m} value={m} className="bg-exo-pure text-white">{m}</option>
          ))}
        </select>

        <span className="text-exo-muted/12 text-[9px] select-none flex-shrink-0">|</span>

        <select
          value={chatMode}
          onChange={e => onChatModeChange(e.target.value)}
          className="bg-transparent outline-none text-[11px] font-sans text-white/40 cursor-pointer hover:text-white/70 transition-colors"
        >
          <option value="sse" className="bg-exo-pure">SSE</option>
          <option value="async" className="bg-exo-pure">Async</option>
        </select>

        <span className="text-exo-muted/12 text-[9px] select-none flex-shrink-0">|</span>

        <select
          value={thinkingLevel}
          onChange={e => onPreferenceChange({ thinking_level: e.target.value })}
          className="bg-transparent outline-none text-[11px] font-sans text-white/40 cursor-pointer hover:text-white/70 transition-colors"
        >
          <option value="off" className="bg-exo-pure">Off</option>
          <option value="auto" className="bg-exo-pure">Auto</option>
          <option value="low" className="bg-exo-pure">Low</option>
          <option value="medium" className="bg-exo-pure">Med</option>
          <option value="high" className="bg-exo-pure">High</option>
        </select>

        <span className="text-exo-muted/12 text-[9px] select-none flex-shrink-0">|</span>

        <select
          value={temperature}
          onChange={e => onPreferenceChange({ temperature: e.target.value })}
          className="bg-transparent outline-none text-[11px] font-sans text-white/40 cursor-pointer hover:text-white/70 transition-colors"
        >
          <option value="1.0" className="bg-exo-pure">1.0</option>
          <option value="1.3" className="bg-exo-pure">1.3</option>
          <option value="1.8" className="bg-exo-pure">1.8</option>
        </select>

        {/* Telemetry (moved from old inline row) */}
        {lastTelemetry && (
          <div className="ml-auto flex items-center gap-2 relative flex-shrink-0">
            <button
              onClick={() => setTelemetryExpanded(v => !v)}
              className="font-sans text-[10px] text-exo-muted/25 tabular-nums tracking-wider hover:text-exo-accent/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-exo-accent/50" />
              <span className="text-exo-muted/35">{lastTelemetry.model_name || lastTelemetry.platform}</span>
              <span>TX:{lastTelemetry.input_chars?.toLocaleString()}</span>
              <span>RX:{lastTelemetry.output_chars?.toLocaleString()}</span>
              {lastTelemetry.cached_input_chars > 0 && (
                <span>CACHE:{Math.round(lastTelemetry.cached_input_chars / (lastTelemetry.input_chars || 1) * 100)}%</span>
              )}
              {lastTelemetry.tool_calls > 0 && (
                <span>TOOLS:{lastTelemetry.tool_calls}</span>
              )}
            </button>
            {telemetryExpanded && (
              <div className="absolute bottom-full right-0 mb-2 px-4 py-3 bg-exo-panel border border-exo-border rounded-[4px] font-mono text-[10px] text-exo-muted shadow-xl z-50 min-w-[260px] animate-fade-in">
                <div className="text-exo-accent/60 text-[9px] uppercase tracking-[0.2em] mb-2 font-bold">Session Totals</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <span className="opacity-50">Requests</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.requests}</span>
                  <span className="opacity-50">Total TX</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalInput.toLocaleString()}</span>
                  <span className="opacity-50">Total RX</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalOutput.toLocaleString()}</span>
                  <span className="opacity-50">Total Cached</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalCached.toLocaleString()}</span>
                  <span className="opacity-50">Cache Hit Rate</span>
                  <span className="text-white/80 tabular-nums text-right">
                    {sessionTelemetryRef.current.totalInput > 0
                      ? Math.round(sessionTelemetryRef.current.totalCached / sessionTelemetryRef.current.totalInput * 100)
                      : 0}%
                  </span>
                  <span className="opacity-50">Tool Calls</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalTools}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Key Alias Selector */}
      <div className="flex items-center gap-3">
        <Key size={10} className="text-exo-muted/25 flex-shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-exo-muted/40 flex-shrink-0">
          Key Alias
        </span>
        {aliases.length > 0 ? (
          <select
            value={selectedAlias}
            onChange={e => handleAliasChange(e.target.value)}
            className="bg-transparent outline-none text-[11px] font-sans text-white/50 cursor-pointer hover:text-white/80 transition-colors max-w-[160px] truncate"
          >
            {aliases.map(a => (
              <option key={a} value={a} className="bg-exo-pure text-white">{a}</option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] text-exo-muted/25 italic">
            {platform ? `No keys configured for ${platform}` : 'Select a model first'}
          </span>
        )}
      </div>

      {/* Row 3: Color Scheme (disabled placeholder) */}
      <div className="flex items-center gap-3 opacity-30">
        <Palette size={10} className="text-exo-muted/25 flex-shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-exo-muted/40 flex-shrink-0">
          Color Scheme
        </span>
        <span className="text-[10px] text-exo-muted/30 italic">Coming soon</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/chat/ControlsDrawer.jsx
git commit -m "feat(chat-core): add ControlsDrawer with key-alias selector"
```

---

### Task 8: Integrate ControlsDrawer into ChatArea

**Files:**
- Modify: `packages/chat-core/src/components/chat/ChatArea.jsx`

- [ ] **Step 1: Read the current ChatArea.jsx to confirm line ranges**

Key sections to modify:
- Import block (add `ControlsDrawer` import, remove unused imports if any)
- `controlsExpanded` rendering block (lines 801-886) → replace with `<ControlsDrawer />`
- `handleSend` (line 334-337) → add `api_key_alias` to body

- [ ] **Step 2: Add import for ControlsDrawer**

At the top of ChatArea.jsx, add the import near the existing component imports (after line 14):

```jsx
import ControlsDrawer from './ControlsDrawer';
```

- [ ] **Step 3: Add api_key_alias read from localStorage in handleSend**

In the `handleSend` function, inside `bodyData` construction (around line 334-337), add the key alias:

Find:
```jsx
const bodyData = {
  content: currentInput,
  model: currentModel,
  thinking_level: thinkingLevel,
  temperature: temperature,
```

Add `api_key_alias` below `temperature`:
```jsx
const bodyData = {
  content: currentInput,
  model: currentModel,
  thinking_level: thinkingLevel,
  temperature: temperature,
  ...(activeSessionId && localStorage.getItem(`exo_session_key_${activeSessionId}`)
    ? { api_key_alias: localStorage.getItem(`exo_session_key_${activeSessionId}`) }
    : {}),
```

- [ ] **Step 4: Replace the controlsExpanded block with ControlsDrawer**

Find the block from line 801 to line 886 (the `{controlsExpanded && ( ... )}` section) and replace with:

```jsx
{/* Controls drawer — replaces old inline row */}
{controlsExpanded && (
  <ControlsDrawer
    currentModel={currentModel}
    thinkingLevel={thinkingLevel}
    temperature={temperature}
    chatMode={chatMode}
    sessionId={activeSessionId}
    lastTelemetry={lastTelemetry}
    sessionTelemetryRef={sessionTelemetryRef}
    telemetryExpanded={telemetryExpanded}
    setTelemetryExpanded={setTelemetryExpanded}
    onPreferenceChange={updatePreference}
    onChatModeChange={(mode) => {
      setChatMode(mode);
      localStorage.setItem('exo_chat_mode', mode);
    }}
  />
)}
```

Remove the `chatMode` setter function from the old inline `onChange` since ControlsDrawer now handles it via `onChatModeChange`.

- [ ] **Step 5: Remove the `controlsExpanded` row completely and clean up unused variables**

The old `controlsExpanded` block (lines 801–886) is fully replaced. Verify:
- `setChatMode` is still used (it's in the `ControlsDrawer` callback)
- `updatePreference` is still used (passed as `onPreferenceChange`)
- The `<SlidersHorizontal>` button (around line 958-963) stays as-is

- [ ] **Step 6: Commit**

```bash
git add packages/chat-core/src/components/chat/ChatArea.jsx
git commit -m "feat(chat-core): integrate ControlsDrawer, send api_key_alias with messages"
```

---

### Task 9: Clean up old SettingsPanel.jsx

**Files:**
- Delete: `packages/chat-core/src/components/settings/SettingsPanel.jsx`

- [ ] **Step 1: Verify no remaining imports**

Run:
```bash
grep -r "SettingsPanel" packages/chat-core/src/ --include="*.jsx" --include="*.js"
```

Expected: Only the file itself (`SettingsPanel.jsx`) matches. No other file imports it.

- [ ] **Step 2: Delete the file**

```bash
git rm packages/chat-core/src/components/settings/SettingsPanel.jsx
git commit -m "chore(chat-core): remove unused SettingsPanel component"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: Build check**

Run:
```bash
cd packages/chat-core && pnpm build
```

Expected: Build succeeds with no errors. Warnings are acceptable.

- [ ] **Step 2: Verify settings navigation**

Start the dev server and manually verify:
1. Click Settings in sidebar → navigates to `/settings/keys`
2. Left nav shows "Key Manage" (active) and "Routine Manage" (greyed out)
3. Platform tabs show Gemini / DeepSeek
4. Each platform shows 4 role slots (System, Session, Sub-agent, Background)

- [ ] **Step 3: Verify key CRUD in settings**

1. Empty state: system slot shows blank alias + key inputs
2. Fill in alias + paste a key → key input masks to `...last4`
3. Click save → success feedback appears
4. Refresh → key persists with alias + last4 display
5. Edit alias → click save → success
6. Click "覆盖" → paste new key → save → success
7. Click delete → confirm dialog → key removed

- [ ] **Step 4: Verify ChatArea key-alias selector**

1. Open a chat session
2. Click SlidersHorizontal → drawer expands
3. Key Alias row shows dropdown with available aliases for current model's platform
4. Default matches key_map session/system default
5. Switch to a different alias → stored in localStorage
6. Refresh page → alias persists
7. Switch model to other platform → aliases update

- [ ] **Step 5: Verify api_key_alias is sent**

1. Open browser DevTools Network tab
2. Send a message in chat
3. Check POST `/api/agents/chat/<sid>/` request body → includes `api_key_alias` field

- [ ] **Step 6: Commit any fixes from verification**

```bash
git add -A && git commit -m "chore: post-verification fixes for key management feature"
```

---

## Verification Checklist (summary)

- [ ] `pnpm build` passes for chat-core
- [ ] `/settings` redirects to `/settings/keys`
- [ ] Left nav: Key Manage (active), Routine Manage (disabled)
- [ ] Platform tabs render dynamically from model registry
- [ ] Each platform has 4 role slots with independent save buttons
- [ ] Key input masks to `...last4` as user types
- [ ] Pre-validation blocks save if alias or key is empty
- [ ] Create, update alias, overwrite key, delete all work end-to-end
- [ ] ChatArea ControlsDrawer expands on SlidersHorizontal click
- [ ] Key-alias dropdown shows correct aliases for current model's platform
- [ ] Default alias = session default || system default from key_map
- [ ] Per-session alias persisted in localStorage (`exo_session_key_${sessionId}`)
- [ ] `api_key_alias` included in chat POST body
- [ ] Old `SettingsPanel.jsx` removed with no broken imports
