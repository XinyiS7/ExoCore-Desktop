# V4 Phase 1A — App Shell Navigation Decision (D1)

> **Document type:** D1 entry-gate decision record（P1A Detailed Plan §3 / §9 Task 1 产物）。
> **Status:** **D1 PASS / FROZEN** — Alicia approved `D-A + M1 + X1 + C1` on 2026-09-02; P1A product-source construction is unlocked.
> **Repositories:** `ExoCore-Desktop`（decision record only; no frozen upstream Spec was modified）。
> **Baselines:** Desktop `f48b4fe`（C0 checkpoint）；outer `8836cf4`。
> **Product authority:** Alicia。**Plan/架构:** `[gpt-5.6-sol / Solaire]`。**Decision 记录整理:** `[deepseek-v4-flash / Ecki] — 2026-09-02`。

---

## 1. 为什么需要这份记录（矛盾澄清）

`V4_Master_Implementation_Roadmap.md` §7 Dependencies 声称「App Shell 低保真原型已冻结移动导航和 More 的表现；不得改变 canonical IA」，但权威输入文档实际仍留空：

| 来源 | 原文（verbatim） | 状态 |
|---|---|---|
| `V4_Spec_Freeze_Index.md` §11 | "mobile bottom bar 的具体四项与 More 交互" | 仍允许后置 |
| `V4_Page_Skeleton.md` 后置决策表 | "移动端底栏最终四项与 More 交互 \| App Shell 原型验收前" | PENDING |
| `V4_Frontend_Refactor_Decision_Questionnaire.md` Q19 | "[X] D. 现在不冻结；等 App Shell 低保真原型比较后定。"（Alicia 空） | 已选"后置" |
| `ExoCore_V4_Single_SPA_Architecture_Spec.md` §9.2 | "移动端底栏不在 Spec 阶段机械等同于四个产品区域。App Shell 低保真原型应比较：直接展示 `Chat / Groups / River / Library`，或在小屏用其中一项换成 More / 对象快捷入口。" | 待比较 |

**本文档即该"低保真原型比较"的决策载体**：兑现 Roadmap 未兑现的冻结声明，但不修改任何 frozen 文档。它只冻结 P1A Detailed Plan §3.2 列出的五项呈现结构；**不冻结任何像素、色彩、字体、动效**（视觉属于 mockup，仍在 P1A 之外）。

---

## 2. 不变量（任何候选都不得违反）

来自 frozen authority，本文档无权改变：

1. **canonical product areas 恒为 `Chat / Groups / River / Library`**（Arch §5.1；Spec Freeze Index §4.1；Questionnaire Q1-A [X]）。
2. **Agent / Project 是 Chat 板块内的高频索引入口，不是一级产品区**（Arch §9.1）。
3. **Settings 从头像 / More 稳定可达，但不占一级产品槽位**（Arch §5.1 / §9.1；Page Skeleton §0）。
4. **桌面与移动端必须进入同一组 canonical routes，共享同一套领域页面实现**（Arch §5.1 / §9.1 / §13-1；P1A Plan §5.4）。
5. **进入具体 Chat 后，消息区不得被常驻移动底栏挤压**（Roadmap §7 exit gate；Arch §9.1「应允许隐藏移动端底栏」）。
6. **移动端底栏只是响应式呈现，不得反向修改 canonical IA**（Spec Freeze Index；Q19 决议 D）。
7. **P1A 只有 Chat 可用；未来区必须 visibly unavailable（禁用+可理解），不得路由到看似完整的空页面**（P1A Plan §4.3 / Task 4.3）。

---

## 3. V3 行为证据（对照用，不是照抄对象）

V3 chat-core（`packages/chat-core`，只读观察）：

- **桌面**：`DesktopSidebar` = 左侧 64px 竖向文字侧栏（vertical-rl 旋转文字标签）。
- **移动**：`MobileBottomBar` 五项 = `首页 / 项目 / 代理 / 群组 / 设置`（对象 hub 与系统项混排）。
- **关键先例**：`App.jsx` 中 `hideBottomBar = pathname.startsWith('/chat/') || pathname.startsWith('/groupchat/')` —— **进入 Chat 详情即隐藏底栏**，main 去 `pb-[60px]`，消息区获得全高；配合 `MobileHeader` 统一返回头。
- `MobileSidebar`（左侧图标 rail）已无任何引用 = 死代码（不复制）。

→ V3 已经实践「详情页隐藏底栏 + 顶返回头」；V4 冻结方向（不变量 5）与之一致，D1 的候选应以此为基线做结构比较，而非重新发明。

---

## 4. 候选比较

### 4.1 桌面一级导航呈现

**D-A — 固定左侧栏（icon + label）**（推荐）

