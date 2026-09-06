import type { ChatTransport, V4RuntimeLease } from './types';

/**
 * Versioned V4 Storage Manager — conditional captured-owner algebra
 *
 * Implements Plan §6.5 and C1B intervention §4 (R4):
 * - Isolated V4 namespace: `exo:v4:chat-runtime:<id>`, `exo:v4:chat-transport`, `exo:v4:chat-draft:<id>`
 * - NEVER reads, touches or clears V3 keys (`exo_async_<id>`);
 * - Persists only minimal transport state: schema version, operation, conversationId,
 *   transport, token, cursor, timestamps, disposition;
 * - Never persists answer text, reasoning, telemetry, API keys, or model credentials;
 * - `persist-runtime(expectedPrior, next)` and `clear-runtime(expectedPrior)` are
 *   conditional compare-before-set/remove transitions. Success requires the
 *   synchronously reread value to EXACTLY match the expected prior snapshot
 *   (pending creation requires verified absence). This is same-tab captured-owner
 *   validation on one JS execution thread — NOT a cross-tab CAS/distributed lock.
 * - Disjoint non-success outcomes: `conflict` (precondition read OK but differs —
 *   observed state untouched, adopt or reread), `precondition_unavailable`
 *   (ownership could not be read — enter storage_blocked_read, never infer),
 *   `mutation_unavailable` (precondition matched but set/remove failed — the
 *   verified expected prior remains and exact mutation retry is legal).
 * - Reads distinguish absent / valid / quarantined / unavailable outcomes and
 *   NEVER return an invalid record as executable.
 */

const KEY_PREFIX_RUNTIME = 'exo:v4:chat-runtime:';
const KEY_TRANSPORT = 'exo:v4:chat-transport';
const KEY_PREFIX_DRAFT = 'exo:v4:chat-draft:';

const OPERATIONS = ['send', 'edit', 'regenerate', 'branch'] as const;
const DISPOSITIONS = ['pending', 'active', 'uncertain'] as const;

function getRuntimeKey(conversationId: number): string {
  return `${KEY_PREFIX_RUNTIME}${conversationId}`;
}

function getDraftKey(conversationId: number): string {
  return `${KEY_PREFIX_DRAFT}${conversationId}`;
}

// ── Read outcome vocabulary (§4.1) ─────────────────────────────────────────

export type LeaseReadOutcome =
  | { state: 'absent' }
  | { state: 'valid'; lease: V4RuntimeLease }
  | { state: 'quarantined'; reason: string }
  | { state: 'unavailable'; reason: string };

// ── Conditional write outcome vocabulary (§4.1) ────────────────────────────

export type ConditionalWriteOutcome =
  | { state: 'persisted'; snapshot: V4RuntimeLease }
  | { state: 'conflict'; observed: V4RuntimeLease | null; note?: string }
  | { state: 'precondition_unavailable'; reason: string }
  | { state: 'mutation_unavailable'; reason: string; verifiedExpectedPrior: V4RuntimeLease | null };

export type ConditionalClearOutcome =
  | { state: 'cleared' }
  | { state: 'conflict'; observed: V4RuntimeLease | null; note?: string }
  | { state: 'precondition_unavailable'; reason: string }
  | { state: 'mutation_unavailable'; reason: string; verifiedExpectedPrior: V4RuntimeLease | null };

function quarantine(key: string, reason: string): LeaseReadOutcome {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn('[V4Storage] Failed to quarantine invalid lease:', err);
    return { state: 'unavailable', reason: '无法移除损坏的运行记录（存储不可用）' };
  }
  return { state: 'quarantined', reason };
}

/**
 * Strict, operation-aware lease read. Invalid JSON / wrong schema / unknown
 * operation / invalid operation-specific fields are REMOVED and reported as
 * 'quarantined' (visible recovery), never returned as executable records.
 */
