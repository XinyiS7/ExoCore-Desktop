/**
 * P2T message-level TTS lifecycle types (B5 contract, Plan §7 CP 2T-1).
 *
 * Truth ownership: the backend owns generation, cache validity, authorization
 * and artifact delivery. The frontend only maps one canonical Message
 * identity to one truthful outcome — these types are the adapter boundary
 * consumed by the (later) voice control state machine.
 */

/** Frontend six-state lifecycle (Plan D3; CP-B adds `warming`). */
export type TtsPhase =
  | 'unavailable'
  | 'idle'
  | 'warming'
  | 'generating'
  | 'playable'
  | 'failed_retryable';

/**
 * Bounded B5 error taxonomy. Mapping is HTTP-status first with `code` / string
 * `error` as bounded secondary discriminators; an unknown backend code
 * degrades to the status-implied code instead of leaking an open-ended set.
 * CP-B renamed `runtime_offline` to the backend's `runtime_unavailable` and
 * adds the distinguishable `engine_unavailable` / `unauthorized` /
 * `synthesis_failed` codes the backend now emits.
 */
export type TtsErrorCode =
  | 'not_found'
  | 'ineligible_message'
  | 'no_active_profile'
  | 'runtime_unavailable'
  | 'engine_unavailable'
  | 'unauthorized'
  | 'generation_timeout'
  | 'generation_failed'
  | 'synthesis_failed'
  | 'audio_artifact_missing'
  | 'contract'
  | 'network';

/** Playable resource identity exactly as returned by the backend (D2/D10). */
export interface TtsPlayable {
  contentUrl: string;
  /**
   * Backend metadata hint only (may be 0); before media metadata arrives it
   * may seed the displayed total duration, never the timeline itself (D8).
   */
  durationMs: number | null;
}

export type TtsOutcome =
  | { phase: 'unavailable'; code: TtsErrorCode }
  | { phase: 'idle' }
  | { phase: 'warming'; retryAfterMs: number }
  | { phase: 'generating'; retryAfterMs: number }
  | { phase: 'playable'; playable: TtsPlayable }
  | { phase: 'failed_retryable'; code: TtsErrorCode; message: string | null };
