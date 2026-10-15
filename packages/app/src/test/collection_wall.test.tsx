import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { cardDate, cardTitle, parseWallFilters, wallFiltersToParams } from '../features/collection/filters';
import { listItem } from './collection_fixtures';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

afterEach(unmockFetch);

const TAGS = { items: [{ name: 'Night', normalized_name: 'night', item_count: 2 }] };

function wallRoutes(list: MockRoute['handler']): MockRoute[] {
  return [
    { test: '/api/collection/items/', method: 'GET', handler: list },
    { test: '/api/collection/tags/', handler: () => jsonResponse(TAGS) },
  ];
}
const listCalls = (calls: { url: URL; init?: RequestInit }[]) =>
  calls.filter((call) => call.url.pathname === '/api/collection/items/');
const params = (call: { url: URL }) => Object.fromEntries(call.url.searchParams);

describe('Library wall filters (UI-B1)', () => {
  it('round-trips URL filters and drops malformed values', () => {
    const filters = parseWallFilters(new URLSearchParams('kind=image&tag=night&q=海&recent=1&month=2026-09&link=1'));
    expect(filters).toEqual({ kind: 'image', tag: 'night', q: '海', recent: true, month: '2026-09', link: true });
    expect(wallFiltersToParams(filters).toString()).toBe('kind=image&tag=night&q=%E6%B5%B7&recent=1&month=2026-09&link=1');
    expect(parseWallFilters(new URLSearchParams('kind=video&month=2026-13&recent=yes'))).toEqual({
      kind: undefined, tag: undefined, q: undefined, recent: undefined, month: undefined, link: undefined,
    });
  });

  it('maps each control to its HTTP parameter and starts a new traversal', async () => {
    const { calls } = installFetch(wallRoutes(() => jsonResponse({ items: [listItem(1)], next_cursor: 'c2' })));
    renderApp(['/library']);
    await screen.findByText('藏品 1');
    expect(params(listCalls(calls)[0])).toEqual({ limit: '24' });

    fireEvent.click(screen.getByRole('tab', { name: '图片' }));
    await waitFor(() => expect(params(listCalls(calls).at(-1)!)).toEqual({ limit: '24', kind: 'image' }));
    fireEvent.click(screen.getByRole('button', { name: '最近 30 天' }));
    await waitFor(() => expect(params(listCalls(calls).at(-1)!)).toMatchObject({ recent: '1' }));
    fireEvent.change(screen.getByLabelText('月份'), { target: { value: '2026-09' } });
    await waitFor(() => expect(params(listCalls(calls).at(-1)!)).toMatchObject({ month: '2026-09' }));
    expect(screen.getByText(/两个时间筛选同时生效时取交集/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '含链接' }));
    await waitFor(() => expect(params(listCalls(calls).at(-1)!)).toMatchObject({ link: '1' }));
    expect(screen.getByText('仅文字藏品正文可能含链接')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: '#Night' }));
    await waitFor(() => expect(params(listCalls(calls).at(-1)!)).toMatchObject({ tag: 'night' }));
    fireEvent.change(screen.getByRole('searchbox', { name: '关键词匹配' }), { target: { value: '海' } });
    await waitFor(() => expect(params(listCalls(calls).at(-1)!)).toEqual({
      limit: '24', kind: 'image', recent: '1', month: '2026-09', link: '1', tag: 'night', q: '海',
    }), { timeout: 2000 });
    // Every request after a filter change is a first page: no old cursor is reused.
    expect(listCalls(calls).every((call) => !call.url.searchParams.has('cursor'))).toBe(true);
  });
});

