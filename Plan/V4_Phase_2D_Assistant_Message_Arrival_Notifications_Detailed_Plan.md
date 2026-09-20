# ExoCore V4 — Phase 2D Assistant Message Arrival + Notifications Detailed Plan

> **Document type:** P2D executable implementation plan；仅覆盖 ordinary Conversation 的 assistant-message arrival、前台刷新、Web Push、设备订阅、未读与 typed navigation。
> **Status:** **APPROVED — CP D-1、CP D-2 已独立验收 PASS；CP D-3 R1 FAIL 后，Alicia 已批准“仅显式忽略创建 Register”的 backend-first 契约修订；D-3 暂停等待后端 gate 与 legacy subscription 前置条件。**
> **Repository:** `ExoCore-Desktop`；生产改动限本仓库 `packages/app`。`../ExoCore/` 只读，B6 已交付。
> **Product authority:** `[human / Alicia]`。
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`。
> **Mini-fork pruning review:** 状态持久化消融、scroll/runtime边界与测试环境复核 `[deepseek/deepseek-v4-flash / reviewer]`；由 `[gpt-5.6-sol / Solaire]` 逐项裁定并收口。
> **Planning baseline:** Desktop HEAD `5122e29348344612e27f2ad8aa419ca8b247ae0d`；P2C Final PASS；backend B6 Final PASS。
> **Frozen B6 contract integrity:** 精确抽取范围是从 `## 第八篇` heading（含）到紧邻 `## 第九篇` heading 之前（不含）。Desktop 与 backend 两段均为 12,435 UTF-8 bytes，SHA-256 `f4ad0067a123e2ff6a89e0c42c7ac3a15f60f4591c77184f6b6c0b78cac11d1c`；Builder按该heading边界复算，不对whole file求hash。
> **Planning-time worktree:** 当前 Desktop 有 63 条 dirty/staged/untracked 状态，主要属于已验收但尚未统一交付的 P2C 及 sibling work。P2D 施工前必须先取得这些重叠文件的独占 handoff 或落到 Alicia 批准的 checkpoint；禁止覆盖、重置或夹带。

---

## 1. 期望效果与本质问题

Alicia 的目标路径是：

```text
Sandro 调用 send_message
  -> assistant Message 成功落入 Sandro 的 Prime ordinary Conversation
  -> 后端产生一个 canonical assistant-message-arrived.v1
  -> V4 根据本设备此刻是否前台聚焦进行路由
       ├─ 正聚焦在该 Conversation：不弹系统通知，原位刷新消息
       ├─ 正聚焦在 V4 的其它页面：不弹系统通知，显示 V4 内未读提示
       └─ V4 未聚焦、在后台或关闭：显示一个 Android/系统 Web Push
            -> 点击后打开/聚焦 V4 canonical Conversation
```

本质问题不是再做一个“通知弹窗组件”，而是让**已经提交的 canonical assistant Message**成为唯一到达事实，并让所有观察路径收敛：

- `send_message`、普通 Chat 完成、前台轮询、Service Worker Push、页面重新聚焦和消息列表读取不能形成平行真相；
- PWA 正在前台聚焦时，用户不应同时看到系统弹窗；
- PWA 不在眼前时，Web Push 才承担系统提醒；
- 无论通知权限是否允许，重新打开或聚焦 V4 后都必须最终看到真实消息；
- 一次 arrival 最终只能产生一条消息、一份设备本地未读和至多一个系统通知。

### 1.1 Alicia 可观察的验收意图

1. Sandro 从 `send_message` 写入主会话后，已打开且聚焦于该会话的 V4 在不整页刷新、不弹 OS 通知的情况下显示新消息；
2. Alicia 正聚焦于 V4 的其它会话或页面时，不弹 OS 通知，但 Chat 导航、Recent 中对应会话和一个克制的 App 内提示能够指出新消息；
3. V4 处于后台、窗口失焦或关闭时，Android/桌面系统显示一条通知；同一消息不双弹；
4. 点击通知可在 warm/cold start 下进入 `/app/chat/:conversationId`；不存在或已删除的 Conversation 显示现有安全错误页，不跳到“最近会话”；
5. 即使通知权限拒绝、订阅过期或 Push provider 失败，V4 在 mount、重新联网或重新聚焦后仍通过 reconciliation 刷新；
6. 通知设置页能诚实区分浏览器能力、权限、浏览器 subscription、后端 persisted ACK 和恢复失败；
7. 普通 Chat、TTS、attachments、Agent/Project workspace、Settings 和 P2C 外观能力不回归。

P2D PASS 后才允许执行统一 Core C2 acceptance；本计划不自授 C2 PASS、commit 或 push。

---

## 2. 权威基线与施工前漂移门

### 2.1 权威顺序

1. `Plan/V4_Master_Implementation_Roadmap.md` §8.4、§8.6、§16、§17；
2. `[human / Alicia]` 本轮明确的“前台聚焦不弹窗、外部 `send_message` 落入会话后前端刷新”；
3. `ReactSheet.md` §8 的 B6 已交付契约；
4. 本 Detailed Plan；
5. 当前 `packages/app` 源码；
6. V3 Push/Notification 实现仅作兼容与失败案例证据，不作 V4 架构模板。

### 2.2 已核实的关键事实

