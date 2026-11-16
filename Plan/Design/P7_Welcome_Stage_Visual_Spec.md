# P7 欢迎页舞台 · 视觉与结构规格（草案）

> **状态：** Draft，P7 方案的视觉附件；未冻结、未施工。
> **整理：** [claude-opus-5-5 / 砚]，依据 Alicia 2026-10-28 讨论决定。
> **参考：** 同目录 `DUAL_STAGE_HOMEPAGE_WIREFRAME.md`、`DUAL_STAGE_MOCKUP.html`（阿莱原稿，保留不改）；索哥 ChatGPT 讨论中的分层原型与组件架构说明（外部，未入库）。
> **本文件覆盖原稿的部分：** 原稿的 35/65 分栏、5 祭坛 + 3 Hub、Dark/Light 同一主题亮暗互换、固定合成背景 + 透明热区，均以本文件为准。

---

## 1. 已定决策

| # | 决策 |
|---|---|
| D1 | 欢迎页是恒定 16:9 横向舞台；手机竖屏高度撑满、原生横向滚动，不缩放、不重排、不折叠为卡片。 |
| D2 | 舞台分层：背景、物件、遮挡、氛围各自独立；**可交互物件不得画进背景图**（clean plate）。 |
| D3 | 构图取猎人工坊**偏左主视角**：后方高台建筑，右侧弧形楼梯自建筑弯下，左侧祭坛沿上升弧线排到建筑左侧，中间前庭留空。画面**左长右短**。 |
| D4 | 右侧楼梯四个主板块：Agents / Projects / River / Library，纵向基本等距、轻微弧度、缩放差异小。 |
| D5 | 左侧共 5 座祭坛：1 座新对话 + 4 个最近会话。新对话为最左下角的矮金杯祭坛，贴近画角、不是视觉焦点；**最新会话**是第二座，近且稍高，是左侧焦点；其余按由近到远排列，纵向缩放明显。 |
| D6 | 后方工坊/剧院建筑是 Settings 入口（点建筑入口区域进入）。 |
| D7 | register 管理是 Agent Profile 的二级入口，不上欢迎页。 |
| D8 | 月亮/太阳当前**不交互**，仅为装饰。 |
| D9 | 中庭预留 `StageResident` 位置，P7 不实现。 |
| D10 | 主题模型见 §6：默认主题可切亮暗；视觉主题包单一色调、无亮暗开关、作用于全应用，各自适配主题图。 |
| D11 | 背景图与互动组件图由 Alicia 提供（Gemini / GPT 出图 + 自有素材包）；本规格只约束导出格式与锚点。 |
| D12 | 本期只做 Bloodborne 主题的舞台美术；Enotria 与默认主题剪影版之后再做。 |
| D13 | 不另设 HUD 入口：Account、通知等全局设置都在现有 Settings 页内，从建筑进入。HUD 只放品牌和状态等非导航信息。 |
| D14 | Agent Profile 重新设计（含 Memory 管理：G045 → register；Standard → 记忆文件）作为 P7 之后的独立 phase。P7 的 Resonance Bell 入口直接链接到现有 V4 Agent Hub/Profile（当前是毛坯）；V3 与 V4 内容不同，不做深链。 |
| D15 | 默认主题剪影：由 Alicia 用 GPT 出一张舞台线稿。这张线稿同时作为**结构蓝图**，之后各主题出图都对照它摆放。 |

---

## 2. 构图示意（1600 × 900 逻辑坐标）

```
 0                                  800                                1600
 +---------------------------------------------------------------------+ 0
 |   (月/日·装饰)                                                         |
 |                                  ▲▲ 高台建筑 ▲▲                        |
 |                               ┌──────────────┐                         |
 |                               │  [Settings]  │╲  弧形楼梯              |
 |                    ◦ s4       └──────────────┘  ╲   ◇ hub1             |
 |               ◦ s3                     (中庭)      ╲   ◇ hub2           |
 |         ○ s2                         [Resident]     ╲   ◇ hub3          |
 |   ● s1 (最新·焦点)                    (P7 留空)        ╲  ◇ hub4         |
 | ■ new                                                                  |
 +---------------------------------------------------------------------+ 900
   ← 左侧：跨度长、纵深陡 →        ← 中 →            ← 右侧：跨度短、纵深缓 →
```

