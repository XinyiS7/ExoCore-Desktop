# PLAN：输入框游乐小抽屉、可爱骰盘、多色草稿便利贴与 Timer 沙漏美化

> **作者**：Alaric（Gemini 4 Hydrogen）  
> **日期**：2026-11-14  
> **需求文档**：[REQ_20261114_Composer_Toy_Drawer_Dice_Tray_and_Timer_UI.md](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/需求/REQ_20261114_Composer_Toy_Drawer_Dice_Tray_and_Timer_UI.md)  
> **后端契约**：[2026-11-14-pin-color-backend-handoff.md](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/spec/2026-11-14-pin-color-backend-handoff.md)  
> **前置基线**：`#130` Inline Action Tags（[parse.ts](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/inlineTags/parse.ts)、[PinBoard.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/inlineTags/PinBoard.tsx)、[InlineTagViews.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/inlineTags/InlineTagViews.tsx)）  
> **状态**：待 Alicia & Alessandro Review（本轮未修改任何业务源码）

---

## 1. 目标与范围边界

为 V4 Chat（`packages/app/src/features/chat/`）补全 `#130` 用户端交互玩具与状态可视化，不引入任何新的第三方 npm 依赖，不修改 `../ExoCore/` 后端代码：

1. **输入框游乐小抽屉（Toy Drawer）**：在 [ChatComposer.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/ChatComposer.tsx) 左侧工具栏新增抽屉入口，只收拢 User 可用的 `roll`（可爱骰盘）与 `pin`（多色便利贴），放开“无正文仅凭待发骰子或待发便利贴直接发送”的门控。
2. **可爱骰盘双阶段状态机**：
   - 发前未合盘：2D 物理把玩（拖拽吸附、光标拨弄/甩盘、长按 `Space` 摇晃、移动端 `DeviceMotionEvent` 与静音降级）、试滚非锁定预览、合盘待发徽章。
   - 发后开奖浮层：锁定交互的单次悬浮滚入动画，对接后端实时落库的 `<roll_result ... dice="...">` 真实点数翻面定格，覆盖失败/中断/暂存/`prefers-reduced-motion` 收敛。
3. **所见即所得多色草稿便利贴**：6 款高对比度预设色系（含 `crimson` 深底浅字）、纸片直写、失焦吸顶至 [PinBoard.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/inlineTags/PinBoard.tsx) 预览态、点击重编、`</pin>` 防破坏校验、与后端加 `color` 字段前的平滑降级。
4. **`<timer>` 沙漏微件**：升级 [InlineTagViews.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/inlineTags/InlineTagViews.tsx) 的 `timer` / `timer_cancel` / `timer_fired` 为 SVG 双腔玻璃沙漏，基于消息 `createdAt + seconds` 与后续触发消息做历史过期静止兜底。

**明确不做（Scope Guard）**：
- 不在抽屉内收入 `<block>`、`<spoiler>`、`<speak>`。
- 不引入 Matter.js / Three.js 等外部物理或 3D 依赖（保持 V4 轻量包体，使用自研轻量 2D 刚体模拟 + Canvas/SVG）。
- 不修改 V3 `chat-core` / `chronicle`，不触碰 `../ExoCore/`。

---

## 2. 现状代码调研与关键契约对齐

