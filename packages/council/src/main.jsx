import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './index.css';
import { apiFetch } from 'exo-shared';
import { pushNotification } from './stores/notificationStore';

// ─── Service Worker Auto-Update Reload ────────────────────────────────
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

// ─── Service Worker Push Navigation Bridge ───────────────────────────
function PushNavigateListener() {
  const navigate = useNavigate();

  React.useEffect(() => {
    async function handleMessage(event) {
      if (event.data?.type !== 'PUSH_NAVIGATE') return;

      const { url, action, registerId, presetId, subscriptionEndpoint,
              title, body, senderName, senderType } = event.data;

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
          } catch (_) { /* silent */ }
        }
        return;
      }

      // expand → 显示内联通知面板 + 导航（旧 SW 兼容：点击主体已归类为 navigate）
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
        // 旧 SW 缓存兼容：expand 本质是点击通知主体 → 执行导航
        if (url) {
          navigate(url);
        }
        return;
      }

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
          } catch (_) { /* silent */ }
        }
        // 收到 postMessage 后真正导航到目标 URL
        if (url) {
          navigate(url);
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

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME}>
      <PushNavigateListener />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
