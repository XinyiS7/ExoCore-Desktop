/**
 * P1D Context Cache control (Plan Task 3.4, §6.4).
 *
 * Backend is the only cache truth; this panel is a validated projection of
 * the Query row plus request state. It owns:
 * - enable preference (conversation-local, default true) — independent from
 *   current cache existence;
 * - countdown derived from confirmed `expires_at`, renewals, snapshot badge;
 * - refresh, eligible renew, release with explicit mutation/error/stale
 *   states; renew/release are excluded while a chat operation or another
 *   cache mutation is unresolved (`mutationsLocked`);
 * - release describes possible background snapshot rebuild; failures keep
 *   the displayed truth until a refetch (mutation callers invalidate first).
 */
import { useMemo } from 'react';
import { toAppApiError } from '../api';
import type { CacheControlApi } from '../control/useCacheControl';

export interface ContextCacheControlProps {
  /** The page-owned cache projection and sole mutation owner. */
  cacheControl: CacheControlApi;
  /** Combined runtime/audio/thinking/cache uncertainty from the page owner. */
  runtimeUncertain: boolean;
  cacheEnabled: boolean;
  onCacheEnabledChange: (enabled: boolean) => void;
  onStorageWarning?: (message: string) => void;
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ContextCacheControl({
  cacheControl,
  runtimeUncertain,
  cacheEnabled,
  onCacheEnabledChange,
}: ContextCacheControlProps) {
  const { presentation, renewing, releasing } = cacheControl;

  const renewError = useMemo(
    () => (cacheControl.renewError ? toAppApiError(cacheControl.renewError) : null),
    [cacheControl.renewError],
  );
  const releaseError = useMemo(
    () => (cacheControl.releaseError ? toAppApiError(cacheControl.releaseError) : null),
    [cacheControl.releaseError],
  );

  // Success notices are transient (mutation.isSuccess) — they disappear on
  // the next mutation start, which is correct for an overlay panel.

  const showRenew = presentation.state === 'active';
  const showRelease = presentation.state === 'active' || presentation.state === 'snapshot_only';
  const actionsDisabled = cacheControl.mutationsLocked;

  return (
    <div className="v4-cache">
      <div className="v4-cache-head">
        <span className="v4-hud-label">上下文缓存</span>
        <label className="v4-switch" title="下一轮是否使用缓存">
          <input
            type="checkbox"
            checked={cacheEnabled}
            onChange={() => onCacheEnabledChange(!cacheEnabled)}
            disabled={runtimeUncertain}
            aria-label="启用上下文缓存"
          />
          <span aria-hidden="true">{cacheEnabled ? '启用' : '关闭'}</span>
        </label>
      </div>

      {presentation.state === 'loading' ? (
        <p className="app-muted">正在读取缓存状态…</p>
      ) : presentation.state === 'active' ? (
        <div className="v4-cache-active" role="status">
          <p className="v4-cache-line">
            <strong>远端缓存生效</strong>
            <span className="v4-cache-countdown" aria-label={`剩余 ${formatCountdown(presentation.cache.remainingSeconds ?? 0)}`}>
              {formatCountdown(presentation.cache.remainingSeconds ?? 0)}
            </span>
          </p>
          <p className="v4-cache-sub">
            {presentation.cache.cacheName ?? presentation.cache.platform}
            {presentation.cache.renewals !== null ? ` · 续期 ${presentation.cache.renewals} 次` : ''}
            {presentation.cache.expiresAt ? ` · ${formatClock(presentation.cache.expiresAt)} 过期` : ''}
          </p>
        </div>
      ) : presentation.state === 'snapshot_only' ? (
        <p className="v4-cache-line" role="status">
          本地快照
          {presentation.cache.snapshotCacheEndIdx !== null
            ? `（至消息 #${presentation.cache.snapshotCacheEndIdx}）`
            : ''}
          <span className="app-muted"> · 无远端缓存</span>
        </p>
      ) : presentation.state === 'empty' ? (
        <p className="v4-cache-line">当前无缓存</p>
      ) : (
        <div className="v4-cache-error" role="alert">
          <p className="app-error-hint">{presentation.message}</p>
          <button
            type="button"
            className="app-btn app-btn-ghost app-btn-xs"
            onClick={() => void cacheControl.refresh()}
          >
            重试
          </button>
        </div>
      )}

      {cacheControl.staleError ? (
        <p className="v4-cache-stale" role="status">
          状态刷新失败，显示上次确认状态
        </p>
      ) : null}

      {cacheControl.renewSuccess ? (
        <p className="v4-cache-ok" role="status">
          已续期；状态已刷新
        </p>
      ) : null}
      {cacheControl.releaseSuccess ? (
        <p className="v4-cache-ok" role="status">
          已释放；后端可能异步重建快照
        </p>
      ) : null}

      {renewError && presentation.state === 'active' ? (
        <p className="v4-cache-error" role="alert">
          续期失败：{renewError.message}
        </p>
      ) : null}
      {releaseError ? (
        <p className="v4-cache-error" role="alert">
          释放失败：{releaseError.message}
        </p>
      ) : null}

      <div className="v4-cache-actions">
        <button
          type="button"
          className="app-btn app-btn-ghost app-btn-sm"
          onClick={() => void cacheControl.refresh()}
          disabled={cacheControl.refreshing}
          title="重新读取缓存状态"
        >
          {cacheControl.refreshing ? '刷新中…' : '刷新'}
        </button>
        {showRenew ? (
          <button
            type="button"
            className="app-btn app-btn-ghost app-btn-sm"
            onClick={cacheControl.renew}
            disabled={actionsDisabled}
            title="为当前远端缓存续期"
          >
            {renewing ? '续期中…' : '续期'}
          </button>
        ) : null}
        {showRelease ? (
          <button
            type="button"
            className="app-btn app-btn-ghost app-btn-sm"
            onClick={cacheControl.release}
            disabled={actionsDisabled}
            title="释放当前缓存/快照（后端可能异步重建快照）"
          >
            {releasing ? '释放中…' : '释放'}
          </button>
        ) : null}
        {runtimeUncertain ? (
          <span className="app-muted">运行中，缓存操作已锁定</span>
        ) : null}
      </div>
    </div>
  );
}