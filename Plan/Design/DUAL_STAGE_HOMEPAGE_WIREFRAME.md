# [Design Spec] ExoCore Desktop Dual-Stage Homepage Wireframe
> **Theme Pair**: `Dark` (Hunter's Dream / Bloodborne) ⇋ `Light` (Sunlit Theater / Enotria: The Last Song)  
> **Status**: Draft / RFC  
> **Scope**: `ExoCore-Desktop` Home View / Stage Shell

---

## 1. 核心设计哲学 (Design Philosophy)

ExoCore Desktop 首页不采用通用卡片堆叠或扁平列表，而是构建为**「空间化舞台（Spatial Stage）」**。  
UI 在 `Dark` 与 `Light` 模式下保持**绝对一致的空间几何骨架（Wireframe Layout）**与**交互热区映射（Hitbox Mapping）**，仅通过**视觉纹理、世界观语汇、色彩盘与光影漫反射**进行对称转换：

- **Dark Mode (Hunter's Dream · 永夜工坊)**：维多利亚晚期、哥特尖顶、苍白血月、湿冷石砖与上位者低语。以高深邃度（#0A0B0E 基底）、低饱和蓝灰与微量水银/冷焰高亮为主。
- **Light Mode (Sunlit Theater · 日光剧院)**：地中海古典剧场、白砂岩回廊、向日葵烈日、即兴喜剧面具（Canovaccio）与油彩刮刀质感。以厚重大理石漫反射（#F7F3E9 / #EFE6D5 基底）、熟透柠檬金、橄榄绿与油画厚涂阴影为主。

---

## 2. 空间布局与线框规范 (Wireframe Grid)

整个页面采用固定景深的视差或分层舞台构图：

```
+----------------------------------------------------------------------------------------------------+
| [Top Nav / Status Anchor]                                                  (Time / Vibe / Session) |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [LEFT SECTOR: 35%]                              |  [RIGHT SECTOR: 65%]                             |
|                                                  |                                                 |
|  ┌─ Celestial Focus (Top-Left) ───────────────┐  |  ┌─ Stage Facade / Architecture (Top-Right) ───┐ |
|  │ Dark:  Pale Blood Moon in Deep Night Sky    │  |  │ Dark:  Victorian Workshop Roof & Spire      │ |
|  │ Light: Blinding Mediterranean Noon Sun      │  |  │ Light: Classical Colonnade & Theater Arch   │ |
|  └─────────────────────────────────────────────┘  |  └─────────────────────────────────────────────┘ |
|                                                  |                                                 |
|  ┌─ Recent Sessions (5 Altars / Left Path) ───┐  |  ┌─ Core Functional Sectors (Right Pathway) ───┐ |
|  │  Vertical cascade / Altar pedestals        │  |  │  Stepped pathway markers / Monuments       │ |
|  │                                            │  |  │                                             │ |
|  │  [ Altar 1: Active Primary Session      ]  │  |  │  [ HUB 1: Agent Hub / Resonance / Mask ]    │ |
|  │  [ Altar 2: Session Slot II             ]  │  |  │                                             │ |
|  │  [ Altar 3: Session Slot III            ]  │  |  │  [ HUB 2: Project Hub / Academy / Script ]  │ |
|  │  [ Altar 4: Session Slot IV             ]  │  |  │                                             │ |
|  │  [ Altar 5: Session Slot V              ]  │  |  │  [ HUB 3: Timeline / River / Sundial ]      │ |
|  │                                            │  |  │                                             │ |
|  └─────────────────────────────────────────────┘  |  └─────────────────────────────────────────────┘ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
| [Bottom Bedrock: Paved stones / Fallen leaves / Ambient Telemetry dock]                            |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. 对称板块命名与语汇映射 (Semantic Mapping)

施工方必须确保在双主题切换时，语义路由（Route ID）保持统一，仅切换标签（Label）、图标（Iconography）与叙事文本（Subtext）：

| 内部路由 `route_id` | 功能定位 | Dark Mode (Bloodborne) | Light Mode (Enotria) | 视觉锚点与交互反馈 |
| :--- | :--- | :--- | :--- | :--- |
| `hub.agents` | **Agent Hub**<br>(多实例协同 / 角色调度) | **共鸣 (Resonance)**<br>*Subtext: 召灵之钟与上位频率* | **假面 (Maschere)**<br>*Subtext: 即兴剧班底与登台面具* | **Dark**: 悬挂的小铜钟与微光符文<br>**Light**: 罗马壁龛中陈列的石膏彩绘面具 |
| `hub.projects` | **Project Hub**<br>(项目空间 / 知识档案) | **学院 (Byrgenwerth)**<br>*Subtext: 拜伦维斯古籍与理性之眼* | **剧本 (Canovaccio)**<br>*Subtext: 幕戏总谱与工艺工坊 (Bottega)* | **Dark**: 堆叠的皮革典籍与星象仪<br>**Light**: 铺展在石台上的羊皮纸卷轴与羽毛笔 |
| `hub.timeline` | **River & Chronology**<br>(时序流 / 记忆河 / 心跳) | **星辰钟楼 (Astral Clocktower)**<br>*Subtext: 玛丽亚的星轨与时针* | **日晷 (Meridiana)**<br>*Subtext: 烈日长廊与幕间流动 (Intermezzo)* | **Dark**: 逆光的巨大齿轮钟盘<br>**Light**: 大理石日晷石柱，光影随汉堡本地日照移动 |
| `session.slot[1..5]` | **Recent Sessions**<br>(最近 5 个活跃会话) | **苏美鲁圣杯祭台 (Chalice Altars)**<br>*五个沿左侧小径排列的苏美鲁石碑* | **古典雕像台座 (Statuary Pedestals)**<br>*五个沿庭院排列的带月桂冠半身像/面具台* | 点击触发碎石/拨弦音效，波纹漫延至全屏进入会话视图 |

---

## 4. 色彩与材质规范 (Material & Palette Tokens)

### 4.1 Dark Mode (Hunter's Dream)
- **Background Base**: `#08090C` (深邃夜空黑)
- **Surface Elevation**: `#111318` (湿冷石砖色) / `#1A1D24` (雕花铁栅栏色)
- **Text Primary**: `#E2E4E9` (苍白骨瓷白)
- **Text Muted**: `#7B8290` (墓穴灰石)
- **Accent / Highlight**:
  - `Celestial`: `#C8D7E8` (冷月银辉)
  - `Energy`: `#5E81AC` (上位者秘法冷蓝)
  - `Border/Rule`: `rgba(255, 255, 255, 0.08)`

### 4.2 Light Mode (Enotria Sunlit Theater)
- **Background Base**: `#F5EFEB` (炙烤白砂岩色，拒绝纯白 `#FFFFFF`)
- **Surface Elevation**: `#EDE4DC` (地中海石灰岩) / `#E2D5C7` (做旧羊皮纸)
- **Text Primary**: `#2C221E` (深焦褐/浓缩意式深色)
- **Text Muted**: `#7D6B5D` (风化泥土赭)
- **Accent / Highlight**:
  - `Celestial`: `#D48826` (烈日琥珀金)
  - `Energy`: `#4A6B53` (橄榄叶暗绿)
  - `Border/Rule`: `rgba(60, 40, 25, 0.12)` (油画阴影轮廓)

---

## 5. 施工注意事项 (Builder Guidelines)

1. **禁止破坏视线对称性**：切换模式时，禁止改变按钮尺寸、左侧列表宽度或右侧路径倾斜角度，必须实现像素级或比例级的原位转场。
2. **严禁使用扁平纯白卡片**：Light 模式所有背景色必须具备白砂岩/大理石质感微底噪（通过 CSS overlay 或 subtle SVG noise 实现），消除生硬刺眼感。
3. **状态持久化**：主题切换状态与用户当前会话状态解耦，存入 LocalStorage，支持随系统或独立手动切换。
