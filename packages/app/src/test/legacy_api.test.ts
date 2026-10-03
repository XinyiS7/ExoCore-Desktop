import { afterEach, describe, expect, it } from 'vitest';
import { AppApiError } from '../features/chat/api';
import {
  LEGACY_KINDS,
  deleteLegacyEvent,
  fetchLegacyEvent,
  isEditableLegacyKind,
  normalizeLegacyEvent,
  updateLegacyEvent,
  type LegacyEvent,
  type LegacyEventPatch,
} from '../features/river/legacyApi';
import { installFetch, jsonResponse, unmockFetch, type RouteHandler } from './helpers';

afterEach(unmockFetch);

const detailPath = '/api/agents/chronicle/7/';
const detail: LegacyEvent = {
  id: 7,
  preset: 6,
  preset_name: 'Alice Agent',
  event_time: '2026-09-15',
  content: '第一行\n第二行',
  scope: null,
  kind: 'milestone',
  message: null,
  keywords: ['a,b', 'c\nd'],
  modified_at: '2026-10-02T12:00:00Z',
};
const patch: LegacyEventPatch = {
  event_time: '2026-09-20',
  content: '改写后',
  scope: null,
  keywords: ['a,b', 'c\nd'],
};

describe('CP4 Legacy detail API', () => {
  it('normalizes the exact serializer row, keeping null scope and comma/newline keyword elements verbatim', () => {
    const normalized = normalizeLegacyEvent(detail);
    expect(normalized).toEqual(detail);
    expect(normalized.scope).toBeNull();
    expect(normalized.keywords).toEqual(['a,b', 'c\nd']);
    expect(LEGACY_KINDS).toEqual(['milestone', 'highlight', 'moment']);
    expect(isEditableLegacyKind('milestone')).toBe(true);
    expect(isEditableLegacyKind('moment')).toBe(true);
    expect(isEditableLegacyKind('highlight')).toBe(false);
    normalized.keywords.push('局部修改');
    expect(detail.keywords).toEqual(['a,b', 'c\nd']);
  });

  it.each([
    ['id 0', { ...detail, id: 0 }],
    ['preset null', { ...detail, preset: null }],
    ['kind bookmark', { ...detail, kind: 'bookmark' }],
    ['message 1.5', { ...detail, message: 1.5 }],
    ['scope number', { ...detail, scope: 3 }],
    ['keyword item number', { ...detail, keywords: ['ok', 3] }],
    ['event_time slash', { ...detail, event_time: '2026/09/15' }],
    ['modified_at garbage', { ...detail, modified_at: 'yesterday' }],
  ])('rejects an off-contract row (%s) instead of synthesizing an editable event', (_name, row) => {
    expect(() => normalizeLegacyEvent(row)).toThrow(AppApiError);
  });

  it('GET reads the exact detail path and refuses a mismatched identity row', async () => {
    const first = installFetch([{ test: detailPath, method: 'GET', handler: () => jsonResponse(detail) }]);
    expect(await fetchLegacyEvent(7)).toEqual(detail);
    expect(first.calls).toHaveLength(1);
    expect(first.calls[0].url.pathname).toBe(detailPath);
    expect(first.calls[0].init?.method).toBe('GET');

    installFetch([{ test: detailPath, method: 'GET', handler: () => jsonResponse({ ...detail, id: 8 }) }]);
    await expect(fetchLegacyEvent(7)).rejects.toMatchObject({ code: 'CONTRACT', status: null, ambiguousWrite: false });

    installFetch([{ test: detailPath, method: 'GET', handler: () => jsonResponse({ detail: '记录不存在' }, 404) }]);
    await expect(fetchLegacyEvent(7)).rejects.toMatchObject({ status: 404, message: '记录不存在' });
  });

  it('PATCH sends exactly event_time/content/scope/keywords and round-trips the returned identity row', async () => {
    let received: Record<string, unknown> | null = null;
    const { calls } = installFetch([{
      test: detailPath,
      method: 'PATCH',
      handler: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        received = body;
        return jsonResponse({ ...detail, ...body, modified_at: '2026-10-02T13:00:00Z' });
      },
    }]);
    const saved = await updateLegacyEvent(7, patch);
    expect(received).toEqual(patch);
    expect(Object.keys(received ?? {}).sort()).toEqual(['content', 'event_time', 'keywords', 'scope']);
    for (const identity of ['id', 'preset', 'preset_name', 'kind', 'message', 'modified_at', 'occurred_at']) {
      expect(received).not.toHaveProperty(identity);
    }
    expect(saved).toEqual({ ...detail, ...patch, modified_at: '2026-10-02T13:00:00Z' });
    expect(saved.keywords).toEqual(patch.keywords);
    expect(saved.id).toBe(detail.id);
    expect(saved.preset).toBe(detail.preset);
    expect(saved.kind).toBe(detail.kind);
    expect(saved.message).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe('PATCH');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(patch);
  });

  it.each<{ name: string; handler: RouteHandler; outcome: Record<string, unknown> }>([
    { name: 'an identity-changing return row', handler: () => jsonResponse({ ...detail, id: 8 }), outcome: { code: 'CONTRACT', ambiguousWrite: true } },
    { name: 'HTTP 500', handler: () => jsonResponse({ error: 'boom' }, 500), outcome: { status: 500, ambiguousWrite: true } },
    { name: 'a lost network', handler: () => { throw new TypeError('Failed to fetch'); }, outcome: { status: null, ambiguousWrite: true } },
    { name: 'HTTP 400 field error', handler: () => jsonResponse({ content: ['不能为空。'] }, 400), outcome: { status: 400, message: '不能为空。', ambiguousWrite: false } },
  ])('classifies the PATCH outcome as settled or ambiguous for $name', async ({ handler, outcome }) => {
    installFetch([{ test: detailPath, method: 'PATCH', handler }]);
    await expect(updateLegacyEvent(7, patch)).rejects.toMatchObject(outcome);
  });

  it('DELETE settles only on an empty 2xx body and keeps every failure as a non-removal error', async () => {
    const first = installFetch([{ test: detailPath, method: 'DELETE', handler: () => jsonResponse(null, 204) }]);
    await expect(deleteLegacyEvent(7)).resolves.toBeUndefined();
    expect(first.calls).toHaveLength(1);
    expect(first.calls[0].init?.method).toBe('DELETE');
    expect(first.calls[0].init?.body).toBeUndefined();

    installFetch([{ test: detailPath, method: 'DELETE', handler: () => jsonResponse({ detail: '记录不存在' }, 404) }]);
    await expect(deleteLegacyEvent(7)).rejects.toMatchObject({ status: 404, message: '记录不存在', ambiguousWrite: false });

    installFetch([{ test: detailPath, method: 'DELETE', handler: () => jsonResponse({ error: 'server exploded' }, 500) }]);
    await expect(deleteLegacyEvent(7)).rejects.toMatchObject({ status: 500, message: 'server exploded', ambiguousWrite: true });

    installFetch([{ test: detailPath, method: 'DELETE', handler: () => { throw new TypeError('Failed to fetch'); } }]);
    await expect(deleteLegacyEvent(7)).rejects.toMatchObject({ status: null, ambiguousWrite: true });
  });
});