```text
┌──────┬──────────────────────────────────────────────┐
│ ◆    │ Chat Home                          [+ 新建] │  ← 页顶动作（右侧）
│ 💬 Chat        ● (enabled, P1A)                     │
│ 👥 Groups      ○ disabled · P2      │ 内容区       │
│ 🌊 River       ○ disabled · P3      │              │
│ 📚 Library     ○ disabled · P4/P5   │              │
│ ────────                            │              │
│ ◎ 头像/More ▼  ← 系统溢出菜单（见 §6）│              │
└──────┴──────────────────────────────────────────────┘
```

- 四大区行 = 同一 IA 的直接投影；行内嵌 phase 徽标 + 语义 disabled（可读、不可激活）。
- 底部头像 = More 入口（Settings 等，不占产品槽）。

**D-B — 窄 icon rail（64px，无文字）**

```text
┌──┬─────────────────────────────┐
│◆ │ Chat Home         [+ 新建]  │
│💬│                             │
│👥│   icon-only rail            │
│🌊│   (hover tooltip 显示 label) │
│📚│                             │
│◎ │                             │
└──┴─────────────────────────────┘
```

- 结构等价 D-A，只是省横向空间；代价：无 label 时四大区可发现性下降，disabled 徽标只能放 tooltip。
- 与 V4 自身多产品区长期共存的目标不符（V3 死代码 rail 是反例）。

**D-C — 顶部一级 tab**

```text
┌──────────────────────────────────────────┐
│ Chat │ Groups │ River │ Library    [🔍][+]│
├──────────────────────────────────────────┤
│ 内容区（顶栏被一级导航占满）              │
```

- 一级区与页顶动作（返回/新建/搜索/账号）竞争同一行；Chat 消息页纵向空间被挤压；宽屏下切换成本高于侧栏。

**比较**（低/中/高 = 定性，非视觉评分）

| 候选 | IA 一致性 | 未来区解锁时 | P1A 施工量 | 结构稳定期 |
|---|---|---|---|---|
| D-A | 高 | 仅翻转 enabled | 中 | 到 P7 cutover 无需返工 |
| D-B | 中 | 同 D-A + 需补 label 呈现 | 中 | 同 D-A，但可发现性长期低 |
| D-C | 中 | 同 D-A | 低 | 顶栏拥挤，后期易返工 |

**推荐：D-A**（理由见 §7 组合论证）。

---

### 4.2 移动底栏（Arch §9.2 指定的比较面）

**M1 — 四项直列 `Chat / Groups / River / Library`**

```text
┌─────────────────────────────────────────────┐
│                (页面内容区)                  │
├─────────────────────────────────────────────┤
│  💬 Chat   👥 Groups   🌊 River   📚 Library │
│  ● active  ○ P2       ○ P3       ○ P4/P5    │  ← 固定 4 槽
└─────────────────────────────────────────────┘
```

- 与桌面 D-A 及 canonical IA 完全同构：**一套导航数据、两种投影**（Task 4.2 data-driven 的直接形态）。
- Groups/River/Library 分别带 phase 徽标 + 语义 disabled，解锁时只翻转 enabled，**槽位永不重组**。
- More 不进底栏（头像菜单承载系统项，见 §6）。

**M2 — 三区 + More（一项降级进 More）**

```text
┌─────────────────────────────────────────────┐
│  💬 Chat   👥 Groups   🌊 River   ⋯ More    │  ← Library 降级
└─────────────────────────────────────────────┘
   子变体 M2a: Library → More（解锁最晚 P4/P5，但它是"长期保留"重区）
   子变体 M2b: Groups → More（块最小 2 页，但 P2 即解锁 → 升格 = 导航变两次）
```

- 满足 §9.2 的「用其中一项换成 More」分支，但一级区降格进溢出菜单 = 可发现性损失；大区解锁时要么永久留在 More（与「Library 是重区」矛盾），要么执行一次升格导航重组（每个 phase 改一次底栏）。

**M3 — 对象快捷参与（Questionnaire Q19-B/C 旧形态）**

```text
┌─────────────────────────────────────────────┐
│  💬 Chat   🤖 Agents   📁 Projects  🌊 River │  ← Groups+Library 进 More/Home
└─────────────────────────────────────────────┘
```

- 与 Arch §9.1「Agent / Project 是 Chat 内高频索引入口」的产品定位冲突：对象入口的 canonical 位置在 **Chat 板块内部**（P2 的 Chat 次级导航），不是一级区。
- Agent Hub / Project Hub 本身 P2 才迁移 → P1A 底栏 4 槽将 **3 disabled**（Agents/Projects/River），可用性最差。
- Q19 决议 D 已明确「底栏不应反过来绑死 IA」——M3 恰恰让底栏反推 Chat 板块结构。

