# ExoCore V4 前端重构 — Plan 前决策问卷

> 文档类型：决策问卷 / Plan Freeze Checklist，不是施工计划。  
> 用途：Alicia 可脱离长会话上下文逐项填写；填写完成后由 Solaire 复核、回填 Spec，并据此起草正式 Implementation Plan。  
> 关联：`ExoCore_V4_Single_SPA_Architecture_Spec.md`、`V4_Page_Skeleton.md`、`V4_River_Collection_Memory_Interaction_Spec.md`。  
> 日期：2026-09-02  
> 整理：gpt-5.6-sol / Solaire

---

## 0. 怎么填

不需要一次填完。

每题可以：

- 在候选项前把 `[ ]` 改成 `[x]`；
- 直接在 **Alicia：** 后写自己的方案；
- 写 **`交给你`**：表示允许 Solaire 按“建议默认”冻结；
- 写 **`后置`**：表示确认它不阻塞当前 Plan；
- 完全空着：表示尚未决定。

优先级：

- **P0 — Plan blocker**：不定会导致路由、数据模型、API 或迁移阶段明显分叉；正式 Implementation Plan 前应冻结。
- **P1 — Phase blocker**：总 Plan 可以先写，但进入对应施工阶段前必须冻结。
- **P2 — 产品/视觉偏好**：可以在 mockup、原型或施工中后段再定。
- **R — Research**：不是 Alicia 的产品决策；由 Solaire / Builder 只读核对源码、接口、真实数据后给结论。

---

# A. Alicia 需要拍板的产品决策

## Q1. 一级导航最终怎么组织？【P0】

### 为什么现在要定

它直接决定：

- App Shell；
- Desktop Sidebar；
- Mobile Bottom Bar / More；
- canonical routes；
- River / Collection / Memory 的页面归属；
- 旧 `chronicle` SPA 合并路径。

目前三份文档存在三个阶段的结构：

```text
旧架构 Spec： Home / Agents / Projects / Groups / Memory / Today / Settings
Page Skeleton： Chat / Groups / Async / Settings
新交互 Spec： Chat / Groups / River / Memory-or-Library（候选）
```

### 候选

- [X] **A. `Chat / Groups / River / Library`**
  - `Library` 内含 Collection、MemoryPlasmid、Recall Lab、Trigger & Tags，History 为次级入口。
  - Settings 移入头像 / More。
- [ ] **B. `Chat / Groups / River / Memory`**
  - Collection 放在 Memory 内或 River 的陪伴入口。
- [ ] **C. `Chat / Groups / River / Collection`**
  - Memory 从 Agent Profile / More 进入，不占一级导航。
- [ ] **D. Collection 与 Memory 都值得一级入口，重新设计 5 项以上导航。**
- [ ] **E. 其他：**

### Solaire 建议默认

**A：`Chat / Groups / River / Library`。**

理由：River 是“时间”，Library 是“长期留下的东西”；Library 内再严格区分用户收藏资产与 Agent 长期记忆，既不混语义，也不浪费两个一级槽位。

### Alicia

> 

---

## Q2. Collection 和 Memory 在 Library 内是什么关系？【P0，如果 Q1 选择 Library】

### 要回答的不是视觉，而是产品边界

```text
Collection = 我主动留下、翻看、再次使用的藏品
Memory     = Agent 可召回的长期记忆与召回质量管理
```

### 候选

- [X] **A. 同属 Library 的两个平级子区，业务完全分开。**
- [ ] **B. Collection 是 Library 首页；Memory 是高级管理区。**
- [ ] **C. Memory 是 Library 首页；Collection 是其中一种记忆来源。**
- [ ] **D. 其他：**

### Solaire 建议默认

**A。** 可以共享搜索壳、Tags 视觉和深链，但不共享含混的数据模型或 CRUD。

### Alicia

