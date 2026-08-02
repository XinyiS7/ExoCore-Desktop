# ExoCore V4 单 SPA 前端架构规格

> 文档类型：产品与前端架构规格（Spec），不是施工计划。
> 状态：Draft，供 Alicia 评审。
> 适用仓库：`ExoCore-Desktop`。
> 日期：2026-08-02。

## 1. 本质问题

ExoCore 后端按技术职责划分为 agents、projects、memory、groupchat、tasks、push 等模块；当前前端则把其中一部分映射成三个独立 SPA。用户实际工作流会跨越这些模块，三 SPA 边界因此造成导航、状态、通知和视觉设施割裂。

V4 的目标不是把 Django app 逐一做成前端入口，而是以 Alicia 的高频任务组织一个应用：

1. 继续最近的交流；
2. 按 Agent 找到对话；
3. 按 Project 回到工作上下文；
4. 进入 GroupChat；
5. 在需要时管理记忆、日程和设置。

**核心决策：V4 收敛为一个 SPA / 一个 PWA；业务功能在代码中保持边界，但共享同一应用壳、路由和通知入口。** [gpt-5.6-sol / Solaire，Alicia approved]

## 2. 当前事实与约束

### 2.1 前端现状

- `chat-core`、`chronicle`、`council` 是三个独立构建和运行的 SPA。
- `ChatArea.jsx` 同时承担聊天流、轮询恢复、附件、音频、模型控制和多种浮层，职责过载。
- `AgentMemory.jsx` 尚未形成可用的记忆管理界面。
- Task 创建组件和 API 调用已经存在，但当前用户实际无法可靠完成创建，后续需单独诊断。
- 当前音频施工尚未形成干净、稳定的工作区；V4 施工不得与其混合。

### 2.2 后端领域事实

- `Conversation` 可关联 `agent_preset`，并可关联 `project`。
- `GroupChat` / `GroupChatMessage` 是独立实体，不是普通 Conversation 的子类型。
- `MemoryPlasmid` 归属 Agent preset，并可追溯到 Conversation / Message。
- Project、Conversation、Agent、MemoryPlasmid 具有真实跨模块关系。

### 2.3 当前契约缺口

当前 `ReactSheet.md` 将 Conversation 创建描述为 `project` 必填、`agent_preset` 可选；目标信息架构则需要支持“某 Agent 的无 Project / Drift 对话”。实施前必须通过源码与真实接口确认以下事项，并在必要时交由后端仓库单独变更：

- 创建普通 Agent Conversation 时，`agent_preset` 是否应成为必需业务字段；
- `project = null` 是否受创建接口支持；
- 旧数据中缺少 Agent 或 Project 的 Conversation 如何展示；
- Conversation 列表是否需要服务端 Agent / Project 组合筛选。

本 Spec 不擅自修改后端契约。

## 3. 目标与非目标

### 3.1 目标

- 建立唯一应用壳与唯一主路由。
- 首页优先呈现最近会话。
- Agent 和 Project 成为同一批 Conversation 的两个索引入口。
- GroupChat 在产品上属于交流，在代码与数据上保持独立。
- Memory 使用统一底层管理器，并提供全局与 Agent 内两种入口。
- Task / Calendar / Chronicle 作为边界清楚的伴随模块，不侵入聊天核心。
- 为后续 Android Capacitor 容器保留稳定的平台适配边界。
- 旧前端在迁移期间继续作为可运行参照和行为基线。

### 3.2 非目标

- 本期不删除 Council 后端。
- 本 Spec 不决定最终视觉主题。
- 本 Spec 不实现 STT、原生通知或 Android Foreground Service。
- 不以重写为由改变既有 API 数据形状。
- 不在 V4 施工中顺手修复所有 V3 历史问题。
- 不把后端模块数量直接映射成同等数量的一级导航。

## 4. 领域与索引模型

### 4.1 普通 Conversation

目标心智模型：

```text
Conversation = Agent × Optional Project
```

