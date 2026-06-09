# Settings V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 chat-core Settings 页面的全面改造：紧凑化 Key Manage、新增 Model Assign / 启用 Routine、分离系统字体和消息字体。

**Architecture:** 所有数据通过 shared 包的 `configApi` 与后端 SystemConfig 单例交互。字体通过 CSS 变量 (`--font-system` / `--font-message`) 分层控制，Tailwind `font-sans` 映射到系统字体，消息元素显式使用消息字体。

**Tech Stack:** React 18, Tailwind CSS 3, lucide-react, react-markdown, exo-shared (configApi + useFont)

---

## File Structure

```
packages/shared/src/
├── hooks/useFont.js          ← 重构：双字体选择
└── styles/fonts.css          ← 新增 CSS 变量

packages/chat-core/
├── src/
│   ├── index.css             ← body 字体 → --font-system
│   ├── tailwind.config.js    ← font-sans → var(--font-system)
│   ├── App.jsx               ← 新路由：model-assign, routine
│   ├── views/SettingsView.jsx← 导航菜单更新
│   ├── components/settings/
│   │   ├── AppearancePanel.jsx     ← 重做：双字体选择器
│   │   ├── KeyManagePanel.jsx      ← 微调间距
│   │   ├── KeyPoolSection.jsx      ← 紧凑重设计
│   │   ├── RoleKeyMapSection.jsx   ← 表格式 + 角色标签更新
│   │   ├── ModelAssignPanel.jsx    ← 新建
│   │   ├── RoutinePanel.jsx        ← 新建
│   │   └── Toast.jsx               ← 不变
│   ├── components/chat/
│   │   ├── MessageBubble.jsx       ← 消息内容 → --font-message
│   │   └── ChatArea.jsx            ← 输入框 → --font-message
│   ├── components/groupchat/
│   │   └── GroupchatMessage.jsx    ← 群桥消息 → --font-message
│   └── views/
│       └── GroupchatRoom.jsx       ← 输入框 → --font-message
```

---

### Task 1: useFont 重构 — 双字体支持

**Files:**
- Modify: `packages/shared/src/hooks/useFont.js`

- [ ] **Step 1: 重写 useFont.js**

```javascript
import { useState, useEffect, useCallback } from 'react';

const FONT_SYSTEM_KEY = 'exo_font_system';
const FONT_MESSAGE_KEY = 'exo_font_message';
const FONT_LEGACY_KEY = 'exo_font_preference';
const DEFAULT_FONT = 'sarasa';

// Font stack definitions
const FONT_STACKS = {
  sarasa:  "'Sarasa Gothic Mono', 'LXGW WenKai', 'Maple Mono', monospace",
  wenkai:  "'LXGW WenKai', 'Sarasa Gothic Mono', 'Georgia', serif",
  maple:   "'Maple Mono', 'Sarasa Gothic Mono', 'Consolas', monospace",
};

export const AVAILABLE_FONTS = [
  { value: 'sarasa',  label: 'Sarasa Gothic Mono',  preview: '更纱等宽黑体 — 春江潮水连海平' },
  { value: 'wenkai',  label: '霞鹜文楷 LXGW WenKai', preview: '霞鹜文楷 — 落霞与孤鹜齐飞' },
  { value: 'maple',   label: 'Maple Mono',           preview: 'Maple Mono — The quick brown fox' },
];

// Fixed font stacks (not user-configurable)
const FONT_NAV  = "'LXGW WenKai', 'Sarasa Gothic Mono', 'Segoe UI', sans-serif";
const FONT_CODE = "'Maple Mono', 'Consolas', 'Cascadia Code', monospace";

function getStoredFont(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function applyFontVariables(systemFont, messageFont) {
  const root = document.documentElement;
  const systemStack = FONT_STACKS[systemFont] || FONT_STACKS[DEFAULT_FONT];
  const messageStack = FONT_STACKS[messageFont] || FONT_STACKS[DEFAULT_FONT];

  root.style.setProperty('--font-system', systemStack);
  root.style.setProperty('--font-message', messageStack);
  // Backward compat: --font-body mirrors --font-system
  root.style.setProperty('--font-body', systemStack);
  root.style.setProperty('--font-nav', FONT_NAV);
  root.style.setProperty('--font-code', FONT_CODE);
}

export function useFont() {
  // Migrate legacy preference on first load
  const legacyFont = (() => {
    try {
      return localStorage.getItem(FONT_LEGACY_KEY);
    } catch { return null; }
  })();

  if (legacyFont) {
    try {
      localStorage.setItem(FONT_SYSTEM_KEY, legacyFont);
      localStorage.setItem(FONT_MESSAGE_KEY, legacyFont);
      localStorage.removeItem(FONT_LEGACY_KEY);
    } catch { /* storage unavailable */ }
  }

  const [systemFont, setSystemFontState] = useState(
    () => getStoredFont(FONT_SYSTEM_KEY, DEFAULT_FONT)
  );
  const [messageFont, setMessageFontState] = useState(
    () => getStoredFont(FONT_MESSAGE_KEY, DEFAULT_FONT)
  );

  // Apply CSS variables on mount and on change
  useEffect(() => {
    applyFontVariables(systemFont, messageFont);
  }, [systemFont, messageFont]);

  // Listen for cross-tab changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === FONT_SYSTEM_KEY) {
        setSystemFontState(getStoredFont(FONT_SYSTEM_KEY, DEFAULT_FONT));
      }
      if (e.key === FONT_MESSAGE_KEY) {
        setMessageFontState(getStoredFont(FONT_MESSAGE_KEY, DEFAULT_FONT));
      }
      if (e.key === FONT_LEGACY_KEY) {
        // Handle legacy migration in other tabs
        const legacy = getStoredFont(FONT_LEGACY_KEY, null);
        if (legacy) {
          localStorage.setItem(FONT_SYSTEM_KEY, legacy);
          localStorage.setItem(FONT_MESSAGE_KEY, legacy);
          localStorage.removeItem(FONT_LEGACY_KEY);
          setSystemFontState(legacy);
          setMessageFontState(legacy);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setSystemFont = useCallback((font) => {
    try { localStorage.setItem(FONT_SYSTEM_KEY, font); } catch {}
    setSystemFontState(font);
  }, []);

  const setMessageFont = useCallback((font) => {
    try { localStorage.setItem(FONT_MESSAGE_KEY, font); } catch {}
    setMessageFontState(font);
  }, []);

  return {
    systemFont,
    messageFont,
    setSystemFont,
    setMessageFont,
    availableFonts: AVAILABLE_FONTS,
  };
}
```

