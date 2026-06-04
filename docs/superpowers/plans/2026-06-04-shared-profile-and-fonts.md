# Shared Profile & Font Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify user profile (avatar, nickname, agent avatar) and font preferences across three SPAs via exo-shared hooks + CSS variable injection.

**Architecture:** Two new React hooks in exo-shared (`useProfile`, `useFont`) serve as the single source of truth for all three modules. `useProfile` reads/writes localStorage for identity data; `useFont` injects CSS custom properties (`--font-body`, `--font-nav`, `--font-code`) at `:root`. chat-core Settings gains an Appearance panel for font selection. chronicle/council consume the hooks for header display and font variables.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, @fontsource packages, localStorage

---

## Task 0: Install Font Dependencies

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Install fontsource packages**

```bash
pnpm add @fontsource/lxgw-wenkai
```

`@fontsource/maple-mono` is already installed. For Sarasa Gothic Mono (no fontsource package), download WOFF2 files from GitHub Releases.

- [ ] **Step 2: Download Sarasa Gothic Mono WOFF2 subset**

```bash
mkdir -p packages/shared/src/assets/fonts
cd packages/shared/src/assets/fonts
# Download regular weight (subset — Latin + CJK common)
curl -L -o sarasa-gothic-mono-regular.woff2 \
  "https://github.com/be5invis/Sarasa-Gothic/releases/download/v1.0.30/sarasa-gothic-mono-regular.woff2"
# Also grab bold weight for headings
curl -L -o sarasa-gothic-mono-bold.woff2 \
  "https://github.com/be5invis/Sarasa-Gothic/releases/download/v1.0.30/sarasa-gothic-mono-bold.woff2"
```

Note: If the GitHub release URLs differ, check https://github.com/be5invis/Sarasa-Gothic/releases for the latest version and correct file paths. The full font is ~15MB but Vite tree-shakes unused glyphs in production builds.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml packages/shared/src/assets/
git commit -m "chore: add font dependencies (lxgw-wenkai, sarasa gothic mono assets)"
```

---

## Task 1: Create shared fonts.css

**Files:**
- Create: `packages/shared/src/styles/fonts.css`

- [ ] **Step 1: Write fonts.css with @font-face declarations**

```css
/* ── LXGW WenKai (霞鹜文楷) — nav/UI font, from fontsource ── */
@import '@fontsource/lxgw-wenkai/400.css';
@import '@fontsource/lxgw-wenkai/700.css';

/* ── Maple Mono — code blocks, from fontsource ── */
@import '@fontsource/maple-mono/400.css';
@import '@fontsource/maple-mono/500.css';
@import '@fontsource/maple-mono/700.css';

/* ── Sarasa Gothic Mono — body/default, self-hosted WOFF2 ── */
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/styles/fonts.css
git commit -m "feat: add fonts.css with @font-face declarations for Sarasa/WenKai/Maple"
```

---

## Task 2: Create profile.js localStorage helpers

**Files:**
- Create: `packages/shared/src/profile.js`

- [ ] **Step 1: Write profile.js**

```js
// ── User avatar ─────────────────────────────────────────────────────────
const USER_AVATAR_KEY = 'exo_user_avatar';
const USER_AVATAR_SEED_KEY = 'exo_user_avatar_seed';
const DEFAULT_SEED = 'Elysia';

export function getUserAvatar() {
  return (
    localStorage.getItem(USER_AVATAR_KEY) ||
    `https://api.dicebear.com/7.x/notionists/svg?seed=${getAvatarSeed()}`
  );
}

export function setUserAvatar(dataUrl) {
  localStorage.setItem(USER_AVATAR_KEY, dataUrl);
  window.dispatchEvent(new StorageEvent('storage', {
    key: USER_AVATAR_KEY, newValue: dataUrl,
  }));
}

export function getAvatarSeed() {
  return localStorage.getItem(USER_AVATAR_SEED_KEY) || DEFAULT_SEED;
}

export function setAvatarSeed(seed) {
  localStorage.setItem(USER_AVATAR_SEED_KEY, seed);
}

// ── User nickname ───────────────────────────────────────────────────────
const USER_NICK_KEY = 'exo_user_nick';
const DEFAULT_NICK = 'Elysia';

export function getUserNick() {
  return localStorage.getItem(USER_NICK_KEY) || DEFAULT_NICK;
}

