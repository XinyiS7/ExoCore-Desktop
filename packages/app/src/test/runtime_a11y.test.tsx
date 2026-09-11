import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCallback, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BranchConfirmModal } from '../features/chat/BranchConfirmModal';
import { TruncateConfirmModal } from '../features/chat/TruncateConfirmModal';
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

// ── R5: shared-helper consumer regressions ─────────────────────────────────
// The corrected helper no longer re-enters its focus effect on lock flips;
// these cases cover (a) the authorized caller-local lock anchor and (b) the
// pre-existing callback-identity rerender behavior of the inline-onClose
// consumers (Branch/Truncate here; TacticalHud and ProjectFilesDrawer have
// their own runner cases in p1d_hud / p1d_project_drawer test files).
// NOTE: jsdom does not model Chromium's native focus-drop from a disabled
// control — the lock case asserts the ANCHOR behavior, not the native drop.

describe('R5 — helper consumers: lock transition and callback-identity rerenders', () => {
  function BranchLockHarness({ onConfirm }: { onConfirm: () => Promise<void> }) {
    const [locked, setLocked] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    // STABLE onClose: isolates the lock anchor from callback-rerender effects.
    const onClose = useCallback(() => setIsOpen(false), []);
    return (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>
          open branch
        </button>
        <button type="button" onClick={() => setLocked(true)}>
          engage lock
        </button>
        <button type="button" onClick={() => setLocked(false)}>
          release lock
        </button>
        {isOpen ? (
          <BranchConfirmModal
            isOpen
            targetMessage={{ id: 7, snippet: '一段历史回答' }}
            locked={locked}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        ) : null}
      </>
    );
  }

  it('branch lock transition: focus anchors on the enabled cancel control; live Escape policy; no duplicate submit; release restores the trigger', async () => {
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    render(<BranchLockHarness onConfirm={onConfirm} />);

    const trigger = screen.getByRole('button', { name: 'open branch' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '创建独立对话分支' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    const cancel = screen.getByRole('button', { name: '取消' });
    const confirm = screen.getByRole('button', { name: '确认创建分支' });
    confirm.focus();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // lock engages -> the modal's own anchor moves focus to the enabled cancel
    fireEvent.click(screen.getByRole('button', { name: 'engage lock' }));
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(dialog.contains(document.activeElement)).toBe(true);

    // live Escape policy: suppressed while locked, dialog stays open
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '创建独立对话分支' })).toBeTruthy();
    // duplicate-submit policy: a locked confirm cannot fire again
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // release -> Escape closes and focus returns to the invoking trigger
    fireEvent.click(screen.getByRole('button', { name: 'release lock' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '创建独立对话分支' })).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  function RerenderHarness({ kind }: { kind: 'branch' | 'truncate' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [tick, setTick] = useState(0);
    const [closes, setCloses] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>
          open {kind}
        </button>
        <button type="button" onClick={() => setTick((t) => t + 1)}>
          bump {tick}
        </button>
        <span data-testid="closes">{closes}</span>
        {isOpen && kind === 'branch' ? (
          // INLINE onClose — the real ConversationPage consumer shape: every
          // parent rerender hands the helper a NEW callback identity.
          <BranchConfirmModal
            isOpen
            targetMessage={{ id: 7, snippet: '一段历史回答' }}
            locked={false}
            onConfirm={() => Promise.resolve()}
            onClose={() => {
              setCloses((c) => c + 1);
              setIsOpen(false);
            }}
          />
        ) : null}
        {isOpen && kind === 'truncate' ? (
          <TruncateConfirmModal
            isOpen
            targetMessageId={7}
            actionType="edit"
            onConfirm={() => undefined}
            onClose={() => {
              setCloses((c) => c + 1);
              setIsOpen(false);
            }}
          />
        ) : null}
      </>
    );
  }

  it.each([['branch'], ['truncate']] as const)(
    '%s modal: callback-identity rerenders keep focus contained; Escape still closes; trigger restored',
    async (kind) => {
      render(<RerenderHarness kind={kind} />);
      const trigger = screen.getByRole('button', { name: `open ${kind}` });
      trigger.focus();
      fireEvent.click(trigger);
      const dialogName = kind === 'branch' ? '创建独立对话分支' : /确认截断后续对话/;
      const dialog = await screen.findByRole('dialog', { name: dialogName });
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

      // parent rerenders (new inline onClose identity) — containment holds
      fireEvent.click(screen.getByRole('button', { name: /bump/ }));
      fireEvent.click(screen.getByRole('button', { name: /bump/ }));
      expect(screen.getByRole('dialog', { name: dialogName })).toBeTruthy();
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Escape remains functional (no lock in this shape) and restores the trigger
      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: dialogName })).toBeNull();
      });
      expect(screen.getByTestId('closes').textContent).toBe('1');
      expect(document.activeElement).toBe(trigger);
    },
  );
});
