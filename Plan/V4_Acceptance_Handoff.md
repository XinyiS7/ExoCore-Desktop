# V4 新验收窗格 Handoff（read-only 事实）

> 本文件是交接事实，不是验收 verdict、不授权任何施工。
> Desktop 仓库根：`D:\Alicia\ExoCore_Project\ExoCore-Desktop`（下文 relative 路径均相对此根）。
> Backend 仓库根：`D:\Alicia\ExoCore_Project\ExoCore`（`../ExoCore/...` 指该仓库）。
>
> **2026-10-03状态覆盖：** 本文件原始主体记录LR-01→P3准备阶段的历史交接；P3随后已获授权并通过C3最终独立验收。当前权威判定为 `Plan/V4_Phase_3_River_Memo_acceptance_report.md`；P4仍未授权。

## 0. 你的职责边界（新验收 pane）

- 只拥有**判定与证据**：核对事实、维护 verdict 与 hold/release 语义。**不做生产修改、不在Alicia授权前审阅/起草 P4 计划或 mockup、不代替 Builder 施工。**
- 机械动作（git 核对、哈希、跑测试）一律下放 scout / test-runner，不占用验收主上下文。
- 对 pane7 Builder 保持**最小打扰**：仅正式 checkpoint 或确需 Builder 处理时才联系；不催办、不代放行。
- 规则：不改真实 DB（AgentPreset ids1–8）、不跑新付费探针、不重启服务；**纯文档 closeout 不需要 RealDB baseline / 迁移 / 测试**；git 仅只读，未获明确授权不 commit。路由与模型版本不写入稳定记录，以运行时配置为准。

## 1. LR-01交接基线（2026-10-02历史快照）

