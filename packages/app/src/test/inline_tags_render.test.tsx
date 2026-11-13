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

describe('CP1-F01 non-allow-listed angle brackets stay visible text', () => {
  const roles = [['assistant'], ['user'], [undefined]] as const;

  it.each(roles)('generic syntax survives real rendering (inlineTags=%s)', (role) => {
    const content = 'Vec<String> 与 Option<Box<T>> 以及 Map<K, V>，x < y 且 y > z，</Foo> 收尾';
    const { container } = render(<MessageContent content={content} inlineTags={role} />);
    expect(container.querySelector('p')?.textContent).toBe(content);
  });

  it('keeps allow-listed card HTML working next to generics', () => {
    const content = '<div style="padding: 4px">\n\n卡片里 Vec<String> 和 <mark>重点</mark>\n\n</div>';
    const { container } = render(<MessageContent content={content} inlineTags="assistant" />);
    expect((container.querySelector('div[style]') as HTMLElement | null)?.style.padding).toBe('4px');
    expect(container.querySelector('mark')?.textContent).toBe('重点');
    expect(container.textContent).toContain('卡片里 Vec<String> 和 重点');
  });

  it('does not double-escape code and keeps autolinks', () => {
    const content = '`Vec<String>`\n\n```rust\nlet v: Vec<String> = vec![];\n```\n\n<https://example.com/a>';
    const { container } = render(<MessageContent content={content} inlineTags="assistant" />);
    expect(container.querySelector('.app-inline-code')?.textContent).toBe('Vec<String>');
    expect(container.querySelector('pre')?.textContent).toContain('let v: Vec<String> = vec![];');
    expect(container.textContent).not.toContain('&lt;');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/a');
  });

  it('keeps generics literal inside an opened spoiler body', () => {
    render(<MessageContent content={'<spoiler>答案是 Vec<String></spoiler>'} inlineTags="assistant" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('答案是 Vec<String>')).not.toBeNull();
  });

  it('still holds back a streaming half tag', () => {
    const { container } = render(<MessageContent content="稍等<sp" inlineTags="assistant" streaming />);
    expect(container.textContent).toBe('稍等');
  });
});

describe('D-F pin / unpin never render in a message body', () => {
  it.each(['assistant', 'user'] as const)('%s body hides the tag and its content', (role) => {
    const { container } = render(
      <MessageContent content={'记住了<pin>周五交稿</pin>，另外<unpin id=3>就这样'} inlineTags={role} />,
    );
    expect(container.textContent).toBe('记住了，另外就这样');
    expect(container.querySelector('[data-itag]')).toBeNull();
    expect(container.querySelector('.app-itag-chip')).toBeNull();
  });

  it('a pin still streaming is hidden as it arrives', () => {
    const { container } = render(<MessageContent content="好<pin>周五交" inlineTags="assistant" streaming />);
    expect(container.textContent).toBe('好');
  });

  it('a pin inside code stays literal', () => {
    const { container } = render(<MessageContent content="`<pin>x</pin>`" inlineTags="assistant" />);
    expect(container.querySelector('.app-inline-code')?.textContent).toBe('<pin>x</pin>');
  });
});

describe('CP1-F03 only parser-accepted tags act; rejected candidates render verbatim', () => {
  const rejected = [
    '<timer>abc',
    '<roll>abc</roll>',
    '<PIN>note</PIN>',
    '<Speak>hi</Speak>',
    '<timer=5m title="x">',
    '<roll=1d7>',
    '<block=abc>',
    '<unpin id=abc>',
    '<pin>未闭合的便签',
    '<spoiler>未闭合',
    '</speak> 孤立闭合',
  ];

  it.each(rejected.flatMap((text) => [['assistant', text], ['user', text]] as const))(
    '%s: %s',
    (role, text) => {
      const { container } = render(<MessageContent content={text} inlineTags={role} />);
      expect(container.textContent).toBe(text);
      expect(container.querySelector('[data-itag], .app-itag-chip')).toBeNull();
    },
  );

  it.each(['<speak>secret</speak>', '<spoiler>secret</spoiler>', '<block=30s>', '<timer=90s title="泡茶">'])(
    'assistant-only tag in a user message stays verbatim: %s',
    (text) => {
      const { container } = render(<MessageContent content={text} inlineTags="user" />);
      expect(container.textContent).toBe(text);
      expect(container.querySelector('[data-itag], .app-itag-chip')).toBeNull();
    },
  );

  it('accepted tags still act around rejected ones', () => {
    const content = '<PIN>x</PIN> <pin>藏起来</pin> <roll=1d20> <roll>y</roll>';
    const { container } = render(<MessageContent content={content} inlineTags="assistant" />);
    expect(container.textContent).toBe('<PIN>x</PIN>  1d20 <roll>y</roll>');
    expect(container.querySelectorAll('.app-itag-chip')).toHaveLength(1);
  });

  it('without a role, tag-shaped text is verbatim too', () => {
    const { container } = render(<MessageContent content="<speak>x</speak> <timer=5s>" />);
    expect(container.textContent).toBe('<speak>x</speak> <timer=5s>');
  });
});
