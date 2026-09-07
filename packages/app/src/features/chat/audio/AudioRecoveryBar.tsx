import type { AudioRecoveryApi } from './audioRecoveryMachine';

export interface AudioRecoveryBarProps {
  recovery: AudioRecoveryApi;
  runtimeBusy: boolean;
  deletePending: boolean;
  onRetry: () => void;
}

export function AudioRecoveryBar({
  recovery,
  runtimeBusy,
  deletePending,
  onRetry,
}: AudioRecoveryBarProps) {
  if (recovery.uploadError) {
    return (
      <div className="app-audio-recovery" role="alert">
        <span>{recovery.uploadError}</span>
        <button
          type="button"
          className="app-btn app-btn-ghost app-btn-xs"
          onClick={recovery.dismissUploadError}
          aria-label="关闭语音上传错误"
        >
          关闭
        </button>
      </div>
    );
  }

  if (!recovery.state) return null;
  if (recovery.state.kind === 'retired') {
    return (
      <div className="app-audio-recovery" role="status">
        <span>恢复所需的附件已删除，本次语音发送不能重试。</span>
        <button
          type="button"
          className="app-btn app-btn-ghost app-btn-xs"
          onClick={recovery.abandon}
          aria-label="放弃语音恢复"
        >
          放弃
        </button>
      </div>
    );
  }

  const locked = runtimeBusy || deletePending || recovery.uploading;
  const reason = locked
    ? deletePending
      ? '附件删除尚未完成，请稍候。'
      : '当前发送或对齐尚未完成，请稍候。'
    : recovery.retryDecision.enabled
      ? null
      : recovery.retryDecision.reason;

  return (
    <div className="app-audio-recovery" role="status">
      <div className="app-audio-recovery-copy">
        <strong>语音发送恢复</strong>
        <span>
          已保留原文字与全部 {recovery.state.snapshot.attachmentIds.length} 个附件编号；重试不会重新上传语音。
        </span>
        {reason ? <span className="app-muted">{reason}</span> : null}
      </div>
      <div className="app-audio-recovery-actions">
        <button
          type="button"
          className="app-btn app-btn-primary app-btn-xs"
          onClick={onRetry}
          disabled={locked || !recovery.retryDecision.enabled}
          aria-label="重试语音发送"
        >
          重试
        </button>
        <button
          type="button"
          className="app-btn app-btn-ghost app-btn-xs"
          onClick={recovery.abandon}
          disabled={runtimeBusy}
          aria-label="放弃语音恢复"
        >
          放弃
        </button>
      </div>
    </div>
  );
}