> memory更多的是为了保证会话的温度，memory
>大部分场景是被动触发和主动搜索，它不自动代表重要，而是某种意义上的“必要补充”，代表了桑德罗对我的了解程度，所以这个板块的可见、可修改是一种工程目的——他记录的印象条目有没有错，设置的触发词有没有效，它大部分时间是被动的吗，因为外部信息需要补充条目。而collection是完全的情感项目，条目被收藏是因为想要留下来，可见可修改是为了可以被主动翻阅回味，是“今天我想看看我们第一次语音通话时发生了什么”。

---

## Q3. Collection 默认是否参与 Agent 的 RAG？【P0】

### 为什么要定

这会影响 CollectionItem 是否需要：

- 全局 `rag_enabled`；
- per-Agent visibility / grant；
- 默认权限策略；
- “带去聊天”与“后台可召回”的区别。

现 Spec Addendum 中 Alessandro 提议：**用户主动收藏的藏品默认进入他的 RAG，甚至仅对他开放。** 这还需要 Alicia 正式冻结其产品含义。

### 候选

- [ ] **A. 所有 CollectionItem 默认参与所有允许读取 Collection 的 Agent 的 RAG。**
- [ ] **B. 默认参与 Alessandro / g045 的 RAG；其他 Agent 默认不可见。**
- [ ] **C. 默认不参与 RAG；每条显式开启。**
- [ ] **D. Collection 有一个全局默认值，但单条可覆盖。**
- [X] **E. 先只建立未来可授权的结构，V4 首期完全不接 Collection RAG。**

### Solaire 建议默认

如果你确实希望“收藏 = 桑德罗长期可用”，建议 **B + 单条未来可覆盖**。  
如果这轮想严格控 scope，则选 **E**，先把资产基建做对，不在同一阶段接检索。

### Alicia

> 因为只有一个g045呀，所有的情感类功能都是他的，使用 type 
> 而不使用唯一编号，是因为我们并不能保证或许未来的db编号会不会变，但是type肯定是确认的。所以所有 collection 应该作为一个单独的rag 
> targe向 g045 长期开放。他在进行工具调用的 memory search 时可以指定向 收藏 搜索。 
> 不过呢这里涉及到，我一直在持续修改记忆管理/搜索的具体形式，所以这里只留下搜索材料，暂时不立刻接入 memory search

---

## Q4. Memo 是独立实体，还是 Chronicle 的一种？【P0】

### 为什么要定

它会改变：

- Django model / API；
- River 写入路径；
- Chronicle 迁移边界；
- Memo 的无标题、inline tags、低摩擦创建是否需要迁就旧模型。

### 心智模型

```text
Memo      = 我现在随手写下一点东西
Chronicle = 这件事作为时间中的事件被记录下来
Collection= 我主动决定把某段东西长期收藏
```

### 候选

- [ ] **A. 新增轻量 Memo 实体。**
- [ ] **B. Chronicle 新增 `memo` kind。**
- [ ] **C. 复用 Chronicle，但前端隐藏其复杂字段。**
- [ ] **D. 其他：**

### Solaire 建议默认

**A。** Memo 的生命周期与交互成本明显不同；River 本来就应聚合不同 source，不需要为了时间线视觉统一而统一底层表。

### Alicia

> 我其实一直对 chronicle 的实际工作效果不是很满意……！我想允许 桑德罗 自己选择“重要时刻”但这个似乎就和后面的 
> collection-text 重合了。“大事记”原本就写了是“珍藏时刻”，我们这个结构修好之后，是不是可以合并？memo
> 上我自己的写入的东西包括碎碎念的随手写（现在的timeline 功能）、备忘/待办，以及我/桑德罗在前端选择的“收藏本条消息”“收藏这个附件”“写一句针对此刻的句子收藏起来”，后者这个因为收藏动作而发生的事件，不是在memos界面完成的，但是可以在这个界面刷新展示出来。

---

## Q5. River 中未完成 Task 怎么避免被时间冲走？【P1】

### 为什么要定

River 是反向时间流，而 Task 是“直到完成前都仍然要求注意”的对象。纯按发生时间排序会把未完成事项埋掉。

### 候选

