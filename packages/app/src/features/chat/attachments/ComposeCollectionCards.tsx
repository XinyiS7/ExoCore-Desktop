import { X } from 'lucide-react';
import { cardTitle, KIND_LABELS } from '../../collection/filters';
import { useCollectionItemQuery } from '../../collection/queries';
import { COLLECTION_BRING_LIMIT } from './types';
import type { ComposeCollectionCard } from './types';

function useCardLabel(itemId: number): { kind: string; title: string } {
  const query = useCollectionItemQuery(itemId);
  const item = query.data;
  return item
    ? { kind: `藏品 · ${KIND_LABELS[item.kind]}`, title: cardTitle(item) }
    : { kind: '藏品', title: `藏品 #${itemId}` };
}

function CardChip({
  card,
  disabled,
  editing,
  onRemove,
}: {
  card: ComposeCollectionCard;
  disabled: boolean;
  editing: boolean;
  onRemove: (itemId: number) => void;
}) {
  const { kind, title } = useCardLabel(card.itemId);
  const rejected = card.status === 'rejected';
  return (
    <span
      className={rejected ? 'app-compose-collection-chip app-compose-collection-chip--rejected' : 'app-compose-collection-chip'}
      data-testid="compose-collection-card"
      data-item-id={card.itemId}
    >
      <span className="app-compose-collection-chip-kind">{rejected ? card.reason : kind}</span>
      <span className="app-compose-collection-chip-title">{title}</span>
      {editing ? null : (
        <button
          type="button"
          className="app-compose-collection-chip-remove"
          aria-label={`移除 ${title}`}
          disabled={disabled}
          onClick={() => onRemove(card.itemId)}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

function RejectionNotice({ card }: { card: ComposeCollectionCard }) {
  const { title } = useCardLabel(card.itemId);
  return (
    <p className="app-compose-collection-alert" role="alert">
      发送失败：“{title}”{card.reason === '藏品已不存在' ? '已不存在' : `的${card.reason}`}，移除后再发送。
    </p>
  );
}

/**
 * #61 pending brought-back cards above the composer. While a historical
 * message is being edited the strip is greyed and excluded from that turn.
 */
export function ComposeCollectionCards({
  cards,
  overflowed = false,
  editing,
  disabled,
  onRemove,
}: {
  cards: readonly ComposeCollectionCard[];
  overflowed?: boolean;
  editing: boolean;
  disabled: boolean;
  onRemove: (itemId: number) => void;
}) {
  if (cards.length === 0) return null;
  const firstRejected = editing ? undefined : cards.find((card) => card.status === 'rejected');
  return (
    <div className="app-compose-collection">
      {firstRejected ? <RejectionNotice card={firstRejected} /> : null}
      <div
        className={editing ? 'app-compose-collection-strip app-compose-collection-strip--editing' : 'app-compose-collection-strip'}
        aria-label="待发藏品卡"
        aria-disabled={editing || undefined}
      >
        {cards.map((card) => (
          <CardChip key={card.itemId} card={card} disabled={disabled} editing={editing} onRemove={onRemove} />
        ))}
        <span className="app-compose-collection-count">
          {cards.length} / {COLLECTION_BRING_LIMIT}
        </span>
      </div>
      {editing ? <span className="app-compose-collection-hint">编辑消息时不能带藏品</span> : null}
      {!editing && overflowed ? (
        <span className="app-compose-collection-hint" role="status">
          每次最多带回 5 件
        </span>
      ) : null}
    </div>
  );
}
