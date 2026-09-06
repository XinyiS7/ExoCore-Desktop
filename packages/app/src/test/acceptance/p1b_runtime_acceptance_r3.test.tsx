import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetch, jsonResponse, renderApp, unmockFetch } from '../helpers';

const conversation = {
  id: 76,
  name: 'Conversation 76',
  created_at: '2026-09-03T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 3,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
};

const emptyPage = { messages: [], total_count: 0, has_more: false, limit: 50, offset: 0 };
const assistantPage = {
  messages: [
    {
      id: 501,
      role: 'assistant',
      content: 'persisted answer',
      reasoning_content: null,
      platform: 'test',
      model_version: 'test',
      token_count: null,
      index_in_session: 0,
      attachment_ids: [],
      attachments_meta: [],
      created_at: '2026-09-03T10:00:00Z',
    },
  ],
  total_count: 1,
  has_more: false,
  limit: 50,
  offset: 0,
};

function base(messages: unknown = emptyPage) {
  return [
    { test: '/api/agents/conversations/76/', handler: () => jsonResponse(conversation) },
    { test: '/api/agents/chat/76/', method: 'GET', handler: () => jsonResponse(messages) },
    { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
  ];
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  unmockFetch();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('C1B R3 independent acceptance — storage transition closure', () => {
  it('does not leave an invalid active async lease when token persistence fails', async () => {
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'exo:v4:chat-runtime:76' && value.includes('"asyncToken"')) {
        throw new DOMException('blocked', 'QuotaExceededError');
      }
      return originalSet.call(this, key, value);
    });

    installFetch([
      ...base(),
      {
        test: '/api/agents/chat/76/',
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'abc12345', status: 'processing' }),
      },
      {
        test: '/api/agents/chat/76/status/',
        method: 'GET',
        handler: () => new Promise<Response>(() => {}),
      },
    ]);

    renderApp(['/chat/76']);
    const box = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(box, { target: { value: 'persist token safely' } });
    fireEvent.change(screen.getByRole('combobox', { name: '传输模式选择' }), {
      target: { value: 'async' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/存储|凭据|恢复/));
    const raw = window.localStorage.getItem('exo:v4:chat-runtime:76');
    expect(raw).not.toBeNull();
    const lease = JSON.parse(raw as string) as { disposition?: string; asyncToken?: string };
    expect(lease.disposition === 'active' && !lease.asyncToken).toBe(false);
    expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument();
  });

  it('does not use an acknowledgement action to unlock a still-active stream after draft cleanup fails', async () => {
    const originalRemove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === 'exo:v4:chat-draft:76') throw new DOMException('blocked', 'QuotaExceededError');
      return originalRemove.call(this, key);
    });

    installFetch([
      ...base(),
      {
        test: '/api/agents/chat/76/',
        method: 'POST',
        handler: () =>
          new Response(new ReadableStream({ start() {} }), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      },
    ]);

    renderApp(['/chat/76']);
    const box = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(box, { target: { value: 'active stream' } });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    // R4 formal authority separates draft-only cleanup from operation storage
    // recovery. Exercise that exact ancillary action and prove it cannot unlock
    // or clear the live runtime marker.
    const retry = await screen.findByRole('button', { name: /重试清理草稿/ });
    expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument());
    expect(window.localStorage.getItem('exo:v4:chat-runtime:76')).not.toBeNull();
  });

  it('keeps a safe-rejection branch locked when its durable marker cannot be cleared', async () => {
    const originalRemove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === 'exo:v4:chat-runtime:76') throw new DOMException('blocked', 'QuotaExceededError');
      return originalRemove.call(this, key);
    });
    const { calls } = installFetch([
      ...base(assistantPage),
      {
        test: '/api/agents/conversations/76/branch/',
        method: 'POST',
        handler: () => jsonResponse({ code: 'invalid_branch', error: 'cannot branch' }, 400),
      },
    ]);

    renderApp(['/chat/76']);
    const branchAction = await screen.findByRole('button', { name: '从该回答派生新会话' });
    fireEvent.click(branchAction);
    const confirm = await screen.findByRole('button', { name: '确认创建分支' });
    fireEvent.click(confirm);
    // R4 may project the same clear-blocked fact in both the operation banner
    // and modal; wait for either/both without making cardinality the contract.
    expect((await screen.findAllByText(/cannot branch|清理失败/)).length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: '确认创建分支' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '确认创建分支' }));
    expect(calls.filter((call) => call.url.pathname.endsWith('/branch/'))).toHaveLength(1);
  });
});
