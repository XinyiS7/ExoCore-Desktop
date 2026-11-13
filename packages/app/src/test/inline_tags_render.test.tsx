import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageContent } from '../features/chat/MessageContent';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import type { MessageView } from '../features/chat/types';
import { renderV4 } from './helpers';

/** #130 CP1 — inline tags rendered through the single Markdown pipeline. */

describe('MessageContent inline tags', () => {
  it('keeps chips inline in the surrounding paragraph', () => {
    const { container } = render(
      <MessageContent content={'**好**，<timer=90s title="泡茶">之后见'} inlineTags="assistant" />,
    );
    const paragraph = container.querySelector('p');
    expect(paragraph?.querySelector('strong')?.textContent).toBe('好');
    expect(paragraph?.querySelector('.app-itag-chip')?.textContent).toBe('1m30s · 泡茶');
    expect(paragraph?.textContent).toContain('之后见');
    expect(container.textContent).not.toContain('<timer');
  });

  it('does nothing without the inlineTags role (reasoning / tool rows)', () => {
    const { container } = render(<MessageContent content="a <roll=1d20> b" />);
    expect(container.querySelector('.app-itag-chip')).toBeNull();
  });

  it('leaves fenced and inline code literal', () => {
    const content = '`<roll=1d20>`\n\n```\n<speak>x</speak>\n```';
    const { container } = render(<MessageContent content={content} inlineTags="assistant" />);
    expect(container.querySelector('[data-itag]')).toBeNull();
    expect(container.querySelector('.app-inline-code')?.textContent).toBe('<roll=1d20>');
    expect(container.textContent).toContain('<speak>x</speak>');
  });

  it('renders speak as a card and never shows the spoken text', () => {
    const { container } = render(
      <MessageContent content={'开头\n\n<speak emotion="soft">悄悄话</speak>\n\n结尾'} inlineTags="assistant" />,
    );
    expect(container.querySelector('[data-itag="speak"]')?.getAttribute('aria-label')).toBe('语音');
    expect(container.textContent).not.toContain('悄悄话');
    expect(container.textContent).toContain('结尾');
  });

  it('marks an open speak as live only while streaming', () => {
    const live = render(<MessageContent content="<speak>说到一半" inlineTags="assistant" streaming />);
    expect(live.container.querySelector('.app-itag-speak--live')).not.toBeNull();
    live.unmount();
    const cut = render(<MessageContent content="<speak>说到一半" inlineTags="assistant" />);
    expect(cut.container.querySelector('[data-itag="speak"]')?.getAttribute('aria-label')).toBe('语音未完成');
    expect(cut.container.textContent).not.toContain('说到一半');
  });

  it('holds back a half tag while streaming', () => {
    const { container } = render(<MessageContent content="稍等<tim" inlineTags="assistant" streaming />);
    expect(container.textContent).toBe('稍等');
  });

  it('keeps a plain spoiler body out of the DOM until clicked', () => {
    render(<MessageContent content={'<spoiler cover="结局">**他活下来了**</spoiler>'} inlineTags="assistant" />);
    expect(screen.queryByText('他活下来了')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /结局/ }));
    expect(screen.getByText('他活下来了').tagName).toBe('STRONG');
  });

  it('cannot open a pwd spoiler by clicking', () => {
    const { container } = render(
      <MessageContent content={'<spoiler pwd="rose">秘密</spoiler>'} inlineTags="assistant" />,
    );
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).not.toContain('秘密');
    expect(container.textContent).toContain('需要口令');
  });

  it('renders roll results with dice and total', () => {
    const { container } = render(
      <MessageContent
        content={'<roll_result expr="2d6+3" by="user" dice="4,5" total=12>'}
        inlineTags="user"
      />,
    );
    expect(container.querySelector('.app-itag-chip')?.textContent).toBe('2d6+3 → 4, 5 = 12');
  });

  it('a user message cannot render assistant-only tags', () => {
    const { container } = render(
      <MessageContent content="<spoiler>x</spoiler> <roll=1d20>" inlineTags="user" />,
    );
    expect(container.querySelector('[data-itag="spoiler"]')).toBeNull();
    expect(container.querySelector('.app-itag-chip')?.textContent).toBe('1d20');
  });

  it('an author-written placeholder without a parsed tag renders nothing', () => {
    const { container } = render(
      <MessageContent content={'<span data-itag-ref="5">x</span>'} inlineTags="assistant" />,
    );
    expect(container.querySelector('.app-itag-chip')).toBeNull();
  });
});

function msg(id: number, role: MessageView['role'], content: string): MessageView {
  return { id, role, content, createdAt: '2026-11-13T15:00:00Z' } as MessageView;
}

const timelineProps = { hasOlder: false, loadingMore: false, onLoadMore: () => {} };

describe('MessageTimeline inline tags', () => {
  it('hides user rows that are only a timer trigger', () => {
    const { container } = renderV4(
      <MessageTimeline
        {...timelineProps}
        messages={[
          msg(1, 'user', '<timer_fired title="泡茶" fire_at="2026-11-13T16:21:44+01:00">'),
          msg(2, 'assistant', '茶好了'),
        ]}
      />,
    );
    expect(container.querySelector('[data-message-id="1"]')).toBeNull();
    expect(container.querySelector('[data-message-id="2"]')).not.toBeNull();
  });

  it('unlocks a pwd spoiler only from a later user message, case-insensitively', () => {
    const spoiler = msg(2, 'assistant', '<spoiler pwd="Rose">玫瑰花园</spoiler>');
    const locked = renderV4(
      <MessageTimeline {...timelineProps} messages={[msg(1, 'user', 'rose'), spoiler]} />,
    );
    expect(locked.container.textContent).not.toContain('玫瑰花园');
    locked.unmount();

    const unlocked = renderV4(
      <MessageTimeline {...timelineProps} messages={[spoiler, msg(3, 'user', '是 ROSE 吗')]} />,
    );
    expect(unlocked.container.textContent).toContain('玫瑰花园');
  });
});
