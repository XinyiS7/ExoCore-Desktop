/** Preset sticky-note paper themes (#130 + Plan 2026-11-14). */

export const PIN_COLORS = ['butter', 'mint', 'blush', 'sky', 'lavender', 'crimson'] as const;

export type PinColor = (typeof PIN_COLORS)[number];

export interface PinColorPreset {
  color: PinColor;
  label: string;
  swatch: string;
}

export const PIN_COLOR_PRESETS: readonly PinColorPreset[] = [
  { color: 'butter', label: '鹅黄', swatch: '#f3e3a1' },
  { color: 'mint', label: '薄荷', swatch: '#cbe5d4' },
  { color: 'blush', label: '樱粉', swatch: '#f4cdd4' },
  { color: 'sky', label: '晴空', swatch: '#cbe0f2' },
  { color: 'lavender', label: '薰衣草', swatch: '#ded3f3' },
  { color: 'crimson', label: '深绯', swatch: '#521b24' },
];

export interface DraftPin {
  id: string;
  body: string;
  color: PinColor;
}

export interface CommittingPin {
  id: string;
  body: string;
  color: PinColor;
}

const PIN_COLOR_SET = new Set<string>(PIN_COLORS);

export function normalizePinColor(value: unknown): PinColor {
  return typeof value === 'string' && PIN_COLOR_SET.has(value) ? (value as PinColor) : 'butter';
}

const UNSAFE_PIN_CLOSE_RE = /<\/pin\s*>/i;

/** Closing tag inside note body would break `<pin>...</pin>` parsing on send. */
export function hasUnsafePinClose(body: string): boolean {
  return UNSAFE_PIN_CLOSE_RE.test(body);
}

export function assemblePinTag(draft: Pick<DraftPin, 'body' | 'color'>): string {
  const cleanBody = draft.body.trim();
  if (draft.color === 'butter') {
    return `<pin>${cleanBody}</pin>`;
  }
  return `<pin color="${draft.color}">${cleanBody}</pin>`;
}
