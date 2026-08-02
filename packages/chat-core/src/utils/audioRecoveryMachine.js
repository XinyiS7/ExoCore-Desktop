/**
 * P0-R6 audio recovery state machine（纯函数，独立可测）。
 * state: { item: { conversationId, attachmentIds } | null, done: bool, error: bool }
 *
 * terminal success 仅当 done && !error；EOF without done / error / transport failure
 * 均保留 item 供重试，且 recoverable 永远 conversation-bound。
 */

export const audioRecoveryInitial = () => ({ item: null, done: false, error: false });

export function audioRecoveryUploadSuccess(state, conversationId, attachmentIds) {
  return { item: { conversationId, attachmentIds }, done: false, error: false };
}

export function audioRecoveryMarkDone(state) {
  return { ...state, done: true };
}

export function audioRecoveryMarkError(state) {
  return { ...state, error: true };
}

/**
 * 重试尝试开始：保留 item/IDs，但重置 done/error（P0-R15）。
 * 否则上次失败的 error=true 残留，retry 成功后 done=true,error=true，
 * onStreamEnd 永不视为 terminal success，重发/放弃入口不消失。
 */
export function audioRecoveryBeginAttempt(state) {
  return { ...state, done: false, error: false };
}

/**
 * 流式结束（reader EOF）。仅 done && !error 视为 terminal success → 清空；
 * 否则保留 item（truncated/empty stream、error、EOF without done 全部保留）。
 */
export function audioRecoveryOnStreamEnd(state) {
  return state.done && !state.error ? audioRecoveryInitial() : state;
}

export function audioRecoveryAbandon() {
  return audioRecoveryInitial();
}

export function audioRecoverySessionSwitch() {
  return audioRecoveryInitial();
}

/**
 * 发送前 audio source 决策（new clip / recoverable IDs / none）。
 * - gate 'unsupported'：目标不支持 audio → 不发网络请求；keepRecoverable 表示
 *   是否保留已有 recoverable item（reuse 分支保留，new clip 分支无 item）。
 * - gate 'ok'：kind 'upload'（新录音）/ 'reuse'（复用 IDs，upload count 0）/'none'。
 */
export function resolveAudioForSend({ status, canRecord, recoverableAudio, conversationId }) {
  if (status === 'recorded') {
    if (!canRecord) return { gate: 'unsupported', keepRecoverable: false };
    return { gate: 'ok', kind: 'upload' };
  }
  if (recoverableAudio && recoverableAudio.conversationId === conversationId) {
    if (!canRecord) return { gate: 'unsupported', keepRecoverable: true };
    return { gate: 'ok', kind: 'reuse', attachmentIds: recoverableAudio.attachmentIds };
  }
  return { gate: 'ok', kind: 'none' };
}
