import type { ChatTransport, RuntimeOperationKind, RuntimeMarker } from './types';

/**
 * V4 chat localStorage: drafts, transport preference and the in-flight
 * runtime marker. Every function is best-effort — a storage failure is
 * logged and degrades to in-memory behavior; it never blocks a send or a
 * delete. The backend stays the only authority for concurrency and deletion.
 *
 * Keys: `exo:v4:chat-runtime:<id>`, `exo:v4:chat-transport`,
 * `exo:v4:chat-draft:<id>`. V3 keys (`exo_async_<id>`) are never touched.
 */

const KEY_PREFIX_RUNTIME = 'exo:v4:chat-runtime:';
const KEY_TRANSPORT = 'exo:v4:chat-transport';
const KEY_PREFIX_DRAFT = 'exo:v4:chat-draft:';

const OPERATIONS: readonly RuntimeOperationKind[] = ['send', 'edit', 'regenerate', 'branch'];

function getRuntimeKey(conversationId: number): string {
  return `${KEY_PREFIX_RUNTIME}${conversationId}`;
}

function getDraftKey(conversationId: number): string {
  return `${KEY_PREFIX_DRAFT}${conversationId}`;
}

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn('[V4Storage] Failed to read', key, err);
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn('[V4Storage] Failed to write', key, err);
  }
}

function removeItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn('[V4Storage] Failed to remove', key, err);
  }
}

// ── In-flight runtime marker ────────────────────────────────────────────────
// Written before a chat/branch POST and cleared once the outcome is settled.
// On route entry a marker means a previous operation never settled in this
// browser: an async marker with a token resumes polling; anything else asks
// the user to acknowledge before sending again (the backend does not reject
// a second concurrent run in the same conversation).

function parseMarker(raw: string, conversationId: number): RuntimeMarker | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Partial<RuntimeMarker>;
  if (d.conversationId !== conversationId) return null;
  if (typeof d.operation !== 'string' || !OPERATIONS.includes(d.operation)) return null;
  if (d.transport !== 'sse' && d.transport !== 'async') return null;
  if (typeof d.startedAt !== 'number' || !Number.isFinite(d.startedAt)) return null;
  const marker: RuntimeMarker = {
    conversationId,
    operation: d.operation,
    transport: d.transport,
    startedAt: d.startedAt,
  };
  if (typeof d.asyncToken === 'string' && d.asyncToken.trim() !== '') {
    marker.asyncToken = d.asyncToken;
  }
  return marker;
}

/** Returns the stored marker, or null. Unreadable records are removed. */
export function readRuntimeMarker(conversationId: number): RuntimeMarker | null {
  const key = getRuntimeKey(conversationId);
  const raw = readItem(key);
  if (raw === null) return null;
  const marker = parseMarker(raw, conversationId);
  if (!marker) {
    console.warn('[V4Storage] Discarding unreadable runtime marker', key);
    removeItem(key);
  }
  return marker;
}

export function writeRuntimeMarker(marker: RuntimeMarker): void {
  writeItem(getRuntimeKey(marker.conversationId), JSON.stringify(marker));
}

/**
 * Clears the marker only when it still belongs to the operation that started
 * at `startedAt`, so a late callback of an old run cannot erase a newer one.
 */
export function clearRuntimeMarker(conversationId: number, startedAt: number): void {
  const key = getRuntimeKey(conversationId);
  const raw = readItem(key);
  if (raw === null) return;
  const marker = parseMarker(raw, conversationId);
  if (marker && marker.startedAt !== startedAt) return;
  removeItem(key);
}

// ── Transport preference ───────────────────────────────────────────────────

export function saveTransportPreference(transport: ChatTransport): void {
  writeItem(KEY_TRANSPORT, transport);
}

export function loadTransportPreference(): ChatTransport {
  return readItem(KEY_TRANSPORT) === 'async' ? 'async' : 'sse';
}

// ── Drafts ─────────────────────────────────────────────────────────────────

export function saveConversationDraft(conversationId: number, draft: string): void {
  if (draft.trim().length === 0) removeItem(getDraftKey(conversationId));
  else writeItem(getDraftKey(conversationId), draft);
}

export function loadConversationDraft(conversationId: number): string {
  return readItem(getDraftKey(conversationId)) ?? '';
}

export function clearConversationDraft(conversationId: number): void {
  removeItem(getDraftKey(conversationId));
}
