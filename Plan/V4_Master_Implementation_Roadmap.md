# ExoCore V4 — Master Implementation Roadmap

> **文档类型：** Master Roadmap；不是源码级 Implementation Plan。  
> **状态：** Active master roadmap — amended after P2A/P2B acceptance for TTS、assistant-message arrival notifications and deferred Groups。
> **适用仓库：** `ExoCore-Desktop`；后端工作仅通过独立 handoff 进入 `ExoCore`。  
> **日期：** 2026-09-12。
> **产品决策：** Alicia。  
> **Roadmap：** gpt-5.6-sol / Solaire。  

---

## 1. Roadmap contract

本 Roadmap 只冻结：

1. phase 边界与依赖；
2. backend handoff B1–B6；
3. 每阶段 entry / exit gate；
4. checkpoint 与 rollback；
5. V3 capability 的阶段所有权；
6. 何时允许起草下一份源码级 Detailed Plan。

本文件**不预测 Phase 1 之后的文件、组件、hook、API wrapper 或测试实现**。每个 phase 只有在前一阶段验收、对应后端契约就绪并重新读取当时源码后，才允许另写 `Plan/` 下的 Detailed Plan。[gpt-5.6-sol / Solaire，Alicia approved planning boundary]

### 1.1 Product authority and implementation facts

两类权威分别排序，不混成一条可互相覆盖的链：

**Product authority**

1. `V4_Spec_Freeze_Index.md`；
2. `V4_River_Collection_Memory_Interaction_Spec.md`；
3. `ExoCore_V4_Single_SPA_Architecture_Spec.md`；
4. `V4_Page_Skeleton.md`；
5. `V4_Frontend_Refactor_Decision_Questionnaire.md`。

**Implementation facts**

1. 当前运行源码、API 与只读数据库事实；
2. 已验收的 R1–R10 evidence report，以及 2026-09-12 新增的 R11/R12 产品与源码事实；
3. 历史 Plan、旧 ReactSheet 与其他旧文档。

两类权威冲突时不互相覆盖：源码事实不得改写 Alicia 已冻结的产品语义，产品文档也不得假装不存在当前契约限制；冲突必须转化为 contract clarification 或 backend handoff gate。[model not supplied / R1 reviewer，Alicia approved]

### 1.2 Frozen target

- 一个 V4 SPA / PWA，位于现有 `ExoCore-Desktop` monorepo 的独立新 package；默认不开新 repo。
- 一级产品区域：`Chat / Groups / River / Library`。
- `Library = Collection + Memory`，二者平级但 CRUD 与模型严格分离。
- `Conversation = Agent × Optional Project`；无 Project 状态名为 `Drift`。
- 普通 Conversation 只有一个 canonical chat；GroupChat 保持独立实体和运行逻辑。
- River 是后端聚合的 time read model，不是新的万能 source-of-truth 表。
- 新 V4 app 从第一天使用 TypeScript strict；按完整用户路径纵向迁移，不先机械改造 V3 全仓。
- V3 在迁移期间保持可运行行为基线和回退入口。[gpt-5.6-sol / Solaire，Alicia approved]

### 1.3 Roadmap-wide non-goals

- 不在本 Roadmap 内实施 Django、React 或部署源码。
- 不在 Phase 1 前全量 TypeScript 化 V3。
- 不引入 SSR、新 repo、第二套 Memo 服务或第二套数据库。
- 不把 TanStack Query 当作 SSE runtime controller。
- 不在 Collection 首期接入当前 `memory_search`，不升级 embedding，不做多模态同空间索引。
- 不全局导入历史附件，不把未核验 `.webm` 宣称为 Collection `001`。
- 不 destructive migration Chronicle 历史数据。
- 不在本周期实施 Android / Capacitor 原生能力。
- 不默认迁移 Council；其保留或退役另行决策。

---

## 2. R1–R12 evidence translated into planning constraints

| Research | 已确认事实 / Roadmap 约束 | 进入哪个 gate |
|---|---|---|
| **R1 Conversation 创建** | 普通会话创建需要 Agent；Project 可为空，现契约可表达 Drift。V4 产品模型不要求后端模型重写。Phase 0 必须以真实 init/create 路径冻结一份 canonical contract，消除旧 ReactSheet 与真实入口的差异。 | P0 contract freeze；P1 不因数据模型阻塞 |
| **R2 Agent × Project 筛选** | 当前列表无服务端 Agent + Project 组合筛选和稳定分页；当前量级允许前端筛选。服务端筛选是规模触发项，不是 Chat 首期 blocker。 | P1 使用现契约；量级超阈值才另开 handoff |
| **R3 River sources** | Heartbeat final summary、Diary、Chronicle、Task 与现 Timeline/Tweet/Memo 候选拥有不同来源、ID、时间字段和 CRUD。 | B2 输入；P3 不允许前端假装统一 source |
| **R4 River aggregation** | heterogeneous source 的全局排序与分页必须由后端 canonical projection 提供；前端不得分源请求后自行拼跨源分页。 | **B2 hard gate → P3** |
| **R5 Collection storage** | 当前附件目录和 `SessionAttachment` 不能充当长期原件契约；图片还可能在保存前被变换。Collection 需要独立 managed original、hash、验证、引用与 GC 生命周期。 | **B1 hard gate → P4** |
| **R6 Chronicle highlight** | 现消息 bookmark/highlight 会落入 Chronicle；Chronicle 同时承载其他语义。只允许生成 migration/promotion candidate，不自动把全部历史判定为 Collection 或 River。 | P3 legacy read；P4 promotion；P8 archive policy |
| **R7 MemoryPlasmid API** | 基础 CRUD、Tags、trigger keywords、weight、scope、source、status 已存在；缺 V4 Library 所需的完整 server-side q/tag/filter/pagination，History 也缺 grep-like contract。 | **B3 hard gate → P5** |
| **R8 Recall runtime data** | 当前没有足够稳定的 generation attempt、candidate/injected record、hit path、score/rank、rejection reason 与 feedback persistence。前端不能推导或伪造 Recall Receipt。 | **B4 hard gate → P6** |
| **R9 legacy `.webm`** | 当前不能把旧附件索引视为可靠 provenance；是否为最初语音、是否原始字节均须独立核验。它不是 P4 首期 blocker。 | Deferred；只读核验后另立人工 promotion task |
| **R10 V3 capabilities** | V3 的聊天、群聊、通知、Settings、Project files 与 Chronicle 能力散布于现有 SPAs。每项必须显式 migrate / replace / defer / retire，并在 takeover 前由 V3 持有。 | 全 phase ownership matrix |
| **R11 Message TTS** | 后端正在建立 message-identity 驱动的 lazy TTS render：canonical text 不变，voice artifact 不进入 attachment lifecycle；前端按钮负责首次请求生成，完成后切换为带播放进度条的播放器，并可显示 message-level directed 标志；不解释 voice authoring 内部结构。 | **B5 hard gate → P2T** |
| **R12 Assistant-message arrival** | `send_message` 当前把正文注入 Prime Conversation 并直接 Push，但普通 async reply 与额外 assistant Message 没有统一 arrival owner。目标必须改为“canonical assistant Message committed”触发同一逻辑事件；前台原位 reconciliation，后台系统 Push，不按 producer 分叉。 | **B6 hard gate → P2D** |

