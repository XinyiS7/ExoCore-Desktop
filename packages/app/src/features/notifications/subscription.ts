/**
 * Push Notification Subscription & Acknowledgement Service
 *
 * Implements Plan D7, D8, §6.5, §6.7, and ReactSheet.md §8.1.
 *
 * Guarantees:
 * - Five-layer truth:
 *   1. Browser capability (PushManager / ServiceWorker)
 *   2. Permission state (default / granted / denied)
 *   3. Browser subscription credential presence
 *   4. Backend persistence confirmation (persisted === true && is_active === true)
 *   5. Renewal / cleanup repair state
 * - Device name trimmed to max 200 Unicode code points.
 * - Device name updates reuse existing browser subscription endpoint without rotating.
 * - Strict 201 backend response validation (id, endpoint, installation_id, is_active, persisted).
 * - Safe error sanitization without leaking sensitive URLs or authentication keys.
 * - Coherent Register ACK state machine (sent / failed_retryable / failed_terminal).
 */

import { apiFetch } from 'exo-shared/api';
import {
  VAPID_PUBLIC_KEY,
  urlBase64ToUint8Array,
  isRecord,
  isValidRegisterAck,
  isValidAckOutcome,
} from './workerContract';
import { getInstallationId } from './storage';

export const PUSH_DEVICE_NAME_STORAGE_KEY = 'exo:v4:push:device_name';

export interface BackendSubscribeResponse {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  device_name: string;
  installation_id: string;
  is_active: boolean;
  persisted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Trim string to max Unicode code points (handles multi-byte / surrogate pairs / emoji).
 */
export function trimToUnicodeCodePoints(str: string, maxCodePoints = 200): string {
  const codePoints = Array.from(str.trim());
  if (codePoints.length <= maxCodePoints) return str.trim();
  return codePoints.slice(0, maxCodePoints).join('');
}

/**
 * Sanitize error messages to prevent leaking sensitive full endpoint URLs or keys.
 */
export function sanitizeErrorMessage(err: unknown): string {
  let rawMsg = '';
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.trim() !== '') {
      rawMsg = obj.message;
    } else if (obj.body && typeof obj.body === 'object') {
      const body = obj.body as Record<string, unknown>;
      if (typeof body.error === 'string') rawMsg = body.error;
      else if (typeof body.detail === 'string') rawMsg = body.detail;
      else {
        const values = Object.values(body);
        if (values.length > 0 && Array.isArray(values[0]) && typeof values[0][0] === 'string') {
          rawMsg = values[0][0];
        }
      }
    }
  }
  if (!rawMsg) {
    rawMsg = err instanceof Error ? err.message : String(err || '请求失败');
  }

  // Redact full endpoint URLs (retain origin only)
  let sanitized = rawMsg.replace(/https?:\/\/[^\s"']+/gi, (url) => {
    try {
      const u = new URL(url);
      return `${u.origin}/[endpoint]`;
    } catch {
      return '[endpoint]';
    }
  });

  // Redact long crypto keys / hashes
  sanitized = sanitized.replace(/[A-Za-z0-9_-]{32,}/g, '[key]');
  return sanitized;
}

/**
 * Strict validator for backend POST /api/push/subscribe/ 201 response.
 * Enforces all 11 fields mandated by ReactSheet.md §8.1.
 */
export function isValidBackendSubscribeResponse(
  res: unknown,
  expectedEndpoint: string,
  expectedInstallationId: string,
): res is BackendSubscribeResponse {
  if (!res || typeof res !== 'object') return false;
  const r = res as Record<string, unknown>;
  return (
    typeof r.id === 'number' &&
    Number.isInteger(r.id) &&
    r.id > 0 &&
    typeof r.endpoint === 'string' &&
    r.endpoint === expectedEndpoint &&
    typeof r.p256dh === 'string' &&
    r.p256dh.length > 0 &&
    typeof r.auth === 'string' &&
    r.auth.length > 0 &&
    typeof r.user_agent === 'string' &&
    typeof r.device_name === 'string' &&
    typeof r.installation_id === 'string' &&
    r.installation_id === expectedInstallationId &&
    r.is_active === true &&
    r.persisted === true &&
    typeof r.created_at === 'string' &&
    !Number.isNaN(Date.parse(r.created_at)) &&
    typeof r.updated_at === 'string' &&
    !Number.isNaN(Date.parse(r.updated_at))
  );
}

