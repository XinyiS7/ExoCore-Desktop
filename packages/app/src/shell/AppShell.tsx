import { Outlet, useLocation } from 'react-router-dom';
import { MoreMenu, PrimaryNavigation } from './PrimaryNavigation';

const DETAIL_PATH = /^\/chat\/\d+$/;

/**
 * Responsive App Shell (D1 = D-A + M1 + X1 + C1):
 * - desktop: fixed left sidebar with the canonical 4 product areas + avatar More;
 * - mobile: bottom bar projecting the same navigation data;
 * - C1: entering canonical /chat/:conversationId hides the bottom bar so the
 *   message area receives full usable height (Roadmap exit gate);
 * - every page owns exactly one scroll container (no nested scroll traps).
 */
export function AppShell() {
  const { pathname } = useLocation();
  const isDetail = DETAIL_PATH.test(pathname);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true" />
          <span className="app-brand-name">ExoCore V4</span>
        </div>
        <PrimaryNavigation variant="sidebar" />
        <MoreMenu className="app-more--sidebar" />
      </aside>

      <div className={`app-main${isDetail ? '' : ' app-main--bb'}`}>
        <Outlet />
      </div>

      {!isDetail ? (
        <nav className="app-bottombar" aria-label="主导航">
          <PrimaryNavigation variant="bottom" />
        </nav>
      ) : null}
    </div>
  );
}
