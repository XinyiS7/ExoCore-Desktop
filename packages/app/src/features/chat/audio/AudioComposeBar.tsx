import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AudioRecorderApi } from './useAudioRecorder';

export interface AudioComposeBarProps {
  recorder: AudioRecorderApi;
  /** Generation/busy lock — disables stop/send/cancel during a run. */
  busy: boolean;
  /**
   * Phase A (Task 3): recorder lifecycle only — recording/recorded/error
   * compose states. The recorded-state Send button is wired by Task 4's
   * runtime integration; until then it is omitted (no dead buttons).
   */
  onSend?: () => void;
}

/**
 * Recording compose bar — three explicit states (Gate E):
 * - recording: live seconds + stop;
 * - recorded: local preview + cancel (+ send once Task 4 wires it);
 * - error: stable message + close.
 */
export function AudioComposeBar({ recorder, busy, onSend }: AudioComposeBarProps) {
  const [playbackError, setPlaybackError] = useState(false);
  useEffect(() => {
    if (recorder.status !== 'recorded') setPlaybackError(false);
  }, [recorder.status, recorder.blobUrl]);

  if (recorder.status === 'idle') return null;

  if (recorder.status === 'recording') {
    return (
      <div className="app-audio-bar" role="status" aria-live="polite">
        <span className="app-audio-rec-dot" aria-hidden="true" />
        <span className="app-audio-rec-seconds">{recorder.recordingSeconds}s / 60s</span>
        <button
          type="button"
          className="app-btn app-btn-danger app-btn-xs"
          onClick={() => recorder.stop()}
          disabled={busy}
          title="停止录音"
          aria-label="停止录音"
        >
          停止
        </button>
      </div>
    );
  }

  if (recorder.status === 'recorded') {
    return (
      <div className="app-audio-bar">
        {playbackError ? (
          <span className="app-att-item-state-text" role="alert">
            音频加载/播放失败
          </span>
        ) : (
          <audio
            controls
            src={recorder.blobUrl ?? undefined}
            onError={() => setPlaybackError(true)}
            className="app-audio-preview"
          >
            您的浏览器不支持音频预览
          </audio>
        )}
        {onSend ? (
          <button
            type="button"
            className="app-btn app-btn-primary app-btn-xs"
            onClick={onSend}
            disabled={busy}
            title="发送语音"
            aria-label="发送语音"
          >
            发送
          </button>
        ) : null}
        <button
          type="button"
          className="app-btn app-btn-ghost app-btn-xs"
          onClick={recorder.cancel}
          disabled={busy}
          title="取消录音"
          aria-label="取消录音"
        >
          取消
        </button>
      </div>
    );
  }

  // error
  return (
    <div className="app-audio-bar app-audio-bar--error" role="alert">
      {recorder.error === 'target_unsupported' ? (
        <Loader2 size={12} className="app-att-spinner app-att-spinner--inline" aria-hidden="true" />
      ) : null}
      <span className="app-att-item-state-text">{recorder.errorMessage}</span>
      <button
        type="button"
        className="app-btn app-btn-ghost app-btn-xs"
        onClick={recorder.cancel}
        disabled={busy}
        title="关闭"
        aria-label="关闭错误提示"
      >
        关闭
      </button>
    </div>
  );
}