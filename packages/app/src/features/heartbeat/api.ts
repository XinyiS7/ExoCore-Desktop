import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, extractFieldErrors } from '../chat/api';
import type {
  CadenceMode,
  FinalizationReason,
  HeartbeatEventDetail,
  HeartbeatEventListItem,
  HeartbeatEventsResponse,
  HeartbeatEventStatus,
  HeartbeatExplicitWakeup,
  HeartbeatLaunchSource,
  HeartbeatNextAuto,
  HeartbeatPendingNote,
  HeartbeatQueueSummary,
  HeartbeatTaskStatus,
} from './types';

/**
 * Valid backend enum sets (from ExoCore models):
 * - HeartbeatPolicy.CadenceMode: 'normal' | 'quiet' | 'deep_quiet'
 * - HeartbeatEvent.Status: 'pending' | 'running' | 'succeeded' | 'failed'
 * - HeartbeatEvent.LaunchSource: 'auto' | 'agent' | 'notification' | 'user'
 * - WakeUpTask.Status: 'pending' | 'running' | 'succeeded' | 'retryable_failed' | 'dead' | 'cancelled'
 * - HeartbeatEvent.FinalizationReason: 'explicit' | 'max_segments'
 */
export const VALID_CADENCE_MODES = new Set<string>(['normal', 'quiet', 'deep_quiet']);
export const VALID_EVENT_STATUSES = new Set<string>(['pending', 'running', 'succeeded', 'failed']);
export const VALID_LAUNCH_SOURCES = new Set<string>(['auto', 'agent', 'notification', 'user']);
export const VALID_TASK_STATUSES = new Set<string>([
  'pending',
  'running',
  'succeeded',
  'retryable_failed',
  'dead',
  'cancelled',
]);
export const VALID_FINALIZATION_REASONS = new Set<string>(['explicit', 'max_segments']);

/**
 * UI-safe Heartbeat error carrying HTTP status, parsed body, and server error code.
 * (Plan §3.1: preserves server error codes like 'already_consumed', 'preset_not_found', etc.)
 */
export class HeartbeatApiError extends AppApiError {
  constructor(
    message: string,
    options: {
      status?: number | null;
      body?: unknown;
      code?: string;
      fieldErrors?: Record<string, string>;
      ambiguousWrite?: boolean;
    } = {},
  ) {
    super(message, options);
    this.name = 'HeartbeatApiError';
  }
}

/**
 * Maps thrown transport error into HeartbeatApiError.
 * Extracts { error, code } or DRF standard envelopes if present.
 */
export function toHeartbeatApiError(cause: unknown): HeartbeatApiError {
  if (cause instanceof HeartbeatApiError) return cause;
  if (cause instanceof AppApiError) {
    let code = cause.code;
    let message = cause.message;
    if (typeof cause.body === 'object' && cause.body !== null) {
      const raw = cause.body as Record<string, unknown>;
      if (typeof raw.code === 'string') {
        code = raw.code;
      }
      if (typeof raw.error === 'string') {
        message = raw.error;
      } else if (typeof raw.detail === 'string') {
        message = raw.detail;
      }
    }
    return new HeartbeatApiError(message, {
      status: cause.status,
      body: cause.body,
      code,
      fieldErrors: cause.fieldErrors,
      ambiguousWrite: cause.ambiguousWrite,
    });
  }

  const err = cause as { message?: string; status?: unknown; body?: unknown };
  const status = typeof err?.status === 'number' ? err.status : null;
  const body = err?.body;

  if (typeof body === 'object' && body !== null) {
    const raw = body as Record<string, unknown>;
    const code =
      typeof raw.code === 'string'
        ? raw.code
        : status !== null
          ? `HTTP_${status}`
          : 'ERROR';
    const msg =
      typeof raw.error === 'string'
        ? raw.error
        : typeof raw.detail === 'string'
          ? raw.detail
          : err?.message ?? `请求失败 (${status})`;
    return new HeartbeatApiError(msg, {
      status,
      body,
      code,
      fieldErrors: extractFieldErrors(body),
    });
  }

  if (status !== null) {
    return new HeartbeatApiError(err?.message ?? `请求失败 (${status})`, {
      status,
      body,
      code: `HTTP_${status}`,
      fieldErrors: extractFieldErrors(body),
    });
  }

  if (err instanceof TypeError || cause instanceof TypeError) {
    return new HeartbeatApiError('网络连接失败，请检查后端服务', {
      status: null,
      code: 'NETWORK_ERROR',
    });
  }

  return new HeartbeatApiError(err?.message ?? '请求失败', {
    status: null,
    code: 'ERROR',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw contractError(`${context} 必须是有效对象`, value);
  }
  return value;
}

function requirePositiveInt(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw contractError(`${context} 必须是正整数`, value);
  }
  return value;
}

