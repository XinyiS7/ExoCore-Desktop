import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { useDocumentTitle } from './useDocumentTitle';

/**
 * Route-level error containment (Plan Task 4.4).
 * Render errors inside a route bubble here instead of blanking the shell.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // P1A: surface in console; no telemetry surface exists yet (P6 domain).
    console.error('[v4] render error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-page" role="alert">
          <p className="app-error-title">页面渲染出错</p>
          <p className="app-error-hint">请刷新重试，或返回 Chat Home。</p>
          <div className="app-error-actions">
            <button type="button" className="app-btn" onClick={() => window.location.reload()}>
              刷新
            </button>
            <Link className="app-btn app-btn-ghost" to="/">
              Chat Home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Router errorElement: shows the thrown route error (404/500 from loaders are not used in P1A). */
export function RouteErrorFallback() {
  useDocumentTitle('页面加载失败');
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);
  return (
    <div className="app-error-page" role="alert">
      <p className="app-error-title">页面加载失败</p>
      <p className="app-error-hint">{message}</p>
      <div className="app-error-actions">
        <Link className="app-btn" to="/">
          Chat Home
        </Link>
      </div>
    </div>
  );
}
