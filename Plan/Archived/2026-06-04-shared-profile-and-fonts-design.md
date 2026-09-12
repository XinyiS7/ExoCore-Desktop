# Shared Profile & Font Settings — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Scope:** ExoCore-Desktop monorepo (chat-core, chronicle, council + exo-shared)

---

## 1. Overview

Three independent SPAs (chat-core, chronicle, council) need shared access to basic user identity (avatar, nickname, agent avatar) and font preferences. Currently these are scattered across localStorage with no unified access pattern.

**Goals:**

1. Provide `useProfile()` hook in `exo-shared` — single source of truth for user avatar, nickname, agent avatar
2. Provide font preference storage + CSS variable injection via `exo-shared`
3. Add an "Appearance" section to chat-core Settings for font selection
4. Three fonts: Sarasa Gothic Mono (default body), LXGW WenKai (nav/UI), Maple Mono (code blocks)
5. Editing remains at existing pages (UserProfile, AgentProfile) — Settings only handles font + future misc items

**Non-goals for this phase:**

- Backend persistence (localStorage only)
- Council full implementation (V3.1 — just wire the hook)
- Cross-device sync
- Font upload (only pre-curated list)

---

## 2. Architecture

```
exo-shared (packages/shared/src/)
├── profile.js              🆕  localStorage read/write helpers
├── hooks/
│   ├── useProfile.js       🆕  unified user+agent identity hook
│   └── useFont.js          🆕  font preference + CSS variable injection
├── styles/
│   └── fonts.css           🆕  @font-face declarations
└── index.js                ✏️  add new exports

chat-core
├── views/SettingsView.jsx  ✏️  add "Appearance" nav item + route
├── views/UserProfile.jsx   ✏️  use shared useProfile() for writes
├── views/AgentProfile.jsx  ✏️  use shared useProfile() for writes
└── index.css               ✏️  use CSS font variables

chronicle
├── App.jsx                 ✏️  call useProfile() for header display
└── index.css               ✏️  use CSS font variables

council
├── App.jsx                 ✏️  call useProfile() (minimal — V3.1)
└── index.css               ✏️  use CSS font variables
```

---

## 3. Data Schema

### 3.1 localStorage Keys

| Key | Type | Default | Written By | Description |
|-----|------|---------|------------|-------------|
| `exo_user_avatar` | string (dataURL) | DiceBear URL | UserProfile | User avatar image |
| `exo_user_nick` | string | `"Elysia"` | UserProfile | Display nickname |
| `exo_user_avatar_seed` | string | `"Elysia"` | UserProfile | DiceBear seed fallback |
| `exo_agent_avatar_{presetId}` | string (dataURL) | DiceBear URL | AgentProfile | Per-agent avatar |
| `exo_font_preference` | string | `"sarasa"` | Settings→Appearance | Active font scheme |

### 3.2 Font Preference Values

| Value | Label | Font Stack |
|-------|-------|------------|
| `"sarasa"` | Sarasa Gothic Mono (默认) | `'Sarasa Gothic Mono', 'LXGW WenKai', monospace` |
| `"wenkai"` | 霞鹜文楷 | `'LXGW WenKai', 'Sarasa Gothic Mono', serif` |
| `"maple"` | Maple Mono | `'Maple Mono', 'Sarasa Gothic Mono', monospace` |

The font preference sets the **body font**. Navigation and code blocks use fixed assignments:

- **Navigation/UI**: always LXGW WenKai (`--font-nav`)
- **Body/content**: follows user preference (`--font-body`)
- **Code blocks**: always Maple Mono (`--font-code`)

---

## 4. Component Specs

### 4.1 `exo-shared/src/profile.js`

```js
// localStorage read/write helpers
export function getUserAvatar()     → string (dataURL or DiceBear URL)
export function setUserAvatar(url)  → void
export function getUserNick()       → string
export function setUserNick(nick)   → void
export function getAgentAvatar(presetId, name) → string
export function setAgentAvatar(presetId, url)   → void
```

### 4.2 `exo-shared/src/hooks/useProfile.js`

```js
// React hook — returns reactive profile state
export function useProfile() → {
  userAvatar,      // string
  userNick,        // string
  agentAvatars,    // Record<presetId, string>
  updateAvatar,    // (file: File) => void
  updateNick,      // (nick: string) => void
  updateAgentAvatar, // (presetId: string, file: File) => void
  refresh,         // () => void — re-read from localStorage
}
```

Listens for `storage` events so cross-tab changes propagate.

### 4.3 `exo-shared/src/hooks/useFont.js`

```js
// React hook — manages font preference + injects CSS variables
export function useFont() → {
  fontPreference,  // 'sarasa' | 'wenkai' | 'maple'
  setFont,         // (font: string) => void
  availableFonts,  // Array<{value, label, preview}>
}
```

On `setFont()`: writes `exo_font_preference` to localStorage, then sets CSS variables on `document.documentElement`:

```css
--font-body: <chosen font stack>;
--font-nav: 'LXGW WenKai', 'Sarasa Gothic Mono', sans-serif;
--font-code: 'Maple Mono', 'Consolas', monospace;
```

