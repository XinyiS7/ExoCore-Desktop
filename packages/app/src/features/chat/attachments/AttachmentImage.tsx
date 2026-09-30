import { useCallback, useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import type { AttachmentMeta, MessageAttachmentView } from '../types';
import { ImageLightbox } from './ImageLightbox';
import { validatedImageContentUrl, validatedImageFileUri } from './mediaUrls';

export interface AttachmentImageProps {
  meta?: AttachmentMeta;
  attachment?: MessageAttachmentView;
}

/**
 * Historical image thumbnail (Task 5, Gate G); canonical image source (V4):
 * - ordered, pre-validated candidates: same-origin canonical `contentUrl`
 *   first, then the legacy `file_uri` (same-origin or HTTPS provider);
 * - each candidate is attempted at most once: an image load error advances to
 *   the next candidate (exactly one canonical -> legacy retry), and only an
 *   exhausted candidate list shows the failed-image card;
 * - `file://`, foreign/protocol-relative canonical URLs and unvalidated
 *   strings are never copied into <img src>;
 * - a changed attachment identity or source set starts a fresh attempt
 *   sequence (no stale failure state), and identical candidate values are
 *   deduped so a dead URL is never re-attempted against itself;
 * - opens the accessible lightbox; the box is never opened by an image that
 *   failed to load (it stays a labelled fallback card).
 */
export function AttachmentImage({ meta, attachment }: AttachmentImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const fileUri = attachment?.fileUri ?? meta?.file_uri;
  const mimeType = attachment?.mimeType ?? meta?.mime_type;
  const label =
    attachment?.displayName ||
    attachment?.originalFilename ||
    meta?.display_name ||
    meta?.original_filename ||
    '图片附件';

  // Ordered, pre-validated candidates: canonical same-origin contentUrl first,
  // then the legacy file_uri. Identical values are deduped so a dead URL is
  // never re-attempted against itself.
  const canonicalSrc = validatedImageContentUrl(attachment?.contentUrl);
  const legacySrc = validatedImageFileUri(fileUri);
  const sources: string[] = [];
  if (canonicalSrc) sources.push(canonicalSrc);
  if (legacySrc && legacySrc !== canonicalSrc) sources.push(legacySrc);

  // Bounded source transition: an image error advances to the next candidate
  // at most once per candidate. The stored identity makes a changed attachment
  // or source set start a fresh sequence instead of retaining stale failure.
  const sourceIdentity = JSON.stringify([attachment?.key ?? null, meta?.id ?? null, sources]);
  const [failure, setFailure] = useState(() => ({ identity: sourceIdentity, failed: 0 }));
  const failedAttempts = failure.identity === sourceIdentity ? failure.failed : 0;
  const src = sources[failedAttempts] ?? '';
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  if (!src) {
    return (
      <div className="app-att-filecard" data-mime={mimeType ?? undefined}>
        <ImageOff size={14} strokeWidth={1.5} aria-hidden="true" />
        <span className="app-att-filecard-name" title={label}>
          {label}
        </span>
        <span className="app-att-filecard-note">图片加载失败</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="app-att-thumb"
        onClick={() => setLightboxOpen(true)}
        title={`查看图片：${label}`}
        aria-label={`查看图片 ${label}`}
      >
        <img
          src={src}
          alt={label}
          className="app-att-thumb-img"
          loading="lazy"
          onError={() =>
            setFailure((prev) => ({
              identity: sourceIdentity,
              failed: (prev.identity === sourceIdentity ? prev.failed : 0) + 1,
            }))
          }
        />
        <span className="app-att-thumb-zoom" aria-hidden="true">
          <Maximize2 size={12} strokeWidth={1.5} />
        </span>
      </button>

      <ImageLightbox isOpen={lightboxOpen} src={src} alt={label} onClose={closeLightbox} />
    </>
  );
}