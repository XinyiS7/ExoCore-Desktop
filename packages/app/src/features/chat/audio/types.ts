/**
 * P1C Audio types — recorder lifecycle (AUD-F) and automatic target gate.
 * Recovery machine + playback manager are NOT part of Phase A (STOP marker).
 */

export type RecorderStatus = 'idle' | 'recording' | 'recorded' | 'error';

export type RecorderErrorCode =
  | 'insecure_context'
  | 'browser_unsupported'
  | 'permission_denied'
  | 'no_microphone'
  | 'mic_unavailable'
  | 'recorder_error'
  | 'empty_clip'
  | 'target_changed'
  | 'target_unsupported';

/** Frozen MIME allowlist (backend mirror): opus first, then plain webm. */
export const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm'] as const;

/** Frontend preflight mirror of the backend 10 MiB audio cap. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Stable user-facing recorder error text (never raw browser messages). */
export function recorderErrorMessage(code: RecorderErrorCode | null): string {
  switch (code) {
    case 'insecure_context':
      return '录音需要 HTTPS 安全上下文（当前页面非安全来源）';
    case 'browser_unsupported':
      return '浏览器不支持录音（需 MediaRecorder 与 WebM 编码）';
    case 'permission_denied':
      return '麦克风权限被拒绝，请在浏览器设置中允许';
    case 'no_microphone':
      return '未检测到麦克风';
    case 'mic_unavailable':
      return '麦克风不可用';
    case 'recorder_error':
      return '录音设备运行时错误';
    case 'empty_clip':
      return '录音内容为空，请重试';
    case 'target_changed':
      return '模型/端点已切换，录音已取消';
    case 'target_unsupported':
      return '当前模型不支持语音附件';
    default:
      return '录音失败，请重试';
  }
}