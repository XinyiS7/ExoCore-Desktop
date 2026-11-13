import { codeRanges, type Range } from './inlineTags/parse';

/**
 * Keeps non-HTML angle-bracket text literal (#130 CP1-F01 / F03).
 *
 * MessageContent renders raw HTML, so `Vec<String>` used to reach rehype-raw
 * as an unknown `<string>` element that the sanitizer then dropped, leaving
 * `Vec`. Before Markdown runs, the `<` of any tag-shaped sequence whose name is
 * not in `allowed` (the sanitizer's tag list) is entity-escaped, so it renders
 * as text. Allow-listed card HTML is untouched, and so is code (fences and
 * inline spans render literally already).
 *
 * Inline action tags are NOT in `allowed`: a tag the parser accepted never
 * reaches this function (it became a placeholder), so every `<timer…` /
 * `<PIN>` / user `<speak>` seen here was rejected and must stay verbatim.
 *
 * Only `<name` followed by whitespace, `/` or `>` is touched: autolinks
 * (`<https://…>`, `<a@b.c>`), `x < y`, `Map<K, V>` and a still-streaming `<sp`
 * are not HTML to begin with and stay as they are.
 *
 * `ranges` / `base` let a caller escape one slice of a larger document while
 * code detection still runs over the whole document.
 */

const TAG_SHAPE_RE = /<(\/?)([A-Za-z][A-Za-z0-9-]*)(?=[\s/>])/g;

export function protectUnknownTags(
  text: string,
  allowed: ReadonlySet<string>,
  ranges: Range[] = codeRanges(text),
  base = 0,
): string {
  if (!text.includes('<')) return text;
  return text.replace(TAG_SHAPE_RE, (match, _slash: string, name: string, offset: number) => {
    if (allowed.has(name.toLowerCase())) return match;
    const at = base + offset;
    if (ranges.some(([from, to]) => at >= from && at < to)) return match;
    return `&lt;${match.slice(1)}`;
  });
}
