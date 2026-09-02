# ExoCore V4 — Spec Freeze Index

> 文档类型：V4 规格索引 / planning handoff，不是 Implementation Plan。
> 状态：Frozen input for Master Roadmap。
> 日期：2026-09-02。
> 产品决策：Alicia。
> 整理：gpt-5.6-sol / Solaire。

---

## 1. 这份文件解决什么

V4 经过多轮讨论后，前端仓库内同时存在架构 Spec、页面骨架、River/Collection/Memory 交互 Spec、决策问卷和后端只读调研。

它们不再被视为五份平级、可以互相覆盖的意见稿。

本文件冻结：

1. 每份文档负责哪一层；
2. 冲突时按什么顺序解释；
3. 当前已经冻结的产品与架构边界；
4. 哪些问题属于 backend contract / phase gate，而不是继续追问 Alicia；
5. Master Roadmap 应怎样拆 phase，避免一次性写完整个 V4 的源码级巨型计划。

---

## 2. 文档职责与优先级

### 2.1 Source of truth 顺序

出现冲突时，按以下顺序解释：

```text
1. 本文件 V4_Spec_Freeze_Index.md
2. V4_River_Collection_Memory_Interaction_Spec.md
3. ExoCore_V4_Single_SPA_Architecture_Spec.md
4. V4_Page_Skeleton.md
5. V4_Frontend_Refactor_Decision_Questionnaire.md
6. 旧研究笔记 / 历史 Plan / 旧 ReactSheet
```

问卷用于记录 Alicia 的决策过程，不再作为施工时需要重新回答的开放问题清单。

### 2.2 各文档只负责一层

| 文档 | 负责 | 不负责 |
|---|---|---|
| `ExoCore_V4_Single_SPA_Architecture_Spec.md` | 单 SPA、领域边界、导航/路由原则、状态所有权、迁移原则、repo/package 策略 | 具体视觉、源码级施工顺序 |
| `V4_River_Collection_Memory_Interaction_Spec.md` | River / Collection / Memory 的产品语义、交互契约、召回可见性 | 整个 App 的基础技术骨架 |
| `V4_Page_Skeleton.md` | 页面层级、每页放什么、Mockup 输入 | 后端表结构、详细 API、phase 施工 |
| `V4_Frontend_Refactor_Decision_Questionnaire.md` | 决策历史与 rationale | 当前开放问题的唯一来源 |
| 后端 R1–R10 只读调研 | 当前源码/API/数据事实 | 产品决策权 |

---

## 3. 一级产品结构：Frozen

```text
ExoCore V4
├── Chat
│   ├── Chat Home / Recent
│   ├── Agent Hub
│   ├── Agent Profile
│   ├── Project Hub
│   ├── Project Detail
│   └── canonical Conversation
│
├── Groups
│   ├── Group list
│   └── Group room
│
├── River
│   ├── Open Tasks shelf
│   ├── Memo
│   ├── Heartbeat final summary
│   ├── Diary preview / full read
│   ├── legacy Chronicle event
│   └── Task / completion events
│
└── Library
    ├── Collection
    │   ├── Text
    │   ├── Image
    │   ├── Audio
    │   └── Document
    │
    └── Memory
        ├── MemoryPlasmid Library
        ├── Trigger & Tags
        ├── Recall Lab
        └── History exact lookup
```

Settings 从头像 / More 稳定可达，但不是一级产品区域。

移动端底栏的具体四项呈现尚未冻结；它是 App Shell mockup 决策，不得反向修改上述 canonical IA。

---

## 4. Chat：Frozen architecture

### 4.1 Conversation 心智模型

```text
Conversation = Agent × Optional Project
```

- Agent 创建时必需；
- Project 可为空；无 Project 状态名称冻结为 `Drift`；
- Agent 与 Project 是同一批 Conversation 的两个筛选维度，不是两套树；
- canonical chat 只有一个详情实现；
- GroupChat 保持独立实体与运行逻辑。

### 4.2 运行能力不得在重写中静默丢失

至少包括：

- attachment；
- audio；
- cache；
- endpoint / model / thinking；
- private memory；
- session history；
- SSE + polling recovery；
- stop；
- regenerate；
- branch；
- tool events；
- project files；
- notifications。

Master Roadmap 必须携带 V3 capability matrix；每个 detailed plan 只接管该 phase 实际触碰的能力。

---

## 5. River：Frozen product semantics

### 5.1 River 是时间 read model