- B6 已提供 `GET /api/push/assistant-arrivals/`：bootstrap 不回放历史，增量页按 `event_id ASC`，`limit` 为 `1..100`；前端以 `event_id` 推进 cursor、以 `dedupe_key` 去重。
- canonical event 固定为 `assistant-message-arrived.v1`，含正整数 `conversation_id/message_id/event_id`、`dedupe_key`、Agent、bounded preview、typed target、可选 `register_ack`、`title_hint` 与 `committed_at`。
- `dedupe_key` 固定为 `assistant-message:<message_id>`；Push payload 的 `tag` 同值且 `renotify=false`。
- Push `data.url` 恒为兼容 root，不是导航事实；V4 必须从 `data.event.target` 映射自身 route。
- `send_message` 与普通合法 assistant write 已在后端汇入同一个 arrival owner；GroupChat、Council、bridge/external、failed/stopped、replay 和空/tool-only 默认排除。
- 前台 freshness 的已冻结机制是 visibility-aware bounded polling：visible 时建议 15 秒，mount、`visibilitychange -> visible`、`online` 立即 reconcile；hidden 时停止普通轮询。
- 后端没有 unread/seen CRUD endpoint。P2D 的未读只能是**本 installation 的前端状态**，不能伪称跨设备 server truth。
- `POST /api/push/subscribe/` 只有响应 `persisted:true` 才证明后端持久化成功；V4 必须提交稳定 UUID `installation_id`。
- `POST /api/push/unsubscribe/` 按 endpoint 幂等返回 204。
- Register ACK 只在 event 明确携带 `register_ack` 时调用；ordinary Chat 不创建假 Register。ACK 为幂等，但失败不得空 catch。
- `packages/app/public/sw.js` 当前只有 Workbox precache/navigation fallback，没有 Push runtime；`main.tsx` 只处理 SW 更新重载。
- `packages/app` 使用 production basename `/app`；React Router 内部地址为 `/chat/:id`，Service Worker cold-open 地址为 `/app/chat/:id`。
- canonical message Query 是 `queryKeys.messages(conversationId)`；`mergeMessagePages()` 已按 Message ID 去重，`fetchFreshWindow()` / `applyFreshWindow()` 是现有 newest-window rebuild seam。
- `ConversationPage` 已维护唯一 scroll owner，并只在 reader 贴近底部时追随 canonical rows；P2D 不应另建 message list 或强制抢走阅读位置。
- `useChatRuntime` 的 runtime overlay 与 canonical Query 分离。Arrival 在本地 run 活跃时直接替换 newest window可能让已持久化 row 与 overlay短暂重复，因此必须协调，而不能无条件 refetch。
- V3 `exo-shared/endpoints/push.js` 会把“浏览器已有 subscription”误报为健康，并吞掉 backend persistence/unsubscribe 失败；不满足 B6，P2D 不复用该 hook。
- V3 Service Worker 使用旧 URL 推断、raw fallback、重复 ACK 和 silent catch；只可参考浏览器 API，不复制其状态模型。

### 2.3 Builder 开工前最小复核

只重读以下真实定义并按符号重定位：

- `packages/app/src/app/{AppProviders,router}.tsx`；
- `packages/app/src/shell/{AppShell,PrimaryNavigation,navigation}.tsx`；
- `packages/app/src/features/chat/{ConversationPage,RecentConversationList,queries,api,types}.ts*`；
- `packages/app/src/features/chat/runtime/useChatRuntime.ts` 的 busy/terminal/reconciliation seam；
- `packages/app/src/features/settings/{NotificationsPlaceholder,SettingsLayout,sections}.tsx`；
- `packages/app/src/main.tsx`、`packages/app/public/sw.js`、`packages/app/vite.config.ts`；
- `ReactSheet.md` §8；必要时只读核对 `../ExoCore/push/{views,serializers,arrival_service,services,models}.py` 与 `RegisterAckView`。

以下任一漂移必须停手报告：event kind/version/字段、bootstrap/cursor 语义、subscription persisted ACK、installation UUID、Register ACK URL/body、production basename、message Query owner、P2C 文件未释放或 B6 contract hash变化。

---

## 3. 冻结产品与架构决策

### D1 — “不弹窗”以本设备存在 foreground-focused V4 client 为边界

`[human / Alicia; gpt-5.6-sol / Solaire]`

- 至少一个同 origin、同 `/app/` scope 的 V4 window client 同时满足 `visibilityState='visible'` 且 focused 时，该设备不显示 OS notification；
- 如果 focused client 正在 exact `/chat/:conversationId`，只把 event 交给 App 做原位 reconciliation，不显示 App 内 toast；
- 如果 focused client 位于其它 Conversation/page，不显示 OS notification，写入 installation-local unread，并显示一个非模态、可关闭/可跳转的 shell indication；
- 仅仅“某个标签页存在”不等于 foreground。所有 V4 client 都 hidden/unfocused，或没有 client 时，显示一个系统 Web Push；
- hidden client 不得因为仍在 `clients.matchAll()` 中就压掉后台通知。

这里的“弹窗”特指系统 Web Push。exact Conversation 前台不再额外弹 App 内卡片；其它前台页面只显示 V4 shell-owned indication，不恢复 V3 浮动通知中心。

### D2 — 一个 typed arrival adapter，拒绝文本/URL 推断

新增 V4-owned notification adapter，对安全字段分层验证 `[deepseek/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`：

- **identity/ordering/privacy 必须 fail closed**：`kind/version`、正整数 ID、非负 `next_cursor`、`dedupe_key === assistant-message:<message_id>`、top-level/target ID一致、preview policy/text/truncated与nullable Register结构；
- **presentation-only 可安全降级**：非法/空的 `agent.name`回退为“Agent”，非法`title_hint`视为`null`，不可解析的`committed_at`不显示相对时间；这些字段不参与route、dedupe、cursor或privacy边界；
- identity/ordering/privacy malformed 2xx 是 contract error，不作为empty、不推进cursor、不写unread、不导航；错误只报告安全的page index及可验证时的`event_id`，不记录payload正文；
- 不做“失败N次后跳过坏event”的liveness捷径：跳过会永久丢失arrival。若同一后端坏event持续阻塞，停手升级contract repair；
- Push payload仅认`data.event`；`title/body/data.url`只做系统展示/legacy-safe fallback，绝不用于identity或route。

所有 network/error 归一继续复用现有 `AppApiError/contractError/toAppApiError`，不建立第二个错误 class。

### D3 — Window-localStorage持有一个installation状态；Service Worker保持无状态

由于B6没有server seen API，事实分层为：

- **server truth:** Message与`AssistantMessageArrival`；
- **transport progress:** 本installation的arrival cursor；
- **presentation truth:** 本installation按`dedupe_key`唯一的arrival/unread records；
- **Register handled:** 仅后端ACK管理，不能与普通unread混为一表。

