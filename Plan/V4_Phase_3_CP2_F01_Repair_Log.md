# CP2-F01 — 同页回复状态生命周期修复 execution-log

日期：2026-10-02；Builder pane7。范围仅CP2-F01/P1（依据只读R1 repair packet）；**施工验证交付，不自判CP2/C3 PASS、不进入CP3。**

## 1. 根因与目标核实

scout核实当前源码：`memo/queries.ts:55–72` root POST确认后cancel/reset River pages；`RiverPage.tsx:24,78`查询数据空时卡片确实卸载。此前`MemoComposer.tsx:9–24`的content/error/inFlight与`MemoThread.tsx:27–28`的target/sending均在卡片之下。503回调打到旧Composer，重建实例自然丢草稿/不确定提示。不是POST失败判定错误，也不是跨路由持久化问题。

冻结B9要求失败留草稿、uncertain先核对；同页新root只是另一次遍历，不能销毁别的reply意图。只推迟reset不能保护已经失败的状态；只临时留旧items不能保护新首页暂不含旧root的情况。

## 2. 修改文件 / 生命周期所有权

生产：
- 新 `features/memo/replyDrafts.ts`：唯一`useMemoReplyDrafts`在**RiverPage**调用。仅为用户交互过的rootId建立记录，含content、所选真实parent.id/author、saving、error；ref为动作判断的同步真值，state为呈现快照。表单禁用和真正防重入锁一起上移。
- `features/river/RiverPage.tsx`：实例化并向卡片传递同页owner。
- `features/river/RiverItemCard.tsx`：只传owner给MemoThread；不用保留过期卡片/旧游标链。
- `features/memo/MemoThread.tsx`：不再有卡片局部targetId/sending；根据owner读取目标/在途状态，选择目标时存真实id/author。重读中目标不在当前结果时保留真实身份并提示核对，不默默改成root。Accordion仍可局部收起/重建；重新打开恢复原意图。
- `features/memo/MemoComposer.tsx`：reply使用controlled呈现与page-owned submit，结果回写owner而非旧Composer setter；root Composer仍局部（它本来就在可替换卡片之外）。复用同一error转换文本，未改变POST/PATCH协议或不确定结果规则。

开发工装：
- 新 `src/test/memo_reply_lifetime.test.tsx`：3个泛化生命周期反例。
- `src/test/memo_test_server.ts`：添加可选memory-only River响应控制，允许冻结一个真实请求窗口/返回新的首页及cursor；其它fixture路径/数据默认行为保持。
- 本记录。未编辑验收probe、spec、acceptance report；没有查看验收probe源码/断言。

### 状态转移

1. 编辑/选目标：按rootId更新独立记录；不覆盖其他thread。默认回复root由所属rootId与读取的真实root决定，显式选择后快照真实parent。
2. 提交：从owner当前ref捕获content/tags/parent；校验与同步saving锁先于await。换实例不能绕过锁；期间文本与target动作被锁住。
3. POST确认：`onCreated`直接清该owner记录content；既有publish/Tags后续链路不变。
4. POST失败：错误/uncertain提示写该owner，content和parent保留；finally解除同条锁。卡片即使不存在，回调仍更新挂载着的RiverPage。
5. GET首页/分页让卡片重新出现：新Composer读同一rootId记录；不会自动POST，也不会把reply放进主轴。
6. 离开RiverPage：记录自然销毁；无localStorage、global store、定时器、后台队列或跨页面承诺。记录限当前页面中实际交互过的thread，不为所有River条目自动建状态。

## 3. 施工偏差与优化

选择packet允许的**同页有界状态上移**，而非保留所有旧卡片/placeholder列表：真实新首页可能根本没有旧root，所以列表保活不能解决整个规则。增加一个feature内部hook与controlled接口；不是跨模块公开API或全局框架。将既有POST错误文本提成共用函数，root/reply仍使用完全相同的错误语义。

`useMemoWrites.save`、root cancel/reset、River infinite query/key/remove/filter规则没有修改：第一次重建请求依旧cursor=null，后续只接受新首页next_cursor。不会通过延迟reset或定时器隐藏问题；加载窗口仍真正清空列表，测试明确证明卡片确已卸载。

