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
    attachmentId: null,
    status: null,
    diagnostics: [],
    ...overrides,
  };
}

function failedDiagnostics(message = '上传失败') {
  return [{ stage: 'upload', code: 'attachment_upload_failed', level: 'error', message }];
}

describe('ComposeAttachmentItem', () => {
  // ── Basic rendering ──
  it('shows the file name', () => {
    render(<ComposeAttachmentItem
      entry={makeEntry({ name: 'photo.png' })}
      onRemove={vi.fn()}
    />);
    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });

  it('renders image preview when preview is provided', () => {
    render(<ComposeAttachmentItem
      entry={makeEntry({ preview: 'blob:test' })}
      onRemove={vi.fn()}
    />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'blob:test');
  });

  // ── Uploading ──
  it('shows uploading spinner for image entries', () => {
    render(<ComposeAttachmentItem
      entry={makeEntry({ preview: 'blob:test', uploading: true })}
      onRemove={vi.fn()}
    />);
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  // ── Failed image ──
  it('displays error text from diagnostics for failed image entries', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          preview: 'blob:test',
          status: 'failed',
          attachmentId: null,
          diagnostics: failedDiagnostics('上传失败'),
        })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('上传失败')).toBeInTheDocument();
    // The old pattern was an isolated "!" — verify no bare "!"
    const errorNodes = Array.from(document.querySelectorAll('span'))
      .filter(el => el.textContent.trim() === '!');
    expect(errorNodes).toHaveLength(0);
  });

  it('displays first error diagnostic when multiple diagnostics exist', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          preview: 'blob:test',
          status: 'failed',
          attachmentId: null,
          diagnostics: [
            { stage: 'preprocess', code: 'x', level: 'warning', message: '无关' },
            { stage: 'upload', code: 'attachment_upload_failed', level: 'error', message: '文件过大' },
            { stage: 'resolve', code: 'y', level: 'error', message: '还有这个错误' },
          ],
        })}
        onRemove={vi.fn()}
      />
    );
    // Should show the first error message, not the warning
    expect(screen.getByText('文件过大')).toBeInTheDocument();
    expect(screen.queryByText('无关')).toBeNull();
    expect(screen.queryByText('还有这个错误')).toBeNull();
  });

  // ── Failed non-image chip ──
  it('shows error on non-image chip via diagnostics', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          name: 'doc.pdf',
          type: 'application/pdf',
          status: 'failed',
          attachmentId: null,
          diagnostics: failedDiagnostics('上传失败'),
        })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('上传失败')).toBeInTheDocument();
  });

  it('falls back to raw message for unknown error', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          preview: 'blob:test',
          status: 'failed',
          attachmentId: null,
          diagnostics: [{ stage: 'unknown', code: 'x', level: 'error', message: 'Something went wrong' }],
        })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  // ── OK degraded (amber state) ──
  it('shows amber overlay with warning for ok_degraded image', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          preview: 'blob:test',
          uploading: false,
          attachmentId: 12,
          status: 'ok_degraded',
          diagnostics: [
            { stage: 'preprocess', code: 'image_preprocess_failed', level: 'warning', message: '已使用原图' },
          ],
        })}
        onRemove={vi.fn()}
      />
    );
    // Warning message visible in amber overlay
    expect(screen.getByText('已使用原图')).toBeInTheDocument();
    // But NOT red error text (amber overlay ≠ red overlay)
    expect(screen.queryByTestId('attachment-error-text')).toBeNull();
  });

  it('shows amber chip for ok_degraded non-image file', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          name: 'data.zip',
          type: 'application/zip',
          uploading: false,
          attachmentId: 7,
          status: 'ok_degraded',
          diagnostics: [
            { stage: 'upload', code: 'x', level: 'warning', message: '部分降级' },
          ],
        })}
        onRemove={vi.fn()}
      />
    );
    const warningEl = screen.getByTestId('attachment-warning-text');
    expect(warningEl).toBeInTheDocument();
    expect(warningEl.textContent).toBe('部分降级');
  });

  it('shows fallback label when ok_degraded has no diagnostics', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          preview: 'blob:test',
          uploading: false,
          attachmentId: 3,
          status: 'ok_degraded',
          diagnostics: [],
        })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('已降级处理')).toBeInTheDocument();
  });

  // ── Close button ──
  it('close button is always visible (no hover dependency)', () => {
    render(<ComposeAttachmentItem entry={makeEntry({ preview: 'blob:test' })} onRemove={vi.fn()} />);
    const btns = screen.getAllByRole('button');
    const removeBtn = btns.find(b => b.getAttribute('aria-label')?.includes('Remove'));
    expect(removeBtn).toBeTruthy();
    expect(removeBtn.className).not.toContain('opacity-0');
  });

  it('remove button works on ok_degraded entries too', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          preview: 'blob:test',
          attachmentId: 12,
          status: 'ok_degraded',
          diagnostics: [{ stage: 'preprocess', code: 'x', level: 'warning', message: 'test' }],
        })}
        onRemove={vi.fn()}
      />
    );
    const btns = screen.getAllByRole('button');
    const removeBtn = btns.find(b => b.getAttribute('aria-label')?.includes('Remove'));
    expect(removeBtn).toBeTruthy();
  });

  it('calls onRemove with clientId when remove button clicked', () => {
    const onRemove = vi.fn();
    render(<ComposeAttachmentItem entry={makeEntry({ clientId: 42 })} onRemove={onRemove} />);

    const btns = screen.getAllByRole('button');
    const removeBtn = btns.find(b => b.getAttribute('aria-label')?.includes('Remove'));
    fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledWith(42);
  });

  // ── Success Indicator ──
  it('renders success checkmark badge for uploaded image attachment', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          preview: 'blob:test',
          uploading: false,
          attachmentId: 101,
          status: 'ok',
        })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByTestId('attachment-success-badge')).toBeInTheDocument();
  });

  it('renders success checkmark badge for uploaded non-image file attachment', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          name: 'doc.pdf',
          uploading: false,
          attachmentId: 102,
          status: 'ok',
        })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByTestId('attachment-success-badge')).toBeInTheDocument();
  });

  it('renders error state for failed status even with empty diagnostics array', () => {
    render(
      <ComposeAttachmentItem
        entry={makeEntry({
          name: 'doc.pdf',
          uploading: false,
          attachmentId: null,
          status: 'failed',
          diagnostics: [],
        })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByTestId('attachment-error-text')).toBeInTheDocument();
    expect(screen.queryByTestId('attachment-success-badge')).toBeNull();
  });
});
