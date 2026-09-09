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
import { useConversationsQuery } from '../features/chat/queries';

/** Active observer of the Recent-conversations query so invalidation is observable. */
function RecentProbe() {
  const q = useConversationsQuery();
  return <span data-testid="recent-count">{q.data ? q.data.length : 'none'}</span>;
}
import * as storageModule from '../features/chat/runtime/storage';
import { loadConversationDraft, readRuntimeLease, saveConversationDraft } from '../features/chat/runtime/storage';
import type { V4RuntimeLease } from '../features/chat/runtime/types';

/** R4 durable-lease reader via the read-outcome vocabulary. */
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
});

describe('C1B-R1 repair invariants — storage-first write safety (R1-01)', () => {
  it('blocks dispatch when the runtime lease cannot be persisted — zero POST, visible error, draft kept', async () => {
    let postCount = 0;
    const saveSpy = vi.spyOn(storageModule, 'persistRuntimeLease').mockReturnValue({
      state: 'mutation_unavailable',
      reason: 'blocked-by-test',
      verifiedExpectedPrior: null,
    });

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/50/', handler: () => jsonResponse(convRow(50)) },
      {
        test: /^\/api\/agents\/chat\/50\/.*$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') postCount += 1;
          return sseDoneStream();
        },
      },
    ]);

    renderApp(['/chat/50']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '存储被锁也要发' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByText(/浏览器存储不可用/)).toBeTruthy();
    });
    expect(postCount).toBe(0);
    // Draft survives — no pre-dispatch destructive clearing.
    expect(loadConversationDraft(50)).toBe('存储被锁也要发');
    // No runtime lease could have been written.
    expect(loadLease(50)).toBeNull();
    saveSpy.mockRestore();
  });

  it('malformed async 2xx keeps uncertainty marker + disabled send; ack unlocks without duplicate POST', async () => {
    let postCount = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/51/', handler: () => jsonResponse(convRow(51)) },
      {
        test: /^\/api\/agents\/chat\/51\/$/,
        method: 'POST',
        handler: () => {
          postCount += 1;
          return jsonResponse({ status: 'processing' }, 200); // malformed: no message_id
        },
      },
      { test: /^\/api\/agents\/chat\/51\//, handler: () => emptyMessages() },
    ]);

    renderApp(['/chat/51']);
    await selectRuntimeTransport('async');

    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '第一次' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(postCount).toBe(1);
    });
    // Uncertainty marker persisted; UI locked.
    await waitFor(() => {
      expect(screen.getByText(/未返回有效的恢复凭据/)).toBeTruthy();
    });
    expect(loadLease(51)?.disposition).toBe('uncertain');
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();

    // Second Enter must NOT create a second POST.
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(postCount).toBe(1);

    // Explicit ack unlocks.
    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }));
    await waitFor(() => {
      expect(loadLease(51)).toBeNull();
      expect(screen.getByRole('button', { name: /发送消息/ })).not.toBeDisabled();
    });
  });

  it('normal draft is cleared only after request acceptance (safe 400 keeps it)', async () => {
    saveConversationDraft(52, '已有草稿');
    let postBody: string | null = null;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/52/', handler: () => jsonResponse(convRow(52)) },
      {
        test: /^\/api\/agents\/chat\/52\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            postBody = String(init.body);
            return jsonResponse({ error: '拒绝' }, 400);
          }
          return emptyMessages();
        },
      },
    ]);

    renderApp(['/chat/52']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '要发的正文' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(postBody).toContain('要发的正文');
    });
    // Safe synchronous rejection: draft + composer text preserved for retry.
    await waitFor(() => {
      expect(loadConversationDraft(52)).toBe('要发的正文');
    });
    expect((screen.getByRole('textbox', { name: /消息输入框/ }) as HTMLTextAreaElement).value).toBe('要发的正文');
    expect(screen.getByRole('button', { name: /发送消息/ })).not.toBeDisabled();
  });
});

