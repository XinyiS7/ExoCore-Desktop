// Acceptance-owned CP2 probes. Construction may read, not edit.
import { useEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AgentProfilePage } from '../features/agents/AgentProfilePage';
import { ChatHomePage } from '../features/chat/ChatHomePage';
import { agentQueryKeys } from '../features/agents/queries';
import { queryKeys } from '../features/chat/queries';

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.unstubAllGlobals(); });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const preset = (id: number) => ({ id, name: `Preset ${id}`, description: null, agent_type: id === 1 ? 'g045' : 'standard', default_model: null, system_prompt: null, is_visible: true });
const conversation = (id: number, agent = 5) => ({ id, name: `created-${id}`, created_at: '2026-01-01T00:00:00Z', frozen_project_ids: [], project: 0, project_name: null, agent_type: 'standard', agent_preset_id: agent, last_message_at: null, thinking_level: null, memory_injection_enabled: null });
function deferred() { let resolve!: (value: Response) => void; const promise = new Promise<Response>(done => { resolve = done; }); return { promise, resolve }; }
const success = () => json({ data: { conversation_id: 901, session_id: 999, session_name: 'created-901' } }, 201);
function LocationProbe({ visits }: { visits: string[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Track committed route entries rather than detail-fetch counts.
  const key = location.key;
  const path = location.pathname;
  // A router observer is part of the harness, not a production navigation mock.
  useEffect(() => { visits.push(path); }, [key, path, visits]);
  return <><output aria-label="current-route">{path}</output><button onClick={() => navigate('/agents/6')}>switch-profile</button><button onClick={() => navigate('/agents/5')}>return-profile</button></>;
}

function mount(entry = '/agents/5') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  // Cached destination detail exercises same-component route switching, not a Hub unmount shortcut.
  client.setQueryData(agentQueryKeys.preset(6), preset(6));
  const requests: { url: URL; method: string; body?: Record<string, unknown> }[] = [];
  const posts: ReturnType<typeof deferred>[] = [];
  const visits: string[] = [];
  let rows: ReturnType<typeof conversation>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    requests.push({ url, method, ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}) });
    if (url.pathname === '/api/agents/sessions/init/' && method === 'POST') { const gate = deferred(); posts.push(gate); return gate.promise; }
    if (url.pathname === '/api/agents/conversations/') return json(rows);
    if (url.pathname === '/api/agents/presets/') return json([preset(1), preset(5), preset(6)]);
    const detail = url.pathname.match(/^\/api\/agents\/presets\/(\d+)\/$/);
    if (detail) return json(preset(Number(detail[1])));
    if (url.pathname === '/api/memory/plasmids/') return json([]);
    if (url.pathname === '/api/core/projects/') return json([{ id: 10, name: 'Project Ten' }, { id: 20, name: 'Project Twenty' }]);
    throw new Error(`Unexpected ${method} ${url.pathname}`);
  }));
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><LocationProbe visits={visits} /><Routes>
    <Route path="/" element={<ChatHomePage />} />
    <Route path="/agents/:presetId" element={<AgentProfilePage />} />
    <Route path="/chat/:conversationId" element={<p>canonical-chat-destination</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
  return { client, requests, posts, visits, setRows: (next: typeof rows) => { rows = next; } };
}
async function openProfileDialog() {
  fireEvent.click(await screen.findByRole('button', { name: '使用此 Agent 新建会话' }));
  const dialog = await screen.findByRole('dialog', { name: '新建会话' });
  await within(dialog).findByRole('combobox', { name: /所属项目/ });
  return dialog;
}
async function submit(dialog: HTMLElement, posts: ReturnType<typeof deferred>[]) {
  fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
  await waitFor(() => expect(posts).toHaveLength(1));
}
async function waitForCompletion(client: QueryClient) {
  // Scheduling only: do not judge product correctness from mutation internals.
  await waitFor(() => expect(client.getMutationCache().getAll().some(mutation => mutation.state.status === 'pending')).toBe(false));
}

