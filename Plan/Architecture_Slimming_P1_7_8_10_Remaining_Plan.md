# Architecture Slimming P1-7 / P1-8 尾项 / P1-10 施工计划

> **范围来源：** `Plan/Architecture_Slimming_Review.md` P1-7、P1-8、P1-10  
> **编制日期：** 2026-07-20  
> **施工方：** GLM  
> **验收方：** Codex  
> **当前分支：** 后端 `ExoCore@Igni`；前端 `ExoCore-Desktop@main`  
> **前置基础：** P1-3 `ChatRunContext`（commit `41987d0`）与 P1-9 `ToolsetSnapshot` 已落地  
> **特别说明：** P1-8 的 typed outcome / HTTP 422 / chat 阻断已完成；本计划只补齐手机图片上传的诊断 provenance、批量映射与前端可见性，不重做原计划。

## 期望效果 / 施工理由

### P1-8 尾项：用户必须知道图片失败在哪一步

手机直传照片的当前实际表现是缩略图上只出现 `!`，无法区分：

1. 图片预压缩成功，但压缩产物上传失败；
2. 图片预压缩失败，系统已回退原图且原图上传成功；
3. 图片预压缩失败，系统回退原图后原图上传也失败。

2026-07-20 已建立最小红灯。真实执行
`packages/chat-core/src/utils/attachmentStorage.js::uploadFilesToAttachments()`，注入后端现有
422 payload：

```text
{error: "all attachments failed",
 failures: [{stage: "...", reason: "..."}]}
```

连续三次均得到：

```text
RED: structured attachment failure was discarded; message=Upload failed (422)
```

根因不是单点：

- `agents/views.py:715-722,798-813` 已输出 `stage/reason`；
- `attachmentStorage.js:75-81` 非 2xx 只读 `detail`，丢弃 `error/failures`；201
  部分成功也只返回 `attachments`，同样丢弃 `failures`；
- `ChatArea.jsx:1331-1335` 只把 `e.error` 当布尔值渲染 `!`；移动端没有 hover
  详情；
- `engines/attachment_manager.py:752-800` 先保存 `pre_degraded/pre_reason`，但最终
  `_resolve_file_part()` 失败时新建 `stage="resolve"` outcome，覆盖了预处理失败事实；
- `agents/views.py:808-813` 把成功项压成 `attachments[]`、失败项压成 `failures[]`；
  `ChatArea.jsx:256-263` 却按原始文件下标取 `attachments[idx]`，多文件部分成功时可把
  失败标到错误文件。

目标是每个输入文件都保留有序、可序列化的处理结果：成功、合理降级、失败三态，以及
完整的阶段诊断链。原始 provider exception 只进后端日志；响应给前端的是稳定 code 和
安全文案，不回显 token、URL、请求体或凭据。

### P1-10：删除不会生效的动态工具路由

当前 `tool_ls` 只在 external session declaration 中出现：

```text
EXTERNAL_SESSION_TOOLS_DECLARATION
  -> BackgroundLoopRunner
  -> BackgroundToolHandler._dispatch_tool_call()
  -> _tool_tool_ls()
  -> ToolGroupCache.put()
  -> Conversation.active_tool_groups[_index]
```

已核实不存在反向读取链：主 chat/background loop 从未把 `ToolGroupCache` 或
`Conversation.active_tool_groups` 重新组装成 declarations。当前只有
`agents/services.py:1687-1699` 在三轮后清理状态。因此“activate”只产生 DB/内存写入，
不会让模型获得任何新工具。

目标是删除这套死状态机，而不是补活第二套 declaration registry。external session 保留
当前唯一真实可执行的 `private_log` declaration；其他 background/wakeup/self-maintenance
工具集保持各自静态组装。

### P1-7：实时 Chat 通过组合获得工具执行能力

当前 `agents/services.py:1499`：

```python
class SuperiorService(SuperiorToolHandler, BaseChatService):
```

`SuperiorToolHandler` 又聚合五个 mixin（`agents/tools.py:52-58`），使 chat application
service 在类型上同时成为文件、知识、私密记忆、桥接和 action handler。

