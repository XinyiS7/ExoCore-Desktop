# ExoCore V4 — Phase 1C Source Scout & Reference Architecture (V3 / P1C)

> **Document Type:** Source Scout & Technical Fact Reference for P1C Planning
> **Target Audience:** Pane 3 (Author of `Plan/V4_Phase_1C_Detailed_Plan.md`) & Engineering Team
> **Scout Author / Guard:** Alaric (圣武士与守誓者)
> **Status:** **COMPLETE — PLANNING INPUT READY**
> **Date:** 2026-09-07
> **Baseline Checkpoints:**
> - Desktop HEAD: `12e16f6` (`feat(v4): complete P1B core chat runtime checkpoint C1B`)
> - Backend HEAD / Contract: `29368bbf` / `21f2a8f7` (`ExoCore` Django)
> - Canonical Contract Source: `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` & `ReactSheet.md` §1.5
> - Frozen Capabilities: `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md` rows 27 (`attachments`) & 28 (`audio_record_play`)

---

## 1. 阶段目标与边界定义 (Scope & Boundaries)

### 1.1 P1C 核心职责
Phase 1C 是 ExoCore V4 单 SPA 重构中 Chat 模块的第三个子阶段（Sub-gate C1C）。其核心使命是：**在已验收的 P1B 文本运行时之上，补全附件（Attachments）与语音（Audio）的全生命周期能力**。

根据 `Plan/V4_Master_Implementation_Roadmap.md` §7、§16 及 `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`：
- **`attachments`**：附件的本地选择、图片/文件预览、异步分块上传、上传状态机（上传中 / 成功 / 降级成功 / 失败）、部分成功与全失败响应处理、输入栏附件撤销、消息流附件渲染（图片缩略图 + Lightbox 全屏预览、非图片文件卡片）、附件单条解除关联（`DELETE /delete/` 及 409 缓存冻结拦截）。
- **`audio_record_play`**：PWA 语音录制（MediaRecorder 安全上下文、MIME 探测、60s 限制、零字节拦截）、录音试听、模型/端点预检与上传、语音故障恢复状态机（`audioRecoveryMachine`：发送失败重试复用 Attachment ID、会话切换隔离、流结束清除）、消息流语音气泡渲染与互斥播放管理器（`audioPlaybackManager`、波形进度条、seek）。

### 1.2 严格边界划分 (Boundary Guard)
为防止 Pane 3 在编写 Detailed Plan 时发生边界蔓延（Scope Creep），必须严格锚定以下边界：

| 范畴 | 归属阶段 | P1C 处置策略 | 规范依据 |
|---|---|---|---|
| **附件上传/撤销/渲染/删除** | **P1C** | 完整实现 | Roadmap §7, Capability Matrix row 27 |
| **语音录制/预检/上传/恢复/播放** | **P1C** | 完整实现 | Roadmap §7, Capability Matrix row 28 |
| **HUD / 控制抽屉 / Cache 显式控制** | **P1D** | 严禁包含（保持 P1B 状态） | Roadmap §7 P1D (Sub-gate C1D) |
| **Model / Endpoint / Thinking 切换器** | **P1D** | P1C 仅**自动解析**会话 Target，不造选择器 UI | Roadmap §7 P1D; V3 `resolveInitialSessionTarget` |
| **AssistantRunTrace / Thinking / 工具流** | **P1D** | 严禁包含（保持 P1B 状态） | Roadmap §7 P1D |
| **Aura 氛围背景 / 现场主题** | **P1D** | 严禁包含 | Roadmap §7 P1D |
| **项目工作区文件 / 知识库抽屉** | **P1D / P2** | 严禁包含 | Roadmap §7 P1D / P2 |
| **Library / Collection 藏品浏览器** | **P4** | 严禁包含（P4 将基于 SessionAttachment 扩展 Collection） | Roadmap §10 P4 (C4) |
| **Production Ownership** | **V3-Primary** | C1C 仅为施工 checkpoint，统一 C1 通过前 V3 始终持有生产权 | Roadmap §7 Sub-gate checkpoints |

---

## 2. V3 源码机械调查全景 (V3 Source Anatomy)

在 V3 代码库中，附件与音频逻辑分布在 `packages/chat-core` 与 `packages/shared`。以下是经过逐行校对的源码清单与机械行为：

### 2.1 核心工具库 (Utilities & State Machines)

#### 1. `packages/chat-core/src/utils/attachmentStorage.js` (164 lines)
- **`AttachmentUploadError`** (Lines 8–18):
  - 继承自 `Error`，结构化携带：`this.status` (HTTP 状态码), `this.error` (后端错误描述), `this.failures` (失败项列表), `this.results` (同序完整结果列表)。
