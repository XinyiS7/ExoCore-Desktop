import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MessageContent } from '../features/chat/MessageContent';

describe('MessageContent KaTeX & Typography Rendering', () => {
  it('renders inline KaTeX math formulas correctly', () => {
    const content = 'Inline math: $x^2 + y^2 = z^2$ is Pythagoras.';
    const { container } = render(<MessageContent content={content} />);

    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
    expect(katexEl?.textContent).toContain('x');
    expect(katexEl?.textContent).toContain('2');
  });

  it('renders display/block KaTeX math formulas correctly', () => {
    const content = 'Block math:\n\n$$\n\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\n$$\n\nEnd.';
    const { container } = render(<MessageContent content={content} />);

    const displayEl = container.querySelector('.katex-display');
    expect(displayEl).not.toBeNull();
    const katexEl = displayEl?.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('renders italics (*text*) without asterisks in an <em> element', () => {
    const content = 'He hesitated. *轻轻点了点头* Then spoke.';
    const { container } = render(<MessageContent content={content} />);

    const emEl = container.querySelector('em');
    expect(emEl).not.toBeNull();
    expect(emEl?.textContent).toBe('轻轻点了点头');
    expect(container.textContent).not.toContain('*轻轻点了点头*');
  });

  it('renders bold (**text**) without asterisks in a <strong> element', () => {
    const content = 'This is **极度重要** information.';
    const { container } = render(<MessageContent content={content} />);

    const strongEl = container.querySelector('strong');
    expect(strongEl).not.toBeNull();
    expect(strongEl?.textContent).toBe('极度重要');
    expect(container.textContent).not.toContain('**极度重要**');
  });

  it('renders blockquote (> text) with blockquote tag', () => {
    const content = '> 今夜，格曼加入狩猎。\n\n准备好了吗？';
    const { container } = render(<MessageContent content={content} />);

    const quoteEl = container.querySelector('blockquote');
    expect(quoteEl).not.toBeNull();
    expect(quoteEl?.textContent).toContain('今夜，格曼加入狩猎。');
  });
});
