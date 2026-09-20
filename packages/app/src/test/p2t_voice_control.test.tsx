/**
 * P2T CP 2T-2 construction tests — control, playback and `directed` visuals.
 *
 * Frozen gates: acceptance spec T5–T8 and Plan §7 CP2. The transport is
 * driven through the real adapter boundary (mocked `fetch`); the observation
 * loop additionally gets a direct harness so the 90-second bound can be
 * exercised without waiting for wall-clock minutes. `stubMedia` is copied
 * from the P1C suite on purpose — that file must not be modified.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { installFetch, jsonResponse, renderV4, type MockRoute } from './helpers';
import { MessageTimeline, type MessageTimelineProps } from '../features/chat/MessageTimeline';
import {
  MessageVoiceControl,
  type MessageVoiceControlProps,
} from '../features/chat/tts/MessageVoiceControl';
import { useMessageVoice, type MessageVoiceAdapters } from '../features/chat/tts/useMessageVoice';
import type { TtsOutcome } from '../features/chat/tts/types';
import { AudioPlayerBubble } from '../features/chat/audio/AudioPlayerBubble';
import { globalAudioPlaybackManager } from '../features/chat/audio/audioPlaybackManager';
import type { MessageView, VoiceProjection } from '../features/chat/types';

// ── jsdom media stubs (copied from p1c_historical_rendering.test.tsx) ───────

function stubMedia(playImpl?: () => Promise<void>) {
  const play = vi.fn(playImpl ?? (() => Promise.resolve()));
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
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: play,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: pause,
  });
  return { play, pause };
}

// ── fixtures ────────────────────────────────────────────────────────────────

const SAME_ORIGIN_AUDIO = '/api/agents/conversations/7/messages/71/tts/content/';
const TTS_PATH = /^\/api\/agents\/conversations\/7\/messages\/\d+\/tts\/$/;

const voiceFor = (over: Partial<VoiceProjection> = {}): VoiceProjection => ({
  available: true,
  directed: false,
  cached: false,
  ...over,
});

const msg = (id: number, over: Partial<MessageView> = {}): MessageView => ({
  id,
  role: 'assistant',
  content: `answer ${id}`,
  reasoningContent: null,
  platform: null,
  modelVersion: null,
  tokenCount: null,
  indexInSession: 0,
  attachmentIds: [],
  attachmentsMeta: [],
  createdAt: '2026-09-12T10:00:00Z',
  voice: voiceFor(),
  ...over,
});

const audioMeta = () => ({
  id: 2,
  display_name: 'voice.webm',
  original_filename: 'recording.webm',
  mime_type: 'audio/webm',
  file_size: 15420,
  file_uri: 'https://remote.invalid/expiring.webm',
  content_url: '/api/agents/conversations/42/attachments/2/content/',
});

function ttsFetch(post: MockRoute['handler'], get?: MockRoute['handler']) {
  return installFetch([
    { test: TTS_PATH, method: 'POST', handler: post },
    { test: TTS_PATH, method: 'GET', handler: get ?? (() => jsonResponse({ status: 'idle' })) },
  ]);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Flush React passive effects before driving native `<audio>` events: the
 * media listeners are attached in an effect, and jsdom never dispatches
 * media events on its own, so firing before the flush would be swallowed.
 */
async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderControl(props: Partial<MessageVoiceControlProps> = {}) {
  return renderV4(
    <MessageVoiceControl conversationId={7} messageId={71} voice={voiceFor()} {...props} />,
  );
}

function renderTimeline(messages: MessageView[], extra: Partial<MessageTimelineProps> = {}) {
  return renderV4(
    <MessageTimeline
      messages={messages}
      conversationId={7}
      hasOlder={false}
      loadingMore={false}
      onLoadMore={() => undefined}
      {...extra}
    />,
  );
}

const ttsCalls = (calls: { url: URL; init?: RequestInit }[]) =>
  calls.filter((call) => call.url.pathname.endsWith('/tts/'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Release the module-level playback owner between tests.
  globalAudioPlaybackManager.play('__test_reset__', () => undefined);
  globalAudioPlaybackManager.stop('__test_reset__');
});

// ── T5 — lazy lifecycle ─────────────────────────────────────────────────────