export function setUserNick(nick) {
  localStorage.setItem(USER_NICK_KEY, nick);
  window.dispatchEvent(new StorageEvent('storage', {
    key: USER_NICK_KEY, newValue: nick,
  }));
}

// ── Agent avatar ────────────────────────────────────────────────────────
const AGENT_AVATAR_PREFIX = 'exo_agent_avatar_';

export function getAgentAvatar(presetId, agentName) {
  const key = `${AGENT_AVATAR_PREFIX}${presetId}`;
  return (
    localStorage.getItem(key) ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(agentName || presetId)}`
  );
}

export function setAgentAvatar(presetId, dataUrl) {
  const key = `${AGENT_AVATAR_PREFIX}${presetId}`;
  localStorage.setItem(key, dataUrl);
  window.dispatchEvent(new StorageEvent('storage', {
    key, newValue: dataUrl,
  }));
}

// ── Bulk read — for initializing useProfile hook ────────────────────────
export function getAllAgentAvatars() {
  const avatars = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(AGENT_AVATAR_PREFIX)) {
      const presetId = key.slice(AGENT_AVATAR_PREFIX.length);
      avatars[presetId] = localStorage.getItem(key);
    }
  }
  return avatars;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/profile.js
git commit -m "feat: add profile.js — localStorage read/write helpers for avatar, nick, agent avatars"
```

---

## Task 3: Create avatar utility in shared

**Files:**
- Create: `packages/shared/src/utils/avatar.js`
- Modify: `packages/chat-core/src/utils/avatar.js`

The `useProfile` hook (Task 4) depends on `resizeAndStoreAvatar`. This function currently lives in `packages/chat-core/src/utils/avatar.js`. Move the core logic to shared.

- [ ] **Step 1: Create shared utils/ directory and write avatar.js**

```bash
mkdir -p packages/shared/src/utils
```

Write `packages/shared/src/utils/avatar.js`:

```js
/**
 * Resize an image file to max 200x200, store as dataURL in localStorage,
 * and invoke the callback with the dataURL.
 */
export function resizeAndStoreAvatar(file, storageKey, onDone) {
  const img = new Image();
  const blobUrl = URL.createObjectURL(file);
  img.onload = () => {
    const MAX = 200;
    const scale = Math.min(MAX / img.width, MAX / img.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    localStorage.setItem(storageKey, dataUrl);
    onDone(dataUrl);
  };
  img.onerror = () => {
    URL.revokeObjectURL(blobUrl);
  };
  img.src = blobUrl;
}
```

- [ ] **Step 2: Update chat-core avatar.js to re-export from shared**

Edit `packages/chat-core/src/utils/avatar.js`:

```js
// Re-export from shared — legacy import paths keep working
export { resizeAndStoreAvatar } from 'exo-shared/utils/avatar';

// These helpers remain chat-core specific (they consume the shared profile module)
import { getUserAvatar, getAgentAvatar } from 'exo-shared/profile';
export { getUserAvatar, getAgentAvatar };
export const getUserAvatarUrl = getUserAvatar;
export const getAgentAvatarUrl = getAgentAvatar;
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/utils/ packages/chat-core/src/utils/avatar.js
git commit -m "feat: move avatar resize utility to exo-shared, re-export from chat-core"
```

---

## Task 4: Create useProfile.js hook

**Files:**
- Create: `packages/shared/src/hooks/useProfile.js`

- [ ] **Step 1: Write useProfile.js**

```js
import { useState, useEffect, useCallback } from 'react';
import {
  getUserAvatar, setUserAvatar,
  getUserNick, setUserNick,
  getAgentAvatar, setAgentAvatar,
  getAllAgentAvatars,
} from '../profile';
import { resizeAndStoreAvatar } from '../utils/avatar';

export function useProfile() {
  const [userAvatar, setUserAvatarState] = useState(getUserAvatar);
  const [userNick, setUserNickState] = useState(getUserNick);
  const [agentAvatars, setAgentAvatars] = useState(getAllAgentAvatars);

  // Listen for cross-tab storage changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'exo_user_avatar') {
        setUserAvatarState(getUserAvatar());
      } else if (e.key === 'exo_user_nick') {
        setUserNickState(getUserNick());
      } else if (e.key && e.key.startsWith('exo_agent_avatar_')) {
        setAgentAvatars(getAllAgentAvatars());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Update user avatar from a File object — resize to 200x200, store as dataURL
  const updateAvatar = useCallback((file) => {
    resizeAndStoreAvatar(file, 'exo_user_avatar', (dataUrl) => {
      setUserAvatar(dataUrl);
      setUserAvatarState(dataUrl);
    });
  }, []);

  // Update nickname
  const updateNick = useCallback((nick) => {
    setUserNick(nick);
    setUserNickState(nick);
  }, []);

  // Update agent avatar
  const updateAgentAvatar = useCallback((presetId, file) => {
    const key = `exo_agent_avatar_${presetId}`;
    resizeAndStoreAvatar(file, key, (dataUrl) => {
      setAgentAvatar(presetId, dataUrl);
      setAgentAvatars(prev => ({ ...prev, [presetId]: dataUrl }));
    });
  }, []);

  // Refresh all state from localStorage (for external mutations)
  const refresh = useCallback(() => {
    setUserAvatarState(getUserAvatar());
    setUserNickState(getUserNick());
    setAgentAvatars(getAllAgentAvatars());
  }, []);

  return {
    userAvatar,
    userNick,
    agentAvatars,
    updateAvatar,
    updateNick,
    updateAgentAvatar,
    refresh,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/hooks/useProfile.js
git commit -m "feat: add useProfile hook — unified user/agent identity from localStorage"
```


## Task 5: Create useFont.js hook

**Files:**
- Create: `packages/shared/src/hooks/useFont.js`

- [ ] **Step 1: Write useFont.js**

```js
import { useState, useEffect, useCallback } from 'react';

const FONT_KEY = 'exo_font_preference';
const DEFAULT_FONT = 'sarasa';

// Font stack definitions — used for --font-body CSS variable
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

function applyFontVariables(fontPref) {
  const root = document.documentElement;
  const bodyStack = FONT_STACKS[fontPref] || FONT_STACKS[DEFAULT_FONT];
  root.style.setProperty('--font-body', bodyStack);
  root.style.setProperty('--font-nav', FONT_NAV);
  root.style.setProperty('--font-code', FONT_CODE);
}

function getStoredFont() {
  return localStorage.getItem(FONT_KEY) || DEFAULT_FONT;
}

export function useFont() {
  const [fontPreference, setFontPreference] = useState(getStoredFont);

  // Apply CSS variables on mount and on change
  useEffect(() => {
    applyFontVariables(fontPreference);
  }, [fontPreference]);

  // Listen for cross-tab changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === FONT_KEY) {
        const newFont = getStoredFont();
        setFontPreference(newFont);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setFont = useCallback((font) => {
    localStorage.setItem(FONT_KEY, font);
    setFontPreference(font);
    // storage event doesn't fire in same tab — apply directly
    applyFontVariables(font);
  }, []);

  return {
    fontPreference,
    setFont,
    availableFonts: AVAILABLE_FONTS,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/hooks/useFont.js
git commit -m "feat: add useFont hook — font preference storage + CSS variable injection"
```

---

## Task 6: Update exo-shared index.js exports

**Files:**
- Modify: `packages/shared/src/index.js`

- [ ] **Step 1: Add new exports**

Read the current file then add these exports below the existing endpoint exports:

```js
// Profile — unified user identity (avatar, nickname, agent avatars)
export { getUserAvatar, setUserAvatar, getUserNick, setUserNick, getAgentAvatar, setAgentAvatar, getAllAgentAvatars } from './profile';

// Hooks — useProfile and useFont
export { useProfile } from './hooks/useProfile';
export { useFont } from './hooks/useFont';

// Avatar utility
export { resizeAndStoreAvatar } from './utils/avatar';
```

The final `index.js` should look like:

```js
// API core
export { baseUrl, getCsrfToken, apiFetch, MODEL_REGISTRY, AVAILABLE_MODELS, MAIN_MODEL_IDS, getConvProjectId } from './api';

// Auth
export { fetchCurrentUser, isAuthenticated } from './auth';

// Models
export { getModelInfo } from './models';

// Hooks
export { useApi } from './hooks/useApi';
export { useCsrf } from './hooks/useCsrf';

// Endpoints (namespaced re-exports to avoid collisions)
export * as agentsApi        from './endpoints/agents';
export * as conversationsApi from './endpoints/conversations';
export * as chronicleApi     from './endpoints/chronicle';
export * as projectsApi      from './endpoints/projects';
export * as tweetsApi        from './endpoints/tweets';
export * as configApi        from './endpoints/config';
export * as memoryApi        from './endpoints/memory';
export * as tasksApi         from './endpoints/tasks';
export * as telemetryApi     from './endpoints/telemetry';
export * as systemApi        from './endpoints/system';
export * as pushApi          from './endpoints/push';

// Profile — unified user identity (avatar, nickname, agent avatars)
export { getUserAvatar, setUserAvatar, getUserNick, setUserNick, getAgentAvatar, setAgentAvatar, getAllAgentAvatars } from './profile';

// Hooks — useProfile and useFont
export { useProfile } from './hooks/useProfile';
export { useFont } from './hooks/useFont';

// Avatar utility
export { resizeAndStoreAvatar } from './utils/avatar';
```

- [ ] **Step 2: Add shared package.json exports for new paths**

Edit `packages/shared/package.json`, add to the `exports` map:

```json
"./profile": "./src/profile.js",
"./hooks/useProfile": "./src/hooks/useProfile.js",
"./hooks/useFont": "./src/hooks/useFont.js",
"./utils/avatar": "./src/utils/avatar.js",
"./styles/fonts.css": "./src/styles/fonts.css"
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.js packages/shared/package.json
git commit -m "feat: export useProfile, useFont, profile helpers from exo-shared"
```

---

## Task 7: Create AppearancePanel.jsx (font selector UI)

**Files:**
- Create: `packages/chat-core/src/components/settings/AppearancePanel.jsx`

- [ ] **Step 1: Write AppearancePanel.jsx**

```jsx
import React from 'react';
import { useFont, AVAILABLE_FONTS } from 'exo-shared';

export default function AppearancePanel() {
  const { fontPreference, setFont } = useFont();

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-xl px-8 py-8">
        {/* Section header */}
        <h2 className="text-sm font-semibold text-chat-text/90 tracking-tight mb-6">
          🎨 Appearance
        </h2>

        {/* Font selector */}
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-chat-muted uppercase tracking-wider">
              Interface Font · 界面字体
            </span>
          </label>

          <div className="space-y-2">
            {AVAILABLE_FONTS.map((font) => (
              <button
                key={font.value}
                onClick={() => setFont(font.value)}
                className={`w-full text-left px-4 py-3 rounded-md border transition-all ${
                  fontPreference === font.value
                    ? 'border-chat-accent bg-chat-accent/10 text-chat-text'
                    : 'border-white/5 bg-white/[0.02] text-chat-muted hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Radio indicator */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    fontPreference === font.value
                      ? 'border-chat-accent'
                      : 'border-chat-muted/30'
                  }`}>
                    {fontPreference === font.value && (
                      <div className="w-2 h-2 rounded-full bg-chat-accent" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {font.label}
                      {font.value === 'sarasa' && (
                        <span className="ml-2 text-[10px] text-chat-muted font-normal">默认</span>
                      )}
                    </p>
                    <p
                      className="text-[11px] text-chat-muted/70 mt-0.5 truncate"
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

        {/* Preview card */}
        <div className="mt-8 p-5 rounded-lg border border-white/5 bg-chat-panel/50">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-chat-muted mb-3">
            Preview · 字体预览
          </p>
          <div style={{ fontFamily: 'var(--font-body)' }}>
            <p className="text-base text-chat-text leading-relaxed mb-2">
              春江潮水连海平，海上明月共潮生。
            </p>
            <p className="text-sm text-chat-muted leading-relaxed mb-3">
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-nav)' }} className="mb-2">
            <p className="text-xs text-chat-muted">
              — Navigation text (霞鹜文楷) · 导航文字
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-code)' }}>
            <p className="text-xs text-chat-muted">
              <code>const code = "Maple Mono" · 代码块文字</code>
            </p>
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
git commit -m "feat: add AppearancePanel — font selector in chat-core settings"
```

---

## Task 8: Update chat-core SettingsView.jsx (add Appearance nav + route)

**Files:**
- Modify: `packages/chat-core/src/views/SettingsView.jsx`
- Modify: `packages/chat-core/src/App.jsx` (add route import)

- [ ] **Step 1: Add Appearance to SettingsView NAV_ITEMS**

Edit `packages/chat-core/src/views/SettingsView.jsx`, change the imports and NAV_ITEMS:

```jsx
import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Key, Clock, Bell, Palette } from 'lucide-react';

const NAV_ITEMS = [
  {
    id: 'keys',
    label: 'Key Manage',
    icon: Key,
    route: '/settings/keys',
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
    label: 'Routine Manage',
    icon: Clock,
    route: '/settings/routine',
    enabled: false,
  },
];
```

(The rest of the component stays the same — it renders `<Outlet />`.)

- [ ] **Step 2: Add Appearance route in App.jsx**

Edit `packages/chat-core/src/App.jsx`:
- Add import at top:
  ```jsx
  import AppearancePanel from './components/settings/AppearancePanel';
  ```
- Inside the settings sub-route, add a new route before the closing `</Route>`:

Find the settings route block (it uses path `/settings` with `SettingsView` as element, containing child routes). Add:

```jsx
<Route path="appearance" element={<AppearancePanel />} />
```

It goes alongside the existing `keys` and `notifications` child routes under the settings parent route.

- [ ] **Step 3: Commit**

```bash
git add packages/chat-core/src/views/SettingsView.jsx packages/chat-core/src/App.jsx
git commit -m "feat: add Appearance nav item and route in Settings"
```

---

## Task 9: Wire useFont() in chat-core App.jsx

**Files:**
- Modify: `packages/chat-core/src/App.jsx`

- [ ] **Step 1: Add useFont() call in AppLayout**

In `AppLayout`, add `useFont()` so CSS variables are injected when chat-core loads:

```jsx
import { useFont } from 'exo-shared';

function AppLayout() {
  useFont(); // Inject --font-body, --font-nav, --font-code CSS variables

  return (
    <div className="w-full h-screen bg-chat-bg text-chat-text font-sans flex overflow-hidden">
      {/* ... rest unchanged ... */}
    </div>
  );
}
```

Note: The `font-sans` Tailwind class will need to use the CSS variable. See Task 11 (tailwind config).

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/App.jsx
git commit -m "feat: wire useFont() in chat-core AppLayout"
```

---

## Task 10: Update chat-core CSS for font variables

**Files:**
- Modify: `packages/chat-core/src/index.css`
- Modify: `packages/chat-core/tailwind.config.js`

- [ ] **Step 1: Import shared fonts.css in index.css**

Add at the top of `packages/chat-core/src/index.css`:

```css
@import 'exo-shared/styles/fonts.css';
@import 'exo-shared/styles/base.css';
@import 'exo-shared/styles/transitions.css';
```

- [ ] **Step 2: Replace body font-family with CSS variable**

Change the body rule in `@layer base`:

```css
@layer base {
  body {
    background-color: #0a0a0f;
    color: #e2e8f0;
    font-family: var(--font-body);
  }
  /* ... rest unchanged ... */
}
```

- [ ] **Step 3: Add nav and code font rules**

Add inside `@layer base { ... }`:

```css
  /* Navigation / UI elements use WenKai */
  nav, .nav, .sidebar, [class*="nav"], button, .label-caps {
    font-family: var(--font-nav);
  }

  /* Code blocks use Maple Mono */
  pre, code, .code-block, .font-mono, [class*="font-mono"] {
    font-family: var(--font-code);
  }
```

- [ ] **Step 4: Update tailwind.config.js fontFamily**

```js
fontFamily: {
  sans: ['var(--font-body)'],
  mono: ['var(--font-code)'],
},
```

This ensures Tailwind's `font-sans` and `font-mono` utilities resolve to the CSS variables.

- [ ] **Step 5: Commit**

```bash
git add packages/chat-core/src/index.css packages/chat-core/tailwind.config.js
git commit -m "feat: chat-core uses CSS font variables (--font-body, --font-nav, --font-code)"
```

---

## Task 11: Update chat-core UserProfile to use shared useProfile()

**Files:**
- Modify: `packages/chat-core/src/views/UserProfile.jsx`

- [ ] **Step 1: Replace direct localStorage calls with useProfile hook**

At the top of the component, find where `userAvatarUrl` and `userNick` are managed (currently via direct `localStorage.getItem` and the `getUserAvatarUrl` utility). Replace with:

```jsx
import { useProfile } from 'exo-shared';

// Inside the component, replace the manual state management:
const { userAvatar, userNick, updateAvatar, updateNick } = useProfile();
```

Specific changes:
- `userAvatarUrl` state → use `userAvatar` from hook
- `userNick` state → use `userNick` from hook
- Avatar upload handler (`handleAvatarChange`) → call `updateAvatar(file)` instead of directly calling `resizeAndStoreAvatar` + `setUserAvatarUrl`
- Nick save handler (`saveNick`) → call `updateNick(nickDraft)` instead of directly `localStorage.setItem`

The `getUserAvatarUrl` import from `../utils/avatar` can be removed (it now re-exports from shared anyway).

- [ ] **Step 2: Check DiceBear seed handling**

The current flow uses `exo_user_avatar_seed` for DiceBear fallback. This is internal to the shared `profile.js` `getUserAvatar()` function. If UserProfile needs to update the seed (e.g., when regenerating DiceBear avatar without uploading), keep a local call to `setAvatarSeed` from profile.js for that edge case. Otherwise remove it.

- [ ] **Step 3: Commit**

```bash
git add packages/chat-core/src/views/UserProfile.jsx
git commit -m "refactor: UserProfile uses shared useProfile() hook"
```

---

## Task 12: Update chat-core AgentProfile to use shared useProfile()

**Files:**
- Modify: `packages/chat-core/src/views/AgentProfile.jsx`

- [ ] **Step 1: Replace agent avatar management with useProfile hook**

```jsx
import { useProfile } from 'exo-shared';

// Inside the component:
const { agentAvatars, updateAgentAvatar } = useProfile();
const avatarUrl = agentAvatars[viewParams.agentId] || getAgentAvatarUrl(viewParams.agentId, preset?.name || '');
```

The `getAgentAvatarUrl` import still works (it re-exports from shared now). The hook manages per-agent avatar state and cross-tab sync.

- [ ] **Step 2: Update avatar change handler**

In the crop/upload callback, replace the direct-localStorage pattern with:
```jsx
updateAgentAvatar(preset.id, croppedFile);
```

- [ ] **Step 3: Commit**

```bash
git add packages/chat-core/src/views/AgentProfile.jsx
git commit -m "refactor: AgentProfile uses shared useProfile() for agent avatars"
```

---

## Task 13: Wire chronicle App.jsx with useProfile + useFont

**Files:**
- Modify: `packages/chronicle/src/App.jsx`

- [ ] **Step 1: Add hooks and profile display**

```jsx
import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { MessageCircle, CheckSquare, Calendar, BookOpen } from 'lucide-react';
import { useProfile, useFont } from 'exo-shared';
import TimelineView from './views/TimelineView';
import TaskListView from './views/TaskListView';
import CalendarView from './views/CalendarView';
import ChronicleView from './views/ChronicleView';

export default function App() {
  const { userAvatar, userNick } = useProfile();
  useFont(); // Inject CSS font variables

  return (
    <div className="w-full h-screen flex flex-col bg-chron-bg text-chron-text">
      {/* Top bar — user identity display (desktop) */}
      <header className="hidden md:flex items-center justify-between h-10 px-4 border-b border-chron-accent/10 bg-chron-panel/80 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={14} strokeWidth={1.5} className="text-chron-accent" />
          <span className="text-[11px] font-mono tracking-wide text-chron-muted">Chronicle</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-chron-text/70">{userNick}</span>
          <img
            src={userAvatar}
            alt={userNick}
            className="w-6 h-6 rounded object-cover border border-chron-accent/15"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<TimelineView />} />
          <Route path="/tasks" element={<TaskListView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/chronicle" element={<ChronicleView />} />
        </Routes>
      </main>

      {/* Bottom Nav — unchanged */}
      <nav className="h-13 flex items-center justify-around border-t-2 border-chron-accent/15 bg-chron-panel shrink-0 relative">
        {/* ... existing bottom nav content unchanged ... */}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chronicle/src/App.jsx
git commit -m "feat: chronicle header shows user avatar/nickname via useProfile; wire useFont"
```

---

## Task 14: Update chronicle CSS for font variables

**Files:**
- Modify: `packages/chronicle/src/index.css`
- Modify: `packages/chronicle/tailwind.config.js`

- [ ] **Step 1: Import shared fonts.css**

Add at the top of `packages/chronicle/src/index.css`:

```css
@import 'exo-shared/styles/fonts.css';
@import 'exo-shared/styles/base.css';
@import 'exo-shared/styles/transitions.css';
```

- [ ] **Step 2: Replace body font-family**

```css
body {
  background-color: #faf5ed;
  color: #2d2418;
  font-family: var(--font-body);
  /* ... rest unchanged ... */
}
```

- [ ] **Step 3: Update label-caps and nav font**

The existing `.label-caps` uses JetBrains Mono — update to use CSS variable:

```css
.label-caps {
  font-family: var(--font-code);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
```

- [ ] **Step 4: Update tailwind.config.js fontFamily**

```js
fontFamily: {
  sans: ['var(--font-body)'],
  mono: ['var(--font-code)'],
},
```

- [ ] **Step 5: Commit**

```bash
git add packages/chronicle/src/index.css packages/chronicle/tailwind.config.js
git commit -m "feat: chronicle uses CSS font variables"
```

---

## Task 15: Wire council App.jsx with useProfile + useFont

**Files:**
- Modify: `packages/council/src/App.jsx`
- Modify: `packages/council/src/index.css`
- Modify: `packages/council/tailwind.config.js`

- [ ] **Step 1: Update council App.jsx**

```jsx
import React from 'react';
import { useProfile, useFont } from 'exo-shared';

export default function App() {
  const { userAvatar, userNick } = useProfile();
  useFont(); // Inject CSS font variables

  return (
    <div className="w-full h-screen bg-cncl-bg text-cncl-text font-sans flex items-center justify-center">
      {/* User identity hint in corner */}
      <div className="fixed top-3 right-4 flex items-center gap-2 opacity-60">
        <span className="text-xs text-cncl-muted">{userNick}</span>
        <img
          src={userAvatar}
          alt={userNick}
          className="w-6 h-6 rounded object-cover border border-cncl-border"
        />
      </div>

      <div className="text-center">
        <h1 className="text-cncl-accent text-2xl mb-4">ExoCore // Council</h1>
        <p className="text-cncl-muted">Multi-Agent Workspace — Coming in V3.1</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update council index.css**

```css
@import 'exo-shared/styles/fonts.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: var(--font-body);
  }
}
```

- [ ] **Step 3: Update council tailwind.config.js fontFamily**

Add if not already present:
```js
fontFamily: {
  sans: ['var(--font-body)'],
  mono: ['var(--font-code)'],
},
```

- [ ] **Step 4: Commit**

```bash
git add packages/council/src/App.jsx packages/council/src/index.css packages/council/tailwind.config.js
git commit -m "feat: council wires useProfile + useFont (V3.1 placeholder)"
```

---

## Task 16: Final Integration — Import fonts.css chain in chronicle and council

**Files:**
- Modify: `packages/chronicle/src/index.css` (verify import from Task 14)
- Modify: `packages/council/src/index.css` (verify import from Task 15)

This task is verification-only. Both chronicle and council should already have `@import 'exo-shared/styles/fonts.css'` from their respective tasks. If missing, add it.

- [ ] **Step 1: Verify all three index.css files import fonts.css**

Run: `grep -r "exo-shared/styles/fonts.css" packages/*/src/index.css`

Expected: all three modules show the import.

- [ ] **Step 2: Run dev servers to verify no CSS resolution errors**

```bash
pnpm dev:chat &
sleep 3
curl -s http://localhost:5173/chat/ | head -20
# Check that Vite resolves the font imports without errors
```

- [ ] **Step 3: Commit any fixes if needed**

---

## Task 17: Cleanup — ensure .gitignore covers .superpowers/

**Files:**
- Modify: `.gitignore` (root)

- [ ] **Step 1: Add .superpowers/ to .gitignore**

```
.superpowers/
```

This prevents the brainstorming session files from being committed.

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers/ to .gitignore"
```

---

## Verification Checklist

After all tasks complete, verify manually:

- [ ] **Font switch:** Open chat-core Settings → Appearance → select 霞鹜文楷 → body font changes in chat-core, chronicle, council
- [ ] **Avatar sync:** Upload avatar in chat-core UserProfile → refresh chronicle → header shows new avatar
- [ ] **Nick sync:** Edit nickname in chat-core UserProfile → refresh chronicle → header shows new nick
- [ ] **Cross-tab:** Open chat-core and chronicle in separate tabs → change font in chat-core → chronicle tab updates via storage event
- [ ] **Font rendering:** Each font renders correctly (no fallback to system serif/sans-serif)
- [ ] **No regression:** Existing flow (chat, agent hub, projects) works unchanged
