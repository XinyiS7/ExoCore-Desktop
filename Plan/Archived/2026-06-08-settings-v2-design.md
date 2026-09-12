# Settings V2 — chat-core 设置页改造设计

**日期:** 2026-06-08
**范围:** chat-core Settings 页面（`SettingsView.jsx` 及下属面板）
**数据源:** ReactSheet_Reorganized.md 第五篇 系统配置 (Core / Config & Models)

---

## 最终效果

### 一级导航变更

```
Keys → Model Assign (NEW) → Notifications → Appearance → Routine (ENABLE) → Memory
```

| 菜单项 | 变更 | 说明 |
|--------|------|------|
| Key Manage | 视觉重做 | 紧凑精致，去掉大卡片 |
| Model Assign | **新增** | 模型角色分配 (model_roles) |
| Notifications | 不变 | Push 通知开关 |
| Appearance | 修复 | 分离系统字体 / 消息字体 |
| Routine | **启用** | 原 `enabled: false`，实现后台任务 Agent 管理 |
| Memory | 不变 | 仍为 Coming Soon 占位 |

新增图标：Model Assign 使用 `Cpu` (lucide-react)

---

## 施工顺序

1. **useFont 重构** — 添加 `--font-system` / `--font-message` CSS 变量，支持双字体选择
2. **AppearancePanel 重做** — 系统字体 + 消息字体两个独立选择器
3. **KeyManagePanel 紧凑重设计** — Key Pool 行内布局 + Key Map 表格式
4. **ModelAssignPanel 新建** — 模型角色 → 模型 ID 下拉框
5. **RoutinePanel 新建** — 后台任务 Agent 分组管理
6. **SettingsView 更新** — 添加 Model Assign 路由，启用 Routine
7. **全站 CSS 变量适配** — 消息气泡、群桥消息、输入框切换到 `--font-message`

---

## 关键文件清单

### 新建文件
- `packages/chat-core/src/components/settings/ModelAssignPanel.jsx`
- `packages/chat-core/src/components/settings/RoutinePanel.jsx`

### 修改文件
- `packages/chat-core/src/views/SettingsView.jsx` — 导航菜单 + 路由
- `packages/chat-core/src/App.jsx` — 添加 Model Assign / Routine 路由
- `packages/chat-core/src/components/settings/AppearancePanel.jsx` — 双字体选择器
- `packages/chat-core/src/components/settings/KeyManagePanel.jsx` — 紧凑重设计
- `packages/chat-core/src/components/settings/KeyPoolSection.jsx` — 紧凑行内布局
- `packages/chat-core/src/components/settings/RoleKeyMapSection.jsx` — 表格式
- `packages/shared/src/hooks/useFont.js` — 双字体支持
- `packages/shared/src/styles/fonts.css` — 新 CSS 变量

### CSS 变量使用点（需排查 + 适配）
- 聊天消息气泡 → `--font-message`
- 群桥消息内容 → `--font-message`
- 消息输入框 → `--font-message`
- 所有其他 UI → `--font-system`

---

## 不变部分
- SettingsView 布局结构（左侧 nav + `<Outlet />`）
- NotificationsPanel 不做改动
- MemoryConsole 占位组件不变
- `--font-nav` 和 `--font-code` 保持固定，用户不可改
- 后端 API 接口不做任何修改
- Key Map 的 4 个角色（system/session/sub_agent/background）保持现有含义

---

## 各模块详细设计

### 1. useFont 重构 + Appearance 面板

**现状问题:** 只有 `--font-body` 一个用户可选字体，全站统一应用。用户无法分别控制 UI 字体和消息字体。

**目标 CSS 变量:**

| 变量 | 用户可选 | 应用范围 |
|------|---------|---------|
| `--font-system` | ✅ | 侧边栏、导航、设置、按钮、标签、卡片标题、所有 UI chrome |
| `--font-message` | ✅ | 聊天消息气泡内容、群桥消息内容、消息输入框 |
| `--font-nav` | ❌ 固定 LXGW WenKai | 导航文字（保持现有逻辑） |
| `--font-code` | ❌ 固定 Maple Mono | 代码块（保持现有逻辑） |

