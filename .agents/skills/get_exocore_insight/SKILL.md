---
name: get-exocore-insight
description: 查询 ExoCore 项目的代码关系地图，回答「改 X 影响什么」类问题，结合静态地图与动态 grep 验证
compatibility: pi
metadata:
  scope: exocore-backend
---

# Skill: ExoCore Insight (get-exocore-insight)

## 1. Description

查询 ExoCore 项目的代码关系地图，回答「改 X 影响什么」类问题。

首选入口是本地脚本：

```bash
python.exe .agent/insight/query_insight.py --target AgentPreset
python.exe .agent/insight/query_insight.py --file agents/models.py
python.exe .agent/insight/query_insight.py --api /api/agents/chat/
```

脚本会先读取 `.agent/insight/backend.yaml` 与 `.agent/insight/dataflows.yaml`，再用 `rg` 现场验证路径/符号是否仍存在，并补充当前代码库中 YAML 没写到的新引用。

## 2. 设计理念

**静态地图 + 动态验证。** insight YAML 只记录 grep 不容易看出的非直观耦合；显式 import、FK、URL、方法调用由脚本现场搜索补齐。

结论优先级：

1. 代码现场验证结果优先。
2. YAML 记录是影响面提示，不是绝对事实。
3. 脚本输出不足时，继续 `rg` 和读源码补充。

## 3. 高风险自动触发

做以下改动前必须查询 insight：

- Django model、migration、serializer、view、service 入口
- API endpoint、API response shape、SSE event
- LLM tool declaration、tool name、tool result shape
- `engines/model_registry.py` provider、capability、credential routing
- memory compaction、context cache、retrieval/orchestrator 逻辑
- scheduler job、signal、background routine
- cross-module contract：frontend、extension、ExocoreData 文件格式、port/URL

普通样式、文案、局部测试、小型内部 helper 且无跨模块契约时，不强制查询。

## 4. 工作流

### A. 选择查询方式

按用户问题或即将修改的对象选择一个参数：

| 目标 | 命令 |
|------|------|
| 实体、类、方法、自然语言关键词 | `python.exe .agent/insight/query_insight.py --target <name>` |
| 文件路径 | `python.exe .agent/insight/query_insight.py --file <repo/path>` |
| API 路径 | `python.exe .agent/insight/query_insight.py --api <path>` |

**注意**：在 Git Bash 下使用 `--api` 时，路径不要以 `/` 开头（会被 MSYS 展开为 Windows 路径），写成 `--api "api/agents/chat/"` 即可。

### B. 阅读固定报告章节

脚本固定输出：

```markdown
## 影响范围
## 已验证引用
## YAML 记录但未验证
## 新发现引用
## 跨模块检查
## 建议检查清单
```

处理规则：

- `已验证引用`：优先阅读这些文件和方法。
- `YAML 记录但未验证`：视为地图可能过期，必须继续 `rg` 或读源码确认。
- `新发现引用`：检查是否需要补充到 YAML；如果只是显式 import 或普通调用，不一定写入地图。
- `跨模块检查`：如果出现 frontend、extension、data touchpoint，必须检查对应模块或 API contract。

### C. 脚本不足时继续补充

出现以下情况时，不能只依赖脚本结果：

- 输出“未在 insight 中命中”
- 输出“YAML 记录但未验证”
- `rg` 不可用
- 用户问题涉及具体字段、response shape、tool 参数或前端组件
- 查询目标是自然语言而不是明确实体名

补充方式：

```bash
rg -n "<symbol-or-field>" .
rg -n "<api-path-or-tool-name>" ..\ExoCore-Desktop ..\ExocoreExtension
```

然后阅读命中的定义文件、serializer/view/service、ReactSheet 文档或扩展 API client。

## 5. 常见查询模式

| 查询类型 | 首选命令 | 后续重点 |
|---------|----------|----------|
| Model 字段变更 | `--target ModelName` | migrations、serializer、admin、frontend 字段假设 |
| Service 方法签名变更 | `--target MethodOrService` | dataflows.yaml 命中的流、所有调用者 |
| API shape 变更 | `--api api/...` | urls.py、ReactSheet.txt、ExoCore-Desktop、ExocoreExtension |
| model provider 变更 | `--file engines/model_registry.py` | LLMGateway、SystemConfigSerializer、SubAgentService、前端模型选择 |
| tool declaration 变更 | `--target tool_name` 或 `--file agents/tools.py` | tool loop、SSE/tool result rendering、telemetry |
| memory compaction 变更 | `--target MemoryCompactor` | SuperiorService post-response、scheduler、ContextCacheManager、HistoryChunk |

## 6. 输出使用规范

- Insight 查询是影响分析起点，不替代读代码和 code review。
- 如果发现 YAML 过期，在本次重大改动结束时同步更新相关 insight YAML 或 update log。
- 不要把旧版 `../.exocore_insight.json` 当主要事实源；它只是历史资产索引。
- 不要让子代理修改文件。需要补充分析时可以 spawn 子代理只读查询，但最终修改由主代理执行。

## 7. 子代理 fallback

只有在脚本结果不足、影响面很大、或需要并行阅读多个模块时才 spawn 子代理。

子代理 prompt 应要求：

1. 先读取脚本输出。
2. 针对未验证/无命中的部分继续 `rg`。
3. 只读分析，不修改文件。
4. 输出缺口清单和建议补充的 insight 条目。
