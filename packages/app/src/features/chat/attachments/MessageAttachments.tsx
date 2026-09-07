import type { AttachmentMeta } from '../types';
import { AttachmentImage } from './AttachmentImage';
import { AttachmentFileCard } from './AttachmentFileCard';
import { AudioPlayerBubble } from '../audio/AudioPlayerBubble';

export interface MessageAttachmentsProps {
  /** Canonical `attachments_meta` rows only — never inferred from IDs. */
  meta: AttachmentMeta[];
}

/**
 * Historical attachment renderers (Task 5, §5.6):
 * - image/* with validated file_uri → thumbnail + accessible lightbox;
 * - audio/* → same-origin content_url player (remote file_uri never used);
 * - anything else → safe metadata-only file card.
 * Rows without a usable source stay visible as fallback cards, never as an
 * empty placeholder or a fabricated control.
 */
export function MessageAttachments({ meta }: MessageAttachmentsProps) {
  if (!meta || meta.length === 0) return null;
  return (
    <div className="app-msg-attachments">
      {meta.map((att) => {
        const isImage = att.mime_type?.startsWith('image/') ?? false;
        const isAudio = att.mime_type?.startsWith('audio/') ?? false;
        if (isAudio) {
          // Same-origin `content_url` is the ONLY audio source; rows without
          // it render the fallible player with a visible failure state.
          return <AudioPlayerBubble key={att.id} meta={att} />;
        }
        if (isImage) {
          return <AttachmentImage key={att.id} meta={att} />;
        }
        return <AttachmentFileCard key={att.id} meta={att} />;
      })}
    </div>
  );
}