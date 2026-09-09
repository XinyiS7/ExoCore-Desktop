/**
 * V4 Aura palette engine (Plan Task 4 / D3, §6.7).
 *
 * Ports ONLY the verified OKLCH interpolation and palette data needed by V4
 * (source: V3 `packages/chat-core/src/components/chat/palettes.js`). The
 * nine-ribbon Canvas/CSS factory is NOT ported; V4 renders at most three
 * gradient layers driven by the three key colors below.
 *
 * Storage: typed validation, custom cap of 3, corrupt storage falls back to
 * the theme default without crashing; theme change selects the light/dark
 * built-in default.
 */
import type { PrefWriteOutcome } from '../control/prefs';

// ── OKLCH math (verified port of the V3 engine) ─────────────────────────────

export interface OklchColor {
  L: number;
  C: number;
  H: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RgbColor | null {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function rgbToOklch(r: number, g: number, b: number): OklchColor {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const L = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const M = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const S = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const lp = Math.cbrt(L);
  const mp = Math.cbrt(M);
  const sp = Math.cbrt(S);
  const ol = 0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp;
  const oa = 1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp;
  const ob = 0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp;
  const C = Math.sqrt(oa * oa + ob * ob);
  let H = Math.atan2(ob, oa) * (180 / Math.PI);
  if (H < 0) H += 360;
  return { L: ol, C, H };
}

export function oklchToHex(L: number, C: number, H: number): string {
  const hRad = H * (Math.PI / 180);
  const oa = C * Math.cos(hRad);
  const ob = C * Math.sin(hRad);
  const lp = L + 0.3963377774 * oa + 0.2158037573 * ob;
  const mp = L - 0.1055613458 * oa - 0.0638541728 * ob;
  const sp = L - 0.0894841775 * oa - 1.291485548 * ob;
  const Lm = lp * lp * lp;
  const Mm = mp * mp * mp;
  const Sm = sp * sp * sp;
  const lr = 4.0767416621 * Lm - 3.3077115913 * Mm + 0.2309699292 * Sm;
  const lg = -1.2684380046 * Lm + 2.6097574011 * Mm - 0.3413193965 * Sm;
  const lb = -0.0041960863 * Lm - 0.7034186147 * Mm + 1.707614701 * Sm;
  const r = clamp01(linearToSrgb(lr));
  const g = clamp01(linearToSrgb(lg));
  const b = clamp01(linearToSrgb(lb));
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function oklchLerp(a: OklchColor, b: OklchColor, t: number): OklchColor {
  let dH = b.H - a.H;
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;
  return {
    L: a.L + (b.L - a.L) * t,
    C: a.C + (b.C - a.C) * t,
    H: a.H + dH * t,
  };
}

/**
 * 3-keypoint → 8-stop palette (verified V3 algorithm). V4 uses the three
 * key colors for its ≤3 gradient layers; the full stop set is retained so
 * palette data stays source-faithful and previews remain identical to V3.
 */
export interface PaletteStops {
  '--obsidian': string;
  '--garnet-600': string;
  '--oxblood-400': string;
  '--oxblood-500': string;
  '--rusty-500': string;
  '--rusty-600': string;
  '--orange-400': string;
  '--orange-500': string;
}

export function computeStops(keyShadow: string, keyMid: string, keyHighlight: string): PaletteStops | null {
  const k0 = hexToRgb(keyShadow);
  const k1 = hexToRgb(keyMid);
  const k2 = hexToRgb(keyHighlight);
  if (!k0 || !k1 || !k2) return null;
  const c0 = rgbToOklch(k0.r, k0.g, k0.b);
  const c1 = rgbToOklch(k1.r, k1.g, k1.b);
  const c2 = rgbToOklch(k2.r, k2.g, k2.b);
  const names = [
    '--obsidian',
    '--garnet-600',
    '--oxblood-400',
    '--oxblood-500',
    '--rusty-500',
    '--rusty-600',
    '--orange-400',
    '--orange-500',
  ] as const;
  const stops = {} as PaletteStops;
  for (let i = 0; i < 8; i++) {
    let lerp: OklchColor;
    if (i <= 3) {
      lerp = oklchLerp(c0, c1, i / 3);
    } else {
      lerp = oklchLerp(c1, c2, (i - 3) / 4);
    }
    stops[names[i]] = oklchToHex(lerp.L, lerp.C, lerp.H);
  }
  return stops;
}

// ── Palette model ────────────────────────────────────────────────────────────

export interface AuraKeypoints {
  /** Deep shadow color (layer base). */
  keyShadow: string;
  /** Mid-glow color (layer 2). */
  keyMid: string;
  /** Highlight color (layer 3). */
  keyHighlight: string;
}

export interface AuraPalette {
  id: string;
  label: string;
  theme: 'dark' | 'light';
  builtin: boolean;
  keypoints: AuraKeypoints;
}

export const DEFAULT_DARK_PALETTE_ID = 'burning-sunset';
export const DEFAULT_LIGHT_PALETTE_ID = 'morning-mist';

const ru = (id: string, label: string, theme: 'dark' | 'light', keypoints: AuraKeypoints): AuraPalette => ({
  id,
  label,
  theme,
  builtin: true,
  keypoints,
});

export const BUILTIN_PALETTES: AuraPalette[] = [
  ru('burning-sunset', 'Burning Sunset', 'dark', {
    keyShadow: '#0a0200',
    keyMid: '#941b0c',
    keyHighlight: '#f8bf74',
  }),
  ru('deep-ocean', 'Deep Ocean', 'dark', {
    keyShadow: '#000a14',
    keyMid: '#084d80',
    keyHighlight: '#7cc8f4',
  }),
  ru('void-amethyst', 'Void Amethyst', 'dark', {
    keyShadow: '#05000a',
    keyMid: '#5c2080',
    keyHighlight: '#d4a0f0',
  }),
  ru('morning-mist', '晨光金雾', 'light', {
    keyShadow: '#fef9f0',
    keyMid: '#f0c78e',
    keyHighlight: '#fbe5c0',
  }),
  ru('spring-dew', '春露', 'light', {
    keyShadow: '#f8faf6',
    keyMid: '#c5daaa',
    keyHighlight: '#eaf2de',
  }),
  ru('peach-cloud', '桃云', 'light', {
    keyShadow: '#fef8f5',
    keyMid: '#f4c4b4',
    keyHighlight: '#fceae2',
  }),
];

export function themeDefaultPaletteId(theme: 'dark' | 'light'): string {
  return theme === 'light' ? DEFAULT_LIGHT_PALETTE_ID : DEFAULT_DARK_PALETTE_ID;
}

const isHexColor = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

function isPalette(value: unknown): value is AuraPalette {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id !== '' &&
    typeof row.label === 'string' &&
    (row.theme === 'dark' || row.theme === 'light') &&
    row.builtin === false &&
    typeof row.keypoints === 'object' &&
    row.keypoints !== null &&
    isHexColor((row.keypoints as Record<string, unknown>).keyShadow) &&
    isHexColor((row.keypoints as Record<string, unknown>).keyMid) &&
    isHexColor((row.keypoints as Record<string, unknown>).keyHighlight)
  );
}

export const MAX_CUSTOM_PALETTES = 3;

const CUSTOM_KEY = 'exo:v4:aura:custom-palettes';

// ── Typed custom palette storage (global, cap 3) ─────────────────────────────

/** Read custom palettes; corrupt storage yields [] and is quarantined. */
export function readCustomPalettes(): AuraPalette[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CUSTOM_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(CUSTOM_KEY);
      return [];
    }
    const valid = parsed.filter(isPalette);
    if (valid.length !== parsed.length) {
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(valid));
    }
    return valid.slice(0, MAX_CUSTOM_PALETTES);
  } catch {
    try {
      window.localStorage.removeItem(CUSTOM_KEY);
    } catch {
      /* quarantine failure — harmless */
    }
    return [];
  }
}

