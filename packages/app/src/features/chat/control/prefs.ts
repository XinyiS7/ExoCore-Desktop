/**
 * P1D conversation-local preference storage (Plan §4.3 / §6.3).
 *
 * Small typed helpers with guarded read/write and explicit fallback. Storage
 * failure keeps the in-memory choice for the current page and surfaces a
 * non-blocking warning; preferences NEVER enter the durable chat-operation
 * lease algebra (runtime/storage.ts is untouched, pane 5 territory).
 *
 * V4 namespace `exo:v4:pref:` — deliberately disjoint from V3 `exo_*` keys.
 */

const PREFIX = 'exo:v4:pref:';
const KEY_CACHE_ENABLED = (id: number) => `${PREFIX}cache-enabled:${id}`;
const KEY_SESSION_TYPE = (id: number) => `${PREFIX}session-type:${id}`;
const KEY_MEMORY_INJECT = (id: number) => `${PREFIX}memory-inject:${id}`;
const KEY_AURA = (id: number) => `${PREFIX}aura:${id}`;

export type PrefReadOutcome<T> =
  | { state: 'absent' }
  | { state: 'valid'; value: T }
  | { state: 'unavailable'; reason: string };

export type PrefWriteOutcome = { state: 'persisted' } | { state: 'unavailable'; reason: string };

function readPref<T>(key: string, validate: (value: unknown) => value is T): PrefReadOutcome<T> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch (err) {
    return { state: 'unavailable', reason: `无法读取本地偏好（${String(err)}）` };
  }
  if (raw === null) return { state: 'absent' };
  try {
    const parsed: unknown = JSON.parse(raw) as unknown;
    return validate(parsed) ? { state: 'valid', value: parsed } : { state: 'absent' };
  } catch {
    // Corrupt value: treat as absent and clear it so the next read is clean.
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* quarantine failure — harmless */
    }
    return { state: 'absent' };
  }
}

function writePref(key: string, value: unknown): PrefWriteOutcome {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { state: 'persisted' };
  } catch (err) {
    return { state: 'unavailable', reason: `无法保存本地偏好（${String(err)}）` };
  }
}

function removePref(key: string): PrefWriteOutcome {
  try {
    window.localStorage.removeItem(key);
    return { state: 'persisted' };
  } catch (err) {
    return { state: 'unavailable', reason: `无法清除本地偏好（${String(err)}）` };
  }
}

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isString = (v: unknown): v is string => typeof v === 'string';
const isSessionType = (v: unknown): v is 'full' | 'lite' => v === 'full' || v === 'lite';

// ── Per-turn target preferences (Plan §4.3 defaults) ────────────────────────

/** `cache_enabled` — conversation-local, default true. */
export function readCacheEnabled(conversationId: number): boolean {
  const out = readPref(KEY_CACHE_ENABLED(conversationId), isBoolean);
  return out.state === 'valid' ? out.value : true;
}

export function writeCacheEnabled(conversationId: number, enabled: boolean): PrefWriteOutcome {
  return writePref(KEY_CACHE_ENABLED(conversationId), enabled);
}

/** `session_type` — conversation-local, default 'lite'. */
export function readSessionType(conversationId: number): 'full' | 'lite' {
  const out = readPref(KEY_SESSION_TYPE(conversationId), isSessionType);
  return out.state === 'valid' ? out.value : 'lite';
}

export function writeSessionType(conversationId: number, sessionType: 'full' | 'lite'): PrefWriteOutcome {
  return writePref(KEY_SESSION_TYPE(conversationId), sessionType);
}

/** g045-only memory injection flag — conversation-local, default true. */
export function readMemoryInjection(conversationId: number): boolean {
  const out = readPref(KEY_MEMORY_INJECT(conversationId), isBoolean);
  return out.state === 'valid' ? out.value : true;
}

export function writeMemoryInjection(conversationId: number, enabled: boolean): PrefWriteOutcome {
  return writePref(KEY_MEMORY_INJECT(conversationId), enabled);
}

/** Conversation-local Aura selection id; fallback resolved by the theme. */
export function readAuraSelection(conversationId: number): string | null {
  const out = readPref(KEY_AURA(conversationId), isString);
  return out.state === 'valid' && out.value !== '' ? out.value : null;
}

export function writeAuraSelection(conversationId: number, paletteId: string | null): PrefWriteOutcome {
  if (paletteId === null) return removePref(KEY_AURA(conversationId));
  return writePref(KEY_AURA(conversationId), paletteId);
}