# SVG & Mermaid Code Block Rendering

**Date:** 2026-06-04
**Scope:** chat-core — MessageBubble CodeBlock component
**Dependency:** `mermaid` npm package

## Goal

When AI generates code blocks tagged `svg` or `mermaid`, render the visual output instead of (or alongside) raw source code.

## Design Decision

**Option B — Preview/Code tab toggle.** Default shows rendered preview. Clicking "Code" tab shows raw source. Copy button stays at top-right in both modes (always copies source).

## Scope

- **In:** `svg`, `mermaid` language tags
- **Out:** `dot`/`graphviz`, `plantuml`, `vega-lite` (deferred)

## Implementation

### Files Changed

- `packages/chat-core/src/components/chat/MessageBubble.jsx` — modify `CodeBlock`, add `SvgPreview` and `MermaidPreview`
- Add `mermaid` dependency to `packages/chat-core/package.json`

### Architecture

```
CodeBlock (modified)
 ├─ Tab bar: [Preview | Code] + Copy button
 ├─ Preview mode:
 │   ├─ SvgPreview   (when lang === 'svg')
 │   └─ MermaidPreview (when lang === 'mermaid')
 └─ Code mode:
     └─ Existing <pre> source view
```

### SVG Rendering

- Parse with `DOMParser`, extract `<svg>` element
- Set `width="100%"`, `max-height: 60vh` for responsive fit
- Render in a white-background container (`bg-white/90 rounded-[4px]`) for visibility on dark chat bg
- Sanitize: strip `<script>`, event handlers (`onclick`, `onerror`, etc.)
- Zero npm dependencies

### Mermaid Rendering

- `mermaid.render()` → SVG string
- Theme: `base` (dark-background compatible)
- Fallback to source view + inline error on render failure
- One-time init: `mermaid.initialize()` on first render

### Safety

- SVG: DOM parse → allowlist tag/attribute filter, no inline scripts
- Mermaid: library handles sanitize internally

### State

- Each CodeBlock independently tracks `activeTab: 'preview' | 'code'`
- No cross-message state needed

## Dependencies

```bash
pnpm add mermaid --filter chat-core
```
