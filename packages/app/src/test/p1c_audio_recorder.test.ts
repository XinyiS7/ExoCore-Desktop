import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { pickSupportedMimeType, useAudioRecorder } from '../features/chat/audio/useAudioRecorder';
import { AUDIO_MIME_CANDIDATES } from '../features/chat/audio/types';

/** Simplified MediaRecorder fake that can emit delayed onstop. */
function installRecorder({ supported = ['audio/webm;codecs=opus'] } = {}) {
  class Rec {
    static instances: Rec[] = [];
    static isTypeSupported(m: string) {
      return supported.includes(m);
    }
    stream: MediaStream;
    mimeType: string;
    state = 'inactive';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(stream: MediaStream, options: { mimeType?: string } = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType ?? '';
      Rec.instances.push(this);
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      setTimeout(() => this.onstop?.(), 0);
    }
    emitData(data?: Blob) {
      this.ondataavailable?.({ data: data ?? new Blob(['voice'], { type: 'audio/webm' }) });
    }
    emitError() {
      this.onerror?.();
    }
  }
  globalThis.MediaRecorder = Rec as unknown as typeof MediaRecorder;
  return Rec;
}

function makeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

function installUserMedia(stream: MediaStream) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:builder-audio'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).MediaRecorder;
  delete (globalThis as Record<string, unknown>).isSecureContext;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('pickSupportedMimeType (AUD-F MIME allowlist)', () => {
  it('returns null when MediaRecorder is unavailable', () => {
    expect(pickSupportedMimeType()).toBeNull();
  });

  it('picks audio/webm;codecs=opus first when supported', () => {
    globalThis.MediaRecorder = { isTypeSupported: (m: string) => m === 'audio/webm;codecs=opus' } as never;
    expect(pickSupportedMimeType()).toBe('audio/webm;codecs=opus');
  });

  it('falls back to audio/webm when opus variant is unsupported', () => {
    globalThis.MediaRecorder = { isTypeSupported: (m: string) => m === 'audio/webm' } as never;
    expect(pickSupportedMimeType()).toBe('audio/webm');
  });

  it('rejects any MIME outside the frozen candidates', () => {
    globalThis.MediaRecorder = { isTypeSupported: (m: string) => m === 'audio/mp4' } as never;
    expect(pickSupportedMimeType()).toBeNull();
  });

  it('exposes the exact frozen candidate list order', () => {
    expect(AUDIO_MIME_CANDIDATES).toEqual(['audio/webm;codecs=opus', 'audio/webm']);
  });
});

