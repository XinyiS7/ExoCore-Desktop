import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { RouteErrorFallback } from '../shared/ErrorBoundary';
import { ChatHomePage } from '../features/chat/ChatHomePage';
import { ConversationPage } from '../features/chat/ConversationPage';
import { NotFoundPage } from '../features/chat/NotFoundPage';

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
        // Real not-found state (no masquerading empty page).
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: BASENAME },
);
