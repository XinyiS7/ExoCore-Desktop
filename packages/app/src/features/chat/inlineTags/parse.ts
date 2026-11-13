/**
 * Inline action tag parser (#130, REQ 2026-11-13 §1).
 *
 * Splits a message body into plain-text and whitelisted-tag segments. Tags are
 * only recognised OUTSIDE Markdown code (fenced blocks and inline code spans);
 * every non-whitelisted or malformed `<...>` stays plain text, so `x < y` and
 * `Vec<String>` are untouched.
 *
 * Paired tags (`speak` / `spoiler` / `pin`) take the body up to their first
 * closing tag outside code. An unclosed `<speak>` always stays a tag (the
 * body after its head is never shown — REQ §3.1); unclosed `spoiler` / `pin`
 * are tags only while streaming, mirroring the backend which ignores them once
 * persisted.
 *
 * While streaming, a trailing `<...` that could still become a whitelisted tag
 * is held back (REQ §1) so half a tag never flashes as text.
 *
 * Keep the grammar in sync with the backend parser (`inline_tags/parser.py`);
 * both share the case table in the tests.
 */

export const DICE_FACES = [4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE = 8;
export const MAX_TAG_SECONDS = 86400;

export type InlineTag =
  | { kind: 'speak'; emotion: string | null; body: string; closed: boolean }
  | { kind: 'spoiler'; cover: string | null; pwd: string | null; body: string; closed: boolean }
  | { kind: 'pin'; body: string; closed: boolean }
  | { kind: 'unpin'; id: number }
  | { kind: 'block'; seconds: number }
  | { kind: 'timer'; seconds: number; title: string | null }
  | { kind: 'timer_cancel'; title: string }
  | { kind: 'timer_fired'; title: string; fireAt: string }
  | { kind: 'roll'; expr: string }
  | { kind: 'roll_result'; expr: string; by: string; dice: number[]; total: number };

/**
 * `start` is the segment's offset in the parsed input. `index` is the tag's
 * position among accepted top-level tags — the backend's `tag_index`, which
 * keys persisted effects such as `inline_rolls` (#130 CP2).
 */
export type Segment =
  | { type: 'text'; text: string; start: number }
  | { type: 'tag'; tag: InlineTag; raw: string; start: number; index: number };

export interface ParseOptions {
  streaming?: boolean;
}

const PAIRED = new Set(['speak', 'spoiler', 'pin']);
const TAG_NAMES = ['speak', 'spoiler', 'pin', 'unpin', 'block', 'timer_fired', 'timer', 'roll_result', 'roll'];

// Name must be followed by `=`, whitespace, `/` or `>` so `<timerx>` / `<rolling>` are not tags.
const OPEN_RE = new RegExp(
  `^<(${TAG_NAMES.join('|')})(?=[=\\s/>])(?:=([^\\s>"]+))?((?:\\s+[a-z_]+=(?:"[^"]*"|[^\\s>"]+))*)\\s*\\/?>`,
);
const ATTR_RE = /([a-z_]+)=(?:"([^"]*)"|([^\s>"]+))/g;
const SECONDS_RE = /^(\d+)s$/;
// Digits only, as in the backend parser: `1e2`, `3.0`, ` 7` are not numbers here.
const UINT_RE = /^\d+$/;
const INT_RE = /^-?\d+$/;
const DICE_TERM_RE = /^(\d*)d(\d+)$/;

export type Range = [number, number];