describe('useAudioRecorder (frozen AUD-F contract)', () => {
  it('rejects insecure contexts with a stable error', async () => {
    Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: false });
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('insecure_context');
    expect(result.current.errorMessage).toContain('HTTPS');
  });

  it('rejects missing getUserMedia', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('browser_unsupported');
  });

  it('rejects unsupported WebM MIME and releases the track', async () => {
    installRecorder({ supported: [] });
    const { stream, track } = makeStream();
    installUserMedia(stream);
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('browser_unsupported');
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('serializes repeated Start while microphone permission is pending', async () => {
    const Rec = installRecorder();
    const { stream, track } = makeStream();
    let resolvePermission: ((value: MediaStream) => void) | null = null;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolvePermission = resolve; }));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const { result } = renderHook(() => useAudioRecorder());

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.start();
      second = result.current.start();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePermission?.(stream);
      await Promise.all([first, second]);
    });
    expect(Rec.instances).toHaveLength(1);
    expect(result.current.status).toBe('recording');
    result.current.cancel();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('records a clip: data → stop → recorded with blob URL', async () => {
    const Rec = installRecorder();
    const { stream } = makeStream();
    installUserMedia(stream);
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('recording');
    const rec = Rec.instances[0] as unknown as { emitData: (b?: Blob) => void };
    await act(async () => {
      rec.emitData(new Blob(['voice'], { type: 'audio/webm;codecs=opus' }));
      result.current.stop();
    });
    await act(async () => {
      vi.runAllTimers();
    });
    expect(result.current.status).toBe('recorded');
    expect(result.current.blobUrl).toBe('blob:builder-audio');
    expect(result.current.mimeType).toBe('audio/webm;codecs=opus');
  });

  it('rejects zero-byte clips and revokes resources', async () => {
    const Rec = installRecorder();
    const { stream, track } = makeStream();
    installUserMedia(stream);
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    const rec = Rec.instances[0] as unknown as { emitData: (b?: Blob) => void };
    await act(async () => {
      rec.emitData(new Blob([], { type: 'audio/webm' }));
      result.current.stop();
      vi.runAllTimers();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('empty_clip');
    expect(result.current.blobUrl).toBeNull();
    expect(track.stop).toHaveBeenCalled();
  });

  it('ignores a delayed onstop after cancel (epoch guard)', async () => {
    const Rec = installRecorder();
    const { stream } = makeStream();
    installUserMedia(stream);
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    const rec = Rec.instances[0] as unknown as { emitData: (b?: Blob) => void };
    rec.emitData(new Blob(['voice'], { type: 'audio/webm' }));
    await act(async () => {
      result.current.cancel();
    });
    expect(result.current.status).toBe('idle');
    // Late onstop fires now — must NOT resurrect the clip.
    await act(async () => {
      vi.runAllTimers();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.blobUrl).toBeNull();
  });

  it('stops an obsolete delayed permission grant after cancel and a new start', async () => {
    const Rec = installRecorder();
    const old = makeStream();
    const fresh = makeStream();
    let resolveOld: ((value: MediaStream) => void) | null = null;
    const getUserMedia = vi
      .fn()
      .mockImplementationOnce(() => new Promise<MediaStream>((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(fresh.stream);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    const { result } = renderHook(() => useAudioRecorder());

    let oldStart!: Promise<void>;
    act(() => { oldStart = result.current.start(); });
    act(() => result.current.cancel());
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe('recording');
    expect(Rec.instances).toHaveLength(1);

    await act(async () => {
      resolveOld?.(old.stream);
      await oldStart;
    });
    expect(old.track.stop).toHaveBeenCalledTimes(1);
    expect(fresh.track.stop).not.toHaveBeenCalled();
  });

  it('ignores canceled recorder data when a later attempt is recording', async () => {
    const Rec = installRecorder();
    const first = makeStream();
    const second = makeStream();
    const getUserMedia = vi.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => { await result.current.start(); });
    const oldRecorder = Rec.instances[0];
    act(() => result.current.cancel());
    await act(async () => { await result.current.start(); });
    const newRecorder = Rec.instances[1];

    oldRecorder.emitData(new Blob(['OLD'], { type: 'audio/webm' }));
    newRecorder.emitData(new Blob(['NEW'], { type: 'audio/webm' }));
    await act(async () => {
      result.current.stop();
      vi.runAllTimers();
    });
    expect(result.current.blob?.size).toBe(3);
    expect(first.track.stop).toHaveBeenCalled();
    expect(second.track.stop).toHaveBeenCalled();
  });

  it('maps permission/no-device errors to stable codes', async () => {
    installRecorder();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
      },
    });
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.error).toBe('permission_denied');

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('none'), { name: 'NotFoundError' })),
      },
    });
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.error).toBe('no_microphone');
  });

  it('auto-stops at the 60 second cap', async () => {
    const Rec = installRecorder();
    const { stream } = makeStream();
    installUserMedia(stream);
    const { result } = renderHook(() => useAudioRecorder(60000));
    await act(async () => {
      await result.current.start();
    });
    const rec = Rec.instances[0] as unknown as { emitData: (b?: Blob) => void };
    rec.emitData(new Blob(['voice'], { type: 'audio/webm' }));
    await act(async () => {
      vi.advanceTimersByTime(61000);
    });
    await act(async () => {
      vi.runAllTimers();
    });
    expect(result.current.status).toBe('recorded');
    expect(Rec.instances[0].state).toBe('inactive');
  });

  it('unmount releases tracks and revokes the blob URL', async () => {
    const Rec = installRecorder();
    const { stream } = makeStream();
    installUserMedia(stream);
    const { result, unmount } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    const rec = Rec.instances[0] as unknown as { emitData: (b?: Blob) => void };
    rec.emitData(new Blob(['voice'], { type: 'audio/webm' }));
    await act(async () => {
      result.current.stop();
      vi.runAllTimers();
    });
    expect(result.current.status).toBe('recorded');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:builder-audio');
  });
});