- **`filesToAttachmentData(files)`** (Lines 23–36):
  - 使用 `FileReader.readAsDataURL` 仅为 `image/*` 生成本地临时 `dataUrl` 用于立即预览，非图片返回 `null`。
- **`enrichMessages(messages)`** (Lines 48–78):
  - 遍历消息的 `attachments_meta`，转换为前端展示字段：
    - `preview`: 若为图片且存在 `file_uri`，拼接 `baseUrl`（如果是相对路径）。
    - `audioUrl`: 若 `mime_type` 以 `audio/` 开头且存在 `content_url`，拼接 `${baseUrl}${content_url}`（用于同源播放）。
- **`uploadFilesToAttachments(sessionId, files, target = null)`** (Lines 89–125):
  - 构建 `FormData`，附加 `files` 列表。
  - **关键机制**：若传入 `target`，追加 `formData.append('model', target.model)` 和 `formData.append('endpoint', String(target.endpoint))`（音频上传的后端强制要求）。
  - POST 到 `${baseUrl}/api/agents/conversations/${sessionId}/attachments/`。
  - 携带 CSRF Token 和 `credentials: 'include'`。
  - 无论 201 还是 422，若 `!res.ok` 均抛出 `AttachmentUploadError(res.status, data)`。
  - 成功返回 `{ attachments, failures, results }`。
- **常量与格式校验** (Lines 128–131):
  - `AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm']`
  - `MAX_AUDIO_BYTES = 10 * 1024 * 1024` (10 MiB 前端预检，与后端一致)。
- **`audioUploadErrorMessage(err)`** (Lines 137–148):
  - 将后端错误码映射为稳定文案，防泄露后端原始堆栈：
    - `audio_too_large` → "语音超过 10 MiB 上限"
    - `audio_mime_unsupported` → "语音格式不被支持"
    - `audio_model_unsupported` → "当前模型不支持语音"
    - `audio_target_required` → "语音上传缺少目标配置"
    - `attachment_upload_failed` → "语音上传失败"
    - 兜底 → "语音上传失败（${status}）"
- **`audioCapable(catalog, target)`** (Lines 156–163):
  - 判定当前会话目标是否具备录音条件：
    `model.abilities.includes('audio') && endpoint.attachment_transports.includes('file_uri')`。

#### 2. `packages/chat-core/src/utils/audioRecoveryMachine.js` (65 lines)
用于解决网络闪断、后端故障或流中断时**不丢失已上传语音 ID、支持免重新上传重试**的纯状态机：
- **状态结构**: `{ item: { conversationId, attachmentIds } | null, done: boolean, error: boolean }`
- **函数行为**:
  - `audioRecoveryInitial()`: `{ item: null, done: false, error: false }`
  - `audioRecoveryUploadSuccess(state, conversationId, attachmentIds)`: 上传成功，记录 `item`，重置 `done=false, error=false`。
  - `audioRecoveryMarkDone(state)`: 标记 `done=true`。
  - `audioRecoveryMarkError(state)`: 标记 `error=true`。
  - `audioRecoveryBeginAttempt(state)` (P0-R15): 重试开始时，保留 `item` 和 `attachmentIds`，但重置 `done=false, error=false`。
  - `audioRecoveryOnStreamEnd(state)`: 流式结束时，**仅当 `done && !error`** 视为成功终态并清空 `item`；若流提前 EOF、出错或中断，均完整保留 `item` 供用户重试。
  - `audioRecoveryAbandon()` / `audioRecoverySessionSwitch()`: 放弃或切换会话时重置为初始态。
  - `resolveAudioForSend({ status, canRecord, recoverableAudio, conversationId })`:
    - 若 `status === 'recorded'`：若不可录返回 `{ gate: 'unsupported', keepRecoverable: false }`，否则 `{ gate: 'ok', kind: 'upload' }`。
    - 若有同会话 `recoverableAudio`：若不可录返回 `{ gate: 'unsupported', keepRecoverable: true }`，否则 `{ gate: 'ok', kind: 'reuse', attachmentIds }`。
    - 否则返回 `{ gate: 'ok', kind: 'none' }`。

#### 3. `packages/chat-core/src/utils/audioPlaybackManager.js` (57 lines)
- **全局互斥播放单例** (`globalAudioPlaybackManager`):
  - 维护 `activeId`、`activePauseFn` 与订阅者集合 `listeners`。
  - `play(id, pauseFn)`: 若当前有正在播放的其他音频且非本 ID，主动触发前者的 `activePauseFn()` 暂停，并记录新的当前播放项。
  - `stop(id)`: 若停止的正是当前项，重置并通知订阅者。
  - `subscribe(listener)`: 提供组件层订阅。