/**
 * Check if the current browser environment supports Web Push and Service Worker.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission state.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export type BrowserSubscriptionOutcome =
  | { status: 'unsupported' }
  | { status: 'ok'; subscription: PushSubscription | null }
  | { status: 'error'; error: string };

/**
 * Retrieve active browser PushSubscription with explicit outcome status.
 */
export async function getBrowserSubscriptionOutcome(): Promise<BrowserSubscriptionOutcome> {
  if (!isPushSupported()) return { status: 'unsupported' };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return { status: 'ok', subscription };
  } catch (err) {
    return { status: 'error', error: sanitizeErrorMessage(err) };
  }
}

/**
 * Backward-compatible helper returning PushSubscription or null.
 */
export async function getBrowserSubscription(): Promise<PushSubscription | null> {
  const outcome = await getBrowserSubscriptionOutcome();
  return outcome.status === 'ok' ? outcome.subscription : null;
}

/**
 * Read locally cached device name.
 */
export function getLocalDeviceName(): string {
  try {
    return localStorage.getItem(PUSH_DEVICE_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Store locally cached device name (trimmed to max 200 Unicode code points).
 */
export function setLocalDeviceName(name: string): void {
  try {
    localStorage.setItem(PUSH_DEVICE_NAME_STORAGE_KEY, trimToUnicodeCodePoints(name, 200));
  } catch {
    // Ignored on storage failure
  }
}

export type SubscribeResult =
  | {
      ok: true;
      browserSubscription: PushSubscription;
      backendResponse: BackendSubscribeResponse;
    }
  | {
      ok: false;
      error: string;
      phase: 'unsupported' | 'permission_denied' | 'browser_subscribe_failed' | 'backend_failed' | 'storage_unavailable';
      browserSubscription?: PushSubscription | null;
      ambiguous?: boolean;
    };

/**
 * Enables Web Push subscription with 5-layer truth validation.
 *
 * Steps:
 * 1. Checks environment support.
 * 2. Requests Notification.requestPermission() (must be triggered by user gesture).
 * 3. Obtains or creates browser PushSubscription with VAPID_PUBLIC_KEY.
 * 4. Verifies stable UUID installation_id.
 * 5. Registers with backend via POST /api/push/subscribe/ and strictly validates 201 response.
 */
export async function subscribeToPush(deviceNameInput?: string): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    return {
      ok: false,
      error: '当前浏览器不支持 Web Push 推送通知',
      phase: 'unsupported',
    };
  }

  // Request permission (User gesture required)
  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch (err) {
      return {
        ok: false,
        error: '通知权限请求异常: ' + sanitizeErrorMessage(err),
        phase: 'permission_denied',
      };
    }
  }

  if (permission !== 'granted') {
    return {
      ok: false,
      error: permission === 'denied' ? '用户已拒绝通知权限' : '未授予通知权限',
      phase: 'permission_denied',
    };
  }

  // Obtain or create browser subscription
  let subscription: PushSubscription | null = null;
  try {
    const registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    }
  } catch (err) {
    return {
      ok: false,
      error: '浏览器推送凭据创建失败: ' + sanitizeErrorMessage(err),
      phase: 'browser_subscribe_failed',
    };
  }

  if (!subscription) {
    return {
      ok: false,
      error: '浏览器推送凭据为空',
      phase: 'browser_subscribe_failed',
    };
  }

  const installationId = getInstallationId();
  if (!installationId) {
    return {
      ok: false,
      error: '本地存储异常，无法持久化安装身份，拒绝登记',
      phase: 'storage_unavailable',
      browserSubscription: subscription,
      ambiguous: true,
    };
  }

  const subJson = subscription.toJSON();
  const endpoint = subscription.endpoint;
  const p256dh = subJson.keys?.p256dh;
  const auth = subJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return {
      ok: false,
      error: '浏览器推送凭证数据不完整',
      phase: 'browser_subscribe_failed',
      browserSubscription: subscription,
    };
  }

  const trimmedDeviceName = trimToUnicodeCodePoints(
    deviceNameInput !== undefined ? deviceNameInput : getLocalDeviceName(),
    200,
  );

  try {
    const res = (await apiFetch('/api/push/subscribe/', {
      method: 'POST',
      body: JSON.stringify({
        subscription: {
          endpoint,
          keys: { p256dh, auth },
        },
        device_name: trimmedDeviceName || undefined,
        installation_id: installationId,
      }),
    })) as unknown;

    if (!isValidBackendSubscribeResponse(res, endpoint, installationId)) {
      return {
        ok: false,
        error: '后端未确认持久化状态 (响应格式非法或端点/安装身份不匹配)',
        phase: 'backend_failed',
        browserSubscription: subscription,
        ambiguous: true,
      };
    }

    setLocalDeviceName(trimmedDeviceName);
    return {
      ok: true,
      browserSubscription: subscription,
      backendResponse: res,
    };
  } catch (err) {
    return {
      ok: false,
      error: '后端订阅保存失败: ' + sanitizeErrorMessage(err),
      phase: 'backend_failed',
      browserSubscription: subscription,
      ambiguous: true,
    };
  }
}

