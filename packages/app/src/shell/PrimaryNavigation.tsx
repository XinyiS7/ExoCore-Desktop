import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, User } from 'lucide-react';
import { useUserAvatar } from '../shared/userAvatar';
import { isChatActive, NAV_ITEMS, type NavItem } from './navigation';
import { useNotifications } from '../features/notifications/notificationContext';

/**
 * Desktop sidebar + mobile bottom bar projections of the one canonical
 * navigation data (Plan Task 4.2; D1 = D-A + M1 + X1).
 */

function NavItemRow({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const { unreadCount } = useNotifications();
  const Icon = item.icon;
  if (item.enabled && item.to !== undefined) {
    const active = item.id === 'chat' && isChatActive(pathname);
    return (
      <Link
        to={item.to}
        aria-current={active ? 'page' : undefined}
        className={`app-nav-item${active ? ' app-nav-item--active' : ''}`}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="app-nav-label">{item.label}</span>
        {item.id === 'chat' && unreadCount > 0 ? (
          <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={`${item.label} — ${item.phase ?? '后续'} 阶段开放`}
      className="app-nav-item app-nav-item--disabled"
    >
      <Icon size={18} aria-hidden="true" />
      <span className="app-nav-label">{item.label}</span>
      {item.phase ? <span className="app-phase-chip">{item.phase}</span> : null}
    </button>
  );
}

export function PrimaryNavigation({ variant }: { variant: 'sidebar' | 'bottom' }) {
  return (
    <div className={variant === 'sidebar' ? 'app-nav app-nav--sidebar' : 'app-nav app-nav--bottom'}>
      {NAV_ITEMS.map((item) => (
        <NavItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}

/**
 * More (X1): unified avatar overflow menu hosting system-level entries (Plan §3 D2).
 * CP C-1 activates Account (/account); Settings and Notifications remain disabled with P2 chip.
 */
interface MoreMenuItemDef {
  label: string;
  icon: typeof User;
  to?: string;
  enabled: boolean;
  phase?: string;
}

const MORE_ITEMS: MoreMenuItemDef[] = [
  { label: '账号 / Profile', icon: User, to: '/account', enabled: true },
  { label: '设置中心', icon: Settings, to: '/settings/keys', enabled: true },
  { label: '通知', icon: Bell, to: '/settings/notifications', enabled: true },
];

export function MoreMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const avatarUrl = useUserAvatar();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (event: PointerEvent | MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const active = document.activeElement;
        const wasInside = Boolean(rootRef.current && active && rootRef.current.contains(active));
        setOpen(false);
        if (wasInside) {
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`app-more${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="app-avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="更多菜单"
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt="用户头像"
            className="app-avatar-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <User size={18} aria-hidden="true" />
        )}
      </button>
      {open ? (
        <ul className="app-more-menu" role="menu">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} role="none">
                {item.enabled && item.to ? (
                  <Link
                    to={item.to}
                    role="menuitem"
                    className="app-more-item"
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled
                    aria-disabled="true"
                    title={`${item.label} — ${item.phase} 阶段开放`}
                    className="app-more-item"
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.phase ? <span className="app-phase-chip">{item.phase}</span> : null}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
