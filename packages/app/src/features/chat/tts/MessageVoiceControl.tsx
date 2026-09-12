/**
 * P2T message voice control (Plan §7 CP 2T-2, D4–D9).
 *
 * Compact actions-cluster leaf that renders the five frozen states:
 * - `unavailable` renders nothing (the read model said there is no target);
 * - `idle` exposes the entry; the row never auto-requests (D11);
 * - `generating` is announced (`aria-busy`) with no percentage, no cancel
 *   and no fabricated timeline (D8, INV-3);
 * - `playable` expands the same button into play/pause + a slim slider whose
 *   timeline comes from the real media element only (D8);
 * - `failed_retryable` keeps an explicit retry entry with whitelist copy.
 *
 * Playback ownership is shared with the attachment player through
 * `globalAudioPlaybackManager` (D4/INV-6); the content URL must pass the
 * same-origin validator before it ever reaches `<audio>` (D10). `directed`
 * only tints the existing button — no extra text, node, title or ARIA (D9).
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Loader2, Pause, Play, RefreshCw, Volume2 } from 'lucide-react';
import type { VoiceProjection } from '../types';
import { globalAudioPlaybackManager } from '../audio/audioPlaybackManager';
import { validatedAudioContentUrl } from '../attachments/mediaUrls';
import { useMessageVoice } from './useMessageVoice';
import type { TtsErrorCode } from './types';
import './tts.css';

/**
 * Bounded failure copy per outcome code (D3 whitelist) — never free-form
 * backend text. Codes that map to `unavailable` never render, but stay
 * exhaustive so a new code cannot silently leak raw payload text.
 */
const FAILURE_COPY: Record<TtsErrorCode, string> = {
  not_found: '语音目标不存在',
  ineligible_message: '该消息不支持朗读',
  no_active_profile: '未配置声线',
  runtime_offline: '语音服务未就绪',
  generation_timeout: '语音生成超时',
  generation_failed: '语音生成失败',
  audio_artifact_missing: '音频加载失败',
  contract: '语音服务响应异常',
  network: '网络连接失败',
};

export interface MessageVoiceControlProps {
  conversationId: number;
  messageId: number;
  voice: VoiceProjection;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function namedError(cause: unknown): string | null {
  return typeof cause === 'object' && cause !== null
    ? ((cause as { name?: unknown }).name as string | undefined) ?? null
    : null;
}

export function MessageVoiceControl({
  conversationId,
  messageId,
  voice,
}: MessageVoiceControlProps) {
  const { phase, outcome, playToken, request, reportMediaFailure } = useMessageVoice({
    conversationId,
    messageId,
    voice,
  });

  const playableResource = outcome?.phase === 'playable' ? outcome.playable : null;
  const contentUrl = playableResource ? validatedAudioContentUrl(playableResource.contentUrl) : null;
  const durationHintSeconds =
    playableResource && playableResource.durationMs !== null && playableResource.durationMs > 0
      ? playableResource.durationMs / 1000
      : 0;

  const playbackId = `tts_${conversationId}_${messageId}`;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);

  // D8: the element owns the timeline; `duration_ms` is only a pre-metadata
  // display hint for the total duration.
  const totalSeconds = mediaDuration > 0 ? mediaDuration : durationHintSeconds;

