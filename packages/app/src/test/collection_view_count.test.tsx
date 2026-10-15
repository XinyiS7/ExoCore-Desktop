import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { detailItem, imageDetail, listItem } from './collection_fixtures';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

afterEach(unmockFetch);

const VIEW = { view_count: 3, last_viewed_at: '2026-10-15T09:00:00+00:00' };

function setup(
  { detail = () => jsonResponse(detailItem(5)), view = () => jsonResponse(VIEW), extra = [] }:
  { detail?: MockRoute['handler']; view?: MockRoute['handler']; extra?: MockRoute[] } = {},
) {
  let detailCalls = 0;
  const mock = installFetch([
    ...extra,
    { test: '/api/collection/items/5/view/', method: 'POST', handler: view },
    { test: '/api/collection/items/', method: 'GET', handler: () => jsonResponse({ items: [listItem(5), listItem(6)], next_cursor: null }) },
    { test: '/api/collection/items/5/', method: 'GET', handler: (url, init) => { detailCalls += 1; return detail(url, init); } },
    { test: '/api/collection/tags/', handler: () => jsonResponse({ items: [] }) },
  ]);
  return { ...mock, detailCalls: () => detailCalls };
}

const views = (calls: { url: URL; init?: RequestInit }[]) =>
  calls.filter((call) => call.url.pathname.endsWith('/view/'));
const dialog = () => screen.findByRole('dialog', { name: /^藏品 / });
const statRow = (label: string) => screen.getByRole('row', { name: new RegExp(`^${label} `) });

describe('Library view counting (UI-D1)', () => {
  it('records exactly one view per opening, merges the count, and a later opening records again', async () => {
    const { calls } = setup();
    renderApp(['/library'], { strict: true });
    await screen.findByRole('link', { name: '藏品 5' });
    expect(views(calls)).toHaveLength(0);

    fireEvent.click(screen.getByRole('link', { name: '藏品 5' }));
    await dialog();
    await waitFor(() => expect(within(statRow('Alicia')).getAllByRole('cell')[0].textContent).toBe('3'));
    expect(views(calls)).toHaveLength(1);
    expect(views(calls)[0].init?.method).toBe('POST');

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('link', { name: '藏品 5' }));
    await dialog();
    await waitFor(() => expect(views(calls)).toHaveLength(2));
  });

  it('does not recount on refetch, edit refresh, or playback in the open detail', async () => {
    const audio = imageDetail(5, {
      kind: 'audio',
      representations: [],
    });
    const { calls, detailCalls } = setup({
      detail: () => jsonResponse(audio),
      extra: [{ test: '/api/collection/items/5/', method: 'PATCH', handler: () => jsonResponse({ ...audio, title: '改过' }) }],
    });
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    await waitFor(() => expect(views(calls)).toHaveLength(1));

    fireEvent.play(document.querySelector('audio')!);
    fireEvent.click(view.getByRole('button', { name: '编辑' }));
    fireEvent.change(view.getByLabelText('标题'), { target: { value: '改过' } });
    fireEvent.click(view.getByRole('button', { name: '保存' }));
    await view.findByRole('button', { name: '编辑' });
    expect(detailCalls()).toBe(1);
    expect(views(calls)).toHaveLength(1);
  });

  it('shows content and says the view was not recorded when the request fails, without retrying', async () => {
    const { calls } = setup({ view: () => jsonResponse({ error: 'boom', code: 'internal' }, 500) });
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    expect(await view.findByText('本次浏览未记录')).toBeTruthy();
    expect(view.getByText('一段文字')).toBeTruthy();
    expect(within(statRow('Alicia')).getAllByRole('cell')[0].textContent).toBe('2');
    expect(views(calls)).toHaveLength(1);
  });

  it('refetches the backend-labelled row when no human row existed yet', async () => {
    let viewed = false;
    const base = detailItem(5);
    setup({
      detail: () => jsonResponse(viewed ? base : { ...base, viewer_stats: base.viewer_stats.slice(1) }),
      view: () => { viewed = true; return jsonResponse(VIEW); },
    });
    renderApp(['/library/items/5']);
    await dialog();
    expect(await screen.findByRole('row', { name: /^Alicia / })).toBeTruthy();
  });
});

describe('Library social detail (UI-D2)', () => {
  it('shows backend labels and counts as given and comments oldest first, read-only', async () => {
    setup({
      detail: () => jsonResponse(detailItem(5, {
        comments: [
          { author_type: 'agent', author_label: 'Alessandro', body: '后来的', created_at: '2026-10-14T11:00:00+00:00' },
          { author_type: 'human', author_label: 'Alicia', body: '先说的', created_at: '2026-10-14T10:00:00+00:00' },
        ],
      })),
      view: () => new Promise<Response>(() => undefined),
    });
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    const table = await view.findByRole('table', { name: '统计' });
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['谁', '看过', '带回', '收藏']);
    const rows = within(table).getAllByRole('row').slice(1)
      .map((row) => Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent));
    expect(rows).toEqual([['Alicia', '2', '1', '1'], ['Alessandro', '1', '0', '0']]);
    expect(view.queryByText('你')).toBeNull();

    const comments = view.getByRole('list', { name: '评论' });
    expect(within(comments).getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)).toEqual(['先说的', '后来的']);
    expect(within(comments).getByText(/^Alicia ·/)).toBeTruthy();
    expect(within(comments).queryAllByRole('button')).toHaveLength(0);
  });
});
