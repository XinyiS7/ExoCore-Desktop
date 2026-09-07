import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { AlertCircle, Pause, Play } from 'lucide-react';
import type { AttachmentMeta } from '../types';
import { globalAudioPlaybackManager } from './audioPlaybackManager';
import { validatedAudioContentUrl } from '../attachments/mediaUrls';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Fixed decorative bars (waveform analysis is NOT a P1C promise). */
const BAR_HEIGHTS = [40, 70, 45, 90, 60, 30, 80, 55, 100, 75, 50, 85, 40, 65, 35, 50];

export interface AudioPlayerBubbleProps {
  /** Canonical same-origin content_url (never a remote file_uri). */
  meta: AttachmentMeta;
}

/**
 * Historical audio bubble (Task 5, Gate G):
 * - plays ONLY the same-origin `content_url`;
 * - 404/load/play failures stay visible with a stable alert;
 * - pointer click AND keyboard (left/right arrows) seek an accessible
 *   slider control;
 * - one global mutual-exclusion owner pauses any previously playing item.
 */
export function AudioPlayerBubble({ meta }: AudioPlayerBubbleProps) {
  const src = validatedAudioContentUrl(meta.content_url) ?? '';
  const uniqueId = useId();
  const audioId = `audio_${uniqueId}_${meta.id}`;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(!src);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Mutual exclusion: another item claiming playback pauses this one.
  useEffect(() => {
    const unsubscribe = globalAudioPlaybackManager.subscribe((activeId) => {
      if (activeId !== audioId && isPlaying && audioRef.current) {
        audioRef.current.pause();
      }
    });
    return unsubscribe;
  }, [audioId, isPlaying]);

  // Audio element lifecycle events / resource ownership.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      setHasError(false);
      setIsLoading(false);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      globalAudioPlaybackManager.play(audioId, () => {
        if (audioRef.current) audioRef.current.pause();
      });
    };
    const handlePause = () => {
      setIsPlaying(false);
      globalAudioPlaybackManager.stop(audioId);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      globalAudioPlaybackManager.stop(audioId);
    };
    const handleError = () => {
      // 404/network/decode failure stays visible; ownership released.
      setHasError(true);
      setIsPlaying(false);
      setIsLoading(false);
      globalAudioPlaybackManager.stop(audioId);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    const auditEl = audio;
    return () => {
      auditEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      auditEl.removeEventListener('timeupdate', handleTimeUpdate);
      auditEl.removeEventListener('play', handlePlay);
      auditEl.removeEventListener('pause', handlePause);
      auditEl.removeEventListener('ended', handleEnded);
      auditEl.removeEventListener('error', handleError);
      globalAudioPlaybackManager.stop(audioId);
    };
  }, [audioId, src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasError) return;
    if (isPlaying) {
      audio.pause();
      return;
    }
    setIsLoading(true);
    audio
      .play()
      .then(() => setIsLoading(false))
      .catch(() => {
        setHasError(true);
        setIsLoading(false);
        setIsPlaying(false);
        globalAudioPlaybackManager.stop(audioId);
      });
  }, [audioId, hasError, isPlaying]);

  const seekToRatio = useCallback((ratio: number) => {
    const audio = audioRef.current;
    const total = duration || (audio?.duration ?? 0);
    if (!audio || !total || !Number.isFinite(total) || total <= 0) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    audio.currentTime = clamped * total;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const handlePointerSeek = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekToRatio((e.clientX - rect.left) / rect.width);
  };

  const handleKeySeek = (e: KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const total = duration || (audio?.duration ?? 0);
    if (!audio || !total || !Number.isFinite(total) || total <= 0) return;
    // 5-second keyboard steps with Home/End as full seek.
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      audio.currentTime = Math.min(total, audio.currentTime + 5);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      audio.currentTime = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      audio.currentTime = total;
    }
    setCurrentTime(audio.currentTime);
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const title = meta.display_name || meta.original_filename || '语音消息';

  return (
    <div className="app-audio-bubble" title={title}>
      <audio ref={audioRef} src={src || undefined} preload="metadata" aria-hidden="true" />

      <button
        type="button"
        className="app-audio-bubble-btn"
        onClick={() => void togglePlay()}
        disabled={hasError}
        aria-label={isPlaying ? `暂停语音 ${title}` : `播放语音 ${title}`}
      >
        {hasError ? (
          <AlertCircle size={14} aria-hidden="true" />
        ) : isPlaying ? (
          <Pause size={14} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play size={14} fill="currentColor" className="app-audio-bubble-play" aria-hidden="true" />
        )}
      </button>

      <div className="app-audio-bubble-main">
        {/* Decorative waveform + accessible seek slider (same element). */}
        <div
          className="app-audio-bubble-waves"
          role="slider"
          aria-label={`语音进度 ${title}`}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} 共 ${formatTime(duration)}`}
          tabIndex={hasError ? -1 : 0}
          onClick={handlePointerSeek}
          onKeyDown={handleKeySeek}
        >
          {BAR_HEIGHTS.map((h, i) => {
            const barProgress = (i / BAR_HEIGHTS.length) * 100;
            return (
              <span
                key={i}
                className={`app-audio-bubble-bar${barProgress <= progressPercent ? ' app-audio-bubble-bar--played' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        <div className="app-audio-bubble-meta">
          {hasError ? (
            <span className="app-audio-bubble-error" role="alert">
              音频加载/播放失败
            </span>
          ) : isLoading ? (
            <span className="app-audio-bubble-loading">加载中…</span>
          ) : (
            <span className="app-audio-bubble-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}