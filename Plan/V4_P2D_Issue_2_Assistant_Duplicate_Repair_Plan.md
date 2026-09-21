# V4 P2D Issue #2 — Return-to-Latest Assistant Duplicate Repair Plan

**状态：** `[human / Alicia]` 已授权继续修复；Issue #2 保持 OPEN  
**仓库：** `ExoCore-Desktop` / `packages/app`  
**基线：** `da9d1ab`（已推送 `origin/main`）  
**关联：** [#2 latest user message can render twice while a generation is in flight](https://github.com/XinyiS7/ExoCore-Desktop/issues/2)  
**真机发现：** `[human / Alicia]`  
**诊断与方案：** `[gpt / Solaire]`

## 1. 问题与目标

A+ `client_turn_id` 已解决 ordinary send 的 optimistic user 与 canonical user 双画。但真机复核发现：生成期间离开底部后点击“返回最新消息”，canonical assistant 已经可被 fresh history 读取、而当前 runtime assistant overlay 尚未释放时，两份助手回复会同时绘制。

本修复只关闭这个 arrival/history application 与 active runtime overlay 的竞态：

- 点击“返回最新”仍应立即滚动到当前可见底部；
- active runtime operation 存在时，不得通过 arrival fresh-window 路径把 canonical assistant 提前并入当前 timeline；
- runtime terminal reconciliation 继续作为 canonical apply → lease clear → overlay release 的有序 owner；
- runtime idle 时，普通 pending arrival 的点击拉取、确认与未读消费行为保持不变。

## 2. 已核实根因

1. `ConversationPage.tsx` 的自动 arrival reconciliation 已有 `!busy && !controlsPending` 门槛。
2. `handleScrollToLatest()` 却无条件在 `hasPendingArrivals` 时调用 `performFreshReconciliation()`，绕过同一门槛。
3. `MessageTimeline.tsx` 正确地将 canonical messages 与 `runtimeAssistant` 都绘制；assistant 没有类似 user `client_turn_id` 的精确身份桥，不能安全地用正文、位置、时间或“任意后继 assistant”猜测并抑制其中一份。
4. Backend ordinary assistant persistence 与客户端 terminal observation 是两个可竞争的可见时刻；arrival 可以先让按钮知道 canonical assistant 已存在，而 SSE/poll terminal 尚未释放 overlay。

因此根因不在 A+ user handoff，而在“主动点击路径绕过 active-operation arrival-apply 门槛”。

## 3. 冻结行为

### 3.1 Active operation

- `busy || controlsPending` 时，点击“返回最新”立即滚动到当前 timeline 底部。
- 若是 runtime 自身的 `hasPendingReconcile`，仍执行既有 pending terminal reconciliation；该路径自身有 canonical apply / clear / release 顺序。
- 仅 `hasPendingArrivals` 时，不在 active operation 中额外执行 `performFreshReconciliation()`。
- unread arrival 保持 pending；不得提前 exact-consume，也不得丢弃。
- 当前 runtime assistant overlay 连续显示一份，不得因 canonical fresh apply 形成第二份。

### 3.2 Idle operation

- runtime 回到 idle 后，既有 near-bottom 自动 reconciliation 或后续点击继续获取 fresh newest window。
- canonical assistant 确认后按现有 exact message ID 路径消费 arrival。
- 其他会话 arrival、失焦规则、route-entry snapshot 语义均不改变。

### 3.3 禁止的替代方案

- 不按 assistant 正文、前缀、时间、index、相邻位置或模型字段去重。
- 不把任意 canonical assistant 当作当前 runtime reply；`send_message` 等独立 assistant producer 不能被误隐藏。
- 不新增 Backend 字段、SSE/poll ACK、数据库迁移或 assistant correlation contract。
- 不改变 `releaseUi()`、lease、stop、recovery、terminal reconciliation 或 A+ user exact handoff。

## 4. 实现范围

允许修改：

- `packages/app/src/features/chat/ConversationPage.tsx`
- 一个聚焦 construction regression 文件；优先放入现有 `packages/app/src/test/p2d_optimistic_canonical_replacement.test.tsx`，仅当该文件的 harness 无法表达 arrival button seam 时新增窄版 `p2d` 测试文件。
- 本 Plan 的施工证据/状态行。

不得修改：

- `MessageTimeline.tsx` 的 assistant 投影；
- `useChatRuntime.ts` operation state / reconciliation；
- Backend、API、schema、ReactSheet；
- Issue #3 的 edit-and-resend 投影行为（独立 scope）。

## 5. 实施步骤

1. 将 `handleScrollToLatest()` 的 arrival fresh reconciliation 条件与既有自动 effect 对齐：只有 runtime/control idle 才主动 fetch/apply pending arrival。
2. 保留点击开头的同步滚底，以及 `hasPendingReconcile` 的既有有序应用。
3. 增加聚焦回归，验证 active 与 idle 两侧，而不是只断言调用次数。
4. 跑聚焦、类型、lint、build 与同环境全套基线比较。

## 6. 验证目标

| ID | 目标 |
|---|---|
| A-01 | active stream、已离底、pending assistant arrival：点击后立即回到底部，但不触发 arrival fresh-window apply，页面只显示一份 runtime assistant。 |
| A-02 | A-01 的 arrival 保持未读/pending，未被假确认或丢弃。 |
| A-03 | terminal pending reconcile：点击仍完成 offset-0 canonical apply、overlay release，最终只显示一份 canonical assistant。 |
| A-04 | idle + pending arrival：点击仍 fetch/apply newest window并通过 canonical message ID exact-consume。 |
| A-05 | A+ ordinary user exact handoff保持：相同 `client_turn_id` 的 canonical user 与 optimistic user 始终只显示一份。 |
| A-06 | 独立 assistant rows 不使用内容/位置猜测隐藏；MessageTimeline assistant projection 不变。 |

建议门禁：

```bash
pnpm --filter exo-app test:run src/test/p2d_optimistic_canonical_replacement.test.tsx src/test/runtime_lifecycle.test.tsx src/acceptance/p2d_closure_issues_1_2_acceptance.test.tsx
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
pnpm --filter exo-app build
pnpm --filter exo-app test:run
```

全套继续按 Node 25 冻结基线逐失败文件/用例比较，不得把既有 26 文件 / 190 用例 WebStorage 红基线计为本修复回归，也不得顺手修测试基础设施。

## 7. Ablation / Scope Razor

最小正确修复是统一两个 arrival-apply 入口的 operation gate。若删除 active gate，真机竞态复现；若改为 Timeline 模糊去重，会误伤独立 assistant producer；若新增 Backend assistant identity，则在当前事实下属于不必要的跨仓扩张。

Issue #3 的 destructive edit projection 虽同属 timeline 观感，但操作语义、失败回滚和截断边界完全不同，必须独立设计与提交，不得夹入本修复。

## 8. 完成定义

- A-01 至 A-06 有明确自动化证据；
- 真机原路径复核不再出现 assistant 双画；
- Issue #2 可在独立验收后关闭；
- 不宣告 Issue #3 或 P2D Final 完成。

## 9. 施工记录（construction evidence）

**施工：** `[deepseek-v4-flash]`，2026-09-21，基线 `da9d1ab`；Issue 状态保持 OPEN。

**Production change（唯一）：** `packages/app/src/features/chat/ConversationPage.tsx` — `handleScrollToLatest()` 的 arrival 分支对齐既有自动 effect 门槛：

```
if (hasPendingArrivals && !busy && !controlsPending) { await performFreshReconciliation(); }
```

点击开头的同步滚底与 `hasPendingReconcile` 有序应用均保留；未改 `MessageTimeline` / `useChatRuntime` / backend / API，无 assistant 模糊去重，无 Issue #3 夹带。

**Tests（同一聚焦文件 `src/test/p2d_optimistic_canonical_replacement.test.tsx`）：** 新增 A-01/A-02（active 点击：立即回底、零 fresh fetch、单份 runtime assistant、arrival 保持未读+徽标）、A-03（away 态 terminal pending reconcile 点击：offset-0 canonical apply + overlay release + 单份 canonical assistant）、A-04（idle 点击：fresh window fetch/apply 且按 canonical message ID exact-consume）；D-01/D-04 的生成中点击断言按冻结语义更新（含确定性 fetch 计数）。A-05 由更新后的 D-01 + 既有 acceptance 用例继续覆盖；A-06 由未改动的 timeline 投影用例 + 文件未触碰保证。

**Ablation：** 临时回退 production 那 3 行 → `D-01`、`D-04`、`A-01/A-02` 三个用例确定性变红；恢复后 13/13 绿。

**门禁结果（Node 25 冻结基线 = 26 文件 / 190 用例 WebStorage 红，未修测试基础设施）：**

| 门禁 | 结果 |
|---|---|
| focused trio（p2d + runtime_lifecycle + p2d_closure acceptance） | p2d 13/13、acceptance 通过；`runtime_lifecycle` 失败集合与基线逐条 diff 一致（同 16 用例，同 `window.localStorage.clear is not a function`） |
| `pnpm --filter exo-app typecheck` | PASS |
| `pnpm --filter exo-app lint` | PASS |
| `pnpm --filter exo-app build` | PASS |
| 全套 `pnpm --filter exo-app test:run` | 26 failed / 66 passed 文件、190 failed / 906 passed 用例；失败集合与基线 diff 0 行（通过数 903 → 906 = 新增 3 用例） |

**状态：** atomic commit（本地，**未 push**）；真机原路径复核（§8 第 2 条）仍待 Alicia / 独立验收执行；不宣告 Issue #3 或 P2D Final。
