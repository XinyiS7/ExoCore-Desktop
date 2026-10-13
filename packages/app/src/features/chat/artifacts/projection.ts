import type { AssistantArtifactKind, AssistantArtifactView } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// Audio artifacts have no user card (#51 E5); the audio player is their only surface.
const VALID_KINDS = new Set<AssistantArtifactKind>(['image', 'file']);
/**
 * Collection bring-back cards (#54): all four item kinds, and the detail is the
 * verbatim item text/metadata, so it is not capped. Media still render once
 * through `MessageAttachments`; a fallback `file` keeps the item-kind title.
 */
export const COLLECTION_PRODUCERS: ReadonlySet<string> = new Set([
  'collection_bring_back',
  'collection_heartbeat_bring_back',
]);
const COLLECTION_KINDS = new Set<AssistantArtifactKind>(['text', 'image', 'audio', 'file']);
const PRODUCER_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const TEXT_LIMIT = 2000;

function parseRef(raw: unknown, type: string): number | null {
  if (!isRecord(raw) || raw.type !== type || !isPositiveInt(raw.id)) return null;
  return raw.id;
}

function parseArtifactItem(candidate: unknown): AssistantArtifactView | null {
  if (!isRecord(candidate)) return null;

  const id = parseRef(candidate.ref, 'assistant_artifact');
  if (id === null) return null;

  const { producer, kind, position, collectible, human } = candidate;
  if (typeof producer !== 'string' || !PRODUCER_PATTERN.test(producer)) return null;
  const isCollection = COLLECTION_PRODUCERS.has(producer);
  const kinds = isCollection ? COLLECTION_KINDS : VALID_KINDS;
  if (typeof kind !== 'string' || !kinds.has(kind as AssistantArtifactKind)) return null;
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) return null;
  if (typeof collectible !== 'boolean') return null;

  if (!isRecord(human)) return null;
  const { title, detail } = human;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > TEXT_LIMIT) {
    return null;
  }
  if (
    detail !== null &&
    (typeof detail !== 'string' || (!isCollection && detail.length > TEXT_LIMIT))
  ) {
    return null;
  }

  let presentationAttachmentKey: string | null = null;
  if (candidate.presentation_attachment !== null) {
    const attachmentId = parseRef(candidate.presentation_attachment, 'message_attachment');
    if (attachmentId === null) return null;
    presentationAttachmentKey = `message_attachment:${attachmentId}`;
  }

  return {
    key: `assistant_artifact:${id}`,
    id,
    producer,
    kind: kind as AssistantArtifactKind,
    position,
    title,
    detail: detail && detail.trim().length > 0 ? detail : null,
    collectible,
    presentationAttachmentKey,
  };
}

/**
 * Normalizes `assistant_artifacts[]` fail-closed: a non-array yields `[]`,
 * malformed items are dropped individually and duplicates by key are
 * collapsed. Output order is the backend render order (position, producer, id).
 */
export function normalizeAssistantArtifacts(raw: unknown): AssistantArtifactView[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, AssistantArtifactView>();
  for (const candidate of raw) {
    const item = parseArtifactItem(candidate);
    if (item && !byKey.has(item.key)) byKey.set(item.key, item);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.position - b.position ||
      (a.producer < b.producer ? -1 : a.producer > b.producer ? 1 : 0) ||
      a.id - b.id,
  );
}