it.each([['/agents/5', 5], ['/', 6]] as const)('CP2 live origin %s creates once, uses canonical id and exposes refreshed row on return', async (entry, id) => {
  const h = mount(entry);
  let dialog: HTMLElement;
  if (entry === '/') {
    fireEvent.click(await screen.findByRole('button', { name: '新建会话' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('radio', { name: 'Preset 6' }));
  } else {
    dialog = await openProfileDialog();
    expect(within(dialog).queryByRole('radio')).toBeNull();
    expect(within(dialog).getByText('Preset 5')).toBeInTheDocument();
  }
  await submit(dialog, h.posts);
  expect(within(dialog).getByRole('button', { name: '创建中…' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: '创建中…' }));
  expect(h.posts).toHaveLength(1);
  expect(h.requests.find(request => request.method === 'POST')?.body).toEqual({ preset_id: id, project_id: 0, thinking_level: 'auto' });
  h.setRows([conversation(901, id)]);
  await act(async () => { h.posts[0].resolve(success()); });
  await screen.findByText('canonical-chat-destination');
  expect(h.visits.filter(path => path.startsWith('/chat/'))).toEqual(['/chat/901']);
  expect(h.client.getQueryData(queryKeys.conversations)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 901, agentPresetId: id })]));
  fireEvent.click(screen.getByRole('button', { name: id === 5 ? 'return-profile' : 'switch-profile' }));
  expect(await screen.findByRole('link', { name: /created-901/ })).toHaveAttribute('href', '/chat/901');
});

it('CP2 fixed g045 captures Agent, Project and permission IDs before later form changes', async () => {
  const h = mount('/agents/1');
  const dialog = await openProfileDialog();
  fireEvent.change(within(dialog).getByRole('combobox', { name: /所属项目/ }), { target: { value: '20' } });
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Project Ten' }));
  await submit(dialog, h.posts);
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Project Ten' }));
  expect(h.requests.find(request => request.method === 'POST')?.body).toEqual({ preset_id: 1, project_id: 20, thinking_level: 'auto', frozen_project_ids: [10] });
  await act(async () => { h.posts[0].resolve(success()); });
  await screen.findByText('canonical-chat-destination');
});

for (const departure of ['close', 'switch'] as const) {
  it.each(['success', 'ordinary-error', 'malformed-success'] as const)(`CP2 late %s after ${departure} cannot navigate or corrupt a newly opened dialog`, async outcome => {
    const h = mount();
    const original = await openProfileDialog();
    await submit(original, h.posts);
    if (departure === 'close') fireEvent.click(within(original).getByRole('button', { name: '关闭' }));
    else fireEvent.click(screen.getByRole('button', { name: 'switch-profile' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const current = await openProfileDialog();
    expect(within(current).getByText(`Preset ${departure === 'close' ? 5 : 6}`)).toBeInTheDocument();
    if (outcome !== 'ordinary-error') h.setRows([conversation(901)]);
    await act(async () => { h.posts[0].resolve(outcome === 'success' ? success() : outcome === 'ordinary-error' ? json({ name: ['STALE-SERVER-ERROR'] }, 400) : json({ data: { session_id: 901, session_name: 'uncertain' } }, 201)); });
    await waitForCompletion(h.client);
    expect(screen.getByLabelText('current-route')).toHaveTextContent(departure === 'close' ? '/agents/5' : '/agents/6');
    expect(h.visits.filter(path => path.startsWith('/chat/'))).toEqual([]);
    expect(within(current).getByRole('button', { name: '创建会话' })).toBeEnabled();
    expect(within(current).queryByRole('alert')).toBeNull();
    expect(h.requests.find(request => request.method === 'POST')?.body).toMatchObject({ preset_id: 5 });
    if (outcome !== 'ordinary-error') {
      expect(h.client.getQueryData(queryKeys.conversations)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 901 })]));
      expect(h.requests.filter(request => request.url.pathname === '/api/agents/conversations/').every(request => request.url.search === '')).toBe(true);
    }
  });
}

it('CP2 live malformed success invalidates the shared collection but stays locked and never infers an id', async () => {
  const h = mount();
  const dialog = await openProfileDialog();
  await submit(dialog, h.posts);
  h.setRows([conversation(901)]);
  await act(async () => { h.posts[0].resolve(json({ data: { session_id: 901, session_name: 'uncertain' } }, 201)); });
  await within(dialog).findByText(/结果不确定/);
  expect(within(dialog).getByRole('button', { name: '创建已锁定' })).toBeDisabled();
  expect(h.visits.filter(path => path.startsWith('/chat/'))).toEqual([]);
  expect(h.posts).toHaveLength(1);
  expect(h.client.getQueryData(queryKeys.conversations)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 901 })]));
});
