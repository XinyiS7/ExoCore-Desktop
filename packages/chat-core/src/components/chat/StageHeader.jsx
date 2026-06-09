import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FolderKanban } from 'lucide-react';

/**
 * StageHeader — the shell's top bar, context-aware.
 *
 * Context A (from home):     [<- Home]
 * Context B (from agent):    [<- AgentName]
 * Context C (from projects): [<- Project Hub]
 * Context D (from project):  [<- ProjectName]              [📁 Project Files]
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
    from === 'agent'    ? state.agentName || 'Agent' :
    from === 'project'  ? state.projectName || 'Project' :
    from === 'projects' ? 'Project Hub' :
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
    <div className="hidden md:flex items-center justify-between h-12 pl-0 pr-4 border-b border-white/5 bg-chat-panel/60 backdrop-blur-md flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-chat-muted hover:text-chat-text transition-colors group"
        >
          <ArrowLeft size={15} strokeWidth={1} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-light text-chat-text/80 truncate max-w-[200px]">
            {backLabel}
          </span>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {showFilesButton && (
          <button
            onClick={onToggleFilesDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-chat-muted/60 hover:text-chat-accent border border-white/[0.06] hover:border-chat-accent/30 rounded transition-all"
            title="Project Files"
          >
            <FolderKanban size={13} strokeWidth={1} />
            <span className="hidden sm:inline font-mono uppercase tracking-widest">Project Files</span>
          </button>
        )}
      </div>
    </div>
  );
}