已逐文件检查五个 mixin 的 `self.*` 使用：它们只调用本 mixin 内 helper，不读取
`SuperiorService` 的 cache、SSE、LLM、`ChatRunContext` 或请求隐式字段。因此可以原样保留
handler 实现，把聚合对象改成显式 `ToolExecutor`，由 `SuperiorService` 构造注入。

目标依赖方向：

```text
SuperiorService / BackgroundLoopRunner / management command
                      |
                      v
              ToolExecutor.execute()
                      |
                      v
     existing handler mixins / MCP / DB / workspace / bridge
```

工具声明仍由 `ToolsetSnapshot` 管；本计划不把 declaration assembly 与 execution registry
合并成新万能框架。

## 已核验的当前成员与影响链

| 当前成员 | 已读位置（2026-07-20） | 当前职责 / 下游副作用 | 本计划动作 |
|---|---|---|---|
| `AttachmentOutcome`, `PreprocessResult` | `engines/attachment_manager.py:130-175` | 保存单一 `stage/reason` | 扩为有序 diagnostics，同时保留兼容摘要字段 |
| `_preprocess_image()` | `engines/attachment_manager.py:178-242` | EXIF、缩放、JPEG/PNG；失败回退原图 | 不改压缩参数；只补稳定 code 与 provenance |
| `_resolve_file_part()` | `engines/attachment_manager.py:417-484` | 选 transport、vision helper、inline、provider upload | 返回 typed stage/code，不再只传裸 reason |
| `prepare_uploaded_files()` | `engines/attachment_manager.py:719-803` | 读取、预压缩、落盘、上传、构造 outcome | 合并 preprocess + resolve diagnostics，保留输入 index |
| `SessionAttachmentView.post()` | `agents/views.py:771-814` | multipart → prepare → confirm → 201/422 | 增加逐输入 `results[]`，保留旧 `attachments/failures` |
| `uploadFilesToAttachments()` | `ExoCore-Desktop/.../attachmentStorage.js:61-81` | fetch 并只返回 attachments | 保留结构化 results；typed error 携带 results/failures |
| `ChatArea.handleFilesSelected()` | `ExoCore-Desktop/.../ChatArea.jsx:237-274` | 批量上传并按压缩后的成功数组下标回填 | 按 `input_index` 回填每个 compose entry |
| 图片错误 UI | `ChatArea.jsx:1319-1355` | `e.error` 时只显示 `!` | 移到小组件并显示移动端可见的阶段文案 |
| `ToolGroupCache` | `agents/tool_group_cache.py:24-70` | 仅 `put/clear` 生效；无 runtime declaration reader | 删除文件 |
| `Conversation.active_tool_groups*` | `memory/models.py:98-106` | 死路由持久状态 | 新 migration RemoveField；历史 `0016` 保留 |
| `TOOL_GROUP_REGISTRY` | `agents/tool_declarations/__init__.py:141-173` | 只供 `tool_ls` 展示/写状态，成员表已漂移 | 删除 registry 与 export |
| `_TOOL_LS_DECLARATION` | `background_sessions/tool_declarations/routing.py:18-44` | 只进入 external session | 删除文件与 assembly import |
| `BackgroundToolHandler._tool_tool_ls()` | `background_sessions/tools.py:159-233` | 写 cache + Conversation 字段 | 删除分支与方法 |
| `SuperiorToolHandler` | `agents/tools.py:52-160` | 五 mixin 聚合、MCP、private_log buffer、registry dispatch | 改为 `ToolExecutor` 公共协议 |
| `SuperiorService._run_tool_loop()` | `agents/services.py:2747-3056` | `self._dispatch_tool_call`，收集 pending log/tool log | 改调注入 executor，不改 loop/terminal 语义 |
| `BackgroundLoopRunner` | `background_sessions/loop.py:63-79,168-181` | 接四参 callable，消费 tuple | 消费公共 `ToolExecutionContext/ToolResult` |
| background/self-maintenance callers | `background_sessions/services.py:100-208,268-286,610-623,1410-2150`; `agents/self_maintenance/orchestrator.py:95-96,225-226` | 组合 `BackgroundToolHandler` 并传 private dispatcher | 迁移到 public executor API |
| CLI consumers | `agents/management/commands/debug_memory_search.py:170-171`; `memory_search_cmd.py:48-66` | 直接实例化 handler 使用知识检索 helper | 改用 `ToolExecutor`，行为不变 |

