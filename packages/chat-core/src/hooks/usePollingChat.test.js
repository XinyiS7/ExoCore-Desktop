import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: () => 'mock-csrf',
}));

import { usePollingChat } from './usePollingChat';

describe('usePollingChat — cursor fallback with dict deltas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dict (telemetry) delta is forwarded but does not NaN the cursor', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message_id: 'm1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // No server cursor → client fallback derives it from delta lengths
          events: [
            { delta: { input_chars: 5, output_chars: 1 }, event_type: 'telemetry' },
            { delta: 'hi', event_type: 'content' },
          ],
          status: 'running',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], cursor: 2, status: 'done' }) });

    const { result } = renderHook(() => usePollingChat());
    const onDelta = vi.fn();
    const p = result.current.sendMessageAsync({ content: 'x' }, 's1', new AbortController().signal, onDelta);

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    await p;

    expect(onDelta).toHaveBeenCalledTimes(2);
    expect(onDelta).toHaveBeenCalledWith({ input_chars: 5, output_chars: 1 }, 'telemetry');
    expect(onDelta).toHaveBeenCalledWith('hi', 'content');

    const statusUrls = fetch.mock.calls.map((c) => c[0]).filter((u) => u.includes('/status/'));
    expect(statusUrls).toHaveLength(2);
    expect(statusUrls[0]).toContain('cursor=0');
    // 'hi'.length === 2; the dict contributes 0 (not NaN)
    expect(statusUrls[1]).toContain('cursor=2');
    expect(statusUrls[1]).not.toContain('NaN');
  });
});