`[deepseek/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]` 消融IndexedDB与worker/window共享schema：

- window侧使用与现有chat runtime一致的versioned `localStorage`纪律，key统一为`exo:v4:*`；保存schema/version、稳定installation UUID、last contiguous cursor及**一个**按`dedupe_key`唯一的bounded arrival map；
- 同一record同时承担poll/SW去重与未读呈现，只允许`source: poll | push`等最小来源标志；不建立第二类“Push先到、cursor未追上”ledger；
- Service Worker不读写cursor/unread/installation storage；background show不消费cursor，app下次foreground仍由poll读取并收敛；notification click直接读取`event.notification.data.event`；
- SW foreground handoff与poll都进入同一个`ingest(events)`入口；后到者只merge同一dedupe record，不触发第二次副作用；
- cursor承担已完成dedupe：若SW event的`event_id <= last contiguous cursor`且本地已无该dedupe record，说明它已被poll处理并消费，直接忽略；若record仍在则只merge不重复计数。这样seen后清掉record也不会被迟到Push重新加回；
- 写入必须幂等且有界；不得存完整Message、reasoning、tool data、TTS direction、Push keys或secret；
- storage损坏进入quarantine/显式outcome，不静默重置成“全已读”；storage不可用时显示恢复错误，但仍允许直接读取canonical Conversation。

多tab/window通过同一个localStorage事实与`storage`事件收敛；并发写必须merge当前最新snapshot，不允许last-writer覆盖掉sibling unread。清站点数据会生成新的installation UUID，后端可能暂留旧endpoint；这是部署/维护限制，不由前端猜测删除。

### D4 — Cursor bootstrap、分页与触发时机严格服从 B6

- 首次无 cursor：只调用 bootstrap，保存 `next_cursor`，不把既有历史伪装成新未读；
- 后续以 `after=<cursor>&limit=50` 增量读取；`has_more=true` 时立即继续取下一页，直到 drain 或本轮失败；
- 只有一页已严格验证、events 已幂等落入本地状态并完成所需 Query安排后，才推进到该页 `next_cursor`；
- 同一页面只允许一个in-flight reconcile owner；mount、15秒timer、online、visibility与SW handoff都调用同一个single-flight ingest/reconcile入口，不并发扇出；
- `document.visibilityState='visible'`时每15秒轮询；hidden时取消timer；mount、`online`、`visibilitychange -> visible`立即触发；
- polling使用`retry:false`（或runtime内至多一次明确受控重试）并显式展示失败；全局`AppProviders`的`refetchOnWindowFocus:false`保持不变，P2D自己的visibility/online触发是唯一refocus owner；
- permission denied/default、无PushSubscription、backend subscription失败均不得停止上述foreground reconciliation。

读取失败保留原cursor和已有未读；shell显示克制的“消息同步暂不可用/重试”，不清空缓存、不持续高频重试。

### D5 — canonical message刷新按 route与runtime状态协调

Arrival runtime位于 V4 shell边界，不依赖某个 Chat send callback。每批 verified events：

1. 始终使`queryKeys.conversations` stale，使Recent的`last_message_at`与后端排序可恢复；
2. 对非当前Conversation：只标记对应message Query stale，不主动拉取不可见会话全量历史；
3. **freshness与seen分开**：只要document visible就允许poll/标记stale；只有window focused且exact Conversation成功确认canonical Message时才消费seen。visible但unfocused的exact Conversation保持unread，且SW仍可显示OS notification；
4. 对当前exact Conversation、runtime idle且reader near-bottom：使用现有`fetchFreshWindow()` + `applyFreshWindow(..., false)`执行一次network fetch/apply；fresh page确认目标Message后消费seen并沿既有规则到底部；
5. 对当前exact Conversation但reader away-from-bottom：**不得调用`applyFreshWindow`**，因为它会把whole message family替换成newest page并破坏旧页scroll geometry。只保留unread、标记Query stale，并把现有“返回最新消息”增强为有新消息状态；用户回到底部时才执行一次fetch/apply；
6. 对当前exact Conversation且本地runtime busy/uncertain：不覆盖runtime-owned overlay/lease，静默合并pending event；runtime到安全终态并完成自身canonical reconcile后，先检查目标Message是否已存在——存在则直接dedupe/consume，不存在才按near-bottom/away规则处理。不得因普通direct completion为用户自己的回复显示“有外部新消息”假banner；
7. fetch/contract失败时不mark seen、不伪造Message row；保留pending unread并提供重试。

同一Message已由普通runtime完成并存在canonical Query时，arrival只完成dedupe/seen，不追加第二个bubble。`mergeMessagePages()`的Message-ID去重仍是最终渲染防线。P2D复用现有helpers，`queries.ts`无需新增第二个rebuild helper。

### D6 — 未读与 App 内提示保持克制，不复活 V3 NotificationPanel

- Chat 主导航显示 installation-local总未读数；0 时不渲染 badge；
- Recent 对有未读的 Conversation显示数量/新消息标记，但不改变后端权威排序；排序只通过 conversations refetch更新；
- 当前 focused exact Conversation在成功 canonical reconcile 后清除该会话中已确认存在的 event；仅打开其它页面不清除；
- 前台其它页面收到新到达时，shell显示最多一个当前 indication，内容只来自 bounded title/agent/preview；连续到达进入未读列表，不堆叠遮挡页面；
- indication 的“查看”导航到 typed Conversation；“关闭”仅关闭当前提示并保留普通 unread，除非该 event带 Register ACK，此时按明确用户动作发送 `dismiss`；
- 关闭提示不等于已阅读 canonical message；未读 badge仍存在；
- 不新增全屏通知中心、通知历史页、声音、自定义振动、优先级、频道或分析。

### D7 — Register ACK只由明确处理动作触发，失败可恢复

