import type {
  AttachmentMeta,
  AttachmentRef,
  AttachmentRefType,
  MessageAttachmentKind,
  MessageAttachmentStatus,
  MessageAttachmentView,
} from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const VALID_REF_TYPES = new Set<AttachmentRefType>(['session_attachment', 'message_attachment']);
const VALID_KINDS = new Set<MessageAttachmentKind>(['audio', 'image', 'file']);
const VALID_STATUSES = new Set<MessageAttachmentStatus>(['pending', 'ready', 'failed']);

function parseAttachmentRef(raw: unknown): AttachmentRef | null {
  if (!isRecord(raw)) return null;
  const { type, id } = raw;
  if (
    typeof type !== 'string' ||
    !VALID_REF_TYPES.has(type as AttachmentRefType) ||
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }
  return { type: type as AttachmentRefType, id };
}

function parseCanonicalAttachmentItem(
  candidate: unknown,
  legacyMap: Map<number, AttachmentMeta>,
): MessageAttachmentView | null {
  if (!isRecord(candidate)) return null;

  const ref = parseAttachmentRef(candidate.ref);
  if (!ref) return null;

  const kind = candidate.kind;
  if (typeof kind !== 'string' || !VALID_KINDS.has(kind as MessageAttachmentKind)) {
    return null;
  }

  const source = candidate.source;
  if (typeof source !== 'string' || source.length === 0 || source.length > 128) {
    return null;
  }

  const status = candidate.status;
  if (typeof status !== 'string' || !VALID_STATUSES.has(status as MessageAttachmentStatus)) {
    return null;
  }

  const position = candidate.position;
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) {
    return null;
  }

  const displayName = candidate.display_name;
  if (typeof displayName !== 'string' || displayName.trim().length === 0) {
    return null;
  }

  const mimeType = candidate.mime_type;
  if (mimeType !== null && (typeof mimeType !== 'string' || mimeType.length === 0)) {
    return null;
  }

  const fileSize = candidate.file_size;
  if (
    fileSize !== null &&
    (typeof fileSize !== 'number' || !Number.isInteger(fileSize) || fileSize < 0)
  ) {
    return null;
  }

  const contentUrl = candidate.content_url;
  if (contentUrl !== null && typeof contentUrl !== 'string') {
    return null;
  }

  const durationMs = candidate.duration_ms;
  if (
    durationMs !== null &&
    (typeof durationMs !== 'number' || !Number.isInteger(durationMs) || durationMs < 0)
  ) {
    return null;
  }

  const errorCode = candidate.error_code;
  if (errorCode !== null && typeof errorCode !== 'string') {
    return null;
  }

  const key = `${ref.type}:${ref.id}`;
  const view: MessageAttachmentView = {
    key,
    ref,
    kind: kind as MessageAttachmentKind,
    source,
    status: status as MessageAttachmentStatus,
    position,
    displayName,
    mimeType: mimeType ?? null,
    fileSize: fileSize ?? null,
    contentUrl: contentUrl ?? null,
    durationMs: durationMs ?? null,
    errorCode: errorCode ?? null,
  };

  // For a canonical session row, legacy meta with matching id may supply file_uri / original_filename
  // without overriding canonical status, source, kind, position, or content URL.
  if (ref.type === 'session_attachment') {
    const legacy = legacyMap.get(ref.id);
    if (legacy) {
      if (typeof legacy.file_uri === 'string') {
        view.fileUri = legacy.file_uri;
      }
      if (typeof legacy.original_filename === 'string') {
        view.originalFilename = legacy.original_filename;
      }
    }
  }

  return view;
}

function parseLegacyMetaItem(item: unknown, index: number): MessageAttachmentView | null {
  if (!isRecord(item)) return null;
  const id = item.id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;

  const mimeType = typeof item.mime_type === 'string' ? item.mime_type : null;
  const isAudio = Boolean(mimeType?.startsWith('audio/'));
  const isImage = Boolean(mimeType?.startsWith('image/'));
  const kind: MessageAttachmentKind = isAudio ? 'audio' : isImage ? 'image' : 'file';

  const displayName =
    typeof item.display_name === 'string' && item.display_name.trim().length > 0
      ? item.display_name
      : typeof item.original_filename === 'string' && item.original_filename.trim().length > 0
        ? item.original_filename
        : '附件';

  return {
    key: `session_attachment:${id}`,
    ref: { type: 'session_attachment', id },
    kind,
    source: 'user',
    status: 'ready',
    position: index,
    displayName,
    mimeType,
    fileSize:
      typeof item.file_size === 'number' && Number.isInteger(item.file_size) && item.file_size >= 0
        ? item.file_size
        : null,
    contentUrl: typeof item.content_url === 'string' ? item.content_url : null,
    durationMs: null,
    errorCode: null,
    fileUri: typeof item.file_uri === 'string' ? item.file_uri : null,
    originalFilename: typeof item.original_filename === 'string' ? item.original_filename : null,
  };
}

/**
 * Normalizes message attachments fail-closed.
 *
 * - If canonical `attachments` is an Array:
 *   - Canonical controls membership.
 *   - Preserves server order (never client-sorts).
 *   - Drops malformed items fail-closed without dropping valid siblings or message.
 *   - Enriches `session_attachment` items with legacy `file_uri`/`original_filename`.
 * - If canonical `attachments` is absent (undefined / null) or not an Array:
 *   - Falls back to `attachments_meta` membership.
 */
export function normalizeMessageAttachments(
  attachmentsRaw: unknown,
  metaRaw: unknown,
): MessageAttachmentView[] {
  const legacyMap = new Map<number, AttachmentMeta>();
  if (Array.isArray(metaRaw)) {
    for (const item of metaRaw) {
      if (isRecord(item) && typeof item.id === 'number' && Number.isInteger(item.id) && item.id > 0) {
        legacyMap.set(item.id, item as unknown as AttachmentMeta);
      }
    }
  }

  // Canonical attachments[] present as an Array: canonical controls membership.
  if (Array.isArray(attachmentsRaw)) {
    const out: MessageAttachmentView[] = [];
    for (const candidate of attachmentsRaw) {
      const item = parseCanonicalAttachmentItem(candidate, legacyMap);
      if (item) {
        out.push(item);
      }
    }
    return out;
  }

  // Fallback to legacy meta membership when canonical is absent or malformed (non-array).
  if (Array.isArray(metaRaw)) {
    const out: MessageAttachmentView[] = [];
    let idx = 0;
    for (const item of metaRaw) {
      const view = parseLegacyMetaItem(item, idx);
      if (view) {
        out.push(view);
        idx++;
      }
    }
    return out;
  }

  return [];
}
