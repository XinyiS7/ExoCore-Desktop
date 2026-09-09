/**
 * V4 Aura stage (Plan Task 4 / D3, §6.7).
 *
 * - exactly three composited gradient layers (no blur/filter animation);
 * - animation uses transform/opacity only and is more active only while the
 *   runtime is genuinely generating;
 * - `prefers-reduced-motion: reduce` renders a static field;
 * - decorative: aria-hidden, pointer-events none, no focusable descendants,
 *   never a scroll owner (sits behind the page scroll/composer).
 */
import { useMemo } from 'react';
import { auraLayerColors, resolvePalette, type AuraPalette } from './palettes';

export interface AuraStageProps {
  /** Palette id (conversation-local). null → theme default. */
  paletteId: string | null;
  theme: 'dark' | 'light';
  /** True while the chat runtime is generating (more active motion). */
  generating?: boolean;
}

export function AuraStage({ paletteId, theme, generating = false }: AuraStageProps) {
  const palette: AuraPalette = useMemo(() => resolvePalette(paletteId, theme), [paletteId, theme]);
  const [shadow, mid, highlight] = auraLayerColors(palette);

  return (
    <div
      className={`v4-aura${generating ? ' v4-aura--active' : ''}`}
      data-testid="v4-aura"
      aria-hidden="true"
      // Decorative only — never intercepts clicks or becomes a scroll owner.
      style={{
        pointerEvents: 'none',
        // Presentation-level inline colors; motion rules live in CSS so
        // reduced-motion and layer count stay deterministic.
        ['--aura-shadow' as string]: shadow,
        ['--aura-mid' as string]: mid,
        ['--aura-highlight' as string]: highlight,
      }}
    >
      <div className="v4-aura-layer v4-aura-layer--1" />
      <div className="v4-aura-layer v4-aura-layer--2" />
      <div className="v4-aura-layer v4-aura-layer--3" />
    </div>
  );
}