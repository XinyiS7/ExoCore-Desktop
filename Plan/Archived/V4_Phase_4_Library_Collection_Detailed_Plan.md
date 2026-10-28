# V4 Phase 4 — Library「藏品管理」(Collection UI) Detailed Plan

> **状态：R6 已冻结（2026-10-15，Solaire 终检通过，F0 完成）。** R5 的主结构已经通过 Solaire 再审；R6 只机械补齐了两项契约漏项。下一步是 CP0（规格修订、mockup、Desktop acceptance spec）。各单元的生产代码要等对应的 acceptance spec 冻结后才动工。目前只写了 Plan、做了只读调研，没有改生产代码，也没有启用 Library 入口。
> **冻结前置（P1-5）：** 先开新 issue，回填本文件头和 #32 评论，本计划才能从 Draft 转为冻结候选。新 issue 建议是 #32 的子 issue「Library 藏品管理 UI + 人侧带回」，标签 `area:desktop`、`area:backend`。ExoCore-Runtime 默认不改生产代码，只做真实 probe 验证。
> **Issue：** XinyiS7/ExoCore#61（#32 子项；F0 于 2026-10-15 完成，#32 已留评论指向本 Plan）。
> **基线：** ExoCore `main@5a80a727`、ExoCore-Desktop `main@ca77f6f`；ExoCore-Runtime 当前 main，只作为只读核对对象。两仓 ReactSheet 第十三篇在 2026-10-15 用 diff 核对过，逐字节一致。
> **需求依据：** `../ExoCore/Plan/需求文档/REQ_20261005_Collection_Agent_Collect_Browse_BringBack_Spec.md`（下称 REQ）。人侧带回会改动 REQ 和若干 V4 规格条文，清单见 §11。
> **旧交接：** `Plan/V4_Phase_4_Library_Collection_Preparation_Handoff.md` 两仓各有一份，git 首次入库都是 **2026-10-04**（Desktop `5344e0d`、ExoCore `6749c209`），当时未获授权。本计划只把它当来源参考，逐条继承核对见 §2。

---

## 0. 事实起点（2026-10-15 跨仓核对）

| 事实 | 核对结果 | 证据 |
|---|---|---|
| Agent 侧 Collection 能力 | 1A/1B/2/3/4a/4b 已 PASS；#41、#43、#54、#55 已关闭 | REQ §13；#32 评论 |
| Library 一级入口 | 当前为 `enabled:false, phase:'P4/P5'`，没有路由 | `shell/navigation.ts`、`app/router.tsx` |
| Desktop Collection 客户端 | 只有 `collectMessage()` 和 `CollectMessageModal`（1B） | `features/collection/*` |
| 人侧 HTTP API | list / create / detail / PATCH / DELETE / original / representation content / retry / bring-to-chat / tags | `collection/{urls,views,serializers}.py`；ReactSheet §13.2 |
| HTTP list 筛选 | `kind` / `tag` / `q` / `recent` / `limit` / `cursor`。`CollectionQuery.month` / `link` 只给 Agent 用；`link` 的实现是 `text_content` 中出现 `http://` 或 `https://` | `views._collection_query`；`item_services.get_page` |
| 统计与评论 | `CollectionItemService.view()` 已存在；HTTP 没有人侧 view 计数入口，也没有统计或评论的读取接口；`_base_queryset()` 没有 prefetch `comments` 和 `viewer_stats` | `item_services.py` |
| Agent 名称字段 | `AgentPreset` 只有 `name`（unique），**没有 `display_name`** | `agents/models.py` |
| 标签 | PATCH `tags` 是对**本 item 的标签关联**整组替换；共享的 `CollectionTag` 行不随 item 删除；没有改名或合并 | `_replace_tags`、`list_tags` |
| 删除 | 硬删 Item；stats、comments、标签关联级联删除；Asset 进入延迟 GC | `item_services.delete` |
| 旧 HTTP bring-to-chat | 没有前端消费方。后端引用分布在：生产代码 `bring_to_chat.py`、`views.py`、`urls.py`，`serializers.py` 里的 `capabilities` 中 `"bring_to_chat"` 和 `bring_to_chat_url`；docstring `collection/apps.py`、`collection/gc_services.py`、`memory/assistant_artifacts.py:433`；测试 `collection/tests/test_cp4_representations.py`、`agents/tests/test_browse_collection.py`，以及验收方 probe `collection/tests/acceptance/test_gc_read_failure.py`。ReactSheet 中涉及它的有：§13.2 路由行、§13.4 的 `capabilities` 和 `bring_to_chat_url`、§13.5、§13.6 中 `collection_target_not_g045` 一行，以及 `asset_verification_failed` 的触发面描述 | 跨四仓 grep |
| `asset_verification_failed` 的触发面 | 不止 bring-to-chat 一处，还包括：`collection/services.py`（资产校验）、`agents/services.py:1694`、`engines/attachment_manager.py:382` | grep |
| Agent bring_back 卡 | 落在 `AssistantArtifact` 上，只挂 assistant Message；原件经 `MessageAttachment` 复制进 chat 域；descriptor 由 **`agents/tool_handlers/collection.py` 里的私有函数 `_show_descriptor`** 构造，由 `memory/assistant_artifacts.py` 的 `_validate_collection_descriptor` 校验；text 藏品正文为空时以 `empty_text` 拒绝 | 对应源文件 |
| **presentation 附件只允许 assistant** | 服务层 `MessageAttachmentService.reserve()`（`memory/message_attachments.py:441`）在 `message.role != "assistant"` 时拒绝；**表本身没有 role 约束**。现成可复用的 primitive：`presentation_draft_for_original`（:203）、`publish_copied_file`（:550）、`attachment_read_models_for_messages`（:349） | 源码 |
| Desktop 附件下载白名单 | `AttachmentFileCard.tsx` 里 `DOWNLOADABLE_SOURCES = {'collection_item'}`；人侧复用这个 source，不用改 | 源码 |
| Direct 出站 user content seam | `agents/services.py:1537-1553`：当前回合（非 regenerate）把 request-scoped 的 `turn_name_block` 追加到出站 `final_messages[-1].content`，**不写进 DB 里的 `Message.content`** | 源码 |
| Runtime 当前 user 输入 | `TurnRequest.user_message` 是 ExoCore 构造的当前 user 输入字符串；validator 只要求“text 或 attachments 至少有一个”。藏品文字块追加进这个字符串之后，只带卡片的回合也是非空的 | `ExoCore-Runtime/.../contracts.py` |
| 现有事务 seam | Runtime：`bridge/subscription_runtime/bindings.py::prepare_turn_with_user_message_locked`（create callback 在它的事务里执行）。Direct：user INSERT **没有外层 atomic**；assistant 侧的 `_persist_direct_assistant_result`（`agents/services.py:1979`）有“canonical + sidecar + 回滚后补偿”的范式 | 源码 |
| 顺序纪律先例 | `agents/models.py::RuntimeCollectionShowBuffer` | 源码 |
| Direct 空正文锚点 | `allow_empty_anchor = bool(files or pending_attachments)` | `agents/services.py` 约 1146 行 |
| regenerate 与附件 | Runtime 在 `edit_message_id` 加 `pending_attachments` 时报 `runtime_attachments_unsupported` | `agents/runtime_turn.py` 约 326 行 |
| Composer 发送门 | 非编辑态下，`text.trim()` 为空、`successfulIds` 为空、也没有录音时禁止发送 | `ChatComposer.tsx` 约 674 行 |
| V4 对话框 | V4 没有 ModalShell；对话框可达性用 `features/chat/dialogA11y.ts::useDialogA11y` 加内联 dialog 实现（参考 `ConversationDeleteConfirmDialog.tsx`） | 源码 |
| 视觉稿 | 还没有 | `Plan/` |

