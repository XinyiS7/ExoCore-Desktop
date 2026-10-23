/** Pure item list for the message collect menu (#72 U4). */
import type { MessageView } from './types';

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
  // #84: presented things come from the gate; Collection cards already live
  // in the Library and are not offered again.
  for (const item of message.presentations ?? []) {
    if (item.surface === 'collection_card') continue;
    items.push({ id: item.key, label: item.label, hint: PENDING_BACKEND_HINT, disabled: true });
  }
  for (const attachment of message.attachments ?? []) {
    if (attachment.status !== 'ready') continue;
    items.push({ id: attachment.key, label: attachment.displayName, hint: PENDING_BACKEND_HINT, disabled: true });
  }
  return items;
}

/** True when the message has anything the collect menu could list. */
export function hasCollectMenuItems(message: MessageView): boolean {
  return buildCollectMenuItems(message, () => undefined).length > 0;
}