/** Character ranges covered by Markdown code (fenced blocks + inline spans). */
export function codeRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const lines = text.split('\n');
  let offset = 0;
  let fence: { char: string; len: number; start: number } | null = null;
  const proseChunks: Range[] = [];
  let proseStart = 0;

  for (const line of lines) {
    const lineEnd = offset + line.length;
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === null && m) {
      proseChunks.push([proseStart, offset]);
      fence = { char: m[1][0], len: m[1].length, start: offset };
    } else if (fence !== null && m && m[1][0] === fence.char && m[1].length >= fence.len && line.trim() === m[1]) {
      ranges.push([fence.start, lineEnd]);
      fence = null;
      proseStart = lineEnd;
    }
    offset = lineEnd + 1;
  }
  if (fence !== null) {
    ranges.push([fence.start, text.length]);
  } else {
    proseChunks.push([proseStart, text.length]);
  }

  // Inline code: a backtick run closed by the next run of the same length.
  for (const [from, to] of proseChunks) {
    const chunk = text.slice(from, to);
    const runRe = /`+/g;
    let run: RegExpExecArray | null;
    while ((run = runRe.exec(chunk)) !== null) {
      const len = run[0].length;
      const closeRe = /`+/g;
      closeRe.lastIndex = run.index + len;
      let close: RegExpExecArray | null;
      let matched = false;
      while ((close = closeRe.exec(chunk)) !== null) {
        if (close[0].length === len) {
          ranges.push([from + run.index, from + close.index + len]);
          runRe.lastIndex = close.index + len;
          matched = true;
          break;
        }
      }
      if (!matched) break;
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

function inRanges(pos: number, ranges: Range[]): boolean {
  return ranges.some(([a, b]) => pos >= a && pos < b);
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR_RE)) {
    attrs[m[1]] = m[2] ?? m[3];
  }
  return attrs;
}

function parseSeconds(value: string | undefined): number | null {
  const m = value ? SECONDS_RE.exec(value) : null;
  if (!m) return null;
  const seconds = Number(m[1]);
  return seconds <= MAX_TAG_SECONDS ? seconds : null;
}

/** DnD dice expression: `NdF` terms (F ∈ DICE_FACES) and integer modifiers, ≤ MAX_DICE dice. */
export function isValidDiceExpr(expr: string): boolean {
  const terms = expr.replace(/\s+/g, '').split(/(?=[+-])/);
  let dice = 0;
  let hasDie = false;
  for (const [index, signed] of terms.entries()) {
    const sign = signed[0];
    const term = sign === '+' || sign === '-' ? signed.slice(1) : signed;
    if (index > 0 && sign !== '+' && sign !== '-') return false;
    if (/^\d+$/.test(term)) continue;
    const m = DICE_TERM_RE.exec(term);
    if (!m || sign === '-') return false;
    const count = m[1] === '' ? 1 : Number(m[1]);
    if (count < 1 || !(DICE_FACES as readonly number[]).includes(Number(m[2]))) return false;
    dice += count;
    hasDie = true;
  }
  return hasDie && dice <= MAX_DICE;
}

type TagHead = InlineTag extends infer T ? (T extends unknown ? Omit<T, 'body' | 'closed'> : never) : never;
type HeadResult = { name: string; tag: TagHead | null; length: number };

function parseHead(text: string, pos: number): HeadResult | null {
  const m = OPEN_RE.exec(text.slice(pos));
  if (!m) return null;
  const [raw, name, value, attrRaw] = m;
  const attrs = parseAttrs(attrRaw ?? '');
  const has = (key: string) => Object.prototype.hasOwnProperty.call(attrs, key);
  let tag: HeadResult['tag'] = null;

  switch (name) {
    case 'speak':
      if (value === undefined) tag = { kind: 'speak', emotion: has('emotion') ? attrs.emotion : null };
      break;
    case 'spoiler':
      if (value === undefined) {
        tag = { kind: 'spoiler', cover: has('cover') ? attrs.cover : null, pwd: has('pwd') ? attrs.pwd : null };
      }
      break;
    case 'pin':
      if (value === undefined) tag = { kind: 'pin' };
      break;
    case 'unpin':
      if (value === undefined && UINT_RE.test(attrs.id ?? '') && Number(attrs.id) > 0) {
        tag = { kind: 'unpin', id: Number(attrs.id) };
      }
      break;
    case 'block': {
      const seconds = parseSeconds(value);
      if (seconds !== null) tag = { kind: 'block', seconds };
      break;
    }
    case 'timer': {
      if (value === undefined && has('cancel') && attrs.cancel !== '') {
        tag = { kind: 'timer_cancel', title: attrs.cancel };
      } else {
        const seconds = parseSeconds(value);
        if (seconds !== null && seconds > 0) tag = { kind: 'timer', seconds, title: has('title') ? attrs.title : null };
      }
      break;
    }
    case 'timer_fired':
      if (value === undefined && has('title') && has('fire_at')) {
        tag = { kind: 'timer_fired', title: attrs.title, fireAt: attrs.fire_at };
      }
      break;
    case 'roll':
      if (value !== undefined && isValidDiceExpr(value)) tag = { kind: 'roll', expr: value };
      break;
    case 'roll_result': {
      const dice = (attrs.dice ?? '').split(',');
      if (
        value === undefined &&
        has('expr') &&
        has('by') &&
        dice.every((d) => INT_RE.test(d)) &&
        INT_RE.test(attrs.total ?? '')
      ) {
        tag = { kind: 'roll_result', expr: attrs.expr, by: attrs.by, dice: dice.map(Number), total: Number(attrs.total) };
      }
      break;
    }
  }
  return { name, tag, length: raw.length };
}

