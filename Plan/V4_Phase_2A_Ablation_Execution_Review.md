# P2A — Ablation / Contradiction Hunt / 施工节奏建议

> **作者：** `[gpt-5.6-sol / Solaire]`
> **状态：** 建议，待 Alicia 批准；不改原计划、不授权施工、不作实现验收结论。
> **依据：** Detailed Plan 全文、Source Scout 全文、builder-workflow。信任已经调查并交叉审查的源码事实；本轮未读业务源码、未启动子代理。
> **工作区：** HEAD `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`；原 Detailed Plan 与 Source Scout 均为既有 untracked 文件，保持不动。开工基线检查：AgentPreset IDs 1–8。

## 1. 结论

**保留功能范围，压缩执行成本。** 当前方案没有值得再砍的独立业务模块：Hub → Profile → 新建/既有 Conversation，加真实 Memory 摘要，已经是完整且克制的切片。

复杂度不均匀：排序、只读字段、Memory 聚合很简单；真正值得 Sol 额度的是 **共享创建流程的双入口兼容及异步生命周期**，其次是 **路由切换与过滤状态/缓存的隔离**。

建议 **DeepSeek 完成只读纵切片 → Sol 处理创建整合 → DeepSeek 收尾**，只设三次强制停检，不按 Task 1–7 七次交接。所有分工均为建议，尚未派工。`[gpt-5.6-sol / Solaire]`

## 2. Contradiction hunting

### C1 — 冻结计划不可修改，但必用 workflow 要求往计划写证据【执行冲突】

- Plan §12：Builder 不得修改 frozen Plan；§7 Task 7、§10：证据写入独立 `V4_Phase_2A_Construction_Evidence.md`。
- builder-workflow §§1.3–1.4、3：要求在 active Plan 中追加施工矩阵和 checkpoint 记录。
- **建议裁决：** 本切片统一将 workflow 所称的施工记录落到独立 Evidence 文件；Detailed Plan 只读，hash 不变。在施工交接中明确这一映射，不修改通用 skill。
- 这是记录归属澄清，不是删减施工自检。

### C2 — “Profile 不请求 Projects”漏掉了同页对话框例外【验收措辞冲突】

- Plan §§2.1、6.2、6.4 明确保留创建对话框的 Project-list Query。
- §8.5 的 “no Profile Project-list request” 若按整个 Profile 页面执行，会误判合法的创建对话框。
- **建议精确化：** Profile 的会话索引/筛选不引入 Project-list Query；创建对话框继续遵循原有 Project Query 生命周期。不要新增“必须打开弹窗后才准请求”的约束。

### C3 — 创建成功、关窗、切路由的责任没有完全分开【高风险歧义，非已证实缺陷】

- §6.4 / §8.3 同时要求：成功刷新共享列表并导航一次；关窗/切路由防止旧回调行动。
- 当前文字未明确：发出请求后离开，随后收到有效成功响应时，共享列表失效是否仍执行？关闭再打开对话框能否抹掉原有 pending/ambiguous 锁？
- **建议冻结的语义：**
  1. 请求绑定提交时的 Agent，不随当前 Profile 改写。
  2. 已离开的页面/已关闭的对话框不再触发旧导航或更新新对话框的局部状态。
  3. 对已经确认成功的创建，保留 canonical mutation 的共享 Conversation 缓存失效；离开页面不意味着服务端写入被撤销。
  4. 不借固定 Agent 模式重构既有 pending/ambiguous-write 锁，也不承诺新增跨卸载、跨刷新持久锁。
- **定点检查范围：** Scout F07/F09 → `CreateConversationDialog`、`useCreateConversationMutation` 及既有创建测试；仅若现有 owner 无法满足已批准边界才升级讨论，不预造第二套 cancellation/generation 框架。

### C4 — 小歧义，可随批准一起修文，不值得另开调查