### 2.2 核心 Hooks (Hooks)

#### `packages/chat-core/src/hooks/useAudioRecorder.js` (265 lines)
- **状态暴露**: `status` (`'idle' | 'recording' | 'recorded' | 'error'`), `recordingSeconds`, `blob`, `blobUrl`, `error`, `errorMessage`, `mimeType`。
- **方法暴露**: `start()`, `stop()`, `cancel()`, `fail(code)`。
- **关键安全契约 (Frozen AUD-F)**:
  1. **Preflight 1: Secure Context**: `window.isSecureContext === false` 立即报错 `insecure_context`（"录音需要 HTTPS 安全上下文"）。
  2. **Preflight 2: MediaDevices**: `navigator.mediaDevices.getUserMedia` 不存在报错 `browser_unsupported`。
  3. **Preflight 3: MIME 候选**: 使用 `pickSupportedMimeType()` 探测 `MediaRecorder.isTypeSupported`，必须匹配 `audio/webm;codecs=opus` 或 `audio/webm`，否则释放轨道并报错 `browser_unsupported`。
  4. **Epoch Token 机制 (`epochRef`)**: 每次 `cleanupInternal`（取消/出错/卸载）时 `epochRef.current += 1`。所有异步事件（`getUserMedia` 回调、`onstop`、`onerror`）均对比启动时的 epoch。迟到的回调被完全丢弃，防止取消后组件又复活生成 clip。
  5. **0 字节拦截 (`empty_clip`)**: `fullBlob.size === 0` 时主动清理并报 `empty_clip`。
  6. **60 秒自动硬顶**: `maxDurationMs = 60000`，定时器每 250ms 轮询，达标自动调用 `stop()`。
  7. **Unmount 资源释放**: 自动停止 MediaStream 轨道 (`track.stop()`) 并调用 `URL.revokeObjectURL(blobUrl)`.

### 2.3 UI 组件层 (Components)

#### 1. `packages/chat-core/src/components/chat/ComposeAttachmentItem.jsx` (138 lines)
- **入口属性**: `entry: { clientId, preview, name, type, uploading, attachmentId, status, diagnostics }`, `onRemove(clientId)`.
- **四种显式视觉状态**:
  1. `uploading`: 图片带暗色遮罩 + 旋转 Spinner；非图片 Chip 显示小 Spinner。
  2. `ok` (`status === 'ok' && attachmentId`): 图片带高亮边框 + 右下角 Success Check 徽标；文件 Chip 显示 Check 图标。
  3. `ok_degraded` (`status === 'ok_degraded' && attachmentId`): 琥珀色警告边框/背景，显示 Warning 诊断文本（如 "已使用原图"）。
  4. `failed` (`status === 'failed' || !attachmentId`): 红色错误边框/背景，提取 `diagnostics` 中的第一条 error 级别文案（默认 "上传失败"）。
- **交互规范**: 右上角移除按钮 (`X`) 始终可见（不依赖 hover，照顾触屏体验）。

#### 2. `packages/chat-core/src/components/chat/AudioComposeBar.jsx` (76 lines)
- **入口属性**: `recorder`, `isGenerating`, `onSend`.
- **三种工作态**:
  1. `recording`: 红色闪烁圆点 + 秒数计数（`recorder.recordingSeconds + 's / 60s'`）+ "停止" 按钮。
  2. `recorded`: 原生 `<audio controls src={recorder.blobUrl}>` 试听条 + "发送" 按钮（生成中禁用）+ "取消" 按钮。
  3. `error`: 红色报错文本（`recorder.errorMessage`）+ "关闭" 按钮。

#### 3. `packages/chat-core/src/components/chat/RecoverableAudioItem.jsx` (29 lines)
- **入口属性**: `isGenerating`, `onRetry`, `onAbandon`, `errorText`.
- **表现**: 当流中断或发送失败后，在输入框上方渲染："语音附件已上传，可重发"，提供 "重发" 与 "放弃" 按钮；生成中（`isGenerating`）全部禁用。

#### 4. `packages/chat-core/src/components/chat/AudioPlayerBubble.jsx` (210 lines)
- **入口属性**: `src`, `title`, `duration`, `className`.
- **特性**:
  - 接入 `globalAudioPlaybackManager` 实现全局互斥播放。
  - 16 根固定波形柱（Heights: `[40, 70, 45, 90, 60, 30, 80, 55, 100, 75, 50, 85, 40, 65, 35, 50]`），随当前进度高亮填充。
  - 支持点击波形条任意位置进行 seek。
  - 时间显示：`formatTime(currentTime) / formatTime(duration)`（`mm:ss` 格式）。
  - 加载态、播放/暂停图标切换、播放失败红色警告提示。