- event无 `register_ack`：不调用 ACK；
- exact focused Conversation在目标 Message成功进入 canonical Query后，可发送一次 `navigate` ACK；
- system notification点击导航：若已有V4 client，Service Worker发送 `navigate` ACK并把typed outcome移交Main；若无client而需cold open，SW不先发ACK，由新窗口在arrival canonical确认后通过Main发送，保证每条正常分支只有一个network owner；
- system notification action/关闭与 App内 indication显式关闭：发送 `dismiss` ACK；
- ACK body只允许 `action` 与可取得时的 `subscription_endpoint`，query只使用 event提供的 `preset_id`；
- ACK幂等允许 SW/Main在进程生命周期边缘重试，但本地必须按 event/action去重，避免正常路径双发；
- ACK失败不得阻止导航、Message显示或unread真相，也不得空catch。Main或已有client可接收的SW路径只保留一个最小pending-retry事实，在下一次safe trigger重试；普通页面不新增专用banner，必要诊断集中显示在Notifications设置页。**经 CP D-2 三次失败升级后由 Alicia 裁决：`notificationclose` 在无任何client且当次网络失败时属于best-effort，不承诺跨SW生命周期重试；在线成功或已有client可接收outcome时仍按正常dismiss ACK处理。**404/400作为终局错误记录并停止自动重试。

### D8 — Subscription UI区分五层状态，不把浏览器 subscription等同健康

`NotificationsPlaceholder` 由真实 `NotificationsPanel` 替代。UI至少区分：

1. browser不支持 Web Push；
2. permission `default/granted/denied`；
3. browser无 subscription / 有 subscription；
4. backend persistence checking / confirmed (`persisted:true`) / failed；
5. renewal/cleanup需要用户操作。

规则：

- 权限请求只允许由用户点击触发；mount不得自动弹权限框；
- installation UUID第一次生成后稳定持久，订阅与轮换都提交同一 UUID；无法持久化UUID时不得宣称健康；
- 若 permission已 granted且browser已有subscription，app可在mount/focus后静默向backend重新登记，以 `persisted:true` 重建健康证据；
- enable：用户手势请求权限、创建/复用 subscription、POST backend；backend失败时明确显示“浏览器已有、后端未确认”，保留恢复按钮；
- device name trim后可为空、最多200字符；更新名称通过当前subscription重新POST，不创建第二个 endpoint；
- disable优先让backend停用endpoint，再取消browser subscription。backend失败时保留browser subscription并显示失败；backend成功但browser cleanup失败时显示“后端已关闭、浏览器残留”并允许重试清理；
- 不显示 p256dh/auth，不记录endpoint全文到console/evidence；endpoint只在发送 ACK时内部使用；
- “已启用”只在当前生命周期获得 `persisted:true` 且本地subscription/installation一致时显示。

P2D建立 V4 typed client，不重写或迁移 V3 `exo-shared/endpoints/push.js`；V3保持rollback reference。

### D9 — Service Worker拥有后台显示与click routing，Main拥有React状态

`packages/app/public/sw.js` 增加：

- `push`：严格解析 B6 v1 event；检查同scope window clients的真实foreground/focus状态；foreground则postMessage typed event而不 `showNotification()`，否则使用后端 bounded title/body与`tag/renotify=false`显示一次；
- `notificationclick`：关闭当前通知；从 typed target构造scope-safe `/app/chat/:conversationId`；优先聚焦现有V4 client，SW发送ACK并postMessage typed outcome/导航；找不到client则不由SW先发ACK，只执行`clients.openWindow()`，由Main在canonical确认后发送一次ACK；绝不按URL前缀猜V3 SPA，不把ACK状态写入URL；
- `notificationclose`：仅对event携带的合法Register发送dismiss ACK；有client时移交typed outcome供诊断/重试，无client且网络失败时按已批准的best-effort限制结束，不引入IndexedDB、不伪称已持久化；
- `pushsubscriptionchange`：SW只用同一app-owned VAPID配置恢复browser subscription，不读取window installation storage、不以`installation_id=null`登记backend；向当前clients发送repair-needed，backend重登记统一留给app下次foreground的D8静默POST。若app一直不再打开，新endpoint不会被backend激活，这是明确限制而不是再引入IndexedDB的理由；
- Main↔SW消息只允许封闭的versioned message kinds：arrival handoff、typed navigate、subscription repair-needed、arrival consumed/close matching tag与既有SW update。

Malformed/legacy payload不得显示raw text、不得导航到payload URL。统一显示无敏感正文、无deeplink的generic “ExoCore有新消息”通知；这也是本地DevTools test push的明确入口。empty push不显示“连接已建立”之类噪声通知。

VAPID public key不是secret，但window subscription与SW renewal必须import同一个app-owned `workerContract`配置事实；V3 module-private旧常量仍是rollback copy，本期只记录而不跨包重构。不得缓存`/api/`或`/media/`，现有Workbox navigation denylist保持。

### D10 — Warm/cold typed navigation与stale target安全

- React内部adapter：`conversation_message` → `/chat/:conversationId`；
- Service Worker cold URL：以registration scope派生 `/app/chat/:conversationId`，不硬编码backend的`data.url`；
- warm click先post typed event/target，再focus并由React Router navigate；不整页reload；
- 多窗口时优先已focused V4 client，其次已visible V4 client，再选择任一同scope client；只导航一个client，不让多个窗口同时跳转；
- Conversation 404沿用现有“会话不存在或已删除”；无权/网络/消息同步失败显式显示，不退回最近会话、不猜Agent Prime Conversation；
- `message_id`用于验证、dedupe与刷新目标，不从Agent ID推导Conversation，不按preview/title搜索消息。

### D11 — 不新增全局store；Feature Provider是唯一运行时owner

预期结构：

```text
packages/app/src/features/notifications/
  contract.ts              B6 types + strict adapter + typed route target
  workerContract.ts        one worker/window-safe VAPID + SW message fact owner
  storage.ts               window-only localStorage cursor/arrival/unread persistence
  subscription.ts          browser Push lifecycle + subscribe/unsubscribe/ACK API
  NotificationRuntime.tsx  Context + polling/SW ingest/focus/unread/one indication
  NotificationsPanel.tsx   real settings surface
  notifications.css
```

Builder可按内聚性合并leaf，但层次不得倒置：

