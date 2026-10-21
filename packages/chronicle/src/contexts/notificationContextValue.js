import { createContext, useContext } from 'react';

// Kept apart from NotificationProvider so that file exports only a component
// (react-refresh/only-export-components).
export const NotificationContext = createContext(null);

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used inside <NotificationProvider>');
  return ctx;
}
