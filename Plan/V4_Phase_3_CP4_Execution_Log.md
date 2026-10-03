# V4 P3 CP4 — Legacy / Ledger / River入口 execution-log

Builder pane7；授权依据：CP3独立R1 PASS后的正式CP4 release、Detailed Plan CP4、冻结spec C17/E。**开发施工交付，独立裁决归pane5；不是C3 PASS、ownership转移或CP5放行。**

## 1. 改动范围

新增：
- `packages/app/src/features/river/legacyApi.ts`
- `packages/app/src/features/river/LegacyEventDialog.tsx`
- 自有 `src/test/{legacy_api.test.ts,legacy_page.test.tsx,heartbeat_deeplink.test.tsx}`

修改：
- `features/river/{RiverPage.tsx,RiverItemCard.tsx,river.css}`：Legacy弹窗、来源刷新及Heartbeat辅助账本链接。
- `features/heartbeat/{AgentHeartbeatPage.tsx,HeartbeatEventDetail.tsx,queries.ts}`：session URL选择与错误/归属保护。
- `app/router.tsx`、`shell/navigation.ts`：按本次显式授权接AppShell River child/启River导航；basename下生产`/app/river`。
- `src/test/{helpers.tsx,shell.test.tsx}`：测试路由表/导航预期同步。
- 本施工记录。

不改AppShell DETAIL_PATH、Groups/Library/root重定向/V3兼容入口、shared、后端、冻结spec/report/probe。保留CP1私有scroll约束、CP2两步写/pending/页面级草稿、CP3Task动作/快照和原KF07。无commit、清理或ownership文档改动。

## 2. 写代码前事实确认

scout只读定位：
- 后端`agents/models.py:565–592`、`serializers.py:213–223`、`views.py:691–703`及router注册，确认ModelViewSet GET/PATCH/DELETE `/api/agents/chronicle/<id>/`存在，DELETE为物理删除，204无body。ReactSheet只列list，detail文档缺口不捏造接口，以实际serializer为准。
- kind真实三类milestone/highlight/moment，前端P3仅前后两类；preset/kind/message后端仍可写，前端必须omit，不虚称后端immutable。
- `heartbeat/events/<session_uuid>/`无效值400/不存在404；现有detail query只读不ack。
- 当前AgentHeartbeatPage原selection局部state在preset变化effect清空；需URL单一来源避免首次deep-link被清掉。Router/nav当前River未开放，已获得本次授权。

## 3. 实施行为与生命周期

### Legacy

- GET canonical详情校验真实字段/请求id，保留preset/message/kind身份；仅milestone/moment提供P3写控件。GET已变highlight或404时明确“来源已变化/不存在”、刷新River且不显示编辑/删除，非把highlight改回可编辑类型。
- PATCH仅event_time/content/scope/keywords，不PUT、不发送preset/kind/message/id/modified_at。scope可null；keywords逐元素textarea，保留逗号/换行，不隐式分裂来源数组；空行不提交。
- PATCH返回canonical更新detail；event_time改变cancel/reset River首页，普通内容更新invalidate当前加载页，不擅改occurred_at或旧cursor中的排序。
- DELETE明确“永久删除、不可恢复、不会进入归档”，二次确认；取消0请求；确认成功204才关闭并刷新移除；403/404/5xx/网络错误不假移除，uncertain先核对不自动重发。
- 弹窗状态由RiverPage持有，不挂在会被reset卸载的卡片里。写入同步ref锁与disabled/close锁；失败保留正文/日期等输入。safe Markdown预览复用MemoContent，无raw HTML。

### Ledger URL桥

- River Heartbeat保留主操作阅读全文，另加`/agents/<真实preset>/heartbeat?session=<真实uuid>`辅助Link，无preset1硬编码。
- AgentHeartbeatPage从URL searchParams派生选择；row点击只更新session，保留其它参数并入history，back/forward/刷新自然恢复；关闭仅删除session。
- absent session=无选择；空/非法UUID=显式无效panel且0 detail请求，不默认跳别的记录。
- 有效UUID但404=明确“心跳记录不存在”+retry；canonical detail.presetId与route不匹配时不呈现事件正文，显示归属不匹配，避免把其它Agent事件当当前Agent来源。
- 既有只读query承接，无ack/消费/唤醒；不增Ledger数据层或新backend接口。

### 导航

AppShell child `river`与River enabled nav同次接入；与真实shell保持原CP1受约束scroll owner，未给body/shell加滚动补丁。Groups/Library仍disabled，根站点/V3保持原入口。这只是入口集成授权，不代表primary ownership切换或C3完成。

## 4. 施工偏差与优化

- Heartbeat query文件额外提供canonical dashed-UUID形状校验，detail组件加preset归属检查/404专门文案；属于完成真实URL定位的局部保护，不改API或权限体系。
- 原selection state+清空effect替换为URL派生，减少双状态同步；setSearchParams复制保留其它参数。
- Legacy局部样式追加river.css，复用已有dialog/focus/Markdown，无新依赖/全局store/框架。
- PATCH/DELETE结果不确定用既有AppApiError.ambiguousWrite表示，拒绝假删除；不新增幂等接口/后台重试。

## 5. 具体开发测试断言

### `legacy_api.test.ts` — 16

