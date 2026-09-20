# V4 P2D Closure — Issues #1 / #2 Repair Plan

**状态：** 施工授权（Alicia 已授权；pane 5 / Solaire 转达）。  
**仓库：** `ExoCore-Desktop` / `packages/app`  
**基线：** `01118cfdaaadabdc68edccd99cb46fa01c6ad547`（已推送 `origin/main`）  
**问题：** [#1 historical unread arrivals can remain permanently stuck](https://github.com/XinyiS7/ExoCore-Desktop/issues/1)；[#2 latest user message can render twice while a generation is in flight](https://github.com/XinyiS7/ExoCore-Desktop/issues/2)  
**产品语义：** `[human / Alicia]`  
**原始 seam 识别与架构收口：** `[gpt / Solaire]`

---

## 1. 目标

以一个窄版 P2D closure 修复两条独立缺陷：

1. **#1 会话未读无法清空：** 首次 focused 阅读对应会话时，清除该时刻已经存在的该会话未读，不再要求历史 arrival 的精确 `message_id` 仍位于当前 newest message window。
2. **#2 最新用户消息重复：** canonical 用户消息在生成途中出现后，立即接替 optimistic 临时副本；同一逻辑用户消息任何时刻只绘制一次。

两条修复共用本 Plan，但生产代码、回归目标和提交必须保持独立，任一条返修不得夹带另一条的无关改动。

## 2. 冻结产品行为

### 2.1 #1：进入会话即消费进入快照

`[human / Alicia]` 决策：普通通讯软件语义优先。用户有焦点地进入对应会话，本身就是明确阅读动作；无需额外证明已经滚动到底端。

冻结规则：

- 进入 `/chat/<conversationId>` 且文档有焦点时，清除**首次 focused 阅读时刻已经存在**的该会话未读；
- 其他会话未读保持不变；
- 首次 focused 消费成功后才到达的新 arrival 不属于该次进入快照，继续沿用现有 canonical 精确确认语义；
- 失焦进入不清除；首次获得焦点时才截取并消费当时的该会话 backlog；
- LocalStorage 读取或写入失败时 fail-closed：未读保持，并显示现有同步错误；
- 不以是否滚动到底、arrival 是否仍在当前消息窗口、或是否逐条加载历史作为清除条件。

当前首个 canonical 页面已经在 `ConversationPage` 中默认滚到最新位置；该事实支持产品体验，但本修复不再把滚动位置当作消费前提。

### 2.2 #2：canonical 接替 optimistic

术语：

- **optimistic 用户消息：** 点击发送后，前端立即绘制的本地临时行，显示“发送中…”；
- **canonical 用户消息：** 后端已持久化、由消息历史接口返回的正式行；
- **runtime assistant：** 助手生成中的独立临时行，不属于本缺陷的替换对象。

冻结规则：

- canonical 对应项尚未出现时，optimistic 行继续提供即时发送反馈；
- canonical 对应项出现后，只绘制 canonical 用户行，optimistic 副本立即停止绘制；
- 助手生成 overlay、流式内容和终止状态不受影响；
- 不使用正文、时间戳或附件列表进行模糊匹配；
- edit、regenerate、失败恢复和 uncertain 生命周期不得被本修复重写。

## 3. 已核实的源码事实

### 3.1 #1 当前 seam

- `NotificationRuntime.tsx` 已经拥有当前 route、`currentConversationId`、LocalStorage `unreadMap`、push/poll ingest、精确消费和未读投影；进入会话消费属于其现有职责，不新建 service。
- `ConversationPage.tsx::checkAndConsumeConfirmedArrivals()` 仅在 arrival 的 `message_id` 精确存在于当前 `merged.rows` 时调用 `consumeExactArrivals()`。
- `storage.ts::consumeArrivalsByMessageIds()` 只删除同一 conversation 且 message ID 命中的记录。
- 因此，掉出 newest window 的历史 arrival 可能永久缺少精确 canonical 命中。

### 3.2 #2 当前 seam

- `useChatRuntime.ts` 在 ordinary send 开始时创建 `optimisticUser`，通常到 `releaseUi()` 才清除。
- `ConversationPage.tsx::handleScrollToLatest()` 可在 operation 尚未释放时应用 pending reconcile 或 fresh newest-window reconciliation。
- `MessageTimeline.tsx` 当前无条件先绘制 canonical `messages`，再绘制 `optimisticUser`。
- canonical 窗口一旦包含刚发送的正式用户消息，而 optimistic 尚未释放，两行会同时出现。
- `MessageView.indexInSession` 是 canonical 会话内严格递增顺序；项目现有 audio recovery 已使用“是否存在更晚 user index”作为后续用户轮次的证明。
- async ack 的 `message_id` 是 opaque runtime token，不是 timeline canonical row ID，不得拿来伪装精确消息身份。

## 4. 设计与实现边界

### 4.1 修复 #1：route-entry unread snapshot

责任位置：`packages/app/src/features/notifications/NotificationRuntime.tsx`。

实现约束：

1. 在 exact conversation route ID 发生进入/切换时启动一次 route-entry 消费尝试；不依赖 `unreadMap` 更新反复触发。
2. 使用 NotificationRuntime 已拥有的 LocalStorage API读取 durable current snapshot；不增加 `storageReady` state、不增加 route marker state、不扩展 `NotificationContextValue`。
3. 从快照中提取当前 conversation 的 message IDs，并复用 `consumeArrivalsByMessageIds()`；不得新增“清空全部未读”接口。
4. 精确消费函数继续在 mutation 内重读最新 storage：只删除快照 message IDs；并发新增的不同 message ID 必须保留。
5. 成功后用现有 `setUnreadMap()` 同步 UI 投影。
6. 若进入时失焦，使用 route-scoped focus listener 延后本次尝试；route 切换或组件卸载必须清理 listener。
7. 快照读取与消费流程一旦成功完成（包括快照为空），本次 route 进入即进入终态：必须停止并清理本次 focus 重试 listener，后续失焦/聚焦不得再次截取或消费 route-entry 快照；只有失败的尝试才可在后续 focus 时重试。切换离开后再次进入同一 route 视为新的一次进入。
8. 读取/写入失败时复用现有 `syncError` 可见错误，不标记成功；之后重新获得焦点或重新进入可再次尝试。
9. 保留 `ConversationPage` 当前 canonical 精确确认逻辑，用于处理进入之后的新 arrival。

持久状态增量：**零**。允许 route effect 内部使用局部闭包变量防止一次进入重复执行，但不得演化为第二套 notification 状态机。

### 4.2 修复 #2：canonical user index proof

责任位置：

- `packages/app/src/features/chat/runtime/types.ts`
- `packages/app/src/features/chat/runtime/useChatRuntime.ts`
- `packages/app/src/features/chat/MessageTimeline.tsx`

实现约束：

1. ordinary send 创建 `optimisticUser` 时，从 `persistedRowsRef.current` 捕获发送前最后一个 canonical user `indexInSession`；空会话使用明确的无前序边界表达。
2. `OptimisticUserRow` 仅增加一个内部顺序边界字段；不得增加 React state、持久化字段或后端字段。
3. Timeline 使用纯判断：当前 canonical rows 中存在 user row 且其 `indexInSession` 晚于发送前边界时，视为 canonical replacement 已出现。
4. replacement 已出现时不绘制 optimistic 用户行；canonical rows 始终按现有逻辑绘制。
5. runtime assistant overlay 不参加该判断，生成中状态继续显示。
6. 不提前修改 runtime operation phase；隐藏 optimistic 只改变展示投影，现有 `releaseUi()` 仍负责最终生命周期清理。
7. 只有 ordinary send 创建此边界；edit/regenerate/branch 不引入新的 optimistic-user 行为。

持久状态增量：**零**。内部临时元数据增量：**一个 canonical user 顺序边界字段**。

## 5. 文件范围

### 5.1 允许修改

生产代码：

- `packages/app/src/features/notifications/NotificationRuntime.tsx`
- `packages/app/src/features/chat/runtime/types.ts`
- `packages/app/src/features/chat/runtime/useChatRuntime.ts`
- `packages/app/src/features/chat/MessageTimeline.tsx`

施工回归：

- #1 优先落在现有 `packages/app/src/test/p2d_d1_arrival_reconciliation.test.tsx`；
- #2 新增聚焦 canonical/optimistic replacement 的 `packages/app/src/test/p2d_optimistic_canonical_replacement.test.tsx`；避免把 P2D 修复塞进无关 P2T 或历史 action 测试。

交付记录：

- 本 Plan；
- 如独立验收要求，可在 acceptance-owned 报告中追加最终结果，但 Construction 不得自行编辑。

### 5.2 明确禁止修改

- `../ExoCore/` 后端、数据库、arrival API 与 SSE/poll wire contract；
- `ReactSheet.md`；
- 当前 staged 的 `packages/app/src/acceptance/**`；
- 当前 staged 的既有 P2D Plan/report/spec 文件；
- V3、P2G、River、Memo；
- `Plan/Update_log.md`（局部 bug closure 不满足重大里程碑记录条件）；
- chat runtime lease、transport、stop/recovery 状态机。

## 6. 二进制验收目标

### 6.1 #1 construction verification targets

| ID | 目标 |
|---|---|
| U-01 | focused 进入 conversation A 后，A 在进入前已有的 arrivals 被清除，即使其 message IDs 不存在于当前 canonical rows。 |
| U-02 | 同一快照中 conversation B 的 arrivals 保持不变。 |
| U-03 | A 进入完成后新 ingest 的不同 message ID 不被入口快照误清。 |
| U-04 | unfocused 进入 A 时未读保持；首次获得 focus 时，清除该时刻 A 已存在的 backlog。 |
| U-05 | storage load/write failure 时 unread 保持且出现既有可见 sync error。 |
| U-06 | 进入后的新 arrival 仍可通过现有 canonical exact-confirmation 路径消费。 |
| U-07 | focused 进入并成功完成入口消费后，先失焦、再收到新 arrival、再重新聚焦；该 arrival 保持未读，不得被第二次入口快照消费。 |

### 6.2 #2 construction verification targets

| ID | 目标 |
|---|---|
| D-01 | canonical replacement 尚未出现时，optimistic 用户行显示一次。 |
| D-02 | generation 仍在进行、canonical later-user row 出现后，同一用户消息仅保留 canonical 行。 |
| D-03 | D-02 时 runtime assistant overlay 仍然存在并继续显示生成状态。 |
| D-04 | 只有旧于或等于发送前边界的 canonical rows 时，不得隐藏 optimistic 行。 |
| D-05 | 空会话首发可以从“无前序 user”正确切换到第一条 canonical user。 |
| D-06 | operation 最终释放后，历史中仍只有一条正式用户消息。 |

测试实现细节不在本 Plan 冻结；Builder 必须以生产行为和现有真实接口为依据，不得针对 acceptance 文件断言硬编码。

## 7. 验证命令与人工复核

施工期先跑聚焦回归，再跑 V4 app 门禁：

```bash
pnpm --filter exo-app test:run src/test/p2d_d1_arrival_reconciliation.test.tsx src/test/p2d_optimistic_canonical_replacement.test.tsx
pnpm --filter exo-app test:run
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
pnpm --filter exo-app build
```

聚焦 Vitest 命令不得在 `test:run` 后插入 `--`；该写法在本仓会使文件过滤失效并运行全套测试。

全套 `test:run` 的施工门禁采用**同环境、逐失败文件/用例与修复前基线一致或改善**，不得仅以进程退出码判定。当前本机 Node `v25.7.0` 的修复前基线已知为红（suite 规模 26 个文件 / 190 个用例，包含 `window.localStorage.clear is not a function` 一类 Node 25 WebStorage 遮蔽问题；单文件运行同样可能受影响），不属于本 Plan 修复范围。Builder 必须在改动前后使用同一 Node 环境各跑一次并记录逐文件差异；本次新增/修改的聚焦回归还必须在独立验收指定的、不受该已知遮蔽问题影响的 Node 版本或容器中通过。不得为消除 Node 25 基线假红而扩张本 Plan。

人工/真机复核目标：

1. PC 与 Android 分别从会话列表进入带历史未读的目标会话：该会话徽标归零，其他会话徽标不变；
2. 在生成过程中离开底部并点击“返回最新消息”：最新用户消息只出现一次，助手继续生成；
3. 保持页面失焦进入/停留：未读不被后台清除；获得焦点后按冻结语义清除；
4. 两条 issue 的 targeted device evidence 完成后，才回到既有 P2D Final-device matrix；本 Plan 不自行宣告 Core C2 PASS。

## 8. 提交与工作区纪律

当前 9 个 staged `A` 文件是 acceptance-owned P2D 资产，施工全程保持内容与 staged 状态不变。不得 reset、unstage、改写或夹入 Builder 修复提交。

建议原子提交：

1. `docs(plan): add P2D issues 1 and 2 closure repair plan`
2. `fix(app): consume conversation unread snapshot on focused entry`（#1 + construction regression）
3. `fix(app): replace optimistic user row after canonical arrival`（#2 + construction regression）
4. 独立验收通过后，由 closure owner 收编既有 staged acceptance 资产及最终报告；Builder 不抢跑。

提交前后必须核对：

- 既有 9 个 staged acceptance assets 仍为原文件、无内容漂移；
- 修复提交只包含本 Plan 允许的生产/施工测试文件；
- 不关闭 GitHub issues，不宣告 P2D Final 或 Core C2，直到 targeted device evidence 与独立验收完成。

## 9. Adversarial Razor / Ablation

本 Plan 主动删除以下非必要方案：

- **删除 read-frontier / 滚动到底判定：** Alicia 已确认“进入会话即已读”；继续追踪滚动位置只会制造竞态。
- **删除新 storage schema / per-conversation cursor：** installation-local exact snapshot 足以解决当前缺陷。
- **删除后端改动：** 两条问题均由 Desktop 现有状态投影造成，后端契约无需扩张。
- **删除内容/时间戳模糊匹配：** 已有 canonical `indexInSession` 顺序事实，不应使用脆弱启发式。
- **删除 optimistic 生命周期重构：** 只需抑制重复展示；不重写 runtime phase/lease/recovery。
- **删除无关 hardening：** 不新增跨设备统一已读、全局清除、遥测、依赖或 UI 改版。

剩余步骤均直接服务 #1、#2 的冻结验收目标；无额外 scope creep。

## 10. 完成定义

本 Plan 的施工完成仅指：

- #1、#2 生产修复分别实现并通过聚焦回归与 V4 app 门禁；
- 两条修复有独立 diff/commit 边界；
- acceptance-owned staged 资产保持不变；
- 向 Alicia/独立验收交付具体测试目标与结果。

最终关闭 issues、解除 P2D Final Hold、补齐 real-device matrix 与盖 Core C2，仍需后续独立验收结论，不由 Builder 自行判定。
