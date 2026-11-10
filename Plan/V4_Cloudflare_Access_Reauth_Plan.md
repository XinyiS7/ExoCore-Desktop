# V4 Cloudflare Access 过期自救修复计划

> **状态：** Ready for implementation  
> **Issue：** XinyiS7/ExoCore#123  
> **基线：** ExoCore-Desktop `main@e78b849`；伞仓 `main@60437ca`  
> **范围：** V4 `/app/`、伞仓 nginx 精确路由、诊断记录  
> **定稿：** [gpt-5.6-sol / Solaire]

## 0. 结论与事实起点

Issue #123 的根因、三层修复方向和范围边界成立，可直接进入施工。Plan 不重新论证已冻结的方案选型，只补足真实代码落点、跨仓边界和可验收接口。

| 事实 | 证据 |
|---|---|
| fetch 的 `TypeError` 在进入通知层前已被规范化为 `AppApiError(status=null)`，通知层看不到原始异常类型 | `packages/app/src/features/chat/api.ts:70-86` |
| 当前网络类错误统一显示“网络连接不可用”，没有在线/离线二分 | `packages/app/src/features/notifications/NotificationRuntime.tsx:35-50` |
| 横幅当前只有“重试”动作，错误公开契约仍是 `string \| null` | `NotificationRuntime.tsx:59, 502, 523-536`；`notificationContext.ts:11` |
| `/reauth` 不存在；nginx 没有根路径 catch-all，该地址当前返回 404 | `../nginx/nginx.conf:62-138` |
| `/app/` 导航当前直接由 precache shell 响应，不会先访问网络 | `packages/app/public/sw.js:26-38` |
| SW 由 InjectManifest 构建，生产 scope/base 均为 `/app/`；根路径 `/reauth` 位于其作用域外 | `packages/app/vite.config.ts:11-25` |
| 现有两套 SW 测试 harness 会剥离 import，并用固定参数执行真实 `sw.js`；新增 Workbox 标识符必须同步暴露 | `packages/app/src/test/p2d_d2_sw_routing.test.tsx:55-96`；`packages/app/src/acceptance/p2d_d2_acceptance.test.ts:37-65` |
| `NetworkFirst` 的 runtime cache 与 precache 不是同一缓存；仅替换 strategy 不能保证首次离线启动仍有壳 | Workbox 策略语义及当前 `precacheAndRoute(self.__WB_MANIFEST)` |

### 计划级校正

Issue 中“TypeError 分支”的用户语义正确，但施工落点应是通知层已有的“规范化网络失败”分支，而不是重新依赖已经丢失的原始 `TypeError` 类型。[gpt-5.6-sol / Solaire]

## 1. 目标与冻结边界

### 1.1 目标

1. 真离线时明确显示“设备已离线”。
2. 浏览器在线、但通知轮询发生规范化网络失败时，显示“连接被中断（可能是登录已过期）”，并提供显式“重新认证”动作。
3. “重新认证”离开 `/app/` 的 SW scope，经 `/reauth` 触发 Cloudflare Access 重认证，再返回 `/app/`。
4. `/app/` 文档导航改为网络优先；只把同源、basic、HTTP 200 的响应写入导航缓存。
5. 网络不可用时仍能从既有安全缓存返回应用壳，不出现首次离线白屏。
6. 将本次误判链条记录到 `DevelopLog/DebugLog.md`，供后续诊断复用。

### 1.2 已定取舍（不得在施工中改回）

- 不增加探测请求或 `redirect: "manual"` 认证检测。
- 不静默自动跳转；只能由用户点击“重新认证”。
- 不采用 unregister SW、清空全部 caches、reload 的恢复路径。
- 不修改 Cloudflare Access 会话时长或 dashboard 策略。
- 不处理 V3 `chat-core`、`chronicle`、`council` 的同类 SW。
- 不扩展到登出、多用户或通用认证状态机。

### 1.3 不变量

- 现有非阻断 `shell-sync-banner` 形态、轮询机制和“重试”动作保留。
- 400、5xx、CONTRACT、storage、游标等非网络错误的既有文案与行为不变。
- `NotificationContextValue.syncError` 继续对消费者暴露 `string | null`，不把 UI action 状态泄漏为公共上下文契约。[gpt-5.6-sol / Solaire]
- `/api/`、`/media/` 不进入文档导航缓存。
- 不新增第三方依赖。
- Agent 不重启或重建常驻 nginx 容器；配置生效操作由 Alicia 按现有运行纪律执行。

## 2. 实现规格

