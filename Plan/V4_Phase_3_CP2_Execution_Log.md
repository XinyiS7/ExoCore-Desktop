# V4 P3 CP2 — Memo施工 execution-log

日期：2026-10-02；Builder pane7。授权范围：CP1独立R2 PASS后，仅release CP2；行为输入为只读Detailed Plan CP2与Frozen spec B。**施工/开发验证完成，提交pane5独立复核；不是CP2/C3自判PASS，不进入CP3。**

## 1. 改动范围

- 新增 `packages/app/src/features/memo/{types.ts,api.ts,queries.ts,tags.ts,MemoComposer.tsx,MemoThread.tsx,MemoTagsDialog.tsx,MemoContent.tsx}`。
- 最小接入既有 `features/river/{RiverPage.tsx,RiverItemCard.tsx,river.css}`：root composer、逐memoId的部分成功提示、卡片Accordion/标签按钮、线程/表单样式。
- 新增Builder开发测试 `src/test/{memo_api.test.ts,memo_page.test.tsx,memo_test_server.ts}`；本执行记录。
- CP1私有page scroll owner、Diary/Heartbeat读取、分页查询与API未改；保留KF07/V3修复。生产router/nav、shared、现有Heartbeat、Task/Calendar、后端与冻结资产均未修改；不commit、不清理他人文件。

## 2. 实施事实

### API / 两步保存

- 明确用真实路径：POST `/api/core/memos/`、POST `/memos/<parent>/replies/`只传content；GET root详情解包`{memo,replies}`；PATCH `/memos/<id>/tags/`只传tags。
- Memo裸响应严格校验正整数id、正文/作者/parent_id/time/tags；不从Memo详情索取reply_count。root/reply POST校验返回parent身份；异常成功响应/网络/5xx显式AppApiError.ambiguousWrite=true，提示先刷新核对，无自动POST retry。
- Composer捕获content/tags/parent/root快照，空白与长tag提交前拒绝；ref锁+disabled防重入。确认POST成功立即清空该草稿、更新对应读取，再PATCH非空提取tags；PATCH失败归独立pending记录，不重新POST。
- pending记录按**memoId**保存于River页面生命期内，带tags快照/rootId/error。新草稿/new memo不覆盖旧目标；重试只PATCH指定id；成功更新root投影/线程并清该条pending。
- 同id tags写用同步busy锁串行化；手动管理tags成功清同id旧pending，避免旧retry覆盖成功新编辑。手动输入每行一个名称，可替换/清空，失败留输入；pending时防双PATCH/Escape关闭。
- root创建cancel/reset River首页遍历；reply/tag更新对应缓存/读取及已加载root tags/直接回复数，保持page顺序/next_cursor/occurred_at，**不把reply插入主轴**。

### Tags / Thread

- 提取只认起点或空白前的#，允许Unicode字母/组合标记/数字/下划线/连字符≥1；其它标点结束。不会认`# `Markdown标题或URL内片段；名称去前导#，trim+精确去重、首见顺序，不lowercase或Unicode归一化。
- `Array.from(name).length≤50`按codepoint；51显式报错、保留完整tag，不截断。root和reply用同一Composer/提取规则。
- 前端content请求原样发送，提取tags不删改正文。实际后端`normalize_content`既有strip行为（只读源码核实）保持不变；未伪造与canonical返回不同的正文。
- Accordion首次打开才GET root；API验证全部后代仍连接该root且无重复/循环父关系，不把不完整关系假摊平。迭代遍历按父子关系、兄弟created_at/id排序；不递归渲染深层React树。
- reply target绑定真实Memo.id，显示@author及Memo#id；切target不改已有草稿文本；请求期间不能切target。小屏仅6px视觉缩进+彩线+显式父指向，数据parent_id不变。
- root直接回复数来自River或加载thread的`parent_id===rootId`计数；深层reply不会加root直接数。全文Markdown及任意层级reply留在同一卡片；收起仅hidden，不卸载已加载Composer，失败草稿可再次展开继续。
- 没有正文编辑/删除/附件、新Memo历史页、Tag全局管理、#task→Task副作用、跨刷新重试队列。

## 3. 施工偏差与优化

- Plan七个Memo文件外增加单一`MemoContent.tsx`，只负责root preview/全文及reply的安全只读Markdown共用呈现；复用已装remark-gfm/rehype-highlight，无raw HTML，不改MessageContent、不引依赖/渲染框架。
- 页面级`useMemoWrites`持有独立pending和每id写锁，Composer/Thread/TagsDialog复用；这是本feature内部状态，不新增全局store或持久队列。
- 关闭讨论保持hidden DOM，以保留草稿/真实target；API图关系guard在异常数据时显式报错，不假造父对象。
- 生产入口及Ledger桥留CP4；Task/Calendar入口仍disabled，不把CP2当全产品时间所有权切换。

## 4. 新开发测试与决定性断言

### `src/test/memo_api.test.ts` — 11 tests