function requireNonNegativeInt(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw contractError(`${context} 必须是非负整数`, value);
  }
  return value;
}

function requireBoolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') {
    throw contractError(`${context} 必须是布尔值`, value);
  }
  return value;
}

function requireString(value: unknown, context: string, allowEmpty = true): string {
  if (typeof value !== 'string') {
    throw contractError(`${context} 必须是字符串`, value);
  }
  if (!allowEmpty && value.trim() === '') {
    throw contractError(`${context} 不能为空字符串`, value);
  }
  return value;
}

function requireNullableString(value: unknown, context: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw contractError(`${context} 必须是字符串或 null`, value);
  }
  return value;
}

function requireNullablePositiveInt(value: unknown, context: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw contractError(`${context} 必须是正整数或 null`, value);
  }
  return value;
}

function requireArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw contractError(`${context} 必须是数组`, value);
  }
  return value;
}

function requireEnum<T extends string>(value: unknown, allowed: Set<string>, context: string): T {
  if (typeof value !== 'string') {
    throw contractError(`${context} 必须是有效枚举字符串`, value);
  }
  if (!allowed.has(value)) {
    throw contractError(`${context} 枚举值无效: ${value}`, value);
  }
  return value as T;
}

function requireNullableEnum<T extends string>(
  value: unknown,
  allowed: Set<string>,
  context: string,
): T | null {
  if (value === null) return null;
  return requireEnum<T>(value, allowed, context);
}

/**
 * Normalizes raw HeartbeatEvent item from list projection.
 */
export function normalizeHeartbeatEventListItem(raw: unknown): HeartbeatEventListItem {
  const r = requireRecord(raw, '心跳记录');
  return {
    sessionUuid: requireString(r.session_uuid, 'session_uuid', false),
    presetId: requirePositiveInt(r.preset_id, 'preset_id'),
    presetName: requireString(r.preset_name, 'preset_name', true),
    launchSource: requireEnum<HeartbeatLaunchSource>(r.launch_source, VALID_LAUNCH_SOURCES, 'launch_source'),
    domain: requireString(r.domain, 'domain', true),
    status: requireEnum<HeartbeatEventStatus>(r.status, VALID_EVENT_STATUSES, 'status'),
    content: requireString(r.content, 'content', true),
    startedAt: requireNullableString(r.started_at, 'started_at'),
    completedAt: requireNullableString(r.completed_at, 'completed_at'),
  };
}

/**
 * Normalizes raw HeartbeatEvent list response.
 */
export function normalizeHeartbeatEventsResponse(raw: unknown): HeartbeatEventsResponse {
  const r = requireRecord(raw, '心跳记录列表');
  if (!Array.isArray(r.events)) {
    throw contractError('events 必须是数组', raw);
  }
  return {
    events: r.events.map(normalizeHeartbeatEventListItem),
    totalCount: requireNonNegativeInt(r.total_count, 'total_count'),
    hasMore: requireBoolean(r.has_more, 'has_more'),
  };
}

/**
 * Normalizes raw HeartbeatEvent detail response.
 */
export function normalizeHeartbeatEventDetail(raw: unknown): HeartbeatEventDetail {
  const base = normalizeHeartbeatEventListItem(raw);
  const r = raw as Record<string, unknown>;
  return {
    ...base,
    seedMessage: requireString(r.seed_message, 'seed_message', true),
    toolHistory: requireArray(r.tool_history, 'tool_history'),
    errorSummary: requireString(r.error_summary, 'error_summary', true),
    finalizationReason: requireNullableEnum<FinalizationReason>(
      r.finalization_reason,
      VALID_FINALIZATION_REASONS,
      'finalization_reason',
    ),
    attemptNumber: requirePositiveInt(r.attempt_number, 'attempt_number'),
    wakeUpTaskId: requireNullablePositiveInt(r.wake_up_task_id, 'wake_up_task_id'),
    sourceConversationId: requireNullablePositiveInt(r.source_conversation_id, 'source_conversation_id'),
    acknowledgedAt: requireNullableString(r.acknowledged_at, 'acknowledged_at'),
  };
}

