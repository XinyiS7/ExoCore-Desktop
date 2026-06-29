# Aurora 浅色主题适配 + 调色板管理优化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aurora 呼吸背景适配浅色主题（晨光金雾等 3 个浅色预设），精简预设至 6 个（深 3 + 浅 3），新增自定义调色板原地编辑功能。

**Architecture:** 5 文件分层修改。`palettes.js` 作为数据层（预设 + CRUD），`AuroraBackground.jsx` 引入 `useTheme()` 做主题感知，`AuroraBackground.css` 通过 CSS 变量 + `[data-theme="light"]` 做视觉适配，`ChatArea.jsx` 初始化时验证调色板主题兼容性，`ControlsDrawer.jsx` 做 UI 层的主题过滤 + 编辑按钮。

**Tech Stack:** React 19, CSS custom properties, localStorage, OKLCH color interpolation

**Spec:** `docs/superpowers/specs/2026-06-22-aurora-light-theme-design.md`

## Global Constraints

- 不修改后端代码（ExoCore/ Django）
- 不修改扩展代码（ExoCore-Extension/）
- 自定义调色板 localStorage key `exo_custom_palettes` 不变
- 每会话调色板 key `exo_session_theme_<sessId>` 不变
- CSS 变量名 `--obsidian` ~ `--orange-500` 不变
- 删除的预设 ID 不可被任何本地存储引用（全新安装无影响，已有数据通过 `getPalette` 回退处理）

---

### Task 1: palettes.js — 预设重构 + updateCustomPalette

**Files:**
- Modify: `packages/chat-core/src/components/chat/palettes.js`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `ALL_PRESETS` — flat object `{ 'burning-sunset': {...}, 'deep-ocean': {...}, ... }` instead of old `BUILTIN` array
  - `DARK_PRESETS` — dark-only subset (3 entries)
  - `LIGHT_PRESETS` — light-only subset (3 entries)
  - `updateCustomPalette(id, updates)` — new function, signature `(string, {label?: string, colors?: object}) => object|null`
  - `getPalette(id)` — updated to search `ALL_PRESETS` + customs
  - `getAllPalettes()` — updated to return flat list from combined sources
  - `DEFAULT_PALETTE_ID` — remains `'burning-sunset'`
  - Removed exports: `BUILTIN` array (replaced by `ALL_PRESETS`)

- [ ] **Step 1: Replace BUILTIN array with structured preset objects**

Replace lines 17–108 (the entire `BUILTIN` array) with:

```js
/* ────────────────────────────────────────────
   Built-in presets — 3 dark + 3 light
   Each preset has a `theme` tag for filtering.
   ──────────────────────────────────────────── */

const DARK_PRESETS = {
  'burning-sunset': {
    id: 'burning-sunset',
    label: 'Burning Sunset',
    theme: 'dark',
    builtin: true,
    colors: {
      '--obsidian':   '#0a0200',
      '--garnet-600': '#ae290e',
      '--oxblood-400': '#751609',
      '--oxblood-500': '#941b0c',
      '--rusty-500':   '#bc3908',
      '--rusty-600':   '#ea4811',
      '--orange-400':  '#ed773f',
      '--orange-500':  '#f8bf74',
    },
  },
  'deep-ocean': {
    id: 'deep-ocean',
    label: 'Deep Ocean',
    theme: 'dark',
    builtin: true,
    colors: {
      '--obsidian':   '#000a14',
      '--garnet-600': '#0a3d6b',
      '--oxblood-400': '#062a4a',
      '--oxblood-500': '#084d80',
      '--rusty-500':   '#0b5fa0',
      '--rusty-600':   '#1a8ad4',
      '--orange-400':  '#3da5e8',
      '--orange-500':  '#7cc8f4',
    },
  },
  'void-amethyst': {
    id: 'void-amethyst',
    label: 'Void Amethyst',
    theme: 'dark',
    builtin: true,
    colors: {
      '--obsidian':   '#05000a',
      '--garnet-600': '#4a1d6b',
      '--oxblood-400': '#2d0f45',
      '--oxblood-500': '#5c2080',
      '--rusty-500':   '#7a2da0',
      '--rusty-600':   '#9b40c8',
      '--orange-400':  '#b86be0',
      '--orange-500':  '#d4a0f0',
    },
  },
};

const LIGHT_PRESETS = {
  'morning-mist': {
    id: 'morning-mist',
    label: '晨光金雾',
    theme: 'light',
    builtin: true,
    colors: {
      '--obsidian':   '#fef9f0',
      '--garnet-600': '#e8b86d',
      '--oxblood-400': '#f5d4a8',
      '--oxblood-500': '#f0c78e',
      '--rusty-500':   '#eeb86b',
      '--rusty-600':   '#f2a65a',
      '--orange-400':  '#f7d6a0',
      '--orange-500':  '#fbe5c0',
    },
  },
  'spring-dew': {
    id: 'spring-dew',
    label: '春露',
    theme: 'light',
    builtin: true,
    colors: {
      '--obsidian':   '#f8faf6',
      '--garnet-600': '#b8cc9e',
      '--oxblood-400': '#d4e4c4',
      '--oxblood-500': '#c5daaa',
      '--rusty-500':   '#a8c78a',
      '--rusty-600':   '#9bb878',
      '--orange-400':  '#dcecc8',
      '--orange-500':  '#eaf2de',
    },
  },
  'peach-cloud': {
    id: 'peach-cloud',
    label: '桃云',
    theme: 'light',
    builtin: true,
    colors: {
      '--obsidian':   '#fef8f5',
      '--garnet-600': '#f0b8a8',
      '--oxblood-400': '#f8d4c8',
      '--oxblood-500': '#f4c4b4',
      '--rusty-500':   '#eea890',
      '--rusty-600':   '#e8987c',
      '--orange-400':  '#fadcd0',
      '--orange-500':  '#fceae2',
    },
  },
};

const ALL_PRESETS = { ...DARK_PRESETS, ...LIGHT_PRESETS };
```