- Agent 表示主要交流对象。
- Project 表示可选工作上下文。
- 没有 Project 的普通对话在用户界面中暂称 `Drift`；最终中文命名待定。
- 同一个 Conversation 只保存一份，不因入口不同复制。

示例：

| Conversation | Agent | Project |
|---|---|---|
| Conv 101 | Agent 1 | Project A |
| Conv 102 | Agent 1 | Drift |
| Conv 103 | Agent 6 | Project A |

从 Agent 1 进入时显示 Conv 101 和 Conv 102，并突出 Project 标签；从 Project A 进入时显示 Conv 101 和 Conv 103，并突出 Agent 标签。

**核心决策：Agent 与 Project 是组合筛选维度，不是彼此嵌套的两套会话树。** [gpt-5.6-sol / Solaire，Alicia approved]

### 4.2 GroupChat

- GroupChat 不参与 Agent × Project 的普通 Conversation 坐标。
- 首页最近活动可将 GroupChat 与普通 Conversation 合并展示，但必须保留可辨识类型。
- GroupChat 详情使用独立的数据访问与消息运行逻辑，不伪装成普通 Conversation。

## 5. 信息架构

### 5.1 一级产品区域

V4 逻辑区域为：

```text
Home
Agents
Projects
Groups
Memory
Today / Chronicle
Settings
```

这不是对移动端底栏数量的要求。移动端与桌面端可使用不同的导航呈现，但必须进入同一组 canonical routes。

### 5.2 Home：继续工作页

首页的第一目标是让 Alicia 以最少操作继续最近交流，不建设泛化 Dashboard。

展示顺序：

1. 最近活动；
2. 常用或最近 Agent；
3. 最近活跃 Project；
4. 最近活跃 GroupChat。

最近活动可包含普通 Conversation 与 GroupChat，条目至少应表达：

- 会话名称或可识别摘要；
- Agent 或 Group 身份；
- Project 标签或 Drift 状态；
- 最近活动时间；
- 类型差异。

### 5.3 Agent Workspace

Agent 页面不默认展开“每个 Project 下的全部会话”，避免形成重复树。

目标内容：

- Agent 基本身份与状态；
- 开始新对话；
- 最近会话；
- 全部 / Drift / Project 维度的筛选入口；
- Memory 摘要与“管理此 Agent 记忆”入口；
- Agent Profile。

Agent 页面已知当前 Agent，因此 Conversation 条目优先突出 Project 上下文。

### 5.4 Project Workspace

Project 页面同样不默认展开“每个 Agent 下的全部会话”。

目标内容：

- Project 概览；
- 在此 Project 中开始对话；
- 最近会话；
- 全部 / Agent 维度的筛选入口；
- Files；
- Project Knowledge。

Project 页面已知当前 Project，因此 Conversation 条目优先突出 Agent 身份。

### 5.5 Canonical Chat

普通聊天必须只有一个 canonical 页面，不从 Agent 和 Project 各复制一套：

```text
/chat/:conversationId
```

聊天页同时展示 Agent 与 Project / Drift 上下文。从列表进入时，浏览器历史负责返回来源；直接打开链接时，默认返回 Home。

GroupChat 使用独立 canonical route，例如：

```text
/groups/:groupId
```

最终 route 名称可在施工计划阶段统一，但“同一实体只有一个详情实现”是固定约束。

## 6. Memory 架构

### 6.1 一个管理器，多个入口

Memory 使用同一底层页面与筛选模型：

- Agent Workspace 显示摘要，并深链到预设该 Agent 筛选条件的管理页；
- 全局 Memory 入口支持跨 Agent 搜索、状态筛选与整理。

**核心决策：Agent 内入口和全局入口不得发展成两套 Memory 实现。** [gpt-5.6-sol / Solaire，Alicia approved]

### 6.2 用户概念分离

界面必须明确区分：

