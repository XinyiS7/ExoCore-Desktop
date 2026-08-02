import React from 'react';

/**
 * 可恢复语音附件 item（P0-R6）：chat 失败后保留可重试入口。
 * busy（isGenerating）时重发/放弃均不可操作（P0-R7/D）。
 */
const RecoverableAudioItem = ({ isGenerating, onRetry, onAbandon, errorText }) => (
  <div className="flex items-center gap-2 px-3 pb-1.5">
    {errorText && <span className="text-[0.625rem] text-red-400">{errorText}</span>}
    <span className="text-[0.625rem] tx-message-mute">语音附件已上传，可重发</span>
    <button
      onClick={onRetry}
      disabled={isGenerating}
      className="text-[0.625rem] px-2 py-0.5 bg-exo-accent text-exo-pure rounded-[2px] hover:shadow-glow-gold disabled:opacity-30 transition-colors"
    >
      重发
    </button>
    <button
      onClick={onAbandon}
      disabled={isGenerating}
      className="text-[0.625rem] px-2 py-0.5 tx-message-mute border border-cinder-line rounded-[2px] hover:tx-message-normal disabled:opacity-30 transition-colors"
    >
      放弃
    </button>
  </div>
);

export default RecoverableAudioItem;