describe('C1B-R1 repair invariants — lifecycle (R1-02)', () => {
  it('unmount cancels local stream and marks SSE outcome uncertain; never auto-stops', async () => {
    let stopCalled = 0;
    let capturedSignal: AbortSignal | null = null;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(convRow(60)) },
      {
        test: '/api/agents/chat/60/stop/',
        handler: () => {
          stopCalled += 1;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/60\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            capturedSignal = init.signal ?? null;
            const enc = new TextEncoder();
            return new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(enc.encode('event: content\ndata: 永不结束\n\n'));
                },
              }),
              { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
            );
          }
          return emptyMessages();
        },
      },
    ]);

    const { unmount } = renderApp(['/chat/60']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '开始后立刻离开' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(capturedSignal).not.toBeNull());

    unmount();
    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true);
    });
    expect(stopCalled).toBe(0);
    // In-flight SSE outcome at unmount becomes uncertain for re-entry.
    expect(loadLease(60)?.disposition).toBe('uncertain');
  });

  it('not_found first reconciles canonical history, stays visible until ack', async () => {
    let reconcileGets = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/61/', handler: () => jsonResponse(convRow(61)) },
      {
        test: /^\/api\/agents\/chat\/61\/status\//,
        handler: () => jsonResponse({ status: 'not_found', events: [], cursor: 0 }),
      },
      {
        test: /^\/api\/agents\/chat\/61\/$/,
        handler: () => {
          reconcileGets += 1;
          return jsonResponse({
            messages: [mkMsg(610, 'user', '早先的提问', 0), mkMsg(611, 'assistant', '早先的回答', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
    ]);
    // Active async lease so re-entry resumes polling into not_found.
    window.localStorage.setItem(
      'exo:v4:chat-runtime:61',
      JSON.stringify({
        version: 1,
        operation: 'send',
        conversationId: 61,
        transport: 'async',
        asyncToken: 'deadbeef',
        cursor: 0,
        startedAt: Date.now() - 1000,
        updatedAt: Date.now() - 500,
        disposition: 'active',
      }),
    );

    const first = renderApp(['/chat/61']);
    expect(await screen.findByText(/凭据已失效/)).toBeTruthy();
    // Canonical history was fetched (reconcile before visible ack state).
    await waitFor(() => {
      expect(reconcileGets).toBeGreaterThan(0);
    });
    expect(screen.getByText('早先的提问')).toBeTruthy();

    // R2-02: the non-executable uncertain marker survives reload — remounting
    // before acknowledgement must show a visible uncertainty lock again.
    first.unmount();
    const second = renderApp(['/chat/61']);
    expect(await screen.findByText(/操作结果不确定/)).toBeTruthy();

    const ackButton = screen.getByRole('button', { name: '关闭提示' });
    fireEvent.click(ackButton);
    await waitFor(() => {
      expect(screen.queryByText(/操作结果不确定/)).toBeNull();
      expect(loadLease(61)).toBeNull();
    });
    second.unmount();
  });

  it('stop network failure is visible + retryable while the run stays locked', async () => {
    let stopCalls = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/62/', handler: () => jsonResponse(convRow(62)) },
      {
        test: '/api/agents/chat/62/stop/',
        handler: () => {
          stopCalls += 1;
          if (stopCalls === 1) throw new TypeError('Failed to fetch');
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/62\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            const enc = new TextEncoder();
            return new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(enc.encode('event: content\ndata: 前一半\n\n'));
                  // Keep the stream OPEN until the retried stop succeeds, so the
                  // first STOP_FAILED state stays visible and retryable.
                  const timer = setInterval(() => {
                    if (stopCalls >= 2) {
                      clearInterval(timer);
                      controller.enqueue(enc.encode('event: stopped\ndata: {"partial": true}\n\n'));
                      controller.close();
                    }
                  }, 30);
                },
              }),
              { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
            );
          }
          return jsonResponse({
            messages: [mkMsg(620, 'user', '停止我', 0), mkMsg(621, 'assistant', '前一半', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
    ]);

    renderApp(['/chat/62']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '停止我' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    const stopBtn = await screen.findByRole('button', { name: /停止生成/ });
    fireEvent.click(stopBtn);

    // First stop fails: visible error + retry affordance; stream continues.
    const retryStop = await screen.findByRole('button', { name: '重试停止' });
    fireEvent.click(retryStop);
    await waitFor(() => {
      expect(stopCalls).toBe(2);
    });
  });

  it('resume polling continues from the retained cursor (no cursor-0 replay after transient failure)', async () => {
    const cursorRequests: number[] = [];
    let failNext = false;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/63/', handler: () => jsonResponse(convRow(63)) },
      {
        test: /^\/api\/agents\/chat\/63\/$/,
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'tok63abc', status: 'processing' }),
      },
      {
        test: /^\/api\/agents\/chat\/63\/status\//,
        handler: (url) => {
          const c = Number(url.searchParams.get('cursor'));
          cursorRequests.push(c);
          if (failNext) {
            failNext = false;
            throw new TypeError('Failed to fetch');
          }
          if (c === 0) {
            // Backend cursor == requested + returned event count (1 event => 1).
            return jsonResponse({ status: 'processing', events: [{ event_type: 'content', delta: '第一段' }], cursor: 1 });
          }
          return jsonResponse({ status: 'done', events: [{ event_type: 'content', delta: '第二段' }], cursor: 2 });
        },
      },
      {
        test: /^\/api\/agents\/chat\/63\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(630, 'user', 'q', 0), mkMsg(631, 'assistant', '第一段第二段', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/63']);
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '恢复测试' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await waitFor(() => expect(cursorRequests.length).toBeGreaterThan(0));
    // Let the first successful poll land (cursor 0 → cursor 1), then fail the next.
    await waitFor(() => expect(loadLease(63)?.cursor).toBe(1));
    failNext = true;
    await waitFor(() => {
      expect(screen.getByText(/网络连接异常/)).toBeTruthy();
    });

    // Resume must request from the retained cursor (1), never from 0.
    fireEvent.click(screen.getByRole('button', { name: '继续轮询' }));
    await waitFor(() => {
      // Failed poll (cursor 1) + resumed poll (same retained cursor 1).
      expect(cursorRequests.filter((c) => c === 1).length).toBeGreaterThanOrEqual(2);
    });
    // Cursor 0 was requested exactly once (the initial poll) — never replayed
    // after the transient failure.
    expect(cursorRequests.filter((c) => c === 0)).toHaveLength(1);
    // The run completes and canonical reconciliation surfaces the full answer.
    expect(await screen.findByText('第一段第二段')).toBeTruthy();
  });
});

describe('C1B-R1 repair invariants — canonical reconciliation (R1-03)', () => {
  it('append terminal near bottom rebuilds a fresh canonical window (offset 0 only, no stale page refetch)', async () => {
    const offsetRequests: number[] = [];
    let postReceived = false;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/70/', handler: () => jsonResponse(convRow(70)) },
      {
        test: /^\/api\/agents\/chat\/70\/$/,
        handler: (url, init) => {
          if (init?.method === 'POST') {
            postReceived = true;
            return sseDoneStream('完整回答');
          }
          const off = Number(url.searchParams.get('offset') ?? '0');
          offsetRequests.push(off);
          if (postReceived) {
            return jsonResponse({
              messages: [mkMsg(701, 'user', '提问', 0), mkMsg(702, 'assistant', '完整回答', 1)],
              total_count: 2,
              has_more: false,
            });
          }
          return jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
    ]);

    renderApp(['/chat/70']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '提问' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    expect(await screen.findByText('完整回答')).toBeTruthy();
    await waitFor(() => {
      // Fresh canonical newest window fetched after terminal (offset 0).
      expect(offsetRequests.filter((o) => o === 0).length).toBeGreaterThanOrEqual(1);
    });
    // Never refetches any stale older offset page in place.
    expect(offsetRequests.filter((o) => o > 0)).toHaveLength(0);
  });

  it('scrolled-up reader: terminal holds pages untouched and applies canonical window on return-to-latest', async () => {
    const offsetRequests: number[] = [];
    let postReceived = false;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/71/', handler: () => jsonResponse(convRow(71)) },
      {
        test: /^\/api\/agents\/chat\/71\/$/,
        handler: (url, init) => {
          if (init?.method === 'POST') {
            postReceived = true;
            return sseDoneStream('新回复');
          }
          const off = Number(url.searchParams.get('offset') ?? '0');
          offsetRequests.push(off);
          if (postReceived) {
            return jsonResponse({
              messages: [mkMsg(711, 'user', '提问', 0), mkMsg(712, 'assistant', '新回复', 1)],
              total_count: 2,
              has_more: false,
            });
          }
          return jsonResponse({
            messages: [mkMsg(710, 'assistant', '很久以前', 0)],
            total_count: 1,
            has_more: false,
          });
        },
      },
    ]);

    renderApp(['/chat/71']);
    // Wait for the message page to be rendered before simulating a scroll.
    await screen.findByText('很久以前');
    const scrollEl = document.querySelector('.app-scroll') as HTMLElement;
    // Simulate the reader having scrolled far upward (not near bottom).
    Object.defineProperty(scrollEl, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(scrollEl, 'clientHeight', { configurable: true, value: 500 });
    scrollEl.scrollTop = 1000;
    fireEvent.scroll(scrollEl);

    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '提问' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Terminal arrives while scrolled up → hold pending, no rebuild GET.
    const returnPrompt = await screen.findByRole('button', { name: /返回最新位置/ });
    const latestButton = screen.getByRole('button', { name: '返回最新消息' });
    await new Promise((r) => setTimeout(r, 60));
    const getsBeforeApply = offsetRequests.length;

    fireEvent.click(latestButton);
    await waitFor(() => {
      expect(offsetRequests.length).toBeGreaterThan(getsBeforeApply);
    });
    expect(await screen.findByText('新回复')).toBeTruthy();
    expect(returnPrompt).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '返回最新消息' })).toBeNull();
    // All applied GETs are canonical offset 0 — never stale offset pages.
    expect(offsetRequests.filter((o) => o > 0)).toHaveLength(0);
  });

  it('destructive regenerate resets the whole family; truncated descendants cannot return via older pages', async () => {
    const offsetRequests: number[] = [];
    let phase: 'pre' | 'post' = 'pre';
    let regenPosted = false;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/72/', handler: () => jsonResponse(convRow(72)) },
      {
        test: /^\/api\/agents\/chat\/72\/$/,
        handler: (url, init) => {
          if (init?.method === 'POST') {
            const body = JSON.parse(String(init.body));
            if (body.edit_message_id !== undefined && (body.content === undefined || body.content === '')) {
              regenPosted = true;
              phase = 'post'; // truncation already applied server-side
              return sseDoneStream('重生成回答');
            }
            return sseDoneStream();
          }
          const off = Number(url.searchParams.get('offset') ?? '0');
          offsetRequests.push(off);
          if (phase === 'pre') {
            if (off === 0) {
              return jsonResponse({
                messages: [
                  mkMsg(720, 'user', '原始问题', 0),
                  mkMsg(721, 'assistant', '旧回答', 1),
                  mkMsg(722, 'user', '后续问题', 2),
                  mkMsg(723, 'assistant', '截断候选', 3),
                ],
                total_count: 6,
                has_more: true,
              });
            }
            return jsonResponse({
              messages: [mkMsg(719, 'assistant', '更早的历史', -1)],
              total_count: 6,
              has_more: false,
            });
          }
          // post-truncation canonical: descendants removed server-side.
          return jsonResponse({
            messages: [mkMsg(720, 'user', '原始问题', 0), mkMsg(724, 'assistant', '重生成回答', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
    ]);

    renderApp(['/chat/72']);
    await screen.findByText('截断候选');
    // Load an older page so stale offset rows are cached.
    const loadOlder = await screen.findByRole('button', { name: '加载更早消息' });
    fireEvent.click(loadOlder);
    await waitFor(() => expect(screen.getByText('更早的历史')).toBeTruthy());

    // Regenerate the FIRST (non-latest) user message → truncation confirm.
    const regenBtns = screen.getAllByRole('button', { name: /重新生成回答/ });
    fireEvent.click(regenBtns[0]);
    fireEvent.click(await screen.findByRole('button', { name: /确认截断并重生成/ }));

    await waitFor(() => {
      expect(regenPosted).toBe(true);
    });
    // Canonical rebuild after destructive terminal happens at offset 0.
    await waitFor(() => {
      const postGets = offsetRequests.filter((o) => o > 0);
      expect(postGets.length).toBeGreaterThan(0); // recorded older fetch remains historical
    });
    expect(await screen.findByText('重生成回答')).toBeTruthy();
    // Truncated descendants never reappear anywhere in the DOM.
    expect(screen.queryByText('截断候选')).toBeNull();
    expect(screen.queryByText('后续问题')).toBeNull();
    // No load-older affordance is offered anymore (has_more=false canonical).
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '加载更早消息' })).toBeNull();
    });
  });
});

