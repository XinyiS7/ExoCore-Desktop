import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderV4 } from './helpers';
import { MessageAttachments } from '../features/chat/attachments/MessageAttachments';
import { normalizeMessageAttachments } from '../features/chat/attachments/projection';
import {
  buildCollectMenuItems,
  hasCollectMenuItems,
} from '../features/chat/collectMenuItems';
import type { AttachmentMeta, MessageView } from '../features/chat/types';

const canonicalRow = (over: Record<string, unknown>) => ({
  ref: { type: 'session_attachment', id: 5 },
  provenance_id: null,
  kind: 'image',
  source: 'user',
  status: 'ready',
  removed: false,
  position: 0,
  display_name: 'photo.png',
  mime_type: 'image/png',
  file_size: 10,
  content_url: '/api/agents/conversations/42/attachments/5/content/',
  duration_ms: null,
  error_code: null,
  ...over,
});

describe('#83 soft-removed attachment trace', () => {
  it('projects removed only when the wire says true', () => {
    const [active, gone] = normalizeMessageAttachments(
      [
        canonicalRow({}),
        canonicalRow({
          ref: { type: 'session_attachment', id: 6 },
          removed: true,
          position: 1,
          display_name: 'chart.png',
          content_url: null,
        }),
      ],
      null,
    );

    expect(active.removed).toBeUndefined();
    expect(gone.removed).toBe(true);
  });

  it('renders type + name + 已移除 with no image, player or link entry', () => {
    const views = normalizeMessageAttachments(
      [
        canonicalRow({ removed: true, content_url: null }),
        canonicalRow({
          ref: { type: 'session_attachment', id: 7 },
          kind: 'audio',
          removed: true,
          position: 1,
          display_name: 'memo.wav',
          mime_type: 'audio/wav',
          content_url: null,
        }),
      ],
      null,
    );

    const { container } = renderV4(<MessageAttachments attachments={views} />);

    const chips = container.querySelectorAll('[data-removed="true"]');
    expect([...chips].map((chip) => chip.textContent)).toEqual([
      '图片photo.png已移除',
      '音频memo.wav已移除',
    ]);
    expect(container.querySelectorAll('img, audio, a, button').length).toBe(0);
  });

  it('keeps active siblings rendering beside a removed row', () => {
    const views = normalizeMessageAttachments(
      [
        canonicalRow({}),
        canonicalRow({
          ref: { type: 'session_attachment', id: 8 },
          kind: 'file',
          removed: true,
          position: 1,
          display_name: 'report.pdf',
          mime_type: 'application/pdf',
          content_url: null,
        }),
      ],
      null,
    );

    const { container } = renderV4(<MessageAttachments attachments={views} />);

    expect(screen.getByRole('button', { name: /查看图片 photo\.png/ })).toBeTruthy();
    expect(container.querySelector('[data-removed="true"]')?.textContent).toBe(
      '文件report.pdf已移除',
    );
  });

  it('legacy attachments_meta fallback renders the same trace', () => {
    const meta: AttachmentMeta[] = [
      {
        id: 9,
        display_name: 'old.png',
        original_filename: 'old.png',
        mime_type: 'image/png',
        file_size: 1,
        file_uri: null,
        content_url: null,
        removed: true,
      },
    ];

    const { container } = renderV4(<MessageAttachments meta={meta} />);

    expect(container.querySelector('[data-removed="true"]')?.textContent).toBe(
      '图片old.png已移除',
    );
    expect(container.querySelectorAll('img').length).toBe(0);
  });
});

describe('#83 removed attachments in the collect menu', () => {
  const messageWith = (content: string, rows: Record<string, unknown>[]): MessageView => ({
    id: 1,
    role: 'user',
    content,
    reasoningContent: null,
    clientTurnId: null,
    platform: null,
    modelVersion: null,
    tokenCount: null,
    indexInSession: 1,
    attachmentIds: [],
    attachmentsMeta: [],
    createdAt: '2026-11-08T10:00:00Z',
    attachments: normalizeMessageAttachments(rows, null),
  });
  const active = canonicalRow({ provenance_id: 'prov-active' });
  const gone = canonicalRow({
    ref: { type: 'session_attachment', id: 6 },
    removed: true,
    position: 1,
    display_name: 'chart.png',
    content_url: null,
  });

  it('skips the removed row and keeps the active sibling', () => {
    const items = buildCollectMenuItems(messageWith('', [active, gone]), () => undefined);

    expect(items.map((item) => [item.id, item.disabled])).toEqual([
      ['session_attachment:5', false],
    ]);
  });

  it('offers no collect entry when every attachment is removed and there is no body', () => {
    expect(hasCollectMenuItems(messageWith('', [gone]))).toBe(false);
  });

  it('still offers the body beside an all-removed attachment list', () => {
    const items = buildCollectMenuItems(messageWith('看图', [gone]), () => undefined);

    expect(items.map((item) => item.id)).toEqual(['body']);
  });
});