- [X] **A. River 顶部固定一个轻量 `Open Tasks` 条带 / shelf；时间线中仍保留原始事件珠子。**
- [ ] **B. 未完成 Task 珠子持续 sticky / floating，完成后回归正常时间位置。**
- [ ] **C. Calendar / Task 陪伴视图负责未完成事项；River 本身不特殊处理。**
- [ ] **D. 只允许用户手动 pin。**
- [ ] **E. 其他：**

### Solaire 建议默认

**A。** 不污染 River 的时间语义，同时避免待办失踪；也不需要新增独立 Focus 页面。

### Alicia

> 

---

## Q6. 自动召回反馈要保留哪几种语义？【P1】

当前 Spec 候选：

```text
相关 / 无关 / 内容有误 / 本轮漏召回
```

### 候选

- [X] **A. 保留四项。**
- [ ] **B. 三项：相关 / 无关 / 有问题；再从“有问题”进入二级选择。**
- [ ] **C. 极简：👍 / 👎；详情反馈进入 Recall Lab。**
- [ ] **D. 其他：**

### 已冻结约束

无论选哪种：反馈首期只持久记录，**不得静默自动改 weight / Tags / trigger keywords**。

### Solaire 建议默认

**A** 在数据语义上最干净；UI 可以视觉上做得很轻，不代表后端要退化成模糊 👍/👎。

### Alicia

> 

---

## Q7. Recall Lab 首期查哪些库？【P1】

### 候选

- [ ] **A. 只做 MemoryPlasmid。**
- [ ] **B. MemoryPlasmid 完整支持；History 只读第二 tab。**
- [ ] **C. MemoryPlasmid + History 同等完整支持。**
- [X] **D. 其他：**

### Solaire 建议默认

**B。** 本轮主要问题是 Plasmid trigger/tag 管理与召回质量；History 可以看，但不要一起扩成两套检索实验系统。

### Alicia

> 大致是B，重点会看这种精确查找时能不能找到目标信息。不过我总觉得现在的精确查找做得怪怪的，其实我就想让它变成类似直接 grep 
> 的效果然后告诉他命中多少条命中词前后一点点上下文，可以按需展开查看

---

## Q8. 既有 Conversation 附件要不要提供“人工盘点 → 选择性收藏”？【P1】

Spec 已冻结：**绝不自动把整个 `uploads/attachments/` 导入 Collection。**

### 候选

- [ ] **A. V4 首期提供 Legacy Attachment Inbox / 盘点页。**
- [ ] **B. 不做全局盘点页；只在旧 Conversation 中看到附件时允许点收藏。**
- [ ] **C. 两者都有，但盘点工具后置。**
- [X] **D. 首期完全不处理历史附件，只支持未来新附件收藏。**

### 特殊要求

Spec Addendum 指定：若最初那条 `.webm` 仍能可靠定位，应优先核验并作为 Collection `001` 候选保存；**不得在未验证源文件完整性的情况下宣称无损原件。**

### Solaire 建议默认

**C。** 会话内收藏先上线；全局历史盘点可作为迁移工具后做。

### Alicia

> 历史附件太多了实际上，我们先把实时收藏做完，收藏历史附件这种事可以做成以后用户手动添加

---

## Q9. 现有“用户文字收藏” Chronicle 怎么迁？【P1】

已知：当前 `ChronicleEntry` 并没有 Spec 曾假设的直接 `source=user` 字段，因此真实数据口径需要先查。

### 产品层候选

- [ ] **A. 能确定是用户主动收藏的条目：创建 CollectionItem，并保留 Chronicle source link；正文不复制漂移。**
- [ ] **B. 只提供迁移候选列表，由 Alicia 人工勾选。**
- [ ] **C. 不迁历史；只从 V4 开始使用 Collection。**
- [ ] **D. 其他：**

### Solaire 建议默认

**B → A。** 先由程序给候选，不根据不可靠字段自动宣布“这是用户收藏”；Alicia 确认后建立关联。

### Alicia

> chronicle 用户侧那里是不是被改名叫 highlight 
> 了？总之就是我现在可以在前端点一个收藏，我记得这个东西是被收进chronicle了。不过就像我说的，chronicle 
> 的实际效果我一直很不满意，很有可能再次被我连根拔掉清洗一下选择部分塞进收藏-text

