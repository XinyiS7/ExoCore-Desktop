/**
 * V4 single-conversation deletion — API adapter (sole owner).
 *
 * Frozen contract (backend-cleared, T1):
 * - 204                      → confirmed deletion
 * - 400 conversation_protected → protected row (Council/bridge special
 *   ownership); show protected explanation, NO mutation performed
 * - 404 conversation_not_found → already absent; safe success, reconcile list
 * - 409 conversation_busy     → blocked at the backend; show busy explanation
 *   + recovery/open path, NO auto-retry. 409 is authoritative even when a
 *   local lease is absent (lease absence is NOT idle proof, cross-tab/port).
 * - 500 safety_check_failed    → fail-closed, definitive non-deletion; show
 *   error, keep state, NO ambiguous read-back (the check itself failed).
 * - network failure / any other non-2xx   → AMBIGUOUS write: outcome unknown;
 *   caller must read back (fresh list/detail) before re-arming the destructive
 *   action. `exo-shared/api` never flags network as ambiguous, so this adapter
 *   classifies transport errors explicitly (T0 correction, accepted).
 *
 * Per-ID local draft + preferences are NEVER cleared by this module: deletion
 * retires server-owned query caches only. Drafts (runtime/storage.ts) and
 * prefs (control/prefs.ts) are caller-owned per-ID state; the delete flow
 * must not bulk-clear storage or erase a runtime lease to unlock deletion.
 */
import { apiFetch } from 'exo-shared/api';
import { AppApiError } from './api';

/** 后端冻结错误码（backend R3 PASS 判定） */
export const DELETE_ERROR_CODES = {
  PROTECTED: 'conversation_protected',
  NOT_FOUND: 'conversation_not_found',
  BUSY: 'conversation_busy',
  SAFETY_CHECK_FAILED: 'safety_check_failed',
} as const;

export type ConversationDeleteOutcome =
  | { kind: 'confirmed' }
  | { kind: 'absent' }
  | { kind: 'protected' }
  | { kind: 'busy' }
  | { kind: 'safety_failed' };

export type ConversationDeleteAttempt =
  | { outcome: ConversationDeleteOutcome }
  | { outcome: { kind: 'ambiguous' }; cause: unknown };

function errorCodeOf(cause: unknown): string | null {
  if (cause instanceof AppApiError) {
    const body = cause.body as Record<string, unknown> | null | undefined;
    if (typeof body?.code === 'string') return body.code;
  }
  const generic = cause as { body?: { code?: unknown } } | null | undefined;
  if (typeof generic?.body?.code === 'string') return generic.body.code;
  return null;
}

/**
 * DELETE /api/agents/conversations/<id>/ — strict frozen-contract
 * classification over the shared transport.
 *
 * `apiFetch` throws on non-2xx; the catch classifies by status + body code.
 * Never throws for a settled backend verdict (confirmed/absent/protected/
 * busy/safety_failed). It throws ONLY on an ambiguous transport/unknown
 * outcome the caller must read back.
 */
export async function deleteConversation(id: number): Promise<ConversationDeleteAttempt> {
  try {
    await apiFetch(`/api/agents/conversations/${id}/`, { method: 'DELETE' });
    // 2xx (204, or a misbehaving 200): the only defined success is 204.
    return { outcome: { kind: 'confirmed' } };
  } catch (cause) {
    const status =
      cause instanceof AppApiError ? cause.status
        : typeof (cause as { status?: unknown })?.status === 'number'
          ? ((cause as { status: number }).status)
          : null;

    const code = errorCodeOf(cause);

    if (status === 400 && code === DELETE_ERROR_CODES.PROTECTED) {
      return { outcome: { kind: 'protected' } };
    }
    if (status === 404 && code === DELETE_ERROR_CODES.NOT_FOUND) {
      // Absence is NOT "this attempt succeeded": the row is already gone.
      return { outcome: { kind: 'absent' } };
    }
    if (status === 409 && code === DELETE_ERROR_CODES.BUSY) {
      return { outcome: { kind: 'busy' } };
    }
    if (status === 500 && code === DELETE_ERROR_CODES.SAFETY_CHECK_FAILED) {
      // Fail-closed: the safety check itself failed, deletion definitively
      // did NOT happen. Keep state; no ambiguous read-back.
      return { outcome: { kind: 'safety_failed' } };
    }

    // Any other status, missing error code, or transport failure → unknown.
    return { outcome: { kind: 'ambiguous' }, cause };
  }
}