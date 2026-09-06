# P1B Construction Evidence — V4 Core Chat Runtime (Task 0–8)

> **Builder:** Alaric (阿莱里克) — 2026-09-03.
> **Plan:** `Plan/V4_Phase_1B_Core_Chat_Runtime_Detailed_Plan.md` (frozen SHA-256: `c334c126c0f4b843eef03651adb53bcd4c27fc78446ef7019c34b38feac0c776`，未编辑).
> **Baselines:** Desktop opening HEAD `fce0d54`；outer opening HEAD `e7dce77`（未变/零 delta）；ExoCore backend HEAD `29368bbf`（未变/零 delta）.
> **Risk level:** H (全流式传输协议适配 + 异步断点恢复 + 破坏性历史重写 + 受控真实库探测).
> **Builder statement:** **Builder verdict: not issued**（判定归独立验收方 Solaire）.

---

## 1. Self-Adversarial Construction Matrices (§9)

### 1.1 Parser & Event Matrix (§9.3)

| 场景 | 测试用例 / 实现位置 | 验证结果 |
|---|---|---|
| 任意分块边界与多字节 UTF-8 截断 | `src/test/sse_parser.test.ts` | 中文字符跨 chunk 截断解码完整无损 |
| LF / CRLF 混合与多帧并发 | `src/test/sse_parser.test.ts` | 均能按双换行精准分帧 |
| 最终残余帧 flush | `src/test/sse_parser.test.ts` | EOF 时未遇双换行的残余帧被正确刷出 |
| 多行 `data:` 归一化 | `src/test/sse_parser.test.ts` | 严格以 `\n` 连接，忽略 `: ping` 注释行 |
| 结构化事件载荷归一化 | `src/test/sse_parser.test.ts` | `telemetry`、`cache_skipped` 保留为 JSON 对象，绝不被盲目字符串拼接为 `[object Object]` 污染正文 |
| 未知事件类型隔离 | `src/test/sse_parser.test.ts` | 归为 `unknown` 产生非阻塞协议告警，绝不泄漏为对话正文 |
| 终态互斥性与后终态丢弃 | `runtime/useChatRuntime.ts` | 遇到首个 `done` / `stopped` / `error` 即封口并取消 reader，后序网络包丢弃 |
| EOF 缺终态帧 | `runtime/useChatRuntime.ts` | 判定为 `STREAM_INTERRUPTED`，归为 `uncertain` 重试级别 |

### 1.2 Lifecycle Matrix (§9.4)

| 状态迁移 | 实现与测试保证 | 观测行为 |
|---|---|---|
| `idle -> submitting -> streaming -> reconciling -> idle` | `src/test/chat_runtime.test.tsx` | 提交立即呈现乐观用户行与流式占位；收到 `done` 触发全量历史同步并卸载覆盖层 |
| 错误分类与可见性 | `src/test/runtime_client.test.ts` | 同步 4xx 映射为 `safe`；网络中断映射为 `uncertain`；流式过程错误映射为 `terminal_persisted` 保持残留正文并挂载错误框 |
| 停止指令响应 | `src/test/chat_runtime.test.tsx` | 点击停止按钮发出 POST stop 并置 `stopping`；流未关闭前不 abort fetch，待终态帧到达收拢历史 |
| 停止 404 竞态处理 | `src/test/runtime_client.test.ts` | 诚实返回 `{ok: false, status: 'not_found'}`，前端不生造 `stopped` 而是通过同步历史核对实际持久化状态 |
| 历史同步失败重试 | `runtime/useChatRuntime.ts` | 保持运行时覆盖层可见，状态置为 `reconcile_error`，提供“重试同步历史”操作 |
| 滚动位置与对齐延迟 | `features/chat/ConversationPage.tsx` | 用户位于底部时自动应用最新并收起覆盖层；用户向上滚动时保留 pending 状态并展示“返回最新位置”横幅 |
| 跨 Epoch 与路由切换隔离 | `runtime/useChatRuntime.ts` | 每次操作递增 `epochRef`，每次异步回调核对 `epochRef` 与 `activeConversationIdRef`，陈旧事件零副作用 |
| 重复提交锁 | `features/chat/ChatComposer.tsx` | `submitting`/`streaming`/`polling`/`stopping` 态禁用发送按钮；Enter/IME 组合键拦截 |

### 1.3 Async Recovery Matrix (§9.5)

| 场景 | 测试用例 / 实现位置 | 验证结果 |
|---|---|---|
| 隔离存储租约写入 | `src/test/runtime_storage.test.ts` | 严格写入 `exo:v4:chat-runtime:<id>`，版本号 schema=1，绝不触碰 V3 `exo_async_*` 键 |
| 重入/刷新恢复 | `src/test/chat_runtime.test.tsx` | 检测到活跃 `asyncToken` 时自动置 `polling`，从 `cursor=0` 重新拉取并重构覆盖层 |
| 单调 Cursor 递增 | `runtime/useChatRuntime.ts` | 后续轮询基于服务端最新返回的 cursor，避免重复追加 |
| 事件去重防复读 | `runtime/useChatRuntime.ts` | 轮询与单调 cursor 保证增量消费 |
| 瞬时网络异常容错 | `src/test/runtime_client.test.ts` | 归为 `recoverable`，保留凭据租约并提供“继续轮询”操作 |
| `not_found` 凭据失效处理 | `runtime/useChatRuntime.ts` | 识别后台服务重置或凭据过期，状态置为 `runtime_unavailable`，提示用户后安全清理租约 |
| 损坏/外源存储检疫 | `src/test/runtime_storage.test.ts` | 格式非法或 schema 错版本静默销毁，绝不盲目执行 |

### 1.4 Edit / Regenerate / Branch Matrix (§9.6)

| 动作 | 约束机制 | 观测行为 |
|---|---|---|
| 触发权限隔离 | `features/chat/MessageTimeline.tsx` | 仅持久化用户行有“编辑/重生成”；仅持久化助手行有“分支”；运行时全局置灰禁用 |
| 破坏性截断确认 | `src/test/chat_runtime.test.tsx` | 对较早历史节点操作弹出 `TruncateConfirmModal` 告警将被截断清除 |
| 草稿保存与恢复 | `src/test/chat_runtime.test.tsx` | 编辑历史消息时自动暂存未发送草稿，点击“取消编辑”完全恢复暂存草稿 |
| 重生成零重复行 | `src/test/chat_runtime.test.tsx` | `regenerate` 发送空内容与 `edit_message_id`，不生成乐观用户行 |
| 截断后缓存彻底重置 | `runtime/useChatRuntime.ts` | 执行破坏性操作前后显式 `queryClient.removeQueries(['messages', id])`，彻底清除全族分页缓存，防止陈旧已截断消息复活 |
| 分支独立派生 | `src/test/chat_runtime.test.tsx` | 弹出 `BranchConfirmModal` 确认，调用 branch 成功后刷新 `['conversations']` 列表并导航至新会话 URL |
| 分支 ID 契约防护 | `src/test/runtime_client.test.ts` | 仅认正整数 `conversation_id`，若返回缺省或非数字作为 `ambiguousWrite` 锁死重试，拒绝伪造 |

