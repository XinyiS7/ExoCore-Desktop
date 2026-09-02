# ExoCore V4 单 SPA 前端架构规格

> 文档类型：产品与前端架构规格（Spec），不是施工计划。
> 状态：核心架构已冻结，可作为 Master Roadmap 输入；阶段性开放项见第 14 节。
> 适用仓库：`ExoCore-Desktop`。
> 初稿：2026-08-02；架构收口：2026-09-02。

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

### 2.3 Conversation 契约已核对

2026-09-02 只读调研确认：

- 普通 Conversation 创建走 `POST /api/agents/sessions/init/`，`preset_id` 创建时必填；
- `project = null` 正式支持，当前序列化层使用 `project: 0` 作为前端 sentinel；
- 当前真实数据中没有缺失 `agent_preset` 的普通会话，存在无 Project 的 Drift 会话；
- Conversation list 当前无服务端 Agent / Project 组合筛选与分页，现量级可继续前端过滤；服务端组合筛选属于可顺路补齐的扩展，不是 V4 Chat 首期 blocker。

因此 `Conversation = Agent × Optional Project` 可直接作为 V4 产品契约；若未来扩展列表规模，再单独引入服务端 filter/pagination。

## 3. 目标与非目标

### 3.1 目标

- 建立唯一应用壳与唯一主路由。
- 首页优先呈现最近会话。
- Agent 和 Project 成为同一批 Conversation 的两个索引入口。
- GroupChat 在产品上属于交流，在代码与数据上保持独立。
- Library 统一承载 Collection 与 Memory 两个平级业务区；Memory 使用统一底层管理器，并提供全局与 Agent 内深链入口。
- River 统一承载异步时间阅读；Task / Calendar / Diary / legacy Chronicle source 保持各自业务与存储边界，不侵入聊天核心。
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
- 没有 Project 的普通对话在用户界面中称 `Drift`；名称已冻结。
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

V4 一级产品区域冻结为：

```text
Chat / Groups / River / Library
```

其中：

- Chat 内包含最近会话、Agent Hub、Project Hub 与 canonical Conversation；
- Groups 保持独立消息领域；
- River 是统一异步时间阅读面；
- Library 内包含平级的 Collection 与 Memory；
- Settings 属低频系统管理，从头像 / More 稳定可达，但不占一级产品槽位。

这不是对移动端底栏具体四项呈现的机械要求。移动端与桌面端可使用不同的导航控件，但必须进入同一组 canonical routes。

### 5.2 Chat 首页：继续工作页

Chat 首页的第一目标是让 Alicia 以最少操作继续最近交流，不建设泛化 Dashboard。

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

聊天页同时展示 Agent 与 Project / Drift 上下文。从列表进入时，浏览器历史负责返回来源；直接打开链接时，默认返回 Chat 首页。

GroupChat 使用独立 canonical route，例如：

```text
/groups/:groupId
```

最终 route 名称可在施工计划阶段统一，但“同一实体只有一个详情实现”是固定约束。

## 6. Library 架构

### 6.1 Collection 与 Memory 平级

Library 共享应用壳，但不把所有长期内容塞进同一张 Memory 列表：

```text
Library
├── Collection   主动决定留下、翻看与再次使用的藏品
└── Memory       Agent 可召回的长期记忆及其质量管理
```

Memory 使用同一底层页面与筛选模型：Agent Workspace 只提供摘要和带 Agent filter 的深链；Library → Memory 提供跨 Agent 搜索、状态筛选与整理。二者不得发展成两套 Memory 实现。

Collection 与 Memory 可以共享搜索壳、Tags 视觉和深链设施，但不共享含混的数据模型或 CRUD。

### 6.2 Memory 内部概念分离

界面必须明确区分：

1. 长期记忆：MemoryPlasmid；
2. 对话摘要：HistoryChunk；
3. Project 知识：KnowledgeFragment 与 Project files。

History 精确查找首期采用 grep-like 心智模型；这些对象可以在搜索体验中关联，但不得以一个含混的“Memory”列表混合呈现所有状态和操作。

## 7. River 与异步领域边界

### 7.1 River 是 read model，不是统一业务表

Task / Diary / Heartbeat / Memo / legacy Chronicle source 与聊天核心在代码和业务规则上分离，但共享一个应用壳，并通过 River 形成统一时间阅读面。River 不要求这些 source 写入同一 source-of-truth 表。

后端目标是提供 canonical River projection / aggregation API，使 heterogeneous source 在统一 `occurred_at` 语义下稳定分页；各 source 的 CRUD 仍由原业务领域拥有。

### 7.2 Chronicle 退役方向

旧 Chronicle 混合了用户 bookmark/highlight 与 Agent milestone/moment。V4 不继续把这种混合语义扩张成新产品领域：

- highlight → Collection migration / promotion 候选；
- milestone / moment → 可作为 River legacy event source；
- 语义不可靠历史数据保留为 legacy archive；
- 不 destructive migration，不要求一次性人工清洗全部历史条目。

### 7.3 Task、Calendar、Memo 与 Diary

- 未完成 Task 在 River 顶部 Open Tasks shelf 持续可见，同时保留主时间轴原事件；
- Calendar 是 Task 等时间数据的陪伴视图，不复制 source；
- Memo 优先由现 Timeline/Tweet 领域演化，并保留其局部 reply thread；
- Diary 在 River 中展示短 preview，点击阅读全文；popup / drawer / inline 属 UI 呈现，不改变 API 核心契约。

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

