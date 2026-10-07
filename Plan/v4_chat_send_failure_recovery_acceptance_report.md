# Acceptance Report: V4 发送失败兜底与 AGY 录音开放

**Plan（冻结依据）:** `Plan/v4_chat_send_failure_recovery_and_agy_audio_plan.md` R1
**Acceptance:** 砚（claude-opus-5-5） **Construction:** Alaric（AGY CLI / Gemini 3.8 Flash）

## Ledger

```text
Cycle: R1 | Checkpoint: Part A + Part B | Baseline: f016570 (A), c36e93b (B) | Verdict: FAIL（Part B PASS；Part A FAIL）
Owners: Construction 1, Acceptance 0, Harness 1, Spec 0, Environment 0
Findings: F-01, F-02 | Consecutive FAIL Count: 1

Cycle: R2 | Checkpoint: Part A + Part B | Baseline: 465c018 (A, amended), fc5837e (B, 内容同 c36e93b) | Verdict: PASS
Owners: Construction 0, Acceptance 0, Harness 0, Spec 0, Environment 1（Node 25 webstorage，已诊断并记入 warnings）
Findings: P2-01, P2-02 | Consecutive FAIL Count: 0
```

## R1 结论

### Part B（c36e93b）：PASS

`audioTarget.ts` 两处仅对 `execution_type === 'managed_runtime'` 跳过 `file_uri` 检查，`audio` 能力检查保留，其他端点不变；A1–A3 测试对应。

### Part A（f016570）：FAIL

通过项（保留）：
- 422 safe 路径与 B1 分类测试；
- 确定性终态判定：async `status=error` 与 SSE `event: error` 均以 `terminal_persisted` 分类，`STREAM_INTERRUPTED` 为 `uncertain`、`not_found` 走独立 outcome，均不恢复（C6）；
- 录音轮次以 `attemptKey`（仅 audioRecoveryMachine 生成）排除（C7）；
- 附件按 `attachmentId` 去重、跳过已 purge 的 id（C8）；
- 横幅在 `releaseUi` 之后注入；
- 既有测试修改仅为给替身补 `restoreEntries`，未放宽断言。

#### F-01 P1（new）恢复文字重复拼接

- **证据**：`ChatComposer.tsx` 恢复 effect 依赖 `[restoredTurn, conversationId, compose]`；`compose` 为 `useComposeAttachments` 每次渲染新建的对象字面量；`restoredTurn` 消费后不清空，`token` 未用于去重。
- **违反**：Plan §3.4 恢复语义（一次失败恢复一次）。
- **根因**：confirmed（源码）。
- **后果**：恢复后父组件任意重渲染、或切走再切回原会话，失败文字被再次前置拼接并再次写草稿。C4 harness 父组件不重渲染，未暴露。
- **Required Outcome**：同一 `restoredTurn`（按 token）至多应用一次。
- **Suggested Direction**：ref 记录已应用 token 并将 `compose` 移出依赖；或 runtime 提供消费确认清空。
- **Verification Targets**：恢复后强制父组件重渲染多次、切换会话再切回，输入框与草稿不变。

#### F-02 P1（harness-defect）C5 未切换会话

- **证据**：`v4_send_failure_recovery.test.tsx` C5 用例全程 `conversationId: 42`，无切换、无会话 B 断言。
- **违反**：Plan §7 C5。
- **Required Outcome**：生成中真实切换到另一会话后原会话失败：新会话输入框与草稿不变，原会话草稿为原文字。若真实切换后原会话 reconcile 不执行导致草稿未写入，属生产缺陷，一并修复。

## R2 复验

### F-01：已修复（residual 关闭）

`ChatComposer` 以 `appliedRestoredTokenRef` 按 token 幂等，`compose` 移出 effect 依赖改用 ref；runtime 在新发送与会话切换时清空 `restoredTurn`。C4 增加恢复后多次强制父组件重渲染的断言。

### F-02：已修复（harness 补齐，并按 R1 授权修复生产路径）

- C5 真实切换 42 → 43 → 42：43 输入框与草稿保持空，42 草稿为原文字，切回后回填。
- 生产修复：`runReconcileStages` 对非当前 identity 在**确定性 error 终态**下仍执行落库核对、`saveConversationDraft`、清除该会话租约，跳过当前路由的 transition / `setRestoredTurn` / `setTransientError` / `releaseUi`；非 error 终态维持 LR-01 语义。`inFlightTurnsRef` 按会话隔离。
- 此改动越过 Plan §2.2"不修改锁状态机"边界，但属 R1 repair packet F-02 明确授权范围；既有 runtime 不变量套件（runtime_r4/r5/r6、lifecycle、p1b acceptance r1–r5）全量通过。

### 回归（独立复跑）

| 命令 | 结果 |
|---|---|
| `test:run src/test/v4_send_failure_recovery.test.tsx` ×3 | 8/8 ×3 |
| `test:run src/test/p1c_audio_target.test.ts` | 9/9 |
| `test:run`（全量） | 116 files，1501/1501，0 skip |
| typecheck / lint / build | 0 error / 0 warning / 成功 |

环境说明：Git Bash 中 conda 的 Node v25.7.0 默认启用内置 Web Storage，遮蔽 jsdom `localStorage`，首次全量出现 219 项与改动无关的 `localStorage.* is not a function` 失败。加 `NODE_OPTIONS=--no-experimental-webstorage` 后全过（施工方使用系统 Node 不受影响）。已记入 `ExoCore/DevelopLog/warnings.md`。

DEPLOY_STEP: 前端构建发布（无后端 / 无 migration）。Part B 录音按钮依赖 `ExoCore/Plan/runtime_attachment_mime_expansion_plan.md` 已上线的后端。

## P2（advisory）

- **P2-01 在途轮次只存内存**：`inFlightTurnsRef` 不落 localStorage。发送后离开聊天页面（ConversationPage 卸载）且错误在返回前到达时，原文字无法恢复。页面内切换会话不受影响。
- **P2-02 提交作者**：两个提交的 author 为 Alicia 本人身份，而非施工方署名；不影响功能。

**署名：** 砚（claude-opus-5-5）— 2026-10-07
