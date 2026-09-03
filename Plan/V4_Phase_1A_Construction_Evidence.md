# P1A Construction Evidence — V4 App Shell & Conversation Read (Task 2–8)

> **Builder:** deepseek-v4-flash / Ecki — 2026-09-02.
> **Plan:** `Plan/V4_Phase_1A_App_Shell_Conversation_Read_Detailed_Plan.md`（frozen，Construction 未编辑）。
> **Decision:** D1 `D-A + M1 + X1 + C1` [Alicia / approved]（`Plan/V4_Phase_1A_App_Shell_Navigation_Decision.md`）。
> **Baselines:** Desktop `f48b4fe`（opening/closing HEAD 未变）；outer `8836cf4`（未变）；ExoCore backend clean（开/收工零 delta）。
> **Risk level:** H（新 package + 双 repo 部署配置 + nginx 容器重建 + 受控真实库探测）。
> 本文档是 Builder 证据记录；**Builder verdict: not issued**（C1A 判定归独立验收）。

---

## 1. Construction matrix（自对抗检查点记录）

| 维度 | 冻结问题 | 观察结果 |
|---|---|---|
| Invariant | Recent 数组不被前端排序/变异 | api.ts normalize 新建对象；list 直通渲染；测试断言原数组 deep-equal 不变 |
| Invariant | offset 从最新端倒数的分页契约 | fetchMessagePage(offset 递增=已载条数)；getNextPageParam = offset+len；merge 纯函数倒序合并+id 去重；has_more=false 终止；单测 4 场景 |
| Invariant | create 只允许 `sessions/init/` | adapter 唯一 POST 目标；测试断言无 `/conversations/` POST |
| Entry paths | Recent/direct/create → 同一 detail 实现 | router 单一路由 `chat/:conversationId`；三个入口测试各自打开同一页面组件 |
| Entry paths | 路由参数非法不发请求 | `isValidConversationId` 门 + enabled=false；测试断言无 chat/conversation 请求 |
| State | 空历史 / 404(detail) / 404(messages) / 网络错 / 无效 id 可区分 | ConversationPage 分支各自渲染；测试分别覆盖 |
| State | 快速切换会话不得泄漏旧消息 | queryKey 按 conversationId 隔离 + merged===undefined 门控 + 组件按 id remount（key 由父层 pages 缓存保证）；测试覆盖路由级进入 |
| Timing | load older 保持滚动位置 | pendingAnchor {top,height} + useLayoutEffect 恢复 scrollTop=top+Δheight；jsdom 无法验证真实滚动（人工矩阵项） |
| Timing | duplicate submit | 按钮 pending disabled + 测试用 gate promise 断言只发 1 请求 |
| Failure | 畸形 envelope 不得当空成功 | 顶层 envelope guard（list/array、init/data、page/messages…）；CONTRACT error 测试 3 例 |
| Failure | 400 字段错误对话框内可见 | fieldErrors 映射 setError + banner；测试断言可见且 dialog 不关 |
| Ownership | 服务端状态单一 TanStack Query；无全局 store | 单 QueryClient；query key 家族集中；无 Zustand/context store |
| Observation | 真实 201 init envelope | **实测缺 data.session_id**（DRF read_only 无属性被跳过）→ 见 §3 偏差备忘 |

## 2. Implementation facts（关键 file :: symbol 行为变更）

