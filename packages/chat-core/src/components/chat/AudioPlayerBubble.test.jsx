import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import AudioPlayerBubble from './AudioPlayerBubble';
import { globalAudioPlaybackManager } from '../../utils/audioPlaybackManager';

describe('AudioPlayerBubble', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly with title and duration', () => {
    render(<AudioPlayerBubble src="blob:http://localhost/test.webm" title="Test Voice" duration={12} />);
    expect(screen.getByText('Test Voice')).toBeInTheDocument();
    expect(screen.getByText(/0:00 \/ 0:12/)).toBeInTheDocument();
  });

  it('toggles play/pause button state', async () => {
    const playMock = vi.fn().mockImplementation(() => Promise.resolve());
    const pauseMock = vi.fn();
    window.HTMLMediaElement.prototype.play = playMock;
    window.HTMLMediaElement.prototype.pause = pauseMock;

    render(<AudioPlayerBubble src="blob:http://localhost/test.webm" duration={10} />);
    const playBtn = screen.getByRole('button', { name: /Play Audio/i });
    expect(playBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(playBtn);
    });
    expect(playMock).toHaveBeenCalled();
  });

  it('stops playback when another audio registers with globalAudioPlaybackManager', () => {
    const pauseMock = vi.fn();
    window.HTMLMediaElement.prototype.pause = pauseMock;

    render(<AudioPlayerBubble src="blob:http://localhost/audio1.webm" duration={10} />);

    // Simulate play start for audio1
    globalAudioPlaybackManager.play('audio_1', pauseMock);

    // Simulate play start for audio2 (exclusive manager should trigger pause of audio1)
    globalAudioPlaybackManager.play('audio_2', vi.fn());

    expect(pauseMock).toHaveBeenCalled();
  });
});