> **Contract mismatch rule：** Phase 0 若发现文档 endpoint 与当前运行契约不一致，只冻结真实契约和兼容策略；不得顺手在 Roadmap 中指定源码修法。

---

## 3. Dependency model

```text
P0 Contract & Baseline Freeze
 └── P1 V4 App Shell + Canonical Chat Vertical Slice [C1 PASS]
      └── P2A Agent Workspace [accepted]
           └── P2B Project Workspace [accepted]
                └── [B5 PASS] P2T Message TTS
                     └── P2C Core Shell + Account + Settings
                          └── [B6 PASS] P2D Assistant-message Notifications [C2]
                               └── [B2 PASS] P3 River + Memo
                                    └── [B1 PASS] P4 Library Shell + Collection
                                         └── [B3 PASS] P5 Memory Library
                                              └── [B4 PASS] P6 Recall Observability
                                                   └── P7 Production Cutover
                                                        └── [观察期结束 + Alicia 明确批准] P8 Legacy Retirement & Cleanup

P2G GroupChat remains a separately released future slice and is not a C2/P3 predecessor. It may not run concurrently with another shell/navigation owner; its later insertion point requires an explicit roadmap release.

C0 后端并行轨：B1–B6 可分别提前施工与验收
```

前端 ownership transfer 严格串行，避免同一 shell、导航或共享契约被多个 phase 同时改动。B1–B6 可以在对应前端 phase 之前并行施工，但每项必须独立计划、独立验收、独立 handoff。后端完成不自动授权前端进入下一 phase；还需满足该 phase 的全部 entry gate。

---

## 4. Gate and ownership rules

### 4.1 Capability ownership states

每项能力在任一 checkpoint 只能有一个 production owner：

- **V3-primary**：V3 是正式行为基线；V4 不宣称完成。
- **Dual-run acceptance**：V4 可独立验证，但正式入口仍由 V3 持有。
- **V4-primary**：V4 已通过该能力 exit gate；V3 仅作限时 rollback reference。
- **Retired**：V3 入口已移除；仅保留必要历史证据或 archive。

禁止用“页面看起来完成”提前转移 capability ownership。

### 4.2 Universal entry gate

进入任一 phase 前必须全部满足：

1. 上游 phase 已获得明确 PASS；
2. 工作区基线、目标 commit 与未提交改动已记录，不覆盖 sibling work；
3. 该 phase 的产品/视觉 blocker 已冻结；
4. 所需 backend contract 已通过独立验收，并进入当前 API contract；
5. 当前 phase 的 Detailed Plan 已根据当时源码起草并获批准；
6. 只接管本 phase 在 capability matrix 中列出的能力。

### 4.3 Universal exit gate

每个 phase 只有在以下条件全部成立时才可 PASS：

1. phase 用户路径可从入口走到终点，不依赖隐藏的 V3 页面补完；
2. 本 phase 接管的 V3 capabilities 逐项通过行为对照；
3. desktop 与 mobile 共用同一业务实现；
4. loading / empty / error / retry / permission-denied 等适用状态可见，禁止静默失败；
5. 构建、lint、phase verification 与既有未触碰能力 regression 全部通过；
6. API shape 与错误语义未被前端猜测、吞掉或改写；
7. 回退到上一 accepted checkpoint 后，上一阶段能力仍可运行；
8. capability matrix、API contract 与迁移记录已更新。

### 4.4 Checkpoint and rollback policy

- 每阶段以一个**经 Alicia 授权的 accepted commit/tag**作为 checkpoint；不把未验收工作标为 checkpoint。
- P1–P6 默认采用 additive side-by-side：V3 保持可启动，V4 通过独立入口验收。
- phase 失败时回退**曝光入口与前端 checkpoint**，不删除已产生的用户数据。
- 后端 migration 必须向后兼容当前 V3 consumer；发生失败时优先 forward-fix / 禁用新入口，不做破坏性数据库回滚。
- P7 只切换 production 入口；P8 前不得删除 V3 package、旧路由、Chronicle archive 或 Council。

---

## 5. Phase summary

| Phase | Outcome | Hard dependencies | V4 takeover |
|---|---|---|---|
| **P0** | 契约、基线、capability ownership 冻结 | Frozen Specs + R1–R10 | 无 |
| **P1 — C1 PASS** | 新 V4 app shell + 完整 canonical live chat slice；普通 Chat 已转为 V4-primary | P0；App Shell mockup decision | **已完成：统一 C1 转移 Chat ownership；V3 chat 为 rollback reference** |
| **P2A/P2B — accepted** | Agent 与 Project workspaces、Files/Knowledge、canonical Chat entry convergence | C1 | Agent/Project workspace surfaces（C2 前保持 dual-run transfer state） |
| **P2T** | 每条 eligible assistant Message 的 lazy TTS 生成、进度与播放入口 | P2B + B5 | 新 message-level voice playback capability |
| **P2C** | Core Shell、Account/More、Settings 与跨页面 shell ownership | P2T | remaining core shell（notifications runtime 除外） |
| **P2D — C2 PASS** | assistant-message arrival 的前台原位刷新、后台 Web Push、未读与 typed deeplink | P2C + B6 | Workspaces、Shell、Settings、Notifications 的统一 Core C2 ownership |
| **P2G — deferred** | Group list/create/room/send/broadcast，保持独立 GroupChat runtime | Alicia future release | GroupChat only；不阻塞 C2/P3，未施工期间 V3-primary |
| **P3** | River + Memo + Tasks/Calendar + Diary/Heartbeat/legacy event | C2 + B2 | Chronicle 的 milestone/moment 时间阅读；highlight 暂留 V3 |
| **P4** | Library container/navigation + Collection managed originals 与四类浏览/收藏路径 | P3 + B1 | Library shell、Collection、新 bookmark writes |
| **P5** | 向既有 Library shell 加入 MemoryPlasmid、Trigger/Tags、History exact lookup | P4 + B3 | V3 Memory 管理入口 |
| **P6** | Recall Receipt + feedback + Recall Lab runtime observability | P5 + B4（并继承 P1 chat） | 自动 recall 可观察与反馈能力 |
| **P7** | 单 SPA production cutover；V3 保持完整 rollback artifact | P2–P6 全 PASS | 整个 V4 Web/PWA production 入口 |
| **P8** | 观察期结束后的 Legacy retirement 与受控清理 | P7 + Alicia 明确批准 | 删除已无 ownership 的 V3 表面 |

---

