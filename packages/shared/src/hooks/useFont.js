/**
 * ⚠️ SYNC ALERT ⚠️
 * 如果你修改了 FONT_STACKS / localStorage key / DEFAULT_FONT，必须同步更新:
 *   packages/chat-core/index.html    (内联 <script> 中的字体初始化代码)
 *   packages/chronicle/index.html    (内联 <script> 中的字体初始化代码)
 * 两边的 STACKS、DEFAULT、key 常量必须完全一致，否则字体闪烁 FOUC 会回来。
 */

import { useState, useEffect, useCallback } from 'react';

const FONT_SYSTEM_KEY = 'exo_font_system';
const FONT_MESSAGE_KEY = 'exo_font_message';
const FONT_LEGACY_KEY = 'exo_font_preference';
const DEFAULT_FONT = 'sarasa';

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

  // Apply CSS variables on mount and on change
  useEffect(() => {
    applyFontVariables(systemFont, messageFont);
  }, [systemFont, messageFont]);

  // Listen for cross-tab changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === FONT_SYSTEM_KEY) {
        setSystemFontState(getStoredFont(FONT_SYSTEM_KEY, DEFAULT_FONT));
      }
      if (e.key === FONT_MESSAGE_KEY) {
        setMessageFontState(getStoredFont(FONT_MESSAGE_KEY, DEFAULT_FONT));
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

  return {
    systemFont,
    messageFont,
    setSystemFont,
    setMessageFont,
    availableFonts: AVAILABLE_FONTS,
  };
}
