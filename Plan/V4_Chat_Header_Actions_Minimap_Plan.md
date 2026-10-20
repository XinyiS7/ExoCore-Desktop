# V4 Chat 会话页：Header 两行化 + 消息操作下移 + 用户消息 Minimap

> **状态：定稿（2026-10-20，Alicia 确认）。** 生产代码尚未动工。
> **Issue：** XinyiS7/ExoCore#72
> **基线：** ExoCore-Desktop `main@c0c1372`；ExoCore `main@0273cc7c`（只读）。
> **来源：** 2026-10-20 Alicia 草图与对话。定位为重构完成前的临时改善，不改后端契约。

---

## 0. 事实起点

| 事实 | 证据 |
|---|---|
| Header 单行挤了 返回 / 标题+chip / HudStateStrip / 项目文件 / 头像 MoreMenu 五块；窄屏是 3×2 grid | `features/chat/ConversationPage.tsx:600-670`；`styles/shell.css:314-400` |
| 头像是 `MoreMenu`（系统入口溢出菜单）；宽屏侧边栏另有一份 | `shell/PrimaryNavigation.tsx`；`shell/AppShell.tsx` |
| 返回链接写死 `Chat Home → /` | `ConversationPage.tsx:601` |
| 进入会话的三个主入口：欢迎页 `RecentConversationList.tsx:87`、`ChatHomePage.tsx:26`（新建）；Agent 主页 `AgentProfilePage.tsx:408/473`；Project 主页 `ProjectDetailPage.tsx:193/359` | grep |
| 状态条项：目标 · 思考 · SSE/轮询 · 缓存+释放 · ✦氛围 · 战术面板 | `hud/HudStateStrip.tsx` |
| 消息操作按钮全在 `app-msg-head` 里；AI 消息另有底部独立"复制" | `MessageTimeline.tsx:149-224, 268-280` |
| 收藏按钮在 hover 设备上 `opacity:0`，只 hover/focus 才显示 | `styles/shell.css:749-764` |
| 收藏目前只走 `CollectMessageModal`（message 来源，整条正文） | `MessageTimeline.tsx:304`；`features/collection/CollectMessageModal.tsx` |
| Collection 来源只有 `attachment(provenance_id)` / `text` / `message` / `chronicle_highlight`；`provenance_id` 只属新 multipart 上传；消息列表 `attachments[]` / `assistant_artifacts[]` 不暴露 `provenance_id` | `ReactSheet.md:1695, 1760`；前端全仓无 `provenance` 引用 |
| 时间线分页：`merged.rows` / `merged.hasOlder` / `handleLoadMore`；唯一滚动容器 `scrollRef` | `ConversationPage.tsx:112, 180, 728-731` |

## 1. 目标 / 非目标

**目标**
1. Header 改两行，去掉头像，宽屏两端拉开、窄屏省略。
2. 返回链接指向"严格上级"（进入会话的来源页）。
3. 消息操作统一放到消息下方；收藏常驻并带二级菜单（artifact/附件项占位置灰）。
4. 用户消息 Minimap + 前端字符串搜索 + 点击跳转 + 加载更早。

**非目标**
- 宽屏侧边栏折叠（另开 issue）。
- artifact / 附件收藏的真实接通（后端需求另开 issue，见 U6）。
- 任何后端或 API 契约改动。

## 2. 设计

### 2.1 Header（U1）

```
第一行：← {上级名}   {会话名}  · {项目名}            [项目文件]  [☰]
第二行：[Agent]  模型  思考 X  SSE  缓存余量 −              more
```

- 模型项：各宽度统一只显示模型名，不再拼端点；完整 `模型 · 端点` 留在 title 提示与战术面板，逐条消息头的 `platform · modelVersion` 不变（2026-10-20 Alicia 定）。
- 项目名：淡色纯文字，不加 badge、不跳转；Drift 会话显示 `Drift`。项目页可经"项目文件"抽屉进入。
- Agent chip：保留边框和到 `/agents/:id` 的跳转。
- "战术面板"按钮改名 `more`，仍打开 `TacticalHud`；✦氛围标签从条上移除（面板内已有）。
- 删除 `<MoreMenu className="app-more--top" />`；侧边栏的 MoreMenu 不动。
- 宽屏：两行各自 `justify-content: space-between`。窄屏：标题 ellipsis；状态条按实测宽度收缩——全部状态项无法并排完整显示时只留模型、思考、缓存三项（验收时 Alicia 定，替代原 ≤390px 断点），`☰` 恒可见。

### 2.2 严格上级（U2）

- 三个入口的 `Link` / `navigate` 带路由 state `{ from: { path, label } }`：欢迎页 `{ '/', 'Chat Home' }`、Agent 主页 `{ '/agents/:id', agent 名 }`、Project 主页 `{ '/projects/:id', 项目名 }`。
- 会话页读取并校验 state；缺失或形状不对（直链、刷新、分支、通知、Library 带回）回退 `← Chat Home`。
- 不使用 `navigate(-1)`：分支/刷新后历史栈不可靠。
- 通过一个小模块 `features/chat/backTarget.ts` 定义 state 类型、构造与解析，入口页与会话页共用。

