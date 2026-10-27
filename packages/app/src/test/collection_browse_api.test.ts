import { afterEach, describe, expect, it } from 'vitest';
import {
  CollectionApiError,
  deleteCollectionItem,
  getCollectionItem,
  listCollectionItems,
  listCollectionTags,
  mergeViewIntoDetail,
  normalizeCollectionDetail,
  normalizeCollectionListItem,
  normalizeCollectionPage,
  patchCollectionItem,
  recordCollectionView,
  retryCollectionRepresentation,
} from '../features/collection/api';
import { collectionQueryKeys } from '../features/collection/queries';
import { detailItem, imageDetail, listItem } from './collection_fixtures';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

afterEach(unmockFetch);

describe('Library list contract', () => {
  it('maps every wall filter to its exact HTTP parameter and omits off filters', async () => {
    const cursor = 'opaque:+/==&?签名';
    const { calls } = installFetch([
      { test: '/api/collection/items/', handler: () => jsonResponse({ items: [listItem(3)], next_cursor: null }) },
    ]);
    await listCollectionItems({ kind: 'text', tag: 'reference', q: '海', recent: true, month: '2026-09', link: true }, cursor, 24);
    await listCollectionItems({ recent: false, link: false, q: '' }, null, 24);
    const full = calls[0].url.searchParams;
    expect(Object.fromEntries(full)).toEqual({
      limit: '24', cursor, kind: 'text', tag: 'reference', q: '海', recent: '1', month: '2026-09', link: '1',
    });
    expect(Object.fromEntries(calls[1].url.searchParams)).toEqual({ limit: '24' });
  });

  it('keys traversals by the canonical filter tuple', () => {
    expect(collectionQueryKeys.pages({ q: '', recent: false })).toEqual(collectionQueryKeys.pages({}));
    expect(collectionQueryKeys.pages({ link: true })).not.toEqual(collectionQueryKeys.pages({}));
  });

  it.each([
    { items: [], next_cursor: '' },
    { items: null, next_cursor: null },
    { next_cursor: null },
  ])('rejects malformed page envelope %j', (raw) => {
    expect(() => normalizeCollectionPage(raw)).toThrow();
  });

  it.each([
    listItem(3, { kind: 'video' }),
    listItem(3, { target: { type: 'collection_item', id: 4 } }),
    listItem(3, { tags: [1] }),
    listItem(3, { collected_at: 'nope' }),
    listItem(3, { source: { type: 'web', key: 'x' } }),
  ])('rejects a malformed list item %j', (raw) => {
    expect(() => normalizeCollectionListItem(raw)).toThrow();
  });
});