  const attemptPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsLoading(true);
    audio.play().then(
      () => setIsLoading(false),
      (cause: unknown) => {
        setIsLoading(false);
        setIsPlaying(false);
        globalAudioPlaybackManager.stop(playbackId);
        const name = namedError(cause);
        // An interrupted play() is control flow; a policy rejection leaves the
        // artifact truthful and playable — never a fake success or a fake
        // synthesis failure (T6).
        if (name === 'AbortError' || name === 'NotAllowedError') return;
        reportMediaFailure();
      },
    );
  }, [playbackId, reportMediaFailure]);

  // Element lifecycle: timeline truth, manager ownership, media-failure truth.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setMediaDuration(audio.duration);
      setIsLoading(false);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      globalAudioPlaybackManager.play(playbackId, () => {
        audioRef.current?.pause();
      });
    };
    const handlePause = () => {
      setIsPlaying(false);
      globalAudioPlaybackManager.stop(playbackId);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      globalAudioPlaybackManager.stop(playbackId);
    };
    const handleError = () => {
      // A media error cannot reveal an HTTP body: it is a retryable artifact
      // truth, never endpoint-404 unavailability (T6). Release is physical.
      audio.pause();
      globalAudioPlaybackManager.stop(playbackId);
      setIsPlaying(false);
      setIsLoading(false);
      reportMediaFailure();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    const owned = audio;
    return () => {
      owned.removeEventListener('loadedmetadata', handleLoadedMetadata);
      owned.removeEventListener('timeupdate', handleTimeUpdate);
      owned.removeEventListener('play', handlePlay);
      owned.removeEventListener('pause', handlePause);
      owned.removeEventListener('ended', handleEnded);
      owned.removeEventListener('error', handleError);
      // Physical release, then ownership release: a detached media element
      // keeps playing on its own, and `manager.stop` only clears bookkeeping
      // without invoking the pause callback (F2). Cleanup runs on unmount,
      // identity change and content-URL replacement — all must stop sound.
      owned.pause();
      globalAudioPlaybackManager.stop(playbackId);
    };
  }, [contentUrl, playbackId, reportMediaFailure]);

  // Mutual exclusion: another item claiming playback pauses this element.
  useEffect(
    () =>
      globalAudioPlaybackManager.subscribe((activeId) => {
        if (activeId !== playbackId) audioRef.current?.pause();
      }),
    [playbackId],
  );

  // A playable resource that fails same-origin validation is a retryable
  // artifact failure — never copied into <audio> (D10).
  useEffect(() => {
    if (phase === 'playable' && !contentUrl) reportMediaFailure();
  }, [contentUrl, phase, reportMediaFailure]);

  // Drop local playback presentation whenever the flow leaves `playable`.
  useEffect(() => {
    if (phase === 'playable') return;
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setMediaDuration(0);
  }, [phase]);

  // Click-originated arrival at `playable` plays exactly once (D3, INV-4).
  const playedTokenRef = useRef(0);
  useEffect(() => {
    if (playToken === 0) {
      playedTokenRef.current = 0;
      return;
    }
    if (playedTokenRef.current === playToken) return;
    playedTokenRef.current = playToken;
    if (phase !== 'playable' || !contentUrl) return;
    attemptPlay();
  }, [attemptPlay, contentUrl, phase, playToken]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      return;
    }
    attemptPlay();
  }, [attemptPlay, isPlaying]);

  const seekToRatio = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      const total = mediaDuration > 0 ? mediaDuration : audio?.duration ?? 0;
      if (!audio || !Number.isFinite(total) || total <= 0) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      audio.currentTime = clamped * total;
      setCurrentTime(audio.currentTime);
    },
    [mediaDuration],
  );

  const handlePointerSeek = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekToRatio((event.clientX - rect.left) / rect.width);
  };

  const handleKeySeek = (event: KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const total = mediaDuration > 0 ? mediaDuration : audio?.duration ?? 0;
    if (!audio || !Number.isFinite(total) || total <= 0) return;
    // Same seek vocabulary as the accepted attachment player: ±5s, Home/End.
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      audio.currentTime = Math.min(total, audio.currentTime + 5);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (event.key === 'Home') {
      event.preventDefault();
      audio.currentTime = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      audio.currentTime = total;
    } else {
      return;
    }
    setCurrentTime(audio.currentTime);
  };

  if (phase === 'unavailable') return null;

  // `directed` is a visual-only modifier on the existing button (D9).
  const buttonClass = voice.directed ? 'app-voice-btn app-voice-btn--directed' : 'app-voice-btn';

  if (phase === 'playable') {
    const progressPercent =
      totalSeconds > 0 ? Math.min(100, (currentTime / totalSeconds) * 100) : 0;
    return (
      <div className="app-voice-control">
        <audio ref={audioRef} src={contentUrl ?? undefined} preload="metadata" aria-hidden="true" />
        <button
          type="button"
          className={buttonClass}
          onClick={togglePlay}
          aria-label={isPlaying ? '暂停朗读' : '播放朗读'}
        >
          {isPlaying ? (
            <Pause size={12} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={12} fill="currentColor" aria-hidden="true" />
          )}
        </button>
        <div
          className="app-voice-progress"
          role="slider"
          aria-label="朗读进度"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalSeconds)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} 共 ${formatTime(totalSeconds)}`}
          tabIndex={0}
          onClick={handlePointerSeek}
          onKeyDown={handleKeySeek}
        >
          <span className="app-voice-progress-track" aria-hidden="true">
            <span className="app-voice-progress-fill" style={{ width: `${progressPercent}%` }} />
          </span>
        </div>
        <span className="app-voice-time">
          {formatTime(currentTime)} / {formatTime(totalSeconds)}
        </span>
        {isLoading ? <span className="app-voice-loading">加载中…</span> : null}
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className="app-voice-control">
        <button
          type="button"
          className={buttonClass}
          disabled
          aria-busy="true"
          aria-label="语音生成中"
        >
          <Loader2 size={12} className="app-voice-spin" aria-hidden="true" />
          生成中
        </button>
      </div>
    );
  }

  if (phase === 'failed_retryable') {
    const copy = outcome?.phase === 'failed_retryable' ? FAILURE_COPY[outcome.code] : FAILURE_COPY.contract;
    // The bounded whitelist reason is real UI text (D3/D6): the state modifier
    // exists so narrow layouts can keep it readable instead of hiding it.
    const failureClass = voice.directed
      ? 'app-voice-btn app-voice-btn--failure app-voice-btn--directed'
      : 'app-voice-btn app-voice-btn--failure';
    return (
      <div className="app-voice-control">
        <button
          type="button"
          className={failureClass}
          onClick={request}
          aria-label="重试生成语音"
          title={copy}
        >
          <RefreshCw size={12} aria-hidden="true" />
          {copy}
        </button>
      </div>
    );
  }

  return (
    <div className="app-voice-control">
      <button type="button" className={buttonClass} onClick={request} aria-label="朗读此条消息">
        <Volume2 size={12} aria-hidden="true" />
        朗读
      </button>
    </div>
  );
}
