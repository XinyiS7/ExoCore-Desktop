---
name: exocore-workflow
description: Preserve existing behavior and downstream side effects during ExoCore code changes. Use before deleting code, changing shared signatures, or refactoring cross-module flows.
compatibility: pi
metadata:
  scope: exocore
---

# Skill: ExoCore 改动工作流 (exocore-workflow)

## 1. 核心理念

改代码不是替换文本。每段旧代码被写出来都有它的目的。
改动时必须回答：**旧代码在做什么 → 新设计下这个目的由什么承接 → 有没有遗漏。**

禁止的行为模式：
- 看到旧代码和新设计"看起来不一样"就直接删除
- 改一个文件不考虑关联文件是否也需要同步变更
- 不读旧代码的上下文就判断"这个不需要了"

---

## 2. 改前：理解旧代码的目的

### A. 触发条件

以下任一情况都必须先做这件事：
- 删除任何函数/方法/代码块
- 修改一个被多处调用的函数签名或行为
- 重构一个类或模块（如"把正文标记改成工具调用"）

### B. 操作

对即将改动的每一段旧代码：

1. **读它的实现和注释** — 不是瞟一眼，是逐行理解
2. **问：它解决了什么问题？** — 用一句话描述它的目的（不是它的做法，是它存在的理由）
3. **找到它的下游消费者** — 谁调用它？谁依赖它的返回值？谁依赖它的副作用？
4. **记录行为清单** — 旧代码产生的每一个外部可见效果（返回值、DB 写入、文件写入、日志、通知、状态变更）

工具链：
```bash
# 1. insight 影响面查询
python.exe .agent/insight/query_insight.py --target <ClassNameOrMethod>

# 2. 全局搜索调用方
rg -n "<function_name>" --type py
rg -n "<class_name>" --type py

# 3. 搜索同模块相关类（如果改了一个 Task，检查其他 Task 是否用同一套模式）
rg -n "<shared_pattern>" <same_directory>
```

---

## 3. 改中：行为映射

### 核心问题

对旧代码的每一个外部可见效果，在新设计中由什么机制承接？

| 旧行为 | 新设计中的承接 | 状态 |
|--------|-------------|------|
| `parse_action()` 从正文正则提取操作 | function calling 返回结构化 args | ✓ 已覆盖 |
| `_record_interaction()` 记录探索搜索到 Register | ??? | ⚠ 待确认 |

如果某个旧行为在新设计中**找不到承接**，只有两个选择：
- **补上**：在新设计中增加机制覆盖这个行为
- **问用户**：这个功能是否要废弃？为什么要废弃？

**绝对禁止**：行为缺失但默不作声地跳过。

### 关联模块同步检查

改了 A 文件的一个模式，必须搜索 B/C/D 文件是否用了同一套旧模式：

```bash
# 示例：改了 services.py 里某个类的 parse_action，检查同文件其他类
rg -n "parse_action" background_sessions/services.py

# 改了工具声明模式，检查所有工具声明文件
rg -n "<old_pattern>" agents/tool_declarations/ background_sessions/
```

---

## 4. 改后：提交前审查

### 强制流程

```bash
# 1. 查看所有改动文件
git diff --stat

# 2. 逐文件检查 diff
git diff <each_file>

# 3. 对每个改动文件问自己：
#    - 这个文件的改动是否都是本次意图范围内的？
#    - 有没有遗漏的关联文件？（改了 services.py 的某个方法，tools.py 是否也需要对应调整？）
#    - 有没有"顺手"改动的不相关代码？如果有，要么分开 commit，要么提醒用户
```

### 无关改动处理

如果 `git diff --stat` 显示有不在本次意图范围内的文件被改动：
1. 检查改动内容
2. 如果是独立修复/改进 → 分开 commit，写清楚的 commit message
3. 如果是意外改动 → 恢复
4. 如果与本次改动相关但忘了提 → 补充到 commit 中，更新 commit message

---

## 5. Insight 强制查询

以下改动前必须跑 insight（与 `get_exocore_insight` skill 互补）：

- Django model / migration / serializer / view / service
- API endpoint / response shape / SSE event
- LLM tool declaration / tool name / tool result shape
- `../../../engines/model_registry.py`
- memory / context cache / retrieval 逻辑
- scheduler job / signal / background routine
- 跨模块契约（frontend / extension / ExoCoreData 文件格式 / port）

```bash
python.exe .agent/insight/query_insight.py --target <EntityName>
# 或
python.exe .agent/insight/query_insight.py --file <path>
```

---

## 6. 删除看似走不到的代码前，必须确认其目的由什么承接

看到“走不到”的代码分支（如 collector/logging 分支），不得直接删除。旧代码的存在通常有目的；新设计可能改变了调用路径，但目的本身（写入 Register、记录探索行为等）可能仍需在新路径上等价承接。删除前先回答：这个分支为什么存在？它的目的在新设计中由哪个调用点承接？若无承接点，必须在等价位置补上实现后再删。
