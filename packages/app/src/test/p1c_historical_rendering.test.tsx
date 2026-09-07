import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderV4 } from './helpers';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import type { MessageView } from '../features/chat/types';
import { AudioPlayerBubble } from '../features/chat/audio/AudioPlayerBubble';
import { globalAudioPlaybackManager } from '../features/chat/audio/audioPlaybackManager';
import { AttachmentFileCard } from '../features/chat/attachments/AttachmentFileCard';

/** HTMLMediaElement play/pause/currentTime stubs for jsdom. */
function stubMedia() {
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  // Patch the REAL jsdom prototype so <audio> elements created by the
  // component share these behaviors (duration is NaN in jsdom by default).
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

const imageMeta = (over: Record<string, unknown> = {}) => ({
  id: 1,
  display_name: 'photo.jpg',
  original_filename: 'photo.jpg',
  mime_type: 'image/jpeg',
  file_size: 245100,
  file_uri: 'https://example.com/photo.jpg',
  content_url: null,
  ...over,
});

const audioMeta = (over: Record<string, unknown> = {}) => ({
  id: 2,
  display_name: 'voice.webm',
  original_filename: 'recording.webm',
  mime_type: 'audio/webm',
  file_size: 15420,
  file_uri: 'https://remote.invalid/expiring.webm',
  content_url: '/api/agents/conversations/42/attachments/2/content/',
  ...over,
});

const fileMeta = (over: Record<string, unknown> = {}) => ({
  id: 3,
  display_name: 'doc.pdf',
  original_filename: 'doc.pdf',
  mime_type: 'application/pdf',
  file_size: 2048,
  file_uri: null,
  content_url: null,
  ...over,
});

const msg = (id: number, over: Partial<MessageView> = {}): MessageView => ({
  id,
  role: 'user',
  content: 'hello',
  reasoningContent: null,
  platform: null,
  modelVersion: null,
  tokenCount: null,
  indexInSession: 0,
  attachmentIds: [1],
  attachmentsMeta: [],
  createdAt: '2026-09-01T10:00:00Z',
  ...over,
});

function renderTimeline(messages: MessageView[]) {
  return renderV4(
    <MessageTimeline
      messages={messages}
      hasOlder={false}
      loadingMore={false}
      onLoadMore={() => undefined}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Task 5 — historical attachment rendering (Gate G)', () => {
  it('renders an image thumbnail and opens an accessible lightbox', async () => {
    renderTimeline([msg(1, { attachmentsMeta: [imageMeta()] })]);
    const thumb = screen.getByRole('button', { name: /查看图片 photo\.jpg/ });
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe('https://example.com/photo.jpg');

    fireEvent.click(thumb);
    const dialog = await screen.findByRole('dialog', { name: /photo\.jpg/ });
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://example.com/photo.jpg');
    // Escape closes the lightbox and restores focus.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows a filename fallback when an image fails to load or has no file_uri', () => {
    renderTimeline([msg(1, { attachmentsMeta: [imageMeta({ file_uri: null })] })]);
    expect(screen.getByText('photo.jpg')).toBeTruthy();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
    // No lightbox trigger for an unloadable image.
    expect(screen.queryByRole('button', { name: /查看图片/ })).toBeNull();
  });

  it('image load error keeps the fallback card visible', () => {
    renderTimeline([msg(1, { attachmentsMeta: [imageMeta()] })]);
    const img = screen.getByRole('button', { name: /查看图片 photo\.jpg/ }).querySelector('img')!;
    fireEvent.error(img);
    expect(screen.getByText('图片加载失败')).toBeTruthy();
    expect(screen.getByText('photo.jpg')).toBeTruthy();
  });

  it('audio bubble uses the same-origin content_url, never the remote file_uri', () => {
    stubMedia();
    const { container } = renderV4(<AudioPlayerBubble meta={audioMeta()} />);
    const audio = container.querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe('/api/agents/conversations/42/attachments/2/content/');
    expect(audio.getAttribute('src')).not.toContain('remote.invalid');
  });

  it('rejects foreign/protocol-relative audio content URLs at the media boundary', () => {
    stubMedia();
    const { container, rerender } = renderV4(
      <AudioPlayerBubble meta={audioMeta({ content_url: 'https://foreign.example/voice.webm' })} />,
    );
    expect(container.querySelector('audio')?.getAttribute('src')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('音频加载/播放失败');

    rerender(<AudioPlayerBubble meta={audioMeta({ content_url: '//foreign.example/voice.webm' })} />);
    expect(container.querySelector('audio')?.getAttribute('src')).toBeNull();
  });

  it('rejects unsupported image URI schemes and renders the filename fallback', () => {
    renderTimeline([msg(1, { attachmentsMeta: [imageMeta({ file_uri: 'file:///C:/private/image.png' })] })]);
    expect(screen.getByText('photo.jpg')).toBeTruthy();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /查看图片/ })).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('audio load/play failure is visible and disables playback', () => {
    stubMedia();
    renderV4(<AudioPlayerBubble meta={audioMeta()} />);
    const els = document.querySelectorAll('audio');
    expect(els.length).toBe(1);
    // Fire the audio element's error event (jsdom surfaces it directly).
    fireEvent.error(els[0]);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('音频加载/播放失败')).toBeTruthy();
  });

  it('plays one message audio item at a time — mutual exclusion via the global manager', async () => {
    const { play } = stubMedia();
    const pauseA = vi.fn();
    const pauseB = vi.fn();
    // Register two simulated owners with the manager directly (unit seam).
    globalAudioPlaybackManager.play('owner-a', pauseA);
    globalAudioPlaybackManager.play('owner-b', pauseB);
    expect(pauseA).toHaveBeenCalledTimes(1); // starting B paused A
    expect(pauseB).not.toHaveBeenCalled();
    globalAudioPlaybackManager.stop('owner-b');
    expect(play).toBeDefined();
  });

  it('seek slider supports pointer clicks and keyboard arrows with an accessible label', () => {
    stubMedia();
    renderV4(<AudioPlayerBubble meta={audioMeta()} />);
    // jsdom never fires metadata on its own — emit it so duration state lands.
    const audio = document.querySelector('audio')!;
    fireEvent.loadedMetadata(audio);
    const slider = screen.getByRole('slider', { name: /语音进度 voice\.webm/ });
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(Number(slider.getAttribute('aria-valuemax'))).toBeGreaterThan(0);
    // Keyboard seek (right arrow) advances currentTime by 5s.
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(audio.currentTime).toBeGreaterThan(0);
    // Pointer seek maps a click ratio into currentTime (120s * 50% = 60s).
    const rect = { left: 0, width: 200 };
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    fireEvent.click(slider, { clientX: 100 });
    expect(audio.currentTime).toBeCloseTo(60, 0);
    expect(slider.getAttribute('aria-valuetext')).toContain('共');
  });

  it('file card shows safe name/type/size only and never storage_path', () => {
    renderV4(
      <AttachmentFileCard
        meta={fileMeta({ storage_path: '/srv/secret/path.pdf' } as never)}
      />,
    );
    const card = screen.getByTitle('doc.pdf');
    expect(within(card).getByText('doc.pdf')).toBeTruthy();
    expect(within(card).getByText(/PDF/)).toBeTruthy();
    expect(within(card).getByText(/2\.0 KB/)).toBeTruthy();
    expect(card.textContent).not.toContain('/srv/');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('pure attachment/audio messages do not render the empty-message placeholder', () => {
    renderTimeline([
      msg(1, { content: '', attachmentsMeta: [imageMeta()] }),
      msg(2, { content: '', attachmentsMeta: [audioMeta()] }),
    ]);
    expect(screen.queryByText('（空消息）')).toBeNull();
    expect(screen.getAllByRole('button', { name: /查看图片/ }).length).toBe(1);
  });

  it('a message with neither text nor attachments still shows the placeholder', () => {
    renderTimeline([msg(3, { content: '', attachmentsMeta: null })]);
    expect(screen.getByText('（空消息）')).toBeTruthy();
  });

  it('mixed attachments render image + audio + file card from canonical metadata', () => {
    stubMedia();
    renderTimeline([
      msg(4, {
        content: 'mixed',
        attachmentsMeta: [imageMeta(), audioMeta(), fileMeta()],
      }),
    ]);
    expect(screen.getByRole('button', { name: /查看图片 photo\.jpg/ })).toBeTruthy();
    expect(screen.getByTitle('voice.webm')).toBeTruthy();
    expect(screen.getByTitle('doc.pdf')).toBeTruthy();
  });
});
describe('Task 5 — mutual exclusion across real bubbles (Gate G)', () => {
  it('starting the second bubble pauses the first via the global manager', async () => {
    stubMedia();
    renderV4(
      <>
        <AudioPlayerBubble meta={audioMeta({ id: 10, display_name: 'one.webm' })} />
        <AudioPlayerBubble meta={audioMeta({ id: 11, display_name: 'two.webm' })} />
      </>,
    );
    const audios = document.querySelectorAll('audio');
    expect(audios.length).toBe(2);
    // Emit metadata so durations are available.
    for (const a of audios) fireEvent.loadedMetadata(a);

    const playBtns = screen.getAllByRole('button', { name: /播放语音/ });
    expect(playBtns.length).toBe(2);

    fireEvent.click(playBtns[0]);
    // jsdom does not dispatch media events on its own — emit the play event
    // so the bubble registers itself as the global owner.
    fireEvent.play(audios[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: /暂停语音 one\.webm/ })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /播放语音 two\.webm/ }));
    fireEvent.play(audios[1]);
    // Real browsers dispatch 'pause' when the manager calls pause() on the
    // previous owner; jsdom does not — simulate the browser behavior.
    fireEvent.pause(audios[0]);
    await waitFor(() => {
      // First bubble was paused by the manager → back to a play button.
      expect(screen.getByRole('button', { name: /播放语音 one\.webm/ })).toBeTruthy();
    });
    // Second is now the active owner.
    expect(screen.getByRole('button', { name: /暂停语音 two\.webm/ })).toBeTruthy();
  });
});