- 真实serializer对象、nullscope与`['a,b','c\nd']`逐元素往返；milestone/moment可写、highlight不可写。
- 8个非法shape反例（id/preset/kind/message/scope/keyword/event_time/modified_at）抛contract error，不合成空success。
- exactGET路径、错id拒绝、404保留detail。
- PATCH body仅4字段，无identity/readonly字段；返回canonical身份保留；错id/500/lost-response均uncertain、400字段错误为确定失败。
- DELETE204无JSON处理，404/500/网络分别真实抛错；5xx不得报告确定未删除。

### `legacy_page.test.tsx` — 15（真实RiverPage驱动）

- 详情真实id/preset6/message42/kind只读，保存body精确4字段。
- moment关键词数组含逗号/换行原样往返，新增/清空行按元素处理。
- 日期/内容前置验证保留输入且0PATCH；server400保留输入/明确错误；server500/网络保留草稿/uncertain且无自动重发。
- deferredPATCH双击1请求、输入与close禁用、Escape/overlay不能关闭；结算后重新启用。
- 已加载第二页后普通edit重读同cursor链；event_time改变重新首页且旧第二页消失，body不回写occurred_at/modified_at。
- highlight/404两反例：不暴露保存/删除，来源变化只触发一次River重读。
- 永久删除取消0DELETE；HTTP500/网络保留原row与错误，不刷新假移除；成功204才关dialog+新首页变空。
- deferredDELETE双击1请求、close/cancel/confirm禁用、Escape/overlay不关闭，成功后再离开。

### `heartbeat_deeplink.test.tsx` — 9

- fresh-load `session`定位真实事件；Ledger row改URL同时保留其它searchparams。
- back/forward回到URL对应selection，非局部state遗留。
- empty/malformed各显式错误，0 detail lookup，无silent默认。
- 404明确不存在/retry；preset不匹配不渲染事件内容。
- GET-only无ack/POST；真实River route/link使用preset6与真实session，证明非硬编码1且保留阅读全文。

### 保留验证

原12文件173项（CP1–CP3、shell、CP2冻结probe）+Legacy31/DeepLink9+既有HeartbeatPage34 = 本次247。HeartbeatPage回归因修改URL选择/detail错误而纳入，不是重做C2验收。shell预期改为River enabled `/river`，其它disabled项保持。

## 6. 执行结果与自检记录

最终一次组合命令，verbose用于单次提取计数，无为计数复跑：

```text
pnpm --filter exo-app exec vitest run
 src/test/tasks_api.test.ts src/test/tasks_ui.test.tsx src/test/tasks_calendar_dates.test.ts
 src/test/memo_api.test.ts src/test/memo_page.test.tsx src/test/memo_reply_lifetime.test.tsx
 src/test/river_api.test.ts src/test/river_page.test.tsx src/test/river_scroll.test.tsx
 src/test/shell.test.tsx src/test/heartbeat_api.test.ts
 src/test/acceptance/cp2_b9_reply_draft_reset.acceptance.test.tsx
 src/test/legacy_api.test.ts src/test/legacy_page.test.tsx
 src/test/heartbeat_deeplink.test.tsx src/test/heartbeat_page.test.tsx --reporter=verbose
```

**16 files /247 passed，0 failed/errors/skipped，exit0。**

| 文件 | 通过数 |
|---|---:|
| heartbeat_api / heartbeat_page | 57 /34 |
| tasks_ui / tasks_api / tasks_calendar_dates | 24 /9 /9 |
| legacy_api / legacy_page / heartbeat_deeplink | 16 /15 /9 |
| river_api / river_page / river_scroll | 15 /15 /4 |
| memo_api / memo_page / memo_reply_lifetime | 11 /13 /3 |
| shell / CP2冻结probe | 12 /1 |

- typecheck（app+node tsconfig）、lint、build均exit0；git diff --check通过。
- 冻结CP2probe只执行不读断言，pre/post SHA256同为`1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2`。只证明本轮前后未变，不扩大历史基线声明。
- 非致命warning：React Router future flags；测试环境localStorage runtime lease读取告警；Vite大chunk/PWA inlineDynamicImports deprecation。未扩成环境/框架改造。
- 前期测试缺陷与修正：5个删除测试在detail仍loading时查按钮，改等待实际可操作控件（无timer）；随后两处自有断言分别误写“不会进入归档”的字面及把DELETE500期待成确定失败，改为正确的不可归档/结果不确定语义。未因测试改变业务行为/冻结资产。补serverPATCH失败及并发写反例后完成上述连贯组合验证。

本人亲核实际Legacy adapter/详情控制流、River源刷新、Heartbeat URL派生及canonical归属guard、router/nav diff和最终结果；没有自行派生Reviewer/Acceptance。源码事实与机械测试下放，独立裁决仍交pane5。

## 7. 未验证、安全与交付边界

- 全部合成mock HTTP响应，无真实HTTP写/DB/.env/用户隐私/GCal/paid、服务启停/隐藏进程、跨仓编辑、commit/清理。
- jsdom/源码CSS不是实际手机/浏览器layout或Alicia视觉PASS；Task忙时全disabled焦点观察按CP3非阻塞记录留最终真浏览器核对，未扩展UI框架。
- 本轮仅相关16文件，不声称最终全量回归。没有重做LR01/C2/B2/KF07接受门。
- Legacy身份由PATCH omission保护，不声称后端具备并发身份CAS/immutable检查；他方并发改kind的竞态不凭空新增后台锁。
- CP4入口已按授权启用，但C3/ownership/root切换未动。交pane5独立核验后立即停，等待release，不自动CP5。
