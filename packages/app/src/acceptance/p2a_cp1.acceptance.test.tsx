// Acceptance-owned. Construction may read, not edit.
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AgentProfilePage } from '../features/agents/AgentProfilePage';
import { queryKeys } from '../features/chat/queries';
import type { ConversationSummary } from '../features/chat/types';

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.unstubAllGlobals(); });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const row = (id: number, agent = 5, project: number | null = 7): ConversationSummary => ({
  id, name: `row-${id}`, agentPresetId: agent, projectId: project, projectName: project === null ? null : `Project ${project}`,
  createdAt: '2026-01-01T00:00:00Z', lastMessageAt: null, agentType: 'standard', thinkingLevel: null, memoryInjectionEnabled: null,
});
function Nav() { const navigate = useNavigate(); return <button onClick={() => navigate('/agents/6')}>switch-agent</button>; }
function mount(
  rows: ConversationSummary[],
  memory?: (id: string | null) => Response | Promise<Response>,
  conversations?: () => Response | Promise<Response>,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData(queryKeys.conversations, rows);
  const calls: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost'); calls.push(url);
    const match = url.pathname.match(/^\/api\/agents\/presets\/(\d+)\/$/);
    if (match) return response({ id: Number(match[1]), name: `Identity ${match[1]}`, description: null, agent_type: 'standard', default_model: null, system_prompt: null, is_visible: true });
    if (url.pathname === '/api/memory/plasmids/') return memory ? memory(url.searchParams.get('preset_id')) : response([]);
    if (url.pathname === '/api/agents/conversations/' && conversations) return conversations();
    throw new Error(`Unexpected request: ${url.pathname}`);
  }));
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/agents/5']}><Nav /><Routes><Route path="agents/:presetId" element={<AgentProfilePage />} /></Routes></MemoryRouter></QueryClientProvider>);
  return { client, calls };
}

it('CP1 independent: shared cache is the live source; no Profile-index Project or second Conversation fetch', async () => {
  const { client, calls } = mount([row(101), row(102, 6)]);
  await screen.findByRole('link', { name: /row-101/ });
  expect(screen.queryByRole('link', { name: /row-102/ })).toBeNull();
  await act(async () => { client.setQueryData(queryKeys.conversations, [row(103)]); });
  expect(screen.getByRole('link', { name: /row-103/ })).toHaveAttribute('href', '/chat/103');
  expect(screen.queryByRole('link', { name: /row-101/ })).toBeNull();
  expect(calls.every(url => /^\/api\/agents\/presets\/5\/$/.test(url.pathname) || url.pathname === '/api/memory/plasmids/')).toBe(true);
});

it('CP1 independent: selecting Drift with only Project conversations produces the empty subset, not zero-Agent copy', async () => {
  mount([row(201)]);
  const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
  fireEvent.click(within(filters).getByRole('radio', { name: 'Drift' }));
  expect(screen.queryByRole('link', { name: /row-201/ })).toBeNull();
  expect(screen.queryByText('该 Agent 还没有会话')).toBeNull();
  expect(within(filters).getByRole('radio', { name: 'Drift' })).toBeChecked();
  // Frozen §8.5 requires the correct subset; extra empty-state copy remains advisory.
  expect(screen.getByRole('list', { name: '该 Agent 的会话' }).children).toHaveLength(0);
});

it('CP1 independent: an identified but unnamed Project is not presented as Drift on its Conversation row', async () => {
  mount([{ ...row(250), projectName: null }]);
  const link = await screen.findByRole('link', { name: /row-250/ });
  expect(link).toHaveTextContent('Project #7');
  expect(link).not.toHaveTextContent('Drift');
});

it('CP1 independent: removed Project selection falls back to All and does not silently resurrect', async () => {
  const { client } = mount([row(301), row(302, 5, null)]);
  const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
  fireEvent.click(within(filters).getByRole('radio', { name: 'Project 7' }));
  expect(screen.queryByRole('link', { name: /row-302/ })).toBeNull();
  await act(async () => { client.setQueryData(queryKeys.conversations, [row(302, 5, null)]); });
  await waitFor(() => expect(screen.getByRole('radio', { name: '全部' })).toBeChecked());
  await act(async () => { client.setQueryData(queryKeys.conversations, [row(301), row(302, 5, null)]); });
  await screen.findByRole('radio', { name: 'Project 7' });
  expect(screen.getByRole('radio', { name: '全部' })).toBeChecked();
  expect(screen.getByRole('link', { name: /row-302/ })).toBeInTheDocument();
});