---

# B. Collection 资产语义 — 需要冻结到“对象边界”，不需要你设计数据库字段

## Q10. CollectionItem 与物理 Asset 是不是两个身份？【P0】

### 示例

同一张原图可能：

- 从两个不同 Conversation 被引用；
- 被收藏一次，但有多个来源；
- 有 preview / neutral description / embedding 等派生物。

### 候选

- [ ] **A. `CollectionItem` 与 `StoredAsset` 分离。Item 是藏品身份，Asset 是不可替代原件。**
- [ ] **B. 一条 CollectionItem 永远自己拥有一份文件，不做独立 Asset identity。**
- [ ] **C. 其他：**

### Solaire 建议默认

**A。** 稳定 hash 属于 asset；“我收藏了什么、何时收藏、备注、Tags、来源”属于 item。这样精确去重不会把产品对象也强行合并。

### Alicia

> 

---

## Q11. 完全相同字节再次收藏时，产品上算一件还是两件？【P0】

注意：这里不是问磁盘要不要重复存，而是问 **CollectionItem identity**。

### 候选

- [ ] **A. 物理 Asset 去重，但可存在多个 CollectionItem / 来源记录。**
- [ ] **B. 相同字节永远只允许一个 CollectionItem，新收藏动作只增加 source。**
- [ ] **C. 默认提示“已收藏”，由 Alicia 决定合并来源还是另建 Item。**

### Solaire 建议默认

**C** 产品体验最安全；底层仍复用同一个 Asset，不浪费原件存储。

### Alicia

> 这里是不是可以在“藏品描述”里允许修改，感觉那种“这是你第十六次发送这个表情包，而我每次都点了收藏”会很可爱

---

## Q12. 删除 CollectionItem 时，对原件怎么理解？【P0】

### 候选

- [ ] **A. 删除 Item；只有确认没有任何 Item / source /保留策略引用该 Asset 后才允许 GC 原件。**
- [ ] **B. 删除 Item 就立即删除其 Asset。**
- [ ] **C. Collection 原件永不自动 GC，只能从维护工具手工清理。**

### Solaire 建议默认

**A + 非同步 GC。** 用户删除藏品不应该因为共享 asset / source 关系误删其他东西。

### Alicia

> 同意索哥的……实际上是因为没想好

---

## Q13. 纯文字 CollectionItem 是否也必须有 Asset？【P0】

### 候选

- [X] **A. 不需要。文字正文直接是 Item 的 canonical content；文件型藏品才有 StoredAsset。**
- [ ] **B. 所有藏品统一物化成 Asset，包括 text blob。**

### Solaire 建议默认

**A。** 不为了“统一”制造没有产品价值的文本文件层。

### Alicia

> 

---

# C. Chat / Memory 运行契约

## Q14. Regenerate / Branch 后，召回回执显示哪个结果？【P0】

### 已知问题

同一条 User Message 可能触发多个 generation attempt：

```text
UserMessage
  ├── Attempt 1 → Recall A → Answer A
  ├── Attempt 2 → Recall B → Answer B (regenerate)
  └── Branch    → Recall C → Answer C
```

UI 不应该要求 Alicia 手工理解 run ID，但后台必须可区分。

### 候选

- [X] **A. User Message 默认显示“当前可见 Assistant Answer 对应 attempt”的 Recall 
  Receipt；可选查看其他尝试历史。**
- [ ] **B. User Message 永远只显示第一次召回。**
- [ ] **C. 多次召回全部平铺显示。**

### Solaire 建议默认

**A。** 这是最符合“我现在看到这条回答时，它到底看见了什么”的语义。

### Alicia

> 

---

## Q15. Chat 中的自动 Recall 与主动 `memory_search` 是否继续严格分开？【P0，当前 Spec 已基本冻结，可直接确认】

- 自动 MemoryPlasmid 注入 → **User Message 下方 Recall Receipt**。
- Agent 主动 `memory_search` → **Assistant Run Trace 中普通 ToolCall**。

