import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Settings, User } from 'lucide-react';
import { isChatActive, NAV_ITEMS, type NavItem } from './navigation';

/**
 * Desktop sidebar + mobile bottom bar projections of the one canonical
 * navigation data (Plan Task 4.2; D1 = D-A + M1 + X1).
 */

function NavItemRow({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
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
 * More (X1): unified avatar overflow menu hosting system-level entries.
 * Every entry is disabled in P1A with a phase chip; More never holds the
 * first-class product areas (they live in the primary navigation).
 */
const MORE_ITEMS: { label: string; icon: typeof User; phase: string }[] = [
  { label: '账号 / Profile', icon: User, phase: 'P2' },
  { label: '设置中心', icon: Settings, phase: 'P2' },
  { label: '通知', icon: Bell, phase: 'P2' },
];

export function MoreMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
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
        type="button"
        className="app-avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="更多菜单"
        onClick={() => setOpen((v) => !v)}
      >
        <User size={18} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="app-more-menu" role="menu">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} role="none">
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
                  <span className="app-phase-chip">{item.phase}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