**结论：**
- **ExoCore：** 一个小切片（CP-B1）；人侧带回，并删除旧端点（CP-B2）。
- **Desktop：** Library UI，加 chat 侧的发送和卡片渲染。
- **ExoCore-Runtime：默认零生产改动。** 藏品文字块走现有的 `user_message` 字符串 seam；CP-B2 只需用真实 Runtime probe 证明“当前回合一次、历史每个 user turn 一次”。

CP-B2 的结构（Solaire 2026-10-15 裁决，R5 修订）：
- 新增 `memory.UserCollectionShow` sidecar；
- `MessageAttachment` 在现有服务里开一个窄入口，source 复用 `collection_item`；
- 同一个 prepared bundle 同时供出站和持久化使用；
- descriptor、模型文字块、人眼卡片投影三者同源。

详见 §10.2。

---

## 1. 目标 / 非目标

### 1.1 目标

1. 一级导航 **Library = Collection**（D1）。Memory 不进 Library，P5 在 Agent Profile 里管理。
2. 拍立得墙：按类型、Tag、关键词、最近 30 天、自然月、含链接筛选，用 cursor 分页。
3. 点卡片放大，可以查看或播放原件，并显示派生状态、描述、收藏理由、Tags、来源、统计和评论。打开或播放算 Alicia 的一次 view。
4. 编辑元数据（title、description、collection_context、tags、文档人工校准）。
5. 二次确认后永久删除。
6. **人侧带回**：在 Library 单选或多选（每回合最多 5 张），选一个 G045 会话，跳转后藏品以待发卡的形式出现在 composer 里，不碰草稿；随下一条消息发出。
   - Alicia 这条消息上显示的卡片，和 Agent bring_back 卡同形。
   - 阿莱看到 descriptor，看不到原件。
   - Alicia 的 `show_count` +1。

desktop 和 mobile 用同一套业务实现。

### 1.2 非目标

- archive、trash、软删、撤销；
- 标签改名、合并、批量操作、Tag 管理页；
- 语义检索或向量检索（#60）；
- 随机翻看；
- 人侧手动新建藏品，批量编辑或删除（多选只用于带回）；
- 人侧写、改、删评论（REQ §7）；
- Chronicle promotion（#31）；
- REQ §13 Step 5；
- Memory / Plasmid（P5 Agent Profile）；
- 藏品卡的专属视觉（以后另做）；
- 真实波形、时长、页数这类契约里没有的元数据；
- regenerate / edit 时带藏品卡（本期拒绝，§10.2）。

---

## 2. 旧交接（10/04 Preparation Handoff）继承核对

| 旧条目 | 现状 | 处理 |
|---|---|---|
| B1 硬门 | B1 已独立验收 PASS，ReactSheet 已同步 | 已满足 |
| mockup 须经 Alicia 批准 | 尚无 | **继承为 CP0 硬门** |
| 四类浏览，原件与派生可区分 | 仍然有效 | 继承 |
| transcript / neutral description / summary 的状态可见 | migration 0007 已删除这些 representation | **作废**，改为 `image_preview`、`audio_playback`、`document_extracted_text` 三种派生的状态可见；相应规格文档改写见 §11 |
| P4 接管新 bookmark writes | Step 1B 已交付 | 已完成 |
| search target / g045 授权 | B1 和 Step 2 已实现 | 已满足 |
| Library 是 canonical 容器，P5 Memory 复用 | **被 D1 取代** | 规格文档修订见 §11 |
| desktop/mobile 同一实现 | 仍然有效 | 继承 |
| 收藏内容能带回聊天 | 由人侧带回的新语义实现，旧 bring-to-chat 退役 | 改写 |
| C4 回滚：停用入口，不批量删除 | 仍然有效 | `library` 改回 disabled，并隐藏带回入口；已发出的卡片保留 |

P4 验收归档时，旧 handoff 的两份副本一起 `git mv` 到 `Archived/`。

---

## 3. IA、路由与页面状态

### 3.1 路由

```text
/library                 拍立得墙
/library/items/:itemId   放大态（嵌套路由，叠在墙上；可深链、可刷新）
```

- `navigation.ts`：`library` 设为 `to:'/library', enabled:true`，去掉 phase chip，新增 `isLibraryActive`。
- 不加子导航，也不放 Memory 占位。
- 筛选条件进 URL search params：`kind` / `tag` / `q` / `recent` / `month` / `link`。cursor 不进 URL。

### 3.2 墙的状态

| 状态 | 呈现 |
|---|---|
| 首屏 loading | 拍立得骨架 |
| 首屏 error | 整页错误加“重试” |
| 无藏品 | “还没有藏品”，并说明可以从聊天消息上的收藏按钮添加 |
| 筛选无结果 | “没有匹配的藏品”，加“清除筛选” |
| 续页 loading / error | 保留已加载的部分；出错时显示“加载失败，重试” |
| end | “已到底”（宽屏放在墙底；窄屏在最后一张之后） |
| `malformed_cursor` | 从第一页重新遍历，并提示“列表已刷新” |

### 3.3 放大态的状态

loading、404 `collection_item_not_found`（显示“藏品不存在或已删除”）、error 加重试、ready、saving（不做乐观改写）、deleted（收起放大态并从墙上移除这张卡）。

---

## 4. 拍立得墙

### 4.1 卡片（D2；细节在 CP0 视觉稿冻结）

上半部是内容区，下方留白处放信息。

- **内容区**
  - image：按 ReactSheet 公开的 `image_preview` content 路径拼出缩略图 URL，加 `loading="lazy"`；`onError` 时回退为图片符号。
  - audio：音乐符号，加一个明确的播放按钮。
  - text：开头几行，取 list 的 `preview`。
  - document：文件类型符号，加 title；没有 title 时写“文档 #id”。
- **信息区**：title（为空时依次用 description 首行、“未命名”），收藏日期（本地时间），前 2–3 个 Tags；有收藏理由时加一个标记。
- **多选**：墙顶加“选择”开关，只用于带回；最多选 5 张，选第 6 张时提示上限。

