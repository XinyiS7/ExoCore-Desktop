import { Bell, Clock, Cpu, Key, Palette, Wrench, type LucideIcon } from 'lucide-react';

export interface SettingsSectionDef {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
}

/**
 * Settings section definitions for Phase 2C CP C-4.
 * Registers keys, models, mcp, appearance, routine, and notifications.
 */
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: 'keys',
    label: '密钥与通道',
    path: '/settings/keys',
    icon: Key,
    description: '端点通道与 API 密钥池',
  },
  {
    id: 'models',
    label: '模型角色',
    path: '/settings/models',
    icon: Cpu,
    description: '主模型与辅助角色绑定',
  },
  {
    id: 'mcp',
    label: 'MCP 与工具抽屉',
    path: '/settings/mcp',
    icon: Wrench,
    description: '工具抽屉授权与凭证管理',
  },
  {
    id: 'appearance',
    label: '外观与体验',
    path: '/settings/appearance',
    icon: Palette,
    description: '主题、字体与字号偏好',
  },
  {
    id: 'routine',
    label: '后台例行',
    path: '/settings/routine',
    icon: Clock,
    description: '自检与深度整理预设',
  },
  {
    id: 'notifications',
    label: '通知设置',
    path: '/settings/notifications',
    icon: Bell,
    description: '系统通知入口与状态说明',
  },
];