function writeCustomPalettes(list: AuraPalette[]): PrefWriteOutcome {
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    return { state: 'persisted' };
  } catch (err) {
    return { state: 'unavailable', reason: `无法保存自定义色板（${String(err)}）` };
  }
}

export type CustomPaletteMutation =
  | { ok: true; palette: AuraPalette }
  | { ok: false; reason: 'capacity_reached' | 'invalid_keypoints' }
  | { ok: false; reason: 'storage_unavailable'; message: string };

/** Save a new custom palette. Capacity is capped at 3 (Plan §6.7). */
export function saveCustomPalette(
  label: string,
  keypoints: AuraKeypoints,
  theme: 'dark' | 'light',
): CustomPaletteMutation {
  if (!isHexColor(keypoints.keyShadow) || !isHexColor(keypoints.keyMid) || !isHexColor(keypoints.keyHighlight)) {
    return { ok: false, reason: 'invalid_keypoints' };
  }
  const list = readCustomPalettes();
  if (list.length >= MAX_CUSTOM_PALETTES) {
    return { ok: false, reason: 'capacity_reached' };
  }
  const palette: AuraPalette = {
    id: `custom-${Date.now()}`,
    label: label.trim() || '自定义',
    theme,
    builtin: false,
    keypoints,
  };
  const outcome = writeCustomPalettes([...list, palette]);
  if (outcome.state === 'unavailable') {
    return { ok: false, reason: 'storage_unavailable', message: outcome.reason };
  }
  return { ok: true, palette };
}