| 调研模块 | 现状与关键事实 | 对本方案的约束 |
|---|---|---|
| **Composer 门控** (`ChatComposer.tsx`) | `handleSubmit` 在 `editingTarget` 时走纯文本 `onConfirmEdit`；常规模式检查 `!trimmed && currentAttachmentIds.length === 0 && !hasRecordedAudio && collectionItemIds.length === 0`；`hasSendableAttachments` 控制 Force Cache (`Snowflake`)；`textOnly` 时 `stagingBlocksSend` 阻止附件/录音/编辑并保留已有附件/录音至解禁。 | 待发骰子与待发便利贴归属文本标签能力，**不得**计入 `hasSendableAttachments` 触发 Force Cache；在 `editingTarget` 与 `textOnly` 时禁用抽屉入口、自动收起面板但保留已武装草稿，且在 `textOnly` 时阻止携带未发玩具直接暂存（见 §3.1）。 |
| **草稿与失败回退** (`ChatComposer.tsx`, `useChatRuntime.ts`) | `useChatRuntime.ts` 在 `shouldRestoreFailedTurn`（`!wasUserPersisted` 且确定性错误）时通过 `restoredTurn` 还原 `inFlight.content`；`ChatComposer.tsx` 已用 `stashedSubmissionRef` 在 `restoredTurn` 时还原结构化的 `compose.entries`。 | 若直接用 `restoredTurn.text` 塞回 `textarea`，会把拼装后的 `<roll=...>` 与 `<pin ...>` 暴露成原始标签文本。因此 `stashedSubmissionRef` 需同步暂存结构化 `{ plainText, pendingDice, draftPins }`，`restoredTurn` 命中时优先还原回玩具状态而非原始标签源码（见 §3.2）。 |
| **后端 `<roll_result>` 落库时机** (`../ExoCore/agents/services.py`, `views.py`, `inline_tags/effects.py`) | 1) `prepare_user_content()` 在 `ChatService.process_chat` 生成器初期用 `secrets.randbelow` 计算真实点数并拼入 `user_content`。<br>2) 无论 Direct 路径（`_persist_ordinary_user_message`）还是 Subscription Runtime 路径（`_prepare_runtime_user_turn`），带有 `client_turn_id` 与 `<roll_result>` 的 `user` `Message` 均在 **LLM 流式输出之前**提交入库。<br>3) 但当前 SSE/Async 流 **不推送** `user_message` 或 `roll_result` 事件；`useChatRuntime` 仅在整轮结束后的 `runReconcileStages` 才拉取 `fetchFreshWindow`。 | 若等到 `done` 才拿 `roll_result`，10–30s 的长回复会让骰盘无限空转。必须在 POST 受理后由只读探针调用 `fetchMessagePage(conversationId, 0, 5)` 按 `clientTurnId` 提前读回真实 `<roll_result>`，**绝不写 TanStack Query 缓存**（保持 `applyFreshWindow` 单写主权）（见 §4.4）。 |
| **`<pin>` 解析与测试夹具** (`parse.ts`, `inline_tags_cp2.test.tsx`, `inline_tag_parser_cases.json`) | Backend `parser.py` 的 `_OPEN_RE` 已允许 `<pin color="...">` 属性且不拒收；前端 `inline_tags_cp2.test.tsx` 对 `inline_tag_parser_cases.json` 执行严格深等断言，且对 `normalizePins` 断言返回字段集合。 | `parse.ts` 仅在显式存在 `color` 属性时才处理 `color`，无 `color` 属性的 `<pin>` AST 与 `inline_tag_parser_cases.json` 保持完全一致；同时同步检查并更新 `inline_tags_cp2.test.tsx`（`normalizePins`）及 `inline_tags_render.test.tsx`（`<timer>` 渲染断言）。 |
| **PinBoard 布局与纸层阴影** (`ConversationPage.tsx`, `PinBoard.tsx`, `inlineTags.css`) | `PinBoard` 位于 `.app-scroll-stage` 内（`z-index: 28`，与 `ChatComposer` 为兄弟关系）；`inlineTags.css` 的 `.app-itag-note` 第 130 行硬编码了鹅黄次层阴影 `rgba(226, 205, 124, 0.7)`，第 208 行硬编码了深棕关闭按钮 hover 背景 `rgba(59, 51, 32, 0.12)`。 | 草稿便利贴状态需提升至 `ConversationPage` 作用域（或共享 Hook `useComposerToys(conversationId)`），使 `ChatComposer` 与 `PinBoard` 无缝协同；`inlineTags.css` 必须变量化次层纸影与关闭按钮 hover/告警色，确保 `crimson` 深底无鹅黄残影与对比度缺陷（见 §5）。 |
| **时间线行级上下文传递** (`MessageTimeline.tsx`, `spoilerUnlock.ts`) | `MessageTimeline` 已使用 `SpoilerUnlockContext` 按消息注入行级判断函数；`MessageContent` 接收 `inlineTags` 并调用 `InlineTagView`。 | `<timer>` 可沿用同一模式新增 `TimerTimelineContext`（注入 `createdAt` 与后续消息是否已出现对应 `timer_fired` / `timer_cancel`），在不污染 `MessageContent` 通用 Markdown 签名的前提下完成精确倒计时与过期兜底（见 §6）。 |

---

## 3. 模块架构与状态设计

### 3.1 新增与改动文件清单

