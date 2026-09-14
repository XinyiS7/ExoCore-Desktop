import { AssistantMessageArrivedV1, validateArrivalEvent } from './contract';

/**
 * Window-only LocalStorage Persistence for Phase 2D Notifications (D3, D1-R1-03).
 *
 * Enforces:
 * - Single installation identity (UUID v4).
 * - Distinct representation of bootstrap/uninitialized cursor (`lastContiguousCursor: null`).
 * - Explicit outcome modelling (ok, absent, corrupted, unavailable).
 * - Quarantine on JSON or schema corruption without silent loss or mask.
 * - Monotonic cursor progression and multi-tab merge safety on writes.
 * - Bounded unread map capacity to prevent local storage quota exhaustion.
 */

export const NOTIFICATIONS_STORAGE_KEY = 'exo:v4:notifications';
export const NOTIFICATIONS_QUARANTINE_PREFIX = 'exo:v4:notifications:quarantine:';
export const MAX_UNREAD_ENTRIES = 100;

export interface StoredArrivalRecord {
  event: AssistantMessageArrivedV1;
  source: 'poll' | 'push';
  receivedAt: number;
}

export interface InstallationStorage {
  version: 1;
  installationId: string;
  lastContiguousCursor: number | null;
  unreadMap: Record<string, StoredArrivalRecord>;
}

export type StorageLoadOutcome =
  | { status: 'ok'; storage: InstallationStorage }
  | { status: 'absent' }
  | { status: 'corrupted'; reason: string }
  | { status: 'unavailable'; error: string };

