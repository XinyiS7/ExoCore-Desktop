import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useComposeAttachments } from '../features/chat/attachments/useComposeAttachments';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const ROUTE = (id = 42) => `/api/agents/conversations/${id}/attachments/`;

const fileOf = (name: string, type = 'image/png') => new File(['x'.repeat(16)], name, { type });

const resultsRow = (inputIndex: number, status: 'ok' | 'ok_degraded' | 'failed', id: number | null, diags: unknown[] = []) => ({
  input_index: inputIndex,
  status,
  attachment: id === null ? null : { id, display_name: `f${id}.png`, original_filename: `f${id}.png`, mime_type: 'image/png', file_size: 16 },
  diagnostics: diags,
});

const okBody = (ids: Array<number | null>, statuses: Array<'ok' | 'ok_degraded' | 'failed'> = ids.map(() => 'ok')) => ({
  attachments: [],
  failures: [],
  results: ids.map((id, i) => resultsRow(i, statuses[i] ?? 'ok', id)),
});

// URL mocks — spy (not stub) so `new URL()` still works for route matching.
const urls: string[] = [];
const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
  const u = `blob:mock-${urls.length}`;
  urls.push(u);
  return u;
});
const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

afterEach(() => {
  unmockFetch();
  urls.length = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

describe('P1C compose coordinator (Task 2, §5.3/Gate C)', () => {
  it('creates uploading entries with image previews and maps ordered results by input_index', async () => {
    installFetch([
      { test: ROUTE(), method: 'POST', handler: () => jsonResponse(okBody([11, 12]), 201) },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png'), fileOf('b.png')]);
    });
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries.map((e) => e.status)).toEqual(['ok', 'ok']);
    expect(result.current.entries.map((e) => e.attachmentId)).toEqual([11, 12]);
    expect(result.current.successfulIds).toEqual([11, 12]);
    expect(result.current.anyUploading).toBe(false);
    // Images got object-URL previews.
    expect(result.current.entries.every((e) => e.preview?.startsWith('blob:'))).toBe(true);
  });

  it('keeps ok_degraded sendable with warning diagnostics and ik flags failed entries', async () => {
    installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              attachments: [{ id: 21, display_name: 'a.png', original_filename: 'a.png', mime_type: 'image/png', file_size: 16 }],
              failures: [],
              results: [
                resultsRow(0, 'ok_degraded', 21, [{ stage: 'storage', code: 'fallback_used', level: 'warning', message: '已使用原图' }]),
                resultsRow(1, 'failed', null, [{ stage: 'preflight', code: 'audio_mime_unsupported', level: 'error', message: 'audio MIME not allowed' }]),
              ],
            },
            201,
          ),
      },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png'), fileOf('b.webm')]);
    });
    expect(result.current.entries[0].status).toBe('ok_degraded');
    expect(result.current.entries[0].attachmentId).toBe(21);
    expect(result.current.entries[0].diagnostics[0].message).toBe('已使用原图');
    expect(result.current.entries[1].status).toBe('failed');
    expect(result.current.entries[1].attachmentId).toBeNull();
    // Only positive validated IDs qualify for send.
    expect(result.current.successfulIds).toEqual([21]);
    expect(result.current.anyUploading).toBe(false);
  });

  it('marks missing/malformed results as explicit failed without manufacturing success', async () => {
    installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: () => jsonResponse({ attachments: [{ id: 31, display_name: 'a.png', original_filename: 'a.png', mime_type: 'image/png', file_size: 16 }], failures: [], results: [{ input_index: 5, status: 'ok', attachment: { id: 999, display_name: 'x', original_filename: 'x', mime_type: 'image/png', file_size: 1 }, diagnostics: [] }] }, 201),
      },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png')]);
    });
    expect(result.current.entries[0].status).toBe('failed');
    expect(result.current.entries[0].attachmentId).toBeNull();
    expect(result.current.entries[0].diagnostics[0]?.code).toBe('results_ownership_invalid');
    expect(result.current.successfulIds).toEqual([]);
  });

  it('rejects duplicate result ownership before exposing any sendable success', async () => {
    installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              results: [resultsRow(0, 'ok', 701), resultsRow(0, 'ok', 702)],
              attachments: [],
              failures: [],
            },
            201,
          ),
      },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png'), fileOf('b.png')]);
    });
    expect(result.current.entries.map((entry) => entry.status)).toEqual(['failed', 'failed']);
    expect(result.current.entries.every((entry) => entry.diagnostics[0]?.code === 'results_ownership_invalid')).toBe(true);
    expect(result.current.successfulIds).toEqual([]);
  });

  it('treats a 201 with non-positive attachment IDs as contract failed, never sendable', async () => {
    installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: () => jsonResponse({ attachments: [], failures: [], results: [{ input_index: 0, status: 'ok', attachment: { id: 0, display_name: 'x', original_filename: 'x', mime_type: 'image/png', file_size: 1 }, diagnostics: [] }] }, 201),
      },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png')]);
    });
    expect(result.current.entries[0].status).toBe('failed');
    expect(result.current.entries[0].attachmentId).toBeNull();
    expect(result.current.successfulIds).toEqual([]);
  });

  it('a removed entry cannot be resurrected by a late callback', async () => {
    installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: () => jsonResponse(okBody([41]), 201),
      },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    let p: Promise<void>;
    act(() => {
      p = result.current.addFiles([fileOf('a.png')]);
    });
    // Entries appear asynchronously; remove while the response is pending.
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const clientId = result.current.entries[0].clientId;
    result.current.removeEntry(clientId);
    await act(async () => {
      await p;
    });
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.successfulIds).toEqual([]);
  });

  it('route switch clears entries, revokes previews and ignores late responses', async () => {
    let resolveUpload: ((r: Response) => void) | null = null;
    const { calls } = installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            resolveUpload = resolve;
          }),
      },
      { test: ROUTE(7), method: 'POST', handler: () => jsonResponse(okBody([51]), 201) },
    ]);
    const { result, rerender } = renderHook(({ id }) => useComposeAttachments(id), { initialProps: { id: 42 } });
    const pending = act(async () => {
      const p = result.current.addFiles([fileOf('a.png')]);
      rerender({ id: 7 });
      expect(result.current.entries).toHaveLength(0);
      // Late response for the OLD conversation arrives after route switch.
      resolveUpload?.(jsonResponse(okBody([51]), 201));
      await p;
    });
    await pending;
    // No entries from the old conversation, none from the late response.
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.successfulIds).toEqual([]);
    expect(calls[0].init?.signal).toBeDefined();
  });

  it('a transport failure marks retained entries failed', async () => {
    installFetch([
      { test: ROUTE(), method: 'POST', handler: () => Promise.reject(new TypeError('Failed to fetch')) },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png')]);
    });
    expect(result.current.entries[0].status).toBe('failed');
    expect(result.current.entries[0].attachmentId).toBeNull();
    expect(result.current.entries[0].diagnostics[0]?.level).toBe('error');
  });

  it('uploading entries block submission via anyUploading until resolution', async () => {
    let resolveUpload: ((r: Response) => void) | null = null;
    installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            resolveUpload = resolve;
          }),
      },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    let p: Promise<void>;
    act(() => {
      p = result.current.addFiles([fileOf('a.png')]);
    });
    // uploading state becomes visible before resolution → send blocked.
    await waitFor(() => expect(result.current.anyUploading).toBe(true));
    await act(async () => {
      resolveUpload?.(jsonResponse(okBody([61]), 201));
      await p;
    });
    expect(result.current.anyUploading).toBe(false);
  });

  it('204 purge removes a successful ID from the same-tick authoritative read', async () => {
    installFetch([
      { test: ROUTE(), method: 'POST', handler: () => jsonResponse(okBody([70]), 201) },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png')]);
    });
    expect(result.current.getSuccessfulIds()).toEqual([70]);
    // Deliberately read before React is given another turn: the tombstone must
    // already prevent Delete-204 → immediate Send from reusing the ID.
    act(() => result.current.purgeAttachmentId(70));
    expect(result.current.getSuccessfulIds()).toEqual([]);
  });

  it('clearCompose revokes previews and empties the strip', async () => {
    installFetch([
      { test: ROUTE(), method: 'POST', handler: () => jsonResponse(okBody([71]), 201) },
    ]);
    const { result } = renderHook(() => useComposeAttachments(42));
    await act(async () => {
      await result.current.addFiles([fileOf('a.png')]);
    });
    expect(result.current.entries).toHaveLength(1);
    await act(async () => {
      result.current.clearCompose();
    });
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.successfulIds).toEqual([]);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});