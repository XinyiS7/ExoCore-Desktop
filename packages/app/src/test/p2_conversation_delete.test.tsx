import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { deleteConversation } from '../features/chat/chatDelete';
import { ConversationDeleteConfirmDialog } from '../features/chat/ConversationDeleteConfirmDialog';
import { ConversationDeleteMenu } from '../features/chat/ConversationDeleteMenu';
import {
  deleteBusyReason,
  deriveDeleteDisplay,
  retireConversationCaches,
} from '../features/chat/chatDeleteUi';
import { queryKeys } from '../features/chat/queries';
import { RecentConversationList } from '../features/chat/RecentConversationList';
import { persistRuntimeLease } from '../features/chat/runtime/storage';

const deletedIds = new Set<number>();

/**
 * V4 single-conversation delete — construction tests (T1).
 *
 * Self-contained by design (no test/helpers.tsx): exercises the frozen
 * backend contract (204/400-protected/404-absent/409-busy/500-fail-closed/
 * network-ambiguous), the busy lease gate, identity-bound settlement, cache
 * retirement scope, and the three list entrances with isolated mocked HTTP.
 */

let fetchMock: ReturnType<typeof vi.fn>;

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(ui: React.ReactElement, client = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const PRESET = { id: 11, name: 'Alessandro', is_visible: true, model: 'gpt', avatar: null };

const CONVO_ROWS = [
  {
    id: 101,
    name: 'Alpha 会话',
    project: null,
    project_name: null,
    agent_preset_id: 11,
    agent_type: 'g045',
    temperature: 1.0,
    thinking_level: 'medium',
    frozen_project_ids: [],
    created_at: '2026-08-01T00:00:00Z',
    last_message_at: '2026-08-02T00:00:00Z',
  },
  {
    id: 102,
    name: 'Beta 会话',
    project: 7,
    project_name: 'P7',
    agent_preset_id: 11,
    agent_type: 'g045',
    temperature: 1.0,
    thinking_level: 'medium',
    frozen_project_ids: [],
    created_at: '2026-08-01T00:00:00Z',
    last_message_at: null,
  },
];

function begin(requests: { url: string; init?: RequestInit }[]) {
  deletedIds.clear();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    requests.push({ url, init });
    if (url.includes('/api/agents/conversations/') && method === 'DELETE') {
      const code = new URL(url, window.location.origin).pathname.match(/\/(\d+)\/$/)?.[1];
      const id = Number(code);
      deletedIds.add(id);
      // Deterministic per-id behavior: 101 -> 204 (confirmed), 102 -> 204, 103 -> 409, 104 -> 400, 105 -> 500
      if (id === 101) return new Response(null, { status: 204 });
      if (id === 102) return new Response(null, { status: 204 });
      if (id === 103) return json({ code: 'conversation_busy', message: 'busy' }, 409);
      if (id === 104) return json({ code: 'conversation_protected', message: 'protected' }, 400);
      if (id === 105) return json({ code: 'safety_check_failed', message: 'safety' }, 500);
      if (id === 106) return Response.error(); // network failure -> TypeError
      if (id === 107) return json({ message: 'no code' }, 404); // 404 WITHOUT code -> ambiguous
      return json({ code: 'conversation_not_found', message: 'absent' }, 404);
    }
    if (url.includes('/api/agents/conversations/')) {
      return json(CONVO_ROWS.filter((r) => !deletedIds.has(r.id)), 200);
    }
    if (url.includes('/api/agents/presets/')) return json([PRESET], 200);
    return json({ error: 'unexpected' }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('deleteConversation adapter — frozen contract classification', () => {
  it('204 maps to confirmed (no attempt at body parsing)', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const attempt = await deleteConversation(101);
    expect(attempt.outcome).toEqual({ kind: 'confirmed' });
    expect(reqs.some((r) => r.url.includes('/api/agents/conversations/101/'))).toBe(true);
  });

  it('404 with conversation_not_found maps to absent', async () => {
    begin([]);
    const attempt = await deleteConversation(999);
    expect(attempt.outcome).toEqual({ kind: 'absent' });
  });

  it('409 with conversation_busy maps to busy', async () => {
    begin([]);
    const attempt = await deleteConversation(103);
    expect(attempt.outcome).toEqual({ kind: 'busy' });
  });

  it('400 with conversation_protected maps to protected', async () => {
    begin([]);
    const attempt = await deleteConversation(104);
    expect(attempt.outcome).toEqual({ kind: 'protected' });
  });

  it('500 with safety_check_failed maps to safety_failed (fail-closed, never ambiguous)', async () => {
    begin([]);
    const attempt = await deleteConversation(105);
    expect(attempt.outcome).toEqual({ kind: 'safety_failed' });
  });

  it('network failure maps to ambiguous (not a settled verdict)', async () => {
    begin([]);
    const attempt = await deleteConversation(106);
    expect(attempt.outcome).toEqual({ kind: 'ambiguous' });
  });

  it('missing error code on non-2xx maps to ambiguous', async () => {
    begin([]);
    const attempt = await deleteConversation(107); // 404 but no code -> ambiguous
    expect(attempt.outcome).toEqual({ kind: 'ambiguous' });
  });
});

describe('deriveDeleteDisplay — pure UI copy mapping', () => {
  it('confirmed copy is irreversible and distinct from archive', () => {
    const d = deriveDeleteDisplay({ kind: 'confirmed' });
    expect(d.verdict).toBe('success');
    expect(d.message).toContain('永久删除');
  });

  it('absent reconciles as already-gone, never as "this attempt succeeded"', () => {
    const d = deriveDeleteDisplay({ kind: 'absent' });
    expect(d.verdict).toBe('absent');
    expect(d.message).toContain('已不存在');
  });

  it('protected explains special ownership', () => {
    const d = deriveDeleteDisplay({ kind: 'protected' });
    expect(d.verdict).toBe('protected');
    expect(d.message).toMatch(/Council|Bridge/);
  });

  it('safety_failed is definitive non-deletion', () => {
    const d = deriveDeleteDisplay({ kind: 'safety_failed' });
    expect(d.verdict).toBe('safety_failed');
    expect(d.message).toContain('未被删除');
  });
});

describe('busy lease gate', () => {
  it('active lease blocks deletion with explanation', async () => {
    persistRuntimeLease(null, {
      version: 1,
      operation: 'send',
      conversationId: 101,
      transport: 'sse',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      disposition: 'active',
    });
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={101}
        conversationName="Alpha"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        performDelete={() => deleteConversation(101)}
      />,
    );
    // Busy gate: the confirm button is disabled with a busy label, and the
    // busy explanation is visible without ever firing a DELETE.
    const confirm = screen.getByRole('button', { name: /无法删除/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(reqs.some((r) => r.init?.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('alert').textContent).toMatch(/运行|进行/);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('corrupt lease quarantines and maps to a blocking explanation (pure gate)', () => {
    // A structurally invalid lease is quarantined (removed) and reported as
    // a blocking reason — the delete flow must never treat it as idle.
    window.localStorage.setItem('exo:v4:chat-runtime:101', '{not json');
    const reason = deleteBusyReason(101);
    expect(reason).toMatch(/损坏/);
    expect(window.localStorage.getItem('exo:v4:chat-runtime:101')).toBeNull(); // quarantined
    // Absent (after quarantine) is NOT idle proof per contract — but the
    // pure gate returns null for absent (backend 409 is authoritative).
    expect(deleteBusyReason(101)).toBeNull();
  });
});

describe('confirm dialog settlement', () => {
  it('cancel sends no DELETE and closes', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={101}
        conversationName="Alpha"
        onClose={onClose}
        onDeleted={onDeleted}
        performDelete={() => deleteConversation(101)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(reqs.some((r) => r.init?.method === 'DELETE')).toBe(false);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirmed settlement retires ONLY the deleted conversation caches and notifies parent', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const client = makeClient();
    client.setQueryData(queryKeys.conversation(101), { id: 101 });
    client.setQueryData(queryKeys.messages(101), { pages: [], pageParams: [] });
    client.setQueryData(['control', 'cache', 101], { active: false });
    client.setQueryData(queryKeys.conversation(102), { id: 102 });
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={101}
        conversationName="Alpha"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        queryClient={client}
        performDelete={() => deleteConversation(101)}
      />,
      client,
    );
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(101);
    });
    await waitFor(() => {
      // Only 101's families are removed; 102's untouched.
      expect(client.getQueryData(queryKeys.conversation(101))).toBeUndefined();
      expect(client.getQueryData(queryKeys.messages(101))).toBeUndefined();
      expect(client.getQueryData(['control', 'cache', 101])).toBeUndefined();
      expect(client.getQueryData(queryKeys.conversation(102))).toEqual({ id: 102 });
    });
  });

  it('busy backend verdict (409) keeps dialog open, no retry, no parent notify', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={103}
        conversationName="Busy"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        performDelete={() => deleteConversation(103)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/运行中/);
    });
    expect(onDeleted).not.toHaveBeenCalled();
    // DELETE fired exactly once (409 is a settled verdict; no retry).
    expect(reqs.filter((r) => r.init?.method === 'DELETE').length).toBe(1);
  });

  it('protected verdict (400) shows explanation, no parent notify', async () => {
    begin([]);
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={104}
        conversationName="Protected"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        performDelete={() => deleteConversation(104)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/保护/);
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('ambiguous network outcome triggers read-back and never claims success', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const readBack = vi.fn(async () => undefined);
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={106}
        conversationName="Net"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        performDelete={() => deleteConversation(106)}
        onReadBack={readBack}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(readBack).toHaveBeenCalled();
    });
    expect(onDeleted).not.toHaveBeenCalled();
    // A subsequent confirmed retry (re-armed) succeeds and notifies.
  });

  it('at most one DELETE per pending confirmation (double click)', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const gate = vi.fn(
      () => new Promise<{ outcome: { kind: 'confirmed' } }>(() => undefined),
    );
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={101}
        conversationName="Alpha"
        onClose={vi.fn()}
        onDeleted={vi.fn()}
        performDelete={gate}
      />,
    );
    const confirm = screen.getByRole('button', { name: /确认删除/ });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(gate).toHaveBeenCalledTimes(1); // pending -> second click ignored
  });
});