export type UnsubscribeResult =
  | {
      ok: true;
      phase: 'unsubscribed';
    }
  | {
      ok: false;
      error: string;
      phase: 'backend_failed' | 'browser_cleanup_failed';
      browserSubscription?: PushSubscription | null;
    };

/**
 * Disables Web Push notifications cleanly with backend-first teardown order.
 */
export async function unsubscribeFromPush(): Promise<UnsubscribeResult> {
  const outcome = await getBrowserSubscriptionOutcome();
  if (outcome.status === 'error') {
    return {
      ok: false,
      error: '无法读取当前浏览器推送状态: ' + outcome.error,
      phase: 'browser_cleanup_failed',
      browserSubscription: null,
    };
  }
  if (outcome.status === 'unsupported' || !outcome.subscription) {
    return { ok: true, phase: 'unsubscribed' };
  }

  const subscription = outcome.subscription;
  const endpoint = subscription.endpoint;

  // 1. Teardown backend first
  try {
    await apiFetch('/api/push/unsubscribe/', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    });
  } catch (err) {
    return {
      ok: false,
      error: '后端退订失败，浏览器订阅已保留: ' + sanitizeErrorMessage(err),
      phase: 'backend_failed',
      browserSubscription: subscription,
    };
  }

  // 2. Unsubscribe browser subscription
  try {
    const unsubOk = await subscription.unsubscribe();
    if (unsubOk === false) {
      return {
        ok: false,
        error: '后端已关闭，但浏览器本地订阅清理失败',
        phase: 'browser_cleanup_failed',
        browserSubscription: subscription,
      };
    }
    return { ok: true, phase: 'unsubscribed' };
  } catch (err) {
    return {
      ok: false,
      error: '后端已关闭，但浏览器本地订阅清理失败: ' + sanitizeErrorMessage(err),
      phase: 'browser_cleanup_failed',
      browserSubscription: subscription,
    };
  }
}

/**
 * Synchronizes an already-granted browser PushSubscription to the backend.
 * Reuses the current browser endpoint without rotating or creating a new subscription.
 */
export async function syncExistingSubscription(deviceNameInput?: string): Promise<SubscribeResult> {
  const outcome = await getBrowserSubscriptionOutcome();
  if (outcome.status === 'unsupported') {
    return {
      ok: false,
      error: '当前浏览器不支持 Web Push 推送通知',
      phase: 'unsupported',
    };
  }
  if (outcome.status === 'error' || !outcome.subscription) {
    return {
      ok: false,
      error: outcome.status === 'error' ? outcome.error : '未检测到浏览器推送凭据',
      phase: 'browser_subscribe_failed',
      browserSubscription: null,
    };
  }

  const subscription = outcome.subscription;
  const installationId = getInstallationId();
  if (!installationId) {
    return {
      ok: false,
      error: '本地存储异常，无法持久化安装身份',
      phase: 'storage_unavailable',
      browserSubscription: subscription,
      ambiguous: true,
    };
  }

  const subJson = subscription.toJSON();
  const endpoint = subscription.endpoint;
  const p256dh = subJson.keys?.p256dh;
  const auth = subJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return {
      ok: false,
      error: '浏览器推送凭证数据不完整',
      phase: 'browser_subscribe_failed',
      browserSubscription: subscription,
    };
  }

  const trimmedDeviceName = trimToUnicodeCodePoints(
    deviceNameInput !== undefined ? deviceNameInput : getLocalDeviceName(),
    200,
  );

  try {
    const res = (await apiFetch('/api/push/subscribe/', {
      method: 'POST',
      body: JSON.stringify({
        subscription: {
          endpoint,
          keys: { p256dh, auth },
        },
        device_name: trimmedDeviceName || undefined,
        installation_id: installationId,
      }),
    })) as unknown;

    if (!isValidBackendSubscribeResponse(res, endpoint, installationId)) {
      return {
        ok: false,
        error: '后端未确认持久化状态 (响应格式非法或端点/安装身份不匹配)',
        phase: 'backend_failed',
        browserSubscription: subscription,
        ambiguous: true,
      };
    }

    if (deviceNameInput !== undefined) {
      setLocalDeviceName(trimmedDeviceName);
    }

    return {
      ok: true,
      browserSubscription: subscription,
      backendResponse: res,
    };
  } catch (err) {
    return {
      ok: false,
      error: '后端同步失败: ' + sanitizeErrorMessage(err),
      phase: 'backend_failed',
      browserSubscription: subscription,
      ambiguous: true,
    };
  }
}

