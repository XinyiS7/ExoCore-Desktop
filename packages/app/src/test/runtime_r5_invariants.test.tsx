import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  installRuntimeFetch as installFetch,
  jsonResponse,
  renderApp,
  selectRuntimeTransport,
  unmockFetch,
} from './helpers';
import { ConversationPage } from '../features/chat/ConversationPage';
import * as storageModule from '../features/chat/runtime/storage';
import { clearRuntimeLease, readRuntimeLease } from '../features/chat/runtime/storage';
import type { V4RuntimeLease } from '../features/chat/runtime/types';

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
        controller.enqueue(enc.encode('event: done\ndata: {}\n\n'));
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
  vi.restoreAllMocks();
});

describe('C1B-R5 sibling probes — branch caller/source separation (§10.1 A1/A2)', () => {
  it('modal close after clear-blocked success revokes the delayed navigation; retry unlocks without navigating', async () => {
    const originalClear = storageModule.clearRuntimeLease;
    let failNextClear = true;
    const clearSpy = vi.spyOn(storageModule, 'clearRuntimeLease');
    clearSpy.mockImplementation((expectedPrior: V4RuntimeLease) => {
      if (failNextClear) {
        failNextClear = false;
        return {
          state: 'mutation_unavailable',
          reason: 'blocked-by-test',
          verifiedExpectedPrior: expectedPrior,
        };
      }
      return originalClear(expectedPrior);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(convRow(60)) },
      { test: '/api/agents/conversations/99/', handler: () => jsonResponse(convRow(99)) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([convRow(60), convRow(99)]) },
      {
        test: '/api/agents/conversations/60/branch/',
        method: 'POST',
        handler: () => jsonResponse({ conversation_id: 99, name: 'Branch' }, 201),
      },
      {
        test: /^\/api\/agents\/chat\/60\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(600, 'user', 'q', 0), mkMsg(601, 'assistant', '60 可分支', 1)],
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

    renderApp(['/chat/60']);
    await screen.findByText('60 可分支');
    fireEvent.click((await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认创建分支' }));

    // Branch created but the exact clear failed → clear-blocked, locked.
    await waitFor(() => {
      expect(screen.getAllByText(/分支已创建，但运行标记清理失败/).length).toBeGreaterThanOrEqual(1);
    });

    // R5-A2: EXPLICIT modal close revokes the per-invocation caller.
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // The later storage retry clears the marker but must NOT navigate.
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => {
      expect(loadLease(60)).toBeNull();
    });
    expect(screen.getByText('60 可分支')).toBeTruthy(); // still on source route
    expect(screen.queryByText('99 的内容')).toBeNull(); // no stale navigation
    await assertSendEnabledAfterTyping('解锁后新消息');
    clearSpy.mockRestore();
  });

  it('branch safe-reject after route switch still clears the source marker durably; no current-route mutation', async () => {
    const pendingBranch = { resolve: null as ((value: Response) => void) | null };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/61/', handler: () => jsonResponse(convRow(61)) },
      { test: '/api/agents/conversations/62/', handler: () => jsonResponse(convRow(62)) },
      {
        test: '/api/agents/conversations/61/branch/',
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            pendingBranch.resolve = resolve;
          }),
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([convRow(61), convRow(62)]) },
      {
        test: /^\/api\/agents\/chat\/61\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(611, 'user', 'q', 0), mkMsg(612, 'assistant', '61 可分支', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
      {
        test: /^\/api\/agents\/chat\/62\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(620, 'assistant', '62 的历史', 0)],
            total_count: 1,
            has_more: false,
          }),
      },
    ]);

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/chat/61']}>
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={
                <div>
                  <Link to="/chat/62">go62</Link>
                  <ConversationPage />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('61 可分支');
    fireEvent.click((await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认创建分支' }));
    await waitFor(() => expect(pendingBranch.resolve).not.toBeNull());

    // Depart, then the branch POST is PROVED-safe-rejected (400).
    fireEvent.click(screen.getByRole('link', { name: 'go62' }));
    await screen.findByText('62 的历史');
    pendingBranch.resolve?.(jsonResponse({ error: 'rejected' }, 400));
    await new Promise((r) => setTimeout(r, 120));

    // Data completion: the source marker is cleared durably even though the
    // caller is stale; the current route stays untouched.
    expect(loadLease(61)).toBeNull();
    expect(screen.getByText('62 的历史')).toBeTruthy();
  });

  it('branch ambiguity after route switch persists uncertain + Recent refresh; no current-route mutation', async () => {
    const pendingBranch = { resolve: null as ((value: Response) => void) | null };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/63/', handler: () => jsonResponse(convRow(63)) },
      { test: '/api/agents/conversations/64/', handler: () => jsonResponse(convRow(64)) },
      {
        test: '/api/agents/conversations/63/branch/',
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            pendingBranch.resolve = resolve;
          }),
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([convRow(63), convRow(64)]) },
      {
        test: /^\/api\/agents\/chat\/63\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(631, 'user', 'q', 0), mkMsg(632, 'assistant', '63 可分支', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
      {
        test: /^\/api\/agents\/chat\/64\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(640, 'assistant', '64 的历史', 0)],
            total_count: 1,
            has_more: false,
          }),
      },
    ]);

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/chat/63']}>
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={
                <div>
                  <Link to="/chat/64">go64</Link>
                  <ConversationPage />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('63 可分支');
    fireEvent.click((await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认创建分支' }));
    await waitFor(() => expect(pendingBranch.resolve).not.toBeNull());

    // Depart while the POST is in flight.
    fireEvent.click(screen.getByRole('link', { name: 'go64' }));
    await screen.findByText('64 的历史');

    // Ambiguous (503) AFTER departure: durable pending→uncertain + positive
    // Recent refresh; the current route stays untouched.
    pendingBranch.resolve?.(jsonResponse({ error: 'boom' }, 503));
    await waitFor(() => {
      expect(loadLease(63)?.disposition).toBe('uncertain');
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    });
    expect(screen.getByText('64 的历史')).toBeTruthy();
  });
});

