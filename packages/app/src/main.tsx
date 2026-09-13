import React from 'react';
import ReactDOM from 'react-dom/client';
import 'highlight.js/styles/github-dark.css';
import './styles/base.css';
import './styles/shell.css';
import './features/agents/agents.css';
import './features/projects/projects.css';
import './features/chat/chatDelete.css';
import './features/account/account.css';
import './features/settings/settings.css';
import { AppProviders } from './app/AppProviders';

// V4 service worker: P1A shell precache only (no /api caching, no push).
// vite-plugin-pwa injects the registration (devOptions.enabled=false → no-op
// in dev); skipWaiting + clients.claim in sw.js → controllerchange reload.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>,
);