| File | Observable behavior |
|---|---|
| `packages/app/src/features/chat/api.ts :: createConversation` | POST sessions/init（永不 POST conversations）；**⚠ initial implementation（SUPERSEDED by §6）曾**：响应含 session_id 则直用，缺省时经 canonical list 按 session_name + max id 解析；**当前态：只认 canonical `data.conversation_id`，缺/非法 → CONTRACT error，零推断** |
| `api.ts :: fetchMessagePage / listConversations / …` | 六接口 + 顶层 envelope guard + 归一化不突变 server DTO |
| `queries.ts :: mergeMessagePages / useMessagePagesQuery / useCreateConversationMutation` | offset 分页 merge（纯函数）；create onSuccess 先 invalidate Recent 再回调 |
| `shell/AppShell.tsx` | C1：`/chat/:id` 时 bottom bar 整棵不渲染；100% 可用高 |
| `shell/navigation.ts + PrimaryNavigation.tsx` | 单一 NAV_ITEMS 数据 → sidebar/bottom 双投影；未来区 semantic disabled + phase chip（无空页面路由） |
| `shell/PrimaryNavigation.tsx :: MoreMenu` | X1 头像溢出菜单：Profile/设置/通知全 disabled+P2 徽标；Escape/outside-click 关闭 |
| `features/chat/MessageContent.tsx` | 只读 markdown：GFM+hljs+KaTeX；**无 rehype-raw**（V3 同策略，零脚本面）；mermaid 动态 import 仅遇 fence 时加载（securityLevel strict） |
| `features/chat/CreateConversationDialog.tsx` | RHF：Agent 必选/项目可选/空白名省略；g045 才出现 permission 多选且自动排除主项目；非 g045 无权限 UI |
| `features/chat/ConversationPage.tsx` | detail/messages 独立 fetch；invalid/404/error/empty 状态区分；无 composer 无 runtime 端点 |
| `shared/src/api.d.ts` + `shared/package.json` | 仅暴露 `exo-shared/api` 消费面 types 条件；V3 runtime 零变更（node 冒烟验证 exports intact） |
| `ReactSheet.md` §3.8 | Project 列表字段 `title` 旧称 → 真实 serializer 字段集（含示例 JSON） |
| `Nginx/nginx.conf` | 新增 `location /app/` + SPA fallback；根重定向/三 V3 location/api/media/TLS 未动 |
| `hybrid_start.ps1` | app dist 校验；容器 create 函数含第 4 挂载；running+缺挂载 → 有界 rm/recreate；running+挂载齐 → `nginx -t` + `reload`（拒绝陈旧配置）；URL 打印 4 SPA |
| `packages/app/package.json` 等 | 版本纪律：复用 V3 lockfile 版本；net-new = @tanstack/react-query ^5.102.0、react-hook-form ^7.87.0、typescript ^5.9.3、@typescript-eslint/* ^8.69.0、@types/node ^24（按计划逐条记录） |

**与 §7.1 文件清单的偏差（仅增补，未删）**：`shell/navigation.ts`（react-refresh 规则要求组件文件只导出组件）、`features/chat/time.ts`（两处共用时间格式化）、`vite-env.d.ts`（vite/pwa client types）、`src/test/*`（测试 4 文件 + helpers）。理由均为工程必要，无功能扩 scope。

## 3. Deviation memo — init 201 envelope 实测缺 session_id

> **⚠ initial implementation, SUPERSEDED by §6 + backend commit `29368bbf`**：下方 name/max-id 解析方案是 P1A 初始实现的历史记录，**不是当前态**。R1 修复（§6）起 backend 双发 canonical `data.conversation_id`，V4 adapter 只消费 `conversation_id`，name/max-id 推断已全部删除；本 memo 保留仅作偏差历史与验收裁决依据。

**发现：** 受控真实探测（2026-09-02）显示 `POST /api/agents/sessions/init/` 201 响应体为 `{msg, data:{session_name}}`——**没有 `data.session_id`**。根因：`SuperiorSessionInitSerializer` 声明 read_only `session_id` 但 create() 返回的 Conversation 实例无该属性 → DRF `SkipField` 静默省略。C0 snapshot 的 conversation.create.init success envelope 与实际不符（backend 只读不可修；既有测试无一处钉住该 envelope）。

**初始适配（不改后端/不伪造，已 SUPERSEDED）：** adapter 优先消费存在的 session_id；缺失时 invalidate 后经 canonical list 按返回的 session_name + max id 解析真实行；解析失败显式返回 null id，UI 关闭对话框并停留刷新后的 Recent（新会话可见可打开），对话框内绝无"创建失败"假象也不可重复提交。局限（单用户机、毫秒级并发竞态可接受）已记录。

**snapshot 同步：** frozen P0 artifact 未编辑；此发现随本报告交给独立验收裁决是否批准后续修正。

## 4. Verification executed（实测数值）

- `pnpm build`（Desktop 递归 4 包）：exit 0（app 980ms；仅 chunk>500kB 警告，mermaid lazy）
- `exo-app typecheck` / `lint`：exit 0 / exit 0（0 errors 0 warnings）
- `exo-app test:run`：4 files / **46 passed**，exit 0
- `exo-chat-core test:run`：12 files / **85 passed**（V3 回归无损），exit 0
- V3 lint 指纹：chat-core exit 1（**168 problems** = 基线）；chronicle/council exit 2（无 flat config = 基线）；均 KNOWN-DIRTY 不变
- dev smoke：exo-app :5176 `/`→200、`/chat/1`→200；**strictPort 二次启动 exit 1**（Port 5176 is already in use）；V3 :5173/:5174/:5175 → 200×3；全部端口释放
- 静态产物：index.html assets 前缀 `/app/assets/`×2；manifest `id exocore-app / scope /app/ / start_url /app/`；sw.js fallback `/app/index.html`、无 /api 缓存策略；dist 被 .gitignore（check-ignore 通过）；app/src 无 V3 源码 import（grep 0）
- backend：`manage.py check` exit 0；`makemigrations --check --dry-run` exit 0（no changes）；focused regressions `core.tests.test_core + agents.tests.test_agentpreset_write_lock + AgentChatUserIdentityTests` → **Ran 77 / OK** exit 0（test 库）；backend worktree 开收工 clean
- 部署：hybrid_start.ps1 -AutoStart 实测——detect 缺 /app/ 挂载 → **容器重建成功**；mounts 4 项齐全；`nginx -t` ok；URL 断言 `/`→301 `/chat/`、`/chat/ /chronicle/ /council/ /app/ /app/chat/1 /app/sw.js` 全 200；api 经 nginx 200
- PowerShell parser：PS-PARSE-OK
- 受控 live create probe：201（envelope 仅 session_name）→ list 解析 id=112 → detail/chat 空历史 has_more=false → **ORM cleanup 完成**（id 不存在、probe 命名残留 0、无关数据未动）
- 真实库 AgentPreset baseline：开工 `OK: 8 rows`、探测前后 `OK: 8 rows [1..8]`、收工 `OK: 8 rows`

## 5. Not executed / not independently verified

- 真实浏览器人工矩阵：桌面/移动宽度视觉、PWA 安装/scope、mermaid/katex 实渲、慢网与滚动锚点手感（jsdom 无法覆盖；需 manual QA）
- 键盘焦点陷阱的完整循环遍历（仅入口/Escape/返回做了自动化断言）
- 多窗口并发 init 竞态下的 name+max-id 解析（单用户机，已在 §3 记录局限）

## 6. R1 repair record — C1A-R1-01..05（backend dependency 29368bbf）

**Backend dependency:** `29368bbf fix(agents): sessions/init 响应契约补 canonical conversation_id（session_id 降级为兼容别名）`（ExoCore，independent verified CLEAN）。前端修复仅在契约冻结后执行。

| Finding | Changed files :: symbols | Match evidence |
|---|---|---|
| **R1-01** | `features/chat/types.ts :: InitEnvelope.data{conversation_id required, session_id? deprecated alias}`、`CreateConversationResult.conversationId: number`（不再 nullable）；`api.ts :: createConversation` 只认 `data.conversation_id`，缺/非法 → contractError，**list/name/max-id 推断全删**；`ChatHomePage.tsx :: handleCreated` 恒导航 `/chat/${conversationId}` | `sessionId` src 残留 0；`listConversations()` 在 createConversation 内引用 0（仅 Recent 列表导出保留）；conversation_id guard 4 处（api×2/types×2） |
| **R1-02** | `styles/shell.css :: .app-nav--bottom .app-phase-chip`（display:none → 紧凑可见：8px/居中/max-width ellipsis；320px 四槽不换行）；C1 detail 无底栏逻辑未动 | shell.css 中 display:none 仅 3 处响应式切换（sidebar/bottombar/more ≥768px），无 chip 隐藏；`P2` chip 文本断言测试保留 |
| **R1-03** | `hybrid_start.ps1`（outer repo）:: `$RequiredMounts` 四挂载 manifest（chat/chronicle/council/app，source+dest）、`Normalize-MountPath`、`Test-NginxMounts`（容忍 host_mnt/大小写/盘符差异但验证真实 source）、`Invoke-NginxConfigReload`（nginx -t 失败 → ERROR+exit 1 拒 reload；reload 退出码非 0 → ERROR+exit 1；绝不到 ready 文案）；四态分支（running+齐全→校验重载 / 齐全未运行→start / 不齐全→有界重建 / 不存在→create） | PS-PARSE-OK；真实容器路径实测 exit 0 + “nginx -t 校验通过…已重新加载” |
| **R1-04** | `packages/app/package.json` 移除 `rehype-raw@^7.0.0`；`pnpm-lock.yaml` 仅删 app importer 3 行 | app manifest 引用 0；lock 保留 3 处（chat-core importer+snapshot×2，V3 版本零变动）；pnpm install “Already up to date” |
| **R1-05** | `features/chat/MessageContent.tsx :: CodeBlock`（CopyButton 整删 + lucide Check/Copy import 移除）；`styles/base.css` 删 `.app-code-copy`/hover 死规则 | `app-code-copy|CopyButton` src 计数 0；clipboard 引用仅剩说明注释 |

**Tests updated:** `src/test/api.test.ts` —— create 成功用例改 dual-emit envelope 断言 `conversationId 77`；新增“不依赖 deprecated alias”（无 session_id 时成功）+“缺 canonical id → CONTRACT 且零 list 推断请求”（calls=1，无 /conversations/ GET）；原两例 list-resolution 测试删除。`src/test/create.test.tsx` initOk envelope 改 dual-emit。

**Numeric results（R1）:** exo-app typecheck/lint exit 0；vitest **46/46**；Desktop root build 4 包 exit 0；chat-core **85/85**；lint 指纹 chat 168 / chronicle exit2 / council exit2 与基线一致；backend `check` 0 + 无 migration drift + focused **87 Ran / OK**（含新 test_session_init_identity 10 条）；nginx 静态 URL 七断言全 200/301 正确。

**Unexecuted:** launcher 负路径状态矩阵（缺挂载/坏配置/reload 失败）未在真实容器上演练——需 Acceptance 状态矩阵核验（避免中途破坏现役容器）；320/390/767 浏览器宽度断言归 Acceptance（C1A-H01 已声明的 harness）。

**Controlled live probe（archived preset 3，修正版）：** init 201 实测 data keys = `[conversation_id, session_id, session_name]`，id=113 双发相等；detail+空历史 has_more=false 通过；ORM 删除完成（存在性 False、probe-name 残留 0）；preset 3 未触碰（name/is_visible/model 原值）；收工真实库基线 `OK: 8 rows [1-8]`。

**Frontend fix depends on backend 29368bbf**: V4 不可对旧后端发布（契约要求 conversation_id）。

## 7. R2 repair record — C1A-R2-01/02/03（backend dependency 29368bbf，未触碰）

| Finding | Changed files :: symbols | Match evidence |
|---|---|---|
| **R2-01** | `api.ts :: AppApiError.ambiguousWrite`（新增只读标志）；`createConversation` 正整数守卫 `Number.isInteger && > 0`，malformed 2xx envelope → CONTRACT + ambiguousWrite（明确中文提示）；`queries.ts :: useCreateConversationMutation` 第二回调 onAmbiguousWrite（先 invalidate Recent，永不推断 identity）；`CreateConversationDialog.tsx` 终态锁：banner 显式提示 + 提交按钮永久 disabled（“创建已锁定”，仍可取消/关闭/Escape）；onSubmit 顶部早退双保险 | Number.isInteger×1；ambiguousWrite 引用×12；createConversation 内 list 推断调用 0 |
| **R2-02** | `base.css :root` 新增 `--v4-bb-offset: 65px` 单一契约 token（内容 64 = icon18+label14+badge14+gap6+padding12，+边框1）；`shell.css` main offset 与 bottombar min-height 均 calc(token + safe-area)；bottom nav label/badge 固定 line-height/padding 使内容恰 64px（无 ResizeObserver） | token 引用×6；无 runtime 测量 |
| **R2-03** | `hybrid_start.ps1`（outer）:: `[switch]$SelfTest`；五函数 + $RequiredMounts 上移顶部（SelfTest 先于一切副作用）；canonical normalize（D:/、/host_mnt/d/、//d/、/d/ → 同一形式）**精确相等**；四态分支后统一终态门禁 Confirm-NginxReady（running+精确四挂载+nginx -t）才进 ready，失败 exit 1；reload 仅在 running+齐全分支严格失败 | .Contains( 0；Confirm-NginxReady×3；SelfTest 8/8 PASS |

**Numeric results（R2 focused）：** app typecheck/lint exit 0；vitest **51/51**（+UI 终态锁测试 + it.each 4 数值守卫）；PS SelfTest 8/8 exit 0；真实容器路径：四挂载齐全 → -t → reload → 终态门禁 “nginx 就绪” → URL /chat/ /app/ /api 200。**Full regression 未跑**（deferred 至 R3 关闭后）。

**Unexecuted：** 320/390/767/768 + detail 浏览器实测归 Acceptance；Django 分支既有缺陷（德语 locale netstat 匹配 → 端口占用仍二次启动报 ERROR，非 R2 范围，记录待后续处理，脚本退出码 0 且既有服务不受影响）。

**Live write：** R2 focused 未再真实 create（合法 dual-emit 消费路径不变；live probe 已于 R1 以 archived preset 3 完成 + ORM 清理；backend 29368bbf clean）。

## 7b. R3 repair record — C1A-R3-01 mobile geometry（RESUME AUTHORIZED，scope 仅此）

**Frozen predicate（Acceptance escalation 钉死）：** CSS 宽度 320/390/767 下 main 底部保留偏移 ≥ 渲染后 fixed bottom-bar 外高（CSS px）；768 桌面与 390 detail 保持零偏移/无底栏；DPR 变化不新增验收维度。

| Finding | Changed files :: symbols | Evidence |
|---|---|---|
| **R3-01** | `shell.css :: .app-nav--bottom .app-nav-item` 新增 `border: 0`（去除继承自共享 .app-nav-item 的 1px transparent border——sidebar 时代防抖占位，bottom 投影下贡献 +2px 使 item box=66）；`.app-bottombar` 由 `min-height`（内容可撑大）改 **`height` 锁定** `calc(var(--v4-bb-offset) + env(safe-area-inset-bottom))`；注释记录 border-free + 固定 metrics ⇒ 内容恰 64px；`--v4-bb-offset: 65px` 基准保留 | 根因：65 算式漏 item 上下各 1px 透明 border + parent border-top 1px → bar=67 而 reserve=65 |

**Measured（Edge headless CDP, DPR=1, served dist）：**
- home-320×800: barH=**65** padMain=**65** diff=**0**；chips 3 个 block 可见（right ≤ 128.9/208.9/295.5 ≤ 320）；scrollW=320 无横向溢出
- home-390×844: barH=**65** padMain=**65** diff=**0**；barTop=779=844−65；chips right ≤ 356.8 ≤ 390
- home-767×900: barH=**65** padMain=**65** diff=**0**；chips right ≤ 686.7 ≤ 767
- home-768×900: bar display **none**；padMain=**0**（media 清除）
- detail-390×844: bar 缺位；.app-main 无 --bb；padMain=**0**
→ 冻结谓词全宽通过（offset ≥ bar 外高，恰相等 0）。

**Numeric focused：** typecheck/lint exit 0；vitest **51/51**（CSS 变更无逻辑回归）。Edge 探测进程已清理（端口 9223 释放，临时文件删除）。

**未触碰：** R2-01/R2-03（closed）、backend 29368bbf、P2-01、导航结构/视觉设计、无 JS 测量代码。

## 8. Declared boundaries（R3 之后重确认）

- P2-01（/app slash redirect）未实现——非阻塞邻接 scope，未经批准（Solaire 指令明确排除）。
- 未编辑：frozen Plan / D1 / P0 snapshot（Acceptance 已同步 v1.1 amendment）/ ReactSheet / acceptance report / handoff。
- V3 源码零改动；ExoCore backend 由 backend owner 提交 29368bbf，我零改动（worktree clean）。
- 无 commit；停在 C1A re-acceptance 前。
- P1B–P1D 未实现确认不变（见 §6）。

- 无 composer/发送/SSE/轮询/stop/编辑/分支（P1B）；无附件/音频 UI（P1C）；无 thinking/cache/model/endpoint 控制、无 Aura/AssistantRunTrace（P1D）；无 P2+ 区域页面（Groups/River/Library/More 系统项全部 semantic disabled）
- V3 源码/路由/PWA scope/根重定向未动；backend/extension 零改动
- paired checkpoint 已获批准，绑定见 §9

## 9. Paired checkpoint binding（[Alicia / approved]）

- **Outer commit:** `e7dce77 chore(v4): P1A app shell deployment — nginx /app/ block + hybrid four-mount readiness`
- **Desktop commit:** this commit containing this binding（§3 name/max-id 方案已标 SUPERSEDED，见 §3 banner + §2 row）
- C1A acceptance report 最终 `C1A: PASS`、FAIL count=0（Acceptance-owned，staged 于本 commit）