| 文件路径 | 职责与变更类型 |
|---|---|
| `packages/app/src/features/chat/inlineTags/pinColors.ts` | **新增**：6 色预设常量（`butter` / `mint` / `blush` / `sky` / `lavender` / `crimson`）、`PinColor` 类型、`normalizePinColor()`、`assemblePinTag()` 与 `</pin>` 安全校验。 |
| `packages/app/src/features/chat/inlineTags/diceTypes.ts` | **新增**：骰池配置、表达式规范化/格式化（如 `1d20+2d6+3`）、`MAX_DICE (8)` 与 `DICE_FACES` 约束（直接复用 `parse.ts` 常量）、`PendingDiceState`。 |
| `packages/app/src/features/chat/inlineTags/dicePhysics.ts` | **新增**：纯 TS 2D 刚体物理内核（固定步长钳制 `dt <= 32ms`、木框碰撞、圆-圆弹性碰撞、摩擦阻尼、光标扫掠冲量、Space 高频微震荡、`DeviceMotion` 加速度映射、翻面目标角度/点数插值）。 |
| `packages/app/src/features/chat/inlineTags/DiceRenderer.tsx` | **新增**：多面体宝石切面 SVG/Canvas 渲染原语（`d4`/`d6`/`d8`/`d10`/`d12`/`d20`/`d100` 几何轮廓、高光切面、主骰 `d20` 橙黄宝石光泽、面数色彩区分、定格点数清晰可读）。 |
| `packages/app/src/features/chat/inlineTags/ToyDrawer.tsx` | **新增**：游乐小抽屉容器（Tab 切换：`🎲 骰盘` / `📌 便利贴`）、骰池拖拽磁吸与点击入盘、常数修正 `+ / -` 步进器、Space 摇晃焦区、DeviceMotion 权限与静音降级按钮、多色纸片直写编辑器（失焦外部吸顶提交）。 |
| `packages/app/src/features/chat/inlineTags/DiceRollOverlay.tsx` | **新增**：发送后悬浮在时间线视口中央偏下的**只读单次开奖浮层**（禁止一切物理干预、真值到达后阻尼减速翻面定格、`d20` 极值 20/1 微光彩蛋、优雅淡出与 `prefers-reduced-motion` 瞬显路径）。 |
| `packages/app/src/features/chat/inlineTags/TimerHourglass.tsx` | **新增**：`<timer>` / `<timer_cancel>` / `<timer_fired>` SVG 双腔玻璃沙漏组件与 `TimerTimelineContext` 消费逻辑。 |
| `packages/app/src/features/chat/inlineTags/timerContext.ts` | **新增**：`TimerTimelineContext`，由 `MessageTimeline` 为每条消息提供 `createdAt` 及后续消息的触发/取消判定。 |
| `packages/app/src/features/chat/inlineTags/useComposerToys.ts` | **新增**：按 `conversationId` 隔离的玩具草稿与提交态管理（待发骰盘、待发草稿便签、`committingPins` 发送过渡态、`rollOverlay` 双阶段生命周期及早读探针协调）。 |
| `packages/app/src/features/chat/inlineTags/parse.ts` | **修改**：`InlineTag` 的 `pin` 分支增加可选 `color?: PinColor`；`parseHead` 在 `name === 'pin'` 时读取 `attrs.color`，命中白名单则附带 `color`，未知值不丢弃标签并归为 `'butter'`（无属性时不添加冗余键以保持既有夹具兼容）。 |
| `packages/app/src/features/chat/inlineTags/InlineTagViews.tsx` | **修改**：`timer` / `timer_cancel` / `timer_fired` 分支委托给 `TimerHourglass`。 |
| `packages/app/src/features/chat/inlineTags/PinBoard.tsx` | **修改**：支持 `data-pin-color` 渲染、新增 `draftPins`（浅虚线框 + `待发送` 角标 + 点击重编 + 本地 `×` 撕除）与 `committingPins`（发送过渡占位，防刷新前闪失）。 |
| `packages/app/src/features/chat/inlineTags/inlineTags.css` | **修改**：6 色 CSS 变量体系、抽屉/骰盘/草稿便签/悬浮开奖浮层/SVG 沙漏样式及 `@media (prefers-reduced-motion: reduce)` 收敛规则。 |
| `packages/app/src/features/chat/types.ts` & `api.ts` | **修改**：`ConversationPinView` 增加 `color: PinColor`；`normalizePins` 读取 `pin.color` 并通过 `normalizePinColor` 平滑降级至 `'butter'`。 |
| `packages/app/src/features/chat/runtime/types.ts` & `useChatRuntime.ts` | **修改**：扩展 `ChatTurnInput` / `useChatRuntime` 暴露当前普通发送的 `activeTurnCorrelation`（`{ conversationId, clientTurnId, phase }`）与 `onTurnReconciled` / `onTurnSettled` 钩子，支撑精确 `roll_result` 探针与终态对齐（不改变既有状态机与锁语义）。 |
| `packages/app/src/features/chat/ChatComposer.tsx` & `ConversationPage.tsx` | **修改**：工具栏入口、待发骰袋徽章、发送门控与正文组装、`stashedSubmissionRef` 失败恢复、以及在 `ConversationPage` 挂载 `useComposerToys`、`PinBoard` 草稿联动与 `DiceRollOverlay`。 |
| `packages/app/src/features/chat/MessageTimeline.tsx` | **修改**：为每条消息注入 `TimerTimelineContext.Provider`（含 `createdAt` 与后续 `timer_fired` / `timer_cancel` 匹配检索）。 |

---

### 3.2 入口、门控与正文拼装设计（对齐重点 1）

#### A. 入口与禁言/编辑联动
1. **工具栏按钮**：在 `ChatComposer.tsx` 的 `.app-composer-attach-tools` 内紧跟录音按钮之后放置“游乐小抽屉”按钮（`PackageOpen` 或 `Dices` 图标），旁附紧凑角标显示当前待发计数（如待发骰子颗数 + 待发便签数）。
2. **禁用态定义**：
   `toyDisabled = busy || runActive || textOnly || audioRecovery.uploading || attachmentManager.deletePending || Boolean(editingTarget)`
   - 当 `editingTarget` 或 `textOnly` 变为 `true` 时，自动关闭抽屉展开态，但**不清空** `pendingDice` 与 `draftPins`。
   - **理由**：与 `ChatComposer.tsx` 既有规则一致——编辑历史消息和 `<block>` 暂存态期间不破坏用户未发出的创作，待切回常规输入态即可继续发送或调整。

#### B. 输入框上方待发骰袋徽章
- 当抽屉收起且 `pendingDice` 非空（例如 `1d20+2d6+3`）时，在 `.app-composer` 内部、输入框上方展示一枚轻量骰袋徽章：
  - 显示 `🎲 已备 {expr}`（未开奖，不展示任何点数）；
  - 若处于 `editingTarget` 或 `textOnly`，徽章置灰并提示当前模式不会随本条发出；
  - 点击徽章主体可重新掀开抽屉切到骰盘继续增减/试晃；点击右侧 `×` 清空 `pendingDice`。

#### C. 发送门控与 `Force Cache` 边界
- **常规发送按钮**：
  - `hasSendableToys = !editingTarget && !textOnly && (hasPendingDice || draftPins.length > 0)`
  - 允许发送条件扩展为：
    `trimmed.length > 0 || compose.successfulIds.length > 0 || collectionCards.length > 0 || recorder.status === 'recorded' || hasPendingDice || draftPins.length > 0`
- **Force Cache (`Snowflake`) 按钮**：
  - 维持 `hasSendableAttachments = compose.getSuccessfulIds().length > 0 || hasRecordedAudio` 不变，严禁因待发骰子/便利贴显示冰晶按钮。