describe('T5 — voice lifecycle stays click-driven', () => {
  it('exposes the entry only for eligible assistant rows and never auto-requests', () => {
    const { play } = stubMedia();
    const { calls } = ttsFetch(() => jsonResponse({ status: 'idle' }));
    renderTimeline([
      msg(71, { voice: voiceFor({ cached: true }) }),
      msg(72, { voice: voiceFor({ available: false }) }),
      msg(73, { voice: null }),
      msg(74, { role: 'user', voice: voiceFor() }),
    ]);
    expect(screen.getAllByRole('button', { name: '朗读此条消息' }).length).toBe(1);
    expect(calls.length).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  it('mounts inside the actions cluster, ahead of the branch action', () => {
    stubMedia();
    ttsFetch(() => jsonResponse({ status: 'idle' }));
    renderTimeline([msg(71)], { onBranchMessage: () => undefined });

    const entry = screen.getByRole('button', { name: '朗读此条消息' });
    const cluster = entry.closest('.app-msg-actions');
    expect(cluster).not.toBeNull();
    const branch = screen.getByRole('button', { name: '从该回答派生新会话' });
    expect(cluster?.contains(branch)).toBe(true);
    // Voice control precedes the existing row actions in DOM order (D5).
    expect(entry.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No second `margin-left: auto` sibling was introduced (D5).
    expect(cluster?.children.length).toBe(2);
  });

  it('never renders the control for the runtime overlay or the optimistic row', () => {
    ttsFetch(() => jsonResponse({ status: 'idle' }));
    renderTimeline([msg(71)], {
      runtimeAssistant: {
        kind: 'client_assistant',
        clientKey: 'client_assistant_1',
        content: 'partial answer',
        thinking: '',
        isStreaming: true,
      },
      optimisticUser: {
        kind: 'client_user',
        clientKey: 'client_user_1',
        content: 'pending question',
        createdAt: '2026-09-12T10:00:01Z',
        pendingAttachmentIds: [],
        priorUserIndexInSession: null,
      },
    });
    expect(screen.getAllByRole('button', { name: '朗读此条消息' }).length).toBe(1);
  });

  it('starts one request per click and observes retry_after_ms until playable', async () => {
    const { play } = stubMedia();
    let gets = 0;
    const { calls } = ttsFetch(
      () => jsonResponse({ status: 'generating', retry_after_ms: 5 }, 202),
      () => {
        gets += 1;
        return gets === 1
          ? jsonResponse({ status: 'generating', retry_after_ms: 5 }, 202)
          : jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO, duration_ms: 4200 });
      },
    );
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    const generating = screen.getByRole('button', { name: '语音生成中' });
    expect((generating as HTMLButtonElement).disabled).toBe(true);
    expect(generating.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('slider')).toBeNull();

    await screen.findByRole('button', { name: '播放朗读' });
    const sequence = ttsCalls(calls).map((call) => call.init?.method ?? 'GET');
    expect(sequence).toEqual(['POST', 'GET', 'GET']);
    expect(ttsCalls(calls)[0].init?.body).toBe('{}');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('collapses rapid repeat clicks into a single in-flight request', async () => {
    stubMedia();
    const post = deferred<Response>();
    const { calls } = ttsFetch(() => post.promise, () => jsonResponse({ status: 'idle' }));
    renderControl();

    const entry = screen.getByRole('button', { name: '朗读此条消息' });
    fireEvent.click(entry);
    fireEvent.click(entry);
    await waitFor(() => expect(ttsCalls(calls).length).toBe(1));
    expect(ttsCalls(calls)[0].init?.method).toBe('POST');

    post.resolve(jsonResponse({ status: 'idle' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '朗读此条消息' })).toBeTruthy());
  });

  it('GET idle resets to the entry state and a later click starts a new request', async () => {
    stubMedia();
    let posts = 0;
    const { calls } = ttsFetch(
      () => {
        posts += 1;
        return jsonResponse({ status: 'generating', retry_after_ms: 5 }, 202);
      },
      () => jsonResponse({ status: 'idle' }),
    );
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await waitFor(() => expect(ttsCalls(calls).length).toBe(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: '语音生成中' })).toBeNull());
    expect(screen.getByRole('button', { name: '朗读此条消息' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await waitFor(() => expect(posts).toBe(2));
  });

  it('unmount aborts the flow and drops the late response', async () => {
    stubMedia();
    const get = deferred<Response>();
    const { calls } = ttsFetch(
      () => jsonResponse({ status: 'generating', retry_after_ms: 5 }, 202),
      () => get.promise,
    );
    const { unmount } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await waitFor(() => expect(ttsCalls(calls).length).toBe(2));
    const getCall = ttsCalls(calls)[1];
    expect(getCall.init?.signal?.aborted).toBe(false);

    unmount();
    expect(getCall.init?.signal?.aborted).toBe(true);
    get.resolve(jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.querySelector('audio')).toBeNull();
  });

  it("cannot write a previous identity's late response into the next identity", async () => {
    const { play } = stubMedia();
    const get = deferred<Response>();
    const { calls } = ttsFetch(
      () => jsonResponse({ status: 'generating', retry_after_ms: 5 }, 202),
      () => get.promise,
    );

    function IdentitySwitch() {
      const [messageId, setMessageId] = useState(71);
      return (
        <>
          <button type="button" onClick={() => setMessageId(72)}>
            switch-identity
          </button>
          <MessageVoiceControl conversationId={7} messageId={messageId} voice={voiceFor()} />
        </>
      );
    }

    renderV4(<IdentitySwitch />);
    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await waitFor(() => expect(ttsCalls(calls).length).toBe(2));

    // Same component instance, new Message identity: the open flow is dropped.
    fireEvent.click(screen.getByRole('button', { name: 'switch-identity' }));
    expect(screen.getByRole('button', { name: '朗读此条消息' })).toBeTruthy();

    get.resolve(jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(screen.queryByRole('button', { name: '播放朗读' })).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('stays usable while a chat run is active (no operation-lock coupling)', async () => {
    stubMedia();
    const { calls } = ttsFetch(
      () => jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO }),
      () => jsonResponse({ status: 'idle' }),
    );
    renderTimeline([msg(71)], { isRunActive: true });

    const entry = screen.getByRole('button', { name: '朗读此条消息' });
    expect((entry as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(entry);
    await screen.findByRole('button', { name: '播放朗读' });
    expect(ttsCalls(calls).some((call) => call.init?.method === 'POST')).toBe(true);
  });
});

// ── observation loop (direct hook drive) ────────────────────────────────────

function VoiceHarness({
  adapters,
  observationLimitMs = 40,
}: {
  adapters: MessageVoiceAdapters;
  observationLimitMs?: number;
}) {
  const api = useMessageVoice({
    conversationId: 7,
    messageId: 71,
    voice: voiceFor(),
    adapters,
    observationLimitMs,
  });
  return (
    <div>
      <span data-testid="phase">{api.phase}</span>
      <span data-testid="token">{api.playToken}</span>
      <button type="button" onClick={api.request}>
        go
      </button>
    </div>
  );
}

describe('T5 — observation bound and retry truth', () => {
  it('stops observing at the bound and stays retryable', async () => {
    const start = vi.fn(async (): Promise<TtsOutcome> => ({ phase: 'generating', retryAfterMs: 5 }));
    const read = vi.fn(async (): Promise<TtsOutcome> => ({ phase: 'generating', retryAfterMs: 5 }));
    renderV4(<VoiceHarness adapters={{ start, read }} />);
    expect(screen.getByTestId('phase').textContent).toBe('idle');

    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('failed_retryable'), {
      timeout: 2000,
    });
    expect(start).toHaveBeenCalledTimes(1);
    const observations = read.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(read.mock.calls.length).toBe(observations);
    expect(screen.getByTestId('phase').textContent).toBe('failed_retryable');
  });

  it('ends a hung transport at the bound as a retryable timeout', async () => {
    let resolveLate: (value: TtsOutcome) => void = () => undefined;
    const read = vi.fn(
      () =>
        new Promise<TtsOutcome>((resolve) => {
          resolveLate = resolve;
        }),
    );
    const adapters: MessageVoiceAdapters = {
      start: vi.fn(async (): Promise<TtsOutcome> => ({ phase: 'generating', retryAfterMs: 1 })),
      read,
    };
    renderV4(<VoiceHarness adapters={adapters} observationLimitMs={60} />);

    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('failed_retryable'), {
      timeout: 2000,
    });
    // A transport that ignores the abort cannot write a late truth over it.
    resolveLate({
      phase: 'playable',
      playable: { contentUrl: SAME_ORIGIN_AUDIO, durationMs: null },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByTestId('phase').textContent).toBe('failed_retryable');
    expect(screen.getByTestId('token').textContent).toBe('0');
  });

  it('honours retry_after_ms instead of busy-spinning the observation', async () => {
    const read = vi.fn(() => new Promise<TtsOutcome>(() => undefined));
    const adapters: MessageVoiceAdapters = {
      start: vi.fn(async (): Promise<TtsOutcome> => ({ phase: 'generating', retryAfterMs: 60 })),
      read,
    };
    renderV4(<VoiceHarness adapters={adapters} observationLimitMs={5000} />);

    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(read).not.toHaveBeenCalled();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1), { timeout: 1500 });
  });

  it('mints a new play token for every click-originated playable arrival', async () => {
    let runs = 0;
    const adapters: MessageVoiceAdapters = {
      start: vi.fn(async (): Promise<TtsOutcome> => {
        runs += 1;
        return runs === 1
          ? { phase: 'failed_retryable', code: 'runtime_offline', message: null }
          : { phase: 'playable', playable: { contentUrl: SAME_ORIGIN_AUDIO, durationMs: null } };
      }),
      read: vi.fn(async (): Promise<TtsOutcome> => ({ phase: 'idle' })),
    };
    renderV4(<VoiceHarness adapters={adapters} />);

    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('failed_retryable'));
    expect(screen.getByTestId('token').textContent).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('playable'));
    expect(screen.getByTestId('token').textContent).toBe('1');
  });
});

// ── T6 — truthful UI ────────────────────────────────────────────────────────

describe('T6 — truthful states and failure copy', () => {
  it('keeps a bounded failure copy and an explicit retry path', async () => {
    stubMedia();
    let posts = 0;
    ttsFetch(
      () => {
        posts += 1;
        return posts === 1
          ? jsonResponse({ code: 'runtime_offline', message: 'daemon offline: private detail' }, 503)
          : jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO });
      },
      () => jsonResponse({ status: 'idle' }),
    );
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    const retry = await screen.findByRole('button', { name: '重试生成语音' });
    expect(retry.textContent).toContain('语音服务未就绪');
    expect(retry.textContent).not.toContain('private detail');
    // The bounded reason is real rendered UI text, not decoration: the state
    // modifier is what keeps it readable when narrow layouts hide the idle and
    // generating labels (F4 rework).
    expect(retry.className).toContain('app-voice-btn--failure');
    expect(retry.className).not.toContain('--directed');

    fireEvent.click(retry);
    await screen.findByRole('button', { name: '播放朗读' });
    expect(posts).toBe(2);
  });

  it('never invents a generation percentage or a cancel affordance', async () => {
    stubMedia();
    const post = deferred<Response>();
    ttsFetch(() => post.promise, () => jsonResponse({ status: 'idle' }));
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    expect(screen.getByRole('button', { name: '语音生成中' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /取消/ })).toBeNull();
    expect(document.body.textContent ?? '').not.toContain('%');

    post.resolve(jsonResponse({ status: 'idle' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '朗读此条消息' })).toBeTruthy());
  });

  it('treats a media error as retryable, never as endpoint-404 unavailability', async () => {
    stubMedia();
    let posts = 0;
    ttsFetch(
      () => {
        posts += 1;
        return jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO });
      },
      () => jsonResponse({ status: 'idle' }),
    );
    const { container } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '播放朗读' });
    await flushEffects();
    const audio = container.querySelector('audio')!;
    const pauseSpy = vi.spyOn(audio, 'pause');
    fireEvent.error(audio);

    const retry = await screen.findByRole('button', { name: '重试生成语音' });
    // Resource loss releases physically too (F2).
    expect(pauseSpy).toHaveBeenCalled();
    expect(retry.textContent).toContain('音频加载失败');
    expect(retry.className).toContain('app-voice-btn--failure');
    fireEvent.click(retry);
    await screen.findByRole('button', { name: '播放朗读' });
    expect(posts).toBe(2);
  });

  it('records a playback policy rejection without faking success or synthesis failure', async () => {
    const play = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      .mockResolvedValue(undefined);
    stubMedia(play);
    ttsFetch(
      () => jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO }),
      () => jsonResponse({ status: 'idle' }),
    );
    const { container } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    await act(async () => {});
    // Synthesis succeeded and the artifact is still playable…
    expect(screen.queryByRole('button', { name: '重试生成语音' })).toBeNull();
    // …and the blocked autoplay is never painted as playing.
    expect(screen.queryByRole('button', { name: '暂停朗读' })).toBeNull();
    expect(screen.getByRole('button', { name: '播放朗读' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '播放朗读' }));
    await flushEffects();
    fireEvent.play(container.querySelector('audio')!);
    await waitFor(() => expect(screen.getByRole('button', { name: '暂停朗读' })).toBeTruthy());
  });

  it('refuses a non-same-origin content URL as a retryable artifact failure', async () => {
    stubMedia();
    ttsFetch(
      () => jsonResponse({ status: 'playable', content_url: 'https://foreign.example/voice.wav' }),
      () => jsonResponse({ status: 'idle' }),
    );
    const { container } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    const retry = await screen.findByRole('button', { name: '重试生成语音' });
    expect(retry.textContent).toContain('音频加载失败');
    expect(container.querySelector('audio')).toBeNull();
  });
});

