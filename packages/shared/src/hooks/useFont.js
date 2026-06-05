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
  try {
    return localStorage.getItem(FONT_KEY) || DEFAULT_FONT;
  } catch {
    return DEFAULT_FONT;
  }
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
    try {
      localStorage.setItem(FONT_KEY, font);
    } catch { /* storage unavailable */ }
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