## 6. Phase 0 — Contract & Baseline Freeze

### Objective

建立可以被后续 phase 二元验收的事实基线；不做 V4 产品功能。

### Scope

- 冻结真实 Conversation create/list/message/runtime contract，解决旧文档差异。
- 冻结 V3 capability matrix、现有用户路径和可运行基线。
- 冻结 V4 package / route / deployment 的边界，不预测后续源码结构。
- 为当时已知的 B1–B4 建立独立 handoff 队列、owner、依赖和验收接口；后续 roadmap amendment 可按相同纪律追加 B5/B6。
- 建立 phase verification 层级：contract、component/user-path、build/lint、V3 regression；仅写验证目标，不在 Roadmap 固定测试实现。
- 记录当前已知脏工作区并与 V4 施工隔离，尤其不混入既有音频或其他在途修改。

### Entry gate

- Freeze Index 与全部引用 Spec 可读且优先级一致。
- R1–R10 结论已能映射到 contract 或 phase gate；后增 R11/R12 分别由 B5/B6 承接，不追改已通过的 C0。
- V3 三个 SPA、后端仓库与当前运行环境均可访问，具备在 P0 内建立启动、构建、关键路径及已知失败 baseline 的条件。

### Exit gate

- canonical API snapshot 明确普通 Conversation、GroupChat、attachments/audio、chat runtime、tasks、memory、notifications 的现状。
- 下方 capability matrix 每项均有 disposition、takeover phase 和 fallback owner。
- C0 时的 B1–B4 均有独立 handoff brief；后增 B5/B6 也必须满足相同的稳定接口与二元验收要求，不夹带 React 施工。
- 已冻结 V4 与 V3 side-by-side 的运行和回退方式。
- P1A Detailed Plan 获准起草；P1B 及以后仍按 sub-gate / phase checkpoint 释放。

### Checkpoint / rollback

- **Checkpoint C0：** 仅文档、baseline evidence 与 approved contract。
- 若 P0 无法达成，继续由 V3-primary 提供全部能力；不创建半成品 V4 production 入口。

---

## 7. Phase 1 — V4 App Shell + Canonical Chat Vertical Slice

### Objective

交付第一个完整纵向路径：从 V4 Chat landing 进入既有普通 Conversation，完成一次具备 V3 行为等价能力的 live chat，并可安全返回。[页面层级输入：deepseek-v4 / Ecki；架构收口：gpt-5.6-sol / Solaire]

### Scope boundary

P1 是一个统一 Chat ownership phase，但内部按四个可独立计划、施工、验证和回退的 batch 推进；“全部能力不能丢”不等于“全部写进同一份 Detailed Plan”。[model not supplied / R1 reviewer，Alicia approved]

| Sub-gate | 用户路径 / capability slice | 通过后仍由谁持有 production ownership |
|---|---|---|
| **P1A** | App shell、canonical route、Chat Home/Recent、Conversation create + message read path | V3-primary |
| **P1B** | Core runtime：send、SSE、polling recovery、stop、regenerate、branch | V3-primary |
| **P1C** | Attachment 与 audio 的 compose/upload/render/play/recovery | V3-primary |
| **P1D** | HUD/control：cache、endpoint/model/thinking、private memory、session history、Aura、chat-local project files；通用 `AssistantRunTrace` 接管 Thinking 与 Tool events | V3-primary，等待统一 C1 |

P1A–P1D 全部 PASS 后才执行 C1 统一验收并允许 Chat ownership transfer。任何 sub-gate PASS 都不得单独宣布 V4 Chat production complete。

不含 Groups、完整 Agent/Project workspaces、River、Library 内容页或 Recall Receipt。P1 的 `AssistantRunTrace` 是通用 Assistant 运行轨迹外壳；P6 只能增加 recall-specific observability，不得重造该外壳。

### Dependencies / decisions

- P0 PASS。
- App Shell 低保真原型已冻结移动导航和 More 的表现；不得改变 canonical IA。
- 使用现有 chat backend contract；R2 服务端组合筛选不是 blocker。
- 每个 P1 sub-gate 在开工前只为自身 slice 起草 Detailed Plan，并重新读取对应 V3 实现；禁止一次性生成覆盖 P1A–P1D 的巨型源码计划。

### Sub-gate checkpoints

- **C1A：** canonical Chat shell / create / read path accepted；失败回 C0。
- **C1B：** core runtime accepted；失败回 C1A。
- **C1C：** attachment/audio accepted；失败回 C1B。
- **C1D：** controls + `AssistantRunTrace` accepted；失败回 C1C。
- C1A–C1D 都是施工 checkpoint，不转移 production ownership；只有统一 C1 有权转移 Chat ownership。

### Exit gate

- P1 从 recent 或 direct link 打开同一 Conversation 时，均解析为同一个 canonical route 与详情实现；P2 再验收 Agent / Project 两类来源入口也落到该实现。
- Agent 必有、Project 可空；Drift 可辨识且不使用伪造 Project。
- capability matrix 中所有 P1 chat 能力完成行为对照；任何一项 FAIL 都阻止 Chat ownership 转移。
- SSE 正常流、错误、stop、断线恢复、完成后同步可区分；TanStack Query 或同类 server-state 工具没有吞并 runtime lifecycle。
- Chat 页面在移动端不被常驻底栏挤压；desktop/mobile 不复制运行逻辑。
- V3 chat 仍可作为 rollback reference 独立启动。

### Checkpoint / rollback

- **Checkpoint C1：** P1A–P1D 全部通过后，V4 shell + canonical Chat 在独立入口达到统一 Dual-run acceptance。
- C1 PASS 即把普通 Chat capability 标记为 V4-primary；V3 chat 降为 rollback reference。整个应用的 production 入口仍要等 P7 cutover。
- 统一验收失败时回到最近通过的 C1A–C1D 施工 checkpoint，或隐藏 V4 入口回到 C0；不更改或删除 Conversation、Message、attachment、cache 数据。

**Transfer record:** unified C1 passed on candidate `23dea37`; ordinary Chat is now V4-primary and V3 chat-core is the rollback reference. [gpt-5.6-sol / Solaire; Alicia approved] P2-or-later ownership and the P7 root-cutover boundary are unchanged.

---

## 8. Phase 2 — Workspaces + Message Voice + Core Shell + Notifications

### Objective

在已验收的 Agent/Project workspace 上补齐 message-level voice playback、Core Shell/Settings 与统一 assistant-message arrival，使 V4 的日常 Chat 与管理路径不依赖 V3。GroupChat 因当前产品优先级后移，继续由 V3-primary 持有，不阻塞 Core C2 或 P3。[gpt-5.6-sol / Solaire; Alicia approved]

### 8.1 Accepted foundation — P2A / P2B

