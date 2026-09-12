# Light/Dark Theme Switching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light/dark theme toggle to chat-core, allowing users to switch between the existing dark Cinder palette and a new warm light palette, with preference persisted across sessions.

**Architecture:** CSS custom properties already drive all colors (`var(--cinder-*)`, `var(--tx-*)`). A `data-theme` attribute on `<html>` switches variable definitions between `:root` (dark, default) and `[data-theme="light"]`. A `useTheme` hook (in shared, following the `useFont` pattern) manages the attribute + localStorage. An inline `<script>` in `index.html` sets `data-theme` before first paint to prevent flash.

**Tech Stack:** React 19, CSS custom properties, localStorage, vanilla JS inline script (no dependencies).

## Global Constraints

- Must keep all existing dark theme behavior unchanged (dark is default)
- Must follow `useFont` pattern: hook in `packages/shared`, inline script in `index.html` for zero-flicker
- chat-core only; chronicle and council are out of scope (though shared hook can be reused)
- The Aurora background palette system (palettes.js) is unchanged — it's a separate per-session effect
- No changes to Tailwind config — `cinder.*` keys already use `var()` references
- No changes to any component JSX other than AppearancePanel and App.jsx

---

## 最终效果

用户在 Settings → Appearance 面板中看到一个 **Theme** 开关（Light / Dark），点击切换：

- **Dark（默认）**：保持现有 Cinder 暗色主题完全不变
- **Light**：全局切换为暖白基调的浅色主题，所有 UI 文字、面板、边框、滚动条同步变化
- 切换瞬间生效，无闪烁（inline script 在页面渲染前读取 localStorage 并设置 `data-theme`）
- 偏好持久化在 `localStorage` key `exo_theme`，关闭浏览器后重新打开保持
- `<meta name="theme-color">` 跟随主题切换（浏览器地址栏/状态栏颜色）

---

## 施工顺序

### Task 1: Create `useTheme` hook in shared

### Task 2: Wire theme into index.html (zero-flicker inline script)

### Task 3: Define `[data-theme="light"]` CSS variables

### Task 4: Fix hardcoded colors in base.css

### Task 5: Add theme toggle to AppearancePanel

### Task 6: Wire App.jsx to apply theme on mount

### Task 7: Validate and verify

---

## 关键文件清单

| 操作 | 文件 |
|------|------|
| Create | `packages/shared/src/hooks/useTheme.js` |
| Modify | `packages/shared/src/index.js:33` (add export) |
| Modify | `packages/shared/src/styles/base.css:6-42` (scrollbar, selection, cinder-aura → variables) |
| Modify | `packages/chat-core/src/index.css:15-30` (wrap `:root` → `:root, [data-theme="dark"]`, add `[data-theme="light"]` block) |
| Modify | `packages/chat-core/src/styles/typography.css:10-29` (same wrapping + light overrides) |
| Modify | `packages/chat-core/index.html:2,6,20-64` (`class="dark"` → `data-theme`, meta theme-color, inline script) |
| Modify | `packages/chat-core/src/components/settings/AppearancePanel.jsx:1-232` (add theme toggle section) |
| Modify | `packages/chat-core/src/App.jsx:64-66` (add `useTheme` call to apply on mount) |

---

## 不变部分

- **不碰** `tailwind.config.js` — Cinder Tailwind keys 已经走 `var()`，自动适配
- **不碰** `palettes.js` / `AuroraBackground.css` / `AuroraBackground.jsx` — Aurora 是独立系统
- **不碰** `ControlsDrawer.jsx` — 调色盘选择器与此无关
- **不碰** 任何 views 或 components 的 JSX（App.jsx 和 AppearancePanel 除外）— 它们都引用 `var(--cinder-*)`，自动适配
- **不碰** chronicle / council 模块
- **不碰** `packages/shared/src/styles/fonts.css` / `transitions.css`
- **不碰** `packages/shared/src/hooks/useFont.js`