**useFont 改动:**
- 存储 key: `exo_font_system` / `exo_font_message`（两个独立 localStorage key）
- 回调: `setSystemFont(font)` / `setMessageFont(font)`
- 导出: `systemFont` / `messageFont` / `setSystemFont` / `setMessageFont` / `availableFonts`
- 向后兼容: 首次加载时，若只有旧 key `exo_font_preference`，迁移到两个新 key（都设为同一个值）

**fonts.css 改动:**
```css
:root {
  --font-system:  'Sarasa Gothic Mono', 'LXGW WenKai', 'Maple Mono', monospace;
  --font-message: 'Sarasa Gothic Mono', 'LXGW WenKai', 'Maple Mono', monospace;
  --font-nav:    'LXGW WenKai', 'Sarasa Gothic Mono', 'Segoe UI', sans-serif;
  --font-code:   'Maple Mono', 'Consolas', 'Cascadia Code', monospace;
}
```

**向后兼容 (critical):**
- `--font-body` 保留，始终设为与 `--font-system` 相同值
- 原因: `tailwind.config.js` 中 `fontFamily.sans: ['var(--font-body)']` 被 chat-core/chronicle/council 三个包共用
- 迁移路径: Tailwind config 改为 `var(--font-system)`，chronicle/council 通过 `--font-body` 别名继续工作
- chat-core `index.css` 的 `font-family: var(--font-body)` → 改为 `var(--font-system)`
- 消息气泡、群桥消息、输入框显式设置 `font-family: var(--font-message)`

**可选用字体（系统和消息共用同一套 3 款）:**
- Sarasa Gothic Mono（更纱等宽黑体）· 默认
- LXGW WenKai（霞鹜文楷）
- Maple Mono

**AppearancePanel UI:**
- 第一组：「🖥️ 系统字体」— 应用于侧边栏 · 导航 · 设置 · 按钮 · 标签
- 第二组：「💬 消息字体」— 仅用于聊天消息气泡 · 群桥消息 · 输入框
- 每组各自独立选择，Radio + 字体预览

---

### 2. Key Manage 紧凑重设计

**KeyPoolSection 改动:**
- 外层 `p-5` → `p-3`（20px → 12px）
- 列表项从 grid 四列 → flex 行内布局
- 每行: `[Alias] [****last4] [日期] [✏️ 🗑️]`
- 日期格式缩短为 `MM/DD`
- 新增表单折叠到行内（点击 +Add 后展开一行输入，而非独立卡片）

**RoleKeyMapSection 改动:**
- 从大卡片（每个 role 一个 `.rounded-lg border p-3.5`）→ 紧凑表格式
- 表头: Role | Assigned Keys | Default
- 4 行对应 4 个角色，每行内显示 key 标签 + 选择器
- Key 标签: 小圆角 chip，选中的高亮，未选中灰色
- Default 指示器: 行内 radio dot
- 保存按钮保持在右上角

**KeyManagePanel 改动:**
- Platform tabs 保持在顶部
- 两个 section 之间去重分隔线（可以是一条细线或更大间距）
- 整体信息密度提高约 40%

---

### 3. Model Assign 面板（新增）

**数据源:** `GET /api/core/config/` → `model_roles`，`GET /api/core/models/` → model registry

**4 个角色行:**

| Role | 中文名 | 过滤模型条件 |
|------|--------|------------|
| `sub_agent` | 后台杂活 · 压实 · 摘要 · 记忆整理 | roles 含 `sub_agent` |
| `vision` | 识图 | roles 含 `vision` |
| `image_gen` | 生图 (tool 类型) | roles 含 `image_gen` |
| `web_search` | 联网搜索 (SearchAgent) | roles 含 `web_search` |

**注意:** `main` 角色不在此处管理 — Agent 自己的模型走 `AgentPreset.default_model` → `settings.DEFAULT_MODEL`

