/** Pure item list for the message collect menu (#72 U4, #74). */
import type { CollectSource } from '../collection/types';
import { validatedImageContentUrl } from './attachments/mediaUrls';
import { formatTime } from './audio/formatTime';
import type { MessageAttachmentView, MessageView, PresentationView } from './types';

/** What a selected menu item collects: the message text, or one attachment / artifact. */
export type CollectChoice =
  | { type: 'body' }
  | { type: 'source'; key: string; label: string; source: CollectSource };

export interface CollectMenuItem {
  id: string;
  label: string;
  hint?: string;
  /** Decorative same-origin preview telling sibling images apart (CP-R1). */
  thumbnailUrl?: string;
  disabled: boolean;
  onSelect?: () => void;
}

const NOT_COLLECTIBLE_HINT = '不可收藏';
const LEGACY_ATTACHMENT_HINT = '旧附件不可收藏';
const ARTIFACT_KEY = /^assistant_artifact:(\d+)$/;

function artifactId(key: string): number | null {
  const match = ARTIFACT_KEY.exec(key);
  return match ? Number(match[1]) : null;
}

function thumbnail(media: MessageAttachmentView | null): { thumbnailUrl?: string } {
  const url = media?.kind === 'image' ? validatedImageContentUrl(media.contentUrl) : null;
  return url ? { thumbnailUrl: url } : {};
}

/** A voice label carries its length, an aid only: the artifact id stays the identity. */
function presentationLabel(item: PresentationView): string {
  const ms = item.surface === 'voice' ? item.media?.durationMs : null;
  return typeof ms === 'number' ? `${item.label} · ${formatTime(ms / 1000)}` : item.label;
}

export function buildCollectMenuItems(
  message: MessageView,
  onCollect: (choice: CollectChoice) => void,
): CollectMenuItem[] {
  const items: CollectMenuItem[] = [];
  const sourceItem = (key: string, label: string, source: CollectSource): CollectMenuItem => ({
    id: key,
    label,
    disabled: false,
    onSelect: () => onCollect({ type: 'source', key, label, source }),
  });
  if (message.content?.trim()) {
    items.push({ id: 'body', label: '收藏正文', disabled: false, onSelect: () => onCollect({ type: 'body' }) });
  }
  // #84: presented things come from the gate; Collection cards already live
  // in the Library and are not offered again.
  for (const item of message.presentations ?? []) {
    if (item.surface === 'collection_card') continue;
    const id = item.collectible ? artifactId(item.key) : null;
    const label = presentationLabel(item);
    items.push({
      ...(id !== null
        ? sourceItem(item.key, label, { type: 'assistant_artifact', artifact_id: id })
        : { id: item.key, label, hint: NOT_COLLECTIBLE_HINT, disabled: true }),
      ...thumbnail(item.media),
    });
  }
  for (const attachment of message.attachments ?? []) {
    if (attachment.status !== 'ready') continue;
    items.push({
      ...(attachment.provenanceId
        ? sourceItem(attachment.key, attachment.displayName, {
            type: 'attachment',
            provenance_id: attachment.provenanceId,
          })
        : { id: attachment.key, label: attachment.displayName, hint: LEGACY_ATTACHMENT_HINT, disabled: true }),
      ...thumbnail(attachment),
    });
  }
  return items;
}

/** True when the message has anything the collect menu could list. */
export function hasCollectMenuItems(message: MessageView): boolean {
  return buildCollectMenuItems(message, () => undefined).length > 0;
}