### U1 — 通知错误二分与显式重认证动作

**文件**

- `packages/app/src/features/notifications/NotificationRuntime.tsx`
- `packages/app/src/features/notifications/notifications.css`
- 必要时仅调整通知相关测试资产，不修改 transport/API contract。

**行为**

1. 将 `formatSyncError` 的结果扩展为通知层内部的结构化展示结果，至少表达：
   - 用户可见文案；
   - 是否允许显示“重新认证”动作。
2. 仅在当前规范化网络失败分支读取 `navigator.onLine`：
   - `false`：文案为“设备已离线”，不显示“重新认证”；
   - 其他情况：文案为“连接被中断（可能是登录已过期）”，显示“重新认证”。
3. 其他错误类型不获得重认证动作。
4. 内部结构化状态向 `NotificationContext` 和 demo 页面继续投影为原有字符串，避免扩大公共契约和无关消费者改造。
5. “重新认证”必须执行浏览器级文档导航到绝对路径 `/reauth`，不得使用 SPA 内部路由，也不得先清缓存或注销 SW。
6. 横幅动作区容纳“重试”和条件式“重新认证”；保持现有视觉层级、键盘可达性和窄屏可用性。

**关键决策**

- 不通过比较中文文案决定是否显示按钮；动作资格必须来自结构化状态。[gpt-5.6-sol / Solaire]
- 不修改 `AppApiError` 或共享 fetch 层。本需求只需区分“浏览器明确离线”与“在线时网络请求失败”，继续复用当前规范化错误入口即可。[gpt-5.6-sol / Solaire]

### U2 — SW 作用域外 `/reauth` 落地点（伞仓施工单元）

**文件**

- `../nginx/nginx.conf`（归属 `ExoCore_Project` 伞仓，不属于 Desktop git 仓）

**行为**

1. 在现有 server 块增加精确匹配 `/reauth` 的 location。
2. 该 location 只返回 `302 /app/`；旁注说明它必须位于 `/app/` SW scope 外，用于触发 Access 边界与新文档导航。
3. 不增加泛化 catch-all、不改变 `/app/` alias、不改变 Access dashboard 配置。

**交付边界**

- Desktop Builder 若无伞仓写权限，只提交 U1/U3/U4，并将 U2 按本节原样交回伞仓负责人。
- nginx 配置变更独立提交，提交信息引用 `XinyiS7/ExoCore#123`。
- 配置语法验证可以执行；不得由 Agent 擅自重启常驻 nginx。

### U3 — `/app/` 文档导航改为安全的 NetworkFirst

**文件**

- `packages/app/public/sw.js`
- `packages/app/src/test/p2d_d2_sw_routing.test.tsx`
- `packages/app/src/acceptance/p2d_d2_acceptance.test.ts`

**行为**

1. 保留 `precacheAndRoute`；将 `/app/` 的 `NavigationRoute` handler 从固定 precache 响应改为 `NetworkFirst`。
2. 为导航响应设置独立、命名明确的 runtime cache，便于检查和版本演进；本次不增加过期淘汰策略，因为该 route 只承载应用文档壳。
3. 配置 Workbox plugin 的 `cacheWillUpdate` 准入条件；只有同时满足以下条件的响应可写入 runtime cache：
   - HTTP status 为 200；
   - `response.type === "basic"`；
   - 响应 URL 与 SW 所在 origin 相同。
4. 网络成功但响应不满足缓存条件时，允许浏览器接收该网络响应，但不得污染应用壳缓存。Cloudflare 登录页因此可以显示，但不能被缓存为 `/app/index.html`。
5. 网络失败时按以下顺序恢复：
   - 使用 NetworkFirst 已有的安全 runtime cache；
   - runtime cache 尚未建立时，显式回退到 precache 中的 `/app/index.html`；
   - 两者都不存在时才让导航失败显式暴露，不返回伪成功空页面。
6. 保留现有 `/api/`、`/media/` denylist；`/reauth` 位于 SW scope 外，不为它增加虚假的 route 分支。
7. 同步更新两套真实 `sw.js` harness，使其能注入并观察新增的 Workbox strategy、precache fallback 和 route 注册接口；不得复制一份脱离生产文件的替代 SW 实现。

**关键决策**

- `NetworkFirst` 不能只做机械替换：必须保留 precache 作为“新 SW 已安装但 runtime 导航缓存尚未建立”时的离线后备。[gpt-5.6-sol / Solaire]
- 不增加 cache 清理迁移。过滤规则保证新写入安全；既有版本从未建立该导航 runtime cache，不存在本次必须清理的同名历史污染。[gpt-5.6-sol / Solaire]