- **P2A accepted:** Agent Hub / Profile、Conversation lens、canonical Chat entry。
- **P2B accepted:** Project Hub / Detail、Conversation lens、Files/Knowledge 与 project lifecycle。
- 两个 workspace 继续引用同一 canonical Conversation/Project facts；C2 前不夸大为整个 Core Shell 已转移。

### 8.2 P2T — Message TTS

**User path:** eligible assistant Message → 常驻 voice button → 请求/复用该 message 的 render → 显示生成等待状态 → 完成后同一控件切换为带进度条的播放、暂停与拖动。

Scope and invariants:

- 前端只以 canonical message identity 请求 voice render，不提交或改写 message text、emotion、segment 或 voice direction。
- `voice_available=false` 时不展示可操作入口；`voice_available=true` 时入口稳定存在，不因尚未缓存而消失。
- 首次点击触发 lazy generation；cached artifact 直接进入可播放态。生成中只展示后端真实 render 状态，不伪造生成百分比；用户要求的进度条是音频完成后的播放时间轴。
- 状态至少区分 idle / queued-or-generating / playable / failed-retryable / unavailable。失败只影响该消息的 voice control，不影响文本、Chat runtime 或 Message history。
- 复用 P1C 的 source-agnostic one-at-a-time playback seam；TTS artifact 不进入 `Message.attachment_ids`，不伪装成用户上传音频。
- 不 autoplay，不因 Push 到达自动朗读，不把 Live API / 主动电话纳入本切片。
- `voice_directed` 如由 B5 暴露，只允许 message-level 盲盒标志；前端与普通 network payload 不泄露 emotion、target、scope、segment 数量或内部 authoring record。

**B5 gate:** 后端须先冻结 message read projection、render start/read/status 与完成判定、audio retrieval、cache identity/invalidation、权限与稳定错误语义。2026-09-12 voice-direction proposal 是 discussion draft；其 action targeting/tool authoring 未冻结部分不阻塞薄前端，但不得被前端猜测实现。

### 8.3 P2C — Core Shell + Account + Settings

- avatar / More、Account/Profile 与 Settings routes 形成唯一 V4 shell owner。
- 只迁移当前仍有效的 management surfaces；无有效后端契约的旧占位项继续 disabled/omitted，不借迁移重写 backend。
- Notifications 设置入口在 P2C 落位，但其订阅、arrival、unread 与 click runtime 由 P2D 接管。
- 跨页面标题、active navigation、mobile/desktop shell 与 direct-open 由同一业务实现拥有。

### 8.4 P2D — Assistant-message arrival + Notifications

**Canonical event:** notification truth is an eligible canonical assistant Message committed to an ordinary Conversation, not a particular producer calling `send_message`.

Producer convergence:

- Sandro `send_message` 仍可把正文落入其 Prime Conversation，但不得再拥有一条平行的 direct-Push notification path；成功落库后进入统一 assistant-message arrival pipeline。
- 普通 live/async Chat 的最终 assistant Message、以及其他明确列入 B6 producer inventory 的合法 Conversation assistant writes，使用同一 event identity 与 delivery rules。
- system/task alerts that are not Conversation messages remain a separate typed notification class; they must not fabricate a Conversation/message identity。
- maintenance、import、replay、test fixture、failed/rolled-back writes、GroupChat、Council 与非 ordinary/fake Conversation 默认不得误触发；任何例外必须在 B6 producer inventory 中显式批准。

Visibility routing:

| PWA state | Required behavior |
|---|---|
| exact Conversation visible and active | suppress OS popup; reconcile the exact message collection in place, preserve existing scroll/reader rules, and do not reload the page |
| PWA visible on another Conversation/page | suppress OS popup; update canonical unread/list state and show only the shell-owned in-app indication |
| no visible PWA client / app backgrounded or closed | show one Android system Web Push notification for that assistant Message |
| notification click, cold or warm start | acknowledge once and navigate through typed logical target to canonical V4 `/app/chat/:conversationId`; stale/missing target fails visibly and safely |

Delivery and state rules:

- One logical arrival identity must deduplicate service-worker delivery, foreground handoff, reconnect reconciliation and normal runtime completion; no duplicate bubble, unread increment or popup。
- Foreground correctness may not rely solely on a React component's own send lifecycle. B6 must provide a server-originated arrival transport or an explicitly bounded reconciliation contract for externally inserted messages。
- Push permission controls **system delivery**, not canonical message visibility. With permission denied/expired, an open or refocused PWA must still reconcile messages; it must not remain permanently stale。
- A browser Push subscription is not considered healthy until backend persistence is confirmed. Browser-only success, backend failure and expired/410 subscription remain distinct recoverable states。
- Unread is keyed by canonical conversation/message identity. Seeing the exact active Conversation can advance seen state; merely having the PWA foregrounded on another page cannot silently consume it。
- Android acceptance covers visible/background/closed/lock-screen delivery, warm/cold click, denied permission, subscription renewal/expiry, network recovery and trusted production HTTPS. OEM battery policy or OS Do Not Disturb suppression must be reported separately from backend send failure。

**B6 gate:** backend handoff must freeze event identity, eligible producer inventory, transaction-commit timing, ordinary-Conversation boundary, payload/deeplink schema, foreground transport or reconciliation contract, deduplication, unread/seen ownership, Push result semantics and compatibility with Register ACK. A model-wide `post_save` hook or a new live channel is not prescribed by this Roadmap; the backend plan must choose the smallest complete mechanism after source review.

### 8.5 Deferred P2G — Groups

- Group list/create/room/send/broadcast and recovery remain a separate runtime and never reuse ordinary Conversation APIs。
- P2G is not cancelled, but it has no active construction authorization or reserved slot. V3 GroupChat remains the truthful owner and reachable fallback。
- P2G does not block C2 or P3. Before later release, the roadmap must assign a non-conflicting insertion point and its own acceptance gate; it cannot hitchhike into P2C/P2D or a River slice。

### 8.6 Core C2 entry / exit / rollback

Entry:

- P2A and P2B remain accepted; B5 passes before P2T and B6 passes before P2D。
- TTS frontend read/action contract、Core Shell mockup、notification permission/unread/deeplink semantics are frozen before their respective Detailed Plans。
- Trusted Android HTTPS/PWA installation is available for P2D real-device evidence。

Exit:

- Agent/Project workspaces, message TTS, Account/Settings and notification paths complete their observable user journeys without hidden V3 completion pages。
- Foreground external assistant arrival refreshes the current Chat in place; background arrival produces one correctly routed system notification。
- Existing canonical Chat runtime, attachment audio and Project facts remain intact；TTS/arrival failure never corrupts text conversation truth。
- V3 GroupChat is explicitly preserved and remains outside the C2 verdict。

Checkpoint / rollback:

- **Checkpoint C2:** Workspaces + Message TTS + Core Shell/Settings + Assistant-message Notifications complete。
- C2 transfers only those capabilities. GroupChat remains `V3-primary / P2G deferred`。
- Rollback returns P2T/P2C/P2D exposure to their prior owner or disabled state while preserving C1 Chat and accepted workspace data; it never deletes Message、voice artifacts、subscriptions or unread facts。