describe('Library detail contract', () => {
  it('parses comments, viewer stats and the nested source message', () => {
    const detail = normalizeCollectionDetail(detailItem(5));
    expect(detail.source).toEqual({
      type: 'message', key: '88', available: true,
      message: { message_id: 88, conversation_id: 12, index_in_session: 3, role: 'assistant', created_at: '2026-10-13T08:00:00+00:00' },
    });
    expect(detail.comments.map(({ id, author_label, can_delete }) => [id, author_label, can_delete])).toEqual([
      [31, 'Alicia', true],
      [32, 'Alessandro', false],
    ]);
    expect(detail.viewer_stats[1]).toMatchObject({ label: 'Alessandro', last_viewed_at: null });
    expect(detail.original_content_url).toBeNull();
  });

  it('accepts older snapshots without a nested message and parses media detail', () => {
    const legacy = detailItem(5, { source: { type: 'text', key: 't', snapshot: { text: 'x' }, available: true } });
    expect(normalizeCollectionDetail(legacy).source.message).toBeNull();
    const image = normalizeCollectionDetail(imageDetail(6));
    expect(image.representations[0]).toMatchObject({ kind: 'image_preview', state: 'succeeded' });
    expect(image.original_content_url).toBe('/api/collection/items/6/original/');
  });

  it.each([
    detailItem(5, { comments: [{ id: 1, author_type: 'bot', author_label: 'x', body: '', created_at: '2026-10-14T10:00:00Z', can_delete: false }] }),
    detailItem(5, { comments: [{ author_type: 'human', author_label: 'Alicia', body: 'x', created_at: '2026-10-14T10:00:00Z', can_delete: true }] }),
    detailItem(5, { comments: [{ id: 1, author_type: 'human', author_label: 'Alicia', body: 'x', created_at: '2026-10-14T10:00:00Z' }] }),
    detailItem(5, { viewer_stats: [{ viewer_type: 'human', viewer_key: 'alicia', label: 'Alicia', view_count: -1, show_count: 0, collect_count: 0, last_viewed_at: null }] }),
    detailItem(5, { comments: undefined }),
    detailItem(5, { representations: [{ kind: 'audio_transcript' }] }),
  ])('rejects malformed social or representation fields', (raw) => {
    expect(() => normalizeCollectionDetail(raw)).toThrow();
  });

  it('merges a recorded view into the human row, adding it when absent', () => {
    const detail = normalizeCollectionDetail(detailItem(5));
    const view = { view_count: 3, last_viewed_at: '2026-10-15T09:00:00+00:00' };
    expect(mergeViewIntoDetail(detail, view)!.viewer_stats[0]).toMatchObject({ label: 'Alicia', ...view, show_count: 1 });
    const agentOnly = { ...detail, viewer_stats: detail.viewer_stats.slice(1) };
    // Without a human row nothing is invented; the caller refetches the backend-labelled row.
    expect(mergeViewIntoDetail(agentOnly, view)).toBeNull();
  });
});

describe('Library writes and errors', () => {
  it('uses the contracted paths and methods', async () => {
    const { calls } = installFetch([
      { test: '/api/collection/items/5/view/', method: 'POST', handler: () => jsonResponse({ view_count: 3, last_viewed_at: '2026-10-15T09:00:00+00:00' }) },
      { test: '/api/collection/items/5/representations/image_preview/retry/', method: 'POST', handler: () => jsonResponse(imageDetail(5)) },
      { test: '/api/collection/items/5/', method: 'PATCH', handler: () => jsonResponse(detailItem(5, { title: '新' })) },
      { test: '/api/collection/items/5/', method: 'DELETE', handler: () => jsonResponse(null, 204) },
      { test: '/api/collection/items/5/', handler: () => jsonResponse(detailItem(5)) },
      { test: '/api/collection/tags/', handler: () => jsonResponse({ items: [{ name: 'Ref', normalized_name: 'ref', item_count: 2 }] }) },
    ]);
    expect(await recordCollectionView(5)).toEqual({ view_count: 3, last_viewed_at: '2026-10-15T09:00:00+00:00' });
    expect((await retryCollectionRepresentation(5, 'image_preview')).kind).toBe('image');
    expect((await patchCollectionItem(5, { title: '新', tags: [] })).title).toBe('新');
    await expect(deleteCollectionItem(5)).resolves.toBeUndefined();
    expect((await getCollectionItem(5)).id).toBe(5);
    expect(await listCollectionTags()).toEqual([{ name: 'Ref', normalized_name: 'ref', item_count: 2 }]);
    const patch = calls.find((call) => call.init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ title: '新', tags: [] });
  });

  it.each([
    [400, 'malformed_cursor'],
    [400, 'invalid_request'],
    [404, 'collection_item_not_found'],
  ])('keeps HTTP %i code %s', async (status, code) => {
    installFetch([{ test: /^\/api\/collection\/items\//, handler: () => jsonResponse({ error: 'safe', code }, status) }]);
    const error = await listCollectionItems({}, 'c', 24).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(CollectionApiError);
    expect(error).toMatchObject({ status, code, message: 'safe' });
  });

  it('reports a malformed success body as a contract error', async () => {
    installFetch([{ test: '/api/collection/items/5/view/', handler: () => jsonResponse({ view_count: 'x' }) }]);
    await expect(recordCollectionView(5)).rejects.toMatchObject({ code: 'CONTRACT' });
  });
});