describe('recent list entrance', () => {
  it('renders a menu trigger per row, opens dropdown, and opens the shared dialog upon selecting 删除会话', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    wrap(<RecentConversationList onRequestCreate={vi.fn()} />);
    await screen.findByText('Alpha 会话');
    const triggers = screen.getAllByLabelText(/会话操作/);
    expect(triggers.length).toBe(2);
    fireEvent.click(triggers[0]);
    const menu = await screen.findByRole('menu');
    expect(menu).toBeTruthy();
    const deleteItem = within(menu).getByRole('menuitem', { name: '删除会话' });
    fireEvent.click(deleteItem);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: '删除会话' })).toBeTruthy();
    expect(dialog.textContent).toMatch(/永久删除/);
    expect(dialog.textContent).toMatch(/归档/); // distinct from archive
  });

  it('menu deletion on the Home list fires DELETE for the exact id and removes the row from the canonical list', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const client = makeClient();
    wrap(
      <RecentConversationList
        onRequestCreate={vi.fn()}
        onDeletedConversation={() => {
          void client.invalidateQueries({ queryKey: queryKeys.conversations });
        }}
      />,
      client,
    );
    await screen.findByText('Alpha 会话');
    const triggers = screen.getAllByLabelText(/会话操作/);
    fireEvent.click(triggers[0]);
    const menu = await screen.findByRole('menu');
    const deleteItem = within(menu).getByRole('menuitem', { name: '删除会话' });
    fireEvent.click(deleteItem);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(reqs.filter((r) => r.init?.method === 'DELETE').length).toBe(1);
      expect(reqs.some((r) => r.init?.method === 'DELETE' && r.url.includes('/101/'))).toBe(true);
    });
    // The dialog itself retires caches + refreshes the canonical list.
    await waitFor(() => {
      const list = client.getQueryData(queryKeys.conversations);
      expect(Array.isArray(list)).toBe(true);
    });
    await waitFor(() => {
      const list = client.getQueryData(queryKeys.conversations) as { id: number }[] | undefined;
      if (list) {
        expect(list.some((r) => r.id === 101)).toBe(false);
      }
    });
    // The row is removed from the DOM too.
    await waitFor(() => {
      expect(screen.queryByText('Alpha 会话')).toBeNull();
    });
  });
});