- `requires start/whitespace boundary...leaves content unchanged`：Unicode字母/组合标记/astral字母可提取；AbC/abc各自保留；URL、word#inline、括号紧邻#、Markdown#空白不提取；正文未删改。
- `counts Unicode codepoints...`：50个astral字母通过；51报错且不截断；trim/exact dedup保留x/X区别。
- `POSTs raw content only...details have no reply_count`：POST body恰content原文；真实parent9 reply路径、独立PATCH tags；root详情后代9→7/10→9；Memo对象无reply_count。
- `preserves definite HTTP%i failures...`（400/403/404）：status/body/message保留且ambiguousWrite=false。
- `marks HTTP%i POST as uncertain`（500/503）：ambiguousWrite=true。
- `marks network failures and malformed successful POST...`：网络与缺id成功响应均uncertain；只POST，无猜id后的PATCH。
- `rejects wrong reply parent and malformed thread graph...`：错误parent成功响应ambiguous；循环关系读错误，不能摊平。
- `supports clearing tags with []...`：PATCH[]原样；错误返回id为CONTRACT。

### `src/test/memo_page.test.tsx` — 13 tests

- `saves raw content then patches exact extracted tags...never creates a Task`：原文含#task/#中文保持POST；PATCH新id100、去重tags；root清草稿并重启River首页，无tasks接口调用，新root成为第二主轴项。
- `clears a confirmed POST draft before PATCH completes...`：延迟PATCH期间草稿已空且disabled；双击只有1POST；PATCH503后显示“记录已保存，标签未保存”，retry仅再次PATCH100，POST数仍1。
- `retains distinct partial contexts across new drafts/memos...`：100/101各自失败；新未提交草稿不变；仅重试100带one，不影响101/two；POST总数2。
- `manual tag replacement clears same-id stale retry...`：手动fresh/Fresh成功清100旧pending；随后[]清标签，正文完全未变，POST仍1。
- `serializes same-id manual tags/retry...`：手动PATCH在途双击无重复；旧retry按钮disabled、Escape不关闭；完成后fresh生效并清旧pending，共1POST/2PATCH（含原失败自动PATCH）。
- `preserves draft and warns to verify uncertain %s POST...`（network/503/malformed）：先刷新核对提示、草稿保留、1POST/0PATCH，无自动重试。
- `keeps definite failure draft, rejects long tags...`：长tag先阻止POST，400留草稿/明确错误，修正后用户主动重提可完成。
- `loads only on expansion...selected real parent...`：未展开0次thread GET；关系/顺序8→9→11及兄弟10保留；改target11不改草稿；POST `/11/replies/`，新reply.parent=11；root直接数仍2/主轴仍1/无River重启。
- `direct root reply increments direct count...nested partial Tags...`：root直接回复增至3，nested回复不再增；partial retry只PATCH reply101；root卡同DOM/time、主轴仍1。
- `retains a failed reply draft through collapse/reopen...`：reply404草稿在收起/重开仍在；thread403显式读错，不假空。
- `tag management failure keeps input...`：reply长tag不POST；手动#前导名称阻止提交；合法输入PATCH403后dialog留输入及错误。

`memo_test_server.ts`为合成memory-only响应fixture（Map），模拟canonical root/reply/Tag数据；无真实DB/HTTP写行为。

## 5. 执行结果 / 连贯自检

事实查询与机械测试均下放scout/test-runner；本人按Plan/行为输入、完整Memo链路、当前缓存/锁/组件源与结果核对：POST确认边界、两步partial、manual清旧pending、真实父身份/直接count、root不位移及CP1scroll约束。未自行派生reviewer或Acceptance。

| 命令 | 结果 |
|---|---|
| `pnpm --filter exo-app exec vitest run src/test/memo_api.test.ts src/test/memo_page.test.tsx src/test/river_api.test.ts src/test/river_page.test.tsx src/test/river_scroll.test.tsx src/test/shell.test.tsx src/test/heartbeat_api.test.ts` | exit0；7 files /127 tests，0失败/错误/跳过。Memo API11+UI13，CP1/shell/HB保留103 |
| `pnpm --filter exo-app typecheck` | exit0，两份tsconfig |
| `pnpm --filter exo-app lint` | exit0 |
| `pnpm --filter exo-app build` | exit0 |

开发修正只发生在自有测试：最初4个thread UI测试等待可见region过早（数据仍pending），改等reply textarea后23条通过；随后typecheck指出call helper丢失url类型，改为HttpCall，并增加同id写锁反例，最终127条/静态/构建通过。未凭测试改业务规则或冻结工装。

既有非致命warning：Node localstorage-file；Vite大chunk（index约1167kB、mermaid等）/PWA inlineDynamicImports deprecated。未扩展为打包/环境修复。

## 6. 未验证 / 安全 / 交付边界

- 没有真实HTTP POST/PATCH、DB写入、真实Diary/Agent隐私读取、.env、付费/GCal调用、服务启停/隐藏后台或跨仓编辑；source仅只读，tests全mock。
- 迭代深度/父关系及小屏浅缩进有源码和DOM证据；真实mobile呈现/触屏/浏览器scroll与视觉仍待Alicia/其指定责任方确认，不把jsdom当真机PASS。
- 全量最终exo-app回归仍留最终收口；本次127为明确七文件开发/保留回归。未重验LR01/C2/B2/KF07，没改其修复。
- pending只活在当前River页面，不承诺刷新/跨路由草稿与写入幂等安全；不为此加持久队列、服务端幂等或权限模型。
- CP2独立核验与下阶段release归pane5/Alicia；交付即停，**不自动进CP3，不启生产导航，不声明C3已通过。**
