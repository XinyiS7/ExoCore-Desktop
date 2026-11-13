import { codeRanges } from './inlineTags/parse';

/**
 * Keeps non-allow-listed angle-bracket text literal (#130 CP1-F01).
 *
 * MessageContent renders raw HTML, so `Vec<String>` used to reach rehype-raw
 * as an unknown `<string>` element that the sanitizer then dropped, leaving
 * `Vec`. Before Markdown runs, the `<` of any tag-shaped sequence whose name is
 * not in `allowed` (the sanitizer's tag list plus the inline action tags) is
 * entity-escaped, so it renders as text. Allowed card HTML is untouched, and so
 * is code (fences and inline spans render literally already).
 *
 * Only `<name` followed by whitespace, `/` or `>` is touched: autolinks
 * (`<https://…>`, `<a@b.c>`), `x < y`, `Map<K, V>` and a still-streaming `<sp`
 * are not HTML to begin with and stay as they are.
 */

const TAG_SHAPE_RE = /<(\/?)([A-Za-z][A-Za-z0-9-]*)(?=[\s/>])/g;

export function protectUnknownTags(content: string, allowed: ReadonlySet<string>): string {
  if (!content.includes('<')) return content;
  const ranges = codeRanges(content);
  return content.replace(TAG_SHAPE_RE, (match, _slash: string, name: string, offset: number) => {
    if (allowed.has(name.toLowerCase())) return match;
    if (ranges.some(([from, to]) => offset >= from && offset < to)) return match;
    return `&lt;${match.slice(1)}`;
  });
}