### 4.4 `exo-shared/src/styles/fonts.css`

```css
/* Google Fonts CDN imports */
@import url('https://fonts.googleapis.com/css2?family=LXGW+WenKai&display=swap');

/* Self-hosted or CDN for Sarasa Gothic Mono (GitHub release) */
@font-face {
  font-family: 'Sarasa Gothic Mono';
  src: url('/fonts/sarasa-gothic-mono-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* ... additional weights */

/* Maple Mono — Google Fonts or self-hosted */
@import url('https://fonts.googleapis.com/css2?family=Maple+Mono&display=swap');
```

**Decision:** LXGW WenKai from Google Fonts (free CDN). Sarasa Gothic Mono self-hosted as WOFF2 (GitHub Releases, ~2MB for regular weight). Maple Mono from Google Fonts.

### 4.5 Settings → Appearance Panel (chat-core)

New view: `packages/chat-core/src/components/settings/AppearancePanel.jsx`

Layout:
```
┌─ Settings ──────────────────────────┐
│ nav:  Key Manage                    │
│       Notifications                 │
│       Appearance    ← 🆕            │
│                                     │
│  🎨 Appearance                      │
│                                     │
│  界面字体                            │
│  ┌─────────────────────────────┐    │
│  │ ○ Sarasa Gothic Mono (默认) │    │
│  │ ○ 霞鹜文楷 LXGW WenKai      │    │
│  │ ○ Maple Mono                │    │
│  └─────────────────────────────┘    │
│                                     │
│  字体预览                            │
│  ┌─────────────────────────────┐    │
│  │ 春江潮水连海平，海上明月共潮生  │    │
│  │ The quick brown fox...         │    │
│  └─────────────────────────────┘    │
│                                     │
│  (future: more misc settings here)  │
└─────────────────────────────────────┘
```

---

## 5. Module Integration

### 5.1 chat-core

- `App.jsx`: Call `useFont()` in AppLayout → inject CSS variables
- `UserProfile.jsx`: Replace direct localStorage calls with `useProfile().updateAvatar/updateNick`
- `AgentProfile.jsx`: Replace direct localStorage calls with `useProfile().updateAgentAvatar`
- `SettingsView.jsx`: Add `appearance` nav item, add route to AppearancePanel
- `index.css`: Replace hardcoded `font-family` with `var(--font-body)`

### 5.2 chronicle

- `App.jsx`: Call `useProfile()` for header avatar/nick display; call `useFont()` for CSS variables
- `index.css`: Replace hardcoded `font-family` with `var(--font-body)`

### 5.3 council

- `App.jsx`: Call `useProfile()` for avatar/nick (minimal — full integration in V3.1)
- `index.css`: Apply CSS font variables

---

## 6. CSS Variable Strategy

Each module's `index.css` changes from:

```css
/* Before */
body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
```

To:

```css
/* After */
body { font-family: var(--font-body); }
.nav, .sidebar, button, .label { font-family: var(--font-nav); }
pre, code, .code-block { font-family: var(--font-code); }
```

Variables are injected by `useFont()` at `:root` level, so they work in all three SPAs independently.

---

## 7. Testing Plan

| Test | Description |
|------|-------------|
| Font switch | Change font in Settings → all three module windows update |
| Avatar sync | Upload avatar in chat-core UserProfile → chronicle header shows new avatar |
| Nick sync | Edit nickname → chronicle header reflects change |
| Cross-tab | Open chat-core and chronicle in separate tabs → font change propagates via storage event |
| Map rendering | Verify each font renders correctly on Win/Mac/Linux (WOFF2 fallback) |

---

## 8. File Manifest

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/profile.js` | Create | localStorage helpers |
| `packages/shared/src/hooks/useProfile.js` | Create | Unified profile hook |
| `packages/shared/src/hooks/useFont.js` | Create | Font preference hook + CSS var injection |
| `packages/shared/src/styles/fonts.css` | Create | @font-face declarations |
| `packages/shared/src/index.js` | Edit | Add new exports |
| `packages/chat-core/src/components/settings/AppearancePanel.jsx` | Create | Font selector UI |
| `packages/chat-core/src/views/SettingsView.jsx` | Edit | Add Appearance nav + route |
| `packages/chat-core/src/views/UserProfile.jsx` | Edit | Use shared useProfile() |
| `packages/chat-core/src/views/AgentProfile.jsx` | Edit | Use shared useProfile() |
| `packages/chat-core/src/App.jsx` | Edit | Wire useFont() |
| `packages/chat-core/src/index.css` | Edit | CSS font variables |
| `packages/chronicle/src/App.jsx` | Edit | Wire useProfile() + useFont() |
| `packages/chronicle/src/index.css` | Edit | CSS font variables |
| `packages/council/src/App.jsx` | Edit | Wire useProfile() minimal |
| `packages/council/src/index.css` | Edit | CSS font variables |

---

## 9. Future Enhancements (out of scope)

- Django `UserProfile` model + API for backend persistence
- Font upload (custom WOFF2)
- Per-module font override (currently global-only)
- Google Fonts API key for dynamic font browsing
- Theme/color scheme settings in Appearance panel