- [ ] **Step 2: Add updateCustomPalette function**

Insert after the `deleteCustomPalette` function (after line 293):

```js
/** Update a custom palette in-place. Returns the updated palette or null. */
export function updateCustomPalette(id, updates) {
  const list = getCustomPalettes();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return null;

  if (updates.label !== undefined) list[idx].label = updates.label;
  if (updates.colors !== undefined) list[idx].colors = { ...list[idx].colors, ...updates.colors };

  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return list[idx];
}
```

- [ ] **Step 3: Update lookup helpers to use ALL_PRESETS**

Replace `getPalette` (lines 300–303):

```js
/** Get a single palette by id (checks built-in then custom). */
export function getPalette(id) {
  if (!id) return ALL_PRESETS[DEFAULT_PALETTE_ID];
  return ALL_PRESETS[id] || getCustomPalettes().find(p => p.id === id) || ALL_PRESETS[DEFAULT_PALETTE_ID];
}
```

Replace `getAllPalettes` (lines 306–308):

```js
/** Get all available palettes (built-in + custom) for the selector UI. */
export function getAllPalettes() {
  return [...Object.values(ALL_PRESETS), ...getCustomPalettes()];
}
```

- [ ] **Step 4: Update DEFAULT_PALETTE_ID and default export**

Replace line 310:

```js
export const DEFAULT_PALETTE_ID = 'burning-sunset';
```

Replace line 312 (default export — remove BUILTIN array export, export ALL_PRESETS instead):

```js
export { ALL_PRESETS, DARK_PRESETS, LIGHT_PRESETS };
export default ALL_PRESETS;
```

- [ ] **Step 5: Commit**

```bash
git add packages/chat-core/src/components/chat/palettes.js
git commit -m "refactor(aurora): restructure presets (3 dark + 3 light), add theme tags, add updateCustomPalette"
```

---

### Task 2: AuroraBackground.css — CSS 变量 + 浅色覆盖

**Files:**
- Modify: `packages/chat-core/src/components/chat/AuroraBackground.css`

**Interfaces:**
- Consumes:
  - CSS custom properties `--aurora-opacity-min`, `--aurora-opacity-max` (new, defined on `.aurora-stage`)
  - `data-theme` attribute on `<html>` (existing theme system)
- Produces: visual-only, no JS interface

- [ ] **Step 1: Add CSS opacity variables to .aurora-stage**

After the existing `.aurora-stage` rules (after line 21), add:

