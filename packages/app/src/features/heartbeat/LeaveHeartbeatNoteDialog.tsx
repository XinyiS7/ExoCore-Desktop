import { type FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDialogA11y } from '../chat/dialogA11y';
import { fetchHeartbeatQueue, toHeartbeatApiError } from './api';
import type { HeartbeatPendingNote, HeartbeatQueueSummary } from './types';
import { heartbeatQueryKeys, useCreateHeartbeatNoteMutation } from './queries';

export interface LeaveHeartbeatNoteDialogProps {
  presetId: number;
  onClose: () => void;
}

/**
 * Lightweight dialog for leaving a pending note for next heartbeat (CP-B, Plan §2.2).
 * - Trimmed empty content is blocked from submission;
 * - Pre-write queue baseline captured for identity matching;
 * - Submission lock while in-flight or reconciling;
 * - On ambiguous write, automatic queue reconciliation:
 *   - newly appearing note ID or exact text match proves commit;
 *   - queue GET failure terminally disables POST and offers queue recheck only;
 *   - safe retry enabled only after successful GET with no commit evidence;
 * - Stable focus anchor (tabIndex=-1) prevents focus dropping to body when locked;
 * - Canonical .app-overlay with useDialogA11y focus containment.
 */
export function LeaveHeartbeatNoteDialog({
  presetId,
  onClose,
}: LeaveHeartbeatNoteDialogProps) {
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationFailed, setReconciliationFailed] = useState(false);

  const baselineNoteIdsRef = useRef<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const mutation = useCreateHeartbeatNoteMutation(presetId);

  const locked = mutation.isPending || reconciling;
  // CPB-R3-F06: Unresolved reconciliation locks dismissal (X, Cancel, Escape, backdrop)
  const dismissalLocked = locked || reconciliationFailed;
  const dialogRef = useDialogA11y(true, onClose, {
    locked: dismissalLocked,
    closeDisabledWhileLocked: true,
  });

  // CPB-R2-F04 / CPB-R3-F06: While locked or in unresolved reconciliation-failed state,
  // ensure focus remains anchored inside dialog container instead of falling to BODY.
  useEffect(() => {
    if (dismissalLocked) {
      dialogRef.current?.focus();
    }
  }, [dismissalLocked, dialogRef]);

  const trimmed = message.trim();
  const canSubmit = trimmed.length > 0 && !locked && !reconciliationFailed;

  async function runReconciliation(baselineIds: Set<number>, targetText: string) {
    setReconciling(true);
    setErrorMessage(null);
    try {
      const freshQueue = await queryClient.fetchQuery({
        queryKey: heartbeatQueryKeys.queue(presetId),
        queryFn: () => fetchHeartbeatQueue(presetId),
      });
      // CPB-R2-F03: 1. A newly appearing note ID proves commit (even if text transformed)
      const hasNewId = freshQueue.pendingNotes.some((n) => !baselineIds.has(n.id));
      // 2. Exact text matches
      const hasTextMatch = freshQueue.pendingNotes.some((n) => n.message === targetText);

      if (hasNewId || hasTextMatch) {
        queryClient.setQueryData(heartbeatQueryKeys.queue(presetId), freshQueue);
        onClose();
        return;
      }
      setReconciliationFailed(false);
      setErrorMessage('便签已提交，但结果无法确认，重新核对信箱未见该项；请重试。');
    } catch {
      // CPB-R2-F03: If queue re-read fails, keep POST terminally disabled.
      setReconciliationFailed(true);
      setErrorMessage('便签已提交，但结果无法确认，且重新核对信箱失败；请重试核对信箱，切勿重复提交。');
    } finally {
      setReconciling(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || locked || reconciliationFailed) return;

    setErrorMessage(null);
    setReconciliationFailed(false);

    // CPB-R2-F03: Capture pre-write queue identity baseline
    const currentQueue = queryClient.getQueryData<HeartbeatQueueSummary>(
      heartbeatQueryKeys.queue(presetId),
    );
    const baselineIds = new Set<number>(
      currentQueue?.pendingNotes.map((n: HeartbeatPendingNote) => n.id) ?? [],
    );
    baselineNoteIdsRef.current = baselineIds;

    try {
      await mutation.mutateAsync(trimmed);
      onClose();
    } catch (err) {
      const apiErr = toHeartbeatApiError(err);
      if (apiErr.ambiguousWrite) {
        await runReconciliation(baselineIds, trimmed);
      } else {
        setErrorMessage(apiErr.message);
      }
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
        className="app-dialog heartbeat-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-note-dialog-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h3 id="leave-note-dialog-title" className="app-dialog-title">
            给下一次心跳留言
          </h3>
          <button
            type="button"
            className="app-icon-btn app-dialog-close"
            onClick={onClose}
            disabled={dismissalLocked}
            aria-label="关闭对话框"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="app-dialog-body">
          <p className="app-dialog-hint">
            小纸条会暂存在心跳信箱中，并在下一次心跳触发时作为上下文一并送达。
          </p>

          {errorMessage ? (
            <div className="app-banner app-banner--error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="app-field">
            <label htmlFor="heartbeat-note-input" className="app-field-label">
              便签留言正文 <span className="app-required">*</span>
            </label>
            <textarea
              id="heartbeat-note-input"
              className="app-input heartbeat-dialog-textarea"
              rows={4}
              placeholder="留给下一次心跳的便签或提醒事项…"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (errorMessage && !reconciliationFailed) setErrorMessage(null);
              }}
              disabled={locked || reconciliationFailed}
              required
            />
          </div>

          <div className="app-dialog-actions">
            <button
              type="button"
              className="app-btn app-btn--subtle"
              onClick={onClose}
              disabled={dismissalLocked}
            >
              取消
            </button>
            {reconciliationFailed ? (
              <button
                type="button"
                className="app-btn app-btn--primary"
                onClick={() => void runReconciliation(baselineNoteIdsRef.current, trimmed)}
                disabled={reconciling}
              >
                {reconciling ? '正在核对信箱…' : '重新核对信箱'}
              </button>
            ) : (
              <button
                type="submit"
                className="app-btn app-btn--primary"
                disabled={!canSubmit || locked}
              >
                {reconciling ? '确认状态中…' : mutation.isPending ? '正在投递…' : '投递便签'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