**UI 布局:**
- 紧凑三列表: Role | 任务描述 | Model 下拉框
- 每行右侧是模型下拉框，按 role 过滤可选模型
- 下拉框显示模型 ID（带 provider 颜色标识）
- 顶部提示文字: "Agent 主模型走 AgentPreset，不在此处"
- 底部 Save 按钮（PATCH `/api/core/config/` 更新 `model_roles`）

**下拉框过滤逻辑:**
```
// 从 model_registry (GET /api/core/models/) 获取
// 对每个 role，过滤出 roles 数组包含该 role 的模型
// 例如 vision role: models.filter(m => m.roles.includes('vision'))
```

---

### 4. Routine 面板（启用 + 实现）

**数据源:** `GET /api/core/config/` →
- `self_check_preset_ids` — 自检 Agent 列表
- `deep_org_preset_ids` — 深度整理 Agent 列表
- `heartbeat_preset_ids` — Heartbeat 互动 Agent 列表
- `active_start` / `active_end` — 活跃时间窗口
- `heartbeat_base_hours` / `heartbeat_random_hours` / `night_heartbeat_base_hours`
- `deep_org_weekday` / `deep_org_hour`

**Agent 列表来源:** `GET /api/agents/presets/` → 过滤 `agent_type` 为 `superior` 或 `g045` 的 preset

**UI 结构 — 两个任务组:**

#### 组 A: Self Check & Deep Organize（共用 Agent 列表）
- 自检 + 深度整理共用同一份 agent 列表
- 后端走两个独立任务，但前端一份配置复制到两个字段
- 行首: 🔍🧹 + 标题 + 说明文字
- 行尾: [🕐 时间设置 ▸] [👥 Agent 管理 ▾]
- 点击「Agent 管理」展开复选框列表
- 点击「时间设置」展开时间配置（只读占位 → 等待后端接口）

#### 组 B: Heartbeat（独立 Agent 列表）
- 同上结构，独立展开
- 行首: 💓 + 标题 + 说明文字
- 行尾: [🕐 时间设置 ▸] [👥 Agent 管理 ▾]

#### 底部: Schedule Preview
- 只读显示当前时间配置摘要
- 格式: `Active: 09:00–23:00 · Heartbeat: 2–4h (day) / 6–8h (night) · Deep Org: 周一 03:00`

#### Agent 复选框列表展开后:
- **排序规则:** g045 → superior（agent_type），每组内选中的排前、未选中排后
- 每个 agent 行: `[☑/☐] Agent名称 · agent_type标签`
- 紧凑排列，无大卡片包裹
- 选中/取消 → 更新本地 state → 点击外层 Save 提交

#### 保存逻辑:
- 组 A 的选中 agent IDs → 同时写入 `self_check_preset_ids` + `deep_org_preset_ids`
- 组 B 的选中 agent IDs → 写入 `heartbeat_preset_ids`
- PATCH `/api/core/config/`

#### 时间设置（占位）:
- 当前只读展示 schedule preview
- 编辑入口留按钮，待后端提供独立时间配置接口后实现
- 占位状态在 UI 上标注 "时间设置接口待上线"

---

## 验证清单

1. `useFont` 设置系统字体 → 侧边栏/设置面板/按钮字体立即变更，消息气泡不受影响
2. `useFont` 设置消息字体 → 只有消息气泡/群桥/输入框字体变更，UI 不受影响
3. 旧 `exo_font_preference` key 自动迁移到两个新 key
4. Key Manage 紧凑布局在 gemini/deepseek 两个 platform 下正常工作
5. Key Pool CRUD（新增/编辑/删除/覆盖 key）功能不受影响
6. Key Map 保存 → `PUT /api/core/config/key-map/` 正常工作
7. Model Assign 下拉框只显示胜任该 role 的模型
8. Model Assign 保存 → PATCH `/api/core/config/` 更新 `model_roles`
9. Routine Agent 列表正确排序（g045 → superior，选中排前）
10. Routine 组 A 保存 → `self_check_preset_ids` + `deep_org_preset_ids` 同时更新
11. Routine 组 B 保存 → `heartbeat_preset_ids` 更新
12. 所有面板 Save 按钮有 loading 状态和 toast 反馈
13. 移动端导航折叠正常