it('CP1 independent: late Memory from old Agent cannot replace current identity, tags or rows', async () => {
  let resolveOld!: (value: Response) => void;
  const oldMemory = new Promise<Response>(resolve => { resolveOld = resolve; });
  mount([row(401), row(402, 6)], id => id === '5' ? oldMemory : response([{ tags: ['current-tag'] }]));
  await screen.findByText('正在加载记忆…');
  fireEvent.click(screen.getByRole('button', { name: 'switch-agent' }));
  await screen.findByText('current-tag');
  await act(async () => { resolveOld(response([{ tags: ['old-tag'] }, { tags: [] }])); await oldMemory; });
  expect(screen.getByRole('heading', { name: 'Identity 6' })).toBeInTheDocument();
  expect(screen.queryByText('old-tag')).toBeNull();
  expect(screen.queryByRole('link', { name: /row-401/ })).toBeNull();
  expect(screen.getByRole('link', { name: /row-402/ })).toBeInTheDocument();
  expect(screen.getByText('1 条记忆（含共享/全局）')).toBeInTheDocument();
});

it('CP1 independent R2 sibling: an empty Agent lens cannot preserve a removed Project selection through refill', async () => {
  const { client } = mount([row(601), row(602, 6)]);
  fireEvent.click(await screen.findByRole('radio', { name: 'Project 7' }));
  await act(async () => { client.setQueryData(queryKeys.conversations, [row(602, 6)]); });
  await screen.findByText('该 Agent 还没有会话');
  await act(async () => { client.setQueryData(queryKeys.conversations, [row(601), row(602, 6)]); });
  await screen.findByRole('radio', { name: 'Project 7' });
  expect(screen.getByRole('radio', { name: '全部' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Project 7' }));
  fireEvent.click(screen.getByRole('button', { name: 'switch-agent' }));
  await screen.findByRole('heading', { name: 'Identity 6' });
  expect(screen.getByRole('radio', { name: '全部' })).toBeChecked();
  expect(screen.queryByRole('link', { name: /row-601/ })).toBeNull();
});

it('CP1 independent R2 sibling: blank Project names and true Drift retain distinct identity in real rows', async () => {
  mount([
    { ...row(701), projectName: '' },
    { ...row(702, 5, 8), projectName: '  ' },
    { ...row(703, 5, null), projectName: null },
    { ...row(704, 5, 9), projectName: 'Named project' },
  ]);
  expect(await screen.findByRole('link', { name: /row-701/ })).toHaveTextContent('Project #7');
  expect(screen.getByRole('link', { name: /row-702/ })).toHaveTextContent('Project #8');
  expect(screen.getByRole('link', { name: /row-703/ })).toHaveTextContent('Drift');
  expect(screen.getByRole('link', { name: /row-704/ })).toHaveTextContent('Named project');
});

it('CP1 independent R2 sibling: pending and failed refetch do not erase a valid Project selection', async () => {
  let finish!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  const { client, calls } = mount([row(801), row(802, 5, null)], undefined, () => pending);
  fireEvent.click(await screen.findByRole('radio', { name: 'Project 7' }));
  let refetch!: Promise<void>;
  act(() => { refetch = client.invalidateQueries({ queryKey: queryKeys.conversations }); });
  await waitFor(() => expect(calls.some(url => url.pathname === '/api/agents/conversations/')).toBe(true));
  expect(screen.getByRole('radio', { name: 'Project 7' })).toBeChecked();
  await act(async () => { finish(response({ detail: 'unavailable' }, 503)); await refetch; });
  await screen.findByText('会话加载失败');
  expect(screen.queryByText('该 Agent 还没有会话')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Identity 5' })).toBeInTheDocument();
  expect(screen.getByText('0 条记忆（含共享/全局）')).toBeInTheDocument();
  await act(async () => { client.setQueryData(queryKeys.conversations, [row(801), row(802, 5, null)]); });
  await screen.findByRole('radio', { name: 'Project 7' });
  expect(screen.getByRole('radio', { name: 'Project 7' })).toBeChecked();
  expect(screen.queryByRole('link', { name: /row-802/ })).toBeNull();
});

it('CP1 independent: failed Memory retains working identity and Conversation section, never reports zero', async () => {
  mount([row(501)], () => response({ detail: 'unavailable' }, 503));
  await screen.findByText('记忆加载失败');
  expect(screen.getByRole('heading', { name: 'Identity 5' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /row-501/ })).toBeInTheDocument();
  expect(screen.queryByText(/0 条记忆/)).toBeNull();
  expect(screen.queryByText('会话加载失败')).toBeNull();
});