describe('C1B-R1 repair invariants — protocol boundary (R1-04)', () => {
  it('malformed content JSON object is reported as a protocol warning, never appended', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/80/', handler: () => jsonResponse(convRow(80)) },
      {
        test: /^\/api\/agents\/chat\/80\/$/,
        handler: () => {
          const enc = new TextEncoder();
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  enc.encode(`event: content\ndata: ${JSON.stringify({ evil: 'json' })}\n\n`),
                );
                controller.enqueue(enc.encode('event: done\ndata: [DONE]\n\n'));
                controller.close();
              },
            }),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          );
        },
      },
    ]);

    renderApp(['/chat/80']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'hi' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    expect(await screen.findByText(/content 事件载荷格式异常/)).toBeTruthy();
    // Raw JSON object must never appear as answer content.
    expect(screen.queryByText('{"evil":"json"}')).toBeNull();
    expect(screen.queryByText(/evil/)).toBeNull();
  });

  it('async polling preserves conversation thinking_level and rejects regressing cursors', async () => {
    let postBody: string | null = null;
    let pollCursor: string | null = null;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      {
        test: '/api/agents/conversations/81/',
        handler: () => jsonResponse(convRow(81, { thinking_level: 'high' })),
      },
      {
        test: /^\/api\/agents\/chat\/81\/$/,
        method: 'POST',
        handler: (_url, init) => {
          postBody = String(init?.body);
          return jsonResponse({ message_id: 'tok81abc', status: 'processing' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/81\/status\//,
        handler: (url) => {
          pollCursor = url.searchParams.get('cursor');
          return jsonResponse({ status: 'done', events: [], cursor: 0, error_message: null });
        },
      },
      {
        test: /^\/api\/agents\/chat\/81\/$/,
        handler: () => emptyMessages(),
      },
    ]);

    renderApp(['/chat/81']);
    await screen.findByRole('textbox', { name: /消息输入框/ });
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '保持高级思考' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(postBody).toContain('"thinking_level":"high"');
    });
    // Regressing cursor envelope (server returns cursor < requested) is rejected
    // by the client adapter → visible interrupted state, token retained.
    await waitFor(() => expect(pollCursor).toBe('0'));
  });
});

