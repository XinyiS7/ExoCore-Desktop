/** #130 CP4 block countdown text. */

/** `m:ss` / `h:mm:ss` until `unblockAt`; `null` once it has passed. */
export function formatBlockRemaining(unblockAt: string, now: number): string | null {
  const ms = Date.parse(unblockAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