describe('ConversationDeleteMenu — keyboard & row menu interactions', () => {
  it('trigger is focusable, has aria-haspopup and aria-expanded, opens on click or ArrowDown', async () => {
    wrap(<ConversationDeleteMenu conversationId={101} conversationName="Alpha" />);
    const trigger = screen.getByRole('button', { name: /会话操作 Alpha/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu');
    expect(menu).toBeTruthy();
    const item = within(menu).getByRole('menuitem', { name: '删除会话' });
    expect(item).toBeTruthy();
  });

  it('keyboard: Escape closes the menu and restores focus to the trigger', async () => {
    wrap(<ConversationDeleteMenu conversationId={101} conversationName="Alpha" />);
    const trigger = screen.getByRole('button', { name: /会话操作 Alpha/ });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = await screen.findByRole('menu');
    const item = within(menu).getByRole('menuitem', { name: '删除会话' });
    item.focus();
    expect(document.activeElement).toBe(item);

    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('outside pointerdown closes the menu without opening dialog', async () => {
    wrap(
      <div>
        <div data-testid="outside">Outside</div>
        <ConversationDeleteMenu conversationId={101} conversationName="Alpha" />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: /会话操作 Alpha/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ArrowDown, ArrowUp, and Tab cycle focus within menu items', async () => {
    wrap(<ConversationDeleteMenu conversationId={101} conversationName="Alpha" />);
    const trigger = screen.getByRole('button', { name: /会话操作 Alpha/ });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    const item = within(menu).getByRole('menuitem', { name: '删除会话' });
    item.focus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item);
    fireEvent.keyDown(menu, { key: 'Tab' });
    expect(document.activeElement).toBe(item);
  });
});

describe('resolve flag — retireConversationCaches scoping', () => {
  it('removes only the target conversation families', () => {
    const client = makeClient();
    client.setQueryData(queryKeys.conversation(1), { id: 1 });
    client.setQueryData(queryKeys.conversation(2), { id: 2 });
    client.setQueryData(['control', 'cache', 1], { active: false });
    const bucket = new Set<string>();
    client.getQueryCache().findAll().forEach((q) => bucket.add(JSON.stringify(q.queryKey)));
    expect(bucket.has(JSON.stringify(['control', 'cache', 1]))).toBe(true);
    retireConversationCaches(client, 1);
    expect(client.getQueryData(queryKeys.conversation(1))).toBeUndefined();
    expect(client.getQueryData(queryKeys.conversation(2))).toEqual({ id: 2 });
  });
});
describe('F1/F2 — re-arm loop and terminal states', () => {
  it('F1: ambiguous outcome re-arms — a SECOND confirm fires a fresh DELETE and settles', async () => {
    // 106 = network failure (ambiguous) on every call; but we override via
    // a custom performDelete that fails the FIRST attempt and succeeds the
    // second, proving the loop is genuinely re-armed by the dialog.
    const calls: string[] = [];
    const performDelete = vi.fn(async () => {
      calls.push('call');
      if (calls.length === 1) return { outcome: { kind: 'ambiguous' as const }, cause: new Error('net') };
      return { outcome: { kind: 'confirmed' as const } };
    });
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={101}
        conversationName="Alpha"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        performDelete={performDelete}
        queryClient={makeClient()}
      />,
    );
    // First confirm -> ambiguous -> read-back completes -> re-armed.
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/删除结果未知/);
    });
    // Button is clickable again (re-armed), NOT stuck at "正在读取…".
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /确认删除/ })).toBeEnabled();
    });
    // Second confirm -> fresh DELETE -> confirmed -> parent notified.
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(performDelete).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(101);
    });
  });

  it('F1: ambiguous read-back is wired by default (canonical invalidate) and never claims success', async () => {
    const reqs: { url: string; init?: RequestInit }[] = [];
    begin(reqs);
    const client = makeClient();
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={106}
        conversationName="Net"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        queryClient={client}
      />,
      client,
    );
    // Default adapter (no performDelete) hits the mocked 106 -> ambiguous.
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/删除结果未知/);
    });
    expect(onDeleted).not.toHaveBeenCalled();
    // The canonical conversations invalidate was the default read-back.
    expect(reqs.filter((r) => r.url.includes('/api/agents/conversations/')).length).toBeGreaterThan(0);
  });

  it('F2: safety_failed is terminal — confirm disabled with direction, no retry', async () => {
    begin([]);
    const onDeleted = vi.fn();
    wrap(
      <ConversationDeleteConfirmDialog
        open
        conversationId={105}
        conversationName="Safety"
        onClose={vi.fn()}
        onDeleted={onDeleted}
        performDelete={() => deleteConversation(105)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/未被删除/);
    });
    const confirm = screen.getByRole('button', { name: /确认删除/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('F1: protected/busy keep dialog open, confirm disabled, no retry', async () => {
    begin([]);
    for (const id of [103, 104]) {
      const { unmount } = wrap(
        <ConversationDeleteConfirmDialog
          open
          conversationId={id}
          conversationName={`C-${id}`}
          onClose={vi.fn()}
          onDeleted={vi.fn()}
          performDelete={() => deleteConversation(id)}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toMatch(/运行中|保护/);
      });
      // Terminal: the danger button is disabled (no retry inside the dialog).
      const danger = document.querySelector('.app-btn--danger') as HTMLButtonElement;
      expect(danger.disabled).toBe(true);
      unmount();
    }
  });
});