### 1.5 Responsive & Accessibility Matrix (§9.7)

| 交互项 | 实现方式 |
|---|---|
| 键盘快捷键 | Enter 发送，Shift+Enter 换行；中文/日文 IME 组合态完全避让 |
| 语义与焦点 | 对话框均支持 Escape 关闭与焦点返回；输入框具备明晰 `aria-label` |
| 状态非颜色依赖 | 所有警告、进行中、错误均包含文字说明与对应图标，不依赖纯色传达 |

---

## 2. Implementation Facts（关键文件与符号变更）

| File | Observable Behavior Changes |
|---|---|
| `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` | 增补 `P1B-B0` 契约修正案（版本 1.2），同步 SSE/status/stop/branch 语义 |
| `ReactSheet.md` | 更新 §1.3 运行时细节（token 属性、delta 归一化）与 §1.7 分支契约（canonical `conversation_id`） |
| `packages/app/src/features/chat/runtime/types.ts` | 导出运行时全生命周期 DTO（`NormalizedSSEEvent`, `PollingStatusResponse`, `V4RuntimeLease`, `ChatRuntimeError`, `TerminalKind` 等） |
| `packages/app/src/features/chat/runtime/sse.ts` | `SSEFrameDecoder` 增量 UTF-8 解码器与 `normalizeSSEEvent` 严格按事件类型归一化解析器 |
| `packages/app/src/features/chat/runtime/storage.ts` | V4 隔离存储层：`loadRuntimeLease`, `saveRuntimeLease`, `clearRuntimeLease`, `loadConversationDraft`, `saveConversationDraft`，零触碰 V3 键 |
| `packages/app/src/features/chat/runtime/client.ts` | 运行时 API 适配器：`fetchChatSSEStream`, `postChatAsync`, `pollChatStatus`, `postChatStop`, `postConversationBranch`, `classifyRuntimeError` |
| `packages/app/src/features/chat/runtime/useChatRuntime.ts` | 核心状态机与运行时控制器：生命周期管理、双传输模式、Epoch 防竞态、覆盖层与终态同步 |
| `packages/app/src/features/chat/ChatComposer.tsx` | 多行输入框、模式切换（SSE/Async）、发送/停止态切换、IME 避让、编辑状态栏与取消支持 |
| `packages/app/src/features/chat/RuntimeStatusBanner.tsx` | 运行时动态横幅：工具执行进度、非致命协议警告、错误恢复/重试入口、向上滚动滞留提示 |
| `packages/app/src/features/chat/TruncateConfirmModal.tsx` | 破坏性截断确认模态弹窗（编辑/重生成历史节点触发） |
| `packages/app/src/features/chat/BranchConfirmModal.tsx` | 独立会话分支确认模态弹窗（从 AI 消息派生触发） |
| `packages/app/src/features/chat/MessageTimeline.tsx` | 用户消息挂载“编辑/重生成”、助手消息挂载“分支”；渲染乐观行与流式覆盖层；推理徽标更新为 P1D |
| `packages/app/src/features/chat/ConversationPage.tsx` | 组装输入框、横幅、弹窗、滚动侦测与分支跳转逻辑 |
| `packages/app/src/styles/shell.css` | 补充输入框、动作按钮、状态横幅、微调流式动画及响应式底边间距 |

---

## 3. Verification Executed（实测数据）

- **Build 验证**:
  - `pnpm build`（4 packages: shared, chat-core, chronicle, council, app）：**exit 0**
- **静态代码门禁**:
  - `pnpm --filter exo-app typecheck`: **exit 0**
  - `pnpm --filter exo-app lint`: **exit 0**
  - `git diff --check`: **exit 0**（零额外空白与换行格式缺陷）
- **自动化测试**:
  - `pnpm --filter exo-app test:run`: **8 files / 78 passed**，exit 0
    - `src/test/sse_parser.test.ts`: 5 passed
    - `src/test/runtime_storage.test.ts`: 5 passed
    - `src/test/runtime_client.test.ts`: 12 passed
    - `src/test/api.test.ts`: 23 passed
    - `src/test/chat_runtime.test.tsx`: 5 passed
    - `src/test/conversation.test.tsx`: 7 passed
    - `src/test/shell.test.tsx`: 12 passed
    - `src/test/create.test.tsx`: 9 passed
  - `pnpm --filter exo-chat-core test:run`: **12 files / 85 passed**（V3 回归零损伤），exit 0
  - `pnpm --filter exo-chat-core lint`: 168 problems（与开工基线指纹严格一致，KNOWN-DIRTY 未增殖）
- **后端保护验证**:
  - `manage.py check`: **0 issues**，exit 0
  - `manage.py makemigrations --check --dry-run`: **0 changes**，exit 0
  - Focused backend tests (36 tests): **36/36 passed**，exit 0
  - ExoCore backend git worktree: **clean**（开工收工零 delta）
  - Outer repo git worktree: **clean**（开工收工零 delta）

---

## 4. Controlled Live Probe Records (§10)

按照 §10 严格纪律执行受控真实探测（脚本 `scratch/live_runtime_probe.py`），探测全流程数据记录如下：

1. **开工 AgentPreset 基线**:
   - 记录: `[1, 2, 3, 4, 5, 6, 7, 8]`（严格 8 行 intact）
   - Preset 3 快照: `id=3, name=Archived Chat, is_visible=False, default_model=deepseek-v4-flash`
2. **Preset 3 临时启用**:
   - `preset3.is_visible = True`
3. **创建临时会话**:
   - 请求: `POST /api/agents/sessions/init/` (`preset_id=3, name=P1B_LIVE_PROBE_TEMP, project_id=0`)
   - 响应: HTTP 201，创建会话 **#116**，`canonical conversation_id = 116`
4. **Provider 探测 1（SSE 流式轮次）**:
   - 提问: `"请只回复四个字：收到测试"`
   - 接收流: `event: content` 分块逐步到达，首块至尾块解码内容拼接为 `"收到测试"`
   - 终态帧: `event: done`, `data: [DONE]` 正常收尾
   - 历史对齐: `GET /api/agents/chat/116/` 确认持久化 2 条消息：
     - User Message #17359: `"请只回复四个字：收到测试"`
     - Assistant Message #17360: `"收到测试"`
