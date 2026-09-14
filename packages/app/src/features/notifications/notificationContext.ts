import { createContext, useContext } from 'react';
import { AssistantMessageArrivedV1 } from './contract';

export interface NotificationContextValue {
  unreadCount: number;
  unreadByConversation: Record<number, number>;
  pendingArrivalsByConversation: Record<number, AssistantMessageArrivedV1[]>;
  activeIndication: AssistantMessageArrivedV1 | null;
  dismissIndication: () => void;
  consumeExactArrivals: (conversationId: number, messageIds: Set<number>) => void;
  syncError: string | null;
  retrySync: () => void;
  repairNeeded: boolean;
  setRepairNeeded: (val: boolean) => void;
}

const defaultNotificationContext: NotificationContextValue = {
  unreadCount: 0,
  unreadByConversation: {},
  pendingArrivalsByConversation: {},
  activeIndication: null,
  dismissIndication: () => {},
  consumeExactArrivals: () => {},
  syncError: null,
  retrySync: () => {},
  repairNeeded: false,
  setRepairNeeded: () => {},
};

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  return ctx ?? defaultNotificationContext;
}

