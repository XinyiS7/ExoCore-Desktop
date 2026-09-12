/**
 * P2T CP 2T-3 construction tests — real-entry integration through
 * `ConversationPage` (Plan §7 CP3 items 1–2, acceptance spec T9/T10).
 *
 * These tests mount the production page behind the production route param and
 * drive only real user affordances: the timeline's voice control, the composer
 * and route navigation through router links. Route switching is provided by an
 * external test-owned `<nav>`: it plays the browser URL bar, it is not part of
 * the page under test.
 *
 * The jsdom media stub is copied locally on purpose — the P1C suite files are
 * frozen and must never be modified by this phase.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { installFetch, jsonResponse, unmockFetch, type MockRoute } from './helpers';
import { ConversationPage } from '../features/chat/ConversationPage';
import { globalAudioPlaybackManager } from '../features/chat/audio/audioPlaybackManager';

// ── jsdom media stubs (copied from the P1C suite on purpose) ────────────────

function stubMedia() {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => 120,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: function () {
      return this.__ct ?? 0;
    },
    set: function (v: number) {
      this.__ct = v;
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
  return { play, pause };
}

// ── fixtures ────────────────────────────────────────────────────────────────

const PRESET = {
  id: 5, name: 'Ecki', description: null, agent_type: 'standard',
  default_model: 'deepseek-v4-flash', system_prompt: null, is_visible: true,
};

const CATALOG = {
  models: [{ name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [7] }],
  endpoints: [{
    id: 7, name: 'DeepSeek', provider: 'deepseek', execution_type: 'direct_api',
    execution_adapter: 'internal_http', payload_format: 'openai', cache_transport: 'inline_chunk',
    attachment_transports: [], configured: true, enabled: true,
  }],
  roles: { main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }], support: {} },
  providers: [],
};

const conversation = (id: number) => ({
  id, name: `Conversation ${id}`, created_at: '2026-09-01T00:00:00Z', frozen_project_ids: [],
  project: 0, project_name: null, agent_type: 'standard', agent_preset_id: 5,
  last_message_at: null, thinking_level: 'auto', memory_injection_enabled: null,
});

const voice = (over: { available?: boolean; directed?: boolean; cached?: boolean } = {}) => ({
  available: true, directed: false, cached: false, ...over,
});

const mkMsg = (id: number, role: 'user' | 'assistant', content: string, voicePayload?: unknown) => ({
  id, role, content, reasoning_content: null, platform: 'deepseek', model_version: 'v4-flash',
  token_count: null, index_in_session: 0, attachment_ids: [], attachments_meta: null,
  created_at: '2026-09-12T10:00:00Z', ...(voicePayload === undefined ? {} : { voice: voicePayload }),
});

const page = (messages: unknown[], hasMore = false) =>
  jsonResponse({ messages, total_count: messages.length, has_more: hasMore });

const ttsPath = (messageId: number) => new RegExp(`^/api/agents/conversations/\\d+/messages/${messageId}/tts/$`);
const contentUrl = (conversationId: number, messageId: number) =>
  `/api/agents/conversations/${conversationId}/messages/${messageId}/tts/content/`;

function pageBase(id: number): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
    { test: '/api/core/model-catalog/', handler: () => jsonResponse(CATALOG) },
    { test: `/api/agents/conversations/${id}/`, handler: () => jsonResponse(conversation(id)) },
    { test: `/api/agents/conversations/${id}/cache/`, handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }) },
  ];
}

function ttsCalls(calls: { url: URL; init?: RequestInit }[], messageId: number) {
  return calls.filter((c) => c.url.pathname.endsWith(`/messages/${messageId}/tts/`));
}

function pageGets(calls: { url: URL; init?: RequestInit }[], conversationId: number) {
  return calls.filter((c) => c.url.pathname === `/api/agents/chat/${conversationId}/`
    && (c.init?.method ?? 'GET') === 'GET');
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * The production route tree for one page, plus an external test-owned
 * navigator standing in for the browser URL bar (T9 route switching).
 */
