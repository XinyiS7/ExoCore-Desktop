import type { AssistantArtifactView } from '../types';
import { CollectionShowCardView } from './CollectionShowCardView';
import { collectionShowCardFromArtifact } from './collectionShowCard';
import { COLLECTION_PRODUCERS } from './projection';

export interface AssistantArtifactCardsProps {
  artifacts: readonly AssistantArtifactView[];
}

/**
 * Producer-neutral info cards beside the assistant message media.
 *
 * Cards never render media or URLs: the linked attachment is rendered once by
 * `MessageAttachments`. No collect entry is shown. Collection bring-back
 * cards keep one restrained marker (#54) and render through the same
 * `CollectionShowCardView` as the human side (#61 D10).
 */
export function AssistantArtifactCards({ artifacts }: AssistantArtifactCardsProps) {
  if (artifacts.length === 0) return null;
  return (
    <div className="app-artifact-cards">
      {artifacts.map((artifact) =>
        COLLECTION_PRODUCERS.has(artifact.producer) ? (
          <div
            key={artifact.key}
            className="app-artifact-card--collection"
            data-testid="assistant-artifact-card"
            data-producer={artifact.producer}
            data-kind={artifact.kind}
          >
            <CollectionShowCardView card={collectionShowCardFromArtifact(artifact)} />
          </div>
        ) : (
          <div
            key={artifact.key}
            className="app-artifact-card"
            data-testid="assistant-artifact-card"
            data-producer={artifact.producer}
            data-kind={artifact.kind}
          >
            <span className="app-artifact-card-title">{artifact.title}</span>
            {artifact.detail ? (
              <p className="app-artifact-card-detail">{artifact.detail}</p>
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}
