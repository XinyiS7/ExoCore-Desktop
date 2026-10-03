import { describe, expect, it } from 'vitest';
import {
  dateOnlyPrefix,
  eventDays,
  eventLocalRangeText,
  instantLocalClock,
  instantLocalDateTime,
  isTimedValue,
  shiftDay,
  shiftMonth,
  sourceOffsetToken,
} from '../features/tasks/calendarDates';
import type { CalendarEvent } from '../features/tasks/types';

/**
 * Pure CP3 helper tests — no server, no DOM. Timed fixtures are built from
 * local wall-clock components so every expectation is valid in any runtime
 * timezone (including DST-observing zones).
 */
let eventSeq = 0;
function ev(overrides: Pick<CalendarEvent, 'start' | 'end' | 'all_day'> & Partial<CalendarEvent>): CalendarEvent {
  eventSeq += 1;
  return {
    id: `date-test-${eventSeq}`,
    source: 'gcal',
    title: 'event',
    description: '',
    location: null,
    html_link: null,
    entry_type: null,
    status: null,
    exocore_entry_id: null,
    calendar_name: null,
    calendar_id: null,
    ...overrides,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * `YYYY-MM-DDTHH:mm:00±HH:MM` for the runtime's local zone. Formatting the
 * normalized Date components keeps nonexistent/ambiguous wall times honest.
 */
function localIso(day: string, hour: number, minute = 0): string {
  const [year, month, date] = day.split('-').map(Number);
  const at = new Date(year, month - 1, date, hour, minute, 0, 0);
  const offsetMinutes = -at.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const localDay = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `${localDay}T${pad(at.getHours())}:${pad(at.getMinutes())}:00${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

describe('calendar date-only arithmetic', () => {
  it('crosses month, year and leap boundaries without a timezone instant', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDay('2023-02-28', 1)).toBe('2023-03-01');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('extracts only real date-only prefixes', () => {
    expect(dateOnlyPrefix('2026-10-02T09:30:00+02:00')).toBe('2026-10-02');
    expect(dateOnlyPrefix('2026-10-02')).toBe('2026-10-02');
    expect(dateOnlyPrefix('nope')).toBeNull();
    expect(dateOnlyPrefix('')).toBeNull();
  });
});

describe('eventDays half-open mapping', () => {
  it('keeps all-day ends exclusive and always covers at least the start day', () => {
    expect(eventDays(ev({ start: '2026-10-02', end: '2026-10-04', all_day: true })))
      .toEqual(['2026-10-02', '2026-10-03']);
    expect(eventDays(ev({ start: '2026-10-02', end: '2026-10-03', all_day: true })))
      .toEqual(['2026-10-02']);
    expect(eventDays(ev({ start: '2026-10-02', end: '2026-10-02', all_day: true })))
      .toEqual(['2026-10-02']);
    expect(eventDays(ev({ start: '2026-10-02', end: '', all_day: true })))
      .toEqual(['2026-10-02']);
  });

  it('never truncates a long all-day range at an arbitrary cap', () => {
    const days = eventDays(ev({ start: '2019-07-01', end: '2021-01-01', all_day: true }));
    expect(days).toHaveLength(550);
    expect(days[0]).toBe('2019-07-01');
    expect(days[days.length - 1]).toBe('2020-12-31');
  });

  it('clips half-open ranges to inclusive snapshot bounds and drops out-of-window events', () => {
    expect(eventDays(
      ev({ start: '2019-07-01', end: '2021-01-01', all_day: true }),
      { start: '2020-02-10', end: '2020-02-15' },
    )).toEqual([
      '2020-02-10',
      '2020-02-11',
      '2020-02-12',
      '2020-02-13',
      '2020-02-14',
      '2020-02-15',
    ]);
    expect(eventDays(
      ev({ start: '2020-01-01', end: '2020-01-02', all_day: true }),
      { start: '2020-02-10', end: '2020-02-15' },
    )).toEqual([]);
    expect(eventDays(
      ev({ start: '2021-01-01', end: '2021-01-02', all_day: true }),
      { start: '2020-02-10', end: '2020-02-15' },
    )).toEqual([]);
  });

  it('maps timed instants to local days with an exclusive local-midnight end', () => {
    expect(eventDays(ev({
      start: localIso('2026-10-02', 22),
      end: localIso('2026-10-03', 0),
      all_day: false,
    }))).toEqual(['2026-10-02']);

    expect(eventDays(ev({
      start: localIso('2026-10-02', 20),
      end: localIso('2026-10-04', 10),
      all_day: false,
    }))).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);

    // A truncated/garbage end must not fabricate extra local days.
    expect(eventDays(ev({
      start: localIso('2026-10-02', 20),
      end: 'nope',
      all_day: false,
    }))).toEqual(['2026-10-02']);
  });

  it('renders identical instants consistently regardless of the source offset', () => {
    const berlin = ev({
      start: '2026-10-02T22:00:00+02:00',
      end: '2026-10-03T02:00:00+02:00',
      all_day: false,
    });
    const utc = ev({
      start: '2026-10-02T20:00:00Z',
      end: '2026-10-03T00:00:00Z',
      all_day: false,
    });
    expect(eventDays(berlin)).toEqual(eventDays(utc));
    expect(eventLocalRangeText(berlin)).toBe(eventLocalRangeText(utc));
    expect(instantLocalClock(berlin.start)).toBe(instantLocalClock(utc.start));
  });
});

describe('instant and source-offset text', () => {
  it('formats browser-local values and surfaces the explicit source offset', () => {
    expect(isTimedValue('2026-10-02T09:30:00+02:00')).toBe(true);
    expect(isTimedValue('2026-10-02')).toBe(false);
    expect(isTimedValue('not-a-date')).toBe(false);

    const at = new Date('2026-10-02T09:30:00+02:00');
    expect(instantLocalClock(at)).toBe(`${pad(at.getHours())}:${pad(at.getMinutes())}`);
    expect(instantLocalDateTime(localIso('2026-10-02', 9, 30))).toBe('2026-10-02 09:30');

    expect(sourceOffsetToken('2026-10-02T09:30:00+02:00')).toBe('+02:00');
    expect(sourceOffsetToken('2026-10-02T07:30:00Z')).toBe('Z');
    expect(sourceOffsetToken('2026-10-02T09:30:00+0200')).toBe('+0200');
    expect(sourceOffsetToken('2026-10-02')).toBeNull();

    // A timed event without an explicit offset is still a real instant.
    expect(sourceOffsetToken('2026-10-02T09:30:00')).toBeNull();
    expect(isTimedValue('2026-10-02T09:30:00')).toBe(true);
  });

  it('labels a local range and collapses a single-instant range', () => {
    const range = eventLocalRangeText(ev({
      start: localIso('2026-10-02', 9, 30),
      end: localIso('2026-10-02', 10, 30),
      all_day: false,
    }));
    expect(range).toBe('2026-10-02 09:30 → 2026-10-02 10:30');
    expect(eventLocalRangeText(ev({
      start: localIso('2026-10-02', 9, 30),
      end: localIso('2026-10-02', 9, 30),
      all_day: false,
    }))).toBe('2026-10-02 09:30');
    expect(eventLocalRangeText(ev({ start: 'nope', end: 'nope', all_day: false }))).toBeNull();
  });
});
