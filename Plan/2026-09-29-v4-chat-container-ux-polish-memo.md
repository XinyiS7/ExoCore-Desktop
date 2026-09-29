# V4 Chat 容器交互与视觉优化备忘录 (UX Polish Memo)

**日期：** 2026-09-29
**作者：** Alaric / Alicia
**范围：** `packages/app`（V4 前端纯 UI/UX 收口，零后端契约改动）
**关联组件：** `ChatComposer.tsx`, `MessageTimeline.tsx`, `MessageContent.tsx`, `RuntimeStatusBanner.tsx`, `UserAttachmentManager.tsx`, `shell.css`

---

## 1. 目标与背景

V4（`/app/`）在完成 P1 ~ P2D 及 CP-E（AI 语音消息播放器）的核心链路验收后，已具备作为日常主力聊天页的能力。但在实际使用中，存在四处影响输入流程度与屏幕视效的细节瑕疵：

1. **输入框定高且矮**：`rows={2}` 且 `resize: none`，内容变多时只能在两行内滚动，输入状态缺乏自适应弹性；
2. **复制按钮缺位**：用户消息、AI 消息和代码块缺少复制按钮，文本提取不便；
3. **生成状态条冗余**：输入框上方在生成时浮现满宽“正在思考与生成…”横条，与 AI 消息头像旁的状态文字完全重复；
4. **附件横条常驻占位**：`会话附件（0）` 在无任何附件时依然强行霸占一整行横条，浪费移动端宝贵的纵向空间。

本施工包对上述四项进行集中解决。

---

## 2. 优化方案细节

### 2.1 输入框自适应高度与弹性扩展 (ChatComposer)
- **行为基准**：
  - 初始为紧凑基准高度（约单行或双行高度，收起态干净利落）；
  - 随用户输入文本量变化，基于 `textarea.scrollHeight` 自动计算并平滑伸展；
  - 限制最大高度上限（如 `max-height: 200px`），超出最大高度后平稳溢出滚动（`overflow-y: auto`）；
  - 当消息发送、清空或撤销修改时，自动复位回初始基准高度；
  - 保持与 `@` 项目文件联想下拉列表的位置与层叠协调。

### 2.2 消息与代码块一键复制 (Copy Buttons)
- **代码块复制 (`MessageContent.tsx - CodeBlock`)**：
  - 在代码块头部右侧（语言标签旁）增加复制图标按钮；
  - 点击调用标准 Clipboard API，复制成功后在 1.5 秒内呈现 Check 成功反馈图标或 Tooltip；
  - 处理复制异常，避免静默失败。
- **消息全文复制 (`MessageTimeline.tsx - MessageRowItem`)**：
  - 在消息操作工具栏（与现有“编辑”、“分支”、“重试”并列）增加“复制”按钮（`<Copy size={12} /> 复制`）；
  - 支持用户消息与助手消息；
  - 点击后将纯文本内容注入剪贴板，呈现瞬时复制成功反馈。

### 2.3 消除冗余生成状态条 (`RuntimeStatusBanner.tsx`)
- **分析**：
  - AI 消息气泡头部已有 `<span className="app-muted">{runtimeAssistant.statusText || '生成中…'}</span>`，位置贴合上下文且轻盈自然；
  - `RuntimeStatusBanner.tsx` 中的 `app-runtime-banner--active` 仅是纯文本重复展示，无额外交互；
- **优化**：
  - 移除 `app-runtime-banner--active` 纯状态文本横条；
  - 严格保留 `RuntimeStatusBanner` 中真正的交互性告警与操作容器（未读新消息回到底部、网络同步重试、停止生成错误、草稿清理重试等）。

### 2.4 附件横条空状态隐匿 (`UserAttachmentManager.tsx` & `ChatComposer.tsx`)
- **分析**：
  - 附件管理主要用于用户查看并删除会话历史中上传的文件；
  - 当会话根本无任何附件时，显示 `会话附件（0）` 毫无意义，白白浪费纵向高度；
- **优化**：
  - 会话载入时主动检索附件状态；
  - 当 `rows.length === 0` 且无在途通知、未被用户主动展开时，完全隐匿外层横条容器；
  - 仅当检测到历史附件存在（`rows.length > 0`）或存在报错/通知时才浮现展示；
  - 用户新上传附件发送后，自动刷新并在有内容时呈现。

---

## 3. 验收与质量门禁

- 现有全量测试（1194 tests）与相关测试保持通过；
- 为新增交互（输入框 autoResize、复制按钮触发）增加有效单测或断言；
- `pnpm --filter exo-app typecheck` 0 错误；
- `pnpm --filter exo-app lint` 0 警告；
- `pnpm --filter exo-app build` 编译成功。