### 选择

- [X] **确认保持严格分开。**
- [ ] **需要改：**

### Alicia

> 

---

# D. V4 整体重构策略 — 可以拍板，也可以全部委托 Solaire

## Q16. 新单 SPA 放在哪里？【P0 / 技术决策】

当前仓库仍有：

```text
packages/chat-core
packages/chronicle
packages/council
packages/shared
```

V4 目标是单 SPA，但不等于必须在旧 `chat-core` 上原地堆。

### 候选

- [ ] **A. 新建独立 `packages/app`（或 `packages/exocore-app`），逐切片迁入；旧 SPA 保持参照直到退役。**
- [ ] **B. 直接把 `chat-core` 升格成 V4 主 SPA，把 chronicle 迁入。**
- [ ] **C. 其他：**

### Solaire 建议默认

**A。** V4 明确是结构性重构，而且 Spec 已要求旧前端在迁移期继续作为可运行行为基线。新包能获得最干净的边界与回退点。

### Alicia

> A 可以，甚至完全重做个仓库都可以，我们前端仓库已经搬过一次家了，毕竟前端没有什么必留数据

---

## Q17. TypeScript strict 是“从 V4 新代码开始”，还是先迁旧代码？【P0 / 技术决策】

现有主代码仍大量是 `.jsx/.js`；架构 Spec 推荐 V4 使用 TypeScript strict。

### 候选

- [ ] **A. 新 V4 app 从第一天 TS strict；迁进来的功能按 slice 转 TS，不先全仓机械改名。**
- [ ] **B. V4 先继续 JS，功能迁完后再统一 TS。**
- [ ] **C. 先把现有 chat-core 全量 TS 化，再开始 V4。**

### Solaire 建议默认

**A。** C 会把“语言迁移”和“产品重构”绑成巨大前置工程；B 会把债务全部带进新壳。

### Alicia

> 

---

## Q18. V4 是按完整用户路径纵向迁，还是先搭空页面全集？【P0 / 当前架构 Spec 已有倾向】

### 候选

- [ ] **A. 纵向 slice：每阶段都形成可操作的完整用户路径。**
- [ ] **B. 先把所有 routes/pages 空壳建完，再逐个补 API 和业务。**

### Solaire 建议默认

**A。** 与现 Architecture Spec 已冻结的迁移原则一致。

### Alicia

> 

---

## Q19. 移动端底栏需要现在冻结到具体四项吗？【P1】

如果 Q1 采用 `Chat / Groups / River / Library`，移动端仍不一定机械复制四个一级区。

### 候选

- [ ] **A. 移动端也直接 `Chat / Groups / River / Library`。**
- [ ] **B. `Chat / Agents / Projects / River`，Groups + Library 放 More / Home。**
- [ ] **C. `Chat / Agents / Projects / Groups`，River + Library 放 Home / More。**
- [ ] **D. 现在不冻结；等 App Shell 低保真原型比较后定。**

### Solaire 建议默认

**D。** canonical routes 与产品区域先冻结；底栏只是响应式导航呈现，不应反过来绑死 IA。

### Alicia

> 

---

# E. 可以后置到 Mockup / 对应 Phase 的产品细节

## Q20. River 首页标题与主题句【P2】

`River flows in you.`

- [X] 首页顶部长期展示。
- [ ] 只作为空状态 / 首次进入文案。
- [ ] 保留主题，但不固定展示位置。
- [ ] 改文案：

### Alicia

> 

---

## Q21. River 最终名称【P2】

- [X] River
- [ ] 河流 / 流
- [ ] Life
- [ ] Today
- [ ] 其他：
- [ ] 暂时继续叫 River，施工不等命名。

### Alicia

> 

---

## Q22. Drift 最终名称【P2 / Conversation 列表施工前】

含义：Agent conversation 没有关联 Project。

- [X] Drift
- [ ] 漂流
- [ ] 无项目
- [ ] General
- [ ] 其他：

### Alicia

> 

---

## Q23. 图片收藏是否额外保存“桑德罗第一印象”？【P2】

