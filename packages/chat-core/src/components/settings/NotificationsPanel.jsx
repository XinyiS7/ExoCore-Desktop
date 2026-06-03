import React from 'react';
import { Bell, BellOff, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { pushApi } from 'exo-shared';

const { usePushSubscription } = pushApi;

export default function NotificationsPanel() {
  const { isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushSubscription();

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-chat-text/90">Push Notifications</h2>
          <p className="text-sm text-chat-muted/60">
            接收来自 ExoCore 的实时推送通知
          </p>
        </div>

        {/* Status card */}
        <div className="bg-chat-panel/60 border border-white/5 rounded-xl p-6 space-y-4">
          {/* Permission status */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-chat-muted/50 w-20">
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
            <span className="text-xs font-mono uppercase tracking-wider text-chat-muted/50 w-20">
              订阅
            </span>
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-sm text-chat-muted/60">
                <Loader2 size={14} className="animate-spin" />
                检查中...
              </span>
            ) : isSubscribed ? (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <CheckCircle2 size={14} />
                已订阅 — 可接收推送
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-chat-muted/40">
                <BellOff size={14} />
                未订阅
              </span>
            )}
          </div>
        </div>

        {/* Toggle button */}
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading || permission === 'denied'}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            isLoading
              ? 'bg-chat-panel/40 text-chat-muted/40 cursor-wait'
              : permission === 'denied'
                ? 'bg-red-500/5 border border-red-500/15 text-red-400/50 cursor-not-allowed'
                : isSubscribed
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                  : 'bg-chat-accent/10 border border-chat-accent/20 text-chat-accent hover:bg-chat-accent/20'
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
          <p className="text-[11px] text-chat-muted/30 text-center leading-relaxed">
            请在浏览器「网站设置」中允许通知权限后刷新页面
          </p>
        )}

        {/* Info for unsubscribed */}
        {!isSubscribed && permission !== 'denied' && !isLoading && (
          <p className="text-[11px] text-chat-muted/30 text-center leading-relaxed">
            点击后浏览器会弹出权限请求，允许后即可在 PC 和 Android 上接收推送通知
          </p>
        )}
      </div>
    </div>
  );
}
