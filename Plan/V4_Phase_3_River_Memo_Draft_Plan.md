# V4 Phase 3 — River & Memo 前端规划草案

> 状态：Draft / preparation only；Alicia 本轮授权前端规划，不代表生产施工或 C3 放行。
> 本文按 `/plan` 格式组织。待呈现 mockup 批准、Tags 决策与 Task 创建诊断门闭合后，再冻结 Detailed Plan。
> 事实输入：`V4_Acceptance_Handoff.md`、Master Roadmap §9、ReactSheet §3.11–3.13、Page Skeleton 的 River checklist、B2 handoff。
> 有效 C2 PASS + B2 FINAL PASS 已满足后端前置；不重复验收 LR-01/C2/B2。B2 的三个既有迁移测试问题仍 pending，不宣称已修复。

## 期望效果 / 施工理由

River 是生活流的统一时间阅读面，不是新的业务总表。用户进入 `/app/river`，能随手写一条无标题 Memo、沿同一时间轴阅读 Memo / Heartbeat 最终总结 / Diary / legacy milestone-moment / Task，并处理未完成任务。

- 顶部长期展示 **River flows in you.**；Open Tasks shelf 保持未完成事项可见。
- 主轴使用后端全局游标，不在前端请求五种列表再 merge。
- Memo 的全部回复保持局部关系，不占主轴；Diary 由 preview 进入 canonical 全文。
- Calendar 是同一批任务/日程的陪伴视图，不复制 Task。
- C3 只在 River read path + source actions 验收后转移相应 ownership。

产品方向：[gpt / Solaire] 维持已冻结的 River / Collection / Memory 分界，不借 P3 扩建 Library。

## 1. 待批准的呈现建议（不是已冻结决策）

| 界面 | 建议 |
|---|---|
| River 主视图 | 主题句 → 轻量 Memo 输入 → Open Tasks shelf → 带类型标记的单一纵向时间轴；Calendar 作为陪伴入口 |
| Memo thread | 原位展开，回复 composer 明确当前回复对象；根据 parent_id 保留任意层级关系，小屏限制视觉缩进而不丢关系 |
| Diary 全文 | 桌面阅读抽屉，小屏全屏阅读；显示 Agent 与 canonical day，不把03:00排序锚点标成真实写作时间 |
| Task | shelf 与事件卡打开同一来源详情/编辑面；完成、延期、编辑按来源接口提交 |
| Legacy event | 标注历史来源，详情/编辑/删除不伪装成 Memo；删除须确认 |
| Heartbeat | 卡片只呈现最终总结；“查看运行记录”定位到已有 V4 Ledger 的对应 session |

Mockup 必须覆盖：主视图、Memo 多层回复、Diary preview→全文、来源详情/编辑、Calendar，及小屏状态。Alicia 批准后才写成冻结表现。[gpt / Solaire]

### Tags / 附件的真实能力边界

- Memo POST/reply 仅接收 `{content}`；后端不自动解析 `#tag`。Tags 只能经独立 PATCH 替换。
- 建议批准一个最小前端路径：从正文提取内联 Tags，并在创建/回复成功后 PATCH Tags；正文原样保留。提取语法与回复是否同样提取必须在冻结时明确。
- 这不是原子提交：若第二步失败，明确显示“记录已保存，标签未保存”，只重试 Tags，绝不重发 POST 造成重复 Memo。未获批准前，不把这一方案写成实现要求。
- Memo 正文编辑/删除、独立全局 Tag 管理、附件上传均没有本期已实现契约。P3 草案不展示这些虚假操作；如 Alicia 要求附件首发，须另写 `Plan/spec/` 后端需求并等待该仓代理交付，不跨仓施工。

## 施工顺序

以下新路径和签名为拟定接口；现有符号/行范围由只读 scout 核实，冻结前须按当时源码重新定位。不是可以直接执行的 Builder 工单。

### 0. 闭合准备门

1. 批准上述 mockup 表现与 Tags 的最小方案；不要求批准额外产品能力。
2. Task 创建 KF-07：`Plan/V4_Phase_0_Baseline/V3_Baseline.md:140` 仍记 reported/undiagnosed。Roadmap §9 的措辞不能当作修复证据；先取得独立诊断记录。若 baseline FAIL，作为单独 bugfix，不夹入 River migration。
3. 冻结时核对实际 B2 契约，并在 B2 handoff 最后一项记录来源证据；本次已完成只读接口核查，不重跑后端验收。
4. Calendar 历史回溯限制有独立 pending；不得擅自修补后端快照。冻结计划须明确当前数据覆盖与缺失状态，避免把缺数据月份显示为“没有日程”。