/**
 * Updates device name for current subscription without rotating or generating new endpoint.
 */
export async function updateDeviceName(deviceNameInput: string): Promise<SubscribeResult> {
  return syncExistingSubscription(deviceNameInput);
}

// ── Register ACK State Machine (Plan D7, D2-R1-04) ──────────────────────────

export type AckStatus = 'idle' | 'pending' | 'sent' | 'failed_retryable' | 'failed_terminal';

export interface AckRecord {
  key: string;
  register_id: number;
  preset_id: number;
  action: 'navigate' | 'dismiss';
  status: AckStatus;
  lastAttemptAt: number;
  error?: string;
  statusCode?: number;
}

export type AckStorageStatus = 'ok' | 'unavailable' | 'corrupted';

export interface AckStorageDiagnostics {
  status: AckStorageStatus;
  error?: string;
}

export const ACK_STORAGE_KEY = 'exo:v4:ack_registry';

const ackRegistry = new Map<string, AckRecord>();
const inFlightAcks = new Map<
  string,
  Promise<{ ok: boolean; status?: number; error?: string; terminal?: boolean }>
>();

let currentAckStorageStatus: AckStorageStatus = 'ok';
let currentAckStorageError: string | undefined = undefined;

export function getAckStorageDiagnostics(): AckStorageDiagnostics {
  return {
    status: currentAckStorageStatus,
    error: currentAckStorageError,
  };
}

function loadAckRegistry(): void {
  try {
    if (typeof localStorage === 'undefined') {
      currentAckStorageStatus = 'unavailable';
      currentAckStorageError = 'localStorage 不可用';
      return;
    }
    const raw = localStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) {
      currentAckStorageStatus = 'ok';
      currentAckStorageError = undefined;
      return;
    }
    let records: unknown;
    try {
      records = JSON.parse(raw);
    } catch (parseErr) {
      ackRegistry.clear();
      currentAckStorageStatus = 'corrupted';
      currentAckStorageError = 'ACK 注册表 JSON 损坏并隔离: ' + sanitizeErrorMessage(parseErr);
      return;
    }
    if (!Array.isArray(records)) {
      ackRegistry.clear();
      currentAckStorageStatus = 'corrupted';
      currentAckStorageError = 'ACK 注册表数据格式非法 (非数组)';
      return;
    }

    const validatedRecords: AckRecord[] = [];
    let hasCorruptedEntry = false;

    for (const r of records) {
      if (!isRecord(r)) {
        hasCorruptedEntry = true;
        break;
      }
      const { key, register_id, preset_id, action, status, lastAttemptAt, statusCode, error } = r;

      if (
        typeof register_id !== 'number' ||
        !Number.isInteger(register_id) ||
        register_id <= 0 ||
        typeof preset_id !== 'number' ||
        !Number.isInteger(preset_id) ||
        preset_id <= 0 ||
        (action !== 'navigate' && action !== 'dismiss') ||
        (status !== 'sent' && status !== 'failed_terminal' && status !== 'failed_retryable') ||
        typeof lastAttemptAt !== 'number' ||
        !Number.isFinite(lastAttemptAt)
      ) {
        hasCorruptedEntry = true;
        break;
      }

      const expectedKey = `${register_id}:${preset_id}:${action}`;
      if (typeof key !== 'string' || key !== expectedKey) {
        hasCorruptedEntry = true;
        break;
      }

      if ('statusCode' in r && statusCode !== undefined) {
        if (typeof statusCode !== 'number' || !Number.isInteger(statusCode) || !Number.isFinite(statusCode)) {
          hasCorruptedEntry = true;
          break;
        }
      }

      if ('error' in r && error !== undefined) {
        if (typeof error !== 'string') {
          hasCorruptedEntry = true;
          break;
        }
      }

      validatedRecords.push({
        key: expectedKey,
        register_id,
        preset_id,
        action,
        status,
        lastAttemptAt,
        statusCode: typeof statusCode === 'number' && Number.isInteger(statusCode) ? statusCode : undefined,
        error: typeof error === 'string' ? error : undefined,
      });
    }

    if (hasCorruptedEntry) {
      ackRegistry.clear();
      currentAckStorageStatus = 'corrupted';
      currentAckStorageError = 'ACK 注册表包含非法格式条目并已隔离';
    } else {
      ackRegistry.clear();
      for (const rec of validatedRecords) {
        ackRegistry.set(rec.key, rec);
      }
      currentAckStorageStatus = 'ok';
      currentAckStorageError = undefined;
    }
  } catch (err) {
    ackRegistry.clear();
    currentAckStorageStatus = 'unavailable';
    currentAckStorageError = 'ACK 注册表读取异常: ' + sanitizeErrorMessage(err);
  }
}