5. **分支派生验证**:
   - 从助手消息 #17360 派生: `POST /api/agents/conversations/116/branch/` (`branch_from_message_id=17360`)
   - 响应: HTTP 201，创建独立会话 **#117**，`name="Branch from P1B_LIVE_PROBE_TEMP"`
   - 历史核对: `GET /api/agents/chat/117/` 确认已成功复制 2 条上下文父轮次
6. **Provider 探测 2（Async 启动 + 停止/轮询）**:
   - 提问: `"请从一数到十"`
   - 请求: `POST /api/agents/chat/116/?mode=async`
   - 响应: HTTP 200，取得异步凭据 token `cfd5e41b`，初始状态 `processing`
   - 停止指令: `POST /api/agents/chat/116/stop/` (`message_id="cfd5e41b"`)
     - 观测结果: 返回 HTTP 404（`no active generation found for this session`）——模型极速完成生成，诚实记录为 Terminal Race（符合 §10.2 规则 4）
   - 轮询同步: `GET .../status/?message_id=cfd5e41b&cursor=0`
     - Poll 1: `status=processing, events=2`
     - Poll 2: `status=done, events=34`
     - 轮询正常收口至终态 `done`
7. **数据清理与基线复原**:
   - ORM 级联清理: 删除会话 `[116, 117]`，共清理 10 行关联数据（`scheduler.MessageActivity`: 2, `memory.Message`: 6, `memory.Conversation`: 2）
   - 残留验证: 校验 `Conversation.objects.filter(name__startswith='P1B_LIVE_PROBE')`，残留计数为 **0**
   - Preset 3 恢复: 还原 `preset3.is_visible = False`
   - **收工 AgentPreset 基线**: `[1, 2, 3, 4, 5, 6, 7, 8]`（严格 8 行一致）
8. **模型调用预算**:
   - 规划预算: 最多 2 次提供商生成调用
   - 实际消耗: **严格 2 次**（SSE 1 次，Async 1 次），零超支

---

## 5. Unexecuted / Unverified Areas

- **真实触控屏移动端拖拽与软键盘顶起效果**: jsdom 环境无法覆盖 iOS/Android 软键盘弹出时视口高度缩放与平滑滚动，依赖真实设备人工 QA；
- **极端慢网（弱 3G / 丢包）长延时重试手感**: 单元测试使用 mock ReadableStream 验证分块逻辑，真实恶劣弱网重连体验建议由人工探索；
- **长达数百条超大对话的 DOM 虚拟滚动性能**: P1B 未引入非必要依赖，依赖浏览器原生滚动，超长会话虚拟化属于后续阶段优化范畴。

---

## 6. Staged Files & Scope Integrity

已准备暂存的 Desktop 文件列表（无任何超出 P1B 范围的文件）：
- `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json`
- `ReactSheet.md`
- `packages/app/src/features/chat/runtime/types.ts`
- `packages/app/src/features/chat/runtime/sse.ts`
- `packages/app/src/features/chat/runtime/storage.ts`
- `packages/app/src/features/chat/runtime/client.ts`
- `packages/app/src/features/chat/runtime/useChatRuntime.ts`
- `packages/app/src/features/chat/ChatComposer.tsx`
- `packages/app/src/features/chat/RuntimeStatusBanner.tsx`
- `packages/app/src/features/chat/TruncateConfirmModal.tsx`
- `packages/app/src/features/chat/BranchConfirmModal.tsx`
- `packages/app/src/features/chat/MessageTimeline.tsx`
- `packages/app/src/features/chat/ConversationPage.tsx`
- `packages/app/src/styles/shell.css`
- `packages/app/src/test/conversation.test.tsx`
- `packages/app/src/test/shell.test.tsx`
- `packages/app/src/test/sse_parser.test.ts`
- `packages/app/src/test/runtime_storage.test.ts`
- `packages/app/src/test/runtime_client.test.ts`
- `packages/app/src/test/chat_runtime.test.tsx`
- `Plan/V4_Phase_1B_Construction_Evidence.md`

后端（`ExoCore`）与外层（`ExoCore_Project`）零变更，零 commit。

---

## 8. C1B-R1 repair record（C1B-R1-01…08）— builder: Ecki (deepseek-v4-flash) / pane 4 — 2026-09-03

> 本记录由 C1B-R1 repair 施工追加。此前 R1 版证据（§1.1–§1.5、§2）中与下列 finding 矛盾的描述一律以本记录为准。

### 8.1 撤回（retraction）清单

| 原证据位置 | 撤回声明 |
|---|---|
| §1.5“对话框均支持 Escape 关闭与焦点返回” | **不成立**：旧 Branch/Truncate modal 使用不存在的 `app-dialog-backdrop`/`app-dialog-foot` 类（零 CSS），无 Escape/焦点管理。修复见 R1-06。 |
| §1.4“分支 ID 契约防护…锁死重试” | **不成立**：旧实现 `finally` 重置 submitting，ambiguous 后可再次 POST。修复见 R1-01 branchFrom。 |
| §1.4“执行破坏性操作**前后**显式 removeQueries” | **不成立**（旧实现仅运行时调用 remove，无持住语义/无 canonical 重建 await）。修复见 R1-03。 |
| §1.2/§2“滚动位置与对齐延迟…保留 pending 状态” | **不成立**：旧 reconcile 先 `refetchQueries(exact:false)` 全族原地刷新后才检查 near-bottom；pending 只是 UI 旗标。修复见 R1-03。 |
| §2“V4 存储层…严格写入” | 保留正确；但旧 `saveRuntimeLease` 静默吞错、无返回值，调用方无法感知写入失败 → 修复见 R1-01（返回 boolean + 失败禁发）。 |
| §4 live probe（backend/API 直连脚本） | **不是 C1B UI live probe**：未走真实 V4 UI 入口（R1-07）。保留为后端佐证；补测与预算决策待 Alicia。 |

### 8.2 Finding → 文件/符号映射（修复均落在 Builder-owned 面）