function normalizeHeartbeatNextAuto(raw: unknown): HeartbeatNextAuto {
  const na = requireRecord(raw, 'next_auto');
  return {
    taskId: requirePositiveInt(na.task_id, 'next_auto.task_id'),
    targetUtc: requireString(na.target_utc, 'next_auto.target_utc', false),
    effectiveUtc: requireString(na.effective_utc, 'next_auto.effective_utc', false),
    effectiveLocal: requireString(na.effective_local, 'next_auto.effective_local', false),
    message: requireString(na.message, 'next_auto.message', true),
    resumeCheck: requireBoolean(na.resume_check, 'next_auto.resume_check'),
    status: requireEnum<HeartbeatTaskStatus>(na.status, VALID_TASK_STATUSES, 'next_auto.status'),
  };
}

function normalizeHeartbeatPendingNote(raw: unknown, index: number): HeartbeatPendingNote {
  const n = requireRecord(raw, `pending_notes[${index}]`);
  return {
    id: requirePositiveInt(n.id, `pending_notes[${index}].id`),
    message: requireString(n.message, `pending_notes[${index}].message`, true),
    createdAt: requireString(n.created_at, `pending_notes[${index}].created_at`, false),
    createdLocal: requireString(n.created_local, `pending_notes[${index}].created_local`, false),
  };
}

function normalizeHeartbeatExplicitWakeup(raw: unknown, index: number): HeartbeatExplicitWakeup {
  const w = requireRecord(raw, `explicit_wakeups[${index}]`);
  return {
    taskId: requirePositiveInt(w.task_id, `explicit_wakeups[${index}].task_id`),
    targetUtc: requireString(w.target_utc, `explicit_wakeups[${index}].target_utc`, false),
    effectiveUtc: requireString(w.effective_utc, `explicit_wakeups[${index}].effective_utc`, false),
    effectiveLocal: requireString(w.effective_local, `explicit_wakeups[${index}].effective_local`, false),
    message: requireString(w.message, `explicit_wakeups[${index}].message`, true),
    resumeCheck: requireBoolean(w.resume_check, `explicit_wakeups[${index}].resume_check`),
    status: requireEnum<HeartbeatTaskStatus>(w.status, VALID_TASK_STATUSES, 'explicit_wakeups.status'),
  };
}

/**
 * Normalizes raw HeartbeatQueue summary response.
 */
export function normalizeHeartbeatQueueSummary(raw: unknown): HeartbeatQueueSummary {
  const r = requireRecord(raw, '心跳队列');
  const presetId = requirePositiveInt(r.preset_id, 'preset_id');
  const autoEnabled = requireBoolean(r.auto_enabled, 'auto_enabled');
  const cadenceMode = requireEnum<CadenceMode>(r.cadence_mode, VALID_CADENCE_MODES, 'cadence_mode');
  const pausedUntilUtc = requireNullableString(r.paused_until_utc, 'paused_until_utc');
  const pausedUntilLocal = requireNullableString(r.paused_until_local, 'paused_until_local');

  let nextAuto: HeartbeatNextAuto | null = null;
  if (r.next_auto !== null && r.next_auto !== undefined) {
    nextAuto = normalizeHeartbeatNextAuto(r.next_auto);
  }

  if (!Array.isArray(r.pending_notes)) {
    throw contractError('pending_notes 必须是数组', raw);
  }
  const pendingNotes = r.pending_notes.map((item, idx) =>
    normalizeHeartbeatPendingNote(item, idx),
  );

  if (!Array.isArray(r.explicit_wakeups)) {
    throw contractError('explicit_wakeups 必须是数组', raw);
  }
  const explicitWakeups = r.explicit_wakeups.map((item, idx) =>
    normalizeHeartbeatExplicitWakeup(item, idx),
  );

  const unshownExplicitCount = requireNonNegativeInt(
    r.unshown_explicit_count,
    'unshown_explicit_count',
  );

  return {
    presetId,
    autoEnabled,
    cadenceMode,
    pausedUntilUtc,
    pausedUntilLocal,
    nextAuto,
    pendingNotes,
    explicitWakeups,
    unshownExplicitCount,
  };
}

/**
 * GET /api/heartbeat/queue/?preset_id=<id>
 */
export async function fetchHeartbeatQueue(presetId: number): Promise<HeartbeatQueueSummary> {
  try {
    const raw = await apiFetch('/api/heartbeat/queue/', { params: { preset_id: presetId } });
    return normalizeHeartbeatQueueSummary(raw);
  } catch (cause) {
    throw toHeartbeatApiError(cause);
  }
}

