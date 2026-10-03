# V4 P3 CP3 — Task / Shelf / Calendar execution-log

Builder pane7；授权依据：CP2独立R2 PASS后的CP3 release、Detailed Plan CP3及冻结spec D。**施工/开发验证完成，提交pane5独立核验；不是CP3/C3自判PASS，不进入CP4。**

## 1. 范围与契约核实

- 新增 `packages/app/src/features/tasks/{types.ts,api.ts,taskPayloads.ts,queries.ts,TaskFormDialog.tsx,TaskDetailDialog.tsx,CalendarCompanion.tsx,taskUi.ts,calendarDates.ts,tasks.css}`。
- 最小接入 `features/river/{RiverPage.tsx,OpenTasksShelf.tsx,RiverItemCard.tsx}`。Calendar/新建入口仅Shelf头部，Hero不加业务按钮；Shelf/Task事件/Calendar的exo事件打开同一真实entry详情。
- 新增自有 `src/test/{tasks_api.test.ts,tasks_ui.test.tsx,tasks_calendar_dates.test.ts,task_test_server.ts}`；更新原Builder `river_page.test.tsx`中三个已过期的Shelf入口disabled预期（CP3批准启用），不修改reading drawer背景inert要求。
- 不改生产router/nav、Legacy/Ledger、后端、shared、CP2写入/草稿owner、CP1私有scroll CSS、KF07；无commit/清理。

scout先核对源码：后端`tasks/{models,serializers,views,urls,gcal_sync}.py`、`scheduler/{calendar_sync,task_routine}.py`只读；前端ReactSheet §3.13实际ScheduleEntry形状与既有adapter/Query/modal模式。ReactSheet §4旧type/priority等已知示意漂移不采纳、不跨仓修文档。CP3 release明示Shelf入口/来源动作，关键文件表未枚举的三个River接入点属于必要同feature集成，而非提前CP4导航。

## 2. 实施与真实行为

### Task

- `GET /api/tasks/entries/`裸数组；detail GET/PATCH `/entries/<id>/`；DELETE204是软归档。完成`POST /entries/<id>/complete/`只认CompletionRecord，不认TaskEntry；完成历史`GET /api/tasks/completions/?entry=<id>`裸数组且验证entry身份。
- 表单明确todo/periodic/goal；创建必有title/entry_type/start_date，本地今天默认，无UTC日期偏移。description为string，todo due_date可空；periodic正整数间隔/单位/end_type及其end字段，不适用end字段null；goal原生goal_count/goal_period/cycle_start/cycle_due。
- 编辑entry_type不变；payload白名单不回写status/id/完成计数/computed/GCal/time字段，无priority。status通过complete/suspend/resume/archive动作。
- 目标cycle边界按真实来源可空，后端不会创建时初始化，UI明确无cycle_due不会自动滚动；不自造周期默认或强制源契约外约束。
- 标签逐项textarea数组，不用逗号/换行拆分（这些是来源允许的单个tag内容）。trim+精确去重+50 codepoint检查；修改标题不会把现有`comma,tag`、`multi\nline`、`a、b`拆成多个标签。
- todo快捷延期只PATCH due_date，明天/下周取运行时本地日历。periodic/goal只开同一原生编辑表单，并说明整体周期基准/cycle边界影响，不PATCH无效due_date。
- complete支持备注；todo归档与periodic/goal仍进行中全部以canonical重新读取为准，不本地一律终结。suspend源清pin；resume不伪造恢复pin。归档二次确认明确软归档、取消不请求。
- GCal仅显式POST push / DELETE unlink；502真实错误可见；PATCH200只证明本地更新，unlink204也只确认本地清关联（远端删除尽力而为），不承诺双向同步。
- `useTaskActions`在RiverPage生命周期内只有一份每entry同步锁（create用0）。所有成功动作失效来源list/detail/completions/Shelf/River；create/complete cancel+reset River首页，普通字段更新失效读取，不改created发生时间/不插入虚构事件。create/complete网络/5xx/异常成功响应明确uncertain并保留输入/备注，无自动POST retry。

### Modal生命周期

RiverPage单一TaskStage选择calendar/create/detail/form，不套双重focus trap；共享action owner不随dialog切换重置。detail→edit→detail回同id；Calendar exo事件→detail关闭回Calendar。写入期间同步ref锁+disabled/锁关闭；Task弹窗不依附River条目，Task创建/完成重建主轴不会卸载表单。Memo仍由已通过CP2的页面级draft/pending owner管理，不因新Task重建丢状态。