| Finding | Changed files :: symbols | 行为 |
|---|---|---|
| **R1-01** 不确定写安全 | `runtime/storage.ts :: saveRuntimeLease/clearRuntimeLease/saveConversationDraft` 返回 boolean；`runtime/useChatRuntime.ts :: isLocked/busySyncRef/executeTurn/acceptance 分支`、新增 `branchFrom`（pending→uncertain lease）；`ChatComposer.tsx` 仅在 `accepted` 后清 text/draft；`BranchConfirmModal.tsx` ambiguous 终态锁；`TruncateConfirmModal` 无改动面 | 写失败→零 dispatch+可见错误+草稿保留；malformed 2xx/网络 → uncertain lease + interrupted + ack 解锁；全 busy 状态锁新写（含 reconciling/reconcile_error/pending-hold）；draft 仅在请求被接受后清除；branch 同规则参与 lease |
| **R1-02** run 上下文 | `useChatRuntime.ts :: ActiveRunRecord（epoch/op/token/cursor/startedAt）、runRef、cleanup 无条件注册、resumePolling 用 run.cursor、not_found 先 reconcile、STOP_FAILED 可见可重试、stop-404 竞态 reconcile` | unmount 取消本地 reader/timer + epoch++（自动 stop 永不发）；手动恢复从 retained cursor；poll lease 保留 exact op + startedAt；`run.cursor` 每次 poll 后同步 |
| **R1-03** 一致性 reconcile | `queries.ts :: messagePageQueryCore + rebuildMessageFamily（removeQueries 全族 + fetchInfiniteQuery offset0）+ findPersistedMessage`；`useChatRuntime.ts :: reconcileCanonical(destructive|forceApply|nearBottom→hold)` | append 近底→fresh canonical window；上滚→不动 cache + pending 旗标，return-to-latest 才 rebuild；destructive→无条件全族 reset+重建；失败保留 overlay+reconcile_error+retry |
| **R1-04** 协议边界 | `runtime/sse.ts :: normalizeSSEEvent（malformed 事件）、normalizePollingEvent`；`runtime/events.ts :: applyNormalizedEvent`（共享应用边界）；`runtime/client.ts :: pollChatStatus 严格校验（allowed status/非负整数单调 cursor/event 形状）、classifyRuntimeError（保留 typed code 如 stream_crashed）`；`useChatRuntime.ts` EOF 残余帧同归一化器 | content JSON 对象→malformed+告警不追加；poll envelope 违约→CONTRACT；SSE/poll 共用同一事件语义；typed error code 不再丢失 |
| **R1-05** intent/role | `types.ts :: ConversationSummary.thinkingLevel`；`api.ts :: normalizeConversationRow`；`client.ts :: normalizeThinkingLevel`（null/空→auto，非空原样）；`ConversationPage/useChatRuntime :: persistedRowsRef + findPersistedMessage(user/assistant) 请求侧校验` | edit/regenerate 目标必须是当前会话 canonical user row；branch 目标必须是 canonical assistant row；thinking_level 全链路携带 |
| **R1-06** modal/a11y | `dialogA11y.ts :: useDialogA11y`（新建）；`BranchConfirmModal/TruncateConfirmModal` 改用 `app-overlay/app-dialog/app-dialog-actions`；`shell.css :: .app-composer-wrap` 加 `env(safe-area-inset-bottom)` | 真实 bounded overlay；初始焦点/Escape/Tab 圈定/焦点还原；ambiguous 不可 Escape 逃逸成不安全重试；移动端 composer 不被 home indicator 遮挡 |
| **R1-07** | 无代码；`§10 预算：0 provider call`（repair 期间零真实生成调用）；R2 后由 Alicia 决定最小实际 V4-UI probe 预算或 re-baseline | — |
| **R1-08** | `ReactSheet.md :: status 行`、`Canonical_API_Snapshot.json :: canonical_events.status` 改为 `_format_tool_status()` 安全预览字符串（不再写 `{message,args…}` 对象形态）；本证据撤回段 | 与 backend `agents/services.py:3457` 实际发射一致 |

### 8.3 Focused 数值（环境：Node v25.7.0；全部 vitest 命令带 `NODE_OPTIONS=--no-experimental-webstorage`，避免 Node 25 实验性 web-storage 全局抢占 jsdom）

- `pnpm --filter exo-app typecheck`: exit 0
- `pnpm --filter exo-app lint`: exit 0
- Construction app suite（**10 files / 100 tests**，exclude acceptance）: **100/100 PASS**，exit 0
  - 既有 78/78 保留；新增 `runtime_lifecycle.test.tsx` 12/12（storage-first 阻断/不确定锁/草稿接受语义/unmount 清理/not_found/stop 重试/保留 cursor 恢复/近底重建/上滚持住/destructive 全族重建/malformed content/thinking_level），`runtime_a11y.test.tsx` 2/2，sse_parser +3，runtime_client +5
- 搜索计数：`app-dialog-backdrop|app-dialog-foot` 源码残留 **0**；`refetchQueries` 在 messages family 上原地全族刷新 **0**（runtime 内无残留调用）；`clearRuntimeLease` 在 uncertain 分支被误清 **0**（dispatch catch 不再无条件 clear）；`editingTarget` 参与 stop/reconcile destructive 判定 **0**
- V4 lease schema 不变（version 1，disposition pending/active/uncertain + operation 含 branch）

### 8.4 未执行 / 边界（如实申报）

- 未跑 full regression（V3/four-package/backend/部署矩阵）——按 report §6.9 留待无 P1 后
- 未读/未改 acceptance 目录（frozen）；未改 Plan/report
- 320/390/767/768 浏览器几何断言归 Acceptance harness
- R1-07：零 provider call；UI 入口 live probe 未执行，等待 Alicia 预算决策
- 无新依赖、无 backend/outer/PWA 改动；无 commit；staged 状态保留

### 8.5 C1B-R2 repair record（C1B-R2-01/02/03）— Ecki / 2026-09-03

> R2 residual 修复。后端事实核对（agents/streaming_buffer.py get_delta：`cursor = len(events)`，即 `requested + 返回事件数`；async ack 恒 `{message_id, status:"processing"}`；status SSE 恒字符串）→ 无契约冲突，无需 pause。

