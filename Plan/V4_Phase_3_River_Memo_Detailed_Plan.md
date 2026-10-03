# V4 Phase 3 — River & Memo Detailed Plan

> **状态：C3最终独立验收PASS（2026-10-03）；详见 V4_Phase_3_River_Memo_acceptance_report.md。已放行本期归属/阶段文档收口，未授权P4施工或commit。**
> Alicia 已批准 UI 原型、D1–D5、Heartbeat 长文阅读及永久删除/类型化延期/原生任务表单三项技术映射，并明确将代码施工交给 pane7。保留原定准备门：CP0 证据闭合并获 release 前，不改生产代码、不启用 River；施工授权不等于 C3 PASS 或来源 ownership 已转移。
> 核心视觉输入：`V4_River_Memo_UI_Mockup.html`、`V4_River_Memo_UI_Mockup_Report.md`。报告顶部 Pending 状态及早期段落仍有过时措辞；本计划以报告 §三/§四、Alicia 本轮明确交接为批准证据，不改写 Alaric 所有文件。
> 契约输入：`ReactSheet.md` §3.11–3.13、Master Roadmap §9、B2 handoff。真实 API 行为优先于 mockup 模拟 alert/示例数据。
> 有效 C2 PASS + B2 FINAL PASS 前置已满足；不重复 LR-01/C2/B2 验收。原 B2 三个 migration replay 问题仍独立 pending。

## 期望效果 / 施工理由

实现一个轻量、可阅读、可操作的异步生活流：随手写 Memo、原位阅读回复、完整阅读 Diary 与 Heartbeat 长文、查看并管理任务，同时保留五种来源的独立业务身份。

**完成标准：** 五源时间阅读和本期来源操作通过 C3；Memo replies 不进入主轴；任务 shelf、详情与事件使用同一 ScheduleEntry 事实源；Library/Collection/Memory 不受影响。

### 1. 获批交互（不得由 Builder 重选）

| 决策 | 实施约束 |
|---|---|
| D1 Tags | Composer 实时识别 `#tag` 并预览；POST 正文成功后自动 PATCH Tags。PATCH 失败显示“记录已保存，标签未保存”，只重试 Tags，绝不重新 POST 已创建正文。 |
| D2 Thread | Memo 卡片内部 Accordion。保留 parent_id 指向；小屏单级视觉缩进 + 彩线 + @Target，不把深层关系摊平成根回复。 |
| D3 Diary | 桌面580px阅读 Drawer，小屏全屏 Modal；关闭恢复原流位置。03:00是 canonical day 排序锚点，不是真实写作时刻。 |
| D4 Shelf | 顶部常驻横向轻量条带，优先露出3–5项未完成任务；顺序沿服务端 pinned/date 排序，不造第二份排序或优先级字段。 |
| D5 日程中枢 | Calendar 与“＋新建待办”均置于 Shelf 头部；主题句 `River flows in you.` 不挂业务按钮。 |
| Heartbeat Precision | 主轴280字符级 preview；主操作为阅读全文，桌面 Drawer / 小屏全屏阅读；Ledger 为辅助链接。全文只显示最终 `content`，不夹工具、seed或错误账本。 |
| 实体分离 | `#task`/`#todo` 是 Memo 标签，不自动创建 ScheduleEntry；任务创建必须由 Shelf 的专属来源表单提交。 |
| 禁假操作 | Memo 无正文编辑/删除、附件按钮；Legacy 来源删除必须二次确认。 |

交互贡献与批准：[Gemini / Alaric，Alicia approved]。契约与实施收口：[gpt / Solaire]。

## 2. 冻结/施工前门禁与技术差异

本表没有将设计示例自动升级为后端改造需求。未闭合项不得交给 Builder 自行决定。