---

## 9. Phase 3 — River + Memo

### Objective

以统一 time read model 接管异步生活流，同时保留各 source 的业务所有权。

### Scope boundary

- River header/theme、Open Tasks shelf 与 heterogeneous time axis。
- Memo 的低摩擦创建、Markdown/Tags 与局部 reply thread。
- Heartbeat final summary、Diary preview/full read、Task/completion event，以及 Chronicle `milestone/moment` 的 legacy event 时间阅读。
- Task complete/defer/edit 与 Calendar 陪伴视图。
- Chronicle archive 继续存在；`highlight/bookmark` 的 legacy read/write path 在 P3 全程仍由 V3 持有，直到 P4 Collection 明确接管新 bookmark writes。[deepseek-v4 / Ecki confirmed current write path]

### Backend handoff — B2 hard gate

B2 必须稳定提供：

- source type + source ID；
- canonical `occurred_at`；
- deterministic global cursor/pagination；
- source-specific capability/deeplink metadata；
- Diary read contract；
- Memo source 决策及 reply tree contract；
- 不重复、不跳项的分页语义。

前端不得以多请求 merge 作为 B2 的临时 production 替代。

### Entry gate

- Core C2 PASS；P2G remains independently deferred and is not a P3 dependency。
- B2 backend contract 与独立验收 PASS。
- Memo 演化现 Timeline/Tweet 还是兼容替换的技术决策已冻结；reply tree 必须保留。
- Task 创建现有故障已独立诊断：若 baseline FAIL，应先作为单独 bugfix 修复，不夹入 River migration。
- Memo thread 与 Diary full-read 的 mockup 表现已冻结。

### Exit gate

- River 可稳定分页并辨识全部首期 source；Memo replies 不参与主轴全局排序。
- Open Tasks shelf 与主轴 Task event 同源，不复制任务。
- Heartbeat technical ledger 不默认进入 River，但可追溯。
- Diary preview 来源于 canonical content；展示方式不要求 API 分叉。
- Chronicle 未明确 promotion 的历史数据仍可审计，且不自动污染 River。
- P3 只转移 `milestone/moment` 的时间阅读 ownership；`highlight/bookmark` 未形成 ownership 真空，仍由 V3-primary 持有。

### Checkpoint / rollback

- **Checkpoint C3：** River read path + source actions accepted。
- 失败时撤回 River V4 入口并恢复 Chronicle SPA 为 active time owner；新 Memo/Task 数据必须继续由 canonical backend CRUD 可读，不做数据删除。

---

## 10. Phase 4 — Library Shell + Collection

### Objective

首次建立 canonical Library container/navigation，并在其中交付不依赖 Conversation/SessionAttachment 存续的长期藏品能力。P4 owns Library shell + Collection；P5 只向同一 shell 加入平级 Memory，不得重造 Library 容器。[model not supplied / R1 reviewer，Alicia approved]

### Scope boundary

- Library container/navigation 与 Collection canonical routes。
- CollectionItem 与 StoredAsset 的分离身份。
- text/image/audio/document 四类浏览、详情、Tags、搜索、最近收藏与来源追溯。
- 文件原件、preview、neutral description、canonical transcript、document extracted material 等 typed representations。
- 从**新且 provenance 可靠**的会话内容显式收藏；P4 接管新文字 bookmark write ownership。
- 旧 Chronicle highlight 只进入候选/promotion 流程，不自动批量迁移。
- 建立独立 Collection search target identity 与按 Agent type `g045` 的长期 authorization boundary；首期不连接 current `memory_search`。

### Backend handoff — B1 hard gate

B1 必须稳定提供：

- 新附件可靠 source identity 与授权读取；
- managed original root、稳定 hash、atomic copy/verification；
- CollectionItem / StoredAsset 引用关系；
- exact-byte asset reuse，但重复收藏 occurrence 不被去重；
- preview/typed derivation 状态与显式失败；
- Collection search target identity 与按 Agent type `g045`、不绑定 preset DB ID 的 authorization structure；
- 引用安全的异步 GC；
- 删除原 Conversation 后 Collection original 仍可用；
- 首期 contract 明确不接入 current `memory_search`。

### Entry gate

- P3 PASS，避免 bookmark/Chronicle ownership 交叉施工。
- B1 backend contract 与独立验收 PASS。
- Collection Browser / Item Detail mockup blocker 已冻结。
- 旧 `.webm` 不在 active scope；如需处理必须另有只读 integrity evidence 与 Alicia 明确批准。

### Exit gate

- 四种类型均可稳定展示；原件与 semantic material 在 UI 和 contract 上可区分。
- 图片 preview 不覆盖 managed original；audio transcript 缺失/失败可见。
- 相同 StoredAsset 可被多个收藏 occurrence 引用，描述与情境不被合并丢失。
- 删除 Item 不会误删仍被引用的 Asset。
- Library container/navigation 由 P4 成为 canonical owner；后续 Memory 复用该壳。
- Collection 可“带去聊天”，并具有独立 search target identity 与 `g045` authorization boundary，但尚不接 current `memory_search`。

### Checkpoint / rollback

- **Checkpoint C4：** Realtime Collection accepted。
- 失败时停用新收藏入口；已成功写入的 Item/Asset 保留可审计，不批量删除，不恢复向 Chronicle 扩张新 bookmark 语义，除非另有明确兼容决策。

---

## 11. Phase 5 — Memory Library

### Objective

用一个 canonical 管理实现接管 MemoryPlasmid 日常浏览、校准与精确 History 查找。

### Scope boundary

- 复用 P4 的 canonical Library container/navigation，加入与 Collection 平级的 Memory 区；不得另建第二套 Library shell。
- MemoryPlasmid Library、detail、Agent/scope/Tags/source/status/trigger/body filters。
- 可编辑真实允许修改的 content、scope、Tags、trigger keywords、weight。
- Trigger & Tags 管理和关联检查。
- History grep-like exact lookup：hit count、context snippets、expandable source。
- Agent Profile 的 Memory 只提供摘要与带 Agent filter 的深链，不复制管理实现。
- 不含 runtime Recall Receipt、自动反馈、自动权重优化或 Collection RAG。

### Backend handoff — B3 hard gate

B3 必须稳定提供：

- MemoryPlasmid server-side q/tag/filter/pagination；
- filter combination 与总数/游标语义；
- History exact query、total hit count、context window 与 source expansion identity；
- 编辑权限、processing transition 与错误契约。

### Entry gate

- P4 PASS。
- B3 backend contract 与独立验收 PASS。
- Library landing 与 Memory navigation mockup 已冻结。

### Exit gate