- Service/adapter验证 browser/API facts；
- Runtime owner编排visibility、cursor、Query与SW message；
- `AppShell` 是唯一 `NotificationRuntime` 挂载边界，使runtime可读取route且同时包住sidebar、bottom bar与`Outlet`；`AppProviders`不再增加第二层owner；
- Context只暴露稳定snapshot/actions；
- `AppShell`、`PrimaryNavigation`、`RecentConversationList`只消费projection，不直接调用PushManager/API；
- `ConversationPage`只提供当前runtime busy/reader状态与使用已有message rebuild seam，不复制arrival polling。

TanStack Query继续拥有server Message/Conversation；arrival cursor/unread不是server Query，不塞入Query cache。不要引入Zustand、Redux、通用event bus或新dependency。

---

## 4. Scope边界

### 4.1 包含

- B6 arrival typed adapter与15秒visible reconciliation；
- mount/online/refocus即时reconcile，hidden停轮询；
- exact Conversation安全原位刷新与runtime busy协调；
- installation-local unread、Chat badge、Recent marker、单一App内indication；
- `/settings/notifications`真实权限/subscription/backend persistence/设备名称/repair UI；
- V4 Service Worker Push显示、foreground suppress、notification click/close、subscription change；
- typed logical navigation、Register ACK与错误恢复；
- desktop + Android PWA trusted HTTPS验证；
- focused construction tests、full regression、browser/real-device evidence与Construction Evidence。

### 4.2 明确排除

- 任何 Django、migration、nginx、V3 package、`packages/shared` Push runtime修改；
- WebSocket、新SSE channel、Background Sync框架、native Android/Capacitor；
- GroupChat、Council、River、Task/system alerts或非Conversation notification classes；
- notification history page、全屏通知中心、声音、自定义振动、优先级/频道/静音时段；
- TTS autoplay、到达后自动朗读、Live API或电话；
- backend unread/seen endpoint、跨设备已读同步；
- Message模型复制、前端插入伪Message、按Agent推导Prime Conversation；
- 修改后端Push投递语义、VAPID key轮换机制或Register envelope；
- 借P2D重构Chat runtime、Query keys、Settings layout或PWA部署入口。

### 4.3 Backend配合结论

P2D没有新增backend production blocker。B6已交付的 §8 足够实施。若实际施工发现需要以下任一内容，必须停手并另写 backend handoff，不可猜测：

- server unread/seen；
- subscription list/health/provider-last-result endpoint；
-按message直接读取的deep-link endpoint；
-新的event kind/version/payload字段；
-跨设备focus presence上报。

---

## 5. 分段施工与Checkpoint holds

P2D严格串行三段。Plan自身不派发Builder/Reviewer；Alicia释放pane。每段只施工自己的owned files，上一段未通过不得提前开放下一段。

### CP D-1 — Typed arrival、cursor/unread与foreground Conversation刷新

实施：

1. 建立合并后的B6 `contract.ts`（types、strict adapter、typed route）与唯一错误映射；
2. 建立window-only localStorage installation/cursor/单一arrival-map持久层及损坏/不可用错误；
3. 建立shell-level Notification Runtime，所有poll/SW event进入同一`ingest(events)`，接入bootstrap、增量drain、15秒visible timer、mount/online/visibility触发与single-flight；
4. 接入Query invalidation、near-bottom才可执行的existing newest-window rebuild、away-from-bottom延迟、exact focused consume及runtime busy静默队列；不修改`queries.ts`；
5. 接入Chat总badge、Recent per-conversation marker与Runtime内一个非模态App内indication；
6. 此段不请求Notification permission、不创建PushSubscription、不显示OS notification。

**D-1 Hold:** 使用真实B6 shape的前台arrival可让Sandro消息进入exact Conversation；其它页面出现一次本地未读；duplicate/pagination/runtime-busy/storage/error不破坏canonical Chat，方可进入SW与subscription。

### CP D-2 — Notifications Settings、Web Push Service Worker与typed click

实施：

1. 将placeholder替换为真实Notifications panel，完成能力/权限/browser subscription/backend persisted/设备名/repair状态；
2. 实现稳定installation identity、enable/update/disable与ambiguous partial failure；
3. 扩展V4 `sw.js`：foreground suppress、background show、tag dedupe、click/close ACK、subscriptionchange repair；
4. Main/Runtime接入versioned SW messages；warm/cold route只由typed target派生；
5. foreground exact不显示App内toast；foreground other只显示in-app；unfocused/background/closed才显示OS Push；
6. 保持Workbox precache/navigation策略和P2C theme/font/settings行为；
7. production本地SW验证复用现有`packages/app/scripts/p2a_serve_dist.mjs`模拟nginx `/app/`映射；`http://localhost`作为secure context覆盖desktop SW/Push路径，不另造静态server。

**D-2 Hold:** 本地browser matrix与可控Push payload证明focus routing、单通知、typed navigation、subscription truth和ACK错误语义全部通过，方可进入真实设备closure。

### CP D-3 — Android/desktop closure、recovery与P2D final evidence

实施：

1. 在trusted production HTTPS与已安装PWA上完成Android visible/exact、visible/other、background、closed、lock-screen、warm click、cold click；
2. 测试设备进入实机矩阵前，用backend owner允许的只读方式确认该设备只有一个预期active endpoint/installation；若发现legacy `installation_id=null`或重复endpoint，停止并申请独立维护授权，不在P2D施工中删真实订阅；
3. 验证denied permission、offline→online、subscription renewal/repair、backend persistence failure与stale/deleted target；
4. 由Alicia授权使用真实Sandro `send_message`路径验证Prime Conversation落库→V4显示→通知路由；自动测试不得伪造真实AgentPreset或发paid provider call；
5. 运行full app regression、typecheck、lint、build、SW bundle inspection、diff checks；
6. 记录OEM battery optimization与Do Not Disturb是否影响系统展示，单独归类环境抑制，不误报为backend failure；
7. 更新P2D Construction Evidence、Roadmap capability记录与必要Update Log；不执行统一C2 acceptance本身。

**D-3 / P2D Final Hold:** §6全部目标有证据且P2D获得明确PASS后，才允许另行释放统一Core C2 acceptance。

