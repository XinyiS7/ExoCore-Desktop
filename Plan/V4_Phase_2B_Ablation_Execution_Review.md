# P2B — 消融、内部矛盾与施工分工建议

> **作者：** `[gpt-5.6-sol / Solaire]`
> **状态：** 待 Alicia 批准的审查建议；不改原 Detailed Plan、不授权施工、不作独立验收结论。
> **审查对象：** `Plan/V4_Phase_2B_Project_Workspace_Management_Detailed_Plan.md` 全文。
> **对象 SHA-256：** `d4445b543e2db32db6e8f094ee7391b24cc1039dc241a80e216c35c6e0fe9cc7`。
> **方法：** 信任既有调查和 mini-fork 裁决，只检查计划内部逻辑、必要性及施工依赖；未读取业务源码、未启动子代理或 reviewer。
> **工作区：** HEAD `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`，存在 P2A 生产/验收/计划脏文件，全部保留。本轮唯一新增文件为本审查。开工真实库基线为 IDs 1–8。

## 1. 总判断

**保留业务范围，重排施工依赖。** Project CRUD、独立 Knowledge、mixed-ID 修复和删除恢复选择都已有明确理由或 Alicia 批准，不重新拿它们做产品裁决。

P2B 比 P2A 多两个真实风险：资源操作改变两个列表的事实，以及不可逆的归档删除。不能只照搬“页面 → CRUD → Knowledge”的文件顺序。

建议 **DeepSeek 连续做基础业务与资源闭环 → Sol 集中做共享创建兼容和归档删除 → DeepSeek 收尾**，四个强制停检点。比原计划增加的一次停检用于隔离删除风险，而不是多开一次泛泛的全量 review。`[gpt-5.6-sol / Solaire]`

## 2. Contradiction hunting

### C1 — work_dir 编辑同时被包含与排除【明确措辞冲突】

- §1、§4.1、§6.1–6.2：创建/编辑 Project 的 `work_dir`。
- §4.2：排除 “browser filesystem access or work-directory editing”。
- **建议：** 保留 Project 配置里的 `work_dir` 字符串编辑；排除“浏览、创建、修改该目录中的实际文件/目录，以及浏览器本地文件系统访问”。不增加目录存在性探测或路径选择器。

这只是区分“保存一个配置值”与“操作它指向的文件系统”，无需查源码。

### C2 — CP2 要验 Files→Knowledge 联动，Knowledge 却到 CP3 才实现【明确阶段依赖冲突】

- D2、§5.2、§6.3、§8.5：上传和两种删除都必须刷新 Files 与 Knowledge 两个事实。
- Stage B / CP2 要求 Files mutations 通过；Stage C 才实现 Knowledge query/list。
- 若 CP2 只证明调用了一个未被消费的 invalidation key，就不能证明两块 UI 不再矛盾；若提前实现 Knowledge，则实际已经越过原阶段边界。
- **建议：** Files 与 Knowledge query/list/edit 在同一资源阶段完成。可先实现只读列表，再接 mutation，但阶段结束必须观察到两个真实查询消费者的更新。

### C3 — 删除后“受影响缓存”的范围需要写成结果，不只列名【开工前澄清，不是已证实漏刷】

- §2.2：删除会将 Conversations 和存活 Knowledge 移往 archive owner。
- D7、§5.2：列出 detail、Conversations、files、Knowledge 等失效对象，但未区分源 Project、archive 目标以及既有 Conversation detail/control 消费者。
- **风险：** Builder 只刷新源 Project 的缓存，也可以声称符合清单；已经缓存的归档目标或 canonical Chat 仍可能保留旧归属。
- **建议明确验收结果：** 本次写入实际改变、且 V4 已缓存的归属/资源事实，在下一次消费时不能继续被视为新鲜旧值。未发生改变的事实无需刷新。
- **最小实现方向：** 施工时定点确认现有 Query owner；优先使用已经存在的适当 key family 失效，不查找归档目标的新接口、不维护迁移映射、不全局清空 QueryClient，也不为不存在的缓存新增缓存。

这属于原“invalidate all affected facts”的执行精确化；不是借机新增后端归档规则。源代码只需在删除施工前检查实际消费者，不需本轮重调查。

### C4 — “当前 preview”与错误后重试尚有小歧义【局部交互口径】

- §6.5 / §8.7 要求 current/fresh preview，所选 IDs 来自该 preview。
- 同时允许删除失败后保留页面，但未说明重开/重新取得 preview 后是否沿用旧选择。
- **建议：** 一次确认使用一次成功取得的 preview；重开或显式重取 preview 时恢复默认未选，旧返回不能覆盖新确认框。失败不自动重新提交 DELETE。
- 不承诺 preview 与 DELETE 之间事务一致，不加轮询、定时过期、二次强制 preview 或跨窗口锁。原计划已经诚实声明 preview 非事务性，保留这一边界。

### 不重复报成新问题