- Library 和 Agent deep link 进入同一 Memory 实现并正确应用 Agent filter。
- MemoryPlasmid、History、Project Knowledge 在名称、来源和可操作字段上不混淆。
- 搜索与组合筛选由后端执行；前端不加载全量数据伪装分页。
- 修改正文引起的 processing 状态和失败可见，不把 pending/failed 条目伪装成 ready。
- Trigger/Tag 建议不自动批量改变数据。

### Checkpoint / rollback

- **Checkpoint C5：** Memory Library accepted。
- 失败时恢复 V3 Memory 管理入口；已提交的合法编辑保持，不通过数据库回滚抹去用户修改。

---

## 12. Phase 6 — Recall Observability

### Objective

让 Alicia 能看到“当前回答实际获得了哪些自动记忆”，并提供可持久反馈与定向 Recall Lab；不把自动 recall 与主动 `memory_search` 混在一起。

### Scope boundary

- User Message 下的 Recall Receipt，绑定当前可见 Assistant answer 对应 attempt。
- injected/candidate、hit path、可解释 score/rank、rejection reason 的展示。
- `相关 / 无关 / 内容有误 / 本轮漏召回` 四类持久反馈。
- Recall Lab 的 Plasmid 检索检查；History 保持 P5 的 grep-like exact lookup。
- 主动 `memory_search` 继续作为 P1 已拥有的 `AssistantRunTrace` 中普通 ToolCall。
- P6 只增加 Recall Receipt 与 recall-specific observability，不重新设计通用 Thinking/Tool events 外壳。
- 首期反馈不自动修改 weight、Tags 或 trigger keywords。

### Backend handoff — B4 hard gate

B4 必须稳定提供：

- generation attempt identity，并关联 user message 与 current answer；
- candidate / injected structured records；
- hit path、score/rank（适用时）与 rejection reason；
- regenerate / branch 下不同 attempt 的隔离；
- feedback persistence、幂等/重复提交语义和授权边界。

### Entry gate

- P1 canonical chat PASS。
- P5 Memory Library PASS。
- B4 backend contract 与独立验收 PASS。
- Recall UI mockup 已冻结；UI 不要求 Alicia 理解内部 run ID。

### Exit gate

- 默认 Receipt 与当前可见回答 attempt 一致；regenerate/branch 不串数据。
- automatic recall 位于 User Message；active `memory_search` 位于 Assistant Run Trace。
- candidate/rejected data 缺失时显式显示 unavailable，不由前端猜测。
- 四类反馈可追溯、可重复读取，且不会静默改变 MemoryPlasmid 参数。
- Thinking、ToolCall、Recall 具有独立边界，不重新堆成巨型消息组件。

### Checkpoint / rollback

- **Checkpoint C6：** Recall observability accepted。
- 失败时关闭 Receipt/feedback exposure；Chat 与 P5 Memory Library 继续可用，已持久反馈保留审计。

---

## 13. Phase 7 — Production Cutover

### Objective

把单 SPA 设为唯一主要 Web/PWA 入口，同时完整保留 V3 rollback artifact/package 并进入观察期；本 phase 不删除 V3。[model not supplied / R1 reviewer，Alicia approved]

### Scope boundary

- production build、nginx/PWA 入口与回退路径切换。
- V3 capability matrix 不再有未解释的 `V3-primary`；deferred capability 必须有明确 owner 与可达入口。
- 保留完整 V3 package、routes、build capability 与最近 production artifact/config checkpoint。
- 保留 legacy Chronicle archive/data 与必要 migration audit。
- Council 保持 deferred；Android / Capacitor 仍属后续项目。

### Entry gate

- C2–C6 全部 PASS；如某 capability 经 Alicia 明确从 V4 首发 defer，matrix 必须记录独立 owner 与可达入口，不能假装完成。
- 所有 V4-primary capability 通过最终组合 regression。
- production deployment 与一键回切 V3 演练通过。
- 真实用户数据无 destructive migration 待执行。

### Exit gate

- 单次主要构建提供 Chat / River / Library；若 P2G 已通过则同时提供 Groups。若 Alicia 仍明确 defer Groups，V3 GroupChat owner 与可达入口必须保留并清楚标示，不得伪装为 V4 已完成。
- Settings、notifications、deep links、PWA refresh/direct-open 与错误恢复通过最终验收。
- V3 rollback artifact/package 可在约定恢复时限内重新成为入口。
- 观察期起止条件、故障阈值、回切责任和证据记录已冻结。
- 文档、API contract、启动说明与 production ownership 记录均指向 V4。

### Checkpoint / rollback

- **Checkpoint C7：** V4 production cutover + observation start。
- cutover 失败只回切前端入口与部署 artifact，不回滚或删除 P3–P6 已产生的合法数据。
- C7 不授权删除任何 V3 package/route/build surface。

---

## 14. Phase 8 — Legacy Retirement & Cleanup

### Objective

仅在 Alicia 明确结束观察期后，删除已无 capability ownership 的 V3 表面；迁移完成与删除旧实现保持两个风险等级。

### Scope boundary

- 移除已完全被 V4 接管的旧 routes、duplicate build responsibilities 与 dead packages。
- 更新 workspace、部署和文档中已失效的 V3 入口。
- 保留 legacy Chronicle archive/data、migration audit 与法律/历史上仍需的证据。
- Council retirement 不进入 P8，除非另有 Alicia 批准的独立决策。
- 不删除或重写用户业务数据。

### Entry gate

- C7 PASS 且观察期达到冻结时长。
- 观察期内没有未解决的 cutover blocker；回切记录已复盘。
- Alicia 明确批准开始 retirement，而不是由 agent 根据“看起来稳定”自行判断。
- 待删除表面逐项证明没有 production ownership、rollback hard dependency 或 deferred consumer。

### Exit gate

- V3 matrix 每项为 `V4-primary`、`Retired` 或 Alicia 明确批准的 `Deferred external owner`。
- 被删除入口已有 V4 owner，且 workspace/build/deployment 不再引用死路径。
- 最终 build/lint/regression 与 production smoke verification 通过。
- 保留项与删除项均有审计记录；Chronicle archive 和用户数据未被 destructive cleanup。

### Checkpoint / rollback

- **Checkpoint C8：** Legacy retirement accepted。
- 源码清理通过 C7 git/artifact checkpoint 可恢复；用户数据不参与 rollback。
- 任一 deferred consumer 被发现仍依赖 V3 时，停止清理并恢复对应表面，不扩大删除范围。

---

## 15. Backend handoff register

> `ExoCore-Desktop` 只写需求契约；Django 施工必须交给 `ExoCore` 仓库 agent。每个 handoff 在进入对应 phase 前另写独立 spec 至 `Plan/spec/`，再交给后端 agent；禁止把后端和前端塞进一张施工单。