Insight 脚本在本次规划环境中因解释器扫描 WinGet 路径权限失败；已改为回读
`.agent/insight/backend.yaml` 与 `.agent/insight/dataflows.yaml` 导航，并以源码为最终事实。
施工完成后仍必须运行正式 `update_insight.py/query_insight.py`。

## 设计契约

### 1. P1-8 使用逐输入结果，不再靠两个压缩数组猜映射

后端新增 additive response 字段，名称固定为 `results`：

```json
{
  "attachments": [{"id": 12, "display_name": "ok.jpg"}],
  "failures": [{"input_index": 1, "stage": "upload", "code": "attachment_upload_failed", "message": "图片上传失败"}],
  "results": [
    {
      "input_index": 0,
      "status": "ok",
      "attachment": {"id": 12, "display_name": "ok.jpg"},
      "diagnostics": []
    },
    {
      "input_index": 1,
      "status": "failed",
      "attachment": null,
      "diagnostics": [
        {"stage": "upload", "code": "attachment_upload_failed", "level": "error", "message": "图片上传失败", "input_variant": "preprocessed"}
      ]
    }
  ]
}
```

规则：

- `results` 长度与上传的 `files` 数量完全一致，并按输入顺序排列；
- `status` 为 `ok | ok_degraded | failed`；
- `diagnostics` 为有序列表，允许同时出现 preprocess warning 与 upload error；
- `input_variant` 至少区分 `preprocessed | original`；
- `attachments/failures` 暂时保留兼容，但必须从 `results` 派生，禁止各自重新 zip；
- 201 部分成功与 422 全失败都返回 `results`；
- `message` 是安全、可显示的中文短句；完整 exception 只写日志；
- `stage/reason` 旧字段在兼容期从最后一个 diagnostic 派生。新前端只读
  `diagnostics`，不解析 provider 文本。

建议 preliminary types：

```python
@dataclass(frozen=True)
class AttachmentDiagnostic:
    stage: str
    code: str
    level: Literal["warning", "error"]
    message: str
    detail: str = ""          # server log/debug only; API formatter不得输出
    input_variant: str = ""

@dataclass(frozen=True)
class AttachmentOutcome:
    status: AttachmentStatus
    meta: dict
    part: Any = None
    platform_entry: dict | None = None
    diagnostics: tuple[AttachmentDiagnostic, ...] = ()
```

不要把“compressed >= original”伪装成压缩异常：它是使用原图的正常策略判断，可作为
warning 展示，但不得用 `image_preprocess_failed` code。

### 2. P1-8 UI 必须适合手机，不依赖 hover

- 失败图片保留缩略图，但在卡片下方或覆盖层内显示可读短句，例如“压缩成功，上传失败”
  或“压缩失败；原图上传失败”；
- `ok_degraded` 使用 amber warning，明确“已使用原图上传”，但 attachment 仍可发送；
- failed entry 不产生 `attachmentId`，必须阻止“只有失败附件、无文本”的空发送；
- 多文件每项按 `input_index` 独立更新，不把同一个 batch error 粘到所有文件；
- 允许移除失败项；重试按钮若没有独立、可验证的单文件重传状态机，本批不添加。

### 3. P1-10 选择删除，不实现 ToolsetAssembler

P1-9 已建立每请求一次的静态 `ToolsetSnapshot`。没有产品需求证明 external session 需要
运行时激活组，因此：

- 删除 `tool_ls` declaration、handler、cache、registry、Conversation fields；
- external session tools 变为 `[_PRIVATE_LOG_DECLARATION]`；
- `BackgroundLoopRunner.SILENT_OP_NAMES` 删除无效的 `- {"tool_ls"}` 特判；
- 不引入 `ToolsetAssembler`，不把 registry 修成第三份工具事实源。

