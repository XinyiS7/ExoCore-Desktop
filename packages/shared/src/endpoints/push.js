/**
 * Web Push subscription management.
 *
 * Uses the Push API (PushManager) to subscribe the browser to push notifications
 * from the ExoCore server. The subscription is sent to the Django backend for
 * storage / later use by the `send_physical_notification` tool.
 */

import { apiFetch } from '../api';

// VAPID public key — the server holds the private key and uses it to sign push messages.
// The browser uses this public key to verify the message origin.
const VAPID_PUBLIC_KEY = 'BKlG4M9uEo7TIOTlDZMN_3ncx8oOM2g7hfy-5M5-xQWOfbporu58kUGrQtLxX99-VShp56Z1ysbcKJ9ySUFtqO8';

/**
 * Convert a base64url-encoded VAPID key to a Uint8Array.
 * The PushManager API requires the applicationServerKey as a Uint8Array.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check whether the current browser supports Web Push.
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current push subscription, if any.
 * Returns `null` if not subscribed.
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Get the current notification permission state.
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('此浏览器不支持通知');
  }

  const result = await Notification.requestPermission();
  return result; // 'granted' | 'denied' | 'default'
}

/**
 * Subscribe to push notifications.
 *
 * 1. Requests notification permission (if not already granted).
 * 2. Waits for the service worker to be ready.
 * 3. Subscribes via pushManager.subscribe() with our VAPID key.
 * 4. Sends the subscription object to the Django backend for storage.
 *
 * Returns the PushSubscription object, or null if denied.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    console.warn('[ExoPush] Push API not supported in this browser');
    return null;
  }

  // 1. Permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('[ExoPush] Notification permission denied');
    return null;
  }

  // 2. Wait for SW
  const registration = await navigator.serviceWorker.ready;

  // 3. Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  console.log('[ExoPush] Subscribed:', subscription.endpoint);

  // 4. Persist to backend
  try {
    await apiFetch('/api/push/subscribe/', {
      method: 'POST',
      body: { subscription: subscription.toJSON() },
    });
    console.log('[ExoPush] Subscription saved to backend');
  } catch (err) {
    console.error('[ExoPush] Failed to save subscription to backend:', err);
    // Don't throw — the browser subscription still exists locally.
    // Next subscribe() call will re-persist.
  }

  return subscription;
}

/**
 * Unsubscribe from push notifications and notify the backend.
 */
export async function unsubscribeFromPush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  // Notify backend first (so it stops sending)
  try {
    await apiFetch('/api/push/unsubscribe/', {
      method: 'POST',
      body: { endpoint: subscription.endpoint },
    });
  } catch (err) {
    console.error('[ExoPush] Failed to notify backend of unsubscription:', err);
  }

  // Then unsubscribe locally
  await subscription.unsubscribe();
  console.log('[ExoPush] Unsubscribed');
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for managing push notification subscription state.
 *
 * Usage:
 *   const { isSubscribed, isLoading, subscribe, unsubscribe } = usePushSubscription();
 *
 *   // Call subscribe() on a button click (must be user gesture for permission prompt)
 *   <button onClick={subscribe}>Enable Notifications</button>
 */
export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState('default');

  // Check current state on mount
  useEffect(() => {
    let cancelled = false;

    async function checkState() {
      try {
        const perm = getNotificationPermission();
        const sub = await getCurrentSubscription();
        if (!cancelled) {
          setPermission(perm);
          setIsSubscribed(!!sub);
        }
      } catch (err) {
        console.warn('[ExoPush] Error checking subscription state:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkState();
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const sub = await subscribeToPush();
      setIsSubscribed(!!sub);
      setPermission(getNotificationPermission());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
      setPermission(getNotificationPermission());
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
