# Cinder Homepage — Implementation Handoff

**Date:** 2026-06-15
**Status:** ✅ L0 navigation + L1 Dashboard complete
**Reference mockup:** `.superpowers/brainstorm/mockups/cinder-homepage-v3.html` (v4 by Gemini)

## What was done

Implemented the Cinder/Ember visual redesign for chat-core's navigation framework (L0) and homepage Dashboard (L1):

- **Tailwind config** with `cinder-*` color tokens backed by CSS custom properties
- **CSS foundation**: fonts (LXGW WenKai), global base (scrollbar, selection, body, aura), shared transitions (fadeUp, fadeIn, breathe, slideUp)
- **DesktopSidebar** rewritten: 64px glass panel, vertical-rl text nav (项目/代理/群组), flame-colored active indicator, SVG hexagon logo, user avatar at bottom
- **MobileBottomBar** rewritten: fixed-bottom 60px glass bar, 5 geometric SVG icons only (no text), safe-area-inset-bottom support, user entry moved to Settings
- **Dashboard** rewritten: hero section with welcome + search (fading hairline), session threads (text rows with dot indicators), navigation matrix (3-column tarot-style chip grid with occult geometric SVGs)
- **AppLayout** updated: content-col wrapper, `100dvh` height, scrollable main area

## Files changed

| File | Action |
|------|--------|
| `packages/chat-core/tailwind.config.js` | **Created** — Cinder color tokens |
| `packages/chat-core/postcss.config.js` | **Created** — standard PostCSS |
| `packages/shared/src/styles/fonts.css` | **Rewritten** — LXGW WenKai font stack |
| `packages/shared/src/styles/base.css` | **Rewritten** — scrollbar, body, aura |
| `packages/shared/src/styles/transitions.css` | **Rewritten** — fadeUp, fadeIn, breathe |
| `packages/chat-core/src/index.css` | **Rewritten** — imports + Tailwind + Cinder vars |
| `packages/chat-core/index.html` | **Edited** — Google Fonts, theme-color, viewport |
| `packages/chat-core/src/App.jsx` | **Edited** — AppLayout structure |
| `packages/chat-core/src/components/layout/DesktopSidebar.jsx` | **Rewritten** |
| `packages/chat-core/src/components/layout/MobileBottomBar.jsx` | **Rewritten** |
| `packages/chat-core/src/views/Dashboard.jsx` | **Rewritten** |

## Conventions established

### Color tokens
All in `:root` as `--cinder-*` CSS variables, also mapped in Tailwind `cinder-*`:
- `base` (#050505), `ember` (#c44d00), `ember-dim` (#885332), `flame` (#ff4a08), `flame-dim` (rgb)
- `glass` (rgba 255,255,255,0.01), `line` (rgba 139,0,0,0.25), `line-glow` (rgba 255,51,51,0.2)
- `text` (#cecdd6), `text-dim` (rgb), `text-faint` (rgb)

### SVG style
- Geometric/occult line art — nested polygons, dashed circles, crosshair lines
- `stroke-width: 0.5–0.8`, no fills (or `fillOpacity: 0.05`), `stroke="currentColor"`
- ViewBox 24×24, rendered at 22–44px

### Glass pattern
- `background: var(--cinder-glass)` + `backdrop-filter: blur(24px)` + `-webkit-backdrop-filter`
- Sidebar: `box-shadow: 2px 0 24px rgba(0,0,0,0.4)`
- Mobile bar: `background: rgba(15, 9, 9, 0.6)` (more opaque for readability)

### Typography
- Font: `'LXGW WenKai', 'Noto Serif SC', 'Georgia', serif` — loaded via Google Fonts
- Body: `font-weight: 300` (light)
- Section labels: `font-size: 10px`, `letter-spacing: 0.3em`
- Nav: `writing-mode: vertical-rl`, `font-size: 11px`, `letter-spacing: 0.3em`

### Navigation rules (revised)
- L0 bottom nav: visible on ALL pages (L1, L2, L3) — no hiding
- Mobile: user entry integrated into Settings, not in bottom bar
- Desktop sidebar: user avatar at bottom of sidebar

## Next: Project & Agent L1/L2

### Project Hall (L1: `/projects`)
Per `Plan/分页细节需求.md`:
- Wide horizontal glass cards for projects (错落排版)
- "Wandering Threads" unassigned sessions below a hairline separator
- `+` new project button (glass circle)
- Bottom nav visible

### Project Profile (L2: `/project/:id`)
- Back button `< 项目`
- System Prompt "crystal" panel (editable, glass)
- File list (horizontal scroll chips)
- Working directory display
- Session threads (text rows)
- Top-right: `+目录`, `+文件`, `+会话` compact buttons

### Agent Hub (L1: `/agent-hub`)
- G045 "The Prime" — special section with breathing aura, locked badge
- Superiors — 2-column glass cards with memory ribbon
- Standards — compact glass chips
- `+` new agent button

### Agent Profile (L2: `/agent/:presetId`)
- Header banner with model-colored glass background
- Avatar + editable name/bios
- Model selector pill
- System Instruction crystal
- Danger zone (except G045) — `Erase Entity` red hairline button
- Session threads

### Chat Area (L3: `/chat/:sessionId`)
- Desktop: side panel or modal within Project/Agent context
- Mobile: bottom-sheet overlay with ↓ close button (left of status indicator)
- Bezel-less tube input with ember underline