**比较**

| 候选 | IA 一致性 | P1A 可用槽 | 解锁时槽位变动 | 可发现性 |
|---|---|---|---|---|
| M1 | 高（直投影） | 1/4 enabled（3 带 phase 徽标） | 零（只翻 enabled） | 高且恒定 |
| M2 | 中（一项降格） | 1/4 | 每次升格重组 1 次 → 2 次变动 | 降级项低 |
| M3 | 低（对象反推板块） | 1/4（且 P2 前两个槽纯摆设） | P2 后需重组 | 对象项误导 |

**推荐：M1。**

---

### 4.3 小屏进入 canonical Chat 的行为（`/chat/:conversationId`）

**C1 — 隐藏底栏 + 顶返回头 + 100dvh 消息区**（推荐）

```text
进入 /chat/123 后：
┌──────────────────────────────┐
│ ‹ Chat Home        123 · 标题 │ ← MobileHeader 返回头（确定性 back → Chat Home）
│                              │
│        消息流（独占全高）      │   ← 底栏已隐藏（V3 同构先例）
│                              │
└──────────────────────────────┘
```

- 满足 Roadmap exit gate「不被常驻底栏挤压」与 Arch §9.1；V3 已在 `/chat/` 实践同规则。
- 返回目标：导航来源（Recent）或直接链接默认 → Chat Home（P1A Plan §5.4 已冻结）。

**C2 — 保留常驻底栏（不隐藏）** → 直接违反不变量 5，排除。

**C3 — 滚动自动隐藏/下拉唤出**：结构上与 C1 相同（都是"非挤压"），只是唤出动效；属视觉/motion 细节，后置 mockup，D1 不冻结。

**推荐：C1**（行为冻结为「详情全高 + 返回头」；C3 式动效留待 mockup 视觉阶段）。

---

### 4.4 桌面与移动同 routes / 同实现确认

- 四种组合候选均基于同一张路由表：`/`（Chat Home）、`/chat/:conversationId`（canonical detail）、wildcard → not-found。
- 桌面/移动只切换**导航投影组件**（sidebar ↔ bottom bar），路由组件零复制（Arch §9.1 / P1A Plan Task 4.2 data-driven 导航）。
- D1 冻结结论：**桌面与移动共享同一组 canonical routes 与页面实现**——四个候选全部满足，此项无分歧，仅作确认记录。

---

## 5. 未来 / 未迁移目标的可见禁用清单（随推荐组合生效）

所有 `disabled` 条目满足：可见、可读、语义 disabled（不可激活、无空页面路由）、带 phase 徽标；aria 可感知（P1A §17.4 semantic disabled treatment）。解锁节奏 = Roadmap §5 phase 表。

| 目标（V4 呈现） | 一级归属 | 解锁 phase | P1A 中呈现 |
|---|---|---|---|
| Groups 列表/房间 | 底栏/侧栏 Groups 槽 | P2 | disabled + `P2` 徽标 |
| Agent Hub / Agent Profile | Chat 板块内次级导航 | P2 | 不呈现（Chat 内部导航属 P2 planning；P1A Chat Home 只有 Recent + 新建） |
| Project Hub / Project Detail | Chat 板块内次级导航 | P2 | 同上 |
| Settings 中心 / Notifications / User Profile | More（头像菜单） | P2 | disabled + `P2` 徽标 |
| River（Memo/Diary/Heartbeat/Task/legacy） | 底栏/侧栏 River 槽 | P3 | disabled + `P3` 徽标 |
| Library（Collection） | 底栏/侧栏 Library 槽 | P4 | disabled + `P4` 徽标 |
| Library（MemoryPlasmid/Recall Lab） | 同 Library 槽 | P5 | disabled（P4 解锁后仍 P5 徽标，槽位不变） |

> 禁用而非隐藏的理由：四大产品区是 V4 的长期契约面（Roadmap capability matrix 冻结行），P1A 起就建立「这四块都在、其余逐步点亮」的壳形态，避免 P7 cutover 时导航突然长出新结构。任何条目被点击只产生"暂未开放"的可理解反馈（如 disabled 语义 + 徽标），**绝不路由到空页面**。

---

## 6. More 的落点与内容（随推荐组合生效）

**X1 — 统一头像/账号溢出菜单（推荐）**

```text
Desktop：侧栏底部 ◎ 头像        Mobile：页顶 ◎ 头像（Chat Home 顶栏）
              ▼ 菜单                            ▼ 菜单
        ┌──────────────────┐          ┌──────────────────┐
        │ ◎ 账号 / Profile  ○ P2 │          │ ◎ 账号 / Profile  ○ P2 │
        │ ⚙ 设置中心        ○ P2 │          │ ⚙ 设置中心        ○ P2 │
        │ 🔔 通知           ○ P2 │          │ 🔔 通知           ○ P2 │
        └──────────────────┘          └──────────────────┘
```