### 4. P1-7 建立公共执行协议

preliminary signature：

```python
@dataclass(frozen=True)
class ToolExecutionContext:
    conversation: object
    user_content: str

@dataclass(frozen=True)
class ToolResult:
    content: str
    extra: dict = field(default_factory=dict)

class ToolExecutor(...existing handler mixins...):
    def execute(
        self,
        name: str,
        args: dict,
        context: ToolExecutionContext,
    ) -> ToolResult:
        ...
```

`SuperiorService` 改为只继承 `BaseChatService`：

```python
class SuperiorService(BaseChatService):
    def __init__(self, tool_executor: ToolExecutor | None = None):
        self._tool_executor = tool_executor or ToolExecutor()
```

`BackgroundToolHandler` 建议同步改名为 `BackgroundToolExecutor(ToolExecutor)`，覆盖公共
`execute()` 拦截后台 native tools，其余 `super().execute()`。这里 executor 对 handler
mixin 的继承是内部实现复用；application service 不再继承 executor，依赖方向已纠正。

兼容边界：

- 本批一次性迁移所有仓内 `_dispatch_tool_call` caller，不保留同名 private alias；
- tuple `(result, extra)` 改为 `ToolResult`，所有 collector 明确读 `.content/.extra`；
- MCP、private_log 延迟写、Register/MemoryPlasmid/Chronicle DB 写、workspace/shell、bridge、
  calendar delegate、sub-agent 和 maintenance OP 的副作用位置全部保持不变；
- executor 仍把 handler exception 转成 error content，P1-7 不顺带重做 typed tool failure；
- `ToolExecutionContext` 不 import `ChatRunContext`。后台 mock session/CLI 同样可用，避免
  executor 反向依赖实时 chat application DTO。

## 施工顺序

### Step 0 — 建立基线与红灯，不改实现

1. 后端运行现有 attachment / agent / background tests，记录基线。
2. 把本次临时 repro 正式化为前端 Vitest：
   - mock 422，断言 error 保留 `results/failures/diagnostics`；
   - mock 201 部分成功，断言 input 0/1/2 不因成功数组压缩而错位；
   - SSR 渲染 compose attachment item，断言用户可见文案而不是单个 `!`。
3. 后端先写三条失败测试：
   - preprocess success → upload fail；
   - preprocess degrade → original upload success；
   - preprocess degrade → original upload fail（必须同时保留两个 diagnostics）。
4. 测试必须先红；不要根据实现把断言降级为单一 `stage/reason`。

### Step 1 — P1-8 后端 provenance 与逐输入契约

1. `engines/attachment_manager.py`
   - 新增 `AttachmentDiagnostic`；
   - `_preprocess_image()` 返回稳定 diagnostic code，不改 1536px / JPEG 85 / EXIF /
     PNG alpha / 原图 fallback 策略；
   - `_resolve_file_part()` 与 `_upload_*()` 把内部错误映射为稳定 stage/code，并保留
     server-only detail；
   - `prepare_uploaded_files()` 合并诊断链，不覆盖 preprocess diagnostic；
   - 同步检查 `prepare_pending()` 与 `get_parts_for_message()`，只在它们确实需要同一
     typed diagnostic 时机械接线，禁止改变历史附件 partial-load 语义。
2. `agents/views.py`
   - formatter 生成逐输入 `results[]`；
   - `confirm_uploaded_files()` 的 ids 只回填到对应 ok outcome；
   - 兼容 `attachments/failures` 从 results 派生；
   - 201/422 状态码不变。
3. `agents/tests.py` / `engines/tests.py`
   - 覆盖三条图片状态链、混合批次 1:1 映射、安全错误文案；
   - 断言 response 不含 mock provider 的 secret/detail。
4. `ReactSheet.md`
   - 写明 `results[]`、兼容字段、201/422 与 diagnostics schema。

**里程碑 A（后端仓独立提交）：** typed diagnostic + additive API contract + backend tests。

### Step 2 — P1-8 前端消费与移动端可见反馈