### 5.1 停工/升级条件

出现任一情况立即停手交Alicia：

- P2C重叠文件仍有其他active owner或尚未形成可恢复checkpoint；
- B6 §8 shape/hash变化；
- 需要后端seen/health/message-detail新接口才能满足冻结目标；
- 浏览器不提供足够的client focus事实，导致无法可靠区分focused与仅存在；
- Service Worker无法在现有injectManifest构建中import同一worker-safe VAPID/message contract而必须复制V4常量；
- arrival刷新必须破坏`useChatRuntime` lease/overlay或重建第二个message owner；
- Android trusted HTTPS/PWA环境不可用；
- 必须修改backend、nginx、V3或acceptance-owned文件。

---

## 6. 二元验收目标（只冻结目标/接口，不冻结测试实现）

### 6.1 Baseline、scope与contract

- [ ] 施工前后HEAD、dirty ownership、owned file manifest有记录；P2C/sibling work未被覆盖或夹带。
- [ ] Desktop/backend `ReactSheet.md` §8继续一致；event/subscribe/ACK adapter无猜测字段。
- [ ] 无backend/nginx/V3/shared Push runtime/new dependency改动；无第二个error class、global store或message owner。
- [ ] malformed 2xx不推进cursor、不写unread、不导航；400 cursor/limit错误显式显示。
- [ ] GroupChat/Council/system/task/bridge payload不被V4伪装成ordinary Conversation arrival。

### 6.2 Cursor、dedupe与foreground freshness

- [ ] 首次bootstrap只保存high-water，不回放历史；合法空库cursor为0。
- [ ] 增量按ASC完整drain `has_more`；page失败保留前一contiguous cursor并可重试。
- [ ] mount、online、visible transition立即reconcile；visible约15秒轮询；hidden无普通timer请求。
- [ ] permission denied、无subscription与backend subscribe失败时，foreground reconciliation仍工作。
- [ ] 同一event经poll、SW、runtime completion、重复页和多tab观察后只有一个unread/一个canonical bubble。
- [ ] 多条连续assistant events保持独立顺序，不被latest覆盖。
- [ ] persistence损坏/禁用有显式错误，不静默清空成已读。

### 6.3 Exact Conversation与Chat runtime

- [ ] focused exact Conversation收到Sandro `send_message`后不reload页面、不弹OS/App内通知，刷新到exact Message。
- [ ] canonical refetch失败不插伪row、不mark seen；重试成功后收敛。
- [ ] 当前local runtime active/uncertain时arrival静默进入pending，不覆盖lease/overlay、不显示“外部新消息”假banner；终态后先查canonical row，确实缺失才安排一次rebuild。
- [ ] 当前reader near-bottom才fetch/apply并随新canonical row到底；scrolled-up时不调用`applyFreshWindow`、旧页与scroll geometry保持，通过增强后的返回最新入口才同步到新消息。
- [ ] conversations list被刷新到backend `last_message_at`/排序真相，但前端不自行排序。
- [ ] Message已由normal runtime存在时arrival不二次插入；TTS/attachments/trace字段仍来自canonical read。

### 6.4 Focus routing、unread与App内indication

- [ ] focused exact：OS=0、App indication=0、成功reconcile后对应本地unread=0。
- [ ] focused other Conversation/page：OS=0、一个shell indication、Chat总badge与Recent对应badge各精确一次。
- [ ] visible但unfocused的exact Conversation仍可poll/标记stale，但不consume seen；系统通知=1，重新focus后canonical确认并收敛unread。
- [ ] hidden/background/closed：系统通知=1；App重新聚焦后reconcile不产生第二条未读。
- [ ] hidden client存在不会压掉OS Push；多个window中一个focused client足以抑制本installation系统弹窗。
- [ ] indication关闭不清除普通unread；查看后进入正确Conversation并在canonical确认后清除。
- [ ] badge在refresh后保持；同一dedupe不累加；删除/不存在Conversation不跳转其它目标。
- [ ] indication使用bounded preview且不遮挡composer/dialog/More，不形成第二个通知中心。

### 6.5 Subscription settings truth

- [ ] unsupported/default/granted/denied、browser none/present、backend checking/persisted/failed、repair-needed可区分。
- [ ] mount不触发permission prompt；enable只由用户手势触发。
- [ ] installation UUID稳定、合法并在subscribe/renewal中一致；storage failure不宣称healthy。
- [ ] browser subscription存在但backend POST失败时显示browser-only，不显示“可接收推送”。
- [ ] backend只有`persisted:true`且identity一致时显示healthy；malformed 201是ambiguous failure。
- [ ] device name允许空、trim后≤200；更新复用endpoint/installation，不制造双订阅。
- [ ] disable的backend失败与browser cleanup失败分别可见，均可恢复且不假success。
- [ ] UI/console/evidence不显示p256dh/auth或完整endpoint；无secret/private message扩散。

### 6.6 Service Worker、Push与typed navigation

- [ ] production bundle实际包含push/click/close/subscriptionchange handlers；dev未注册假SW。
- [ ] foreground-focused client收到typed handoff且`showNotification`为0；其它状态使用`tag=dedupe_key`、`renotify=false`至多显示一次。
- [ ] notification title/body只来自后端bounded字段；raw/malformed/empty payload不泄露、不按任意URL导航。
- [ ] warm click聚焦并只导航一个V4 client；cold click打开scope-correct `/app/chat/:conversationId`。
- [ ] `data.url`、Agent ID、title/body均不参与route identity；typed target ID不一致fail closed。
- [ ] stale/deleted Conversation显示现有404；network/permission错误不重定向最近会话。
- [ ] pushsubscriptionchange只恢复browser subscription并通知repair-needed，不尝试从SW读取window installation、不以null identity静默登记；下次foreground使用原localStorage installation完成backend POST。
- [ ] SW更新、precache、`/api`/`/media` denylist、navigation fallback与P2C theme bootstrap不回归。

### 6.7 Register ACK