// ── T7 — compact player and directing ───────────────────────────────────────

describe('T7 — compact player and `directed` visuals', () => {
  it('adds only a visual modifier for directed rows', () => {
    ttsFetch(() => jsonResponse({ status: 'idle' }));
    renderTimeline([
      msg(71, { voice: voiceFor({ directed: false }) }),
      msg(72, { voice: voiceFor({ directed: true }) }),
    ]);

    const buttons = screen.getAllByRole('button', { name: '朗读此条消息' });
    expect(buttons.length).toBe(2);
    const [plain, directed] = buttons;
    expect(plain.className).toBe('app-voice-btn');
    expect(directed.className).toBe('app-voice-btn app-voice-btn--directed');
    expect(directed.outerHTML.replace(' app-voice-btn--directed', '')).toBe(plain.outerHTML);
  });

  it('keeps directed visual-only in the retryable failure state too', async () => {
    stubMedia();
    ttsFetch(() => jsonResponse({ detail: 'runtime offline' }, 503));
    const { unmount } = renderControl({ voice: voiceFor({ directed: false }) });
    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    const plain = await screen.findByRole('button', { name: '重试生成语音' });
    const plainHtml = plain.outerHTML;
    expect(plain.className).toBe('app-voice-btn app-voice-btn--failure');
    unmount();

    renderControl({ voice: voiceFor({ directed: true }) });
    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    const directed = await screen.findByRole('button', { name: '重试生成语音' });
    expect(directed.className).toBe('app-voice-btn app-voice-btn--failure app-voice-btn--directed');
    expect(directed.outerHTML.replace(' app-voice-btn--directed', '')).toBe(plainHtml);
  });

  it('seeks the real media element by pointer and keyboard under the frozen slider name', async () => {
    stubMedia();
    ttsFetch(
      () => jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO, duration_ms: 4200 }),
      () => jsonResponse({ status: 'idle' }),
    );
    const { container } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '播放朗读' });
    const slider = screen.getByRole('slider', { name: '朗读进度' });
    // Pre-metadata: the allowed backend duration hint seeds the total (D8).
    expect(slider.getAttribute('aria-valuemax')).toBe('4');

    const audio = container.querySelector('audio')!;
    await flushEffects();
    fireEvent.loadedMetadata(audio);
    expect(slider.getAttribute('aria-valuemax')).toBe('120');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(audio.currentTime).toBe(5);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(audio.currentTime).toBe(0);

    const rect = { left: 0, width: 200 };
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    fireEvent.click(slider, { clientX: 100 });
    expect(audio.currentTime).toBeCloseTo(60, 0);
    expect(slider.getAttribute('aria-valuetext')).toContain('共');
  });
});

