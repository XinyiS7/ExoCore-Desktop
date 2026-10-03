# V4 P3 CP1 — Builder execution-log

日期：2026-10-02；施工pane7；输入：Detailed Plan CP1及Solaire所有的只读Frozen Behavior Acceptance Input。KF07独立R2 PASS后release仅CP1。

**状态：CP1施工/开发验证完成，交pane5独立验收；不自判CP1/C3 PASS，不进入CP2。生产入口与ownership仍未切换。**

## 1. 改动范围

全部为Desktop新增文件：

- `packages/app/src/features/river/{types.ts,api.ts,queries.ts,RiverPage.tsx,RiverItemCard.tsx,OpenTasksShelf.tsx,SourceReadingDrawer.tsx,river.css}`。
- `packages/app/src/features/diary/{types.ts,api.ts,queries.ts}`。
- Builder开发测试：`packages/app/src/test/{river_api.test.ts,river_page.test.tsx,river_fixtures.ts}`。
- 本施工记录。

未改router/navigation、Heartbeat既有代码、shared、聊天渲染、完整V3 modal或后端。KF07生产修复与测试原样保留；未修改冻结diagnosis/acceptance/spec/UI资产，未清理他人文件、未commit。

## 2. 实施事实

- 五源聚合GET，API消费字段显式校验，来源和target交叉检查；不将坏envelope当空成功。卡片分支呈现；按服务端数组顺序拼接，不重排、不按entry_id折叠Task created/completed，key=`source_type:source_id`。
- Memo计数只用River.source_specific.reply_count并标直接回复数；未读取Memo详情或实现回复/Tags写功能。Chronicle仅接milestone/moment读投影，无编辑/删除假操作。
- Query key规范化sources/preset/limit；opaque cursor原样传shared transport编码。末页null停止；ref锁+fetch状态阻断同时续页。手动refresh取消在途请求并reset首页，不沿旧页cursor refetch；来源/Agent上下文退出即丢弃旧遍历缓存，重访也从首页开始。没有后台轮询、focus/reconnect续链刷新或cursor解码。
- 首页loading/empty/error、续页loading/error/end分别展示。503初页无假完整流；续页保留成功页且说明遍历未完成；malformed_cursor仅给重启首页入口，无无限自动重试、故障源剔除或客户端merge降级。
- Shelf独立全局GET，保留serializer ordering，显示数量/空/失败/重试，可横向滚动。任务type/status及适用日期只读展示；没有独立任务状态库/urgency排序。
- Diary按target.preset_id/day获取canonical content；day/03:00说明不冒充实际写作或归档时刻。Heartbeat复用既有`useHeartbeatEventDetailQuery`；阅读正文仅detail.content，无seed/tool/error/ack/wakeup。
- 共用Diary/Heartbeat阅读壳：CSS桌面`min(580px,100vw)`，≤640px全屏100dvh；正文独立滚动。body直属背景元素inert/aria-hidden，锁背景滚动；复用dialogA11y focus trap/Escape/关闭焦点恢复；清理先恢复背景再恢复焦点。
- Markdown仅react-markdown/remark-gfm/rehype-highlight，无rehype-raw；全文加载前无假字数，成功后按实际Unicode字符计数；读取失败不会拿preview冒充全文。

## 3. 施工偏差与边界映射

1. **CP1只读与后续按钮：** Shelf的Calendar/新建待办入口保留但disabled且注明后续阶段开放；composer槽仅说明，未造可点击的写操作。Ledger session深链按CP4接入，CP1没有未实现的Ledger按钮。生产导航未提前启用。
2. **Shelf内部类型：** `OpenTask`是当前完整ScheduleEntry wire响应的显式只读消费投影，保留本阶段实际展示字段；不是新增公共API、字段或Task领域模型。CP3再按完整CRUD契约扩展消费，不把当前投影宣称完整Task迁移。
3. **缓存策略：** 读取上下文退出时移除该cursor链，确保source/preset重访与手动refresh均从首页重启；阅读抽屉不卸载主流，因此不改变已读流内容或位置。
4. **开发修正：** 首次typecheck发现仅测试fixture的联合类型过宽及ByRoleOptions多余exact；显式收窄fixture/去掉该option后针对性复核通过，未改外部逻辑或冻结输入。

## 4. 具体用例与决定性断言

### `src/test/river_api.test.ts` — 15 tests

