/**
 * Pure calendar date/instant helpers for the CP3 Calendar companion.
 *
 * Two distinct domains, never mixed:
 * - Date-only `YYYY-MM-DD` strings (all-day events, snapshot windows) use pure
 *   UTC-basis calendar arithmetic and are never passed through a local-timezone
 *   conversion.
 * - Timed ISO strings (GCal `dateTime`, raw source offsets) denote instants.
 *   They are converted to the browser-local timezone for grouping and display
 *   (explicitly labelled 本地时区), and their source offset is surfaced so the
 *   local reading is never mistaken for the original wall time.
 *
 * `eventDays` implements half-open ranges:
 * - all-day: `[start, end)` — `end` is exclusive per the GCal convention; the
 *   backend writes `ref_date + 1 day` in `_format_date_range`;
 * - timed: `[startInstant, endInstant)` — the end instant contributes a day
 *   only when it is strictly past local midnight, so an event ending exactly
 *   at 00:00 occupies no additional local day.
 *
 * Results may be clipped to the inclusive snapshot window (`window_start` →
 * `window_end` are both covered) and are never truncated by an arbitrary cap.
 */

import type { CalendarEvent } from './types';

export interface CalendarDayBounds {
  /** Inclusive first date-only day. */
  start: string;
  /** Inclusive last date-only day. */
  end: string;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_COMPONENT = /T?\d{2}:\d{2}/;
const SOURCE_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Pure date-only arithmetic (UTC basis) — never a local-timezone instant. */
export function shiftDay(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + delta));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Pure month arithmetic for `YYYY-MM` values. */
export function shiftMonth(value: string, delta: number): string {
  const [year, month] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}`;
}

/** Valid date-only prefix (`YYYY-MM-DD`) of a snapshot value, else `null`. */
export function dateOnlyPrefix(value: string): string | null {
  const prefix = value.slice(0, 10);
  return DATE_ONLY.test(prefix) ? prefix : null;
}

/** True when the value carries a parseable time component (a real instant). */
export function isTimedValue(value: string): boolean {
  return TIME_COMPONENT.test(value) && !Number.isNaN(new Date(value).getTime());
}

/** Parsed instant, or `null` when the value is not a valid date. */
export function parseTimedInstant(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toDate(value: string | Date): Date | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Browser-local calendar day of an instant. Do not pass date-only strings. */
export function instantLocalDay(value: string | Date): string | null {
  const date = toDate(value);
  return date === null ? null : localDay(date);
}

/** Browser-local `HH:mm` of an instant. Do not pass date-only strings. */
export function instantLocalClock(value: string | Date): string | null {
  const date = toDate(value);
  return date === null ? null : `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Browser-local `YYYY-MM-DD HH:mm` of an instant. Do not pass date-only strings. */
export function instantLocalDateTime(value: string | Date): string | null {
  const date = toDate(value);
  if (date === null) return null;
  return `${localDay(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Explicit source offset token (`Z` / `+02:00` / `+0200`); `null` if absent. */
export function sourceOffsetToken(value: string): string | null {
  const match = SOURCE_OFFSET.exec(value);
  return match ? match[1] : null;
}

/** Browser-local start → end text for a timed event; `null` without a valid start. */
export function eventLocalRangeText(event: CalendarEvent): string | null {
  const start = instantLocalDateTime(event.start);
  if (start === null) return null;
  const end = instantLocalDateTime(event.end);
  return end === null || end === start ? start : `${start} → ${end}`;
}

/**
 * Days the event occupies as half-open ranges, optionally clipped to inclusive
 * snapshot bounds. Returns `[]` for unparseable dates and out-of-window events.
 */
export function eventDays(event: CalendarEvent, bounds?: CalendarDayBounds | null): string[] {
  const startDay = dateOnlyPrefix(event.start);
  if (startDay === null) return [];

  let first = startDay;
  let last = startDay;

  if (!event.all_day && isTimedValue(event.start)) {
    const start = parseTimedInstant(event.start);
    if (start === null) return [];
    first = localDay(start);
    last = first;
    const end = parseTimedInstant(event.end);
    if (end !== null && end.getTime() > start.getTime()) {
      // Half-open instant range: the last occupied local day is end - 1ms.
      last = localDay(new Date(end.getTime() - 1));
    }
  } else {
    const endDay = dateOnlyPrefix(event.end);
    if (endDay !== null && endDay > startDay) last = shiftDay(endDay, -1);
  }

  const lower = bounds && bounds.start > first ? bounds.start : first;
  const upper = bounds && bounds.end < last ? bounds.end : last;
  const days: string[] = [];
  for (let cursor = lower; cursor <= upper; cursor = shiftDay(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}
