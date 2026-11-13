import { parseInlineTags, type InlineTag } from './parse';

/**
 * Bridges parsed inline tags into the one Markdown pipeline (#130 CP1).
 *
 * Each recognised tag is replaced by an empty placeholder element carrying
 * `data-itag-ref=<index>`; MessageContent's `div` / `span` components swap the
 * placeholder for the tag view. Tags therefore keep their position inside
 * paragraphs and the surrounding Markdown is parsed as one document. Block tags
 * become a stand-alone `<div>` HTML block, inline tags an inline `<span>`.
 */

export type InlineTagRole = 'assistant' | 'user';

/** Kinds a user message may carry (REQ: spoiler/speak/block/timer are assistant-only). */
const USER_KINDS = new Set<InlineTag['kind']>(['pin', 'unpin', 'roll', 'roll_result', 'timer_fired']);
const BLOCK_KINDS = new Set<InlineTag['kind']>(['speak', 'spoiler', 'pin']);

export interface PlaceholderResult {
  markdown: string;
  tags: InlineTag[];
}

export function withTagPlaceholders(
  content: string,
  role: InlineTagRole | undefined,
  streaming: boolean,
): PlaceholderResult {
  if (!role) return { markdown: content, tags: [] };
  const tags: InlineTag[] = [];
  let markdown = '';
  for (const segment of parseInlineTags(content, { streaming })) {
    if (segment.type === 'text') {
      markdown += segment.text;
      continue;
    }
    if (role === 'user' && !USER_KINDS.has(segment.tag.kind)) {
      markdown += segment.raw;
      continue;
    }
    const ref = tags.push(segment.tag) - 1;
    markdown += BLOCK_KINDS.has(segment.tag.kind)
      ? `\n\n<div data-itag-ref="${ref}"></div>\n\n`
      : `<span data-itag-ref="${ref}"></span>`;
  }
  return { markdown, tags };
}
