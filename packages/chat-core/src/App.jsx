import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Hexagon, Menu, X, MessageSquare, BrainCircuit, FolderKanban, Settings, Minus } from 'lucide-react';

// Hooks
import { useProjects } from './hooks/useProjects';
import { usePresets } from './hooks/usePresets';
import { useActiveSession } from './hooks/useActiveSession';
import { useMemoryManager } from './hooks/useMemory';

// Views
import Dashboard from './views/Dashboard';
import AgentHub from './views/AgentHub';
import AgentProfile from './views/AgentProfile';
import AgentMemory from './views/AgentMemory';
import ProjectList from './views/ProjectList';
import ProjectDetail from './views/ProjectDetail';
import UserProfile from './views/UserProfile';
import SettingsView from './views/SettingsView';

// Modals
import DestructorModal from './components/modals/DestructorModal';
import NewSessionModal from './components/modals/NewSessionModal';
import CreateProjectModal from './components/modals/CreateProjectModal';

// ─── Layout with thin top bar ──────────────────────────────────────────
function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Listen for Tauri tray navigation events
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) navigate(e.detail);
    };
    window.addEventListener('exo-nav', handler);
    return () => window.removeEventListener('exo-nav', handler);
  }, [navigate]);

  const navItems = [
    { path: '/',          icon: Hexagon,        label: 'Home' },
    { path: '/agent-hub', icon: BrainCircuit,   label: 'Agents' },
    { path: '/projects',  icon: FolderKanban,   label: 'Projects' },
    { path: '/settings',  icon: Settings,       label: 'Settings' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-full h-screen bg-chat-bg text-chat-text font-sans flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-11 flex items-center px-4 border-b border-white/5 bg-chat-panel/80 backdrop-blur-md shrink-0 z-50">
        {/* Logo */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2 mr-6 shrink-0">
          <Hexagon size={18} className="text-chat-accent" />
          <span className="text-[10px] font-bold tracking-[0.25em] text-chat-accent uppercase hidden sm:block">ExoCore</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                isActive(path)
                  ? 'text-chat-accent bg-chat-accent/10'
                  : 'text-chat-muted hover:text-chat-text hover:bg-white/5'
              }`}
            >
              <Icon size={14} strokeWidth={1.5} />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          {/* User avatar quick-access */}
          <button
            onClick={() => navigate('/user')}
            className="w-7 h-7 rounded border border-white/10 overflow-hidden hover:border-chat-accent/30 transition-colors"
          >
            <img
              src={localStorage.getItem('exo_user_avatar') || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(localStorage.getItem('exo_user_nick') || 'Exo User')}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 text-chat-muted hover:text-chat-text transition-colors"
          >
            <Menu size={18} />
          </button>

          {/* Window controls (Tauri: hide, not exit) */}
          <button
            onClick={() => {
              if (window.__TAURI__) {
                window.__TAURI__.window.getCurrent().hide();
              }
            }}
            className="p-1.5 text-chat-muted hover:text-chat-text hover:bg-white/5 rounded transition-colors"
            title="Hide window (service keeps running)"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Mobile slide-over menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 w-64 h-full bg-chat-panel border-l border-white/5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-[10px] font-bold tracking-[0.25em] text-chat-accent uppercase">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-chat-muted hover:text-chat-text">
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 py-2">
              {navItems.map(({ path, icon: Icon, label }) => (
                <button
                  key={path}
                  onClick={() => { navigate(path); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors ${
                    isActive(path)
                      ? 'text-chat-accent bg-chat-accent/10 border-r-2 border-chat-accent'
                      : 'text-chat-muted hover:text-chat-text hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

// ─── AppState bridge for V2 views ──────────────────────────────────────
function useAppStateBridge() {
  const navigate = useNavigate();
  const { projects, setProjects, refresh: refreshProjects } = useProjects();
  const { presets, setPresets, refresh: refreshPresets } = usePresets();
  const { activeSessionId, setActiveSessionId } = useActiveSession();
  const { memoryRefreshKey, triggerMemoryRefresh } = useMemoryManager();

  const [destructorConfig, setDestructorConfig] = useState({ isOpen: false });
  const [newSessionConfig, setNewSessionConfig] = useState({ isOpen: false, initialContext: null });
  const [createProjectConfig, setCreateProjectConfig] = useState({ isOpen: false });

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
    navigate(routes[view] || '/');
  }, [navigate]);

  const goBack = useCallback(() => navigate(-1), [navigate]);

  return {
    appState: {
      projects, setProjects, presets, setPresets,
      activeSessionId, setActiveSessionId,
      refreshKey: memoryRefreshKey,
      memoryRefreshKey, triggerMemoryRefresh,
      destructorConfig, setDestructorConfig,
      newSessionConfig, setNewSessionConfig,
      createProjectConfig, setCreateProjectConfig,
      openDestructor: (c) => setDestructorConfig({ ...c, isOpen: true }),
      openNewSession: (ctx, cb) => setNewSessionConfig({ isOpen: true, initialContext: ctx, onSuccess: cb }),
      openCreateProject: () => setCreateProjectConfig({ isOpen: true }),
      refreshPresets, refreshProjects,
    },
    setView,
    goBack,
    destructorConfig, setDestructorConfig,
    newSessionConfig, setNewSessionConfig,
    createProjectConfig, setCreateProjectConfig,
  };
}

// ─── Route wrappers (with modal rendering) ──────────────────────────────
function DashboardRoute() {
  const { appState, setView, destructorConfig, setDestructorConfig, newSessionConfig, setNewSessionConfig, createProjectConfig, setCreateProjectConfig } = useAppStateBridge();
  return (
    <>
      <Dashboard appState={appState} setView={setView} />
      <DestructorModal config={destructorConfig} onClose={() => setDestructorConfig({ isOpen: false })} />
      {newSessionConfig.isOpen && (
        <NewSessionModal
          isOpen={newSessionConfig.isOpen}
          onClose={() => setNewSessionConfig({ isOpen: false })}
          projects={appState.projects}
          presets={appState.presets}
          initialContext={newSessionConfig.initialContext}
          onSuccess={newSessionConfig.onSuccess}
        />
      )}
      {createProjectConfig.isOpen && (
        <CreateProjectModal
          isOpen={createProjectConfig.isOpen}
          onClose={() => setCreateProjectConfig({ isOpen: false })}
          setProjects={appState.setProjects}
        />
      )}
    </>
  );
}
function AgentHubRoute() {
  const { appState, setView, goBack } = useAppStateBridge();
  return <AgentHub appState={appState} setView={setView} goBack={goBack} />;
}
function AgentProfileRoute() {
  const { presetId } = useParams();
  const { appState, setView, goBack } = useAppStateBridge();
  return <AgentProfile appState={appState} setView={setView} goBack={goBack} viewParams={{ agentId: Number(presetId) }} />;
}
function AgentMemoryRoute() {
  const { presetId } = useParams();
  const { appState, setView, goBack } = useAppStateBridge();
  return <AgentMemory appState={appState} setView={setView} goBack={goBack} viewParams={{ agentId: Number(presetId) }} />;
}
function ChatRoute() {
  return <ChatPlaceholder />;
}
function ProjectsRoute() {
  const { appState, setView, goBack } = useAppStateBridge();
  return <ProjectList appState={appState} setView={setView} goBack={goBack} />;
}
function ProjectDetailRoute() {
  const { id } = useParams();
  const { appState, setView, goBack } = useAppStateBridge();
  return <ProjectDetail appState={appState} setView={setView} goBack={goBack} viewParams={{ projectId: Number(id) }} />;
}
function UserRoute() {
  const { appState, setView, goBack } = useAppStateBridge();
  return <UserProfile appState={appState} setView={setView} goBack={goBack} />;
}
function SettingsRoute() {
  return <SettingsView />;
}

// ─── Chat placeholder ───────────────────────────────────────────────────
function ChatPlaceholder() {
  const navigate = useNavigate();
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-chat-bg">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="p-4 rounded-full bg-chat-accent/10 inline-block">
          <MessageSquare size={32} className="text-chat-accent/50" />
        </div>
        <h2 className="text-xl font-light text-chat-text">Chat Interface</h2>
        <p className="text-sm text-chat-muted leading-relaxed">
          The full chat experience — including conversation threads, streaming responses,
          context cache management, and file attachments — will be implemented in a dedicated session.
        </p>
        <p className="text-[10px] font-mono text-chat-muted/40 uppercase tracking-widest">
          Coming in next iteration
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-chat-panel border border-white/10 rounded text-xs text-chat-muted hover:text-chat-text hover:border-chat-accent/30 transition-all mt-4"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Root App ───────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardRoute />} />
        <Route path="chat/:sessionId?" element={<ChatRoute />} />
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