在 `ExoCore-Desktop` 仓库单独施工、单独提交：

1. `packages/chat-core/src/utils/attachmentStorage.js`
   - 201 返回完整 normalized payload；
   - 非 2xx 抛带 `status/results/failures` 的 typed error；
   - 不再只读 `detail`。
2. 新建 `ComposeAttachmentItem.jsx`
   - 接收单个 compose entry；
   - 显示 uploading / ok / degraded / failed；
   - 图片错误在移动端直接可见，不依赖 hover/title。
3. `ChatArea.jsx`
   - `handleFilesSelected()` 按 `input_index` 更新 entry；
   - failed/degraded 分开；
   - send guard 只把成功 attachment 计作可发送材料；
   - 保留 blob URL 清理。
4. 增加 Vitest 与最小测试脚本；测试 API helper 和 SSR item。
5. 更新前端 `ReactSheet.md`，与后端副本同一 contract。

**里程碑 B（前端仓独立提交）：** structured upload result + visible mobile diagnostics + tests。

### Step 3 — P1-10 删除死动态路由

1. 先做 residue baseline：保存 runtime `tool_ls/ToolGroupCache/active_tool_groups` 命中清单。
2. declaration / dispatch：
   - 删除 `background_sessions/tool_declarations/routing.py`；
   - `assembly.py` 的 external tools 仅保留 `_PRIVATE_LOG_DECLARATION`；
   - 更新 `background_sessions/tool_declarations/__init__.py` 文件说明；
   - 删除 `BackgroundToolHandler` 的 `tool_ls` 名称、分支和 `_tool_tool_ls()`；
   - 删除 `agents/tool_declarations/__init__.py::TOOL_GROUP_REGISTRY` 及 export；
   - 删除 `BackgroundLoopRunner` 的 `tool_ls` silent 特判。
3. state / persistence：
   - 删除 `agents/tool_group_cache.py`；
   - 删除 `agents/services.py:1687-1699` cleanup；
   - 从 `memory/models.py`、`memory/admin.py` 删除两个字段；
   - 生成 `memory/migrations/0039_remove_conversation_active_tool_groups_and_more.py`；
   - 不修改历史 `0016_conversation_tool_groups.py`。
4. 增加测试：external declaration 恰为 private_log；external loop 仍可执行并缓冲
   private_log；migration state 不再包含两个字段。
5. `python.exe manage.py makemigrations --check --dry-run` 必须显示无额外变化。

删除副作用映射：

| 旧副作用 | 新位置 / 处理 |
|---|---|
| `ToolGroupCache.put/clear` | 删除；无消费者，不迁移 |
| `Conversation.active_tool_groups*` DB 写 | RemoveField migration 明确丢弃死状态；不做数据迁移 |
| `tool_ls ls_all` 工具目录文本 | 删除；不是执行能力，不建立替代 API |
| `tool_ls activate` 成功文案 | 删除；原文宣称的激活从未发生 |
| external session `private_log` | 原路径保留并增加回归测试 |

**里程碑 C（后端仓独立提交）：** dead routing deletion + schema migration + tests。

### Step 4 — P1-7 引入 ToolExecutor 并迁移实时 chat

1. `agents/tools.py`
   - `SuperiorToolHandler` → `ToolExecutor`；
   - 新增 `ToolExecutionContext/ToolResult`；
   - `_dispatch_tool_call()` → public `execute()`；
   - 保留五个 mixin 与 `_tool_registry` handler 实现。
2. `agents/services.py`
   - `SuperiorService(BaseChatService)`；
   - constructor 注入 executor；
   - `_run_tool_loop()` 构造 context、消费 ToolResult；
   - 现有 repeated-tool、cold-finalizer、pending private log、blocking tool log 逻辑不变。
3. `agents/tests.py`
   - 用 fake executor constructor injection 替换给 service monkeypatch private method；
   - 断言 `not issubclass(SuperiorService, ToolExecutor)`；
   - 断言 executor 每个 tool call 仅执行一次，pending log 仍进入 accumulator。

