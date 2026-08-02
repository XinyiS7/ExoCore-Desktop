/**
 * 全局语音互斥播放管理器 (Exclusive Audio Playback Manager)
 * 确保同一时间只有一个语音/音频组件在播放。
 */
class AudioPlaybackManager {
  constructor() {
    this.activeId = null;
    this.activePauseFn = null;
    this.listeners = new Set();
  }

  /**
   * 注册并启动播放某个音频。
   * 如果当前有正在播放的其他音频，自动调用其 pause 回调。
   * @param {string} id 音频唯一标识 (如 att.id 或 src)
   * @param {Function} pauseFn 暂停回调函数
   */
  play(id, pauseFn) {
    if (this.activeId && this.activeId !== id && typeof this.activePauseFn === 'function') {
      try {
        this.activePauseFn();
      } catch (err) {
        console.warn('[AudioPlaybackManager] Failed to pause previous audio:', err);
      }
    }
    this.activeId = id;
    this.activePauseFn = pauseFn;
    this.notify();
  }

  /**
   * 标记某个音频停止或暂停。
   * @param {string} id 
   */
  stop(id) {
    if (this.activeId === id) {
      this.activeId = null;
      this.activePauseFn = null;
      this.notify();
    }
  }

  /**
   * 订阅状态变更
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.activeId));
  }
}

export const globalAudioPlaybackManager = new AudioPlaybackManager();
