import { afterEach, describe, expect, it } from 'vitest';
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

afterEach(() => unmockFetch());

function modalRoutes(conversationId: number) {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
    { test: `/api/agents/conversations/${conversationId}/`, handler: () => jsonResponse(convRow(conversationId)) },
    {
      test: /^\/api\/agents\/chat\/\d+\/$/,
      handler: () =>
        jsonResponse({
          messages: [
            mkMsg(1001, 'user', '问题甲', 0),
            mkMsg(1002, 'assistant', '回答甲（可以分支）', 1),
          ],
          total_count: 2,
          has_more: false,
        }),
    },
  ];
}

describe('C1B-R1-06 — real modal a11y (focus, Escape, containment)', () => {
  it('branch modal: opening moves focus inside, Tab stays contained, Escape closes and restores trigger focus', async () => {
    installFetch(modalRoutes(91));
    renderApp(['/chat/91']);

    const branchBtn = (await screen.findAllByRole('button', { name: /从该回答派生新会话/ }))[0];
    branchBtn.focus();
    fireEvent.click(branchBtn);

    const dialog = await screen.findByRole('dialog', { name: '创建独立对话分支' });
    await waitFor(() => {
      // Initial focus lands inside the dialog.
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    // Tab cycles only inside the dialog (last -> first wrap).
    const cancel = screen.getByRole('button', { name: '取消' });
    const confirm = screen.getByRole('button', { name: '确认创建分支' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect([cancel, confirm]).toContain(document.activeElement);

    // Escape closes the dialog.
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '创建独立对话分支' })).toBeNull();
    });
    expect(document.activeElement).toBe(branchBtn);
  });

  it('truncation modal: Escape closes and returns focus', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/92/', handler: () => jsonResponse(convRow(92)) },
      {
        test: /^\/api\/agents\/chat\/\d+\/$/,
        handler: () =>
          jsonResponse({
            messages: [
              mkMsg(1001, 'user', '问题甲', 0),
              mkMsg(1002, 'assistant', '回答甲', 1),
              mkMsg(1003, 'user', '问题乙（最新用户）', 2),
            ],
            total_count: 3,
            has_more: false,
          }),
      },
    ]);
    renderApp(['/chat/92']);

    const editBtns = await screen.findAllByRole('button', { name: /编辑此条消息/ });
    // First user message is historical -> truncation confirmation modal.
    const editBtn = editBtns[0];
    editBtn.focus();
    fireEvent.click(editBtn);

    const dialog = await screen.findByRole('dialog', { name: /确认截断后续对话/ });
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /确认截断后续对话/ })).toBeNull();
    });
    expect(document.activeElement).toBe(editBtn);
  });
});