- [ ] `register_ack=null`永不请求ACK；ordinary Chat不伪造Register。
- [ ] system navigate/dismiss、App内显式dismiss和exact successful consume发送正确action/query/body。
- [ ] 正常路径同一event/action至多一次；生命周期边缘重复仍由幂等contract安全收敛。
- [ ] ACK失败不阻止导航/Message显示/unread；可重试状态可见，无empty catch。
- [ ] 400/404终局错误不无限重试；subscription endpoint仅内部发送，不展示。

### 6.8 Android与质量流水线

- [ ] trusted production HTTPS安装的Android PWA覆盖exact foreground、other foreground、background、closed、lock-screen。
- [ ] warm/cold click、denied permission、offline→online、renewal/repair与消息最终可见全部通过。
- [ ] 真实Sandro `send_message`只产生一个canonical Message、一个arrival、一个前端显示路径；不出现旧direct Push双弹。
- [ ] 实机前只读确认测试device不存在第二个legacy/stale active endpoint；若存在则证据标记环境未就绪并走独立维护授权，不由P2D删除。
- [ ] 清站点数据→新installation UUID的行为与旧endpoint残留风险被明确记录，不误称backend已自动归并legacy null identity。
- [ ] desktop production PWA同时覆盖focused/unfocused与多window选择。
- [ ] OEM battery/DND suppression与app/backend失败分开记录。
- [ ] focused construction suites、full `exo-app` regression、typecheck、lint、build、`git diff --check`均0 fail并报告numeric totals。
- [ ] Builder不编辑`src/acceptance/**`或acceptance reports；独立acceptance由Alicia另行释放。
- [ ] 自动验证不调用paid provider、不改真实AgentPreset、不打印secret/private payload；真实`send_message` smoke只在Alicia授权下执行。

---

## 7. 关键文件清单（planning-time，施工按符号重定位）

### 7.1 Create

- `packages/app/src/features/notifications/contract.ts`
- `packages/app/src/features/notifications/workerContract.ts`
- `packages/app/src/features/notifications/storage.ts`
- `packages/app/src/features/notifications/subscription.ts`
- `packages/app/src/features/notifications/NotificationRuntime.tsx`（同时持有Context与单一indication）
- `packages/app/src/features/notifications/NotificationsPanel.tsx`
- `packages/app/src/features/notifications/notifications.css`
- focused P2D construction tests under `packages/app/src/test/`（按contract/runtime/SW/settings分组，具体测试实现不在本Plan冻结）
- `Plan/V4_Phase_2D_Construction_Evidence.md`

Builder可合并纯leaf；不得拆出通用notification framework。

### 7.2 Modify

- `packages/app/public/sw.js`
- `packages/app/src/main.tsx`
- `packages/app/src/shell/AppShell.tsx`（唯一runtime挂载边界；包住shell projections与`Outlet`）
- `packages/app/src/app/router.tsx`
- `packages/app/src/shell/PrimaryNavigation.tsx`
- `packages/app/src/features/chat/ConversationPage.tsx`
- `packages/app/src/features/chat/RecentConversationList.tsx`
- `packages/app/src/features/settings/sections.ts`（仅更新已交付说明，如真实需要）
- `packages/app/src/features/settings/settings.css`（只移除placeholder专属样式/接真实panel布局）
- `packages/app/src/test/helpers.tsx`（接真实Notifications route/provider test harness）
- `packages/app/vite.config.ts`（仅当SW共享worker-compatible配置或manifest文字需要最小接线；不得改scope/start_url）
- `Plan/Update_log.md`（仅完工登记，保留sibling edits）
- `Plan/V4_Master_Implementation_Roadmap.md`（仅P2D PASS后更新capability/checkpoint记录）

### 7.3 Delete

- `packages/app/src/features/settings/NotificationsPlaceholder.tsx`：仅在真实`NotificationsPanel`已接线、全仓引用为零后删除。Roadmap明确由P2D接管，该placeholder的临时所有权届满；不得同时保留两套页面。

### 7.4 明确不改

- `../ExoCore/**`
- `packages/chat-core/**`、`packages/chronicle/**`、`packages/council/**`
- `packages/shared/src/endpoints/push.js`
- `nginx/**`、`hybrid_start.ps1`
- `packages/app/src/acceptance/**` 与现有acceptance reports。

---

## 8. Construction Evidence与handoff

Builder只维护 `Plan/V4_Phase_2D_Construction_Evidence.md`，记录事实而不自授PASS：

- entry HEAD、dirty ownership、P2C重叠文件handoff与owned manifest；
- B6 §8 hash复核；
- 每checkpoint changed symbols/files；
- event/page/subscription/ACK validator覆盖与错误分类；
- cursor/unread persistence schema、dedupe、清理与storage failure结果；
- focus/visibility矩阵、Query刷新次数、runtime-busy协调和scroll观察；
- SW source与production bundle双重检查；
- browser subscription/backend persistence/renewal partial failure状态；
- desktop与Android trusted HTTPS实机矩阵；
- 真实Sandro `send_message` smoke的授权、Conversation/Message/event identity和可见结果，不记录private正文；
- numeric tests/typecheck/lint/build/diff totals；
- known limitations：本期unread为installation-local；SW renewal只恢复browser subscription、backend登记等下次foreground；backend 410若browser不触发subscriptionchange只能在前台repair；清站点数据会产生新installation UUID并可能留下legacy endpoint；OEM/DND是环境抑制。

截图只证明布局/系统通知出现，不证明dedupe、cursor、Message identity、ACK或backend persistence。网络记录必须脱敏。

---

## 9. Rollback与失败语义

- P2D PASS前，关闭V4 Notification Runtime/真实Settings route并恢复P2C placeholder exposure即可回退；C1 Chat、P2T、P2C Settings继续可用。
- 回退不删除canonical Message、AssistantMessageArrival、Register、subscription或本地unread；不得用数据库清理伪造rollback。
- Service Worker rollback必须通过下一accepted artifact正常更新；不得要求用户手工清站点数据作为常规回退。
- 已持久化Push subscription在V4 UI回退后仍可能收到backend Push；若需停止曝光，必须通过正常unsubscribe或部署旧owner，不能仅删除按钮。
- cursor写失败保留旧cursor并重试；不得跳过未知区间。
- message rebuild失败保留旧canonical Query与unread；不得插preview当Message。
- subscribe ambiguous failure保留browser subscription并显示backend未确认；不得自动创建第二个subscription。
- unsubscribe partial failure按D8呈现，不进行逆向猜测。
- ACK失败不回滚导航或Message；终局400/404停止自动重试。
- 同一问题三次修复失败即熔断，整理最小复现、已证伪假设与剩余选择交Alicia。

