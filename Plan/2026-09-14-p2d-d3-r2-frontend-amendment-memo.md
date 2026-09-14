# Memo: P2D CP D-3 R2 前端施工续接（explicit-ignore amendment）

- **日期**: 2026-09-14（Ecki 接棒，前一棒 builder 会话撞限中断）
- **权威**: `Plan/spec/2026-09-14-assistant-arrival-explicit-ignore-handoff.md`（frontend AUTHORIZED）；`Plan/V4_Phase_2D_CP_D3_acceptance_report.md` R2 release 章节；Solaire 施工包（10 项）。
- **目标**: 在 `packages/app` 内落地 explicit-ignore 替换契约：OS 通知/Shell 指示的「忽略」走 `POST /api/push/assistant-arrivals/<event_id>/ignore/`；body/查看/关闭零 Register ACK；删除 V4 全部 navigate/dismiss ACK 发送、重试、注册表、诊断 UI 与 SW ACK 消息；typed `ignore:{allowed:boolean}` 必填、`register_ack` 保留 required nullable legacy 且绝不用其推断 Ignore。
- **接棒时状态**: 6 个 app 生产文件已改（ReactSheet §8 与后端 f7bef663 逐字节一致；workerContract/sw.js/NotificationRuntime/NotificationsPanel/subscription 已部分完成）。剩余：ACK 残留清扫、sw.js ignore fail-closed 边界、DemoPage、construction 测试迁移、D3-R1-04 回归、证据/Update Log 事实修正、全套门禁 + 产物检查。
- **已知冻结资产冲突（需 Solaire 确认）**:
  1. 冻结 D-2 acceptance 探针仍 import ACK 导出；删除后 tsc 报错 → 需「temporarily excluded」机制。
  2. 冻结 D-1 acceptance 探针 fixture 缺 `ignore` 字段，新解析器下 3 用例实测失败 → D-1 探针同样需 Acceptance 补字段（语义未变，仅 fixture 过时）。
- **范围**: 仅 `packages/app`（生产 + 自有测试 + 文档）。不碰 `src/acceptance/**`、验收报告、spec、后端/V3/shared/nginx/依赖/真实 DB。不跑真实 provider/Sandro smoke。
- **验证**: 自有 construction 测试 + tsc + eslint + build + `git diff --check` + 生产 dist/sw.js 产物抽查（ignore action 存在、ACK 端点零引用）。完工后 STOP，交付 Solaire 做 R2 code acceptance，不自评 PASS。
- **终态（2026-09-14 23:25）**:
  - 生产：workerContract / sw.js / NotificationRuntime / NotificationsPanel / subscription / NotificationDemoPage / notifications.css / ReactSheet §8（与后端 f7bef663 逐字节一致）。
  - 测试：P2D 施工域 5 文件 81/81；新增 `p2d_d2_r1_repair_regressions.test.ts`（D3-R1-04 两回归）。
  - 门禁：tsc（app+node）0 error；eslint 0 error；vite build PASS（91 precache）；`git diff --check` clean；产物检查：ignore 分支存在、`/api/agents/registers/` 零引用、notificationclose 中性。
  - 排除机制：tsconfig.json + eslint.config.js + vite.config.ts 三处注释互引，排除冻结 D-1（fixture 缺 ignore）/D-2（ACK 契约过时）探针，待 Acceptance 补丁后回纳。
  - 环境备注：src/test 广域存在基线既有环境损坏（runtime_storage 等在 0bed2fc 即 13/13 失败，已用临时 worktree 验证），非 R2 引入，未修。
  - 工作区未提交（含此前已 staged 的冻结验收资产），等待验收方指令。
- **R3 修复（2026-09-14 23:45，响应 R2 FAIL）**:
  - D3-R2-01：`subscription.ts` 新增纯守卫 `isValidIgnoreResponse`（五字段冻结真值 + event_id 身份匹配），违约 2xx 一律 `ok:false` 可见可重试失败，删除无条件 2xx 成功兜底；矩阵测试补齐。
  - D3-R2-02：`NotificationRuntime` 的 ignore 状态改为 event_id 绑定的 `IgnoreUiState`（busy/error 相位），完成更新身份守卫——旧完成不关/不标注/不置忙新提示，同事件失败仍可见可重试；三条时序回归入 integration。
  - 机械：移除 tsconfig/eslint/vite.config 三处临时排除，默认发现重新纳入 amended D-1/D-2 与新增 D-3 冻结探针。
  - 门禁：三份 Acceptance 探针 19/19；Builder focused 5 文件 87/87；tsc/eslint/build/diff-check 全绿；全量回归与真机 smoke 按 R3 顺序暂缓。
