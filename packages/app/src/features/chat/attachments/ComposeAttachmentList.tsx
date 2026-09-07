import type { ComposeAttachmentEntry } from './types';
import { ComposeAttachmentItem } from './ComposeAttachmentItem';

export interface ComposeAttachmentListProps {
  entries: ComposeAttachmentEntry[];
  onRemove: (clientId: number) => void;
  /** Disabled while the C1B operation is active (Gate C/H). */
  disabled?: boolean;
}

/** Compose attachment strip: one entry per visible state, original order. */
export function ComposeAttachmentList({ entries, onRemove, disabled }: ComposeAttachmentListProps) {
  if (entries.length === 0) return null;
  return (
    <div className="app-att-list" aria-label="待发送附件">
      {entries.map((entry) => (
        <ComposeAttachmentItem key={entry.clientId} entry={entry} onRemove={onRemove} disabled={disabled} />
      ))}
    </div>
  );
}