```css
/* Opacity range used by all ribbon/blob keyframes.
   Overridden per-theme so light mode can run subtler. */
.aurora-stage {
  --aurora-opacity-min: 0.10;
  --aurora-opacity-max: 0.50;
}

[data-theme="light"] .aurora-stage {
  --aurora-opacity-min: 0.06;
  --aurora-opacity-max: 0.32;
}
```

- [ ] **Step 2: Replace hardcoded opacity values in keyframes with CSS variables**

In all 7 `@keyframes` blocks, replace each opacity value:

| Old pattern | New pattern |
|---|---|
| `opacity: 0.10` | `opacity: var(--aurora-opacity-min)` |
| `opacity: 0.12` | `opacity: var(--aurora-opacity-min)` |
| `opacity: 0.16` | `opacity: var(--aurora-opacity-min)` |
| `opacity: 0.18` | `opacity: var(--aurora-opacity-min)` |
| `opacity: 0.44` | `opacity: var(--aurora-opacity-max)` |
| `opacity: 0.46` | `opacity: var(--aurora-opacity-max)` |
| `opacity: 0.48` | `opacity: var(--aurora-opacity-max)` |
| `opacity: 0.50` | `opacity: var(--aurora-opacity-max)` |
| `opacity: 0.52` | `opacity: var(--aurora-opacity-max)` |

All other opacity values (0.20, 0.24, 0.25, 0.26, 0.28, 0.42, 0.45) stay as-is — they're mid-cycle.
For any opacity value > 0.40, replace with `var(--aurora-opacity-max)`.
For any opacity value < 0.15, replace with `var(--aurora-opacity-min)`.

Example — `aurora-drift-right` keyframes (lines 142–148) become:

```css
@keyframes aurora-drift-right {
  0%   { transform: translate(-20vw, 0) scale(1);       opacity: var(--aurora-opacity-min); }
  25%  { transform: translate(5vw, -8vh) scale(1.12);   opacity: var(--aurora-opacity-max); }
  50%  { transform: translate(30vw, -3vh) scale(1.04);  opacity: 0.28; }
  75%  { transform: translate(50vw, -10vh) scale(1.14); opacity: var(--aurora-opacity-max); }
  100% { transform: translate(-20vw, 0) scale(1);       opacity: var(--aurora-opacity-min); }
}
```

Apply the same pattern to all 7 keyframes (`aurora-drift-right`, `aurora-drift-left`, `aurora-drift-right-wave`, `aurora-drift-left-wave`, `aurora-deep-breathe`, `aurora-warm-float`, `aurora-gold-rise`).

- [ ] **Step 3: Add [data-theme="light"] overrides for blend mode, grain, vignette, and idle glow**

Add at the end of the file:

```css
/* ═══════════════════════════════════════════════════
   LIGHT-THEME OVERRIDES
   ═══════════════════════════════════════════════════ */

/* screen blend is near-invisible on light backgrounds → multiply for warm staining */
[data-theme="light"] .aurora-ribbon {
  mix-blend-mode: multiply;
}

/* Grain is too prominent on light backgrounds */
[data-theme="light"] .aurora-grain {
  opacity: 0.018;
}

/* Replace dark vignette with warm center glow */
[data-theme="light"] .aurora-vignette {
  background: radial-gradient(
    ellipse 62% 52% at 50% 38%,
    rgba(254, 249, 240, 0.25) 0%,
    rgba(254, 249, 240, 0.08) 50%,
    transparent 100%
  );
}

/* Idle ambient glow — warm peach instead of dark oxblood */
[data-theme="light"] .aurora-stage::after {
  background: radial-gradient(
    ellipse 65% 45% at 50% 42%,
    rgba(240, 199, 142, 0.06) 0%,
    transparent 70%
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/chat-core/src/components/chat/AuroraBackground.css
git commit -m "feat(aurora): CSS variables for keyframe opacity, [data-theme=light] blend/grain/vignette overrides"
```

---

### Task 3: AuroraBackground.jsx — 主题感知默认调色板

**Files:**
- Modify: `packages/chat-core/src/components/chat/AuroraBackground.jsx`

**Interfaces:**
- Consumes: `useTheme` from `exo-shared` (returns `{ theme: 'dark'|'light' }`)
- Produces: same component signature, internally resolves theme-default palette when none provided

- [ ] **Step 1: Add useTheme import and theme-aware palette resolution**

Replace lines 1–19 with:

