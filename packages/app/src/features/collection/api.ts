import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import {
  COLLECTION_KINDS,
  COLLECTION_SOURCE_TYPES,
  REPRESENTATION_KINDS,
  REPRESENTATION_STATES,
  type CollectMessageInput,
  type CollectMessagePayload,
  type CollectMessageResult,
  type CollectOutcome,
  type CollectSourceInput,
  type CollectionAsset,
  type CollectionComment,
  type CollectionDetail,
  type CollectionFilters,
  type CollectionItemPatch,
  type CollectionListItem,
  type CollectionPage,
  type CollectionRepresentation,
  type CollectionSourceMessage,
  type CollectionTag,
  type CollectionViewResult,
  type CollectionViewerStat,
  type RepresentationKind,
} from './types';

/**
 * Domain error for Collection API interactions, preserving backend error message and code.
 */
export class CollectionApiError extends AppApiError {
  constructor(cause: AppApiError) {
    const body = cause.body;
    const fields =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const message =
      typeof fields.error === 'string'
        ? fields.error
        : typeof fields.message === 'string'
          ? fields.message
          : cause.message;
    const code = typeof fields.code === 'string' ? fields.code : cause.code;
    super(message, {
      status: cause.status,
      body,
      code,
    });
  }
}

/**
 * Collect a message by creating a new collection item (201 created) or incrementing
 * the collect count on an existing collection item (200 already_collected).
 *
 * Contract requirements (Issue #32 Step 1B):
 * - Endpoint: POST /api/collection/items/ (strictly preserve trailing slash)
 * - Source text: canonical MessageView.content verbatim (NEVER trim or rewrite)
 * - Note: optional collection_context (sent if non-empty)
 */
export async function collectMessage(input: CollectMessageInput): Promise<CollectMessageResult> {
  const payload: CollectMessagePayload = {
    source: {
      type: 'message',
      message_id: input.messageId,
      text: input.content,
    },
  };

  return postCollect(payload, input.context);
}

/** Collect a user attachment or an AI artifact (#74); same outcome contract as messages. */
export async function collectSource(input: CollectSourceInput): Promise<CollectMessageResult> {
  return postCollect({ source: input.source }, input.context);
}

async function postCollect(
  payload: CollectMessagePayload,
  context: string | undefined,
): Promise<CollectMessageResult> {
  const trimmedContext = context?.trim();
  if (trimmedContext) {
    payload.collection_context = trimmedContext;
  }

  try {
    const res = await apiFetch('/api/collection/items/', {
      method: 'POST',
      body: payload,
    });

    if (typeof res !== 'object' || res === null || Array.isArray(res)) {
      throw contractError('收藏响应格式异常', res);
    }

    const row = res as Record<string, unknown>;
    const outcome = row.collect_outcome;
    if (outcome !== 'created' && outcome !== 'already_collected') {
      throw contractError('收藏响应缺少合法的 collect_outcome', res);
    }

    if (!Number.isInteger(row.id)) {
      throw contractError('收藏响应缺少合法的整数 id', res);
    }
    return {
      id: row.id as number,
      collectOutcome: outcome as CollectOutcome,
    };
  } catch (err: unknown) {
    const appError = toAppApiError(err);
    throw new CollectionApiError(appError);
  }
}

/* ---- V4 Library browse / detail (Issue #61, ReactSheet §13.2–13.4) ---- */

const ITEMS_PATH = '/api/collection/items/';
const itemPath = (id: number) => `${ITEMS_PATH}${id}/`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw contractError('藏品数据格式异常', value);
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw contractError('藏品文本字段异常', value);
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}
function timestamp(value: unknown): string {
  const result = text(value);
  if (Number.isNaN(Date.parse(result))) throw contractError('藏品时间字段异常', value);
  return result;
}
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw contractError('藏品数值字段异常', value);
  }
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw contractError('藏品布尔字段异常', value);
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw contractError('藏品列表字段异常', value);
  }
  return [...value];
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw contractError('藏品枚举字段异常', value);
  return value as T;
}
function list<T>(value: unknown, item: (row: unknown) => T): T[] {
  if (!Array.isArray(value)) throw contractError('藏品列表字段异常', value);
  return value.map(item);
}