describe('Library wall traversal and states (UI-A2 / UI-B1)', () => {
  it('pages with the cursor, keeps cards on continuation failure, and retries', async () => {
    let fail = true;
    const { calls } = installFetch(wallRoutes((url) => {
      if (!url.searchParams.has('cursor')) return jsonResponse({ items: [listItem(2), listItem(1)], next_cursor: 'c2' });
      if (fail) return jsonResponse({ error: 'boom', code: 'internal' }, 500);
      return jsonResponse({ items: [listItem(9)], next_cursor: null });
    }));
    renderApp(['/library']);
    await screen.findByText('藏品 2');
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(await screen.findByText('加载失败，已保留已加载的藏品。')).toBeTruthy();
    expect(screen.getByText('藏品 1')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await screen.findByText('藏品 9');
    expect(screen.getByText('已到底')).toBeTruthy();
    expect(listCalls(calls).at(-1)!.url.searchParams.get('cursor')).toBe('c2');
    const links = within(screen.getByLabelText('藏品墙')).getAllByRole('link', { name: /藏品/ });
    expect(links.map((link) => link.textContent)).toEqual(['藏品 2', '藏品 1', '藏品 9']);
  });

  it('restarts from page one on malformed_cursor and says the list refreshed', async () => {
    let rejected = false;
    const { calls } = installFetch(wallRoutes((url) => {
      if (url.searchParams.has('cursor')) {
        rejected = true;
        return jsonResponse({ error: 'bad cursor', code: 'malformed_cursor' }, 400);
      }
      return jsonResponse({ items: [listItem(rejected ? 5 : 4)], next_cursor: rejected ? null : 'stale' });
    }));
    renderApp(['/library']);
    await screen.findByText('藏品 4');
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await screen.findByText('藏品 5');
    expect(screen.getByRole('status').textContent).toContain('列表已刷新');
    expect(screen.queryByText('藏品 4')).toBeNull();
    expect(listCalls(calls).map((call) => call.url.searchParams.get('cursor'))).toEqual([null, 'stale', null]);
  });

  it('distinguishes empty collection, empty filter result and first-load error', async () => {
    installFetch(wallRoutes(() => jsonResponse({ items: [], next_cursor: null })));
    const first = renderApp(['/library']);
    expect(await screen.findByText('还没有藏品')).toBeTruthy();
    first.unmount();

    installFetch(wallRoutes(() => jsonResponse({ items: [], next_cursor: null })));
    const second = renderApp(['/library?kind=audio']);
    expect(await screen.findByText('没有匹配的藏品')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(await screen.findByText('还没有藏品')).toBeTruthy();
    second.unmount();

    let ok = false;
    installFetch(wallRoutes(() => (ok ? jsonResponse({ items: [listItem(3)], next_cursor: null }) : jsonResponse({ error: 'down', code: 'x' }, 503))));
    renderApp(['/library']);
    expect(await screen.findByRole('alert')).toHaveTextContent('藏品加载失败');
    ok = true;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('藏品 3')).toBeTruthy();
  });

  it('renders four kinds without invented metadata and never records a view', async () => {
    const { calls } = installFetch(wallRoutes(() => jsonResponse({ items: [
      listItem(1, { preview: '正文开头', collection_context: '想留着' }),
      listItem(2, { kind: 'image', title: '', description: '窗台上的猫\n第二行', preview: '', tags: ['猫', '早晨', '窗', '第四'] }),
      listItem(3, { kind: 'audio', title: '', preview: '' }),
      listItem(4, { kind: 'document', title: '', preview: '' }),
    ], next_cursor: null })));
    renderApp(['/library?q=x']);
    await screen.findByText('正文开头');
    const wall = screen.getByLabelText('藏品墙');
    expect(within(wall).getByRole('link', { name: '窗台上的猫' })).toHaveAttribute('href', '/library/items/2?q=x');
    expect(within(wall).getByText('#猫 #早晨 #窗')).toBeTruthy();
    expect(within(wall).getByRole('link', { name: '未命名' })).toBeTruthy();
    expect(within(wall).getByRole('link', { name: '文档 #4' })).toBeTruthy();
    expect(within(wall).getByRole('link', { name: '播放 未命名' })).toBeTruthy();
    expect(within(wall).getAllByRole('img', { name: '有收藏理由' })).toHaveLength(1);

    const thumb = within(wall).getByRole('img', { name: '窗台上的猫\n第二行' });
    expect(thumb).toHaveAttribute('src', '/api/collection/items/2/representations/image_preview/content/');
    fireEvent.error(thumb);
    expect(within(wall).getByLabelText('预览不可用')).toBeTruthy();

    // Same implementation exposes the narrow stepper; stepping does not request a view.
    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    expect(screen.getByText('2 / 4')).toBeTruthy();
    fireEvent.keyDown(wall, { key: 'ArrowRight' });
    expect(screen.getByText('3 / 4')).toBeTruthy();
    expect(calls.some((call) => call.url.pathname.endsWith('/view/'))).toBe(false);
  });

  it('formats titles and local dates from contract fields only', () => {
    expect(cardTitle({ id: 7, kind: 'text', title: '  ', description: '' })).toBe('未命名');
    expect(cardTitle({ id: 7, kind: 'document', title: '', description: '' })).toBe('文档 #7');
    const local = new Date(2026, 9, 14, 23, 12);
    expect(cardDate(local.toISOString(), new Date(2026, 0, 1))).toBe('10-14 23:12');
    expect(cardDate(local.toISOString(), new Date(2027, 0, 1))).toBe('2026-10-14');
  });
});