| ID | 事实与处理 | 状态 |
|---|---|---|
| G-KF07 | CalendarWidget创建payload及错误反馈已独立修复，复核见 `V4_Phase_3_KF07_acceptance_report.md` R2。已证实客户端缺陷关闭，不认定历史唯一原因或真实HTTP/落盘已验证。真实库无探针。 | **CLOSED：R2独立复核PASS** |
| G-DELETE | 使用来源硬删；二次确认明确“永久删除、不可恢复”。禁止照搬mockup“软归档/确认软归档/调用软归档接口”文案，不新增软归档方案。 | **CLOSED：Alicia批准** |
| G-DEFER | todo 快捷延期 PATCH due_date；periodic/goal 打开原生日期编辑并解释影响。periodic 改 start_date 移动整个周期基准（due_date无效），goal 改 cycle_due 影响午夜滚动；不伪造单次延期能力。 | **CLOSED：Alicia批准** |
| G-FORM | 移除虚构priority，使用已有 is_pinned；新建 todo 明确 entry_type、start_date。GCal显示真实单向推送状态，不承诺PATCH成功就远端同步成功。 | **CLOSED：Alicia批准** |
| G-API | 冻结前按源码复核B2消费要求并记录到本计划证据；本轮scout已核查五源接口/写动作，后端历史验收不重跑。 | 本轮只读核查完成，最终冻结时重定位 |

**已由真实契约约束的示例更正（不新增功能）：**
- River 503 无 items：首次失败展示整页错误；续页失败保留先前成功页并标明未刷新/未完整，不声称四源新页正常。禁止剔除故障source重新请求作为隐式降级。
- Calendar 数据来自GCal + ScheduleEntry快照，不含Diary/Heartbeat；mockup相应格子是示例，不是新数据源需求。
- 覆盖范围显示实际 window_start/window_end/fetched_at，不照抄固定“9月至11月”。
- Diary API不提供真实归档时间，不能把“约09:00生产节奏”标成该条真实归档时刻。
- 卡片没有全文字数元数据：未读取全文不显示“约650字”等伪统计；获取全文后可基于真实content计数，无需新API。
- Shelf“常驻”是首页稳定区域，不新增无限滚动粘性顶栏或轮询；主题句长期保留，不照搬原型里未实现的sticky声明。Shelf排序仅为来源serializer ordering；既有calculate_urgency/get_prioritized_entries评分不在本期消费范围，不按“最高优先级”示例自行客户端重排。

## 3. 架构与契约映射

### 3.1 最小分层

采用 app 现有 feature 的 `api.ts / types.ts / queries.ts / 组件` 模式；view只负责呈现/交互，API规范化、来源错误、payload映射与保存步骤集中管理。

**不同于早期草案的收敛：** 不新建shared JS端点再补成套TS声明。app已通过 `exo-shared/api` 的typed `apiFetch`消费端点；既有tasks/chronicle wrappers是无TS声明JS。P3在各feature API层使用同一transport与真实路径，复用已有协议，不复制CSRF实现。保留V3 wrappers不动。[gpt / Solaire]

- River：聚合读接口、分页与展示组装。
- Memo：内容创建/回复/Tags及两步保存状态。
- Tasks：来源CRUD、动作、Calendar与payload映射。
- Diary：按preset/day读取canonical全文。
- Legacy：仅milestone/moment详情/编辑/已批准删除，放在River feature的来源模块，不建立新Chronicle产品区。
- Heartbeat：复用既有detail query/API；新增生活流全文阅读呈现，不复用会显示账本的 `HeartbeatEventDetail` 作为正文。
- 共用长文阅读壳仅覆盖Diary/Heartbeat，禁止升级成万能详情框架。

### 3.2 拟定API签名（新增接口，不冒充已有符号）

