# REQ — Per-Agent Tool Drawer 授权与 MCP alias 凭证管理

**状态：** `[Frozen / Frontend Contract Ready / Backend Pending]`

**产品裁决：** `[Alicia / approved]`

**架构整理：** `[gpt-5.6-sol / Solaire]`

**日期：** 2026-08-13

**权威 wire contract：** `ReactSheet.md` 第十篇

## 1. 产品目标

1. 后端本地维护全部合法 Drawer / MCP server catalog；前端只能管理已有名称，不能创建任意 domain。
2. 每个 Drawer 独立维护 visitor 授权；授权关系不保存为 `AgentPreset` 的 JSON/list 字段。
3. 每个 AgentPreset 可以对同一 MCP server 使用公共凭证或一对一凭证。
4. 凭证写入后只以 alias 管理；前端永远不读取明文，运行时由后端按可信 caller preset 从数据库解析。
5. 同一份 per-preset Drawer Registry 同时约束 `go_to(domain)` 和 Heartbeat `tool_activate(domain)`。

## 2. 冻结领域结构

```text
Local Drawer Catalog
  name -> server_name -> declaration provider/tool compaction

DrawerAccess
  drawer_name + preset_id + enabled

McpCredential
  globally unique alias + server_name + opaque credential_value

McpServerCredentialBinding
  server_name -> nullable public credential alias

McpPresetCredentialBinding
  preset_id + server_name -> mode(inherit_public|dedicated)
                              + nullable dedicated credential alias
```

### 2.1 为什么不复用 `core.ApiKey`

当前 `ApiKey` 不能直接承担 MCP 凭证：

- `platform` 由 `ProviderProfile` allowlist 校验，只接受模型 provider；
- Endpoint 外键与删除时“同 key_value 全删 + 清 SystemConfig”属于模型 API key 语义；
- `CharField(max_length=500)` 和 provider mismatch 校验不应泄漏到 MCP server；
- 复用会让 MCP alias 删除意外影响模型 Endpoint 或旧 SystemConfig。

因此 MCP 使用独立 secret resource，但复用相同的产品交互：POST 写入、GET 只见 alias/metadata、PUT overwrite、PATCH rename、DELETE。

### 2.2 凭证值形式

v1 将 MCP key/token 保存为 **opaque UTF-8 secret string**：

- API 字段名统一 `credential_value`，不按 `api_key` / `bearer_token` 分裂；
- server adapter 决定它最终进入 Bearer header、query/header key 或其他 transport；
- 数据库字段应允许空值以外的长文本（实现建议 `TextField`），但 POST/overwrite 拒绝空白；
- 不保存到 DrawerAccess、AgentPreset、Event、prompt、tool args 或日志；
- API 响应只返回 alias、server_name、last_four 与时间；绝不返回 secret；
- 本阶段不承诺 OAuth refresh bundle、JSON credential document 或自动轮换；这些需另行扩展 credential type/lifecycle。

> 当前项目 `ApiKey.key_value` 也是数据库 write-only 明文。若未来要求应用层静态加密，应作为统一 secret-store 项目处理，不能只给 MCP 引入一套未经运维验证的加密协议。

## 3. 公共与一对一解析

每个 MCP server 的本地 catalog 冻结：

```text
credential_strategy = none | shared | per_preset | shared_or_per_preset
credential_required = bool
```

Preset binding 冻结：

```text
mode = inherit_public | dedicated
```

解析矩阵：

| strategy | 合法 mode | 解析 |
|---|---|---|
| none | 无 binding | 无凭证；adapter 必须支持匿名 |
| shared | inherit_public | server 公共 alias |
| per_preset | dedicated | 当前 preset 专属 alias；禁止公共 fallback |
| shared_or_per_preset | inherit_public / dedicated | 显式选择公共或专属 |