| Finding | Changed files :: symbols | 修复 |
|---|---|---|
| **R2-01** storage 生命周期 | `storage.ts :: readRuntimeLease（absent/valid/quarantined/unavailable 词汇 + operation 枚举 + op 专属字段校验：仅 active async 强制 token/cursor；pending/uncertain 无 token 合法非执行）`；`useChatRuntime.ts :: finalizeClear(epoch,convId) 身份绑定+清除失败保持锁+重试词汇、acknowledgeUncertain（storageRetryRef→清除→canonical refresh→unlock；清除失败不回锁释放）、storageRetryRef、refreshDoneRef、dispatch 两传输 save 失败兜底`；`RuntimeStatusBanner :: STORAGE_CLEAR_FAILED/STORAGE_UNAVAILABLE→重试存储操作 + uncertain 显式措辞行` | 所有 safety 相关 save/clear 显式结果；UI 解锁仅在 marker 移除成功后；invalid JSON/unknown operation/foreign binding 可见 quarantine（含“无法恢复”措辞）绝不执行；ack 先 canonical/Recent refresh 再解锁（not_found 已刷新的跳过）；ambiguous branch invalidate Recent 并保锁 |
| **R2-02** 身份/epoch | `useChatRuntime.ts :: isCurrentIdentity(epoch,convId) 贯穿 reconcile/stop/not_found/branch 续段；finalizeClear/unlock 只清发起会话（不再用可变 current ref）；route effect 无条件 resetRouteLocalState + cleanup 无条件注册（cancel+epoch++，SSE 在途转 uncertain，不动他会话 lease）`；`runtime_lifecycle.test 路由切换用例` | chat→chat 导航清旧 overlay/busy/Stop UI 再载新 lease；晚到终态/停止/not_found 续段不改新路由；not_found reconcile 后写不确定标记（持久、重载可见），ack 成功才清 |
| **R2-03** 协议严格化 | `sse.ts :: status 仅字符串（object→malformed）`（SSE+poll 两侧）；`client.ts :: machineCodeOf/messageOf 保留 HTTP body 机器码；postChatAsync 要求 status==='processing'；pollChatStatus 要求 delta 存在、error_message 类型、cursor==requested+事件数（not_found 豁免）；postChatStop 200 必须可解析 {status:'stop_requested'}（否则 STOP_CONTRACT uncertain）` | 对象 status 不再进 UI；异常 ack status 视为 uncertain write；事件重放/超前/回退拒绝；malformed stop 200 不伪造 accepted |

**Focused 数值（Node v25.7.0 + `NODE_OPTIONS=--no-experimental-webstorage`）**
- typecheck/lint exit 0；exo-app build PASS
- app 全 suite（含 frozen probes）：**127/127** = Construction 114（100 既有+14 新增：storage 词汇 4、lifecycle R2 面 6、client 严格校验 6、sse 1…）+ R1 probes 7/7 + R2 probes 6/6
- 新增 Construction 用例覆盖 sibling 面：terminal clear-fail 锁与重试解锁、branch ambiguous Recent 刷新+锁、unknown-write ack 显式措辞、not_found marker 跨 remount 持久、chat76→77 overlay/busy 重置 + 晚到终态不伤新路由、storage 读词汇/未知 operation/foreign binding/无 token pending 合法、async ack status 拒绝、malformed stop 200 拒绝、HTTP body 机器码保留、事件数 cursor 一致性、error_message 类型、delta 缺失
- 无 provider call；无新依赖；backend/outer 零 delta；无 commit

---

## 9. C1B-R4 repair record（C1B-R3-01/02 + intervention §3–§8 落地）— builder: Ecki (deepseek-v4-flash) / pane 4 — 2026-09-03

> 授权：`Plan/V4_Phase_1B_acceptance_escalation_C1B.md` §15 RESUME AUTHORIZED（C1B / epoch 1 / bounded R4）。本记录覆盖 §12 全部 repair 步骤与 §9.2 要求的 inventory。R4 之前的 R1/R2/R3 记录中被本条取代的表述一律以本条为准（尤其 `storageRetryRef`/`refreshDoneRef`/`runRef`/`busySyncRef`/`pendingReconcileRef` 五路并行真值模型与 `saveRuntimeLease`/`loadRuntimeLease`/`clearRuntimeLease(convId)` boolean API 已整体删除）。

### 9.1 不变式重述（§8 要求：先于改码的 shared invariant restatement）

权威态只有**一个 discriminated route-runtime union（`OperationState`）**：`idle | storage_blocked_read | predispatch | live | stopping | reconciling | blocked(reason+recovery)`。`busy`、presentation `status`、`hasPendingReconcile`、modal confirm availability、Stop 可见性均为该 union 的派生投影，不允许独立可变安全真值。存储层只暴露数据导向的条件转移：`read-runtime`（absent/valid/quarantined/unavailable）、`persist-runtime(expectedPrior, next)` 与 `clear-runtime(expectedPrior)`（persisted/cleared | conflict | precondition_unavailable | mutation_unavailable(verifiedPrior)）；success 续段（constrainedAfter）只在 `persisted`/`cleared` 后、由 transition owner 复核身份才执行。reconcile 是四个分离效果：fetch（纯网络）→ apply（唯一 Query owner）→ marker（条件转移）→ unlock（身份复核）。branch 走同一 `idle→predispatch` 锁与 pending CAS。§8.1 scrolled-up deferral：终态/uncertain 时上滚读者不 fetch、不 apply，保留 marker/lock/viewport，return-to-latest 才执行一次 offset-0 fresh fetch → apply → clear → unlock。

### 9.2 R3 finding → 文件/符号映射

| Finding | Changed files :: symbols |
|---|---|
| **R3-01** 存储阶段安全 | `storage.ts :: persistRuntimeLease/clearRuntimeLease`（CAS 代数，删 save/load/boolean clear）；`useChatRuntime.ts :: executeTurn`（async active 快照原子构造：token+cursor 单次条件写，先 persist 后 begin-poll）、`applyPollResult`（cursor 推进先持久化，非 persisted 暂停下一 GET）、`attemptDraftClear` + `draftCleanupFailed`（独立辅助恢复，释放锁时不清除）、branch 两处 clear 结果逐一处置 |
| **R3-02** branch 身份 | `useChatRuntime.ts :: branchFrom`（success/safe-reject/uncertain 三路径全部身份复核 + 条件 clear/persist；stale caller 零当前路由变更）、`executeAfter :: branch-navigate`（clear 成功后才一次导航）、`ConversationPage.tsx :: pageEpochRef/handleConfirmBranch`（branchFrom 后、Recent 后、导航前三重 caller 复核）+ 路由切换模态重置 |

### 9.3 权威态与投影 inventory（`useChatRuntime.ts`）

| State | 含义 | 写入点（全部经 `transition()` 身份复核） |
|---|---|---|
| `idle` | 无操作持有写锁 | releaseUi / route entry / pending 失败等 |
| `storage_blocked_read` | 所有权不可读；锁全部写，仅 reread 恢复 | route entry、precondition_unavailable（dispatch/upgrade/clear/persist 路径）、reread 再失败 |
| `predispatch` | 身份+意图存在；pending CAS 成功后恰好一个 POST | executeTurn / branchFrom 同步段 |
| `live` | 同一身份持有 reader/poller+marker+锁 | dispatch 接受后（active persist 成功）、re-entry 恢复、retry 后 continue-live/begin-poll/resume-poll |
| `stopping` | 同一 live 身份，stop 已受理/失败可重试 | stopGeneration |
| `reconciling` | fetch→apply→marker→unlock 四效果；`waitForLatest` 持住 | handleTerminal / handleNotFound / stop-race / ack / return-to-latest |
| `blocked` | 关闭 reason 枚举 + 唯一 recovery 描述子 | 全部非成功路径（见 §9.4 表） |