function persistAckRegistry(): void {
  try {
    if (typeof localStorage === 'undefined') {
      currentAckStorageStatus = 'unavailable';
      currentAckStorageError = 'localStorage 不可用';
      return;
    }
    if (currentAckStorageStatus === 'corrupted') {
      // Storage is quarantined as corrupted; do not overwrite corrupt state
      return;
    }
    const records = Array.from(ackRegistry.values()).filter(
      (r) => r.status === 'sent' || r.status === 'failed_terminal' || r.status === 'failed_retryable',
    );
    localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(records));
    currentAckStorageStatus = 'ok';
    currentAckStorageError = undefined;
  } catch (err) {
    currentAckStorageStatus = 'unavailable';
    currentAckStorageError = 'ACK 注册表持久化失败 (配额超限或存储禁用): ' + sanitizeErrorMessage(err);
  }
}

// Hydrate on module load
if (typeof window !== 'undefined') {
  loadAckRegistry();
}

export function getAckDiagnostics(): AckRecord[] {
  const records = Array.from(ackRegistry.values()).filter(
    (r) => r.status === 'failed_retryable' || r.status === 'failed_terminal',
  );
  if (currentAckStorageStatus !== 'ok' && currentAckStorageError) {
    records.push({
      key: `storage:${currentAckStorageStatus}`,
      register_id: 0,
      preset_id: 0,
      action: 'navigate',
      status: currentAckStorageStatus === 'corrupted' ? 'failed_terminal' : 'failed_retryable',
      lastAttemptAt: Date.now(),
      error: currentAckStorageError,
    });
  }
  return records;
}

export function clearAckRegistryForTest(): void {
  ackRegistry.clear();
  inFlightAcks.clear();
  currentAckStorageStatus = 'ok';
  currentAckStorageError = undefined;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACK_STORAGE_KEY);
    }
  } catch {
    // Ignored
  }
}

export function reloadAckRegistryForTest(): void {
  ackRegistry.clear();
  inFlightAcks.clear();
  loadAckRegistry();
}

export function isAckSent(
  registerAck: { register_id: number; preset_id: number } | null | undefined,
  action: 'navigate' | 'dismiss',
): boolean {
  if (!registerAck) return false;
  const key = `${registerAck.register_id}:${registerAck.preset_id}:${action}`;
  const existing = ackRegistry.get(key);
  return existing?.status === 'sent' || inFlightAcks.has(key);
}