- **`textOnly`（`#130` 暂存/禁言）门控**：
  - `stagingBlocksSend = textOnly && (Boolean(editingTarget) || hasSendableAttachments || hasPendingDice || draftPins.length > 0)`
  - 当 `textOnly` 且持有待发骰子或便签时，明确提示：`暂存期间只能发送文字：待发骰子与便利贴会保留，等禁言结束后再发送`。
  - **边界兜底**：若发送瞬间恰好撞上后端刚进入定时任务后台回复（`staging_gate` 返回 `status: 'staged'`），`useChatRuntime.acceptStaged` 正常受理，前端不卡在开奖动画（见 §4.4）。
- **编辑模式 (`editingTarget`)**：
  - 仅校验 `text.trim().length > 0`，不读取也不消耗 `pendingDice` 与 `draftPins`。

#### D. 正文拼装与 `restoredTurn` 还原
- 在 `ChatComposer.handleSubmit`（非编辑模式）拼装：
  1. `baseText = cleanProjectRefsForSend(trimmed)`
  2. `rollTag = hasPendingDice ? `<roll=${formattedExpr}>` : ''`
  3. `pinTags = draftPins.map(assemblePinTag).join('\n')`（`butter` 生成 `<pin>内容</pin>`，其余生成 `<pin color="${color}">内容</pin>`）
  4. 按 `[baseText, rollTag, pinTags].filter(Boolean).join('\n\n')` 拼为 `submittedText`（注意正文与标签间用空行或空格分隔，避免与 Markdown 语法粘连；若仅发 `<roll=...>` 或仅发 `<pin>...</pin>` 则无多余空行）。
- **`outcome === 'accepted'` 后**：
  - `stashedSubmissionRef` 记录 `{ conversationId, plainText: trimmed, entries, pendingDice, draftPins }`；
  - 清空 `text`、草稿、`pendingDice`；将 `draftPins` 转为只读 `committingPins` 交由 `PinBoard` 过渡显示（直至 `conversation` 详情刷新或本轮结束）；
  - 若本轮包含 `rollTag`，将本轮预备好的骰子数组与表达式转交给 `DiceRollOverlay` 进入锁定开奖阶段。
- **确定性失败回退 (`restoredTurn`)**：
  - 当 `useChatRuntime` 因 `!wasUserPersisted` 触发 `restoredTurn` 时，`ChatComposer` 检测到 `stashedSubmissionRef.current?.conversationId === conversationId`：还原 `plainText` 到输入框（并同步 `saveConversationDraft`）、恢复 `pendingDice` 与 `draftPins`，同时清理开奖浮层与 `committingPins`。

---

## 4. 核心功能一：可爱骰盘双阶段状态机（对齐重点 2）

### 4.1 双阶段状态机总览

```
  [idle / 装盘把玩阶段 (Playground)]
     │  - 拖拽/点击增减骰子 (≤8 颗, d4/d6/d8/d10/d12/d20/d100) + +/- 常数修正
     │  - 未合盘时：2D 物理引擎激活（光标拨弄 / 甩盘 / 长按 Space / DeviceMotion）
     │  - 停稳后仅显示水印「试滚中 · 发送后正式掷骰」
     ▼
  (合盘 / 收起抽屉)
     │  - 保留紧凑待发骰袋徽章，不调用任何开奖接口
     ▼
  (用户点击发送 → ChatComposer accepted & activeClientTurnId 绑定)
     │
     ▼
  [Phase 2-A: rolling（悬浮滚入 & 只读滚动，禁止一切交互干预）]
     │  - 视口中央偏下半透明浮层，骰子从底部滚入
     │  - 最短滚动计时 t >= 1350ms
     │  - 并行：轻量只读探针按 clientTurnId 拉取最新 user 消息提取 <roll_result>
     ├──(发送被拒 / staged / 未落库失败 / 卸载) ──▶ [dismissed]（立即收敛清理并按需恢复草稿）
     ▼ (t >= 1350ms 且真实 roll_result.dice 到位)
  [Phase 2-B: settling → revealed（阻尼减速翻面定格 & 微光展示）]
     │  - 骰子按真实 dice[i] 精确翻面定格
     │  - 亮起总和与明细（d20 === 20 金暖微光 / d20 === 1 暗红提示晕）
     │  - 定格展示 1500ms（或 reduced-motion 下 1200ms）
     ▼
  [fading → idle]（浮层优雅淡出，消息流由 <roll_result> 芯片永久接棒）
```

### 4.2 装盘规则与视觉规范
- **白名单与上限**：严格沿用 `parse.ts` 导出的 `DICE_FACES = [4, 6, 8, 10, 12, 20, 100]` 与 `MAX_DICE = 8`。超出 8 颗时骰池按钮置灰并在盘沿轻提示“单次最多掷 8 颗骰子”。
- **常数修正**：步进器 `-` / `+` 支持整数修正（范围建议 `-99` ~ `+99`，默认 `0`）；`formatDiceExpr(dice, modifier)` 按面数汇总排序（如 `1d20+2d6+3`、`2d8-1`），确保与 `isValidDiceExpr()` 完全兼容。
- **拖拽吸附与触屏兼容**：
  - 使用统一 Pointer Events（`onPointerDown` / `onPointerMove` / `onPointerUp`）实现跨 PC 鼠标与移动端触屏拖拽；
  - 拖至距托盘内边界 `24px` 范围内触发绒布边缘亮圈磁吸提示，松手即按入盘点赋予随机微初速度滑入；
  - 短按（移动距离 `< 6px`）直接入盘（兼容快速点击与无障碍键盘 Enter）；盘内轻点单颗骰子或拖出托盘外释放即撤回。