### 2.3 消息操作（U3）

- `app-msg-head` 只留 角色名 · 时间 · 模型（AI）。
- 新增统一的 `app-msg-actions` 底栏，位于消息体之后：
  - AI：复制 · 朗读（`MessageVoiceControl`，可用时）· 分支 · 收藏
  - 用户：复制 · 收藏 · 编辑 · 重生成
- 运行锁规则不变（编辑/重生成/分支锁定；朗读不锁）。删除原底部独立复制按钮。
- 收藏常驻：删掉 hover 隐藏 CSS。

### 2.4 收藏二级菜单（U4）

- 点"收藏"弹出小菜单（复用 `dialogA11y` 风格的焦点/Esc 处理，点外部关闭）：
  - `收藏正文`：有正文时可用 → 现有 `CollectMessageModal` 流程。
  - 每个 assistant artifact / ready 附件一项：置灰，副文案"待后端支持"。
- 菜单只有一项可用、且无占位项时也照样弹菜单（保持交互一致；Alicia 已确认收藏走菜单）。

### 2.5 Minimap + 搜索（U5）

- `☰` 切换浮层：锚定消息区右上，盖在时间线上，不改变布局；Esc / 再点 / 点外部关闭。
- 数据：`merged.rows` 中 `role === 'user'` 的消息（含已加载的全部页）。
- 无搜索：每条显示正文前 15 字；高亮当前视口所在条。
- 搜索：不区分大小写的子串匹配；只列命中项，每条显示命中词前后共 15 字，命中词高亮。
- 点击：滚动 `scrollRef` 到对应消息（消息 `article` 增加 `data-message-id`），并短暂高亮该消息。
- 加载更早：`hasOlder` 为真时，列表滚到顶出现"加载更早消息"；搜索无结果显示"已加载的 N 条中未找到"+"加载更早消息"，加载后按当前关键词自动重搜。底部注明"仅搜索已加载的 N 条"。
- 分层：纯函数（摘要/命中切片）放 `features/chat/minimap/excerpt.ts`；状态与滚动放 hook；组件只渲染。

### 2.6 范围外登记（U6）

- 开 issue：宽屏侧边栏可折叠（`area:desktop`，`enhancement`，P3）。
- 开 issue：artifact / 附件可收藏（`area:backend`+`area:desktop`）。内容：消息读模型暴露可收藏原件身份（`provenance_id` 或新增 `assistant_artifact` 来源类型），并同步两仓 ReactSheet §13.3；Desktop 接通 U4 占位项。

## 3. 施工单元与文件

| 单元 | 文件 | 测试 |
|---|---|---|
| U1 Header | `ConversationPage.tsx`、`hud/HudStateStrip.tsx`、`styles/shell.css`、HUD 样式 | 更新 `shell.test.tsx`、`p1d_*`、`p2d_d2_integration` 中 header / 头像 / 战术面板断言 |
| U2 上级 | 新 `backTarget.ts`；`RecentConversationList.tsx`、`ChatHomePage.tsx`、`AgentProfilePage.tsx`、`ProjectDetailPage.tsx`、`ConversationPage.tsx` | 新增三入口 + 回退的路由测试；更新 `p2a_agents`、`p2b_projects` |
| U3 操作下移 | `MessageTimeline.tsx`、`styles/shell.css` | 更新 `collection_message*`、`assistant_artifact_cards`、`heartbeat_page` 中按钮位置/可见性断言 |
| U4 收藏菜单 | 新 `features/chat/MessageCollectMenu.tsx`；`MessageTimeline.tsx` | 菜单开合、正文可用、占位置灰 |
| U5 Minimap | 新 `minimap/excerpt.ts`、`minimap/useMessageMinimap.ts`、`minimap/MessageMinimap.tsx`、css；`ConversationPage.tsx`、`MessageTimeline.tsx`（`data-message-id`） | `excerpt` 单测；搜索/跳转/加载更早组件测试 |
| U6 登记 | GitHub issue ×2 | — |

每个单元完成即提交，提交写 `refs XinyiS7/ExoCore#N`。

## 4. 验收

- `pnpm --filter app test`、`pnpm lint`、`pnpm build` 全绿。
- 真实环境（:5173 或 :8080）窄屏 ≈420px 与宽屏 ≥1280px 截图：两行 header、无头像、more/☰ 可见；三入口返回名正确、刷新回退 Chat Home；按钮在消息下方、收藏常驻、菜单占位置灰；Minimap 摘要/搜索高亮/跳转/加载更早可用。
- 验收 PASS 后关闭 issue，评论提交号与验收记录。
