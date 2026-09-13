export type Theme = 'dark' | 'light';

export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  THEMES: string[];
}

export const THEMES: string[];

export function useTheme(): ThemeState;
