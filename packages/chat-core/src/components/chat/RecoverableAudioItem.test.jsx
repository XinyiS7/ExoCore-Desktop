import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import RecoverableAudioItem from './RecoverableAudioItem.jsx';

describe('RecoverableAudioItem (P0-R6/D)', () => {
  it('retry and abandon are both disabled while busy (13.4.7)', () => {
    render(
      <RecoverableAudioItem isGenerating onRetry={vi.fn()} onAbandon={vi.fn()} />,
    );
    const retry = screen.getByText('重发');
    const abandon = screen.getByText('放弃');
    expect(retry.disabled).toBe(true);
    expect(abandon.disabled).toBe(true);
  });

  it('actions are enabled when idle', () => {
    render(
      <RecoverableAudioItem isGenerating={false} onRetry={vi.fn()} onAbandon={vi.fn()} />,
    );
    expect(screen.getByText('重发').disabled).toBe(false);
    expect(screen.getByText('放弃').disabled).toBe(false);
  });

  it('triggers retry and abandon callbacks', () => {
    const onRetry = vi.fn();
    const onAbandon = vi.fn();
    render(<RecoverableAudioItem isGenerating={false} onRetry={onRetry} onAbandon={onAbandon} />);
    screen.getByText('重发').click();
    screen.getByText('放弃').click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onAbandon).toHaveBeenCalledOnce();
  });

  it('shows stable failure copy when errorText provided (P1-R12)', () => {
    render(
      <RecoverableAudioItem
        isGenerating={false}
        onRetry={vi.fn()}
        onAbandon={vi.fn()}
        errorText="发送失败，附件已保留"
      />,
    );
    expect(screen.getByText('发送失败，附件已保留')).toBeVisible();
  });
});