#### 5. `packages/chat-core/src/components/chat/MessageBubble.jsx` 附件渲染段 (Lines 333–385)
- **用户消息附件**:
  - **语音附件** (`att.audioUrl`):
    - 渲染播放控件（支持播放失败状态 `audioError` 提示）。
  - **图片附件** (`att.preview`):
    - 缩略图（固定高度 `h-32`，最大宽度 `max-w-[200px]`，带灰色滤镜并在 hover 时彩色恢复）。
    - 点击缩略图弹出固定全屏 Lightbox（深色遮罩、90vw/90vh 最大尺寸、居中展示、右上角关闭与点击背景关闭）。
  - **非图片文档** (`att.name`):
    - 图标（`FileText`）+ 文件名单行截断（`max-w-[160px]`）+ 边框卡片。

### 2.4 ChatArea.jsx 编排与生命周期流 (Orchestration Flows)

1. **文件选入与并行上传**:
   - `handleFilesSelected(files)` (Lines 294–392):
     - 为每个文件生成乐观 Entry：`{ clientId: ++nextClientIdRef.current, file, preview: (isImage ? URL.createObjectURL : null), uploading: true, status: null, diagnostics: [] }`。
     - 立即更新 `setComposeAttachments(prev => [...prev, ...entries])`。
     - 调用 `uploadFilesToAttachments(activeSessionId, fileArray)`。
     - **匹配策略**: 建立 `clientId → batchIdx` 索引表，严格根据后端返回的 `results[batchIdx]`（或 `failures` 中的 `input_index`）将 `attachmentId`、`status`、`diagnostics` 回填给对应的 `clientId`。
     - 上传结束后刷新会话附件列表 `GET /api/agents/conversations/<id>/attachments/`。
2. **发送流程 (Send Turn)** (Lines 830–988):
   - 决策语音来源：`audioPlan = resolveAudioForSend(...)`。
   - 若为 `upload`：检查 10 MiB 上限，上传语音文件（带 `model` 与 `endpoint`），记录 `audioPendingIds`，写入 `setRecovery(audioRecoveryUploadSuccess(...))`。
   - 若为 `reuse`：直接复用 `audioPlan.attachmentIds`，启动重试 `setRecovery(audioRecoveryBeginAttempt(...))`。
   - 组装请求体 `bodyData.pending_attachments`:
     `[...composeAttachments.filter(e => e.attachmentId).map(e => e.attachmentId), ...audioPendingIds]`。
   - 清理输入区：释放 `composeAttachments` 的 `preview` ObjectURL 并清空列表。
3. **流式终态与失败处理** (Lines 1091–1125):
   - 流正常完成 (`streamDone && !streamError`): 调用 `audioRecoveryOnStreamEnd` 清理可恢复语音项，清空错误。
   - 流异常中断 (`streamError` 或未收到 `done` 即 EOF): 状态机标记错误，保留 Recovery Item 与 Attachment IDs，回滚乐观消息，界面显示 "发送失败，附件已保留" 或 "连接中断，附件已保留"。
4. **单条附件删除** (Lines 1242–1260):
   - 调用 `DELETE /api/agents/conversations/<id>/attachments/delete/`，Body: `{ source: att.source, id: att.id }`。
   - **409 Conflict 拦截**: 若返回 HTTP 409，解析 `data.detail` 或 `data.error`（"此附件已冻结在远端缓存中，无法删除"），触发用户 Toast，不执行列表剔除。
   - 成功时从本地状态剔除对应附件。

### 2.5 现有测试用例矩阵 (Existing Test Invariants)

