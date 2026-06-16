# Sidebar Navigation Turns White on Hover

- **Date**: 2026-06-16
- **Status**: Resolved
- **Severity**: Recurring (3+ sessions)

## Phenomenon

Sidebar navigation icons and text briefly flash white or turn white when the mouse hovers over them. The effect is most visible on:
- The logo/Hexagon icon at the top
- Navigation text items (项目/代理/群组/设置)
- Any SVG icon with `stroke="currentColor"` inside a button with `transition-all`

## Root Cause (Chain)

### 1. `transition-all` on buttons (the primary trigger)
`transition-all` transitions ALL CSS properties, not just colors. This includes `filter`, `text-shadow`, `box-shadow`, `transform`, etc.

In `DesktopSidebar.jsx`, hover handlers change THREE properties simultaneously:
```js
onMouseEnter: {
  color: 'var(--cinder-flame)',     // orange
  filter: 'drop-shadow(0 0 8px rgba(255,74,8,0.6))',  // glow
  textShadow: '0 0 8px rgba(255,74,8,0.3)'             // text glow
}
onMouseLeave: {
  color: '',      // reset to default
  filter: '',     // reset filter → transitions from "glow" to "none"
  textShadow: ''  // reset shadow → transitions to "none"
}
```

The `filter` transition from `drop-shadow(...)` → `none` goes through intermediate filter values that the browser renders as brightness/white artifacts on the SVG paths.

### 2. SVG `stroke="currentColor"` inheritance (the amplifier)
Custom SVGs (LogoSvg) use `stroke="currentColor"`. When the parent button's `color` transitions, the SVG stroke color follows. Combined with a simultaneous `filter` transition, the SVG rendering pipeline produces unexpected bright intermediate frames.

### 3. Long transition durations (the magnifier)
Logo: `duration-500` (500ms). Nav items: `duration-300` (300ms). These long durations give the browser plenty of time to render visible white/artifact frames.

### 4. Lucide-react is NOT involved
Verified: Lucide ships zero CSS, uses `fill="none"` + `stroke="currentColor"` only, no hover styles. Tailwind preflight only sets `display: block` on SVGs. The white comes from the project's own CSS transitions interacting with SVG rendering.

## Fix Pattern

**Three rules for any button containing SVGs:**

1. **Use `transition-colors`, never `transition-all`.** `transition-colors` only animates: `color, background-color, border-color, text-decoration-color, fill, stroke`. It does NOT animate `filter`, `box-shadow`, `text-shadow`, or `transform` — eliminating the white-flash vector entirely.

2. **Keep hover duration ≤ 200ms.** Longer durations (300ms+) magnify any rendering artifacts.

3. **Only change `color` on hover.** Avoid changing `filter` or `text-shadow` in JS `onMouseEnter`/`onMouseLeave` handlers. If glow effects are needed, use CSS `:hover` with `transition-colors` and accept that the glow will snap on/off (non-animated). Or use `box-shadow` which IS covered by `transition-colors`... wait, no it isn't. Use `outline-color` or accept the snap.

### Before (broken):
```jsx
<button
  className="... transition-all duration-500"
  style={{ color: 'var(--cinder-ember-dim)', filter: 'drop-shadow(...)' }}
  onMouseEnter={e => {
    e.currentTarget.style.color = 'var(--cinder-flame)';
    e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(255,74,8,0.6))';
  }}
  onMouseLeave={e => {
    e.currentTarget.style.color = '';
    e.currentTarget.style.filter = '';
  }}
>
  <LogoSvg />
</button>
```

### After (fixed):
```jsx
<button
  className="... transition-colors duration-200"
  style={{ color: 'var(--cinder-ember-dim)' }}
  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cinder-flame)'; }}
  onMouseLeave={e => { e.currentTarget.style.color = ''; }}
>
  <LogoSvg />
</button>
```

## Checklist — When Touching Any Nav/Icon Button

- [ ] No `transition-all` on buttons containing SVGs
- [ ] No `filter` or `textShadow` changes in JS hover handlers
- [ ] Duration ≤ 200ms
- [ ] SVGs use `stroke="currentColor"` (standard) — verified no extra CSS interferes
- [ ] Test on both light and dark backgrounds
