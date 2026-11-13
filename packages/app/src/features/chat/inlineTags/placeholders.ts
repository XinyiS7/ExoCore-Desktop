import { codeRanges, parseInlineTags, type InlineTag } from './parse';
import { protectUnknownTags } from '../rawHtmlText';

/**
 * Bridges parsed inline tags into the one Markdown pipeline (#130 CP1).
 *
 * Each ACCEPTED tag is replaced by an empty placeholder element carrying
 * `data-itag-ref=<index>`; MessageContent's `div` / `span` components swap the
 * placeholder for the tag view. Tags therefore keep their position inside
 * paragraphs and the surrounding Markdown is parsed as one document. Block tags
 * become a stand-alone `<div>` HTML block, inline tags an inline `<span>`.
 *
 * Invariant (CP1-F03): only what the parser accepted for this author role acts
 * or is hidden. Everything else — plain text and rejected tag-shaped text
 * (bad syntax, uppercase, unclosed, bad arguments, wrong role) — goes through
 * `protectUnknownTags` and renders verbatim.
 */

export type InlineTagRole = 'assistant' | 'user';

/** Kinds a user message may carry (REQ: spoiler/speak/block/timer are assistant-only). */
const USER_KINDS = new Set<InlineTag['kind']>(['pin', 'unpin', 'roll', 'roll_result', 'timer_fired']);
const BLOCK_KINDS = new Set<InlineTag['kind']>(['speak', 'spoiler']);
/**
 * D-F: pins live only in the conversation-level sticky-note area (CP2); the
 * message body shows neither the tag nor its content. Canonical text is untouched.
 */
const HIDDEN_KINDS = new Set<InlineTag['kind']>(['pin', 'unpin']);

/**
 * One parse, projected for an author role: what the message body actually
 * shows. Shared by rendering (`withTagPlaceholders`) and row visibility
 * (`hasVisibleBody`) so the two can never disagree (CP1-F04).
 */
type Projected =
  | { kind: 'text'; text: string; start: number }
  | { kind: 'tag'; tag: InlineTag };

function projectInlineTags(content: string, role: InlineTagRole, streaming: boolean): Projected[] {
  const parts: Projected[] = [];
  for (const segment of parseInlineTags(content, { streaming })) {
    if (segment.type === 'text') {
      parts.push({ kind: 'text', text: segment.text, start: segment.start });
    } else if (role === 'user' && !USER_KINDS.has(segment.tag.kind)) {
      parts.push({ kind: 'text', text: segment.raw, start: segment.start });
    } else if (!HIDDEN_KINDS.has(segment.tag.kind)) {
      parts.push({ kind: 'tag', tag: segment.tag });
    }
  }
  return parts;
}

/** Whether the body shows anything once inline tags are projected (no role = raw text). */
export function hasVisibleBody(content: string, role: InlineTagRole | undefined, streaming = false): boolean {
  if (!role) return content.trim() !== '';
  return projectInlineTags(content, role, streaming).some((p) => p.kind === 'tag' || p.text.trim() !== '');
}

export interface PlaceholderResult {
  markdown: string;
  tags: InlineTag[];
}

export function withTagPlaceholders(
  content: string,
  role: InlineTagRole | undefined,
  streaming: boolean,
  htmlTags: ReadonlySet<string>,
): PlaceholderResult {
  const ranges = codeRanges(content);
  if (!role) return { markdown: protectUnknownTags(content, htmlTags, ranges), tags: [] };
  const tags: InlineTag[] = [];
  let markdown = '';
  for (const part of projectInlineTags(content, role, streaming)) {
    if (part.kind === 'text') {
      markdown += protectUnknownTags(part.text, htmlTags, ranges, part.start);
      continue;
    }
    const ref = tags.push(part.tag) - 1;
    markdown += BLOCK_KINDS.has(part.tag.kind)
      ? `\n\n<div data-itag-ref="${ref}"></div>\n\n`
      : `<span data-itag-ref="${ref}"></span>`;
  }
  return { markdown, tags };
}
