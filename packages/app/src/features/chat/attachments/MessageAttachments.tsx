import type { AttachmentMeta, MessageAttachmentView } from '../types';
import { AttachmentImage } from './AttachmentImage';
import { AttachmentFileCard } from './AttachmentFileCard';
import { AudioPlayerBubble } from '../audio/AudioPlayerBubble';

export interface MessageAttachmentsProps {
  /** CP-E canonical unified attachments projection. */
  attachments?: MessageAttachmentView[] | null;
  /** Canonical `attachments_meta` rows for legacy fallback — never inferred from IDs. */
  meta?: AttachmentMeta[] | null;
  /** Scoped conversation identity for transcript requests. */
  conversationId?: number;
}

/**
 * Historical and unified attachment renderers (Task 5, §5.6; CP-E §4):
 * - image/* with validated file_uri → thumbnail + accessible lightbox;
 * - audio/* → same-origin content_url player (remote file_uri never used);
 * - anything else → safe metadata-only file card.
 *
 * In CP-E:
 * - canonical attachments[] controls membership when present;
 * - non-ready (pending / failed / malformed) rows fail closed without a player;
 * - ready voice message audio renders through AudioPlayerBubble;
 * - legacy attachments_meta remains a fallback when canonical attachments is absent.
 */
export function MessageAttachments({ attachments, meta, conversationId }: MessageAttachmentsProps) {
  if (attachments !== undefined && attachments !== null) {
    const ready = attachments.filter((att) => att.status === 'ready');
    if (ready.length === 0) return null;
    return (
      <div className="app-msg-attachments">
        {ready.map((att) => {
          if (att.kind === 'audio') {
            return (
              <AudioPlayerBubble
                key={att.key}
                attachment={att}
                conversationId={conversationId}
              />
            );
          }
          if (att.kind === 'image') {
            return <AttachmentImage key={att.key} attachment={att} />;
          }
          return <AttachmentFileCard key={att.key} attachment={att} />;
        })}
      </div>
    );
  }

  if (meta && meta.length > 0) {
    return (
      <div className="app-msg-attachments">
        {meta.map((att) => {
          const isImage = att.mime_type?.startsWith('image/') ?? false;
          const isAudio = att.mime_type?.startsWith('audio/') ?? false;
          if (isAudio) {
            return (
              <AudioPlayerBubble
                key={att.id}
                meta={att}
                conversationId={conversationId}
              />
            );
          }
          if (isImage) {
            return <AttachmentImage key={att.id} meta={att} />;
          }
          return <AttachmentFileCard key={att.id} meta={att} />;
        })}
      </div>
    );
  }

  return null;
}