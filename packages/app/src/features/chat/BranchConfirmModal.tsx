import { useEffect, useRef, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { useDialogA11y } from './dialogA11y';
import { toAppApiError } from './api';

export interface BranchConfirmModalProps {
  isOpen: boolean;
  targetMessage: { id: number; snippet: string } | null;
  /**
   * Confirm availability is DERIVED from the authoritative operation state
   * (intervention §6.1). This modal owns presentation/accessibility only —
   * no independent `submitting`/`locked` safety truth exists here, and closing
   * can never clear a lease or unlock an ambiguous/clear-blocked operation.
   */
  locked: boolean;
  onConfirm: (messageId: number) => Promise<void>;
  onClose: () => void;
}

export function BranchConfirmModal({
  isOpen,
  targetMessage,
  locked,
  onConfirm,
  onClose,
}: BranchConfirmModalProps) {
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogA11y(isOpen && !!targetMessage, onClose, {
    closeDisabledWhileLocked: true,
    locked,
  });
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // R5 scope disposition (A): bounded lock-transition anchor. Source-derived
  // rationale: the corrected shared helper no longer re-enters its focus
  // effect on lock flips, so THIS modal preserves its locked-state focus
  // ownership locally — when `locked` engages, move focus to the still-enabled
  // 取消 control (existing cancel/Escape/duplicate-submit/ambiguous policies
  // unchanged; helper API unchanged). Branch's real-browser lock outcome is
  // not independently verified; this is a bounded preservation measure, not
  // a claim that the native disabled-focus drop is the only possible path.
  useEffect(() => {
    if (lockedRef.current) cancelRef.current?.focus();
  }, [locked]);

  if (!isOpen || !targetMessage) return null;

  const handleBranch = async () => {
    if (locked) return;
    setError(null);
    try {
      await onConfirm(targetMessage.id);
      onClose();
    } catch (err: unknown) {
      const appError = toAppApiError(err);
      const msg = appError.message || '创建分支失败';
      setError(appError.ambiguousWrite || appError.code === 'UNCERTAIN_BRANCH' ? `${msg}` : msg);
    }
  };

  return (
    <div className="app-overlay" role="presentation">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-modal-title"
      >
        <div className="app-dialog-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={18} aria-hidden="true" />
            <h2 id="branch-modal-title" className="app-h2">
              创建独立对话分支
            </h2>
          </div>
        </div>

        <div className="app-dialog-body">
          <p>
            将从消息 <strong>#{targetMessage.id}</strong> 开始派生新的独立会话：
          </p>
          <blockquote className="app-blockquote" style={{ margin: '8px 0', fontSize: '13px' }}>
            {targetMessage.snippet.slice(0, 100)}
            {targetMessage.snippet.length > 100 ? '…' : ''}
          </blockquote>
          <p className="app-muted" style={{ fontSize: '12px' }}>
            系统将复制该回答之前的上下文（最多 21 条），在新创建的独立会话中开启全新探索，当前会话不受任何影响。
          </p>
          {error ? (
            <p className="app-error-hint" role="alert" style={{ marginTop: '8px' }}>
              {error}
              {locked ? ' 结果不确定，为避免重复创建已锁定，请在“最近会话”中确认。' : ''}
            </p>
          ) : null}
        </div>

        <div className="app-dialog-actions">
          <button ref={cancelRef} type="button" className="app-btn app-btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="app-btn app-btn-primary"
            onClick={() => void handleBranch()}
            disabled={locked}
            aria-disabled={locked}
          >
            确认创建分支
          </button>
        </div>
      </div>
    </div>
  );
}