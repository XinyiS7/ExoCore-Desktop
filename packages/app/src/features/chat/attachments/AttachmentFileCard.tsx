import { FileText } from 'lucide-react';
import type { AttachmentMeta } from '../types';

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
  meta: AttachmentMeta;
}

/**
 * Safe metadata-only file card (Task 5, Gate G):
 * - displays display_name, type label and size ONLY;
 * - NEVER renders `storage_path` or any server path;
 * - no download promise: the frozen contract exposes no stable same-origin
 *   document content URL for non-audio files, so this card is not clickable.
 */
export function AttachmentFileCard({ meta }: AttachmentFileCardProps) {
  const label = meta.display_name || meta.original_filename || '文件附件';
  return (
    <div className="app-att-filecard" data-mime={meta.mime_type} title={label}>
      <FileText size={14} strokeWidth={1.5} aria-hidden="true" />
      <span className="app-att-filecard-name">{label}</span>
      <span className="app-att-filecard-meta">
        {typeLabel(meta.mime_type)}
        {formatSize(meta.file_size) ? ` · ${formatSize(meta.file_size)}` : ''}
      </span>
    </div>
  );
}