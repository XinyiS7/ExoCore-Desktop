import { useCallback, useEffect, useRef, useState } from 'react';
import { COLLECTION_BRING_LIMIT } from './types';
import type { ComposeCollectionCard } from './types';

/**
 * #61 brought-back Collection cards waiting above the composer — the sibling
 * of `useComposeAttachments` for the second compose payload. Cards hold only
 * the item id; a route switch drops them, as it drops compose attachments.
 */
export interface ComposeCollectionApi {
  /** Selection order, deduped, at most five. */
  cards: ComposeCollectionCard[];
  /** True after an add was cut at the five-card cap, until a card leaves. */
  overflowed: boolean;
  /** Same-tick read of the item ids in order, for `collection_items`. */
  getItemIds: () => number[];
  /**
   * Append item ids after the cards already waiting; `restore` puts a failed
   * turn's cards back first, in their original order.
   */
  addCards: (itemIds: readonly number[], options?: { restore?: boolean }) => void;
  removeCard: (itemId: number) => void;
  /** Mark exactly the card a per-item 422 / SSE error named by `item_id`. */
  rejectCard: (itemId: number, reason: string) => void;
  /** Clear after an accepted ordinary send. */
  clear: () => void;
}

export function useComposeCollectionCards(conversationId: number): ComposeCollectionApi {
  const [cards, setCards] = useState<ComposeCollectionCard[]>([]);
  const [overflowed, setOverflowed] = useState(false);
  const cardsRef = useRef<ComposeCollectionCard[]>([]);
  cardsRef.current = cards;

  useEffect(
    () => () => {
      cardsRef.current = [];
      setCards([]);
      setOverflowed(false);
    },
    [conversationId],
  );

  const getItemIds = useCallback(() => cardsRef.current.map((card) => card.itemId), []);

  const addCards = useCallback((itemIds: readonly number[], options?: { restore?: boolean }) => {
    const incoming = itemIds
      .filter((id) => Number.isInteger(id) && id > 0)
      .map((itemId): ComposeCollectionCard => ({ itemId, status: 'ready' }));
    if (incoming.length === 0) return;
    const prev = cardsRef.current;
    const ordered = options?.restore ? [...incoming, ...prev] : [...prev, ...incoming];
    const seen = new Set<number>();
    const next: ComposeCollectionCard[] = [];
    let cut = false;
    for (const card of ordered) {
      if (seen.has(card.itemId)) continue;
      if (next.length >= COLLECTION_BRING_LIMIT) {
        cut = true;
        continue;
      }
      seen.add(card.itemId);
      next.push(card);
    }
    cardsRef.current = next;
    setCards(next);
    if (cut) setOverflowed(true);
  }, []);

  const removeCard = useCallback((itemId: number) => {
    cardsRef.current = cardsRef.current.filter((card) => card.itemId !== itemId);
    setCards(cardsRef.current);
    setOverflowed(false);
  }, []);

  const rejectCard = useCallback((itemId: number, reason: string) => {
    cardsRef.current = cardsRef.current.map((card) =>
      card.itemId === itemId ? { itemId, status: 'rejected', reason } : card,
    );
    setCards(cardsRef.current);
  }, []);

  const clear = useCallback(() => {
    cardsRef.current = [];
    setCards([]);
    setOverflowed(false);
  }, []);

  return { cards, overflowed, getItemIds, addCards, removeCard, rejectCard, clear };
}
