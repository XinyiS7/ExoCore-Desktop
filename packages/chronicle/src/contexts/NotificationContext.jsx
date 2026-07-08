import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { subscribe, removeNotification } from '../stores/notificationStore';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    return subscribe(setNotifications);
  }, []);

  const dismiss = useCallback(async (item) => {
    if (item.registerId) {
      try {
        const { apiFetch } = await import('exo-shared');
        await apiFetch(`/api/agents/registers/${item.registerId}/ack/`, {
          method: 'POST',
          body: {
            action: 'dismiss',
            subscription_endpoint: item.subscriptionEndpoint || null,
          },
          params: item.presetId ? { preset_id: item.presetId } : {},
        });
      } catch (_) { /* silent */ }
    }
    removeNotification(item.id);
  }, []);

  const navigateTo = useCallback(async (item, navigate) => {
    if (item.registerId) {
      try {
        const { apiFetch } = await import('exo-shared');
        await apiFetch(`/api/agents/registers/${item.registerId}/ack/`, {
          method: 'POST',
          body: {
            action: 'navigate',
            subscription_endpoint: item.subscriptionEndpoint || null,
          },
          params: item.presetId ? { preset_id: item.presetId } : {},
        });
      } catch (_) { /* silent */ }
    }
    removeNotification(item.id);
    // 真正导航到目标页
    if (item.url) {
      navigate(item.url);
    }
  }, []);

  const ctx = { notifications, dismiss, navigateTo };

  return (
    <NotificationContext.Provider value={ctx}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used inside <NotificationProvider>');
  return ctx;
}
