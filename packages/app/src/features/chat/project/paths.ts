/**
 * P1D project reference path rules (Plan Task 5, §6.6).
 *
 * Pure functions shared by the Project drawer, the composer insertion
 * boundary (pane 5) and send-time cleanup:
 * - insertion accepts ONLY safe workspace-relative paths (malformed,
 *   duplicate, absolute or path-traversing entries are rejected);
 * - token format is exactly `@[relative/path] `; cursor extraction only
 *   activates for the current incomplete `@` token;
 * - send-time conversion rewrites only VALID `@[path]` tokens to `@path`;
 *   malformed bracket text remains untouched.
 */

const TOKEN_RE = /@\[([^\]]+)\]/g;
const ABSOLUTE_RE = /^(?:[a-zA-Z]:[\\/]|[/\\])/;

/** True for a POSIX-style workspace-relative path without traversal. */
export function isSafeRelativePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (path.length > 1024) return false;
  // Control chars (per-char, avoids a control-char regex lint rule).
  for (let i = 0; i < path.length; i += 1) {
    if (path.charCodeAt(i) < 0x20) return false;
  }
  if (ABSOLUTE_RE.test(path)) return false;
  // Backslash is accepted as a separator but never as the first char (UNC-ish).
  if (/^\\/.test(path)) return false;
  const segments = path.split(/[/\\]+/);
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') return false;
  }
  return true;
}

/** True when a path survives AND is not a duplicate of an existing token. */
export function isInsertablePath(path: string, existingTokens: ReadonlySet<string>): boolean {
  return isSafeRelativePath(path) && !existingTokens.has(path);
}

/** Parse every `@[path]` token in the draft (for chips / duplicates). */
export function extractProjectRefs(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    out.push(match[1]);
  }
  return out;
}

/**
 * Cursor-aware incomplete `@` token extraction. Returns the query after the
 * last `@` before the caret when that `@` opens a still-incomplete bracket
 * token (no `]` between it and the caret, no whitespace boundary). The
 * popup only activates for this current token (Plan §6.6).
 */
export function extractCurrentAtQuery(text: string, caret: number): string | null {
  const head = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const start = head.lastIndexOf('@');
  if (start === -1) return null;
  const tail = head.slice(start);
  // A complete token means the popup must not re-open over it.
  if (tail.includes(']')) return null;
  // `@` must begin the token — a previous char that is word-ish would make
  // this an email/mention-like artifact; require whitespace/boundary before.
  if (start > 0 && !/\s/.test(head[start - 1])) return null;
  const query = tail.slice(1);
  // Whitespace ends the query segment (space-separated prose after a token).
  if (/\s/.test(query)) return null;
  return query;
}

/**
 * Send-time cleanup: convert ONLY valid `@[relative/path]` tokens to
 * `@path`. Invalid bracket text (absolute, traversal, malformed) is left
 * untouched — never silently rewritten.
 */
export function cleanProjectRefsForSend(text: string): string {
  return text.replace(TOKEN_RE, (whole, path: string) =>
    isSafeRelativePath(path) ? `@${path}` : whole,
  );
}

/**
 * Insert a token at the caret: `@[relative/path] ` (trailing space). Returns
 * the new text and the new caret position.
 */
export function insertProjectRefToken(
  text: string,
  caret: number,
  path: string,
): { text: string; caret: number } {
  if (!isSafeRelativePath(path)) return { text, caret };
  const token = `@[${path}] `;
  const pos = Math.max(0, Math.min(caret, text.length));
  const next = text.slice(0, pos) + token + text.slice(pos);
  return { text: next, caret: pos + token.length };
}