### 1. 来源 API 与类型层

- 新建 `packages/app/src/features/river/`、`memo/`、`tasks/`、`diary/`；沿现有 feature 的 `api.ts / types.ts / queries.ts` 风格，不新增依赖。
- 新增 endpoint wrappers 放在 `packages/shared/src/endpoints/`，由 `packages/shared/src/index.js:21–36` 导出；app API 层负责类型和响应规范化，view 不直接调用第三方/底层请求。
- 拟定：`riverApi.listRiver(params)`、`riverApi.getOpenTasks()`；`memoApi.createMemo(content)`、`getMemoThread(rootId)`、`replyToMemo(parentId, content)`、`updateMemoTags(id, tags)`；`diaryApi.getDiary(presetId, day)`。
- 不另建 Memo 历史列表页面：River 已承担主轴历史阅读，`GET /memos/?before_id=` 本期不必消费。
- 复用 `tasksApi`（`endpoints/tasks.js:4–48`）的来源 CRUD/complete/suspend/resume、calendar snapshots；复用 `chronicleApi`（`chronicle.js:4–20`）的详情和变更。

契约约束：
- Item identity 为 `source_type + source_id`。Task created/completed 是不同事件，不能按 entry_id 去重。
- cursor 原样经 URLSearchParams 编码回传；筛选或首页刷新开始新的遍历，不沿用旧过滤器游标。
- `preset_id` 仅影响 Diary/Heartbeat/Chronicle，不声称筛掉所有 Memo/Task。
- Open Tasks 响应是 ScheduleEntry，不是 RiverItem。
- Memo reply_count 是直接子回复数，不标为全线程总数；详情返回全部后代的平铺列表。
- Diary canonical day 是身份，occurred_at 是排序锚点。
- capabilities 是动作提示而非授权；服务器拒绝必须正常展示。

### 2. River 只读主视图

- 新建 `RiverPage.tsx` 与来源展示组件；TanStack Query 承接列表、shelf、详情状态。
- 原样保持服务端全局排序；分页期间保留已成功页面，续页错误在续页处展示并可重试，不伪装完整结果。
- 初次读取、空流、错误、加载更多、末页分别呈现。503 source_unavailable 显式展示，不静默移除故障 source 或改用多源 merge。
- 手动刷新重建首页遍历；不新增实时推送/后台轮询。“已翻过区间的新内容需刷新”与 G1 一致。
- Memo thread 和 Diary full-read 按获批 mockup 实现；Markdown 复用 app 已有安全渲染模式，不启用任意 HTML。

### 3. Memo 与来源动作

- 新建 Memo composer/thread，创建无需标题/目录；提交中阻止重复点击，失败保留输入，成功才清空。
- Tags 路径仅按获批决策实现；部分成功不得伪报全部成功。
- Task 操作从来源接口提交；延期是 PATCH 适用日期，不虚构 `/defer/`。任务类型/日期表单以现有 ScheduleEntry 契约为准，完整字段映射在 Detailed Plan 冻结时列明。
- Task 创建门通过后迁移 Task CRUD；不只提供 complete 而留下创建/编辑 ownership 真空。
- 来源变更成功后同步失效对应详情、River 与 shelf；影响 calendar 数据时失效对应 query。Chronicle event_time 变更必须重新从首页遍历。
- Chronicle 只处理 milestone/moment 来源操作，不接 highlight/bookmark。
- Heartbeat 定位：已有 `AgentHeartbeatPage.tsx:77` 用本地 selected session，当前没有 UUID deeplink。拟在 `/agents/:presetId/heartbeat` 增加 `session` query 参数，经现有 detail query 定位该条；刷新/无效 UUID 显式处理，不新增 Ledger 协议或纸条消费。

### 4. Calendar 陪伴视图

- 复用 `tasksApi.getCalendarSnapshot()` / `getTodaySnapshot()` 与来源 Task 数据，不假造 date-range 请求参数（当前 list 只有 status/entry_type/is_pinned）。
- Calendar 展示使用当前日期字段与已有快照；任务操作仍回到同一来源详情。
- 快照503、未覆盖日期与真正空集合不能混为一谈。历史回溯后端修复单独 pending，不纳入本计划。
- GCal 来源的读取沿现有接口；迁移哪些既有来源动作须在冻结表中逐项列出，不擅自扩展同步协议。

