/**
 * P1D typed control adapters (Plan Task 1, §6.3–§6.6).
 *
 * Same discipline as `features/chat/api.ts`: exo-shared transport unmodified,
 * every envelope guarded here, normalization only at this boundary.
 * Backend facts verified against source (Construction Evidence §2):
 * - cache GET/DELETE/renew semantics incl. 204 release + background rebuild;
 * - Conversation PATCH accepts `thinking_level` / `memory_injection_enabled`;
 * - project tree `?path=` single-level vs recursive root, 400/403/404 errors.
 */
import { apiFetch } from 'exo-shared/api';
import { AppApiError, toAppApiError } from '../api';
import {
  isThinkingLevel,
  type CacheStatusView,
  type ProjectDetailRow,
  type ProjectFileRow,
  type ProjectTreeEnvelope,
  type ProjectTreeEntry,
  type ProjectTreeRequest,
  type ThinkingLevel,
} from './types';

/** Local contract-error factory — `contractError` in `../api` is private. */
function contractError(message: string, body: unknown): AppApiError {
  return new AppApiError(message, { body, code: 'CONTRACT' });
}

// ── Cache ────────────────────────────────────────────────────────────────────

function parseIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

/**
 * Validate the cache wire row into the strict CacheStatusView.
 * `expires_at` + nonnegative `remaining_seconds` are REQUIRED while active;
 * `has_snapshot`/`platform` are always required. Optional garnish fields
 * (renewals/ttl/cache_name/model) degrade to null — they never gate truth.
 */
export function validateCacheStatus(raw: unknown): CacheStatusView {
  if (typeof raw !== 'object' || raw === null) {
    throw contractError('缓存状态接口返回格式异常', raw);
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.active !== 'boolean') {
    throw contractError('缓存状态缺少 active 布尔字段', raw);
  }
  if (typeof row.platform !== 'string') {
    throw contractError('缓存状态缺少 platform 字段', raw);
  }
  if (typeof row.has_snapshot !== 'boolean') {
    throw contractError('缓存状态缺少 has_snapshot 布尔字段', raw);
  }

  let expiresAt: string | null = null;
  let remainingSeconds: number | null = null;
  if (row.active) {
    if (typeof row.expires_at !== 'string' || !parseIsoTimestamp(row.expires_at)) {
      throw contractError('活动缓存缺少有效的 expires_at', raw);
    }
    if (typeof row.remaining_seconds !== 'number' || !Number.isFinite(row.remaining_seconds) || row.remaining_seconds < 0) {
      throw contractError('活动缓存缺少非负 remaining_seconds', raw);
    }
    expiresAt = row.expires_at;
    remainingSeconds = row.remaining_seconds;
  }

  const snapshotCacheEndIdx =
    row.snapshot_cache_end_idx === null || row.snapshot_cache_end_idx === undefined
      ? null
      : typeof row.snapshot_cache_end_idx === 'number' && Number.isInteger(row.snapshot_cache_end_idx) && (row.snapshot_cache_end_idx as number) >= 0
        ? (row.snapshot_cache_end_idx as number)
        : null;

  return {
    active: row.active,
    platform: row.platform,
    expiresAt,
    remainingSeconds,
    renewals: typeof row.renewals === 'number' ? row.renewals : null,
    ttlSeconds: typeof row.ttl_seconds === 'number' ? row.ttl_seconds : null,
    cacheName: typeof row.cache_name === 'string' ? row.cache_name : null,
    model: typeof row.model === 'string' ? row.model : null,
    hasSnapshot: row.has_snapshot,
    snapshotCacheEndIdx,
  };
}

/** GET /api/agents/conversations/<id>/cache/ */
export async function fetchCacheStatus(conversationId: number): Promise<CacheStatusView> {
  const raw = await apiFetch(`/api/agents/conversations/${conversationId}/cache/`);
  return validateCacheStatus(raw);
}

/**
 * POST /api/agents/conversations/<id>/cache/renew/
 * Success requires `{ok: true}`; 404/409/network keep backend truth unchanged
 * until the caller refetches (Plan §6.4 — mutations never fabricate success).
 */