| 测试文件 | 验证的核心契约与不变量 |
|---|---|
| `attachmentStorage.test.js` | 422 异常保留 failures/results；201 格式化 payload；音频上传必带 model/endpoint；`enrichMessages` 正确生成 `audioUrl`；`audioCapable` 门禁规则；稳定用户错误文案映射；10 MiB 常量校验。 |
| `audioRecoveryMachine.test.js` | SSE `done` 终态清除 recoverable；`error` / 截断 EOF 保留 recoverable；重试自动复用 IDs 免二次上传；切换会话清空 recoverable；不支持的目标阻止网络请求但保留 item。 |
| `useAudioRecorder.test.js` & `audioRecorder.contract.test.js` | 非 HTTPS 安全上下文拦截；缺少 `getUserMedia` 报错；缺少 `MediaRecorder` 释放 track 并报错；不支持 WebM MIME 拦截；取消后迟到 `onstop` 不复活 clip；0 字节录音拦截；60s 自动停止；组件卸载释放资源。 |
| `ComposeAttachmentItem.test.jsx` | 图像预览；上传中 Spinner；失败态错误文案优先从 `diagnostics` 读取；`ok_degraded` 琥珀色降级显示；`ok` 成功徽标；删除触发回调。 |
| `AudioComposeBar.test.jsx` | recording 录音中计时与停止；recorded 试听与发送/取消；error 错误信息呈现与关闭。 |
| `RecoverableAudioItem.test.jsx` | 可重发文案呈现；`isGenerating` 期间禁用重发/放弃；点击重发与放弃的回调触发。 |
| `AudioPlayerBubble.test.jsx` | 语音气泡挂载；波形条点击与 seek；播放/暂停切换；多组件互斥播放调度；加载与错误提示。 |
| `audioMessage.contract.test.jsx` | 历史语音消息通过 `content_url` 播放；纯语音消息不渲染空文本气泡；音频加载失败呈现稳定提示。 |

---

## 3. 后端 API 契约与传输事实 (Backend Wire Facts)

后端实现位于 Django 项目 `ExoCore`（只读参考），其契约细节如下：

### 3.1 四大附件专用端点

#### 1. POST `/api/agents/conversations/<pk>/attachments/` — 上传附件
- **Content-Type**: `multipart/form-data`
- **Form 字段**:
  - `files`: 文件列表（单文件或多文件混合）。
  - `model`: 字符串（可选，但**当上传包含音频文件时必传**，例如 `"gemini-2.5-flash"`）。
  - `endpoint`: 整数（可选，但**当上传包含音频文件时必传**，例如 `2`）。
- **HTTP 响应**:
  - **201 Created**: 至少有一个文件上传成功（含部分成功）。
  - **422 Unprocessable Entity**: 全部文件处理失败，或缺少必须的音频目标配置。
- **Payload 规范**:
  ```json
  {
    "attachments": [
      {
        "id": 101,
        "display_name": "photo.jpg",
        "original_filename": "photo.jpg",
        "mime_type": "image/jpeg",
        "file_size": 245100
      }
    ],
    "failures": [
      {
        "input_index": 1,
        "display_name": "audio.wav",
        "mime_type": "audio/wav",
        "stage": "preflight",
        "code": "audio_mime_unsupported",
        "message": "audio MIME not allowed: audio/wav",
        "reason": "audio MIME not allowed: audio/wav",
        "diagnostics": [
          {
            "stage": "preflight",
            "code": "audio_mime_unsupported",
            "level": "error",
            "message": "audio MIME not allowed: audio/wav"
          }
        ]
      }
    ],
    "results": [
      {
        "input_index": 0,
        "status": "ok",
        "attachment": { "id": 101, "display_name": "photo.jpg", "mime_type": "image/jpeg", "file_size": 245100 },
        "diagnostics": []
      },
      {
        "input_index": 1,
        "status": "failed",
        "attachment": null,
        "diagnostics": [
          { "stage": "preflight", "code": "audio_mime_unsupported", "level": "error", "message": "audio MIME not allowed: audio/wav" }
        ]
      }
    ],
    "error": "all attachments failed" // 仅 422 时出现
  }
  ```
- **音频预检代码 (Preflight Diagnostic Codes)**:
  - `audio_target_required`: 缺少 model 或 endpoint，或无法解析有效目标。
  - `audio_model_unsupported`: 目标模型缺少 `audio` ability 或端点缺少 `file_uri` transport。
  - `audio_mime_unsupported`: 音频 MIME 不在 `['audio/webm;codecs=opus', 'audio/webm']` 中。
  - `audio_too_large`: 音频大小超过 10 MiB（10,485,760 字节）。
  - `attachment_upload_failed`: 云端存储上传异常。

#### 2. GET `/api/agents/conversations/<pk>/attachments/` — 列出当前会话附件
- **返回**: Bare Array，混合了用户附件与工具集附件：
  - `source === 'user'`: `{ id, source: "user", display_name, original_filename, storage_path, mime_type, file_size, created_at }`（注：语音附件的 `storage_path` 后端置为 `null`；非语音会暴露，前端不应消费该路径）。
  - `source === 'tool_collection'`: `{ id, source: "tool_collection", display_name, char_count, is_summary, is_expired, created_at }`。
