import type { AssistantArtifactView } from '../types';
import { COLLECTION_PRODUCERS } from './projection';

export interface AssistantArtifactCardsProps {
  artifacts: readonly AssistantArtifactView[];
}

/**
 * Producer-neutral info cards beside the assistant message media.
 *
 * Cards never render media or URLs: the linked attachment is rendered once by
 * `MessageAttachments`. No collect entry is shown. Collection bring-back
 * cards share one restrained marker (#54).
 */
export function AssistantArtifactCards({ artifacts }: AssistantArtifactCardsProps) {
  if (artifacts.length === 0) return null;
  return (
    <div className="app-artifact-cards">
      {artifacts.map((artifact) => (
        <div
          key={artifact.key}
          className={
            COLLECTION_PRODUCERS.has(artifact.producer)
              ? 'app-artifact-card app-artifact-card--collection'
              : 'app-artifact-card'
          }
          data-testid="assistant-artifact-card"
          data-producer={artifact.producer}
          data-kind={artifact.kind}
        >
          <span className="app-artifact-card-title">{artifact.title}</span>
          {artifact.detail ? (
            <p className="app-artifact-card-detail">{artifact.detail}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