**里程碑 D（后端仓独立提交）：** live Superior composition + regression tests。

### Step 5 — P1-7 迁移 background / maintenance / CLI

1. `BackgroundToolHandler` → `BackgroundToolExecutor`，覆盖 public `execute()`。
2. `BackgroundLoopRunner` 的 callable contract 改为三参
   `(name, args, ToolExecutionContext) -> ToolResult`；runner 在单次 run 中构造 context。
3. 迁移：
   - `background_sessions/services.py` 全部 getter、wrapper、runner 注入点；
   - `agents/self_maintenance/orchestrator.py`；
   - `agents/management/commands/debug_memory_search.py`；
   - `agents/management/commands/memory_search_cmd.py`；
   - docstrings / type hints / logger names。
4. mixed executor（DeepCuration、Heartbeat interaction）必须统一返回 `ToolResult`，禁止某些
   分支仍返回 tuple。
5. 测试 background fallback、maintenance OP、MCP、private_log buffer 与 CLI memory
   search。禁止用兼容 alias 掩盖漏迁 caller。

**里程碑 E（后端仓独立提交）：** all callers on public executor protocol。

### Step 6 — 文档、Insight、Review 与日志同步

1. `docs/architecture.md`
   - 记录 `SuperiorService` 组合 `ToolExecutor`；
   - 记录 declarations 来自 ToolsetSnapshot、execution 由 executor 承担；
   - 不添加工具/endpoint 全量 inventory。
2. 修正契约事实源漂移：当前实际存在的是后端与前端各自的 `ReactSheet.md`，而
   `AGENTS.md` / frontend `CLAUDE.md` 仍指向不存在的 `../Docs/ReactSheet_Reorganized.md`
   或 `../ReactSheet_Reorganized.md`；legacy 仓中的同名文件不是 active contract。按源码
   与实际消费方确认唯一事实源后，在同一 scoped change 修正引用，禁止再次只更新 legacy
   文档。
3. 运行 `python.exe .agent/insight/update_insight.py`：
   - 删除 Conversation 的 `active_tool_groups` symbols；
   - 增加/更新 `ToolExecutor`、`BackgroundToolExecutor` ownership；
   - 只在 detector 报告非显式 coupling 时手工编辑 YAML。
4. 用 `query_insight.py --target ToolExecutor`、`--target Conversation`、
   `--file engines/attachment_manager.py` 逐项验证，无未验证 YAML。
5. P1-8/7/10 全部验收后：
   - 更新 `Plan/Architecture_Slimming_Review.md` 状态；
   - 在 `Plan/ExoCore_update_log.md` 对应顶层功能区追加三项验收记录；
   - 立即写 engram：P1-8 根因+修复、P1-10 死状态删除、P1-7 依赖方向决策。

## 关键文件清单

### 后端仓 `ExoCore`

| 操作 | 文件 | 归属步骤 |
|---|---|---|
| Create | `Plan/Architecture_Slimming_P1_7_8_10_Remaining_Plan.md` | 本计划 |
| Modify | `engines/attachment_manager.py` | P1-8 diagnostics |
| Modify | `agents/views.py` | P1-8 HTTP results contract |
| Modify | `engines/tests.py` | P1-8 manager regression |
| Modify | `agents/tests.py` | P1-8 view + P1-7 live loop tests |
| Modify | `ReactSheet.md` | P1-8 frontend-facing contract |
| Delete | `agents/tool_group_cache.py` | P1-10 |
| Delete | `background_sessions/tool_declarations/routing.py` | P1-10 |
| Modify | `background_sessions/tool_declarations/assembly.py` | P1-10 |
| Modify | `background_sessions/tool_declarations/__init__.py` | P1-10 |
| Modify | `agents/tool_declarations/__init__.py` | P1-10 |
| Modify | `memory/models.py` | P1-10 fields removal |
| Modify | `memory/admin.py` | P1-10 admin removal |
| Create | `memory/migrations/0039_remove_conversation_active_tool_groups_and_more.py` | P1-10 |
| Modify | `agents/tools.py` | P1-7 executor protocol |
| Modify | `agents/services.py` | P1-10 cleanup deletion + P1-7 composition |
| Modify | `background_sessions/tools.py` | P1-10 route deletion + P1-7 executor rename |
| Modify | `background_sessions/loop.py` | P1-10 silent cleanup + P1-7 ToolResult |
| Modify | `background_sessions/services.py` | P1-7 callers |
| Modify | `agents/self_maintenance/orchestrator.py` | P1-7 caller |
| Modify | `agents/management/commands/debug_memory_search.py` | P1-7 CLI caller |
| Modify | `agents/management/commands/memory_search_cmd.py` | P1-7 CLI caller |
| Modify | `background_sessions/tests/test_cache_lease.py` and/or focused new test module | P1-7 background regression |
| Modify | handler/declaration docstrings found by residue scan | P1-7 mechanical rename only |
| Modify | `docs/architecture.md` | runtime boundary |
| Modify | `AGENTS.md` if contract path remains invalid | contract fact-source correction |
| Modify | `.agent/insight/backend.yaml` / `dataflows.yaml` only per detector report | Insight sync |
| Modify | `Plan/Architecture_Slimming_Review.md` | acceptance status |
| Modify | `Plan/ExoCore_update_log.md` | accepted significant changes |