export function normalizeCollectionListItem(value: unknown): CollectionListItem {
  const row = record(value);
  const id = integer(row.id, 1);
  const target = record(row.target);
  if (target.type !== 'collection_item' || target.id !== id) {
    throw contractError('藏品定位不一致', value);
  }
  const source = record(row.source);
  return {
    id,
    kind: choice(row.kind, COLLECTION_KINDS),
    title: text(row.title),
    description: text(row.description),
    collection_context: text(row.collection_context),
    preview: text(row.preview),
    tags: strings(row.tags),
    source: { type: choice(source.type, COLLECTION_SOURCE_TYPES), key: text(source.key) },
    collected_at: timestamp(row.collected_at),
    updated_at: timestamp(row.updated_at),
  };
}

export function normalizeCollectionPage(value: unknown): CollectionPage {
  const row = record(value);
  const cursor = row.next_cursor;
  if (!(cursor === null || (typeof cursor === 'string' && cursor.length > 0))) {
    throw contractError('藏品分页格式异常', value);
  }
  return { items: list(row.items, normalizeCollectionListItem), next_cursor: cursor };
}

/** Items collected before the nested snapshot existed carry no `message` key. */
function normalizeSourceMessage(value: unknown): CollectionSourceMessage | null {
  if (value === null || value === undefined) return null;
  const row = record(value);
  return {
    message_id: integer(row.message_id, 1),
    conversation_id: integer(row.conversation_id, 1),
    index_in_session: integer(row.index_in_session),
    role: text(row.role),
    created_at: timestamp(row.created_at),
  };
}

function normalizeRepresentation(value: unknown): CollectionRepresentation {
  const row = record(value);
  return {
    kind: choice(row.kind, REPRESENTATION_KINDS),
    state: choice(row.state, REPRESENTATION_STATES),
    canonical_text: text(row.canonical_text),
    content_url: nullableText(row.content_url),
    artifact_mime_type: text(row.artifact_mime_type),
    producer_type: text(row.producer_type),
    producer_version: text(row.producer_version),
    model_identity: text(row.model_identity),
    attempt_count: integer(row.attempt_count),
    retryable: boolean(row.retryable),
    retry_url: nullableText(row.retry_url),
    error_code: text(row.error_code),
    updated_at: timestamp(row.updated_at),
  };
}

function normalizeAsset(value: unknown): CollectionAsset | null {
  if (value === null) return null;
  const row = record(value);
  return {
    sha256: text(row.sha256),
    file_size: integer(row.file_size),
    mime_type: text(row.mime_type),
    status: text(row.status),
  };
}

function normalizeComment(value: unknown): CollectionComment {
  const row = record(value);
  return {
    author_type: choice(row.author_type, ['human', 'agent'] as const),
    author_label: text(row.author_label),
    body: text(row.body),
    created_at: timestamp(row.created_at),
  };
}

function normalizeViewerStat(value: unknown): CollectionViewerStat {
  const row = record(value);
  return {
    viewer_type: choice(row.viewer_type, ['human', 'agent'] as const),
    viewer_key: text(row.viewer_key),
    label: text(row.label),
    view_count: integer(row.view_count),
    show_count: integer(row.show_count),
    collect_count: integer(row.collect_count),
    last_viewed_at: row.last_viewed_at === null ? null : timestamp(row.last_viewed_at),
  };
}

export function normalizeCollectionDetail(value: unknown): CollectionDetail {
  const base = normalizeCollectionListItem(value);
  const row = record(value);
  const source = record(row.source);
  const snapshot = record(source.snapshot);
  return {
    ...base,
    source: {
      ...base.source,
      available: boolean(source.available),
      message: normalizeSourceMessage(snapshot.message),
    },
    text_content: text(row.text_content),
    asset: normalizeAsset(row.asset),
    representations: list(row.representations, normalizeRepresentation),
    capabilities: strings(row.capabilities),
    original_content_url: nullableText(row.original_content_url),
    comments: list(row.comments, normalizeComment),
    viewer_stats: list(row.viewer_stats, normalizeViewerStat),
  };
}

