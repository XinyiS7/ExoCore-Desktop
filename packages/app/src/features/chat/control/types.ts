/**
 * P1D control-domain DTOs — cache, conversation preference patch, project
 * context (Plan Task 1 / §6.3–§6.6).
 *
 * Every row is validated at the API boundary (`control/api.ts`); malformed
 * payloads surface as CONTRACT errors, never as silently empty success.
 * No trace DTO is declared here — Task 6 waits for the frozen backend
 * AssistantRunTrace handoff.
 */

// ── Conversation preference patch ───────────────────────────────────────────

/** Canonical conversation thinking levels (ReactSheet §1.2, Plan D5). */
export const THINKING_LEVELS = ['off', 'auto', 'low', 'medium', 'high', 'max'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return THINKING_LEVELS.includes(value as ThinkingLevel);
}

/** g045-only memory injection preference (conversation-local, default true). */
export interface MemoryInjectionPreference {
  enabled: boolean;
}

// ── Cache status (GET /api/agents/conversations/<id>/cache/) ────────────────

/**
 * Validated backend cache response.
 * - `expires_at` / `remaining_seconds` are present only while `active` is true;
 * - `has_snapshot` is always present (local cache_chunk snapshot);
 * - `platform` is always present.
 */
export interface CacheStatusView {
  active: boolean;
  platform: string;
  /** ISO timestamp of the remote-cache expiry; absent when inactive. */
  expiresAt: string | null;
  /** Backend-supplied remaining seconds; absent when inactive. */
  remainingSeconds: number | null;
  renewals: number | null;
  ttlSeconds: number | null;
  cacheName: string | null;
  model: string | null;
  hasSnapshot: boolean;
  snapshotCacheEndIdx: number | null;
}

/** Discriminated presentation projection of the cache truth (Plan §6.4). */
export type CachePresentation =
  | { state: 'loading' }
  | { state: 'active'; cache: CacheStatusView }
  | { state: 'snapshot_only'; cache: CacheStatusView }
  | { state: 'empty'; cache: CacheStatusView }
  | { state: 'error'; message: string };

// ── Project context (core) ───────────────────────────────────────────────────

/** Project detail row (GET /api/core/projects/<id>/). */
export interface ProjectDetailRow {
  id: number;
  name: string;
  description: string | null;
  prompt: string | null;
  workDir: string | null;
  createdAt: string;
}

/** Uploaded ProjectFile reference row (read-only, §4.3/§6.6). */
export interface ProjectFileRow {
  id: number;
  name: string;
  fileType: string;
  size: number;
  /** Absolute content URL served by the backend; never a local path. */
  url: string | null;
  previewUrl: string | null;
  createdAt: string;
}

/**
 * Work-directory tree entry.
 * Recursive root tree may nest `entries` on dirs; a `?path=` single-level
 * response never carries nested children (a dir without `entries` is a shell
 * that must be expanded through one exact-path fetch).
 */
export interface ProjectTreeEntry {
  name: string;
  type: 'dir' | 'file';
  /** Workspace-relative POSIX-style path (`a/b.txt`). */
  path: string;
  size: number | null;
  entries: ProjectTreeEntry[] | null;
}

export interface ProjectTreeEnvelope {
  /** The requested relative path ('' for root). */
  path: string;
  entries: ProjectTreeEntry[];
}

/** Tree fetch target — root or one exact work-dir-relative directory path. */
export type ProjectTreeRequest =
  | { kind: 'root' }
  | { kind: 'level'; path: string };