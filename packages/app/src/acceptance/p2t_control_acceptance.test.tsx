import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MessageVoiceControl } from '../features/chat/tts/MessageVoiceControl';
import { globalAudioPlaybackManager } from '../features/chat/audio/audioPlaybackManager';
import { installFetch, jsonResponse, renderV4 } from '../test/helpers';

function playableTransport() {
  return installFetch([{
    test: /^\/api\/agents\/conversations\/7\/messages\/\d+\/tts\/$/,
    method: 'POST',
    handler: (url) => jsonResponse({
      status: 'playable',
      content_url: `${url.pathname}content/`,
      duration_ms: 120000,
    }),
  }]);
}

function mediaHarness(playResult?: () => Promise<void>) {
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    const result = playResult ? playResult() : Promise.resolve();
    if (!playResult) this.dispatchEvent(new Event('play'));
    return result;
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => 120,
  });
  return { play, pause };
}

function control(messageId: number, directed = false) {
  return <MessageVoiceControl conversationId={7} messageId={messageId}
    voice={{ available: true, directed, cached: true }} />;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  globalAudioPlaybackManager.play('__acceptance_reset__', () => undefined);
  globalAudioPlaybackManager.stop('__acceptance_reset__');
});

describe('P2T CP2 independent control invariants', () => {
  it('remains lazy even when the read projection says cached', () => {
    const { calls } = playableTransport();
    const { play } = mediaHarness();
    renderV4(control(71));
    expect(screen.getByRole('button', { name: '朗读此条消息' })).toBeTruthy();
    expect(calls).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
  });

  it('directed changes only the existing button modifier, not its semantics or tree', () => {
    playableTransport();
    mediaHarness();
    const ordinary = renderV4(control(71, false));
    const a = ordinary.getByRole('button', { name: '朗读此条消息' });
    const ordinaryShape = { text: a.textContent, title: a.getAttribute('title'), aria: a.getAttribute('aria-label'), children: a.childElementCount };
    ordinary.unmount();
    const directed = renderV4(control(72, true));
    const b = directed.getByRole('button', { name: '朗读此条消息' });
    expect({ text: b.textContent, title: b.getAttribute('title'), aria: b.getAttribute('aria-label'), children: b.childElementCount }).toEqual(ordinaryShape);
    expect(a.className).not.toContain('--directed');
    expect(b.className).toContain('--directed');
  });

  it('two voice rows have one playback owner and the second pauses the first', async () => {
    playableTransport();
    const { pause } = mediaHarness();
    const view = renderV4(<>{control(71)}{control(72)}</>);
    const entries = screen.getAllByRole('button', { name: '朗读此条消息' });
    fireEvent.click(entries[0]);
    await screen.findByRole('button', { name: '暂停朗读' });
    const audios = view.container.querySelectorAll('audio');
    expect(audios).toHaveLength(1);
    const first = audios[0];
    fireEvent.click(entries[1]);
    await waitFor(() => expect(view.container.querySelectorAll('audio')).toHaveLength(2));
    await waitFor(() => expect(pause.mock.instances).toContain(first));
  });

  it('an autoplay policy rejection remains explicitly playable', async () => {
    playableTransport();
    mediaHarness(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    renderV4(control(71));
    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '播放朗读' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: '重试生成语音' })).toBeNull();
  });

  it('actively playing media is physically paused when its control unmounts', async () => {
    playableTransport();
    const { pause } = mediaHarness();
    const view = renderV4(control(71));
    fireEvent.click(screen.getByRole('button', { name: '朗读此条消息' }));
    await screen.findByRole('button', { name: '暂停朗读' });
    const audio = view.container.querySelector('audio');
    expect(audio).not.toBeNull();
    pause.mockClear();
    await act(async () => view.unmount());
    expect(pause.mock.instances).toContain(audio);
  });
});