- 产品一级区域是 `Chat / Groups / River / Library`；Agent / Project 是 Chat 内的高频索引入口。
- 进入具体聊天后，应允许隐藏移动端底栏，给消息区域完整空间。
- Settings 必须稳定可达，但不占高频一级产品槽位。
- 桌面与移动端共享路由和领域页面，不维护两套业务实现。

### 9.2 待比较方案

移动端底栏不在 Spec 阶段机械等同于四个产品区域。App Shell 低保真原型应比较：直接展示 `Chat / Groups / River / Library`，或在小屏用其中一项换成 More / 对象快捷入口。

无论视觉呈现如何变化，canonical product areas 与 routes 不因移动端底栏限制而改变。

## 10. 前端技术边界

### 10.1 基础技术

V4 推荐使用：

- React + Vite；
- TypeScript strict；
- React Router；
- TanStack Query 管理普通服务端状态；
- React Hook Form 管理复杂表单。

不因重写默认引入 SSR 框架。

V4 默认继续位于现有 `ExoCore-Desktop` 仓库，新建独立主 SPA package，而不是直接在旧 `chat-core` 上原地堆叠。旧 `chat-core`、`chronicle`、`council` 在迁移期间继续作为可运行行为基线。

不开新 repo 是当前默认，而不是永久禁令。只有当独立构建、部署、权限或发布生命周期形成无法在 monorepo 内合理隔离的硬约束时，才升级为 repo split 决策；“前端可以重写”本身不足以成为再搬仓理由。

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

- V4 在 `ExoCore-Desktop` 内采用独立新应用 package，但不一次性删除 V3。
- 旧前端是迁移期间的可运行行为参照。
- 按完整用户路径纵向迁移，不按“先建完所有 API 层、再建所有 UI 层”横向堆积。
- 每个迁移切片必须可独立验证，并保留回退到 V3 的能力。
- 音频、附件、regenerate、branch、cache、tool events 等复杂聊天能力必须逐项建立行为清单，不因界面重写而静默丢失。
- V4 开工前必须冻结 V3 capability matrix 与可运行 baseline/checkpoint；之后每个 phase 独立维护自己的 entry gate、exit acceptance 与 rollback point。

## 13. 架构验收标准

后续 Implementation Plan 必须覆盖以下可验证目标；本 Spec 不冻结测试实现细节：

1. 单次构建产生一个主要 Web/PWA 应用，不再要求用户在 chat-core 与 chronicle SPA 间切换。
2. Chat 首页可进入最近普通 Conversation 和最近 GroupChat，并能辨识两者类型。
3. 同一 Conversation 可从 Agent 和 Project 两种入口打开，最终进入同一个 canonical chat 实现。
4. Agent 页面支持按 Project / Drift 缩小会话范围；Project 页面支持按 Agent 缩小范围。
5. 列表筛选不复制或生成第二份 Conversation。
6. GroupChat 不调用普通 Conversation 专属接口。
7. Agent Memory 深链和 Library 内 Memory 入口进入同一管理实现，并正确应用 Agent 筛选。
8. MemoryPlasmid、HistoryChunk、Project Knowledge 在名称、状态和可用操作上可区分。
9. Task 模块故障不得阻断聊天核心启动与使用。
10. Settings 保持可达，现有对接在未获单独批准前不被改写。
11. 桌面与移动端不复制业务逻辑；具体 Chat 在移动端具有不被常驻底栏挤压的完整消息区域。
12. SSE 运行、停止、恢复、终态与错误展示具有明确控制边界，不再由巨型页面组件直接承担。
13. Web 平台能力与未来 Capacitor 平台能力通过接口隔离。
14. V3 尚未迁移的能力有显式清单，不得以“重写”为由被默认视为废弃。
15. River 与 Library 均使用单 SPA canonical routes，不重新形成独立 chronicle/memory SPA。
16. Collection 与 Memory 在 Library 中可导航关联但业务模型分离；旧 Chronicle 不作为 V4 新数据的默认写入领域。

## 14. 开放决策

以下事项不阻塞 Spec 起草，但必须在对应施工阶段前冻结：

| 决策 | 冻结时点 |
|---|---|
| 移动端底栏最终四项与 More 交互 | App Shell 原型验收前 |
| Memo 最终直接演化现 Timeline/Tweet 还是建立兼容层后替换 | River detailed plan 前 |
| River heterogeneous sources 的 canonical `occurred_at` / cursor 契约 | River backend contract plan 前 |
| Recall run identity / RecallReceipt 的后端数据模型 | Recall Observability detailed plan 前 |
| Collection managed storage 的物理生命周期与 GC 细节 | Collection backend contract plan 前 |
| Capacitor 使用内置静态资源或 `server.url` | Android 施工计划前 |
| Council 后端是否退役 | V4 稳定后单独决策 |

## 15. 后续文档边界

本 Spec 收口后，规划必须分成两个层级，禁止一次性预测整个 V4 的源码级施工细节：

1. **Master Roadmap**：只冻结 phase 边界、依赖、backend handoff、entry/exit gate、rollback/checkpoint 与 V3 capability matrix；
2. **Per-Phase Detailed Plan**：仅在对应 phase 即将开工时，根据当时真实源码写文件、组件、API 与测试级施工清单。

Master Roadmap 不负责 Phase 1 之后的源码级文件预测；每个 phase 验收后再起草下一阶段 detailed plan。

本 Spec 不直接充当施工清单。

---

**主要作者：** gpt-5.6-sol / Solaire — 2026-08-02
**调研贡献：** Gemini 3.6 Flash / Alaric
**产品决策人：** Alicia
