# V4 Agent Profile — Heartbeat Page + Mailbox + Prime Conversation Companion Plan

> **状态：** APPROVED — Alicia 已授权；Pane 8 从 CP-A 开始施工
> **日期：** 2026-09-29
> **Plan owner / Acceptance：** Solaire
> **预定 Frontend Builder：** Pane 8
> **主仓：** `ExoCore-Desktop` / `packages/app`
> **后端前置：** `Plan/Archived/2026-09-29-v4-agent-profile-prime-contract-handoff.md`

---

## 0. 目标与产品定调

本施工包在进入 River B2 前，补齐 V4 Agent Profile 的三项日常能力：

1. 从 G045 Agent Profile 进入独立 Heartbeat 页面，读取 Heartbeat Ledger；
2. 在同一 Heartbeat 页面查看一次“下次自动心跳”，并管理用户小纸条与用户指定唤醒；
3. 在 Agent Profile 的会话列表中查看并设置 Prime Conversation，变更前弹出二次确认。

### Alicia 已冻结的口径

- ExoCore 产品域内 **G045 必定且只存在一个**；本轮不设计复数 G045、G045 切换或兼容分支。
- V4 的 Heartbeat、用户留言、指定唤醒和 Prime Conversation 均属于这个唯一 G045；其它 tier 不显示这些入口。
- 唯一 G045 只要已经存在正常、用户可见 Chat，就必须且只能有一个 Prime Conversation。
- 全新或重置后的系统中，第一个正常、用户可见 G045 Chat 自动成为 Prime；以后只能通过选择另一正常 Chat 排他转移。
- Council 已列入后续废弃范围，不参与 Prime 设计或验收；WezBridge / AGY bridge 属于可选外部容器，不是 Prime 候选，也不覆盖它们作为初始或唯一 Conversation 的场景。
- Prime 不允许清空；当前 Prime 必须先转移后才能删除。
- 留言入口从唯一 G045 的 Agent Profile 进入 Heartbeat 页面，不放到 Chat Composer 或全局导航。
- 下一次心跳时间只显示一个；本轮准确显示后端现有 canonical `next_auto`，UI 文案为 **“下次自动心跳”**。
- 用户预约唤醒单独列在页面中，不伪装成自动心跳，也不与 Agent 自身内部 wakeup 合并。
- Prime 星标不能因误触立即迁移：点击未选中的星标后必须二次确认。
- 点击当前 Prime 的实心星不发写请求；系统不存在“取消所有 Prime”这一产品语义。
- 验收以真实可用行为为中心，不扩张为多 tier 权限体系或复杂敌对输入工程。

### 本轮不是

- 不修改 Heartbeat policy、cadence、暂停/恢复规则；
- 不把小纸条写进普通 Conversation 或 System Prompt；
- 不展示、取消或推断 Agent 自己创建的内部 wakeup；
- 不迁移 V3 的整页视觉实现或直接 import V3 组件；
- 不建设 River 聚合、Memo、Collection、Memory Library；
- 不以本 companion 自动宣称 Core C2 ownership transfer；
- 不处理 Agent 名称、头像、模型、System Prompt 编辑。

### 历史文档与测试的 rebaseline

Alicia 已授权直接修正 P2A/P2C 文档中的复数 G045 fixture、数组 map 与“多选”措辞；原因与 old/new hash 记录在 `Plan/2026-09-29-g045-singleton-invariant-doc-rebaseline.md`。历史 acceptance/baseline 文件继续保留当时的原始 hash，作为 point-in-time 证据。

CP-D 同步把 P2A/P2C 测试中的双 G045 fixture 改为真实 singleton fixture；不为不存在的第二个 G045 保留产品分支。

本 Plan 仅在 Prime 删除边界上 supersede `Plan/V4_P2_Conversation_Delete_T0_Disposition.md` 的“no prime redesign”：当前 Prime 不得直接删除，必须先转移。其它删除生命周期仍由原 T0 契约拥有。

---

## 1. 已验证基线与仓库边界

### 1.1 Desktop 基线

- `ExoCore-Desktop` 当前 HEAD：`8498327`，`main` 比 `origin/main` ahead 1；该提交属于既有 V4 Chat UX polish，已提交但尚未推送。
- 本施工不得改写、revert、amend 或夹带该提交；最终推送前须按实际接受范围说明它是否随分支一并到达远端。
- V4 Agent Profile 已存在：
  - `packages/app/src/features/agents/AgentProfilePage.tsx`
  - `packages/app/src/features/agents/api.ts`
  - `packages/app/src/features/agents/queries.ts`
  - `packages/app/src/features/agents/projection.ts`
  - `packages/app/src/features/agents/agents.css`
- V4 当前尚无 heartbeat feature、typed client、route 或测试。