| 文件 | 拟定函数 | 真实接口 |
|---|---|---|
| `river/api.ts` | `fetchRiverPage({cursor?,sources?,presetId?,limit?}, signal?)` → RiverPageData | GET `/api/core/river/` |
| 同上 | `fetchOpenTasks(signal?)` → ScheduleEntry[] | GET `/api/core/river/open-tasks/`，解包items |
| `memo/api.ts` | `createMemo(content)` / `fetchMemoThread(rootId)` | POST `/api/core/memos/`；GET `/memos/<root>/` |
| 同上 | `createMemoReply(parentId, content)` / `replaceMemoTags(id,tags)` | POST `/memos/<parent>/replies/`；PATCH `/memos/<id>/tags/` |
| `diary/api.ts` | `fetchCanonicalDiary(presetId, day, signal?)` | GET `/api/memory/diaries/<preset>/<day>/` |
| `tasks/api.ts` | `fetchTasks(filters)` / `fetchTask(id)` / `createTask(payload)` / `updateTask(id,patch)` / `archiveTask(id)` | `/api/tasks/entries/` / `<id>/`，GET/POST/PATCH/DELETE |
| 同上 | `completeTask(id,note?)` / `suspendTask(id)` / `resumeTask(id)` | POST `/api/tasks/entries/<id>/complete/`、`suspend/`、`resume/` |
| 同上 | `fetchCompletions(id)` | GET `/api/tasks/completions/?entry=<id>`，裸数组 |
| 同上 | `pushTaskToGCal(id)` / `unlinkTaskFromGCal(id)` | POST/DELETE `<id>/gcal/` |
| 同上 | `fetchCalendarSnapshot(signal?)` / `fetchTodaySnapshot(signal?)` | GET `/api/tasks/calendar/` / `/calendar/today/` |
| `river/legacyApi.ts` | `fetchLegacyEvent(id)` / `updateLegacyEvent(id,patch)` / `deleteLegacyEvent(id)` | `/api/agents/chronicle/<id>/` GET/PATCH/DELETE（删除受G-DELETE约束） |
| 既有 `heartbeat/api.ts:395–402` | **复用** `fetchHeartbeatEventDetail(sessionUuid)` | GET `/api/heartbeat/events/<uuid>/` |

API层检查消费字段与响应形状，保留HTTP status/body；River将body.code/source_type转为可呈现的类型字段，不依赖 `toAppApiError` 自动提升code（现状不会）。沿用 `AppApiError/contractError`，不改全局聊天错误语义。

### 3.3 关键读约束

- identity=`source_type + source_id`；Task created与每次completed是独立事件，不能按entry_id去重。
- 主轴服务端排序，客户端不得重排或解包cursor；每页默认20，next_cursor=null停止。筛选/刷新清除旧页与cursor后从首页开始。
- sources为五源子集；preset_id只过滤Diary/Heartbeat/Chronicle，Memo/Task保持全局，不标成“该Agent专属任务”。
- 保留G1：已翻过区间新增需刷新，续页不承诺历史快照；重复点击load more只发生一个在途请求。
- capabilities控制可见来源操作，不是权限凭证。Heartbeat现capabilities仅open_ledger；已批准全文作为该来源只读呈现，通过既有detail读取，不要求后端增read_full。
- Memo详情 `{memo,replies}`，replies含全部后代；MemoSerializer没有reply_count。卡片计数来自RiverItem.source_specific.reply_count，仅指root直接子回复数；回复后刷新River投影，或从已载入replies按parent_id===rootId推导直接计数。用户选择的parentId绑定实际回复对象，不用可编辑的@文字猜parentId。
- Diary请求以target的preset/day为准，不从浏览器时区截日期生成身份；day精度显示canonical日期与锚点说明。
- Task列表/completions是裸数组；shelf是 `{items}`。calendar/today是 `{fetched_at,window_start,window_end,count,events}`。

## 施工顺序

Alicia已指派pane7完成施工；CP0及CP1–CP4独立复核闭合，CP5真实页面视觉/只读交互证据完成，C3已由Acceptance作出FINAL PASS。各阶段授权说明保留为历史执行边界；最终归属以 `V4_Phase_3_River_Memo_acceptance_report.md` 及本计划CP5收口规则为准。

### CP0 — 准备门与验收输入冻结

1. G-DELETE/G-DEFER/G-FORM已闭合；独立诊断KF-07，记录证据、结论、是否需另案修复，不把SubAgentTask pending误认为ScheduleEntry故障。诊断写入 `Plan/V4_Phase_3_KF07_Diagnosis.md`，不写生产修复、不在真实库POST探针。
2. 行为验收输入已单独冻结为 `Plan/V4_Phase_3_River_Memo_acceptance_spec.md`（Solaire所有）；Builder读取行为目标，不修改该spec、不窥探针对性验收工装；自己的开发测试仍可编写。独立验收责任方由Alicia指定，不擅自生成review/acceptance子代理。
3. **KF-07是整个P3生产施工的准备门，不只是Task验收门：CP1–CP4均等待CP0证据闭合与release。** “不混入River施工”指诊断/必要修复单独成案，不代表允许绕过原entry gate。若FAIL先报告独立修复需求，禁止夹带后端或前端生产修复；若PASS交证据给Solaire闭合门，再获下一CP release。reviewer建议的分阶段绕门未获Alicia明确批准，不采纳。

