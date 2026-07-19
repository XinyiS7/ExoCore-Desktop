# P1-11 Model Target 前端迁移指南

> **面向仓库：** `../ExoCore-Desktop`
> **后端方案：** `Plan/Architecture_Slimming_P1_11_Model_Registry_Plan.md`
> **目的：** chat-core 从“只传 model、前端猜 provider”迁到“选择 model + Endpoint”，同时允许前后端独立发布。

## 1. 兼容结论

旧前端不会因没有 `endpoint` 停摆。后端支持：

| 请求 | 解析结果 |
|---|---|
| 无 model、无 endpoint | preset default model（否则 main model）+ main Endpoint |
| 只有 model | 指定 model + main Endpoint |
| 只有 endpoint | preset/default main model + 指定 Endpoint |
| model + endpoint | 指定 pair |

所有路径都在进入 `LLMGateway` 前解析成完整 `ResolvedModelTarget`。后端切换 runtime 前必须预检所有启用 preset 的 `default_model` 均与 main Endpoint 兼容；预检失败就不切换，不能等用户发送时才暴露。

## 2. 已核实的当前代码

以下成员于 2026-07-18 从源码核实：

| 文件 | 当前事实 | 修改方向 |
|---|---|---|
| `packages/chat-core/src/components/chat/ChatArea.jsx:64,426-436` | `currentModel` 是字符串，来自 `preset.default_model` | 持有 model + 临时 Endpoint，从 catalog/main role 初始化 |
| `packages/chat-core/src/components/chat/ChatArea.jsx:719-731` | body 总是传 model/cache，没有 endpoint | 新增数值字段 `endpoint` |
| `packages/chat-core/src/components/chat/ChatArea.jsx:1219-1240` | `ControlsDrawer` 只收到 model | 传 catalog、Endpoint 与 target callback |
| `packages/chat-core/src/components/chat/ControlsDrawer.jsx:37-67` | 从静态 model registry 猜 provider，再选 key alias | provider 从 Endpoint 取；移除会话 key alias 选择 |
| `packages/chat-core/src/components/chat/ControlsDrawer.jsx:194-202` | model 下拉使用静态 `MAIN_MODEL_IDS` | 改用 catalog models，与 Endpoint 联动 |
| `packages/chat-core/src/components/settings/ModelAssignPanel.jsx` | 保存 `{role: model}` | 保存 `{role, model, endpoint}` rows |
| `packages/chat-core/src/views/AgentProfile.jsx:84-110,203-206,429-432` | preset 只保存 `default_model` | 保留；只显示能与 main Endpoint 组成默认 pair 的模型 |
| `packages/shared/src/endpoints/config.js` | 没有 catalog/Endpoint/roles wrappers | 增加集中 API wrappers |
| `packages/shared/src/endpoints/agents.js:21-35` | chat wrapper 原样透传 body | 签名可保持，只补契约说明 |
| `packages/shared/src/api.js:10+` | 静态 registry 是 bootstrap fallback | 不再用于 target/provider/兼容决策 |

前端权威契约实际位于 `../ExoCore-Desktop/ReactSheet_Reorganized.md`；后端仓库也有 `ReactSheet_Reorganized.md` 副本，本项同步两份。

## 3. 前端使用的数据契约

### 3.1 Catalog

```text
GET /api/core/model-catalog/
```

```js
{
  models: [{ name, family, abilities, compatible_endpoint_ids }],
  endpoints: [{
    id, name, provider, payload_format, cache_transport,
    attachment_transports, configured, enabled,
  }],
  roles: [{ role, model, endpoint }],
}
```

前端规则：

- 不实现 `supported_families/supported_models/excluded_models`。
- 兼容性只看 `model.compatible_endpoint_ids.includes(endpoint.id)`。
- 默认模型只展示至少有一个 configured、enabled compatible Endpoint 的条目。
- Endpoint 下拉只展示 compatible、configured、enabled 项。
- `payload_format/cache_transport` 只用于说明 UI；前端不构造 provider payload。

### 3.2 Chat body

```js
{
  content: currentInput,
  model: sessionTarget.model,
  endpoint: sessionTarget.endpoint,
  cache_enabled: cacheEnabled,
  // 其余现有字段不变
}
```

- `endpoint` 是数值 id，不发送 label/provider/URL。
- `cache_enabled` 只表示用户是否允许有效 cache 策略；前端不决定 reference 或 inline。
- 新前端停止发送 `api_key_alias`。Endpoint 已绑定凭证，alias 不能覆盖它。
- 旧前端仍带 `api_key_alias` 时，兼容后端接受该字段但不让它覆盖 resolved Endpoint。

### 3.3 错误

至少展示：

```text
invalid_model_endpoint_pair
model_disabled
endpoint_disabled
endpoint_not_configured
target_config_error
```

SSE 建立前的非 2xx 必须读取 JSON body，不能只显示 `HTTP 400`。async 模式同样展示 code/message。配置错误不自动重试或静默换 Endpoint；保留输入和附件。

## 4. 会话状态与交互

建议在 `ChatArea` 用不可拆分状态：

```js
const [sessionTarget, setSessionTarget] = useState({
  model: "",
  endpoint: null,
});
```

初始化：

```text
model = preset.default_model || role(main).model
endpoint = role(main).endpoint
```

它只是页面临时 override：

