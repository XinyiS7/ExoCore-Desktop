import React, { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCircle2, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import { useNotifications } from './notificationContext';
import {
  isPushSupported,
  getNotificationPermission,
  getBrowserSubscriptionOutcome,
  getLocalDeviceName,
  setLocalDeviceName,
  subscribeToPush,
  unsubscribeFromPush,
  updateDeviceName,
  syncExistingSubscription,
} from './subscription';

export function NotificationsPanel(): React.ReactElement {
  const { repairNeeded, setRepairNeeded } = useNotifications();

  const [supported] = useState<boolean>(() => isPushSupported());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission(),
  );
  const [browserSub, setBrowserSub] = useState<PushSubscription | null>(null);
  const [browserSubError, setBrowserSubError] = useState<string | null>(null);
  const [backendState, setBackendState] = useState<'none' | 'checking' | 'persisted' | 'failed'>('none');
  const [deviceName, setDeviceName] = useState<string>(() => getLocalDeviceName());
  const [busy, setBusy] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  // Refresh status on mount and focus WITHOUT requesting permission
  const refreshStatus = useCallback(async () => {
    if (!isPushSupported()) {
      setPermission('unsupported');
      return;
    }
    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    const outcome = await getBrowserSubscriptionOutcome();

    if (outcome.status === 'unsupported') {
      setPermission('unsupported');
      setBrowserSub(null);
      setBrowserSubError(null);
      setBackendState('none');
      return;
    }

    if (outcome.status === 'error') {
      setBrowserSub(null);
      setBrowserSubError(outcome.error);
      setBackendState('failed');
      return;
    }

    // outcome.status === 'ok'
    const sub = outcome.subscription;
    setBrowserSub(sub);
    setBrowserSubError(null);

    if (!sub) {
      setBackendState('none');
    } else if (currentPerm === 'granted') {
      // Browser subscription exists and permission is granted: verify with backend
      setBackendState('checking');
      const syncRes = await syncExistingSubscription();
      if (syncRes.ok) {
        setBackendState('persisted');
        setRepairNeeded(false);
      } else {
        setBackendState('failed');
      }
    } else {
      setBackendState('none');
    }
  }, [setRepairNeeded]);

  useEffect(() => {
    void refreshStatus();

    const onFocus = () => {
      void refreshStatus();
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshStatus]);

  const isFullyHealthy =
    supported &&
    permission === 'granted' &&
    browserSub !== null &&
    backendState === 'persisted' &&
    !repairNeeded;

  const isBrowserOnly =
    supported &&
    browserSub !== null &&
    backendState !== 'persisted';

  const handleEnable = async () => {
    setBusy(true);
    setStatusMessage(null);

    const result = await subscribeToPush(deviceName);
    setBusy(false);

    if (result.ok) {
      setBrowserSub(result.browserSubscription);
      setBrowserSubError(null);
      setPermission('granted');
      setBackendState('persisted');
      setRepairNeeded(false);
      setStatusMessage({ type: 'success', text: '推送通知已成功启用并已在后端持久化。' });
    } else {
      setPermission(getNotificationPermission());
      if (result.browserSubscription) {
        setBrowserSub(result.browserSubscription);
        setBrowserSubError(null);
        setBackendState('failed');
      }
      setStatusMessage({ type: 'error', text: result.error });
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setStatusMessage(null);

    const result = await unsubscribeFromPush();
    setBusy(false);

    if (result.ok) {
      setBrowserSub(null);
      setBrowserSubError(null);
      setBackendState('none');
      setRepairNeeded(false);
      setStatusMessage({ type: 'success', text: '已成功停用推送通知。' });
    } else {
      if (result.phase === 'backend_failed') {
        setBackendState('failed');
      } else if (result.phase === 'browser_cleanup_failed') {
        setBackendState('none');
      }
      setStatusMessage({ type: 'error', text: result.error });
    }
  };

  const handleSaveDeviceName = async () => {
    const trimmed = deviceName.trim();
    if (Array.from(trimmed).length > 200) {
      setStatusMessage({ type: 'error', text: '设备名称长度不能超过 200 个字符' });
      return;
    }

    setLocalDeviceName(trimmed);
    if (browserSub) {
      setBusy(true);
      setStatusMessage(null);
      const result = await updateDeviceName(trimmed);
      setBusy(false);

      if (result.ok) {
        setBackendState('persisted');
        setStatusMessage({ type: 'success', text: '设备名称已保存并更新至后端。' });
      } else {
        setBackendState('failed');
        setStatusMessage({ type: 'error', text: result.error });
      }
    } else {
      setStatusMessage({ type: 'success', text: '设备名称已保存到本地。' });
    }
  };

  const handleRetrySync = async () => {
    setBusy(true);
    setStatusMessage(null);
    const result = await subscribeToPush(deviceName);
    setBusy(false);

    if (result.ok) {
      setBrowserSub(result.browserSubscription);
      setBrowserSubError(null);
      setBackendState('persisted');
      setRepairNeeded(false);
      setStatusMessage({ type: 'success', text: '已重新同步并确认后端持久化。' });
    } else {
      setBackendState('failed');
      setStatusMessage({ type: 'error', text: result.error });
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h2 className="settings-panel-title">通知设置</h2>
        <p className="settings-panel-desc">管理 Web Push 推送通知权限、设备名称与投递状态。</p>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`settings-card ${statusMessage.type === 'error' ? 'notif-alert--error' : 'notif-alert--success'}`}
          style={{
            borderLeft: `4px solid ${statusMessage.type === 'error' ? 'var(--v4-danger, #ef4444)' : 'var(--v4-success, #22c55e)'}`,
            marginBottom: '16px',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {statusMessage.type === 'error' ? (
              <AlertTriangle size={18} color="var(--v4-danger, #ef4444)" />
            ) : (
              <CheckCircle2 size={18} color="var(--v4-success, #22c55e)" />
            )}
            <span style={{ fontSize: '13px' }}>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* ── 状态总览与五层事实 ── */}
      <div className="settings-card" style={{ marginBottom: '16px', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} />
          <span>推送服务状态</span>
          {isFullyHealthy ? (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--v4-success, #22c55e)', fontWeight: 600 }}>
              ● 已启用
            </span>
          ) : isBrowserOnly ? (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--v4-warn, #f59e0b)', fontWeight: 600 }}>
              ▲ 未完全确认 (后端未就绪)
            </span>
          ) : permission === 'denied' ? (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--v4-danger, #ef4444)', fontWeight: 600 }}>
              ✕ 已拒绝
            </span>
          ) : (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--v4-text-mute, #888888)', fontWeight: 500 }}>
              ○ 未启用
            </span>
          )}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--v4-line, #333333)' }}>
            <span style={{ color: 'var(--v4-text-mute, #888888)' }}>浏览器支持</span>
            <span>{supported ? '支持 Web Push' : '当前浏览器不支持'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--v4-line, #333333)' }}>
            <span style={{ color: 'var(--v4-text-mute, #888888)' }}>通知权限</span>
            <span>
              {permission === 'granted'
                ? '已授权 (granted)'
                : permission === 'denied'
                ? '已拒绝 (denied)'
                : permission === 'unsupported'
                ? '不支持'
                : '默认 (未询问)'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--v4-line, #333333)' }}>
            <span style={{ color: 'var(--v4-text-mute, #888888)' }}>浏览器订阅凭证</span>
            <span>
              {browserSubError
                ? `无法读取凭据 (${browserSubError})`
                : browserSub
                ? '已存在 (浏览器已就绪)'
                : '未创建'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--v4-line, #333333)' }}>
            <span style={{ color: 'var(--v4-text-mute, #888888)' }}>后端持久化确认</span>
            <span>
              {backendState === 'persisted'
                ? '已持久化 (persisted: true)'
                : backendState === 'failed'
                ? '登记失败 / 未确认'
                : backendState === 'checking'
                ? '正在核验...'
                : '未登记'}
            </span>
          </div>

          {repairNeeded && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--v4-warn, #f59e0b)' }}>
              <span>订阅修复状态</span>
              <span>凭证轮换需要重新同步至后端</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 设备名称设置 ── */}
      <div className="settings-card" style={{ marginBottom: '16px', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Smartphone size={18} />
          <span>设备名称</span>
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)', marginBottom: '12px' }}>
          为当前设备设置可辨识的显示名称（最多 200 个字符），仅作通知标签展示，不作为设备身份认证凭据。
        </p>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            id="device-name"
            aria-label="设备名称"
            type="text"
            className="settings-input"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--v4-line, #333333)',
              background: 'var(--v4-panel-2, #2a2a2a)',
              color: 'var(--v4-text, #f0f0f0)',
              fontSize: '13px',
            }}
            placeholder="例如: Work Laptop / Alicia's Phone"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          <button
            type="button"
            className="settings-btn"
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid var(--v4-line, #333333)',
              background: 'var(--v4-panel-2, #2a2a2a)',
              color: 'var(--v4-text, #f0f0f0)',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={handleSaveDeviceName}
            disabled={busy}
          >
            保存设备名
          </button>
        </div>
      </div>

      {/* ── 控制操作 ── */}
      <div className="settings-card" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {!browserSub ? (
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            style={{
              padding: '8px 18px',
              borderRadius: '4px',
              background: 'var(--v4-accent, #4f8cff)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: busy || !supported ? 'not-allowed' : 'pointer',
              opacity: busy || !supported ? 0.6 : 1,
            }}
            onClick={handleEnable}
            disabled={busy || !supported}
          >
            {busy ? '正在处理...' : '启用推送通知'}
          </button>
        ) : (
          <button
            type="button"
            className="settings-btn"
            style={{
              padding: '8px 18px',
              borderRadius: '4px',
              border: '1px solid var(--v4-danger, #ef4444)',
              background: 'transparent',
              color: 'var(--v4-danger, #ef4444)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            onClick={handleDisable}
            disabled={busy}
          >
            {busy ? '正在停用...' : '关闭推送通知'}
          </button>
        )}

        {(isBrowserOnly || repairNeeded) && (
          <button
            type="button"
            className="settings-btn"
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid var(--v4-warn, #f59e0b)',
              background: 'var(--v4-panel-2, #2a2a2a)',
              color: 'var(--v4-warn, #f59e0b)',
              fontSize: '13px',
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={handleRetrySync}
            disabled={busy}
          >
            <RefreshCw size={14} />
            <span>重新同步到后端</span>
          </button>
        )}
      </div>
    </div>
  );
}
