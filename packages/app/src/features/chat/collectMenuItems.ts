/** Pure item list for the message collect menu (#72 U4). */
import type { MessageView } from './types';
import { COLLECTION_PRODUCERS } from './artifacts/projection';

export interface CollectMenuItem {
  id: string;
  label: string;
  hint?: string;
  disabled: boolean;
  onSelect?: () => void;
}

const PENDING_BACKEND_HINT = '待后端支持';

export function buildCollectMenuItems(message: MessageView, onCollectBody: () => void): CollectMenuItem[] {
  const items: CollectMenuItem[] = [];
  if (message.content?.trim()) {
    items.push({ id: 'body', label: '收藏正文', disabled: false, onSelect: onCollectBody });
  }
  // Collection bring-back cards already live in the Library.
  const artifacts = (message.role === 'assistant' ? message.assistantArtifacts ?? [] : []).filter(
    (artifact) => !COLLECTION_PRODUCERS.has(artifact.producer),
  );
  const artifactMediaKeys = new Set(artifacts.map((artifact) => artifact.presentationAttachmentKey));
  for (const artifact of artifacts) {
    items.push({ id: artifact.key, label: artifact.title, hint: PENDING_BACKEND_HINT, disabled: true });
  }
  for (const attachment of message.attachments ?? []) {
    // Media already represented by an artifact card, or copied out of the
    // Library, is not offered again.
    if (attachment.status !== 'ready') continue;
    if (attachment.source === 'collection_item' || artifactMediaKeys.has(attachment.key)) continue;
    items.push({ id: attachment.key, label: attachment.displayName, hint: PENDING_BACKEND_HINT, disabled: true });
  }
  return items;
}

/** True when the message has anything the collect menu could list. */
export function hasCollectMenuItems(message: MessageView): boolean {
  return buildCollectMenuItems(message, () => undefined).length > 0;
}
