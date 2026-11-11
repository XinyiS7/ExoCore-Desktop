/**
 * Local file links in assistant Markdown (#91).
 *
 * Agents write links such as `[views.py](file:///D:/x/views.py#L21-L40)` or
 * `[notes](D:\x\notes.md)`. react-markdown would strip both twice (sanitize
 * `protocols.href`, then the default `urlTransform`), so a remark pass rewrites
 * them to an internal `exo-local:` marker carrying the *raw* link destination.
 *
 * The raw destination is sliced from the Markdown source via node positions,
 * not taken from `node.url`: mdast decodes backslash escapes (`D:\_tmp` →
 * `D:_tmp`), and the backend verifies the href verbatim against the stored
 * message content. Only standard inline `[text](dest)` links are handled;
 * anything else falls back to `node.url`. Raw HTML `<a>` is never touched.
 */

export const LOCAL_FILE_PROTOCOL = 'exo-local';
const MARKER_PREFIX = `${LOCAL_FILE_PROTOCOL}:`;

const FILE_URL = /^file:\/\/\//i;
const DRIVE_PATH = /^[A-Za-z]:[\\/]/;

export function isLocalFileHref(href: string): boolean {
  return FILE_URL.test(href) || DRIVE_PATH.test(href);
}

export function toLocalFileMarker(rawHref: string): string {
  return MARKER_PREFIX + encodeURIComponent(rawHref);
}

/** Inverse of `toLocalFileMarker`; null for any other URL. */
export function fromLocalFileMarker(url: string | undefined | null): string | null {
  if (!url || !url.startsWith(MARKER_PREFIX)) return null;
  try {
    return decodeURIComponent(url.slice(MARKER_PREFIX.length));
  } catch {
    return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Human-readable absolute path (fragment dropped, URL-decoded). */
export function localFileDisplayPath(rawHref: string): string {
  const withoutFragment = rawHref.split('#', 1)[0];
  if (FILE_URL.test(withoutFragment)) {
    return safeDecode(withoutFragment.slice('file:///'.length));
  }
  return safeDecode(withoutFragment);
}

export interface LineRange {
  start: number;
  end: number;
}

/**
 * `#L21` / `#L21-L40` → 1-based inclusive range. Malformed, reversed or
 * out-of-range fragments return null: the file still opens, just unpositioned.
 */
export function parseLineRange(rawHref: string, lineCount: number): LineRange | null {
  const hash = rawHref.indexOf('#');
  if (hash < 0) return null;
  const match = /^L(\d+)(?:-L?(\d+))?$/.exec(rawHref.slice(hash + 1));
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (start < 1 || end < start || end > lineCount) return null;
  return { start, end };
}

// ── remark plugin ──────────────────────────────────────────────────────────

interface Point {
  offset?: number;
}
interface MdNode {
  type: string;
  url?: string;
  children?: MdNode[];
  position?: { start: Point; end: Point };
}

/** Slice the raw destination of an inline `[text](dest ...)` link from source. */
function rawInlineDestination(node: MdNode, source: string): string | null {
  const start = node.position?.start.offset;
  if (start === undefined) return null;
  const children = node.children ?? [];
  const textEnd = children.length ? children[children.length - 1].position?.end.offset : start + 1;
  if (textEnd === undefined || source.slice(textEnd, textEnd + 2) !== '](') return null;

  let i = textEnd + 2;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  if (source[i] === '<') {
    const close = source.indexOf('>', i + 1);
    return close < 0 ? null : source.slice(i + 1, close);
  }
  let depth = 0;
  let j = i;
  while (j < source.length) {
    const ch = source[j];
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (/\s/.test(ch)) break;
    if (ch === '(') depth += 1;
    if (ch === ')') {
      if (depth === 0) break;
      depth -= 1;
    }
    j += 1;
  }
  return j > i ? source.slice(i, j) : null;
}

function visitLinks(node: MdNode, source: string): void {
  if (node.type === 'link' && typeof node.url === 'string') {
    const raw = rawInlineDestination(node, source);
    const href = raw !== null && isLocalFileHref(raw) ? raw : node.url;
    if (isLocalFileHref(href)) node.url = toLocalFileMarker(href);
  }
  node.children?.forEach((child) => visitLinks(child, source));
}

export function remarkLocalFileLinks() {
  return (tree: MdNode, file: { value?: unknown }) => {
    visitLinks(tree, typeof file.value === 'string' ? file.value : String(file.value ?? ''));
  };
}