### 1.2 V3 仅作行为参考

- `packages/chat-core/src/views/AgentProfile.jsx`：G045 Profile 的 `Heartbeat Ledger` 入口；
- `packages/chat-core/src/views/AgentMemory.jsx`：事件列表、详情、分页和状态展示；
- `packages/shared/src/endpoints/heartbeat.js`：旧 JS endpoint wrapper。

V4 必须使用自身 TypeScript adapter、query 和视觉体系，不从 V3 import 页面、组件或状态。

### 1.3 后端已完成部分

下列能力已实现并通过后端验收：

- `GET /api/heartbeat/events/`；
- `GET /api/heartbeat/events/<session_uuid>/`；
- `GET /api/heartbeat/queue/?preset_id=<id>`；
- `POST /api/heartbeat/notes/` 与 `DELETE /api/heartbeat/notes/<note_id>/`；
- `POST /api/heartbeat/wakeups/` 与 `DELETE /api/heartbeat/wakeups/<task_id>/`；
- `UserZettelchen` 按时间顺序注入下一次 Heartbeat Initial User Background；
- 用户指定唤醒只暴露和取消 `heartbeat_launch_source="user"`；
- `Conversation.is_prime` 字段与 `ConversationService.set_prime_conversation()` 的顺序转移基础。

### 1.4 已确认的后端缺口

Prime 字段和转移 service 已有，但完整产品不变量尚未落地：

- live `agents.serializers.ConversationSerializer` 未暴露 `is_prime`，V4 读不到，PATCH 分支也不可达；
- G045 首个正常、用户可见 Chat 当前不会自动成为 Prime；
- 当前 Prime 仍可被直接删除，随后形成零 Prime；
- 数据库没有“同一 AgentPreset 至多一个 Prime”的约束；
- AgentPreset 写路径尚未完整保护“唯一 G045 不可被移除或复制”的产品事实。

该缺口必须由 ExoCore Builder 按 companion handoff 窄修；Pane 8 不得跨仓修改后端。

---

## 2. 页面与交互冻结

## 2.1 Agent Profile

G045 Agent Profile 的 Identity 区域提供 `Heartbeat` 入口，路由：

```text
/app/agents/<presetId>/heartbeat
```

非 G045 Profile 不显示该入口。本轮不为其它 tier 增加 disabled 状态、解释卡或升级提示。

仅唯一 G045 的会话列表增加 Prime 星标；其它 Agent Profile 不显示星标：

- 当前 Prime：实心星 + 可访问标签“当前主会话”；
- 非 Prime：空心星 + 标签“设为主会话”；
- 点击实心星：不发请求、不清空 Prime；
- 点击空心星：打开确认窗；
- 列表行主体继续导航到 Chat；星标必须是行链接的 sibling/独立按钮，不得嵌套进 `<Link>`，也不得因点击星标触发行导航。

确认窗：

```text
将「<会话名>」设为主会话？

阿莱之后主动发送的消息会进入这个会话。

[取消] [设为主会话]
```

说明：用户小纸条注入下一次 Heartbeat，不直接作为聊天消息写入 Prime，因此确认文案不得宣称“小纸条会直接进入该会话”。

提交期间：

- 锁住重复确认；
- 成功后关闭确认窗并刷新 canonical conversation query；
- UI 只显示服务端重新读取后的唯一 Prime，不乐观伪造第二颗实心星；
- 明确失败保留确认窗并显示错误；
- 请求结果不明确时刷新 canonical conversation query；目标已成为 Prime 即收口，否则保留错误并允许重试。

## 2.2 Heartbeat 页面结构

页面属于当前 G045 Agent，顶部保留返回 Agent Profile 的入口，并分为三块。

### A. Heartbeat 状态

只显示一个主时间：

```text
下次自动心跳
2026-09-30 09:30
```

数据口径：

- `auto_enabled=true` 且 `next_auto != null`：显示 `next_auto.effective_local`；
- 自动心跳关闭：显示“自动心跳未启用”；
- 自动心跳开启但尚无 row：显示“尚未排定”；
- `paused_until_local` 非空时，可在次级文案显示“暂停至 …”，但不得显示第二个“下一次”主时间；
- 用户指定唤醒在下方单独展示，不参与该主时间计算。

### B. 心跳信箱与用户指定唤醒

#### 小纸条

- `给下一次心跳留言` 打开轻量对话框；
- 正文 trim 后为空时不能提交；
- 成功后刷新 queue，待送达纸条按后端顺序显示；
- 每张未消费纸条显示正文、投递时间和“撤回”；
- 撤回成功后刷新；
- `409 already_consumed` 显示“纸条已被拆封，无法撤回”，随后刷新 queue；
- 页面不展示 consumed 历史纸条。

