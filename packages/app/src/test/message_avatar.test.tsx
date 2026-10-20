import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageAvatar } from '../features/chat/MessageAvatar';

/** #72 U7: message heads show an avatar in place of the name. */

function loadShellCss(): string {
  const directPath = resolve(process.cwd(), 'src/styles/shell.css');
  if (existsSync(directPath)) return readFileSync(directPath, 'utf8');
  const monorepoPath = resolve(process.cwd(), 'packages/app/src/styles/shell.css');
  if (existsSync(monorepoPath)) return readFileSync(monorepoPath, 'utf8');
  throw new Error(`Cannot locate shell.css from cwd: ${process.cwd()}`);
}

describe('MessageAvatar', () => {
  it('names the speaker through alt and title only, with no link', () => {
    const { container } = render(<MessageAvatar src="https://example.com/a.png" name="Alessandro" />);
    expect(screen.getByRole('img', { name: 'Alessandro' })).toHaveAttribute('src', 'https://example.com/a.png');
    expect(container.querySelector('.app-msg-avatar')).toHaveAttribute('title', 'Alessandro');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('falls back to the first character when the image fails, and retries a new source', () => {
    const { rerender } = render(<MessageAvatar src="https://example.com/broken.png" name="砚" />);
    fireEvent.error(screen.getByRole('img', { name: '砚' }));
    expect(screen.getByRole('img', { name: '砚' }).tagName).toBe('SPAN');
    expect(screen.getByRole('img', { name: '砚' })).toHaveTextContent('砚');

    rerender(<MessageAvatar src="https://example.com/new.png" name="砚" />);
    expect(screen.getByRole('img', { name: '砚' }).tagName).toBe('IMG');
  });

  it('mirrors the user head so time and avatar sit on the right', () => {
    expect(loadShellCss()).toMatch(/\.app-msg--user \.app-msg-head \{\s*flex-direction: row-reverse;/);
  });
});