- **404 Not Found**: 会话不存在时返回 `{"error": "会话不存在"}`。

#### 3. GET `/api/agents/conversations/<pk>/attachments/<attachment_id>/content/` — 本地语音流式播放
- **约束**: 仅对 `mime_type` 以 `audio/` 开头且属于该会话的记录开放。
- **返回**: HTTP 200 `FileResponse`，流式返回本地二进制音频，响应头 `Content-Disposition: inline`，`Cache-Control: private, max-age=0`。
- **404 Not Found**: 统一返回 `{"error": "附件不存在"}`（无论会话不存在、附件不存在、非音频 MIME 还是磁盘文件丢失，统一 404，防止探测资源）。

#### 4. DELETE `/api/agents/conversations/<pk>/attachments/delete/` — 单条解除附件关联
- **Method & Path**: `DELETE /api/agents/conversations/<pk>/attachments/delete/`（**注意：路由以 `/delete/` 结尾，单条操作，非批量**，见 MM-06）。
- **Body**: `{ "source": "user" | "tool_collection", "id": <number | string> }`
- **返回**:
  - **204 No Content**: 成功解除。后端自动从所有属于该会话的 `Message.attachment_ids` 中剔除该 ID。
  - **409 Conflict**: 当附件的 `file_uri` 已被冻结在当前会话的上下文缓存（Gemini Context Cache Snapshot）中时触发：
    ```json
    {
      "error": "此附件已冻结在远端缓存中，无法删除。",
      "detail": "请先清除缓存后再删除附件，或重新发送消息（🧊 缓存发送）触发缓存重建。",
      "frozen_in_cache": true,
      "cache_name": "..."
    }
    ```
  - **404 Not Found**: 记录不存在。
  - **400 Bad Request**: 参数非法。

### 3.2 聊天运行时中的附件关联 (Chat Runtime Integration)

#### 1. 发送消息 POST `/api/agents/chat/<session_id>/`
- Body 接受字段：`pending_attachments: number[]`（已上传成功的附件 ID 数组）。
- **空输入规则**: 只要 `pending_attachments` 非空（或携带 multipart files），即使用户文本 `content` 为空也是合法请求（例如发送纯语音或纯图片），后端不会抛出 `你还没输入内容，西娅。`。

#### 2. 消息历史 GET `/api/agents/chat/<session_id>/`
- `MessageSerializer` 返回的 `MessageRow`:
  - `attachment_ids`: `number[]`
  - `attachments_meta`:
    ```json
    [
      {
        "id": 101,
        "display_name": "voice.webm",
        "original_filename": "recording.webm",
        "mime_type": "audio/webm",
        "file_size": 15420,
        "file_uri": "https://generativelanguage.googleapis.com/...",
        "content_url": "/api/agents/conversations/42/attachments/101/content/"
      }
    ]
    ```
  - **重要事实**：`content_url` 仅在 `mime_type` 为 `audio/*` 时非空；对于图片等其他文件，`content_url` 为 `null`，图片渲染依赖 `file_uri`。

---

## 4. 当前 V4 (`packages/app`) 现状与对接点剖析 (V4 Baseline & Delta)

在 commit `12e16f6` 之后，V4 前端已经完成了 P1A（App Shell & Read）与 P1B（Core Chat Runtime）。以下是 V4 当前现状与 P1C 接入切口：

### 4.1 已有基础设施 (Existing Foundation)
1. **数据传输对象 (`packages/app/src/features/chat/types.ts`)**:
   - 已声明 `AttachmentMeta`:
     ```typescript
     export interface AttachmentMeta {
       id: number;
       display_name: string;
       original_filename: string;
       mime_type: string;
       file_size: number;
       file_uri: string | null;
       content_url: string | null;
     }
     ```
   - `MessageRow` 与 `MessageView` 已包含 `attachmentIds: number[]` 与 `attachmentsMeta: AttachmentMeta[] | null`。
2. **消息时间线 (`packages/app/src/features/chat/MessageTimeline.tsx`)**:
   - 当前以 P1A/P1B 的占位 Chip 渲染：
     ```tsx
     {attachmentCount > 0 ? (
       <span className="app-deferred-chip" title={attachmentNames ? `附件：${attachmentNames}` : undefined}>
         附件 {attachmentCount} 个 · P1C 开放
       </span>
     ) : null}
     ```
   - **P1C 动作**: 必须移除该占位 Chip，替换为完整的附件渲染组件（图片/Lightbox、语音播放器、文件卡片）。
