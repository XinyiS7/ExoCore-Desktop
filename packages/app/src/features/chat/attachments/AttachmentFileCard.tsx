import { FileText } from 'lucide-react';
import type { AttachmentMeta, MessageAttachmentView } from '../types';

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
 * - no download promise: the frozen contract exposes no stable same-origin
 *   document content URL for non-audio files, so this card is not clickable.
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

  return (
    <div className="app-att-filecard" data-mime={mimeType ?? undefined} title={label}>
      <FileText size={14} strokeWidth={1.5} aria-hidden="true" />
      <span className="app-att-filecard-name">{label}</span>
      <span className="app-att-filecard-meta">
        {typeLabel(mimeType)}
        {formatSize(fileSize) ? ` · ${formatSize(fileSize)}` : ''}
      </span>
    </div>
  );
}