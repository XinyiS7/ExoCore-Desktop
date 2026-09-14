import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { RouteErrorFallback } from '../shared/ErrorBoundary';
import { ChatHomePage } from '../features/chat/ChatHomePage';
import { ConversationPage } from '../features/chat/ConversationPage';
import { NotFoundPage } from '../features/chat/NotFoundPage';
import { AgentHubPage } from '../features/agents/AgentHubPage';
import { AgentProfilePage } from '../features/agents/AgentProfilePage';
import { ProjectHubPage } from '../features/projects/ProjectHubPage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { AccountPage } from '../features/account/AccountPage';
import { SettingsLayout } from '../features/settings/SettingsLayout';
import { AppearancePanel } from '../features/settings/AppearancePanel';
import { RoutinePanel } from '../features/settings/RoutinePanel';
import { KeysPanel } from '../features/settings/KeysPanel';
import { ModelRolesPanel } from '../features/settings/ModelRolesPanel';
import { McpPanel } from '../features/settings/McpPanel';
import { NotificationsPanel } from '../features/notifications/NotificationsPanel';
import { NotificationDemoPage } from '../features/notifications/NotificationDemoPage';

// Vite BASE_URL: "/" in dev, "/app/" in production build → basename "" / "/app".
// Browser refresh and nginx fallback preserve the same detail route (Plan §5.4).
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      errorElement: <RouteErrorFallback />,
      children: [
        // Chat Home is the package root.
        { index: true, element: <ChatHomePage /> },
        // /chat without an ID redirects to Chat Home.
        { path: 'chat', element: <Navigate to="/" replace /> },
        // Canonical conversation detail.
        { path: 'chat/:conversationId', element: <ConversationPage /> },
        // P2A: Agent Hub (L1) + directly addressable Agent Profile (L2).
        { path: 'agents', element: <AgentHubPage /> },
        { path: 'agents/:presetId', element: <AgentProfilePage /> },
        // P2B: Project Hub (L1) + directly addressable Project Detail (L2, D8).
        { path: 'projects', element: <ProjectHubPage /> },
        { path: 'projects/:projectId', element: <ProjectDetailPage /> },
        // P2C CP C-1: Canonical Account page + /user legacy redirect (Plan §3 D1).
        { path: 'account', element: <AccountPage /> },
        { path: 'user', element: <Navigate to="/account" replace /> },
        // P2C CP C-4: Settings feature shell with Keys, Models, MCP, Appearance, Routine, Notifications (Plan §6 CP C-4).
        {
          path: 'settings',
          element: <SettingsLayout />,
          children: [
            { index: true, element: <Navigate to="/settings/keys" replace /> },
            { path: 'keys', element: <KeysPanel /> },
            { path: 'models', element: <ModelRolesPanel /> },
            { path: 'mcp', element: <McpPanel /> },
            { path: 'appearance', element: <AppearancePanel /> },
            { path: 'routine', element: <RoutinePanel /> },
            { path: 'notifications', element: <NotificationsPanel /> },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
        // Interactive demo & lab for notifications (P2D).
        { path: 'demo/notifications', element: <NotificationDemoPage /> },
        { path: 'demo', element: <Navigate to="/demo/notifications" replace /> },
        // Real not-found state (no masquerading empty page).
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: BASENAME },
);
