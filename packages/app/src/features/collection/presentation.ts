import type { CollectionSourceType, RepresentationKind, RepresentationState } from './types';

/** Human wording for contract enums in the expanded view (Plan §5.2). */

export const SOURCE_LABELS: Record<CollectionSourceType, string> = {
  attachment: '聊天附件',
  message: '聊天消息',
  text: '手动文本',
  chronicle_highlight: '纪事摘录',
  // #74: an AI voice/image reads as a chat attachment too (no AI-generated mark).
  assistant_artifact: '聊天附件',
};

/** Only the two speaker roles are named; anything else is left out rather than guessed. */
export function roleLabel(role: string): string | null {
  if (role === 'user') return '用户';
  if (role === 'assistant') return '助手';
  return null;
}

export const REPRESENTATION_LABELS: Record<RepresentationKind, string> = {
  image_preview: '预览',
  audio_playback: '播放版本',
  document_extracted_text: '提取文本',
};

export const REPRESENTATION_STATE_LABELS: Record<RepresentationState, string> = {
  pending: '处理中',
  succeeded: '可用',
  failed: '失败',
  unavailable: '不可用',
};

/** Local "YYYY-MM-DD HH:mm". */
export function localDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const DESCRIPTION_LIMIT = 500;

/** Tags input: one per comma (ASCII or full-width) or line; whitespace inside a tag is kept. */
export function parseTagsInput(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(/[,，\n]/)) {
    const tag = raw.trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags;
}
