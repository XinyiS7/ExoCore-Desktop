# ExoCore V4 — River & Memo UI Mockup 设计与审阅报告

> **文档性质**：P3 阶段 UI Mockup 呈现报告与决策清单（Design / Mockup Phase Only）。  
> **权威输入**：`Plan/V4_Phase_3_River_Memo_Draft_Plan.md`、`Plan/V4_Page_Skeleton.md` River Checklist、`Plan/V4_River_Collection_Memory_Interaction_Spec.md` §3、`ReactSheet.md` §3.11–3.13。  
> **静态交互原型文件**：[`Plan/V4_River_Memo_UI_Mockup.html`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/V4_River_Memo_UI_Mockup.html)  
> **设计责任人**：Alaric (Gemini 3.8 Flash)  
> **当前状态**：Pending Alicia Review & Approval（不授权生产施工、不切入口、不改动草案与历史验收文件）。

---

## 一、 Mockup 原型交付物概览

已将完整高保真交互视觉稿输出至独立文件：  
👉 **[`Plan/V4_River_Memo_UI_Mockup.html`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/V4_River_Memo_UI_Mockup.html)**

### 视觉与架构遵循原则
1. **完全沿用 V4 真实设计系统**：
   * 采用 `packages/app/src/styles/base.css` 与 `shell.css` 的深色与浅色双套 Tokens（`--v4-bg`, `--v4-panel`, `--v4-accent`, `--v4-line` 等）；
   * 支持一键切换 **桌面端（1200px + 216px 侧边栏）** 与 **移动端（390px iPhone + 65px 底部导航栏）** 或 **双端并排检视**；
   * 顶部提供场景直达切换器（Tab 1-6）与“契约标注开/关”开关，直观呈现设计边界。
2. **严守真实后端能力红线（无虚假按钮）**：
   * Memo 卡片 **绝无正文编辑、删除按钮，绝无附件上传入口**（无对应契约）；
   * 标签不声称由后端自动解析，原型提供了前台提取与两步保存的模拟；
   * Task 延期严禁虚构 `/defer/` 接口，原型严格以明确日期走 `PATCH /api/tasks/entries/<id>/`；
   * Heartbeat 卡片仅展示最终摘要，提供跳转至 Ledger session 的 DeepLink 按钮，不复制技术账本；
   * Diary 明确标注欧洲柏林时间 03:00 仅为排序锚点，非真实写作时刻。

---

## 二、 六大核心场景与交互设计方案

### 场景 1：River 主视图全景（The Living Stream）
* **顶部固定标语**：长期驻留 **`River flows in you.`**，无论怎么滚动或过滤均保持可见；右上角提供 `日历陪伴视图 ↗` 快捷入口。
* **轻量 Memo Composer**：
  * 无标题、无分类目录，输入框默认提示 `随手记下脑海里的碎片...（支持 #标签）`；
  * 正文内键入 `#v4 #river` 时，底部实时提取并渲染为标签 Chip；
  * 提交按钮带防重复点击状态（`提交中...`）；提交后清空，失败保留输入。
* **Open Tasks Shelf（未完成任务持续暴露）**：
  * 横向滚动卡片栏，清晰展示置顶与待办任务（如 `KF-07 任务创建诊断门`）；
  * 卡片直接提供 `✓ 完成`、`📅 延期`、`编辑` 操作，主轴原事件与 Shelf 同步联动。
* **五源单一纵向时间轴**：
  * 按 `(occurred_at, source_type, source_key)` 降序自然排列，带日期分割线（TODAY / YESTERDAY）；
  * 采用差异化珠子（Beads）与来源徽章标识 5 源：
    * 📝 **Memo**（蓝色 `#4f8cff`，包含直接回复数与标签）；
    * ⚡ **Heartbeat**（琥珀色 `#e8b64c`，仅展示最终文字总结）；
    * 📖 **Diary**（紫色 `#a855f7`，展示 canonical 前 280 字符预览，标注 Day Precision）；
    * ✅ **Task**（翠绿色 `#10b981`，区分创建与完成动态）；
    * 📜 **Legacy Event**（石板灰 `#94a3b8`，标明旧 Chronicle Milestone/Moment 来源）。

