import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';
import { ConversationPage } from '../features/chat/ConversationPage';
import { useConversationsQuery } from '../features/chat/queries';
import * as storageModule from '../features/chat/runtime/storage';
import { readRuntimeLease } from '../features/chat/runtime/storage';
import type { V4RuntimeLease } from '../features/chat/runtime/types';

/** Active observer of the Recent-conversations query so invalidation is observable. */
function RecentProbe() {
  const q = useConversationsQuery();
  return <span data-testid="recent-count">{q.data ? q.data.length : 'none'}</span>;
}

function loadLease(conversationId: number): V4RuntimeLease | null {
  const outcome = readRuntimeLease(conversationId);
  return outcome.state === 'valid' ? outcome.lease : null;
}

async function assertSendEnabledAfterTyping(text: string) {
  const box = screen.getByRole('textbox', { name: /消息输入框/ }) as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: text } });
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /发送消息/ })).not.toBeDisabled();
  });
}

const PRESET_ECKI = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const convRow = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: `conv ${id}`,
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
  ...over,
});

const mkMsg = (id: number, role: string, content: string, indexInSession: number) => ({
  id,
  role,
  content,
  reasoning_content: null,
  platform: 'deepseek',
  model_version: 'v4-flash',
  token_count: null,
  index_in_session: indexInSession,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-09-01T10:00:00Z',
});

