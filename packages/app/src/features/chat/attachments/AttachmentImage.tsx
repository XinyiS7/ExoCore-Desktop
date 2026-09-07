import { useCallback, useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import type { AttachmentMeta } from '../types';
import { ImageLightbox } from './ImageLightbox';
import { validatedImageFileUri } from './mediaUrls';

export interface AttachmentImageProps {
  meta: AttachmentMeta;
}

/**
 * Historical image thumbnail (Task 5, Gate G):
 * - validated `file_uri` only; a load failure keeps the filename visible as
 *   a fallback (never a broken icon alone);
 * - opens the accessible lightbox; the box is never opened by an image that
 *   failed to load (it stays a labelled fallback card).
 */
export function AttachmentImage({ meta }: AttachmentImageProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const src = validatedImageFileUri(meta.file_uri) ?? '';
  const label = meta.display_name || meta.original_filename || '图片附件';

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  if (!src || loadFailed) {
    return (
      <div className="app-att-filecard" data-mime={meta.mime_type}>
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
          onError={() => setLoadFailed(true)}
        />
        <span className="app-att-thumb-zoom" aria-hidden="true">
          <Maximize2 size={12} strokeWidth={1.5} />
        </span>
      </button>

      <ImageLightbox isOpen={lightboxOpen} src={src} alt={label} onClose={closeLightbox} />
    </>
  );
}