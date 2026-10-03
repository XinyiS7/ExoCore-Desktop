import { useState } from 'react';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RiverPage } from '../features/river/RiverPage';
import { SourceReadingDrawer } from '../features/river/SourceReadingDrawer';
import { allItems, diaryDetail, diaryItem, heartbeatDetail, heartbeatItem, memoItem, openTask } from './river_fixtures';
import { installFetch, jsonResponse, renderV4, unmockFetch, type RouteHandler } from './helpers';

function readRoutes(river: RouteHandler, shelf: unknown[] = []) {
  return installFetch([
    { test: '/api/core/river/', handler: river },
    { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: shelf }) },
  ]);
}
afterEach(() => { cleanup(); unmockFetch(); });

describe('River CP1 read page', () => {
  it('renders five sources in server order and both task events, with no write/ledger actions or route exposure', async () => {
    const { calls } = readRoutes(() => jsonResponse({ items: allItems, next_cursor: null }), [openTask, { ...openTask, id: 12, title: '来源次项', is_pinned: true }]);
    renderV4(<RiverPage presetId={6} />);
    await screen.findByText('根 Memo #task');
    expect(Array.from(document.querySelectorAll('[data-river-identity]')).map((node) => node.getAttribute('data-river-identity'))).toEqual(allItems.map((item) => `${item.source_type}:${item.source_id}`));
    expect(screen.getByText('user · 2 条直接回复')).toBeInTheDocument();
    expect(screen.getByText('已到本次遍历末尾。')).toBeInTheDocument();
    const shelf = screen.getByRole('region', { name: /未完成事项/ });
    expect(within(shelf).getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(['来源首项', '📌 来源次项']);
    expect(within(shelf).getByRole('button', { name: '日历' })).toBeEnabled();
    expect(within(shelf).getByRole('button', { name: '＋ 新建待办' })).toBeEnabled();
    expect(screen.getByText(/Memo 和 Task 仍为全局/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ledger|运行日志/ })).not.toBeInTheDocument();
    expect(calls.every((call) => call.init?.method === 'GET')).toBe(true);
    expect(calls.some((call) => call.url.pathname === '/api/tasks/entries/')).toBe(false);
  });

  it('passes opaque cursor, blocks overlapping continuation and stops at null', async () => {
    let finish!: (response: Response) => void;
    const cursor = 'opaque:+/==&?';
    const { calls } = readRoutes((url) => url.searchParams.has('cursor')
      ? new Promise((resolve) => { finish = resolve; })
      : jsonResponse({ items: [memoItem], next_cursor: cursor }));
    renderV4(<RiverPage />);
    const more = await screen.findByRole('button', { name: '加载更早记录' });
    fireEvent.click(more); fireEvent.click(more);
    await waitFor(() => expect(calls.filter((call) => call.url.searchParams.has('cursor'))).toHaveLength(1));
    expect(calls.find((call) => call.url.searchParams.has('cursor'))!.url.searchParams.get('cursor')).toBe(cursor);
    await act(async () => { finish(jsonResponse({ items: [diaryItem], next_cursor: null })); });
    await screen.findByText('日记预览');
    expect(screen.queryByRole('button', { name: '加载更早记录' })).not.toBeInTheDocument();
    expect(screen.getByText('已到本次遍历末尾。')).toBeInTheDocument();
    expect(screen.getByText('根 Memo #task')).toBeInTheDocument();
  });

  it('refresh discards old pages/cursor and changes filters always restart at home, including revisits', async () => {
    let generation = 0;
    const { calls } = readRoutes((url) => jsonResponse({ items: [{ ...memoItem, preview: `${url.searchParams.get('sources')}:${generation}:${url.searchParams.has('cursor') ? 'next' : 'home'}`, source_id: url.searchParams.has('cursor') ? '8' : '7' }], next_cursor: url.searchParams.has('cursor') ? null : 'cursor-old' }), [openTask]);
    renderV4(<RiverPage presetId={6} />);
    await screen.findByRole('button', { name: '加载更早记录' });
    fireEvent.click(screen.getByRole('button', { name: '加载更早记录' }));
    await screen.findByText(/:0:next$/);
    generation = 1;
    fireEvent.click(screen.getByRole('button', { name: '刷新时间流' }));
    await screen.findByText(/:1:home$/);
    expect(screen.queryByText(/:0:next$/)).not.toBeInTheDocument();
    const riverCalls = () => calls.filter((call) => call.url.pathname === '/api/core/river/');
    expect(riverCalls().at(-1)!.url.searchParams.has('cursor')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Memo' }));
    await screen.findByText('memo:1:home');
    fireEvent.click(screen.getByRole('button', { name: '全部来源' }));
    await screen.findByText('memo,heartbeat,diary,task,chronicle:1:home');
    expect(riverCalls().filter((call) => call.url.searchParams.has('cursor'))).toHaveLength(1);
    expect(riverCalls().every((call) => call.url.searchParams.get('preset_id') === '6')).toBe(true);
    expect(screen.getByText('来源首项')).toBeInTheDocument();
    expect(calls.filter((call) => call.url.pathname.endsWith('/open-tasks/'))).toHaveLength(1);
  });

  it('changing and revisiting preset filters never revives prior cursor pages', async () => {
    const { calls } = readRoutes((url) => jsonResponse({ items: [{ ...memoItem, source_id: url.searchParams.has('cursor') ? '8' : '7', preview: `preset-${url.searchParams.get('preset_id')}-${url.searchParams.has('cursor') ? 'next' : 'home'}` }], next_cursor: url.searchParams.has('cursor') ? null : 'old' }));
    function PresetHarness() {
      const [presetId, setPresetId] = useState(6);
      return <><button onClick={() => setPresetId((id) => id === 6 ? 2 : 6)}>切换测试身份</button><RiverPage presetId={presetId} /></>;
    }
    renderV4(<PresetHarness />);
    fireEvent.click(await screen.findByRole('button', { name: '加载更早记录' }));
    await screen.findByText('preset-6-next');
    fireEvent.click(screen.getByRole('button', { name: '切换测试身份' }));
    await screen.findByText('preset-2-home');
    fireEvent.click(screen.getByRole('button', { name: '切换测试身份' }));
    await screen.findByText('preset-6-home');
    expect(screen.queryByText('preset-6-next')).not.toBeInTheDocument();
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/' && call.url.searchParams.has('cursor'))).toHaveLength(1);
  });

  it('shows shelf failure separately without manufacturing empty tasks, and explicit retry recovers', async () => {
    let failed = true;
    installFetch([
      { test: '/api/core/river/', handler: () => jsonResponse({ items: [memoItem], next_cursor: null }) },
      { test: '/api/core/river/open-tasks/', handler: () => failed ? jsonResponse({ error: 'shelf failed' }, 503) : jsonResponse({ items: [openTask] }) },
    ]);
    renderV4(<RiverPage />);
    await screen.findByText('根 Memo #task');
    expect(await screen.findByRole('alert')).toHaveTextContent('未完成事项读取失败');
    expect(screen.queryByText('暂无未完成事项。')).not.toBeInTheDocument();
    failed = false;
    fireEvent.click(screen.getByRole('button', { name: '重试任务条带' }));
    await screen.findByText('来源首项');
  });

  it('shows initial 503 as whole-page failure with no silently reduced-source requests', async () => {
    const { calls } = readRoutes(() => jsonResponse({ error: 'unavailable', code: 'source_unavailable', source_type: 'heartbeat' }, 503));
    renderV4(<RiverPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Heartbeat暂不可用，无法取得完整 River 页面');
    expect(document.querySelectorAll('[data-river-identity]')).toHaveLength(0);
    expect(screen.queryByText('这段时间流暂无记录。')).not.toBeInTheDocument();
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/')).toHaveLength(1);
  });

  it.each(['source_unavailable', 'malformed_cursor'])('keeps prior page on continuation %s and offers the correct recovery', async (code) => {
    const { calls } = readRoutes((url) => url.searchParams.has('cursor')
      ? jsonResponse({ error: 'failed', code, source_type: 'diary' }, code === 'malformed_cursor' ? 400 : 503)
      : jsonResponse({ items: [memoItem], next_cursor: 'opaque' }));
    renderV4(<RiverPage />);
    fireEvent.click(await screen.findByRole('button', { name: '加载更早记录' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('已保留先前成功页面，本次遍历未完成');
    expect(screen.getByText('根 Memo #task')).toBeInTheDocument();
    expect(screen.queryByText('已到本次遍历末尾。')).not.toBeInTheDocument();
    if (code === 'malformed_cursor') {
      expect(screen.queryByRole('button', { name: '重试加载更早记录' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '重新刷新时间流' }));
      await screen.findByRole('button', { name: '加载更早记录' });
      expect(calls.filter((call) => call.url.pathname === '/api/core/river/').at(-1)!.url.searchParams.has('cursor')).toBe(false);
    } else expect(screen.getByRole('button', { name: '重试加载更早记录' })).toBeInTheDocument();
  });

  it('distinguishes loading, empty stream and empty shelf while exposing enabled CP3 entrances', async () => {
    let finish!: (response: Response) => void;
    readRoutes(() => new Promise((resolve) => { finish = resolve; }));
    renderV4(<RiverPage />);
    expect(screen.getByText('正在加载 River…')).toBeInTheDocument();
    await screen.findByText('暂无未完成事项。');
    expect(screen.getByRole('button', { name: '日历' })).toBeEnabled();
    await act(async () => { finish(jsonResponse({ items: [], next_cursor: null })); });
    await screen.findByText('这段时间流暂无记录。');
    expect(screen.queryByRole('button', { name: '加载更早记录' })).not.toBeInTheDocument();
  });
});

describe('River CP1 source reading', () => {
  it('reads exact canonical target and restores focus/stream while isolating the background and trapping focus', async () => {
    let finish!: (response: Response) => void;
    const { calls } = installFetch([
      { test: '/api/core/river/', handler: () => jsonResponse({ items: [diaryItem], next_cursor: null }) },
      { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: [] }) },
      { test: '/api/memory/diaries/6/2026-10-01/', handler: () => new Promise((resolve) => { finish = resolve; }) },
    ]);
    const { container } = renderV4(<RiverPage />);
    const trigger = await screen.findByRole('button', { name: '阅读全文' });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(container).toHaveAttribute('aria-hidden', 'true');
    expect(container.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(dialog).getByText(/03:00 是排序锚点/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/全文 \d+ 字符/)).not.toBeInTheDocument();
    const close = within(dialog).getByRole('button', { name: '关闭阅读' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    await act(async () => { finish(jsonResponse(diaryDetail)); });
    expect(await within(dialog).findByRole('heading', { name: '日记全文' })).toBeInTheDocument();
    expect(within(dialog).getByText(/canonical 正文/)).toBeInTheDocument();
    expect(calls.some((call) => call.url.pathname === '/api/memory/diaries/6/2026-10-01/')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(container).not.toHaveAttribute('aria-hidden');
    expect(container.inert).toBeFalsy();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
    expect(screen.getByText('日记预览')).toBeInTheDocument();
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/')).toHaveLength(1);
  });

  it('reuses Heartbeat detail GET and renders final content only, not seed/tool/error, with no ack/wakeup', async () => {
    const { calls } = installFetch([
      { test: '/api/core/river/', handler: () => jsonResponse({ items: [heartbeatItem], next_cursor: null }) },
      { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: [] }) },
      { test: `/api/heartbeat/events/${heartbeatItem.target.session_uuid}/`, handler: () => jsonResponse(heartbeatDetail) },
    ]);
    renderV4(<RiverPage />);
    fireEvent.click(await screen.findByRole('button', { name: '阅读全文' }));
    await screen.findByRole('heading', { name: '最终全文' });
    expect(screen.getByText('这不是预览。')).toBeInTheDocument();
    expect(screen.queryByText('不可展示seed')).not.toBeInTheDocument();
    expect(screen.queryByText('不可展示tool')).not.toBeInTheDocument();
    expect(screen.queryByText('不可展示error')).not.toBeInTheDocument();
    expect(calls.every((call) => call.init?.method === 'GET')).toBe(true);
    expect(calls.some((call) => /ack|consume|wakeup/.test(call.url.pathname))).toBe(false);
  });

  it.each([403, 404, 503])('does not replace failed Heartbeat full text with preview on HTTP%i; explicit retry recovers', async (status) => {
    let failing = true;
    installFetch([{ test: `/api/heartbeat/events/${heartbeatItem.target.session_uuid}/`, handler: () => failing ? jsonResponse({ error: 'no full text' }, status) : jsonResponse(heartbeatDetail) }]);
    renderV4(<SourceReadingDrawer item={heartbeatItem} onClose={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(status === 403 ? '没有权限' : status === 404 ? '不可读或不存在' : '全文读取失败');
    expect(screen.queryByText('心跳预览')).not.toBeInTheDocument();
    expect(screen.queryByText(/全文 \d+ 字符/)).not.toBeInTheDocument();
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: '重试读取全文' }));
    await screen.findByRole('heading', { name: '最终全文' });
  });

  it('renders Markdown without executing raw HTML', async () => {
    installFetch([{ test: '/api/memory/diaries/6/2026-10-01/', handler: () => jsonResponse({ ...diaryDetail, content: '# 安全正文\n\n<script>window.bad=true</script>\n\n<img src=x onerror=alert(1)>' }) }]);
    renderV4(<SourceReadingDrawer item={diaryItem} onClose={vi.fn()} />);
    await screen.findByRole('heading', { name: '安全正文' });
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('script')).toBeNull();
    expect(dialog.querySelector('img')).toBeNull();
  });
});