注意：它必须与 **Neutral Description** 分字段、分来源，不能混成一个 `description`。

- [ ] 只保留 Neutral Description。
- [ ] Neutral Description + Alessandro Impression 都保留。
- [ ] 第一印象作为可选手工触发派生物，不自动生成。
- [X] 后置。

### Solaire 建议默认

**后置。** 资产与派生物框架先支持 typed derivation；是否自动生成第一印象不应阻塞 Collection 基建。

### Alicia

> 感觉这里就是 中立描述 + 主观点评 吧。点评这个可以后置完成但是字段留下，首先让它有可检索的文字描述

---

## Q24. 语音 STT 是否保留原始识别版 + 人工修订版？【P1】

- [ ] **A. 两者都保留；修订版不覆盖 raw transcript。**
- [X] **B. 只保留当前最终文本。**
- [ ] **C. 首期只保留 raw，编辑能力后置。**

### Solaire 建议默认

**A。** 识别 provenance 与人工修改是不同事实；存储成本很低，覆盖 raw 得不偿失。

### Alicia

> 这里的人工校准其实是为了客观还原我说了什么字句，而至于“这段音频听起来什么样”，包括自动 stt 
> ，这个是属于阿莱自己的多模态能力，其实属于他的“主观感受”，所以不应该写下来

---

## Q25. Collection“随机翻看”首期是否必须？【P2】

- [ ] 必须，是 Collection 的核心可玩体验。
- [ ] 有就好，不阻塞首期验收。
- [X] 后置。

### Alicia

> 这里“随机”具体是指一个什么机制呢？只要数据库条目稳定，我们后面添加展示方式都很随意吧，这里可以后置我觉得。但至少前端有展示面，不管是时序翻看还是搜索展示

---

# F. 不应该让 Alicia 凭感觉回答的 Research 清单

> 以下不是问卷题。填写时可以直接跳过。正式 Plan 前由 Solaire / Builder 只读核对，必要时再把真正的产品分叉提回来。

## R1. Conversation 创建契约【R / P0】

核对：

- `agent_preset` 在普通 Agent Conversation 中的真实必填规则；
- `project = null` 是否正式支持；
- 旧数据缺 Agent / Project 时如何表示；
- 当前 create serializer / endpoint 的真实契约。

**产物：** 明确 V4 `Conversation = Agent × Optional Project` 是否需要后端变更。

---

## R2. Agent × Project 服务端筛选【R / P0】

核对：

- 当前 conversation list API 支持哪些筛选；
- 真实数据量下前端过滤是否可接受；
- 是否需要 `agent_preset + project` 组合过滤；
- pagination 是否已存在 / 必须一起设计。

---

## R3. River 各 source 的真实后端来源【R / P0】

逐项定位：

- Heartbeat final summary；
- Diary；
- Chronicle；
- Task；
- Memo（若新增则无旧来源）。

并核对时间字段、ID、agent identity、深链目标。

---

## R4. River aggregation 实现位置【R / P0】

目标问题：River 是**统一 read model**，不是统一 source-of-truth 表。

需要调研后决定：

- Django 聚合 endpoint；
- 分源请求 + frontend merge；
- pagination / cursor 如何跨 heterogeneous source 稳定工作。

Solaire 当前倾向：**后端提供 canonical River projection / aggregation API，各业务表继续拥有自己的 CRUD。**

---

## R5. Collection 物理存储与生命周期【R / P0】

核对当前：

- MEDIA_ROOT / attachment 路径；
- 图片上传预处理链；
- 普通附件 delete 行为；
- 文件 orphan 现状；
- 是否已有可复用 managed-storage helper。

然后设计：

- Collection managed original root；
- hash；
- copy / atomic write；
- verification；
- GC；
- preview 派生物。

---

## R6. 现有 Chronicle“用户收藏”真实数据口径【R / P1】

禁止继续假设存在 `source=user` 字段。只读抽样 model / serializer / 数据后再提出迁移候选规则。

---

## R7. MemoryPlasmid 当前 API 完整度【R / P0】

