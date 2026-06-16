import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import BackToUpper from '../layout/BackButton';

/**
 * StageHeader — the shell's top bar, context-aware.
 *
 * Context A (from home):     ‹ Home
 * Context B (from agent):    ‹ AgentName
 * Context C (from projects): ‹ Project Hall
 * Context D (from project):  ‹ ProjectName    [📁 Project Files]
 *
 * Session name is NOT shown here — it lives inside ChatArea's v2 header.
 */
export default function StageHeader({
  onToggleFilesDrawer,
  project,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const from = state.from;
  const backLabel =
    from === 'agent'    ? state.agentName || 'Agent Hub' :
    from === 'project'  ? state.projectName || 'Project' :
    from === 'projects' ? 'Project Hall' :
    from === 'home'     ? 'Home' :
    /* fallback */        'Back';

  const handleBack = () => {
    if (state.backTo) {
      navigate(state.backTo);
    } else {
      navigate(-1);
    }
  };

  const showFilesButton = from === 'project';

  return (
    <div className="hidden md:flex items-center justify-between h-12 pl-0 pr-4 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <BackToUpper label={backLabel} onClick={handleBack} />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {showFilesButton && (
          <button
            onClick={onToggleFilesDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[0.6875rem] text-cinder-text-faint hover:text-cinder-flame border border-white/[0.06] hover:border-cinder-flame/30 rounded transition-all"
            title="Project Files"
          >
            <FolderKanban size={13} strokeWidth={1} />
            <span className="hidden sm:inline font-mono tracking-widest">Project Files</span>
          </button>
        )}
      </div>
    </div>
  );
}