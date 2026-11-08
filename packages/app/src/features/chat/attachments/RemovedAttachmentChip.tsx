import { FileX } from 'lucide-react';
import type { MessageAttachmentKind } from '../types';

const KIND_LABELS: Record<MessageAttachmentKind, string> = {
  image: '图片',
  audio: '音频',
  file: '文件',
};

export interface RemovedAttachmentChipProps {
  kind: MessageAttachmentKind;
  name: string;
}

/**
 * #83 soft-removed attachment trace: type + name + 「已移除」. Inert by
 * design — no thumbnail, player, link or download entry.
 */
export function RemovedAttachmentChip({ kind, name }: RemovedAttachmentChipProps) {
  return (
    <div
      className="app-att-filecard app-att-filecard--removed"
      data-removed="true"
      title={`${name}（已移除）`}
    >
      <FileX size={14} strokeWidth={1.5} aria-hidden="true" />
      <span className="app-att-filecard-meta">{KIND_LABELS[kind]}</span>
      <span className="app-att-filecard-name">{name}</span>
      <span className="app-att-filecard-meta">已移除</span>
    </div>
  );
}
