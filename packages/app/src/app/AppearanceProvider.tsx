import { useEffect, useMemo, type ReactNode } from 'react';
import { useTheme } from 'exo-shared/hooks/useTheme';
import { useFont } from 'exo-shared/hooks/useFont';
import { AppearanceContext, type AppearanceContextValue } from './appearanceContext';

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const themeState = useTheme();
  const fontState = useFont();

  // Keep <meta name="theme-color"> strictly in sync with V4 --v4-bg.
  // Overwrites V3 #050505 or #faf8f5 set by the shared hook to enforce V4 chrome:
  // dark -> #0a0a0c, light -> #f8f9fb.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', themeState.theme === 'light' ? '#f8f9fb' : '#0a0a0c');
    }
  }, [themeState.theme]);

  // Keep data-font-* attributes in sync on root document element
  useEffect(() => {
    document.documentElement.setAttribute('data-font-system', fontState.systemFont);
    document.documentElement.setAttribute('data-font-message', fontState.messageFont);
    document.documentElement.setAttribute('data-font-code', fontState.codeFont);
  }, [fontState.systemFont, fontState.messageFont, fontState.codeFont]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      theme: themeState.theme,
      setTheme: themeState.setTheme,
      toggleTheme: themeState.toggleTheme,
      systemFont: fontState.systemFont,
      messageFont: fontState.messageFont,
      codeFont: fontState.codeFont,
      fontScale: fontState.fontScale,
      setSystemFont: fontState.setSystemFont,
      setMessageFont: fontState.setMessageFont,
      setCodeFont: fontState.setCodeFont,
      setFontScale: fontState.setFontScale,
      availableFonts: fontState.availableFonts,
      scaleConfig: fontState.scaleConfig,
    }),
    [
      themeState.theme,
      themeState.setTheme,
      themeState.toggleTheme,
      fontState.systemFont,
      fontState.messageFont,
      fontState.codeFont,
      fontState.fontScale,
      fontState.setSystemFont,
      fontState.setMessageFont,
      fontState.setCodeFont,
      fontState.setFontScale,
      fontState.availableFonts,
      fontState.scaleConfig,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}
