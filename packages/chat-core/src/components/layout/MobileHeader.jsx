import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BackToUpper from './BackButton';

/**
 * MobileHeader — top back bar on L1 hall pages (mobile only).
 *
 * Only visible on L1 hall routes (/projects, /agent-hub, etc.).
 * Hidden on L2/L3 pages — those have their own navigation.
 * All L1 halls go back to Dashboard ("Home").
 */
export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  const L1_HALL = ['/projects', '/agent-hub', '/groupchat', '/settings', '/user'];
  const isL1 = L1_HALL.includes(location.pathname);
  if (isHome || !isL1) return null;

  return (
    <div className="md:hidden flex-shrink-0 flex items-center px-3" style={{ height: '40px' }}>
      <BackToUpper
        label="Home"
        onClick={() => navigate('/')}
      />
    </div>
  );
}