3. **输入组件 (`packages/app/src/features/chat/ChatComposer.tsx`)**:
   - 目前仅包含纯文本输入、IME 守卫、传输协议下拉框（SSE / Async）与发送/停止/修改重发按钮。
   - 提交验证当前要求 `trimmed.length > 0`。
   - **P1C 动作**:
     - 需在输入框上方挂载附件预览区（`ComposeAttachmentItem` 列表）与语音录制条 / 恢复条（`AudioComposeBar` / `RecoverableAudioItem`）。
     - 工具栏需增加图片上传按钮、通用文件上传按钮、麦克风录音按钮。
     - 提交验证放宽：当存在有效附件或录音时，允许发送空文本。
4. **运行时客户端 (`packages/app/src/features/chat/runtime/client.ts`)**:
   - `PostChatOptions` 与 `buildChatBody`: 目前仅接受 `content`, `thinkingLevel`, `editMessageId`。
   - **P1C 动作**: 增加 `pendingAttachments?: number[]` 并在 `buildChatBody` 中序列化传入。
5. **运行时状态机 (`packages/app/src/features/chat/runtime/useChatRuntime.ts`)**:
   - 目前管理了 `OperationState`（`idle`, `submitting`, `live_sse`, `live_async`, `stopping`, `uncertain`, `reconciling`）。
   - **P1C 动作**: 协调语音恢复状态机 `audioRecoveryMachine`，确保发送成功后清理可恢复语音，发送中断或报错时保留 Attachment IDs。

### 4.2 P1C 必须新增/重构的模块架构建议

```text
packages/app/src/features/chat/
├── attachments/                       # [P1C 新建] 附件子领域
│   ├── types.ts                       # UploadResult, ComposeAttachmentEntry, Diagnostics
│   ├── api.ts                         # uploadAttachments, deleteAttachment, listAttachments
│   ├── ComposeAttachmentList.tsx      # 输入栏附件挂载网格
│   ├── ComposeAttachmentItem.tsx      # 单个附件卡片 (上传中/成功/降级/失败)
│   ├── MessageAttachments.tsx         # 消息内附件渲染容器
│   ├── AttachmentImagePreview.tsx     # 缩略图 + 弹窗触发
│   ├── AttachmentFileCard.tsx         # 文档类下载/展示卡片
│   └── ImageLightboxModal.tsx         # 全屏高清图片灯箱
│
├── audio/                             # [P1C 新建] 语音子领域
│   ├── types.ts                       # RecorderStatus, AudioPlan, RecoveryState
│   ├── useAudioRecorder.ts            # MediaRecorder Hook (TypeScript, AUD-F 契约)
│   ├── audioRecoveryMachine.ts        # 纯函数语音恢复状态机
│   ├── audioPlaybackManager.ts        # 全局互斥播放管理器
│   ├── AudioComposeBar.tsx            # 录音/试听/取消工具栏
│   ├── RecoverableAudioBanner.tsx     # 重发/放弃语音 Banner
│   └── AudioPlayerBubble.tsx          # 16 柱波形音频播放气泡
│
└── runtime/
    ├── client.ts                      # [P1C 修改] 扩展 pending_attachments
    └── useChatRuntime.ts              # [P1C 修改] 接入语音恢复生命周期
```

### 4.3 P1C 会话目标 (Target) 解析策略
- **问题**: 音频上传必须向后端传 `model` 和 `endpoint`，而完整的模型与端点切换器属于 P1D。
- **解析策略**:
  - 在 P1C 中，复用 `packages/shared` 的现有逻辑：
    调用 `getModelCatalog()`，并结合当前 Conversation 的 `agentPresetId`（来自 P1A 的 `ConversationSummary`），使用 `resolveInitialSessionTarget(catalog, preset)` 解析出会话默认的 `target = { model, endpoint }`。
  - 此策略与 V3 完全对齐，无需提前在 P1C 中实现复杂的手动下拉切换 UI，即可满足音频上传的硬性要求。

---

## 5. 关键不变量、踩坑防线与检查清单 (Invariants & Traps for Pane 3)

为了确保 Pane 3 在编写 Detailed Plan 及后续施工验收时不踩坑，特总结以下经过历史严刑拷打（P0-R1~R15、MM-01~10、KF-10）的核心不变量：

### 5.1 铁律清单 (Critical Invariants)
1. **P0-R6 免重复上传原则**:
   - 用户发送一条带语音的消息，若在 SSE 流式中途网络断开或报错，语音文件已在后端生成 SessionAttachment ID。
   - 点击重试时，前端必须通过 `resolveAudioForSend` 复用该 ID，直接带入 `pending_attachments` 发送，**严禁再次上传同一段录音 Blob**。