- **托盘与多面骰视觉**：
  - 托盘呈现温润深木框 + 天鹅绒质感底衬（微弱径向暗角，在 V4 dark / light / bloodborne 主题下均协调）；
  - 骰子采用多边形切面 SVG（`d4` 三角、`d6` 圆角正方、`d8` 菱形双锥、`d10`/`d100` 风筝十面、`d12` 五边形、`d20` 六角切面宝石），主骰 `d20` 赋予橙黄琥珀宝石渐变，其余面数拥有清晰可辨的宝石色调与高对比数字。

### 4.3 发前 2D 物理模拟（`dicePhysics.ts`）
- **物理模型**：
  - 状态：`x, y, vx, vy, angle, angularVel, radius, faces, previewValue, settled`。
  - 步长：单帧 `dt = Math.min(rawDt, 0.032)`，防止切后台回来瞬移穿墙；木框内壁做弹性碰撞（恢复系数 `0.58`），骰子间做质点圆碰撞分离与动量交换（`restitution = 0.65`），绒布表面线性阻尼 + 速度阈值以下（`speed < 8 && |angularVel| < 0.15`）判定停稳并更新 `previewValue`。
- **三种交互通道**：
  1. **PC 光标拨弄与甩盘**：指针在盘面移动时计算瞬时速度 `(vx, vy)`，当指针路径穿过骰子半径范围时按距离衰减施加冲量与旋转角动量；按住托盘空白处拖动则产生整体甩盘加速度并带动木框产生 ±6px 弹性位移回弹。
  2. **PC 长按 `Space` 摇晃**：托盘区 `tabIndex={0}`（不抢占输入框焦点；仅当焦点在托盘内部且不在可编辑元素时响应），`onKeyDown` 检测到 `e.code === 'Space'` 调用 `e.preventDefault()` 并在每帧向所有骰子施加高频随机抖动脉冲与框体微震动；`onKeyUp` / `onBlur` 立即停止施加外力，骰子四散滚开靠阻尼停稳。
  3. **移动端 `DeviceMotionEvent` 降级**：
     - 检测 `typeof window !== 'undefined' && 'DeviceMotionEvent' in window`；
     - 若需 `DeviceMotionEvent.requestPermission`（iOS 13+），在移动端托盘顶部/角落提供轻量“启用摇一摇”开关（在用户点击手势内请求权限）；已授权/无需授权设备监听 `devicemotion` 的 `accelerationIncludingGravity`（高通滤波提取线性加速度增量）映射为盘内 2D 冲量；
     - 拒绝授权、桌面端或无传感器设备**静默降级**，不弹错误窗，始终保留触屏划拨与一只“晃一晃”实体按钮供单手点击轻晃。

### 4.4 发送后真实 `<roll_result>` 追踪与异常收敛（关键设计）
1. **为什么不能等 `done` 才读结果**：
   - 经代码验证，`ExoCore` 的 user 消息（含 `<roll_result ... dice="..." total="...">`）是在 LLM 开始生成前就已经落库，但 SSE / Async 通道没有下发 user 消息落库事件；等 `useChatRuntime` 的 `runReconcileStages` 会在整段 AI 回复完成（可能 15~30s）后才拉取历史。
2. **轻量只读探针机制（`useComposerToys` + `useChatRuntime` 只读信号）**：
   - `useChatRuntime` 在 `executeTurn` 创建 `clientTurnIdForPost` 后，在 `predispatch` / `live` 期间通过回调或只读状态向 `ConversationPage` 暴露当前活跃普通发送的 `{ conversationId, clientTurnId, phase, firstWireEventSeen }`（仅当本轮发出了待发骰子时启用探针）。
   - **触发时机**：一旦 `phase === 'live'` 且（收到首个 SSE/Poll 流事件 `status` / `thinking` / `content`，或 POST 受理后满 `350ms`），调用只读接口 `fetchMessagePage(conversationId, 0, 5)`（**不写入 TanStack Query 缓存**，绝不干扰 `applyFreshWindow`）。
   - **重试节奏**：若第一次尚未查到（例如 RAG / 记忆检索耗时稍长），按 `400ms → 700ms → 1200ms → 1800ms` 节流复查，期间一旦命中 `msg.role === 'user' && msg.clientTurnId === clientTurnId`，立即用 `parseInlineTags(msg.content)` 按标签出现顺序提取 `kind === 'roll_result' && by === 'user'` 的 `dice` 与 `total`，随即中止探针。
   - **终态兜底共享**：若对话很快进入 `runReconcileStages`（`done` / `stopped` / `error`），`useChatRuntime` 在 `applyFreshWindow` 成功应用最新 `page` 时触发 `onTurnReconciled(page.messages, { conversationId, clientTurnId, outcome })`；探针未命中时直接从这批已取回的消息中解析 `<roll_result>`，零额外请求。
3. **动画对齐与定格**：
   - `DiceRollOverlay` 在 `onSend` 返回 `'accepted'`（且非 `staged`）时启动，记录 `rollStartAt = performance.now()`，以本地拟真速度保持滚动（**完全禁用**指针拨弄、Space、DeviceMotion）。
   - 当真实 `dice` 到位且 `elapsed >= 1350ms`（若晚于 1350ms 则在到达时刻立即衔接），为每颗骰子锁入目标点数 `dice[i]`，在 `420ms` 阻尼减速区间内收敛速度并翻面定格，同时展示总和与各骰明细；若 `d20` 出现 `20` 或 `1`，附加极克制的琥珀/绯红光晕。定格 `1500ms` 后执行 `280ms` 淡出并卸载浮层。
