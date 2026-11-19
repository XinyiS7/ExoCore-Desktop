import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MessageContent } from '../features/chat/MessageContent';

/**
 * #136 LifeUp links (`lifeup:` protocol):
 * - Markdown `[text](lifeup://...)` renders as `<a href>` with the exact URL preserved
 *   (no double percent-encoding, no decoding) and no `target="_blank"`.
 * - Only `lifeup` on `href` is additionally allowed; `javascript:` and other non-allowlisted
 *   protocols remain stripped.
 */
describe('MessageContent lifeup:// links (#136)', () => {
  it('renders lifeup:// Markdown links with href preserved verbatim and no target=_blank', () => {
    const href = 'lifeup://api/add_task?todo=%E4%BB%8A%E6%97%A5%E4%B8%B4%E6%91%B9&notes=a%20b&coin=10';
    const { container } = render(
      <MessageContent content={`[在人升里接下这个任务](${href})`} inlineTags="assistant" />,
    );

    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent).toBe('在人升里接下这个任务');
    expect(anchor?.getAttribute('href')).toBe(href);
    expect(anchor?.getAttribute('target')).toBeNull();
    expect(container.querySelector('[data-local-file]')).toBeNull();
  });

  it.each([
    ['reward', 'lifeup://api/reward?type=coin&number=5&content=%E5%B0%8F%E5%A5%96%E5%8A%B1'],
    ['toast', 'lifeup://api/toast?text=%E5%AE%8C%E6%88%90%E5%95%A6%20%21&type=1'],
  ])('preserves lifeup://api/%s href verbatim', (_endpoint, href) => {
    const { container } = render(
      <MessageContent content={`[触发](${href})`} inlineTags="assistant" />,
    );

    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe(href);
  });

  it('keeps filtering javascript:, data:, and other unallowlisted protocols', () => {
    const content = [
      '[js-md](javascript:alert(1))',
      '',
      '<a href="javascript:alert(2)">js-html</a>',
      '',
      '[data-md](data:text/html,hi)',
      '',
      '[custom-md](customapp://open)',
    ].join('\n');
    const { container } = render(<MessageContent content={content} inlineTags="assistant" />);

    const anchors = Array.from(container.querySelectorAll('a'));
    expect(anchors).toHaveLength(4);
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href');
      expect(href === null || href === '').toBe(true);
    }
  });

  it('only allows lifeup: on href, not on img src', () => {
    const { container } = render(
      <MessageContent content='<img src="lifeup://api/toast?text=hi" alt="x">' inlineTags="assistant" />,
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    const src = img?.getAttribute('src');
    expect(src === null || src === '').toBe(true);
  });

  it('leaves standard https:// links unaffected', () => {
    const href = 'https://example.com/a?x=1&y=2';
    const { container } = render(
      <MessageContent content={`[doc](${href})`} inlineTags="assistant" />,
    );

    expect(container.querySelector('a')?.getAttribute('href')).toBe(href);
  });
});
