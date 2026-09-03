import type { ReactNode } from 'react';

/** Loading indicator with perceivable text (not color-only). */
export function LoadingState({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="app-async" role="status">
      <span className="app-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Error state with explicit retry action. */
export function ErrorState({
  title = '加载失败',
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="app-async" role="alert">
      <p className="app-async-title">{title}</p>
      {detail ? <p className="app-async-detail">{detail}</p> : null}
      {onRetry ? (
        <button type="button" className="app-btn app-btn-ghost" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  );
}

/** Empty state with optional call to action. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="app-async">
      <p className="app-async-title">{title}</p>
      {hint ? <p className="app-async-detail">{hint}</p> : null}
      {action}
    </div>
  );
}