### CP1 — 五源只读、分页与长文阅读

**新增** `features/river/{types.ts,api.ts,queries.ts,RiverPage.tsx,RiverItemCard.tsx,OpenTasksShelf.tsx,SourceReadingDrawer.tsx,river.css}`；`features/diary/{types.ts,api.ts,queries.ts}`。

- `RiverPage`薄组装：Hero、composer槽、shelf、source filters、主轴与分页；卡片按五种source分支，不建立动态插件注册系统。
- query keys包含规范化sources/presetId；infinite query pageParam只传opaque cursor。手动刷新以query reset开始新遍历，不能只refetch所有旧页沿旧边界继续。
- 首页/loading/empty/error与续页loading/error/end分别呈现；503遵守§2整页语义；malformed_cursor给出重新刷新入口，不无限自动重试。
- shelf保持来源顺序，显示总数、可横向浏览，首屏约3–5卡；空shelf保留Calendar与新建待办入口。筛选主轴不隐藏全局shelf。
- Diary与Heartbeat长文共用阅读壳：desktop宽580px且不超过viewport，mobile全屏；独立正文滚动，关闭保留主流与已展开thread；键盘焦点约束、Escape关闭、焦点恢复、背景不可交互沿现有dialog习惯。
- 复用 `features/chat/dialogA11y.ts:20–97`；Markdown使用现有react-markdown/remark-gfm/rehype-highlight依赖，禁rehype-raw；只新增简单只读Markdown呈现，不拆改MessageContent或聊天渲染。
- Heartbeat正文复用 `useHeartbeatEventDetailQuery(presetId,uuid,enabled)`（queries.ts:66–77），只渲染detail.content及来源元信息；不触发ack/消费/唤醒；403/404/错误显示重试或不可读状态，不拿preview冒充全文。
- Drawer正文加载前无假字数；Diary不显示未经证实的实际归档时刻。

### CP2 — Memo 创建、Tags与任意层级回复

**新增** `features/memo/{types.ts,api.ts,queries.ts,tags.ts,MemoComposer.tsx,MemoThread.tsx,MemoTagsDialog.tsx}`。

**Tags最小语法（实现映射，非新Tag领域）：**
- `#`前为字符串起点或空白；tag名称接受Unicode字母/组合标记/数字、下划线、连字符，至少1字符；正文原样保存。
- 遇其它标点/空白终止，不将Markdown标题的 `# ` 或URL内片段认作tag；不添加Markdown AST/复杂代码块识别能力。
- 名称不含前导#，不强制小写/Unicode归一化；trim、精确去重，按首次出现预览；Unicode codepoints计数≤50（匹配后端Python len，而非UTF-16长度）。过长tag显式提示，提交前纠正，不悄悄截短。
- 根与回复composer采用同一规则；管理Tags对话框可直接替换/清除列表，但不改正文，不自动合并近义词。

**保存状态：**
1. 捕获当前content/tags/parentId，空白拒绝；请求期间防重复提交。
2. POST失败保留草稿，不自动重试POST。使用既有AppApiError.ambiguousWrite语义：网络/响应丢失、5xx或无法确认新id的异常成功响应，由Memo适配器显式置true（transport不会自动推断）；提示“保存结果不确定，请先刷新核对”，不把手动重提呈现为确定安全的普通重试。不增加服务端幂等协议或跨刷新队列。
3. POST返回新id即认定正文已保存；清空此次草稿并刷新对应读数据，然后自动PATCH已提取tags（空集合无需额外PATCH）。
4. PATCH失败保存 `{memoId,tags}` 为该条的待重试上下文，展示部分成功；根/回复均只重试其Tags。用户继续写新的Memo不覆盖旧重试目标；无需新增跨刷新持久重试队列。
5. Tags成功刷新该条/线程/River；明确手动Tags覆盖成功时清除同条旧重试上下文，避免旧重试覆盖新编辑。

