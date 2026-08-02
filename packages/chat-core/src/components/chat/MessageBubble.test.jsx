import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: () => 'mock-csrf',
  useTheme: () => ({ theme: 'dark' }),
}));

import MessageBubble from './MessageBubble.jsx';

const audioOnlyMessage = {
  id: 71,
  role: 'user',
  content: '',
  attachments: [{
    id: 9,
    name: 'recording.webm',
    type: 'audio/webm',
    audioUrl: 'http://localhost:8000/api/agents/conversations/7/attachments/9/content/',
  }],
};

function renderAudioMessage() {
  return render(
    <MessageBubble
      msg={audioOnlyMessage}
      agentName="Agent"
      agentAvatarUrl="/agent.png"
      userNick="Alicia"
      userAvatarUrl="/user.png"
      isGenerating={false}
    />,
  );
}

describe('MessageBubble audio playback (Builder)', () => {
  it('audio-only message renders audio without an empty prose bubble', () => {
    const { container } = renderAudioMessage();

    const audio = screen.getByTitle('recording.webm');
    expect(audio).toHaveAttribute(
      'src',
      'http://localhost:8000/api/agents/conversations/7/attachments/9/content/',
    );
    expect(container.querySelector('.prose')).toBeNull();
  });

  it('shows a visible error when history audio cannot load', () => {
    renderAudioMessage();

    fireEvent.error(screen.getByTitle('recording.webm'));

    expect(screen.getByText(/音频.*(加载|播放).*失败/)).toBeVisible();
  });
});
