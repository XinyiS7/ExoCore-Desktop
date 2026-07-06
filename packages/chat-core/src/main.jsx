import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './index.css';
import 'katex/dist/katex.min.css';
import { apiFetch } from 'exo-shared';
import { pushNotification } from './stores/notificationStore';

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
    async function handleMessage(event) {
      if (event.data?.type !== 'PUSH_NAVIGATE') return;

      const { url, action, registerId, presetId, subscriptionEndpoint,
              title, body, senderName, senderType } = event.data;

      // dismiss → 只回执，不跳转
      if (action === 'dismiss') {
        if (registerId) {
          try {
            await apiFetch(
              `/api/agents/registers/${registerId}/ack/`,
              {
                method: 'POST',
                body: {
                  action: 'dismiss',
                  subscription_endpoint: subscriptionEndpoint || null,
                },
                params: presetId ? { preset_id: presetId } : {},
              },
            );
          } catch (_) {
            // Silent
          }
        }
        return;
      }

      // expand → 显示内联通知面板，不跳转，不发 ACK（对方不知道已读）
      if (action === 'expand') {
        window.focus();

        pushNotification({
          title,
          body,
          senderName,
          senderType,
          url,
          registerId,
          presetId,
          subscriptionEndpoint,
        });
        return;
      }

      // navigate → 回执（SW 已处理 openWindow/focus，不再 navigate 避免空刷新）
      if (action === 'navigate') {
        if (registerId) {
          try {
            await apiFetch(
              `/api/agents/registers/${registerId}/ack/`,
              {
                method: 'POST',
                body: {
                  action: 'navigate',
                  subscription_endpoint: subscriptionEndpoint || null,
                },
                params: presetId ? { preset_id: presetId } : {},
              },
            );
          } catch (_) {
            // Silent
          }
        }
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