### 4.2 布局

- 宽屏：小拍立得网格。
- 窄屏：一次一张，左右滑动（scroll-snap，同时提供按钮和左右键）；滑到倒数第 3 张时预取下一页。

### 4.3 筛选

| 筛选 | 参数 | 说明 |
|---|---|---|
| 类型 Tab | `kind` | 全部 / 文字 / 图片 / 语音 / 文档 |
| Tag chip（单选） | `tag` | 来源是 `/tags/` |
| 搜索 | `q` | debounce 约 300ms；文案写“关键词匹配” |
| 最近 30 天 | `recent=1` | |
| 月份 | `month=YYYY-MM` | 本地自然月；和 `recent` 同时生效时取交集，UI 上写明 |
| 含链接 | `link=1` | 只匹配 `text_content` 里出现的 `http(s)://`，标题、描述、提取文本都不算。实际效果是只会命中文字藏品，所以在非“文字”Tab 下打开时，提示“仅文字藏品正文可能含链接” |

### 4.4 分页

- `useInfiniteQuery`，`limit=24`。
- 筛选一变就重新遍历；`retry:false`；`staleTime:Infinity`；focus 或 reconnect 时不 refetch；卸载时 `removeQueries`。
- cursor 不跨筛选复用；排序以服务端为准。

### 4.5 计数边界

曝光、缩略图、翻页、筛选、滑动都**不计 view**。

---

## 5. 放大态：详情与编辑

### 5.1 打开与计数

- 点卡片：放大，进入 `/library/items/:id`，发 `GET detail`（不计数）。
- 点音频卡上的播放键：等同打开，ready 后自动开始播放。
- 首次渲染成功后，发一次 `POST /items/<id>/view/`（见 §8）。

### 5.2 内容（排列由视觉稿决定，内容不增不减）

1. **原件区**
   - image：先显示 preview，点开看原件；preview 不是 succeeded 时直接用原件，并标“预览不可用”。
   - audio：`<audio controls>`，优先用 `audio_playback`，否则用原件。
   - document：“打开原件”。
   - text：全文，保留换行，可以选中复制。
   - 没有 `read_original` 能力，或请求返回 404：显示“原件不可用”。
2. **派生状态**：每种 representation 显示 `state`；failed 时附 `error_code` 对应文案；有 `retry_url` 时显示“重试”；遇到 409 `derivation_not_retryable` 时提示后刷新。
3. **文档提取文本**：长文折叠；提供“人工校准”（PATCH `manual_representation`）。
4. **描述**（为空时显示“暂无描述”）、**收藏理由**、**Tags**。
5. **来源**：
   - 来源类型用人话名称；
   - 角色只写“用户”或“助手”；
   - 显示原消息时间，取自 `source.snapshot.message.created_at`；
   - 当 `source.available` 为真、且 **`source.snapshot.message.conversation_id`** 存在时，显示“打开来源会话”，链接到 `/chat/<id>`；只打开会话，不定位到具体消息。
6. **统计与评论**（§8）。
7. **操作**：带回聊天（单个）、编辑、删除。

### 5.3 编辑（PATCH，不做乐观更新）

| 字段 | 约束（仍以服务端 400 为准） |
|---|---|
| `title` | ≤255 |
| `description` | trim 后 ≤500，带计数器 |
| `collection_context` | 显示为“收藏理由” |
| `tags` | ≤32 个，每个 ≤50；整组提交；文案写“这一件藏品的 Tags” |
| `manual_representation` | 只对 document 的 `document_extracted_text` 开放，不能为空 |

- 保存成功：用响应里的 detail 替换缓存，墙上那张卡做局部 patch；Tags 变化时 invalidate `/tags/`。
- 400：提示“内容不合法，未保存”，表单内容保留。

---

## 6. 删除

- 确认对话框使用 `useDialogA11y` 和 V4 内联 dialog 模式，参照 `ConversationDeleteConfirmDialog.tsx`，**不 import V3**。默认焦点放在“取消”上。
- 文案：“永久删除这件藏品，不可恢复。它的收藏理由、评论、浏览统计和本藏品的标签关联会一起删除（标签本身仍保留在其他藏品上）。已经带进聊天的藏品卡不受影响。”
- 204 时：收起放大态，从已加载页移除这张卡，invalidate `/tags/`。404 视为已删除。删除进行中禁用按钮。
- composer 里还没发出的卡，如果对应藏品已被删除，发送时会被拒，处理见 §7.5。

---

## 7. 人侧带回

### 7.1 Alicia 已定语义（2026-10-15）

1. 藏品卡随 Alicia 本回合的 user message 发出；阿莱在 payload 里看到“本回合人类带回藏品 #N”，以及和 Agent bring_back 同形的 descriptor。
2. 阿莱看不到原件，需要时自己调用 `inspect_original`。
3. Alicia 消息一侧的卡片和 Agent bring_back 卡**同源**：用同一份 descriptor、同一个人眼投影（`project_human_card`）、同一个前端组件；只有外层的记录类型因说话人不同而不同。
   - 原件复制进 chat 域，作为只给人看的呈现附件；
   - 卡片显示收藏理由（非空时）；text 卡另外显示正文（见下文，这是对 #55 reason-only 的明确修订，两侧同时生效）；
   - 不受藏品之后的编辑或删除影响；
   - **呈现附件不进入模型输入。**
   - text 藏品**同样以藏品卡的形式挂在附件位置，绝不填进消息正文**（不写 `Message.content`，不进输入框）。卡片正文始终取自 descriptor 快照里不设上限的 `text`，**不用 `description` 代替**（`description` 仍是独立的、≤500 字的客观描述）；没有媒体副本。快照完整保存；长文的呈现方式 Alicia 以后再定，本期限高、内部滚动，以后改成折叠也只改组件，不动快照。
4. 不碰输入框草稿。
5. 支持多选，每回合最多 5 张。只有卡片、没有正文的消息也可以发送，不另外加约束。
6. 每张被接受的卡片给 Alicia 的 `show_count` +1。
7. 删除旧的 `POST /items/<id>/bring-to-chat/`。

### 7.2 Desktop 交互

1. 两个入口：放大态里的“带回聊天”，以及墙上多选后的“带回聊天（N）”。
2. 会话选择器只列 `agentType === 'g045'` 的会话，按最近活跃排序，默认选 Prime。
   - **没有可用 G045 会话时**，显示“还没有可以带回的 G045 会话”，确认按钮禁用，附一个去 Chat 新建会话的链接。
3. 确认后跳转到 `/chat/<id>`，router state 携带 `{ collectionCards: [itemId, …] }`。`ConversationPage` 把这些卡放进 composer 的待发卡区：
   - 不调用任何服务端写接口；
   - 标题用 `GET detail` 取（不计数），取不到时显示“藏品 #N”，不阻塞发送；
   - 消费完立刻 `navigate(..., {replace:true, state:null})`。
