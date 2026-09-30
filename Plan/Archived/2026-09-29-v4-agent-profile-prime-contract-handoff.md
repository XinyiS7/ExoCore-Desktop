# Unique G045 + Prime Conversation — ExoCore Backend Contract Handoff

> **状态：** FROZEN SPEC — Alicia 已批准；等待 ExoCore backend Builder 分派 Gate 0
> **日期：** 2026-09-29
> **消费方：** ExoCore-Desktop V4 Agent Profile companion
> **后端仓：** `../ExoCore/`

## 1. 冻结的产品事实

1. ExoCore 产品域内 **G045 必定且只存在一个**。
2. 唯一 G045 只要已有正常、用户可见 Chat，就必须且只能有一个 Prime Conversation。
3. 全新或重置系统中，第一个正常、用户可见 G045 Chat 自动成为 Prime。
4. 后续只能通过选择另一正常、用户可见 Chat 排他转移 Prime。
5. Prime 不能被清空；当前 Prime 必须先转移，才能删除原会话。
6. Prime、Heartbeat、用户留言和指定唤醒不向 standard 或其它 tier 开放。

本轮不设计复数 G045、正常 Chat 的零 Prime 状态、Prime 猜测、Prime 自动漂移或多用户并发体系。Council 已列入后续废弃范围，不参与 Prime 设计或验收；WezBridge / AGY bridge 是可选外部容器，不是 Prime 候选，也不覆盖它们作为初始或唯一 Conversation 的场景。

Alicia 已授权修正旧 P2A/P2C 文档中的复数 G045 fixture、list map 和多选措辞；old/new hash 记录见 `Plan/2026-09-29-g045-singleton-invariant-doc-rebaseline.md`。历史 point-in-time acceptance pin 不回写；`self_check_preset_ids` 等数组 wire shape 最多承载唯一 canonical G045 ID。

本 handoff 仅在 Prime 删除边界上 supersede `Plan/V4_P2_Conversation_Delete_T0_Disposition.md` 的 “no prime redesign”：当前 Prime 必须先转移后删除；其它删除生命周期不变。

## 2. 当前实现缺口

已存在：

- `memory.models.Conversation.is_prime`；
- `memory.services.ConversationService.set_prime_conversation()` 的顺序清旧设新基础；
- `push.arrival_service` 对“恰好一个 Prime”的 fail-closed 消费。

尚未满足产品事实：

- live `agents.serializers.ConversationSerializer` 没有 `is_prime`，list/detail 与 PATCH 均未接通；
- G045 首个正常、用户可见 Chat 创建后仍是 `is_prime=false`；
- 当前 Prime 可以被删除并形成零 Prime；
- 数据库没有“同一 preset 至多一个 Prime”的 backstop；
- AgentPreset 写路径没有完整阻止第二个 G045 或把唯一 G045 改成其它 tier。

因此本 handoff 不是纯 serializer 补字段，而是一次小范围 invariant closure。

## 3. 后端行为契约

### 3.1 唯一 G045

- 现有 canonical G045 保持唯一；
- 任何把其它 preset 改成 `g045` 的写入必须拒绝；
- 任何把唯一 G045 改成其它 `agent_type` 的写入必须拒绝；
- 不新增第二套 G045 选择、排序或 fallback 逻辑；
- 真实库仍必须通过既有 8-row baseline。

### 3.2 首会话自动 Prime

唯一 G045 创建正常、用户可见 Chat 时：

- 若此前尚无 Conversation，新会话在同一创建事务内写为 `is_prime=true`；
- 后续新会话默认 `is_prime=false`，不得抢走现有 Prime；
- 不按 latest timestamp 猜 Prime，也不在读取时偷偷修复。

当前 canonical 用户会话创建入口为：

```text
POST /api/agents/sessions/init/
```

只有创建正常、用户可见 G045 Chat 的生产入口需要复用同一创建 service；Council 与 bridge 容器保持既有外部/待废弃边界，不纳入本 Gate。