- [ ] **Step 2: 验证向后兼容**

手动在浏览器 console 中设置 `localStorage.setItem('exo_font_preference', 'wenkai')`，刷新页面后检查：
- `localStorage.getItem('exo_font_system')` === `'wenkai'`
- `localStorage.getItem('exo_font_message')` === `'wenkai'`
- `localStorage.getItem('exo_font_preference')` === `null` (已清除)
- `getComputedStyle(document.documentElement).getPropertyValue('--font-system')` 包含 `'LXGW WenKai'`

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/hooks/useFont.js
git commit -m "refactor(shared): split useFont into system/message dual-font support with legacy migration"
```

---

### Task 2: fonts.css + index.css 更新

**Files:**
- Modify: `packages/shared/src/styles/fonts.css`
- Modify: `packages/chat-core/src/index.css`

- [ ] **Step 1: 更新 fonts.css 的 CSS 变量**

```css
@import '@fontsource/lxgw-wenkai/300.css';
@import '@fontsource/lxgw-wenkai/700.css';
@import '@fontsource/maple-mono/400.css';
@import '@fontsource/maple-mono/500.css';
@import '@fontsource/maple-mono/700.css';

@font-face {
  font-family: 'Sarasa Gothic Mono';
  src: url('../assets/fonts/sarasa-gothic-mono-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Sarasa Gothic Mono';
  src: url('../assets/fonts/sarasa-gothic-mono-bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-system:  'Sarasa Gothic Mono', 'LXGW WenKai', 'Maple Mono', monospace;
  --font-message: 'Sarasa Gothic Mono', 'LXGW WenKai', 'Maple Mono', monospace;
  --font-body:    'Sarasa Gothic Mono', 'LXGW WenKai', 'Maple Mono', monospace; /* deprecated alias for --font-system */
  --font-nav:     'LXGW WenKai', 'Sarasa Gothic Mono', 'Segoe UI', sans-serif;
  --font-code:    'Maple Mono', 'Consolas', 'Cascadia Code', monospace;
}
```

- [ ] **Step 2: 更新 chat-core index.css**

将 `body` 的 `font-family: var(--font-body)` 改为 `var(--font-system)`：

Edit `packages/chat-core/src/index.css` line 13:
```css
  body {
    background-color: #0a0a0f;
    color: #e2e8f0;
    font-family: var(--font-system);
  }
```

- [ ] **Step 3: 更新 App.jsx 注释**

Edit `packages/chat-core/src/App.jsx` line 45:
```jsx
  useFont(); // Inject --font-system, --font-message, --font-body (alias), --font-nav, --font-code CSS variables
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/styles/fonts.css packages/chat-core/src/index.css packages/chat-core/src/App.jsx
git commit -m "feat: add --font-system/--font-message CSS variables, keep --font-body as compat alias"
```

---

### Task 3: tailwind.config.js 更新

**Files:**
- Modify: `packages/chat-core/tailwind.config.js`

- [ ] **Step 1: 更新 font-sans 映射**

Edit `packages/chat-core/tailwind.config.js` line 8, change `'var(--font-body)'` to `'var(--font-system)'`:

```javascript
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-system)'],
        mono: ['var(--font-code)'],
      },
      // ... rest unchanged
    },
  },
  plugins: [typography],
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/tailwind.config.js
git commit -m "refactor(chat-core): tailwind font-sans now uses --font-system instead of --font-body"
```

---

### Task 4: AppearancePanel 重做 — 双字体选择器

**Files:**
- Modify: `packages/chat-core/src/components/settings/AppearancePanel.jsx`

- [ ] **Step 1: 重写 AppearancePanel.jsx**

```jsx
import React from 'react';
import { useFont, AVAILABLE_FONTS } from 'exo-shared';