### 场景 2：Memo 多层回复树原位展开态（In-place Thread）
* **展开契约**：点击 `💬 回复 / 展开讨论`，在当前卡片内部以虚线分割平滑展开回复树，**不跳转页面、不污染 River 全局主轴排序**。
* **层级关系**：
  * 根据平铺列表的 `parent_id` 建立嵌套关系，并在头部显示明确的 `@TargetAuthor` 目标指示；
  * **小屏防挤压设计**：移动端约束最大缩进距离（避免移动端因多次嵌套将文字挤压成细条），依靠左侧彩线与 `@指向` 保持从属清晰。
* **原位回复框**：点击任意层级的 `↩ 回复`，输入框自动填充 `@目标作者 ` 并聚焦。

### 场景 3：Diary 全文阅读态（Desktop Drawer vs Mobile Fullscreen）
* **桌面端（Desktop）**：
  * 点击 `📖 阅读全文`，从屏幕右侧滑出 **580px 宽幅阅读抽屉（Drawer）**；
  * River 主流保留在左侧并带微弱半透明遮罩，关闭抽屉立刻回到原时间流位置，上下文完全不丢失。
* **移动端（Mobile）**：
  * 转换为全屏沉浸阅读浮层（100vw × 100vh），顶部带标准返回箭头与日期标题。
* **时间精度澄清**：
  * 抽屉顶部清晰展示 `Canonical Entry · 排序锚点 03:00 · 真实归档 ~09:00`，彻底消除时间歧义。

### 场景 4：Task 来源表单与 Legacy 归档确认
* **Task 详情与延期 Modal**：
  * 沿用 `ScheduleEntry` 真实数据结构（标题、类型、当前截止日、周期参数、GCal 同步状态）；
  * 快速延期提供下拉选项（明天 / 下周末 / 自选日期），提交时调用 `PATCH /api/tasks/entries/<id>/` 更新 `due_date`。
* **Legacy Event 归档删除**：
  * 历史纪事绝不伪装成 Memo，提供红色危险操作按钮；
  * 点击后触发专门的确认弹窗：`⚠️ 确认归档删除历史纪事？该操作将调用 Chronicle 来源软归档接口，不可撤销`。

### 场景 5：Calendar 陪伴入口与日历视图
* **定位**：同一批任务/日程的第二种时间表达，不另建任务实体；
* **月份栅格与今日清单**：
  * 7 列星期布局，格内以彩色圆点与微型胶囊标示 Task 与 Heartbeat；
* **边界状态明确区分**：
  * 显式标注 `数据覆盖范围：2026-09 至 2026-11`；
  * 针对更早历史月份的后端 pending 缺陷，明确显示“历史未覆盖诊断说明”，**严禁把缺失快照误报为“该月没有任何日程”**。

### 场景 6：关键异常、503 与两步保存边缘态
* **503 `source_unavailable` 显式警告横幅**：
  * 某单一来源（如 Heartbeat 或 Diary 文件）不可用时，顶部显示告警条，其余 4 源正常阅读；
  * 严禁静默丢弃故障源，严禁在前端回退为多源客户端拼装。
* **续页失败（Load More Error）**：
  * 保持已加载内容不变，在时间轴底部呈现重试按钮与具体错误原因。
* **Tags 两步保存部分失败提示**：
  * 若第 1 步 Memo POST 成功，第 2 步 PATCH Tags 失败：
  * 界面弹出明确提示：`✓ Memo 已保存成功 (#105)，但标签未保存`，并附带 **`[仅重试标签]` 独立按钮**；
  * 严禁重新触发 Memo POST，杜绝产生重复条目。

---

---

## 三、 Alicia 拍板决议记录 (Decisions Recorded)

Alicia 已于 2026-10-02 审阅并**全额采纳推荐原型（方案 A）**：

| 序号 | 决策事项 | 采纳决议 | 落地结论 |
| :--- | :--- | :--- | :--- |
| **D1** | **Memo Tags 两步保存机制** | **方案 A (APPROVED)** | Composer 实时正则提取 `#tag`，创建成功后前台静默 `PATCH Tags`；若标签更新失败显式提示“仅重试标签”，绝不重发 Memo POST。 |
| **D2** | **Memo Thread 展开形态** | **方案 A (APPROVED)** | 卡片内部原位折叠展开（In-place Accordion），移动端约束浅缩进 + `@Target` 指向，不跳出时间流。 |
| **D3** | **Diary 全文阅读形态** | **方案 A (APPROVED)** | 桌面端 580px 侧边阅读抽屉（Drawer），移动端全屏 Modal，阅读完毕即刻返回时间主轴。 |
| **D4** | **Open Tasks Shelf 展收策略** | **方案 A (APPROVED)** | 顶部常驻横向轻量条带，展示 3–5 项最高优先级未完成任务，主轴原事件与 Shelf 双向联动。 |
| **D5** | **Calendar 陪伴视图入口** | **聚合至 Open Tasks Shelf (APPROVED)** | 从顶部 Hero 标语剥离，移至 Open Tasks shelf 区域（与待办清单、[＋ 新建待办] 并列）。顶部 `River flows in you.` 恢复纯粹诗意与沉静，日程管理动作在 Shelf 处高度内聚。 |

