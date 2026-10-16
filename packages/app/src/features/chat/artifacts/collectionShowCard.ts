import type { CollectionKind } from '../../collection/types';
import type { AssistantArtifactView, CollectionShowCard } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

const ITEM_KINDS: ReadonlySet<string> = new Set<CollectionKind>(['text', 'image', 'audio', 'document']);
const TITLE_LIMIT = 2000;

/** Backend `show_descriptors.KIND_LABELS`, read back from the fixed #54 title. */
const TITLE_KIND_LABELS: Readonly<Record<string, CollectionKind>> = {
  文本: 'text',
  图片: 'image',
  音频: 'audio',
  文档: 'document',
};
const COLLECTION_TITLE = /^从藏品馆带回 · (文本|图片|音频|文档) #([1-9]\d*)$/;

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseShow(candidate: unknown): (CollectionShowCard & { position: number }) | null {
  if (!isRecord(candidate)) return null;
  const { key, item_id, item_kind, position, title, detail, text } = candidate;
  if (typeof key !== 'string' || key.length === 0) return null;
  if (!isPositiveInt(item_id)) return null;
  if (typeof item_kind !== 'string' || !ITEM_KINDS.has(item_kind)) return null;
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) return null;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > TITLE_LIMIT) return null;
  if (detail !== undefined && detail !== null && typeof detail !== 'string') return null;
  if (text !== undefined && typeof text !== 'string') return null;
  if (item_kind !== 'text' && text !== undefined) return null;
  return {
    key,
    itemId: item_id,
    itemKind: item_kind as CollectionKind,
    title,
    detail: nonEmpty(detail),
    text: item_kind === 'text' && typeof text === 'string' ? text : null,
    position,
  };
}

/**
 * Normalizes user `collection_shows[]` (#61 CP-B2) fail-closed: a non-array
 * yields `[]`, malformed rows are dropped individually, duplicate keys collapse
 * and output follows `position`.
 */
export function normalizeCollectionShows(raw: unknown): CollectionShowCard[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, CollectionShowCard & { position: number }>();
  for (const candidate of raw) {
    const show = parseShow(candidate);
    if (show && !byKey.has(show.key)) byKey.set(show.key, show);
  }
  return [...byKey.values()]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...card }) => card);
}

/**
 * The same domain card for an Agent collection artifact. Its item identity
 * comes from the contract-fixed title `从藏品馆带回 · <kind> #<item_id>`; a
 * title outside that form keeps the card readable but without a Library link.
 */
export function collectionShowCardFromArtifact(artifact: AssistantArtifactView): CollectionShowCard {
  const match = COLLECTION_TITLE.exec(artifact.title);
  return {
    key: artifact.key,
    itemId: match ? Number(match[2]) : null,
    itemKind: match ? TITLE_KIND_LABELS[match[1]] : null,
    title: artifact.title,
    detail: artifact.detail,
    text: artifact.kind === 'text' ? artifact.text : null,
  };
}