- D6 写 deduplicated `(projectId, projectName)` pairs，但 §6.5 / §8.5 明确按 **ID** 去重。以 ID 为唯一键；同 ID 标签取后端顺序中的首条，缺名用既定 fallback，不增加名称冲突协调机制。
- “valid Profile paths”建议解释为现有路由 ID 校验通过，不是必须 detail 请求成功；否则 loading → success 可能改变底栏布局。不存在/隐藏但语法有效的 ID 仍使用可恢复的 Profile 外壳。具体有效 ID 语法跟随已有 V4 模式，不新造 parser 框架。
- §8.1 示例默认带 Node storage flag，而下文说只在碰撞重现时使用；默认命令去掉 flag，将带 flag 的命令记为条件性替代。

### Scout 的旧建议不是重新打开的产品争议

Scout 是事实索引，不是施工验收规范。其“全部 8 个可见卡片”、旧 `/agent/:id` 路由、Memory 深链/提示按钮、Profile 筛选使用 Projects Query 等建议已被 Detailed Plan 裁决覆盖。

交接只需一句：**后续冻结决策以 Detailed Plan 为准；Scout 用于定位源码事实，不复活已否决建议。** 不修改 Scout 历史记录，也不再逐条 re-review。

## 3. Ablation：删执行冗余，不删验收结果

| 项目 | 建议 | 理由 / 保留边界 |
|---|---|---|
| §5 / Task 0 全量重读 V3 与后端 | 改为调查基线后的相关文件 drift 检查；Builder 仍须读实际要改/复用的 V4 方法与签名 | 已有调查不能免除落笔前确认，但无需再浏览两个后端 app、V3 页面或 962 行 Ledger；确有 drift 才按 Scout 定位回源 |
| Task 1 与 Task 6 都“计算”Memory 摘要 | 一处纯投影，API/Query 边界返回 count/tags，页面只消费 | 不建立两次聚合，也不设计完整 Plasmid 前端领域模型；保留当前顶层数组检查 |
| §8、§9、§10 多份证据表 | §8 为验证目标，§9 为门槛索引，Evidence 记录一次结果并引用 | 不要求每条文字独占一个测试，不复制三套矩阵；所有既定目标仍须可追溯 |
| 每个 Task 都全量回归/交接 | 阶段内自检，风险边界才停；全 exo-app 回归与 build 放最终门 | 保留中途针对性检查，避免最后才发现跨 Agent 状态串线 |
| 给每个区域建 hook/component/types 文件 | 只在独立异步状态或行为确实需要边界时拆分 | 可有小的区块组件；不建泛型 workspace、filter registry 或自定义 Query 层 |
| 重复验证未变的创建协议 | 复用既有 P1A 测试证据；新增证据集中于 fixed-Agent 入口及两入口兼容 | §8.3 目标不删除，不重抄整套创建测试 |

**不建议删：** 独立错误/重试、路由 ID 守卫、Project 消失回退 All、Memory 包含共享记录的说明、五个既定响应式宽度。它们已经对应明确验收目标，不再借“简化”重开范围讨论。

**不建议添：** 缓存数据逐字段校验、跨页面永久写锁、自动回滚服务端创建、截断 tags 的新产品规则、后台同步 Agent 配置、通用 Project workspace 抽象。相邻改善留待其所属切片。

## 4. 施工节奏与分工

### 开工前：一次短交接，不做第四个大 gate

Alicia 批准上述澄清并明确开工后，记录最终 Plan hash、工作区边界、Evidence 归属和三次停检规则。Builder 核对变更相关 V4 接口；只读切片内部风险 M，创建异步整合风险 H。若发生事实 drift，当场停，不靠补偿代码绕过。

固定模式输入只需传已验证 preset，结果继续走现有 mutation。具体 prop 名称由读过源码的 Builder 冻结，无需 Sol 先替所有文件设计签名。

### 段 A — DeepSeek：完整只读纵切片