#### 指定唤醒

- `预约唤醒` 打开对话框；
- UI 使用本地 `datetime-local` + 留言正文；
- 提交时转换为后端接受的 `YYYY-MM-DD HH:MM`；
- 本轮固定 `resume_check=false`，不暴露高级选项；
- 只显示 queue 返回的用户预约 `explicit_wakeups`；
- 允许取消 pending/retryable_failed；取消成功后刷新；
- 若 `unshown_explicit_count > 0`，显示“另有 N 条预约未展开”，本轮不新增分页 API。

### C. Heartbeat Ledger

保留 V3 的核心信息能力，但不要求复制 V3 像素或复杂图形：

- 首屏读取最近 20 条 Event；
- 列表显示状态、时间、launch source、domain 和可辨识摘要；
- 点击读取该 `session_uuid` 详情；
- 详情展示 `content`、`seed_message`、`error_summary`、`finalization_reason`、`attempt_number`、`tool_history` 等现有 allowlist 字段；
- 使用 `total_count/has_more` 做上一页/下一页；
- Event API 永不 acknowledge；
- retry event 不去重、不合并成一条，保持账本完整；
- `launch_source="user"` 显示为“用户指定”；
- 本轮不实现 V3 ECG 动画、复杂筛选器或 retry 聚类视图。

---

## 3. 前端架构与目标文件

推荐建立独立 feature，避免继续膨胀 `AgentProfilePage.tsx`：

```text
packages/app/src/features/heartbeat/
├── AgentHeartbeatPage.tsx
├── api.ts
├── queries.ts
├── types.ts
├── HeartbeatMailbox.tsx
├── HeartbeatLedger.tsx
├── HeartbeatEventDetail.tsx
├── LeaveHeartbeatNoteDialog.tsx
├── ScheduleHeartbeatDialog.tsx
└── heartbeat.css
```

Profile companion：

```text
packages/app/src/features/agents/
├── AgentProfilePage.tsx
├── PrimeConversationConfirmDialog.tsx
├── api.ts
├── queries.ts
└── agents.css
```

共享 Chat DTO 边界：

```text
packages/app/src/features/chat/types.ts
packages/app/src/features/chat/api.ts
packages/app/src/features/chat/queries.ts
```

路由与 shell：

```text
packages/app/src/app/router.tsx
packages/app/src/shell/AppShell.tsx
packages/app/src/main.tsx          # 仅在新增 CSS import 确有需要时
```

文件名允许 Builder 按现有结构微调，但职责边界不得退化成一个巨型页面组件。

### 3.1 Typed adapter

V4 不直接使用 V3 的无类型 `heartbeatApi`。新 adapter 必须：

- 用 `apiFetch` 调 canonical `/api/heartbeat/...`；
- 在边界验证对象、数组、整数 ID、日期字符串与枚举；
- 解析 heartbeat 的 `{error, code}` 错误 envelope；
- 保留服务器 error code，供 `already_consumed`、`cannot_cancel` 等 UI 分支使用；
- malformed 2xx 视为 contract error；
- 写请求遵循现有 definite/ambiguous-write 区分。

### 3.2 Query ownership

建议 query keys：

```text
['agent-heartbeat', presetId, 'queue']
['agent-heartbeat', presetId, 'events', limit, offset]
['agent-heartbeat', presetId, 'event', sessionUuid]
```

规则：

- 仅唯一 G045 preset 启动 Heartbeat query；其它 Agent Profile 不提供入口；
- route preset 改变时，旧请求结果不得显示到新 Agent；
- note/wakeup mutation 只 invalidate 当前 preset queue；
- Prime mutation invalidate 现有 canonical conversations query，不另建第二套会话集合。

---

## 4. Checkpoints 与施工顺序

## Gate 0 — ExoCore G045 / Prime invariant companion

Owner：ExoCore backend Builder（非 Pane 8）。

交付：

- 固定“系统内唯一 G045”写入不变量：不能把其它 preset 改成 G045，也不能把唯一 G045 改走；
- 唯一 G045 的第一个正常、用户可见 Chat 在创建事务内自动成为 Prime；
- 同一 preset 最多一个 Prime 具备数据库 backstop，转移操作保持排他和原子；
- live conversation list/detail 返回 `is_prime`，PATCH `{ "is_prime": true }` 执行转移；
- PATCH false 被拒绝，当前 Prime 删除被拒绝；先转移后，旧会话可正常删除；
- API 与两仓 ReactSheet 同步；
- 后端 focused regression 与 DB baseline 通过。

Gate 0 未完成时，Pane 8 可施工 CP-A/CP-B，但 CP-C Prime 不得伪造 mock-only 完成。

## CP-A — Heartbeat typed client + route + read ledger

