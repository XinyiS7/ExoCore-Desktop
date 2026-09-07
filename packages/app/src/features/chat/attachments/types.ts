/**
 * P1C Attachment DTOs — typed wire contract for the frozen attachment endpoints
 * (Plan §2.3, Scout §3.1).
 *
 * Ownership rule (frozen): `results` is the SOLE authority for success and
 * positive attachment IDs. Compatibility `attachments`/`failures` may enrich
 * matching diagnostics but must never manufacture or override a result.
 */

// ── Upload wire contract ──────────────────────────────────────────────────

export interface AttachmentDiagnostic {
  stage: string;
  code: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

/** Attachment row embedded in a successful upload result. */
export interface AttachmentUploadRow {
  id: number;
  display_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
}

export type UploadResultStatus = 'ok' | 'ok_degraded' | 'failed';

/** One authoritative per-input upload result, ordered by `input_index`. */
export interface UploadResultItem {
  input_index: number;
  status: UploadResultStatus;
  attachment: AttachmentUploadRow | null;
  diagnostics: AttachmentDiagnostic[];
}

/** Compatibility failure entry (never the ownership source). */
export interface UploadFailureItem {
  input_index: number;
  display_name: string;
  mime_type: string;
  stage: string;
  code: string;
  message: string;
  reason: string;
  diagnostics: AttachmentDiagnostic[];
}

/** Full body of a 201 (at least one success) or 422 (all failed) response. */
export interface AttachmentUploadPayload {
  attachments?: AttachmentUploadRow[];
  failures?: UploadFailureItem[];
  results?: UploadResultItem[];
  /** Present on 422 all-failed responses. */
  error?: string;
}

/**
 * Normalized upload outcome. 201 and 422 both carry the complete ordered
 * `results`; every other status is a transport/HTTP error surfaced as
 * `AppApiError` (not a partial success).
 */
export type AttachmentUploadOutcome =
  | { status: 201; payload: AttachmentUploadPayload }
  | { status: 422; payload: AttachmentUploadPayload };

// ── List wire contract ────────────────────────────────────────────────────

export type AttachmentSource = 'user' | 'tool_collection';

/** Bare mixed-source list row (GET .../attachments/). */
export interface AttachmentListRow {
  source: AttachmentSource;
  id: number | string;
  display_name: string;
  /** Present for `user` rows; never rendered or used as a URL (KF-10). */
  storage_path: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  original_filename?: string | null;
  created_at?: string | null;
  /** tool_collection-only fields; parsed but never exposed as P1C controls. */
  char_count?: number | null;
  is_summary?: boolean | null;
  is_expired?: boolean | null;
}

// ── Delete wire contract ──────────────────────────────────────────────────

export interface DeleteAttachmentBody {
  source: AttachmentSource;
  id: number | string;
}

/** Frozen-cache 409 body — fields preserved verbatim for guidance display. */
export interface FrozenCacheDeleteBody {
  error: string;
  detail: string;
  frozen_in_cache: true;
  cache_name?: string;
}

export type DeleteAttachmentOutcome =
  | { ok: true; status: 204 }
  | { ok: false; status: 409; frozen: true; message: string; body: FrozenCacheDeleteBody }
  | { ok: false; status: number; frozen: false; message: string };

// ── Audio target wire contract ────────────────────────────────────────────

/** Resolved automatic current target (model + integer endpoint). */
export interface AudioTarget {
  model: string;
  endpoint: number;
}

// ── Compose-local DTO ─────────────────────────────────────────────────────

export type ComposeEntryStatus = 'uploading' | 'ok' | 'ok_degraded' | 'failed';

/** One selected input bound to a stable client id and exactly one visible state. */
export interface ComposeAttachmentEntry {
  clientId: number;
  /** Original File — retained only while the entry lives (never persisted). */
  file: File;
  /** Local preview for images only; an object URL owned by this entry. */
  preview: string | null;
  name: string;
  type: string;
  size: number;
  status: ComposeEntryStatus;
  /** Positive attachment id, present only on ok / ok_degraded. */
  attachmentId: number | null;
  /** Safe diagnostics surfaced by the UI (never server stack traces). */
  diagnostics: AttachmentDiagnostic[];
}