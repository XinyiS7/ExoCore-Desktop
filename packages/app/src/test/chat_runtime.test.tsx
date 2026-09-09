import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

const PRESET_ECKI = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const MODEL_CATALOG = {
  models: [{
    name: 'deepseek-v4-flash',
    family: 'deepseek',
    abilities: ['fc'],
    compatible_endpoint_ids: [7],
  }],
  endpoints: [{
    id: 7,
    name: 'DeepSeek',
    provider: 'deepseek',
    execution_type: 'direct_api',
    execution_adapter: 'internal_http',
    payload_format: 'openai',
    cache_transport: 'inline_chunk',
    attachment_transports: ['inline_text'],
    configured: true,
    enabled: true,
  }],
  roles: { main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }], support: {} },
  providers: [],
};

const convRow = (id: number) => ({
  id,
  name: `Conversation #${id}`,
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
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

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  unmockFetch();
  window.localStorage.clear();
});

describe('P1B Chat Runtime Integration (§9.4, §9.5, §9.6, §9.7)', () => {
  it('disables blank/whitespace send, keeps Enter for newline, and sends on Shift+Enter', async () => {
    let sendCalls = 0;
    let sentBody: Record<string, unknown> | null = null;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(MODEL_CATALOG) },
      { test: '/api/agents/conversations/30/', handler: () => jsonResponse(convRow(30)) },
      {
        test: /^\/api\/agents\/chat\/30\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            sendCalls += 1;
            sentBody = JSON.parse(String(init.body)) as Record<string, unknown>;
            return new Response('event: done\ndata: [DONE]\n\n', {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          return jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
    ]);

    renderApp(['/chat/30']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    const sendBtn = screen.getByRole('button', { name: /发送消息/ });

    // Blank: disabled
    expect(sendBtn).toBeDisabled();

    // Whitespace only: disabled
    fireEvent.change(textbox, { target: { value: '   ' } });
    expect(sendBtn).toBeDisabled();

    // Plain Enter keeps the browser's native newline behavior and never sends.
    fireEvent.change(textbox, { target: { value: 'Line 1' } });
    expect(fireEvent.keyDown(textbox, { key: 'Enter' })).toBe(true);
    expect(sendCalls).toBe(0);
    fireEvent.change(textbox, { target: { value: 'Line 1\nLine 2' } });

    // IME composition Shift+Enter confirms text only; it must never dispatch.
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true, isComposing: true });
    expect(sendCalls).toBe(0);

    // Shift+Enter sends, with all request controls frozen into the request body.
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await waitFor(() => {
      expect(sendCalls).toBe(1);
    });
    expect(sentBody).toMatchObject({
      content: 'Line 1\nLine 2',
      model: 'deepseek-v4-flash',
      endpoint: 7,
      thinking_level: 'auto',
      session_type: 'lite',
      cache_enabled: true,
    });
    expect(sentBody).not.toHaveProperty('memory_injection_enabled');
  });

  it('renders optimistic user turn and streams SSE assistant response to completion', async () => {
    let postReceived = false;
    let reconciled = false;

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(MODEL_CATALOG) },
      { test: '/api/agents/conversations/31/', handler: () => jsonResponse(convRow(31)) },
      {
        test: /^\/api\/agents\/chat\/31\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            postReceived = true;
            // Simulated SSE stream
            const stream = new ReadableStream({
              start(controller) {
                const enc = new TextEncoder();
                controller.enqueue(enc.encode('event: content\ndata: 愿圣光指引你\n\n'));
                controller.enqueue(enc.encode('event: done\ndata: [DONE]\n\n'));
                controller.close();
              },
            });
            return new Response(stream, {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }

          // GET messages: returns persisted messages after post
          if (postReceived) {
            reconciled = true;
            return jsonResponse({
              messages: [
                mkMsg(301, 'user', '你好，阿莱', 0),
                mkMsg(302, 'assistant', '愿圣光指引你', 1),
              ],
              total_count: 2,
              has_more: false,
            });
          }

          return jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
    ]);

    renderApp(['/chat/31']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });

    fireEvent.change(textbox, { target: { value: '你好，阿莱' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Optimistic user turn should be rendered immediately
    expect(await screen.findByText('你好，阿莱')).toBeTruthy();

    // Assistant streamed content should land
    expect(await screen.findByText('愿圣光指引你')).toBeTruthy();

    // Reconciled messages should be fetched
    await waitFor(() => {
      expect(reconciled).toBe(true);
    });
  });

  it('switches to Stop button during active run, and stop request reconciles', async () => {
    let stopCalled = false;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(MODEL_CATALOG) },
      { test: '/api/agents/conversations/32/', handler: () => jsonResponse(convRow(32)) },
      {
        test: '/api/agents/chat/32/stop/',
        handler: () => {
          stopCalled = true;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/32\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            const stream = new ReadableStream({
              start(controller) {
                const enc = new TextEncoder();
                controller.enqueue(enc.encode('event: content\ndata: 一半的回答\n\n'));
                // Keep open until stopped
              },
            });
            return new Response(stream, {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          return jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
    ]);

    renderApp(['/chat/32']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '运行并停止' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // Button should become Stop button
    const stopBtn = await screen.findByRole('button', { name: /停止生成/ });
    expect(stopBtn).toBeTruthy();

    // Click Stop
    fireEvent.click(stopBtn);
    await waitFor(() => {
      expect(stopCalled).toBe(true);
    });
  });

  it('resumes active async turn from localStorage on re-entry without duplicating', async () => {
    let pollCount = 0;
    window.localStorage.setItem(
      'exo:v4:chat-runtime:33',
      JSON.stringify({
        version: 1,
        operation: 'send',
        conversationId: 33,
        transport: 'async',
        asyncToken: 'tok_res33',
        cursor: 0,
        startedAt: Date.now() - 1000,
        updatedAt: Date.now() - 500,
        disposition: 'active',
      }),
    );

    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(MODEL_CATALOG) },
      { test: '/api/agents/conversations/33/', handler: () => jsonResponse(convRow(33)) },
      {
        test: /^\/api\/agents\/chat\/33\/status\//,
        handler: () => {
          pollCount += 1;
          return jsonResponse({
            status: 'done',
            events: [{ event_type: 'content', delta: '恢复的回答' }],
            cursor: 1,
            error_message: null,
          });
        },
      },
      {
        test: /^\/api\/agents\/chat\/33\/$/,
        handler: () =>
          jsonResponse({
            messages: [
              mkMsg(401, 'user', '恢复前的提问', 0),
              mkMsg(402, 'assistant', '恢复的回答', 1),
            ],
            total_count: 2,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/33']);

    // Polling status banner or assistant content appears
    expect(await screen.findByText('恢复的回答')).toBeTruthy();
    expect(pollCount).toBeGreaterThanOrEqual(1);
  });

  it('provides edit and regenerate actions on persisted user messages, and branch on assistant messages', async () => {
    let branchCalled = false;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(MODEL_CATALOG) },
      { test: '/api/agents/conversations/34/', handler: () => jsonResponse(convRow(34)) },
      { test: '/api/agents/conversations/99/', handler: () => jsonResponse(convRow(99)) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([convRow(34), convRow(99)]) },
      {
        test: '/api/agents/conversations/34/branch/',
        handler: () => {
          branchCalled = true;
          return jsonResponse({ conversation_id: 99, name: 'Branch from 34' }, 201);
        },
      },
      {
        test: /^\/api\/agents\/chat\/\d+\/$/,
        handler: () =>
          jsonResponse({
            messages: [
              mkMsg(501, 'user', '第一个历史问题', 0),
              mkMsg(502, 'assistant', '第一个回答', 1),
              mkMsg(503, 'user', '第二个最新问题', 2),
              mkMsg(504, 'assistant', '第二个回答', 3),
            ],
            total_count: 4,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/34']);
    await screen.findByText('第一个历史问题');

    const editBtns = screen.getAllByRole('button', { name: /编辑此条消息/ });
    expect(editBtns).toHaveLength(2);

    const regenBtns = screen.getAllByRole('button', { name: /重新生成回答/ });
    expect(regenBtns).toHaveLength(2);

    const branchBtns = screen.getAllByRole('button', { name: /从该回答派生新会话/ });
    expect(branchBtns).toHaveLength(2);

    // 1. Click edit on historical (non-latest) user message -> TruncateConfirmModal opens
    fireEvent.click(editBtns[0]);
    expect(await screen.findByText('确认截断后续对话？')).toBeTruthy();
    const cancelModalBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelModalBtn);

    // 2. Click edit on latest user message -> populates composer directly without modal
    fireEvent.click(editBtns[1]);
    const composer = screen.getByRole('textbox', { name: /消息输入框/ }) as HTMLTextAreaElement;
    expect(composer.value).toBe('第二个最新问题');

    // Cancel edit restores composer
    const cancelEditBtn = screen.getByRole('button', { name: /取消编辑/ });
    fireEvent.click(cancelEditBtn);
    expect(composer.value).toBe('');

    // 3. Click branch on assistant message -> BranchConfirmModal opens
    fireEvent.click(branchBtns[1]);
    expect(await screen.findByText('创建独立对话分支')).toBeTruthy();

    const confirmBranchBtn = screen.getByRole('button', { name: '确认创建分支' });
    fireEvent.click(confirmBranchBtn);

    await waitFor(() => {
      expect(branchCalled).toBe(true);
    });
  });
});
