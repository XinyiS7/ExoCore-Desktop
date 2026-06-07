import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './index.css';

// Strip trailing slash: Vite's BASE_URL is "/chat/" → basename "/chat"
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

// ─── Service Worker Auto-Update Reload ────────────────────────────────
// When a new SW activates and claims this client, reload to get new code.
// Dev mode: devOptions.enabled=false, so this won't fire in dev.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  // Backup: also listen for SW_UPDATED message from the new SW's activate handler
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
}

// ─── Service Worker Push Navigation Bridge ───────────────────────────
// When the SW receives a notificationclick, it postMessages the target
// URL here so React Router can navigate without a full page reload.
function PushNavigateListener() {
  const navigate = useNavigate();

  React.useEffect(() => {
    function handleMessage(event) {
      if (event.data?.type === 'PUSH_NAVIGATE' && event.data?.url) {
        // SW sends absolute path like /chat/agent/6.
        // Strip basename prefix if present so React Router handles it.
        const path = event.data.url.startsWith(BASENAME)
          ? event.data.url.slice(BASENAME.length) || '/'
          : event.data.url;
        navigate(path);
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [navigate]);

  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME}>
      <PushNavigateListener />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