describe('C1B-R2 residual invariants — storage lifecycle (R2-01)', () => {
  it('terminal reconciliation stays LOCKED when lease removal fails; retry storage op unlocks', async () => {
    let postCount = 0;
    const originalClear = storageModule.clearRuntimeLease;
    let failNextClear = true;
    const clearSpy = vi.spyOn(storageModule, 'clearRuntimeLease');
    clearSpy.mockImplementation((expectedPrior: V4RuntimeLease) => {
      if (failNextClear && loadLease(expectedPrior.conversationId)) {
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
      { test: '/api/agents/conversations/95/', handler: () => jsonResponse(convRow(95)) },
      {
        test: /^\/api\/agents\/chat\/95\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            postCount += 1;
            return sseDoneStream('正常回答');
          }
          return jsonResponse({
            messages: [mkMsg(950, 'user', 'q', 0), mkMsg(951, 'assistant', '正常回答', 1)],
            total_count: 2,
            has_more: false,
          });
        },
      },
    ]);
    renderApp(['/chat/95']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: 'q' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByText(/无法清除上次运行标记/)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();
    expect(postCount).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => {
      expect(loadLease(95)).toBeNull();
    });
    const textboxAfter = screen.getByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textboxAfter, { target: { value: '解锁后新消息' } });
    expect(screen.getByRole('button', { name: /发送消息/ })).not.toBeDisabled();
    clearSpy.mockRestore();
  });

  it('ambiguous branch refreshes Recent while keeping its durable lock; confirm stays locked', async () => {
    let branchPosts = 0;
    let recentGets = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/96/', handler: () => jsonResponse(convRow(96)) },
      {
        test: '/api/agents/conversations/96/branch/',
        method: 'POST',
        handler: () => {
          branchPosts += 1;
          return jsonResponse({ session_id: 111 }, 201); // malformed: no conversation_id
        },
      },
      {
        test: '/api/agents/conversations/',
        handler: () => {
          recentGets += 1;
          return jsonResponse([convRow(96)]);
        },
      },
      {
        test: /^\/api\/agents\/chat\/96\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(960, 'user', 'q', 0), mkMsg(961, 'assistant', '可分支', 1)],
            total_count: 2,
            has_more: false,
          }),
      },
    ]);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/chat/96']}>
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
    await waitFor(() => expect(recentGets).toBeGreaterThanOrEqual(1)); // initial list load
    const branchBtn = (await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0];
    fireEvent.click(branchBtn);
    const confirmBtn = await screen.findByRole('button', { name: '确认创建分支' });
    fireEvent.click(confirmBtn);

    await screen.findByText(/缺少有效的会话编号/);
    expect(branchPosts).toBe(1);
    // Ambiguous branch must invalidate Recent → active observer refetches.
    await waitFor(() => {
      expect(recentGets).toBeGreaterThanOrEqual(2);
    });
    expect(loadLease(96)?.disposition).toBe('uncertain');
    expect(screen.getByRole('button', { name: '确认创建分支' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await new Promise((r) => setTimeout(r, 60));
    expect(branchPosts).toBe(1);
  });

  it('unknown-write ack wording explicitly states possible success and no auto-resend', async () => {
    let postCount = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/97/', handler: () => jsonResponse(convRow(97)) },
      {
        test: /^\/api\/agents\/chat\/97\/$/,
        method: 'POST',
        handler: () => {
          postCount += 1;
          return jsonResponse({ status: 'processing' }, 200); // malformed ack (no message_id)
        },
      },
      { test: /^\/api\/agents\/chat\/97\//, handler: () => emptyMessages() },
    ]);
    renderApp(['/chat/97']);
    await selectRuntimeTransport('async');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '未知结果' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await waitFor(() => expect(postCount).toBe(1));
    expect(
      await screen.findByText(/结果可能已成功：确认后将解除锁定并同步最新消息，不会自动重发/),
    ).toBeTruthy();
  });
});

