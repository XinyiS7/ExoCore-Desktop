import { type FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDialogA11y } from '../chat/dialogA11y';
import { fetchHeartbeatQueue, toHeartbeatApiError } from './api';
import type { HeartbeatExplicitWakeup, HeartbeatQueueSummary } from './types';
import { heartbeatQueryKeys, useScheduleHeartbeatWakeupMutation } from './queries';

export interface ScheduleHeartbeatDialogProps {
  presetId: number;
  onClose: () => void;
}

function getDefaultWakeupTime(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(0);
  d.setSeconds(0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatToBackendTime(datetimeLocal: string): string {
  // datetime-local produces YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss, backend expects YYYY-MM-DD HH:MM
  const normalized = datetimeLocal.replace('T', ' ');
  const parts = normalized.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return normalized;
}

/**
 * Dialog for scheduling a user-designated wakeup task (CP-B, Plan §2.2).
 * - UI inputs: local datetime-local + message text;
 * - Normalizes browser-provided seconds to YYYY-MM-DD HH:MM;
 * - resume_check fixed to false;
 * - Pre-write queue baseline captured for identity and unshown count;
 * - Submission lock while in-flight or reconciling;
 * - On ambiguous write, automatic queue reconciliation:
 *   - newly appearing wakeup ID, increased unshown count, or text match proves commit;
 *   - queue GET failure terminally disables POST and offers queue recheck only;
 *   - safe retry enabled only after successful GET with no commit evidence;
 * - Stable focus anchor (tabIndex=-1) prevents focus dropping to body when locked;
 * - Canonical .app-overlay with useDialogA11y focus containment.
 */
export function ScheduleHeartbeatDialog({
  presetId,
  onClose,
}: ScheduleHeartbeatDialogProps) {
  const [wakeUpAt, setWakeUpAt] = useState(getDefaultWakeupTime);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationFailed, setReconciliationFailed] = useState(false);

  const baselineWakeupIdsRef = useRef<Set<number>>(new Set());
  const baselineUnshownCountRef = useRef<number>(0);
  const queryClient = useQueryClient();
  const mutation = useScheduleHeartbeatWakeupMutation(presetId);

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
  const canSubmit =
    wakeUpAt.trim().length > 0 && trimmed.length > 0 && !locked && !reconciliationFailed;

  async function runReconciliation(
    baselineIds: Set<number>,
    baselineUnshown: number,
    targetText: string,
  ) {
    setReconciling(true);
    setErrorMessage(null);
    try {
      const freshQueue = await queryClient.fetchQuery({
        queryKey: heartbeatQueryKeys.queue(presetId),
        queryFn: () => fetchHeartbeatQueue(presetId),
      });

      // CPB-R2-F03:
      // 1. Newly appearing task ID proves commit (even if text transformed)
      const hasNewId = freshQueue.explicitWakeups.some((w) => !baselineIds.has(w.taskId));
      // 2. Increased unshown_explicit_count proves commit outside visible 20-row projection cap
      const hasCountIncrease = freshQueue.unshownExplicitCount > baselineUnshown;
      // 3. Exact text matches
      const hasTextMatch = freshQueue.explicitWakeups.some((w) => w.message === targetText);

      if (hasNewId || hasCountIncrease || hasTextMatch) {
        queryClient.setQueryData(heartbeatQueryKeys.queue(presetId), freshQueue);
        onClose();
        return;
      }
      setReconciliationFailed(false);
      setErrorMessage('预约已提交，但结果无法确认，重新核对信箱未见该项；请重试。');
    } catch {
      // CPB-R2-F03: If queue re-read fails, keep POST terminally disabled.
      setReconciliationFailed(true);
      setErrorMessage('预约已提交，但结果无法确认，且重新核对信箱失败；请重试核对信箱，切勿重复提交。');
    } finally {
      setReconciling(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || locked || reconciliationFailed) return;

    setErrorMessage(null);
    setReconciliationFailed(false);

    // CPB-R2-F03: Capture pre-write queue identity and unshown count baseline
    const currentQueue = queryClient.getQueryData<HeartbeatQueueSummary>(
      heartbeatQueryKeys.queue(presetId),
    );
    const baselineIds = new Set<number>(
      currentQueue?.explicitWakeups.map((w: HeartbeatExplicitWakeup) => w.taskId) ?? [],
    );
    const baselineUnshown = currentQueue?.unshownExplicitCount ?? 0;
    baselineWakeupIdsRef.current = baselineIds;
    baselineUnshownCountRef.current = baselineUnshown;

    try {
      const backendTime = formatToBackendTime(wakeUpAt);
      await mutation.mutateAsync({
        wakeUpAt: backendTime,
        message: trimmed,
      });
      onClose();
    } catch (err) {
      const apiErr = toHeartbeatApiError(err);
      if (apiErr.ambiguousWrite) {
        await runReconciliation(baselineIds, baselineUnshown, trimmed);
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
        aria-labelledby="schedule-wakeup-dialog-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h3 id="schedule-wakeup-dialog-title" className="app-dialog-title">
            预约心跳唤醒
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
            指定唤醒将在约定时间准时触发 Agent 心跳，并投递本次附带的留言。
          </p>

          {errorMessage ? (
            <div className="app-banner app-banner--error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="app-field">
            <label htmlFor="heartbeat-wakeup-time-input" className="app-field-label">
              唤醒时间 (本地时间) <span className="app-required">*</span>
            </label>
            <input
              id="heartbeat-wakeup-time-input"
              type="datetime-local"
              step={60}
              className="app-input heartbeat-dialog-input"
              value={wakeUpAt}
              onChange={(e) => {
                setWakeUpAt(e.target.value);
                if (errorMessage && !reconciliationFailed) setErrorMessage(null);
              }}
              disabled={locked || reconciliationFailed}
              required
            />
          </div>

          <div className="app-field">
            <label htmlFor="heartbeat-wakeup-msg-input" className="app-field-label">
              唤醒留言正文 <span className="app-required">*</span>
            </label>
            <textarea
              id="heartbeat-wakeup-msg-input"
              className="app-input heartbeat-dialog-textarea"
              rows={3}
              placeholder="唤醒时的留言或触发主题…"
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
                onClick={() =>
                  void runReconciliation(
                    baselineWakeupIdsRef.current,
                    baselineUnshownCountRef.current,
                    trimmed,
                  )
                }
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
                {reconciling ? '确认状态中…' : mutation.isPending ? '正在预约…' : '确认预约'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