export function readRuntimeLease(conversationId: number): LeaseReadOutcome {
  let raw: string | null;
  try {
    const key = getRuntimeKey(conversationId);
    raw = window.localStorage.getItem(key);
    if (raw === null) return { state: 'absent' };
  } catch (err) {
    console.warn('[V4Storage] Failed to read runtime lease:', err);
    return { state: 'unavailable', reason: '无法读取运行状态（存储不可用）' };
  }

  let data: Partial<V4RuntimeLease>;
  try {
    data = JSON.parse(raw) as Partial<V4RuntimeLease>;
  } catch {
    return quarantine(getRuntimeKey(conversationId), 'invalid_json');
  }

  const key = getRuntimeKey(conversationId);
  const fail = (reason: string) => quarantine(key, reason);

  if (data.version !== 1) return fail(`schema_version:${String(data.version)}`);
  if (!Number.isInteger(data.conversationId) || (data.conversationId as number) !== conversationId) {
    return fail('conversation_binding_mismatch');
  }
  if (typeof data.operation !== 'string' || !(OPERATIONS as readonly string[]).includes(data.operation)) {
    return fail(`unknown_operation:${String(data.operation)}`);
  }
  if (data.transport !== 'sse' && data.transport !== 'async') {
    return fail(`unknown_transport:${String(data.transport)}`);
  }
  if (typeof data.disposition !== 'string' || !(DISPOSITIONS as readonly string[]).includes(data.disposition)) {
    return fail(`unknown_disposition:${String(data.disposition)}`);
  }
  if (
    typeof data.startedAt !== 'number' ||
    !Number.isFinite(data.startedAt) ||
    typeof data.updatedAt !== 'number' ||
    !Number.isFinite(data.updatedAt)
  ) {
    return fail('non_finite_timestamps');
  }
  // Operation-specific fields (C1B-R2-01): an EXECUTABLE async lease
  // (disposition 'active') must carry an opaque token + nonnegative integer
  // cursor. 'pending'/'uncertain' async markers legitimately exist before the
  // ack returns or after an unknown outcome without a usable token — they are
  // non-executable duplicate-write protection and must survive reload.
  if (data.transport === 'async' && data.disposition === 'active') {
    if (typeof data.asyncToken !== 'string' || data.asyncToken.trim() === '') {
      return fail('async_missing_token');
    }
    if (typeof data.cursor !== 'number' || !Number.isInteger(data.cursor) || (data.cursor as number) < 0) {
      return fail('async_invalid_cursor');
    }
  }
  if (data.operation === 'branch' && data.transport !== 'sse') {
    return fail('branch_transport_must_be_sse');
  }
  return { state: 'valid', lease: data as V4RuntimeLease };
}

function readRaw(key: string): { ok: true; value: string | null } | { ok: false; reason: string } {
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch (err) {
    console.warn('[V4Storage] Failed to read storage key:', err);
    return { ok: false, reason: '无法读取运行状态（存储不可用）' };
  }
}

/** Structural check of a stored value — enough to compare ownership. */
function parseObserved(raw: string): V4RuntimeLease | 'invalid' {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return 'invalid';
  }
  if (typeof data !== 'object' || data === null) return 'invalid';
  const d = data as Partial<V4RuntimeLease>;
  if (
    d.version !== 1 ||
    typeof d.conversationId !== 'number' ||
    typeof d.operation !== 'string' ||
    typeof d.transport !== 'string' ||
    typeof d.disposition !== 'string' ||
    typeof d.startedAt !== 'number' ||
    typeof d.updatedAt !== 'number'
  ) {
    return 'invalid';
  }
  return d as V4RuntimeLease;
}

/**
 * Full exact snapshot comparison (stable owner + disposition + updatedAt +
 * async token/cursor when present). `undefined` and absent fields compare equal.
 */
function leaseEquals(a: V4RuntimeLease, b: V4RuntimeLease): boolean {
  if (a.version !== b.version || a.conversationId !== b.conversationId) return false;
  if (a.operation !== b.operation || a.transport !== b.transport) return false;
  if (a.disposition !== b.disposition) return false;
  if (a.startedAt !== b.startedAt || a.updatedAt !== b.updatedAt) return false;
  if ((a.asyncToken ?? undefined) !== (b.asyncToken ?? undefined)) return false;
  if ((a.cursor ?? undefined) !== (b.cursor ?? undefined)) return false;
  return true;
}