---

## 3. 分层（后 → 前）

| 层 | 名称 | 内容 | 交互 | 备注 |
|---|---|---|---|---|
| L0 | Sky | 天空、星/云、月/日 | 无 | 月/日为装饰（D8） |
| L1 | Architecture | 高台建筑远景 | 建筑入口区 → Settings | 只有锚点表里的入口区可点，不是整张建筑图 |
| L2 | Ground | 高台、楼梯主体、道路、地面 | 无 | |
| L3 | Objects | 祭坛 ×5、板块入口 ×4 | 各自独立 `<button>` / `<a>` | 组内按 y 排序，近者在上 |
| L4 | Resident | 中庭住民 | — | P7 预留空容器 |
| L5 | Occlusion | 栏杆前沿、台阶边、花丛 | `pointer-events:none` | 可插入 L3 物件之间 |
| L6 | Atmosphere | 雾、花瓣、光尘 | `pointer-events:none` | |
| L7 | Post | 暗角、颗粒、统一色调 | `pointer-events:none` | |
| HUD | Screen-fixed | 品牌、状态等 | 是 | 固定于屏幕，不随舞台滚动/视差 |

**实现路线：** DOM/CSS 分层（透明 WebP + CSS transform），不使用 Three.js/PixiJS。理由：入口必须是语义按钮并走 React Router、键盘焦点与读屏可用、手机原生横滑不与 canvas 抢事件。将来 `StageResident` 需要骨骼/纸偶动画时，可单独以 canvas/Rive 组件嵌入 L4，不影响其余层。

---

## 4. 锚点表（初版坐标，待素材到位后校准）

坐标为舞台比例（0–1），锚点为物件**底部中心**；`scale` 为相对基准尺寸的深度缩放。切换主题包不得修改本表。

### 4.1 左侧祭坛（纵深陡）

| slot | 语义 | x | y | scale | 说明 |
|---|---|---|---|---|---|
| `altar.new` | 新对话（矮金杯） | 0.06 | 0.97 | 1.00 | 贴左下角，可部分出画；不是焦点 |
| `altar.recent.1` | 最新会话 | 0.17 | 0.84 | 0.86 | **左侧焦点**：近且稍高 |
| `altar.recent.2` | 第 2 近 | 0.26 | 0.73 | 0.66 | |
| `altar.recent.3` | 第 3 近 | 0.33 | 0.645 | 0.52 | |
| `altar.recent.4` | 第 4 近 | 0.39 | 0.585 | 0.42 | 接近建筑左侧 |

### 4.2 右侧楼梯板块（纵向等距、轻弧、缩放平缓）

| slot | 板块 | Bloodborne 物件 | x | y | scale |
|---|---|---|---|---|---|
| `hub.1`（最高/最远） | River | Astral Clocktower | 0.74 | 0.60 | 0.66 |
| `hub.2` | Library（Collection） | Abandoned Workshop | 0.80 | 0.69 | 0.72 |
| `hub.3` | Agent Hub | Resonance Bell | 0.85 | 0.79 | 0.78 |
| `hub.4`（最低/最近） | Project Hub | Lecture Building | 0.89 | 0.90 | 0.84 |

### 4.3 其他

| slot | 区域 | 说明 |
|---|---|---|
| `building.settings` | x 0.53–0.63, y 0.36–0.56 | 建筑大门/台阶口；具体按底图校准 |
| `celestial` | 中心 x 0.20, y 0.20 | 装饰，无交互 |
| `resident.zone` | 中心 x 0.52, y 0.78 | P7 留空 |

---