/** Start index of a trailing `<...` that may still grow into a whitelisted tag, else -1. */
export function pendingTagStart(text: string, ranges: Range[] = codeRanges(text)): number {
  const lt = text.lastIndexOf('<');
  if (lt < 0 || text.indexOf('>', lt) >= 0 || inRanges(lt, ranges)) return -1;
  const tail = text.slice(lt);
  const m = /^<\/?([a-z_]*)/.exec(tail);
  if (!m) return -1;
  const name = m[1];
  const rest = tail.slice(m[0].length);
  if (rest === '') return TAG_NAMES.some((n) => n.startsWith(name)) ? lt : -1;
  // Full name followed by attributes still being typed.
  return TAG_NAMES.includes(name) && /^[=\s]/.test(rest) && !tail.startsWith('</') ? lt : -1;
}

function findClose(text: string, name: string, from: number, ranges: Range[]): number {
  const needle = `</${name}>`;
  let idx = text.indexOf(needle, from);
  while (idx >= 0 && inRanges(idx, ranges)) idx = text.indexOf(needle, idx + 1);
  return idx;
}

export function parseInlineTags(input: string, options: ParseOptions = {}): Segment[] {
  const streaming = options.streaming ?? false;
  let text = input;
  let ranges = codeRanges(text);
  if (streaming) {
    const pending = pendingTagStart(text, ranges);
    if (pending >= 0) {
      text = text.slice(0, pending);
      ranges = codeRanges(text);
    }
  }

  const segments: Segment[] = [];
  let tagCount = 0;
  let buffer = '';
  let bufferStart = 0;
  let pos = 0;
  const flush = () => {
    if (buffer) segments.push({ type: 'text', text: buffer, start: bufferStart });
    buffer = '';
  };

  while (pos < text.length) {
    const lt = text.indexOf('<', pos);
    if (lt < 0) {
      buffer += text.slice(pos);
      break;
    }
    buffer += text.slice(pos, lt);
    const head = inRanges(lt, ranges) ? null : parseHead(text, lt);
    if (!head || head.tag === null) {
      buffer += '<';
      pos = lt + 1;
      continue;
    }

    const headEnd = lt + head.length;
    if (!PAIRED.has(head.name)) {
      flush();
      segments.push({ type: 'tag', tag: head.tag as InlineTag, raw: text.slice(lt, headEnd), start: lt, index: tagCount++ });
      pos = headEnd;
      bufferStart = pos;
      continue;
    }

    const close = findClose(text, head.name, headEnd, ranges);
    if (close < 0 && head.name !== 'speak' && !streaming) {
      buffer += '<';
      pos = lt + 1;
      continue;
    }
    const closed = close >= 0;
    const bodyEnd = closed ? close : text.length;
    const end = closed ? close + head.name.length + 3 : text.length;
    flush();
    segments.push({
      type: 'tag',
      tag: { ...head.tag, body: text.slice(headEnd, bodyEnd), closed } as InlineTag,
      raw: text.slice(lt, end),
      start: lt,
      index: tagCount++,
    });
    pos = end;
    bufferStart = pos;
  }
  flush();
  return segments;
}

/** A user row that is nothing but a backend timer trigger (REQ §3.3) — hidden in the timeline. */
export function isTimerTriggerMessage(content: string): boolean {
  const segments = parseInlineTags(content);
  const tags = segments.filter((s) => s.type === 'tag');
  return (
    tags.length === 1 &&
    tags[0].type === 'tag' &&
    tags[0].tag.kind === 'timer_fired' &&
    segments.every((s) => s.type === 'tag' || s.text.trim() === '')
  );
}