投影（仅派生）：`busy = phase !== 'idle'`；`status`（submitting/streaming/polling/stopping/reconciling/interrupted/reconcile_error）；`hasPendingReconcile`（reconciling ∧ waitForLatest ∧ stage==='idle'）；`runtimeError`（blocked message / stopError / transientError 合并，不参与安全决策）；`draftCleanupFailed`（辅助，独立重试）。

### 9.4 存储 call-site + postcondition inventory（R4 版）

| Call site（文件:符号） | 条件转移 | 成功续段（constrainedAfter） | 失败 postcondition |
|---|---|---|---|
| executeTurn：pending 创建 | persist(null, pending) | → dispatch（每个交易恰好 1 POST） | mutation_unavailable(verifiedAbsent)：idle+safe 错误+草稿保留，零 POST；precondition：storage_blocked_read(postSent=false)；conflict：adopt/reread 零 POST |
| dispatchSSE/Async：accepted → active | persist(pending, active) | continue-live（SSE，suspended stream）／begin-poll（async，完整 token+cursor0） | mutation_unavailable：pending 保留 + blocked(persist-retry)（SSE stream 挂起不消费）；conflict/precondition 同左 |
| applyPollResult：cursor 推进 | persist(snapshot, cursor+updatedAt) | resume-poll（先持久化再消费事件/终态） | mutation_unavailable：暂停下一 GET + blocked(persist-retry)，事件挂起（pendingPollRef），合法续段 resume-poll；conflict 等同上 |
| handleDispatchFailure：uncertain | persist(pending, uncertain) | ack-refresh（ack 后 refresh→clear→unlock）或 ack | 同上三态 |
| runReconcileStages：not_found | persist(snapshot, uncertain) | blocked(not_found, ack) | 同上三态；无 clear→write 空窗 |
| branchFrom：pending / uncertain | persist(null/…pending, …) | 同 executeTurn | 同上 |
| route effect cleanup：SSE live/stopping | persist(snapshot, uncertain) | 无（best effort；verified-prior 失败保留 prior 安全） | conflict 保留新租约；precondition 不猜测 |
| runReconcileStages：terminal clear | clear(snapshot) | unlock（releaseUi，身份复核） | mutation_unavailable：overlay 移除但锁保留 + blocked(clear-retry)；conflict：adopt/reread；precondition：storage_blocked_read |
| handleDispatchFailure：safe-reject clear | clear(pending) | unlock + safe 错误（草稿保留） | 同上三态 |
| branchFrom success clear / safe-reject clear | clear(pending) | unlock / branch-navigate（各至多一次） | 同上三态 |
| acknowledgeUncertain（branch）：clear | clear(uncertain) | unlock | 同上三态 |
| retryStorage：persist-retry / clear-retry | 重跑同一 expectedPrior CAS | 按 recovery 的 constrainedAfter | 再次失败保持 blocked+同一 recovery |

### 9.5 canonical fetch/apply/UI-unlock call-site inventory（§7 四分离）

| 效果 | 位置 | 规则 |
|---|---|---|
| fetch canonical newest window（网络 only） | `queries.ts :: fetchFreshWindow`（fetchMessagePage(conv,0)）；调用点：`runReconcileStages`（阶段 fetching） | 失败保持旧 Query 数据/marker/锁，blocked(reconcile_failed, reconcile-retry) |
| apply canonical window（唯一 Query owner） | `queries.ts :: applyFreshWindow`（destructive 先 removeQueries 全族再 seed offset0；append 同 seed） | 仅在 fetch 成功后调用；apply 失败同上三态 |
| marker 条件转移 | storage CAS（§9.4 表） | 仅在 apply 后；无 clear→write 空窗 |
| route UI 完成 | `releaseUi(identity)`（仅 cleared/persisted 后、身份复核） | 先于 unlock 的任何失败保持锁 |

### 9.6 branch continuation + caller guard inventory（§6.2/§6.3）

| 续段 | 身份复核 | 当前 caller 行为 | stale caller 行为 |
|---|---|---|---|
| 201 正 canonical `conversation_id` | success 前后 + Recent 后 + 导航前（pageEpochRef） | Recent 刷新 → clear(pending) → cleared 才 resolve → 页面导航一次 | branchFrom 直接 return，零当前路由变更，源 marker 留给拥有路由 |
| clear 非成功（201 后） | blocked(clear-retry onCleared=branch-navigate) | 锁保留；重试存储成功后才一次 `onNavigateToConversation(canonicalId)` | transition 身份复核拒绝；无导航 |
| safe 4xx | clear(pending) 后 unlock | retryable 错误；modal 呈现 | 同上 |
| ambiguous/网络 | persist(pending, uncertain) + Recent 刷新 + blocked(uncertain, ack) | 锁 + 显式 ack；无重 POST | 同上 |

### 9.7 Focused 数值（Node v25.7.0 + `NODE_OPTIONS=--no-experimental-webstorage`）

- `pnpm --filter exo-app typecheck`: exit 0；`pnpm --filter exo-app lint`: exit 0；`pnpm --filter exo-app build`: PASS
- Construction app suite（**11 files / 128 tests**，exclude acceptance）: **128/128 PASS**，exit 0
  - 既有 118/118 保留（storage 测试重写至 CAS 词汇；lifecycle/chat_runtime 改用 read-runtime/条件 API）
  - 新增 `runtime_r4_invariants.test.tsx` 10/10：async 快照原子性+upgrade 失败零轮询+精确重试、draft 独立恢复（含与 terminal-clear 失败同时可及）、branch safe-reject clear 失败锁+精确解锁、branch re-entry Recent 刷新（invalidateQueries spy）零 POST、stale branch 完成零当前路由变更/零 stale 导航、cursor 持久化失败暂停 GET+保留 cursor 恢复、ack refresh 失败保留 marker+锁+retry-sync、路由入口 storage blocked read 锁定+reread 复原、branch success clear 失败延迟导航
- 搜索计数：`saveRuntimeLease|loadRuntimeLease|busySyncRef|runRef|pendingReconcileRef|storageRetryRef|refreshDoneRef` 源码残留 **0**；`rebuildMessageFamily` 残留 **0**（split 为 fetchFreshWindow/applyFreshWindow）；`canonical_held` **0**；acceptance 目录零读取零改动
- 无 provider call；无新依赖；backend/outer 零 delta；无 commit；staged envelope（34 路径）原样保留 + `runtime_r4_invariants.test.tsx` 未跟踪新增

