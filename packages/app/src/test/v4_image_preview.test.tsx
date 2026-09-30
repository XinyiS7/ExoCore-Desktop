import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderV4 } from './helpers';
import { AttachmentImage } from '../features/chat/attachments/AttachmentImage';
import { MessageAttachments } from '../features/chat/attachments/MessageAttachments';
import { ComposeAttachmentItem } from '../features/chat/attachments/ComposeAttachmentItem';
import { validatedImageContentUrl } from '../features/chat/attachments/mediaUrls';
import type { ComposeAttachmentEntry } from '../features/chat/attachments/types';
import type { MessageAttachmentView } from '../features/chat/types';

const SAME_ORIGIN_CONTENT = '/api/agents/conversations/42/attachments/5/content/';

const imageAttachment = (over: Partial<MessageAttachmentView> = {}): MessageAttachmentView => ({
  key: 'session_attachment:5',
  ref: { type: 'session_attachment', id: 5 },
  kind: 'image',
  source: 'user',
  status: 'ready',
  position: 0,
  displayName: 'photo.png',
  mimeType: 'image/png',
  fileSize: 1024,
  contentUrl: null,
  durationMs: null,
  errorCode: null,
  ...over,
});

const composeEntry = (over: Partial<ComposeAttachmentEntry> = {}): ComposeAttachmentEntry => ({
  clientId: 1,
  file: new File(['x'], 'frame.png', { type: 'image/png' }),
  preview: 'blob:frame-preview',
  name: 'frame.png',
  type: 'image/png',
  size: 16,
  status: 'ok',
  attachmentId: 9,
  diagnostics: [],
  ...over,
});

describe('V4 image preview — same-origin content URL validation (F1)', () => {
  it('accepts relative and same-origin absolute canonical URLs', () => {
    expect(validatedImageContentUrl(SAME_ORIGIN_CONTENT)).toBe(SAME_ORIGIN_CONTENT);
    expect(validatedImageContentUrl(`  ${SAME_ORIGIN_CONTENT}  `)).toBe(SAME_ORIGIN_CONTENT);
    const absolute = `${window.location.origin}${SAME_ORIGIN_CONTENT}`;
    expect(validatedImageContentUrl(absolute)).toBe(absolute);
  });

  it('rejects empty, foreign, protocol-relative, scheme and unparseable values', () => {
    const bad = [
      null,
      undefined,
      '',
      '   ',
      'https://foreign.example/photo.png',
      '//foreign.example/photo.png',
      'data:image/png;base64,AA',
      'file:///C:/secret.png',
      'javascript:alert(1)',
      'ftp://files.example/photo.png',
      'http://',
    ];
    for (const value of bad) {
      expect(validatedImageContentUrl(value)).toBeNull();
    }
  });
});

