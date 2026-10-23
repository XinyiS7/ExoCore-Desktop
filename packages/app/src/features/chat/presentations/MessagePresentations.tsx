import type { MessageAttachmentView, PresentationView } from '../types';
import { AttachmentImage } from '../attachments/AttachmentImage';
import { AttachmentFileCard } from '../attachments/AttachmentFileCard';
import { AudioPlayerBubble } from '../audio/AudioPlayerBubble';
import { CollectionShowCardView } from '../artifacts/CollectionShowCardView';

export interface MessagePresentationsProps {
  presentations: readonly PresentationView[];
  /** Selects the existing card container per speaker. */
  role: 'user' | 'assistant';
  /** Scoped conversation identity for voice transcript requests. */
  conversationId?: number;
}

function MediaSurface({
  media,
  transcriptEligible,
  conversationId,
}: {
  media: MessageAttachmentView;
  transcriptEligible: boolean;
  conversationId?: number;
}) {
  if (media.kind === 'audio') {
    return (
      <AudioPlayerBubble
        attachment={media}
        conversationId={conversationId}
        transcriptEligible={transcriptEligible}
      />
    );
  }
  if (media.kind === 'image') return <AttachmentImage attachment={media} />;
  return <AttachmentFileCard attachment={media} />;
}

/**
 * The single renderer of `presentations[]` (#84): the backend gate decided
 * what this message shows; this only maps each surface onto the existing
 * media and card components.
 *
 * - `image`: the image only — no description box;
 * - `voice`: the voice player, the only surface eligible for a transcript;
 * - `collection_card`: the shared Collection card, its original (if any)
 *   rendered once as plain media (collection audio never gets a transcript).
 *
 * Media keep the previous layout row above the cards.
 */
export function MessagePresentations({ presentations, role, conversationId }: MessagePresentationsProps) {
  if (presentations.length === 0) return null;
  const media = presentations.flatMap((item) => (item.media ? [{ item, media: item.media }] : []));
  const cards = presentations.flatMap((item) => (item.card ? [{ item, card: item.card }] : []));
  return (
    <>
      {media.length > 0 ? (
        <div className="app-msg-attachments" data-testid="message-presentation-media">
          {media.map(({ item, media: attachment }) => (
            <MediaSurface
              key={item.key}
              media={attachment}
              transcriptEligible={item.surface === 'voice'}
              conversationId={conversationId}
            />
          ))}
        </div>
      ) : null}
      {cards.length > 0 ? (
        role === 'user' ? (
          <div className="app-collection-shows">
            {cards.map(({ item, card }) => (
              <CollectionShowCardView key={item.key} card={card} />
            ))}
          </div>
        ) : (
          <div className="app-artifact-cards">
            {cards.map(({ item, card }) => (
              <div
                key={item.key}
                className="app-artifact-card--collection"
                data-testid="assistant-artifact-card"
                data-producer={item.owner}
              >
                <CollectionShowCardView card={card} />
              </div>
            ))}
          </div>
        )
      ) : null}
    </>
  );
}