---

## 验证

1. `pnpm dev:chat` 启动，打开 `http://localhost:5173`
2. 默认应为 Dark 主题（和现在一样）
3. Settings → Appearance → 点击 Light：整个页面切换为浅色
4. 刷新页面：保持 Light（无闪烁）
5. 切换回 Dark：恢复暗色
6. 新标签页打开：主题同步
7. Aurora 背景在 AI 思考时正常显示（浅色主题下可能偏淡，但不应错乱）

---

### Task 1: Create `useTheme` hook in shared

**Files:**
- Create: `packages/shared/src/hooks/useTheme.js`
- Modify: `packages/shared/src/index.js:33`

**Interfaces:**
- Produces: `useTheme()` → `{ theme, setTheme, toggleTheme, THEMES }`
  - `theme`: `'dark' | 'light'`
  - `setTheme(t: 'dark' | 'light')`: void
  - `toggleTheme()`: void
  - `THEMES`: `['dark', 'light']`

- [ ] **Step 1: Create `packages/shared/src/hooks/useTheme.js`**

```javascript
/**
 * Theme hook — light/dark mode switching.
 *
 * localStorage key: exo_theme
 * Values: 'dark' | 'light'
 * Default: 'dark' (no migration needed — existing users stay on dark)
 *
 * KEEP IN SYNC with inline <script> in:
 *   packages/chat-core/index.html
 */

import { useState, useEffect, useCallback } from 'react';

const KEY = 'exo_theme';
const DEFAULT = 'dark';

export const THEMES = ['dark', 'light'];

function getStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' ? 'light' : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update <meta name="theme-color"> for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#faf8f5' : '#050505');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(getStored);

  // Apply on mount (in case inline script hasn't run yet)
  useEffect(() => {
    applyTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-tab sync
  useEffect(() => {
    const handler = (e) => {
      if (e.key === KEY) {
        const next = (e.newValue === 'light' ? 'light' : DEFAULT);
        applyTheme(next);
        setThemeState(next);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setTheme = useCallback((t) => {
    const v = t === 'light' ? 'light' : DEFAULT;
    try { localStorage.setItem(KEY, v); } catch {}
    applyTheme(v);
    setThemeState(v);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, THEMES };
}
```

- [ ] **Step 2: Export from `packages/shared/src/index.js`**

Add after line 33 (after the `useFont` export):

```javascript
export { useTheme } from './hooks/useTheme';
```

- [ ] **Step 3: Verify shared builds**

Run: `cd packages/shared && pnpm build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/hooks/useTheme.js packages/shared/src/index.js
git commit -m "feat: add useTheme hook for light/dark theme switching"
```

---

### Task 2: Wire theme into index.html (zero-flicker inline script)

**Files:**
- Modify: `packages/chat-core/index.html:2,6,20-64`

**Interfaces:**
- Consumes: localStorage key `exo_theme` (same as `useTheme.js`)
- Produces: `data-theme` attribute on `<html>` set before first paint

- [ ] **Step 1: Update `<html>` tag (line 2)**

Change:
```html
<html lang="en" class="dark">
```
To:
```html
<html lang="en" data-theme="dark">
```

- [ ] **Step 2: Update `<meta name="theme-color">` (line 6)**

Change:
```html
<meta name="theme-color" content="#050505" />
```
To:
```html
<meta name="theme-color" content="#050505" id="meta-theme-color" />
```

(The `id` lets the inline script find it immediately without `querySelector`.)

- [ ] **Step 3: Add theme init before the existing font `<script>` (before line 20)**

Insert this `<script>` block immediately after the `<link>` tags and before the existing font `<script>`:

```html
  <script>
    (function() {
      var theme = 'dark';
      try {
        var stored = localStorage.getItem('exo_theme');
        if (stored === 'light') theme = 'light';
      } catch(e) {}
      document.documentElement.setAttribute('data-theme', theme);
      var meta = document.getElementById('meta-theme-color');
      if (meta) {
        meta.setAttribute('content', theme === 'light' ? '#faf8f5' : '#050505');
      }
    })();
  </script>
```

