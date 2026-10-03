import { afterEach, describe, expect, it } from 'vitest';
import { fetchOpenTasks, fetchRiverPage, normalizeOpenTasks, normalizeRiverItem, normalizeRiverPage, normalizeSources, RiverApiError } from '../features/river/api';
import { fetchCanonicalDiary, normalizeCanonicalDiary } from '../features/diary/api';
import { AppApiError } from '../features/chat/api';
import { riverQueryKeys } from '../features/river/queries';
import { allItems, diaryDetail, diaryItem, memoItem, openTask, taskCompleted, taskCreated } from './river_fixtures';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

afterEach(unmockFetch);
describe('River CP1 read contracts', () => {
  it('preserves source order, composite identity, direct reply count and nullable task fields', () => {
    const page = normalizeRiverPage({ items: allItems, next_cursor: null });
    expect(page.items).toEqual(allItems);
    expect(page.items.map((item) => `${item.source_type}:${item.source_id}`)).toEqual(allItems.map((item) => `${item.source_type}:${item.source_id}`));
    expect(normalizeRiverItem(taskCreated)).not.toEqual(normalizeRiverItem(taskCompleted));
    expect(normalizeRiverItem(memoItem)).toMatchObject({ source_specific: { reply_count: 2 } });
  });
  it('canonicalizes sources in both key and request without decoding cursors', async () => {
    const cursor = 'opaque:+/==&?签名';
    const { calls } = installFetch([{ test: '/api/core/river/', handler: () => jsonResponse({ items: [], next_cursor: null }) }]);
    await fetchRiverPage({ sources: ['task', 'memo', 'task'], presetId: 6, cursor });
    expect(normalizeSources(['task', 'memo', 'task'])).toEqual(['memo', 'task']);
    expect(riverQueryKeys.pages({ sources: ['task', 'memo', 'task'], presetId: 6 })).toEqual(riverQueryKeys.pages({ sources: ['memo', 'task'], presetId: 6 }));
    expect(calls[0].url.searchParams.get('cursor')).toBe(cursor);
    expect(calls[0].url.searchParams.get('sources')).toBe('memo,task');
    expect(calls[0].url.searchParams.get('preset_id')).toBe('6');
    expect(calls[0].url.searchParams.get('limit')).toBe('20');
  });
  it.each([{ items: [], next_cursor: '' }, { items: [], next_cursor: 2 }, { items: null, next_cursor: null }, { next_cursor: null }])('rejects malformed page envelope %j instead of an empty success', (raw) => {
    expect(() => normalizeRiverPage(raw)).toThrow(AppApiError);
  });
  it.each([
    { ...memoItem, target: { type: 'task', entry_id: 7 } },
    { ...memoItem, source_specific: { ...memoItem.source_specific, reply_count: -1 } },
    { ...diaryItem, target: { ...diaryItem.target, day: '2026-09-30' } },
    { ...memoItem, occurred_at: 'invalid' },
  ])('rejects malformed source identities/fields %j', (raw) => {
    expect(() => normalizeRiverItem(raw)).toThrow(AppApiError);
  });
  it('unpacks shelf and preserves backend ordering, no client urgency/pinning sort', async () => {
    const tasks = [openTask, { ...openTask, id: 12, title: '来源次项', is_pinned: true }];
    installFetch([{ test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: tasks }) }]);
    expect(await fetchOpenTasks()).toEqual(tasks);
    expect(() => normalizeOpenTasks(tasks)).toThrow(AppApiError);
    expect(() => normalizeOpenTasks({ items: [{ ...openTask, status: 'archived' }] })).toThrow(AppApiError);
  });
  it.each([
    [503, { error: 'unavailable', code: 'source_unavailable', source_type: 'diary' }],
    [400, { error: 'bad cursor', code: 'malformed_cursor' }],
  ])('retains HTTP %i body/code/source attribution', async (status, body) => {
    installFetch([{ test: '/api/core/river/', handler: () => jsonResponse(body, status) }]);
    await expect(fetchRiverPage()).rejects.toMatchObject({ status, body, code: body.code });
    try { await fetchRiverPage(); } catch (error) {
      expect(error).toBeInstanceOf(RiverApiError);
      if (status === 503) expect(error).toMatchObject({ sourceType: 'diary' });
    }
  });
});
describe('canonical Diary CP1 contract', () => {
  it('requests exact target preset/day and keeps content verbatim', async () => {
    const { calls } = installFetch([{ test: '/api/memory/diaries/6/2026-10-01/', handler: () => jsonResponse(diaryDetail) }]);
    expect(await fetchCanonicalDiary(6, '2026-10-01')).toEqual(diaryDetail);
    expect(calls[0].init?.method).toBe('GET');
    expect(calls[0].url.pathname).toBe('/api/memory/diaries/6/2026-10-01/');
    expect(normalizeCanonicalDiary({ ...diaryDetail, content: '' }, 6, '2026-10-01').content).toBe('');
  });
  it('rejects wrong day/preset and preserves canonical missing error', async () => {
    expect(() => normalizeCanonicalDiary(diaryDetail, 1, '2026-10-01')).toThrow(AppApiError);
    expect(() => normalizeCanonicalDiary(diaryDetail, 6, '2026-10-02')).toThrow(AppApiError);
    installFetch([{ test: '/api/memory/diaries/6/2026-10-01/', handler: () => jsonResponse({ error: 'missing', code: 'diary_not_found' }, 404) }]);
    await expect(fetchCanonicalDiary(6, '2026-10-01')).rejects.toMatchObject({ status: 404, code: 'diary_not_found' });
  });
});
