/**
 * Pure text helpers for the user-message minimap (#72 U5). Lengths count
 * code points, so CJK and emoji each count as one character.
 */

export const EXCERPT_LENGTH = 15;

export interface MatchExcerpt {
  before: string;
  match: string;
  after: string;
  /** Text was cut before `before`. */
  leadingCut: boolean;
  /** Text was cut after `after`. */
  trailingCut: boolean;
}

function normalize(text: string): string[] {
  return Array.from(text.replace(/\s+/g, ' ').trim());
}

/** First `length` characters of the message, with an ellipsis when cut. */
export function headExcerpt(text: string, length = EXCERPT_LENGTH): string {
  const chars = normalize(text);
  return chars.length > length ? `${chars.slice(0, length).join('')}…` : chars.join('');
}

function findMatch(chars: string[], needle: string[]): number {
  const lower = chars.map((c) => c.toLowerCase());
  outer: for (let i = 0; i + needle.length <= lower.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (lower[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Case-insensitive substring match. Returns a window of `length` characters
 * in total around the first hit (the hit itself is never cut), or null.
 */
export function matchExcerpt(text: string, query: string, length = EXCERPT_LENGTH): MatchExcerpt | null {
  const needle = normalize(query).map((c) => c.toLowerCase());
  if (needle.length === 0) return null;
  const chars = normalize(text);
  const at = findMatch(chars, needle);
  if (at === -1) return null;

  const context = Math.max(0, length - needle.length);
  let start = Math.max(0, at - Math.floor(context / 2));
  let end = Math.min(chars.length, start + needle.length + context);
  start = Math.max(0, end - needle.length - context);
  end = Math.max(end, at + needle.length);

  return {
    before: chars.slice(start, at).join(''),
    match: chars.slice(at, at + needle.length).join(''),
    after: chars.slice(at + needle.length, end).join(''),
    leadingCut: start > 0,
    trailingCut: end < chars.length,
  };
}