describe('V4 image preview — canonical source resolution (F1)', () => {
  it('renders a ready image from a same-origin contentUrl with no fileUri and opens the lightbox', async () => {
    renderV4(<AttachmentImage attachment={imageAttachment({ contentUrl: SAME_ORIGIN_CONTENT })} />);

    const thumb = screen.getByRole('button', { name: /查看图片 photo\.png/ });
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe(SAME_ORIGIN_CONTENT);

    fireEvent.click(thumb);
    const dialog = await screen.findByRole('dialog', { name: /photo\.png/ });
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe(SAME_ORIGIN_CONTENT);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('prefers the canonical contentUrl over a valid legacy fileUri', () => {
    renderV4(
      <AttachmentImage
        attachment={imageAttachment({
          contentUrl: SAME_ORIGIN_CONTENT,
          fileUri: 'https://cdn.example/photo.png',
        })}
      />,
    );
    const img = screen.getByRole('button', { name: /查看图片 photo\.png/ }).querySelector('img');
    expect(img?.getAttribute('src')).toBe(SAME_ORIGIN_CONTENT);
  });

  it('rejects foreign / protocol-relative canonical URLs and keeps the legacy fileUri fallback', () => {
    const { rerender } = renderV4(
      <AttachmentImage
        attachment={imageAttachment({
          contentUrl: 'https://foreign.example/photo.png',
          fileUri: 'https://cdn.example/photo.png',
        })}
      />,
    );
    let img = screen.getByRole('button', { name: /查看图片 photo\.png/ }).querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example/photo.png');

    rerender(
      <AttachmentImage
        attachment={imageAttachment({
          contentUrl: '//foreign.example/photo.png',
          fileUri: 'https://cdn.example/photo.png',
        })}
      />,
    );
    img = screen.getByRole('button', { name: /查看图片 photo\.png/ }).querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example/photo.png');
  });

  it('shows the failed-image card when the canonical URL is rejected and no fileUri exists', () => {
    renderV4(
      <AttachmentImage
        attachment={imageAttachment({ contentUrl: 'https://foreign.example/photo.png', fileUri: null })}
      />,
    );
    expect(screen.getByText('photo.png')).toBeTruthy();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /查看图片/ })).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('never copies an unsupported canonical scheme into <img src>', () => {
    const bad = [
      'data:image/png;base64,AAAA',
      'file:///C:/secret.png',
      'javascript:alert(1)',
      'ftp://files.example/photo.png',
    ];
    for (const value of bad) {
      const { unmount } = renderV4(
        <AttachmentImage attachment={imageAttachment({ contentUrl: value, fileUri: null })} />,
      );
      expect(screen.queryByRole('button', { name: /查看图片/ })).toBeNull();
      expect(document.querySelector('img')).toBeNull();
      expect(screen.getByText('图片加载失败')).toBeTruthy();
      unmount();
    }
  });

  it('a canonical image load failure keeps the existing fallback card', () => {
    renderV4(<AttachmentImage attachment={imageAttachment({ contentUrl: SAME_ORIGIN_CONTENT })} />);
    const img = screen
      .getByRole('button', { name: /查看图片 photo\.png/ })
      .querySelector('img')!;
    fireEvent.error(img);
    expect(screen.getByText('photo.png')).toBeTruthy();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /查看图片/ })).toBeNull();
  });

  it('retries the legacy fileUri exactly once after a canonical load error, then shows the card', () => {
    renderV4(
      <AttachmentImage
        attachment={imageAttachment({
          contentUrl: SAME_ORIGIN_CONTENT,
          fileUri: 'https://cdn.example/photo.png',
        })}
      />,
    );

    let thumb = screen.getByRole('button', { name: /查看图片/ });
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe(SAME_ORIGIN_CONTENT);

    fireEvent.error(thumb.querySelector('img')!);
    thumb = screen.getByRole('button', { name: /查看图片/ });
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/photo.png');

    fireEvent.error(thumb.querySelector('img')!);
    expect(screen.queryByRole('button', { name: /查看图片/ })).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('photo.png')).toBeTruthy();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
  });

  it('an open lightbox shares the fallback source and closes when both candidates fail', async () => {
    renderV4(
      <AttachmentImage
        attachment={imageAttachment({
          contentUrl: SAME_ORIGIN_CONTENT,
          fileUri: 'https://cdn.example/photo.png',
        })}
      />,
    );
    const thumb = screen.getByRole('button', { name: /查看图片/ });
    fireEvent.click(thumb);
    const dialog = await screen.findByRole('dialog', { name: /photo\.png/ });
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe(SAME_ORIGIN_CONTENT);

    fireEvent.error(thumb.querySelector('img')!);
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/photo.png');
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/photo.png');

    fireEvent.error(thumb.querySelector('img')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
  });

  it('clears stale load failure state when the attachment or source set changes', () => {
    const base = { contentUrl: SAME_ORIGIN_CONTENT, fileUri: 'https://cdn.example/photo.png' };
    const { rerender } = renderV4(<AttachmentImage attachment={imageAttachment(base)} />);

    // Exhaust both candidates for the original attachment -> card.
    fireEvent.error(screen.getByRole('button', { name: /查看图片/ }).querySelector('img')!);
    fireEvent.error(screen.getByRole('button', { name: /查看图片/ }).querySelector('img')!);
    expect(screen.getByText('图片加载失败')).toBeTruthy();

    // Same attachment identity, new canonical source -> fresh attempt.
    rerender(
      <AttachmentImage
        attachment={imageAttachment({
          ...base,
          contentUrl: '/api/agents/conversations/42/attachments/5/content/?v=2',
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: /查看图片/ }).querySelector('img')?.getAttribute('src'),
    ).toBe('/api/agents/conversations/42/attachments/5/content/?v=2');
    expect(screen.queryByText('图片加载失败')).toBeNull();

    // New attachment identity with an unchanged source set -> also fresh.
    fireEvent.error(screen.getByRole('button', { name: /查看图片/ }).querySelector('img')!);
    fireEvent.error(screen.getByRole('button', { name: /查看图片/ }).querySelector('img')!);
    expect(screen.getByText('图片加载失败')).toBeTruthy();
    rerender(
      <AttachmentImage
        attachment={imageAttachment({
          ...base,
          key: 'session_attachment:6',
          ref: { type: 'session_attachment', id: 6 },
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: /查看图片/ }).querySelector('img')?.getAttribute('src'),
    ).toBe(SAME_ORIGIN_CONTENT);
    expect(screen.queryByText('图片加载失败')).toBeNull();
  });

  it('dedupes identical canonical and legacy values so one error exhausts the candidate list', () => {
    renderV4(
      <AttachmentImage
        attachment={imageAttachment({ contentUrl: SAME_ORIGIN_CONTENT, fileUri: SAME_ORIGIN_CONTENT })}
      />,
    );
    const thumb = screen.getByRole('button', { name: /查看图片/ });
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe(SAME_ORIGIN_CONTENT);

    fireEvent.error(thumb.querySelector('img')!);
    expect(screen.queryByRole('button', { name: /查看图片/ })).toBeNull();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
  });

  it('MessageAttachments keeps the ready filter: a pending canonical image never renders', () => {
    const ready = imageAttachment({ contentUrl: SAME_ORIGIN_CONTENT });
    const pending = imageAttachment({
      key: 'session_attachment:6',
      ref: { type: 'session_attachment', id: 6 },
      status: 'pending',
      displayName: 'draft.png',
      contentUrl: SAME_ORIGIN_CONTENT,
    });
    const { container } = renderV4(<MessageAttachments attachments={[ready, pending]} />);
    expect(container.querySelectorAll('img').length).toBe(1);
    expect(screen.getByRole('button', { name: /查看图片 photo\.png/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /查看图片 draft\.png/ })).toBeNull();
  });
});

describe('V4 image preview — compose thumbnail lightbox (F2)', () => {
  it('renders the thumbnail as a labelled native button that opens the lightbox by pointer', async () => {
    renderV4(<ComposeAttachmentItem entry={composeEntry()} onRemove={vi.fn()} />);

    const thumb = screen.getByRole('button', { name: '查看图片 frame.png' });
    expect(thumb.tagName).toBe('BUTTON');

    fireEvent.click(thumb);
    const dialog = await screen.findByRole('dialog', { name: /frame\.png/ });
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('blob:frame-preview');

    fireEvent.click(screen.getByRole('button', { name: '关闭图片预览' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('is keyboard reachable and Escape closes the lightbox returning focus to the thumbnail', async () => {
    renderV4(<ComposeAttachmentItem entry={composeEntry()} onRemove={vi.fn()} />);

    const thumb = screen.getByRole('button', { name: '查看图片 frame.png' });
    thumb.focus();
    expect(document.activeElement).toBe(thumb);

    fireEvent.click(thumb);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(thumb);
  });

  it('keeps remove an independent control: it never opens the lightbox', () => {
    const onRemove = vi.fn();
    renderV4(<ComposeAttachmentItem entry={composeEntry()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: '移除附件 frame.png' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('preserves the upload / error / degraded overlays and the success badge', () => {
    const { rerender } = renderV4(
      <ComposeAttachmentItem
        entry={composeEntry({ status: 'uploading', attachmentId: null })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('上传中');

    rerender(
      <ComposeAttachmentItem
        entry={composeEntry({
          status: 'failed',
          attachmentId: null,
          diagnostics: [
            {
              stage: 'upload',
              code: 'attachment_upload_failed',
              level: 'error',
              message: '图片上传失败',
            },
          ],
        })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('图片上传失败')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('上传失败');

    rerender(
      <ComposeAttachmentItem
        entry={composeEntry({
          status: 'ok_degraded',
          diagnostics: [
            {
              stage: 'preprocess',
              code: 'image_preprocess_degraded_original_used',
              level: 'warning',
              message: '已使用原图',
            },
          ],
        })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('已使用原图')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('已降级处理');

    rerender(<ComposeAttachmentItem entry={composeEntry()} onRemove={vi.fn()} />);
    expect(screen.getByRole('img', { name: '上传成功' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('已上传');
  });
});
