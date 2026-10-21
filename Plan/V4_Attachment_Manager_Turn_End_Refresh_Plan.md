# V4 附件管理：回合结束时刷新

> **状态：草案，待 Alicia 定稿。**
> **Issue：** 待开
> **基线：** ExoCore-Desktop `main@5795e1a`；ExoCore 只读。
> **来源：** 2026-10-21 conv95 排查。不改后端契约。

## 0. 事实起点

- 后端从 e0abf00d（2026-10-06）起，在第 n 轮结束时把 ToolCollection 结果锚定为一条 `SessionAttachment`，并写进用户消息 n 的 `attachment_ids`。附件列表接口以 `source: "user"` 返回它，所以它属于可管理附件，期望效果是和前端上传的文档一样。
- 输入框上方的「会话附件（N）」（`UserAttachmentManager`，带 `hideWhenEmpty`）只在三个时机刷新：
  1. 进入会话（`ChatComposer.tsx` 挂载时的 effect）；
  2. 点击发送的那一刻（`ChatComposer.tsx` submit 之后）；
  3. 手动展开或点刷新。但列表为空时整个组件被隐藏，用户点不到。
- 回合结束时没有刷新。锚定附件在发送之后才生成，所以要等重新进入会话才会出现。
- 实例：conv95 用户消息 23222。14:41:17 发送时列表为空；14:42:20 回合结束，后端锚定生成 #1011；管理区一直不显示，直到重新进入会话。Alicia 已确认重进后可见。

## 1. 目标 / 非目标

**目标**：回合结束后，附件管理自动刷新一次，锚定附件当场出现在可管理列表里，不需要重进会话。

**非目标**：
- 锚定附件的显示名（目前用的是缓存文件名 `conv_95_...`，需要后端改，以后再说）；
- 气泡里文件卡的交互；
- 第二名单 / artifact 的分类问题；
- 后端的任何改动。

## 2. 设计

- 在 `ConversationPage.tsx`（`attachmentManager` 的持有者）里，当 `useChatRuntime` 返回的 `busy` 从 `true` 变为 `false` 时，调用一次 `attachmentManager.refresh()`。
  - `busy` 等价于 `opState.phase !== 'idle'`，覆盖普通发送、重生成、编辑和停止，这几种都可能产生锚定附件。
  - 只在边沿触发：用 ref 记住上一次的 `busy`，初次挂载不触发，因为进入会话时已有的刷新会处理。
- `refresh` 本身已经能处理删除进行中、路由切换和过期 epoch，这里不加额外判断。
- 发送时的那次刷新保留：它负责把刚上传的附件同步进列表。

## 3. 施工单元与文件

| 单元 | 文件 |
|---|---|
| R1 回合结束刷新 | `packages/app/src/features/chat/ConversationPage.tsx` |
| R2 测试 | `packages/app/src/test/` 下新增一个测试文件：模拟 busy 从 true 变为 false，断言附件列表接口被再次请求，且新行出现在「会话附件」里；初次挂载不产生额外请求 |

## 4. 验收

- `vitest` 全绿；`tsc`、`eslint`（app）通过；`vite build` 通过。
- 真机：在任意会话里发一条会触发 web_search 的消息。回合结束后，不重进会话，输入框上方就出现「会话附件（N）」，展开后能看到新的锚定附件，并且可以删除。

登记：砚（claude-opus-5-5）— 2026-10-21
