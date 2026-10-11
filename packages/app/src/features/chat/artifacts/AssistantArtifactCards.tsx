import type { AssistantArtifactView, MessageAttachmentView } from '../types';

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface AssistantArtifactCardsProps {
  artifacts: readonly AssistantArtifactView[];
  /** Same-message media rows; a card only reads its linked row's duration. */
  attachments?: readonly MessageAttachmentView[];
}

/**
 * Producer-neutral info cards beside the assistant message media.
 *
 * Cards never render media, URLs or transcripts: the linked attachment is
 * rendered once by `MessageAttachments`, and voice transcript stays with
 * `AudioPlayerBubble` after natural playback ends. No collect entry is shown.
 */
export function AssistantArtifactCards({ artifacts, attachments }: AssistantArtifactCardsProps) {
  if (artifacts.length === 0) return null;
  const attachmentsByKey = new Map((attachments ?? []).map((att) => [att.key, att]));
  return (
    <div className="app-artifact-cards">
      {artifacts.map((artifact) => {
        const media = artifact.presentationAttachmentKey
          ? attachmentsByKey.get(artifact.presentationAttachmentKey)
          : undefined;
        const durationMs =
          media?.kind === 'audio' && media.durationMs !== null ? media.durationMs : null;
        return (
          <div
            key={artifact.key}
            className="app-artifact-card"
            data-testid="assistant-artifact-card"
            data-producer={artifact.producer}
            data-kind={artifact.kind}
          >
            <span className="app-artifact-card-title">{artifact.title}</span>
            {durationMs !== null ? (
              <span className="app-artifact-card-duration">{formatDuration(durationMs)}</span>
            ) : null}
            {artifact.detail ? (
              <p className="app-artifact-card-detail">{artifact.detail}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
