/**
 * Always-visible 收藏 action with a second-level menu (#72 U4).
 *
 * - 收藏正文 opens the existing CollectMessageModal flow (message source).
 * - A collectible assistant artifact and a ready attachment with provenance
 *   open the same modal for that source (#74); the rest stay listed, disabled.
 * - Escape / outside click closes; focus returns to the trigger.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Bookmark } from 'lucide-react';
import type { MessageView } from './types';
import { buildCollectMenuItems, type CollectChoice } from './collectMenuItems';

export function MessageCollectMenu({
  message,
  onCollect,
}: {
  message: MessageView;
  onCollect: (choice: CollectChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  const triggerId = useId();

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const items = buildCollectMenuItems(message, (choice) => {
    close();
    onCollect(choice);
  });

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const enabled = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [],
    );
    if (enabled.length === 0) return;
    event.preventDefault();
    const current = enabled.findIndex((el) => el === document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    enabled[(current + step + enabled.length) % enabled.length]?.focus();
  };

  return (
    <div ref={containerRef} className="app-msg-collect">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="app-msg-action-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="收藏此条消息"
        aria-label="收藏此条消息"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bookmark size={12} aria-hidden="true" />
        收藏
      </button>
      {open ? (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="app-msg-collect-menu"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="app-msg-collect-item"
                disabled={item.disabled}
                title={item.hint ? `${item.label}（${item.hint}）` : item.label}
                onClick={item.onSelect}
              >
                <span className="app-msg-collect-label">{item.label}</span>
                {item.hint ? <span className="app-msg-collect-hint">{item.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
