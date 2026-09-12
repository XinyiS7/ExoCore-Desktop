/**
 * T1 single-conversation delete — INDEPENDENT ACCEPTANCE PROBES (Acceptance-owned).
 *
 * Asserts the FROZEN contract, not implementation details:
 * - shared dialog + always-reachable trigger on list rows; cancel = zero DELETE
 * - busy gate (valid lease blocks; corrupt lease quarantined + blocked;
 *   backend 409 authoritative when no local lease)
 * - settled outcomes: 204 confirms and reconciles ONLY that conversation;
 *   409 busy = single DELETE, explanation, NO auto-retry;
 *   500 safety_failed = fail-closed, NO ambiguous read-back, affordance must
 *   not be enabled-but-dead
 * - ambiguous (network): canonical read-back THEN re-arm (second confirm fires)
 * - late settlement after unmount must not touch a new view or crash
 *
 * Production composition: RecentConversationList -> ConversationDeleteMenu ->
 * ConversationDeleteConfirmDialog. Fetch mock: DELETE /conversations/<id>/
 * 101,102 -> 204; 103 -> 409 busy; 105 -> 500 safety_check_failed; 106 -> network
 * TypeError; any other id -> 204. List GET returns rows minus deleted ids.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { RecentConversationList } from '../features/chat/RecentConversationList';
import { ConversationDeleteConfirmDialog } from '../features/chat/ConversationDeleteConfirmDialog';
import type { ConversationDeleteAttempt } from '../features/chat/chatDelete';

const PRESET = { id: 11, name: 'Alessandro', is_visible: true, model: 'gpt', avatar: null };

const ROWS = [
  { id: 101, name: 'Alpha 会话', project: null, project_name: null, agent_preset_id: 11, agent_type: 'g045', temperature: 1.0, thinking_level: 'medium', frozen_project_ids: [], created_at: '2026-08-01T00:00:00Z', last_message_at: '2026-08-02T00:00:00Z' },
  { id: 102, name: 'Beta 会话', project: 7, project_name: 'P7', agent_preset_id: 11, agent_type: 'g045', temperature: 1.0, thinking_level: 'medium', frozen_project_ids: [], created_at: '2026-08-01T00:00:00Z', last_message_at: null },
];

type Req = { url: string; method: string };
let deletedIds = new Set<number>();
let requests: Req[] = [];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function begin() {
  deletedIds = new Set<number>();
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();
      requests.push({ url, method });
      if (url.includes('/api/agents/conversations/') && method === 'DELETE') {
        const id = Number(new URL(url, window.location.origin).pathname.match(/\/(\d+)\/$/)?.[1]);
        deletedIds.add(id);
        if (id === 106) throw new TypeError('Failed to fetch');
        if (id === 103) return json({ code: 'conversation_busy', message: 'busy' }, 409);
        if (id === 105) return json({ code: 'safety_check_failed', message: 'safety' }, 500);
        return new Response(null, { status: 204 });
      }
      if (url.includes('/api/agents/conversations/')) {
        return json(ROWS.filter((r) => !deletedIds.has(r.id)), 200);
      }
      if (url.includes('/api/agents/presets/')) return json([PRESET], 200);
      return json({ error: 'unexpected' }, 500);
    }),
  );
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function wrap(ui: ReactElement, c = client()) {
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const listGets = () => requests.filter((r) => r.method === 'GET' && r.url.includes('/api/agents/conversations/')).length;
const deletes = () => requests.filter((r) => r.method === 'DELETE').length;

const LEASE_PREFIX = 'exo:v4:chat-runtime:';
function seedLease(id: number, disposition: 'pending' | 'active' | 'uncertain') {
  window.localStorage.setItem(
    `${LEASE_PREFIX}${id}`,
    JSON.stringify({ version: 1, conversationId: id, operation: 'send', transport: 'sse', disposition, startedAt: Date.now() - 1000, updatedAt: Date.now() - 1000 }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function openDialogFor(rowIndex: number) {
  const triggers = await screen.findAllByRole('button', { name: /会话操作/ });
  fireEvent.click(triggers[rowIndex]);
  const item = await screen.findByRole('menuitem', { name: /删除会话/ });
  fireEvent.click(item);
  return await screen.findByRole('dialog');
}

it('home rows carry an always-visible delete trigger; cancel sends zero DELETE', async () => {
  begin();
  wrap(<RecentConversationList onRequestCreate={() => undefined} />);
  const triggers = await screen.findAllByRole('button', { name: /会话操作/ });
  expect(triggers).toHaveLength(2);
  await openDialogFor(0);
  expect(screen.getByRole('dialog').textContent).toMatch(/Alpha 会话/);
  fireEvent.click(screen.getByRole('button', { name: /取消/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(deletes()).toBe(0);
});

it('valid pending lease blocks confirmation with explanation and zero DELETE', async () => {
  begin();
  seedLease(101, 'pending');
  wrap(<RecentConversationList onRequestCreate={() => undefined} />);
  await openDialogFor(0);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/正在进行|等待确认/));
  expect(screen.getByRole('button', { name: /无法删除/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /取消/ }));
  expect(deletes()).toBe(0);
});

it('corrupt lease: dialog blocks with quarantine banner; after isolation deletion is backend-guarded', async () => {
  begin();
  window.localStorage.setItem(`${LEASE_PREFIX}101`, '{{{not-json');
  wrap(<RecentConversationList onRequestCreate={() => undefined} />);
  await openDialogFor(0);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/损坏的运行记录/));
  expect(screen.getByRole('button', { name: /无法删除/ })).toBeDisabled();
  expect(window.localStorage.getItem(`${LEASE_PREFIX}101`)).toBeNull(); // quarantined away on read
  fireEvent.click(screen.getByRole('button', { name: /取消/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await openDialogFor(0); // fresh read after isolation: absent -> backend 409 authoritative
  const confirm = screen.getByRole('button', { name: /确认删除/ });
  expect(confirm).not.toBeDisabled();
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.queryByText(/Alpha 会话/)).toBeNull());
  expect(deletes()).toBe(1);
  expect(screen.getByText(/Beta 会话/)).toBeTruthy();
});

it('409 busy: single DELETE, alert copy, row kept, NO auto-retry', async () => {
  begin();
  wrap(
    <>
      <RecentConversationList onRequestCreate={() => undefined} />
      <ConversationDeleteConfirmDialog open conversationId={103} conversationName="Busy 会话" onClose={() => undefined} onDeleted={() => undefined} />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/运行中|无法删除/));
  await new Promise((r) => setTimeout(r, 150));
  expect(deletes()).toBe(1);
  expect(screen.getByText(/Beta 会话/)).toBeTruthy();
});

it('500 safety_failed: single DELETE, error copy, NO list read-back, affordance not enabled-but-dead', async () => {
  begin();
  wrap(
    <>
      <RecentConversationList onRequestCreate={() => undefined} />
      <ConversationDeleteConfirmDialog open conversationId={105} conversationName="Safety 会话" onClose={() => undefined} onDeleted={() => undefined} />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/安全检查未能完成/));
  expect(deletes()).toBe(1);
  const getsAtSettle = listGets();
  await new Promise((r) => setTimeout(r, 100));
  expect(listGets()).toBe(getsAtSettle); // fail-closed: NO ambiguous read-back
  const confirm = screen.getByRole('button', { name: /确认删除/ });
  const deletesBefore = deletes();
  fireEvent.click(confirm);
  await new Promise((r) => setTimeout(r, 100));
  const retryFired = deletes() > deletesBefore;
  expect(retryFired || confirm.hasAttribute('disabled')).toBe(true); // enabled-but-dead is a defect
});

it('ambiguous network: canonical read-back then RE-ARM; second confirm fires a new DELETE', async () => {
  begin();
  wrap(
    <>
      <RecentConversationList onRequestCreate={() => undefined} />
      <ConversationDeleteConfirmDialog open conversationId={106} conversationName="Net 会话" onClose={() => undefined} onDeleted={() => undefined} />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/网络连接失败|结果未知/));
  const getsAtSettle = listGets();
  await new Promise((r) => setTimeout(r, 100));
  expect(listGets()).toBeGreaterThan(getsAtSettle); // contract: canonical read-back happens
  const confirm = screen.getByRole('button', { name: /确认删除/ });
  const deletesBefore = deletes();
  fireEvent.click(confirm);
  await new Promise((r) => setTimeout(r, 100));
  expect(deletes()).toBeGreaterThan(deletesBefore); // contract: re-armed, second DELETE fires
});

it('204 confirmed: row leaves list on refetch, sibling 102 intact, exactly one DELETE', async () => {
  begin();
  wrap(<RecentConversationList onRequestCreate={() => undefined} />);
  await openDialogFor(0); // 101
  fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
  await waitFor(() => expect(screen.queryByText(/Alpha 会话/)).toBeNull());
  expect(screen.getByText(/Beta 会话/)).toBeTruthy();
  expect(deletes()).toBe(1);
  expect(requests.filter((r) => r.method === 'DELETE')[0].url).toMatch(/\/101\/$/);
});

it('dialog-level re-arm contract: after ambiguous + read-back, a second click fires again', async () => {
  begin();
  const performDelete = vi.fn(async (): Promise<ConversationDeleteAttempt> => ({ outcome: { kind: 'ambiguous' }, cause: new TypeError('boom') }));
  const onReadBack = vi.fn(async () => undefined);
  wrap(
    <ConversationDeleteConfirmDialog open conversationId={108} conversationName="Net2 会话" onClose={() => undefined} onDeleted={() => undefined} performDelete={performDelete} onReadBack={onReadBack} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
  await waitFor(() => expect(onReadBack).toHaveBeenCalled());
  await waitFor(() => expect(onReadBack).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 80)); // let the re-arm finally settle
  const confirm = screen.getByRole('button', { name: /确认删除/ });
  fireEvent.click(confirm);
  await new Promise((r) => setTimeout(r, 100));
  expect(performDelete).toHaveBeenCalledTimes(2); // contract: re-armed after read-back
});

it('late settlement after unmount never paints/redirects a new view and does not crash', async () => {
  begin();
  let resolveDelete!: (a: ConversationDeleteAttempt) => void;
  const performDelete = vi.fn(
    () => new Promise<ConversationDeleteAttempt>((resolve) => { resolveDelete = resolve; }),
  );
  const onDeleted = vi.fn();
  const view = wrap(
    <ConversationDeleteConfirmDialog open conversationId={101} conversationName="Alpha 会话" onClose={() => undefined} onDeleted={onDeleted} performDelete={performDelete} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));
  await waitFor(() => expect(performDelete).toHaveBeenCalled());
  view.unmount(); // user navigated away; dialog instance is gone
  await Promise.resolve();
  resolveDelete({ outcome: { kind: 'confirmed' } }); // late settlement
  await new Promise((r) => setTimeout(r, 100));
  expect(onDeleted).toHaveBeenCalledTimes(1);
  expect(deletes()).toBe(0); // injected performDelete — network untouched
});