**回复关系：**
- Accordion首次展开读root详情；全部后代依parent_id构建线程，兄弟按created_at/id稳定展示，不借此改变全局排序。
- @Target为真实父对象的可见指向；改变回复目标不隐式改已有草稿正文。小屏视觉压缩，数据parent关系不压缩。
- 成功更新thread与卡片直接回复数，严格按§3.3的来源/推导规则，不向Memo详情索取reply_count；根POST重建首页遍历，回复/Tags变更更新已加载卡片而不移动root事件位置。
- 无Memo正文编辑/删除/附件；不另建before_id历史页；无 `#task`→Task副作用。

### CP3 — Task CRUD、Shelf动作与Calendar

**新增** `features/tasks/{types.ts,api.ts,queries.ts,taskPayloads.ts,TaskFormDialog.tsx,TaskDetailDialog.tsx,CalendarCompanion.tsx}`。

**字段映射（G-FORM/G-DEFER已获批准）：**

| 类型 | 创建/编辑字段 | 只读 / 行为 |
|---|---|---|
| 共通 | title（trim非空）、description、start_date（必填，默认本地今天）、tags[]、is_pinned；创建entry_type明确 | 编辑entry_type不可改；status经真实来源动作；occurrences_done/gcal字段/时间戳不可由form回写 |
| todo | due_date 可空 | Shelf新建默认为todo；日期可选，不能漏entry_type/start_date |
| periodic | interval_unit(day/week/month)、interval_value正整数；end_type(never/count/date)，对应end_count或end_date，不适用字段null | 展示next_periodic_due；不承诺PATCH due_date会延期；完整规则走来源编辑 |
| goal | goal_count正整数、goal_period(week/month)、cycle_start、cycle_due | 展示current_cycle_completions；complete不立即关闭cycle，午夜job决定滚动/升级 |

- 沿V3字段覆盖迁移现有三类型CRUD，不把极简todo入口误写成完整Task迁移完成；编辑面渐进展现类型字段，无新增高级分类系统。
- Shelf与Task事件均打开同一个entry详情；动作与patch在API/payload层集中，不在卡片散落日期换算。
- complete POST可携note→CompletionRecord；todo完成会归档，periodic/goal可能仍留shelf，按返回来源事实重新读，不能一律动画移除所有任务。
- suspend/resume/archive沿真实来源API，archive是ScheduleEntry软归档；危险归档确认不可复用成Chronicle“软归档”。
- postpone处理沿G-DEFER最终决议，明天/下周用运行时本地日期计算而非mockup固定日期；日期字符串不经UTC转当天造成偏移。
- 所有动作成功同步失效Task详情/list/completions、shelf与River；完成/创建重启首页遍历以看到新事件，更新原事件不移动created时间。
- GCal显式push/unlink沿已有动作；POST失败502明确显示，不默认勾选“自动双向同步”。PATCH200只证明本地更新，后端远端update失败可能仅warning，UI不得宣称远端同步成功。

**Calendar（与mockup一致的陪伴Modal，小屏占满可用屏幕）：**
- Shelf头部入口打开月份栅格/选中日清单，任务详情/创建由同一组来源组件承接，不创建另一个Task状态库。
- 快照只读GCal/ScheduleEntry，基于实际start/end与all_day呈现；GCal结束日排他规则不得多画一天，时间事件与date-only区分处理。
- 当前快照goal不纳入，periodic只输出下次一个日期（不展开未来RRULE）；全量Task列表仍可看goal，不伪造快照全覆盖。
- 用 `fetchTasks` 展示全量任务及本地来源操作；Calendar格中的exo事件通过exocore_entry_id定位Task，纯GCal事件仅展示真实信息/html_link，无虚构Task编辑按钮。
- calendar与today快照均保留fetched_at/覆盖元数据；未覆盖月份明确未覆盖，503明确快照不可用；不可写固定月份边界。
- Task操作后本地详情/shelf刷新；快照由07/14/21后台job生成，query refetch不等于重建快照。显示其生成时间，不能声称动作后快照已经即时同步；列表里的本地Task状态按最新接口读取，不盲改快照/GCal数组。
- 不新增date-range API、不补历史回溯后端、不将River分页结果当完整日历事实源。

### CP4 — Legacy来源与Ledger定位、导航集成

**新增** `features/river/{legacyApi.ts,LegacyEventDialog.tsx}`；详情/编辑使用event_time/content/scope/keywords，保留kind/preset/message身份，不能编辑成highlight污染领域。

