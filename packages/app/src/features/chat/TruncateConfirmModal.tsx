import { AlertTriangle } from 'lucide-react';
import { useDialogA11y } from './dialogA11y';

export interface TruncateConfirmModalProps {
  isOpen: boolean;
  targetMessageId: number;
  actionType: 'edit' | 'regenerate';
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Truncation confirmation (R1-06): a real bounded modal with focus
 * management and Escape handling, reusing the accepted app-overlay/app-dialog
 * pattern instead of the previous un-styled backdrop/foot classes.
 */
export function TruncateConfirmModal({
  isOpen,
  targetMessageId,
  actionType,
  onConfirm,
  onClose,
}: TruncateConfirmModalProps) {
  const dialogRef = useDialogA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="app-overlay" role="presentation">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="truncate-modal-title"
      >
        <div className="app-dialog-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="var(--color-warning, #f59e0b)" aria-hidden="true" />
            <h2 id="truncate-modal-title" className="app-h2">
              确认截断后续对话？
            </h2>
          </div>
        </div>

        <div className="app-dialog-body">
          <p>
            您正在对历史消息 <strong>#{targetMessageId}</strong> 进行
            {actionType === 'edit' ? '编辑重发' : '重新生成'}。
          </p>
          <p className="app-muted" style={{ marginTop: '8px' }}>
            根据会话模型规则，该消息之后的所有对话记录将被<strong>永久截断并清除</strong>
            ，新的回答将接续在选定节点之后。
          </p>
        </div>

        <div className="app-dialog-actions">
          <button type="button" className="app-btn app-btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="app-btn app-btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            确认截断并{actionType === 'edit' ? '编辑' : '重生成'}
          </button>
        </div>
      </div>
    </div>
  );
}
