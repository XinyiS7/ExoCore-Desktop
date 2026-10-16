import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CollectionApiError, getCollectionItem } from '../../collection/api';
import { collectionQueryKeys } from '../../collection/queries';
import type { CollectionShowCard } from '../types';

type OpenState = 'idle' | 'checking' | 'missing' | 'failed';

/**
 * One brought-back Collection card for either speaker (#61 D10). Media are
 * rendered once by `MessageAttachments`; the card itself carries the fixed
 * title, the complete text snapshot (text cards) and the non-empty reason.
 * The card stays exactly as sent even after the item is deleted.
 */
export function CollectionShowCardView({ card }: { card: CollectionShowCard }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [openState, setOpenState] = useState<OpenState>('idle');
  const itemId = card.itemId;

  const open = async () => {
    if (itemId === null || openState === 'checking') return;
    setOpenState('checking');
    try {
      await client.fetchQuery({
        queryKey: collectionQueryKeys.detail(itemId),
        queryFn: ({ signal }) => getCollectionItem(itemId, signal),
      });
      setOpenState('idle');
      navigate(`/library/items/${itemId}`);
    } catch (err) {
      const missing = err instanceof CollectionApiError && err.code === 'collection_item_not_found';
      setOpenState(missing ? 'missing' : 'failed');
    }
  };

  return (
    <div className="app-collection-show" data-testid="collection-show-card">
      <div className="app-collection-show-card">
        {itemId === null ? (
          <span className="app-collection-show-title">{card.title}</span>
        ) : (
          <button
            type="button"
            className="app-collection-show-title app-collection-show-open"
            aria-busy={openState === 'checking'}
            onClick={() => void open()}
          >
            {card.title}
          </button>
        )}
        {card.text !== null ? (
          <div className="app-collection-show-text" tabIndex={0} role="region" aria-label={card.title}>
            {card.text}
          </div>
        ) : null}
        {card.detail !== null ? <p className="app-collection-show-detail">{card.detail}</p> : null}
      </div>
      {openState === 'missing' ? (
        <p className="app-collection-show-notice" role="status">
          藏品已不存在（聊天里的卡片保持原样）
        </p>
      ) : null}
      {openState === 'failed' ? (
        <p className="app-collection-show-notice" role="status">
          暂时打不开这件藏品，请稍后再试。
        </p>
      ) : null}
    </div>
  );
}
