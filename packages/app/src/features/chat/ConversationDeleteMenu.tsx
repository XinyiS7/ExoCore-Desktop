/**
 * Row-level action menu for the three V4 conversation lists
 * (Home Recent / Agent Profile / Project Detail). One shared component.
 *
 * - Always-reachable three-dot menu button inside the row (mouse, keyboard focus,
 *   touch); never hover-only. Long names / narrow windows are handled by the
 *   existing row layout + this action's flex-shrink:0.
 * - Opens a dropdown menu with extensible actions; currently contains the
 *   single disabled-safe item "删除会话" (danger style).
 * - Selecting "删除会话" opens the shared ConversationDeleteConfirmDialog
 *   with an immutable capture of {id, name} at open time.
 * - Keyboard: focusable trigger, Enter/Space/ArrowDown opens, Arrow/Tab navigates
 *   inside, Escape / outside-click closes, focus restores to trigger.
 * - After confirmed/absent settlement: retire ONLY this conversation's
 *   caches + refresh the canonical list; the parent stays on its list route.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Trash2 } from 'lucide-react';
import { ConversationDeleteConfirmDialog } from './ConversationDeleteConfirmDialog';
import { reconcileConversationList } from './chatDeleteUi';
import { queryKeys } from './queries';

export interface ConversationDeleteMenuProps {
  conversationId: number;
  conversationName: string;
  /** Called after confirmed/absent settlement so the parent can refresh derived UI. */
  onDeleted?: (deletedId: number) => void;
}

export interface ConversationActionItem {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onSelect: () => void;
}

export function ConversationDeleteMenu({
  conversationId,
  conversationName,
  onDeleted,
}: ConversationDeleteMenuProps) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const menuId = useId();
  const triggerId = useId();

  const displayName = conversationName.trim() !== '' ? conversationName : `#${conversationId}`;

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleDeleted = useCallback(
    (deletedId: number) => {
      void reconcileConversationList(queryClient, deletedId);
      onDeleted?.(deletedId);
    },
    [queryClient, onDeleted],
  );

  const openDeleteDialog = useCallback(() => {
    setMenuOpen(false);
    triggerRef.current?.focus();
    setDialogOpen(true);
  }, []);

  const actions: ConversationActionItem[] = [
    {
      id: 'delete',
      label: '删除会话',
      icon: Trash2,
      danger: true,
      disabled: false,
      title: '删除会话',
      onSelect: openDeleteDialog,
    },
  ];

  // Focus the first enabled menu item when menu opens
  useEffect(() => {
    if (menuOpen) {
      const focusFirst = () => {
        const first = menuRef.current?.querySelector<HTMLButtonElement>(
          'button[role="menuitem"]:not(:disabled)',
        );
        first?.focus();
      };
      focusFirst();
      const raf = requestAnimationFrame(focusFirst);
      return () => cancelAnimationFrame(raf);
    }
  }, [menuOpen]);

  // Outside pointer click dismisses menu
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setMenuOpen(true);
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      triggerRef.current?.focus();
      return;
    }

    const enabledItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (enabledItems.length === 0) return;

    const currentIndex = enabledItems.findIndex((el) => el === document.activeElement);

    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault();
      const nextIndex = currentIndex === -1 || currentIndex >= enabledItems.length - 1 ? 0 : currentIndex + 1;
      enabledItems[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
      event.preventDefault();
      const prevIndex = currentIndex <= 0 ? enabledItems.length - 1 : currentIndex - 1;
      enabledItems[prevIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      enabledItems[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      enabledItems[enabledItems.length - 1]?.focus();
    }
  };

  return (
    <>
      <div ref={containerRef} className="conversation-row-menu">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className="app-icon-btn conversation-menu-trigger"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          aria-label={`会话操作 ${displayName}`}
          title="会话操作"
          onClick={() => setMenuOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
        >
          <MoreVertical size={16} aria-hidden="true" />
        </button>

        {menuOpen ? (
          <ul
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            aria-orientation="vertical"
            className="conversation-dropdown-menu"
            onKeyDown={handleMenuKeyDown}
          >
            {actions.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    aria-disabled={item.disabled ? 'true' : undefined}
                    title={item.title ?? item.label}
                    className={`conversation-menu-item${item.danger ? ' conversation-menu-item--danger' : ''}`}
                    onClick={() => {
                      if (item.disabled) return;
                      item.onSelect();
                    }}
                  >
                    {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <ConversationDeleteConfirmDialog
        open={dialogOpen}
        conversationId={conversationId}
        conversationName={conversationName}
        onClose={closeDialog}
        onDeleted={handleDeleted}
        queryClient={queryClient}
        onReadBack={() => queryClient.invalidateQueries({ queryKey: queryKeys.conversations })}
      />
    </>
  );
}

export const ConversationRowMenu = ConversationDeleteMenu;