/**
 * ⚠️ SYNC ALERT ⚠️
 * If you modify FONT_STACKS / localStorage keys / DEFAULTS, you MUST sync:
 *   packages/chat-core/index.html    (inline <script> font init)
 *   packages/chronicle/index.html    (inline <script> font init)
 *   packages/shared/src/styles/fonts.css  (CSS fallback variables)
 * All three must use identical STACKS, DEFAULTs, and keys, or FOUC returns.
 */

import { useState, useEffect, useCallback } from 'react';

// ── localStorage keys ──
const KEY_SYSTEM  = 'exo_font_system';
const KEY_MESSAGE = 'exo_font_message';
const KEY_CODE    = 'exo_font_code';
const KEY_SCALE   = 'exo_font_scale';
const KEY_LEGACY  = 'exo_font_preference';

// ── Defaults ──
const DEFAULT_SYSTEM  = 'sarasa';
const DEFAULT_MESSAGE = 'sarasa';
const DEFAULT_CODE    = 'maple';
const DEFAULT_SCALE   = 100; // percent (80–150)

// ── Font stacks ──
// KEEP IN SYNC with inline <script> in index.html files
const FONT_STACKS = {
  sarasa:  "'Sarasa Gothic Mono', 'LXGW WenKai', 'Maple Mono', monospace",
  wenkai:  "'LXGW WenKai', 'Sarasa Gothic Mono', 'Georgia', serif",
  maple:   "'Maple Mono', 'Sarasa Gothic Mono', 'Consolas', monospace",
};

// Get the actual CSS font stack for a font key
export function getFontStack(fontKey) {
  return FONT_STACKS[fontKey] || FONT_STACKS[DEFAULT_SYSTEM];
}

export const AVAILABLE_FONTS = [
  { value: 'sarasa', label: 'Sarasa Gothic Mono',  preview: '更纱等宽黑体 — 春江潮水连海平' },
  { value: 'wenkai', label: '霞鹜文楷 LXGW WenKai', preview: '霞鹜文楷 — 落霞与孤鹜齐飞' },
  { value: 'maple',  label: 'Maple Mono',           preview: 'Maple Mono — The quick brown fox' },
];

// ── Font scale config (percentage slider) ──
export const FONT_SCALE_CONFIG = {
  min: 80,
  max: 150,
  step: 5,
  default: 100,
  // Common presets shown as ticks/dots on the slider
  presets: [80, 90, 100, 110, 125, 150],
};

// ── Helpers ──
function getStored(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function getStoredScale() {
  try {
    const raw = localStorage.getItem(KEY_SCALE);
    if (raw == null) return DEFAULT_SCALE;
    const val = parseFloat(raw);
    if (Number.isNaN(val)) return DEFAULT_SCALE;
    // Migrate old decimal format (0.5–2.0) to percentage (80–150)
    if (val < 10) return Math.round(val * 100);
    return Math.round(val);
  } catch { return DEFAULT_SCALE; }
}

function resolveStack(fontKey) {
  return FONT_STACKS[fontKey] || FONT_STACKS[DEFAULT_SYSTEM];
}

function applyFontVariables(systemFont, messageFont, codeFont) {
  const root = document.documentElement;
  root.style.setProperty('--font-system',  resolveStack(systemFont));
  root.style.setProperty('--font-message', resolveStack(messageFont));
  root.style.setProperty('--font-code',    resolveStack(codeFont));
  // Backward compat: --font-body mirrors --font-system for Tailwind font-sans
  root.style.setProperty('--font-body',    resolveStack(systemFont));
}

function applyFontScale(scale) {
  // scale is percentage (80–150), stored as integer
  document.documentElement.style.setProperty('--exo-font-scale', String(scale / 100));
}

// ── Hook ──
export function useFont() {
  // One-time legacy migration
  const legacyFont = (() => {
    try { return localStorage.getItem(KEY_LEGACY); } catch { return null; }
  })();
  if (legacyFont) {
    try {
      localStorage.setItem(KEY_SYSTEM, legacyFont);
      localStorage.setItem(KEY_MESSAGE, legacyFont);
      localStorage.removeItem(KEY_LEGACY);
    } catch { /* storage unavailable */ }
  }

  const [systemFont, setSystemFontState] = useState(
    () => getStored(KEY_SYSTEM, DEFAULT_SYSTEM)
  );
  const [messageFont, setMessageFontState] = useState(
    () => getStored(KEY_MESSAGE, DEFAULT_MESSAGE)
  );
  const [codeFont, setCodeFontState] = useState(
    () => getStored(KEY_CODE, DEFAULT_CODE)
  );
  const [fontScale, setFontScaleState] = useState(getStoredScale);

  // Apply CSS variables on change
  useEffect(() => {
    applyFontVariables(systemFont, messageFont, codeFont);
  }, [systemFont, messageFont, codeFont]);

  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e) => {
      switch (e.key) {
        case KEY_SYSTEM:
          setSystemFontState(getStored(KEY_SYSTEM, DEFAULT_SYSTEM));
          break;
        case KEY_MESSAGE:
          setMessageFontState(getStored(KEY_MESSAGE, DEFAULT_MESSAGE));
          break;
        case KEY_CODE:
          setCodeFontState(getStored(KEY_CODE, DEFAULT_CODE));
          break;
        case KEY_SCALE:
          setFontScaleState(getStoredScale());
          break;
        case KEY_LEGACY: {
          const leg = getStored(KEY_LEGACY, null);
          if (leg) {
            localStorage.setItem(KEY_SYSTEM, leg);
            localStorage.setItem(KEY_MESSAGE, leg);
            localStorage.removeItem(KEY_LEGACY);
            setSystemFontState(leg);
            setMessageFontState(leg);
          }
          break;
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Apply on mount (in case inline script hasn't set them yet)
  useEffect(() => {
    applyFontVariables(systemFont, messageFont, codeFont);
    applyFontScale(fontScale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSystemFont = useCallback((font) => {
    try { localStorage.setItem(KEY_SYSTEM, font); } catch {}
    setSystemFontState(font);
  }, []);

  const setMessageFont = useCallback((font) => {
    try { localStorage.setItem(KEY_MESSAGE, font); } catch {}
    setMessageFontState(font);
  }, []);

  const setCodeFont = useCallback((font) => {
    try { localStorage.setItem(KEY_CODE, font); } catch {}
    setCodeFontState(font);
  }, []);

  const setFontScale = useCallback((scale) => {
    const clamped = Math.max(FONT_SCALE_CONFIG.min, Math.min(FONT_SCALE_CONFIG.max, Math.round(scale)));
    try { localStorage.setItem(KEY_SCALE, String(clamped)); } catch {}
    setFontScaleState(clamped);
  }, []);

  return {
    systemFont,
    messageFont,
    codeFont,
    fontScale,
    setSystemFont,
    setMessageFont,
    setCodeFont,
    setFontScale,
    availableFonts: AVAILABLE_FONTS,
    scaleConfig: FONT_SCALE_CONFIG,
  };
}