function renderConsole(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <nav aria-label="测试导航">
          <Link to="/chat/31">会话 31</Link>
          <Link to="/chat/32">会话 32</Link>
        </nav>
        <Routes>
          <Route path="chat/:conversationId" element={<ConversationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Consume a pending near-bottom reconciliation exactly like a reader would. */
function consumeReconcile(container: HTMLElement) {
  const scroller = container.querySelector('.app-scroll');
  if (scroller) fireEvent.scroll(scroller);
}

async function settle(ms = 20) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

afterEach(() => {
  cleanup();
  unmockFetch();
  vi.restoreAllMocks();
  localStorage.clear();
});

// ── T9 routing and reconciliation ───────────────────────────────────────────

describe('P2T CP3 — route identity and non-destructive reconciliation (T9)', () => {
  it("cannot write or play route A's late terminal response into route B", async () => {
    stubMedia();
    const late = deferred<Response>();
    const ownership: (string | null)[] = [];
    const unsubscribe = globalAudioPlaybackManager.subscribe((id) => ownership.push(id));

    const { calls } = installFetch([
      ...pageBase(31),
      ...pageBase(32),
      { test: '/api/agents/chat/31/', handler: () => page([mkMsg(71, 'assistant', '答案 71', voice())]) },
      { test: '/api/agents/chat/32/', handler: () => page([mkMsg(81, 'assistant', '答案 81', voice())]) },
      { test: ttsPath(71), method: 'POST', handler: () => jsonResponse({ status: 'generating', retry_after_ms: 5 }, 202) },
      // A transport that ignores the abort signal — the late response is real.
      { test: ttsPath(71), method: 'GET', handler: () => late.promise },
    ]);

    renderConsole('/chat/31');
    fireEvent.click(await screen.findByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '语音生成中' });
    await waitFor(() => expect(ttsCalls(calls, 71).filter((c) => c.init?.method === 'GET')).toHaveLength(1));
    const getsBeforeDeparture = ttsCalls(calls, 71).filter((c) => c.init?.method === 'GET').length;

    fireEvent.click(screen.getByRole('link', { name: '会话 32' }));
    await screen.findByText('答案 81');

    await act(async () => {
      late.resolve(jsonResponse({
        status: 'playable',
        content_url: contentUrl(31, 71),
        duration_ms: 4200,
      }));
      await Promise.resolve();
    });
    await settle();

    // B renders only its own lazy entry: no inherited playable state…
    const row = screen.getByText('答案 81').closest('article') as HTMLElement;
    expect(within(row).getByRole('button', { name: '朗读此条消息' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '播放朗读' })).toBeNull();
    // …no media element and no playback ownership was ever taken or retained…
    expect(document.querySelectorAll('audio')).toHaveLength(0);
    expect(ownership.filter((id) => id !== null)).toHaveLength(0);
    // …and no request was ever issued for B's own message, nor polled again for A.
    expect(ttsCalls(calls, 81)).toHaveLength(0);
    expect(ttsCalls(calls, 71).filter((c) => c.init?.method === 'GET').length).toBe(getsBeforeDeparture);
    unsubscribe();
  });

  it('keeps the same row voice state across a non-destructive canonical replacement', async () => {
    stubMedia();
    const encoder = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let fresh = false;
    const row = mkMsg(71, 'assistant', '答案 71', voice());
    const { calls } = installFetch([
      ...pageBase(41),
      {
        test: '/api/agents/chat/41/',
        method: 'GET',
        handler: () => (fresh
          ? page([row, mkMsg(90, 'user', 'hello'), mkMsg(91, 'assistant', '运行后的回答')])
          : page([row])),
      },
      {
        test: '/api/agents/chat/41/',
        method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(streamController) {
            controller = streamController;
            streamController.enqueue(encoder.encode('event: content\ndata: 运行后的回答\n\n'));
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      { test: ttsPath(71), method: 'POST', handler: () => jsonResponse({ status: 'playable', content_url: contentUrl(41, 71), duration_ms: 5000 }) },
    ]);

    const { container } = renderConsole('/chat/41');
    const textbox = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: '消息输入框' });
    fireEvent.click(await screen.findByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '播放朗读' });

    // Ordinary send → terminal → canonical newest-window replacement.
    fireEvent.change(textbox, { target: { value: 'hello' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    fresh = true;
    await act(async () => {
      controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
      controller.close();
    });
    await screen.findByText('运行后的回答');
    consumeReconcile(container);
    await waitFor(() => expect(pageGets(calls, 41).length).toBeGreaterThanOrEqual(2));

    // The same row keeps its live playable control: no reset, no re-request.
    const rowEl = screen.getByText('答案 71').closest('article') as HTMLElement;
    expect(within(rowEl).getByRole('button', { name: '播放朗读' })).toBeTruthy();
    expect(ttsCalls(calls, 71).filter((c) => c.init?.method === 'POST')).toHaveLength(1);
    expect(container.querySelectorAll('audio')).toHaveLength(1);
  });
});

// ── T10 isolation and recovery ─────────────────────────────────────────────

describe('P2T CP3 — isolation, recovery and chat operability (T10)', () => {
  it('treats cached voice lazily and accepts exactly one POST on click', async () => {
    stubMedia();
    let posts = 0;
    installFetch([
      ...pageBase(51),
      { test: '/api/agents/chat/51/', handler: () => page([mkMsg(71, 'assistant', '答案 71', voice({ cached: true }))]) },
      {
        test: ttsPath(71),
        method: 'POST',
        handler: () => {
          posts += 1;
          return jsonResponse({ status: 'playable', content_url: contentUrl(51, 71), duration_ms: 3000 });
        },
      },
    ]);

    renderConsole('/chat/51');
    const entry = await screen.findByRole('button', { name: '朗读此条消息' });
    expect(posts).toBe(0); // cached is a projection fact, never an auto-request

    fireEvent.click(entry);
    await screen.findByRole('button', { name: '播放朗读' });
    expect(posts).toBe(1);
    await settle(40);
    expect(posts).toBe(1); // no second POST for an already playable row
  });

  it('keeps a media failure retryable, recovers on an explicit POST, and never touches list, scroll or runtime', async () => {
    stubMedia();
    let posts = 0;
    const { calls } = installFetch([
      ...pageBase(61),
      { test: '/api/agents/chat/61/', handler: () => page([mkMsg(71, 'assistant', '答案 71', voice())]) },
      {
        test: ttsPath(71),
        method: 'POST',
        handler: () => {
          posts += 1;
          return jsonResponse({ status: 'playable', content_url: contentUrl(61, 71), duration_ms: 3000 });
        },
      },
    ]);

    const { container } = renderConsole('/chat/61');
    fireEvent.click(await screen.findByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '播放朗读' });
    const audio = await waitFor(() => {
      const el = container.querySelector('audio');
      if (!el) throw new Error('playable row renders a media element');
      return el;
    });

    const scroller = container.querySelector('.app-scroll') as HTMLElement;
    scroller.scrollTop = 40;
    const getsBefore = pageGets(calls, 61).length;
    const articlesBefore = screen.getAllByRole('article').length;

    // The content artifact is gone: a media error is retryable, not unavailable.
    fireEvent.error(audio);
    const retry = await screen.findByRole('button', { name: '重试生成语音' });
    expect(retry.textContent).toContain('音频加载失败');
    expect(container.querySelectorAll('audio')).toHaveLength(0);

    // A second explicit POST recovers playback.
    fireEvent.click(retry);
    await screen.findByRole('button', { name: '播放朗读' });
    expect(posts).toBe(2);

    // No list refetch, no scroll disturbance, no injected assistant rows.
    expect(pageGets(calls, 61).length).toBe(getsBefore);
    expect(scroller.scrollTop).toBe(40);
    expect(screen.getAllByRole('article').length).toBe(articlesBefore);
  });

  it('turns an offline synthesis failure into a local retryable entry and leaves chat operable', async () => {
    stubMedia();
    let posts = 0;
    const { calls } = installFetch([
      ...pageBase(71),
      { test: '/api/agents/chat/71/', handler: () => page([mkMsg(71, 'assistant', '答案 71', voice())]) },
      {
        test: ttsPath(71),
        method: 'POST',
        handler: () => {
          posts += 1;
          return jsonResponse({ detail: 'runtime offline' }, 503);
        },
      },
    ]);

    renderConsole('/chat/71');
    fireEvent.click(await screen.findByRole('button', { name: '朗读此条消息' }));
    const retry = await screen.findByRole('button', { name: '重试生成语音' });
    expect(retry.textContent).toContain('语音服务未就绪');
    expect(posts).toBe(1);

    // Chat stays operable: the composer accepts input and the runtime is untouched.
    const textbox = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: '消息输入框' });
    fireEvent.change(textbox, { target: { value: 'still works' } });
    expect(textbox.value).toBe('still works');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(pageGets(calls, 71).length).toBe(1);
    expect(screen.queryByText(/重试同步|运行状态未知/)).toBeNull();
  });
});
