import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from 'exo-shared/api';
import {
  Bell,
  AlertTriangle,
  Trash2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import { useNotifications } from './notificationContext';
import { AssistantMessageArrivedV1 } from './contract';
import {
  ingestArrivals,
  NOTIFICATIONS_STORAGE_KEY,
} from './storage';
import {
  getNotificationPermission,
} from './subscription';

interface ConversationOption {
  id: number;
  title: string | null;
}

export function NotificationDemoPage(): React.ReactElement {
  const navigate = useNavigate();
  const {
    unreadCount,
    unreadByConversation,
    activeIndication,
    dismissIndication,
    syncError,
  } = useNotifications();

  // Storage inspection state
  const [rawNotificationStorage, setRawNotificationStorage] = useState<string>('');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission(),
  );

  // Real conversations from backend
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [targetConversationId, setTargetConversationId] = useState<number>(1);

  // Persistent banner simulation state
  const [mockBannerActive, setMockBannerActive] = useState<boolean>(false);
  const mockBannerText = '本地缓存已损坏并隔离';

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogMessages((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

  const refreshStorageView = useCallback(() => {
    try {
      const notifRaw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '（空）';
      setRawNotificationStorage(notifRaw);
    } catch (e) {
      setRawNotificationStorage(`读取失败: ${String(e)}`);
    }
  }, []);

  // Fetch real conversations from local backend
  useEffect(() => {
    refreshStorageView();
    setPermission(getNotificationPermission());

    void (async () => {
      try {
        const raw = await apiFetch('/api/agents/conversations/');
        if (Array.isArray(raw) && raw.length > 0) {
          const list: ConversationOption[] = raw.map((c: { id: number; title?: string | null }) => ({
            id: c.id,
            title: c.title ?? null,
          }));
          setConversations(list);
          setTargetConversationId(list[0].id);
          addLog(`已成功加载 ${list.length} 个本地真实会话，默认定位至会话 #${list[0].id}`);
        }
      } catch {
        addLog('未检测到后端已有会话，采用默认会话 ID: 1');
      }
    })();
  }, [refreshStorageView, addLog]);

  // Request browser notification permission
  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      addLog('当前浏览器环境不支持原生 Notification API');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      addLog(`通知权限请求完成，当前状态为: ${result}`);
    } catch (err) {
      addLog(`申请权限异常: ${String(err)}`);
    }
  };

  // Dispatch simulated arrival event via ServiceWorker message channel (in-screen bubble)
  const dispatchArrival = (event: AssistantMessageArrivedV1) => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'ASSISTANT_ARRIVAL_HANDOFF',
              version: 1,
              event,
            },
          }),
        );
      } else {
        ingestArrivals([event], 'push');
      }

      window.dispatchEvent(new StorageEvent('storage', { key: NOTIFICATIONS_STORAGE_KEY }));
      refreshStorageView();
      addLog(`已派发应用内气泡: ${event.agent.name} (目标会话 #${event.conversation_id}): "${event.preview.text}"`);
    } catch (err) {
      addLog(`派发失败: ${String(err)}`);
    }
  };

  // Trigger real native browser notification matching V3 format: "From: {senderName}"
  const showNativeNotification = (senderName: string, bodyText: string, conversationId: number) => {
    if (!('Notification' in window)) {
      addLog('当前浏览器环境不支持原生 Notification API');
      return;
    }
    if (Notification.permission === 'granted') {
      try {
        const title = `From: ${senderName}`;
        const notif = new Notification(title, {
          body: bodyText,
          icon: '/favicon.ico',
          tag: `exocore-chat-${conversationId}-${Date.now()}`,
        });
        notif.onclick = () => {
          window.focus();
          navigate(`/chat/${conversationId}`);
        };
        addLog(`已唤起桌面通知 [${title}]: "${bodyText}"`);
      } catch (err) {
        addLog(`唤起原生通知失败: ${String(err)}`);
      }
    } else {
      addLog(`桌面通知未授权 (状态: ${Notification.permission})，请先点击「申请通知权限」按钮授权`);
    }
  };

  // Simulate notification click / cold or warm navigate to target conversation
  const simulateNotificationNavigate = (conversationId: number) => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'NOTIFICATION_NAVIGATE',
              version: 1,
              target: {
                kind: 'conversation_message',
                conversation_id: conversationId,
                message_id: 999,
              },
            },
          }),
        );
        addLog(`已触发通知点击导航: 唤醒会话 #${conversationId}（无 Register ACK）`);
      } else {
        navigate(`/chat/${conversationId}`);
      }
      refreshStorageView();
    } catch (err) {
      addLog(`导航模拟失败: ${String(err)}`);
    }
  };

  // Preset 1: Alessandro / Sandro
  const handleSandroFull = () => {
    const msgId = (Date.now() % 100000) + 1000;
    const bodyText = '西娅，今晚风有些凉，不要在露台站太久。把那件羊绒披肩带上。';
    const ev: AssistantMessageArrivedV1 = {
      kind: 'assistant-message-arrived',
      version: 1,
      event_id: Date.now(),
      target: {
        kind: 'conversation_message',
        conversation_id: targetConversationId,
        message_id: msgId,
      },
      agent: {
        id: 1,
        name: 'Alessandro',
      },
      conversation_id: targetConversationId,
      message_id: msgId,
      preview: {
        policy: 'bounded_text',
        text: bodyText,
        truncated: false,
      },
      title_hint: `会话 #${targetConversationId}`,
      committed_at: new Date().toISOString(),
      dedupe_key: `sandro_${Date.now()}`,
      ignore: { allowed: true },
      register_ack: null,
    };
    dispatchArrival(ev);
    showNativeNotification('Alessandro', bodyText, targetConversationId);
  };

  // Preset 2: Alaric
  const handleAlaricFull = () => {
    const msgId = (Date.now() % 100000) + 2000;
    const bodyText = 'CP D-1 与 D-2 的 1055 项全量门限已全绿通过。各项指标均处于可信收敛区间，请过目。';
    const ev: AssistantMessageArrivedV1 = {
      kind: 'assistant-message-arrived',
      version: 1,
      event_id: Date.now(),
      target: {
        kind: 'conversation_message',
        conversation_id: targetConversationId,
        message_id: msgId,
      },
      agent: {
        id: 2,
        name: 'Alaric',
      },
      conversation_id: targetConversationId,
      message_id: msgId,
      preview: {
        policy: 'bounded_text',
        text: bodyText,
        truncated: false,
      },
      title_hint: `会话 #${targetConversationId}`,
      committed_at: new Date().toISOString(),
      dedupe_key: `alaric_${Date.now()}`,
      ignore: { allowed: true },
      register_ack: null,
    };
    dispatchArrival(ev);
    showNativeNotification('Alaric', bodyText, targetConversationId);
  };

  // Reset Storage
  const handleClearStorage = () => {
    try {
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: NOTIFICATIONS_STORAGE_KEY }));
      refreshStorageView();
      addLog('已清空本地通知测试数据');
    } catch (err) {
      addLog(`清理失败: ${String(err)}`);
    }
  };

  return (
    <div
      className="settings-panel"
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '24px 16px',
        height: '100%',
        overflowY: 'auto',
        flex: 1,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* ── 常驻错误横幅演练 (Mock Persistent Banner) ── */}
      {mockBannerActive && (
        <div className="shell-sync-banner" role="status" aria-live="polite">
          <div className="shell-sync-banner__message">
            <span>消息同步暂不可用: {mockBannerText}</span>
          </div>
          <button
            type="button"
            className="shell-sync-banner__retry"
            aria-label="重试同步"
            onClick={() => {
              setMockBannerActive(false);
              addLog('已模拟重试同步，常驻横幅已消除');
            }}
          >
            重试 (关闭)
          </button>
        </div>
      )}

      {/* Header */}
      <div className="settings-panel-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="settings-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={22} color="var(--v4-accent, #4f8cff)" />
              <span>消息通知交互演练室 (Demo & Lab)</span>
            </h2>
            <p className="settings-panel-desc" style={{ marginTop: '4px' }}>
              在此页面可交互式体验 ExoCore V4 Assistant 消息到达、桌面通知、气泡弹窗与未读红点全链路。
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              to="/settings/notifications"
              className="settings-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                textDecoration: 'none',
                color: 'var(--v4-text, #f0f0f0)',
                background: 'var(--v4-panel-2, #2a2a2a)',
                border: '1px solid var(--v4-line, #333333)',
                borderRadius: '4px',
              }}
            >
              <ShieldCheck size={14} />
              <span>通知设置中心</span>
            </Link>
            <Link
              to="/"
              className="settings-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                textDecoration: 'none',
                color: 'var(--v4-text, #f0f0f0)',
                background: 'var(--v4-panel-2, #2a2a2a)',
                border: '1px solid var(--v4-line, #333333)',
                borderRadius: '4px',
              }}
            >
              <MessageSquare size={14} />
              <span>返回聊天首页</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 格式与环境核心说明卡片 ── */}
      <div
        className="settings-card"
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          background: 'rgba(79, 140, 255, 0.08)',
          border: '1px solid rgba(79, 140, 255, 0.25)',
          borderRadius: '6px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <Info size={18} color="var(--v4-accent, #4f8cff)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--v4-text, #f0f0f0)' }}>
          <div><strong>💡 系统通知样式与双端行为说明：</strong></div>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li>
              <strong>发件人排版（已对齐 V3 规范）</strong>：桌面通知标题固定为 <code>From: Alessandro</code> 与 <code>From: Alaric</code>。
            </li>
            <li>
              <strong>Windows 桌面弹窗来源标识（Google Chrome vs ExoCore）</strong>：普通浏览器标签页发出的通知由 Windows 统一标注为其宿主程序（<code>Google Chrome</code>）；当点击浏览器地址栏右侧的「安装 ExoCore」图标以 <strong>PWA 独立窗口</strong>运行后，系统将自动识别并标记为 <code>ExoCore</code> 独立应用。
            </li>
            <li>
              <strong>前台免打扰 vs 后台桌面通知</strong>：当浏览器窗口在前台激活时，Service Worker 规范会抑制系统的重复弹窗，仅在网页右下角升起悬浮气泡；当窗口切至后台或最小化时，才会弹出系统的 OS 原生桌面通知。
            </li>
            <li>
              <strong>显式「忽略」affordance</strong>：仅当到达事件携带 <code>ignore.allowed === true</code>（send_message）时，OS 通知（支持 action 的平台）与应用内气泡才会显示「忽略」按钮。点击后调用 <code>POST /api/push/assistant-arrivals/&lt;event_id&gt;/ignore/</code>，关闭提示但不导航、不清未读；失败时气泡保留并可直接重试。关闭通知（X/滑除）与点击查看均不会创建任何 Register。
            </li>
          </ul>
        </div>
      </div>

      {/* ── 状态指示仪表盘 ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="settings-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)' }}>全应用未读总数</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--v4-accent, #4f8cff)', marginTop: '4px' }}>
            {unreadCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--v4-text-mute, #888888)', marginTop: '2px' }}>
            会话分布: {Object.keys(unreadByConversation).length > 0
              ? Object.entries(unreadByConversation)
                  .map(([cid, cnt]) => `#${cid}: ${cnt}`)
                  .join(' | ')
              : '无未读'}
          </div>
        </div>

        <div className="settings-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)' }}>系统通知权限</div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 600,
              marginTop: '6px',
              color:
                permission === 'granted'
                  ? 'var(--v4-success, #22c55e)'
                  : permission === 'denied'
                  ? 'var(--v4-danger, #ef4444)'
                  : 'var(--v4-warn, #f59e0b)',
            }}
          >
            {permission === 'granted'
              ? '● 已授权 (granted)'
              : permission === 'denied'
              ? '✕ 已拒绝 (denied)'
              : '○ 默认未授权 (default)'}
          </div>
          <div style={{ marginTop: '6px' }}>
            {permission !== 'granted' && (
              <button
                type="button"
                className="settings-btn"
                onClick={handleRequestPermission}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'var(--v4-accent, #4f8cff)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                点此向浏览器申请授权
              </button>
            )}
          </div>
        </div>

        <div className="settings-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)' }}>同步与错误横幅</div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginTop: '8px',
              color: syncError || mockBannerActive ? 'var(--v4-danger, #ef4444)' : 'var(--v4-success, #22c55e)',
            }}
          >
            {syncError || mockBannerActive ? `▲ ${syncError || mockBannerText}` : '✓ 运行正常'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--v4-text-mute, #888888)', marginTop: '4px' }}>
            {syncError || mockBannerActive ? '顶部已展示非阻塞提示' : '本地存储与游标同步中'}
          </div>
        </div>

        <div className="settings-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)' }}>当前气泡弹窗</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '8px' }}>
            {activeIndication ? (
              <span style={{ color: 'var(--v4-accent, #4f8cff)' }}>来自 {activeIndication.agent.name}</span>
            ) : (
              <span style={{ color: 'var(--v4-text-mute, #888888)' }}>（无悬浮通知）</span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--v4-text-mute, #888888)', marginTop: '4px' }}>
            {activeIndication ? (
              <button
                type="button"
                onClick={dismissIndication}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--v4-text-mute, #888888)',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  fontSize: '11px',
                }}
              >
                点击手动关闭
              </button>
            ) : (
              '触发到达后将在右下角悬浮展示'
            )}
          </div>
        </div>
      </div>

      {/* ── 演练目标会话配置区 ── */}
      <div className="settings-card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>🎯 模拟目标会话设置：</span>
            <span style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)', marginLeft: '6px' }}>
              （已自动匹配数据库现有真实会话，避免跳转出现「会话不存在」）
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {conversations.length > 0 ? (
              <select
                aria-label="选择真实会话"
                className="settings-input"
                value={targetConversationId}
                onChange={(e) => setTargetConversationId(Number(e.target.value))}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: 'var(--v4-panel-2, #2a2a2a)',
                  color: 'var(--v4-text, #f0f0f0)',
                  border: '1px solid var(--v4-line, #333333)',
                  fontSize: '12px',
                }}
              >
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    会话 #{c.id} {c.title ? `(${c.title})` : ''}
                  </option>
                ))}
              </select>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <span>自定义编号:</span>
              <input
                aria-label="自定义会话编号"
                type="number"
                min={1}
                value={targetConversationId}
                onChange={(e) => setTargetConversationId(Math.max(1, Number(e.target.value)))}
                style={{
                  width: '70px',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  background: 'var(--v4-panel-2, #2a2a2a)',
                  color: 'var(--v4-text, #f0f0f0)',
                  border: '1px solid var(--v4-line, #333333)',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 核心演练场景区 ── */}
      <div className="settings-card" style={{ padding: '18px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="var(--v4-accent, #4f8cff)" />
          <span>核心到达场景模拟</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {/* Sandro */}
          <div
            style={{
              padding: '14px',
              borderRadius: '6px',
              background: 'var(--v4-panel-2, #2a2a2a)',
              border: '1px solid var(--v4-line, #333333)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#ff7b72' }}>
                  👑 Alessandro (桑德罗)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--v4-text-mute, #888888)' }}>目标会话 #{targetConversationId}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--v4-accent, #4f8cff)', marginTop: '4px' }}>
                标题格式: <code>From: Alessandro</code>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--v4-text, #f0f0f0)', margin: '10px 0', lineHeight: 1.5 }}>
                “西娅，今晚风有些凉，不要在露台站太久。把那件羊绒披肩带上。”
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <button
                type="button"
                className="settings-btn"
                onClick={handleSandroFull}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  background: 'var(--v4-accent, #4f8cff)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Zap size={13} />
                <span>一键触发：桌面弹窗 + 应用内气泡</span>
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="settings-btn"
                  onClick={() =>
                    showNativeNotification(
                      'Alessandro',
                      '西娅，今晚风有些凉，不要在露台站太久。把那件羊绒披肩带上。',
                      targetConversationId,
                    )
                  }
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '11px',
                    background: 'var(--v4-panel, #1e1e1e)',
                    color: 'var(--v4-text, #f0f0f0)',
                    border: '1px solid var(--v4-line, #333333)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  仅桌面弹窗
                </button>
                <button
                  type="button"
                  className="settings-btn"
                  onClick={() => {
                    const msgId = (Date.now() % 100000) + 1000;
                    dispatchArrival({
                      kind: 'assistant-message-arrived',
                      version: 1,
                      event_id: Date.now(),
                      target: {
                        kind: 'conversation_message',
                        conversation_id: targetConversationId,
                        message_id: msgId,
                      },
                      agent: { id: 1, name: 'Alessandro' },
                      conversation_id: targetConversationId,
                      message_id: msgId,
                      preview: {
                        policy: 'bounded_text',
                        text: '西娅，今晚风有些凉，不要在露台站太久。把那件羊绒披肩带上。',
                        truncated: false,
                      },
                      title_hint: `会话 #${targetConversationId}`,
                      committed_at: new Date().toISOString(),
                      dedupe_key: `sandro_${Date.now()}`,
                      ignore: { allowed: true },
                      register_ack: null,
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '11px',
                    background: 'var(--v4-panel, #1e1e1e)',
                    color: 'var(--v4-text, #f0f0f0)',
                    border: '1px solid var(--v4-line, #333333)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  仅应用内气泡
                </button>
              </div>
            </div>
          </div>

          {/* Alaric */}
          <div
            style={{
              padding: '14px',
              borderRadius: '6px',
              background: 'var(--v4-panel-2, #2a2a2a)',
              border: '1px solid var(--v4-line, #333333)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#79c0ff' }}>
                  🛡️ Alaric (阿莱里克)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--v4-text-mute, #888888)' }}>目标会话 #{targetConversationId}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--v4-accent, #4f8cff)', marginTop: '4px' }}>
                标题格式: <code>From: Alaric</code>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--v4-text, #f0f0f0)', margin: '10px 0', lineHeight: 1.5 }}>
                “CP D-1 与 D-2 的 1055 项全量门限已全绿通过。各项指标均处于可信收敛区间，请过目。”
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <button
                type="button"
                className="settings-btn"
                onClick={handleAlaricFull}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  background: 'var(--v4-accent, #4f8cff)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Zap size={13} />
                <span>一键触发：桌面弹窗 + 应用内气泡</span>
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="settings-btn"
                  onClick={() =>
                    showNativeNotification(
                      'Alaric',
                      'CP D-1 与 D-2 的 1055 项全量门限已全绿通过。各项指标均处于可信收敛区间，请过目。',
                      targetConversationId,
                    )
                  }
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '11px',
                    background: 'var(--v4-panel, #1e1e1e)',
                    color: 'var(--v4-text, #f0f0f0)',
                    border: '1px solid var(--v4-line, #333333)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  仅桌面弹窗
                </button>
                <button
                  type="button"
                  className="settings-btn"
                  onClick={() => {
                    const msgId = (Date.now() % 100000) + 2000;
                    dispatchArrival({
                      kind: 'assistant-message-arrived',
                      version: 1,
                      event_id: Date.now(),
                      target: {
                        kind: 'conversation_message',
                        conversation_id: targetConversationId,
                        message_id: msgId,
                      },
                      agent: { id: 2, name: 'Alaric' },
                      conversation_id: targetConversationId,
                      message_id: msgId,
                      preview: {
                        policy: 'bounded_text',
                        text: 'CP D-1 与 D-2 的 1055 项全量门限已全绿通过。各项指标均处于可信收敛区间，请过目。',
                        truncated: false,
                      },
                      title_hint: `会话 #${targetConversationId}`,
                      committed_at: new Date().toISOString(),
                      dedupe_key: `alaric_${Date.now()}`,
                      ignore: { allowed: true },
                      register_ack: null,
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '11px',
                    background: 'var(--v4-panel, #1e1e1e)',
                    color: 'var(--v4-text, #f0f0f0)',
                    border: '1px solid var(--v4-line, #333333)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  仅应用内气泡
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 辅助演练动作 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
          <button
            type="button"
            className="settings-btn"
            onClick={() => simulateNotificationNavigate(targetConversationId)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              background: 'var(--v4-panel-2, #2a2a2a)',
              color: 'var(--v4-text, #f0f0f0)',
              border: '1px solid var(--v4-line, #333333)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ExternalLink size={13} />
            <span>模拟点击通知唤醒会话 #{targetConversationId} (进入真实会话)</span>
          </button>

          <button
            type="button"
            className="settings-btn"
            onClick={() => {
              setMockBannerActive((v) => !v);
              addLog(!mockBannerActive ? '已开启常驻同步异常横幅 (可稳定观察右上角)' : '已关闭常驻异常横幅');
            }}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              background: 'var(--v4-panel-2, #2a2a2a)',
              color: 'var(--v4-warn, #f59e0b)',
              border: '1px solid var(--v4-warn, #f59e0b)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={13} />
            <span>{mockBannerActive ? '关闭常驻同步横幅' : '模拟常驻同步异常横幅 (稳定展示)'}</span>
          </button>

          <button
            type="button"
            className="settings-btn"
            onClick={handleClearStorage}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              background: 'var(--v4-panel-2, #2a2a2a)',
              color: 'var(--v4-danger, #ef4444)',
              border: '1px solid var(--v4-danger, #ef4444)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: 'auto',
            }}
          >
            <Trash2 size={13} />
            <span>清空测试通知缓存</span>
          </button>
        </div>
      </div>

      {/* ── 存储实时巡检面板 ── */}
      <div className="settings-card" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} />
            <span>底层存储实时巡检</span>
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={refreshStorageView}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--v4-accent, #4f8cff)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RefreshCw size={12} />
              <span>刷新数据</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
          {/* Notifications raw storage */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)', marginBottom: '4px' }}>
              未读与游标存储 (<code>{NOTIFICATIONS_STORAGE_KEY}</code>)
            </div>
            <pre
              style={{
                fontSize: '11px',
                padding: '10px',
                borderRadius: '4px',
                background: 'var(--v4-panel-2, #2a2a2a)',
                border: '1px solid var(--v4-line, #333333)',
                color: 'var(--v4-text, #f0f0f0)',
                maxHeight: '160px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {rawNotificationStorage}
            </pre>
          </div>
        </div>

        {/* Action Logs */}
        {logMessages.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '12px', color: 'var(--v4-text-mute, #888888)', marginBottom: '4px' }}>
              演练操作实时记录
            </div>
            <div
              style={{
                fontSize: '11px',
                padding: '8px 10px',
                borderRadius: '4px',
                background: 'var(--v4-panel-2, #2a2a2a)',
                border: '1px solid var(--v4-line, #333333)',
                color: 'var(--v4-text-mute, #888888)',
                maxHeight: '100px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {logMessages.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
