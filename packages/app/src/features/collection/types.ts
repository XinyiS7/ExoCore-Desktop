/**
 * V4 Collection domain types (B1 / Issue #32 Step 1B).
 */

export type CollectOutcome = 'created' | 'already_collected';

export interface CollectMessageSource {
  type: 'message';
  message_id: number;
  text: string;
}

/** Collectible chat sources other than message text (#74, ReactSheet §13.3). */
export type CollectSource =
  | { type: 'attachment'; provenance_id: string }
  | { type: 'assistant_artifact'; artifact_id: number };

export interface CollectMessagePayload {
  source: CollectMessageSource | CollectSource;
  collection_context?: string;
}

export interface CollectMessageInput {
  messageId: number;
  /**
   * CANONICAL MessageView.content verbatim.
   * MUST NEVER be trimmed or rewritten (backend uses exact equality to determine full message scope).
   */
  content: string;
  context?: string;
}

export interface CollectSourceInput {
  source: CollectSource;
  context?: string;
}

export interface CollectMessageResult {
  id: number;
  collectOutcome: CollectOutcome;
}

/*
 * V4 Library browse/detail projections (Issue #61, ReactSheet §13.2–13.4).
 * Field names mirror the backend wire shape, like River's read projections.
 */

export const COLLECTION_KINDS = ['text', 'image', 'audio', 'document'] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export const COLLECTION_SOURCE_TYPES = [
  'attachment',
  'text',
  'message',
  'chronicle_highlight',
  'assistant_artifact',
] as const;
export type CollectionSourceType = (typeof COLLECTION_SOURCE_TYPES)[number];

export interface CollectionListItem {
  id: number;
  kind: CollectionKind;
  title: string;
  description: string;
  collection_context: string;
  preview: string;
  tags: string[];
  source: { type: CollectionSourceType; key: string };
  collected_at: string;
  updated_at: string;
}

export interface CollectionPage {
  items: CollectionListItem[];
  next_cursor: string | null;
}

/** Canonical source-Message coordinates (`source.snapshot.message`); null when undeterminable. */
export interface CollectionSourceMessage {
  message_id: number;
  conversation_id: number;
  index_in_session: number;
  role: string;
  created_at: string;
}

export const REPRESENTATION_KINDS = ['image_preview', 'audio_playback', 'document_extracted_text'] as const;
export type RepresentationKind = (typeof REPRESENTATION_KINDS)[number];

export const REPRESENTATION_STATES = ['pending', 'succeeded', 'failed', 'unavailable'] as const;
export type RepresentationState = (typeof REPRESENTATION_STATES)[number];

export interface CollectionRepresentation {
  kind: RepresentationKind;
  state: RepresentationState;
  canonical_text: string;
  content_url: string | null;
  artifact_mime_type: string;
  producer_type: string;
  producer_version: string;
  model_identity: string;
  attempt_count: number;
  retryable: boolean;
  retry_url: string | null;
  error_code: string;
  updated_at: string;
}

export interface CollectionAsset {
  sha256: string;
  file_size: number;
  mime_type: string;
  status: string;
}

export interface CollectionComment {
  id: number;
  author_type: 'human' | 'agent';
  author_label: string;
  body: string;
  created_at: string;
  can_delete: boolean;
}

export interface CollectionViewerStat {
  viewer_type: 'human' | 'agent';
  viewer_key: string;
  label: string;
  view_count: number;
  show_count: number;
  collect_count: number;
  last_viewed_at: string | null;
}

export interface CollectionDetail extends Omit<CollectionListItem, 'source'> {
  source: {
    type: CollectionSourceType;
    key: string;
    available: boolean;
    message: CollectionSourceMessage | null;
  };
  text_content: string;
  asset: CollectionAsset | null;
  representations: CollectionRepresentation[];
  capabilities: string[];
  original_content_url: string | null;
  comments: CollectionComment[];
  viewer_stats: CollectionViewerStat[];
}

export interface CollectionTag {
  name: string;
  normalized_name: string;
  item_count: number;
}

export interface CollectionViewResult {
  view_count: number;
  last_viewed_at: string;
}

/** Wall filters; each maps 1:1 to a `GET /items/` query parameter. */
export interface CollectionFilters {
  kind?: CollectionKind;
  tag?: string;
  q?: string;
  recent?: boolean;
  month?: string;
  link?: boolean;
}

export interface CollectionItemPatch {
  title?: string;
  description?: string;
  collection_context?: string;
  tags?: string[];
  manual_representation?: { kind: 'document_extracted_text'; canonical_text: string };
}