- Desktop：HEAD `d46a95d`（"docs(chat): close accepted LR-01 and restore effective C2 release"），`main` 领先 `origin/main` 10 个提交（`origin/main` = `1b13b0b`）；worktree 除本 handoff（untracked）外 tracked/staged 干净。
- **pane7 的 LR-01 doc-only closeout 已落地，并经独立机械核验：VERIFIED completed，无违规（2026-10-02，核验范围 `953cae3..d46a95d`）。**
  - 纯文档：`d46a95d` 仅 8 个文档文件（DevelopLog/DebugLog + Plan/**），无生产代码 / 测试 / DB / 迁移改动。
  - 冻结 spec `Plan/V4_Chat_Foreground_Resume_acceptance_spec.md` SHA-256 仍为 `26fd8936…1e5`；验收报告 `Plan/V4_Chat_Foreground_Resume_acceptance_report.md` 与 `953cae3` 字节一致（Builder 未改写，Acceptance 所有）。
  - `Plan/V4_Core_C2_acceptance_report.md` §1–§6 与父提交逐字节一致（前缀 cmp 通过），仅追加 §7 补充：锁屏 hold 解除、有效 C2 PASS；原历史 verdict/复现未被改写。
  - 施工 memo 以 tracked rename（R084）归档为 `Plan/Archived/V4_Chat_Foreground_Resume_Implementation_Memo.md`（旧路径已不存在）；execution log / diagnosis / C2 §7 / DebugLog 对 memo 的引用均指向归档路径且可解析。
  - 元数据旧表述当时已修正：`Plan/V4_Master_Implementation_Roadmap.md`、`Plan/V4_Spec_Freeze_Index.md` §B2、`Plan/spec/2026-09-02-v4-b2-river-aggregation-handoff.md` 均记录锁屏 hold 解除、有效 C2+B2 前置满足；其后的P3状态现由本文件顶部覆盖说明及C3最终报告接续。
  - `DevelopLog/DebugLog.md` 新增条目与证据一致（1345/1345、Alicia 传输中/完成后解锁确认），未夸大（无"949 全绿"、无"P3 已释放"类表述）。

## 2. LR-01 事实（pane5 Acceptance 已收口，提交 `953cae3`）

- 冻结 spec（Acceptance 所有，Builder 不得改）：`Plan/V4_Chat_Foreground_Resume_acceptance_spec.md`，SHA-256 `26fd8936d8510e8a40a72baa8c32f00b1f464d862cbcbfd54b5e419b2a3ba1e5`（写入时实测一致）。
- 验收报告：`Plan/V4_Chat_Foreground_Resume_acceptance_report.md`
  - R1：独立自动化 checkpoint **PASS** —— exo-app 全量 `103 files / 1345/1345 PASS`，typecheck/lint/build 全绿；唯一未过为设备门，无实现 P0/P1。
  - R2：Alicia 真机证据（发送后锁屏，**传输中与完成后**分别解锁均自动恢复完整回答，无需手点"继续"）→ **Final LR-01 PASS**；据此解除锁屏引入的"有效 Core C2 hold"，保留原始 C2 PASS + 本补充修复证据（原始 C2 历史见 `Plan/V4_Core_C2_acceptance_report.md`，其 §5 advisory 不得改写成"已修复"）。
- 施工侧（pane7 所有）：`Plan/Archived/V4_Chat_Foreground_Resume_Implementation_Memo.md`（已归档）、`Plan/V4_Chat_Foreground_Resume_execution_log.md`、`Plan/V4_Chat_Lockscreen_Resume_diagnosis.md`；生产修复 `0b0d4ed`（单文件 `packages/app/src/features/chat/runtime/useChatRuntime.ts` + 新测试）。
- R2 授权 Builder 的 closeout 范围：记录已验收修复、归档对应施工计划（tracked history）、更新有效 C2/Roadmap/Freeze Index 状态与证据链接；**不得覆盖历史 C2 verdict/复现，不得宣称 B2 排除项已修复，不得未授权启动 P3**。
- 机械证据日志在 `/tmp/lr01-*`（易失）；耐久证据以已提交的 report/spec 为准，不要引用临时目录作为长期证据。

## 3. 下一步（Exact pending action）

LR-01 doc-only closeout保持VERIFIED；P3随后由Alicia批准mockup、Detailed Plan与分Checkpoint施工，并于2026-10-03取得C3 FINAL PASS。P3施工、视觉确认与最后live证据均已闭合，权威报告为 `Plan/V4_Phase_3_River_Memo_acceptance_report.md`。

**当前唯一阶段等待项：Alicia对P4 preparation的独立指示。** 在此之前：

1. 不重复LR-01/C2/B2/P3已关闭验收或机械测试；
2. 不把C3 PASS扩张为P4施工授权、product-root/P7切换、V3删除或commit授权；
3. `chronicle_highlight`及新bookmark写入仍由V3持有，直到B1及P4/C4独立门闭合。

## 4. B2 后端事实（ExoCore，只读）

- 验收报告：`../ExoCore/Plan/V4_B2_River_Backend_acceptance_report.md`（SHA-256 `721e5364aec202de2c317c3903ffc679628b0a3eb66d0bb019ca2546336474e8`）——**R5 FINAL PASS under Alicia 批准的 exact-three baseline isolation**。
- 原始 full 949：failures0 / **errors3**（3 个既有 migration-replay 标签）；仅精确隔离这 3 个标签后 **946/946 PASS**，无 skip/error。三个旧迁移缺陷**未修复、另行 pending**——不得写"949 全绿"或"已修复"。
- 已归档：`../ExoCore/Plan/Archived/V4_B2_River_Backend_Implementation_Plan.md`（及 `_Draft_Plan.md`、`river_aggregation_b2_pending.md`）；当前 `../ExoCore/Plan/` 保留 acceptance report/spec/CP4 execution log。
- ExoCore HEAD `412cf9c1`（ahead 13）；worktree 有**既存未提交** `Plan/PENDING_INDEX.md`、`Plan/presentation_attachment_producers_pending.md`（他人变更，保留勿动、勿提交）。

## 5. AGY 图片探针（边界事实）

- 证据：`../ExoCore/Plan/AGY_Image_Artifact_Probe_Evidence_2026-10-01.md`（commit `5f94506c`）。
- 真实工具证据来自 provider **step38 `output.txt`**（"Generated image is saved at <artifact path>"），非仅凭对话转述；单次付费探针已消耗，**不得重复付费**。
- 探针副本位于 `%TEMP%\exocore-agy-image-probe-63265c2b-…\*.jpg`，**非持久存储**，可能被 OS 清理；Runtime 尚无自动 artifact 导出 API，**图片桥未实现**——不得宣称 bridge 存在；后续设计须先冻结受控 capture/export seam（与 generation retirement 协调）。
- Collection 属 B1/P4 范围，不在本探针交付内。

## 6. 快速索引

| 主题 | 权威文件 | 状态 |
|---|---|---|
| LR-01 冻结行为 | `Plan/V4_Chat_Foreground_Resume_acceptance_spec.md` | Frozen（Acceptance） |
| LR-01 判定 | `Plan/V4_Chat_Foreground_Resume_acceptance_report.md` | R1 PASS / R2 Final PASS（`953cae3`） |
| LR-01 施工 | `Plan/Archived/V4_Chat_Foreground_Resume_Implementation_Memo.md`（已归档）、`Plan/V4_Chat_Foreground_Resume_execution_log.md`、`Plan/V4_Chat_Lockscreen_Resume_diagnosis.md` | 完成；memo 已归档，log/diagnosis 就地保留 |
| LR-01 closeout | `d46a95d`（8 个文档文件，无代码/测试） | 独立机械核验 VERIFIED completed（见 §1） |
| C2 历史 | `Plan/V4_Core_C2_acceptance_report.md` | PASS（hold 已于 R2 解除） |
| B2 | `../ExoCore/Plan/V4_B2_River_Backend_acceptance_report.md` | FINAL PASS（exact-three 隔离） |
| AGY 探针 | `../ExoCore/Plan/AGY_Image_Artifact_Probe_Evidence_2026-10-01.md` | 证据已提交；无图片桥 |
| P3 C3 | `Plan/V4_Phase_3_River_Memo_acceptance_report.md` | FINAL PASS（2026-10-03）；P4/P7/V3清理未授权 |
