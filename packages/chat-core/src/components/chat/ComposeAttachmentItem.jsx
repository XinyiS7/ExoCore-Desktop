import React from 'react';
import { FileText, X } from 'lucide-react';

const STAGE_LABELS = {
  preprocess: '压缩失败',
  upload: '上传失败',
  resolve: '处理失败',
};

/**
 * Single compose attachment entry.
 *
 * Renders one of three visual states:
 * - uploading: thumbnail + spinner overlay
 * - ok: thumbnail (image) or chip (non-image) with close button
 * - failed: red overlay + human-readable error text, close button
 *
 * Close button is always visible — no hover dependency for mobile.
 */
export default function ComposeAttachmentItem({ entry, onRemove }) {
  const { clientId, preview, name, error, uploading } = entry;

  const errorLabel = typeof error === 'string' ? (STAGE_LABELS[error] || error) : null;

  const handleRemove = () => {
    onRemove(clientId);
  };

  if (preview) {
    return (
      <div className="relative flex-shrink-0">
        <div className="relative h-14 w-14 rounded-md overflow-hidden border border-exo-mist-10">
          <img src={preview} alt={name} className="w-full h-full object-cover" />

          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-exo-accent/50 border-t-exo-accent rounded-full animate-spin" />
            </div>
          )}

          {errorLabel && !uploading && (
            <div className="absolute inset-0 bg-red-500/30 flex flex-col items-center justify-center gap-0.5">
              <span className="text-[0.6rem] text-red-200 leading-tight text-center px-1">
                {errorLabel}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRemove}
          aria-label={`Remove ${name}`}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-exo-pure border border-cinder-line tx-message-mute hover:text-red-400 hover:border-red-400/30 flex items-center justify-center transition-colors"
        >
          <X size={10} strokeWidth={1} />
        </button>
      </div>
    );
  }

  // Non-image file chip
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[0.725rem] ${
      errorLabel
        ? 'border-red-500/30 text-red-400 bg-red-500/5'
        : uploading
          ? 'border-exo-mist-10 tx-message-mute bg-exo-pure'
          : 'border-exo-accent/20 tx-message-accent bg-exo-accent/5'
    }`}>
      <FileText size={10} strokeWidth={1} />
      <span className="max-w-[120px] truncate">{name}</span>
      {uploading && (
        <div className="w-2.5 h-2.5 border-2 border-exo-accent/50 border-t-exo-accent rounded-full animate-spin flex-shrink-0" />
      )}
      {errorLabel && !uploading && (
        <span className="text-[0.6rem] text-red-400 flex-shrink-0 ml-1" data-testid="attachment-error-text">
          {errorLabel}
        </span>
      )}
      <button
        type="button"
        onClick={handleRemove}
        aria-label={`Remove ${name}`}
        className="flex-shrink-0 ml-1 text-cinder-line hover:text-red-400 transition-colors"
      >
        <X size={10} strokeWidth={1} />
      </button>
    </div>
  );
}
