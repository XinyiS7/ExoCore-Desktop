import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MoreMenu } from '../../shell/PrimaryNavigation';
import { SETTINGS_SECTIONS } from './sections';
import { formatDocumentTitle, APP_BASE_TITLE } from '../../shared/useDocumentTitle';
import './settings.css';

export function SettingsLayout() {
  const location = useLocation();
  const currentSection = SETTINGS_SECTIONS.find((s) =>
    location.pathname.startsWith(s.path)
  );

  const isBareSettings = location.pathname.replace(/\/$/, '') === '/settings';

  useEffect(() => {
    if (isBareSettings) {
      document.title = formatDocumentTitle('页面不存在');
      return () => {
        document.title = APP_BASE_TITLE;
      };
    }
  }, [isBareSettings]);

  return (
    <div className="settings-page">
      {/* Topbar for mobile & desktop navigation header */}
      <header className="app-topbar app-topbar--detail settings-topbar">
        <div className="app-topbar-left">
          <Link to="/" className="app-back-btn" aria-label="返回聊天">
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <div className="settings-topbar-title-wrap">
            <span className="app-topbar-title">设置中心</span>
            {currentSection ? (
              <span className="settings-topbar-sub">/ {currentSection.label}</span>
            ) : null}
          </div>
        </div>
        <div className="app-topbar-actions">
          <MoreMenu className="app-more--top" />
        </div>
      </header>

      {/* Settings layout frame */}
      <div className="settings-layout">
        {/* Desktop sidebar rail */}
        <nav className="settings-rail" aria-label="设置分区导航">
          <div className="settings-rail-title">系统设置</div>
          <ul className="settings-rail-list">
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <li key={section.id}>
                  <NavLink
                    to={section.path}
                    className={({ isActive }) =>
                      `settings-rail-item${isActive ? ' settings-rail-item--active' : ''}`
                    }
                  >
                    <Icon size={16} aria-hidden="true" className="settings-rail-icon" />
                    <div className="settings-rail-item-text">
                      <span className="settings-rail-item-label">{section.label}</span>
                      <span className="settings-rail-item-desc">{section.description}</span>
                    </div>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile horizontal section selector */}
        <nav className="settings-mobile-tabs" aria-label="设置分区标签">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <NavLink
                key={section.id}
                to={section.path}
                className={({ isActive }) =>
                  `settings-mobile-tab${isActive ? ' settings-mobile-tab--active' : ''}`
                }
              >
                <Icon size={14} aria-hidden="true" />
                <span>{section.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Main content scroll container */}
        <main className="settings-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
