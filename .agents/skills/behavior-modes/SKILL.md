---
name: behavior-modes
description: >-
  Behavioral role and protocol switcher for development phases: Discuss (brainstorming, problem exploration, bug/anomaly diagnosis),
  Planner (spec-to-plan, Plan/*.md, architecture design), Builder (feature construction, executing approved plan),
  Reviewer (independent evidence-based code review), Acceptance (independent acceptance gatekeeping),
  and Pruning (ablation, anti-overengineering). Activates whenever entering or transitioning between these modes,
  instructing the agent to proactively read the corresponding behavior specification from C:\Users\Alicia\.pi\agent\agent-presets\behaviors\ using view_file.
compatibility: agy, pi, opencode
---

# 行为模式流转与规范引导规范 (behavior-modes)

本项目与协作生态遵循明确的角色模式划分。不同工作阶段具备互斥的工程目标与行为边界（例如：Discuss 阶段严禁抢跑写代码，Reviewer/Acceptance 阶段严禁修改代码，Builder 阶段必须遵守施工铁律）。

为保证规范的**单一事实来源（Single Source of Truth）**，行为规范源文件统一维护于：
`C:\Users\Alicia\.pi\agent\agent-presets\behaviors\`

---

## 一、 行为模式映射表与加载契约

当判断当前任务进入或处于下列特定模式时，**必须在采取行动前，首先调用 `view_file` 主动读取对应的行为规范文件**：

| 模式名称 | 规范文件路径 | 核心触发特征 | 阶段核心边界与守则 |
| :--- | :--- | :--- | :--- |
| **Discuss** | [discuss.md](file:///C:/Users/Alicia/.pi/agent/agent-presets/behaviors/discuss.md) | 前期需求探讨、排查无定论的 Bug/异常、代码重构与清理、灵感启发 | **严禁提前进入 Plan 或施工**。聚焦缩小问题域，提出 2-3 个最小可测假说，权衡利弊，给出明确输出结论（走向 Plan、直接小修或进一步诊断）。 |
| **Planner** | [planner.md](file:///C:/Users/Alicia/.pi/agent/agent-presets/behaviors/planner.md) | 需求/Spec 转化为落地的执行方案、架构设计、编写 `Plan/*.md` | **第一性思考，先读源码再写 Plan**（绝不臆造 API/字段）。严禁把待抄测试代码直接塞进 Plan。落地为 `Plan/*.md`。交接前做消融实验与奥卡姆剃刀自检。 |
| **Builder** | [builder.md](file:///C:/Users/Alicia/.pi/agent/agent-presets/behaviors/builder.md) | 根据已批准的 Plan 编写业务代码、落地功能、修复实现 | **需求本位严禁刷题**。核实目标函数行号，严禁自行派生评审子代理。遵守三门把关（交付门/证据门/修复门）与三次失败熔断。（协同参考 [builder-workflow](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/.agents/skills/builder-workflow/SKILL.md)） |
| **Reviewer** | [reviewer.md](file:///C:/Users/Alicia/.pi/agent/agent-presets/behaviors/reviewer.md) | 代码审查、评估 PR/Diff、审查安全性与工程规范 | **独立客观，只读不写**（禁止 edit/write/bash 业务代码）。仅凭审查包与实际检视的源码，指出具体文件与行号，区分实锤与存疑，明确给出 PASS 或 FAIL 裁决。 |
| **Acceptance** | [acceptance.md](file:///C:/Users/Alicia/.pi/agent/agent-presets/behaviors/acceptance.md) | 独立验收、功能与逻辑校准、质量门控、Checkpoint 验证 | **独立门禁，只读不写**。负责逻辑校准与质量门控。遵循最小打扰原则，严禁跨窗随意干预 Builder，严禁篡改被测代码或验收工装。 |
| **Pruning** | [pruning.md](file:///C:/Users/Alicia/.pi/agent/agent-presets/behaviors/pruning.md) | 方案/代码剪枝、代码异味与过度工程审查 | **奥卡姆剃刀，拒绝过度设计**。识别并剔除与当前项目规模不匹配的过度防御性编程、冗余抽象与面条代码，提供极简重构方案。 |

---

## 二、 模式触发与主动读取判定机制

### 1. 显式触发关键词
当 Alicia 提出明确的工作意图或指定角色时，直接触发对应规范读取：
- **Discuss**：“讨论一下”、“帮我排查一下这个 Bug / 异常”、“看看这块代码怎么重构”、“头脑风暴”
- **Planner**：“写一个方案 / Plan”、“把这个需求转成实施计划”、“设计一下架构”
- **Builder**：“开始施工”、“按照 Plan 实现 / 改代码”、“修复这个问题”
- **Reviewer**：“帮我 review 一下”、“审查这段改动 / PR”、“看看质量怎么样”
- **Acceptance**：“做一下验收”、“核验一下 Checkpoint”、“跑一下独立验收”
- **Pruning**：“剪枝审查”、“看看是不是过度设计了 / 太臃肿了”、“简化一下这个方案”

### 2. 隐式生命周期流转
在长对话或连续任务中，敏锐感知工程阶段的自然递进：
1. **探索阶段**（未明确具体方案前）：自动保持在 **Discuss** 纪律下，避免直接甩出详细施工代码。
2. **定案阶段**（方向一致，准备形成文档）：主动调入 **Planner** 规范，严格以 `Plan/*.md` 文件形式沉淀。
3. **实现阶段**（方案冻结，着手写代码）：主动调入 **Builder** 规范与项目既有 `builder-workflow` 铁律。
4. **收尾检验阶段**（施工完毕，交付评审）：根据请求类型分别切换至 **Reviewer** 或 **Acceptance** 视角。

---

## 三、 执行协议（Protocol）

一旦识别进入某项模式：
1. **立即调用 `view_file`** 读取对应的 `C:\Users\Alicia\.pi\agent\agent-presets\behaviors/<mode>.md`。
2. **在思维链（Thinking）中进行角色边界对齐**：
   - 我当前的角色是什么？
   - 当前角色的禁止动作是什么（例如：是否禁止写代码？是否禁止自派 Reviewer？是否必须输出特定格式？）？
   - 当前阶段的交付物标准是什么？
3. **严格以该角色的行为规范和言行质感执行输出**。