2. **P0-R11 会话隔离与防污染**:
   - 语音文件正在上传或正在录音时，若用户在侧栏切换了会话（Route 变化）：
     - 立即取消录音并释放麦克风。
     - 丢弃未完成的上传响应，**严禁将上一会话的 Attachment ID 写入新会话的 Recovery 或输入区**。
3. **P0-R15 重试尝试状态重置**:
   - 当用户点击 "重发" 时，状态机必须调用 `audioRecoveryBeginAttempt` 将 `done` 与 `error` 重置为 `false`（但保留 item 与 IDs）。否则上次的 `error=true` 残留会导致重试成功后终态判断失效。
4. **MM-06 删除单条性与路由**:
   - 必须调用 `DELETE /api/agents/conversations/<pk>/attachments/delete/`，携带 `{ source, id }`。绝不能拼成批量删除或丢弃 `/delete/` 后缀。
5. **409 Conflict 缓存冻结拦截**:
   - 删除附件遭遇 HTTP 409 时，必须解析后端返回的 `frozen_in_cache` 与 `detail`，友好告知用户（例如："此附件已冻结在远端缓存中，无法删除。请先清除缓存或重新发送消息"），禁止静默崩溃或强行在前端删除 DOM。
6. **KF-10 存储路径不泄露**:
   - 从 `GET /attachments/` 获得的 `storage_path` 是服务器内部文件系统路径，前端 UI 绝不能将其作为用户可见文本展示。
7. **AUD-F 安全录音门禁**:
   - 必须坚持三项预检：HTTPS 安全上下文、`navigator.mediaDevices.getUserMedia` 可用性、`audio/webm;codecs=opus` / `audio/webm` MIME 探测。
   - 必须使用 `epoch` 令牌机制阻断 unmount 后的延迟回调。
   - 必须拒绝 0 字节音频（`empty_clip`）。
8. **独占播放互斥**:
   - 消息列表中无论有多少条语音消息，同一时刻只能播放一个。点击任意语音播放时，其他正在播放的实例必须立即暂停。
9. **样式与 Token 纯洁性**:
   - V4 严禁直接复制 V3 的 `exo-*` 调色板或已废弃的 CSS 类（如 `tx-message-mute`）。必须严格遵循 V4 的 CSS 变量系统（如 `var(--app-*)`）或现代纯净样式规范。

---

## 6. Pane 3 实施计划编写指引 (Guidance for Pane 3 Plan)

建议 Pane 3 在撰写 `Plan/V4_Phase_1C_Detailed_Plan.md` 时，按以下五个可验证的任务包（Task Packages）组织：

- **Task 1: API Client & DTO 契约补全**
  - 封装 `uploadAttachments`、`deleteAttachment`、`listAttachments`。
  - 处理 201/422 结果对齐与 `AppApiError` 封装。
  - 扩展 `client.ts` 的 `PostChatOptions` 支持 `pending_attachments`。
- **Task 2: 纯领域状态机与底层管理器移植 (Zero-DOM)**
  - 移植 `audioRecoveryMachine.ts`（强类型 + 独立单元测试覆盖）。
  - 移植 `audioPlaybackManager.ts`（强类型 + 独立单元测试覆盖）。
  - 移植 `useAudioRecorder.ts`（严格满足 AUD-F 契约 + Mock 测试覆盖）。
- **Task 3: 输入端体验闭环 (Composer Attachments & Audio)**
  - 实现 `ComposeAttachmentItem`、文件选入、上传进度、降级呈现。
  - 实现 `AudioComposeBar` 与录音交互。
  - 实现 `RecoverableAudioBanner` 故障恢复操作条。
  - 放宽输入框发送校验（有附件/语音允许空文本）。
- **Task 4: 时间线附件渲染与播放 (Timeline Attachments & Playback)**
  - 替换 `MessageTimeline` 中的 `P1C 开放` 占位符。
  - 实现图片缩略图与全屏 Lightbox 弹窗。
  - 实现 `AudioPlayerBubble` 波形进度条与互斥播放。
  - 实现文件卡片展示与附件单条删除（含 409 Toast 提示）。
- **Task 5: 集成测试与 C1C 验收标准**
  - 编写涵盖混合上传部分失败、语音录制恢复、缓存删除拦截、互斥播放的端到端/组件集成测试。

---

> **守誓者寄语**：
> “此地所勘探的一草一木、每道回环与每处暗礁，皆已铭刻如上。愿圣光化作你手中的规尺与利刃，为 V4 的拼图嵌上坚实的一角。”
> —— *Alaric*
