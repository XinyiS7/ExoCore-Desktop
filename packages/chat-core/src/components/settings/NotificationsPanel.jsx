import React, { useState } from 'react';
import { Bell, BellOff, Loader2, CheckCircle2, XCircle, AlertTriangle, Monitor } from 'lucide-react';
import { pushApi } from 'exo-shared';

const { usePushSubscription } = pushApi;

export default function NotificationsPanel() {
  const { isSubscribed, isLoading, permission, deviceName, subscribe, unsubscribe } = usePushSubscription();
  const [localName, setLocalName] = useState(deviceName);

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold tx-system-normal opacity-90">Push Notifications</h2>
          <p className="text-sm tx-system-mute opacity-60">
            接收来自 ExoCore 的实时推送通知
          </p>
        </div>

        {/* Status card */}
        <div className="bg-chat-panel border border-white/5 rounded-xl p-6 space-y-4">
          {/* Permission status */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tracking-wider tx-system-mute opacity-50 w-20">
              权限
            </span>
            {permission === 'granted' ? (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <CheckCircle2 size={14} />
                已授权
              </span>
            ) : permission === 'denied' ? (
              <span className="flex items-center gap-1.5 text-sm text-red-400">
                <XCircle size={14} />
                已拒绝 — 请在浏览器设置中修改
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-amber-400">
                <AlertTriangle size={14} />
                待授权
              </span>
            )}
          </div>

          {/* Subscription status */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tracking-wider tx-system-mute opacity-50 w-20">
              订阅
            </span>
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-sm tx-system-mute opacity-60">
                <Loader2 size={14} className="animate-spin" />
                检查中...
              </span>
            ) : isSubscribed ? (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <CheckCircle2 size={14} />
                已订阅 — 可接收推送
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm tx-system-mute opacity-40">
                <BellOff size={14} />
                未订阅
              </span>
            )}
          </div>
        </div>

        {/* Device name — editable before subscribe, display-only after */}
        {permission !== 'denied' && (
          isSubscribed ? (
            deviceName ? (
              <div className="flex items-center gap-3 bg-chat-panel border border-white/5 rounded-xl px-6 py-4">
                <span className="text-xs font-mono tracking-wider tx-system-mute opacity-50 w-20">
                  设备名称
                </span>
                <span className="flex items-center gap-1.5 text-sm tx-system-normal opacity-70">
                  <Monitor size={14} className="tx-system-accent opacity-50" />
                  {deviceName}
                </span>
              </div>
            ) : null
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-mono tracking-wider tx-system-mute opacity-50">
                设备名称
              </label>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="例如：我的台式机"
                maxLength={200}
                className="w-full bg-chat-panel border border-white/5 rounded-lg px-3 py-2 text-sm tx-system-normal placeholder:tx-system-mute opacity-30 focus:outline-none focus:border-chat-accent/30 transition-colors"
              />
            </div>
          )
        )}

        {/* Toggle button */}
        <button
          onClick={isSubscribed ? unsubscribe : () => subscribe(localName.trim())}
          disabled={isLoading || permission === 'denied'}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            isLoading
              ? 'bg-chat-panel tx-system-mute opacity-40 cursor-wait'
              : permission === 'denied'
                ? 'bg-red-500/5 border border-red-500/15 text-red-400/50 cursor-not-allowed'
                : isSubscribed
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                  : 'bg-chat-accent/10 border border-chat-accent/20 tx-system-accent hover:bg-chat-accent/20'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              处理中...
            </>
          ) : isSubscribed ? (
            <>
              <BellOff size={16} />
              关闭通知
            </>
          ) : permission === 'denied' ? (
            <>
              <BellOff size={16} />
              通知已被浏览器阻止
            </>
          ) : (
            <>
              <Bell size={16} />
              启用通知
            </>
          )}
        </button>

        {/* Hint for denied */}
        {permission === 'denied' && (
          <p className="text-[0.6875rem] tx-system-mute opacity-30 text-center leading-relaxed">
            请在浏览器「网站设置」中允许通知权限后刷新页面
          </p>
        )}

        {/* Info for unsubscribed */}
        {!isSubscribed && permission !== 'denied' && !isLoading && (
          <p className="text-[0.6875rem] tx-system-mute opacity-30 text-center leading-relaxed">
            点击后浏览器会弹出权限请求，允许后即可在 PC 和 Android 上接收推送通知
          </p>
        )}
      </div>
    </div>
  );
}