// ── T8 — single playback owner ──────────────────────────────────────────────

describe('T8 — playback ownership', () => {
  it('shares one playback owner with attachment audio in both directions', async () => {
    stubMedia();
    ttsFetch(
      () => jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO }),
      () => jsonResponse({ status: 'idle' }),
    );
    const { container } = renderV4(
      <>
        <MessageVoiceControl conversationId={7} messageId={71} voice={voiceFor()} />
        <AudioPlayerBubble meta={audioMeta()} />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '播放朗读' });
    const audios = container.querySelectorAll('audio');
    expect(audios.length).toBe(2);
    const [ttsAudio, bubbleAudio] = [audios[0], audios[1]];
    await flushEffects();
    fireEvent.loadedMetadata(bubbleAudio);

    fireEvent.play(ttsAudio);
    await waitFor(() => expect(screen.getByRole('button', { name: '暂停朗读' })).toBeTruthy());

    // Attachment audio claims playback → the manager pauses the TTS element.
    const ttsPause = vi.spyOn(ttsAudio, 'pause');
    fireEvent.click(screen.getByRole('button', { name: /播放语音/ }));
    fireEvent.play(bubbleAudio);
    expect(ttsPause).toHaveBeenCalled();

    // TTS claims ownership back → the attachment element is paused.
    fireEvent.pause(ttsAudio);
    await waitFor(() => expect(screen.getByRole('button', { name: '播放朗读' })).toBeTruthy());
    const bubblePause = vi.spyOn(bubbleAudio, 'pause');
    fireEvent.click(screen.getByRole('button', { name: '播放朗读' }));
    fireEvent.play(ttsAudio);
    expect(bubblePause).toHaveBeenCalled();
  });

  it('releases playback ownership on unmount and physically pauses the element', async () => {
    stubMedia();
    ttsFetch(
      () => jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO }),
      () => jsonResponse({ status: 'idle' }),
    );
    const seen: (string | null)[] = [];
    const unsubscribe = globalAudioPlaybackManager.subscribe((activeId) => seen.push(activeId));
    const { container, unmount } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '播放朗读' });
    await flushEffects();
    const audio = container.querySelector('audio')!;
    const pauseSpy = vi.spyOn(audio, 'pause');
    fireEvent.play(audio);
    await waitFor(() => expect(seen[seen.length - 1]).toBe('tts_7_71'));

    unmount();
    // A detached media element keeps sounding on its own: cleanup must pause
    // the exact owned element, not only clear manager bookkeeping (F2).
    // Repeated idempotent pauses are harmless; the probe requires membership.
    expect(pauseSpy).toHaveBeenCalled();
    expect(seen[seen.length - 1]).toBeNull();
    unsubscribe();
  });

  it('physically pauses the owned element when the row identity changes mid-playback', async () => {
    stubMedia();
    ttsFetch(
      () => jsonResponse({ status: 'playable', content_url: SAME_ORIGIN_AUDIO }),
      () => jsonResponse({ status: 'idle' }),
    );
    const seen: (string | null)[] = [];
    const unsubscribe = globalAudioPlaybackManager.subscribe((activeId) => seen.push(activeId));

    function IdentitySwitch() {
      const [messageId, setMessageId] = useState(71);
      return (
        <>
          <button type="button" onClick={() => setMessageId(72)}>
            switch-identity
          </button>
          <MessageVoiceControl conversationId={7} messageId={messageId} voice={voiceFor()} />
        </>
      );
    }

    const { container } = renderV4(<IdentitySwitch />);
    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '播放朗读' });
    await flushEffects();
    const audio = container.querySelector('audio')!;
    const pauseSpy = vi.spyOn(audio, 'pause');
    fireEvent.play(audio);
    await waitFor(() => expect(seen[seen.length - 1]).toBe('tts_7_71'));

    fireEvent.click(screen.getByRole('button', { name: 'switch-identity' }));
    expect(pauseSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '朗读此条消息' })).toBeTruthy();
    await waitFor(() => expect(seen[seen.length - 1]).toBeNull());
    unsubscribe();
  });
});