- [ ] **Step 4: Add SYNC ALERT comment above the new script**

```html
  <!--
    ⚠️ SYNC ALERT ⚠️
    This script's key / defaults MUST match:
      packages/shared/src/hooks/useTheme.js
    Change either side → sync the other, or theme flash returns.
  -->
```

- [ ] **Step 5: Commit**

```bash
git add packages/chat-core/index.html
git commit -m "feat: add inline theme init script for zero-flicker switching"
```

---

### Task 3: Define `[data-theme="light"]` CSS variables

**Files:**
- Modify: `packages/chat-core/src/index.css:15-30`
- Modify: `packages/chat-core/src/styles/typography.css:10-29`

**Interfaces:**
- Consumes: `data-theme` attribute on `<html>` (set by Task 1 + Task 2)
- Produces: All `--cinder-*` and `--tx-*` variables have light variants

- [ ] **Step 1: Wrap `:root` Cinder variables with `:root, [data-theme="dark"]`**

In `packages/chat-core/src/index.css`, change lines 15-30 from:

```css
:root {
  --cinder-base:       #050505;
  --cinder-ember:      #c44d00;
  --cinder-ember-dim:  #885332;
  --cinder-flame:      #ff4a08;
  --cinder-flame-dim:  rgb(253 192 122 / 0.8);
  --cinder-glass:      rgba(255, 255, 255, 0.01);
  --cinder-glass-heavy:rgba(15, 9, 9, 0.6);
  --cinder-line:       rgba(139, 0, 0, 0.25);
  --cinder-line-glow:  rgba(255, 51, 51, 0.2);
  --cinder-text:       #cecdd6;
  --cinder-text-dim:   rgb(156 156 170);
  --cinder-text-faint: rgb(113 112 120);
  --cinder-panel:      rgba(255, 255, 255, 0.02);
  --cinder-surface:    rgba(255, 255, 255, 0.015);
}
```

To:

```css
:root,
[data-theme="dark"] {
  --cinder-base:       #050505;
  --cinder-ember:      #c44d00;
  --cinder-ember-dim:  #885332;
  --cinder-flame:      #ff4a08;
  --cinder-flame-dim:  rgb(253 192 122 / 0.8);
  --cinder-glass:      rgba(255, 255, 255, 0.01);
  --cinder-glass-heavy:rgba(15, 9, 9, 0.6);
  --cinder-line:       rgba(139, 0, 0, 0.25);
  --cinder-line-glow:  rgba(255, 51, 51, 0.2);
  --cinder-text:       #cecdd6;
  --cinder-text-dim:   rgb(156 156 170);
  --cinder-text-faint: rgb(113 112 120);
  --cinder-panel:      rgba(255, 255, 255, 0.02);
  --cinder-surface:    rgba(255, 255, 255, 0.015);
}
```

- [ ] **Step 2: Add `[data-theme="light"]` Cinder block**

Append after the dark block (after the closing `}` and a blank line):

```css
/* ── Cinder · Light Theme ── */
[data-theme="light"] {
  --cinder-base:       #faf8f5;
  --cinder-ember:      #c44d00;
  --cinder-ember-dim:  #a06040;
  --cinder-flame:      #e04400;
  --cinder-flame-dim:  rgb(180 70 20 / 0.7);
  --cinder-glass:      rgba(0, 0, 0, 0.02);
  --cinder-glass-heavy:rgba(255, 252, 248, 0.88);
  --cinder-line:       rgba(180, 80, 0, 0.15);
  --cinder-line-glow:  rgba(200, 60, 0, 0.12);
  --cinder-text:       #3a3632;
  --cinder-text-dim:   rgb(110 100 90);
  --cinder-text-faint: rgb(150 140 128);
  --cinder-panel:      rgba(0, 0, 0, 0.015);
  --cinder-surface:    rgba(0, 0, 0, 0.008);
}
```