function FontSelector({ label, description, value, onChange }) {
  return (
    <div className="space-y-2.5">
      <div>
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-chat-text/70">
          {label}
        </span>
        {description && (
          <p className="text-[9px] text-chat-muted/40 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>

      <div className="space-y-1">
        {AVAILABLE_FONTS.map((font) => (
          <button
            key={font.value}
            onClick={() => onChange(font.value)}
            className={`w-full text-left px-3 py-2 rounded-md border transition-all ${
              value === font.value
                ? 'border-chat-accent/30 bg-chat-accent/5 text-chat-text'
                : 'border-transparent bg-white/[0.02] text-chat-muted hover:border-white/8 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                value === font.value ? 'border-chat-accent' : 'border-chat-muted/30'
              }`}>
                {value === font.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-chat-accent" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {font.label}
                  {font.value === 'sarasa' && (
                    <span className="ml-1.5 text-[9px] text-chat-muted font-normal">默认</span>
                  )}
                </p>
                <p
                  className="text-[10px] text-chat-muted/50 mt-0.5 truncate"
                  style={{ fontFamily: font.value === 'sarasa'
                    ? "'Sarasa Gothic Mono', monospace"
                    : font.value === 'wenkai'
                      ? "'LXGW WenKai', serif"
                      : "'Maple Mono', monospace"
                  }}
                >
                  {font.preview}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AppearancePanel() {
  const { systemFont, messageFont, setSystemFont, setMessageFont } = useFont();

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-xl px-8 py-8">
        <h2 className="text-sm font-semibold text-chat-text/90 tracking-tight mb-6">
          🎨 Appearance
        </h2>

        <div className="space-y-6">
          {/* System Font */}
          <FontSelector
            label="🖥️ System Font · 系统字体"
            description="应用于侧边栏、导航、设置、按钮、标签等所有非消息内容的 UI"
            value={systemFont}
            onChange={setSystemFont}
          />

          <div className="border-t border-white/5" />

          {/* Message Font */}
          <FontSelector
            label="💬 Message Font · 消息字体"
            description="仅应用于聊天消息气泡、群桥消息内容和消息输入框"
            value={messageFont}
            onChange={setMessageFont}
          />
        </div>

        {/* Preview cards */}
        <div className="mt-8 space-y-4">
          {/* System font preview */}
          <div className="p-4 rounded-lg border border-white/5 bg-chat-panel/50">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-chat-muted/40 mb-3">
              System Font Preview · 系统字体
            </p>
            <div style={{ fontFamily: 'var(--font-system)' }}>
              <p className="text-sm text-chat-text leading-relaxed mb-1">
                Settings · 设置面板 · Navigation · 导航
              </p>
              <p className="text-xs text-chat-muted">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </div>
          </div>

          {/* Message font preview */}
          <div className="p-4 rounded-lg border border-white/5 bg-chat-panel/50">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-chat-muted/40 mb-3">
              Message Font Preview · 消息字体
            </p>
            <div style={{ fontFamily: 'var(--font-message)' }}>
              <p className="text-sm text-chat-text leading-relaxed mb-1">
                こんにちは！今天想聊什么？春江潮水连海平。
              </p>
              <p className="text-xs text-chat-muted">
                Hello! How can I help you today? 0123456789
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/AppearancePanel.jsx
git commit -m "feat(chat-core): redesign AppearancePanel with separate system/message font selectors"
```

---

### Task 5: KeyPoolSection 紧凑重设计

**Files:**
- Modify: `packages/chat-core/src/components/settings/KeyPoolSection.jsx`

- [ ] **Step 1: 重写 KeyPoolSection 为紧凑行内布局**

整体替换文件内容。核心改动：
- 外层 `p-5` → `p-3`（20px → 12px）
- 列表项从 `grid grid-cols-[1fr_100px_140px_100px]` → `flex items-center justify-between`
- 日期从 `toLocaleDateString` → `MM/DD` 短格式
- 新增加表单折叠在列表顶部（而非独立卡片）

```jsx
import React, { useState, useRef } from 'react';
import { configApi } from 'exo-shared';
import { Save, Trash2, Plus, X, Edit3, Key } from 'lucide-react';
import Toast from './Toast';

export default function KeyPoolSection({ platform, keys, loading, onKeysChanged }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newMasked, setNewMasked] = useState('');
  const keyValueRef = useRef('');

  const [editing, setEditing] = useState(null);
  const [editAlias, setEditAlias] = useState('');
  const [editMode, setEditMode] = useState('alias');
  const [editKeyValue, setEditKeyValue] = useState('');
  const [editMasked, setEditMasked] = useState('');
  const editKeyRef = useRef('');

  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const clearFeedback = () => setFeedback(null);

  // ── Key input with masked display ── (same logic, unchanged)
  const handleMaskedKeyChange = (e, masked, keyRef, setKey, setMasked) => {
    const newDisplay = e.target.value;
    if (newDisplay === masked) return;
    let newKey;
    if (newDisplay.startsWith('...')) {
      const newSuffix = newDisplay.slice(3);
      if (newDisplay.length > masked.length) {
        const oldSuffix = keyRef.current.length >= 4 ? keyRef.current.slice(-4) : keyRef.current;
        if (newSuffix.startsWith(oldSuffix)) {
          newKey = keyRef.current + newSuffix.slice(oldSuffix.length);
        } else {
          const prefix = keyRef.current.length > 4 ? keyRef.current.slice(0, -4) : '';
          newKey = prefix + newSuffix;
        }
      } else {
        const charsRemoved = masked.length - newDisplay.length;
        newKey = keyRef.current.slice(0, -charsRemoved);
      }
    } else {
      newKey = newDisplay;
    }
    keyRef.current = newKey;
    setKey(newKey);
    if (newKey.length >= 4) { setMasked(`...${newKey.slice(-4)}`); }
    else if (newKey.length > 0) { setMasked(`...${newKey}`); }
    else { setMasked(''); }
  };

  const handlePaste = (e, keyRef, setKey, setMasked) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    if (!pasted) return;
    const cleaned = pasted.replace(/\s+/g, '');
    keyRef.current = cleaned;
    setKey(cleaned);
    if (cleaned.length >= 4) { setMasked(`...${cleaned.slice(-4)}`); }
    else if (cleaned.length > 0) { setMasked(`...${cleaned}`); }
    else { setMasked(''); }
  };

  // ── Add key ──
  const resetAddForm = () => {
    setShowAddForm(false);
    setNewAlias('');
    setNewKeyValue('');
    setNewMasked('');
    keyValueRef.current = '';
  };

  const handleAddKey = async () => {
    clearFeedback();
    if (!newAlias.trim() || !newKeyValue.trim()) return;
    setSaving(true);
    try {
      await configApi.createApiKey({ alias: newAlias.trim(), platform, key_value: newKeyValue.trim() });
      resetAddForm();
      setFeedback({ type: 'success', msg: 'Key 创建成功' });
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '创建失败' });
    } finally { setSaving(false); }
  };

  // ── Edit ──
  const startEdit = (key) => {
    setEditing(key.alias);
    setEditAlias(key.alias);
    setEditMode('alias');
    setEditKeyValue('');
    setEditMasked('');
    editKeyRef.current = '';
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditAlias('');
    setEditMode('alias');
    setEditKeyValue('');
    setEditMasked('');
    editKeyRef.current = '';
  };

  const handleEditSave = async () => {
    clearFeedback();
    if (!editAlias.trim()) return;
    setSaving(true);
    try {
      if (editMode === 'overwrite') {
        if (!editKeyValue.trim()) return;
        await configApi.overwriteApiKey(editing, editKeyValue.trim());
        setFeedback({ type: 'success', msg: 'Key 已更新' });
      } else if (editAlias.trim() !== editing) {
        await configApi.updateApiKeyAlias(editing, editAlias.trim());
        setFeedback({ type: 'success', msg: 'Alias 已更新' });
      } else { setSaving(false); cancelEdit(); return; }
      cancelEdit();
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
    } finally { setSaving(false); }
  };

  // ── Delete ──
  const handleDelete = async (alias) => {
    if (!window.confirm(`删除 key "${alias}"？这将级联删除所有同值 key。`)) return;
    clearFeedback();
    setSaving(true);
    try {
      await configApi.deleteApiKey(alias);
      setDeleting(null);
      setFeedback({ type: 'success', msg: '删除成功' });
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '删除失败' });
    } finally { setSaving(false); }
  };

  // ── Short date format ──
  const shortDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const canAdd = newAlias.trim() && newKeyValue.trim() && !saving;
  const canEditSave = editMode === 'alias'
    ? editAlias.trim() && !saving
    : editAlias.trim() && editKeyValue.trim() && !saving;

  if (loading && keys.length === 0) {
    return (
      <div className="bg-chat-panel border border-white/5 rounded-lg p-4 flex items-center justify-center">
        <span className="inline-block w-4 h-4 border-2 border-chat-muted/20 border-t-chat-muted/40 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-chat-panel border border-white/5 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={13} className="text-chat-muted/50" />
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-chat-text/70">
            Key Pool
          </span>
          <span className="text-[9px] font-mono text-chat-muted/40">· {keys.length} keys</span>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-chat-accent/60 hover:text-chat-accent border border-chat-accent/15 hover:border-chat-accent/30 rounded transition-all disabled:opacity-30"
          >
            <Plus size={11} /> Add
          </button>
        )}
      </div>

      {/* Add form — inline row */}
      {showAddForm && (
        <div className="flex items-center gap-2 p-2 bg-chat-bg border border-white/8 rounded">
          <input
            type="text"
            value={newAlias}
            onChange={e => { setNewAlias(e.target.value); clearFeedback(); }}
            placeholder="Alias"
            maxLength={50}
            disabled={saving}
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-chat-panel border border-white/8 rounded text-xs text-chat-text outline-none focus:border-chat-accent/30 transition-colors placeholder:text-chat-muted/30 font-mono"
          />
          <input
            type="text"
            value={newMasked}
            onChange={e => handleMaskedKeyChange(e, newMasked, keyValueRef, setNewKeyValue, setNewMasked)}
            onPaste={e => handlePaste(e, keyValueRef, setNewKeyValue, setNewMasked)}
            placeholder="Paste API Key..."
            autoComplete="off"
            disabled={saving}
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-chat-panel border border-white/8 rounded text-xs text-chat-text outline-none focus:border-chat-accent/30 transition-colors placeholder:text-chat-muted/30 font-mono"
          />
          <button
            onClick={handleAddKey}
            disabled={!canAdd}
            className="px-3 py-1.5 bg-chat-accent text-white text-[9px] font-bold uppercase tracking-[0.12em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-1 flex-shrink-0"
          >
            {saving ? (
              <span className="inline-block w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={11} />
            )}
            Create
          </button>
          <button
            onClick={resetAddForm}
            disabled={saving}
            className="p-1 text-chat-muted/40 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Key list — compact rows */}
      {keys.length === 0 ? (
        <div className="text-center py-4 text-[10px] text-chat-muted/40 font-mono">
          No keys configured for {platform}
        </div>
      ) : (
        <div className="space-y-0.5">
          {keys.map(k => (
            <div
              key={k.alias}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded border transition-colors ${
                editing === k.alias
                  ? 'bg-chat-bg border-chat-accent/20'
                  : 'bg-chat-bg border-transparent hover:border-white/5'
              }`}
            >
              {/* Alias */}
              {editing === k.alias ? (
                <input
                  type="text"
                  value={editAlias}
                  onChange={e => { setEditAlias(e.target.value); clearFeedback(); }}
                  maxLength={50}
                  disabled={saving}
                  className="w-32 px-2 py-0.5 bg-chat-panel border border-white/10 rounded text-xs text-chat-text outline-none focus:border-chat-accent/40 font-mono"
                />
              ) : (
                <span className="text-xs text-chat-text font-mono truncate min-w-0 flex-1">{k.alias}</span>
              )}

              {/* Meta: last four + date */}
              {editing === k.alias && editMode === 'overwrite' ? (
                <input
                  type="text"
                  value={editMasked}
                  onChange={e => handleMaskedKeyChange(e, editMasked, editKeyRef, setEditKeyValue, setEditMasked)}
                  onPaste={e => handlePaste(e, editKeyRef, setEditKeyValue, setEditMasked)}
                  placeholder="Paste new key..."
                  autoComplete="off"
                  disabled={saving}
                  className="w-40 px-2 py-0.5 bg-chat-panel border border-white/10 rounded text-xs text-chat-text outline-none focus:border-chat-accent/40 font-mono"
                />
              ) : (
                <div className="flex items-center gap-4 mr-2 flex-shrink-0">
                  <code className="text-[10px] text-chat-muted/50 font-mono tabular-nums">
                    {k.last_four ? `****${k.last_four}` : '—'}
                  </code>
                  <span className="text-[9px] text-chat-muted/30 font-mono tabular-nums w-10 text-right">
                    {shortDate(k.created_at)}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {editing === k.alias ? (
                  <>
                    <button
                      onClick={handleEditSave}
                      disabled={!canEditSave}
                      className="p-1 text-green-400/50 hover:text-green-400 disabled:opacity-20 transition-colors"
                    >
                      {saving ? (
                        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={12} strokeWidth={1.5} />
                      )}
                    </button>
                    <button onClick={cancelEdit} disabled={saving} className="p-1 text-chat-muted/30 hover:text-white transition-colors">
                      <X size={12} strokeWidth={1.5} />
                    </button>
                    {editMode === 'alias' && (
                      <button
                        onClick={() => setEditMode('overwrite')}
                        disabled={saving}
                        className="text-[8px] font-mono uppercase tracking-wider text-chat-accent/40 hover:text-chat-accent transition-colors px-1"
                      >
                        Key
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(k)} disabled={saving} className="p-1 text-chat-muted/30 hover:text-chat-accent/50 transition-colors">
                      <Edit3 size={11} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => deleting === k.alias ? handleDelete(k.alias) : setDeleting(k.alias)}
                      disabled={saving}
                      className={`p-1 transition-colors disabled:opacity-30 ${
                        deleting === k.alias ? 'text-red-400 hover:text-red-300' : 'text-chat-muted/30 hover:text-red-400'
                      }`}
                    >
                      <Trash2 size={11} strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/KeyPoolSection.jsx
git commit -m "refactor(chat-core): compact KeyPoolSection — inline row layout, tighter spacing"
```

---

### Task 6: RoleKeyMapSection 表格式紧凑重设计

**Files:**
- Modify: `packages/chat-core/src/components/settings/RoleKeyMapSection.jsx`

- [ ] **Step 1: 重写 RoleKeyMapSection 为表格式**

核心改动：
- 从 4 个大卡片（每个 role 一个 `.rounded-lg border p-3.5`）→ 单表格 4 行
- 表头: Role | Assigned Keys | Default
- Key 标签: 小 chip，选中的高亮

```jsx
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

const ROLE_DESCS = {
  system:     '系统默认 Key · 所有未指定 Key 的场景',
  session:    '会话默认 Key · 用户对话使用',
  sub_agent:  '子代理默认 Key · 压实/摘要/记忆整理等后台任务',
  background: '后台任务 Key · 定时自检/互动/深度整理',
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/RoleKeyMapSection.jsx
git commit -m "refactor(chat-core): compact RoleKeyMapSection — table layout replacing role cards"
```

---

### Task 7: KeyManagePanel 微调

**Files:**
- Modify: `packages/chat-core/src/components/settings/KeyManagePanel.jsx`

- [ ] **Step 1: 调整面板间距和分隔线**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { configApi, MODEL_REGISTRY } from 'exo-shared';
import { useApiKeys } from '../../hooks/useApiKeys';
import KeyPoolSection from './KeyPoolSection';
import RoleKeyMapSection from './RoleKeyMapSection';
import { RefreshCw } from 'lucide-react';

function getPlatforms() {
  const providers = [...new Set(MODEL_REGISTRY.map(m => m.provider))];
  return providers.length > 0 ? providers : ['gemini', 'deepseek'];
}

export default function KeyManagePanel() {
  const platforms = getPlatforms();
  const [activePlatform, setActivePlatform] = useState(platforms[0] || 'gemini');
  const { keys, loading, refresh } = useApiKeys(activePlatform);

  const [keyMap, setKeyMap] = useState({});
  const [keyMapLoading, setKeyMapLoading] = useState(true);

  const fetchKeyMap = useCallback(() => {
    setKeyMapLoading(true);
    configApi.getConfig()
      .then(config => setKeyMap(config.key_map || {}))
      .catch(() => {})
      .finally(() => setKeyMapLoading(false));
  }, []);

  useEffect(() => { fetchKeyMap(); }, [fetchKeyMap]);

  const handleDataChanged = useCallback(() => {
    refresh();
    fetchKeyMap();
  }, [refresh, fetchKeyMap]);

  const isLoading = loading && keyMapLoading && keys.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-chat-muted/40" />
      </div>
    );
  }

  const platformKeyMap = keyMap[activePlatform] || {};

  return (
    <div className="h-full flex flex-col">
      {/* Platform tabs */}
      <div className="flex gap-0 border-b border-white/5 px-5 pt-2">
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-all border-b-2 -mb-[1px] ${
              activePlatform === p
                ? 'text-chat-accent border-chat-accent bg-chat-accent/5'
                : 'text-chat-muted/40 border-transparent hover:text-chat-muted/60 hover:border-chat-muted/15'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Content — reduced spacing */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <KeyPoolSection
          platform={activePlatform}
          keys={keys}
          loading={loading}
          onKeysChanged={handleDataChanged}
        />

        <RoleKeyMapSection
          platform={activePlatform}
          keys={keys}
          keyMapForPlatform={platformKeyMap}
          onSaved={fetchKeyMap}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/KeyManagePanel.jsx
git commit -m "refactor(chat-core): tighten KeyManagePanel spacing, reduce px/py"
```

---

### Task 8: ModelAssignPanel 新建

**Files:**
- Create: `packages/chat-core/src/components/settings/ModelAssignPanel.jsx`

- [ ] **Step 1: 创建 ModelAssignPanel.jsx**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { configApi } from 'exo-shared';
import { Save, Cpu } from 'lucide-react';
import Toast from './Toast';

const MODEL_ROLES = [
  { key: 'sub_agent',  label: 'Sub-agent',   desc: '后台杂活 · 压实 · 摘要 · 记忆整理' },
  { key: 'vision',     label: 'Vision',       desc: '识图' },
  { key: 'image_gen',  label: 'Image Gen',    desc: '生图 (tool 类型)' },
  { key: 'web_search', label: 'Web Search',   desc: '联网搜索 (SearchAgent)' },
];

export default function ModelAssignPanel() {
  const [modelRoles, setModelRoles] = useState({});
  const [initialRoles, setInitialRoles] = useState({});
  const [modelRegistry, setModelRegistry] = useState([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearFeedback = () => setFeedback(null);

  // Fetch config + model registry
  useEffect(() => {
    setLoading(true);
    Promise.all([
      configApi.getConfig(),
      configApi.listModels().catch(() => []),
    ])
      .then(([config, models]) => {
        const roles = config.model_roles || {};
        setModelRoles(roles);
        setInitialRoles(roles);
        setModelRegistry(Array.isArray(models) ? models : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = (role, modelId) => {
    setModelRoles(prev => ({ ...prev, [role]: modelId }));
  };

  const isDirty = JSON.stringify(modelRoles) !== JSON.stringify(initialRoles);
  const canSave = isDirty && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    clearFeedback();
    setSaving(true);
    try {
      await configApi.updateConfig({ model_roles: modelRoles });
      setInitialRoles({ ...modelRoles });
      setFeedback({ type: 'success', msg: '模型分配保存成功' });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
    } finally { setSaving(false); }
  };

  // Filter models by role
  const modelsForRole = (roleKey) => {
    if (modelRegistry.length === 0) return [];
    return modelRegistry.filter(m => m.roles && m.roles.includes(roleKey));
  };

  // Provider color indicator
  const providerColor = (provider) => {
    const colors = {
      gemini: '#4285F4',
      deepseek: '#00CEC9',
      openai: '#10A37F',
    };
    return colors[provider] || '#888';
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
        <div className="flex items-center gap-3 mb-2">
          <Cpu size={16} className="text-chat-muted/50" />
          <h2 className="text-sm font-semibold text-chat-text/90 tracking-tight">
            🤖 Model Assign · 模型分配
          </h2>
        </div>
        <p className="text-[10px] text-chat-muted/40 font-mono mb-8 ml-9">
          Agent 主模型走 AgentPreset.default_model，不在此处配置
        </p>

        {/* Role rows */}
        <div className="space-y-1">
          {/* Header row */}
          <div className="flex items-center px-3 py-1.5 text-[9px] font-mono uppercase tracking-[0.1em] text-chat-muted/40 border-b border-white/[0.04]">
            <span className="w-[110px] flex-shrink-0">Role</span>
            <span className="w-[200px] flex-shrink-0">Description</span>
            <span className="flex-1">Model</span>
          </div>

          {MODEL_ROLES.map(({ key, label, desc }) => {
            const models = modelsForRole(key);
            const currentModelId = modelRoles[key] || '';
            const currentModel = modelRegistry.find(m => m.id === currentModelId);

            return (
              <div
                key={key}
                className="flex items-center px-3 py-2 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
              >
                <span className="w-[110px] flex-shrink-0 font-mono text-[10px] text-chat-text/70">
                  {label}
                </span>
                <span className="w-[200px] flex-shrink-0 text-[10px] text-chat-muted/50">
                  {desc}
                </span>
                <div className="flex-1 relative">
                  <select
                    value={currentModelId}
                    onChange={e => handleRoleChange(key, e.target.value)}
                    className="w-full max-w-[260px] appearance-none bg-chat-bg border border-white/10 rounded px-2.5 py-1.5 text-[10px] font-mono text-chat-text outline-none focus:border-chat-accent/30 transition-colors cursor-pointer"
                  >
                    <option value="">— 使用默认 —</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                  </select>
                  {/* Provider dot + current preview */}
                  {currentModel && (
                    <span
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
                      style={{ backgroundColor: providerColor(currentModel.provider) }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {modelRegistry.length === 0 && (
          <div className="text-center py-6 text-[10px] text-chat-muted/40 font-mono">
            Model registry 未加载，请检查后端 /api/core/models/
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-1.5 bg-chat-accent text-white text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-1.5"
          >
            {saving ? (
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save
          </button>
        </div>

        <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/ModelAssignPanel.jsx
git commit -m "feat(chat-core): add ModelAssignPanel — assign models to sub_agent/vision/image_gen/web_search roles"
```

---

### Task 9: RoutinePanel 新建

**Files:**
- Create: `packages/chat-core/src/components/settings/RoutinePanel.jsx`

- [ ] **Step 1: 创建 RoutinePanel.jsx**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { configApi, agentsApi } from 'exo-shared';
import { Save, Clock, Users, ChevronDown, ChevronRight } from 'lucide-react';
import Toast from './Toast';

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
    <div className="mt-2 p-3 bg-chat-bg border border-white/[0.06] rounded">
      {g045List.length > 0 && (
        <>
          <div className="text-[8px] font-mono uppercase tracking-[0.12em] text-chat-muted/40 mb-1.5">G045</div>
          {g045List.map(p => (
            <label
              key={p.id}
              className="flex items-center gap-2 py-1 px-1 cursor-pointer text-[10px] font-mono text-chat-text/70 hover:text-chat-text transition-colors"
            >
              <span
                className={`w-3 h-3 rounded-[2px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                  checkedIds.includes(p.id) ? 'bg-chat-accent border-chat-accent' : 'border-white/15'
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
          <div className="text-[8px] font-mono uppercase tracking-[0.12em] text-chat-muted/40 mt-2 mb-1.5">Superior</div>
          {superiorList.map(p => (
            <label
              key={p.id}
              className="flex items-center gap-2 py-1 px-1 cursor-pointer text-[10px] font-mono text-chat-text/70 hover:text-chat-text transition-colors"
            >
              <span
                className={`w-3 h-3 rounded-[2px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                  checkedIds.includes(p.id) ? 'bg-chat-accent border-chat-accent' : 'border-white/15'
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
        <p className="text-[9px] text-chat-muted/30 font-mono text-center py-2">No agents available</p>
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

  // Local agent selections
  const [selfDeepOrgIds, setSelfDeepOrgIds] = useState([]); // shared: self_check + deep_org
  const [heartbeatIds, setHeartbeatIds] = useState([]);

  // Expand/collapse
  const [expandedAgents, setExpandedAgents] = useState({ scdo: false, hb: false });

  // Fetch config + presets
  useEffect(() => {
    setLoading(true);
    Promise.all([
      configApi.getConfig(),
      agentsApi.listPresets().catch(() => []),
    ])
      .then(([cfg, allPresets]) => {
        setConfig(cfg);
        // self_check + deep_org share the same list; use self_check as source of truth
        setSelfDeepOrgIds(cfg.self_check_preset_ids || []);
        setHeartbeatIds(cfg.heartbeat_preset_ids || []);

        // Filter to g045 + superior only
        const relevant = (Array.isArray(allPresets) ? allPresets : [])
          .filter(p => p.agent_type === 'g045' || p.agent_type === 'superior');
        setPresets(relevant);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Toggle handlers ──
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

  // ── Save ──
  const handleSave = async () => {
    clearFeedback();
    setSaving(true);
    try {
      await configApi.updateConfig({
        self_check_preset_ids: selfDeepOrgIds,
        deep_org_preset_ids: selfDeepOrgIds,  // copy same list
        heartbeat_preset_ids: heartbeatIds,
      });
      setFeedback({ type: 'success', msg: '后台任务配置保存成功' });
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
    } finally { setSaving(false); }
  };

  // Schedule preview
  const schedulePreview = () => {
    const c = config;
    const day = WEEKDAY_NAMES[c.deep_org_weekday] || '?';
    const hour = c.deep_org_hour != null ? `${String(c.deep_org_hour).padStart(2, '0')}:00` : '?';
    return (
      <span>
        Active: <span style={{color:'#aaa'}}>{c.active_start || '?'} – {c.active_end || '?'}</span>
        {' · '}Heartbeat: <span style={{color:'#aaa'}}>{c.heartbeat_base_hours || '?'}–{c.heartbeat_base_hours + c.heartbeat_random_hours || '?'}h (day) / {c.night_heartbeat_base_hours || '?'}–{c.night_heartbeat_base_hours + c.heartbeat_random_hours || '?'}h (night)</span>
        {' · '}Deep Org: <span style={{color:'#aaa'}}>{day} {hour}</span>
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
        <h2 className="text-sm font-semibold text-chat-text/90 tracking-tight mb-6">
          ⚡ Routine · 后台任务
        </h2>

        {/* ── Group A: Self Check & Deep Organize ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-sm">🔍🧹</span>
              <div className="min-w-0">
                <span className="text-xs text-chat-text/80 font-medium">Self Check & Deep Organize</span>
                <span className="text-[9px] text-chat-muted/50 ml-2 hidden sm:inline">自检 + 深度整理 · 共用 Agent 列表</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <button
                className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-chat-muted/40 hover:text-chat-muted/70 border border-white/[0.06] rounded px-2 py-1 transition-colors"
              >
                <Clock size={10} /> 时间设置
              </button>
              <button
                onClick={() => toggleExpand('scdo')}
                className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider transition-colors border rounded px-2 py-1 ${
                  expandedAgents.scdo
                    ? 'text-chat-accent/70 border-chat-accent/15 bg-chat-accent/[0.04]'
                    : 'text-chat-muted/40 border-white/[0.06] hover:text-chat-muted/70'
                }`}
              >
                <Users size={10} /> Agent 管理
                {expandedAgents.scdo ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
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
                <span className="text-xs text-chat-text/80 font-medium">Heartbeat</span>
                <span className="text-[9px] text-chat-muted/50 ml-2 hidden sm:inline">主动互动 · 活跃窗口内定时发起对话</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <button
                className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-chat-muted/40 hover:text-chat-muted/70 border border-white/[0.06] rounded px-2 py-1 transition-colors"
              >
                <Clock size={10} /> 时间设置
              </button>
              <button
                onClick={() => toggleExpand('hb')}
                className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider transition-colors border rounded px-2 py-1 ${
                  expandedAgents.hb
                    ? 'text-chat-accent/70 border-chat-accent/15 bg-chat-accent/[0.04]'
                    : 'text-chat-muted/40 border-white/[0.06] hover:text-chat-muted/70'
                }`}
              >
                <Users size={10} /> Agent 管理
                {expandedAgents.hb ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
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
        <div className="p-3 bg-chat-bg border border-white/[0.06] rounded mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">⏱️</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-chat-muted/50">Schedule Preview</span>
            <span className="text-[8px] font-mono text-chat-muted/30 ml-1">(时间设置接口待上线)</span>
          </div>
          <p className="text-[10px] font-mono text-chat-muted/60 leading-relaxed">{schedulePreview()}</p>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-chat-accent text-white text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-1.5"
          >
            {saving ? (
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save
          </button>
        </div>

        <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/settings/RoutinePanel.jsx
git commit -m "feat(chat-core): add RoutinePanel — background task agent management (self_check/deep_org/heartbeat)"
```

---

### Task 10: SettingsView + App.jsx 路由更新

**Files:**
- Modify: `packages/chat-core/src/views/SettingsView.jsx`
- Modify: `packages/chat-core/src/App.jsx`

- [ ] **Step 1: 更新 SettingsView 导航菜单**

Edit `packages/chat-core/src/views/SettingsView.jsx`:

```jsx
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Key, Clock, Bell, Palette, Database, Cpu, ArrowLeft } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';

const NAV_ITEMS = [
  {
    id: 'keys',
    label: 'Key Manage',
    icon: Key,
    route: '/settings/keys',
    enabled: true,
  },
  {
    id: 'models',
    label: 'Model Assign',
    icon: Cpu,
    route: '/settings/models',
    enabled: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    route: '/settings/notifications',
    enabled: true,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    route: '/settings/appearance',
    enabled: true,
  },
  {
    id: 'routine',
    label: 'Routine',
    icon: Clock,
    route: '/settings/routine',
    enabled: true,  // ← was false, now enabled
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Database,
    route: '/settings/memory',
    enabled: true,
  },
];

export default function SettingsView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navVisible, setNavVisible] = useState(true);

  const isActive = (route) => location.pathname === route;

  const handleNavClick = (route, enabled) => {
    if (!enabled) return;
    navigate(route);
    setNavVisible(false);
  };

  return (
    <div className="flex-1 h-full flex overflow-hidden">
      <nav className={`w-52 flex-shrink-0 border-r border-white/5 bg-chat-panel/50 py-6 flex flex-col md:flex ${navVisible ? 'flex' : 'hidden'}`}>
        <div className="px-4 mb-4">
          <h1 className="text-sm font-semibold text-chat-text/90 tracking-tight">Settings</h1>
        </div>

        <div className="flex-1 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon, route, enabled }) => (
            <button
              key={id}
              onClick={() => handleNavClick(route, enabled)}
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

      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {!navVisible && (
          <div className="md:hidden flex-shrink-0 h-10 bg-chat-panel border-b border-white/5 flex items-center px-3">
            <button
              onClick={() => setNavVisible(true)}
              className="p-1 text-chat-muted hover:text-chat-accent active:scale-90 transition-all flex items-center gap-2"
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span className="text-xs font-medium text-chat-text">Settings Menu</span>
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 App.jsx 路由**

Edit `packages/chat-core/src/App.jsx`:

新增 imports:
```jsx
import ModelAssignPanel from './components/settings/ModelAssignPanel';
import RoutinePanel from './components/settings/RoutinePanel';
```

新增 route wrappers:
```jsx
function ModelAssignRoute() {
  return <ModelAssignPanel />;
}

function RoutineRoute() {
  return <RoutinePanel />;
}
```

移除 `RoutinePlaceholderRoute`（不再需要）。

在 `<Route path="settings" element={<SettingsRoute />}>` 内：
- 在 `keys` 之后新增 `<Route path="models" element={<ModelAssignRoute />} />`
- 将 `routine` 路由从 `<RoutinePlaceholderRoute />` 改为 `<RoutineRoute />`

完整 settings 路由块:
```jsx
<Route path="settings" element={<SettingsRoute />}>
  <Route index element={<Navigate to="keys" replace />} />
  <Route path="keys" element={<KeyManageRoute />} />
  <Route path="models" element={<ModelAssignRoute />} />
  <Route path="notifications" element={<NotificationsRoute />} />
  <Route path="appearance" element={<AppearancePanel />} />
  <Route path="routine" element={<RoutineRoute />} />
  <Route path="memory" element={<MemoryConsole />} />
</Route>
```

- [ ] **Step 3: Commit**

```bash
git add packages/chat-core/src/views/SettingsView.jsx packages/chat-core/src/App.jsx
git commit -m "feat(chat-core): add Model Assign + enable Routine in settings nav and routes"
```

---

### Task 11: 全站 CSS 字体变量适配

**Files:**
- Modify: `packages/chat-core/src/components/chat/MessageBubble.jsx`
- Modify: `packages/chat-core/src/components/chat/ChatArea.jsx`
- Modify: `packages/chat-core/src/components/groupchat/GroupchatMessage.jsx`
- Modify: `packages/chat-core/src/views/GroupchatRoom.jsx`

- [ ] **Step 1: MessageBubble — 消息气泡内容 → --font-message**

在 `packages/chat-core/src/components/chat/MessageBubble.jsx` 中，给用户气泡 (line 351) 和 Agent 气泡 (line 355) 各加 `style={{ fontFamily: 'var(--font-message)' }}`：

Two edits in MessageBubble.jsx:

Edit 1 (user bubble, ~line 351):
```jsx
<div className="max-w-[92%] bg-exo-pure border border-exo-mist-12 rounded-[4px] rounded-tr-none p-4 text-sm shadow-brutalist transition-all hover:border-exo-mist-20 prose prose-invert prose-sm prose-pre:!bg-transparent prose-pre:!p-0 text-white/90" style={{ fontFamily: 'var(--font-message)' }}>
```

Edit 2 (agent bubble, ~line 355):
```jsx
<div className="w-full prose prose-invert prose-sm max-w-none prose-pre:!bg-transparent prose-pre:!p-0" style={{ fontFamily: 'var(--font-message)' }}>
```

- [ ] **Step 2: ChatArea — 输入框 → --font-message**

Edit `packages/chat-core/src/components/chat/ChatArea.jsx` textarea (~line 1160)，添加 `style`:

```jsx
<textarea
  ref={textareaRef}
  value={inputValue}
  // ... all existing props unchanged ...
  className="w-full bg-transparent text-sm text-white/90 outline-none resize-none px-4 pt-2.5 pb-1 disabled:opacity-50 overflow-y-auto max-h-[40vh] font-sans font-normal placeholder:text-exo-muted/40"
  style={{ minHeight: (inputFocused || inputValue) ? '4.5rem' : '2.5rem', fontFamily: 'var(--font-message)' }}
  disabled={isGenerating}
/>
```

- [ ] **Step 3: GroupchatMessage — 群桥消息内容 → --font-message**

Edit `packages/chat-core/src/components/groupchat/GroupchatMessage.jsx`:

Edit 1 (user bubble, ~line 103):
```jsx
<div className="max-w-[92%] bg-exo-pure border border-exo-mist-12 rounded-[4px] rounded-tr-none p-4 text-sm shadow-brutalist transition-all hover:border-exo-mist-20 prose prose-invert prose-sm prose-pre:!bg-transparent prose-pre:!p-0 text-white/90" style={{ fontFamily: 'var(--font-message)' }}>
```

Edit 2 (agent prose, ~line 113):
```jsx
<div className="w-full prose prose-invert prose-sm max-w-none prose-pre:!bg-transparent prose-pre:!p-0" style={{ fontFamily: 'var(--font-message)' }}>
```

- [ ] **Step 4: GroupchatRoom — 群桥输入框 → --font-message**

Edit `packages/chat-core/src/views/GroupchatRoom.jsx` textarea (~line 515):
```jsx
<textarea
  ref={textareaRef}
  value={inputValue}
  onChange={handleInputChange}
  onClick={handleInputClick}
  onKeyUp={handleInputKeyUp}
  onKeyDown={handleKeyDown}
  placeholder="Message...  (@ to mention)"
  rows={1}
  disabled={isSending}
  className="w-full bg-exo-pure border border-exo-mist-10 rounded-[4px] px-4 py-2.5 text-sm text-white/90 outline-none resize-none focus:border-exo-accent/40 transition-colors font-sans placeholder:text-exo-muted/40 disabled:opacity-50 max-h-[40vh]"
  style={{ minHeight: '2.75rem', fontFamily: 'var(--font-message)' }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add packages/chat-core/src/components/chat/MessageBubble.jsx packages/chat-core/src/components/chat/ChatArea.jsx packages/chat-core/src/components/groupchat/GroupchatMessage.jsx packages/chat-core/src/views/GroupchatRoom.jsx
git commit -m "feat(chat-core): apply --font-message to message bubbles, groupchat, and input areas"
```

---

## Validation

Run the dev server and manually verify:
```bash
pnpm dev:chat
```

1. Open Settings → Appearance → 分别改系统字体和消息字体，确认消息气泡和 UI 独立变化
2. Settings → Key Manage → 检查紧凑布局，新增/编辑/删除 key，保存 Key Map
3. Settings → Model Assign → 修改各角色模型，保存后刷新确认持久化
4. Settings → Routine → 展开 Agent 管理，勾选/取消 agent，确认排序（g045 → superior，选中排前），保存
5. 移动端折叠导航 → 各菜单正常切换
6. Console 无报错