### 3.3 Read

现有 conversation list/detail additive 返回 strict boolean：

```json
{
  "id": 95,
  "name": "Alessandro",
  "is_prime": true
}
```

适用于：

```text
GET /api/agents/conversations/
GET /api/agents/conversations/<id>/
```

### 3.4 排他转移

沿用 detail PATCH：

```http
PATCH /api/agents/conversations/<id>/
Content-Type: application/json

{"is_prime": true}
```

要求：

- 仅接受唯一 G045 所属 Conversation；
- 旧 Prime 清除与目标 Prime 设置必须是一个原子结果；
- 重复设置当前 Prime 幂等；
- 成功响应中的目标必须为 `is_prime=true`；
- `PATCH {"is_prime": false}` 返回 400，不得进入普通 serializer save；
- 失败不得留下零 Prime、两个 Prime 或响应值与数据库不一致。

实现时不得沿用当前“先 `serializer.save()`，再调用 service”的双写顺序。`is_prime` 必须从普通字段保存中隔离；service 成功后刷新响应 instance，再序列化返回。

### 3.5 唯一性 backstop

新增条件唯一约束：同一 `agent_preset` 在 `is_prime=true` 时最多一条 Conversation。

“至少一个”由创建、转移和删除边界共同维持：

- 首个正常、用户可见 Chat 自动 Prime；
- transfer 不产生中间可见零 Prime；
- 当前 Prime 的 DELETE 返回 409，并提示先选择另一主会话；
- Prime 转移后，旧 Conversation 可按原流程删除。

不要求构造多用户并发压力测试；验证顺序行为和约束即可。

## 4. Desktop 消费契约

- 仅唯一 G045 的 Agent Profile 显示 Prime 星标；
- 当前 Prime 显示实心星；其它会话显示空心星；
- 点击空心星先确认，再 PATCH true；
- 点击实心星零写入；
- 当前 Prime 不显示可执行删除，或在删除尝试时呈现后端“先转移”的明确错误；
- standard tier 不显示 Prime UI。

确认文案可以直接使用阿莱：

```text
将「<会话名>」设为主会话？
阿莱之后主动发送的消息会进入这个会话。
```

## 5. 最小验收

1. 唯一 G045 不可被改走；其它 preset 不可改成 G045。
2. fresh 状态创建第一个正常、用户可见 G045 Chat，读取为 `is_prime=true`。
3. 创建第二个正常 Chat 后，仍只有第一个是 Prime。
4. PATCH 第二个为 true 后，第一为 false、第二为 true。
5. 重复 PATCH 当前 Prime 为 true 保持幂等。
6. PATCH false 被拒绝且 Prime 不变。
7. DELETE 当前 Prime 被拒绝；转移后旧会话可删除。
8. 数据库条件唯一约束阻止同 preset 两个 Prime。
9. conversation list/detail 返回真实 `is_prime`。
10. 现有 name/thinking/memory PATCH 与普通删除不回归。

机械门：

```text
python.exe manage.py test <focused test labels> -v 2
python.exe manage.py check
python.exe manage.py makemigrations --check --dry-run
bash .agent/check_real_db_baseline.sh
```

本轮不需要真实 provider、真实 Heartbeat 或复杂竞态测试。

## 6. 预计文件与收口

预计影响：

```text
agents/serializers.py
agents/views.py
agents/tests/...
memory/models.py
memory/services.py
memory/migrations/...
memory/tests/...
ReactSheet.md
```

边界：

- ExoCore-Desktop Builder 不跨仓施工；
- 后端 PASS 后 Desktop 才完成 Prime CP-C 联调；
- 两仓 `ReactSheet.md` 同步唯一 G045、首会话自动 Prime、排他转移与禁止清空/删除；
- 不改变 Heartbeat、Push arrival 或主动消息投递的其它语义。
