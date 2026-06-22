/**
 * Aurora background color engine.
 *
 * Built-in presets  — quick-select starting points.
 * Custom palettes   — user-created via 3-keypoint OKLCH interpolation,
 *                      max 3, stored globally in localStorage.
 *
 * Storage keys:
 *   localStorage `exo_custom_palettes`        → JSON array of custom palette objects
 *   localStorage `exo_session_theme_<sessId>` → active palette id (per-session)
 */

/* ────────────────────────────────────────────
   Built-in presets
   ──────────────────────────────────────────── */

/* ────────────────────────────────────────────
   Built-in presets — 3 dark + 3 light
   Each preset has a `theme` tag for filtering.
   ──────────────────────────────────────────── */

const DARK_PRESETS = {
  'burning-sunset': {
    id: 'burning-sunset',
    label: 'Burning Sunset',
    theme: 'dark',
    builtin: true,
    colors: {
      '--obsidian':   '#0a0200',
      '--garnet-600': '#ae290e',
      '--oxblood-400': '#751609',
      '--oxblood-500': '#941b0c',
      '--rusty-500':   '#bc3908',
      '--rusty-600':   '#ea4811',
      '--orange-400':  '#ed773f',
      '--orange-500':  '#f8bf74',
    },
  },
  'deep-ocean': {
    id: 'deep-ocean',
    label: 'Deep Ocean',
    theme: 'dark',
    builtin: true,
    colors: {
      '--obsidian':   '#000a14',
      '--garnet-600': '#0a3d6b',
      '--oxblood-400': '#062a4a',
      '--oxblood-500': '#084d80',
      '--rusty-500':   '#0b5fa0',
      '--rusty-600':   '#1a8ad4',
      '--orange-400':  '#3da5e8',
      '--orange-500':  '#7cc8f4',
    },
  },
  'void-amethyst': {
    id: 'void-amethyst',
    label: 'Void Amethyst',
    theme: 'dark',
    builtin: true,
    colors: {
      '--obsidian':   '#05000a',
      '--garnet-600': '#4a1d6b',
      '--oxblood-400': '#2d0f45',
      '--oxblood-500': '#5c2080',
      '--rusty-500':   '#7a2da0',
      '--rusty-600':   '#9b40c8',
      '--orange-400':  '#b86be0',
      '--orange-500':  '#d4a0f0',
    },
  },
};

const LIGHT_PRESETS = {
  'morning-mist': {
    id: 'morning-mist',
    label: '晨光金雾',
    theme: 'light',
    builtin: true,
    colors: {
      '--obsidian':   '#fef9f0',
      '--garnet-600': '#e8b86d',
      '--oxblood-400': '#f5d4a8',
      '--oxblood-500': '#f0c78e',
      '--rusty-500':   '#eeb86b',
      '--rusty-600':   '#f2a65a',
      '--orange-400':  '#f7d6a0',
      '--orange-500':  '#fbe5c0',
    },
  },
  'spring-dew': {
    id: 'spring-dew',
    label: '春露',
    theme: 'light',
    builtin: true,
    colors: {
      '--obsidian':   '#f8faf6',
      '--garnet-600': '#b8cc9e',
      '--oxblood-400': '#d4e4c4',
      '--oxblood-500': '#c5daaa',
      '--rusty-500':   '#a8c78a',
      '--rusty-600':   '#9bb878',
      '--orange-400':  '#dcecc8',
      '--orange-500':  '#eaf2de',
    },
  },
  'peach-cloud': {
    id: 'peach-cloud',
    label: '桃云',
    theme: 'light',
    builtin: true,
    colors: {
      '--obsidian':   '#fef8f5',
      '--garnet-600': '#f0b8a8',
      '--oxblood-400': '#f8d4c8',
      '--oxblood-500': '#f4c4b4',
      '--rusty-500':   '#eea890',
      '--rusty-600':   '#e8987c',
      '--orange-400':  '#fadcd0',
      '--orange-500':  '#fceae2',
    },
  },
};

const ALL_PRESETS = { ...DARK_PRESETS, ...LIGHT_PRESETS };

/* ────────────────────────────────────────────
   CSS variable → aurora layer mapping
   The 8 stops are indexed 0–7.
   keyShadow  → index 0  (--obsidian)
   keyMid     → index 3  (--oxblood-500)
   keyHighlight → index 7 (--orange-500)
   Positions 1-2 interpolate shadow→mid
   Positions 4-6 interpolate mid→highlight
   ──────────────────────────────────────────── */

export const STOP_NAMES = [
  '--obsidian',
  '--garnet-600',
  '--oxblood-400',
  '--oxblood-500',
  '--rusty-500',
  '--rusty-600',
  '--orange-400',
  '--orange-500',
];

