import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { installRuntimeFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

/**
 * #77: ToolCollection results are anchored as manageable attachments when the
 * turn ends, after the send-time list refresh. The manager must re-list once
 * the run settles, without re-entering the conversation.
 */

const LIST_PATH = '/api/agents/conversations/50/attachments/';

const PRESET = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const CONVERSATION = {
  id: 50,
  name: 'conv 50',
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
};

const ANCHORED_ROW = {
  source: 'user',
  id: 1011,
  display_name: 'conv_50_20261021_144220_14a37112',
  original_filename: 'conv_50_20261021_144220_14a37112.txt',
  mime_type: 'text/plain',
  file_size: 1963,
  created_at: '2026-10-21T12:42:20Z',
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  unmockFetch();
  window.localStorage.clear();
});

describe('attachment manager turn-end refresh (#77)', () => {
  it('re-lists when the run settles so an anchored tool result appears', async () => {
    let anchored = false;
    let finishTurn: () => void = () => undefined;
    const enc = new TextEncoder();
    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/50/', handler: () => jsonResponse(CONVERSATION) },
      { test: LIST_PATH, method: 'GET', handler: () => jsonResponse(anchored ? [ANCHORED_ROW] : []) },
      {
        test: '/api/agents/chat/50/',
        method: 'POST',
        handler: () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(enc.encode('event: content\ndata: 好\n\n'));
                // The turn stays open until the test lets it finish.
                finishTurn = () => {
                  controller.enqueue(enc.encode('event: done\ndata: [DONE]\n\n'));
                  controller.close();
                };
              },
            }),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          ),
      },
      {
        test: '/api/agents/chat/50/',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    const listCalls = () => calls.filter((c) => c.url.pathname === LIST_PATH).length;

    renderApp(['/chat/50']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    await waitFor(() => expect(listCalls()).toBe(1));

    fireEvent.change(textbox, { target: { value: '搜一下这个仓库' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true));
    // The send-time refresh runs before the backend anchors anything.
    await waitFor(() => expect(listCalls()).toBe(2));
    expect(screen.queryByText(/会话附件/)).toBeNull();

    anchored = true;
    finishTurn();

    expect(await screen.findByText('会话附件（1）')).toBeInTheDocument();
    expect(listCalls()).toBe(3);
  });
});