/**
 * GET /api/heartbeat/events/?preset_id=<id>&limit=<limit>&offset=<offset>
 * Read-only ledger list (A-19..A-25). Never writes or acknowledges.
 */
export async function fetchHeartbeatEvents(
  presetId: number,
  options: { limit?: number; offset?: number } = {},
): Promise<HeartbeatEventsResponse> {
  const { limit = 20, offset = 0 } = options;
  try {
    const raw = await apiFetch('/api/heartbeat/events/', {
      params: { preset_id: presetId, limit, offset },
    });
    return normalizeHeartbeatEventsResponse(raw);
  } catch (cause) {
    throw toHeartbeatApiError(cause);
  }
}

/**
 * GET /api/heartbeat/events/<session_uuid>/
 * Read-only ledger event detail. Never writes or acknowledges.
 */
export async function fetchHeartbeatEventDetail(sessionUuid: string): Promise<HeartbeatEventDetail> {
  try {
    const raw = await apiFetch(`/api/heartbeat/events/${encodeURIComponent(sessionUuid)}/`);
    return normalizeHeartbeatEventDetail(raw);
  } catch (cause) {
    throw toHeartbeatApiError(cause);
  }
}

/**
 * POST /api/heartbeat/notes/
 * Creates a pending note for next heartbeat (CP-B).
 */
export async function createHeartbeatNote(
  presetId: number,
  message: string,
): Promise<HeartbeatPendingNote> {
  let raw: unknown;
  try {
    raw = await apiFetch('/api/heartbeat/notes/', {
      method: 'POST',
      body: { preset_id: presetId, message },
    });
  } catch (cause) {
    throw toHeartbeatApiError(cause);
  }

  try {
    return normalizeHeartbeatPendingNote(raw, 0);
  } catch {
    throw new HeartbeatApiError('小纸条已提交，但返回格式无法确认；已重新读取信箱（避免重复提交）。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
}

/**
 * DELETE /api/heartbeat/notes/<int:note_id>/
 * Withdraws a pending note before consumption (CP-B).
 */
export async function withdrawHeartbeatNote(noteId: number): Promise<void> {
  try {
    await apiFetch(`/api/heartbeat/notes/${noteId}/`, {
      method: 'DELETE',
    });
  } catch (cause) {
    throw toHeartbeatApiError(cause);
  }
}

/**
 * POST /api/heartbeat/wakeups/
 * Schedules a user-designated wakeup task (CP-B).
 */
export async function scheduleHeartbeatWakeup(
  presetId: number,
  wakeUpAt: string,
  message: string,
): Promise<HeartbeatExplicitWakeup> {
  let raw: unknown;
  try {
    raw = await apiFetch('/api/heartbeat/wakeups/', {
      method: 'POST',
      body: {
        preset_id: presetId,
        wake_up_at: wakeUpAt,
        message,
        resume_check: false,
      },
    });
  } catch (cause) {
    throw toHeartbeatApiError(cause);
  }

  try {
    const r = requireRecord(raw, 'schedule_wakeup response');
    const targetUtc = requireString(r.target_utc, 'target_utc', false);
    const effectiveUtc =
      typeof r.effective_utc === 'string' && r.effective_utc.trim() !== ''
        ? r.effective_utc
        : targetUtc;
    const effectiveLocal =
      typeof r.effective_local === 'string' && r.effective_local.trim() !== ''
        ? r.effective_local
        : typeof r.target_local === 'string' && r.target_local.trim() !== ''
          ? r.target_local
          : targetUtc;

    return {
      taskId: requirePositiveInt(r.task_id, 'task_id'),
      targetUtc,
      effectiveUtc,
      effectiveLocal,
      message: requireString(r.message, 'message', true),
      resumeCheck: requireBoolean(r.resume_check, 'resume_check'),
      status: requireEnum<HeartbeatTaskStatus>(r.status, VALID_TASK_STATUSES, 'status'),
    };
  } catch {
    throw new HeartbeatApiError('唤醒预约已提交，但返回格式无法确认；已重新读取信箱（避免重复提交）。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
}

/**
 * DELETE /api/heartbeat/wakeups/<int:task_id>/
 * Cancels a user-designated wakeup task (CP-B).
 */
export async function cancelHeartbeatWakeup(taskId: number): Promise<void> {
  try {
    await apiFetch(`/api/heartbeat/wakeups/${taskId}/`, {
      method: 'DELETE',
    });
  } catch (cause) {
    throw toHeartbeatApiError(cause);
  }
}
