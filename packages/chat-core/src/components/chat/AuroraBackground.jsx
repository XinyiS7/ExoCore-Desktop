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
    <div
      className={`aurora-stage${active ? ' aurora-active' : ''}`}
      style={cssVars}
    >
    <div className="aurora-goo">
      {/* Ribbon curtains — horizontal aurora bands */}
      <div className="aurora-ribbon aurora-r1" />
      <div className="aurora-ribbon aurora-r2" />
      <div className="aurora-ribbon aurora-r3" />
      <div className="aurora-ribbon aurora-r4" />
      <div className="aurora-ribbon aurora-r5" />
      <div className="aurora-ribbon aurora-r6" />

      {/* Depth blobs — ambient warmth */}
      <div className="aurora-ribbon aurora-blob-deep" />
      <div className="aurora-ribbon aurora-blob-warm" />
      <div className="aurora-ribbon aurora-blob-gold" />
    </div>
    <div className="aurora-grain" />
    <div className="aurora-vignette" />
  </div>
  );
};

export default AuroraBackground;