4. 待发卡归 `useComposeAttachments` 所有，离开会话就清空（D9）。同一个 item 去重。总数上限 5，加卡时就在客户端拦住。
5. **编辑态（`editingTarget`）下**，待发卡不可用：卡片区置灰，提示“编辑消息时不能带藏品”，发送 body 也不带这些卡。服务端同样会拒绝（§10.2）。
6. 发送：body 增加 `collection_items: [id, …]`，按加入顺序。只要有至少一张待发卡，空正文也允许发送。
7. 发送后走 canonical 刷新；卡片由服务端投影渲染。

### 7.3 Alicia 消息一侧的卡片

- **同一个前端 domain shape 和组件。** Agent 侧的 `assistant_artifacts[]`（collection producer）和人侧的 `collection_shows[]` 是两种投影外壳，Desktop 把它们 normalize 成同一个 `CollectionShowCard`：`{key, itemId, itemKind, title, detail, text?}`。两侧都用同一个 `CollectionShowCardView` 渲染。`title`、`detail`、`text` 由后端共享的 `project_human_card` 给出，前端不自己拼。
- 标题“从藏品馆带回 · <类型> #N”；`detail` 只在收藏理由非空时出现。
- 媒体由现有的 `MessageAttachments` 显示一次，卡片本身不渲染媒体。
- **text 卡：** 显示 `text`（保留换行），加上非空的收藏理由。卡片挂在附件区，和正文气泡分开；消息正文为空时不出现空气泡。本期限高，内部滚动。**Agent 侧的 text 卡同时生效**（#55 修订，见 §11）。
- 点卡片跳转到 `/library/items/N`；藏品已删除时，点击后提示“藏品已不存在”。
- 卡片上没有收藏按钮。专属视觉以后替换，组件边界留好替换余地。

### 7.4 后端契约要点

完整内容见 §10.2，这一节只列 Desktop 依赖的部分：
- 发送 body 字段 `collection_items`（HTTP 层），Direct 和 Runtime 两条路径都接受；ExoCore 与 Runtime 之间的 wire 不变；
- 稳定的错误码；
- user Message 读取投影新增 `collection_shows[]`，卡片字段来自共享的 `project_human_card`；Agent 侧 collection artifact 的投影对 text 也增加 `text`；
- 人侧呈现附件进入 user Message 的现有 `attachments[]` 投影，`source` 沿用 `"collection_item"`（说话人由 `message.role` 判定）。

### 7.5 错误

| 情形 | 呈现 |
|---|---|
| 藏品不存在或已删除（`collection_bring_item_not_found`，错误体带 `item_id`） | 沿用现有的发送失败呈现；草稿、文件附件和其他卡片都保留；**按 `item_id` 把对应的卡标成 rejected**，并提示移除 |
| 原件不可用（`collection_bring_original_unavailable`，带 `item_id`） | 同上；对应的卡标红，提示“原件不可用” |
| text 正文为空（`collection_bring_empty_text`，带 `item_id`） | 同上；对应的卡标红，提示“这件文字藏品没有正文” |
| 超过上限（`collection_bring_too_many`） | 客户端预先拦住；服务端拒绝作为兜底 |
| 编辑态带卡（`collection_bring_unsupported_with_edit`） | 客户端预先拦住；服务端拒绝作为兜底 |
| 非法参数（`collection_bring_invalid`） | 通用发送失败 |

**错误体契约（冻结）：** 针对单个 item 的错误（`item_not_found`、`original_unavailable`、`empty_text`）必须带上可以定位的 `item_id`。整请求错误（`invalid`、`too_many`、`unsupported_with_edit`）不要求带 `item_id`。

**任何失败都不丢卡：** 无论是普通发送失败，还是 accepted 之后没落盘的失败，恢复时卡片都按原顺序回到 composer，草稿和文件附件也一起回来。

---

## 8. 评论、统计与 view 计数

- **view**
  - 每次打开放大态计 1 次，用打开时的 `location.key` 去重（防 StrictMode 双挂载、重渲染、PATCH 后的 refetch）。
  - 放大态里播放不再另计。
  - **POST 成功后**，把返回的 `view_count` 和 `last_viewed_at` 合并进当前 detail 缓存中 human 那一行 `viewer_stats`（行不存在就补一行），这样统计行当次就是对的。
  - POST 失败不阻塞，统计行显示“本次浏览未记录”，不自动重试。
- **统计行**：每个 viewer 一行。human 显示为“你”；Agent 显示后端给的 `label`（来自 `AgentPreset.name`）。显示看过、带回、收藏三个次数；没有统计行时显示 0。
- **评论区**：按时间正序的只读扁平列表，只显示 `author_label`、时间、正文。

---

## 9. 统一错误、空与加载规则

- 所有请求都走 `apiFetch`，失败包成 `CollectionApiError`，保留 `code`，文案按 code 映射。
- 内容 404 统一视为 `collection_item_not_found`。
- 不为 ReactSheet §13.6 里未实现的 code 写分支。
- 不做乐观更新，不做静默降级。
- loading 区域配可读文字，并设 `aria-live="polite"`。

---

## 10. 后端与跨仓改动

### 10.1 CP-B1 小切片（ExoCore，不加 migration）

| ID | 内容 |
|---|---|
| G1 | `POST /api/collection/items/<id>/view/`：调用 `CollectionItemService.view(viewer=HUMAN_COLLECTOR)`，返回 `200 {"view_count": int, "last_viewed_at": "<ISO>"}`；item 不存在时返回 `404 collection_item_not_found`，不计数 |
| G2 | detail 新增两个字段（**仅 detail 有，list 没有**），GET 不计数：<br>• `comments: [{author_type: "human"\|"agent", author_label: str, body: str, created_at: ISO}]`：按 `created_at, id` 正序，**不暴露 `author_key`**；<br>• `viewer_stats: [{viewer_type, viewer_key, label, view_count, show_count, collect_count, last_viewed_at\|null}]`：human 的 `label` 是 `"Alicia"`；`preset:N` 的 `label` 是 `AgentPreset.name`；preset 已不存在时 `label` 为 `"preset:N"`。<br>viewer 和 comment 的 label 投影**在 collection 内抽成一个 helper**，HTTP detail 和 Agent browse（`agents/tool_handlers/collection.py` 中的 `_detail`、`_stats`）共用。Agent browse 里现有的硬编码口径改用这个 helper，不留第二套口径。CP-B1 需要先核对 Agent browse 当前输出，并保证它的输出逐字不变；如果会变，必须登记成显式修订。<br>detail 查询 **prefetch `comments` 和 `viewer_stats`**，避免 N+1；`_base_queryset` 不能给 list 也加上这两个 prefetch，需要单独提供一个 detail 用的查询 |
| G4 | list 透传 `month` 和 `link`。`month` 必须是严格的 `YYYY-MM`，非法时 400 `invalid_request`。`views._collection_query` 里现有的 `recent` 布尔解析（`_TRUE_VALUES`、`_FALSE_VALUES`）**抽成一个共用的 bool parser**，`recent` 和 `link` 都调用它：大小写不敏感的 `1\|true` 视为真，`0\|false` 或空视为假，其他值返回 400。匹配语义沿用 `CollectionQuery.link`（只看 `text_content` 里的 `http(s)://`）。cursor 已经绑定了这两个参数 |
| G3 | 不改后端；缩略图由客户端按约定的 URL 拼出 |