River 不成为新的万能 source-of-truth 表。

```text
source domain -> River projection -> unified time reading
```

各业务实体继续拥有自己的 CRUD；后端应提供稳定聚合 projection / pagination contract，前端不跨 heterogeneous source 自行拼分页。

### 5.2 Memo

- 无标题低摩擦输入；
- Markdown / tags；
- 优先研究现 Timeline/Tweet 领域直接演化；
- reply tree 必须保留；
- River 主轴只排序 thread root，回复属于 Memo 的局部 capability；
- inline / drawer / detail 的展开方式是 mockup 决策，不是数据模型 blocker。

### 5.3 Diary

- River 展示当天约 09:00 形成的 canonical DiaryEntry 的一小段 preview；
- 点击阅读全文；
- preview 首期可以由 canonical content 截取，不要求额外生成一份 River-specific summary；
- popup / drawer / inline 阅读属于前端表现，不要求 API 分叉。

### 5.4 Task

- River 顶部固定 Open Tasks shelf；
- 主时间轴仍保留 Task 原始事件；
- complete / defer / edit capability 保留；
- Calendar 为陪伴视图。

### 5.5 Chronicle

Chronicle 不再被要求继续作为 V4 独立新产品领域。

```text
legacy highlight          -> Collection promotion candidate
legacy milestone / moment -> River legacy event candidate
semantic-uncertain rows   -> Legacy Archive
```

原则：

- 不全删；
- 不全继承；
- 不 destructive migration；
- 未明确 promotion 的历史数据继续可审计保留；
- 新 bookmark 最终写 Collection，不继续扩大 Chronicle 混合语义。

---

## 6. Collection：Frozen product semantics

### 6.1 Collection 与 Memory 不等价

Collection 是情感藏品：因为“想留下来”而存在。

Memory 是 Agent recall substrate：因为“未来交流可能需要知道”而存在。

二者同属 Library，但平级、不同 CRUD、不同数据模型。

### 6.2 Item 与 Asset

```text
CollectionItem = 收藏行为、情境、描述、Tags、来源、时间
StoredAsset    = 文件原件身份、稳定 hash、物理生命周期
```

- text item 不强制 StoredAsset；
- 文件型 item 使用 managed asset；
- 同一字节可以复用同一 StoredAsset；
- 收藏行为本身不去重；
- 同一表情包第十六次被发送并收藏，可以留下第十六次独立情境；
- 删除 Item 不得误删仍被引用的 Asset；实际 GC 为独立生命周期问题。

### 6.3 Derived semantic material

- image：neutral description；
- audio：可人工校准的 canonical transcript；
- document：extracted text / canonical summary；
- image 的 g045 主观点评属于另一 typed derivation，可预留类型但后置生成；
- 模型的主观“听感”不伪装成客观 STT 落库。

### 6.4 RAG direction

- Collection 未来是独立 RAG target；
- 长期授权按 Agent type `g045`，不按易变化 DB preset ID；
- V4 Collection 首期只建立原件、canonical semantic material、搜索与授权结构；
- 暂不接 current `memory_search`。

### 6.5 历史附件

首期不做全局 legacy attachment migration/inbox。

实时新附件收藏优先；历史内容以后由用户手动选择添加。

---

## 7. Memory / Recall：Frozen direction

### 7.1 MemoryPlasmid Library

至少支持：Agent、scope、Tags、source、status、trigger 状态、正文搜索，并可编辑真实允许修改的字段。

### 7.2 History

History 精确查找采用 grep-like 心智模型：

```text
query
-> total hit count
-> keyword context snippets
-> expandable source
```

它不是首期第二套完整 semantic ranking 实验台。

### 7.3 自动 recall 与主动 memory_search

严格分开：

- automatic MemoryPlasmid recall -> User Message 下方 Recall Receipt；
- active `memory_search` -> Assistant Run Trace 中普通 ToolCall。

Recall feedback 冻结为：

```text
相关 / 无关 / 内容有误 / 本轮漏召回
```

首期只持久记录，不自动改变 weight / Tags / trigger keywords。

### 7.4 Recall observability backend gate

当前后端没有足够的 generation attempt / injected candidate / score / rejection 持久数据支撑 Recall Receipt。

因此 Recall Receipt 与 Recall Lab 的 runtime-observability 部分必须等待独立 backend contract：稳定 attempt identity + structured recall records。

这属于 phase gate，不是继续向 Alicia 追问产品意图。

---

