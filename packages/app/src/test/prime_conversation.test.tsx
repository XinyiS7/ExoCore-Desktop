import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { listConversations } from '../features/chat/api';
import type { ConversationRow } from '../features/chat/types';
import {
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
} from './helpers';

const PRESET_G045 = {
  id: 1,
  name: 'Alessandro',
  description: 'Order and devotion',
  agent_type: 'g045',
  default_model: 'g-prime',
  system_prompt: 'Be rigorous.',
  is_visible: true,
};

const PRESET_STANDARD = {
  id: 5,
  name: 'Ecki',
  description: 'Standard worker',
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: 'Be brief.',
  is_visible: true,
};

function wireConv(id: number, over: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id,
    name: `会话 #${id}`,
    created_at: '2026-09-01T10:00:00Z',
    frozen_project_ids: [],
    project: 0,
    project_name: null,
    agent_type: 'g045',
    agent_preset_id: 1,
    last_message_at: null,
    thinking_level: 'auto',
    memory_injection_enabled: null,
    is_prime: false,
    ...over,
  };
}

function g045Routes(convs: ConversationRow[]): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045, PRESET_STANDARD]) },
    { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
    { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_STANDARD) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse(convs) },
    { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
  ];
}

describe('Prime Conversation Affordance (Gate 0 / CP-C, Plan §2.1 / §5.C)', () => {
  afterEach(() => unmockFetch());

  it('G045 profile renders filled star on prime conversation and hollow stars on others', async () => {
    const convs: ConversationRow[] = [
      wireConv(101, { name: '会话 Alpha', is_prime: true }),
      wireConv(102, { name: '会话 Beta', is_prime: false }),
    ];
    installFetch(g045Routes(convs));
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const primeBtn = await screen.findByRole('button', { name: '当前主会话' });
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });

    expect(primeBtn).toBeInTheDocument();
    expect(setPrimeBtn).toBeInTheDocument();
    expect(primeBtn.classList.contains('prime-star-btn--active')).toBe(true);
    expect(setPrimeBtn.classList.contains('prime-star-btn--active')).toBe(false);

    // Exactly one active prime star
    expect(screen.getAllByRole('button', { name: '当前主会话' })).toHaveLength(1);
  });

  it('Standard tier Agent Profile does not display any prime star buttons', async () => {
    const convs: ConversationRow[] = [
      wireConv(501, { agent_preset_id: 5, agent_type: 'standard', name: 'Standard Conv', is_prime: false }),
    ];
    installFetch(g045Routes(convs));
    renderApp(['/agents/5']);

    await screen.findByText('Ecki');
    await screen.findByText('Standard Conv');
    expect(screen.queryByRole('button', { name: '当前主会话' })).toBeNull();
    expect(screen.queryByRole('button', { name: '设为主会话' })).toBeNull();
  });

  it('clicking active star sends zero requests and does not open confirmation dialog', async () => {
    const convs: ConversationRow[] = [
      wireConv(101, { is_prime: true }),
      wireConv(102, { is_prime: false }),
    ];
    const { calls } = installFetch(g045Routes(convs));
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const initialCallCount = calls.length;

    const primeBtn = await screen.findByRole('button', { name: '当前主会话' });
    fireEvent.click(primeBtn);

    // No dialog opened
    expect(screen.queryByRole('dialog')).toBeNull();
    // 0 new network requests
    expect(calls.length).toBe(initialCallCount);
  });

  it('clicking hollow star opens confirm dialog; Cancel closes with zero write requests', async () => {
    const convs: ConversationRow[] = [
      wireConv(101, { name: '旧会话', is_prime: true }),
      wireConv(102, { name: '新会话', is_prime: false }),
    ];
    const { calls } = installFetch(g045Routes(convs));
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
    fireEvent.click(setPrimeBtn);

    // Dialog opens with exact copy from Plan §2.1
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent('将「新会话」设为主会话？');
    expect(within(dialog).getByText('阿莱之后主动发送的消息会进入这个会话。')).toBeInTheDocument();

    const initialWriteCalls = calls.filter((c) => c.init?.method === 'PATCH' || c.init?.method === 'POST');

    // Clicking 取消
    const cancelBtn = within(dialog).getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).toBeNull();
    const finalWriteCalls = calls.filter((c) => c.init?.method === 'PATCH' || c.init?.method === 'POST');
    expect(finalWriteCalls.length).toBe(initialWriteCalls.length);
  });

  it('confirming transfers Prime atomically via PATCH { is_prime: true } and updates UI', async () => {
    let conv101Prime = true;
    let conv102Prime = false;

    const routes: MockRoute[] = [
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          jsonResponse([
            wireConv(101, { name: '会话 101', is_prime: conv101Prime }),
            wireConv(102, { name: '会话 102', is_prime: conv102Prime }),
          ]),
      },
      {
        test: '/api/agents/conversations/102/',
        method: 'PATCH',
        handler: (_url, init) => {
          const body = JSON.parse(String(init?.body));
          expect(body).toEqual({ is_prime: true });
          conv101Prime = false;
          conv102Prime = true;
          return jsonResponse(wireConv(102, { name: '会话 102', is_prime: true }));
        },
      },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];

    const { calls } = installFetch(routes);
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
    fireEvent.click(setPrimeBtn);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: '设为主会话' });
    fireEvent.click(confirmBtn);

    // Dialog closes on success
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // PATCH was issued to /api/agents/conversations/102/
    const patchCalls = calls.filter(
      (c) => c.url.pathname === '/api/agents/conversations/102/' && c.init?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(1);

    // Verified refreshed UI: Conv 102 is now prime, conv 101 is non-prime
    await waitFor(() => {
      const activeStars = screen.getAllByRole('button', { name: '当前主会话' });
      expect(activeStars).toHaveLength(1);
    });

    const rows = screen.getByRole('list', { name: '该 Agent 的会话' });
    const row102 = within(rows).getByRole('link', { name: /会话 102/ }).closest('li')!;
    expect(within(row102).getByRole('button', { name: '当前主会话' })).toBeInTheDocument();
  });

  it('PATCH error displays message and keeps dialog open for retry or cancellation', async () => {
    const routes: MockRoute[] = [
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          jsonResponse([
            wireConv(101, { name: '会话 101', is_prime: true }),
            wireConv(102, { name: '会话 102', is_prime: false }),
          ]),
      },
      {
        test: '/api/agents/conversations/102/',
        method: 'PATCH',
        handler: () =>
          jsonResponse({ is_prime: ['非 G045 预设不允许设置主会话'] }, 400),
      },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];

    installFetch(routes);
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
    fireEvent.click(setPrimeBtn);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: '设为主会话' });
    fireEvent.click(confirmBtn);

    // Displays backend error message
    await within(dialog).findByText('非 G045 预设不允许设置主会话');
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();

    // Dialog stays open and confirm button is enabled for retry
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '设为主会话' })).not.toBeDisabled();

    // User can cancel cleanly
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ambiguous write: when network error occurs but GET reveals target is prime, dialog closes cleanly', async () => {
    let conv101Prime = true;
    let conv102Prime = false;

    const routes: MockRoute[] = [
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          jsonResponse([
            wireConv(101, { name: '会话 101', is_prime: conv101Prime }),
            wireConv(102, { name: '会话 102', is_prime: conv102Prime }),
          ]),
      },
      {
        test: '/api/agents/conversations/102/',
        method: 'PATCH',
        handler: () => {
          // Backend applied the change, but network dropped on response
          conv101Prime = false;
          conv102Prime = true;
          throw new TypeError('Network connection lost');
        },
      },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];

    installFetch(routes);
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
    fireEvent.click(setPrimeBtn);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: '设为主会话' });
    fireEvent.click(confirmBtn);

    // Reconciliation reconciles target as prime and closes dialog cleanly!
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Conv 102 is now prime in UI
    expect(await screen.findByRole('button', { name: '当前主会话' })).toBeInTheDocument();
  });

  it('ambiguous write: when GET reveals target is NOT prime, shows error and allows retry', async () => {
    const routes: MockRoute[] = [
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          jsonResponse([
            wireConv(101, { name: '会话 101', is_prime: true }),
            wireConv(102, { name: '会话 102', is_prime: false }),
          ]),
      },
      {
        test: '/api/agents/conversations/102/',
        method: 'PATCH',
        handler: () => {
          throw new TypeError('Network connection lost');
        },
      },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];

    installFetch(routes);
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
    fireEvent.click(setPrimeBtn);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: '设为主会话' });
    fireEvent.click(confirmBtn);

    // Error banner shown, dialog stays open, retry is enabled
    await within(dialog).findByText('主会话设置未生效，请重新确认。');
    expect(within(dialog).getByRole('button', { name: '设为主会话' })).not.toBeDisabled();
  });

  it('ambiguous write + GET failure: locks dismissal and provides 重新核对会话 button', async () => {
    let getFail = false;
    const routes: MockRoute[] = [
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          getFail
            ? Promise.reject(new TypeError('GET failed'))
            : jsonResponse([
                wireConv(101, { name: '会话 101', is_prime: true }),
                wireConv(102, { name: '会话 102', is_prime: false }),
              ]),
      },
      {
        test: '/api/agents/conversations/102/',
        method: 'PATCH',
        handler: () => {
          getFail = true;
          throw new TypeError('Network connection lost');
        },
      },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];

    installFetch(routes);
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
    fireEvent.click(setPrimeBtn);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '设为主会话' }));

    // Unresolved state: dismissal locked
    await within(dialog).findByText(/主会话已提交，但结果无法确认/);
    expect(within(dialog).getByRole('button', { name: '关闭' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeDisabled();

    const recheckBtn = within(dialog).getByRole('button', { name: '重新核对会话' });
    expect(recheckBtn).not.toBeDisabled();
  });

  it('delete current Prime conversation returns 409 and displays warning banner without deletion', async () => {
    const routes: MockRoute[] = [
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          jsonResponse([
            wireConv(101, { name: '主会话 101', is_prime: true }),
            wireConv(102, { name: '普通会话 102', is_prime: false }),
          ]),
      },
      {
        test: '/api/agents/conversations/101/',
        method: 'DELETE',
        handler: () =>
          jsonResponse(
            {
              code: 'conversation_prime_transfer_required',
              error: '当前会话为主会话，不能直接删除。请先将其他会话设为主会话后再删除。',
            },
            409,
          ),
      },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];

    installFetch(routes);
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const rows = screen.getByRole('list', { name: '该 Agent 的会话' });
    const row101 = within(rows).getByRole('link', { name: /主会话 101/ }).closest('li')!;

    // Open row menu on conv 101 and click 删除会话
    const menuTrigger = within(row101).getByRole('button', { name: /会话操作/ });
    fireEvent.click(menuTrigger);
    const deleteItem = await screen.findByRole('menuitem', { name: '删除会话' });
    fireEvent.click(deleteItem);

    // In delete dialog, click 确认删除
    const deleteDialog = await screen.findByRole('dialog');
    const confirmDeleteBtn = within(deleteDialog).getByRole('button', { name: '确认删除' });
    fireEvent.click(confirmDeleteBtn);

    // Warning banner appears stating prime cannot be deleted
    await within(deleteDialog).findByText('当前主会话不可删除。若需删除，请先将其他会话设为主会话。');
    expect(confirmDeleteBtn).toBeDisabled();

    // Conv 101 is NOT removed from list
    fireEvent.click(within(deleteDialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: /主会话 101/ })).toBeInTheDocument();
  });

  it('dialog a11y: Escape and backdrop click close dialog when not locked', async () => {
    const convs: ConversationRow[] = [
      wireConv(101, { name: '会话 Alpha', is_prime: true }),
      wireConv(102, { name: '会话 Beta', is_prime: false }),
    ];
    installFetch(g045Routes(convs));
    renderApp(['/agents/1']);

    await screen.findByText('Alessandro');
    const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
    setPrimeBtn.focus();
    fireEvent.click(setPrimeBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Escape closes dialog
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Reopen and test backdrop click
    fireEvent.click(screen.getByRole('button', { name: '设为主会话' }));
    const dialogAgain = await screen.findByRole('dialog');
    const overlay = dialogAgain.closest('.app-overlay')!;
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  describe('CPC-R1-F01: Strict list contract on is_prime', () => {
    it('listConversations rejects non-boolean is_prime values with CONTRACT error code', async () => {
      const invalidValues = ['false', 'true', null, undefined, 0, 1, {}];

      for (const invalid of invalidValues) {
        const rawRow: Record<string, unknown> = {
          id: 99,
          name: 'Test Conv',
          created_at: '2026-09-01T10:00:00Z',
          frozen_project_ids: [],
          project: 0,
          project_name: null,
          agent_type: 'g045',
          agent_preset_id: 1,
          last_message_at: null,
          thinking_level: 'auto',
          memory_injection_enabled: null,
        };
        if (invalid !== undefined) {
          rawRow.is_prime = invalid;
        }

        installFetch([
          { test: '/api/agents/conversations/', handler: () => jsonResponse([rawRow]) },
        ]);

        await expect(listConversations()).rejects.toMatchObject({
          code: 'CONTRACT',
          message: '会话数据缺少有效的主会话标记',
        });
        unmockFetch();
      }
    });

    it('malformed is_prime in conversations causes Agent Profile to render load error and 0 stars', async () => {
      const malformedConvs = [
        {
          id: 101,
          name: 'Off-contract Conv',
          created_at: '2026-09-01T10:00:00Z',
          frozen_project_ids: [],
          project: 0,
          project_name: null,
          agent_type: 'g045',
          agent_preset_id: 1,
          last_message_at: null,
          thinking_level: 'auto',
          memory_injection_enabled: null,
          is_prime: 'false', // Off-contract string instead of boolean
        },
      ];

      installFetch([
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        { test: '/api/agents/conversations/', handler: () => jsonResponse(malformedConvs) },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ]);

      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      // Must show error state
      await screen.findByText('会话加载失败');
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();

      // Zero misleading prime stars rendered
      expect(screen.queryByRole('button', { name: '当前主会话' })).toBeNull();
      expect(screen.queryByRole('button', { name: '设为主会话' })).toBeNull();
    });
  });

  describe('CPC-R1-F02: HTTP 5xx & ambiguous write handling on Prime PATCH', () => {
    it('HTTP 500 on PATCH where canonical GET reveals target is prime: closes dialog and updates UI', async () => {
      let conv101Prime = true;
      let conv102Prime = false;
      let patchCount = 0;

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        {
          test: '/api/agents/conversations/',
          handler: () =>
            jsonResponse([
              wireConv(101, { name: '会话 101', is_prime: conv101Prime }),
              wireConv(102, { name: '会话 102', is_prime: conv102Prime }),
            ]),
        },
        {
          test: '/api/agents/conversations/102/',
          method: 'PATCH',
          handler: () => {
            patchCount++;
            // Server committed the transaction in DB, but threw 500 before response
            conv101Prime = false;
            conv102Prime = true;
            return jsonResponse({ error: 'Internal Server Error' }, 500);
          },
        },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ];

      installFetch(routes);
      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
      fireEvent.click(setPrimeBtn);

      const dialog = await screen.findByRole('dialog');
      const confirmBtn = within(dialog).getByRole('button', { name: '设为主会话' });
      fireEvent.click(confirmBtn);

      // Reconciles commit via canonical GET and closes dialog cleanly
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(patchCount).toBe(1);

      // Conv 102 is now prime in UI
      await waitFor(() => {
        const rows = screen.getByRole('list', { name: '该 Agent 的会话' });
        const row102 = within(rows).getByRole('link', { name: /会话 102/ }).closest('li')!;
        expect(within(row102).getByRole('button', { name: '当前主会话' })).toBeInTheDocument();
      });
    });

    it('HTTP 500 on PATCH where target is NOT prime: unlocks safe retry without blind second PATCH', async () => {
      let patchCount = 0;

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        {
          test: '/api/agents/conversations/',
          handler: () =>
            jsonResponse([
              wireConv(101, { name: '会话 101', is_prime: true }),
              wireConv(102, { name: '会话 102', is_prime: false }),
            ]),
        },
        {
          test: '/api/agents/conversations/102/',
          method: 'PATCH',
          handler: () => {
            patchCount++;
            return jsonResponse({ error: 'DB Connection Timeout' }, 504);
          },
        },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ];

      installFetch(routes);
      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
      fireEvent.click(setPrimeBtn);

      const dialog = await screen.findByRole('dialog');
      const confirmBtn = within(dialog).getByRole('button', { name: '设为主会话' });
      fireEvent.click(confirmBtn);

      // Ambiguous write reconciled, target was NOT prime -> error banner shown
      await within(dialog).findByText('主会话设置未生效，请重新确认。');
      // No blind second PATCH was issued
      expect(patchCount).toBe(1);

      // Safe retry is enabled
      const retryBtn = within(dialog).getByRole('button', { name: '设为主会话' });
      expect(retryBtn).not.toBeDisabled();

      // User can also cancel cleanly
      const cancelBtn = within(dialog).getByRole('button', { name: '取消' });
      expect(cancelBtn).not.toBeDisabled();
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('HTTP 502 on PATCH + GET failure: locks dismissal and offers 重新核对会话 only', async () => {
      let getFail = false;
      let patchCount = 0;

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        {
          test: '/api/agents/conversations/',
          handler: () =>
            getFail
              ? jsonResponse({ error: 'Service Unavailable' }, 503)
              : jsonResponse([
                  wireConv(101, { name: '会话 101', is_prime: true }),
                  wireConv(102, { name: '会话 102', is_prime: false }),
                ]),
        },
        {
          test: '/api/agents/conversations/102/',
          method: 'PATCH',
          handler: () => {
            patchCount++;
            getFail = true;
            return jsonResponse({ error: 'Bad Gateway' }, 502);
          },
        },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ];

      installFetch(routes);
      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
      fireEvent.click(setPrimeBtn);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: '设为主会话' }));

      // Unresolved reconciliation: dismissal locked
      await within(dialog).findByText(/主会话已提交，但结果无法确认/);
      expect(within(dialog).getByRole('button', { name: '关闭' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: '取消' })).toBeDisabled();

      // Exactly one recheck action, no second PATCH
      expect(patchCount).toBe(1);
      const recheckBtn = within(dialog).getByRole('button', { name: '重新核对会话' });
      expect(recheckBtn).not.toBeDisabled();
    });

    it('malformed successful PATCH response is treated as ambiguous write and reconciles', async () => {
      let conv101Prime = true;
      let conv102Prime = false;

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        {
          test: '/api/agents/conversations/',
          handler: () =>
            jsonResponse([
              wireConv(101, { name: '会话 101', is_prime: conv101Prime }),
              wireConv(102, { name: '会话 102', is_prime: conv102Prime }),
            ]),
        },
        {
          test: '/api/agents/conversations/102/',
          method: 'PATCH',
          handler: () => {
            conv101Prime = false;
            conv102Prime = true;
            // 200 OK but malformed body (missing boolean is_prime)
            return jsonResponse({ id: 102, is_prime: 'not_a_boolean' });
          },
        },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ];

      installFetch(routes);
      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
      fireEvent.click(setPrimeBtn);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: '设为主会话' }));

      // Contract error on PATCH response treated as ambiguous write -> reconciles successfully
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => {
        const rows = screen.getByRole('list', { name: '该 Agent 的会话' });
        const row102 = within(rows).getByRole('link', { name: /会话 102/ }).closest('li')!;
        expect(within(row102).getByRole('button', { name: '当前主会话' })).toBeInTheDocument();
      });
    });
  });

  describe('CPC-R2-F03: Non-object & null list rows reject via CONTRACT error without leaking TypeError', () => {
    it('listConversations rejects null, arrays, and primitive rows as CONTRACT error', async () => {
      const invalidPayloads: unknown[][] = [
        [null],
        [wireConv(101), null], // valid row followed by null
        [[1, 2, 3]],
        ['primitive-string'],
        [42],
        [false],
      ];

      for (const payload of invalidPayloads) {
        installFetch([
          { test: '/api/agents/conversations/', handler: () => jsonResponse(payload) },
        ]);

        let caughtErr: unknown = null;
        try {
          await listConversations();
        } catch (e) {
          caughtErr = e;
        }

        expect(caughtErr).not.toBeNull();
        expect(caughtErr).not.toBeInstanceOf(TypeError);
        expect(caughtErr).toMatchObject({
          code: 'CONTRACT',
        });
        unmockFetch();
      }
    });

    it('list containing null renders ErrorState on Agent Profile without throwing TypeError', async () => {
      installFetch([
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        { test: '/api/agents/conversations/', handler: () => jsonResponse([wireConv(101), null]) },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ]);

      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      await screen.findByText('会话加载失败');
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '当前主会话' })).toBeNull();
      expect(screen.queryByRole('button', { name: '设为主会话' })).toBeNull();
    });
  });

  describe('CPC-R2-F04: Mismatched PATCH response ID treated as ambiguous write', () => {
    it('PATCH returning mismatched conversation id reconciles and closes if target is Prime in canonical GET', async () => {
      let patchCount = 0;
      let conv102IsPrime = false;

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        {
          test: '/api/agents/conversations/',
          handler: () =>
            jsonResponse([
              wireConv(101, { name: '会话 101', is_prime: !conv102IsPrime }),
              wireConv(102, { name: '会话 102', is_prime: conv102IsPrime }),
            ]),
        },
        {
          test: '/api/agents/conversations/102/',
          method: 'PATCH',
          handler: () => {
            patchCount++;
            // Server transferred prime to 102 in DB, but returned row for 103
            conv102IsPrime = true;
            return jsonResponse({
              id: 103, // Mismatched ID!
              name: '会话 103',
              is_prime: true,
            });
          },
        },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ];

      installFetch(routes);
      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
      fireEvent.click(setPrimeBtn);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: '设为主会话' }));

      // Reconciles via canonical list: 102 is prime -> closes dialog cleanly!
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(patchCount).toBe(1);

      await waitFor(() => {
        const rows = screen.getByRole('list', { name: '该 Agent 的会话' });
        const row102 = within(rows).getByRole('link', { name: /会话 102/ }).closest('li')!;
        expect(within(row102).getByRole('button', { name: '当前主会话' })).toBeInTheDocument();
      });
    });

    it('PATCH returning mismatched conversation id exposes safe retry if target is not Prime in canonical GET', async () => {
      let patchCount = 0;

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
        { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_G045) },
        {
          test: '/api/agents/conversations/',
          handler: () =>
            jsonResponse([
              wireConv(101, { name: '会话 101', is_prime: true }),
              wireConv(102, { name: '会话 102', is_prime: false }),
            ]),
        },
        {
          test: '/api/agents/conversations/102/',
          method: 'PATCH',
          handler: () => {
            patchCount++;
            return jsonResponse({
              id: 999, // Mismatched ID!
              name: '会话 999',
              is_prime: true,
            });
          },
        },
        { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      ];

      installFetch(routes);
      renderApp(['/agents/1']);

      await screen.findByText('Alessandro');
      const setPrimeBtn = await screen.findByRole('button', { name: '设为主会话' });
      fireEvent.click(setPrimeBtn);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: '设为主会话' }));

      // Ambiguous write reconciled: target is NOT prime -> safe retry unlocked, banner shown
      await within(dialog).findByText('主会话设置未生效，请重新确认。');
      expect(patchCount).toBe(1); // No blind second PATCH

      const retryBtn = within(dialog).getByRole('button', { name: '设为主会话' });
      expect(retryBtn).not.toBeDisabled();
    });
  });
});

