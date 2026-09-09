import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

const PRESET_ECKI = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const convRow = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: `conv ${id}`,
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
  ...over,
});

const mkMsg = (id: number, role: string, content: string, indexInSession: number, over: Record<string, unknown> = {}) => ({
  id,
  role,
  content,
  reasoning_content: null,
  platform: 'deepseek',
  model_version: 'v4-flash',
  token_count: null,
  index_in_session: indexInSession,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-09-01T10:00:00Z',
  ...over,
});

function detailRoutes(id: number, pageHandler: (url: URL) => Response | Promise<Response>, over: Record<string, unknown> = {}): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
    { test: `/api/agents/conversations/${id}/`, handler: () => jsonResponse(convRow(id, over)) },
    { test: /^\/api\/agents\/chat\/\d+\/$/, handler: (url) => pageHandler(url) },
  ];
}

afterEach(() => unmockFetch());

describe('canonical read path — timeline & paging', () => {
  it('renders persisted messages ascending with role labels and readable rich text', async () => {
    installFetch(
      detailRoutes(21, () =>
        jsonResponse({
          messages: [
            mkMsg(101, 'user', 'Hello **world** with `code`', 0),
            mkMsg(102, 'assistant', '# Heading\n\n- a\n- b', 1),
            mkMsg(103, 'system', 'system note', 2),
            mkMsg(104, 'developer', 'tool payload', 3),
          ],
          total_count: 4,
          has_more: false,
        }),
      ),
    );
    renderApp(['/chat/21']);

    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(4);
    const texts = articles.map((a) => a.textContent ?? '');
    expect(texts[0]).toContain('Hello');
    expect(texts[0]).toContain('world');
    expect(texts[0]).toContain('你');
    expect(texts[1]).toContain('Heading');
    expect(texts[2]).toContain('System');
    expect(texts[3]).toContain('Developer');
    // deepseek · v4-flash caption on assistant messages.
    expect(texts[1]).toContain('deepseek');
    // In P1B, composer is present on populated conversation
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('shows deferred indicators for reasoning and attachments without claiming controls', async () => {
    installFetch(
      detailRoutes(22, () =>
        jsonResponse({
          messages: [
            mkMsg(201, 'assistant', 'thinking here', 0, {
              reasoning_content: 'hidden reasoning',
              attachment_ids: [1, 2],
              attachments_meta: [
                { id: 1, display_name: 'a.pdf', original_filename: 'a.pdf', mime_type: 'application/pdf', file_size: 3, file_uri: null, content_url: null },
                { id: 2, display_name: 'b.png', original_filename: 'b.png', mime_type: 'image/png', file_size: 4, file_uri: null, content_url: null },
              ],
            }),
          ],
          total_count: 1,
          has_more: false,
        }),
      ),
    );
    renderApp(['/chat/22']);

    const traceSummary = await screen.findByText('历史轨迹');
    const trace = traceSummary.closest('details') as HTMLDetailsElement;
    expect(trace.open).toBe(false);
    expect(screen.getByText('hidden reasoning')).not.toBeVisible();
    fireEvent.click(traceSummary);
    expect(trace.open).toBe(true);
    expect(screen.getByText('hidden reasoning')).toBeVisible();
    // P1C placeholder chip is replaced by real renderers (Task 5).
    expect(screen.queryByText(/附件 2 个 · P1C 开放/)).toBeNull();
    // a.pdf → metadata-only file card (no link, no download promise).
    expect(await screen.findByText('a.pdf')).toBeTruthy();
    // b.png has file_uri null → visible fallback card, not a broken image.
    expect(screen.getByText('b.png')).toBeTruthy();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
    // No attachment download/control UI.
    expect(screen.queryByRole('link', { name: /a\.pdf/ })).toBeNull();
    // In P1B, composer send button is present
    expect(screen.getByRole('button', { name: /发送/ })).toBeTruthy();
  });

  it('loads older pages with the offset invariant, dedupes and renders ascending', async () => {
    let pageCount = 0;
    const { calls } = installFetch(
      detailRoutes(23, () => {
        pageCount += 1;
        if (pageCount === 1) {
          return jsonResponse({
            messages: [mkMsg(10, 'assistant', 'm10', 9), mkMsg(11, 'assistant', 'm11', 10)],
            total_count: 12,
            has_more: true,
          });
        }
        return jsonResponse({
          messages: [mkMsg(8, 'assistant', 'm8', 7), mkMsg(9, 'assistant', 'm9', 8)],
          total_count: 12,
          has_more: false,
        });
      }),
    );
    renderApp(['/chat/23']);

    await screen.findByText('m10');
    expect(await screen.findByRole('button', { name: '加载更早消息' })).toBeTruthy();
    // Newest window first (offset=0).
    const urls = calls.filter((c) => c.url.pathname.includes('/chat/23/'));
    expect(urls[0].url.searchParams.get('offset')).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: '加载更早消息' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: '加载更早消息' })).toBeNull());
    await screen.findByText('m8');
    const articles = screen.getAllByRole('article');
    const texts = articles.map((a) => a.textContent ?? '');
    // Oldest → newest: m8, m9, m10, m11 with no duplicates.
    expect(texts.map((t) => t.replace('Agent', '').trim()).join('|')).toContain('m8');
    const idx8 = texts.findIndex((t) => t.includes('m8'));
    const idx10 = texts.findIndex((t) => t.includes('m10'));
    expect(idx8).toBeLessThan(idx10);
    expect(screen.getAllByText(/m8|m9|m10|m11/)).toHaveLength(4);
    const lastUrl = calls.filter((c) => c.url.pathname.includes('/chat/23/')).at(-1);
    expect(lastUrl?.url.searchParams.get('offset')).toBe('2');
  });

  it('disables the older button while the older page is in flight', async () => {
    let resolvePage: (r: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      resolvePage = resolve;
    });
    installFetch(
      detailRoutes(24, (url) => {
        if (url.searchParams.get('offset') === '0') {
          return jsonResponse({
            messages: [mkMsg(301, 'assistant', 'm301', 0)],
            total_count: 2,
            has_more: true,
          });
        }
        return gate;
      }),
    );
    renderApp(['/chat/24']);
    const button = await screen.findByRole('button', { name: '加载更早消息' });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('button', { name: /加载中/ })).toBeDisabled());
    resolvePage(jsonResponse({ messages: [mkMsg(300, 'assistant', 'm300', -1)], total_count: 2, has_more: false }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /加载中/ })).toBeNull());
  });

  it('message-history 404 is a distinct recoverable state', async () => {
    installFetch(
      detailRoutes(25, () => jsonResponse({ error: '会话不存在' }, 404)),
    );
    renderApp(['/chat/25']);
    expect(await screen.findByText('消息历史不可用')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });

  it('message fetch failure shows error + retry that recovers', async () => {
    let fail = true;
    installFetch(
      detailRoutes(26, () =>
        fail
          ? jsonResponse({ error: 'boom' }, 500)
          : jsonResponse({ messages: [mkMsg(400, 'assistant', 'recovered', 0)], total_count: 1, has_more: false }),
      ),
    );
    renderApp(['/chat/26']);
    expect(await screen.findByText('消息加载失败')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('recovered')).toBeTruthy();
  });

  it('shows project context (ProjX) instead of Drift when the conversation has a project', async () => {
    installFetch(
      detailRoutes(27, () => jsonResponse({ messages: [], total_count: 0, has_more: false }), {
        project: 10,
        project_name: 'ProjX',
        name: 'proj conv',
      }),
    );
    renderApp(['/chat/27']);
    expect(await screen.findByText('ProjX')).toBeTruthy();
    expect(within(document.body).queryByText('Drift')).toBeNull();
  });
});
