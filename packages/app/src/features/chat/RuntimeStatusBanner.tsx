import { AlertCircle, AlertTriangle, ArrowDown, RefreshCw } from 'lucide-react';
import type { ChatRuntimeError, RuntimeStatus } from './runtime/types';

export interface RuntimeStatusBannerProps {
  status: RuntimeStatus;
  statusText?: string;
  error?: ChatRuntimeError | null;
  protocolWarning?: string | null;
  hasPendingReconcile: boolean;
  /** Independent anciliary draft-cleanup failure (§4.4) — never touches the lease. */
  draftCleanupFailed: boolean;
  onApplyPendingReconcile: () => void;
  onRetrySync: () => void;
  onRetryStop: () => void;
  onRetryReread: () => void;
  onRetryStorage: () => void;
  onResumePolling: () => void;
  onAcknowledgeUncertain: () => void;
  onDismissTransient: () => void;
  onRetryDraftCleanup: () => void;
}

/**
 * Pure projection surface of the authoritative OperationState (C1B §3.2).
 * No button here can clear a lease, unlock a write or start a run — every
 * action name maps to one exact data-only recovery in the runtime controller.
 */
export function RuntimeStatusBanner({
  status,
  statusText,
  error,
  protocolWarning,
  hasPendingReconcile,
  draftCleanupFailed,
  onApplyPendingReconcile,
  onRetrySync,
  onRetryStop,
  onRetryReread,
  onRetryStorage,
  onResumePolling,
  onAcknowledgeUncertain,
  onDismissTransient,
  onRetryDraftCleanup,
}: RuntimeStatusBannerProps) {
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

      {/* 2. Generation status / tool progress indicator */}
      {status === 'streaming' || status === 'polling' || status === 'submitting' || status === 'stopping' ? (
        <div className="app-runtime-banner app-runtime-banner--active">
          <span className="app-spinner-inline" aria-hidden="true" />
          <span>{status === 'stopping' ? '正在停止生成…' : (statusText || '正在思考与生成…')}</span>
        </div>
      ) : null}

      {/* 3. Nonfatal protocol warning (§5.2) */}
      {protocolWarning ? (
        <div className="app-runtime-banner app-runtime-banner--warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{protocolWarning}</span>
        </div>
      ) : null}

      {/* 3b. Independent draft-cleanup recovery (§4.4) — coexists with any
           operation-storage outcome; repairing one never erases the other. */}
      {draftCleanupFailed ? (
        <div className="app-runtime-banner app-runtime-banner--warning" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <div className="app-runtime-banner-content">
            <div className="app-runtime-banner-msgwrap">
              <span className="app-runtime-banner-msg">
                草稿清理失败：已发送内容可能残留为未发送状态，请勿在刷新后重复发送同一条消息。
              </span>
            </div>
            <div className="app-runtime-banner-actions">
              <button
                type="button"
                className="app-btn app-btn-xs"
                onClick={onRetryDraftCleanup}
              >
                <RefreshCw size={12} aria-hidden="true" />
                重试清理草稿
              </button>
            </div>
          </div>
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
              ) : error.code === 'STORAGE_BLOCKED_READ' ? (
                <button type="button" className="app-btn app-btn-xs" onClick={onRetryReread}>
                  <RefreshCw size={12} aria-hidden="true" />
                  重试读取存储
                </button>
              ) : error.code === 'STORAGE_CLEAR_FAILED' || error.code === 'STORAGE_UNAVAILABLE' ? (
                <button type="button" className="app-btn app-btn-xs" onClick={onRetryStorage}>
                  <RefreshCw size={12} aria-hidden="true" />
                  重试存储操作
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