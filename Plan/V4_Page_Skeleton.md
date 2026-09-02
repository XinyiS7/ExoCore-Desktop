# ExoCore V4 — 页面骨架与 Mockup 契约

> 用途：作为 V4 前端视觉 mockup 的输入契约（供 Gemini App 端生成完整视觉稿）。
> 状态：IA 已收口；供 App Shell / 页面 Mockup 与 Master Roadmap 使用，非施工计划。
> 定位：只约束「有哪些页面 / 导航层级 / 每个页面装什么」；不约束像素与具体视觉。
> 关联：承接 `ExoCore_V4_Single_SPA_Architecture_Spec.md` 的信息架构，按 Alicia 重排后的四大板块落地。
> 初稿：2026-08-26 | IA 收口：2026-09-02 | 整理：Ecki / deepseek-v4，Solaire / gpt-5.6-sol

---

## 0. 一句话总览

一个应用壳 + 四大产品区域：**Chat / Groups / River / Library**。Settings 从头像 / More 稳定可达但不占一级产品槽位。三级结构是复杂对象路径的上限与常用模式，不要求所有板块机械凑满三级。

**推荐 mockup 绘制顺序：先画 ① App Shell → ② Chat 首页 → ③ River 中轴时间线 → ④ Library 首页/切换关系**。前两张决定迁移起点，后两张决定新产品区的长期 IA。

---

## 1. App Shell（应用壳）— 贯穿所有页面的底座

承载：一级导航入口（四大板块）+ 顶部区（搜索 / 新建 / 账号）。

需要覆盖两种呈现形态（桌面侧栏 / 移动底栏），但指向同一组页面。

---

## 板块一：实时聊天（Chat）— 主战场，最大板块

> 形似主流 AI 客户端。内含两套入口（Agent 系 + Project 系），但**都通向同一个 Chat 页**。

| 层级 | 页面 | 现路由 | 说明 |
|---|---|---|---|
| 板块首页 | **Chat 首页（最近会话）** | Dashboard | 最近交流优先，兼作板块 landing |
| 第2级 | **Agent Hub**（Agent 列表） | `agent-hub` | Agent 索引 |
| 第2级 | **Project Hub**（项目列表） | `projects` | 项目索引 |
| 第3级 | **Agent Profile** | `agent/:id` | Agent 详情 + 名下会话/记忆入口 |
| 第3级 | **Project Detail** | `project/:id` | 项目详情 + 文件/会话/知识 |
| 第3级 | **Chat 页（canonical）** | `chat/:sessionId` | 🔑 唯一聊天实现 |

**关键设计点：**
- Agent × Project 是**组合筛选维度，不是两套会话树**——同一会话只存一份；从 Agent 进突出 Project 标签，从 Project 进突出 Agent 标签。
- 无 Project 的对话称 **Drift**（名称已冻结）。
- Agent Profile 内嵌 **Memory 摘要 + 管理入口**（深链）。
- Chat 页承载聊天流、模型控制、附件、音频等能力，但界面应让**模型控制等浮层不挤压消息区**。

---

## 板块二：群聊（Groups）— 小而独立

| 层级 | 页面 | 现路由 | 说明 |
|---|---|---|---|
| 第2级 | **群聊列表** | `groupchat` | 一屏 |
| 第3级 | **群聊房间** | `groupchat/:id` | 独立消息逻辑，不伪装成普通 Chat |

> 进不了任何板块，独立成一级入口。mockup 优先级最低（块小）。

---

## 板块三：River — 异步生活时间轴

> River 是统一的时间阅读面，不是统一业务表。Memo / Heartbeat / Diary / Task / legacy Chronicle event 作为不同 source 缀在同一主轴上。

| 层级 | 页面 | 来源 / 旧页面 | 说明 |
|---|---|---|---|
| 板块首页 | **River 主视图** | TimelineView + 多 source | 🔑 `River flows in you.` 固定在顶部；Open Tasks shelf + 中轴时间流 |
| 第2级 | **单项详情 / 编辑** | Task / Memo / legacy event | 按 source capability 展开 |
| 第2级 | **日历视图**（陪伴视图） | CalendarView | 时间轴外的第二种时间表达 |

**关键设计点：**
- 主轴只排序 thread root；Memo 自身可带 reply tree，回复不进入全局排序。
- Diary 珠子只显示当天日记 preview，点击阅读全文；popup / drawer / inline 后置到 mockup。
- Task 顶部另有 Open Tasks shelf，防止未完成事项被时间冲走；主轴仍保留原事件。
- Chronicle 不再作为 V4 新产品入口：旧 milestone/moment 可成为 legacy event，旧 highlight 归 Collection promotion 候选，其他历史保留 archive。
- River 支持按类型与时间缩小范围，但各 source 的编辑/完成/展开行为仍由自身 capability 决定。