- 只允许milestone/moment来源；如果详情已变成不支持类型，提示来源已变化，刷新River，不能继续暴露P3写操作。
- DELETE严格按已闭合G-DELETE永久删除语义二次确认；成功移除条目并刷新，不声称软归档或保留审计副本。详情编辑仅PATCH，不改用需要preset等完整字段的PUT。
- event_time改变会移动排序，成功重启首页遍历，不能在旧cursor链里补位。
- `features/heartbeat/AgentHeartbeatPage.tsx:77,178–190`：添加 `session` query→selection桥；Ledger行选择更新该参数，已有detail查询承接刷新/无效uuid/404。preset来自真实RiverItem，不硬编码preset1。
- `app/router.tsx:29–68`：新增AppShell child `river`（生产 `/app/river`）。Thread/阅读/Calendar/编辑均为页内交互，本期无需详情子路由，无需修改 `AppShell.tsx:6` DETAIL_PATH。
- `shell/navigation.ts:21–24`：仅在Builder获得相应暴露授权后启用River；不改Groups/Library状态；`src/test/shell.test.tsx:59` 相应更新导航预期。
- 根站点跳转、V3 `/chronicle/`入口与既有Chat所有权不变；本期不做P7全产品切换。

### CP5 — C3证据与ownership收口

- Builder记录每个CP的改动边界与验证证据，验收由Alicia指定责任方；不得自行改验收报告verdict。
- C3只在完整来源操作（含门禁）与前端最终回归通过后PASS；分阶段可演示不等于生产primary切换。
- PASS后按授权更新Roadmap/Freeze Index/ownership记录与重大功能Update_log；不覆盖历史C2/B2报告。
- FAIL撤回V4 River入口、恢复Chronicle SPA active time owner；新Memo/Task仍由canonical CRUD可读，不删数据、不倒灌旧表、不撤数据库迁移。

## 关键文件清单

| 动作 | 路径 | 职责 |
|---|---|---|
| Create | `packages/app/src/features/river/` §CP1/CP4所列文件 | 主流读取、展示、长文壳、legacy来源 |
| Create | `packages/app/src/features/memo/` §CP2所列文件 | 内容/回复/Tags两步保存 |
| Create | `packages/app/src/features/diary/{types,api,queries}.ts` | canonical全文 |
| Create | `packages/app/src/features/tasks/` §CP3所列文件 | CRUD/payload/Calendar |
| Modify | `packages/app/src/features/heartbeat/AgentHeartbeatPage.tsx` | session深链 |
| Modify | `packages/app/src/app/router.tsx`、`src/shell/navigation.ts` | 获批阶段入口 |
| Create / Modify | 各feature相关测试、`src/test/shell.test.tsx` | 本计划可验证行为；具体实现另冻 |
| Create（责任方指定后） | `Plan/V4_Phase_3_River_Memo_acceptance_spec.md`、施工证据文档 | 独立验收输入/Builder证据 |
| Modify（C3获批收口后） | Roadmap、Freeze Index、ownership引用与`Plan/Update_log.md` | 阶段归属与里程碑记录 |
| Delete | 无 | 不清理V3/他人文件 |

现有事实定位：shared `api.js:45–80`/`api.d.ts:5–30`；app chat `api.ts:31–97`、`MessageContent.tsx:182–194`、`dialogA11y.ts:20–97`；heartbeat `types.ts:56–83`、`api.ts:256–273,395–402`、`queries.ts:25–27,66–77`。这些是可复用接点，Builder需先读后写，不能按行号盲补丁。

后端只读证据：`../ExoCore/core/river_views.py:30–114`、`river_sources.py:40–371`；`core/memo_service.py:28–89`；`tasks/models.py:28–236`、`serializers.py:12–73`、`views.py:30–256`、`gcal_sync.py:1–134`；`scheduler/calendar_sync.py:370–472,666–765`；`agents/views.py:691–702`；`heartbeat/views.py:112–130`。

## 不变部分 / scope与消融结论

