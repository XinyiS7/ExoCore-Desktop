import React from 'react';

/**
 * 录音状态面板（独立于 ChatArea）。
 * - recording：红点 + 秒数 + 停止
 * - recorded：本地试听 + 发送 + 取消
 * - error：可区分错误 + 关闭
 * 波形/视觉增强不在 frozen V1 scope（见验收报告 section 10）。
 */
const AudioComposeBar = ({ recorder, isGenerating, onSend }) => {
  const [playbackError, setPlaybackError] = React.useState(false);
  // 新 clip / 状态切换时重置本地试听错误
  React.useEffect(() => {
    if (recorder.status !== 'recorded') setPlaybackError(false);
  }, [recorder.status, recorder.blobUrl]);

  if (recorder.status === 'idle') return null;
  return (
    <div className="flex items-center gap-2 px-3 pb-1.5">
      {recorder.status === 'recording' && (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-[0.625rem] tx-message-mute tabular-nums tracking-wider">
            {recorder.recordingSeconds}s / 60s
          </span>
          <button
            onClick={() => recorder.stop()}
            className="text-[0.625rem] px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-[2px] hover:bg-red-500/25 transition-colors"
          >
            停止
          </button>
        </>
      )}
      {recorder.status === 'recorded' && (
        <>
          {playbackError
            ? <span className="text-[0.625rem] text-red-400">音频加载/播放失败</span>
            : <audio
              controls
              src={recorder.blobUrl}
              onError={() => setPlaybackError(true)}
              className="h-8 max-w-[220px] flex-1"
             />}
          <button
            onClick={onSend}
            disabled={isGenerating}
            className="text-[0.625rem] px-2 py-0.5 bg-exo-accent text-exo-pure rounded-[2px] hover:shadow-glow-gold disabled:opacity-30 transition-colors"
          >
            发送
          </button>
          <button
            onClick={recorder.cancel}
            disabled={isGenerating}
            className="text-[0.625rem] px-2 py-0.5 tx-message-mute border border-cinder-line rounded-[2px] hover:tx-message-normal disabled:opacity-30 transition-colors"
          >
            取消
          </button>
        </>
      )}
      {recorder.status === 'error' && (
        <>
          <span className="text-[0.625rem] text-red-400">{recorder.errorMessage}</span>
          <button
            onClick={recorder.cancel}
            className="text-[0.625rem] px-2 py-0.5 tx-message-mute border border-cinder-line rounded-[2px] hover:tx-message-normal transition-colors"
          >
            关闭
          </button>
        </>
      )}
    </div>
  );
};

export default AudioComposeBar;
