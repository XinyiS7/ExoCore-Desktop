# 发送失败时不丢草稿、错误可见 Plan

- 日期：2026-10-06
- 作者：砚（claude-opus-5-5）
- 状态：**作废（2026-10-07）**。事故实际发生在 V4（packages/app），本 Plan 修的是 V3 chat-core。后端改由 `ExoCore/Plan/chat_sync_admission_preflight_plan.md` 处理，V4 前端兜底另写 Plan。
- 范围：`packages/chat-core`（前端）。后端不改。

## 1. 现象

Alicia 在会话 95（AGY / gemini-3.1-pro）发一条带 txt 附件的消息：

- 消息一帧不到就消失；
- 没有任何错误提示；
- 打好的文字和附件都没了。

之前"请求没有抵达 AGY"的情况表现相同。消息 21407 开头"刚才打了一大堆字结果不知道为什么出问题给卡掉了"也是同一个原因。

本次触发原因是后端 runtime 预检拒绝了 `text/plain`（`runtime_attachment_type_unsupported`），这个白名单另见 `ExoCore/Plan/runtime_attachment_mime_expansion_plan.md`。

本 Plan 只处理前端：**任何**发送失败都不应吞掉用户输入，也不应静默。

## 2. 根因（已对照源码确认）

`components/chat/ChatArea.jsx` 的 `handleSend`：

1. **发送时立即清空，失败时不恢复。**
   - `:944` `setInputValue("")`；
   - `:946–948` 释放 compose 附件预览 URL 并 `setComposeAttachments([])`；
   - `:953` 删除 localStorage 草稿；
   - 失败时只有 `AbortError`（用户主动中止）会把文字放回（`:1131–1136`），流内 `event:error`（`:1121–1127`）和其他异常（`:1138–1144`）都不恢复。
2. **`finally` 无条件清空 `pendingAttachments`**（`:1181`），失败时抽屉选择的附件也丢了。
3. **错误文案没有显示位置。** `sendError` 只作为 `errorText` 传给 `RecoverableAudioItem`（`:1684–1690`），而它只在存在语音重发项时才渲染。普通文字 / 文件发送失败时，`setSendError(...)` 写进了一个不显示的状态。
4. **后端给出的原因被丢掉。**
   - async 模式（Alicia 当前使用）：后端 `views.py:_consume_sse` 把 `{code, message}` 写进 `error_message`；`hooks/usePollingChat.js` 的 `pollLoop` 执行 `reject(new Error(pollData.error_message || ...))`，对象被转成 `"[object Object]"`；
   - SSE 模式：`:1088` 收到 `event:error` 后直接 `continue`，不读 data。
5. **一帧闪现**：先把乐观消息放进列表，失败后用 `preSendHistory` 回滚，`finally` 再从服务端重新拉一遍列表。

## 3. 目标行为

| 情况 | 文字 | compose 附件 | 抽屉选中的 pending 附件 | 错误提示 |
|---|---|---|---|---|
| 成功 | 清空 | 清空、释放预览 | 清空 | 无 |
| 任意失败（后端拒绝、HTTP 非 2xx、async `status=error`、SSE `event:error`、EOF 无 done、网络异常） | 放回输入框并写回 localStorage 草稿 | 原样放回（含预览） | 原样放回 | 显示，含后端给出的具体原因 |
| 用户中止 | 放回（保持现状） | 放回 | 放回 | 不显示错误 |

补充规则：

- **输入框已有新内容时**（失败前用户又打了字），不覆盖：把失败的文字放在前面，中间空一行，接上现有内容。
- **发送期间切换了会话**：把失败的文字写入原会话的 localStorage 草稿（`exo_draft_{sendSessionId}`），不写当前会话的输入框；附件不恢复（属于原会话）。
- **编辑重发失败**：恢复 `editingMessageId`，让用户可以直接再次提交编辑。来自重新生成按钮（`options.editMessageId`，无输入）的失败不恢复编辑态。
- **语音重发流程**（`recovery` / `failedUserMsgIdRef`）保持现有语义不变。

## 4. 改动

### 4.1 `hooks/usePollingChat.js`

`status === 'error'` 时，reject 一个带结构的错误：