- **文件：** `collection/views.py`、`urls.py`、`serializers.py`，以及在 `item_services.py` 里加 detail 查询。
- **测试：** `collection/tests/` 覆盖以下情形：
  - view +1，404 时不计数，不影响 agent 行，GET 不计数；
  - `comments` 和 `viewer_stats` 的投影，包括没有行、`preset:N` 解析出 label、preset 已删除；
  - `month` 和 `link` 的正常值与非法值；
  - list 的查询数没有回归。
- **需要独立的后端 acceptance spec（P1-5）。**

### 10.2 CP-B2 人侧带回（ExoCore 独立 Plan；**acceptance spec 在施工前冻结**；Runtime 默认零改动）

ExoCore 的 Plan 文件名为 `Plan/Collection_Human_Bring_Back_Plan.md`。以下各项是本计划交给 CP-B2 的硬性要求。总原则是**接现有 seam，不新造结构或协议**。B2 调研中如果发现某个现有 seam 确实满足不了要求，必须带着正面证据重新申请，不能预先造好字段或类。

**(a) 持久化结构**

1. **`AssistantArtifact` 保持只属于 assistant**，所有权语义不变。
2. **`UserCollectionShow` 放在 `memory` app**，作为 Message 的 sidecar（additive migration，CreateModel）：
   - `message`：FK 指向 user Message，CASCADE；
   - `item_id`：整数，**不设 FK**；
   - `descriptor`：JSON 快照，由共享的 `validate_show_descriptor` 校验；
   - `position`；
   - 唯一约束两个：`(message, item_id)` 和 **`(message, position)`**，顺序纪律参照 `RuntimeCollectionShowBuffer`。
3. **复用 `MessageAttachment`，不新增 source。** 沿用现有的 `source="collection_item"`；说话人由 `message.role` 和 `UserCollectionShow` 判定。
   - 专用入口固定放在**现有的 `MessageAttachmentService` 里**，例如 `reserve_user_collection(...)`。它只接受 `message.role == "user"`、`source == "collection_item"`，且这条 Message 已经有对应的 `UserCollectionShow`。
   - 通用的 `reserve()` 仍然只接受 assistant。
   - 两个入口在内部下沉共用同一个 reserve/publish primitive，复用 `presentation_draft_for_original`、`publish_copied_file`、现有的 StoredAsset 校验，以及 `compensate_after_rollback`。**不得复制出第二套媒体流水线或计数流水线。**
   - 同步更新 Change Guide 和 low-level writer audit。不新增外部的低层调用方。
   - 测试要证明：通用入口仍然拒绝 user Message；专用入口拒绝非 user 的 Message、拒绝其他 source、拒绝没有对应 `UserCollectionShow` 的 Message。
4. **严禁使用 `SessionAttachment`。**
5. **text 藏品只建 `UserCollectionShow`**，不建媒体附件，绝不写进 `Message.content`。正文为空时拒绝，与 Agent 侧的 `empty_text` 一致。
6. **读取投影：** 新增 `user_collection_show_read_models_for_messages(messages)`，一次查询批量投影，接进 `MessageListSerializer` 的 cache（和 `attachment_read_models_for_messages`、`artifact_read_models_for_messages` 同一个模式）；**禁止逐条 message 查询**。投影字段：`{key, item_id, item_kind, position, title, detail, text?}`，由 `project_human_card` 生成。
7. 保留 `AttachmentProvenance.origin_collection_item_id`，本期不删这个死列。

**(b) 共享 base（纯函数，Agent 和人侧都必须调用）**

`collection/show_descriptors.py`：

| 函数 | 现有来源（抽出后删除原实现） |
|---|---|
| `build_show_descriptor(item)` | `agents/tool_handlers/collection.py::_show_descriptor` |
| `validate_show_descriptor(d)` | `memory/assistant_artifacts.py::_validate_collection_descriptor` |
| `render_model_details(d)` 和 `render_model_block(d, context)` | `_collection_heading`、`_collection_details`、`_collection_live_continuity`、`_collection_heartbeat_continuity`。**`context` 取三种值：`agent_live`、`agent_heartbeat`、`human`**；前两种的输出必须和现状逐字一致（#54 回归） |
| `project_human_card(d)` | `_collection_human`；对 text 卡增加 `text` |

- 三个调用方：Agent live、Agent heartbeat、人侧带回。外层的记录类型和锚点可以不同；descriptor、模型文字块、人眼卡片投影三者同源。
- Direct 和 Runtime 用到的文字块都由这个 renderer 生成。Runtime 拿到的就是 ExoCore 拼好的字符串，Runtime 侧不需要知道藏品。

**(c) Prepared bundle：一次构造，两处使用**

- preflight 时一次性构造 `PreparedUserCollectionShow`，是不可变 bundle，每个 item 包含：item id、order、经过校验的 descriptor、渲染好的 `human` 文字块、媒体草稿（`presentation_draft_for_original` 的结果；text 卡没有媒体草稿）。区分 text 和媒体、决定要不要出媒体草稿时，**复用 `agents/collection_shows.py::_presentation`**；需要的话把它抽进共享 base，不另写第二套分类。
- **同一个 bundle** 既用于当前回合的出站 `user_message`，也用于之后的持久化。**禁止重新读取 item，禁止第二次拼 descriptor。**

**(d) 接入点**

