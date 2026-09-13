import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

const preset = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const catalog = {
  models: [{
    name: 'deepseek-v4-flash',
    family: 'deepseek',
    abilities: [],
    compatible_endpoint_ids: [7],
  }],
  endpoints: [{
    id: 7,
    name: 'DeepSeek',
    provider: 'deepseek',
    execution_type: 'direct_api',
    execution_adapter: 'internal_http',
    payload_format: 'openai',
    cache_transport: 'inline_chunk',
    attachment_transports: [],
    configured: true,
    enabled: true,
  }],
  roles: {
    main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }],
    support: {
      general_sub_agent: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      vision_helper: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      grounding: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      image_gen: { model: 'deepseek-v4-flash', default_endpoint: 7 },
    },
  },
  providers: [
    {
      id: 'deepseek',
      display_name: 'DeepSeek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      requires_endpoint_api_key: true,
    },
  ],
};

const conversation = (id: number) => ({
  id,
  name: `Conversation ${id}`,
  created_at: '2026-09-01T00:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
});

function timelineScroll(container: HTMLElement) {
  return container.querySelector('.app-scroll-stage > .app-scroll') as HTMLElement;
}

const message = (id: number, content: string, index: number, reasoning: string | null = null) => ({
  id,
  role: 'assistant',
  content,
  reasoning_content: reasoning,
  platform: 'test',
  model_version: 'test',
  token_count: null,
  index_in_session: index,
  attachment_ids: [],
  attachments_meta: [],
  created_at: '2026-09-01T00:00:00Z',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function baseRoutes(
  id: number,
  cacheBody: Record<string, unknown> = { active: false, platform: null, has_snapshot: false },
) {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
    { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
    { test: `/api/agents/conversations/${id}/`, handler: () => jsonResponse(conversation(id)) },
    {
      test: `/api/agents/conversations/${id}/cache/`,
      method: 'GET',
      handler: () => jsonResponse(cacheBody),
    },
  ];
}

function installScrollMetrics(element: HTMLElement, initial: { height: number; client: number; top: number }) {
  let height = initial.height;
  let top = initial.top;
  const writes: number[] = [];
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, get: () => height },
    clientHeight: { configurable: true, get: () => initial.client },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
        writes.push(value);
      },
    },
  });
  return {
    get top() { return top; },
    setTop(value: number) { top = value; },
    setHeight(value: number) { height = value; },
    writes,
  };
}

afterEach(() => {
  cleanup();
  unmockFetch();
  localStorage.clear();
});

