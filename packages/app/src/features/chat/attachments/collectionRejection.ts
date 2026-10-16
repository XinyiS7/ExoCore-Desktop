import type { ChatRuntimeError } from '../runtime/types';

/** #61 per-item rejection codes (422 body or post-acceptance SSE `error`). */
const ITEM_REJECTION_LABELS: Readonly<Record<string, string>> = {
  collection_bring_item_not_found: '藏品已不存在',
  collection_bring_original_unavailable: '原件不可用',
  collection_bring_empty_text: '文字为空',
};

export interface CollectionItemRejection {
  itemId: number;
  /** Short chip label, e.g. "原件不可用". */
  label: string;
}

/**
 * Reads the single card a runtime error names. Whole-request errors
 * (`collection_bring_invalid` / `_too_many` / `_unsupported_with_edit`) and
 * any payload without a positive `item_id` mark no card.
 */
export function collectionItemRejectionOf(error: ChatRuntimeError | null): CollectionItemRejection | null {
  if (!error) return null;
  const label = ITEM_REJECTION_LABELS[error.code];
  if (!label) return null;
  const raw = error.raw;
  if (typeof raw !== 'object' || raw === null) return null;
  const itemId = (raw as { item_id?: unknown }).item_id;
  if (typeof itemId !== 'number' || !Number.isInteger(itemId) || itemId <= 0) return null;
  return { itemId, label };
}