- 公共 alias 可以为 null；专属 binding 的 credential FK 在 `dedicated` 时必须非空。
- required server 解析不到有效 alias 时 `credential_ready=false`。
- visitor 授权允许先保存，但运行时 `go_to`、`tool_activate` 与 MCP dispatch 必须在网络前拒绝未 ready 配置。
- 不因 dedicated alias 缺失而静默 fallback 到 public；mode 是明确选择。

## 4. 前端施工注意事项

### 4.1 Drawer 勾选页

- 先读取 `GET /api/agents/drawers/` 形成列，再读取 preset Drawer 配置形成勾选状态。
- 勾选保存必须逐项 PUT，不整份覆盖 visitor list。
- `available=false` 的 Drawer 显示为后端未接入；不要把它等同于 `enabled=false`。
- `credential_ready=false` 应显示独立 warning；不要擅自撤销 visitor 勾选。
- 保存只代表后端确认；请求失败必须恢复 UI 或明确标记未保存，禁止 optimistic fake success。
- 当前运行中的 Heartbeat 不受设置变动影响；UI 不应承诺立即关闭其 active Drawer。

### 4.2 MCP Server 管理页

- Server 列表由 `GET /api/agents/mcp-servers/` 驱动；不要硬编码 Galatea/Moonlight。
- 凭证输入框只用于 POST/overwrite 当次提交；提交结束立即清空组件状态。
- 编辑页面只显示 alias、last_four、configured/ready 与更新时间，不显示 placeholder secret。
- “公共凭证”实际保存的是 alias binding，不是再次提交 secret。
- preset credential mode 只展示 server strategy 允许的选项。
- `dedicated` 的 alias 下拉只列同一 `server_name` 的 credentials。
- 清除公共绑定提交 `credential_alias: null`；这不会删除 credential alias。
- 删除 alias 遇到 `credential_in_use` 时提示先解除公共/preset binding；前端不要自动级联解绑。

### 4.3 安全与日志

- 不把 `credential_value` 放入 URL、query string、localStorage、sessionStorage、toast、console、analytics 或错误上报。
- API wrapper 不记录 credential request body。
- 浏览器密码管理器/autocomplete 建议关闭；值不要在页面重载后恢复。
- 错误展示只使用后端安全 `error/code`；不回显原始请求体。
- alias 不是 secret，可以显示、复制和用于 binding。

### 4.4 后端未上线期间

本契约标记为 Backend Pending。前端可以完成组件、类型和 endpoint wrapper，但：

- 404/503 必须展示“后端接口尚不可用”；
- 不使用临时 localStorage 假保存取代后端；
- 不把 mock 数据带入生产 build；
- backend 交付后再做真实联调。

## 5. `go_to` / Heartbeat 联动

```text
catalog合法 Drawer
∩ DrawerAccess(enabled, preset)
= authorized ToolDrawerRegistry
```

该 Registry 是以下入口的唯一 domain allowlist：

1. live main conversation 的 `go_to(action="spawn", domain=...)`；
2. Heartbeat 的 `tool_activate(domain=...)`；
3. `HeartbeatActor(initial_drawer_name=domain)` 的 trusted initial activation。

MCP dispatch 继续走既有 `mcp_{server}_{tool}` 唯一路由，只新增 server-owned credential resolution：

```text
ToolCallerIdentity.preset_id
+ DrawerDefinition.server_name
-> public/per-preset alias binding
-> McpCredential secret
-> credential-scoped MCP client
```

LLM/tool args 不得提交 preset、alias、token 或 credential mode。

## 6. Scope Razor

本需求不授权：

- 将 Drawer list/token 字段加到 `AgentPreset`；
- 前端创建任意 Drawer/server；
- 接入真实 Moonlight 工具/schema/通知；
- OAuth refresh、自动轮换或多字段 JSON credential；
- 修改 HeartbeatActor 状态机；
- 让 alias 删除自动级联解绑；
- 未经 Alicia 明确许可调用真实外部 MCP server。
