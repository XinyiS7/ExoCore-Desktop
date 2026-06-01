import React, { useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';

// Hooks
import { useProjects } from './hooks/useProjects';
import { usePresets } from './hooks/usePresets';
import { useActiveSession } from './hooks/useActiveSession';
import { useMemoryManager } from './hooks/useMemory';

// Layout
import Sidebar from './components/layout/Sidebar';
import MobileSidebar from './components/layout/MobileSidebar';

// Views
import Dashboard from './views/Dashboard';
import AgentHub from './views/AgentHub';
import AgentProfile from './views/AgentProfile';
import AgentMemory from './views/AgentMemory';
import ProjectList from './views/ProjectList';
import ProjectDetail from './views/ProjectDetail';
import UserProfile from './views/UserProfile';

// Modals
import DestructorModal from './components/modals/DestructorModal';
import NewSessionModal from './components/modals/NewSessionModal';
import CreateProjectModal from './components/modals/CreateProjectModal';

// ─── AppShell: provides layout + appState bridge for V2-era views ──────────
function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // App-level state from focused hooks
  const { projects, setProjects, refresh: refreshProjects } = useProjects();
  const { presets, setPresets, refresh: refreshPresets } = usePresets();
  const { activeSessionId, setActiveSessionId } = useActiveSession();
  const { memoryRefreshKey, triggerMemoryRefresh } = useMemoryManager();

  // Modal state
  const [destructorConfig, setDestructorConfig] = useState({ isOpen: false });
  const [newSessionConfig, setNewSessionConfig] = useState({ isOpen: false, initialContext: null });
  const [createProjectConfig, setCreateProjectConfig] = useState({ isOpen: false });

  // Compat: setView / goBack bridge for V2 view conventions
  const setView = useCallback((view, params) => {
    const routes = {
      dashboard: '/',
      chat: params?.sessionId ? `/chat/${params.sessionId}` : '/chat',
      agent_hub: '/agent-hub',
      agent_profile: params?.agentId ? `/agent/${params.agentId}` : '/agent-hub',
      agent_memory: params?.agentId ? `/agent/${params.agentId}/memory` : '/agent-hub',
      project: params?.projectId ? `/project/${params.projectId}` : '/projects',
      project_detail: params?.projectId ? `/project/${params.projectId}` : '/projects',
      user: '/user',
      settings: '/settings',
      projects: '/projects',
    };
    const path = routes[view];
    if (path) navigate(path);
  }, [navigate]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Modal helpers
  const openDestructor = useCallback((config) => {
    setDestructorConfig({ ...config, isOpen: true });
  }, []);

  const openNewSession = useCallback((initialContext = null, onSuccess = null) => {
    setNewSessionConfig({ isOpen: true, initialContext, onSuccess });
  }, []);

  const openCreateProject = useCallback(() => {
    setCreateProjectConfig({ isOpen: true });
  }, []);

  // Build appState object for V2 view compat
  const appState = {
    // Data
    projects, setProjects,
    presets, setPresets,
    // Session
    activeSessionId, setActiveSessionId,
    refreshKey: memoryRefreshKey,
    // Memory
    memoryRefreshKey, triggerMemoryRefresh,
    // Modals
    destructorConfig, setDestructorConfig,
    newSessionConfig, setNewSessionConfig,
    createProjectConfig, setCreateProjectConfig,
    openDestructor, openNewSession, openCreateProject,
    // Refresh
    refreshPresets, refreshProjects,
  };

  // Wrap children with extra props
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { appState, setView, goBack });
    }
    return child;
  });

  return (
    <div className="w-full h-screen bg-chat-bg text-chat-text font-sans flex overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar
          newSessionConfig={newSessionConfig}
          setNewSessionConfig={setNewSessionConfig}
          createProjectConfig={createProjectConfig}
          setCreateProjectConfig={setCreateProjectConfig}
          openNewSession={openNewSession}
          openCreateProject={openCreateProject}
          appState={appState}
          setView={setView}
          goBack={goBack}
        />
      </div>

      {/* Mobile sidebar — slide-over */}
      {showMobileSidebar && (
        <MobileSidebar
          showConvList={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          appState={appState}
          setView={setView}
          goBack={goBack}
        />
      )}

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile header bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-chat-panel/80 backdrop-blur-md">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="text-chat-muted hover:text-chat-text transition-colors"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2.5 5h15M2.5 10h15M2.5 15h15" />
            </svg>
          </button>
          <span className="text-xs font-mono uppercase tracking-widest text-chat-accent/60">ExoCore</span>
          <div className="w-5" />
        </div>

        <div className="flex-1 overflow-hidden">
          {childrenWithProps}
        </div>
      </main>

      {/* Modals */}
      <DestructorModal
        config={destructorConfig}
        onClose={() => setDestructorConfig({ isOpen: false })}
      />
      {newSessionConfig.isOpen && (
        <NewSessionModal
          isOpen={newSessionConfig.isOpen}
          onClose={() => setNewSessionConfig({ isOpen: false })}
          projects={projects}
          presets={presets}
          initialContext={newSessionConfig.initialContext}
          onSuccess={newSessionConfig.onSuccess}
        />
      )}
      {createProjectConfig.isOpen && (
        <CreateProjectModal
          isOpen={createProjectConfig.isOpen}
          onClose={() => setCreateProjectConfig({ isOpen: false })}
          setProjects={setProjects}
        />
      )}
    </div>
  );
}

// ─── Route wrappers to provide viewParams ──────────────────────────────────
function DashboardRoute(props) {
  return <Dashboard {...props} />;
}

function AgentHubRoute(props) {
  return <AgentHub {...props} />;
}

function AgentProfileRoute(props) {
  const { presetId } = useParams();
  return <AgentProfile {...props} viewParams={{ agentId: Number(presetId) }} />;
}

function AgentMemoryRoute(props) {
  const { presetId } = useParams();
  return <AgentMemory {...props} viewParams={{ agentId: Number(presetId) }} />;
}

function ChatRoute(props) {
  const { sessionId } = useParams();
  return <Dashboard {...props} />;
  // TODO: Replace with dedicated ChatArea view when refactored
}

function ProjectsRoute(props) {
  return <ProjectList {...props} />;
}

function ProjectDetailRoute(props) {
  const { id } = useParams();
  return <ProjectDetail {...props} viewParams={{ projectId: Number(id) }} />;
}

function UserRoute(props) {
  return <UserProfile {...props} />;
}

function SettingsRoute(props) {
  // Placeholder: import SettingsPanel when ready
  return <Dashboard {...props} />;
}

// ─── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<DashboardRoute />} />
        <Route path="chat/:sessionId" element={<ChatRoute />} />
        <Route path="agent-hub" element={<AgentHubRoute />} />
        <Route path="agent/:presetId" element={<AgentProfileRoute />} />
        <Route path="agent/:presetId/memory" element={<AgentMemoryRoute />} />
        <Route path="projects" element={<ProjectsRoute />} />
        <Route path="project/:id" element={<ProjectDetailRoute />} />
        <Route path="settings" element={<SettingsRoute />} />
        <Route path="user" element={<UserRoute />} />
      </Route>
    </Routes>
  );
}
