# V4 Chat — Dispatch Target Precedence Repair（F1）

**状态：** 施工授权（Alicia 2026-09-18："F1 改"）
**风险：** 低-中。只改 V4 聊天派发时的 settings 取值优先级与可观测性；不动 transport、lease、reconcile 状态机，不动后端契约。
**触发事故：** 2026-09-18 AGY（Subscription Runtime）端点"发送即断开"。判别链见 `../.agent`→ 本仓日志与 `ExoCore/DevelopLog/DebugLog.md` 2026-09-18 条。

---

## 1. 目标（goal）

修复"**用户当前选中的目标 ≠ 实际派发的目标**"这一类静默分叉：

- 用户把执行目标切到 AGY（`gemini-3.1-pro-preview` + endpoint 7）并在 HUD 里确认后发送；
- 实际 POST 出去的却是**重放快照里的旧目标**（Direct endpoint），后端按 Direct 跑，Wire 上表现为"发出去就断"，HUD 与后端两边都看不到原因。

## 2. 预期行为（intended behavior）

`executeTurn()` 取 settings 的优先级改为：

```
页面级校验过的当前选择（dispatchSettings）   ← 优先（这是用户此刻的意图，且已通过 catalog 兼容检查）
重放快照（turn.dispatchSettings）           ← 仅当当前选择不可用时兜底（音频重试/恢复重放）
null                                        ← 仍然 fail-closed（不落盘、不 POST，给可见错误）
```

并且在"用当前选择替换了一个不同的重放快照"时 **留痕**：一条可见 notice + 一条 `console.warn`，包含两侧的 model/endpoint。这样同类分叉下次一眼可见，而不是靠考古日志。

`undefined` 兼容缝（pre-P1D 隔离 harness）语义**保持不变**：页面根本没传 settings 时，行为与今天一致。

## 3. 范围与不变量（scope / invariants）

改动：
- `packages/app/src/features/chat/runtime/useChatRuntime.ts` — `executeTurn()` 的 `effectiveSettings` 取值 + 分叉留痕。

不动（明确排除）：
- `storage.ts` lease 语义（lease 本就不存 model/endpoint，无需改）；
- audio recovery machine 的 `capturedSettings` 语义（`null` 当前选择 + 有快照时仍用快照，避免音频重试回归）；
- transport (sse/async)、reconcile/uncertain 状态机、后端与 Runtime 契约；
- `ChatComposer` 的 `dispatchSettings === null` 提示：现状**已经可见**（状态条 + 按钮 title），本次不改（避免无收益改动）。

## 4. 验证（validation）

1. 新增前端回归：
   - 页面给出 `dispatchSettings`（enp 7）而重放快照为 endpoint 1 → POST body 必须是 `endpoint: 7`；
   - 分叉时 notice 被设置且文案含两侧 model/endpoint；
   - 页面 `dispatchSettings = null` 且**无**快照 → 仍然 rejected + `TARGET_UNRESOLVED`（fail-closed 不退化）；
   - `undefined` harness 路径（无页面 settings）→ 行为不变（POST 不带 model/endpoint，保持既有 P1D 契约测试绿）。
2. 跑 V4 app 全量前端测试（本仓约定命令），确认既有 P1C/P1D runtime 契约测试全绿。
3. 手工验证（Alicia 侧）：HUD 选 AGY → 发送 → 控制台不出现分叉 warning，且 Wire 上走 Runtime 分支（后端 `RuntimeTurn` 出现、runtime store 有写入）。

## 5. 关联

- 事故判别链：`ExoCore/DevelopLog/DebugLog.md` 2026-09-18 条；预警条目：`ExoCore/DevelopLog/warnings.md`。
- 未做的部分（Alicia 决定）：F2 不采用（自动重载新代码是必要的）；后端/runtime 两个进程的关联由她自己看。
