import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { installFetch, jsonResponse, renderApp, unmockFetch } from '../helpers';
import { normalizeSSEEvent } from '../../features/chat/runtime/sse';
import { pollChatStatus } from '../../features/chat/runtime/client';

const preset = {
  id: 5,
  name: 'Runtime Agent',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const conversation = (id: number) => ({
  id,
  name: `Conversation ${id}`,
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'high',
  memory_injection_enabled: null,
});

const assistant = (id: number) => ({
  id,
  role: 'assistant',
  content: 'persisted answer',
  reasoning_content: null,
  platform: 'deepseek',
  model_version: 'v4-flash',
  token_count: null,
  index_in_session: 0,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-09-01T10:00:00Z',
});

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  unmockFetch();
  window.localStorage.clear();
});

describe('C1B independent acceptance — decisive runtime invariants', () => {
  it('does not dispatch a write when the mandatory uncertainty marker cannot be persisted', async () => {
    let postCount = 0;
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (String(key).startsWith('exo:v4:chat-runtime:')) throw new DOMException('blocked', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/agents/conversations/71/', handler: () => jsonResponse(conversation(71)) },
      {
        test: /^\/api\/agents\/chat\/71\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') postCount += 1;
          return init?.method === 'POST'
            ? new Response('event: done\ndata: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
            : jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
    ]);

    renderApp(['/chat/71']);
    const box = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(box, { target: { value: 'must remain retry-safe' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(postCount).toBe(0));
  });

  it('retains an ambiguous async write lock and blocks resubmission until acknowledgement', async () => {
    let postCount = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/agents/conversations/72/', handler: () => jsonResponse(conversation(72)) },
      {
        test: /^\/api\/agents\/chat\/72\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            postCount += 1;
            return jsonResponse({ status: 'processing' });
          }
          return jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
    ]);

    renderApp(['/chat/72']);
    await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(screen.getByRole('combobox', { name: /传输模式选择/ }), { target: { value: 'async' } });
    fireEvent.change(screen.getByRole('textbox', { name: /消息输入框/ }), { target: { value: 'ambiguous async' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: /消息输入框/ }), { key: 'Enter' });

    await screen.findByText(/未返回有效的恢复凭据/);
    expect(postCount).toBe(1);
    expect(window.localStorage.getItem('exo:v4:chat-runtime:72')).not.toBeNull();
    expect(screen.getByRole('button', { name: /发送消息/ })).toBeDisabled();
  });

  it('keeps malformed branch success terminally locked instead of allowing a duplicate branch write', async () => {
    let branchCount = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/agents/conversations/73/', handler: () => jsonResponse(conversation(73)) },
      {
        test: '/api/agents/conversations/73/branch/',
        handler: () => {
          branchCount += 1;
          return jsonResponse({ session_id: 999, name: 'created but malformed' }, 201);
        },
      },
      {
        test: /^\/api\/agents\/chat\/73\/$/,
        handler: () => jsonResponse({ messages: [assistant(730)], total_count: 1, has_more: false }),
      },
    ]);

    renderApp(['/chat/73']);
    const trigger = await screen.findByRole('button', { name: /从该回答派生新会话/ });
    fireEvent.click(trigger);
    const confirm = await screen.findByRole('button', { name: '确认创建分支' });
    fireEvent.click(confirm);
    await screen.findByText(/缺少有效的会话编号/);

    expect(branchCount).toBe(1);
    expect(screen.getByRole('button', { name: '确认创建分支' })).toBeDisabled();
    expect(window.localStorage.getItem('exo:v4:chat-runtime:73')).not.toBeNull();
  });

  it('does not classify a malformed canonical content payload as answer text', () => {
    const malformedContent = normalizeSSEEvent('content', JSON.stringify({ injected: 'not text' }));
    expect(malformedContent.event).not.toBe('content');
  });

  it('rejects malformed polling status/event/cursor fields at the transport boundary', async () => {
    installFetch([
      {
        test: /^\/api\/agents\/chat\/74\/status\/$/,
        handler: () => jsonResponse({ status: 'future_status', events: [{}], cursor: -1 }),
      },
    ]);
    await expect(pollChatStatus(74, 'token-74', 0)).rejects.toThrow();
  });

  it('preserves the Conversation thinking level on a runtime turn', async () => {
    let postedBody: Record<string, unknown> | null = null;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/agents/conversations/75/', handler: () => jsonResponse(conversation(75)) },
      {
        test: /^\/api\/agents\/chat\/75\/$/,
        handler: async (_url, init) => {
          if (init?.method === 'POST') {
            postedBody = JSON.parse(String(init.body));
            return new Response(new ReadableStream({ start() {} }), {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          return jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    ]);

    renderApp(['/chat/75']);
    const box = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(box, { target: { value: 'preserve settings' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(postedBody).not.toBeNull());
    expect(postedBody).toMatchObject({ thinking_level: 'high' });
  });

  it('cancels the local stream reader when leaving a Conversation route without issuing stop', async () => {
    const postedSignal: { current: AbortSignal | null } = { current: null };
    let stopCount = 0;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/agents/conversations/76/', handler: () => jsonResponse(conversation(76)) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      {
        test: '/api/agents/chat/76/stop/',
        handler: () => {
          stopCount += 1;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: /^\/api\/agents\/chat\/76\/$/,
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            postedSignal.current = init.signal ?? null;
            return new Response(new ReadableStream({ start() {} }), {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          return jsonResponse({ messages: [], total_count: 0, has_more: false });
        },
      },
    ]);

    renderApp(['/chat/76']);
    const box = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(box, { target: { value: 'leave route' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(postedSignal.current).not.toBeNull());
    fireEvent.click(screen.getByRole('link', { name: /Chat Home/ }));
    await waitFor(() => expect(postedSignal.current?.aborted).toBe(true));
    expect(stopCount).toBe(0);
  });
});
