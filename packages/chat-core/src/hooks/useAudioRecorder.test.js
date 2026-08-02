import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// useAudioRecorder imports attachmentStorage which imports exo-shared.
vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: () => 'mock-csrf',
}));

import { pickSupportedMimeType, useAudioRecorder } from './useAudioRecorder.js';

// 简化 ContractMediaRecorder（Builder 版；真实行为模拟 delayed onstop）
function installRecorder({ supported = ['audio/webm;codecs=opus'] } = {}) {
  class Rec {
    static instances = [];
    static isTypeSupported(m) {
      return supported.includes(m);
    }

    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || '';
      this.state = 'inactive';
      Rec.instances.push(this);
    }

    start() { this.state = 'recording'; }

    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      setTimeout(() => this.onstop?.(), 0);
    }

    emitData(data = new Blob(['voice'], { type: 'audio/webm' })) {
      this.ondataavailable?.({ data });
    }

    emitError() {
      this.onerror?.(new Event('error'));
    }
  }
  globalThis.MediaRecorder = Rec;
  return Rec;
}

function makeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] }, track };
}

function installUserMedia(stream) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'isSecureContext', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:builder-audio'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.MediaRecorder;
  delete globalThis.isSecureContext;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
});

describe('pickSupportedMimeType', () => {
  it('returns null when MediaRecorder is unavailable (jsdom/node)', () => {
    expect(pickSupportedMimeType()).toBeNull();
  });

  it('picks audio/webm;codecs=opus first when supported', () => {
    globalThis.MediaRecorder = {
      isTypeSupported: m => m === 'audio/webm;codecs=opus',
    };
    expect(pickSupportedMimeType()).toBe('audio/webm;codecs=opus');
  });

  it('falls back to audio/webm when opus variant unsupported', () => {
    globalThis.MediaRecorder = {
      isTypeSupported: m => m === 'audio/webm',
    };
    expect(pickSupportedMimeType()).toBe('audio/webm');
  });

  it('returns null when no candidate is supported', () => {
    globalThis.MediaRecorder = { isTypeSupported: () => false };
    expect(pickSupportedMimeType()).toBeNull();
  });
});

describe('useAudioRecorder callback races (Builder runtime)', () => {
  it('cancel discards a delayed onstop clip and revokes nothing', async () => {
    const { stream, track } = makeStream();
    installUserMedia(stream);
    const Rec = installRecorder();
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());
    act(() => Rec.instances[0].emitData());
    act(() => result.current.cancel());
    await act(async () => new Promise(r => setTimeout(r, 5)));

    expect(result.current.status).toBe('idle');
    expect(result.current.blobUrl).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('recorder runtime error cannot publish a clip via delayed onstop', async () => {
    const { stream, track } = makeStream();
    installUserMedia(stream);
    const Rec = installRecorder();
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());
    act(() => Rec.instances[0].emitData());
    act(() => Rec.instances[0].emitError());
    await act(async () => new Promise(r => setTimeout(r, 5)));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('recorder_error');
    expect(result.current.blob).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('unmount stops active tracks and does not publish a delayed clip', async () => {
    const { stream, track } = makeStream();
    installUserMedia(stream);
    const Rec = installRecorder();
    const { result, unmount } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());
    act(() => Rec.instances[0].emitData());
    unmount();
    await new Promise(r => setTimeout(r, 5));

    expect(track.stop).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('zero-byte recording is rejected without publishing a clip', async () => {
    const { stream, track } = makeStream();
    installUserMedia(stream);
    installRecorder();
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());
    act(() => result.current.stop());
    await act(async () => new Promise(r => setTimeout(r, 5)));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('empty_clip');
    expect(result.current.blobUrl).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('manual stop publishes exactly one local clip and stops tracks', async () => {
    const { stream, track } = makeStream();
    installUserMedia(stream);
    const Rec = installRecorder();
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());
    act(() => Rec.instances[0].emitData());
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.status).toBe('recorded'));

    expect(result.current.blob).toBeInstanceOf(Blob);
    expect(result.current.blobUrl).toBe('blob:builder-audio');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('start() synchronous throw maps to recorder_error and stops the track (P0-R1)', async () => {
    const { stream, track } = makeStream();
    installUserMedia(stream);
    const Rec = installRecorder();
    Rec.prototype.start = function startThrow() { throw new Error('start failed'); };
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('recorder_error');
    expect(result.current.blob).toBeNull();
    expect(track.stop).toHaveBeenCalledOnce();
  });
});