### 5. 导航与 C3 交付

- `packages/app/src/app/router.tsx:29–68`：在 AppShell 下增加获批 River/详情/Calendar 路由，保留 production basename `/app`。
- `packages/app/src/shell/navigation.ts:21–24`：River 现为 disabled；仅在明确施工与 checkpoint 暴露授权后启用，不因写本草案就切入口。
- `AppShell.tsx:6` 的 DETAIL_PATH 需按最终 drawer/page 方案决定是否调整；不无理由改变全局底栏规则。
- `src/test/shell.test.tsx:59` 的 disabled 预期随批准的入口阶段更新。
- C3 FAIL：撤回 V4 River 入口，V3 Chronicle SPA 恢复 active time owner；保留新 Memo/Task 数据与 canonical CRUD，不删数据。

## 关键文件清单

| 动作 | 文件 / 目录 |
|---|---|
| Create | `packages/app/src/features/{river,memo,tasks,diary}/`（具体组件粒度由获批 mockup 冻结） |
| Create | `packages/shared/src/endpoints/{river,memos,diary}.js` |
| Modify | `packages/shared/src/index.js` |
| Modify | `packages/app/src/app/router.tsx`、`src/shell/navigation.ts` |
| Modify（条件） | `packages/app/src/shell/AppShell.tsx`（仅最终详情路由需要时） |
| Modify | `packages/app/src/features/heartbeat/AgentHeartbeatPage.tsx`（session 定位） |
| Create / Modify | 对应 feature/API/导航测试；验收测试实现另行冻结，不在计划内嵌代码 |
| Create（后续） | P3 mockup、Detailed Plan、独立 acceptance spec 与施工 evidence，各归所属责任方 |
| Delete | 无 |

## 不变部分 / 消融检查

- 不改后端、Runtime、Extension、nginx；不重启服务、不操作真实 DB、不做付费探针。
- 不导入 V3 页面/组件；可参考旧逻辑并复用 exo-shared wrappers；V3 兼容入口与数据保留。
- 不做 Collection/Memory/Recall Lab、图片导出桥、Memo 附件后端、新 embedding、Chronicle 数据迁移。
- 不重验已关闭 LR-01/C2/B2；不顺手修三个旧 migration replay 问题。
- 不增独立 Memo 服务、第二登录系统、统一 River 写模型、自动轮询或前端 source merge。
- 暂不新建 Memo 专属历史入口、全局 Tag 管理、全局详情框架。只有本轮五种真实来源需要的 UI。
- Task KF-07、calendar 历史回溯、Memo 附件契约作为独立问题记录，不以 advisory 自动扩张 P3。

## 验证方式（仅目标 / 接口，不内嵌测试实现）

冻结后的验证仅覆盖前端消费行为；由 test-runner 执行机械流程，独立验收由 Alicia 指定。

1. 五源卡片可辨识，保持 API 排序与复合身份；游标原样传回，筛选/刷新不混旧游标。
2. 首页/续页/空流/503/无效游标状态准确，不发生静默 source 丢失或多源 merge fallback。
3. Memo 创建、任意层级回复、Tags 的已批准路径正确；回复不加入主轴；失败保留输入，Tags 部分失败不重复创建正文。
4. Diary 请求与返回符合 preset/day 身份；preview/fullread 来自 canonical content，day 精度不误导。
5. Heartbeat 默认不显示技术账本，来源入口定位正确 session，River GET 不触发 ack/唤醒。
6. Task 创建门有明确证据；CRUD/完成/延期/状态操作及 shelf/事件/详情更新一致，不复制 Task。
7. Chronicle milestone/moment 操作走来源 API，时间变更刷新遍历；highlight/bookmark 仍 V3-owned。
8. Calendar 不复制任务；缺快照/未覆盖范围不伪报为空；来源动作错误明确。
9. 获批 desktop/mobile mockup：回复对象、返回/关闭、阅读滚动、编辑/删除确认和异步状态可用。
10. 相关测试与 exo-app typecheck/lint/build 通过；C3 前做获批范围的最终前端回归，不重跑已关闭后端验收。

## 署名

主要规划：gpt / Solaire — 2026-10-02
产品批准：Alicia（本草案呈现与 Tags 决策尚待批准）
