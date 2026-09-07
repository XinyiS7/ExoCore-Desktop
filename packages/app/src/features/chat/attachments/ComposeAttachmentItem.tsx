import { Check, FileText, Loader2, TriangleAlert, X } from 'lucide-react';
import type { AttachmentDiagnostic, ComposeAttachmentEntry } from './types';

function firstDiagnosticLabel(
  diagnostics: AttachmentDiagnostic[] | undefined,
  level: 'error' | 'warning',
): string | null {
  if (!diagnostics || diagnostics.length === 0) return null;
  const match = diagnostics.find((d) => d.level === level);
  return match ? match.message : null;
}

export interface ComposeAttachmentItemProps {
  entry: ComposeAttachmentEntry;
  onRemove: (clientId: number) => void;
  /** Disabled while the C1B operation is active (Gate C/H). */
  disabled?: boolean;
}

/**
 * One compose attachment entry — exactly one of four visible states:
 * uploading / ok / ok_degraded / failed. Remove is always visible (no hover
 * dependency), never color-only.
 */
export function ComposeAttachmentItem({ entry, onRemove, disabled }: ComposeAttachmentItemProps) {
  const isUploading = entry.status === 'uploading';
  const isOk = entry.status === 'ok';
  const isDegraded = entry.status === 'ok_degraded';
  const isFailed = entry.status === 'failed';

  const errorLabel = isFailed ? firstDiagnosticLabel(entry.diagnostics, 'error') : null;
  const warningLabel = isDegraded ? firstDiagnosticLabel(entry.diagnostics, 'warning') : null;

  const stateLabel = isUploading
    ? '上传中'
    : isFailed
      ? '上传失败'
      : isDegraded
        ? '已降级处理'
        : '已上传';

  const removeLabel = `移除附件 ${entry.name}`;

  if (entry.preview) {
    // Image entry with local preview.
    const borderClass = isFailed
      ? 'app-att-item-preview--failed'
      : isDegraded
        ? 'app-att-item-preview--degraded'
        : isOk
          ? 'app-att-item-preview--ok'
          : '';
    return (
      <div className="app-att-item app-att-item--image" data-state={entry.status}>
        <div className={`app-att-item-preview-wrap ${borderClass}`}>
          <img src={entry.preview} alt={entry.name} className="app-att-item-img" />
          {isUploading ? (
            <div className="app-att-item-overlay app-att-item-overlay--uploading">
              <Loader2 size={16} className="app-att-spinner" aria-hidden="true" />
            </div>
          ) : null}
          {isFailed ? (
            <div className="app-att-item-overlay app-att-item-overlay--failed">
              <span className="app-att-item-state-text">{errorLabel ?? '上传失败'}</span>
            </div>
          ) : null}
          {isDegraded ? (
            <div className="app-att-item-overlay app-att-item-overlay--degraded">
              <TriangleAlert size={12} className="app-att-warn-icon" aria-hidden="true" />
              <span className="app-att-item-state-text">{warningLabel ?? '已降级处理'}</span>
            </div>
          ) : null}
          {isOk ? (
            <span
              className="app-att-item-success-badge"
              role="img"
              aria-label="上传成功"
            >
              <Check size={10} strokeWidth={2.5} aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="app-att-item-remove"
          onClick={() => onRemove(entry.clientId)}
          disabled={disabled}
          aria-label={removeLabel}
          title={removeLabel}
        >
          <X size={11} strokeWidth={2} aria-hidden="true" />
        </button>
        <span className="app-att-item-status" role="status">
          {stateLabel}
        </span>
      </div>
    );
  }

  // Generic file chip.
  const chipClass = isFailed
    ? 'app-att-chip--failed'
    : isDegraded
      ? 'app-att-chip--degraded'
      : isOk
        ? 'app-att-chip--ok'
        : '';
  return (
    <div className={`app-att-item ${chipClass}`} data-state={entry.status}>
      <div className="app-att-chip">
        <FileText size={12} strokeWidth={1.5} aria-hidden="true" />
        <span className="app-att-chip-name" title={entry.name}>
          {entry.name}
        </span>
        {isUploading ? <Loader2 size={11} className="app-att-spinner app-att-spinner--inline" aria-hidden="true" /> : null}
        {isOk ? <Check size={11} strokeWidth={2.5} className="app-att-ok-icon" aria-hidden="true" /> : null}
        {isFailed ? (
          <span className="app-att-item-state-text">{errorLabel ?? '上传失败'}</span>
        ) : null}
        {isDegraded ? (
          <span className="app-att-item-state-text">{warningLabel ?? '已降级'}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="app-att-item-remove app-att-item-remove--chip"
        onClick={() => onRemove(entry.clientId)}
        disabled={disabled}
        aria-label={removeLabel}
        title={removeLabel}
      >
        <X size={11} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}