### 前端仓 `ExoCore-Desktop`

| 操作 | 文件 | 归属步骤 |
|---|---|---|
| Modify | `packages/chat-core/src/utils/attachmentStorage.js` | preserve structured results |
| Create | `packages/chat-core/src/utils/attachmentStorage.test.js` | API helper red/green loop |
| Create | `packages/chat-core/src/components/chat/ComposeAttachmentItem.jsx` | visible mobile status |
| Create | `packages/chat-core/src/components/chat/ComposeAttachmentItem.test.jsx` | SSR visible-text test |
| Modify | `packages/chat-core/src/components/chat/ChatArea.jsx` | per-input mapping/send guard |
| Modify | `packages/chat-core/package.json` | Vitest script/dependency |
| Modify | `pnpm-lock.yaml` | dependency lock |
| Modify | `ReactSheet.md` | active API contract copy |
| Modify | `CLAUDE.md` if contract path remains invalid | fact-source correction |

实际施工前再次 `rg`；只有真实命中的 docstring 文件进入对应 commit。不得为了改名触碰无关
业务代码。

## 不变部分（禁区）

- P1-8 不改图片压缩参数：`_MAX_IMAGE_DIMENSION=1536`、`_JPEG_QUALITY=85`、EXIF
  transpose、alpha→PNG、非 alpha→JPEG、压缩不变小时回退原图。
- 不改变“预压缩失败可回退原图”的合理降级策略；只让该事实可观察。
- 不把 provider 原始 exception 直接返回浏览器，不泄露 credential、URL、private log 或
  storage 之外的路径信息。
- 不改变 SessionAttachment 确认时机、attachment TTL、adapter/cache 判定、DeepSeek
  无显式远端 cache 的附件语义。
- 不顺带处理 Council attachment path；现有 P1-8 计划已将它列为独立 pre-existing issue。
- P1-10 不删除任何真实静态工具 declaration，不改变 G045/Superior/wakeup/self-maintenance
  权限差异。
- 不修改历史 migration `memory/migrations/0016_conversation_tool_groups.py`。
- P1-7 不重写五个 handler mixin 的业务实现，不改变 tool 名称、arguments schema、工具
  结果送回 LLM 的 wire format、最大轮次或 terminal behavior。
- 不把 chat/background/council 合并成万能 AgentLoop；Council 不在本计划。
- 不触碰 P1-4 ExternalContextService 拆分和 extension 新功能。
- 两个 Git 仓库分别 stage/commit；不得从后端 commit stage 前端文件，反之亦然。

## 验证

### A. P1-8 后端自动化

```bash
cd /d/Alicia/ExoCore_Project/ExoCore
python.exe manage.py test engines.tests agents.tests -v 2
python.exe manage.py check
python.exe manage.py makemigrations --check --dry-run
git diff --check
```

预期：