---

## 板块四：Library — 长期留下的内容与记忆管理

| 层级 | 页面 | 说明 |
|---|---|---|
| 板块首页 | **Library** | Collection / Memory 两个平级业务入口 |
| 第2级 | **Collection Browser** | 文字 / 图片 / 语音 / 文档；Tags、搜索、最近收藏 |
| 第3级 | **Collection Item Detail** | 原件、canonical semantic material、来源、收藏情境、带去聊天 |
| 第2级 | **Memory / Plasmid Library** | Agent、scope、Tags、source、trigger、status、正文搜索 |
| 第3级 | **MemoryPlasmid Detail** | 正文、触发词、Tags、weight、来源与处理状态 |
| 第2级 | **Recall Lab** | Plasmid 检索检查 + History grep-like 精确查找 |

**关键设计点：**
- Collection 是“主动留下来回味的藏品”；Memory 是“为了会话连续性而可查看、可修正的 recall substrate”。
- 两者可共享搜索壳和 Tags 视觉，但不能共享含混的数据模型或 CRUD。
- Collection 首期必须有稳定展示面；随机翻看后置。
- Settings 不再是一级板块，从头像 / More 进入现有设置中心。

---

## Mockup 绘制清单（Checklist）

**Shell**
- [ ] App Shell（侧栏 / 底栏 + 顶部栏）— 定一级导航位置

**Chat 板块**
- [ ] Chat 首页（最近会话）
- [ ] Agent Hub 列表
- [ ] Project Hub 列表
- [ ] Agent Profile 详情
- [ ] Project Detail 详情
- [ ] Chat 页（canonical 唯一实现）

**Groups 板块**
- [ ] 群聊列表
- [ ] 群聊房间

**River 板块**
- [ ] 🎯 River 主视图（主题句 + Open Tasks shelf + 多 source 中轴线）
- [ ] Memo thread 展开态
- [ ] Diary preview → 阅读全文
- [ ] 单项详情 / 编辑
- [ ] 日历陪伴视图

**Library 板块**
- [ ] Library 首页 / Collection-Memory 切换关系
- [ ] Collection Browser + Item Detail
- [ ] MemoryPlasmid Library + Detail
- [ ] Recall Lab（Plasmid + History grep-like）

**低频系统入口**
- [ ] 头像 / More → Settings 中心

---

## Mockup 阶段后置决策

| 决策 | 冻结时点 |
|---|---|
| 移动端底栏最终四项与 More 交互 | App Shell 原型验收前 |
| Memo thread 在小屏使用 inline / drawer / detail 哪种展开 | River mockup 前 |
| Diary 全文使用 popup / drawer / inline | River mockup 前；不影响 API 契约 |
| Library 首页是 split landing 还是默认进入 Collection | Library mockup 前 |
| Collection Item Detail 的 desktop/mobile 信息密度 | Collection mockup 前 |

---

*主要整理：Ecki / deepseek-v4 — 2026-08-26*
*承接自：ExoCore_V4_Single_SPA_Architecture_Spec.md（Solaire / gpt-5.6-sol）*

层级
```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: 悬浮微控层 (Sticky Top HUD & Bottom Input Tube)     │  ← 始终浮在最上层
├─────────────────────────────────────────────────────────────┤
│ Layer 2: 交互抽屉层 (Tactical Drawer & Upload ActionSheet)   │  ← 触发时自顶部/底部滑出
├─────────────────────────────────────────────────────────────┤
│ Layer 1: 消息流排版区 (Scrollable Lens-Bubble Stream)        │  ← 宽幅毛玻璃卡片消息流
├─────────────────────────────────────────────────────────────┤
│ Layer 0: 全局能量场 (Dynamic Aura Canvas / Gemini Breathing) │  ← 最底层：流式生成时点亮
└─────────────────────────────────────────────────────────────┘
```