export function normalizeCollectionTags(value: unknown): CollectionTag[] {
  return list(record(value).items, (item) => {
    const row = record(item);
    return {
      name: text(row.name),
      normalized_name: text(row.normalized_name),
      item_count: integer(row.item_count, 1),
    };
  });
}

export function normalizeViewResult(value: unknown): CollectionViewResult {
  const row = record(value);
  return { view_count: integer(row.view_count, 1), last_viewed_at: timestamp(row.last_viewed_at) };
}

/** Exact `GET /items/` parameters: off/empty filters are omitted, never sent as `0`. */
export function collectionListParams(filters: CollectionFilters, cursor: string | null, limit: number) {
  return {
    limit,
    cursor: cursor ?? undefined,
    kind: filters.kind,
    tag: filters.tag || undefined,
    q: filters.q || undefined,
    recent: filters.recent ? 1 : undefined,
    month: filters.month || undefined,
    link: filters.link ? 1 : undefined,
  };
}

async function collectionRequest<T>(run: () => Promise<unknown>, normalize: (raw: unknown) => T): Promise<T> {
  try {
    return normalize(await run());
  } catch (cause) {
    throw new CollectionApiError(toAppApiError(cause));
  }
}

export function listCollectionItems(
  filters: CollectionFilters,
  cursor: string | null,
  limit: number,
  signal?: AbortSignal,
): Promise<CollectionPage> {
  return collectionRequest(
    () => apiFetch(ITEMS_PATH, { method: 'GET', signal, params: collectionListParams(filters, cursor, limit) }),
    normalizeCollectionPage,
  );
}

export function getCollectionItem(id: number, signal?: AbortSignal): Promise<CollectionDetail> {
  return collectionRequest(() => apiFetch(itemPath(id), { method: 'GET', signal }), normalizeCollectionDetail);
}

export function patchCollectionItem(id: number, patch: CollectionItemPatch): Promise<CollectionDetail> {
  return collectionRequest(() => apiFetch(itemPath(id), { method: 'PATCH', body: patch }), normalizeCollectionDetail);
}

export function deleteCollectionItem(id: number): Promise<void> {
  return collectionRequest(() => apiFetch(itemPath(id), { method: 'DELETE' }), () => undefined);
}

export function retryCollectionRepresentation(id: number, kind: RepresentationKind): Promise<CollectionDetail> {
  return collectionRequest(
    () => apiFetch(`${itemPath(id)}representations/${kind}/retry/`, { method: 'POST' }),
    normalizeCollectionDetail,
  );
}

export function recordCollectionView(id: number): Promise<CollectionViewResult> {
  return collectionRequest(() => apiFetch(`${itemPath(id)}view/`, { method: 'POST' }), normalizeViewResult);
}

export function listCollectionTags(signal?: AbortSignal): Promise<CollectionTag[]> {
  return collectionRequest(
    () => apiFetch('/api/collection/tags/', { method: 'GET', signal }),
    normalizeCollectionTags,
  );
}

/** Public same-origin preview path (ReactSheet §13.2); thumbnails fall back on error. */
export const collectionImagePreviewUrl = (id: number) => `${itemPath(id)}representations/image_preview/content/`;

/**
 * Merge a recorded view into the human statistics row so this opening shows
 * the new count at once; the human row is added first when absent.
 */
export function mergeViewIntoDetail(detail: CollectionDetail, view: CollectionViewResult): CollectionDetail | null {
  // No human row yet: the backend owns its identity/label, so the caller refetches instead.
  const index = detail.viewer_stats.findIndex((stat) => stat.viewer_type === 'human');
  if (index < 0) return null;
  const viewer_stats = [...detail.viewer_stats];
  viewer_stats[index] = { ...viewer_stats[index], ...view };
  return { ...detail, viewer_stats };
}
