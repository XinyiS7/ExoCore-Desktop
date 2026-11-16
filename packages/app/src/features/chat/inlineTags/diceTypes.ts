import { DICE_FACES, MAX_DICE, isValidDiceExpr } from './parse';

export type DieFaces = (typeof DICE_FACES)[number];

export const MIN_DICE_MODIFIER = -99;
export const MAX_DICE_MODIFIER = 99;

/** Canonical ordering keeps d20 first as the hero die, matching assembled `<roll=...>`. */
export const DICE_TERM_ORDER: readonly DieFaces[] = [20, 100, 12, 10, 8, 6, 4];

export interface PoolDie {
  id: string;
  faces: DieFaces;
}

export interface PendingDiceState {
  dice: PoolDie[];
  modifier: number;
  expr: string;
}

export function clampDiceModifier(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_DICE_MODIFIER, Math.min(MAX_DICE_MODIFIER, Math.trunc(value)));
}

/**
 * Sorts dice into canonical term order so index `i` matches the backend's
 * evaluated `dice[i]` sequence in `<roll_result dice="...">`.
 */
export function orderDiceForExpr<T extends { faces: DieFaces }>(dice: readonly T[]): T[] {
  const rank = new Map<DieFaces, number>(DICE_TERM_ORDER.map((faces, idx) => [faces, idx]));
  return [...dice].sort((a, b) => (rank.get(a.faces) ?? 99) - (rank.get(b.faces) ?? 99));
}

export function formatDiceExpr(dice: readonly { faces: DieFaces }[], modifier: number): string {
  if (dice.length === 0) return '';
  const counts = new Map<DieFaces, number>();
  for (const die of dice) {
    counts.set(die.faces, (counts.get(die.faces) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const faces of DICE_TERM_ORDER) {
    const count = counts.get(faces);
    if (count && count > 0) parts.push(`${count}d${faces}`);
  }
  const base = parts.join('+');
  const mod = clampDiceModifier(modifier);
  const expr = mod > 0 ? `${base}+${mod}` : mod < 0 ? `${base}${mod}` : base;
  return isValidDiceExpr(expr) ? expr : '';
}

export function canAddDie(currentCount: number): boolean {
  return currentCount < MAX_DICE;
}

export function buildPendingDiceState(dice: readonly PoolDie[], modifier: number): PendingDiceState | null {
  if (dice.length === 0 || dice.length > MAX_DICE) return null;
  const ordered = orderDiceForExpr(dice);
  const clampedMod = clampDiceModifier(modifier);
  const expr = formatDiceExpr(ordered, clampedMod);
  if (!expr) return null;
  return { dice: ordered, modifier: clampedMod, expr };
}

export function fontSizeForDieLabel(textStr: string): string {
  if (textStr.length >= 4) return '10.5';
  if (textStr.length === 3) return '11.5';
  if (textStr.length === 2) return '13.5';
  return '15';
}

/**
 * Expands a valid dice expression (e.g. `1d20+2d6+3`) into ordered die entries
 * matching the expression's evaluation sequence and clamped integer modifier.
 */
export function expandDiceExpr(
  expr: string,
  idPrefix = 'roll',
): { dice: PoolDie[]; modifier: number } | null {
  const compact = expr.replace(/\s+/g, '');
  if (!compact || !isValidDiceExpr(compact)) return null;
  const terms = compact.split(/(?=[+-])/);
  const dice: PoolDie[] = [];
  let modifier = 0;
  let seq = 0;

  for (const signed of terms) {
    if (/^[+-]?\d+$/.test(signed)) {
      modifier += Number(signed);
      continue;
    }
    const term = signed[0] === '+' ? signed.slice(1) : signed;
    const match = /^(\d*)d(\d+)$/.exec(term);
    if (!match) return null;
    const count = match[1] === '' ? 1 : Number(match[1]);
    const faces = Number(match[2]) as DieFaces;
    for (let i = 0; i < count; i += 1) {
      seq += 1;
      dice.push({ id: `${idPrefix}-${seq}`, faces });
    }
  }

  return dice.length > 0 ? { dice, modifier: clampDiceModifier(modifier) } : null;
}