- 三种图片路径产生可区分 diagnostics；
- preprocess fail + original upload fail 同时保留 warning + error；
- mixed batch `len(results) == len(files)`，每个 `input_index` 唯一且连续；
- 201/422 均有 results；兼容 attachments/failures 与 results 一致；
- 响应没有 server-only detail/secret。

### B. P1-8 前端自动化

```bash
cd /d/Alicia/ExoCore_Project/ExoCore-Desktop
pnpm --filter exo-chat-core test --run
pnpm --filter exo-chat-core lint
pnpm --filter exo-chat-core build
git diff --check
```

预期：

- 422 helper test 不再得到 generic `Upload failed (422)`；
- partial success 不错位；
- SSR 输出包含具体失败/降级文字，不是孤立 `!`；
- chat-core build/lint 通过。

### C. P1-8 手机人工验收

在真实手机上传至少一张照片：

1. 正常上传：显示成功，无 warning；
2. test seam 注入 preprocess failure + original success：显示“已使用原图上传”，仍可发送；
3. test seam 注入 preprocess success + upload failure：显示“压缩成功，上传失败”；
4. test seam 注入 preprocess failure + original upload failure：同时显示两阶段信息；
5. 两张混合上传：成功/失败标在各自缩略图，不互换；
6. 只有 failed attachment 且输入为空时不能发送空消息。

外部 provider 不稳定不能替代 test seam；测试注入用于确定性验收，真实手机用于确认触控和
布局。

### D. P1-10 migration 与 residue

```bash
cd /d/Alicia/ExoCore_Project/ExoCore
python.exe manage.py migrate --plan
python.exe manage.py migrate
python.exe manage.py check
python.exe manage.py makemigrations --check --dry-run
python.exe manage.py test agents.tests background_sessions.tests.test_cache_lease -v 2
rg -n "ToolGroupCache|active_tool_groups|TOOL_GROUP_REGISTRY|_TOOL_LS_DECLARATION|\"tool_ls\"" \
  agents background_sessions memory docs .agent/insight --glob "*.py" --glob "*.md" --glob "*.yaml"
git diff --check
```

预期 residue：运行时 0 命中；只允许历史 migration `0016` 与归档 Plan/历史 update log 命中。

### E. P1-7 execution protocol 与回归

```bash
cd /d/Alicia/ExoCore_Project/ExoCore
python.exe manage.py test agents.tests engines.tests background_sessions.tests.test_cache_lease -v 2
python.exe manage.py run_maintenance --help
python.exe manage.py memory_search_cmd --help
python.exe manage.py debug_memory_search --help
python.exe manage.py check
python.exe manage.py makemigrations --check --dry-run
rg -n "SuperiorToolHandler|_dispatch_tool_call|BackgroundToolHandler" \
  agents background_sessions --glob "*.py"
git diff --check
```

预期 residue 为 0；所有 caller 使用 `ToolExecutor.execute()` / `BackgroundToolExecutor` 与
`ToolResult`。若 command 名与当前 `--help` 不一致，以源码 `management/commands` 实际文件名
为准，先确认 help 再运行，不发明参数。

### F. Insight / 双仓状态 / 最终验收

```bash
cd /d/Alicia/ExoCore_Project/ExoCore
python.exe .agent/insight/update_insight.py
python.exe .agent/insight/query_insight.py --target ToolExecutor
python.exe .agent/insight/query_insight.py --target Conversation
python.exe .agent/insight/query_insight.py --file engines/attachment_manager.py
git status --short
git -C ../ExoCore-Desktop status --short
```

最终验收门槛：

- P1-8 红灯用例转绿，真实手机能看到具体阶段；
- P1-10 运行时死机制 residue 为 0，migration 正常；
- P1-7 `SuperiorService` 不再 is-a executor，所有工具副作用回归通过；
- backend/frontend contract 一致且没有继续更新 legacy ReactSheet；
- 两仓提交边界清晰，无无关文件、无临时 debug 脚本、无 `[DEBUG-*]` 残留；
- Review、update log、Insight、engram 均已同步后才可宣布 P1 7/8/10 完成。