| ID | Backend owner | Frontend consumer | Earliest start | Required before | Compatibility rule |
|---|---|---|---|---|---|
| **B1 Attachment provenance + Collection storage/target identity** | ExoCore | P4 | C0 后可并行 | P4 Detailed Plan freeze | 现 V3 attachment/audio 继续可用；新 managed storage 与 authorization structure additive |
| **B2 River aggregation** | ExoCore | P3 | C0 后可并行 | P3 Detailed Plan freeze | source CRUD 保持；aggregation additive |
| **B3 Memory search/filter** | ExoCore | P5 | C0 后可并行 | P5 Detailed Plan freeze | 现 Plasmid CRUD 保持；扩展查询不得破坏 V3 |
| **B4 Recall identity/observability** | ExoCore | P6 | C0 后可并行 | P6 Detailed Plan freeze | 未升级的 chat consumer 可忽略新 records；不得改变回答语义 |
| **B5 Message TTS render contract** | ExoCore | P2T | 已开始独立需求/后端设计 | P2T Detailed Plan freeze | additive message projection；文本/attachment/chat runtime 不依赖 voice 成功 |
| **B6 Assistant-message arrival contract** | ExoCore | P2D | C1 后可独立规划 | P2D Detailed Plan freeze | canonical Message write behavior preserved；`send_message`/async converge without duplicate Push or Group/Council leakage |

B6 frontend-authored backend handoff: `Plan/spec/2026-09-12-assistant-message-arrival-notification-handoff.md`. B5 source discussion currently lives in the backend requirement set and must still yield a frozen frontend-facing contract before P2T planning.

Handoff acceptance 只判断稳定接口、权限、分页/identity/error 语义与数据完整性；不要求后端 agent决定前端视觉。

---

## 16. V3 capability ownership matrix

| Capability | Current V3 owner / evidence surface | Disposition | V4 takeover | Minimum transfer condition | Rollback owner |
|---|---|---|---|---|---|
| Conversation create / recent list | chat-core | **Migrate** | P1A/C1 | Agent required、Project optional/Drift、canonical open path | V3 chat-core |
| Agent / Project filters | chat-core | **Replace UI, preserve entities** | P2 | 同一 Conversation 集合双维筛选、不复制 | V3 Agent/Profile/Project views |
| SSE streaming | chat-core Chat runtime | **Migrate** | P1B/C1 | delta/error/done 与终态完整 | V3 chat-core |
| Polling recovery | chat-core polling flow | **Migrate** | P1B/C1 | reload/disconnect 后可恢复且不重复消息 | V3 chat-core |
| Stop | chat-core | **Migrate** | P1B/C1 | running → stopped/terminal 可观察 | V3 chat-core |
| Regenerate | chat-core | **Migrate** | P1B/C1 | 保持消息与回答关联；P6 再接 attempt receipt | V3 chat-core |
| Branch | chat-core | **Migrate** | P1B/C1 | 分支目标与新会话可追溯 | V3 chat-core |
| Tool events / Thinking | chat-core message flow | **Migrate + repartition UI** | P1D/C1 | P1 owns canonical `AssistantRunTrace`；顺序、状态、错误不丢；主动 memory_search 仍是 ToolCall | V3 chat-core |
| Attachments | chat-core compose/message | **Migrate**；P4 扩展收藏 | P1C/C1 | 上传部分成功/失败、删除、消息显示行为等价 | V3 chat-core |
| Audio record/upload/play/recovery | chat-core audio surfaces | **Migrate** | P1C/C1 | 录音、目标校验、恢复、播放与显式错误等价 | V3 chat-core |
| Cache | chat-core controls | **Migrate** | P1D/C1 | 状态、renew/delete 与进度/错误可见 | V3 chat-core |
| Endpoint / model / thinking level | chat-core controls | **Migrate** | P1D/C1 | 当前会话目标选择及错误语义保持 | V3 chat-core |
| Private memory toggle | chat-core controls | **Migrate** | P1D/C1 | 请求语义与显示状态保持 | V3 chat-core |
| Session history control | chat-core controls | **Migrate** | P1D/C1 | 历史开关/窗口行为保持 | V3 chat-core |
| Aura / conversation现场主题 | chat-core chat surface | **Migrate** | P1D/C1 | 作为 chat-local capability，不降级为全局低频设置 | V3 chat-core |
| Project files in chat | chat-core drawer/header | **Migrate** | P1D/C1 | chat-local 文件访问保持 | V3 chat-core |
| Project workspace files/knowledge | chat-core Project views | **Migrate** | P2 | workspace 与 chat 引用同一事实来源 | V3 Project views |
| Agent Hub / Profile | chat-core | **Replace within canonical Chat area** | P2 | 身份、Prompt、会话入口、Memory deep link 保持 | V3 Agent views |
| Project Hub / Detail | chat-core | **Replace within canonical Chat area** | P2 | 项目详情、会话、files/knowledge 入口保持 | V3 Project views |
| Message TTS playback | 无 V4 owner；后端 B5 建设中 | **Add thin message-level consumer** | P2T/C2 | lazy render、真实 render 状态、播放时间轴、single-owner playback、failure isolation、no autoplay | Disable voice control；canonical text remains |
| GroupChat | chat-core Groupchat views | **Defer, later migrate with separate runtime** | P2G（未排期） | list/create/room/send/broadcast/recovery 不伪装普通 chat | V3 Groupchat views |
| Assistant-message arrival / push UI | chat-core + chronicle duplicate surfaces；V3 `send_message` direct Push | **Replace with one canonical Message-arrival owner** | P2D/C2 | exact-active foreground reconcile；other-visible unread；background one Push；typed canonical deeplink；deduplicated | V3 duplicate providers/panels + current send_message path |
| Settings | chat-core | **Migrate with contract preservation** | P2C/C2 | 现有效设置全部可达；不顺手重写 backend | V3 Settings |
| User/Profile shell entry | chat-core | **Migrate** | P2C/C2 | 账号/头像/More 稳定可达 | V3 User view |
| Timeline/Tweet → Memo candidate | chronicle Timeline | **Replace after source decision** | P3 | 低摩擦创建、Tags、reply tree | V3 Timeline |
| Task CRUD/actions | chronicle | **Migrate** | P3 | create/edit/complete/defer 与错误状态可靠 | V3 Task views |
| Calendar | chronicle | **Migrate as companion view** | P3 | 不复制 Task source | V3 Calendar |
| Heartbeat final summary | chat-core AgentMemory / backend ledger surfaces | **Project into River; retain ledger** | P3 | summary 与 technical ledger 分离且可追溯 | V3 ledger surface |
| Diary | backend/domain existing surface | **Add canonical River read path** | P3 | preview/full read 同一 canonical content | Existing backend/read path |
| Chronicle milestone/moment | chronicle | **Replace active time-reading UI; retain legacy source/archive** | P3/P8 | P3 转移时间阅读；archive 持续可审计；P8 才可清理旧表面 | V3 Chronicle |
| Chronicle highlight/bookmark | chat-core → Chronicle | **Keep V3 through P3; replace new writes with Collection** | P4 | P3 无 ownership 真空；P4 新收藏写 Collection；旧数据仅 candidate | V3 highlight read/write path |
| Library container/navigation | 无 canonical V3 owner | **New shared shell** | P4 | P4 owns container/routes；P5 复用而不重建 | Disable V4 Library exposure |
| Collection | 无稳定 V3 owner | **New capability** | P4 | B1 data integrity + four-type browser + target identity + `g045` agent-type authorization | Disable V4 Collection exposure |
| MemoryPlasmid management | chat-core AgentMemory/MemoryConsole（语义不完整） | **Replace inside P4 Library shell** | P5 | filters/edit/status/deep link 完整；不复制 Library 容器 | V3 memory surfaces |
| History exact lookup | V3 HistoryChunk management | **Replace UX, preserve source** | P5 | grep-like count/context/expand | V3 History surface |
| Automatic recall receipt/feedback | 无合格 V3 owner | **New capability** | P6 | B4 attempt identity + feedback persistence | Disable receipt exposure |
| Active `memory_search` ToolCall | chat-core tool event | **Migrate, not merge with auto recall** | P1D/C1；P6 verify | 始终保留普通 ToolCall 语义 | V3 chat-core |
| Council | council stub / backend separate | **Defer** | 未排期 | Alicia 独立决策 | Existing council baseline |
| Android / Capacitor | 无 | **Defer** | 未排期 | 独立 platform plan | Web/PWA |