| 接入点 | 要求 |
|---|---|
| **HTTP 最早的空正文门** | `agents/views.py:219-221` 现在的判断是：正文、`edit_message_id`、`pending_attachments`、上传文件四者都为空时返回 400。这里要把 `collection_items` 加进去，否则只带卡片的请求还没到 service 就会被拒。B2 acceptance 要覆盖 Direct 和 Runtime 两条路径的 card-only 发送 |
| 请求解析（两条路径共用） | `collection_items` 是正整数列表，可选；回合内去重，保留首次出现的顺序。整请求错误：超过 5 个报 `collection_bring_too_many`，类型非法报 `collection_bring_invalid`。单 item 错误（**错误体必须带 `item_id`**）：不存在报 `collection_bring_item_not_found`，原件不可用报 `collection_bring_original_unavailable`，text 正文为空报 `collection_bring_empty_text` |
| 和 `edit_message_id` 或 regenerate 组合 | 本期拒绝，返回 `collection_bring_unsupported_with_edit`；Direct 和 Runtime 都拒 |
| Direct 空正文锚点 | `allow_empty_anchor = bool(files or pending_attachments or collection_items)` |
| **Direct 当前回合** | 在 `agents/services.py:1537-1553` 的同一个出站 user content seam 里，把 bundle 的文字块追加到 `final_messages[-1].content`，排在 `turn_name_block` 之后，**不写进 DB 的 `Message.content`** |
| **Runtime 当前回合** | 把 bundle 的文字块追加进 ExoCore 构造的 `RuntimeTurnPayload` / `TurnRequest.user_message`。只带卡片时，这个字符串本身就非空，现有的“text 或 attachments”合同直接通过。**wire shape 不变** |
| Runtime preflight | 在 HTTP accepted 之前完成解析和 bundle 构造 |
| **历史** | 这是一个**新的 user-input sidecar**，不复用 `artifact_continuity`，也不放宽它。在 raw/hot/cache 历史、Runtime bootstrap/rebase/delta 各自的 user content projection seam 上，调用同一个 renderer，把 `UserCollectionShow` 渲染进现有的历史 user content 字符串。AssistantArtifact 的“Runtime 不消费 user 锚第二名单”规则保持不变 |
| 次数纪律（冻结） | 当前回合出现一次；之后每个历史 user turn 出现一次；**不重复**，也不和当前回合的块叠加 |

**(e) 事务、锁序与补偿：按真实 seam 定，不写全局假设**

- **Runtime：** 在 `prepare_turn_with_user_message_locked` 的 create callback 里，也就是在它的事务内，完成以下步骤：写 user Message，写 `UserCollectionShow`，通过专用入口写 `MessageAttachment`，调用 `record_show(HUMAN_COLLECTOR)`。
- **Direct：** user INSERT 现在没有外层 atomic。参照 `_persist_direct_assistant_result` 的“canonical + sidecar + 回滚后补偿”范式，给 user 写入**建一个明确的 atomic wrapper**，把 user Message、sidecar、附件、`record_show` 包在同一个事务里。
- **锁序**由 CP-B2 Plan 按这两个真实 seam 分别冻结（StoredAsset、CollectionItem、Conversation/binding 锁之间的先后），本计划不预设全局顺序。
- **补偿：**
  - 事务失败，整体回滚；已经复制出的文件在事务外 unlink。
  - 原件 missing 走 `compensate_after_rollback`，在回滚之后单独提交。
  - 不允许部分成功。
  - Runtime 在 accepted 之后失败或 STOP 的情况，按现有 user 行的生命周期处理，由 CP-B2 逐项确认。
- **Runtime 证明：** 用真实 Runtime probe 证明当前回合和历史各出现恰好一次。Runtime 仓没有生产改动，因此不需要双仓同步重启的纪律，按常规重启 `run-exocore` 即可。

**(f) 删除旧 bring-to-chat**

- 删除：`collection/bring_to_chat.py`；`BringToChatSerializer`；`CollectionBringToChatView`；对应 url；`serializers.collection_item_data` 中 `capabilities` 的 `"bring_to_chat"` 和 `bring_to_chat_url`。
- 改写 docstring：`collection/apps.py`、`collection/gc_services.py`、`memory/assistant_artifacts.py:433`。
- 测试：
  - `test_cp4_representations.py` 里相关的部分删除或改写；
  - `test_http_bring_to_chat_changes_no_view_count` 改为“人侧带回不计 view”；
  - 验收方的 probe `test_gc_read_failure.py` **由验收方改写**。
- ReactSheet：
  - 删除 §13.2 的路由行、§13.4 的两个字段、§13.5 中 bring-to-chat 的段落、§13.6 中 `collection_target_not_g045` 一行；
  - **保留 `asset_verification_failed`**，只把它的触发面改掉。
- 保留 `AttachmentProvenance.origin_collection_item_id` 列。

**(g) 文档**

- 两仓 ReactSheet：
  - user Message 投影的 `collection_shows[]`；
  - 发送字段和错误码；
  - #54/#55 中 collection artifact 卡“reason-only”的现有条文（约第 380–409 行），给 text 卡加上 `text`；
  - 登记 `UserCollectionShow` 是 user 侧的例外，并写明次数纪律。
- Change Guide 和 low-level writer audit：登记专用入口。
- `docs/architecture.md`、`.agent/insight/`、ExoCore update log。

---

## 11. 规格修订清单（CP0 内完成，Alicia 已定，只做落盘）

**REQ_20261005（ExoCore 仓），新增 `[rev 2026-10-15]`：**
- §5 或新增小节写入人侧带回语义（§7.1 全部 7 条）；
- §6.5 改为“人侧带回计 Alicia 的 show_count”，取代 rev 2026-10-09b 中“HTTP bring-to-chat 不计”；
- §9 注明 bring-to-chat 按本次决定删除；
- §12 写明：`AssistantArtifact` 仍然只属于 assistant；人侧卡片记录是 `memory.UserCollectionShow`（user-input sidecar），人侧呈现附件经 `MessageAttachmentService` 的专用入口写入，`source` 沿用 `collection_item`；两侧共用 `collection/show_descriptors.py`；
- **#55 reason-only 修订（Alicia 2026-10-15 明确决定）：** text 藏品卡，Agent 侧和人侧同时改为显示快照里完整的 `text` 正文，加上非空的收藏理由；媒体卡保持 reason-only。`description` 不代替正文。
- §10 增补人侧带回的验收目标。

**V4 规格（Desktop 仓）：**

| 文档 | 修订 |
|---|---|
| `V4_River_Collection_Memory_Interaction_Spec.md` | §4.2 表：图片、语音、文档的“语义表示”列改为“`description`（单一客观描述）+ 确定性派生（preview / playback / extracted text）”。§4.2 末段（不得塞进万能 description）加注：已被 REQ rev 2026-10-09 取代。§4.3 删除“时长与 STT 摘要”“提取摘要”。§4.5 结构图中的 Neutral Description / Canonical Transcript 改写。§4.7 中 “STT” 的措辞改为“描述”。§8 改为 `Library = Collection`，Memory 在 Agent Profile。§11 中“中立描述 + 主观点评”和“语音 canonical transcript”两行标为已被取代。§12 验收第 6 条（transcript）改写为 playback 状态可见 |
| `V4_Master_Implementation_Roadmap.md` | §10 Scope 中 “neutral description、canonical transcript” 改写；Exit 中 “audio transcript 缺失/失败可见” 改为“三种派生状态可见”；§10 Objective 删去“P5 复用 Library 容器”；§11 P5 入口改为 Agent Profile，相应改写第 487 行（复用 Library 壳）和第 492 行（Profile 只放摘要和深链）；§13 能力表中 Library container 和 MemoryPlasmid 两行同步改写 |
| `V4_Spec_Freeze_Index.md` | §6.3 Derived semantic material 改写（不再有 neutral description、canonical transcript）；Library 结构树与 §8 保持一致 |
| `V4_Page_Skeleton.md` | 板块四改为只有 Collection；第 43 行 Agent Profile 改为“Memory 完整管理”；Item Detail 的“canonical semantic material”改为“描述与派生状态” |