1. 长期记忆：MemoryPlasmid；
2. 对话摘要：HistoryChunk；
3. Project 知识：KnowledgeFragment 与 Project files。

这些对象可以在搜索体验中关联，但不得以一个含混的“Memory”列表混合呈现所有状态和操作。

## 7. Task、Calendar 与 Chronicle

### 7.1 边界

Task / Calendar / Chronicle 与聊天核心在代码和业务规则上分离，但初始 V4 仍共享一个应用壳和安装包。

原因：

- Task 推送与 Agent 推送可以共享设备注册和通知路由；
- 聊天创建或引用 Task 时可在同一应用内深链；
- 避免重新产生两套 PWA、Service Worker、主题、导航和 Android 安装包。

**决策：先拆业务边界，不先拆用户应用。是否独立为另一产品保留为未来决策。** [gpt-5.6-sol / Solaire，Alicia provisional approval]

### 7.2 目标区域

暂用 `Today / Chronicle` 表示该区域，最终名称待定。内部可包含：

- 今日概览；
- Tasks；
- Calendar；
- Timeline / Activity；
- Chronicle / 大事记。

该区域不默认占据移动端底栏；是否升级为高频一级入口由真实使用频率决定。

## 8. Council 与 Settings

### 8.1 Council

- Council 不进入 V4 首期信息架构。
- GroupChat 不复用 Council 前端实现。
- Council 后端的保留或退役由独立后端决策处理。

### 8.2 Settings

- 当前 Settings 对接暂不改动。
- V4 应为 Settings 保留稳定入口，但不以 `SystemConfig` 单表结构直接决定页面分组。
- 移动端 Settings 不占高频底栏位置，优先放在头像或 More 菜单。

## 9. 响应式导航约束

### 9.1 已冻结原则

- Home、Agents、Projects、Groups 是当前最高频入口。
- 进入具体聊天后，应允许隐藏移动端底栏，给消息区域完整空间。
- Memory 与 Settings 必须可达，但不要求进入高频底栏。
- 桌面与移动端共享路由和领域页面，不维护两套业务实现。

### 9.2 待比较方案

移动端底部导航最终形式需经过低保真原型比较，候选包括：

```text
Home | Agents | Projects | Groups
```

或在 Task 成为每日高频功能后：

```text
Home | Agents | Projects | Today
```

第二种情况下 Groups 需从 Home 或交流区域稳定可达。Spec 不提前冻结该选择。

## 10. 前端技术边界

### 10.1 基础技术

V4 推荐使用：

- React + Vite；
- TypeScript strict；
- React Router；
- TanStack Query 管理普通服务端状态；
- React Hook Form 管理复杂表单。

不因重写默认引入 SSR 框架。

### 10.2 状态所有权

- 当前 Agent、Project、Conversation 等可导航身份由 URL 表达。
- 后端实体与列表由 Query cache 管理。
- 弹窗、抽屉、输入草稿等局部 UI 状态尽量留在局部。
- 只有确认存在跨页面客户端状态后，才考虑 Zustand 等额外状态库。

### 10.3 聊天运行边界

TanStack Query 不承担完整 SSE 生命周期。聊天运行需要独立控制器，至少隔离：

- SSE 事件解析与运行状态；
- 断线后状态查询或恢复；
- stop；
- 消息增量合并；
- error / done 终态；
- regenerate / branch 等会话动作。

表现组件不得直接拼装上述协议。

### 10.4 平台能力边界

录音、通知、文件与 App 生命周期通过平台适配接口暴露，Web 组件不得散布 Android 条件判断。

目标形态示意：

```text
Platform capability
├── Web / PWA implementation
└── Capacitor implementation
```

## 11. Android 方向

Capacitor 是当前首选 Android 容器，但不属于单 SPA 首期验收。[Gemini 3.6 Flash / Alaric，gpt-5.6-sol / Solaire reviewed]

约束：

