import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiverPage } from '../features/river/RiverPage';
import { jsonResponse, renderV4, unmockFetch } from './helpers';
import { installMemoServer } from './memo_test_server';

function card(id: number) { return document.querySelector<HTMLElement>(`[data-river-identity="memo:${id}"]`)!; }
async function expand(id: number) {
  fireEvent.click(within(card(id)).getByRole('button', { name: '展开讨论' }));
  const region = await within(card(id)).findByRole('region', { name: `Memo #${id} 讨论` });
  await within(region).findByLabelText('回复正文');
  return region;
}
async function ready() { renderV4(<RiverPage />); await screen.findByText('agent:2 · 2 条直接回复'); }
function rootPost() {
  fireEvent.change(screen.getByLabelText('Memo 正文'), { target: { value: '另一条根记录' } });
  fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
}
function delayRiver(server: ReturnType<typeof installMemoServer>['server']) {
  let release!: () => void;
  server.river = (_url, payload) => new Promise((resolve) => { release = () => resolve(jsonResponse(payload)); });
  return async () => { await act(async () => { release(); }); };
}
afterEach(() => { cleanup(); unmockFetch(); });

describe('CP2-F01 page-owned reply lifecycle, independent developer counterexamples', () => {
  it('preserves an already failed nested draft/uncertain error across a later root POST and slow first-page rebuild', async () => {
    const { server, calls } = installMemoServer(); await ready();
    const thread = await expand(7);
    fireEvent.click(within(thread).getByRole('button', { name: '回复 Memo #11' }));
    fireEvent.change(within(thread).getByLabelText('回复正文'), { target: { value: '失败后仍保留 #Keep' } });
    server.post = (parent) => parent !== null ? jsonResponse({ error: 'uncertain reply' }, 503) : undefined;
    fireEvent.click(within(thread).getByRole('button', { name: '发送回复' }));
    expect(await within(thread).findByRole('alert')).toHaveTextContent('保存结果不确定');
    const finishRiver = delayRiver(server);
    rootPost();
    await waitFor(() => expect(card(7)).toBeNull());
    expect(screen.getByText('正在加载 River…')).toBeInTheDocument();
    await finishRiver();
    await waitFor(() => expect(card(7)).not.toBeNull());
    const remounted = await expand(7);
    expect(within(remounted).getByLabelText('回复正文')).toHaveValue('失败后仍保留 #Keep');
    expect(within(remounted).getByRole('alert')).toHaveTextContent('保存结果不确定，请先刷新核对');
    expect(within(remounted).getByText('回复目标：@agent:2 · Memo #11')).toBeInTheDocument();
    expect(calls.filter((call) => call.init?.method === 'POST' && call.url.pathname.endsWith('/11/replies/'))).toHaveLength(1);
    expect(calls.filter((call) => call.init?.method === 'PATCH')).toHaveLength(0);
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/').map((call) => call.url.searchParams.get('cursor'))).toEqual([null, null]);
  });

  it('keeps an in-flight reply draft/uncertain error when its 503 settles while the root-create reset window has the card unmounted', async () => {
    const { server, calls } = installMemoServer(); await ready();
    const thread = await expand(7);
    fireEvent.change(within(thread).getByLabelText('回复正文'), { target: { value: 'B9 在途503 #Keep' } });
    let finishReply!: (response: Response) => void;
    server.post = (parent) => parent !== null ? new Promise<Response>((resolve) => { finishReply = resolve; }) : undefined;
    fireEvent.click(within(thread).getByRole('button', { name: '发送回复' }));
    await waitFor(() => expect(calls.filter((call) => call.init?.method === 'POST' && call.url.pathname.endsWith('/7/replies/'))).toHaveLength(1));
    const finishRiver = delayRiver(server); rootPost();
    await waitFor(() => expect(card(7)).toBeNull());
    expect(screen.getByText('正在加载 River…')).toBeInTheDocument();
    // The deferred reply fails while the reset window has the card unmounted.
    await act(async () => { finishReply(jsonResponse({ error: 'reply offline' }, 503)); });
    expect(card(7)).toBeNull(); expect(screen.getByText('正在加载 River…')).toBeInTheDocument();
    await finishRiver(); await waitFor(() => expect(card(7)).not.toBeNull());
    const remounted = await expand(7);
    expect(within(remounted).getByLabelText('回复正文')).toHaveValue('B9 在途503 #Keep');
    expect(within(remounted).getByText('回复目标：@agent:2 · Memo #7')).toBeInTheDocument();
    expect(within(remounted).getByRole('alert')).toHaveTextContent('保存结果不确定，请先刷新核对');
    expect(calls.filter((call) => call.init?.method === 'POST' && call.url.pathname.endsWith('/7/replies/'))).toHaveLength(1);
  });

  it('preserves the in-flight lock/real parent through remount, then clears only that confirmed successful reply and patches its tags', async () => {
    const { server, calls } = installMemoServer(); await ready();
    const thread = await expand(7);
    const occurredAt = card(7).querySelector('time')!.getAttribute('datetime');
    fireEvent.click(within(thread).getByRole('button', { name: '回复 Memo #9' }));
    fireEvent.change(within(thread).getByLabelText('回复正文'), { target: { value: '在途成功 #Keep' } });
    let finishReply!: () => void;
    server.post = (parent, content) => parent !== null ? new Promise((resolve) => { finishReply = () => {
      const memo = { ...server.memos.get(7)!, id: server.nextId++, parent_id: parent, content, tags: [] };
      server.memos.set(memo.id, memo); resolve(jsonResponse(memo, 201));
    }; }) : undefined;
    fireEvent.click(within(thread).getByRole('button', { name: '发送回复' }));
    await waitFor(() => expect(calls.filter((call) => call.init?.method === 'POST')).toHaveLength(1));
    const finishRiver = delayRiver(server); rootPost();
    await waitFor(() => expect(card(7)).toBeNull());
    await finishRiver(); await waitFor(() => expect(card(7)).not.toBeNull());
    const remounted = await expand(7);
    const input = within(remounted).getByLabelText('回复正文');
    expect(input).toHaveValue('在途成功 #Keep'); expect(input).toBeDisabled();
    expect(within(remounted).getByRole('button', { name: '回复 Memo #11' })).toBeDisabled();
    expect(within(remounted).getByText('回复目标：@agent:2 · Memo #9')).toBeInTheDocument();
    // Synthetic key events still invoke React handlers on disabled inputs: owner-level lock must guard them.
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await act(async () => { finishReply(); });
    await waitFor(() => expect(input).toHaveValue(''));
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(within(remounted).queryByRole('alert')).not.toBeInTheDocument();
    expect(remounted.querySelector('[data-memo-id="101"]')).toHaveAttribute('data-parent-id', '9');
    expect(server.memos.get(101)).toMatchObject({ content: '在途成功 #Keep', parent_id: 9, tags: ['Keep'] });
    expect(calls.filter((call) => call.init?.method === 'POST' && call.url.pathname.endsWith('/9/replies/'))).toHaveLength(1);
    expect(calls.filter((call) => call.init?.method === 'PATCH').map((call) => call.url.pathname)).toEqual(['/api/core/memos/101/tags/']);
    expect(card(101)).toBeNull(); expect(document.querySelectorAll('[data-river-identity]')).toHaveLength(2);
    expect(card(7).querySelector('time')!.getAttribute('datetime')).toBe(occurredAt);
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/').map((call) => call.url.searchParams.get('cursor'))).toEqual([null, null]);
  });

  it('retains independent thread drafts/targets when old roots are absent from the fresh first page and return via its new cursor', async () => {
    const { server, calls } = installMemoServer();
    server.memos.set(17, { ...server.memos.get(7)!, id: 17, author: 'agent:4', content: '第二线程', tags: [] });
    await ready();
    const first = await expand(7);
    fireEvent.click(within(first).getByRole('button', { name: '回复 Memo #11' }));
    fireEvent.change(within(first).getByLabelText('回复正文'), { target: { value: '线程甲未提交 #A' } });
    const second = await expand(17);
    fireEvent.change(within(second).getByLabelText('回复正文'), { target: { value: '线程乙未提交 #B' } });
    let release!: () => void;
    server.river = (url, payload) => url.searchParams.get('cursor')
      ? jsonResponse({ items: payload.items.slice(1), next_cursor: null })
      : new Promise((resolve) => { release = () => resolve(jsonResponse({ items: payload.items.slice(0, 1), next_cursor: 'fresh-home-cursor' })); });
    rootPost(); await waitFor(() => expect(card(7)).toBeNull());
    await act(async () => { release(); });
    await screen.findByRole('button', { name: '加载更早记录' });
    expect(card(7)).toBeNull(); expect(card(17)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '加载更早记录' }));
    await waitFor(() => expect(card(17)).not.toBeNull());
    const restoredA = await expand(7); const restoredB = await expand(17);
    expect(within(restoredA).getByLabelText('回复正文')).toHaveValue('线程甲未提交 #A');
    expect(within(restoredA).getByText('回复目标：@agent:2 · Memo #11')).toBeInTheDocument();
    expect(within(restoredB).getByLabelText('回复正文')).toHaveValue('线程乙未提交 #B');
    expect(within(restoredB).getByText('回复目标：@agent:4 · Memo #17')).toBeInTheDocument();
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/').map((call) => call.url.searchParams.get('cursor'))).toEqual([null, null, 'fresh-home-cursor']);
    expect(calls.filter((call) => call.init?.method === 'POST')).toHaveLength(1);
    expect(calls.some((call) => call.url.pathname.includes('/replies/') && call.init?.method === 'POST')).toBe(false);
  });
});
