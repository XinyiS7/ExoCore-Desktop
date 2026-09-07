import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIO_MIME_CANDIDATES, recorderErrorMessage, type RecorderErrorCode, type RecorderStatus } from './types';

/**
 * Frontend capability probe for the frozen WebM MIME allowlist.
 * jsdom / no-MediaRecorder environments return null.
 */
export function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  return AUDIO_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export interface AudioRecorderApi {
  status: RecorderStatus;
  recordingSeconds: number;
  blob: Blob | null;
  blobUrl: string | null;
  error: RecorderErrorCode | null;
  errorMessage: string;
  mimeType: string | null;
  /** AUD-F preflight (secure context / getUserMedia / MIME) then record. */
  start: () => Promise<void>;
  /** Stop and finalize a clip (0-byte clips are rejected). */
  stop: () => void;
  /** Cancel: release tracks, revoke URL, reset to idle. */
  cancel: () => void;
  /** Fail with a stable code (target gate); full resource cleanup. */
  fail: (code: RecorderErrorCode) => void;
}

/**
 * Native MediaRecorder wrapper — TS port of the frozen AUD-F contract:
 * secure-context / getUserMedia / frozen WebM MIME preflight, epoch token,
 * zero-byte rejection, 60-second cap, unmount track+URL release.
 */
export function useAudioRecorder(maxDurationMs = 60000): AudioRecorderApi {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<RecorderErrorCode | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startAtRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  /** Synchronous ownership guard while getUserMedia permission is pending. */
  const startPendingRef = useRef(false);
  const maxRef = useRef(maxDurationMs);
  maxRef.current = maxDurationMs;

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      try {
        URL.revokeObjectURL(blobUrlRef.current);
      } catch {
        /* ignore */
      }
      blobUrlRef.current = null;
    }
  }, []);

  const cleanupInternal = useCallback(() => {
    // epoch++ invalidates any late onstop/onerror (cancel/unmount must never
    // resurrect a clip).
    epochRef.current += 1;
    startPendingRef.current = false;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* already stopping */
      }
    }
    recorderRef.current = null;
    stopTracks();
    chunksRef.current = [];
  }, [stopTracks]);

  // Unmount cleanup: release tracks + revoke local preview URL.
  useEffect(
    () => () => {
      cleanupInternal();
      revokeBlobUrl();
    },
    [cleanupInternal, revokeBlobUrl],
  );

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* already stopping */
      }
    } else {
      stopTracks();
    }
  }, [stopTracks]);

  const start = useCallback(async () => {
    // React state cannot serialize two Start clicks in the same render. Refs
    // own both pending permission and an already-created recorder.
    if (startPendingRef.current || recorderRef.current) return;
    startPendingRef.current = true;
    const epoch = ++epochRef.current;
    setError(null);
    setStatus('idle');

    // Preflight 1: secure context (HTTPS-only, PWA).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      startPendingRef.current = false;
      setError('insecure_context');
      setStatus('error');
      return;
    }
    // Preflight 2: getUserMedia availability.
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      startPendingRef.current = false;
      setError('browser_unsupported');
      setStatus('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      // Cancel/route switch/new attempt owns the UI now; an obsolete denial
      // must not overwrite it.
      if (epochRef.current !== epoch) return;
      startPendingRef.current = false;
      const name = (e as DOMException)?.name;
      setError(
        name === 'NotAllowedError'
          ? 'permission_denied'
          : name === 'NotFoundError'
            ? 'no_microphone'
            : 'mic_unavailable',
      );
      setStatus('error');
      return;
    }
    // Cancel/unmount raced the permission grant → release track immediately.
    if (epochRef.current !== epoch) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    // Preflight 3: MediaRecorder + frozen WebM MIME (no browser-default MIME).
    const mime = pickSupportedMimeType();
    if (!mime) {
      for (const track of stream.getTracks()) track.stop();
      startPendingRef.current = false;
      setError('browser_unsupported');
      setStatus('error');
      return;
    }

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      for (const track of stream.getTracks()) track.stop();
      startPendingRef.current = false;
      setError('browser_unsupported');
      setStatus('error');
      return;
    }

    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (epochRef.current !== epoch) return;
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      if (epochRef.current !== epoch) return; // delayed onstop after cancel/error
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
      try {
        blobUrlRef.current = URL.createObjectURL(fullBlob);
        setBlobUrl(blobUrlRef.current);
      } catch {
        blobUrlRef.current = null;
        setBlobUrl(null);
      }
      setRecordingSeconds(Math.max(1, Math.round((Date.now() - startAtRef.current) / 1000)));
      setStatus('recorded');
      stopTracks();
    };
    rec.onerror = () => {
      if (epochRef.current !== epoch) return;
      cleanupInternal(); // epoch++ → late onstop cannot publish the clip
      revokeBlobUrl();
      setBlob(null);
      setBlobUrl(null);
      setError('recorder_error');
      setStatus('error');
    };

    // Assign refs BEFORE start() so a synchronous throw still cleans up.
    recorderRef.current = rec;
    streamRef.current = stream;
    try {
      rec.start();
      startPendingRef.current = false;
    } catch {
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
    timerRef.current = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startAtRef.current) / 1000);
      setRecordingSeconds(secs);
      if (secs * 1000 >= maxRef.current) stop();
    }, 250);
  }, [stop, cleanupInternal, revokeBlobUrl, stopTracks]);

  const cancel = useCallback(() => {
    cleanupInternal();
    revokeBlobUrl();
    setBlob(null);
    setBlobUrl(null);
    setMimeType(null);
    setRecordingSeconds(0);
    setStatus('idle');
  }, [cleanupInternal, revokeBlobUrl]);

  const fail = useCallback(
    (code: RecorderErrorCode) => {
      cleanupInternal();
      revokeBlobUrl();
      setBlob(null);
      setBlobUrl(null);
      setError(code);
      setStatus('error');
    },
    [cleanupInternal, revokeBlobUrl],
  );

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