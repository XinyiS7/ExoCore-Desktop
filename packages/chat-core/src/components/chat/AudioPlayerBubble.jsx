import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';
import { globalAudioPlaybackManager } from '../../utils/audioPlaybackManager';

/**
 * 格式化秒数为 mm:ss 或 m:ss
 */
function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * 现代风格语音播放器组件 (Audio Player Bubble)
 * 支持互斥播放、波形条进度展示、时间切换与可拖拽/点击 seek
 *
 * @param {Object} props
 * @param {string} props.src - 音频文件 URL / Blob URL
 * @param {string} [props.title] - 音频标题或文件名
 * @param {number} [props.duration] - 预设总时长（秒）
 * @param {string} [props.className] - 附加 CSS 类
 */
export default function AudioPlayerBubble({ src, title, duration: initialDuration, className = '' }) {
  const uniqueId = useId();
  const audioId = useRef(`audio_${uniqueId}_${src}`).current;
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 监听全局互斥播放状态
  useEffect(() => {
    const unsubscribe = globalAudioPlaybackManager.subscribe((activeId) => {
      if (activeId !== audioId && isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    });
    return unsubscribe;
  }, [audioId, isPlaying]);

  // 同步音频事件
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
      setHasError(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      globalAudioPlaybackManager.play(audioId, () => {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
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

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      globalAudioPlaybackManager.stop(audioId);
    };
  }, [audioId, src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      audio.play().then(() => {
        setIsLoading(false);
      }).catch((err) => {
        console.error('[AudioPlayerBubble] Play failed:', err);
        setHasError(true);
        setIsLoading(false);
      });
    }
  }, [isPlaying]);

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progressPercent = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  // 生成固定 16 根波形模拟条
  const numBars = 16;
  const barHeights = [40, 70, 45, 90, 60, 30, 80, 55, 100, 75, 50, 85, 40, 65, 35, 50];

  return (
    <div
      className={`flex items-center gap-3 bg-exo-pure/40 backdrop-blur-md border border-cinder-line rounded-lg px-3 py-2 text-xs max-w-[280px] shadow-sm transition-all hover:border-exo-accent/30 ${className}`}
      title={title || 'Voice Message'}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* 播放 / 暂停 按钮 */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={hasError}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-exo-accent/15 border border-exo-accent/30 text-exo-accent hover:bg-exo-accent hover:text-white transition-all shrink-0 active:scale-95 disabled:opacity-40"
        aria-label={isPlaying ? 'Pause Audio' : 'Play Audio'}
      >
        {hasError ? (
          <AlertCircle size={14} className="text-red-400" />
        ) : isPlaying ? (
          <Pause size={14} fill="currentColor" />
        ) : (
          <Play size={14} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      {/* 波形条与进度信息 */}
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
        {/* 点击/拖拽波形条 */}
        <div
          onClick={handleSeek}
          className="relative h-5 flex items-center gap-[2px] cursor-pointer group py-1"
        >
          {barHeights.map((h, i) => {
            const barProgress = (i / numBars) * 100;
            const isPlayed = barProgress <= progressPercent;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isPlayed
                    ? 'bg-exo-accent opacity-90'
                    : 'bg-exo-mist-20 opacity-40 group-hover:opacity-60'
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        {/* 底部时间及状态 */}
        <div className="flex items-center justify-between text-[0.625rem] font-mono text-exo-mist-60">
          <span className="truncate">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          {title && (
            <span className="truncate max-w-[80px] opacity-70 ml-1">
              {title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