describe('P1D final user-acceptance scroll repairs', () => {
  it('initializes the first canonical layout at bottom once and preserves older-page anchors', async () => {
    const initial = deferred<Response>();
    const older = deferred<Response>();
    installFetch([
      ...baseRoutes(140),
      {
        test: '/api/agents/chat/140/',
        method: 'GET',
        handler: (url) => url.searchParams.get('offset') === '0' ? initial.promise : older.promise,
      },
    ]);
    const { container } = renderApp(['/chat/140']);
    await screen.findByText('Conversation 140');
    const scroll = timelineScroll(container);
    const metrics = installScrollMetrics(scroll, { height: 1200, client: 300, top: 0 });

    await act(async () => {
      initial.resolve(jsonResponse({
        messages: [message(2, 'latest', 1, 'legacy trace')],
        total_count: 2,
        has_more: true,
        limit: 50,
        offset: 0,
      }));
    });
    await screen.findByText('latest');
    expect(metrics.top).toBe(1200);
    expect(metrics.writes).toEqual([1200]);

    metrics.writes.length = 0;
    fireEvent.click(screen.getByText('历史轨迹'));
    expect(metrics.writes).toHaveLength(0);

    metrics.setTop(500);
    fireEvent.scroll(scroll);
    expect(await screen.findByRole('button', { name: '返回最新消息' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加载更早消息' }));
    metrics.setHeight(1600);
    await act(async () => {
      older.resolve(jsonResponse({
        messages: [message(1, 'older', 0)],
        total_count: 2,
        has_more: false,
        limit: 50,
        offset: 1,
      }));
    });
    await screen.findByText('older');
    expect(metrics.top).toBe(900);
    expect(metrics.writes).toEqual([900]);
  });

  it('does not initialize to bottom after the user scrolls before canonical history lands', async () => {
    const initial = deferred<Response>();
    installFetch([
      ...baseRoutes(141),
      { test: '/api/agents/chat/141/', method: 'GET', handler: () => initial.promise },
    ]);
    const { container } = renderApp(['/chat/141']);
    await screen.findByText('Conversation 141');
    const scroll = timelineScroll(container);
    const metrics = installScrollMetrics(scroll, { height: 1000, client: 250, top: 120 });
    fireEvent.scroll(scroll);

    await act(async () => {
      initial.resolve(jsonResponse({
        messages: [message(1, 'history', 0)],
        total_count: 1,
        has_more: false,
        limit: 50,
        offset: 0,
      }));
    });
    await screen.findByText('history');
    expect(metrics.top).toBe(120);
    expect(metrics.writes).toHaveLength(0);
  });

  it('anchors the latest affordance inside the timeline viewport stage (U-05)', async () => {
    installFetch([
      ...baseRoutes(144),
      {
        test: '/api/agents/chat/144/',
        method: 'GET',
        handler: () => jsonResponse({
          messages: [message(1, 'tall history', 0)],
          total_count: 1,
          has_more: false,
          limit: 50,
          offset: 0,
        }),
      },
    ]);
    const { container } = renderApp(['/chat/144']);
    await screen.findByText('tall history');
    const stage = container.querySelector('.app-scroll-stage') as HTMLElement;
    expect(stage).not.toBeNull();
    const scroll = timelineScroll(container);
    expect(stage.contains(scroll)).toBe(true);

    // Simulate scrolled-up so the affordance renders, then verify it lives
    // INSIDE the stage (sibling of the scroll owner), outside .app-scroll
    // itself — a passive overlay anchored to the timeline viewport.
    installScrollMetrics(scroll, { height: 2000, client: 500, top: 1000 });
    fireEvent.scroll(scroll);
    const latest = await screen.findByRole('button', { name: '返回最新消息' });
    expect(stage.contains(latest)).toBe(true);
    expect(scroll.contains(latest)).toBe(false);
    // The stage is the direct flex child that ends exactly above the composer,
    // so an absolute button inside it cannot overlap the composer at any width.
    expect(stage.parentElement?.querySelectorAll('.app-scroll-stage')).toHaveLength(1);
  });

  it('clicking latest scrolls to the current bottom immediately, then consumes the pending reconcile once (U-06)', async () => {
    let postAccepted = false;
    let canonicalGets = 0;
    const canonical = deferred<Response>();
    installFetch([
      ...baseRoutes(145),
      {
        test: '/api/agents/chat/145/',
        method: 'POST',
        handler: () => {
          postAccepted = true;
          return new Response(
            'event: content\ndata: runtime reply\n\nevent: done\ndata: [DONE]\n\n',
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          );
        },
      },
      {
        test: '/api/agents/chat/145/',
        method: 'GET',
        handler: () => {
          canonicalGets += 1;
          return postAccepted ? canonical.promise : jsonResponse({
            messages: [message(1, 'old reply', 0)],
            total_count: 1,
            has_more: false,
            limit: 50,
            offset: 0,
          });
        },
      },
    ]);
    const { container } = renderApp(['/chat/145']);
    await screen.findByText('old reply');
    const scroll = timelineScroll(container);
    const metrics = installScrollMetrics(scroll, { height: 2000, client: 500, top: 1000 });
    fireEvent.scroll(scroll);

    const textbox = screen.getByRole('textbox', { name: '消息输入框' });
    fireEvent.change(textbox, { target: { value: 'question' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    expect(await screen.findByRole('button', { name: '返回最新位置' })).toBeInTheDocument();
    const latest = screen.getByRole('button', { name: '返回最新消息' });

    // Reader scrolls further up while the pending canonical fetch is in flight.
    metrics.setTop(800);
    metrics.setHeight(2400);
    fireEvent.scroll(scroll);
    act(() => fireEvent.click(latest));

    // Scroll happens SYNCHRONOUSLY — before the pending canonical GET resolves:
    // the owner is assigned its CURRENT bottom (scrollHeight 2400; browsers
    // clamp the read to 2400-500=1900 — this mock intentionally omits clamping
    // so the assignment target stays observable).
    expect(metrics.top).toBe(2400);
    expect(metrics.writes.at(-1)).toBe(2400);
    expect(canonicalGets).toBeGreaterThanOrEqual(1);

    // Then the one pending reconcile is consumed exactly once; canonical apply
    // follows the reader to its new bottom and both affordances clear.
    await act(async () => {
      canonical.resolve(jsonResponse({
        messages: [message(2, 'canonical reply', 1)],
        total_count: 1,
        has_more: false,
        limit: 50,
        offset: 0,
      }));
    });
    await screen.findByText('canonical reply');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '返回最新位置' })).toBeNull();
      expect(screen.queryByRole('button', { name: '返回最新消息' })).toBeNull();
    });
    expect(canonicalGets).toBe(2);
    // The reader stayed at the followed bottom after canonical replacement.
    expect(metrics.writes.at(-1)).toBe(2400);
  });

  it('routes the direct cache minus through the page owner once under the shared lock', async () => {
    const release = deferred<Response>();
    let releaseCalls = 0;
    const installResult = installFetch([
      ...baseRoutes(143, {
        active: true,
        platform: 'deepseek',
        has_snapshot: true,
        cache_name: 'cache-143',
        model: 'deepseek-v4-flash',
        created_at: '2026-09-01T00:00:00Z',
        expires_at: '2099-09-01T00:02:00Z',
        remaining_seconds: 120,
        renewals: 0,
        ttl_seconds: 300,
      }),
      {
        test: '/api/agents/conversations/143/cache/',
        method: 'DELETE',
        handler: () => {
          releaseCalls += 1;
          return release.promise;
        },
      },
      {
        test: '/api/agents/conversations/143/cache/renew/',
        method: 'POST',
        handler: () => jsonResponse({ ok: false, reason: 'no active cache' }, 409),
      },
      {
        test: '/api/agents/chat/143/',
        method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    const { calls } = installResult;
    renderApp(['/chat/143']);
    const releaseButton = await screen.findByRole('button', { name: '释放上下文缓存' });
    await waitFor(() => expect((releaseButton as HTMLButtonElement).disabled).toBe(false));

    act(() => fireEvent.click(releaseButton));
    // The strip invokes the SAME page-owned release owner; exactly one DELETE
    // request reaches the backend. A second same-tick click must be blocked
    // by the synchronous pending guard even before React rerenders.
    fireEvent.click(releaseButton);
    await waitFor(() => expect(releaseCalls).toBe(1));
    expect(calls.filter((c) => c.init?.method === 'DELETE')).toHaveLength(1);
    await waitFor(() => expect((releaseButton as HTMLButtonElement).disabled).toBe(true));

    await act(async () => {
      release.resolve(new Response(null, { status: 204 }));
    });
    await waitFor(() => expect(releaseButton).not.toBeDisabled());
  });

  it('manually reaching bottom consumes one pending reconcile and removes both affordances', async () => {
    let postAccepted = false;
    let canonicalGets = 0;
    installFetch([
      ...baseRoutes(142),
      {
        test: '/api/agents/chat/142/',
        method: 'POST',
        handler: () => {
          postAccepted = true;
          return new Response('event: content\ndata: runtime reply\n\nevent: done\ndata: [DONE]\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          });
        },
      },
      {
        test: '/api/agents/chat/142/',
        method: 'GET',
        handler: () => {
          canonicalGets += 1;
          return jsonResponse(postAccepted ? {
            messages: [message(2, 'canonical reply', 1)],
            total_count: 2,
            has_more: false,
            limit: 50,
            offset: 0,
          } : {
            messages: [message(1, 'old reply', 0)],
            total_count: 1,
            has_more: false,
            limit: 50,
            offset: 0,
          });
        },
      },
    ]);
    const { container } = renderApp(['/chat/142']);
    await screen.findByText('old reply');
    const scroll = timelineScroll(container);
    const metrics = installScrollMetrics(scroll, { height: 2000, client: 500, top: 1000 });
    fireEvent.scroll(scroll);

    const textbox = screen.getByRole('textbox', { name: '消息输入框' });
    fireEvent.change(textbox, { target: { value: 'question' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    expect(await screen.findByRole('button', { name: '返回最新位置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回最新消息' })).toBeInTheDocument();
    expect(canonicalGets).toBe(1);

    metrics.setTop(1500);
    fireEvent.scroll(scroll);
    await screen.findByText('canonical reply');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '返回最新位置' })).toBeNull();
      expect(screen.queryByRole('button', { name: '返回最新消息' })).toBeNull();
    });
    expect(canonicalGets).toBe(2);
  });
});