export function recordAckOutcome(
  registerAck: unknown,
  action: unknown,
  outcome: unknown,
): void {
  if (
    !isValidRegisterAck(registerAck) ||
    (action !== 'navigate' && action !== 'dismiss') ||
    !isValidAckOutcome(outcome)
  ) {
    return;
  }
  const key = `${registerAck.register_id}:${registerAck.preset_id}:${action}`;
  const record: AckRecord = {
    key,
    register_id: registerAck.register_id,
    preset_id: registerAck.preset_id,
    action,
    status: outcome.status,
    lastAttemptAt: Date.now(),
    error: typeof outcome.error === 'string' ? outcome.error : undefined,
    statusCode:
      typeof outcome.statusCode === 'number' && Number.isInteger(outcome.statusCode)
        ? outcome.statusCode
        : undefined,
  };
  ackRegistry.set(key, record);
  persistAckRegistry();
}

/**
 * Sends Register ACK (navigate / dismiss) with coherent state machine truth.
 *
 * Guarantees:
 * - Only sent if register_ack is valid with positive integers.
 * - Idempotency: duplicate sends for identical event/action are suppressed once sent.
 * - In-flight joining: concurrent calls for identical event/action return the same pending promise.
 * - Terminal 400 / 404 errors stop auto-retries and never falsely report success.
 * - Non-blocking: failures do not throw or impede navigation or message displays.
 * - Obtains subscription_endpoint whenever obtainable.
 */
export async function sendRegisterAck(
  registerAck: unknown,
  action: 'navigate' | 'dismiss',
  endpoint?: string,
): Promise<{ ok: boolean; status?: number; error?: string; terminal?: boolean }> {
  if (!isValidRegisterAck(registerAck) || (action !== 'navigate' && action !== 'dismiss')) {
    return { ok: false, error: 'No valid register_ack provided' };
  }

  const key = `${registerAck.register_id}:${registerAck.preset_id}:${action}`;

  // 1. In-flight check: reuse pending request promise
  const inFlight = inFlightAcks.get(key);
  if (inFlight) {
    return inFlight;
  }

  // 2. Existing settled check
  const existing = ackRegistry.get(key);
  if (existing?.status === 'sent') {
    return { ok: true, status: 200 };
  }
  if (existing?.status === 'failed_terminal') {
    return { ok: false, status: existing.statusCode, error: existing.error, terminal: true };
  }

  const record: AckRecord = {
    key,
    register_id: registerAck.register_id,
    preset_id: registerAck.preset_id,
    action,
    status: 'pending',
    lastAttemptAt: Date.now(),
  };
  ackRegistry.set(key, record);

  const promise = (async () => {
    // Attempt to resolve subscription_endpoint if not provided
    let effectiveEndpoint = endpoint;
    if (!effectiveEndpoint && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const subOutcome = await getBrowserSubscriptionOutcome();
        if (subOutcome.status === 'ok' && subOutcome.subscription) {
          effectiveEndpoint = subOutcome.subscription.endpoint;
        }
      } catch {
        // Ignored
      }
    }

    try {
      const url = `/api/agents/registers/${registerAck.register_id}/ack/?preset_id=${registerAck.preset_id}`;
      const body: Record<string, string> = { action };
      if (effectiveEndpoint) {
        body.subscription_endpoint = effectiveEndpoint;
      }

      await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      record.status = 'sent';
      record.error = undefined;
      record.statusCode = 200;
      ackRegistry.set(key, record);
      persistAckRegistry();
      return { ok: true, status: 200 };
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
          ? (err as { status: number }).status
          : undefined;

      const errorMsg = sanitizeErrorMessage(err);
      if (status === 400 || status === 404) {
        record.status = 'failed_terminal';
        record.statusCode = status;
        record.error = errorMsg;
        ackRegistry.set(key, record);
        persistAckRegistry();
        return { ok: false, status, error: errorMsg, terminal: true };
      }

      record.status = 'failed_retryable';
      record.statusCode = status;
      record.error = errorMsg;
      ackRegistry.set(key, record);
      persistAckRegistry();
      return { ok: false, status, error: errorMsg, terminal: false };
    } finally {
      inFlightAcks.delete(key);
    }
  })();

  inFlightAcks.set(key, promise);
  return promise;
}

/**
 * Retries all pending retryable ACKs (called on reconnect or explicit user retry).
 */
export async function retryPendingAcks(): Promise<number> {
  let count = 0;
  for (const record of ackRegistry.values()) {
    if (record.status === 'failed_retryable') {
      count++;
      await sendRegisterAck(
        { register_id: record.register_id, preset_id: record.preset_id },
        record.action,
      );
    }
  }
  return count;
}