```jsx
import React from 'react';
import './AuroraBackground.css';
import { getPalette, DARK_PRESETS, LIGHT_PRESETS } from './palettes';
import { useTheme } from 'exo-shared';

/**
 * Full-viewport aurora plasma background.
 *
 * @param {boolean} active    — enables the ribbon-drift animation (AI generating)
 * @param {string}  paletteId — key into palettes.js; auto-selects theme default when omitted
 * @param {object}  colors    — direct CSS-variable map (live preview); takes precedence over paletteId
 */
const AuroraBackground = ({ active = false, paletteId, colors }) => {
  const { theme } = useTheme();

  // Resolve theme-default palette when no explicit palette is given
  const themeDefaultId = theme === 'light'
    ? Object.keys(LIGHT_PRESETS)[0]   // 'morning-mist'
    : Object.keys(DARK_PRESETS)[0];   // 'burning-sunset'

  const resolvedId = paletteId || themeDefaultId;
  const palette = colors ? { colors } : getPalette(resolvedId);

  const cssVars = {};
  if (palette?.colors) {
    for (const [k, v] of Object.entries(palette.colors)) {
      cssVars[k] = v;
    }
  }

  return (
    // ... existing JSX unchanged ...
```

**Important:** The rest of the component (JSX return block, lines 21–44) stays exactly the same — only the imports and palette resolution logic change.

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/chat/AuroraBackground.jsx
git commit -m "feat(aurora): auto-select theme-default palette via useTheme()"
```

---

### Task 4: ChatArea.jsx — 主题感知默认值 + 兼容性验证

**Files:**
- Modify: `packages/chat-core/src/components/chat/ChatArea.jsx`

**Interfaces:**
- Consumes:
  - `useTheme` from `exo-shared`
  - `getPalette` from `./palettes` (updated — returns objects with `theme` field)
- Produces: theme-aware default palette initialization, useEffect-based theme-change handling

- [ ] **Step 1: Add useTheme import**

At line 17, update the palette import to also import `ALL_PRESETS`:

```jsx
import { DEFAULT_PALETTE_ID, getPalette, ALL_PRESETS } from './palettes';
```

At line 7, add `useTheme` to the `exo-shared` import (it's already imported for other hooks, verify):

```jsx
// If useTheme is not already imported from 'exo-shared', add it:
import { baseUrl, getCsrfToken, MAIN_MODEL_IDS, useTheme } from 'exo-shared';
```

- [ ] **Step 2: Add getThemeDefault helper and update paletteId initialization**

At line 80, replace the paletteId initialization:

```jsx
// OLD (lines 80-82):
const [paletteId, setPaletteId] = useState(() =>
  activeSessionId ? localStorage.getItem(`exo_session_theme_${activeSessionId}`) || DEFAULT_PALETTE_ID : DEFAULT_PALETTE_ID
);

// NEW:
const { theme } = useTheme();

const getThemeDefaultId = (t) => {
  return t === 'light' ? 'morning-mist' : 'burning-sunset';
};