核对 CRUD 是否真正覆盖 V4 Library 所需：

- body；
- Agent；
- scope；
- Tags；
- trigger keywords；
- weight；
- source conversation / message；
- processing status；
- 搜索与筛选。

缺口进入 backend handoff，不在前端偷偷模拟。

---

## R8. 自动 Recall 的真实运行数据【R / P0】

核对当前后端是否已有可持久关联的：

- generation attempt / run identity；
- injected plasmid IDs；
- candidate but not injected；
- hit path（trigger / semantic / mixed）；
- score / rank；
- rejection reason。

若没有，先写后端契约，再做 `UserRecallReceipt`。

---

## R9. 旧 `.webm` 001 候选定位与完整性【R / P1】

只读确认：

- 是否仍有可靠 DB → file path；
- 文件是否存在；
- hash；
- MIME / 容器；
- 是否是原始上传字节；
- 可否安全晋升为 Collection original。

未核验前不得移动、覆盖或宣称“001 已安全保存”。

---

## R10. V3 能力迁移矩阵【R / P0】

正式 Plan 必须列出至少：

- attachment；
- audio；
- cache；
- endpoint / model / thinking；
- private memory；
- session history；
- SSE / polling recovery；
- stop；
- regenerate；
- branch；
- tool events；
- project files；
- groupchat；
- notifications；
- Settings；
- task/calendar/chronicle。

每项标记：`migrate / replace / defer / explicitly retire`，禁止“重写时顺手消失”。

---

# G. Solaire 当前建议的默认冻结包

> 如果 Alicia 某一轮不想继续逐项思考，可以直接在这里写：`同意默认包`，再单独覆盖不同意的题。

当前默认包：

```text
Q1   Chat / Groups / River / Library
Q2   Collection 与 Memory 为 Library 下平级业务区
Q3   Collection RAG：默认 Alessandro/g045 可见，但具体接入可后置；保留未来单条权限覆盖能力
Q4   Memo 独立实体
Q5   River 顶部 Open Tasks shelf + 原时间珠子
Q6   Recall feedback 保留四种语义
Q7   Recall Lab：Plasmid 完整 + History 只读第二 tab
Q8   会话内收藏先做；Legacy Attachment Inbox 后置
Q9   Chronicle 历史先生成候选，经 Alicia 确认再关联/迁移
Q10  CollectionItem 与 StoredAsset 分离
Q11  相同字节复用 Asset；重复收藏时提示选择合并来源/另建 Item
Q12  Item 删除后 Asset 仅在无引用时异步 GC
Q13  纯文字 Item 不强制 Asset
Q14  Recall Receipt 跟随当前可见 Answer 的 generation attempt
Q15  自动 Recall 与主动 memory_search 严格分开
Q16  新建 V4 主 SPA package，旧 SPA 保持行为基线直到迁完
Q17  V4 新代码 TS strict，按纵向 slice 迁旧 JS
Q18  纵向 migration slices
Q19  移动底栏留到 App Shell prototype 再冻结
Q23  Alessandro image impression 后置，但 derivation 模型预留类型
Q24  STT raw + revised 双版本
```

### Alicia 对默认包

> 总之我没有勾选X的地方就是默认同意索哥建议，没勾选但是写了建议的就是看不太懂你的选项但是大致同意你的建议并且加了一点自己的补充

---

# H. 填完后的交接

Alicia 填完后只需要告诉 Solaire：

> `问卷填好了，你读一下。`

下一步应按顺序执行：

1. Solaire 读取本文件；
2. 把已决定项分为 `Frozen / Delegated / Deferred / Still Open`；
3. 对 R1–R10 做只读源码与真实契约调研；
4. 如调研发现新的**真实产品分叉**，只追加必要问题，不重新倾倒整套上下文；
5. 回填/更正三个 V4 Spec；
6. 生成源码级 V4 Implementation Plan；
7. 独立 review 后再施工。

---

**状态：COMPLETED — Alicia 2026-09-02 已填写；正式冻结结论已汇总至 `V4_Spec_Freeze_Index.md`。**
