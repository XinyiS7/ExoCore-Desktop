# V4 Issue #32 Step 1B — 收藏消息正文施工方案与行为备忘 (Plan & Behavior Memo)

> **任务标识：** refs XinyiS7/ExoCore#32 (Step 1B)
> **执行范围：** 仅 V4 (`packages/app`)，严禁改动 V3 (`chat-core`, `chronicle`, `council`)。
> **状态：** 施工前方案与行为备忘（最小定案）。

---

## 1. 契约与业务目标

### 1.1 后端契约（已部署，零后端改动）
- **接口：** `POST /api/collection/items/`（**严格保留末尾斜杠**）。
- **请求体（JSON）：**
  ```json
  {
    "source": {
      "type": "message",
      "message_id": <message.id>,
      "text": "<message.content>"
    },
    "collection_context": "<optionalNote>"
  }
  ```
- **核心不变量：**
  - **原文完整性**：必须发送 canonical `MessageView.content` 原文，**严禁 trim 或重写**。后端以此计算 Message 来源 scope（`selected_text == message.content` 判定为全量 `full` scope，否则按 sha256 归入 `selection` scope）。
  - **附言规则**：附言可选（可空）。当附言非空时，发送修剪后的纯文本 `collection_context`；为空或未填写时缺省或忽略。
  - **响应分流**：
    - 首次收藏：HTTP `201 Created`，返回详情且 `collect_outcome = "created"`。
    - 同源重复收藏：HTTP `200 OK`，返回详情且 `collect_outcome = "already_collected"`（后端为当前收藏者计数 +1；若本次附言非空追加只增不改的评论）。
  - **错误结构**：统一使用 `{ "error": "<msg>", "code": "<code>" }`。
  - **路由独立性**：无须 `conversation_id`。

### 1.2 前端冻结 UI 与交互规范
1. **按钮位置与显隐判定**：
   - 位于 V4 persisted、正文非空的 `user` 与 `assistant` 消息的 hover action 区（即 `MessageTimeline.tsx` 的 `.app-msg-actions`）。
   - **严禁显示条件**：
     - `optimisticUser`（发送中草稿）；
     - `runtimeAssistant`（流式生成中/思考中）；
     - 空正文（`!message.content?.trim()`，如纯附件、纯语音合成错误或空消息）。
2. **弹窗交互（附言输入）**：
   - 点击“收藏”弹出轻量 Modal（`CollectMessageModal`）。
   - 严格遵循 `useDialogA11y` 焦点捕获、Tab 循环、Escape 响应与回退还原。
   - 提供可选附言输入框（`textarea`）。
3. **防重复提交**：
   - 提交期间锁定表单控件与取消按钮，同步 ref 拦截连击，Escape 在锁定时禁止关闭。
4. **诚实反馈边界**：
   - 成功反馈区分 `created`（“已加入收藏”）与 `already_collected`（“该消息已在收藏中，已记录再次收藏”）。
   - **严禁承诺读取**：不得显示或暗示可读取 count 计数或历史评论。
   - **禁止 filled-state**：本阶段无读取 API，消息卡片上的收藏按钮保持常规中性动作按钮，绝不做已收藏状态填充。

---

## 2. 模块拆分与架构设计

按照“保持 view 薄、adapter 独立”规范：
1. **独立 API Adapter** (`packages/app/src/features/collection/`)：
   - `types.ts`：定义 `CollectMessageSource`、`CollectMessageInput`、`CollectMessageResult`、`CollectOutcome`。
   - `api.ts`：封装 `collectMessage` 与 `CollectionApiError`，使用 `exo-shared/api` 之 `apiFetch`，继承 `AppApiError`。
2. **独立 Modal 视图** (`packages/app/src/features/collection/CollectMessageModal.tsx`)：
   - 薄呈现层，复用 `app-overlay` / `app-dialog` / `app-dialog-head` / `app-dialog-body` / `app-dialog-actions` 样式。
   - 包含原文引述、附言输入、错误警告、防连击机制及区分结果的状态提示。
3. **时间线集成** (`packages/app/src/features/chat/MessageTimeline.tsx`)：
   - 在 `MessageRowItem` 的 `.app-msg-actions` 内为满足条件的消息渲染“收藏”动作按钮（带 `<Bookmark size={12} />`）。
   - `MessageTimeline` 管理当前打开收藏的目标消息状态，并挂载 `CollectMessageModal`；支持可选外部回调 `onCollectMessage`。
4. **Focused Tests** (`packages/app/src/test/`)：
   - `collection_api.test.ts`：测试 `collectMessage` API 边界，验证 payload 字段（尤其是未 trim 的原文与附言处理）、201 created / 200 already_collected、以及契约/网络错误提取。
   - `collection_message.test.tsx`：测试 Timeline 显隐规则（persisted user/assistant 渲染、空正文不渲染、optimistic/streaming 不渲染）、Modal 打开、防重复提交、成功反馈分流与无 filled-state 验证。

---

## 3. 隔离守则（Discipline & Safeguards）
- **绝不改动 V3 目录** (`packages/chat-core`, `packages/chronicle`, `packages/council`)。
- **保护他人工作区**：工作区中现有的 `ReactSheet.md` 未暂存 hunk（音频契约）与 `Plan/chat_send_failure_recovery_plan.md` 绝对不触碰、不 stage。
- **Git 提交**：按规则只 stage 本次相关文件，提交说明为规范的 `refs XinyiS7/ExoCore#32`。
- **交付门禁**：运行完整测试套件，在验收门前停止并向 Solaire 汇报。