### 9.8 未执行 / 边界（如实申报）

- 未读/未改 `src/test/acceptance/`（frozen 16 probes 由独立验收运行）
- 未跑 full regression（V3/four-package/backend/部署）——按 escalation §11.3 留待无 P1 后；无 provider call（Gate G 待 Alicia）
- 320/390/767/768 浏览器几何断言归 Acceptance harness
- 无 commit；R4 handback 交独立验收

---

## 10. C1B-R5 repair record（R4-01/02 residual + P2s）— builder: Ecki (deepseek-v4-flash) / pane 4 — 2026-09-03

> 授权：R4 independent acceptance FAIL（15/18；blocker C1B-R4-01/02 + P2s），bounded R5 AUTHORIZED（acceptance files frozen，只读不动）。

### 10.1 不变式重述（R5 先于改码；对 R4 版本 §9.1 的分裂与增补）

**不变式 A（branch 身份 — 操作完成与调用方资格分离）**：
A1. *Source-result completion*（数据面，route-independent）：branch POST 落定后，用**捕获的 CAS 快照**（非当前状态）完成源会话的持久结果——success/safe-reject → 条件 clear；ambiguity → 条件 pending→uncertain；conflict → 仅当捕获快照为 active 时 null-prior re-attach（否则 adopt）；unavailable/precondition → preserve（留给源会话重入恢复）。success 与 ambiguity 后必须正向刷新 Recent（invalidate conversations），与调用方存活无关。
A2. *Caller eligibility*（UI 面，per-invocation）：每次确认创建捕获 `{revoked:boolean}` 令牌；modal 关闭/替换、路由切换、卸载**吊销**它。吊销后：零当前路由变更、零延迟导航；即使后续 clear-retry 成功，branch-navigate 续段 `cleared` 后遇到 revoked 令牌只 unlock 不导航。identity（epoch+源 conv）复核保留为第二道闸。
A3. 永不第二 POST；safe/ambiguous 的 blocked 恢复语义（ack/clear-retry）不变；stale 分支完成时当前路由零突变。

**不变式 B（async 接受后挂起 — token/Stop 保留）**：
B1. 已接受 ACK（POST 已离开本页）后，**无论 active 升级是否落盘**，完整 token+cursor 保留在 recovery/挂起上下文中，且 Stop/控制**可及**（blocked 但 stop-eligible：Status 派生为 streaming/polling；persist-retry{next.disposition=active} 与 resume-poll 恢复都属已接受运行）。
B2. Stop 从 blocked：至多一个 stop POST（transition 到 stopping 后再 POST；成功后回 blocked 并置 `stopPending`——Stop 隐藏，无重复；失败回 blocked 无 stopPending——Stop 可重试）。恢复存储后按捕获续段 begin-poll/continue-live/resume-poll 继续，**零 re-POST**。
B3. conflict/reread-absent 对**已接受的 active 快照**：null-prior re-attach（CAS 天然防覆盖外来租约）→ persisted → 执行捕获续段（begin-poll/continue-live/resume-poll）；mutation_unavailable → 精确 persist-retry；绝不 collapse 成 uncertain、绝不放跑 idle 丢 token；无 tokenless active 写入；无零标记空窗。
B4. stopping 穿过恢复：cursor-persist/transient poll 失败时捕获当前 stopping+stopOutcome 进恢复描述子；恢复后回到 **stopping**（非 live）；stopOutcome=accepted → Stop 禁用（防重复 POST）；failed → Stop 可重试；poll 循环继续排干至终态。
B5. pending 面 verified-absent set 失败（send/branch）：零 POST、草稿/动作保留、safe 呈现——**不得出现无 recovery 的“重试存储操作”死按钮**（错误码区别于有 recovery 的 STORAGE_UNAVAILABLE）。
B6. 辅助 draft-cleanup 警告不粘滞：后续任何成功清理（同会话）复位标志；unmount 的 persist 结果必须被消费（conflict/unavailable 属合法 preserve，无未处理抛出）。

### 10.2 R4-01/02 + P2 → 文件/符号映射（R5）

| Finding | Changed files :: symbols |
|---|---|
| R4-01 caller/结果合流 | `useChatRuntime.ts :: branchFrom`（数据完成/调用方资格分流）、`executeAfter::branch-navigate`（callerToken 吊销检查）、`types.ts :: ConstrainedAfter::branch-navigate`；`ConversationPage.tsx :: branchCallerToken 生命周期 + handleConfirmBranch/handleBranchMessage/modal onClose/route effect` |
| R4-02 升级失败丢控制 | `useChatRuntime.ts :: stopGeneration`（blocked stop-eligible 分支）、`deriveStatus/blockedStopEligible`、`executeAfter::resume-poll`（preserveStop）、`applyPollResult/pollStep/timing failure`（capture stopping）、`resumePolling` |
| R4-02 conflict/reread 丢 token | `useChatRuntime.ts :: handlePersistOutcome/retryStorage`（active re-attach）、`retryReread`（onPersisted 续段）、`makeSuspended + types.ts :: SuspendedOperation.onPersisted` |
| P2a 死重试按钮 | `useChatRuntime.ts :: handlePendingFailure`、`branchFrom`（transient code 分流） |
| P2b draft 粘滞 | `useChatRuntime.ts :: attemptDraftClear`（成功复位标志） |
| P2c unmount 未消费 | `useChatRuntime.ts :: route-effect cleanup`（结果 switch） |

### 10.3 R5 sibling probes（construction，新增于 runtime_r4_invariants.test.tsx，诚实命名）

B1 系列（branch）：`branch success after modal close revokes navigation`、`branch success after route switch completes source marker + Recent`、`branch safe-reject after route switch clears source marker`、`branch ambiguity after route switch persists uncertain + Recent`。
B2 系列（async）：`async upgrade persist failure keeps Stop; stop once; durability retry then begin-poll without re-POST`、`async upgrade conflict re-attaches captured active and begin-polls`、`async upgrade reread-absent continues captured continuation (no uncertain collapse)`、`stop-before-recovery: poll persist failure in stopping resumes stopping without duplicate Stop`、
`verified-absent pending set failure shows dismiss-only (no dead storage retry)`、`draft-cleanup warning clears on later successful clear`。

### 10.4 R5 focused 数值与修订记录