function sseDoneStream(prefix?: string) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        if (prefix) controller.enqueue(enc.encode(`event: content\ndata: ${prefix}\n\n`));
        controller.enqueue(enc.encode('event: done\ndata: [DONE]\n\n'));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function emptyMessages() {
  return jsonResponse({ messages: [], total_count: 0, has_more: false });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  unmockFetch();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('C1B-R4 invariant wave — §11.1 probe 1: accepted async snapshot atomicity', () => {
  it('complete token+cursor active snapshot is persisted against the exact pending prior; a failed upgrade keeps pending, zero polling, exact retry resumes', async () => {
    let pollCount = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    // Call 1: pending creation (real). Call 2: pending→active upgrade (FAILS).
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      if (persistCalls === 2) {
        return { state: 'mutation_unavailable', reason: 'blocked-by-test', verifiedExpectedPrior: expectedPrior };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/41/', handler: () => jsonResponse(convRow(41)) },
      {
        test: /^\/api\/agents\/chat\/41\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tokr41a', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/41\/status\//,
        handler: () => {
          pollCount += 1;
          return jsonResponse({ status: 'done', events: [], cursor: 0, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/41\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/41']);
    const transport = await screen.findByLabelText('传输模式选择');
    fireEvent.change(transport, { target: { value: 'async' } });
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '原子快照' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    // Upgrade failure: the PENDING marker survives — never a tokenless active.
    await waitFor(() => {
      expect(loadLease(41)?.disposition).toBe('pending');
      expect(screen.getByText(/消息已发送但恢复凭据保存失败/)).toBeTruthy();
    });
    // No polling GET may begin until the complete snapshot is durable.
    await new Promise((r) => setTimeout(r, 80));
    expect(pollCount).toBe(0);
    // R5-B1: an ACCEPTED run keeps Stop reachable while the first GET waits
    // for durability — the composer projects Stop (never the send button),
    // and the send lock is still held.
    expect(screen.queryByRole('button', { name: /发送消息/ })).toBeNull();
    expect(screen.getByRole('button', { name: /停止生成/ })).toBeTruthy();

    // Exact storage retry persists the COMPLETE active snapshot, then polling begins.
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => {
      expect(loadLease(41)?.disposition).toBe('active');
      expect(loadLease(41)?.asyncToken).toBe('tokr41a');
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });
    // Terminal reconciliation clears the marker and unlocks.
    await waitFor(() => {
      expect(loadLease(41)).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
    persistSpy.mockRestore();
  });
});

describe('C1B-R4 invariant wave — §11.1 probe 2 / §4.4: independent draft-cleanup recovery', () => {
  it('draft-removal failure keeps the live run and exposes a draft-only retry that cannot clear or unlock', async () => {
    const originalClearDraft = storageModule.clearConversationDraft;
    let draftClearCalls = 0;
    const draftSpy = vi.spyOn(storageModule, 'clearConversationDraft');
    draftSpy.mockImplementation((convId: number) => {
      draftClearCalls += 1;
      if (draftClearCalls === 1) return false; // first removal attempt fails
      return originalClearDraft(convId);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/47/', handler: () => jsonResponse(convRow(47)) },
      {
        test: /^\/api\/agents\/chat\/47\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') return sseDoneStream('正常流式回答');
          return jsonResponse({
            messages: [mkMsg(470, 'user', 'q', 0), mkMsg(471, 'assistant', '正常流式回答', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
    ]);

    renderApp(['/chat/47']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    // Draft row appears; the run itself completes and reconciles regardless.
    await screen.findByText(/草稿清理失败/);
    await waitFor(() => {
      expect(loadLease(47)).toBeNull(); // terminal reconcile cleared the lease
    });
    await assertSendEnabledAfterTyping('解锁后新消息');

    // The draft-only retry clears the draft row; it never touches the lease.
    fireEvent.click(screen.getByRole('button', { name: /重试清理草稿/ }));
    await waitFor(() => {
      expect(screen.queryByText(/草稿清理失败/)).toBeNull();
    });
    draftSpy.mockRestore();
  });

  it('simultaneous draft-cleanup failure AND terminal clear failure leave both recovery paths independently reachable', async () => {
    const originalClearDraft = storageModule.clearConversationDraft;
    const originalClear = storageModule.clearRuntimeLease;
    let failNextClear = true;
    let failNextDraft = true;
    const draftSpy = vi.spyOn(storageModule, 'clearConversationDraft');
    draftSpy.mockImplementation((convId: number) => {
      if (failNextDraft) {
        failNextDraft = false;
        return false;
      }
      return originalClearDraft(convId);
    });
    const clearSpy = vi.spyOn(storageModule, 'clearRuntimeLease');
    clearSpy.mockImplementation((expectedPrior: V4RuntimeLease) => {
      if (failNextClear) {
        failNextClear = false;
        return { state: 'mutation_unavailable', reason: 'blocked-by-test', verifiedExpectedPrior: expectedPrior };
      }
      return originalClear(expectedPrior);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/48/', handler: () => jsonResponse(convRow(48)) },
      {
        test: /^\/api\/agents\/chat\/48\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') return sseDoneStream('回答');
          return jsonResponse({
            messages: [mkMsg(480, 'user', 'q', 0), mkMsg(481, 'assistant', '回答', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
    ]);

    renderApp(['/chat/48']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    // Both failure surfaces are visible and locked.
    await screen.findByText(/草稿清理失败/);
    await screen.findByText(/无法清除上次运行标记/);
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();

    // Repairing the draft does NOT unlock the operation.
    fireEvent.click(screen.getByRole('button', { name: /重试清理草稿/ }));
    await waitFor(() => {
      expect(screen.queryByText(/草稿清理失败/)).toBeNull();
    });
    expect(loadLease(48)).not.toBeNull();
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();

    // Repairing the storage clear unlocks; the draft failure stays closed.
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => {
      expect(loadLease(48)).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
    draftSpy.mockRestore();
    clearSpy.mockRestore();
    void originalClearDraft;
  });
});

describe('C1B-R4 invariant wave — §11.1 probe 3: branch safe rejection with conditional-clear non-success', () => {
  it('stays locked after clear failure; exact retry unlocks; exactly one POST', async () => {
    let branchPosts = 0;
    const originalClear = storageModule.clearRuntimeLease;
    let failNextClear = true;
    const clearSpy = vi.spyOn(storageModule, 'clearRuntimeLease');
    clearSpy.mockImplementation((expectedPrior: V4RuntimeLease) => {
      if (failNextClear) {
        failNextClear = false;
        return { state: 'mutation_unavailable', reason: 'blocked-by-test', verifiedExpectedPrior: expectedPrior };
      }
      return originalClear(expectedPrior);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/49/', handler: () => jsonResponse(convRow(49)) },
      {
        test: '/api/agents/conversations/49/branch/',
        method: 'POST',
        handler: () => {
          branchPosts += 1;
          return jsonResponse({ error: '拒绝' }, 400);
        },
      },
      {
        test: /^\/api\/agents\/chat\/49\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(490, 'user', 'q', 0), mkMsg(491, 'assistant', '可分支', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/49']);
    await screen.findByText('可分支');
    const branchBtn = (await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0];
    fireEvent.click(branchBtn);
    const confirmBtn = await screen.findByRole('button', { name: '确认创建分支' });
    fireEvent.click(confirmBtn);

    // Clear failure after safe rejection: locked + visible; modal cannot retry.
    await waitFor(() => {
      expect(screen.getAllByText(/分支请求被拒绝，但运行标记清理失败/).length).toBeGreaterThanOrEqual(1);
    });
    expect(confirmBtn).toBeDisabled();
    expect(loadLease(49)?.disposition).toBe('pending');

    // Exact clear retry unlocks (no second POST ever leaves this dialog).
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => {
      expect(loadLease(49)).toBeNull();
      expect(confirmBtn).not.toBeDisabled();
    });
    expect(branchPosts).toBe(1);
    clearSpy.mockRestore();
  });
});

describe('C1B-R4 invariant wave — §11.1 probe 5: branch re-entry discovery', () => {
  it('pending branch marker refreshes Recent at entry without any branch POST; ack unlocks', async () => {
    let branchPosts = 0;
    window.localStorage.setItem(
      'exo:v4:chat-runtime:43',
      JSON.stringify({
        version: 1,
        operation: 'branch',
        conversationId: 43,
        transport: 'sse',
        startedAt: Date.now() - 5000,
        updatedAt: Date.now() - 4000,
        disposition: 'pending',
      }),
    );

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/43/', handler: () => jsonResponse(convRow(43)) },
      {
        test: '/api/agents/conversations/43/branch/',
        method: 'POST',
        handler: () => {
          branchPosts += 1;
          return jsonResponse({ conversation_id: 200 }, 201);
        },
      },
      {
        test: '/api/agents/conversations/',
        handler: () => jsonResponse([convRow(43)]),
      },
      {
        test: /^\/api\/agents\/chat\/43\/$/,
        handler: () => emptyMessages(),
      },
    ]);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/chat/43']}>
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={
                <div>
                  <RecentProbe />
                  <ConversationPage />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Entry interprets the branch marker as uncertain and refreshes Recent
    // WITHOUT issuing a branch POST (invalidation is the observable contract;
    // TanStack dedupes refetch-with-inflight, so the query call is asserted).
    await screen.findByText(/操作结果不确定/);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    });
    expect(branchPosts).toBe(0);

    // Explicit acknowledgement clears the marker and unlocks.
    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }));
    await waitFor(() => {
      expect(loadLease(43)).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
    expect(branchPosts).toBe(0);
  });
});

describe('C1B-R4 invariant wave — §11.1 probe 6: stale branch completion', () => {
  it('route departure during branch POST prevents current-route mutation and stale navigation', async () => {
    const pendingBranch = { resolve: null as ((value: Response) => void) | null };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/44/', handler: () => jsonResponse(convRow(44)) },
      { test: '/api/agents/conversations/45/', handler: () => jsonResponse(convRow(45)) },
      {
        test: '/api/agents/conversations/44/branch/',
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            pendingBranch.resolve = resolve;
          }),
      },
      {
        test: '/api/agents/conversations/',
        handler: () => jsonResponse([convRow(44), convRow(45)]),
      },
      {
        test: /^\/api\/agents\/chat\/44\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(440, 'user', 'q', 0), mkMsg(441, 'assistant', '44 可分支', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
      {
        test: /^\/api\/agents\/chat\/45\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(450, 'assistant', '45 的历史', 0)],
            total_count: 1,
            has_more: false,
          }),
      },
    ]);

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/chat/44']}>
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={
                <div>
                  <Link to="/chat/45">go45</Link>
                  <ConversationPage />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('44 可分支');
    fireEvent.click((await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认创建分支' }));
    await waitFor(() => expect(pendingBranch.resolve).not.toBeNull());

    // Route departure while the branch POST is in flight.
    fireEvent.click(screen.getByRole('link', { name: 'go45' }));
    await screen.findByText('45 的历史');
    expect(loadLease(45)).toBeNull();

    // R5-A1: the branch 201 arrives AFTER departure — the SOURCE RESULT still
    // completes durably (exact conditional clear of the captured pending +
    // positive Recent refresh) while the CURRENT route stays untouched and no
    // stale navigation occurs.
    pendingBranch.resolve?.(jsonResponse({ conversation_id: 99, name: 'Branch' }, 201));
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.getByText('45 的历史')).toBeTruthy();
    expect(loadLease(45)).toBeNull();
    expect(loadLease(44)).toBeNull(); // source marker completed (cleared)
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    });
  });
});

describe('C1B-R4 invariant wave — §5.3 polling cursor persist failure pauses the next GET', () => {
  it('cursor-advance persist failure pauses polling; exact retry resumes from the retained in-memory cursor', async () => {
    const cursorRequests: number[] = [];
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    // 1: pending creation; 2: ack→active upgrade; 3: cursor advance FAILS.
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      if (persistCalls === 3) {
        return { state: 'mutation_unavailable', reason: 'blocked-by-test', verifiedExpectedPrior: expectedPrior };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/46/', handler: () => jsonResponse(convRow(46)) },
      {
        test: /^\/api\/agents\/chat\/46\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tok46ab', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/46\/status\//,
        handler: (url) => {
          const c = Number(url.searchParams.get('cursor'));
          cursorRequests.push(c);
          if (c === 0) {
            return jsonResponse({ status: 'processing', events: [{ event_type: 'content', delta: '第一段' }], cursor: 1 });
          }
          return jsonResponse({ status: 'done', events: [], cursor: 1, error_message: null });
        },
      },
      {
        test: /^\/api\/agents\/chat\/46\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(460, 'user', 'q', 0), mkMsg(461, 'assistant', '第一段', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/46']);
    const transport = await screen.findByLabelText('传输模式选择');
    fireEvent.change(transport, { target: { value: 'async' } });
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    // First poll lands (cursor 0 → 1) but its cursor persist fails → pause.
    await waitFor(() => expect(cursorRequests.length).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/无法保存轮询进度/)).toBeTruthy();
    });
    const getsWhileBlocked = cursorRequests.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(cursorRequests.length).toBe(getsWhileBlocked); // NO next GET while blocked
    expect(cursorRequests.filter((c) => c === 0)).toHaveLength(1);

    // Exact retry persists the retained cursor and resumes from IT (never 0).
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    // Resume continues from the RETAINED cursor (1) — cursor 0 is never replayed.
    await waitFor(() => {
      expect(cursorRequests.filter((c) => c === 1).length).toBeGreaterThanOrEqual(1);
    });
    expect(cursorRequests.filter((c) => c === 0)).toHaveLength(1);
    expect(await screen.findByText('第一段')).toBeTruthy();
    await waitFor(() => {
      expect(loadLease(46)).toBeNull();
    });
    persistSpy.mockRestore();
  });
});

describe('C1B-R4 invariant wave — acknowledgement refresh failure retains marker + lock', () => {
  it('ack with a failed canonical refresh keeps the durable marker and lock; retry-sync completes the acknowledgement', async () => {
    let postCount = 0;
    let failNextMessagesGet = true;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/52/', handler: () => jsonResponse(convRow(52)) },
      {
        test: /^\/api\/agents\/chat\/52\/$/,
        method: 'POST',
        handler: () => {
          postCount += 1;
          return jsonResponse({ status: 'processing' }, 200); // malformed ack (no token)
        },
      },
      { test: /^\/api\/agents\/chat\/52\//, handler: () => {
        // Fail only a POST-era GET (the mount-time page GET must stay healthy).
        if (postCount > 0 && failNextMessagesGet) {
          failNextMessagesGet = false;
          return jsonResponse({ error: 'boom' }, 500);
        }
        return jsonResponse({
          messages: [mkMsg(520, 'user', 'q', 0)],
          total_count: 1,
          has_more: false,
        });
      } },
    ]);

    renderApp(['/chat/52']);
    const transport = await screen.findByLabelText('传输模式选择');
    fireEvent.change(transport, { target: { value: 'async' } });
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    await waitFor(() => expect(postCount).toBe(1));
    fireEvent.click(await screen.findByRole('button', { name: '关闭提示' }));

    // Refresh failed: marker + lock remain, retry-sync is offered.
    await waitFor(() => {
      expect(screen.getByText(/消息历史对齐失败，请点击重试/)).toBeTruthy();
    });
    expect(loadLease(52)?.disposition).toBe('uncertain');
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /重试同步历史/ }));
    await waitFor(() => {
      expect(loadLease(52)).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
  });
});

describe('C1B-R4 invariant wave — route-entry storage blocked read', () => {
  it('unavailable route-entry read locks every write; exact reread resolves to idle', async () => {
    const readSpy = vi
      .spyOn(storageModule, 'readRuntimeLease')
      .mockImplementationOnce(() => ({ state: 'unavailable', reason: 'blocked-read-by-test' }));
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/53/', handler: () => jsonResponse(convRow(53)) },
      { test: /^\/api\/agents\/chat\/53\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/53']);
    await screen.findByRole('textbox', { name: /消息输入框/ });
    await waitFor(() => {
      expect(screen.getByText(/重试读取存储/)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();

    // Reread (now works) resolves absent → idle with no invented identity.
    fireEvent.click(screen.getByRole('button', { name: /重试读取存储/ }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /重试读取存储/ })).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
    readSpy.mockRestore();
  });
});

describe('C1B-R4 invariant wave — §6.2 branch success with clear non-success defers navigation', () => {
  it('canonical result retained; at most one navigation only after exact clear; retry navigates', async () => {
    const originalClear = storageModule.clearRuntimeLease;
    let failNextClear = true;
    const clearSpy = vi.spyOn(storageModule, 'clearRuntimeLease');
    clearSpy.mockImplementation((expectedPrior: V4RuntimeLease) => {
      if (failNextClear) {
        failNextClear = false;
        return { state: 'mutation_unavailable', reason: 'blocked-by-test', verifiedExpectedPrior: expectedPrior };
      }
      return originalClear(expectedPrior);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/54/', handler: () => jsonResponse(convRow(54)) },
      { test: '/api/agents/conversations/99/', handler: () => jsonResponse(convRow(99)) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([convRow(54), convRow(99)]) },
      {
        test: '/api/agents/conversations/54/branch/',
        method: 'POST',
        handler: () => jsonResponse({ conversation_id: 99, name: 'Branch' }, 201),
      },
      {
        test: /^\/api\/agents\/chat\/54\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(540, 'user', 'q', 0), mkMsg(541, 'assistant', '54 可分支', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
      {
        test: /^\/api\/agents\/chat\/99\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(990, 'assistant', '99 的内容', 0)],
            total_count: 1,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/54']);
    await screen.findByText('54 可分支');
    fireEvent.click((await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0]);
    const confirmBtn = await screen.findByRole('button', { name: '确认创建分支' });
    fireEvent.click(confirmBtn);

    // Clear non-success after branch success: result retained, locked.
    await waitFor(() => {
      expect(screen.getAllByText(/分支已创建，但运行标记清理失败/).length).toBeGreaterThanOrEqual(1);
    });
    expect(confirmBtn).toBeDisabled();
    expect(loadLease(54)?.disposition).toBe('pending');

    // Exact clear retry → at most one identity-checked navigation to the
    // canonical conversation_id.
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    expect(await screen.findByText('99 的内容')).toBeTruthy();
    await waitFor(() => {
      expect(loadLease(54)).toBeNull();
    });
    clearSpy.mockRestore();
  });

});
