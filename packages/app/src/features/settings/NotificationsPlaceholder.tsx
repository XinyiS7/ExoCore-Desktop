import { Bell } from 'lucide-react';

export function NotificationsPlaceholder() {
  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h2 className="settings-panel-title">通知设置</h2>
        <p className="settings-panel-desc">本页当前仅为入口说明，通知运行时将在 Phase 2D 交付。</p>
      </div>

      <div className="settings-card notif-placeholder-body">
        <div className="notif-boundary-notice">
          <strong>Phase 2D 待交付</strong>
          <p>此处不读取浏览器通知权限、不显示订阅状态、不配置设备名，也不注册任何到达或点击监听。</p>
        </div>

        <div className="notif-feature-list">
          <div className="notif-feature-item">
            <Bell className="notif-feature-icon" size={20} />
            <div>
              <span className="notif-feature-title">通知中心与推送订阅说明</span>
              <span className="notif-feature-desc">订阅状态与投递结果的集中说明将在 Phase 2D 提供。</span>
            </div>
          </div>
          <div className="notif-feature-item">
            <Bell className="notif-feature-icon" size={20} />
            <div>
              <span className="notif-feature-title">浏览器原生权限管理</span>
              <span className="notif-feature-desc">权限申请与撤销流程将在 Phase 2D 提供。</span>
            </div>
          </div>
          <div className="notif-feature-item">
            <Bell className="notif-feature-icon" size={20} />
            <div>
              <span className="notif-feature-title">设备名称与 Web Push 凭证订阅</span>
              <span className="notif-feature-desc">设备命名与后端持久化订阅将在 Phase 2D 提供。</span>
            </div>
          </div>
          <div className="notif-feature-item">
            <Bell className="notif-feature-icon" size={20} />
            <div>
              <span className="notif-feature-title">助手消息到达与统一未读流</span>
              <span className="notif-feature-desc">到达刷新、未读状态与点击跳转将在 Phase 2D 提供。</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