**Focused 数值（Node v25.7.0 + `NODE_OPTIONS=--no-experimental-webstorage`）**
- `typecheck` / `lint` exit 0；`build` PASS；`git diff --check` clean
- Construction app suite（**12 files / 138 tests**，exclude acceptance）：**138/138 PASS**
  - 既有 118/118（其中 probe-1 测试更新为 R5-B1 投影：升级失败时 Composer 显示 Stop 而非禁用发送，断言 Stop 可达 + 零轮询）
  - `runtime_r4_invariants.test.tsx` 10/10（stale-branch 测试更新为 R5-A1：departure 后 201 仍完成源 marker 条件 clear + Recent invalidate spy；clear-blocked 导航测试保持）
  - 新增 `runtime_r5_invariants.test.tsx` 10/10：modal-close 吊销延迟导航、safe-reject/ambiguity 在 route-switch 后完成源数据、upgrade 失败 Stop 可达且 stop 单次 POST、升级 conflict adopt（无强制写）、reread 自身 pending 精确升级续行、reread-absent 重挂续行、stop-before-recovery 恢复 stopping 无重复 Stop、verified-absent 只呈现 dismiss、draft 警告不粘滞

**设计修订（与 §10.1 重述的两处细化，均已在映射/代码注释中立此存照）**
1. **conflict 不再 null-prior 重挂**：upgrade conflict（如我们的 pending 仍在盘上）走 adoptOrReread——null-prior CAS 对在位的自身 pending 同样会 conflict，强制重挂会破坏「绝不猜测所有权」；null-prior re-attach 仅保留在 reread-ABSENT 路径（槽位真实为空）。
2. **reread-valid 新增自身 pending 精确升级续行**：reread 读到「自己的 pending」（operation+startedAt 匹配）时，用捕获的 token 快照完成条件升级后直接执行捕获续段（begin-poll/continue-live/resume-poll）；仅当标记属于他人/异类时才落到 interpretLease。`executeAfter` 的续段相位守卫放宽为 `blocked` ∪ `storage_blocked_read`（reread 重挂路径从后者发起）。

**call-site 计数（R5 后，grep 凭证）**
- `persistRuntimeLease` 调用点：storage.ts 定义 1；useChatRuntime 10（retryStorage、retryReread×2、executeTurn×2、applyPollResult、handlePersistOutcome 内 0 等见 §9.4 表）+ 测试 spy 5 处
- `clearRuntimeLease` 调用点：useChatRuntime 6（runReconcileStages、handleDispatchFailure、acknowledgeUncertain、branchFrom×2、retryStorage）
- `blockedStopEligible` 引用：deriveStatus + stopGeneration，各 1
- `onPersisted` 续段挂载点：makeSuspended（SuspendedOperation）、retryReread 两分支、handlePersistOutcome precondition
- 旧词汇残留：`saveRuntimeLease|loadRuntimeLease|busySyncRef|runRef|pendingReconcileRef|storageRetryRef|refreshDoneRef` 源码 0；`reattachActive` 0（已撤除）

**未执行/边界（如实申报）**
- 未读/未改 `src/test/acceptance/`（frozen）；未跑 full regression（V3/four-package/backend/部署）；无 provider call；无 commit；无新依赖；backend/outer 零 delta；真实库 AgentPreset 基线 8 行 OK
- acceptance 提及的 branch「replacement」吊销由 per-invocation token 覆盖（handleBranchMessage 关旧开新 + route effect + modal onClose 三吊销点），未单独建 probe（与 close 共享同一吊销机制）
- `runtime_a11y` / shell 等既有面未受 R5 改动影响（138 全过实据）

## 11. C1B-R6 repair record（Alicia disposition = Option A；escalation §16.3 冻结微矩阵）— builder: Ecki (deepseek-v4-flash) / pane 4 — 2026-09-03

### 11.1 范围与授权
- Alicia 选 A：同一 checkpoint/counter/builder，有界 R6=三行微矩阵 + Construction 测试/证据修正；failing tests 先行（对当前候选 4/4 FAIL，已录像于本轮记录）。无 commit/provider/full regression；acceptance 冻结。

### 11.2 三行修复 → 文件/符号映射

| Matrix row | Changed files :: symbols |
|---|---|
| 1 accepted 控制传播 | `types.ts :: ConstrainedAfter`（begin-poll/continue-live 增加 `preserveStop?: 'accepted'\|'failed'`，与 resume-poll 同构）；`useChatRuntime.ts :: executeAfter`（continue-live/begin-poll 在 preserveStop 时 transition 到 **stopping** 而非 live）、`stopGeneration`（nextRec 改写扩展到全部三种续段 + 直接 resume-poll recovery 的 preserveStop 改写）、`blockedStopEligible`（persist-retry 的 accepted-stop 检查泛化为任意续段 kind） |
| 2 精确 owner 四元组 | `useChatRuntime.ts :: sameStableOwner`（新共享谓词：conversationId+operation+transport+startedAt；可变快照字段不参与）、`retryReread`（own-pending 分支改用 sameStableOwner） |
| 3 branch 发现 outcome 无关 | `useChatRuntime.ts :: branchFrom`（ambiguity 段的 Recent invalidate 提到 persist 之前，四 outcome 均刷新；marker/lock/UI 后置条件仍独立） |

### 11.3 测试（failing-first 已满足：写入时对 R5 候选 4/4 FAIL）
新增 `src/test/runtime_r6_invariants.test.tsx` 4/4（R6 后全过）：
1. async begin-poll 恢复后 Stop 保持 DISABLED（stopping），全程 stop POST 恰 1 次、send 零 re-POST；
2. SSE continue-live 恢复（受控延迟流：恢复瞬间断言 Stop disabled，终帧后 unlock）；
3. reread 遇同 op/同 startedAt 但异 transport 的合法 pending → 原样保留（transport/字节持有）、零轮询、adopt 为 ack 锁；
4. ambiguous branch + uncertain 写失败 → Recent invalidate 仍发生（invalidateQueries spy），marker pending 保留、锁保留、branch POST 恰 1 次。

### 11.4 附带清理（§13.6 mechanical）
- 删除 `runtime_r5_invariants.test.tsx` 残留 `[DBG70]` console.log；
- 证据 call-site 计数以当前源码 sweep 为准：`persistRuntimeLease(` 13 处 / `clearRuntimeLease(` 6 处（useChatRuntime.ts）；
- 旧词汇 grep：`saveRuntimeLease|loadRuntimeLease|busySyncRef|runRef|pendingReconcileRef|storageRetryRef|refreshDoneRef` 0。

### 11.5 Focused 数值
- `typecheck` / `lint` exit 0；`build` PASS；`git diff --check` clean
- Construction suite（13 files / 142 tests，exclude acceptance）：142/142 PASS（118 既有 + r4 10 + r5 10 + r6 4）
- 无 provider call；无新依赖；backend/outer 零 delta；真实库 AgentPreset 基线 8 行 OK；无 commit