- 原计划已经明确：关窗/切 Project 只抑制旧局部回调，确认成功的写入仍刷新共享缓存；不再重开 P2A 的同类争议。
- §9 已将证据放在独立 Construction Evidence；交接注明它承载 builder-workflow 的矩阵/checkpoint 记录即可，不另造证据文件。
- “不提供 Knowledge create/delete”理解为不提供其独立入口，不否认上传、删除 Files 的既定 Knowledge 副作用。可加一句括注，不能借此砍掉 `kf_` 删除。
- §7 指定独立验收的偏好，不等于授权本窗口启动 reviewer。施工信号、验收人/既定 loop 仍由 Alicia 明确指定。

## 3. Ablation：哪些可以更简练

| 对象 | 建议 | 不丢掉的要求 |
|---|---|---|
| 再次后端全量阅读 | §2.4 的 V4 实际修改/复用定义仍要读；后端按既有证据定位、按相关 drift 回查 | mixed IDs、preview、Knowledge PATCH 等实际契约不靠猜；无法建立基线时只读对应定义 |
| Knowledge detail query | 默认不建，直接用列表已有的 abstract/keywords 预填编辑 | 只有列表确实缺编辑所需字段时再增加；PATCH 后 refetch，不伪造完整行 |
| 为 Project 再建一份 Projects list owner | 扩充现有 canonical list 边界，而非 feature 目录复制 | §5.2 的单一事实源；目录位置不比 ownership 重要 |
| Files row 的严格 source 校验 | 按 D3 保持已裁决的宽容展示，不重新收紧 | ID 形式仍严格；未知/不一致 source 中性标签；删除键不变 |
| 每个 editor 都复刻整套“通用 mutation 状态机” | 复用已成立的 Query/局部失效模式，不抽象成 CRUD 引擎 | pending、输入保留、字段错误、迟到回调仍按目标验证；共同点不足就保留清晰局部实现 |
| 每个阶段全 app 测试＋全宽度双环境截图 | 中间 gate 做相关行为/关键布局，最终执行原定完整矩阵 | dev/prod、五个宽度及所有既定目标不删除；证据按目标追溯，不按条文机械复制测试 |
| 让 Sol 做所有写操作 | 普通 Project create/edit、Files 和 Knowledge 交给 DeepSeek | Sol 只承接共享创建语义与归档删除；普通写请求不自动等于高推理成本 |

**明确不砍：** recovery picker（Alicia 已批准）、Files→Knowledge 失效、abstract 索引提示及 provider-safe 验证、P1D mixed-ID 回归、局部错误独立性。

**明确不添：** 自动补偿/恢复已删除 Project、删除进度轮询、跨标签页写锁、浏览器文件服务、通用 Workspace、后台重建索引状态追踪、真实数据测试夹具。也不顺手清理 P2A 代码。

## 4. 建议替换 §7 的施工节奏

以下四段是建议版，获批前原阶段规则仍有效。阶段内按相关目标自检，阶段结束停止并交给 Alicia 指定的验收链；没有明确验收链时交 Alicia 决定，不自行创建 reviewer。

### 段 A — DeepSeek：Project 基础纵切片＋普通 create/edit

**从原计划移动：** 原 Stage A 去掉 fixed-Project 创建；加入原 Stage B 的 Project create/edit。

范围：
- routes、Home 入口、shell 层级；Hub、detail、基本表单；
- 单一 Projects list/detail 边界；共享 Conversations lens、Agent filter；
- 新建/编辑的错误、成功 refetch、迟到局部回调保护。

**CP1 必停 — Project 身份与状态隔离：**
- Hub 顺序/count 不把失败变零；非法 ID 不请求、404 与故障不同。
- A→B 不串身份/筛选；源 Agent 消失回退 All 且不自动复选。
- create/edit 正确保存必填/空字段，返回 ID 导航一次；失败保留输入，迟到结果不覆盖新页面。
- canonical Projects/Conversations 没有重复 owner。

此时不要求 Project 内能创建 Conversation，不开放未完成的资源/删除操作。这个中间 checkpoint 不是产品完成宣告。

**为何 DeepSeek：** 已有 P2A 路由、筛选和失效模式可参照；难度主要是有纪律地执行已有规则，而非重新设计。

### 段 B — DeepSeek：Files＋Knowledge 资源闭环

范围：
- P1D mixed-ID 类型/adapter 最小修复及 chat-local read-only 回归；
- Project Files 列表、上传、numeric/`kf_` 删除；
- Knowledge 列表、abstract/keywords 编辑；
- 同步整理这些实际落地契约对应的 `ReactSheet.md` 段落。

