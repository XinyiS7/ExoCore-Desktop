import { Library, MessageSquare, Users, Waves, type LucideIcon } from 'lucide-react';

/**
 * One canonical IA definition (Plan Task 4.2). Desktop sidebar and mobile
 * bottom bar are projections of this data; future areas are semantic
 * disabled entries with phase chips — never routed to empty pages.
 * Non-component module so component files keep react-refresh purity.
 */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Route for enabled entries; disabled entries must not pretend to have pages. */
  to?: string;
  enabled: boolean;
  /** Human-readable availability window, shown on the chip. */
  phase?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, to: '/', enabled: true },
  { id: 'groups', label: 'Groups', icon: Users, enabled: false, phase: 'P2' },
  { id: 'river', label: 'River', icon: Waves, enabled: false, phase: 'P3' },
  { id: 'library', label: 'Library', icon: Library, enabled: false, phase: 'P4/P5' },
];

export const isChatActive = (pathname: string) =>
  pathname === '/' ||
  /^\/chat(?:\/|$)/.test(pathname) ||
  // P2A: Agent Hub/Profile stay under the Chat product area's active state (D4).
  /^\/agents(?:\/|$)/.test(pathname) ||
  // P2B: Project Hub/Detail stay under the Chat product area's active state (D8).
  /^\/projects(?:\/|$)/.test(pathname);