- [ ] **Step 3: Wrap `:root` typography variables with `:root, [data-theme="dark"]`**

In `packages/chat-core/src/styles/typography.css`, change the `:root` block (lines 10-29) from:

```css
:root {
  /* ── 暖色轴 ... ── */
  --tx-warm-incandescent: #fff3db;
  --tx-warm-gold:         #f8bf74;
  ...
```

To:

```css
:root,
[data-theme="dark"] {
```

(Just change the selector on line 10, keep everything else identical.)

- [ ] **Step 4: Add `[data-theme="light"]` typography block**

Append after the dark typography `}` (after line 29), before the `/* ═══ 二、语义类 ═══ */` comment:

```css

/* ── Light Theme · 暖色/冷色/中性轴映射 ── */
[data-theme="light"] {
  /* 暖色轴 — 暗底白炽 → 白底深焰 */
  --tx-warm-incandescent: #8a3800;
  --tx-warm-gold:         #b85a00;
  --tx-warm-flare:        #d05000;
  --tx-warm-flame:        #c04000;
  --tx-warm-ember:        #8a3000;

  /* 极冷轴 — 暗底等离子 → 白底深蓝 */
  --tx-cryo-plasma:       #3a60d0;
  --tx-cryo-void:         #6a7a90;

  /* 中性轴 — 暗底亮字 → 白底暗字 */
  --tx-neutral-00:        #1a1816;
  --tx-neutral-10:        #2a2824;
  --tx-neutral-20:        #4a4440;
  --tx-neutral-30:        #6a645e;
  --tx-neutral-40:        #8a8480;
  --tx-neutral-70:        #b0aaa5;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/chat-core/src/index.css packages/chat-core/src/styles/typography.css
git commit -m "feat: add [data-theme='light'] CSS variable overrides for Cinder + typography palettes"
```

---

### Task 4: Fix hardcoded colors in base.css

**Files:**
- Modify: `packages/shared/src/styles/base.css:6-12,21-24,33-42`

**Interfaces:**
- Consumes: `--cinder-ember`, `--cinder-flame`, `--cinder-text`, `--cinder-base` (defined in chat-core index.css)
- Produces: Scrollbar, selection, and cinder-aura glow all respond to theme

- [ ] **Step 1: Add CSS variables for scrollbar and selection colors**

In `packages/shared/src/styles/base.css`, insert new variables after line 4 (after the `Cinder · Global Base` comment block, before the scrollbar section):

```css
/* ── Theme-aware tokens (sync with chat-core index.css) ── */
:root,
[data-theme="dark"] {
  --cinder-scrollbar-thumb:       rgba(196, 77, 0, 0.15);
  --cinder-scrollbar-thumb-hover: rgba(255, 74, 8, 0.4);
  --cinder-selection-bg:          rgba(196, 77, 0, 0.25);
}

[data-theme="light"] {
  --cinder-scrollbar-thumb:       rgba(180, 80, 0, 0.12);
  --cinder-scrollbar-thumb-hover: rgba(200, 60, 0, 0.3);
  --cinder-selection-bg:          rgba(196, 77, 0, 0.15);
}
```

- [ ] **Step 2: Replace hardcoded scrollbar colors**

Change:
```css
::-webkit-scrollbar-thumb {
  background: rgba(196, 77, 0, 0.15);
  border-radius: 4px;
  transition: background 0.3s;
}
::-webkit-scrollbar-thumb:hover { background: rgba(255, 74, 8, 0.4); }

* {
  scrollbar-width: thin;
  scrollbar-color: rgba(196, 77, 0, 0.15) transparent;
}
```

