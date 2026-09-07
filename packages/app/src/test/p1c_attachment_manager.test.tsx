import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUserAttachmentManager } from '../features/chat/attachments/useUserAttachmentManager';
import { UserAttachmentManager } from '../features/chat/attachments/UserAttachmentManager';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const LIST_ROUTE = '/api/agents/conversations/42/attachments/';
const DELETE_ROUTE = '/api/agents/conversations/42/attachments/delete/';

const userRow = (id: number, name = `f${id}.png`) => ({
  source: 'user' as const,
  id,
  display_name: name,
  original_filename: name,
  storage_path: '/srv/x/' + name,
  mime_type: 'image/png',
  file_size: 16,
  created_at: '2026-09-01T10:00:00Z',
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

function wrapperWith(client: QueryClient) {
  return function StableQueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => unmockFetch());

describe('P1C user-attachment manager (Task 2.5/2.6, Gate H)', () => {
  it('always exposes the first-entry control and permits retry after an initial list failure', async () => {
    let attempts = 0;
    installFetch([
      {
        test: LIST_ROUTE,
        handler: () => {
          attempts += 1;
          return attempts === 1 ? jsonResponse({ error: 'temporary' }, 503) : jsonResponse([]);
        },
      },
    ]);
    function Harness() {
      const manager = useUserAttachmentManager(42);
      return <UserAttachmentManager manager={manager} busy={false} />;
    }
    render(<Harness />, { wrapper });

    const toggle = screen.getByRole('button', { name: '展开附件管理' });
    fireEvent.click(toggle);
    await screen.findByText('temporary');
    fireEvent.click(screen.getByRole('button', { name: '刷新附件列表' }));
    await waitFor(() => expect(attempts).toBe(2));
    expect(screen.getByRole('button', { name: '收起附件管理' })).toBeTruthy();
  });

  it('loads only user rows and exposes deletePending during the request', async () => {
    let resolveDelete: ((r: Response) => void) | null = null;
    const { calls } = installFetch([
      { test: LIST_ROUTE, handler: () => jsonResponse([userRow(1), { source: 'tool_collection', id: 'doc/x.md', display_name: 'x.md', storage_path: null }]) },
      {
        test: DELETE_ROUTE,
        method: 'DELETE',
        handler: () =>
          new Promise<Response>((resolve) => {
            resolveDelete = resolve;
          }),
      },
    ]);
    const { result } = renderHook(() => useUserAttachmentManager(42), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].source).toBe('user');
    expect(result.current.rows[0].id).toBe(1);

    let p: Promise<void>;
    act(() => {
      p = result.current.remove(result.current.rows[0]);
    });
    // deletePending stays true while the request is unresolved.
    await waitFor(() => expect(result.current.deletePending).toBe(true));
    await act(async () => {
      resolveDelete?.(new Response(null, { status: 204 }));
      await p;
    });
    expect(result.current.deletePending).toBe(false);
    // 204 tombstones the row locally before refresh. Even this deliberately
    // stale mock list cannot resurrect the deleted ID.
    expect(result.current.rows).toHaveLength(0);
    const deleteCall = calls.find((c) => c.url.pathname === DELETE_ROUTE);
    expect(deleteCall).toBeDefined();
    expect(JSON.parse(String(deleteCall?.init?.body))).toEqual({ source: 'user', id: 1 });
  });

  it('manual refresh cannot invalidate an unresolved delete or strand its lock', async () => {
    let resolveDelete: ((response: Response) => void) | null = null;
    const { calls } = installFetch([
      { test: LIST_ROUTE, handler: () => jsonResponse([userRow(8)]) },
      {
        test: DELETE_ROUTE,
        method: 'DELETE',
        handler: () => new Promise<Response>((resolve) => { resolveDelete = resolve; }),
      },
    ]);
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useUserAttachmentManager(42, { onDeleted }), { wrapper });
    await act(async () => { await result.current.refresh(); });

    let deletion!: Promise<void>;
    act(() => { deletion = result.current.remove(result.current.rows[0]); });
    await waitFor(() => expect(result.current.deletePending).toBe(true));
    await act(async () => { await result.current.refresh(); });
    expect(calls.filter((call) => call.url.pathname === LIST_ROUTE)).toHaveLength(1);

    await act(async () => {
      resolveDelete?.(new Response(null, { status: 204 }));
      await deletion;
    });
    expect(onDeleted).toHaveBeenCalledWith(8);
    expect(result.current.deletePending).toBe(false);
    expect(result.current.rows).toHaveLength(0);
  });

  it('on 204 the id no longer appears after a canonical re-list (backend removed it)', async () => {
    // Stateful mock: after the delete succeeds the canonical list no longer
    // contains the row (the backend detaches it from the conversation).
    let deleted = false;
    installFetch([
      {
        test: LIST_ROUTE,
        handler: () => jsonResponse(deleted ? [] : [userRow(2)]),
      },
      {
        test: DELETE_ROUTE,
        method: 'DELETE',
        handler: () => {
          deleted = true;
          return new Response(null, { status: 204 });
        },
      },
    ]);
    const { result } = renderHook(() => useUserAttachmentManager(42), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    await act(async () => {
      await result.current.remove(result.current.rows[0]);
    });
    // 204 purged the local row FIRST; the canonical refresh returns [] — the
    // id stays absent and can never be resent.
    expect(result.current.rows).toHaveLength(0);
  });

  it('preserves rows unchanged and surfaces guidance on 409 frozen-in-cache', async () => {
    installFetch([
      { test: LIST_ROUTE, handler: () => jsonResponse([userRow(3)]) },
      {
        test: DELETE_ROUTE,
        method: 'DELETE',
        handler: () =>
          jsonResponse(
            {
              error: '此附件已冻结在远端缓存中，无法删除。',
              detail: '请先清除缓存后再删除附件，或重新发送消息（🧊 缓存发送）触发缓存重建。',
              frozen_in_cache: true,
              cache_name: 'conv-42-snap',
            },
            409,
          ),
      },
    ]);
    const { result } = renderHook(() => useUserAttachmentManager(42), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    await act(async () => {
      await result.current.remove(result.current.rows[0]);
    });
    // 409 mutates NO state.
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.frozenInCache).toBe(true);
    expect(result.current.notice).toContain('缓存');
  });

  it('400/404 delete failures retain the row and keep the error visible', async () => {
    installFetch([
      { test: LIST_ROUTE, handler: () => jsonResponse([userRow(4)]) },
      { test: DELETE_ROUTE, method: 'DELETE', handler: () => jsonResponse({ error: '附件不存在' }, 404) },
    ]);
    const { result } = renderHook(() => useUserAttachmentManager(42), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    await act(async () => {
      await result.current.remove(result.current.rows[0]);
    });
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.notice).toBe('附件不存在');
  });

  it('does not refresh a departed delete route after its history invalidation settles', async () => {
    let resolveHistory!: () => void;
    const historyWait = new Promise<void>((resolve) => { resolveHistory = resolve; });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(client, 'invalidateQueries').mockImplementation(() => historyWait);
    installFetch([
      { test: '/api/agents/conversations/42/attachments/', handler: () => jsonResponse([userRow(702)]) },
      { test: '/api/agents/conversations/7/attachments/', handler: () => jsonResponse([userRow(801)]) },
      { test: DELETE_ROUTE, method: 'DELETE', handler: () => new Response(null, { status: 204 }) },
    ]);
    const onDeleted = vi.fn();
    const { result, rerender } = renderHook(
      ({ id }) => useUserAttachmentManager(id, { onDeleted }),
      { wrapper: wrapperWith(client), initialProps: { id: 42 } },
    );
    await act(async () => { await result.current.refresh(); });

    let deletion!: Promise<void>;
    act(() => { deletion = result.current.remove(result.current.rows[0]); });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(702));
    rerender({ id: 7 });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.rows.map((row) => row.id)).toEqual([801]);

    await act(async () => {
      resolveHistory();
      await deletion;
    });
    expect(result.current.rows.map((row) => row.id)).toEqual([801]);
    expect(result.current.notice).toBeNull();
  });

  it('does not surface a departed delete rejection in the next route', async () => {
    let rejectDelete!: (reason: Error) => void;
    installFetch([
      { test: '/api/agents/conversations/42/attachments/', handler: () => jsonResponse([userRow(702)]) },
      { test: '/api/agents/conversations/7/attachments/', handler: () => jsonResponse([userRow(801)]) },
      {
        test: DELETE_ROUTE,
        method: 'DELETE',
        handler: () => new Promise<Response>((_resolve, reject) => { rejectDelete = reject; }),
      },
    ]);
    const { result, rerender } = renderHook(({ id }) => useUserAttachmentManager(id), {
      wrapper,
      initialProps: { id: 42 },
    });
    await act(async () => { await result.current.refresh(); });
    let deletion!: Promise<void>;
    act(() => { deletion = result.current.remove(result.current.rows[0]); });
    await waitFor(() => expect(result.current.deletePending).toBe(true));

    rerender({ id: 7 });
    await act(async () => { await result.current.refresh(); });
    await act(async () => {
      rejectDelete(new Error('old A delete failed'));
      await deletion;
    });
    expect(result.current.rows.map((row) => row.id)).toEqual([801]);
    expect(result.current.notice).toBeNull();
    expect(result.current.deletePending).toBe(false);
  });

  it('does not resume an old A delete continuation after an A-to-B-to-A cycle', async () => {
    let resolveHistory!: () => void;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(client, 'invalidateQueries').mockImplementation(
      () => new Promise<void>((resolve) => { resolveHistory = resolve; }),
    );
    let currentA = [userRow(702)];
    installFetch([
      { test: '/api/agents/conversations/42/attachments/', handler: () => jsonResponse(currentA) },
      { test: '/api/agents/conversations/7/attachments/', handler: () => jsonResponse([userRow(801)]) },
      { test: DELETE_ROUTE, method: 'DELETE', handler: () => new Response(null, { status: 204 }) },
    ]);
    const { result, rerender } = renderHook(({ id }) => useUserAttachmentManager(id), {
      wrapper: wrapperWith(client),
      initialProps: { id: 42 },
    });
    await act(async () => { await result.current.refresh(); });
    let deletion!: Promise<void>;
    act(() => { deletion = result.current.remove(result.current.rows[0]); });
    await waitFor(() => expect(result.current.rows).toHaveLength(0));

    rerender({ id: 7 });
    rerender({ id: 42 });
    currentA = [userRow(900)];
    await act(async () => { await result.current.refresh(); });
    expect(result.current.rows.map((row) => row.id)).toEqual([900]);
    await act(async () => {
      resolveHistory();
      await deletion;
    });
    expect(result.current.rows.map((row) => row.id)).toEqual([900]);
  });

  it('a second route invalidates stale rows; the next refresh targets the new conversation', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/conversations/42/attachments/', handler: () => jsonResponse([userRow(1)]) },
      { test: '/api/agents/conversations/7/attachments/', handler: () => jsonResponse([]) },
    ]);
    const { result, rerender } = renderHook(({ id }) => useUserAttachmentManager(id), {
      wrapper,
      initialProps: { id: 42 },
    });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    rerender({ id: 7 });
    // Route switch empties the manager immediately (no cross-conv leakage).
    await waitFor(() => expect(result.current.rows).toHaveLength(0));
    // Lazy panel: the next explicit refresh (or panel open) targets 7.
    await act(async () => {
      await result.current.refresh();
    });
    expect(calls.some((c) => c.url.pathname === '/api/agents/conversations/7/attachments/')).toBe(true);
  });
});