每处都写明 “Alicia 2026-10-15 决定 / 起草：砚”。

---

## 12. 前端分层与关键文件

| 文件 | 改动 |
|---|---|
| `shell/navigation.ts` | 启用 `library`，新增 `isLibraryActive` |
| `shell/PrimaryNavigation.tsx` | **消费** `isLibraryActive`，按现有的 chat 模式做 active 高亮（只加函数、不接上没有意义） |
| `app/router.tsx` | 新增 `/library` 和嵌套的 `/library/items/:itemId` |
| `features/collection/types.ts` | ListItem、Detail（含 `comments` 和 `viewer_stats`）、Representation、Tag、ViewResult |
| `features/collection/api.ts` | `listItems`、`getItem`、`patchItem`、`deleteItem`、`retryRepresentation`、`listTags`、`recordView`；做严格校验 |
| `features/collection/queries.ts`（新） | 直接沿用 `river/queries.ts` 的 mounted traversal pattern（精确的 queryKey，卸载时精确 remove），**不再抽第三个框架**；`recordView` 成功后把结果合并进 detail 缓存 |
| `features/collection/CollectionWallPage.tsx`（新） | 墙、筛选、宽屏和窄屏布局、多选 |
| `features/collection/PolaroidCard.tsx`（新） | 四类卡片 |
| `features/collection/PolaroidExpanded.tsx`（新） | 放大态 |
| `features/collection/CollectionDeleteDialog.tsx`（新） | `useDialogA11y` 加内联 dialog |
| `features/collection/BringTargetDialog.tsx`（新） | G045 会话选择器，含空状态 |
| `features/collection/collection.css`（新） | 只用 Cinder 和 app 已有的变量 |
| `features/chat/attachments/types.ts` | `useComposeAttachments` 里**另开一个平行数组** `collectionCards: ComposeCollectionCard[]`，元素是 `{itemId, kind?, title?, status: 'ready' \| 'rejected', reason?}`，**不伪装成带 File 的 `ComposeAttachmentEntry`**；`ComposeAttachmentApi` 增加对应的增、删、标记 rejected、取 id 列表的方法；`clearCompose`、`restoreEntries` 和路由清理都覆盖这个数组 |
| `features/chat/attachments/useComposeAttachments.ts` | 实现以上接口；去重；上限 5；按会话隔离 |
| `features/chat/ChatComposer.tsx` | 发送门：非编辑态下，“正文为空、`successfulIds` 为空、没有录音、**`collectionCards` 为空**”时禁止发送；编辑态下卡片区置灰，不参与发送；**`stashedSubmissionRef` 携带 collection item ids**，普通发送失败后卡片原样恢复 |
| `features/chat/runtime/useChatRuntime.ts` 和发送 body 构造 | 空输入门把 `collectionCards` 算进去；`DispatchIntent` 和 `activeAttemptRef` 的恢复快照都带上 collection item ids；`restoredTurn` 也带上，这样 accepted 之后没落盘的情况能把卡还原；按错误体里的 `item_id` 把对应卡标为 rejected，整请求错误不标单张；**edit/regenerate 一律不带** |
| `features/chat/ConversationPage.tsx` | 消费 router state 里的 `collectionCards` |
| `features/chat/types.ts::MessageRow` 和 `MessageView` | 增加 `collection_shows`（行）和规整后的 `collectionShows`（视图） |
| `features/chat/api.ts::normalizeMessageRow` | **在现有的 message normalization owner 里**接入 `collection_shows[]`，并和 `assistant_artifacts[]` 中的 collection producer 一起规整成同一个 `CollectionShowCard`；不另写一套平行的 API parser |
| `features/chat/artifacts/` | 共用组件 `CollectionShowCardView`；`AssistantArtifactCards` 中的 collection 分支改用它；text 卡显示 `text`，限高、内部滚动 |
| `features/chat/MessageTimeline.tsx` | user Message 一侧挂 `CollectionShowCardView`；正文为空时不出空气泡 |
| `ReactSheet.md` | 随 CP-B1 / B2 同步 |

不 import 任何 V3 代码，也不改 V3 包。

---

## 13. 可达性与测试

### 13.1 可达性

- 类型 Tab 用 `role="tablist"`；chip 和开关用 `aria-pressed`。
- 卡片是可聚焦的链接；窄屏支持左右键，并提供上一张、下一张按钮。
- 播放键有 `aria-label`。
- 放大态和各对话框都用 `useDialogA11y`：焦点锁定、Esc 关闭、关闭后焦点回到原位。
- 图片 alt 依次取 description、title、“图片藏品 #id”。
- 状态信息不只靠颜色表达。
- 多选框有可读标签。

### 13.2 vitest

| 文件（拟） | 覆盖 |
|---|---|
| `collection_browse_api.test.ts` | 严格解析，包括 `comments` 和 `viewer_stats`；错误码保留 |
| `collection_wall.test.tsx` | 六种筛选映射；重新遍历；续页失败；`malformed_cursor`；空状态；缩略图回退；布局；不发 view |
| `collection_expanded.test.tsx` | 四类原件；派生状态和重试；PATCH；描述 500 字上限；Tags；人工校准；统计和评论；来源会话链接取自 `snapshot.message.conversation_id` |
| `collection_view_count.test.tsx` | 每次打开只计一次（StrictMode 下也一样）；播放键只计一次；refetch 不计；**成功后统计行立即 +1**；失败不阻塞 |
| `collection_delete.test.tsx` | 文案（标签关联）；204 和 404；防重复提交 |
| `collection_bring.test.tsx` | 选择器只列 G045、默认 Prime、空状态；单选和多选；上限 5；草稿不变；去重；移除；state 消费后清掉；`collection_items` 按顺序；只有卡片可以发送（`useChatRuntime` 空输入门）；edit/regenerate 不带卡；失败恢复后卡片还原（普通失败、accepted 后没落盘两种情况都要测），并按 `item_id` 把失效的那张标为 rejected；整请求错误不标单张 |
| `collection_message_card.test.tsx` | `assistant_artifacts[]`（collection）和 `collection_shows[]` normalize 成同一个 `CollectionShowCard`，并由同一个组件渲染；两侧 text 卡都显示正文；user 侧 `collection_item` 附件可以下载；user 侧卡片按投影渲染；text 卡显示正文、不进气泡正文、空正文消息不出空气泡；点击跳转；藏品已删除时的提示；没有收藏按钮 |
| `library_navigation.test.tsx` | 入口、active 状态，没有 Memory 子项 |
| 既有 P1C、chat、artifact 测试 | 全量回归，断言不放宽 |