/* ────────────────────────────────────────────
   OKLCH color-space conversion
   ──────────────────────────────────────────── */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const toHex = (v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** sRGB → linear (remove gamma) */
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear → sRGB (apply gamma) */
function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Linear RGB → OKLab → OKLCH { L, C, H } */
function rgbToOklch(r, g, b) {
  // sRGB → linear
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // Linear RGB → LMS
  const L = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const M = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const S = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // LMS → L'M'S' (cube root)
  const lp = Math.cbrt(L);
  const mp = Math.cbrt(M);
  const sp = Math.cbrt(S);

  // L'M'S' → OKLab
  const ol = 0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp;
  const oa = 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp;
  const ob = 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp;

  // OKLab → OKLCH
  const C = Math.sqrt(oa * oa + ob * ob);
  let H = Math.atan2(ob, oa) * (180 / Math.PI);
  if (H < 0) H += 360;

  return { L: ol, C, H };
}

/** OKLCH → OKLab → linear RGB → sRGB hex */
function oklchToHex(L, C, H) {
  // OKLCH → OKLab
  const hRad = H * (Math.PI / 180);
  const oa = C * Math.cos(hRad);
  const ob = C * Math.sin(hRad);

  // OKLab → L'M'S'
  const lp = L + 0.3963377774 * oa + 0.2158037573 * ob;
  const mp = L - 0.1055613458 * oa - 0.0638541728 * ob;
  const sp = L - 0.0894841775 * oa - 1.2914855480 * ob;

  // L'M'S' → LMS (cube)
  const Lm = lp * lp * lp;
  const Mm = mp * mp * mp;
  const Sm = sp * sp * sp;

  // LMS → linear RGB
  const lr =  4.0767416621 * Lm - 3.3077115913 * Mm + 0.2309699292 * Sm;
  const lg = -1.2684380046 * Lm + 2.6097574011 * Mm - 0.3413193965 * Sm;
  const lb = -0.0041960863 * Lm - 0.7034186147 * Mm + 1.7076147010 * Sm;

  // linear → sRGB
  return rgbToHex(linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb));
}

/** Interpolate between two OKLCH colors (shortest H path) */
function oklchLerp(a, b, t) {
  let dH = b.H - a.H;
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;
  return {
    L: a.L + (b.L - a.L) * t,
    C: a.C + (b.C - a.C) * t,
    H: a.H + dH * t,
  };
}

/* ────────────────────────────────────────────
   3-keypoint → 8-stop palette
   ──────────────────────────────────────────── */

/**
 * Compute 8 aurora color stops from 3 user-picked key colors.
 *
 * @param {string} keyShadow    hex color for deepest shadow (→ --obsidian)
 * @param {string} keyMid       hex color for mid-glow     (→ --oxblood-500)
 * @param {string} keyHighlight hex color for brightest    (→ --orange-500)
 * @returns {object} map of CSS variable names → hex values
 */
export function computeStops(keyShadow, keyMid, keyHighlight) {
  const k0 = rgbToOklch(...Object.values(hexToRgb(keyShadow)));
  const k1 = rgbToOklch(...Object.values(hexToRgb(keyMid)));
  const k2 = rgbToOklch(...Object.values(hexToRgb(keyHighlight)));

  const stops = {};
  for (let i = 0; i < 8; i++) {
    let lerp;
    if (i <= 3) {
      // i=0 → k0, i=3 → k1, i=1,2 → lerp
      const t = i / 3;
      lerp = oklchLerp(k0, k1, t);
    } else {
      // i=3 → k1, i=7 → k2, i=4,5,6 → lerp
      const t = (i - 3) / 4;
      lerp = oklchLerp(k1, k2, t);
    }
    stops[STOP_NAMES[i]] = oklchToHex(lerp.L, lerp.C, lerp.H);
  }
  return stops;
}

/* ────────────────────────────────────────────
   Custom palette storage (global, max 3)
   ──────────────────────────────────────────── */

const CUSTOM_KEY = 'exo_custom_palettes';

/** Read custom palettes from localStorage */
export function getCustomPalettes() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save a new custom palette (max 3). Returns the new palette or null. */
export function saveCustomPalette(name, colors) {
  const list = getCustomPalettes();
  if (list.length >= 3) return null;
  const id = 'custom-' + Date.now();
  const entry = { id, label: name, builtin: false, colors };
  list.push(entry);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return entry;
}

/** Delete a custom palette by id. */
export function deleteCustomPalette(id) {
  const list = getCustomPalettes().filter(p => p.id !== id);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

/** Update a custom palette in-place. Returns the updated palette or null. */
export function updateCustomPalette(id, updates) {
  const list = getCustomPalettes();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return null;

  if (updates.label !== undefined) list[idx].label = updates.label;
  if (updates.colors !== undefined) list[idx].colors = { ...list[idx].colors, ...updates.colors };

  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return list[idx];
}

/* ────────────────────────────────────────────
   Lookup helpers
   ──────────────────────────────────────────── */

/** Get a single palette by id (checks built-in then custom). */
export function getPalette(id) {
  if (!id) return ALL_PRESETS[DEFAULT_PALETTE_ID];
  return ALL_PRESETS[id] || getCustomPalettes().find(p => p.id === id) || ALL_PRESETS[DEFAULT_PALETTE_ID];
}

/** Get all available palettes (built-in + custom) for the selector UI. */
export function getAllPalettes() {
  return [...Object.values(ALL_PRESETS), ...getCustomPalettes()];
}

export const DEFAULT_PALETTE_ID = 'burning-sunset';

export { ALL_PRESETS, DARK_PRESETS, LIGHT_PRESETS };
export default ALL_PRESETS;
