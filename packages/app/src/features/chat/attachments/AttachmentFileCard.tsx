import { FileText } from 'lucide-react';
import type { AttachmentMeta, MessageAttachmentView } from '../types';
import { validatedFileContentUrl } from './mediaUrls';

// Collection bring-back originals outside the media contract fall back to a
// file (#54); the backend serves them as a same-origin download.
const DOWNLOADABLE_SOURCES = new Set(['collection_item']);

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(mime: string | null | undefined): string {
  if (!mime) return '文件';
  const short = mime.split('/').pop()?.toUpperCase() ?? '';
  return short || '文件';
}

export interface AttachmentFileCardProps {
  meta?: AttachmentMeta;
  attachment?: MessageAttachmentView;
}

/**
 * Safe metadata-only file card (Task 5, Gate G):
 * - displays display_name, type label and size ONLY;
 * - NEVER renders `storage_path` or any server path;
 * - no download promise for other sources: only `collection_item` files are
 *   a same-origin download link (#54); every other file card stays inert.
 */
export function AttachmentFileCard({ meta, attachment }: AttachmentFileCardProps) {
  const label =
    attachment?.displayName ||
    attachment?.originalFilename ||
    meta?.display_name ||
    meta?.original_filename ||
    '文件附件';
  const mimeType = attachment?.mimeType ?? meta?.mime_type;
  const fileSize = attachment?.fileSize ?? meta?.file_size;
  const downloadUrl =
    attachment && attachment.status === 'ready' && DOWNLOADABLE_SOURCES.has(attachment.source)
      ? validatedFileContentUrl(attachment.contentUrl)
      : null;

  const body = (
    <>
      <FileText size={14} strokeWidth={1.5} aria-hidden="true" />
      <span className="app-att-filecard-name">{label}</span>
      <span className="app-att-filecard-meta">
        {typeLabel(mimeType)}
        {formatSize(fileSize) ? ` · ${formatSize(fileSize)}` : ''}
      </span>
    </>
  );

  if (downloadUrl) {
    return (
      <a
        className="app-att-filecard"
        href={downloadUrl}
        download={label}
        data-mime={mimeType ?? undefined}
        title={label}
      >
        {body}
      </a>
    );
  }
  return (
    <div className="app-att-filecard" data-mime={mimeType ?? undefined} title={label}>
      {body}
    </div>
  );
}