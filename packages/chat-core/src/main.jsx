import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './index.css';

// Strip trailing slash: Vite's BASE_URL is "/chat/" → basename "/chat"
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

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