- `preserves source order, composite identity, direct reply count and nullable task fields`：标准化结果与原六项数组完全相等；同entry的created/completed不同；reply_count=2原样保留。
- `canonicalizes sources in both key and request without decoding cursors`：`['task','memo','task']`→`memo,task`，等价query key；带`:+/==&?签名`cursor searchParams解码结果与输入一致；preset_id=6、limit=20。
- `rejects malformed page envelope %j...`（4例）：无items/非数组/非string cursor/空cursor均抛AppApiError，不归零。
- `rejects malformed source identities/fields %j`（4例）：target/source冲突、负reply_count、Diary day冲突、非法时间被拒绝。
- `unpacks shelf and preserves backend ordering...`：后排pinned项不被提前；裸数组错误形状/archived shelf行拒绝。
- `retains HTTP %i body/code/source attribution`（503/400）：status/body/code保留，503.sourceType=diary。
- `requests exact target preset/day and keeps content verbatim`：GET精确路径；CRLF/空正文保留。
- `rejects wrong day/preset and preserves canonical missing error`：错身份抛契约错误；404.code=diary_not_found。

### `src/test/river_page.test.tsx` — 15 tests

- `renders five sources in server order and both task events...`：DOM复合identity顺序等于六项输入；直接回复数、末页、来源顺序Shelf；Calendar/新建disabled，无编辑/Ledger操作；只GET且没有tasks创建调用。
- `passes opaque cursor, blocks overlapping continuation and stops at null`：延迟Promise下连击只有一次续页；cursor原样；完成后两页都保留，null无更多按钮。
- `refresh discards old pages/cursor and changes filters always restart at home, including revisits`：旧next页消失；refresh、切source和回全部的最后请求均无旧cursor；所有请求preset=6；Shelf仍可见且只调用一次。
- `changing and revisiting preset filters never revives prior cursor pages`：6→2→6后旧next页不复活，只有原先一次cursor请求。
- `shows shelf failure separately...explicit retry recovers`：失败显示错误不是空；主流仍正常；显式重试后来源首项可见。
- `shows initial 503 as whole-page failure...`：alert标Heartbeat不可用，无主流项、不显示空成功，仅一次五源请求。
- `keeps prior page on continuation %s...`（503/malformed）：原Memo仍在，明确遍历未完成，不显示末页；503可重试；malformed只有refresh且重启无cursor。
- `distinguishes loading, empty stream and empty shelf...`：可控首页pending、空Shelf、空流分开；无更多按钮、空Shelf仍有禁用后续入口。
- `reads exact canonical target and restores focus/stream...`：精确Diary6/day GET；读前无字数；背景inert/aria-hidden、body锁；关闭键取得焦点、Tab不逃逸；全文Markdown标题出现；Escape关闭后trigger焦点/背景状态恢复，原preview与一次主流请求保持。
- `reuses Heartbeat detail GET and renders final content only...`：最终全文标题/正文可见；seed/tool/error不可见；所有GET，无ack/consume/wakeup。
- `does not replace failed Heartbeat full text with preview on HTTP%i...`（403/404/503）：权限/不可读/错误明确；无preview兜底及假字数；显式重试取全文。
- `renders Markdown without executing raw HTML`：script/img原HTML不产生DOM元素。

## 5. 机械验证结果与本人自检

scout承担接口/源码事实定位；test-runner执行以下命令，只返回有界摘要。Builder本人按Plan/冻结行为、当前新增源码及测试结果检查了source/target映射、两种遍历重启、错误状态、readonly操作边界与抽屉清理顺序；不派生reviewer、不增加多轮自评。

| 命令 | exit / 结果 |
|---|---|
| `pnpm --filter exo-app exec vitest run src/test/river_api.test.ts src/test/river_page.test.tsx src/test/shell.test.tsx src/test/heartbeat_api.test.ts` | 0；4 files /99 tests通过：River API15、River UI15、既有shell12、既有Heartbeat API57 |
| `pnpm --filter exo-app typecheck` | 0 |
| `pnpm --filter exo-app lint` | 0，无findings |
| `pnpm --filter exo-app build` | 0；PWA构建完成 |
| scoped `git diff --check` | 0；新增untracked文件不在tracked diff统计中，不把空diff当无施工 |

构建非致命warning：大chunk（index约1167kB/gzip333kB及既有mermaid等）、PWA inlineDynamicImports deprecated。Vitest非致命Node localstorage-file warning。没有为这些既有点位扩大修复。

## 6. 未验证 / 安全边界

- 无真实HTTP、真实Diary内容、AgentPreset/DB写探针、GCal/付费调用、.env/private读取；测试用合成数据+mock fetch。未跨仓编辑、未启动/重启任何服务或隐藏后台进程。
- 580px/小屏全屏、明暗主题、真实浏览器scroll位置保持与视觉质量有CSS实现及DOM交互证据，**没有Alicia真机/视觉确认**；不将jsdom证据说成真机验收。
- 没有Memo/thread、任务CRUD/Calendar、Chronicle操作、Ledger session桥、router/navigation/ownership切换；这些按CP2–CP4后续release，CP1未承诺完整C3能力。
- 本轮运行针对性99条而非全量exo-app回归；全量最终回归仍属于后续收口。未重验LR01/C2/B2，未重复KF07流水线。

**交付：请求pane5独立CP1核验。完成即停，等待下一release；C3未PASS，CP2未开工。**
