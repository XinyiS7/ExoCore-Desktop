import type { CollectionKind } from '../../collection/types';
import { parseCanonicalAttachmentItem } from '../attachments/projection';
import type {
  CollectionShowCard,
  MessageAttachmentKind,
  MessageAttachmentView,
  PresentationSurface,
  PresentationView,
} from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Media kinds each surface accepts (mirrors backend `presentation_surfaces.SURFACES`). */
const SURFACE_MEDIA: Readonly<Record<PresentationSurface, ReadonlySet<MessageAttachmentKind>>> = {
  image: new Set(['image']),
  voice: new Set(['audio']),
  collection_card: new Set(['image', 'audio', 'file']),
};
const SURFACES: ReadonlySet<string> = new Set(Object.keys(SURFACE_MEDIA));
const KEY_PATTERN = /^(assistant_artifact|user_collection_show):[1-9]\d*$/;
const OWNER_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const ITEM_KINDS: ReadonlySet<string> = new Set<CollectionKind>(['text', 'image', 'audio', 'document']);
const TEXT_LIMIT = 2000;
const NO_LEGACY = new Map();

function nonEmpty(value: string | null): string | null {
  return value !== null && value.trim().length > 0 ? value : null;
}

function parseCard(raw: unknown, key: string): CollectionShowCard | null {
  if (!isRecord(raw)) return null;
  const { item_id, item_kind, title, detail, text } = raw;
  if (!isPositiveInt(item_id)) return null;
  if (typeof item_kind !== 'string' || !ITEM_KINDS.has(item_kind)) return null;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > TEXT_LIMIT) return null;
  // The reason (detail) and the text snapshot are uncapped (#54 / #61).
  if (detail !== null && typeof detail !== 'string') return null;
  if (text !== null && typeof text !== 'string') return null;
  if (item_kind !== 'text' && text !== null) return null;
  return {
    key,
    itemId: item_id,
    itemKind: item_kind as CollectionKind,
    title,
    detail: nonEmpty(detail),
    text,
  };
}

function parseMedia(raw: unknown, surface: PresentationSurface): MessageAttachmentView | null {
  const media = parseCanonicalAttachmentItem(raw, NO_LEGACY);
  if (
    media === null ||
    media.ref.type !== 'message_attachment' ||
    media.status !== 'ready' ||
    !SURFACE_MEDIA[surface].has(media.kind)
  ) {
    return null;
  }
  return media;
}

function parsePresentation(candidate: unknown): PresentationView | null {
  if (!isRecord(candidate)) return null;
  const { key, surface, owner, position, label, card, media } = candidate;
  // Fail closed: only an explicit true offers the item for collection (#74).
  const collectible = candidate.collectible === true;
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) return null;
  if (typeof surface !== 'string' || !SURFACES.has(surface)) return null;
  if (typeof owner !== 'string' || !OWNER_PATTERN.test(owner)) return null;
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) return null;
  if (typeof label !== 'string' || label.trim().length === 0 || label.length > TEXT_LIMIT) return null;
  const typed = surface as PresentationSurface;

  if (typed === 'collection_card') {
    const parsedCard = parseCard(card, key);
    if (parsedCard === null) return null;
    const parsedMedia = media === null ? null : parseMedia(media, typed);
    if (media !== null && parsedMedia === null) return null;
    return { key, surface: typed, owner, position, label, card: parsedCard, media: parsedMedia, collectible };
  }

  if (card !== null) return null;
  const parsedMedia = parseMedia(media, typed);
  if (parsedMedia === null) return null;
  return { key, surface: typed, owner, position, label, card: null, media: parsedMedia, collectible };
}

/**
 * Normalizes `presentations[]` (#84) fail-closed: a non-array yields `[]`;
 * unknown surfaces and malformed items are dropped individually without
 * affecting siblings; duplicate keys collapse. Order is the backend order.
 */
export function normalizePresentations(raw: unknown): PresentationView[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, PresentationView>();
  for (const candidate of raw) {
    const item = parsePresentation(candidate);
    if (item && !byKey.has(item.key)) byKey.set(item.key, item);
  }
  return [...byKey.values()];
}