### U4 — 诊断记录

**文件**

- `DevelopLog/DebugLog.md`

**记录内容**

- 症状：横幅误报“网络连接不可用”，重试无效。
- 根因链：Access 过期 → fetch 跟随跨域重定向失败 → 规范化网络错误；同时 precache navigation 阻止顶层文档触网。
- 决定性证据：请求 302 至 `wandering-dream-37db.cloudflareaccess.com`。
- 修复入口：在线/离线文案二分、`/reauth`、安全 NetworkFirst + precache fallback。
- 排障提醒：先检查 Access 会话，不要先归因 Wi-Fi；不得通过清空全部 SW/cache 作为常规修复。

## 3. 验证规格

> 本节只冻结验证目标与接口，不冻结具体测试实现。

### 3.1 自动回归

1. **通知错误分类**
   - 规范化网络失败且 `navigator.onLine === false`：渲染“设备已离线”；无“重新认证”。
   - 同类失败且浏览器在线：渲染“连接被中断（可能是登录已过期）”；存在“重新认证”。
   - “重新认证”触发的目标严格为 `/reauth`，不是 SPA 相对路由。
   - 既有 400、5xx、CONTRACT、普通重试和成功清错行为继续通过。
2. **SW route 注册与缓存准入**
   - `/app/` navigation 注册为 NetworkFirst；`/api/`、`/media/` 仍排除。
   - 同源 basic 200 可缓存。
   - 跨源响应、非 basic 响应、非 200 响应均不可缓存。
   - 网络失败且 runtime cache 为空时，可从 precache 返回 `/app/index.html`。
   - 网络失败且存在安全 runtime cache 时优先返回该缓存。
3. **构建门**
   - app 相关 Vitest 回归通过；
   - TypeScript typecheck、lint、production build 通过；
   - 两套 SW harness 均实际加载生产 `public/sw.js`。

### 3.2 nginx 验证

1. nginx 配置语法检查通过。
2. 在经过项目网关的环境请求 `/reauth`：
   - 若 Access 会话有效并到达 origin，响应为 `302` 且 `Location: /app/`；
   - 若 Access 会话已过期，由 Cloudflare Access 接管并出现登录流程。
3. 不以 Vite dev server 的 `/reauth` 行为作为 nginx 验收证据。

### 3.3 真实环境验收

1. 让 Access 会话失效（或在无痕环境移除对应授权 cookie）。
2. V4 出现“连接被中断（可能是登录已过期）”及“重新认证”，而不是“设备已离线”。
3. 点击后进入 Access 登录，完成认证后回到 `/app/`；通知轮询恢复，无需清缓存或注销 SW。
4. 正常联网刷新时，DevTools 显示 `/app/index.html` 发起真实网络请求。
5. 断网后冷启动仍显示应用壳，不白屏。
6. Cache Storage 中保存的 `/app/index.html` 为同源应用壳，不是 Cloudflare 登录 HTML。

## 4. 施工顺序与提交边界

1. U1：错误展示状态、按钮与对应回归。
2. U3：SW strategy、缓存过滤、precache fallback 与 harness 回归。
3. U2：伞仓 nginx 精确路由，由具备伞仓施工权限者独立提交。
4. U4：在实现行为确认后补 DebugLog 诊断记录。
5. 分别执行 Desktop 自动门、nginx 语法门和真实环境验收；不要为了测试 `/reauth` 重启网关。

建议至少拆为两个原子提交：

- Desktop：通知自救 + SW 安全网络优先 + 回归 + DebugLog；
- Umbrella：nginx `/reauth` 精确路由。

提交信息均写 `refs XinyiS7/ExoCore#123`，不得使用自动关闭关键字。

## 5. Ablation / Razor Check

施工前最终消融结果：[gpt-5.6-sol / Solaire]

- **保留**结构化 action 状态：否则只能靠中文文案反推按钮，脆弱且不可维护。
- **保留**precache fallback：它直接对应“首次离线启动不白屏”的验收，不是额外加固。
- **拒绝**认证探针、通用 auth store、401/403 后端契约、cache migration、V3 同步改造：均非 #123 验收所需。
- **拒绝**自动跳转、自动清缓存、自动重启 nginx：分别违反已定交互、安全边界和运行纪律。
- **不新增**性能、并发、多设备或恶意响应场景测试；本次只验证真实 Access 过期链条和离线壳不回归。

---

登记：[gpt-5.6-sol / Solaire] — 2026-11-10
