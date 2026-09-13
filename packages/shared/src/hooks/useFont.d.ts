export function getFontStack(fontKey: string): string;

export interface FontOption {
  value: string;
  label: string;
  preview: string;
}

export const AVAILABLE_FONTS: FontOption[];

export interface FontScaleConfig {
  min: number;
  max: number;
  step: number;
  default: number;
  presets: number[];
}

export const FONT_SCALE_CONFIG: FontScaleConfig;

export interface FontState {
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

export function useFont(): FontState;