- 不改ExoCore/Runtime/Extension/nginx、真实DB/AgentPreset、付费探针；后端问题只写独立spec交对应仓代理。
- 不导入V3页面/组件，不修改V3 wrappers，不删除兼容入口；不重构聊天/现有Heartbeat技术账本。
- 不做Memo附件、正文编辑/删除、独立Memo历史页、全局Tag管理、Task自动识别、Calendar历史后端、双向GCal同步或新的优先级模型。
- highlight/bookmark仍V3-primary直到P4，Collection/Memory/Recall/图片桥均排除。
- 不建立River写模型/独立登录/新依赖/后台轮询/实时推送/跨刷新重试队列；不拆出通用CRUD平台或source插件框架。
- 不因为mockup批准修复未授权的后端差异；必要技术映射留门，不以实现便利静默缩窄TaskCRUD。
- 本轮文档规划不需跑测试/DB基线/服务重启；施工期间双服务显式重启仍遵守伞仓规则。

## 验证方式（覆盖索引；测试代码与工装另行冻结）

下表是CP验证面的导航，不是第二份冻结验收规格；行为判定以 `V4_Phase_3_River_Memo_acceptance_spec.md` 为唯一验收输入，实施规则以上述各节为准，发现冲突须报告，不自行择优。

| ID | 验证面与预期 |
|---|---|
| V01 | `/river`五源识别、API顺序、复合identity；created/completed不同事件不折叠；reply不加入主轴。 |
| V02 | opaque cursor参数完整编码、末页停止、重复load防重入；筛选/刷新重启遍历，G1行为不夸大。 |
| V03 | 首次/续页503、empty、malformed_cursor、来源动作权限错误明确；续页保留既有页，无伪四源完整页或merge fallback。 |
| V04 | Memo POST与PATCH分离、过长tag显式校验；POST成功/PATCH失败只重试正确id的Tags，新草稿不覆盖旧重试；无自动重复POST。 |
| V05 | 任意parent回复选择正确、直接回复数语义正确；小屏浅缩进仍可辨真实对象；回复失败保留输入。 |
| V06 | Diary preset/day定位准确；03:00不误标写作时间；580px/全屏阅读、焦点、关闭恢复原流可用。 |
| V07 | Heartbeat以detail.content完整阅读，技术字段不泄漏到生活流；读取不ack；Ledger session深链可刷新定位，不硬编码Agent。 |
| V08 | KF-07独立证据闭合；todo/periodic/goal原生字段CRUD及readonly保护、类型化日期处理正确；goal/periodic完成不伪报终结。 |
| V09 | shelf顺序/计数/空状态与来源事实一致；创建/完成/编辑同步失效详情/list/River/shelf，Memo #task无创建副作用。 |
| V10 | GCal一向push/unlink错误可见，PATCH200不宣称远端同步成功；不虚构priority字段。 |
| V11 | Calendar范围/生成时间真实，未覆盖≠空；无Heartbeat/Diary假事件；快照延迟不伪称即时刷新，全量Task含goal仍可操作。 |
| V12 | Legacy详情/编辑限milestone/moment，event_time变更新遍历；删除仅按G-DELETE最终批准语义确认；highlight路径不接管。 |
| V13 | desktop/mobile与现有明暗主题；日程入口仅在Shelf头部，Hero无功能按钮；无Memo附件/正文编辑/删除假按钮。 |
| V14 | River入口/回撤范围正确，不修改Chat/Groups/Library所有权；V3兼容路径保留。 |
| V15 | 各CP相关自动化与最终exo-app全量测试、typecheck/lint/build通过；最终shared无需改动，无额外后端回归流水线。 |

机械验证由test-runner执行，仅返回有界摘要/exit code/数量/决定性失败片段，不向主上下文灌全日志。真机/视觉验收由Alicia及其指定验收方完成；不擅自生成review/acceptance pane。

## 署名

技术规划与契约映射：gpt / Solaire — 2026-10-02
UI与D1–D5交互贡献：Gemini / Alaric
产品方向与UI批准：Alicia
技术差异批准：Alicia（G-DELETE/G-DEFER/G-FORM均CLOSED）
施工指派：Alicia → pane7；KF-07、CP1–CP4独立复核PASS，CP5视觉与真实只读交互证据闭合；C3 FINAL PASS（2026-10-03，见 `V4_Phase_3_River_Memo_acceptance_report.md`）。
审阅修正贡献：deepseek/deepseek-flash / pruning reviewer（F1–F3事实修正、F4门语义澄清）；采纳与scope消融：gpt / Solaire。