---

## 10. Adversarial razor / Ablation Study

初版由`[gpt-5.6-sol / Solaire]`执行；Alicia随后显式提供`[deepseek/deepseek-v4-flash / reviewer]` mini-fork pruning review。本版只接受消融与既有验收边界内的correctness修正，未扩大scope。

### 10.1 保留：缺少即无法满足目标

- foreground reconciliation：这是Sandro外部写入刷新且不依赖Push permission的唯一已交付机制；
- SW focus routing：否则前台也会收到系统弹窗；
- window installation cursor + 单一arrival/unread map持久化：cursor推进后若不持久化unread，刷新会永久丢提醒；
- runtime-busy协调：否则arrival可能与本地overlay争夺message truth；
- typed target：否则cold/warm click只能猜V3 URL或Agent Prime Conversation；
- backend persisted ACK分层：否则设置页会把browser-only subscription误报健康；
- Register ACK：`send_message`现有Agent感知语义要求保留；
- Android trusted HTTPS实机：Push、锁屏、cold start无法由jsdom证明。

### 10.2 消融/拒绝

- IndexedDB、worker/window共享持久化schema与第二类Push-before-cursor ledger；SW无状态、一个window arrival map足够；
- WebSocket、新SSE channel、Background Sync framework；B6已有bounded polling；
- server unread/seen新模型；当前验收只需要installation-local且无后端接口；
- V3 NotificationPanel式历史抽屉；一个shell indication + badge足够；
- 全局Redux/Zustand/event bus；一个feature provider足够；
- 前端伪Message或直接把Push preview塞进timeline；
- 按Agent ID查Prime Conversation、按title/body/time去重；
- Push声音、TTS autoplay、自定义vibration、priority/channel、quiet hours；
- 通知统计、delivery analytics、跨设备presence；
- message deep-scroll/全文搜索新接口；canonical Conversation open已满足本期typed deeplink；
- 11个leaf文件与分离的types/api/route/context/indication文件；默认合并为7个内聚生产文件；
- 修改V3 shared push hook；它仍是rollback owner，V4使用更严格typed client；
- 为410 provider状态猜测“健康”；只报告当前可验证的browser/backend persistence facts；
- 借SW改造缓存API/media或生产root cutover；P7才拥有入口切换。

### 10.3 相邻改进（不进入P2D）

- backend durable unread/seen与跨设备同步；
- subscription list、provider last-success/410 health endpoint；
- notification inbox/history与按Agent/Conversation筛选；
- exact Message deep-link读取/定位endpoint；
- notification quiet hours/channel；
- native Android/Capacitor foreground service。

**Razor verdict:** 三个checkpoint都直接服务于“外部assistant Message前台刷新、聚焦不弹OS、后台单Push、typed返回”的冻结目标；再减会留下消息不可见或重复提醒，再加则进入后端新能力、通知中心或原生平台扩张。

---

## 11. 审批与释放规则

Alicia已批准本Plan；**CP D-1、CP D-2 已事实验收 PASS。CP D-2 的方案①修订继续有效：stateless SW；无client的notification-close失败为best-effort。Alicia 已明确释放 CP D-3（实机闭环、真实 Sandro `send_message` 联调与恢复矩阵），当前施工中。**

若当前 Pane 2 Builder（Gemini 3.8 Flash）的施工质量达到检查点要求，后续保持同一pane、同一Builder上下文连续完成D-2/D-3；检查点只暂停施工并接受独立验收，不因例行PASS主动更换Builder。FAIL修复仍留在同一checkpoint；只有质量、上下文、三次失败熔断或Alicia另行决定时才换Builder。`[human / Alicia]`

以下任何改变都属于scope change，必须回到Alicia：

- 将“foreground-focused不弹OS”改成“只要window存在就不弹”；
- 新增server unread/seen或跨设备状态；
- 改B6 event/subscription/ACK contract；
- 让Push preview直接成为Message；
- 加通知历史中心、声音、TTS autoplay或native Android；
- 把GroupChat/Council/system alerts带入同一runtime。

**署名：** `[gpt-5.6-sol / Solaire]`
---

## 12. Alicia-approved D-3 contract amendment — explicit Ignore only

Alicia has superseded the default Register/ACK interaction semantics during D-3. The authoritative cross-repository handoff is `Plan/spec/2026-09-14-assistant-arrival-explicit-ignore-handoff.md`.

Frozen product rule:

- `send_message` creates no default short Register;
- viewing/navigating creates no Register;
- OS X/swipe close creates no Register;
- only an explicit `忽略` action creates one idempotent server-owned short Register, `Alicia 已忽略你的消息`;
- explicit ignore does not navigate or consume installation-local unread;
- a fully closed/offline stateless-SW ignore remains best-effort;
- backend contract implementation and acceptance precede frontend release;
- legacy subscription cleanup remains a separate D-3 precondition.

The prior CP D-2 navigate/dismiss ACK gates are preserved as historical acceptance evidence but are superseded for the final P2D product verdict. CP D-3 remains open; Core C2 is not released.
### 12.1 Multi-origin subscription environment decision

Alicia confirmed active subscriptions 21 (Mac/Tailscale), 32 (Android/Tailscale), 49 (Android/Home LAN), 51 (Windows V4 test), and 52 (Android V4 test) are intentionally retained. No maintenance deactivation is authorized. The Android Home and Tailscale origins may each display one Push for the same arrival; Alicia accepts this cross-origin duplication. At-most-once remains scoped per installation/origin, while the new explicit-ignore backend action must remain globally idempotent per arrival across all devices/origins.