View 1: 主会话界面 (流式输出态 + 透镜气泡)
```
┌─────────────────────────────────────────────────────────────┐
│ ❮ Project      ✦ Alessandro · Project: Chimera [📁]   [⎔] │ ← 顶部 HUD: 动态返回、名称、项目文件快捷入口
│ ─────────────────────────────────────────────────────────── │
│  ⚡ Claude-3.7-Sonnet  ·  🧠 Cache: 1.2M  ·  💭 Think: Deep │ ← 微缩参数副栏 (静默展示状态)
├─────────────────────────────────────────────────────────────┤
│ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ │ ← Layer 0: Gemini 风格全屏呼吸渐变场[cite: 1, 9]
│ ~ ~ (底图光晕：#a63d00 ⇄ #f8bf74 弥散微光穿透毛玻璃) ~ ~ ~  │   (生成中低频起伏)[cite: 1, 9]
│                                                             │
│                                           14:28 · You ──┐   │
│                      ┌──────────────────────────────────┴─┐ │
│                      │ 帮我分析这段数据，顺便听一下录音。   │ │ ← 用户消息气泡 (半透毛玻璃)[cite: 1, 9]
│                      │ ┌────────────────────────────────┐ │ │
│                      │ │ 🎵 0:14  |||l||l|ll||l|   ▶    │ │ │ ← 自带音频胶囊
│                      │ │ 🖼 [thumbnail_01.png] (48KB)   │ │ │ ← 图片附件缩略图
│                      │ └────────────────────────────────┘ │ │
│                      └────────────────────────────────────┘ │
│                                                             │
│ ┌── ✦ Elysia · Qwen-2.5-72B                     14:28:32 ─┐ │
│ │ ┌─ ⚙ Thinking & Tools (2 calls · 1.4s) ───────────────┐ │ │ ← 折叠态：思考链与工具链
│ │ │ ├─ 💭 [已折叠] 展开思维链 (742 tokens)...           │ │ │   (执行时点亮暗火刻度线)[cite: 1]
│ │ │ ├─ ✓ memory_search("chimera_config") · 12ms        │ │ │
│ │ │ └─ ✓ execute_script("parse_matrix.py") · 180ms     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ ┌─ 🔊 AI Voice Response ──────────────────────────────┐ │ │ 
│ │ │  ▶  [ 等待音频流生成 / Pending ]              0:00   │ │ │ ← AI 音频挂载槽 (Pending状态)[cite: 1]
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ 已经解析完毕。Chimera 矩阵中的核心参数存在偏移：          │ │ ← 核心 Markdown 渲染区[cite: 1]
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ┌─ [+] ─────────────────────────────────────────── [◆] ───┐ │ ← 悬浮晶体输入管 (底边带发光细线)[cite: 1, 9]
│ │  +   [📎 2] 输入指令或在此粘贴遗物片段...             ◆   │ │ 
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```
View 2: 配置抽屉 (Tactical HUD - 下拉展开)
```
┌─────────────────────────────────────────────────────────────┐
│ ❮ Project           ✦ TACTICAL HUD & STATE              [✕] │
├─────────────────────────────────────────────────────────────┤
│ ┌── 🧠 认知模型与端点 (下拉列表选择) ────────────────────┐ │
│ │  Endpoint : [ Local Ollama (192.168.1.12)          ▾ ] │ │ ← 列表选择类型
│ │  Model    : [ DeepSeek-R1-Distill-70B              ▾ ] │ │
│ │  Thinking : [ 启用深度思考 (Budget: 4096 tokens)    ▾ ] │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌── ⚙️ 系统能力调度 (Toggle 拨动开关) ───────────────────┐ │
│ │  Context Cache (上下文缓存)           [ ● ON  |   ]     │ │ ← Toggle 类型 cache 依旧要有进度条和清空
│ │  Private Memory (记忆读取与注入)      [ ● ON  |   ]     │ │
│ │  Session History (历史滑窗连贯)       [   | ◯ OFF ]     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌── 🌌 能量场环境 (下拉列表选择) ────────────────────────┐ │
│ │  Aura Theme : [ 余火燃动 (Ember Flame)             ▾ ] │ │ ← 呼吸背景切换[cite: 1]
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌── 📎 本次会话附件管理 (有效附件列表) ──────────────────┐ │
│ │  ┌──────────────┐ ┌──────────────┐                     │ │ ← 附件：横向/网格排列[cite: 1]
│ │  │ 🖼 spec.png  │ │ 📄 env.yaml  │                     │ │
│ │  │ 128KB    [×] │ │ 4KB      [×] │                     │ │ ← 可手动点击 [x] 删除[cite: 1]
│ │  └──────────────┘ └──────────────┘                     │ │
│ └────────────────────────────────────────────────────────┘ │
│                          ▼ 点击收起抽屉                      │
└─────────────────────────────────────────────────────────────┘
```

