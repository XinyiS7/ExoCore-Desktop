import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useCacheControl } from '../features/chat/control/useCacheControl';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const activeRow = {
  active: true,
  platform: 'gemini',
  cache_name: 'ctx/abc',
  model: 'gemini-3.5-flash',
  created_at: '2026-09-01T00:00:00Z',
  expires_at: new Date(Date.now() + 120_000).toISOString(),
  remaining_seconds: 120,
  renewals: 1,
  ttl_seconds: 1800,
  has_snapshot: true,
  snapshot_cache_end_idx: 42,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

/** Flush microtasks + fake timers inside act (waitFor is real-timer only). */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

let fetchCalls: ReturnType<typeof installFetch>['calls'];

beforeEach(() => {
  vi.useFakeTimers();
  fetchCalls = installFetch([
    { test: '/api/agents/conversations/1/cache/', handler: () => jsonResponse(activeRow) },
  ]).calls;
});
afterEach(() => {
  vi.useRealTimers();
  unmockFetch();
});

describe('P1D useCacheControl (Plan Task 3.4 / §6.4)', () => {
  it('derives countdown from confirmed expiry and ticks down', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCacheControl(1), { wrapper });
    await flush(10);
    expect(result.current.presentation.state).toBe('active');
    if (result.current.presentation.state !== 'active') return;
    const initial = result.current.presentation.cache.remainingSeconds ?? 0;
    await flush(2000);
    const after = result.current.presentation.state === 'active'
      ? result.current.presentation.cache.remainingSeconds ?? 0
      : 0;
    expect(initial - after).toBeGreaterThanOrEqual(1);
    expect(initial - after).toBeLessThanOrEqual(3);
  });

  it('calibrates at most every 30 seconds and pauses while hidden', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCacheControl(1), { wrapper });
    await flush(10);
    expect(result.current.presentation.state).toBe('active');

    const callsAfterLoad = fetchCalls.length;
    await flush(29_000);
    expect(fetchCalls.length).toBe(callsAfterLoad);

    await flush(2_000); // crosses the 30s calibration boundary
    expect(fetchCalls.length).toBe(callsAfterLoad + 1);

    // Hidden document pauses calibration entirely.
    const hiddenSpy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden' as DocumentVisibilityState);
    const afterHidden = fetchCalls.length;
    await flush(60_000);
    expect(fetchCalls.length).toBe(afterHidden);
    hiddenSpy.mockRestore();
  });

  it('locks renew/release during runtime uncertainty', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCacheControl(1, { runtimeUncertain: true }), { wrapper });
    await flush(10);
    expect(result.current.presentation.state).toBe('active');
    expect(result.current.mutationsLocked).toBe(true);
    act(() => {
      result.current.renew();
      result.current.release();
    });
    await flush(10);
    // No renew/release requests were issued while locked.
    expect(fetchCalls.filter((c) => c.url.pathname.endsWith('/cache/renew/')).length).toBe(0);
    expect(fetchCalls.filter((c) => c.url.pathname.endsWith('/cache/') && c.init?.method === 'DELETE').length).toBe(0);
  });

  it('consumes mutation rejection and releases the synchronous sibling guard', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCacheControl(1), { wrapper });
    await flush(10);
    const failureCalls = installFetch([
      {
        test: '/api/agents/conversations/1/cache/renew/',
        handler: () => jsonResponse({ error: 'denied' }, 500),
      },
    ]).calls;

    act(() => {
      result.current.renew();
      // A second cache command in the same tick must observe the ref guard.
      result.current.release();
    });
    expect(result.current.isOperationPending()).toBe(true);
    await flush(10);
    expect(result.current.isOperationPending()).toBe(false);
    expect(result.current.renewError).toBeTruthy();
    expect(failureCalls.filter((call) => call.init?.method === 'POST')).toHaveLength(1);
    expect(failureCalls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(0);
  });

  it('shows stale error while retaining the last confirmed row', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCacheControl(1), { wrapper });
    await flush(10);
    expect(result.current.presentation.state).toBe('active');
    // Force a failing refetch → stale row retained + staleError true.
    installFetch([
      {
        test: '/api/agents/conversations/1/cache/',
        handler: () => jsonResponse({ error: 'boom' }, 500),
      },
    ]);
    act(() => {
      void result.current.refresh();
    });
    await flush(10);
    expect(result.current.staleError).toBe(true);
    expect(result.current.presentation.state).toBe('active');
  });

  it('cleans timers on unmount (no late ticks survive)', async () => {
    const { wrapper } = makeWrapper();
    const { result, unmount } = renderHook(() => useCacheControl(1), { wrapper });
    await flush(10);
    expect(result.current.presentation.state).toBe('active');
    unmount();
    await expect(flush(5000)).resolves.toBeUndefined();
  });
});