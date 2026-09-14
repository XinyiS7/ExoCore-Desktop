import { contractError } from '../chat/api';
import {
  type AssistantMessageArrivedV1,
  parseArrivalEvent,
} from './workerContract';

export type { AssistantMessageArrivedV1 };

export interface AssistantArrivalPage {
  events: AssistantMessageArrivedV1[];
  next_cursor: number;
  has_more: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fail-closed validation for an individual AssistantMessageArrivedV1 event.
 * Delegates parsing directly to pure worker/window-safe parseArrivalEvent from workerContract.
 * Wraps any parse failure into contractError.
 */
export function validateArrivalEvent(raw: unknown): AssistantMessageArrivedV1 {
  const result = parseArrivalEvent(raw);
  if (!result.ok) {
    throw contractError(result.error, raw);
  }
  return result.value;
}

/**
 * Validates a paginated arrival response from GET /api/push/assistant-arrivals/.
 *
 * Fail closed if:
 * - Response is not an object, has_more is not boolean, next_cursor is not a non-negative integer.
 * - Events array is invalid or any event violates event-level schema.
 * - Events are not in strictly ascending event_id order.
 * - Duplicate event_id or dedupe_key is detected within the page.
 * - next_cursor regresses behind the last event's event_id when events are present.
 */
export function validateArrivalPage(raw: unknown): AssistantArrivalPage {
  if (!isRecord(raw)) {
    throw contractError('到达分页响应不是有效对象', raw);
  }

  if (!Array.isArray(raw.events)) {
    throw contractError('到达分页响应 events 必须为数组', raw);
  }

  if (typeof raw.has_more !== 'boolean') {
    throw contractError('到达分页响应 has_more 必须为布尔值', raw);
  }

  if (typeof raw.next_cursor !== 'number' || !Number.isInteger(raw.next_cursor) || raw.next_cursor < 0) {
    throw contractError('到达分页响应 next_cursor 必须为非负整数', raw);
  }

  const events: AssistantMessageArrivedV1[] = [];
  const seenEventIds = new Set<number>();
  const seenDedupeKeys = new Set<string>();
  let previousEventId = -1;

  for (const item of raw.events) {
    const validated = validateArrivalEvent(item);

    // Strict ascending order
    if (validated.event_id <= previousEventId) {
      throw contractError(`到达分页 events 未按 event_id 严格升序排列 (${validated.event_id} <= ${previousEventId})`, raw);
    }
    previousEventId = validated.event_id;

    // Deduplication check
    if (seenEventIds.has(validated.event_id) || seenDedupeKeys.has(validated.dedupe_key)) {
      throw contractError(`到达分页包含重复事件 ${validated.event_id} / ${validated.dedupe_key}`, raw);
    }
    seenEventIds.add(validated.event_id);
    seenDedupeKeys.add(validated.dedupe_key);

    events.push(validated);
  }

  // next_cursor consistency with page
  if (events.length > 0) {
    const lastEventId = events[events.length - 1].event_id;
    if (raw.next_cursor < lastEventId) {
      throw contractError(`到达分页 next_cursor (${raw.next_cursor}) 小于当页最新事件 event_id (${lastEventId})`, raw);
    }
  }

  return {
    events,
    next_cursor: raw.next_cursor,
    has_more: raw.has_more,
  };
}

/**
 * Route mapping helper for AssistantMessageArrivedV1 targets.
 */
export function toConversationRoute(conversationId: number): string {
  return `/chat/${conversationId}`;
}
