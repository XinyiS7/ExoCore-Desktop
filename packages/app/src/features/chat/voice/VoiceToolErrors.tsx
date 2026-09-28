import type { VoiceToolError } from '../types';

/**
 * CP-C minimal `send_voice_msg` failure surface (backend Plan REVISE-7 §8).
 *
 * Renders only the bounded safe code: no tool content/style, no provider
 * prose, no audio player and no attachment placeholder. A failed synthesis
 * never produces an audio artifact, so this notice is the whole row-side
 * failure UI; the full voice player belongs to CP-E.
 */
export function VoiceToolErrors({ errors }: { errors: readonly VoiceToolError[] }) {
  if (errors.length === 0) return null;
  return (
    <>
      {errors.map((entry) => (
        <div
          key={entry.position}
          className="app-runtime-error-box app-voice-tool-error"
          role="alert"
          data-testid="voice-tool-error"
          data-position={entry.position}
        >
          <span className="app-error-hint">send_voice_msg 调用失败</span>
          <code className="app-voice-tool-error-code">{entry.errorCode}</code>
        </div>
      ))}
    </>
  );
}
