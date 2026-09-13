import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../shared/useDocumentTitle';

/** Real wildcard not-found state — never an empty page that looks complete. */
export function NotFoundPage() {
  useDocumentTitle('页面不存在');
  return (
    <div className="app-page app-page--center">
      <div className="app-error-page" role="alert">
        <p className="app-error-title">页面不存在</p>
        <p className="app-error-hint">这个地址没有对应的页面。</p>
        <Link className="app-btn" to="/">
          Chat Home
        </Link>
      </div>
    </div>
  );
}