- More = 系统/账号级溢出入口（Settings 的 canonical 家），与 Page Skeleton「Settings 从头像 / More 稳定可达但不占一级槽」一致。
- P1A 中菜单项全部 disabled + phase 徽标（不伪装可用）；P2 解锁后逐项点亮。
- 一级产品区（Groups/River/Library）**不**进 More——它们在底栏/侧栏有槽（M1/D-A），More 不重复。

**X2 — 底栏独立 More 槽**：仅在 M2 下成立；若采用 M1 无此需要（More 槽会挤掉一个一级区，回到 M2 的缺陷）。

**X3 — 无 More、Settings 独立入口**：违反不变量 3（Settings 占一级/高频槽），排除。

**推荐：X1。**

---

## 7. 推荐组合 R = D-A + M1 + X1 + C1

**联动论证：**

1. **一套导航数据模型**：四大区（id/label/icon/route/phase/enabled）= 唯一事实；desktop sidebar 与 mobile bottom bar 都是它的投影（Task 4.2 直接受益，零重复路由逻辑）。
2. **解锁 = 翻 enabled**：P2（Groups + More 系统项）→ P3（River）→ P4/P5（Library）逐个点亮，槽位/结构/位置零变动——每个 phase 验收不需要动 shell 导航。
3. **诚实呈现**：P1A 壳即展示最终 4 区结构（3 区 disabled 带徽标），不出现"以后会长出新的导航"的意外；More 只放系统项，语义单一。
4. **Chat 全高**：C1 保证 canonical 详情不被任何常驻底栏挤压（Roadmap exit gate 的直接满足），且 V3 已有同构行为先例可对照验收。
5. **Q19 决议尊重**：底栏是呈现，不反向绑死 IA——M1 是 IA 的直投影，最不"绑死"。

**P1A 施工映射（Task 4 / 12 落地时）**：

- `shell/`：nav 数据 = `[{id:'chat',…enabled:true},{groups,phase:'P2'},{river,phase:'P3'},{library,phase:'P4/P5'}]`；`PrimaryNavigation` desktop 侧栏 + mobile 底栏两投影；detail 路由命中时 mobile 投影卸载（C1）。
- Chat Home 顶栏：`[+ 新建]`（P1A create 入口）+ `◎ 头像/More`；无搜索入口（搜索随 P2 出现，P1A 不造 disabled 空壳）。
- 禁用条目：`aria-disabled` + phase 徽标，无路由、无可聚焦激活；键盘可达性保证 disabled 状态可读（§17.4）。

---

## 8. 决策记录（Alicia 填写）

- **候选**：桌面 D-A / D-B / D-C；移动 M1 / M2a / M2b / M3；More X1 / X2 / X3；小屏 Chat C1 / C3。
- **推荐组合**：D-A + M1 + X1 + C1（见 §7 论证）。
- **可接受的替代组合**：任何「不变量 §2」保持的组合均可施工（例如桌面 D-B + 移动 M1 + X1 + C1 只在侧栏宽度上不同）。

> **[Alicia / approved] `D-A + M1 + X1 + C1` — 2026-09-02**

Decision effect:
- This record is `FROZEN`; P1A Detailed Plan §3.3 D1 gate is PASS.
- `packages/app` product-source construction is unlocked from Task 2 onward.
- Any later change to this combination requires Alicia's explicit revision and invalidates the affected shell/responsive acceptance evidence.

---

## 9. 变更清单与本记录边界

**Changed files（本检查点）：**

| 文件 | 动作 |
|---|---|
| `Plan/V4_Phase_1A_App_Shell_Navigation_Decision.md`（本文档） | Created（D1 decision record，P1A Plan §7.1 列表内文件） |

**未变更（声明）：** P1A Detailed Plan、7 份 frozen spec/roadmap 文档、C0 baseline artifacts、ReactSheet.md、任何 `packages/*` 源码、`../ExoCore/`、outer `Nginx/hybrid_start.ps1`、`pnpm-workspace.yaml`。无 commit；无 `packages/app`。

**Visual boundary：** 本文档不含任何色彩/字体/间距/动效决策；ASCII 图仅为结构示意。视觉全部属于 mockup 阶段（Page Skeleton 已列 App Shell 为第一张 mockup）。

---

*Decision 记录整理：deepseek-v4-flash / Ecki — 2026-09-02*
*Authority 冻结：gpt-5.6-sol / Solaire（Arch §9.2 比较面）、Alicia（Q1-A / Q19-D / C0 approval / D1 `D-A + M1 + X1 + C1` approval）*