**CP2 必停 — 两份资源视图不能彼此撒谎：**
- uploaded-only、synced-only、mixed 都可用；无效 ID 明确失败，source 降级标签不误路由。
- 上传/两类删除后 Files 和 Knowledge 都从服务端事实更新；失败保留原事实并显示错误。
- Knowledge 编辑只提交允许字段；abstract 与 keywords-only 的成功提示不同。
- Files/Knowledge 各自故障独立，A 的 editor 不能影响 B。
- P1D drawer 仍只读，无文件打开承诺；验证无真实用户数据写入或付费 embedding 调用。

**为何 DeepSeek：** API 已调查定稿，复杂处是两个 query 的明确联动，并不需要 Sol 重造领域模型。这里让两个可见消费者共同验收，比推迟 Knowledge 更省返工。

### 段 C — Sol：共享创建兼容＋不可逆删除

范围：
1. 固定 Project 接入既有创建 dialog/mutation。
2. Project delete preview、recovery selection、DELETE body、错误分级、共享失效和导航。

**单一施工时段，内部仍按两条不变量串行：** 先创建兼容并做针对性自检，再做删除；前者有未解决问题时不堆上后者。无需因此另开一个全量独立验收 gate。

**CP3 必停 — 前驱兼容与破坏性写入：**
- Home 自由选择、Agent Profile fixedPreset、Project fixedProject 三入口都成立；不为产品没有的双固定入口开发新模式。
- standard/g045、extension Projects、pending/ambiguous locks 和 origin 行为不退化。
- preview 失败不可确认；选择只取当前 preview numeric IDs，默认空；DELETE 明确发送空/非空 `keep_file_ids`。
- 204 的全局失效与局部导航分离；关闭/切页不劫持新 origin。
- 普通错误与 `file_rollback_failed` 文案分级正确；无“失败等于完整回滚”的假承诺。
- 按 C3 检查现有缓存消费者，归档副作用没有被误当成单一源 Project 删除。

**为何 Sol：** 这里需要同时守住 P1A/P2A 已验收的创建语义，以及不能靠前端撤销的后端生命周期。Sol 负责窄而难的 owner 边界，不能因此重写 chat query 层或 backend service。

Sol 若施工，CP3 只提交事实，由指定独立验收方判断，不自授 PASS。

### 段 D — DeepSeek：视觉、回归与证据收尾

范围：已有界面的长文本、focus/键盘、滚动可达性、五个宽度，余下精确 API 文档修订及证据整理。

**CP4 / P2B 最终必停：**
- 原 §8 全部目标可追溯，包括 dev/prod 五宽度浏览器证据。
- focused tests、完整 exo-app tests、typecheck、lint、build、工作区与 staged whitespace 检查有结果。
- 区分实测、自动化与未测，不用截图证明 mutation 语义、不用 DOM 测试冒充真实布局观察。
- P2A/C1 相关回归、scope scan、收工真实库基线和脏文件归属齐全。
- 独立验收按明确授权执行；不自动 commit、C2 转移或进入其他切片。

## 5. Owner 与成本控制

- **施工主力：DeepSeek。** A/B 连续持有 Project feature、相关测试与文档，不切换窗口做每个叶子组件。
- **高风险整合：Sol。** C 开始时一次性交接所需 Project 页面/query 整合文件与 canonical create dialog，完成后归还给收尾方。禁止同文件并行。
- **独立验收：Alicia 指定。** 原计划推荐 Astra 可保留；本建议不派工、不假定 pane 已建立关系。
- **Alaric：保留事实调查贡献。** 只有施工出现具体契约 drift 才请求对应证据，不让他重扫 V3/后端。`[gemini / Alaric — source research, per Detailed Plan]`
- **机械执行：低成本 test runner 可承担。** 命令和判定目标由 owner 选；错误解释及修复决定不外包给纯 runner。

交接只给：当前 Plan/hash、相关改动、checkpoint 目标及观测、共享文件 owner、未解决项。完整 dirty manifest 在 Evidence 留一份；不把所有 P2A 截图/源码反复灌进 Sol 上下文。

**为什么不是三个或七个 checkpoint：** 原 CP2 把普通 CRUD、双列表副作用与不可逆删除揉在一起，而其 Knowledge 依赖还没做完。四段将这三个不同失败域拆开，同时把最终布局/全回归独立收口；不按每个 endpoint 或 dialog 单独停检。若坚持三段，至少必须把 Knowledge 前移，并明确 CP2 内删除之前的硬停检，不能只压缩编号却掩盖风险。

## 6. 批准后最小修改建议

1. 修 §4.2 work-directory wording（C1）。
2. 用四段节奏替换 §7，将 Knowledge 与 Files 同阶段（C2）。
3. 在 §5.2 / 删除目标补上受影响缓存结果口径（C3），在 §6.5 明确 preview 会话与默认选择（C4）。
4. §9 注明独立 Evidence 承载 workflow 施工记录；保留原 §8 目标，不附测试代码、不另造验收范围。

除上述点状修文，不重写已批准 D1–D9，不重启产品讨论。**本轮只有审查文档产物，未施工、未运行产品测试、未提交。** `[gpt-5.6-sol / Solaire]`