const [paletteId, setPaletteId] = useState(() => {
  const stored = activeSessionId
    ? localStorage.getItem(`exo_session_theme_${activeSessionId}`)
    : null;
  if (stored) {
    const preset = getPalette(stored);
    // Validate stored palette is compatible with current theme.
    // Custom palettes have no theme tag → always compatible.
    // Built-in presets must match the current theme.
    if (preset && (!preset.theme || preset.theme === theme)) {
      return stored;
    }
  }
  return getThemeDefaultId(theme);
});
```

- [ ] **Step 3: Add useEffect to handle theme changes at runtime**

After the `useEffect` that restores per-session palette (around line 376), add a new `useEffect`:

```jsx
// When theme changes, verify current paletteId is still compatible
useEffect(() => {
  const preset = getPalette(paletteId);
  if (preset?.theme && preset.theme !== theme) {
    // Current palette is incompatible with new theme → revert to default
    const newDefault = getThemeDefaultId(theme);
    setPaletteId(newDefault);
    if (activeSessionId) {
      localStorage.setItem(`exo_session_theme_${activeSessionId}`, newDefault);
    }
  }
}, [theme]);
```

- [ ] **Step 4: Update the session-restore useEffect to also validate theme**

At line 376-377, update the session restore logic:

```jsx
// Restore per-session color palette (with theme validation)
const savedPalette = localStorage.getItem(`exo_session_theme_${activeSessionId}`);
if (savedPalette) {
  const preset = getPalette(savedPalette);
  if (preset && (!preset.theme || preset.theme === theme)) {
    setPaletteId(savedPalette);
  } else {
    setPaletteId(getThemeDefaultId(theme));
  }
} else {
  setPaletteId(getThemeDefaultId(theme));
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/chat-core/src/components/chat/ChatArea.jsx
git commit -m "feat(aurora): theme-aware default palette + cross-theme compatibility validation in ChatArea"
```

---

### Task 5: ControlsDrawer.jsx — 主题过滤 + 编辑功能

**Files:**
- Modify: `packages/chat-core/src/components/chat/ControlsDrawer.jsx`

**Interfaces:**
- Consumes:
  - `useTheme` from `exo-shared` (new)
  - `ALL_PRESETS` (named export, replaces `BUILTIN` default import)
  - `updateCustomPalette` from `./palettes` (new)
- Produces: filtered preset select + update/save-as-new buttons

- [ ] **Step 1: Update imports**

Replace lines 4–5:

```jsx
import { getCustomPalettes, saveCustomPalette, deleteCustomPalette, updateCustomPalette, computeStops, getPalette, DEFAULT_PALETTE_ID, STOP_NAMES, ALL_PRESETS } from './palettes';
// Remove: import BUILTIN from './palettes';
```

Add `useTheme` import (line 1 already imports from react; check if `useTheme` comes from `exo-shared`):

At line 2, verify `useTheme` is available. If ControlsDrawer doesn't already import it:

```jsx
import { configApi, MODEL_REGISTRY, MAIN_MODEL_IDS, useTheme } from 'exo-shared';
```

- [ ] **Step 2: Add theme and filtered presets**

After the component function signature (after line 21 or wherever props end), add:

```jsx
const { theme } = useTheme();

// Filter built-in presets by current theme
const filteredPresets = Object.entries(ALL_PRESETS)
  .filter(([, p]) => p.theme === theme)
  .map(([id, p]) => p);
```

- [ ] **Step 3: Replace BUILTIN.map with filteredPresets.map in the select**

At line 333, change:

```jsx
// OLD:
{BUILTIN.map(p => (

// NEW:
{filteredPresets.map(p => (
```

- [ ] **Step 4: Add handleUpdate function for in-place editing**

After the `handleDeleteCustom` function (after line 156), add:

```jsx
// Update current custom palette in-place
const handleUpdateCustom = () => {
  if (!isCustomSelected) return;
  const name = customName.trim() || currentPalette.label;
  const stops = computeStops(keyShadow, keyMid, keyHighlight);
  const updated = updateCustomPalette(paletteId, { label: name, colors: stops });
  if (updated) {
    setCustomPalettes(getCustomPalettes());
    setShowSaveInput(false);
    setCustomName('');
    // Force Aurora to re-render with updated colors
    onPaletteChange && onPaletteChange(paletteId);
  }
};
```

- [ ] **Step 5: Modify the save controls section to show Update + Save As New**

Replace the save controls block (lines 407–447) with:

```jsx
  {/* Save / Update controls */}
  {isDirty && (
    <div className="flex items-center gap-1.5 animate-fade-in">
      {showSaveInput ? (
        <>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (isCustomSelected) handleUpdateCustom();
                else handleSaveCustom();
              }
              if (e.key === 'Escape') { setShowSaveInput(false); setCustomName(''); }
            }}
            placeholder={isCustomSelected ? (currentPalette?.label || 'name...') : 'name...'}
            autoFocus
            maxLength={24}
            className="w-20 bg-exo-bg border border-exo-mist-10 rounded-[2px] px-1.5 py-0.5 text-[0.625rem] tx-system-normal outline-none focus:border-exo-accent/50"
            style={{ fontFamily: 'var(--font-code)' }}
          />
          {/* Update button — only for custom palettes */}
          {isCustomSelected && (
            <button
              onClick={handleUpdateCustom}
              className="p-0.5 text-amber-400/60 hover:text-amber-400 transition-colors"
              title="Update this palette"
            >
              <Check size={12} />
            </button>
          )}
          {/* Save-as-new button */}
          <button
            onClick={handleSaveCustom}
            disabled={!customName.trim() || customCount >= MAX_CUSTOM}
            className="p-0.5 text-green-400/60 hover:text-green-400 disabled:opacity-20 transition-colors"
            title="Save as new palette"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => { setShowSaveInput(false); setCustomName(''); }}
            className="p-0.5 tx-system-mute opacity-40 hover:tx-system-normal transition-colors"
          >
            <X size={11} />
          </button>
        </>
      ) : (
        <div className="flex items-center gap-1.5">
          {/* Update button (compact, for custom palettes) */}
          {isCustomSelected && (
            <button
              onClick={() => setShowSaveInput(true)}
              className="text-[0.5625rem] text-amber-400/60 hover:text-amber-400 transition-colors"
              title="Update this palette"
            >
              Update
            </button>
          )}
          {/* Save-as-new button */}
          <button
            onClick={() => setShowSaveInput(true)}
            disabled={customCount >= MAX_CUSTOM}
            className="text-[0.5625rem] tx-system-accent opacity-60 hover:tx-system-accent disabled:opacity-20 transition-colors"
            title={customCount >= MAX_CUSTOM ? `Max ${MAX_CUSTOM} custom palettes` : 'Save as custom palette'}
          >
            {customCount >= MAX_CUSTOM ? `[${MAX_CUSTOM}/${MAX_CUSTOM}]` : '+ Save'}
          </button>
        </div>
      )}
    </div>
  )}
```

Also remove the old `isDirty && !isCustomSelected` "modified" label (lines 353-355) since it's now redundant:

```jsx
{/* DELETE this block (lines 353-355):
{isDirty && !isCustomSelected && (
  <span className="text-[0.5625rem] tx-system-accent opacity-50 animate-fade-in" style={{ fontFamily: 'var(--font-code)' }}>modified</span>
)}
*/}
```

- [ ] **Step 6: Verify the delete button still works correctly**

The delete button (lines 344-352) should remain unchanged. When a custom palette is deleted while active, it already falls back to `DEFAULT_PALETTE_ID`. Verify that `DEFAULT_PALETTE_ID` ('burning-sunset') is always compatible with dark theme. Since the user may be in light mode when deleting, add a guard:

In `handleDeleteCustom` (line 149), update the fallback:

```jsx
const handleDeleteCustom = (id) => {
  deleteCustomPalette(id);
  setCustomPalettes(getCustomPalettes());
  if (paletteId === id && onPaletteChange) {
    // Fall back to theme-appropriate default instead of hardcoded DEFAULT_PALETTE_ID
    const fallback = theme === 'light' ? 'morning-mist' : 'burning-sunset';
    onPaletteChange(fallback);
  }
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/chat-core/src/components/chat/ControlsDrawer.jsx
git commit -m "feat(aurora): theme-filtered presets + in-place update for custom palettes in ControlsDrawer"
```

---

## Verification

Run the app and verify end-to-end:

```bash
cd ExoCore-Desktop
pnpm dev:chat
```

1. **深色模式回归**: 打开 http://localhost:5173 → 确认 Burning Sunset 正常显示，动画流畅，vignette 边缘渐暗正确
2. **浅色 Aurora**: Settings → Appearance → Light → Aurora 自动切换为晨光金雾，飘带暖金色在暖白背景柔和可见
3. **浅色预设切换**: ControlsDrawer → Palette 下拉 → 选择春露/桃云 → Aurora 立即切换
4. **自动跟随**: 在 Settings 中反复切换 Dark/Light → Aurora 始终同步切换
5. **ControlsDrawer 过滤**: 深色模式下拉显示 3 个深色预设，浅色模式显示 3 个浅色预设 + 自定义
6. **自定义编辑 — 更新**: 选自定义调色板 → 修改关键点颜色 → 点击 "Update" → 原地保存，ID 不变
7. **自定义编辑 — 另存为**: 修改后输入新名称 → 点击 Save → 创建新调色板，原调色板保留
8. **内置不可编辑**: 选内置预设 → 修改颜色 → 只显示 "+ Save" 按钮，无 "Update"
9. **跨主题兼容**: 深色下选 Deep Ocean → 切到浅色 → Aurora 回退 morning-mist → 切回深色 → 恢复 Deep Ocean
10. **GroupchatRoom**: 打开群聊 → 确认背景显示当前主题默认的环境光晕，无动画