4. **失败 / 中断 / 暂存 / 无障碍收敛**：
   - **`outcome === 'rejected'`（前置拒发 / 4xx）**：立即中止，不开启或立即关闭 `DiceRollOverlay`，保留 `pendingDice`。
   - **`staged`（`acceptStaged`）**：后端暂存未掷骰，立即关闭 `DiceRollOverlay`，不等待 `roll_result`。
   - **流式错误且 `!wasUserPersisted`（`restoredTurn`）**：中止探针并关闭浮层，将 `pendingDice` 恢复到武装态。
   - **中断 / `stopped` / `uncertain_write` 且已离开 `live`/`reconciling`**：若已匹配到已落库的 `roll_result` 则正常定格展示后淡出；若进入 `blocked` 或 `idle` 仍无 `roll_result`（用户行未落库或网络彻底不可达），立即中止探针并优雅淡出关闭浮层，绝不无限转圈或编造假点数。
   - **`prefers-reduced-motion: reduce`**：跳过滚入与高速旋转动画，在收到 `roll_result` 后直接静态淡显结果面板 `1200ms` 后淡出（同时支持点击浮层空白/关闭按钮提前跳过展示）。

---

## 5. 核心功能二：所见即所得多色草稿便利贴（对齐重点 3）

### 5.1 6 色预设与 CSS 变量规范
在 `inlineTags/pinColors.ts` 与 `inlineTags.css` 中统一维护 6 色预设，严格对齐 `REQ §4.1` 与后端契约：

| `color` | `--itag-paper` | `--itag-paper-edge` | `--itag-paper-edge-2` | `--itag-ink` | `--itag-ink-mute` | `--itag-note-hover` |
|---|---|---|---|---|---|---|
| `butter`（默认） | `#f3e3a1` | `#e2cd7c` | `rgba(226, 205, 124, 0.7)` | `#3b3320` | `rgba(59, 51, 32, 0.62)` | `rgba(59, 51, 32, 0.12)` |
| `mint` | `#cbe5d4` | `#add1ba` | `rgba(173, 209, 186, 0.7)` | `#1f3829` | `rgba(31, 56, 41, 0.65)` | `rgba(31, 56, 41, 0.12)` |
| `blush` | `#f4cdd4` | `#dfadb7` | `rgba(223, 173, 183, 0.7)` | `#462229` | `rgba(70, 34, 41, 0.65)` | `rgba(70, 34, 41, 0.12)` |
| `sky` | `#cbe0f2` | `#a9c8e3` | `rgba(169, 200, 227, 0.7)` | `#1f3347` | `rgba(31, 51, 71, 0.65)` | `rgba(31, 51, 71, 0.12)` |
| `lavender` | `#ded3f3` | `#c3b4e2` | `rgba(195, 180, 226, 0.7)` | `#2e2445` | `rgba(46, 36, 69, 0.65)` | `rgba(46, 36, 69, 0.12)` |
| `crimson` | `#521b24` | `#3b1118` | `rgba(59, 17, 24, 0.78)` | `#f5eadc` | `rgba(245, 234, 220, 0.74)` | `rgba(245, 234, 220, 0.16)` |

- **crimson 专属细节**：
  - 胶带条 `::before` 在深底上调为微暖半透（`rgba(245, 234, 220, 0.22)`），避免过白刺眼；
  - 底部删除失败告警 `[role='alert']` 在 `crimson` 下改用高对比浅暖琥珀 `#ffd2a6`（替代普通浅底的 `#a3361f`）。

### 5.2 失焦吸顶、点击重编与防破坏校验
1. **纸片直写编辑器**：
   - 打开抽屉切至“📌 便利贴”时，渲染一张复用 `.app-itag-note` 视觉的编辑纸片，内置自动聚焦 `<textarea>` 与下方 6 枚圆点色卡按钮。
   - 编辑已有草稿时，纸片右上显示“编辑待发便签”小标识与“放弃/完成”轻量按钮。
2. **点击外部吸顶（Commit-on-Blur）**：
   - 当编辑器处于活跃且输入内容 `trim()` 非空时，监听文档级 `pointerdown`（捕获或冒泡阶段排除编辑器容器自身及调色圆点）或抽屉收起动作：
     - 若包含字面 `</pin>`（不区分路径，正则 `/<\/pin\s*>/i`），**拒绝吸顶并保留编辑态**，在纸片底部高亮提示“便利贴正文不能包含 `</pin>`”；
     - 校验通过则保存至 `draftPins`（新建或原地更新 `editingDraftId`），并立即在右上角 `PinBoard` 栈顶呈现为 `.app-itag-note--draft`（浅虚线外框 + `待发送` 角标）。
3. **点击重编与撤回**：
   - `PinBoard` 点击任意 `draft` 便签（排除 `×` 按钮）→ 触发 `onEditDraftPin(draftId)`，自动掀开 `ToyDrawer` 切至便利贴页签并回填文字与颜色。
   - 点击 `draft` 便签上的 `×` → 直接从 `draftPins` 移除，不发网络请求。