/** Delete a custom palette; selecting a deleted id later falls back. */
export function deleteCustomPalette(id: string): PrefWriteOutcome {
  const list = readCustomPalettes().filter((p) => p.id !== id);
  return writeCustomPalettes(list);
}

/** Update label or keypoints of a custom palette in place. */
export function updateCustomPalette(
  id: string,
  updates: Partial<Pick<AuraPalette, 'label'> & { keypoints: AuraKeypoints }>,
): { ok: true; palette: AuraPalette } | { ok: false; reason: 'not_found' | 'invalid_keypoints' | 'storage_unavailable' } {
  const list = readCustomPalettes();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if (updates.keypoints !== undefined) {
    const kp = updates.keypoints;
    if (!isHexColor(kp.keyShadow) || !isHexColor(kp.keyMid) || !isHexColor(kp.keyHighlight)) {
      return { ok: false, reason: 'invalid_keypoints' };
    }
    list[idx] = { ...list[idx], keypoints: kp };
  }
  if (updates.label !== undefined) {
    list[idx] = { ...list[idx], label: updates.label.trim() || list[idx].label };
  }
  const outcome = writeCustomPalettes(list);
  if (outcome.state === 'unavailable') {
    return { ok: false, reason: 'storage_unavailable' };
  }
  return { ok: true, palette: list[idx] };
}

export function getAllPalettes(): AuraPalette[] {
  return [...BUILTIN_PALETTES, ...readCustomPalettes()];
}

/**
 * Resolve a palette id with deterministic fallback:
 * unknown/corrupt id → theme default; missing id → theme default.
 */
export function resolvePalette(id: string | null | undefined, theme: 'dark' | 'light'): AuraPalette {
  const fallbackId = themeDefaultPaletteId(theme);
  if (!id) {
    return BUILTIN_PALETTES.find((p) => p.id === fallbackId) ?? BUILTIN_PALETTES[0];
  }
  const direct = BUILTIN_PALETTES.find((p) => p.id === id);
  if (direct) return direct;
  const custom = readCustomPalettes().find((p) => p.id === id);
  if (custom) return custom;
  return BUILTIN_PALETTES.find((p) => p.id === fallbackId) ?? BUILTIN_PALETTES[0];
}

/** The 3-layer colors actually rendered by AuraStage (shadow/mid/highlight). */
export function auraLayerColors(palette: AuraPalette): [string, string, string] {
  return [palette.keypoints.keyShadow, palette.keypoints.keyMid, palette.keypoints.keyHighlight];
}

/** Full 8-stop map for preview swatches (identical math to V3). */
export function paletteStopsFor(palette: AuraPalette): PaletteStops | null {
  return computeStops(
    palette.keypoints.keyShadow,
    palette.keypoints.keyMid,
    palette.keypoints.keyHighlight,
  );
}