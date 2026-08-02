import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: () => 'mock-csrf',
  useTheme: () => ({ theme: 'dark' }),
}));

import AudioComposeBar from './AudioComposeBar.jsx';

function fakeRecorder(status) {
  return {
    status,
    blobUrl: 'blob:compose-clip',
    blob: new Blob(['x'], { type: 'audio/webm' }),
    recordingSeconds: 3,
    error: null,
    errorMessage: '',
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
  };
}

describe('AudioComposeBar playback error (P1-R4)', () => {
  it('shows a visible error when local playback cannot load', () => {
    const { container } = render(
      <AudioComposeBar recorder={fakeRecorder('recorded')} isGenerating={false} onSend={() => {}} />,
    );

    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    fireEvent.error(audio);

    expect(container.textContent).toContain('音频加载/播放失败');
  });

  it('disables send while generating (unified busy gate)', () => {
    const { container } = render(
      <AudioComposeBar recorder={fakeRecorder('recorded')} isGenerating onSend={() => {}} />,
    );
    const buttons = container.querySelectorAll('button');
    const send = [...buttons].find(b => b.textContent === '发送');
    expect(send).not.toBeNull();
    expect(send.disabled).toBe(true);
  });

  it('disables cancel while generating (P0-R7: cancel-during-upload must not leak chat submit)', () => {
    const { container } = render(
      <AudioComposeBar recorder={fakeRecorder('recorded')} isGenerating onSend={() => {}} />,
    );
    const buttons = container.querySelectorAll('button');
    const cancel = [...buttons].find(b => b.textContent === '取消');
    expect(cancel).not.toBeNull();
    expect(cancel.disabled).toBe(true);
  });
});