## 8. Repo 与应用骨架：Frozen default

### 8.1 默认不开新 repo

V4 默认继续留在 `ExoCore-Desktop`。

推荐：

```text
ExoCore-Desktop/
└── packages/
    ├── chat-core      # V3 baseline
    ├── chronicle      # V3 baseline
    ├── council        # deferred baseline
    ├── shared
    └── <new-v4-app>   # clean V4 SPA
```

新 V4 app 从第一天使用 TypeScript strict，并按纵向 user-path slice 迁移能力。

### 8.2 什么情况下才重新开 repo

只有出现真正的 repository boundary 时再拆，例如：

- 独立发布/部署生命周期；
- 不同权限或 ownership；
- 构建/依赖工具链无法在 monorepo 内合理隔离；
- V3/V4 共仓造成不可接受的 CI 或 package resolution 冲突。

“前端没有必留数据”或“可以全部重写”不是单独开 repo 的充分理由。

---

## 9. Backend contract gates

Master Roadmap 应把下面内容作为独立 backend dependency，不把 Django + React 全塞进一张巨型施工单。

### B1 — Attachment provenance + Collection managed storage

- 恢复/建立新附件可靠来源身份；
- CollectionItem / StoredAsset；
- managed original root；
- verification/hash；
- GC；
- preview / derived representations。

### B2 — River aggregation

- Diary read API；
- heterogeneous River projection；
- canonical occurred_at；
- global pagination/cursor；
- source-specific deeplink/capabilities。

### B3 — Memory search/filter

- MemoryPlasmid server-side q/tag/filter/pagination；
- History grep-like exact lookup + hit count + context。

### B4 — Recall run identity / observability

- generation attempt identity；
- injected and candidate plasmid records；
- hit path；
- score/rank where applicable；
- rejection reason；
- feedback persistence。

---

## 10. Planning decomposition contract

### 10.1 不写一个“全 V4 源码级 Implementation Plan”

规划分两层：

```text
Master Roadmap
    -> Phase 0 Detailed Plan -> implement -> accept
    -> Phase 1 Detailed Plan -> implement -> accept
    -> Phase 2 Detailed Plan -> implement -> accept
    -> ...
```

Master Roadmap 只冻结 phase、依赖、entry/exit gate、backend handoff、rollback/checkpoint 和 capability ownership。

只有当前即将施工的 phase 才写源码级 detailed plan。

### 10.2 Master Roadmap 建议分块

以下是 **spec boundary suggestion**，不是已经完成的 Roadmap：

```text
Phase 0  Contract & Baseline Freeze
Phase 1  V4 App Shell + Chat Vertical Slice
Phase 2  Groups + Remaining Core Shell
Phase 3  River + Memo
Phase 4  Collection
Phase 5  Memory Library
Phase 6  Recall Observability
Phase 7  Legacy Retirement & Cleanup
```

Roadmap author 可以基于依赖重新合并或拆小，但必须遵守：

- Phase 0 后只为当前 phase 写源码级计划；
- backend B1–B4 作为明确 gate/handoff；
- 每 phase 都可独立验收和 rollback；
- V3 未迁能力必须显式 `migrate / replace / defer / retire`；
- 后半程不得依赖今天对未来文件路径的脆弱预测。

---

## 11. 当前仍然允许后置的产品/视觉选择

这些不阻塞 Master Roadmap：

- mobile bottom bar 的具体四项与 More 交互；
- Memo thread 的 inline / drawer / detail 展开；
- Diary 全文 popup / drawer / inline；
- Library landing 默认展示 Collection 还是 split chooser；
- Collection Item Detail 的 desktop/mobile 信息密度；
- image g045 subjective impression 的生成时机；
- Collection random browse；
- multimodal embedding model/version；
- Android Capacitor 具体承载方式；
- Council 最终退役与否。

---

## 12. 给 Master Roadmap 作者的输入要求

开始 Roadmap 前应读取：

1. 本 Freeze Index；
2. `ExoCore_V4_Single_SPA_Architecture_Spec.md`；
3. `V4_River_Collection_Memory_Interaction_Spec.md`；
4. `V4_Page_Skeleton.md`；
5. 已完成问卷，仅用于 rationale；
6. R1–R10 evidence report / 对应源码，只用于事实验证。

Roadmap 不应重新询问已经 Frozen 的产品问题；只有源码调研发现**新的真实产品分叉**时才回到 Alicia。

---

**状态：READY FOR MASTER ROADMAP**