- 不 PATCH preset。
- 不 PUT roles。
- 不修改 Endpoint。
- 切换会话或重新进入页面时恢复默认 pair。

本次不要用 localStorage 偷渡“每会话持久 Endpoint”。若以后需要记住选择，应新增明确的持久契约。

联动规则：

1. 换 model 后当前 Endpoint 仍兼容：保留。
2. 不兼容但只有一个 configured compatible Endpoint：自动切换并给出可见提示。
3. 有多个候选：清空 Endpoint，要求用户选择。
4. 没有候选：model 不可选并说明原因。
5. Endpoint 下拉本身只列兼容项，不生成非法 pair 再等后端拒绝。

Cache/附件提示：

- `remote_reference` 显示“远端引用缓存”，`inline_chunk` 显示“上下文快照内联”。
- OpenRouter 承载 Gemini family 时仍显示 inline。
- 附件可依据 abilities/transports 预提示，但 reference/inline/vision helper 由后端最终决定。

## 5. 分文件施工顺序

### F1 — shared API

修改 `packages/shared/src/endpoints/config.js`，增加：

```js
getModelCatalog()
listModelEntries()
listEndpoints()
createEndpoint(data)
updateEndpoint(id, data)
deleteEndpoint(id)
getModelRoles()
updateModelRoles(rows)
```

保留 `listModels()` 一版供旧调用；新页面不得从旧 shape 推 provider。

### F2 — target 纯函数

在 shared 或 chat-core 非视觉层增加并测试：

```js
getMainRole(catalog)
getCompatibleEndpoints(catalog, modelName)
resolveInitialSessionTarget(catalog, preset)
changeTargetModel(catalog, currentTarget, nextModel)
```

这些函数只消费 catalog，不自行理解 family/provider 兼容算法。

### F3 — 设置页

修改 `ModelAssignPanel.jsx`：

- role 改为 `main/general_sub_agent/vision_helper/grounding/image_gen`。
- 每行保存 model + Endpoint。
- model 按 role abilities 过滤；Endpoint 按 compatible ids 过滤。
- 保存走 roles API 整体 PUT。
- `style_shadow/calendar/aux` 不做独立项；说明它们共享 general sub-agent pair。

Endpoint CRUD 如需较多 UI，拆独立 `EndpointManagePanel`，不要把 key、URL、transport 编辑塞进 role row。

### F4 — AgentProfile

保留 `AgentPreset.default_model`。候选模型必须兼容 main Endpoint；保存前阻止已知非法选择，后端仍做最终校验。

### F5 — 会话临时 override

修改 `ChatArea.jsx` 与 `ControlsDrawer.jsx`：

- 使用 `sessionTarget`。
- 增加联动 model/Endpoint 下拉。
- body 同时发送 model、endpoint、cache_enabled。
- provider 从 Endpoint 取，不从 model 名或静态表猜。
- 删除 `exo_session_key_<sessionId>` 的读写及 `api_key_alias` body 字段。
- SSE 与 async 共用一个 body builder，防止漏字段。

### F6 — 契约与 fallback 清理

- 同步前后端两份 `ReactSheet_Reorganized.md`。
- 设置与 chat target 不再依赖 `MAIN_MODEL_IDS/MODEL_REGISTRY`。
- 静态表只保留离线 label fallback。
- 全局搜索 model-name 到 provider 的字符串猜测并逐处确认，不做无审查批量删除。

## 6. 安全发布顺序

1. 后端发布 additive schema、seed、catalog、roles/Endpoint API。
2. legacy-default 预检通过后，后端切换 target-only Gateway；旧 chat body 仍受支持。
3. 前端发布 pair selector，显式发送 endpoint，停止发送 api_key_alias。
4. 观察 target 配置错误，确认没有旧客户端特有失败。
5. 以后可删除旧 `/api/core/models/` adapter；endpoint 缺省解析建议保留为正式 fallback。

回滚前端不会使聊天停摆：旧 bundle 恢复只传 model，后端仍以 main Endpoint 补全 target。

## 7. 验证

```bash
cd /d/Alicia/ExoCore_Project/ExoCore-Desktop
pnpm lint
pnpm build
```

手工矩阵：

1. 旧 body 只传 model + cache_enabled，消息成功。
2. 新 body 默认 pair 发消息成功。
3. 同一 Gemini model 分别选官方/OpenRouter，均可发送，后端采用不同 payload/cache 策略。
4. 换 model 后 Endpoint 正确保留、唯一切换或要求重选。
5. 临时 Endpoint 不修改 preset/roles，重新进入会话后恢复默认。
6. 无 compatible configured Endpoint 时禁用发送并说明原因。
7. 配置错误保留输入和附件，不自动重试或换 Endpoint。
8. SSE/async body 均含相同 model/endpoint/cache_enabled。
9. 新请求不含 api_key_alias；旧请求含该字段仍被后端接受。
10. OpenRouter + Gemini family 不显示为 ExoCore remote cache。

## 8. 不做

- 前端不构造 Gemini/OpenAI payload。
- 前端不选择 file id/file uri/inline/vision helper。
- 前端不实现 Endpoint compatibility 算法。
- 不给 Conversation 新增持久 Endpoint 字段。
- 不把临时选择自动保存到 preset/main role。
- 不把 Calendar 做成独立模型配置；它与 style-shadow/aux 共用 `general_sub_agent` pair。
