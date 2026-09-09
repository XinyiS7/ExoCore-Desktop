import { afterEach, describe, expect, it } from 'vitest';
import {
  fetchCacheStatus,
  releaseCache,
  renewCache,
  validateCacheStatus,
} from '../features/chat/control/api';
import { AppApiError } from '../features/chat/api';
import type { CacheStatusView } from '../features/chat/control/types';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const activeCache = {
  active: true,
  platform: 'gemini',
  cache_name: 'projects/123/locations/global/contextCaches/abc',
  model: 'gemini-3.5-flash',
  created_at: '2026-09-01T00:00:00Z',
  expires_at: '2026-09-01T00:30:00Z',
  remaining_seconds: 1799,
  renewals: 1,
  ttl_seconds: 1800,
  has_snapshot: true,
  snapshot_cache_end_idx: 42,
};

describe('P1D cache adapters (Plan Task 1 / §6.4)', () => {
  afterEach(() => unmockFetch());

  it('validates an active remote cache row strictly', () => {
    const view = validateCacheStatus(activeCache);
    expect(view).toMatchObject<Partial<CacheStatusView>>({
      active: true,
      platform: 'gemini',
      expiresAt: '2026-09-01T00:30:00Z',
      remainingSeconds: 1799,
      renewals: 1,
      ttlSeconds: 1800,
      hasSnapshot: true,
      snapshotCacheEndIdx: 42,
    });
  });

  it('rejects an active row without a parseable expires_at', () => {
    expect(() => validateCacheStatus({ ...activeCache, expires_at: 'not-a-date' })).toThrow(AppApiError);
    expect(() => validateCacheStatus({ ...activeCache, expires_at: undefined })).toThrow(AppApiError);
  });

  it('rejects an active row with negative remaining_seconds', () => {
    expect(() => validateCacheStatus({ ...activeCache, remaining_seconds: -1 })).toThrow(AppApiError);
  });

  it('rejects rows missing active/has_snapshot/platform booleans', () => {
    expect(() => validateCacheStatus({ ...activeCache, active: 'yes' })).toThrow(AppApiError);
    expect(() => validateCacheStatus({ ...activeCache, has_snapshot: undefined })).toThrow(AppApiError);
    expect(() => validateCacheStatus({ ...activeCache, platform: 7 })).toThrow(AppApiError);
  });

  it('accepts an inactive row with a snapshot (snapshot-only state)', () => {
    const view = validateCacheStatus({
      active: false,
      platform: 'deepseek',
      has_snapshot: true,
      snapshot_cache_end_idx: 9,
    });
    expect(view.active).toBe(false);
    expect(view.hasSnapshot).toBe(true);
    expect(view.expiresAt).toBeNull();
    expect(view.remainingSeconds).toBeNull();
  });

  it('accepts an empty row (no cache, no snapshot)', () => {
    const view = validateCacheStatus({ active: false, platform: 'unknown', has_snapshot: false });
    expect(view.hasSnapshot).toBe(false);
  });

  it('GET surfaces malformed envelopes as CONTRACT errors, never empty success', async () => {
    installFetch([
      { test: '/api/agents/conversations/1/cache/', handler: () => jsonResponse({ active: 'wat' }) },
    ]);
    await expect(fetchCacheStatus(1)).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('GET returns the validated row on success', async () => {
    installFetch([
      { test: '/api/agents/conversations/1/cache/', handler: () => jsonResponse(activeCache) },
    ]);
    await expect(fetchCacheStatus(1)).resolves.toMatchObject({ active: true });
  });

  it('renew requires {ok:true}; a malformed 2xx is an ambiguous write', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/1/cache/renew/',
        method: 'POST',
        handler: () => jsonResponse({ ok: false, reason: 'no active cache' }),
      },
    ]);
    await expect(renewCache(1)).rejects.toMatchObject({ ambiguousWrite: true, code: 'CONTRACT' });
  });

  it('renew success returns expiry + renewals', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/1/cache/renew/',
        method: 'POST',
        handler: () => jsonResponse({ ok: true, expires_at: '2026-09-01T01:00:00Z', renewals: 2 }),
      },
    ]);
    await expect(renewCache(1)).resolves.toEqual({
      ok: true,
      expiresAt: '2026-09-01T01:00:00Z',
      renewals: 2,
    });
  });

  it('renew 409/404 are surfaced with their status (truth retained by caller)', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/1/cache/renew/',
        method: 'POST',
        handler: () => jsonResponse({ ok: false, reason: 'no active cache' }, 409),
      },
      {
        test: '/api/agents/conversations/2/cache/renew/',
        method: 'POST',
        handler: () => jsonResponse({ error: '会话不存在' }, 404),
      },
    ]);
    await expect(renewCache(1)).rejects.toMatchObject({ status: 409 });
    await expect(renewCache(2)).rejects.toMatchObject({ status: 404 });
  });

  it('release succeeds on 204 and never converts 404 into success', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/1/cache/',
        method: 'DELETE',
        handler: () => new Response(null, { status: 204 }),
      },
      {
        test: '/api/agents/conversations/2/cache/',
        method: 'DELETE',
        handler: () => jsonResponse({ error: '当前无活跃缓存或快照' }, 404),
      },
    ]);
    await expect(releaseCache(1)).resolves.toEqual({ released: true });
    await expect(releaseCache(2)).rejects.toMatchObject({ status: 404 });
  });
});