To:
```css
::-webkit-scrollbar-thumb {
  background: var(--cinder-scrollbar-thumb);
  border-radius: 4px;
  transition: background 0.3s;
}
::-webkit-scrollbar-thumb:hover { background: var(--cinder-scrollbar-thumb-hover); }

* {
  scrollbar-width: thin;
  scrollbar-color: var(--cinder-scrollbar-thumb) transparent;
}
```

- [ ] **Step 3: Replace hardcoded selection color**

Change:
```css
::selection {
  background: rgba(196, 77, 0, 0.25);
  color: var(--cinder-text);
}
```

To:
```css
::selection {
  background: var(--cinder-selection-bg);
  color: var(--cinder-text);
}
```

- [ ] **Step 4: Add light theme variant for `.cinder-aura::before`**

After the existing `.cinder-aura::before` block (lines 33-42), append:

```css
[data-theme="light"] .cinder-aura::before {
  background:
    radial-gradient(ellipse 60% 40% at 50% 30%, rgba(196,77,0,0.03) 0%, transparent 60%),
    radial-gradient(ellipse 30% 25% at 80% 70%, rgba(200,120,40,0.02) 0%, transparent 50%);
}
```

- [ ] **Step 5: Verify base.css**

Check that `body` rule (line 27-29) already uses `var(--cinder-base)` and `var(--cinder-text)` — no changes needed there.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/styles/base.css
git commit -m "fix: move hardcoded colors in base.css to theme-aware CSS variables"
```

---

### Task 5: Add theme toggle to AppearancePanel

**Files:**
- Modify: `packages/chat-core/src/components/settings/AppearancePanel.jsx:1-232`

**Interfaces:**
- Consumes: `useTheme` from `exo-shared`

- [ ] **Step 1: Add import**

After the existing `import { useFont, ... } from 'exo-shared';` on line 2, add `useTheme`:

Change line 2 from:
```javascript
import { useFont, AVAILABLE_FONTS, FONT_SCALE_CONFIG, getFontStack } from 'exo-shared';
```

To:
```javascript
import { useFont, useTheme, AVAILABLE_FONTS, FONT_SCALE_CONFIG, getFontStack } from 'exo-shared';
```

- [ ] **Step 2: Add theme state to component**

In the `AppearancePanel` function body (after `useFont()` destructuring on line 132, before the `return`), add:

```javascript
  const { theme, setTheme } = useTheme();
```

- [ ] **Step 3: Add theme toggle UI section**

After the `{/* Font Scale Slider */}` section ending `</div>` (after line 176, before `{/* Preview cards */}`), insert:

```jsx

          <div className="border-t border-white/5" />

          {/* Theme Toggle */}
          <div className="space-y-3">
            <div>
              <span className="text-[0.625rem] tracking-[0.12em] tx-system-normal opacity-70">
                🎨 Theme · 主题
              </span>
              <p className="text-[0.5625rem] tx-system-mute opacity-40 mt-0.5 leading-relaxed">
                切换深色 / 浅色全局配色方案
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'border-chat-accent/40 bg-chat-accent/10 tx-system-accent shadow-glow-gold'
                    : 'border-white/5 bg-white/[0.02] tx-system-mute hover:border-white/10'
                }`}
              >
                <span className="block text-lg mb-1">🌙</span>
                Dark · 深色
              </button>

              <button
                onClick={() => setTheme('light')}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  theme === 'light'
                    ? 'border-chat-accent/40 bg-chat-accent/10 tx-system-accent shadow-glow-gold'
                    : 'border-white/5 bg-white/[0.02] tx-system-mute hover:border-white/10'
                }`}
              >
                <span className="block text-lg mb-1">☀️</span>
                Light · 浅色
              </button>
            </div>
          </div>
