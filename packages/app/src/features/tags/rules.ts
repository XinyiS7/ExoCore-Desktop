/**
 * Session / Project tag rules mirrored from the backend `core/tags.py`
 * (ReactSheet §1.2). The backend stays authoritative; these helpers only give
 * the dialogs immediate feedback and the same canonical names before submit.
 */

export const SPECIAL_TAGS = ['chat', 'code', 'story', 'theater'] as const;

const SPECIAL_SET = new Set<string>(SPECIAL_TAGS);

export function isSpecialTag(name: string): boolean {
  return SPECIAL_SET.has(name);
}

/** Strip leading `#`; special tags are case-insensitive and stored lower-case. */
export function canonicalTag(raw: string): string | null {
  const name = raw.trim().replace(/^#+/, '').trim();
  if (name === '') return null;
  const lowered = name.toLowerCase();
  return SPECIAL_SET.has(lowered) ? lowered : name;
}

/** Append one raw entry, keeping canonical names unique. */
export function addTag(tags: readonly string[], raw: string): string[] {
  const name = canonicalTag(raw);
  if (name === null || tags.includes(name)) return [...tags];
  return [...tags, name];
}

/** Same copy as the backend `SpecialTagConflict`; null when at most one special tag. */
export function specialTagConflict(tags: readonly string[]): string | null {
  const special = tags.filter(isSpecialTag);
  if (special.length <= 1) return null;
  return `不可同时存在 ${special.map((name) => `#${name}`).join(' 和 ')}。请至少删除一个。`;
}

/** Read a wire `tags` value; anything that is not a string list reads as no tags. */
export function readTagNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** Backend 400 `{tags: {code, message}}` → message, else null. */
export function tagErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const detail = (body as Record<string, unknown>).tags;
  if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
    const message = (detail as Record<string, unknown>).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return null;
}
