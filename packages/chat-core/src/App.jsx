import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useTheme } from 'exo-shared';

// Layout
import DesktopSidebar from './components/layout/DesktopSidebar';
import MobileHeader from './components/layout/MobileHeader';
import MobileBottomBar from './components/layout/MobileBottomBar';
import ErrorBoundary from './components/ErrorBoundary';

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
import KeyManagePanel from './components/settings/KeyManagePanel';
import ModelAssignPanel from './components/settings/ModelAssignPanel';
import NotificationsPanel from './components/settings/NotificationsPanel';
import AppearancePanel from './components/settings/AppearancePanel';
import RoutinePanel from './components/settings/RoutinePanel';
import MemoryConsole from './views/MemoryConsole';
import GroupchatList from './views/GroupchatList';


// Chat
import ChatShell from './components/chat/ChatShell';

// Modal context (shared state across all routes)
import { ModalProvider, useModalContext } from './contexts/ModalContext';

// ─── AppLayout shell ─────────────────────────────────────────────────
function AppLayout() {
  const navigate = useNavigate();
  const { projects, setProjects } = useProjects();
  const { presets, setPresets } = usePresets();
  const { activeSessionId, setActiveSessionId } = useActiveSession();

  // Minimal setView for NewSessionModal default navigation
  const setView = useCallback((view, params) => {
    const routes = {
      chat: params?.sessionId
        ? { pathname: `/chat/${params.sessionId}`, state: { ...params } }
        : '/chat',
    };
    const target = routes[view] || '/';
    if (typeof target === 'string') {
      navigate(target);
    } else {
      navigate(target.pathname, { state: target.state });
    }
  }, [navigate]);

  // Apply theme on mount and sync across tabs
  useTheme();

  const appStateForModals = { projects, setProjects, presets, setPresets, activeSessionId, setActiveSessionId };

  return (
    <ModalProvider appState={appStateForModals} setView={setView}>
      <div className="w-full flex cinder-aura" style={{ height: '100dvh' }}>
        {/* Desktop: 64px vertical-rl text sidebar */}
        <DesktopSidebar />

        {/* Content column: main + mobile bar */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile: top back-navigation bar */}
          <MobileHeader />

          {/* Page content — overflow-hidden: each view handles its own scrolling */}
          <main className="flex-1 overflow-hidden flex flex-col relative z-[1]">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>

          {/* Mobile: fixed bottom navigation bar */}
          <MobileBottomBar />
        </div>
      </div>
    </ModalProvider>
  );
}

// ─── AppState bridge (keeps existing views working) ───────────────────
function useAppStateBridge() {
  const navigate = useNavigate();
  const { projects, setProjects, refresh: refreshProjects } = useProjects();
  const { presets, setPresets, refresh: refreshPresets } = usePresets();
  const { activeSessionId, setActiveSessionId } = useActiveSession();
  const { memoryRefreshKey, triggerMemoryRefresh } = useMemoryManager();

  const [refreshKey, setRefreshKey] = useState(0);

  // Modal functions from shared context (single state across all routes)
  const {
    openNewSession, openDestructor, openCreateProject,
    newSessionConfig, destructorConfig, createProjectConfig,
  } = useModalContext();

  // setView: maps old string-based navigation → React Router
  const setView = useCallback((view, params) => {
    const routes = {
      dashboard: '/',
      chat: params?.sessionId
        ? { pathname: `/chat/${params.sessionId}`, state: { ...params } }
        : '/chat',
      agent_hub: '/agent-hub',
      agent_profile: params?.agentId ? `/agent/${params.agentId}` : '/agent-hub',
      agent_memory: params?.agentId ? `/agent/${params.agentId}/memory` : '/agent-hub',
      project: params?.projectId ? `/project/${params.projectId}` : '/projects',
      project_detail: params?.projectId ? `/project/${params.projectId}` : '/projects',
      user: '/user',
      settings: '/settings',
      projects: '/projects',
      groupchat: '/groupchat',
    };
    const target = routes[view] || '/';
    if (typeof target === 'string') {
      navigate(target);
    } else {
      navigate(target.pathname, { state: target.state });
    }
  }, [navigate]);

  const goBack = useCallback(() => navigate(-1), [navigate]);

  return {
    appState: {
      projects, setProjects, presets, setPresets,
      activeSessionId, setActiveSessionId,
      refreshKey, setRefreshKey,
      memoryRefreshKey, triggerMemoryRefresh,
      openDestructor,
      openNewSession,
      openCreateProject,
      refreshPresets, refreshProjects,
      // Keep these for backward compat (some components may destructure them)
      destructorConfig, newSessionConfig, createProjectConfig,
    },
    setView,
    goBack,
  };
}

// ─── Route wrappers ───────────────────────────────────────────────────
function DashboardRoute() {
  const { appState, setView } = useAppStateBridge();
  return <Dashboard appState={appState} setView={setView} />;
}

function ChatShellRoute() {
  const { appState } = useAppStateBridge();
  return (
    <ChatShell
      presets={appState.presets}
      activeSessionId={appState.activeSessionId}
      setActiveSessionId={appState.setActiveSessionId}
      setRefreshKey={appState.setRefreshKey}
      openNewSession={appState.openNewSession}
      openDestructor={appState.openDestructor}
    />
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

function GroupchatListRoute() {
  const { id } = useParams();
  const { appState, goBack } = useAppStateBridge();
  return <GroupchatList appState={appState} goBack={goBack} viewParams={{ id: id ? Number(id) : undefined }} />;
}

function KeyManageRoute() {
  return <KeyManagePanel />;
}

function NotificationsRoute() {
  return <NotificationsPanel />;
}

function ModelAssignRoute() {
  return <ModelAssignPanel />;
}

function RoutineRoute() {
  return <RoutinePanel />;
}

function SettingsRoute() {
  return <SettingsView />;
}

// ─── Root App ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardRoute />} />
        <Route path="chat/:sessionId" element={<ChatShellRoute />} />
        <Route path="agent-hub" element={<AgentHubRoute />} />
        <Route path="agent/:presetId" element={<AgentProfileRoute />} />
        <Route path="agent/:presetId/memory" element={<AgentMemoryRoute />} />
        <Route path="projects" element={<ProjectsRoute />} />
        <Route path="project/:id" element={<ProjectDetailRoute />} />
        <Route path="groupchat" element={<GroupchatListRoute />} />
        <Route path="groupchat/:id" element={<GroupchatListRoute />} />
        <Route path="user" element={<UserRoute />} />
        <Route path="settings" element={<SettingsRoute />}>
          <Route index element={<Navigate to="keys" replace />} />
          <Route path="keys" element={<KeyManageRoute />} />
          <Route path="models" element={<ModelAssignRoute />} />
          <Route path="notifications" element={<NotificationsRoute />} />
          <Route path="appearance" element={<AppearancePanel />} />
          <Route path="routine" element={<RoutineRoute />} />
          <Route path="memory" element={<MemoryConsole />} />
        </Route>
      </Route>
    </Routes>
  );
}