Tags同id锁/partial pending/manual成功清旧retry、CP1私有scroll owner/CSS/Diary/HB/KF07均保留；无Task/Calendar/router/nav/shared/backend变更。

## 4. 泛化证据：具体用例与断言

新 `packages/app/src/test/memo_reply_lifetime.test.tsx`：

1. `preserves an already failed nested draft/uncertain error across a later root POST and slow first-page rebuild`
   - **先**对真实parent11 reply503并出现uncertain，再做新的root POST和慢GET（区别于原packet中“在加载窗口才失败”）。
   - 断言card7在加载期为null，真实发生卸载；恢复/重开后原`失败后仍保留 #Keep`正文、先刷新核对提示、@agent:2/Memo#11仍在。
   - parent11只有一次POST，0 PATCH；两次River请求cursor均null。不是仅等当前请求结束再reset。

2. `preserves the in-flight lock/real parent through remount, then clears only that confirmed successful reply and patches its tags`
   - parent9回复保持POST在途；root POST与慢GET造成卸载；**先恢复卡片，POST还没返回**。
   - 重建Textarea仍原文且disabled、其他target按钮disabled、target仍9；给disabled输入合成Ctrl+Enter也不能绕过page-owned锁。
   - 成功返回后清空该draft/解除busy，无错误；新reply101.parent_id=9，Tags只PATCH101一次且canonical tags为Keep。
   - reply POST仍1、主轴仅两个root且没有memo101；旧root occurred_at不变；新首页请求cursor=null。

3. `retains independent thread drafts/targets when old roots are absent from the fresh first page and return via its new cursor`
   - thread7/parent11与thread17/default root17分别保存未提交草稿A/B。
   - 新root成功后慢GET只返回新root100，旧两root不仅加载窗口缺席，**新首页也缺席**；只通过fresh-home-cursor后续页返回。
   - 重开两个thread，各自正文及真实parent11/17恢复，没有串目标/内容；请求cursor序列精确`[null, null, 'fresh-home-cursor']`。
   - 总POST仅新的root1次，reply POST为0，绝不自动补投草稿。

## 5. 开发验证与本人自检

runner只执行、未查看冻结probe源/断言；其机械SHA256前后均：
`1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2`。
这只证明此次执行前后probe未变，不扩大为历史所有资产的hash基线声明。

执行命令（native explicit paths）：

```text
pnpm --filter exo-app exec vitest run \
  src/test/memo_api.test.ts src/test/memo_page.test.tsx \
  src/test/memo_reply_lifetime.test.tsx \
  src/test/river_api.test.ts src/test/river_page.test.tsx \
  src/test/river_scroll.test.tsx src/test/shell.test.tsx \
  src/test/heartbeat_api.test.ts \
  src/test/acceptance/cp2_b9_reply_draft_reset.acceptance.test.tsx
```

结果：9 files / **131 passed**，0 failed/errors/skipped，exit0。
- 原Memo API11/UI13；新lifetime3；CP1/shell/HB保留103；冻结probe1。
- `pnpm --filter exo-app typecheck`：exit0。
- `pnpm --filter exo-app lint`：exit0。
- `pnpm --filter exo-app build`：exit0；只有已有大chunk/PWA deprecation warning。

本人按packet/B9、当前完整Page→Card→Thread→Composer链路与新hook源码亲核：真实reset仍卸载；ref锁/结果回调不再依附旧Composer；parent快照与跨thread更新不串；POST确认才清content、uncertain保留原文；新cursor链未改变，Tags链未改。没有自行派生reviewer/Acceptance。上述为开发证据，独立R2裁决仍归pane5。

## 6. 边界与交付

- 全mock/memory-only；无真实HTTP写、DB/.env/真实隐私/付费/GCal、服务启动/重启/隐藏进程/跨仓编辑/commit/文件清理。
- TypeScript/DOM异步生命周期证据不是浏览器真实layout或Alicia视觉PASS；无最终全量重跑，无LR01/C2/B2或KF07复验。
- Accordion展开态仍可因卡片重建恢复为关闭；用户重开后恢复reply状态。本次不新增自动展开/跨路由草稿功能。
- 交付pane5聚焦复核CP2-F01；停止施工、等待release，不进入CP3，不声明C3通过。
