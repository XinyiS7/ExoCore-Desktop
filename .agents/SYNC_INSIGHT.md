# Insight System Sync — from extension-pane CC

## 上下文

我们刚才在项目根目录讨论并创建了 ExoCore Insight 体系的共有文档。

## 已创建的文件

### 项目根目录
- `.agent/project.md` — 项目身份 + 模块边界定义
- `.agent/insight/overview.md` — insight 系统架构说明
- `AGENT.md` — 跨模块统一指南 + 耦合警告表

### 需要你在后端创建的
- `ExoCore/.agent/insight/backend.yaml` — 后端的 model→view→serializer→service→test 映射链
- `ExoCore/.agent/insight/dataflows.yaml` — 关键数据流路径（chat flow, council flow, ingestion pipeline）

## Insight 架构（三层）

```
Layer 1: 项目根 .agent/insight/overview.md  — 系统概述（已完成）
Layer 2: 各模块 .agent/insight/*.yaml        — 结构化代码关系地图（后端待做）
Layer 3: get_exocore_insight skill            — spawn 子代理查询 insight（后端待实现）
```

## 设计要点

1. **只记录 grep 找不到的非直观耦合**。grep 能搜到的上下游不要写进 map
2. **YAML 格式**，不是 JSON。可手写可加注释
3. **insight map 是活文档**，改代码时同步更新
4. **子代理模式**：调用 get_exocore_insight → spawn 子代理加载 insight yaml + grep 现场验证 → 回答"改 X 影响什么"
5. **不单独做 tool**，注册在 use_skill 里，superior 通过 spawn_sub_agent 调用

## YAML Schema 参考

```yaml
# backend.yaml
entities:
  AgentPreset:
    path: agents/models.py
    type: model
    upstream:
      - entity: AgentFactory
        path: agents/factory.py
        reason: "instantiates service based on agent_type"
      - entity: AgentPresetSerializer
        path: agents/serializers.py
        reason: "serializes preset for API"
    downstream:
      - entity: AgentSession
        path: agents/models.py
        reason: "FK to AgentPreset"
    touches_frontend: true
    touches_extension: true
    migrations:
      - agents/migrations/0023_*.py
    tests:
      - test_api.py
```

## 其他

- 更新 ExoCore/CLAUDE.md，在顶部加一行引用根目录的共有文档：
  ```
  Before working: read ../.agent/project.md and ../AGENT.md for cross-module context.
  ```
- 各个前端和 extension 的 insight map 由各自的 agent 在自己的模块里实现
- 阿莱在 extension 写的 generate_insight.py 是初版探索，生成的是静态 JSON，方向对但不完整。我们讨论后决定用 YAML + 活文档 + 子代理的方案替代
