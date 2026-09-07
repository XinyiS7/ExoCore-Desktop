import { X } from 'lucide-react';
import { useDialogA11y } from '../dialogA11y';

export interface ImageLightboxProps {
  isOpen: boolean;
  src: string;
  alt: string;
  onClose: () => void;
}

/**
 * Accessible image lightbox (Task 5, Gate G/I):
 * - labelled close button, Escape closes, backdrop click closes;
 * - focus enters/contains/restores via the shared dialog a11y pattern;
 * - clicking the image itself never closes (no accidental close).
 */
export function ImageLightbox({ isOpen, src, alt, onClose }: ImageLightboxProps) {
  const dialogRef = useDialogA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="app-lightbox"
      role="presentation"
      onClick={(e) => {
        // Backdrop close only — an image click is never treated as close.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="app-lightbox-content" role="dialog" aria-modal="true" aria-label={alt}>
        <button
          type="button"
          className="app-lightbox-close"
          onClick={onClose}
          title="关闭图片预览"
          aria-label="关闭图片预览"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <img src={src} alt={alt} className="app-lightbox-img" />
      </div>
    </div>
  );
}