命令：`pnpm --filter exo-app test:run`、`pnpm --filter exo-app lint`、`pnpm --filter exo-app build`。

### 13.3 真实环境核验（CP6）

`pnpm dev:app` 连真实后端，宽屏和窄屏都要走：四类藏品、六种筛选、打开和播放、编辑、删除（只删测试藏品）。人侧带回在 Direct 和 AGY 各走一遍：单张、多张、只有卡片、text 卡，并确认阿莱能看到 descriptor、能 inspect。截图存到 `Plan/evidence/`。

---

## 14. 冻结与施工顺序

| 步 | 内容 | 门 |
|---|---|---|
| **F0** | 开新 issue，回填本 Plan 和 #32 评论；本计划转为冻结候选 | P1-5 |
| **CP0** | §11 规格修订落盘；视觉稿经 Alicia 批准（墙、放大态、多选、删除、选择器含空状态、待发卡、消息侧卡片）；验收方冻结 **Desktop acceptance spec** | F0 |
| **CP-B1**（ExoCore） | 冻结 **B1 后端 acceptance spec**，然后施工 G1、G2、G4 | CP0 规格修订完成 |
| **CP-B2**（ExoCore；Runtime 只做 probe） | 按 §10.2 写 `Collection_Human_Bring_Back_Plan.md`，冻结两条 seam 各自的锁序 → Solaire review → **冻结 B2 acceptance spec**（含真实 Runtime probe 的次数纪律）→ 施工 → 独立验收 | CP0；和 CP-B1 互不依赖 |
| **CP1** | 导航、路由、api、types、queries | CP0 |
| **CP2** | 墙：筛选、分页、布局 | CP1（`month` 和 `link` 联调等 CP-B1） |
| **CP3** | 放大态：原件、派生、编辑、删除 | CP2 |
| **CP4** | 统计、评论、view | CP3 + CP-B1 PASS |
| **CP5** | 人侧带回前端 | CP3 + CP-B2 的 HTTP 字段和 `collection_shows[]` 形状冻结（联调依赖 CP-B2 已可用） |
| **CP6** | 可达性、真实核验、证据、Update_log、AGENTS 迁移状态；提交独立验收 | CP1–5 |

Desktop acceptance spec 不能代替 B1 或 B2 的后端和跨仓 spec。每个 CP 提交前都要跑 test、lint、typecheck，只 stage 本 CP 范围内的文件；提交写 `refs` 新 issue。

---

## 15. 验收建议（交给验收方冻结）

1. 有 Library 一级入口，`/library` 就是 Collection，没有 Memory 子入口。
2. 四类藏品都能浏览；原件和派生能区分开；preview 失败时原件仍然可见。
3. 六种筛选和服务端结果一致；分页不重复、不遗漏；改筛选后不复用旧 cursor；`link` 只命中正文里含 `http(s)://` 的文字藏品。
4. 曝光、缩略图、滑动、翻页、筛选都不改统计；每次打开或播放只让 Alicia 的 `view_count` +1，界面上当次就显示出来。
5. 编辑能完整 round-trip；400 时表单不丢；Tags 是整组替换。
6. 删除需要二次确认；文案准确；已发出的藏品卡不受影响；共享的 Tag 行不会被删。
7. 人侧带回：
   - 草稿不变；可以多选，最多 5 张；可以只带卡片发送；编辑态下被拒；
   - 阿莱本回合看到 descriptor，看不到原件，能 inspect；之后的回合恰好投影一次；Direct 和 AGY 都成立；
   - Alicia 消息一侧的卡片与 Agent 卡同源（共享 descriptor、文字块、投影、组件），媒体只显示一次；Agent 侧 text 卡也显示正文；text 卡显示藏品正文，且正文没有被写进消息 content；
   - 每张被接受的卡片让 `show_count` +1，失败时不计、没有部分落盘、没有残留文件；
   - 旧 bring-to-chat 端点和 capability 都已不存在。
8. 各种错误、空、加载状态与 §3 和 §7.5 一致；没有伪造的元数据。
9. 既有的聊天附件、正文收藏、Agent bring_back 卡、#54 回归都没有退化。
10. 宽屏和窄屏是同一套实现，键盘能完成全部主路径。

---

## 16. 与相关 issue 的边界

| Issue | 关系 |
|---|---|
| **#32** | 本计划是 #32 的人侧部分，用子 issue 承载；#32 保持 OPEN，留给 Step 5 |
| **Step 5** | 不并入本期；它和人侧带回都会用到共享 descriptor（§10.2 b），但两者都不需要对方先完成 |
| **#60** | 本期只做字面 `q` |
| **#8 / #28** | 无关 |
| **#31** | Library 只显示 highlight 来源的藏品，不做 promotion |
| **P5 Memory** | 改到 Agent Profile |

---

## 17. 决定记录

| ID | 决定（Alicia 2026-10-15） |
|---|---|
| D1 | Library 只放 Collection；MemoryPlasmid 在 Agent 主页管理（P5） |
| D2 | 拍立得卡片：上半部是内容，下方留白放信息；窄屏左右滑，宽屏小卡网格；点击放大或播放，出现统计和评论；音频用音乐符号加明确的播放键 |
| D3 | 展示评论和统计，计人侧 view |
| D4 | G045 会话选择器，默认 Prime |
| D5 | 作废：人侧带回不碰草稿 |
| D6 | HTTP 开放 `month` 和 `link` 筛选 |
| D7 | 缩略图由客户端拼 URL，失败回退 |
| D8 | 统计每个 viewer 一行，Agent 用 preset 名 |
| D9 | 待发藏品卡离开会话即清空 |
| D10 | 两侧卡片同源：共用 descriptor、模型文字块和 `project_human_card`，前端用同一个 `CollectionShowCard` 组件。原件复制为只给人看的呈现附件，不受藏品删除影响，不进模型输入。text 卡挂在附件位置，显示快照正文和非空的收藏理由（两侧同时修订 #55），绝不填进消息正文；长文呈现以后再定 |
| D11 | 每回合最多 5 张 |
| 带回 | §7.1 全部 7 条 |

Alicia 的产品待决项和 CP-B2 的架构（Solaire 2026-10-15 裁决，R5 修订为接现有 seam）都已经定下，没有剩余待决项。

---

## 署名

计划编写与跨仓只读核对：砚（claude-opus-5-5）— 2026-10-15（R1 初稿；R2 并入 Alicia 的决定；R3 按 Solaire 一审 REVISE 修订；R4 并入 CP-B2 架构裁决；R5 改为接现有 seam；R6 补齐 HTTP 空正文门和带 item_id 的错误体，转为冻结候选）。授权链：Alicia → Solaire（pane5）→ 砚（pane4），仅限写计划和只读调研。