export type StorageWriteOutcome =
  | { status: 'ok'; storage: InstallationStorage }
  | { status: 'unavailable'; error: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(uuid: string): boolean {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for test environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Moves corrupt raw data to a quarantine key for post-mortem forensics,
 * removing it from the primary storage key.
 */
export function quarantineStorage(raw: string, reason: string): void {
  try {
    const key = `${NOTIFICATIONS_QUARANTINE_PREFIX}${Date.now()}`;
    const payload = JSON.stringify({
      reason,
      raw,
      quarantinedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, payload);
    localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  } catch {
    // If quarantine writing fails, still attempt to clear broken primary key
    try {
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    } catch {
      // Ignored
    }
  }
}

/**
 * Strictly loads and validates the current installation storage.
 */
export function loadInstallationStorage(): StorageLoadOutcome {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  } catch (err) {
    return { status: 'unavailable', error: err instanceof Error ? err.message : String(err) };
  }

  if (raw === null || raw.trim() === '') {
    return { status: 'absent' };
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantineStorage(raw, 'JSON parse failed');
    return { status: 'corrupted', reason: 'JSON parse failed' };
  }

  if (!isRecord(parsed)) {
    quarantineStorage(raw, 'Root is not an object');
    return { status: 'corrupted', reason: 'Root is not an object' };
  }

  if (parsed.version !== 1) {
    quarantineStorage(raw, `Unsupported schema version: ${parsed.version}`);
    return { status: 'corrupted', reason: `Unsupported schema version: ${parsed.version}` };
  }

  if (typeof parsed.installationId !== 'string' || !isValidUuid(parsed.installationId)) {
    quarantineStorage(raw, 'Invalid installationId UUID');
    return { status: 'corrupted', reason: 'Invalid installationId UUID' };
  }

  const cursor = parsed.lastContiguousCursor;
  if (cursor !== null && (!Number.isInteger(cursor) || (cursor as number) < 0)) {
    quarantineStorage(raw, 'Invalid lastContiguousCursor');
    return { status: 'corrupted', reason: 'Invalid lastContiguousCursor' };
  }

  if (!isRecord(parsed.unreadMap)) {
    quarantineStorage(raw, 'unreadMap is not an object');
    return { status: 'corrupted', reason: 'unreadMap is not an object' };
  }

  const validatedUnreadMap: Record<string, StoredArrivalRecord> = {};
  for (const [key, entry] of Object.entries(parsed.unreadMap)) {
    if (!isRecord(entry)) {
      quarantineStorage(raw, `Malformed entry in unreadMap at ${key}`);
      return { status: 'corrupted', reason: `Malformed entry in unreadMap at ${key}` };
    }
    if (entry.source !== 'poll' && entry.source !== 'push') {
      quarantineStorage(raw, `Invalid source in unreadMap at ${key}`);
      return { status: 'corrupted', reason: `Invalid source in unreadMap at ${key}` };
    }
    if (typeof entry.receivedAt !== 'number' || !Number.isFinite(entry.receivedAt)) {
      quarantineStorage(raw, `Invalid receivedAt in unreadMap at ${key}`);
      return { status: 'corrupted', reason: `Invalid receivedAt in unreadMap at ${key}` };
    }

    try {
      const validatedEvent = validateArrivalEvent(entry.event);
      if (key !== validatedEvent.dedupe_key) {
        quarantineStorage(raw, `Key mismatch in unreadMap: ${key} vs ${validatedEvent.dedupe_key}`);
        return { status: 'corrupted', reason: `Key mismatch in unreadMap: ${key} vs ${validatedEvent.dedupe_key}` };
      }
      validatedUnreadMap[key] = {
        event: validatedEvent,
        source: entry.source,
        receivedAt: entry.receivedAt,
      };
    } catch (err) {
      quarantineStorage(raw, `Event validation failed in unreadMap: ${err instanceof Error ? err.message : String(err)}`);
      return { status: 'corrupted', reason: `Event validation failed in unreadMap: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  return {
    status: 'ok',
    storage: {
      version: 1,
      installationId: parsed.installationId,
      lastContiguousCursor: cursor as number | null,
      unreadMap: validatedUnreadMap,
    },
  };
}

/**
 * Initializes clean storage if absent or corrupted, or returns existing healthy storage.
 */
export function initializeStorage(): StorageWriteOutcome {
  const loadResult = loadInstallationStorage();
  if (loadResult.status === 'ok') {
    return { status: 'ok', storage: loadResult.storage };
  }
  if (loadResult.status === 'unavailable') {
    return { status: 'unavailable', error: loadResult.error };
  }

  const freshStorage: InstallationStorage = {
    version: 1,
    installationId: generateUuid(),
    lastContiguousCursor: null, // Bootstrap required
    unreadMap: {},
  };

  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(freshStorage));
    return { status: 'ok', storage: freshStorage };
  } catch (err) {
    return { status: 'unavailable', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Applies bounding to unreadMap by pruning oldest entries if exceeding MAX_UNREAD_ENTRIES.
 */
function boundUnreadMap(map: Record<string, StoredArrivalRecord>): Record<string, StoredArrivalRecord> {
  const entries = Object.entries(map);
  if (entries.length <= MAX_UNREAD_ENTRIES) {
    return map;
  }

  // Sort by receivedAt ASC (oldest first)
  entries.sort((a, b) => a[1].receivedAt - b[1].receivedAt);
  const toKeep = entries.slice(entries.length - MAX_UNREAD_ENTRIES);
  const bounded: Record<string, StoredArrivalRecord> = {};
  for (const [k, v] of toKeep) {
    bounded[k] = v;
  }
  return bounded;
}

/**
 * Core transaction mutator. Always reads the latest snapshot from localStorage,
 * applies changes, guarantees cursor monotonicity, bounds the unread map, and writes atomically.
 */
export function mutateStorage(
  mutator: (current: InstallationStorage) => {
    nextCursor?: number | null;
    unreadMapUpdate?: Record<string, StoredArrivalRecord>;
    removeDedupeKeys?: string[];
  },
): StorageWriteOutcome {
  const initResult = initializeStorage();
  if (initResult.status !== 'ok') {
    return initResult;
  }

  // Re-read latest state to handle multi-tab concurrency
  const latestLoad = loadInstallationStorage();
  const current = latestLoad.status === 'ok' ? latestLoad.storage : initResult.storage;

  const mutation = mutator(current);

  // Monotonic cursor calculation
  let finalCursor = current.lastContiguousCursor;
  if (mutation.nextCursor !== undefined) {
    if (current.lastContiguousCursor === null) {
      finalCursor = mutation.nextCursor;
    } else if (mutation.nextCursor !== null) {
      finalCursor = Math.max(current.lastContiguousCursor, mutation.nextCursor);
    }
  }

  // Merge unread map
  const nextUnreadMap = { ...current.unreadMap, ...(mutation.unreadMapUpdate ?? {}) };
  if (mutation.removeDedupeKeys) {
    for (const key of mutation.removeDedupeKeys) {
      delete nextUnreadMap[key];
    }
  }

  const boundedMap = boundUnreadMap(nextUnreadMap);

  const finalStorage: InstallationStorage = {
    version: 1,
    installationId: current.installationId, // Immutable
    lastContiguousCursor: finalCursor,
    unreadMap: boundedMap,
  };

  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(finalStorage));
    return { status: 'ok', storage: finalStorage };
  } catch (err) {
    return { status: 'unavailable', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Ingests validated arrival events, advancing cursor atomically if specified.
 */
export function ingestArrivals(
  events: AssistantMessageArrivedV1[],
  source: 'poll' | 'push',
  advanceToCursor?: number,
): StorageWriteOutcome {
  const now = Date.now();
  return mutateStorage((current) => {
    const unreadMapUpdate: Record<string, StoredArrivalRecord> = {};
    for (const ev of events) {
      // If event_id <= lastContiguousCursor and not already unread, it was previously consumed
      if (current.lastContiguousCursor !== null && ev.event_id <= current.lastContiguousCursor) {
        if (!current.unreadMap[ev.dedupe_key]) {
          continue;
        }
      }
      unreadMapUpdate[ev.dedupe_key] = {
        event: ev,
        source,
        receivedAt: now,
      };
    }

    return {
      nextCursor: advanceToCursor !== undefined ? advanceToCursor : current.lastContiguousCursor,
      unreadMapUpdate,
    };
  });
}

/**
 * Commits high-water mark cursor forward without altering unread messages.
 */
export function commitCursor(cursor: number): StorageWriteOutcome {
  return mutateStorage((current) => ({
    nextCursor: current.lastContiguousCursor === null ? cursor : Math.max(current.lastContiguousCursor, cursor),
  }));
}

/**
 * Consumes unread arrivals matching confirmed canonical message IDs for an exact conversation.
 */
export function consumeArrivalsByMessageIds(
  conversationId: number,
  messageIds: Set<number>,
): StorageWriteOutcome {
  return mutateStorage((current) => {
    const removeDedupeKeys: string[] = [];
    for (const [key, record] of Object.entries(current.unreadMap)) {
      if (record.event.conversation_id === conversationId && messageIds.has(record.event.message_id)) {
        removeDedupeKeys.push(key);
      }
    }
    return { removeDedupeKeys };
  });
}

/**
 * Retrieves the current installation UUID if available, initializing clean storage if needed.
 * Returns null if storage is unavailable or corrupt.
 */
export function getInstallationId(): string | null {
  const init = initializeStorage();
  if (init.status === 'ok') {
    return init.storage.installationId;
  }
  return null;
}