### Calendar

- 两真实只读路径`/api/tasks/calendar/`与`/calendar/today/`，展示各自fetched_at/window_start/window_end/count；503显式不可用，不伪装空；覆盖外日期禁用且明确未覆盖≠空，月份范围来自实际快照，无固定月份/新date-range接口。
- 格子/选日只消费快照events，另用fetchTasks全量来源列表展示goal/暂停/归档，不拿River分页冒充全量日历。
- goal不在快照、periodic仅下次单日（不展开RRULE）明确说明。纯GCal事件仅真实内容/description/location/link，不伪装Task；exo事件通过exocore_entry_id打开同一详情。
- all_day为日期域，结束日排他；timed为真实instant，转浏览器本地时区分日/显示，明确“本地时区”，保留原始start/end及来源偏移。跨日timed按半开区间，午夜结束不多画一天；all_day长事件按实际snapshot窗口裁剪，无120天随意截断。
- 成功/失败状态都有显式重新读取入口；它只GET旧文件，不触后台job。显示07/14/21快照规则及动作后不保证即时同步、GCal抓取可能缺项而无独立错误标记，不声称覆盖内即绝对完整。

## 3. 施工偏差与自检修正

- Plan七个Task文件外加`taskUi.ts`（共用labels/errors）、`calendarDates.ts`（date-only/instant半开区间纯函数）、`tasks.css`（局部响应式）。单函数`fetchCalendarSnapshot(kind)`承接calendar/today两路径，代替两份几乎相同adapter；不改变外部请求契约。
- 采用明确三类型原生编辑而非额外快捷延期框架；单一TaskStage防嵌套modal，没有新全局store/持久队列/依赖。
- 本人源链路自检发现并修复两个业务缺陷：分隔符tag输入会损坏来源合法数组；最初Calendar只投timed起始日且all_day有120天截断。分别改逐项textarea和实际半开区间/时区处理，并加超过原样例反例。scout确认后端JSON直接保留GCal原偏移而非统一Asia/Shanghai，所以不能将截出的HH:mm冒称本地时间。
- 首次21项开发测试20通过、1失败：两个snapshot共享fetched_at使自有`getByText`非唯一；改为明确断言两个metadata段。未读/改验收断言来适配产品。

## 4. 具体开发测试证据

### `tasks_api.test.ts`

- `builds exact todo/periodic/goal create payloads from required native fields only`：三类型确切body，readonly字段逐个不出现。
- `omits entry_type and readonly fields on edit and rejects invalid native inputs before any write`：编辑白名单、标题/start/interval/end/goal非法值拒绝；tag50/51 codepoint边界。
- 本地postpone测试：23:30与跨月/跨年，tomorrow/+7日不经UTC；两原生进程TZ重跑见下节。
- list/detail实际query及identity；complete返回CompletionRecord、GET历史entry=id且错entry拒绝。
- create网络/500/503/异常201标uncertain，400确定失败，无retry。
- archive/unlink空204可接受；GCal502带后端detail；gcal_synced未确认不能假成功。
- calendar异构exo/gcal字段、date-only/timed原值、metadata/count/entry身份及503错误，不制造空快照。

### `tasks_ui.test.tsx`（通过真实RiverPage驱动）

