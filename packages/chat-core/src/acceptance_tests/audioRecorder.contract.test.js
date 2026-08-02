import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: () => 'acceptance-csrf',
}));

import { useAudioRecorder } from '../hooks/useAudioRecorder.js';

function makeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] }, track };
}

function installRecorder({ supported = ['audio/webm;codecs=opus'], asyncStop = true } = {}) {
  class ContractMediaRecorder {
    static instances = [];
    static isTypeSupported(mime) {
      return supported.includes(mime);
    }

    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || '';
      this.state = 'inactive';
      ContractMediaRecorder.instances.push(this);
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      const emit = () => this.onstop?.();
      if (asyncStop) setTimeout(emit, 0);
      else emit();
    }

    emitData(data = new Blob(['voice'], { type: 'audio/webm' })) {
      this.ondataavailable?.({ data });
    }

    emitError() {
      this.onerror?.(new Event('error'));
    }
  }
  globalThis.MediaRecorder = ContractMediaRecorder;
  return ContractMediaRecorder;
}

function setSecureContext(value) {
  Object.defineProperty(globalThis, 'isSecureContext', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  setSecureContext(true);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:acceptance-audio'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete globalThis.MediaRecorder;
  delete globalThis.isSecureContext;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
});

describe('Frozen AUD-F recorder contract', () => {
  it('blocks recording in a non-secure context and exposes an HTTPS-specific error', async () => {
    setSecureContext(false);
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    installRecorder();
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('insecure_context');
    expect(result.current.errorMessage).toMatch(/HTTPS/i);
  });

  it('reports browser_unsupported when getUserMedia is absent', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    installRecorder();
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('browser_unsupported');
  });

  it('stops an acquired track and reports browser_unsupported when MediaRecorder is absent', async () => {
    const { stream, track } = makeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());

    expect(result.current.error).toBe('browser_unsupported');
    expect(track.stop).toHaveBeenCalledOnce();
    expect(result.current.blob).toBeNull();
  });

  it('rejects a browser with no frozen WebM MIME and stops the acquired track', async () => {
    const { stream, track } = makeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const Recorder = installRecorder({ supported: [] });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());

    expect(Recorder.instances).toHaveLength(0);
    expect(result.current.error).toBe('browser_unsupported');
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('manual cancel cannot be overwritten by a delayed recorder onstop callback', async () => {
    const { stream, track } = makeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const Recorder = installRecorder();
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    act(() => Recorder.instances[0].emitData());

    act(() => result.current.cancel());
    await act(async () => new Promise(resolve => setTimeout(resolve, 5)));

    expect(result.current.status).toBe('idle');
    expect(result.current.blob).toBeNull();
    expect(result.current.blobUrl).toBeNull();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('recorder runtime error remains an error and cannot create a clip via onstop', async () => {
    const { stream, track } = makeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const Recorder = installRecorder();
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    act(() => Recorder.instances[0].emitData());

    act(() => Recorder.instances[0].emitError());
    await act(async () => new Promise(resolve => setTimeout(resolve, 5)));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('recorder_error');
    expect(result.current.blob).toBeNull();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('unmount stops active tracks and does not publish a delayed clip', async () => {
    const { stream, track } = makeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const Recorder = installRecorder();
    const { result, unmount } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    act(() => Recorder.instances[0].emitData());

    unmount();
    await new Promise(resolve => setTimeout(resolve, 5));

    expect(track.stop).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('does not publish a zero-byte clip when recording produced no data', async () => {
    const { stream, track } = makeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    installRecorder();
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());

    act(() => result.current.stop());
    await act(async () => new Promise(resolve => setTimeout(resolve, 5)));

    expect(result.current.status).toBe('error');
    expect(result.current.blob).toBeNull();
    expect(result.current.blobUrl).toBeNull();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('manual stop publishes exactly one local playable clip and stops tracks', async () => {
    const { stream, track } = makeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const Recorder = installRecorder();
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    act(() => Recorder.instances[0].emitData());

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.status).toBe('recorded'));

    expect(result.current.blob).toBeInstanceOf(Blob);
    expect(result.current.blobUrl).toBe('blob:acceptance-audio');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
  });
});
