/**
 * Theme hook — light/dark mode switching.
 *
 * localStorage key: exo_theme
 * Values: 'dark' | 'light'
 * Default: 'dark' (no migration needed — existing users stay on dark)
 *
 * KEEP IN SYNC with inline <script> in:
 *   packages/chat-core/index.html
 */

import { useState, useEffect, useCallback } from 'react';

const KEY = 'exo_theme';
const DEFAULT = 'dark';

export const THEMES = ['dark', 'light'];

function getStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' ? 'light' : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update <meta name="theme-color"> for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#faf8f5' : '#050505');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(getStored);

  // Apply on mount (in case inline script hasn't run yet)
  useEffect(() => {
    applyTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-tab sync
  useEffect(() => {
    const handler = (e) => {
      if (e.key === KEY) {
        const next = (e.newValue === 'light' ? 'light' : DEFAULT);
        applyTheme(next);
        setThemeState(next);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setTheme = useCallback((t) => {
    const v = t === 'light' ? 'light' : DEFAULT;
    try { localStorage.setItem(KEY, v); } catch {}
    applyTheme(v);
    setThemeState(v);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, THEMES };
}
