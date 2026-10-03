import { afterEach, describe, expect, it } from 'vitest';
import { createMemo, createMemoReply, fetchMemoThread, normalizeMemo, replaceMemoTags } from '../features/memo/api';
import { extractMemoTags, normalizeTags } from '../features/memo/tags';
import { AppApiError } from '../features/chat/api';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const root = { id: 7, author: 'agent:2', content: '正文', parent_id: null, created_at: '2026-10-02T12:00:00Z', tags: [] };
afterEach(unmockFetch);
describe('Memo CP2 grammar', () => {
  it('requires start/whitespace boundary, accepts Unicode letters/marks/numbers/_/-, leaves content unchanged', () => {
    const content = '#中文 #Cafe\u0301 #𐐀𐐁 #AbC #abc #AbC #a-b_2\n# \nhttps://x/#url word#inline (#paren) #tag!';
    expect(extractMemoTags(content)).toEqual({ tags: ['中文', 'Cafe\u0301', '𐐀𐐁', 'AbC', 'abc', 'a-b_2', 'tag'], error: null });
    expect(content).toContain('word#inline');
  });
  it('counts Unicode codepoints, accepts 50 astral letters, rejects 51 without truncating', () => {
    expect(extractMemoTags(`#${'𐐀'.repeat(50)}`).error).toBeNull();
    const tooLong = extractMemoTags(`#${'𐐀'.repeat(51)}`);
    expect(tooLong.error).toContain('超过 50');
    expect(tooLong.tags[0]).toBe('𐐀'.repeat(51));
    expect(normalizeTags([' x ', 'x', '', 'X'])).toEqual({ tags: ['x', 'X'], error: null });
  });
});
describe('Memo CP2 API adapters', () => {
  it('POSTs raw content only; confirms bare id/parent; PATCHs separate tags; details have no reply_count', async () => {
    const { calls } = installFetch([
      { test: '/api/core/memos/', method: 'POST', handler: () => jsonResponse(root, 201) },
      { test: '/api/core/memos/9/replies/', method: 'POST', handler: () => jsonResponse({ ...root, id: 10, parent_id: 9 }, 201) },
      { test: '/api/core/memos/7/tags/', method: 'PATCH', handler: () => jsonResponse({ ...root, tags: ['Tag'] }) },
      { test: '/api/core/memos/7/', method: 'GET', handler: () => jsonResponse({ memo: root, replies: [{ ...root, id: 9, parent_id: 7 }, { ...root, id: 10, parent_id: 9 }] }) },
    ]);
    expect(await createMemo('  raw #Tag  ')).toEqual(root);
    expect(await createMemoReply(9, 'nested')).toMatchObject({ id: 10, parent_id: 9 });
    expect(await replaceMemoTags(7, ['Tag'])).toMatchObject({ tags: ['Tag'] });
    expect(await fetchMemoThread(7)).toMatchObject({ replies: [{ id: 9, parent_id: 7 }, { id: 10, parent_id: 9 }] });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ content: '  raw #Tag  ' });
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ tags: ['Tag'] });
    expect(normalizeMemo(root)).not.toHaveProperty('reply_count');
  });
  it.each([400, 403, 404])('preserves definite HTTP%i failures without ambiguousWrite', async (status) => {
    const body = { error: 'rejected' };
    installFetch([{ test: '/api/core/memos/', handler: () => jsonResponse(body, status) }]);
    await expect(createMemo('draft')).rejects.toMatchObject({ status, body, ambiguousWrite: false, message: 'rejected' });
  });
  it.each([500, 503])('marks HTTP%i POST as uncertain', async (status) => {
    installFetch([{ test: '/api/core/memos/', handler: () => jsonResponse({ error: 'uncertain' }, status) }]);
    await expect(createMemo('draft')).rejects.toMatchObject({ status, ambiguousWrite: true });
  });
  it('marks network failures and malformed successful POST as uncertain, never creates tags against guessed id', async () => {
    installFetch([{ test: '/api/core/memos/', handler: () => { throw new TypeError('network'); } }]);
    await expect(createMemo('draft')).rejects.toMatchObject({ ambiguousWrite: true });
    const { calls } = installFetch([{ test: '/api/core/memos/', handler: () => jsonResponse({ created: true }, 201) }]);
    await expect(createMemo('draft')).rejects.toMatchObject({ ambiguousWrite: true, code: 'CONTRACT' });
    expect(calls).toHaveLength(1);
  });
  it('rejects wrong reply parent and malformed thread graph rather than flattening real relationships', async () => {
    installFetch([
      { test: '/api/core/memos/9/replies/', handler: () => jsonResponse({ ...root, id: 10, parent_id: 7 }, 201) },
      { test: '/api/core/memos/7/', handler: () => jsonResponse({ memo: root, replies: [{ ...root, id: 9, parent_id: 10 }, { ...root, id: 10, parent_id: 9 }] }) },
    ]);
    await expect(createMemoReply(9, 'reply')).rejects.toMatchObject({ ambiguousWrite: true, code: 'CONTRACT' });
    await expect(fetchMemoThread(7)).rejects.toBeInstanceOf(AppApiError);
  });
  it('supports clearing tags with [], identity guards the PATCH response', async () => {
    const { calls } = installFetch([{ test: '/api/core/memos/7/tags/', handler: () => jsonResponse(root) }]);
    await replaceMemoTags(7, []);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ tags: [] });
    installFetch([{ test: '/api/core/memos/7/tags/', handler: () => jsonResponse({ ...root, id: 9 }) }]);
    await expect(replaceMemoTags(7, [])).rejects.toMatchObject({ code: 'CONTRACT', ambiguousWrite: false });
  });
});
