import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { headExcerpt, matchExcerpt } from '../features/chat/minimap/excerpt';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

/** #72 U5: user-message minimap + front-end search. */

describe('minimap excerpts', () => {
  it('takes the first 15 characters, collapsing whitespace', () => {
    expect(headExcerpt('短消息')).toBe('短消息');
    expect(headExcerpt('一二三四五六七八九十甲乙丙丁戊己庚')).toBe('一二三四五六七八九十甲乙丙丁戊…');
    expect(headExcerpt('line one\n\n  line two')).toBe('line one line t…');
  });

  it('centres a 15-character window on a case-insensitive hit', () => {
    const hit = matchExcerpt('前面有很多很多的铺垫文字然后才说到 Memory Plausibility 这件事情以及后面的内容', 'memory');
    expect(hit).not.toBeNull();
    expect(hit!.match).toBe('Memory');
    expect(Array.from(hit!.before + hit!.match + hit!.after)).toHaveLength(15);
    expect(hit!.leadingCut).toBe(true);
    expect(hit!.trailingCut).toBe(true);
  });

  it('shifts the window at the edges and never cuts the hit', () => {
    const start = matchExcerpt('灰灰是谁起的外号啊，桑德罗起的', '灰灰');
    expect(start).toMatchObject({ before: '', match: '灰灰', leadingCut: false });
    const long = matchExcerpt('abc', 'abc', 2);
    expect(long).toMatchObject({ before: '', match: 'abc', after: '' });
    expect(matchExcerpt('nothing here', 'xyz')).toBeNull();
    expect(matchExcerpt('anything', '   ')).toBeNull();
  });
});

const PRESET = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const CONV = {
  id: 30,
  name: 'minimap conv',
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
};

const mkMsg = (id: number, role: string, content: string, index: number) => ({
  id,
  role,
  content,
  reasoning_content: null,
  platform: 'deepseek',
  model_version: 'v4-flash',
  token_count: null,
  index_in_session: index,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-09-01T10:00:00Z',
});

function routes(): MockRoute[] {
  let page = 0;
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
    { test: '/api/agents/conversations/30/', handler: () => jsonResponse(CONV) },
    {
      test: '/api/agents/chat/30/',
      handler: () => {
        page += 1;
        if (page === 1) {
          return jsonResponse({
            messages: [
              mkMsg(3, 'user', '帮我看看召回 benchmark 的结果', 2),
              mkMsg(4, 'assistant', '好的', 3),
              mkMsg(5, 'user', '为什么突然开始说韩语了', 4),
              mkMsg(6, 'assistant', 'language confusion', 5),
            ],
            total_count: 6,
            has_more: true,
          });
        }
        return jsonResponse({
          messages: [mkMsg(1, 'user', '最早的一条：灰灰是谁', 0), mkMsg(2, 'assistant', '是砚', 1)],
          total_count: 6,
          has_more: false,
        });
      },
    },
  ];
}

async function openMinimap() {
  installFetch(routes());
  renderApp(['/chat/30']);
  await screen.findByText('好的');
  fireEvent.click(screen.getByRole('button', { name: '用户消息导航' }));
  return screen.getByRole('dialog', { name: '用户消息导航' });
}

describe('MessageMinimap in the conversation page', () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    unmockFetch();
    vi.restoreAllMocks();
  });

  it('lists loaded user messages only, and jumps to one with a flash', async () => {
    const panel = await openMinimap();
    const items = within(panel).getAllByRole('button', { name: /召回|韩语/ });
    expect(items.map((b) => b.textContent)).toEqual(['帮我看看召回 benchmar…', '为什么突然开始说韩语了']);
    expect(within(panel).getByText('仅搜索已加载的 2 条')).toBeTruthy();

    fireEvent.click(items[1]);
    const target = document.querySelector('[data-message-id="5"]') as HTMLElement;
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target).toHaveClass('app-msg--flash');
    expect(items[1]).toHaveAttribute('aria-current', 'location');
  });

  it('filters by substring, highlights the hit, and offers older pages when nothing matches', async () => {
    const panel = await openMinimap();
    const search = within(panel).getByRole('searchbox', { name: '搜索用户消息' });

    fireEvent.change(search, { target: { value: 'BENCH' } });
    const mark = panel.querySelector('mark');
    expect(mark).toHaveTextContent('bench');
    expect(within(panel).getAllByRole('listitem').filter((li) => li.querySelector('.app-minimap-item'))).toHaveLength(1);

    fireEvent.change(search, { target: { value: '灰灰' } });
    expect(within(panel).getByText('已加载的 2 条中未找到')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: '加载更早消息' }));

    // Older page arrives; the same query now matches without retyping.
    await waitFor(() => expect(panel.querySelector('mark')).toHaveTextContent('灰灰'));
    expect(within(panel).getByText('仅搜索已加载的 3 条')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: '加载更早消息' })).toBeNull();
  });

  it('closes on Escape and returns focus to the toggle', async () => {
    const panel = await openMinimap();
    fireEvent.keyDown(within(panel).getByRole('searchbox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '用户消息导航' })).toBeNull();
    expect(screen.getByRole('button', { name: '用户消息导航' })).toHaveFocus();
  });
});
