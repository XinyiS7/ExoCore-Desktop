import { createContext, useContext } from 'react';
import type { Theme } from 'exo-shared/hooks/useTheme';
import type { FontOption, FontScaleConfig } from 'exo-shared/hooks/useFont';

export interface AppearanceContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  systemFont: string;
  messageFont: string;
  codeFont: string;
  fontScale: number;
  setSystemFont: (font: string) => void;
  setMessageFont: (font: string) => void;
  setCodeFont: (font: string) => void;
  setFontScale: (scale: number) => void;
  availableFonts: FontOption[];
  scaleConfig: FontScaleConfig;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return ctx;
}
