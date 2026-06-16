/**
 * ⚠️ SYNC ALERT ⚠️
 * 如果你修改了 FONT_STACKS / localStorage key / DEFAULT_FONT / DEFAULT_SCALE，必须同步更新:
 *   packages/chat-core/index.html    (内联 <script> 中的字体初始化代码)
 *   packages/chronicle/index.html    (内联 <script> 中的字体初始化代码)
 * 两边的 STACKS、DEFAULT、key 常量必须完全一致，否则字体闪烁 FOUC 会回来。
 */

import { useState, useEffect, useCallback } from 'react';

const FONT_SYSTEM_KEY = 'exo_font_system';
const FONT_MESSAGE_KEY = 'exo_font_message';
const FONT_LEGACY_KEY = 'exo_font_preference';
const FONT_SCALE_KEY = 'exo_font_scale';
const DEFAULT_FONT = 'sarasa';
const DEFAULT_SCALE = 1.0;

// Font stack definitions
// KEEP IN SYNC with the inline <script> in: packages/chat-core/index.html
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

export const FONT_SCALE_OPTIONS = [
  { value: 1.0,  label: '标准',  shortLabel: 'M'  },
  { value: 1.15, label: '中等',  shortLabel: 'L'  },
  { value: 1.30, label: '大',   shortLabel: 'XL' },
  { value: 1.50, label: '特大', shortLabel: '2XL' },
];

// Fixed font stacks (not user-configurable)
const FONT_NAV  = "'LXGW WenKai', 'Sarasa Gothic Mono', 'Segoe UI', sans-serif";
const FONT_CODE = "'Maple Mono', 'Consolas', 'Cascadia Code', monospace";

function getStoredFont(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function applyFontVariables(systemFont, messageFont) {
  const root = document.documentElement;
  const systemStack = FONT_STACKS[systemFont] || FONT_STACKS[DEFAULT_FONT];
  const messageStack = FONT_STACKS[messageFont] || FONT_STACKS[DEFAULT_FONT];

  root.style.setProperty('--font-system', systemStack);
  root.style.setProperty('--font-message', messageStack);
  // Backward compat: --font-body mirrors --font-system
  root.style.setProperty('--font-body', systemStack);
  root.style.setProperty('--font-nav', FONT_NAV);
  root.style.setProperty('--font-code', FONT_CODE);
}

function applyFontScale(scale) {
  document.documentElement.style.setProperty('--exo-font-scale', String(scale));
}

export function useFont() {
  // Migrate legacy preference on first load
  const legacyFont = (() => {
    try {
      return localStorage.getItem(FONT_LEGACY_KEY);
    } catch { return null; }
  })();

  if (legacyFont) {
    try {
      localStorage.setItem(FONT_SYSTEM_KEY, legacyFont);
      localStorage.setItem(FONT_MESSAGE_KEY, legacyFont);
      localStorage.removeItem(FONT_LEGACY_KEY);
    } catch { /* storage unavailable */ }
  }

  const [systemFont, setSystemFontState] = useState(
    () => getStoredFont(FONT_SYSTEM_KEY, DEFAULT_FONT)
  );
  const [messageFont, setMessageFontState] = useState(
    () => getStoredFont(FONT_MESSAGE_KEY, DEFAULT_FONT)
  );

  const [fontScale, setFontScaleState] = useState(
    () => {
      try { return parseFloat(localStorage.getItem(FONT_SCALE_KEY)) || DEFAULT_SCALE; }
      catch { return DEFAULT_SCALE; }
    }
  );

  // Apply CSS variables on mount and on change
  useEffect(() => {
    applyFontVariables(systemFont, messageFont);
  }, [systemFont, messageFont]);

  // Apply font scale on mount and on change
  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  // Listen for cross-tab changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === FONT_SYSTEM_KEY) {
        setSystemFontState(getStoredFont(FONT_SYSTEM_KEY, DEFAULT_FONT));
      }
      if (e.key === FONT_MESSAGE_KEY) {
        setMessageFontState(getStoredFont(FONT_MESSAGE_KEY, DEFAULT_FONT));
      }
      if (e.key === FONT_SCALE_KEY) {
        setFontScaleState(parseFloat(e.newValue) || DEFAULT_SCALE);
      }
      if (e.key === FONT_LEGACY_KEY) {
        const legacy = getStoredFont(FONT_LEGACY_KEY, null);
        if (legacy) {
          localStorage.setItem(FONT_SYSTEM_KEY, legacy);
          localStorage.setItem(FONT_MESSAGE_KEY, legacy);
          localStorage.removeItem(FONT_LEGACY_KEY);
          setSystemFontState(legacy);
          setMessageFontState(legacy);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setSystemFont = useCallback((font) => {
    try { localStorage.setItem(FONT_SYSTEM_KEY, font); } catch {}
    setSystemFontState(font);
  }, []);

  const setMessageFont = useCallback((font) => {
    try { localStorage.setItem(FONT_MESSAGE_KEY, font); } catch {}
    setMessageFontState(font);
  }, []);

  const setFontScale = useCallback((scale) => {
    const clamped = Math.max(0.5, Math.min(2.0, scale));
    try { localStorage.setItem(FONT_SCALE_KEY, String(clamped)); } catch {}
    setFontScaleState(clamped);
  }, []);

  return {
    systemFont,
    messageFont,
    fontScale,
    setSystemFont,
    setMessageFont,
    setFontScale,
    availableFonts: AVAILABLE_FONTS,
    availableScales: FONT_SCALE_OPTIONS,
  };
}
