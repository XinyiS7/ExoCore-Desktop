import React from 'react';
import { FileText, X, AlertTriangle } from 'lucide-react';

/**
 * Extract the user-visible label from a diagnostics array.
 * Returns the first error's message, first warning's message, or null.
 */
function firstDiagnosticLabel(diagnostics, level) {
  if (!diagnostics || diagnostics.length === 0) return null;
  const match = diagnostics.find(d => d.level === level);
  return match ? match.message : null;
}

/**
 * Single compose attachment entry.
 *
 * Renders one of four visual states driven by entry.status:
 * - uploading:      spinner overlay
 * - ok:             image preview or file chip (no overlay)
 * - ok_degraded:    amber overlay ("已使用原图" etc) + preview, attachmentId set
 * - failed:         red overlay + first error message, no attachmentId
 *
 * Close button is always visible — no hover dependency for mobile.
 */
export default function ComposeAttachmentItem({ entry, onRemove }) {
  const { clientId, preview, name, uploading, attachmentId, status, diagnostics } = entry;

  const hasError = !uploading && !attachmentId && diagnostics && diagnostics.length > 0;
  const isDegraded = !uploading && attachmentId && status === 'ok_degraded';

  const errorLabel = hasError
    ? firstDiagnosticLabel(diagnostics, 'error')
    : null;
  const warningLabel = isDegraded
    ? firstDiagnosticLabel(diagnostics, 'warning')
    : null;

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

          {hasError && (
            <div className="absolute inset-0 bg-red-500/30 flex flex-col items-center justify-center gap-0.5">
              <span className="text-[0.6rem] text-red-200 leading-tight text-center px-1">
                {errorLabel || '上传失败'}
              </span>
            </div>
          )}

          {isDegraded && (
            <div className="absolute inset-0 bg-amber-500/30 flex flex-col items-center justify-center gap-0.5">
              <AlertTriangle size={10} strokeWidth={1} className="text-amber-200" />
              <span className="text-[0.6rem] text-amber-200 leading-tight text-center px-1">
                {warningLabel || '已降级处理'}
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
  const chipStyle = hasError
    ? 'border-red-500/30 text-red-400 bg-red-500/5'
    : isDegraded
      ? 'border-amber-500/30 text-amber-400 bg-amber-500/5'
      : uploading
        ? 'border-exo-mist-10 tx-message-mute bg-exo-pure'
        : 'border-exo-accent/20 tx-message-accent bg-exo-accent/5';

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[0.725rem] ${chipStyle}`}>
      <FileText size={10} strokeWidth={1} />
      <span className="max-w-[120px] truncate">{name}</span>
      {uploading && (
        <div className="w-2.5 h-2.5 border-2 border-exo-accent/50 border-t-exo-accent rounded-full animate-spin flex-shrink-0" />
      )}
      {hasError && (
        <span className="text-[0.6rem] text-red-400 flex-shrink-0 ml-1" data-testid="attachment-error-text">
          {errorLabel || '上传失败'}
        </span>
      )}
      {isDegraded && (
        <span className="text-[0.6rem] text-amber-400 flex-shrink-0 ml-1" data-testid="attachment-warning-text">
          {warningLabel || '已降级'}
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
