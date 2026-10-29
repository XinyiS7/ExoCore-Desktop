import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MessageContent } from '../features/chat/MessageContent';

/**
 * Raw HTML in Chat: agent-authored cards render, untrusted markup cannot.
 *
 * Guards the plugin order invariant inside MessageContent — rehype-raw →
 * rehype-sanitize → rehype-highlight → rehype-katex — plus the two ways this
 * feature usually breaks: fenced code being eaten as HTML, and math/highlight
 * losing their generated markup to the sanitizer.
 */
describe('MessageContent raw HTML cards', () => {
  it('renders inline styles on div and span', () => {
    const content = [
      '<div style="border: 1px solid rgb(200, 0, 0); padding: 8px">',
      '',
      '卡片 <span style="color: rgb(255, 0, 0)">重点</span>',
      '',
      '</div>',
    ].join('\n');
    const { container } = render(<MessageContent content={content} />);

    const cards = container.querySelectorAll('div[style]');
    expect(cards).toHaveLength(1);
    expect((cards[0] as HTMLElement).style.padding).toBe('8px');

    const span = container.querySelector('span[style]') as HTMLElement | null;
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('重点');
    expect(span?.style.color).toBe('rgb(255, 0, 0)');
    // Style survived sanitizing as a real attribute, not as literal text.
    expect(container.textContent).not.toContain('style="');
  });

  it('renders details/summary with the open attribute', () => {
    const content = '<details open>\n<summary>展开副标题</summary>\n<b>折叠里的内容</b>\n</details>';
    const { container } = render(<MessageContent content={content} />);

    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(true);
    expect(container.querySelector('summary')?.textContent).toBe('展开副标题');
    expect(details?.textContent).toContain('折叠里的内容');
  });

  it('keeps HTML inside fenced and inline code literal', () => {
    const content = ['```html', '<div style="color:red">不该被渲染</div>', '```', '', '用 `<details>` 包起来'].join('\n');
    const { container } = render(<MessageContent content={content} />);

    const block = container.querySelector('pre code');
    expect(block?.textContent).toContain('<div style="color:red">');
    // Nothing from the fence (or the inline code) became an element.
    expect(container.querySelectorAll('div[style]')).toHaveLength(0);
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('code.app-inline-code')?.textContent).toBe('<details>');
  });

  it('drops script, iframe, inline handlers and javascript: URLs', () => {
    const content = [
      '<script>window.__rawHtmlXss = 1</script>',
      '',
      '<iframe src="https://example.com"></iframe>',
      '',
      '<img src="x" onerror="window.__rawHtmlXss = 2">',
      '',
      '<a href="javascript:window.__rawHtmlXss = 3">链接</a>',
      '',
      '正常文本',
    ].join('\n');
    const { container } = render(<MessageContent content={content} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('style')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toContain('javascript');
    expect((window as unknown as Record<string, unknown>).__rawHtmlXss).toBeUndefined();
    expect(container.textContent).toContain('正常文本');
  });

  it('renders cards, KaTeX math and highlighted code in the same message', () => {
    const content = [
      '<div style="padding: 4px">公式如下：</div>',
      '',
      'Inline math: $x^2 + y^2 = z^2$',
      '',
      '```js',
      'const answer = 42;',
      '```',
    ].join('\n');
    const { container } = render(<MessageContent content={content} />);

    // Sanitizer ran before katex, so the classes remark-math needs survived it.
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.querySelector('div[style]')).not.toBeNull();
    // Fenced code still goes through CodeBlock (lang label + copy button).
    // NOTE: hljs classes are flattened by CodeBlock today (pre-existing V4
    // behaviour, tracked separately) — this asserts the block path, not colour.
    expect(container.querySelector('.app-code-lang')?.textContent).toBe('js');
    expect(container.querySelector('pre code')?.textContent).toContain('const answer = 42;');
  });

  it('survives an HTML tag that is still streaming in', () => {
    const partial = '<div style="color:red"\n\n半截卡片';
    expect(() => render(<MessageContent content={partial} />)).not.toThrow();

    const { container } = render(<MessageContent content={'<details>\n<summary>标题'} />);
    expect(() => container.textContent).not.toThrow();
  });
});
