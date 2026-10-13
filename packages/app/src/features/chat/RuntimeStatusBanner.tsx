import { AlertCircle, AlertTriangle, ArrowDown, RefreshCw } from 'lucide-react';
import type { ChatRuntimeError, RuntimeStatus } from './runtime/types';

export interface RuntimeStatusBannerProps {
  status: RuntimeStatus;
  statusText?: string;
  error?: ChatRuntimeError | null;
  protocolWarning?: string | null;
  hasPendingReconcile: boolean;
  onApplyPendingReconcile: () => void;
  onRetrySync: () => void;
  onRetryStop: () => void;
  onResumePolling: () => void;
  onAcknowledgeUncertain: () => void;
  onDismissTransient: () => void;
}

/**
 * Pure projection surface of the authoritative OperationState (C1B §3.2).
 * No button here can unlock a write or start a run on its own — every
 * action name maps to one exact data-only recovery in the runtime controller.
 */
export function RuntimeStatusBanner({
  status: _status,
  statusText: _statusText,
  error,
  protocolWarning,
  hasPendingReconcile,
  onApplyPendingReconcile,
  onRetrySync,
  onRetryStop,
  onResumePolling,
  onAcknowledgeUncertain,
  onDismissTransient,
}: RuntimeStatusBannerProps) {
  const hasContent = hasPendingReconcile || Boolean(protocolWarning) || Boolean(error);
  if (!hasContent) return null;

  return (
    <div className="app-runtime-banners" aria-live="polite">
      {/* 1. Pending reconcile button (scrolled-up terminal/uncertain hold, §8.1) */}
      {hasPendingReconcile ? (
        <div className="app-runtime-banner app-runtime-banner--info">
          <span>收到新消息回复</span>
          <button
            type="button"
            className="app-btn app-btn-primary app-btn-xs"
            onClick={onApplyPendingReconcile}
          >
            <ArrowDown size={12} aria-hidden="true" />
            返回最新位置
          </button>
        </div>
      ) : null}

      {/* 2. Nonfatal protocol warning (§5.2) */}
      {protocolWarning ? (
        <div className="app-runtime-banner app-runtime-banner--warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{protocolWarning}</span>
        </div>
      ) : null}

      {/* 4. Runtime error / Interruption banner */}
      {error ? (
        <div className="app-runtime-banner app-runtime-banner--error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <div className="app-runtime-banner-content">
            <div className="app-runtime-banner-msgwrap">
              <span className="app-runtime-banner-msg">{error.message}</span>
              {error.retryClass === 'uncertain' ? (
                <span className="app-runtime-banner-sub">
                  结果可能已成功：确认后将解除锁定并同步最新消息，不会自动重发。
                </span>
              ) : null}
            </div>
            <div className="app-runtime-banner-actions">
              {error.code === 'RECONCILE_FAILED' ? (
                <button type="button" className="app-btn app-btn-xs" onClick={onRetrySync}>
                  <RefreshCw size={12} aria-hidden="true" />
                  重试同步历史
                </button>
              ) : error.code === 'STOP_FAILED' ? (
                <button type="button" className="app-btn app-btn-xs" onClick={onRetryStop}>
                  <RefreshCw size={12} aria-hidden="true" />
                  重试停止
                </button>
              ) : error.retryClass === 'uncertain' ? (
                <button type="button" className="app-btn app-btn-xs" onClick={onAcknowledgeUncertain}>
                  关闭提示
                </button>
              ) : error.retryClass === 'recoverable' ? (
                <button type="button" className="app-btn app-btn-xs" onClick={onResumePolling}>
                  <RefreshCw size={12} aria-hidden="true" />
                  继续轮询
                </button>
              ) : (
                <button type="button" className="app-btn app-btn-xs" onClick={onDismissTransient}>
                  关闭提示
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}