export async function renewCache(conversationId: number): Promise<{ ok: true; expiresAt: string | null; renewals: number | null }> {
  const raw = await apiFetch(`/api/agents/conversations/${conversationId}/cache/renew/`, {
    method: 'POST',
  });
  if (typeof raw !== 'object' || raw === null || (raw as Record<string, unknown>).ok !== true) {
    throw new AppApiError('缓存续期成功，但返回内容无法确认；将重新读取缓存状态。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
  const row = raw as Record<string, unknown>;
  return {
    ok: true,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    renewals: typeof row.renewals === 'number' ? row.renewals : null,
  };
}

/**
 * DELETE /api/agents/conversations/<id>/cache/
 * Success is a 204 (possibly followed by an async backend snapshot rebuild —
 * the UI must describe release, not promise permanent deletion, Plan D4).
 * 404 means there is nothing to release and is surfaced, never converted to
 * success. The caller refetches before re-presenting truth.
 */
export async function releaseCache(conversationId: number): Promise<{ released: true }> {
  await apiFetch(`/api/agents/conversations/${conversationId}/cache/`, { method: 'DELETE' });
  return { released: true };
}

// ── Conversation preference patch (thinking level) ───────────────────────────

/**
 * PATCH /api/agents/conversations/<id>/ {thinking_level}
 *
 * Definite rejection (4xx) keeps the confirmed Query value and surfaces the
 * backend message. Network failure / 5xx / malformed 2xx are UNKNOWN saves:
 * `ambiguousWrite` is set for a malformed success; both callers show
 * “保存状态待确认” and refetch the exact Conversation before re-presenting.
 * Retrying the same explicit value is idempotent and legal.
 */
export interface ThinkingPatchResult {
  confirmedLevel: ThinkingLevel;
}

export async function patchConversationThinkingLevel(
  conversationId: number,
  level: ThinkingLevel,
): Promise<ThinkingPatchResult> {
  if (!isThinkingLevel(level)) {
    throw new AppApiError(`无效的思考级别: ${String(level)}`, { code: 'VALIDATION' });
  }
  let raw: unknown;
  try {
    raw = await apiFetch(`/api/agents/conversations/${conversationId}/`, {
      method: 'PATCH',
      body: { thinking_level: level },
    });
  } catch (cause) {
    const err = toAppApiError(cause);
    // 4xx is a definite rejection (backend refuses or knows better
    // state); anything else (network or 5xx) is an unknown save.
    if (err.status !== null && err.status < 500) throw err;
    throw new AppApiError('思考级别保存结果待确认（网络/服务异常），已重新读取会话状态。', {
      status: err.status,
      body: err.body,
      code: 'UNKNOWN_SAVE',
      ambiguousWrite: err.status === null ? false : true,
    });
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as Record<string, unknown>).id !== conversationId ||
    !isThinkingLevel((raw as Record<string, unknown>).thinking_level)
  ) {
    throw new AppApiError('思考级别已提交，但返回内容无法确认；已重新读取会话状态。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
  return { confirmedLevel: (raw as Record<string, unknown>).thinking_level as ThinkingLevel };
}

// ── Project context (detail / files / tree) ──────────────────────────────────

/** GET /api/core/projects/<id>/ */
export async function fetchProjectDetail(projectId: number): Promise<ProjectDetailRow> {
  const raw = await apiFetch(`/api/core/projects/${projectId}/`);
  const id = (raw as Record<string, unknown> | null)?.id;
  // F03: the frozen positive base-10 Project identity contract — non-positive
  // or fractional numeric ids must never establish an editable owner.
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    (id as number) <= 0 ||
    typeof (raw as Record<string, unknown>).name !== 'string'
  ) {
    throw contractError('项目详情接口返回格式异常', raw);
  }
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as number,
    name: row.name as string,
    description: typeof row.description === 'string' ? row.description : null,
    prompt: typeof row.prompt === 'string' ? row.prompt : null,
    workDir: typeof row.work_dir === 'string' ? row.work_dir : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

/**
 * Verified file ID forms (P2B D3): a positive integer (web upload) or the
 * `kf_<positive integer>` string form (Obsidian sync). `source` metadata is
 * presentation-only and never becomes a second rejection gate; unknown or
 * ID-inconsistent source values render a neutral label but the row stays
 * usable as long as its verified ID + name pass.
 */
export function isVerifiedProjectFileId(value: unknown): value is number | string {
  if (typeof value === 'number') return Number.isInteger(value) && (value as number) > 0;
  if (typeof value === 'string') return /^kf_[1-9]\d*$/.test(value);
  return false;
}

/** GET /api/core/projects/<id>/files/ — bare array, read-only rows (mixed IDs). */
export async function fetchProjectFiles(projectId: number): Promise<ProjectFileRow[]> {
  const raw = await apiFetch(`/api/core/projects/${projectId}/files/`);
  if (!Array.isArray(raw)) throw contractError('项目文件接口返回格式异常', raw);
  const rows: ProjectFileRow[] = [];
  for (const item of raw) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !isVerifiedProjectFileId((item as Record<string, unknown>).id) ||
      typeof (item as Record<string, unknown>).name !== 'string'
    ) {
      throw contractError('项目文件接口包含异常行', raw);
    }
    const row = item as Record<string, unknown>;
    rows.push({
      id: row.id as number | string,
      name: typeof row.name === 'string' ? row.name : '',
      fileType: typeof row.file_type === 'string' ? row.file_type : '',
      size: typeof row.size === 'number' ? row.size : 0,
      url: typeof row.url === 'string' ? row.url : null,
      previewUrl: typeof row.preview_url === 'string' ? row.preview_url : null,
      source: typeof row.source === 'string' ? row.source : null,
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    });
  }
  return rows;
}

/**
 * Wire-level tree entry validation (shared by root recursive and single-level
 * responses). Entries with malformed names/types/paths are protocol errors —
 * they are rejected here and never reach insertion boundaries (Plan §6.6).
 * Path traversal/absolute-path SEMANTIC rejection lives in `project/paths.ts`.
 */
export function validateTreeEntries(rawEntries: unknown): ProjectTreeEntry[] {
  if (!Array.isArray(rawEntries)) throw contractError('项目目录树返回格式异常（entries 非数组）', rawEntries);
  const seen = new Set<string>();
  const out: ProjectTreeEntry[] = [];
  for (const item of rawEntries) {
    if (typeof item !== 'object' || item === null) {
      throw contractError('项目目录树包含异常行', rawEntries);
    }
    const row = item as Record<string, unknown>;
    if (typeof row.name !== 'string' || row.name.length === 0) {
      throw contractError('项目目录树条目缺少有效名称', rawEntries);
    }
    if (row.type !== 'dir' && row.type !== 'file') {
      throw contractError('项目目录树条目类型非法', rawEntries);
    }
    if (typeof row.path !== 'string' || row.path.length === 0) {
      throw contractError('项目目录树条目缺少有效相对路径', rawEntries);
    }
    // Same-relative-path duplicates cannot be inserted cleanly — refuse.
    if (seen.has(row.path)) {
      throw contractError('项目目录树包含重复路径条目', rawEntries);
    }
    seen.add(row.path);
    const entry: ProjectTreeEntry = {
      name: row.name,
      type: row.type,
      path: row.path,
      size: typeof row.size === 'number' && Number.isFinite(row.size) ? row.size : null,
      entries: null,
    };
    if (row.type === 'dir' && row.entries !== undefined && row.entries !== null) {
      entry.entries = validateTreeEntries(row.entries);
    }
    out.push(entry);
  }
  return out;
}

/**
 * GET /api/core/projects/<id>/tree/ — root recursive tree, or one exact
 * single level when `?path=` is supplied (Plan §6.6 / fork-review correction).
 */
export async function fetchProjectTree(
  projectId: number,
  request: ProjectTreeRequest,
): Promise<ProjectTreeEnvelope> {
  const path = request.kind === 'root' ? '' : request.path;
  const raw = await apiFetch(`/api/core/projects/${projectId}/tree/`, {
    params: path ? { path } : undefined,
  });
  if (typeof raw !== 'object' || raw === null || typeof (raw as Record<string, unknown>).path !== 'string') {
    throw contractError('项目目录树接口返回格式异常', raw);
  }
  // Refuse to treat a path-pointing-at-file (400) or traversal response as a
  // tree — the backend already guards these, this is a defense-in-depth gate.
  const entries = validateTreeEntries((raw as Record<string, unknown>).entries);
  return { path: (raw as Record<string, unknown>).path as string, entries };
}