---

## 17. Phase-plan release rule

Detailed Plan 的发布顺序严格为：

```text
C0 PASS  → 只写 P1A Detailed Plan
C1A PASS → 只写 P1B Detailed Plan
C1B PASS → 只写 P1C Detailed Plan
C1C PASS → 只写 P1D Detailed Plan
C1D PASS → 执行统一 C1 Chat ownership acceptance
C1 PASS  → 才允许写 P2A Detailed Plan
P2A PASS → 才允许写 P2B Detailed Plan
P2B PASS + B5 PASS → 才允许写 P2T Detailed Plan
P2T PASS → 才允许写 P2C Detailed Plan
P2C PASS + B6 PASS → 才允许写 P2D Detailed Plan
P2D PASS → 执行统一 Core C2 acceptance
C2 PASS + B2 PASS → 才允许写 P3 Detailed Plan
P2G 仅由 Alicia 以后单独释放；不作为 C2/P3 前置，且不得与其他 shell/navigation construction 并发
C3 PASS + B1 PASS → 才允许写 P4 Detailed Plan
C4 PASS + B3 PASS → 才允许写 P5 Detailed Plan
C5 PASS + B4 PASS → 才允许写 P6 Detailed Plan
C6 PASS → 才允许写 P7 Cutover Plan
C7 PASS + 观察期结束 + Alicia 批准 → 才允许写 P8 Retirement Plan
```

若后端 gate 提前完成，可以先验收和冻结 contract，但不得提前写未来 React 文件级步骤。每份 Detailed Plan 只携带当前 phase 或 P1 sub-gate 实际接管的 capability 子矩阵。

---

## 18. Adversarial razor / Ablation Study

Roadmap handoff 前按 acceptance scope 做消融：

### 保留

- 新 V4 package：它提供 V3 side-by-side rollback，是结构性重构的必要隔离。
- P1 保留统一 Chat ownership gate，但以 P1A–P1D 小批施工：既防能力静默丢失，也防 Detailed Plan 巨型化。
- B1–B6 独立 gate：它们分别解决数据完整性、跨源分页、服务端检索、attempt identity、voice render 与 assistant-message arrival，均不能由前端可靠补造。
- P7 只做 cutover、P8 才做 retirement：迁移完成与删除旧入口不是同一个风险等级。

### 删除 / 拒绝进入 active scope

- 为未来规模预建 Conversation server filtering：R2 尚无 blocker 证据。
- 新 repo、SSR、Zustand、Capacitor、原生推送重做：当前 acceptance 不需要。
- legacy attachment inbox、全量附件迁移、`.webm 001` 自动封存：provenance 不足且 Alicia 已明确后置。
- Collection → current `memory_search` retrieval wiring、embedding 升级、主观图片点评、随机浏览：均不阻塞 Collection 首期；P4 仍必须建立 target identity 与 `g045` authorization boundary。
- 自动 feedback 调权、自动 Tag 合并、History semantic ranking：超出冻结目标。
- destructive Chronicle cleanup 与 Council retirement：必须另行批准。
- Phase 2 以后源码文件预测：在未来源码与后端契约未就绪时属于脆弱猜测。
- Push 到达后自动 TTS/自动播放、Live API、主动电话：都不需要满足当前“点按生成并播放”与消息提醒目标。
- 为 foreground refresh 预先指定 WebSocket、SSE 或数据库 signal：Roadmap 只冻结 observable contract；B6 来源核对后选择最小完整机制。
- 在 Conversation arrival 已成为统一事实后继续保留 `send_message` 专属 direct-Push 平行通道：会制造重复消息/通知，必须被统一机制承接而不是共存。
- 因“不急用”直接删除 GroupChat 或把未施工状态计入 C2 PASS：前者破坏回退，后者是假验收；正确处置是 P2G deferred + V3-primary。

**Razor conclusion：** P2T 是薄前端对已规划 backend artifact 的必要消费面；P2C 是 P2D 单一 shell owner 的前置；P2D 以 Message arrival 收敛现有重复/漏刷行为。Groups 不阻塞当前价值链，故从 Core C2 predecessor 中消融但保留明确 owner。无需 Capacitor、Live/电话、自动朗读或预选实时传输技术。

---

## 19. Master Roadmap acceptance

本 Roadmap 可冻结，当且仅当 Alicia 确认：

- [x] phase 顺序和边界可接受；P2T → P2C → P2D，P2G independently deferred；
- [x] B1–B6 是独立 backend handoff，不与前端施工混单；
- [x] P1A–P1D 已完成，只有统一 C1 转移了 Chat ownership；
- [x] V3 capability matrix 保留所有未转移 owner；GroupChat 明确留在 V3-primary；
- [x] P3 不提前接管 highlight/bookmark；P4 才把新 bookmark writes 转给 Collection；
- [x] P4 owns Library shell，P5 复用；P1 owns `AssistantRunTrace`，P6 只扩展 recall；
- [x] P7 cutover 后 V3 保持完整 rollback reference；只有 P8 可受控清理；
- [x] 后续仍不在 backend contract/上游 gate 前提前写源码级计划；
- [x] TTS/notification active scope 与 Groups/Live/电话/Capacitor deferred scope 已分离。

**Current release position:** P2A/P2B 已独立验收；待 P2B 文件收尾后，下一份允许起草的源码级施工计划只有 **P2T Detailed Plan**，且必须等待 B5 frontend contract freeze。P2C、P2D、P3 与 P2G 不自动获准。