- 原生 FCM 推送、Foreground Service、原生录音均视为独立能力施工，不假设套壳后自动获得；
- Web Push 与原生 FCM 是不同发送通道；
- 初始正式方案优先评估 APK 内置静态前端、远程调用 ExoCore API；
- `server.url` 远程加载仅作为个人原型候选，必须另行评估 TLS、Tailscale、离线行为和安全边界；
- `pwa-to-apk` 不作为正式依赖，正式实现优先使用官方 Capacitor 工具链。

## 12. 迁移与兼容原则

- V4 采用新应用骨架，但不一次性删除 V3。
- 旧前端是迁移期间的可运行行为参照。
- 按完整用户路径纵向迁移，不按“先建完所有 API 层、再建所有 UI 层”横向堆积。
- 每个迁移切片必须可独立验证，并保留回退到 V3 的能力。
- 音频、附件、regenerate、branch、cache、tool events 等复杂聊天能力必须逐项建立行为清单，不因界面重写而静默丢失。
- V4 开工前，当前音频工作必须先验收并形成明确 commit/checkpoint。

## 13. 架构验收标准

后续 Implementation Plan 必须覆盖以下可验证目标；本 Spec 不冻结测试实现细节：

1. 单次构建产生一个主要 Web/PWA 应用，不再要求用户在 chat-core 与 chronicle SPA 间切换。
2. Home 首屏可进入最近普通 Conversation 和最近 GroupChat，并能辨识两者类型。
3. 同一 Conversation 可从 Agent 和 Project 两种入口打开，最终进入同一个 canonical chat 实现。
4. Agent 页面支持按 Project / Drift 缩小会话范围；Project 页面支持按 Agent 缩小范围。
5. 列表筛选不复制或生成第二份 Conversation。
6. GroupChat 不调用普通 Conversation 专属接口。
7. Agent Memory 入口和全局 Memory 入口进入同一管理实现，并正确应用 Agent 筛选。
8. MemoryPlasmid、HistoryChunk、Project Knowledge 在名称、状态和可用操作上可区分。
9. Task 模块故障不得阻断聊天核心启动与使用。
10. Settings 保持可达，现有对接在未获单独批准前不被改写。
11. 桌面与移动端不复制业务逻辑；具体 Chat 在移动端具有不被常驻底栏挤压的完整消息区域。
12. SSE 运行、停止、恢复、终态与错误展示具有明确控制边界，不再由巨型页面组件直接承担。
13. Web 平台能力与未来 Capacitor 平台能力通过接口隔离。
14. V3 尚未迁移的能力有显式清单，不得以“重写”为由被默认视为废弃。

## 14. 开放决策

以下事项不阻塞 Spec 起草，但必须在对应施工阶段前冻结：

| 决策 | 冻结时点 |
|---|---|
| 移动端底栏最终四项与 More 交互 | 应用壳原型验收前 |
| `Drift` 的最终中英文名称 | Conversation 列表施工前 |
| Today / Life / Chronicle 的产品名称 | 该模块迁移前 |
| Task 是否未来独立成另一产品 | 推送与 Android 方案设计前 |
| Conversation 创建时 Agent / Project 的真实必填规则 | Conversation 施工计划前 |
| Agent × Project 服务端筛选接口需求 | Conversation 施工计划前 |
| Capacitor 使用内置静态资源或 `server.url` | Android 施工计划前 |
| Council 后端是否退役 | V4 稳定后单独决策 |

## 15. 后续文档边界

本 Spec 获 Alicia 批准后，再在前端仓库创建独立 Implementation Plan。Implementation Plan 负责：

- 源码级文件与组件定位；
- 分阶段迁移顺序；
- API 缺口和跨仓移交；
- 每阶段验收命令与预期结果；
- V3 能力迁移矩阵；
- commit/checkpoint 边界。

本 Spec 不直接充当施工清单。

---

**主要作者：** gpt-5.6-sol / Solaire — 2026-08-02
**调研贡献：** Gemini 3.6 Flash / Alaric
**产品决策人：** Alicia
