/**
 * P1C Global audio playback manager (Task 5, §5.6/Gate G).
 *
 * One module-level mutual-exclusion owner: starting one item pauses the
 * previous item; pause/end/error/unmount releases ownership. Mutual
 * exclusion can never be guaranteed independently inside each bubble, so it
 * lives here as a single singleton — no second playback truth exists.
 */

export type PlaybackListener = (activeId: string | null) => void;

class AudioPlaybackManager {
  private activeId: string | null = null;
  private activePause: (() => void) | null = null;
  private listeners = new Set<PlaybackListener>();

  /**
   * Claim playback for `id`. If another item owns playback, its pause
   * callback is invoked immediately (mutual exclusion).
   */
  play(id: string, pauseFn: () => void): void {
    if (this.activeId !== null && this.activeId !== id) {
      try {
        this.activePause?.();
      } catch {
        /* the previous owner is already gone; ignore */
      }
    }
    this.activeId = id;
    this.activePause = pauseFn;
    this.notify();
  }

  /** Release ownership only when `id` is the current owner. */
  stop(id: string): void {
    if (this.activeId !== id) return;
    this.activeId = null;
    this.activePause = null;
    this.notify();
  }

  /** Subscribe to ownership changes; returns the unsubscribe function. */
  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.activeId);
  }
}

/** The one module-level playback owner for the whole V4 chat. */
export const globalAudioPlaybackManager = new AudioPlaybackManager();