Owner：Pane 8。

- 建 typed DTO/normalizer/error mapping；
- 新增 `/agents/:presetId/heartbeat`；
- G045 Profile 添加入口；
- 完成 queue read、一个下次自动心跳时间；
- 完成 Event list/detail 与分页；
- 完成 loading/empty/error/retry 状态。

**Checkpoint 停手条件：** 独立验收 CP-A 后再进入写操作。

## CP-B — Mailbox writes

Owner：Pane 8。

- 留小纸条、撤回；
- 指定时间唤醒、取消；
- queue refresh 与服务端错误分支；
- 对话框 a11y、提交锁与移动端布局。

**Checkpoint 停手条件：** 独立验收 CP-B 后再进入 Prime。

## CP-C — Prime Conversation

Owner：Pane 8；前置 Gate 0 PASS。

- `ConversationRow`/`ConversationSummary` 增加 `is_prime/isPrime`，按现有 conversation adapter 风格归一化；
- Profile 星标与确认窗；
- PATCH true mutation；
- 成功/失败/ambiguous-write reconciliation；
- 保持会话筛选、删除、新建和导航行为不变。

## CP-D — 联合回归与文档收口

- 同步 Desktop `ReactSheet.md`；后端 companion 同步 ExoCore `ReactSheet.md`；
- 如需更新 ownership/migration record，目标为 `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md` 与 `Plan/V4_Master_Implementation_Roadmap.md`；只记录本 companion 已验收能力，是否正式关闭 Core C2 由 Alicia/独立验收另行裁决；
- PASS 后追加 `Plan/Update_log.md`；
- 主 Plan 与已被后端消费的 Prime handoff 均 `git mv` 至 `Plan/Archived/`；
- 独立验收完成后才 push accepted range。

---

## 5. 冻结验收目标（保持精简）

### A. Heartbeat 页面

1. G045 Profile 可进入 Heartbeat 页面；非 G045 不显示入口。
2. 页面只显示一个“下次自动心跳”主时间，并正确处理 disabled/unscheduled/paused。
3. 最近 Event 可读、可分页、可查看详情；GET 不产生 acknowledge 或其它写入。
4. 页面刷新后仍从服务端恢复相同 queue 和 ledger 状态。

### B. 小纸条与指定唤醒

1. 非空小纸条可创建并立即出现在待送达列表；可撤回。
2. 已消费竞态返回 409 时不误报撤回成功，刷新后移除陈旧项。
3. 本地时间预约可创建并出现在用户预约列表；可取消。
4. 页面不显示或取消 Agent 自己的内部 wakeup。

### C. Prime

1. 全新 G045 的第一个正常、用户可见 Chat 自动成为 Prime；Profile 显示且只显示一颗实心星。
2. 点空心星只打开确认窗；取消零写入。
3. 确认后服务端原子迁移 Prime，刷新后旧星消失、新星出现。
4. 点当前实心星零请求；当前 Prime 不能删除，转移后旧会话恢复可删除。
5. 标准 tier Agent Profile 不显示 Prime 星标。

### D. 机械门

由独立 test runner 执行：

```text
pnpm --filter exo-app test:run
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
pnpm --filter exo-app build
```

浏览器覆盖至少：320、390、768、1280 px；检查 Profile 星标、确认窗、Heartbeat 页面、两个写入对话框无横向溢出且键盘可操作。

不需要真实 LLM、真实 Heartbeat 执行或付费 provider；后端 API 使用可控 fixture，最终做一次本地真实 Django API 的非破坏 smoke。

---

## 6. Preserve 边界

施工必须保持：

- V4 ordinary Chat、CP-E voice、attachment polling 不变；
- Profile 现有 Agent/Project/Drift 会话筛选不变；
- `CreateConversationDialog` 与删除生命周期不变；
- V3 三个 SPA 可独立 build；
- Heartbeat Event GET 永不 acknowledge；
- 用户小纸条仍进入 Heartbeat Initial User Background，不进入 System Prompt；
- Prime 只决定主动可见消息的落点，不改变普通用户发起 Chat 的归属；
- 不触碰 River B2/P3 实现。

---

## 7. 审阅后待授权

Alicia 审阅时只需确认：

1. 页面主时间使用明确的“下次自动心跳”，而不是声称聚合所有内部 wakeup；
2. Heartbeat Ledger 采用 V4 简洁列表/详情，不复制 V3 ECG 动画；
3. 指定唤醒 UI 只用本地日期时间 + 留言，`resume_check` 固定 false；
4. Prime 确认窗采用本文案；当前 Prime 只能转移，不能清空或直接删除。

确认后，先放行 Gate 0 与 Pane 8 CP-A；后续按 checkpoint 独立验收逐段放行。