```

- [ ] **Step 4: Commit**

```bash
git add packages/chat-core/src/components/settings/AppearancePanel.jsx
git commit -m "feat: add light/dark theme toggle to Appearance settings"
```

---

### Task 6: Wire App.jsx to apply theme on mount

**Files:**
- Modify: `packages/chat-core/src/App.jsx:1,64-66`

**Interfaces:**
- Consumes: `useTheme` from `exo-shared`

- [ ] **Step 1: Add import**

Change line 1 from:
```javascript
import React, { useState, useCallback, useEffect } from 'react';
```

To:
```javascript
import React, { useState, useCallback, useEffect, useMemo } from 'react';
```

And add after the existing `exo-shared` imports (if any — there are none currently in App.jsx; hooks are imported elsewhere). Actually, we need to import `useTheme` somewhere that gets called on mount. The cleanest place is `AppLayout` since it's always rendered and wraps all routes.

Add this import near the top of App.jsx (after the existing React import):
```javascript
import { useTheme } from 'exo-shared';
```

Actually, looking at App.jsx more carefully — there are no existing `exo-shared` imports in App.jsx currently. The `useTheme` hook needs to be called in a component that's always mounted. `AppLayout` is the right place.

- [ ] **Step 2: Call useTheme in AppLayout**

In the `AppLayout` function (after the `setView` callback, before the `appStateForModals` line), add:

```javascript
  // Apply theme on mount and sync across tabs
  useTheme();
```

Place it right after line 60 (`}, [navigate]);`) and before line 62 (`const appStateForModals = ...`).

- [ ] **Step 3: Verify the placement**

The `useTheme()` call in `AppLayout` ensures:
- On mount: reads localStorage, sets `data-theme` (though inline script already did it — this is the React-side sync)
- Cross-tab: `storage` event listener keeps theme in sync
- No props needed — the hook works via DOM + localStorage

- [ ] **Step 4: Commit**

```bash
git add packages/chat-core/src/App.jsx
git commit -m "feat: wire useTheme into AppLayout for theme mount and cross-tab sync"
```

---

### Task 7: Validate and verify

**Files:**
- None (verification only)

- [ ] **Step 1: Start dev server**

```bash
cd packages/chat-core && pnpm dev
```

Expected: Vite starts on :5173, no build errors.

- [ ] **Step 2: Verify dark theme (default)**

Open `http://localhost:5173` in an incognito/clean browser window.
- Page loads with dark background (`#050505`)
- `<html>` has `data-theme="dark"`
- All UI looks identical to before the changes

- [ ] **Step 3: Verify light theme switch**

Navigate to Settings → Appearance.
- Click "Light · 浅色" button.
- Entire page switches to warm white background.
- `<html>` changes to `data-theme="light"`.
- Text is dark (`#3a3632`).
- Scrollbar is warm-tinted.
- Glass panels have dark tint instead of light tint.
- Selection highlight is warm orange.

- [ ] **Step 4: Verify persistence**

Refresh the page (F5).
- Page loads in light theme (no dark flash).
- `<html data-theme="light">` is present from first paint.

- [ ] **Step 5: Verify cross-tab sync**

Open a second tab to `http://localhost:5173`.
- In Tab 1, switch to dark.
- Tab 2 should follow (via `storage` event).

- [ ] **Step 6: Verify toggle back**

Switch back to dark.
- All UI returns to the original Cinder dark look.

- [ ] **Step 7: Verify Aurora background still works**

Open a chat session with an AI agent.
- Aurora background animation plays during AI thinking.
- In dark theme: identical to before.
- In light theme: Aurora is visible but may appear fainter (expected — `mix-blend-mode: screen` has less impact on light backgrounds). This is acceptable for V1 — a future task can tune Aurora for light theme if needed.

- [ ] **Step 8: Verify prose/code blocks**

Find a chat message with code blocks and formatted text.
- Switch themes.
- Code blocks, inline code, blockquotes, tables all adapt.

- [ ] **Step 9: Verify no console errors**

Open browser console. Switch themes. No errors or warnings.

- [ ] **Step 10: Final commit (if any fixes)**

```bash
git add -A
git commit -m "chore: final verification pass for light/dark theme"
```