4. **发送交接与后端未就绪降级**：
   - 发送 `accepted` 后，`draftPins` 转为只读 `committingPins`（显示 `发送中…` 轻状态，不可点击重编/撕除），防止等待回复期间右上角便签闪烁消失；待 `applyFreshWindow` 触发 `conversation` 详情重读后（或轮次 settled 后）清除 `committingPins`，由后端 `inline_state.pins` 无缝接棒；若发送失败触发 `restoredTurn`，`committingPins` 还原为可编辑 `draftPins`。
   - **后端未加 `color` 字段时的平滑降级**：前端发出 `<pin color="mint">...</pin>` 已可被现版后端 `parser.py` 正常解析落库；后端序列化尚未返回 `pin.color` 前，`normalizePins` 自动回退 `"butter"`；后端合入 [2026-11-14-pin-color-backend-handoff.md](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/spec/2026-11-14-pin-color-backend-handoff.md) 后自动展现对应色系，零耦合。

---

## 6. 核心功能三：`<timer>` SVG 双腔玻璃沙漏美化（对齐重点 4）

### 6.1 组件结构与视觉呈现（`TimerHourglass.tsx`）
- **内联基线兼容**：外层沿用 `.app-itag-chip` 的内联胶囊对齐基线，附加 `.app-itag-timer` 修饰类，确保混排在 Markdown 段落中不撑乱行高。
- **SVG 双腔玻璃沙漏（`16×20` / `20×24` 紧凑比例）**：
  - 使用 React `useId()` 生成唯一 `clipPath` ID（上腔漏斗、下腔弧底），防止同一页面多颗沙漏互相遮罩串扰。
  - **动态沙量映射**：`ratio = clamp(remainingMs / (seconds * 1000), 0, 1)`：
    - 上腔余沙：高度随 `ratio` 线性下降（漏斗锥顶渐收）；
    - 中间细沙流：仅在 `state === 'running'` 且未开启 `prefers-reduced-motion` 时显示垂直细沙流微动效；
    - 下腔沙丘：高度随 `1 - ratio` 升高，顶部带微拱沙丘曲线。
  - **时间文本**：`倒计时 mm:ss`（`>= 3600s` 显示 `倒计时 hh:mm:ss`），配合 `font-variant-numeric: tabular-nums` 防止每秒数字跳宽；如有 `title` 则追加 ` · {title}`。

### 6.2 时间推算与历史过期兜底
1. **上下文注入（`TimerTimelineContext`）**：
   - 在 [MessageTimeline.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/MessageTimeline.tsx) 渲染每条持久化消息时，通过 `TimerTimelineContext.Provider` 提供：
     - `createdAt: message.createdAt`
     - `isResolvedByLaterMessage(title: string | null): boolean`：检查 `messages.slice(index + 1)` 中是否已出现匹配同一有效标题（`title?.trim() || '计时器'`，与后端 `timers.py` 的 `DEFAULT_TIMER_TITLE = "计时器"` 保持一致）的 `<timer_fired>` 或 `<timer cancel="...">`（通过 `parseInlineTags` 检查，只在存在后续相关消息时计算）。
2. **状态判定优先级**：
   - **已取消**：若后续消息有同名 `<timer cancel="...">`，或标签本身为 `<timer_cancel>` → 沙漏呈现横卧/停流灰调静止态：`已取消 · {title}`（注：`timer_cancel` 本身固定显示 `已取消 · {title}`）。
   - **已流尽（完成态）**：满足以下任一条件立即静止于“上腔空、下腔满”并带极微弱暖光，**不创建 `setInterval`**：
     - 后续消息存在同名 `<timer_fired>`；
     - `fireAtMs = Date.parse(createdAt) + tag.seconds * 1000` 已小于等于当前时间 `Date.now()`（覆盖三天前的历史消息、刷新重进等所有过期场景）；
     - `createdAt` 合法且倒计时归零。
   - **进行中（`running`）**：仅当 `remainingMs > 0` 且未被触发/取消时启动 `1000ms` 定时器每秒更新一次；归零瞬间立即 `clearInterval` 并收敛为流尽态。
   - **独立渲染兜底（无 `TimerTimelineContext`，如局部预览/测试）**：不强行乱跑倒计时，静态显示满沙起步或标准时长文本（如 `倒计时 mm:ss`），保证纯组件单测稳定确定。
3. **`timer_fired`**：
   - 继续保持 `timelineVisibility.ts` 中“纯 `<timer_fired>` 触发消息整行隐藏”的既有契约；若出现在非纯触发消息的文本内联位置，渲染为流尽泛暖光的小沙漏徽章（`计时到点 · {title}`）。

---

## 7. 实施步骤与依赖顺序