---

## 四、 本轮新增交互深化与契约澄清 (Refinements based on Alicia's Feedback)

针对 Alicia 在审阅中重点确认的业务细节，原型已同步迭代优化：

### 1. 日历入口移至待办区（功能与语义高度聚合）
* **顶部 Hero 净化**：顶部 `River flows in you.` 去除具体功能跳转，仅保留产品主题与生命流副标，还给时间主轴纯粹的呼吸感。
* **日程中枢收拢**：将 `[📅 日历陪伴视图 ↗]` 与 `[＋ 新建待办]` 一并收拢至 **Open Tasks Shelf 头部**。用户在此处一次性完成：未完成事项速览、延期/勾选完成、新建排期日程、展开月份日历，逻辑完全闭环。

### 2. 待办区域拉取机制与 Memo 实体边界澄清
* **待办数据性质**：
  * Open Tasks shelf 的数据是**实时拉取**自 `GET /api/core/river/open-tasks/`（后端过滤 `active | escalated` 的 `ScheduleEntry`，并按置顶与截止排序）。
  * 翻阅全量任务与按月/周排期的**真正日程板块**，在 V4 中被定位为 River 的**日历陪伴视图（Calendar Companion View）**；而历史 V3 的复杂任务全功能（周期规则、高级分类管理）目前仍在 V3 Chronicle 中，V4 的完整 Task CRUD 迁移目前处于 P3 准备与 KF-07 诊断门阶段。
* **随手发 Memo 绝不自动生成 Task（实体严格隔离）**：
  * **事实契约**：Memo 实体走 `POST /api/core/memos/`（底层映射为 Tweet 表），**后端绝不会因为正文包含 `#task` 或 `#todo` 就自动去创建一条 `ScheduleEntry`**。
  * **交互落地**：为防止用户误以为“发一条带 `#task` 的 Memo 就会自动进日历和 Shelf”，在 Open Tasks shelf 顶部增设了专用的 **`[＋ 新建待办]` 按钮**，唤起极简日程表单走 `tasksApi` 原生创建；Memo 输入框专心承载灵感碎片与生活流，二者概念清晰、互不混淆。

### 3. Alessandro 心跳长文本总结的 Precision / 全文模式
* **背景**：
  * 阿莱在日常心跳总结中，常常会写下长达数段、细腻周全的系统巡检观察、生活流思考与反思，字数常达数百字以上，绝不仅是 280 字的干瘪摘要。
  * 原先卡片若仅展示截断后的摘要并引导去“查看运行记录”，会直接跳入冰冷的技术账本（Tools、Token 耗时、执行状态），破坏了 River 温柔生活流的阅读体验。
* **交互落地（采用 Diary 类似的抽屉阅读模式）**：
  * **主轴卡片**：保留约 280 字的精致预览，底部显示 `约 650 字 · 原文已就绪`；
  * **全文阅读**：主操作设为 **`📖 阅读全文 (Read Full)`**，点击后从右侧滑出 **“Alessandro 的心跳巡检总结”专属阅读抽屉（Drawer）**，完整沉浸阅读阿莱的长文本叙述与温情叮嘱；
  * **底层账本退居次席**：卡片与抽屉底部的 `🔍 运行日志 (Ledger) ↗` 降级为辅助技术链接，仅供需要追溯具体 ToolCall 时使用。

---

## 五、 后续交接

1. 本设计稿与本报告完全独立保存在 `Plan/` 下，未触碰任何既有草案与历史验收文件。
2. 随着 Alicia 拍板闭环（D1–D5 全部 APPROVED，加深待办独立入口与心跳长文本抽屉），已为 Solaire 冻结 Detailed Plan 提供了完整无歧义的视觉与交互事实。可由 Solaire 正式推进 `Plan/V4_Phase_3_River_Memo_Detailed_Plan.md` 的编制。

