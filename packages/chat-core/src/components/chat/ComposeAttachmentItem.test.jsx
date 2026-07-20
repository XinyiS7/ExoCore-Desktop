import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ComposeAttachmentItem from './ComposeAttachmentItem.jsx';

function makeEntry(overrides = {}) {
  return {
    clientId: 1,
    preview: null,
    name: 'test.jpg',
    type: 'image/jpeg',
    uploading: false,
    error: null,
    ...overrides,
  };
}

describe('ComposeAttachmentItem', () => {
  it('shows the file name', () => {
    render(<ComposeAttachmentItem entry={makeEntry({ name: 'photo.png' })} onRemove={vi.fn()} />);
    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });

  it('renders image preview when preview is provided', () => {
    render(<ComposeAttachmentItem entry={makeEntry({ preview: 'blob:test' })} onRemove={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'blob:test');
  });

  it('shows uploading spinner for image entries', () => {
    render(<ComposeAttachmentItem entry={makeEntry({ preview: 'blob:test', uploading: true })} onRemove={vi.fn()} />);
    // The spinner is an animate-spin div; verify it exists within the overlay
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('displays error text for failed image entries, not just "!"', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({ preview: 'blob:test', error: 'upload' })}
        onRemove={vi.fn()}
      />
    );
    // Should show human-readable Chinese label, not the old single "!"
    expect(screen.getByText('上传失败')).toBeInTheDocument();
    // The old pattern was an isolated "!" — verify we have a real error message
    const errorNodes = Array.from(document.querySelectorAll('span'))
      .filter(el => el.textContent.trim() === '!');
    expect(errorNodes).toHaveLength(0);
  });

  it('displays preprocess error label', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({ preview: 'blob:test', error: 'preprocess' })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('压缩失败')).toBeInTheDocument();
  });

  it('shows error on non-image chip entries', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({ name: 'doc.pdf', type: 'application/pdf', error: 'upload' })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('上传失败')).toBeInTheDocument();
  });

  it('close button is always visible (no hover dependency)', () => {
    render(<ComposeAttachmentItem entry={makeEntry({ preview: 'blob:test' })} onRemove={vi.fn()} />);
    // The button uses aria-label — find by role button with the remove label
    const btns = screen.getAllByRole('button');
    const removeBtn = btns.find(b => b.getAttribute('aria-label')?.includes('Remove'));
    expect(removeBtn).toBeTruthy();
    // Button should not rely on opacity-0 for visibility
    expect(removeBtn.className).not.toContain('opacity-0');
  });

  it('calls onRemove with clientId when remove button clicked', () => {
    const onRemove = vi.fn();
    render(<ComposeAttachmentItem entry={makeEntry({ clientId: 42 })} onRemove={onRemove} />);

    const btns = screen.getAllByRole('button');
    const removeBtn = btns.find(b => b.getAttribute('aria-label')?.includes('Remove'));
    fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledWith(42);
  });

  it('falls back to raw error string when stage is unknown', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({ preview: 'blob:test', error: 'Something went wrong' })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
