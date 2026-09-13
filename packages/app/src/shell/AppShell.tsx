import { Outlet, useLocation } from 'react-router-dom';
import { MoreMenu, PrimaryNavigation } from './PrimaryNavigation';

const DETAIL_PATH = /^\/chat\/\d+$|^\/agents\/[1-9]\d*$|^\/projects\/[1-9]\d*$|^\/account$|^\/settings(?:\/.*)?$/;

/**
 * Responsive App Shell (D1 = D-A + M1 + X1 + C1):
 * - desktop: fixed left sidebar with the canonical 4 product areas + avatar More;
 * - mobile: bottom bar projecting the same navigation data;
 * - C1: entering canonical /chat/:conversationId hides the bottom bar so the
 *   message area receives full usable height (Roadmap exit gate);
 * - P2A: syntactically valid /agents/:presetId is a focused L2 Profile shell
 *   — the bottom bar is hidden without waiting for detail success; invalid
 *   IDs and the L1 Hub keep it visible;
 * - P2B: syntactically valid /projects/:projectId is a focused L2 Project
 *   Detail shell under the same policy (D8); invalid IDs and the L1 Hub keep
 *   the bottom bar visible;
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