describe('C1B-R5 sibling probes — async suspension: token/Stop retention (§10.1 B1–B3)', () => {
  it('upgrade persist failure keeps Stop reachable; stop posts once; durability retry begin-polls without re-POST', async () => {
    let sendPosts = 0;
    let stopPosts = 0;
    let pollCount = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      // 1: pending creation (real). 2: pending→active upgrade FAILS.
      if (persistCalls === 2) {
        return {
          state: 'mutation_unavailable',
          reason: 'blocked-by-test',
          verifiedExpectedPrior: expectedPrior,
        };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/70/', handler: () => jsonResponse(convRow(70)) },
      {
        test: /^\/api\/agents\/chat\/70\/$/,
        method: 'POST',
        handler: () => {
          sendPosts += 1;
          return jsonResponse({ message_id: 'tok70a', status: 'processing' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/70\/stop\//,
        method: 'POST',
        handler: () => {
          stopPosts += 1;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/70\/status\//,
        handler: (url) => {
          pollCount += 1;
          const c = Number(url.searchParams.get('cursor'));
          if (c === 0) {
            return jsonResponse({ status: 'processing', events: [{ event_type: 'content', delta: '同步段' }], cursor: 1 });
          }
          return jsonResponse({ status: 'done', events: [], cursor: 1, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/70\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/70']);
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Upgrade failed: pending retained, zero polling, Stop REACHABLE (R5-B1).
    await waitFor(() => {
      expect(screen.getByText(/消息已发送但恢复凭据保存失败/)).toBeTruthy();
    });
    expect(loadLease(70)?.disposition).toBe('pending');
    await new Promise((r) => setTimeout(r, 80));
    expect(pollCount).toBe(0);
    expect(screen.getByRole('button', { name: /停止生成/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /发送消息/ })).toBeNull();

    // Stop from the durability pause: exactly one stop POST.
    fireEvent.click(screen.getByRole('button', { name: /停止生成/ }));
    await waitFor(() => expect(stopPosts).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/停止请求已发送/)).toBeTruthy();
    });
    expect(sendPosts).toBe(1); // the send POST is never re-issued

    // Durability retry: upgrade lands, begin-poll drains; no second stop.
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await new Promise((r) => setTimeout(r, 400));
    await waitFor(() => {
      expect(loadLease(70)?.disposition).toBe('active');
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });
    await waitFor(() => {
      expect(loadLease(70)).toBeNull(); // terminal reconcile cleared
    });
    expect(stopPosts).toBe(1);
    await assertSendEnabledAfterTyping('解锁后新消息');
    persistSpy.mockRestore();
  });

  it('upgrade persist conflict adopts without forcing a write; exact ack reconciles and unlocks', async () => {
    let pollCount = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      // 1: pending creation (real). 2: upgrade CONFLICTS (our own pending is
      // still on disk — a null-prior re-attach would itself conflict, so the
      // runtime adopts and the exact pending marker carries the truth).
      if (persistCalls === 2) {
        return { state: 'conflict', observed: null, note: 'blocked-by-test' };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/71/', handler: () => jsonResponse(convRow(71)) },
      {
        test: /^\/api\/agents\/chat\/71\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tok71a', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/71\/status\//,
        handler: () => {
          pollCount += 1;
          return jsonResponse({ status: 'done', events: [], cursor: 0, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/71\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/71']);
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // R5-B3: conflict never guesses — adoption leaves the exact pending marker
    // and surfaces the ack lock; no tokenless active, no uncertain, no poll.
    await waitFor(() => {
      expect(screen.getByText(/上一次操作结果不确定/)).toBeTruthy();
    });
    expect(loadLease(71)?.disposition).toBe('pending');
    await new Promise((r) => setTimeout(r, 80));
    expect(pollCount).toBe(0);
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();

    // Explicit acknowledgement: canonical refresh → exact clear → unlock.
    fireEvent.click(screen.getByRole('button', { name: /关闭提示/ }));
    await waitFor(() => {
      expect(loadLease(71)).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
    persistSpy.mockRestore();
  });

  it('reread finds OUR OWN pending after upgrade precondition failure: exact upgrade with the captured token then begin-poll', async () => {
    let pollCount = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      // 1: pending creation (real). 2: upgrade hits a READ failure.
      if (persistCalls === 2) {
        return { state: 'precondition_unavailable', reason: 'blocked-read-by-test' };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/72/', handler: () => jsonResponse(convRow(72)) },
      {
        test: /^\/api\/agents\/chat\/72\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tok72a', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/72\/status\//,
        handler: (url) => {
          pollCount += 1;
          const c = Number(url.searchParams.get('cursor'));
          if (c === 0) {
            return jsonResponse({ status: 'processing', events: [{ event_type: 'content', delta: '续跑段' }], cursor: 1 });
          }
          return jsonResponse({ status: 'done', events: [], cursor: 1, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/72\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/72']);
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Upgrade read-failure → storage_blocked_read locks everything.
    await waitFor(() => {
      expect(screen.getByText(/重试读取存储/)).toBeTruthy();
    });
    expect(loadLease(72)?.disposition).toBe('pending');

    // R5-B3: reread finds OUR OWN pending (the awaited durability) → the
    // captured active snapshot (token!) is written via the exact CAS and the
    // captured begin-poll runs — never `uncertain`, never idle-with-token-lost.
    fireEvent.click(screen.getByRole('button', { name: /重试读取存储/ }));
    await waitFor(() => {
      expect(loadLease(72)?.disposition).toBe('active');
      expect(loadLease(72)?.asyncToken).toBe('tok72a');
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });
    await screen.findByText('续跑段');
    expect(loadLease(72)?.disposition).not.toBe('uncertain');
    await waitFor(() => {
      expect(loadLease(72)).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
    persistSpy.mockRestore();
  });

  it('reread-ABSENT after upgrade precondition failure re-attaches the captured continuation (no uncertain collapse)', async () => {
    let pollCount = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      // 1: pending creation (real). 2: upgrade hits a READ failure.
      if (persistCalls === 2) {
        return { state: 'precondition_unavailable', reason: 'blocked-read-by-test' };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/76/', handler: () => jsonResponse(convRow(76)) },
      {
        test: /^\/api\/agents\/chat\/76\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tok76a', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/76\/status\//,
        handler: (url) => {
          pollCount += 1;
          const c = Number(url.searchParams.get('cursor'));
          if (c === 0) {
            return jsonResponse({ status: 'processing', events: [{ event_type: 'content', delta: '重挂段' }], cursor: 1 });
          }
          return jsonResponse({ status: 'done', events: [], cursor: 1, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/76\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/76']);
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Upgrade read-failure → storage_blocked_read; then the marker VANISHES
    // (another session cleared it) before the reread.
    await waitFor(() => {
      expect(screen.getByText(/重试读取存储/)).toBeTruthy();
    });
    expect(loadLease(76)?.disposition).toBe('pending');
    const marker76 = loadLease(76);
    if (marker76) clearRuntimeLease(marker76);

    // R5-B3: reread-absent re-attaches the captured active snapshot and runs
    // the captured begin-poll — never `uncertain`, never idle-with-token-lost.
    fireEvent.click(screen.getByRole('button', { name: /重试读取存储/ }));
    await waitFor(() => {
      expect(loadLease(76)?.disposition).toBe('active');
      expect(loadLease(76)?.asyncToken).toBe('tok76a');
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });
    await screen.findByText('重挂段');
    await waitFor(() => {
      expect(loadLease(76)).toBeNull();
    });
    await assertSendEnabledAfterTyping('解锁后新消息');
    persistSpy.mockRestore();
  });

  it('stop-before-recovery: cursor persist failure in stopping resumes STOPPING; no duplicate Stop POST', async () => {
    let stopPosts = 0;
    let pollCount = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      // 1: pending; 2: upgrade; 3: cursor advance OK; 4: cursor advance FAILS
      // (this one happens AFTER the user clicked Stop — the stopping phase).
      if (persistCalls === 4) {
        return {
          state: 'mutation_unavailable',
          reason: 'blocked-by-test',
          verifiedExpectedPrior: expectedPrior,
        };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/73/', handler: () => jsonResponse(convRow(73)) },
      {
        test: /^\/api\/agents\/chat\/73\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tok73a', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/73\/stop\//,
        method: 'POST',
        handler: () => {
          stopPosts += 1;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/73\/status\//,
        handler: (url) => {
          pollCount += 1;
          const c = Number(url.searchParams.get('cursor'));
          if (c === 0) {
            return jsonResponse({ status: 'processing', events: [{ event_type: 'content', delta: '第一段' }], cursor: 1 });
          }
          return jsonResponse({ status: 'stopped', events: [], cursor: c, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/73\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/73']);
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Live: first poll lands events and cursor 1.
    await waitFor(() => {
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });
    await screen.findByText('第一段');

    // User clicks Stop → accepted stop; polls keep draining.
    fireEvent.click(screen.getByRole('button', { name: /停止生成/ }));
    await waitFor(() => expect(stopPosts).toBe(1));

    // The NEXT cursor advance (callback 4) fails while stopping → blocked
    // resume-poll. Stop is NOT re-offered (accepted stop preserved).
    await waitFor(() => {
      expect(screen.getByText(/无法保存轮询进度/)).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /停止生成/ })).toBeNull();
    expect(stopPosts).toBe(1);

    // Exact retry resumes STOPPING (not live): polls drain to `stopped`, the
    // terminal reconciles and unlocks — still exactly one stop POST.
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => {
      expect(loadLease(73)).toBeNull();
    });
    expect(stopPosts).toBe(1);
    await assertSendEnabledAfterTyping('解锁后新消息');
    persistSpy.mockRestore();
  });
});

describe('C1B-R5 sibling probes — P2 hygiene (§10.1 B5/B6)', () => {
  it('verified-absent pending-set failure shows dismiss-only — no dead storage retry', async () => {
    let sendPosts = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      if (persistCalls === 1) {
        return {
          state: 'mutation_unavailable',
          reason: 'blocked-by-test',
          verifiedExpectedPrior: expectedPrior,
        };
      }
      return originalPersist(expectedPrior, next);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/74/', handler: () => jsonResponse(convRow(74)) },
      {
        test: /^\/api\/agents\/chat\/74\/$/,
        method: 'POST',
        handler: () => {
          sendPosts += 1;
          return jsonResponse({ message_id: 'tok74a', status: 'processing' });
        },
      },
      { test: /^\/api\/agents\/chat\/74\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/74']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Zero POST, safe presentation, NO dead 重试存储操作 on a state that has no
    // storage recovery — only the dismiss action (R5-B5).
    await waitFor(() => {
      expect(screen.getByText(/消息未发送/)).toBeTruthy();
    });
    expect(sendPosts).toBe(0);
    expect(screen.queryByRole('button', { name: /重试存储操作/ })).toBeNull();
    expect(screen.getByRole('button', { name: /关闭提示/ })).toBeTruthy();
    // The composer unlocked for a fresh, honest retry by the user.
    await assertSendEnabledAfterTyping('重试发送');
    persistSpy.mockRestore();
  });

  it('draft-cleanup warning clears when a later accepted send clears the draft (no sticky warning)', async () => {
    const originalClearDraft = storageModule.clearConversationDraft;
    let draftClearCalls = 0;
    const draftSpy = vi.spyOn(storageModule, 'clearConversationDraft');
    draftSpy.mockImplementation((convId: number) => {
      draftClearCalls += 1;
      if (draftClearCalls === 1) return false; // first removal fails
      return originalClearDraft(convId);
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/75/', handler: () => jsonResponse(convRow(75)) },
      {
        test: /^\/api\/agents\/chat\/75\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') return sseDoneStream('正常流式回答');
          return jsonResponse({
            messages: [mkMsg(750, 'user', 'q', 0), mkMsg(751, 'assistant', '正常流式回答', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
    ]);

    renderApp(['/chat/75']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '第一条' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // First send: draft clear fails → warning appears; run completes.
    await screen.findByText(/草稿清理失败/);
    await waitFor(() => {
      expect(loadLease(75)).toBeNull();
    });

    // Second accepted send: its draft clear SUCCEEDS and resets the flag —
    // the warning must not stick (R5-B6).
    await assertSendEnabledAfterTyping('第二条');
    fireEvent.keyDown(screen.getByRole('textbox', { name: /消息输入框/ }), { key: 'Enter', shiftKey: true });
    await waitFor(() => {
      expect(screen.queryByText(/草稿清理失败/)).toBeNull();
    });
    draftSpy.mockRestore();
  });
});