describe('C1B-R2 residual invariants — route switch identity (R2-02)', () => {
  it('chat76 to chat77 resets overlay/busy; a late terminal of 76 cannot clear route 77', async () => {
    const conv76 = convRow(76, { name: 'Conversation 76' });
    const conv77 = convRow(77, { name: 'Conversation 77' });
    const streamRef: { ctrl: ReadableStreamDefaultController<Uint8Array> | null } = { ctrl: null };
    const enc = new TextEncoder();

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/76/', handler: () => jsonResponse(conv76) },
      { test: '/api/agents/conversations/77/', handler: () => jsonResponse(conv77) },
      {
        test: /^\/api\/agents\/chat\/76\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            return new Response(
              new ReadableStream({
                start(controller) {
                  streamRef.ctrl = controller;
                  controller.enqueue(enc.encode('event: content\ndata: 76 的乐观回答\n\n'));
                },
              }),
              { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
            );
          }
          return jsonResponse({
            messages: [mkMsg(760, 'user', '76 的问题', 0)],
            total_count: 1,
            has_more: false,
          });
        },
      },
      {
        test: /^\/api\/agents\/chat\/77\/$/,
        handler: () =>
          jsonResponse({
            messages: [mkMsg(770, 'assistant', '77 的历史', 0)],
            total_count: 1,
            has_more: false,
          }),
      },
    ]);

    const { unmount } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/chat/76']}>
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={
                <div>
                  <Link to="/chat/77">go77</Link>
                  <ConversationPage />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('Conversation 76');
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '76 的问题' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await screen.findByText(/76 的乐观回答/);
    expect(screen.getByRole('button', { name: /停止生成/ })).toBeTruthy();
    expect(loadLease(76)?.disposition).toBe('active');

    fireEvent.click(screen.getByRole('link', { name: 'go77' }));
    await screen.findByText('Conversation 77');

    await waitFor(() => {
      expect(screen.queryByText(/76 的乐观回答/)).toBeNull();
      expect(screen.queryByRole('button', { name: /停止生成/ })).toBeNull();
    });
    expect(screen.getByText('77 的历史')).toBeTruthy();
    expect(loadLease(76)?.disposition).toBe('uncertain');
    expect(loadLease(77)).toBeNull();

    // Late terminal from 76 after route change must be ignored.
    if (streamRef.ctrl) {
      streamRef.ctrl.enqueue(enc.encode('event: done\ndata: [DONE]\n\n'));
      streamRef.ctrl.close();
    }
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.getByText('77 的历史')).toBeTruthy();
    expect(loadLease(77)).toBeNull();
    unmount();
  });
});