**原任务对应：** Task 1、2、3、4 的只读部分、5、6，带够用样式及针对性验证；暂不接创建入口。

**归属：** Agent feature、路由/导航、Chat Home 的 Hub 次入口及对应测试。DeepSeek 可以做这些，不必让 Sol 逐文件施工。

**阶段内自检：** 边界守卫、排序/过滤/聚合、局部加载失败、路由和布局。无需每完成一个组件就找 Sol。

#### CP1 — 必停：只读闭环与状态隔离

重点看：
- 同一共享 Conversation 数据源，无 Profile 筛选 Project Query，无 Hub Memory 扇出请求。
- A → B 的身份、Memory、筛选不串线；选中 Project 从源集合消失时回退 All。
- detail 失败可恢复；Conversation/Memory 失败不伪装空值、不互相阻断。
- Hub 与 Profile 移动导航层级正确，canonical Chat 未分叉。

交接只带相关 diff、目标证据、剩余问题，不重送全部调查正文。经明确放行再进段 B。

### 段 B — Sol：固定 Agent 创建整合

**原任务对应：** Task 4 的创建入口 + §6.4 / §8.3。

**建议 Sol 亲自负责：** `CreateConversationDialog` 的窄扩展、Profile 入口接线、必要的既有 callback owner 调整及决定性验证。不是重写 chat api/query；若无需改 canonical mutation 就不改。

**为什么值额度：** 唯一同时触碰既有 Chat Home 行为、不可撤回的服务端写入、关闭/切页时序及缓存失效的区域。这里的判断错误会影响已经验收的 P1A，而不只是新页面。

#### CP2 — 必停：创建兼容与异步责任

重点看：
- Home 可选 Agent 与 Profile 固定 Agent 同时成立；g045/Drift/Project 仍走原协议。
- 重复提交与 malformed-success 锁未削弱。
- 有效成功只导航一次；关闭/切页后的迟到结果不劫持新页面。
- 已成功写入仍能通过共享列表刷新被发现，不把“抑制旧页面回调”做成“丢掉全局更新”。

Sol 若施工，只报告施工事实，不自授独立验收 PASS。此处由 Alicia 决定继续；若她指定独立验收方，则按明确验收链放行。不得自行拉 reviewer pane。

### 段 C — DeepSeek：视觉收尾、回归、证据整理

**原任务对应：** Task 7。

完成长文本、键盘/focus、五个宽度、页面滚动、安全区检查；机械执行原定 exo-app 检查并记录结果。无需让 Sol 阅读每一行成功日志；失败摘要必须保留命令、退出码、失败测试和关键错误。

#### CP3 — 必停：最终交付门

- 对照 §8，所有适用目标有证据；全 exo-app 回归、typecheck、lint、build 和 diff 检查完成。
- 明确哪些是自动验证、哪些是浏览器检查、哪些未执行；DOM 单测不能冒充真实宽度/滚动检查。
- scope sweep、原有脏文件隔离、收工数据库基线及 ownership 未转移说明齐全。
- 不自动提交、不进入 P2B；独立验收仅在 Alicia 请求后启动。

### 协作约束

这不是三路并行施工：按 A → B → C 交接。`AgentProfilePage` 等整合文件在交接时切换唯一 owner，避免 DeepSeek 和 Sol 同时改页。

只有证据显示问题涉及 canonical 创建生命周期或无法保持既定状态隔离时才升级给 Sol；普通 JSX、样式、排序/聚合和失败文案不默认升级。测试命令采集可交低成本执行者，判定失败原因留给当前 owner。

## 5. 批准后最小落笔范围

只需对 Detailed Plan 做定点修文：C1–C4、§5/Task 0 的读取策略、三段施工与停检引用。无需重写整份计划、调整业务范围或增加测试实现。

本审查建议经 Alicia 批准前不改变冻结验收要求；当前未施工、未提交、未启动独立验收。`[gpt-5.6-sol / Solaire]`