| 阶段 | 任务内容 | 主要涉及文件 |
|---|---|---|
| **Step 1：数据契约与颜色/骰子基础模块** | 定义 6 色预设与降级、扩展 `ConversationPinView` 与 `normalizePins`、扩展 `parse.ts` 的 `<pin color>`（保持旧夹具无损）、实现骰子表达式组装与校验工具。 | `pinColors.ts`, `diceTypes.ts`, `parse.ts`, `types.ts`, `api.ts` |
| **Step 2：PinBoard 多色升级与草稿态** | 变量化 `inlineTags.css` 纸张阴影与交互色，落地 6 色预设（含 `crimson`）；扩展 `PinBoard` 支持 `draftPins`（虚线 + `待发送` + 点击重编 + `×`）与 `committingPins` 过渡态。 | `PinBoard.tsx`, `inlineTags.css` |
| **Step 3：`<timer>` SVG 沙漏微件** | 实现 `TimerTimelineContext`、`TimerHourglass` 双腔 SVG 与历史过期/触发静止兜底，在 `InlineTagViews.tsx` 与 `MessageTimeline.tsx` 接入。 | `timerContext.ts`, `TimerHourglass.tsx`, `InlineTagViews.tsx`, `MessageTimeline.tsx`, `inlineTags.css` |
| **Step 4：2D 物理骰盘与游乐小抽屉 UI** | 实现 `dicePhysics.ts` 刚体模拟、`DiceRenderer.tsx` 宝石切面绘制、`ToyDrawer.tsx`（骰盘拖拽吸附 / 光标拨弄 / 甩盘 / Space 摇晃 / DeviceMotion 降级 + 便利贴直写失焦吸顶）。 | `dicePhysics.ts`, `DiceRenderer.tsx`, `ToyDrawer.tsx`, `inlineTags.css` |
| **Step 5：发送后开奖浮层与运行时联动** | 实现 `useComposerToys.ts`、`DiceRollOverlay.tsx`；在 `useChatRuntime.ts` 暴露只读发送关联信息与对账回调；打通 `ChatComposer.tsx` / `ConversationPage.tsx` 入口、门控、`stashedSubmissionRef` 回退恢复、只读 `roll_result` 探针与全量异常收敛。 | `useComposerToys.ts`, `DiceRollOverlay.tsx`, `useChatRuntime.ts`, `runtime/types.ts`, `ChatComposer.tsx`, `ConversationPage.tsx` |
| **Step 6：既有测试对齐与新增验证** | 同步更新受语义升级影响的既有断言（`inline_tags_cp2.test.tsx` 中 `normalizePins` 断言、`inline_tags_render.test.tsx` 中 `<timer>` 显示断言），并补充完整单元与集成验证。 | `packages/app/src/test/*` |

---

## 8. 消融检查与风险控制（Razor Check）

1. **避免过度抽象**：
   - 不做通用插件化“抽屉扩展框架”，只做清晰的骰盘 + 便利贴双 Tab；
   - 不引入外部物理库，2D 刚体引擎限定 ~200 行内纯函数/轻量状态更新。
2. **不造假想并发防御**：
   - 只读 `roll_result` 探针限定于**单次活跃普通发送且带有 `<roll=...>`**，不搞全局轮询定时器；一旦命中或轮次离开活跃态立即销毁定时器。
3. **跨模块不变量保护**：
   - **TanStack Query 单写原则**：早读探针只读 `fetchMessagePage` 返回体内存解析，绝不写入 `queryKeys.messages` 缓存；
   - **Force Cache 严格边界**：待发骰子与便利贴绝不触发 `hasSendableAttachments` / `Snowflake`；
   - **可访问性与降级**：全程尊重 `prefers-reduced-motion: reduce` 与 iOS `DeviceMotionEvent` 无权限静默降级，确保桌面端与手机 PWA 端均可单手完整操作。

---

## 9. 验收与测试目标（Verification Targets）

> 遵循 Planner 规范，此处仅冻结验证目标与接口边界，测试实现细节在施工阶段编写。

1. **类型检查与构建**：`pnpm --filter exo-app typecheck`、`pnpm --filter exo-app lint` 与既有全量 `pnpm --filter exo-app test:run` 全绿。
2. **Parser 与 Pin Color 兼容性**（`inline_tags_parse` / `inline_tags_cp2`）：
   - `inline_tag_parser_cases.json` 全量已有用例 100% 通过；
   - `<pin color="crimson">...</pin>` 正确解析 `color: 'crimson'`；未知 `color` 与缺失 `color` 均保留便签并回退 `'butter'`；
   - `normalizePins` 在后端未返回 `color` 字段与返回合法/非法 `color` 字段时均稳定输出合规 `PinColor`。
3. **Composer 门控与游乐小抽屉交互**：
   - 仅待发骰盘或仅待发草稿便签（正文为空）时发送按钮可用，点击发送提交合法 `<roll=...>` / `<pin color="...">...</pin>`；
   - `editingTarget` 与 `textOnly`（`<block>` 暂存）期间抽屉禁用且保留既有待发玩具，Force Cache 冰晶不因玩具出现；
   - 便利贴含字面 `</pin>` 时阻止吸顶并给出可见提示；点击纸片外部即吸顶 `PinBoard` 显示 `待发送` 虚线框，点击重编可修改，点击 `×` 本地撤回；
   - 请求确定性失败触发 `restoredTurn` 时，还原纯正文与未发出的骰子/草稿便签。
4. **骰盘双阶段与真值探针**：
   - 白名单面数与 `<= 8` 颗校验、`+ / -` 常数步进；
   - 发前支持光标拨弄、Space 摇晃与 `DeviceMotion` 回调映射；
   - 发后进入只读 `DiceRollOverlay`（屏蔽拨弄/Space），通过 mock `fetchMessagePage` 返回带 `client_turn_id` 与 `<roll_result ... dice="...">` 的 user 行，验证浮层停留在后端真实点数后淡出；
   - 覆盖 `rejected`、`staged`、无 `roll_result` 中断及 `prefers-reduced-motion: reduce` 的快速收敛。
5. **Timer 沙漏渲染与过期兜底**（`inline_tags_render`）：
   - `<timer>` 渲染双腔 SVG 沙漏与 `倒计时` 文本；
   - `createdAt + seconds <= now` 的历史消息与已有后续 `<timer_fired>` / `<timer cancel>` 的消息直接静止于流尽/已取消态，不残留活跃定时器；
   - 正常未过期消息每秒递减并按比例变化沙量，归零后停止定时并定格。