## 5. 交互与数据

- 每个物件自己处理 hover / focus / active，只亮起自身，不整图闪烁；悬停时只有画面上浮，点击区不动。
- 视差（仅 `pointer:fine` 且未开启 reduced-motion）只移动 L0–L2 画面，不移动 L3 点击区。
- 铭牌：桌面端在 hover/focus 时显示；触屏（`pointer:coarse`）无 hover，铭牌常显，单击即进入。
- 最近会话不足 4 个时，空祭坛显示为沉寂态、不可点，不伪造会话 ID。
- 最近会话的数据来源与排序字段在 P7 Plan 中 trace，本文件不预设。
- 主题包只影响外观（图片、铭牌文案、色彩），不影响 route 与 slot。

### 手机横滑

- 390×844 时舞台宽约 1500px。设三个 scroll-snap 停靠点：**左（默认）**、中（建筑/中庭）、右（楼梯）。
- 默认停在最左：新对话与最新会话都在首屏内。
- 验收：从最左滑到最右，hub.4 可点；任何位置都没有被裁掉、滑不到的内容。

---

## 6. 主题模型

| 主题 | 亮/暗 | 欢迎页舞台 |
|---|---|---|
| 默认主题（无主题包） | 可切换 | 中性剪影：SVG 简化轮廓，颜色跟随亮暗 token |
| Bloodborne 主题包 | 固定（夜） | Hunter's Dream 主题图 |
| Enotria 主题包 | 固定（日） | 日光剧院主题图 |

- 视觉主题包没有亮暗开关；启用主题包时，Settings 的亮暗切换隐藏或锁定。
- 现有 `packages/app/src/styles/theme-bloodborne.css` 的 light 分支（大教堂石棺）删除；Enotria 新建为独立主题包。
- 主题包作用于全应用；欢迎页只是其中一个适配面。
- 三套主题共用同一份结构和锚点表；剪影版用来验证结构，也是素材缺失时的兜底。

---

## 7. 素材导出规范（每个主题包一组）

```text
themes/<pack>/stage/
  sky.webp                 # L0，可与 architecture 合并
  architecture.webp        # L1，clean plate：不含任何交互物件
  ground.webp              # L2，楼梯/高台/道路
  occlusion.webp           # L5，可选，透明
  objects/
    altar-new.webp         # 矮金杯 / 对应物
    altar-recent.webp      # 最近会话祭坛（4 座复用同一张，靠 scale 区分远近）
    hub-agents.webp
    hub-projects.webp
    hub-river.webp
    hub-library.webp
```

- 舞台图以 1600×900 为逻辑尺寸，**实际导出 ≥ 3200×1800**（高分屏）。
- 物件图为透明 WebP/PNG，底部中心为落地点，四周透明边距统一；如有偏差，只调该物件的 visual offset，不改 §4 锚点。
- 所有物件光向一致（主光来源在 Style Bible 中定），底部接触阴影由 CSS 统一绘制，不画进物件图。
- 原稿两张 `stage_*.jpg` 把物件画死在图里，仅作氛围参考，不能直接用作分层底图。

---

## 8. 待定

1. **Memory 管理的 P7 记录**（D14）：现有实现在 V3 chat-core（`views/AgentMemory.jsx` / `views/MemoryConsole.jsx`）。P7 的 capability matrix 记为“deferred，owner = Agent Profile phase，过渡入口 = V3 回退路由”。V4 `AgentProfilePage` 里“记忆管理入口将在 P5 Library 阶段提供”这句过时文案，留到 Agent Profile phase 一并处理。
2. **出图的一致性**：素材来自多个来源，先以 D15 线稿锁定结构，再定一张 Bloodborne 舞台母版锁定画风（构图 + 光向 + 色调），之后所有物件图都以这两张为参考生成或筛选。
3. **路线图同步**：Agent Profile phase 的编号与位置需写入 `V4_Master_Implementation_Roadmap.md`（由 Solaire 整理）。
