import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIO_MIME_CANDIDATES } from '../utils/attachmentStorage';

/**
 * 前端录音能力探测（Phase 0 冻结：audio/webm;codecs=opus 优先，audio/webm 兜底）。
 * jsdom/无 MediaRecorder 环境返回 null。
 */
export function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  return AUDIO_MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) || null;
}

function recorderErrorMessage(code) {
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
    default:
      return '录音失败，请重试';
  }
}

/**
 * native MediaRecorder 封装。
 * status: idle | recording | recorded | error
 * 安全边界（Frozen AUD-F recorder contract）：
 * - preflight：secure context / getUserMedia / MediaRecorder / 冻结 WebM MIME，
 *   任一不满足即拒绝；已获取的 track 立即释放。
 * - epoch token：cancel/error/unmount 递增 epoch，迟到的 onstop 回调被忽略，
 *   不会复活 clip 或 object URL。
 * - 空录音（0 字节）拒绝，不发布 clip。
 * - 60s 自动停止；unmount 自动释放轨道 + revoke URL。
 */
export function useAudioRecorder({ maxDurationMs = 60000 } = {}) {
  const [status, setStatus] = useState('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);
  const [mimeType, setMimeType] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const startAtRef = useRef(0);
  const blobUrlRef = useRef(null);
  const epochRef = useRef(0);
  const maxRef = useRef(maxDurationMs);
  maxRef.current = maxDurationMs;

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const cleanupInternal = useCallback(() => {
    // epoch++ 使任何迟到的 onstop/onerror 失效，防止 cancel/unmount 后复活 clip
    epochRef.current += 1;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch (_) { /* already stopping */ }
    }
    recorderRef.current = null;
    stopTracks();
    chunksRef.current = [];
  }, [stopTracks]);

  // unmount cleanup：释放轨道 + 撤销本地预览 URL
  useEffect(() => () => {
    cleanupInternal();
    revokeBlobUrl();
  }, [cleanupInternal, revokeBlobUrl]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch (_) { /* already stopping */ }
    } else {
      stopTracks();
    }
  }, [stopTracks]);

  const start = useCallback(async () => {
    if (status === 'recording') return;
    const epoch = epochRef.current;
    setError(null);
    setStatus('idle');

    // preflight 1: secure context（HTTPS-only，PWA 手机端）
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('insecure_context');
      setStatus('error');
      return;
    }
    // preflight 2: getUserMedia availability
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setError('browser_unsupported');
      setStatus('error');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(
        e && e.name === 'NotAllowedError' ? 'permission_denied'
          : e && e.name === 'NotFoundError' ? 'no_microphone'
          : 'mic_unavailable'
      );
      setStatus('error');
      return;
    }
    // 等待授权期间被 cancel/unmount 抢占 → 释放 track
    if (epochRef.current !== epoch) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    // preflight 3: MediaRecorder + 冻结 WebM MIME（不 fallback 到浏览器默认 MIME）
    const mime = pickSupportedMimeType();
    if (!mime) {
      stream.getTracks().forEach(t => t.stop());
      setError('browser_unsupported');
      setStatus('error');
      return;
    }

    let rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch (_e) {
      stream.getTracks().forEach(t => t.stop());
      setError('browser_unsupported');
      setStatus('error');
      return;
    }

    chunksRef.current = [];
    rec.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };    rec.onstop = () => {
      if (epochRef.current !== epoch) return; // delayed onstop after cancel/error/unmount
      const fullBlob = new Blob(chunksRef.current, { type: mime });
      if (!fullBlob.size) {
        cleanupInternal();
        revokeBlobUrl();
        setBlob(null);
        setBlobUrl(null);
        setMimeType(null);
        setError('empty_clip');
        setStatus('error');
        return;
      }
      setBlob(fullBlob);
      setMimeType(mime);
      revokeBlobUrl();
      blobUrlRef.current = URL.createObjectURL(fullBlob);
      setBlobUrl(blobUrlRef.current);
      setRecordingSeconds(Math.max(1, Math.round((Date.now() - startAtRef.current) / 1000)));
      setStatus('recorded');
      stopTracks();
    };
    rec.onerror = () => {
      if (epochRef.current !== epoch) return;
      cleanupInternal(); // epoch++ → 迟到的 onstop 不能发布 clip
      revokeBlobUrl();
      setBlob(null);
      setBlobUrl(null);
      setError('recorder_error');
      setStatus('error');
    };

    // 先赋值 refs，start() 抛错时 cleanupInternal 仍能释放 track
    recorderRef.current = rec;
    streamRef.current = stream;
    try {
      rec.start();
    } catch (_e) {
      // P0-R1: start() 同步失败 → 受控事务收尾，不向 UI 抛 rejected promise
      cleanupInternal();
      revokeBlobUrl();
      setBlob(null);
      setBlobUrl(null);
      setError('recorder_error');
      setStatus('error');
      return;
    }
    startAtRef.current = Date.now();
    setStatus('recording');
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startAtRef.current) / 1000);
      setRecordingSeconds(secs);
      if (secs * 1000 >= maxRef.current) stop();
    }, 250);
  }, [status, stop, cleanupInternal, revokeBlobUrl]);

  const cancel = useCallback(() => {
    cleanupInternal();
    revokeBlobUrl();
    setBlob(null);
    setBlobUrl(null);
    setMimeType(null);
    setRecordingSeconds(0);
    setStatus('idle');
  }, [cleanupInternal, revokeBlobUrl]);

  const fail = useCallback((code) => {
    cleanupInternal();
    revokeBlobUrl();
    setBlob(null);
    setBlobUrl(null);
    setError(code);
    setStatus('error');
  }, [cleanupInternal, revokeBlobUrl]);

  return {
    status,
    recordingSeconds,
    blob,
    blobUrl,
    error,
    errorMessage: recorderErrorMessage(error),
    mimeType,
    start,
    stop,
    cancel,
    fail,
  };
}