/**
 * Conditional persist (§4.1). Pending creation (expectedPrior === null) only
 * succeeds while the key is still absent. Every replacement succeeds only when
 * the synchronously reread value exactly matches `expectedPrior`.
 * NEVER emits a tokenless active async snapshot.
 */
export function persistRuntimeLease(
  expectedPrior: V4RuntimeLease | null,
  next: V4RuntimeLease,
): ConditionalWriteOutcome {
  const key = getRuntimeKey(next.conversationId);
  const raw = readRaw(key);
  if (!raw.ok) {
    return { state: 'precondition_unavailable', reason: raw.reason };
  }
  const observed: V4RuntimeLease | 'invalid' | null = raw.value === null ? null : parseObserved(raw.value);
  if (expectedPrior === null) {
    if (observed !== null) {
      return observed === 'invalid'
        ? { state: 'conflict', observed: null, note: 'unparseable' }
        : { state: 'conflict', observed };
    }
  } else {
    if (observed === null) return { state: 'conflict', observed: null };
    if (observed === 'invalid') return { state: 'conflict', observed: null, note: 'unparseable' };
    if (!leaseEquals(expectedPrior, observed)) return { state: 'conflict', observed };
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
    return { state: 'persisted', snapshot: next };
  } catch (err) {
    console.warn('[V4Storage] Failed to persist runtime lease:', err);
    return { state: 'mutation_unavailable', reason: '无法写入运行状态（存储不可用）', verifiedExpectedPrior: expectedPrior };
  }
}

/**
 * Conditional clear (§4.1). Clear is ONLY the final legal release step and
 * only against the exact expected prior snapshot — never `clear old → write
 * new`, so no zero-marker gap can be created by a stale callback.
 */
export function clearRuntimeLease(expectedPrior: V4RuntimeLease): ConditionalClearOutcome {
  const key = getRuntimeKey(expectedPrior.conversationId);
  const raw = readRaw(key);
  if (!raw.ok) {
    return { state: 'precondition_unavailable', reason: raw.reason };
  }
  const observed: V4RuntimeLease | 'invalid' | null = raw.value === null ? null : parseObserved(raw.value);
  if (observed === null) return { state: 'conflict', observed: null };
  if (observed === 'invalid') return { state: 'conflict', observed: null, note: 'unparseable' };
  if (!leaseEquals(expectedPrior, observed)) return { state: 'conflict', observed };
  try {
    window.localStorage.removeItem(key);
    return { state: 'cleared' };
  } catch (err) {
    console.warn('[V4Storage] Failed to clear runtime lease:', err);
    return { state: 'mutation_unavailable', reason: '无法清除运行状态（存储不可用）', verifiedExpectedPrior: expectedPrior };
  }
}

export function saveTransportPreference(transport: ChatTransport): void {
  try {
    window.localStorage.setItem(KEY_TRANSPORT, transport);
  } catch (err) {
    console.warn('[V4Storage] Failed to save transport preference:', err);
  }
}

export function loadTransportPreference(): ChatTransport {
  try {
    const val = window.localStorage.getItem(KEY_TRANSPORT);
    if (val === 'async') return 'async';
    return 'sse';
  } catch {
    return 'sse';
  }
}

export function saveConversationDraft(conversationId: number, draft: string): boolean {
  try {
    const key = getDraftKey(conversationId);
    if (draft.trim().length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, draft);
    }
    return true;
  } catch (err) {
    console.warn('[V4Storage] Failed to save draft:', err);
    return false;
  }
}

export function loadConversationDraft(conversationId: number): string {
  try {
    const key = getDraftKey(conversationId);
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function clearConversationDraft(conversationId: number): boolean {
  try {
    const key = getDraftKey(conversationId);
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn('[V4Storage] Failed to clear draft:', err);
    return false;
  }
}