```js
const err = new Error(typeof em === 'object' && em ? (em.message || em.code || 'Server error') : (em || 'Server error'));
err.code = typeof em === 'object' && em ? em.code : undefined;
```

`not_found` 和 HTTP 非 2xx 维持现状（message 为字符串）。

### 4.2 `ChatArea.jsx`

1. **发送前快照**：`currentInput`（已有）、`composeAttachments`、`currentPending`（已有）、`editingMessageId`、`sendSessionId`（已有）。
2. **发送时**：仍然立即清空输入框和附件（保持乐观体验），但**不在此时释放** compose 预览 URL。
3. **统一的失败恢复函数** `restoreFailedSend(reasonText)`，在三处失败分支调用：SSE 流结束非 done（`:1121`）、`catch` 非 Abort（`:1138`）、以及 async reject。它负责：
   - 按第 3 节规则放回文字、写回草稿；
   - 放回 compose 附件和 pending 附件；
   - 恢复编辑态（仅编辑流程）；
   - `setSendError(reasonText)`。
   `AbortError` 分支改为同样放回附件（文字放回已有）。
4. **成功时**才释放 compose 预览 URL。
5. **`finally` 中的 `setPendingAttachments([])`** 改为只在成功时执行。
6. **SSE `event:error`**：解析 data 中的 `message` / `code`，记录下来作为提示原因。
7. **错误提示**：在输入区上方新增一个通用提示条（样式参照现有 `cacheSkippedToast`，红色系），显示 `sendError`。
   - 文案："发送失败：{后端原因}。文字和附件已放回输入框。"，没有后端原因时用"发送失败（连接中断 / 网络错误）"；
   - 不自动消失，用户点关闭，或下次发送开始时（已有 `setSendError(null)`）清除；
   - `RecoverableAudioItem` 不再承担错误文案显示，避免同一条错误出现两次；现有测试断言的文本 `'发送失败，附件已保留'` 相应调整为新提示条的文案。
8. 闪现（乐观消息出现后被撤回）**保留**：失败后用户能看到文字回到输入框，这就是明确反馈；本期不改乐观显示策略。

## 5. 不改动

- 后端 SSE / async 错误格式；
- 语音录制、上传、重发逻辑；
- 乐观显示与 `finally` 中的服务端刷新（只改 `setPendingAttachments([])` 一行的条件）；
- 运行时白名单（另一个 Plan）。

## 6. 测试（vitest）

`ChatArea.test.jsx` / `usePollingChat.test.js` 新增：

| # | 场景 | 断言 |
|---|---|---|
| 1 | async 模式，status=error，`error_message={code:'runtime_attachment_type_unsupported', message:'Subscription Runtime accepts PNG, JPEG, and WebP images only'}` | 输入框恢复原文；compose 附件恢复；提示条可见并含后端 message；localStorage 草稿恢复 |
| 2 | SSE 模式，`event:error` 带 `{code, message}` | 同上 |
| 3 | POST 返回 HTTP 400 | 文字、附件恢复，提示条可见 |
| 4 | 网络异常（fetch reject） | 同上 |
| 5 | 失败时输入框已有新文字 | 新旧都在，失败文字在前 |
| 6 | 发送期间切换会话后失败 | 原会话 localStorage 草稿为失败文字；当前会话输入框不变 |
| 7 | 编辑重发失败 | 文字恢复且仍处于编辑态 |
| 8 | 抽屉 pending 附件发送失败 | pending 附件仍在 |
| 9 | 成功发送 | 文字、附件清空；预览 URL 被释放；无提示条 |
| 10 | 现有语音重发测试 | 全部保持通过（文案断言随第 4.2-7 调整） |
| 11 | `usePollingChat` | error_message 为对象时 `err.message` 为其 message、`err.code` 为其 code；为字符串时行为不变 |

回归：`pnpm --filter chat-core test`、`pnpm lint`、`pnpm build`。

手工：手机上对 AGY 会话发 txt（白名单放开前），确认文字和附件回到输入框、提示条显示原因。

## 7. 收尾

- `ReactSheet.md` 不涉及（不改接口形状）；
- 更新 `ExoCore/Plan/ExoCore_update_log.md`（或 Desktop 对应记录）；
- 验收后归档本 Plan。

**署名：** 砚（claude-opus-5-5）— 2026-10-06