- 三类型创建请求body、默认local今天与entry_type；readonly编辑只PATCH允许字段；原生goal空cycle字段按null发送且解释不会自动初始化。
- 逐项tag反例：已有`['comma,tag','multi\nline','a、b']`仅改title后PATCH数组完全不变；新增/删除行、不隐式拆分。
- complete带note：todo读取为archived；periodic计数增长但仍active；goal仍active且周期完成数更新。completions请求真`entry`筛选。
- suspend清pin、resume来源状态；archive取消0 DELETE、确认204软归档；todo明天/+7只due_date，periodic/goal开原生form且不发due_date。
- deferred create双击1 POST、400留字段；network/503/malformed201各1 POST、原title/due保留，明确可能已创建/先核对，不自动重试。
- `keeps the completion note and canonical state on a 503 and never double-sends a pending click`：deferred complete双击1 POST，pending disabled；503后note未丢、active未假终结、uncertain提示。
- GCal push502真实错误；PATCH成功无远端已同步承诺；unlink204尽力而为；unlink502保留原gcal link并显示错误，不声称已清除。
- create/complete重建首页并丢弃旧cursor页；普通更新重新读取既有分页来源；Shelf/list/source同步。
- Calendar metadata两个快照同生成时间均展示；排他end不多画一天，timed本地时区含原偏移，exo点击真entry GET，纯GCal只有link不Task edit；goal在全量列表而不制造快照条目；未覆盖disabled、503可重读恢复。
- Calendar泛化：2020整年window内跨越120天后的第208日仍有长all_day事件；timed夜间到午夜不多一天；同instant不同偏移归到相同本地日期/时刻；显示description/start/end。
- `keeps the same fetched_at and sends no rebuild POST on a successful snapshot refetch`：GET由1到2但fetched_at未变，所有tasks POST为0，绝不把读旧文件说成重建。

### `tasks_calendar_dates.test.ts`

9项纯日期/instant验证：日期域shift、半开all_day、裁剪、长跨度、timed午夜边界/相同instant不同offset、本地格式与原偏移。与API共18项在两原生TZ重跑通过，日期域未受时区移动。

### 保留回归

原CP1/CP2来源读取、分页、scroll结构、Memo两步写/多pending/manual tags清retry、任意父回复及CP2-F01页面级草稿3泛化/冻结probe继续执行；shell production入口仍未启用。未改冻结probe源/断言，只有执行与机械hash权限。

## 5. 最终连贯开发门

runner执行明确12文件（非glob、非全量）：

```text
pnpm --filter exo-app exec vitest run
  src/test/tasks_api.test.ts src/test/tasks_ui.test.tsx src/test/tasks_calendar_dates.test.ts
  src/test/memo_api.test.ts src/test/memo_page.test.tsx src/test/memo_reply_lifetime.test.tsx
  src/test/river_api.test.ts src/test/river_page.test.tsx src/test/river_scroll.test.tsx
  src/test/shell.test.tsx src/test/heartbeat_api.test.ts
  src/test/acceptance/cp2_b9_reply_draft_reset.acceptance.test.tsx
```

**12 files /173 tests通过，0 failed/errors/skipped，exit0**。本轮reporter只输出aggregate，未为拆分计数额外重跑；新增Task测试源合计42，原保留131。

- typecheck（两个tsconfig）：exit0。
- lint：exit0。
- build：exit0；已有chunk>500kB及PWA inlineDynamicImports deprecation warning。生产router未接River，此build不是生产路由/视觉验收。
- native TZ=Asia/Shanghai：运行进程offset=-480，tasks_api+tasks_calendar_dates共18项exit0。
- native TZ=America/Los_Angeles：offset=420，同18项exit0。runner最初shell前缀未传入Windows子进程的尝试已识别、废弃；最终采用spawn环境实际生效的证据，不将假TZ运行冒充成功。
- CP2冻结probe此次前后SHA256相同：`1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2`；只证明本次执行未变，不声称整个冻结历史证明。
- git tracked改动仍只有原KF07 CalendarWidget；staged为空，router/nav/shared未改。新features/tests未跟踪，`git diff`不代表它们无变化。`git diff --check`通过。

本人亲核Plan/spec D、实际source mapping、payload/API/action invalidation、modal生命周期、Shelf入口、Calendar日期域/instant分离及最终结果；未自行派生reviewer/Acceptance。子代理承接源码事实、施工和机械测试，独立裁决仍交pane5。

## 6. 未验证、安全与交付

- 全部测试是installFetch/Map合成数据，无真实HTTP写、DB/.env/用户隐私/付费/GCal调用、服务启停/隐藏后台、跨仓编辑、commit或删除他人文件。
- Backend只能尽力远端同步、快照可能陈旧/不完整为已知来源边界；未增加恢复job、远端探针或新API。Task nullable历史字段保留来源契约，未替后端初始化或迁移数据。
- jsdom/源码CSS证据不是真浏览器layout、手机触屏、Alicia视觉PASS。最终全量回归留后续收口；LR01/C2/B2/KF07未重验。
- 无CP4 Legacy/Ledger/router/nav、无ownership切换/C3宣布。
- 交pane5独立核验后停止，等待下一release。
