import { useCallback, useState } from 'react';
import { AlertCircle, Star, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { listConversations, setPrimeConversation, toAppApiError } from '../chat/api';
import { queryKeys } from '../chat/queries';
import { useDialogA11y } from '../chat/dialogA11y';

export interface PrimeConversationConfirmDialogProps {
  open: boolean;
  conversationId: number;
  conversationName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PrimeConversationConfirmDialog({
  open,
  conversationId,
  conversationName,
  onClose,
  onSuccess,
}: PrimeConversationConfirmDialogProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationFailed, setReconciliationFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const locked = submitting || reconciling;
  const dismissalLocked = locked || reconciliationFailed;

  const close = useCallback(() => {
    if (dismissalLocked) return;
    onClose();
  }, [dismissalLocked, onClose]);

  const dialogRef = useDialogA11y(open, close, {
    closeDisabledWhileLocked: dismissalLocked,
    locked: dismissalLocked,
  });

  if (!open) return null;

  const displayName =
    conversationName.trim() !== '' ? conversationName : `会话 #${conversationId}`;

  async function reconcileCommit(): Promise<boolean> {
    setReconciling(true);
    try {
      const rows = await listConversations();
      queryClient.setQueryData(queryKeys.conversations, rows);
      const target = rows.find((r) => r.id === conversationId);
      if (target?.isPrime) {
        setReconciliationFailed(false);
        setErrorMessage(null);
        onSuccess?.();
        onClose();
        return true;
      }
      setReconciliationFailed(false);
      setErrorMessage('主会话设置未生效，请重新确认。');
      return false;
    } catch {
      setReconciliationFailed(true);
      setErrorMessage('主会话已提交，但结果无法确认，且核对会话列表失败；请重试核对，切勿重复提交。');
      return false;
    } finally {
      setReconciling(false);
    }
  }

  async function handleConfirm() {
    if (locked || reconciliationFailed) return;
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await setPrimeConversation(conversationId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      onSuccess?.();
      onClose();
    } catch (cause) {
      const err = toAppApiError(cause);
      if (err.ambiguousWrite) {
        await reconcileCommit();
      } else {
        const msg =
          err.fieldErrors?.is_prime ||
          (err.body && typeof (err.body as { error?: unknown }).error === 'string'
            ? (err.body as { error: string }).error
            : err.message);
        setErrorMessage(msg || '设置主会话失败');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="app-overlay"
      role="presentation"
      onClick={(e) => {
        if (!dismissalLocked && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="app-dialog prime-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prime-confirm-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h2 id="prime-confirm-title" className="app-h2">
            将「{displayName}」设为主会话？
          </h2>
          <button
            type="button"
            className="app-icon-btn app-dialog-close"
            aria-label="关闭"
            onClick={close}
            disabled={dismissalLocked}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="app-dialog-body prime-confirm-body">
          <p className="prime-confirm-desc">
            阿莱之后主动发送的消息会进入这个会话。
          </p>

          {errorMessage ? (
            <div className="app-banner app-banner--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
        </div>

        <div className="app-dialog-actions">
          <button
            type="button"
            className="app-btn app-btn-ghost"
            onClick={close}
            disabled={dismissalLocked}
          >
            取消
          </button>

          {reconciliationFailed ? (
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => void reconcileCommit()}
              disabled={reconciling}
            >
              {reconciling ? '核对中…' : '重新核对会话'}
            </button>
          ) : (
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={() => void handleConfirm()}
              disabled={locked}
            >
              <Star size={14} aria-hidden="true" />
              {submitting ? '设置中…' : '设为主会话'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
