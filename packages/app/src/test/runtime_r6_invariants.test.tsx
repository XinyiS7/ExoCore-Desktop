import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';
import { ConversationPage } from '../features/chat/ConversationPage';
import * as storageModule from '../features/chat/runtime/storage';
import { clearRuntimeLease, persistRuntimeLease, readRuntimeLease } from '../features/chat/runtime/storage';
import type { V4RuntimeLease } from '../features/chat/runtime/types';

/**
 * C1B-R6 cross-product probes — frozen micro-matrix (escalation §16.3).
 * These tests MUST FAIL against the current R5 candidate and PASS only after
 * the three-row production fix:
 *   1. accepted control propagation through begin-poll/continue-live/resume-poll
 *   2. exact owner predicate (conversationId+operation+transport+startedAt)
 *   3. branch ambiguity Recent discovery independent of marker outcome
 */

function loadLease(conversationId: number): V4RuntimeLease | null {
  const outcome = readRuntimeLease(conversationId);
  return outcome.state === 'valid' ? outcome.lease : null;
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

describe('C1B-R6 micro-matrix row 1 — accepted Stop propagates through begin-poll/continue-live recovery', () => {
  it('async: upgrade-fail → stop once → durability retry resumes STOPPING (begin-poll); no re-enabled Stop', async () => {
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
      { test: '/api/agents/conversations/80/', handler: () => jsonResponse(convRow(80)) },
      {
        test: /^\/api\/agents\/chat\/80\/$/,
        method: 'POST',
        handler: () => {
          sendPosts += 1;
          return jsonResponse({ message_id: 'tok80a', status: 'processing' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/80\/stop\//,
        method: 'POST',
        handler: () => {
          stopPosts += 1;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/80\/status\//,
        handler: (url) => {
          pollCount += 1;
          const c = Number(url.searchParams.get('cursor'));
          if (c === 0) {
            return jsonResponse({
              status: 'processing',
              events: [{ event_type: 'content', delta: '停止后排干' }],
              cursor: 1,
            });
          }
          return jsonResponse({ status: 'done', events: [], cursor: 1, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/80\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/80']);
    const transport = await screen.findByLabelText('传输模式选择');
    fireEvent.change(transport, { target: { value: 'async' } });
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    // Accepted run paused on durability: Stop reachable, zero polling.
    await waitFor(() => {
      expect(screen.getByText(/消息已发送但恢复凭据保存失败/)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /停止生成/ })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 80));
    expect(pollCount).toBe(0);

    // Stop once from the durability pause.
    fireEvent.click(screen.getByRole('button', { name: /停止生成/ }));
    await waitFor(() => expect(stopPosts).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/停止请求已发送/)).toBeTruthy();
    });

    // Durability retry → begin-poll resumes the TRANSPORT.
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => {
      expect(loadLease(80)?.disposition).toBe('active');
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });

    // R6 row 1: the accepted Stop survives the recovery — Stop stays
    // DISABLED (stopping), never re-enabled for a duplicate POST.
    const stopBtn = screen.getByRole('button', { name: /停止生成/ });
    expect((stopBtn as HTMLButtonElement).disabled).toBe(true);

    // Drain to terminal, reconcile, unlock — still exactly one stop POST.
    await waitFor(() => {
      expect(loadLease(80)).toBeNull();
    });
    expect(stopPosts).toBe(1);
    expect(sendPosts).toBe(1);
    expect(screen.queryByRole('button', { name: /停止生成/ })).toBeNull();
    persistSpy.mockRestore();
  });

  it('sse: upgrade-fail → stop once → durability retry resumes STOPPING (continue-live); no re-enabled Stop', async () => {
    let stopPosts = 0;
    // Controlled SSE stream: content first, `stopped` later (asserted after
    // the durability retry, while the stream is still draining).
    const streamCtl = { end: null as (() => void) | null };
    const enc = new TextEncoder();
    const sseStream = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(enc.encode('event: content\ndata: SSE 停止\n\n'));
            streamCtl.end = () => controller.enqueue(enc.encode('event: stopped\ndata: {}\n\n'));
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
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
      { test: '/api/agents/conversations/81/', handler: () => jsonResponse(convRow(81)) },
      {
        test: /^\/api\/agents\/chat\/81\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') return sseStream();
          return jsonResponse({
            messages: [mkMsg(810, 'user', 'q', 0), mkMsg(811, 'assistant', 'SSE 停止', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
      {
        test: /^\/api\/agents\/chat\/81\/stop\//,
        method: 'POST',
        handler: () => {
          stopPosts += 1;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
    ]);

    renderApp(['/chat/81']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    // SSE accepted run paused on durability: Stop reachable.
    await waitFor(() => {
      expect(screen.getByText(/消息已发送但恢复凭据保存失败/)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /停止生成/ })).toBeTruthy();

    // Stop once from the durability pause (SSE stop: bare endpoint).
    fireEvent.click(screen.getByRole('button', { name: /停止生成/ }));
    await waitFor(() => expect(stopPosts).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/停止请求已发送/)).toBeTruthy();
    });

    // Durability retry → continue-live resumes the suspended SSE stream
    // (content already flowing; `stopped` withheld by the test).
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await screen.findByText('SSE 停止');

    // R6 row 1 (SSE sibling): the accepted Stop survives the continue-live
    // recovery — Stop stays DISABLED (stopping), never re-enabled.
    const stopBtn = screen.getByRole('button', { name: /停止生成/ });
    expect((stopBtn as HTMLButtonElement).disabled).toBe(true);
    expect(stopPosts).toBe(1);

    // Allow the terminal frame; reconcile clears and unlocks.
    streamCtl.end?.();
    await waitFor(() => {
      expect(loadLease(81)).toBeNull();
    });
    expect(stopPosts).toBe(1);
    expect(screen.queryByRole('button', { name: /停止生成/ })).toBeNull();
    persistSpy.mockRestore();
  });
});

describe('C1B-R6 micro-matrix row 2 — exact owner predicate includes transport', () => {
  it('reread finds a DIFFERENT-owner valid lease (same op/startedAt, other transport): never overwritten, no old poll', async () => {
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
      { test: '/api/agents/conversations/82/', handler: () => jsonResponse(convRow(82)) },
      {
        test: /^\/api\/agents\/chat\/82\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tok82a', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/82\/status\//,
        handler: () => {
          pollCount += 1;
          return jsonResponse({ status: 'done', events: [], cursor: 0, error_message: null });
        },
      },
      { test: /^\/api\/agents\/chat\/82\/$/, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/82']);
    const transport = await screen.findByLabelText('传输模式选择');
    fireEvent.change(transport, { target: { value: 'async' } });
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    // Upgrade read-failure → storage_blocked_read locks everything.
    await waitFor(() => {
      expect(screen.getByText(/重试读取存储/)).toBeTruthy();
    });
    const ours = loadLease(82);
    expect(ours?.disposition).toBe('pending');

    // ANOTHER session's lease owns the slot now: identical operation and
    // startedAt but a DIFFERENT transport (sse) — a different stable owner.
    if (ours) clearRuntimeLease(ours);
    const foreignSseLease = persistRuntimeLease(null, {
      version: 1,
      operation: 'send',
      conversationId: 82,
      transport: 'sse',
      startedAt: ours!.startedAt,
      updatedAt: Date.now(),
      disposition: 'pending', // pending like ours — the transport is what differs
    });
    expect(foreignSseLease.state).toBe('persisted');

    // Reread: the observed owner must be adopted/interpreted — the old async
    // continuation must NEVER overwrite it or start polling.
    fireEvent.click(screen.getByRole('button', { name: /重试读取存储/ }));
    await waitFor(() => {
      expect(screen.getByText(/上一次操作结果不确定/)).toBeTruthy(); // adopted: sse-active → ack lock
    });
    expect(loadLease(82)?.transport).toBe('sse'); // byte-for-byte owned
    expect(loadLease(82)?.disposition).toBe('pending');
    await new Promise((r) => setTimeout(r, 80));
    expect(pollCount).toBe(0); // no old continuation polled
    persistSpy.mockRestore();
  });
});

describe('C1B-R6 micro-matrix row 3 — ambiguous branch discovery is outcome-independent', () => {
  it('ambiguous branch + uncertain-marker mutation failure still refreshes Recent (marker/lock preserved)', async () => {
    let branchPosts = 0;
    const originalPersist = storageModule.persistRuntimeLease;
    let persistCalls = 0;
    const persistSpy = vi.spyOn(storageModule, 'persistRuntimeLease');
    persistSpy.mockImplementation((expectedPrior, next) => {
      persistCalls += 1;
      // 1: pending creation (real). 2: pending→uncertain FAILS.
      if (persistCalls === 2 && next.disposition === 'uncertain') {
        return {
          state: 'mutation_unavailable',
          reason: 'blocked-by-test',
          verifiedExpectedPrior: expectedPrior,
        };
      }
      return originalPersist(expectedPrior, next);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/83/', handler: () => jsonResponse(convRow(83)) },
      {
        test: '/api/agents/conversations/83/branch/',
        method: 'POST',
        handler: () => {
          branchPosts += 1;
          return jsonResponse({ error: 'boom' }, 503);
        },
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([convRow(83)]) },
      {
        test: /^\/api\/agents\/chat\/83\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(831, 'user', 'q', 0), mkMsg(832, 'assistant', '83 可分支', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
    ]);

    const { MemoryRouter, Route, Routes } = await import('react-router-dom');
    const { render } = await import('@testing-library/react');
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/chat/83']}>
          <Routes>
            <Route path="/chat/:conversationId" element={<ConversationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('83 可分支');
    fireEvent.click((await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认创建分支' }));

    // Ambiguous (503): the pending→uncertain marker write FAILS — but the
    // discovery refresh is outcome-independent (a conversation may exist).
    await waitFor(() => {
      expect(screen.getByText(/无法写入不确定性标记/)).toBeTruthy();
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    });
    // Marker truth and lock remain exact; no second branch POST.
    expect(loadLease(83)?.disposition).toBe('pending');
    expect(branchPosts).toBe(1);
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();
    persistSpy.mockRestore();
  });
});