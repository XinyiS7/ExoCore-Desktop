# V4 P3 CP0 — KF-07 ScheduleEntry 创建独立诊断

日期：2026-10-02；执行：pane7 Builder（CP0 诊断），scout 只读核查，test-runner 隔离验证。

## 结论与门禁

**诊断发现：FAIL — 当前 V3 CalendarWidget 快捷创建存在确定的 payload 缺陷。** 缺少必填 `start_date`，且空备注发送 `description: null`，实际 ScheduleEntrySerializer 同时拒绝两个字段。失败仅写 console，用户界面缺少错误反馈。

此结论不是 C3/CP0 验收 verdict，也不能证明该缺陷就是 Alicia 历史报告的唯一原因。历史记录无 ScheduleEntry 专属报错或复现步骤；相关后端 pending 实际关注 SubAgentTask，不可混用。

**P3 生产施工继续 HOLD。** 交独立诊断与另案修复需求给 pane5；未获得后续 release 前不进入 CP1–CP4，不改 River 或 V3 生产代码。无需后端变更即可处理已证实的客户端缺陷；本轮不生成后端修复 spec。

## 核查范围与当前源码接点

| 链路 | 当前文件 / 行 | 事实 |
|---|---|---|
| 基线 | `Plan/V4_Phase_0_Baseline/V3_Baseline.md:140` | KF-07 reported/undiagnosed；不是已证实后端故障 |
| 快捷创建 | `packages/chronicle/src/components/CalendarWidget.jsx:38,69–83,237–260` | todo payload 缺 start_date；空 note → null；catch 只 console.error；表单只有标题/日期 |
| 页面可达 | `packages/chronicle/src/views/CalendarView.jsx:63` | CalendarWidget 在 Calendar 页渲染 |
| 完整表单对照 | `packages/chronicle/src/components/TaskCreateModal.jsx:14–18,40–59,69–85` | 三类型共用 start_date、字符串 description；默认日期；失败有 setError |
| 传输 | `packages/shared/src/endpoints/tasks.js:11–14`、`packages/shared/src/api.js:45–80` | POST `/api/tasks/entries/` 原样 JSON 序列化；不会补 start_date 或转换 null；非2xx抛异常 |
| 来源模型（只读） | `../ExoCore/tasks/models.py:43,47` | description blank=True 但非 nullable；start_date 无默认且必填 |
| 来源校验（只读） | `../ExoCore/tasks/serializers.py:12–74` | 实际 ModelSerializer，无上述字段放宽或默认注入 |
| 来源入口（只读） | `../ExoCore/tasks/views.py:30–45` | 普通 ListCreateAPIView，绑定该 serializer，无 create 覆盖 |
| 历史 pending（只读） | `../ExoCore/Plan/exocore_task_feature_anomaly_pending.md` | 2026-08-21 记录对象是 SubAgentTask/异步回传，症状仍待补充 |
| 文档漂移 | `ReactSheet.md:736,740–755` | River 节列当前字段；§4.1仍列旧 type/priority/scheduled_date 等示意，与当前源码冲突 |

scout 历史核查：P0 `f48b4fe` 曾更正 Task 文档，`1d0bc82` 的 ReactSheet 修改恢复了旧 §4.1；CalendarWidget payload 追溯到 `ba1b9b1`。历史追溯用于来源说明，不替代当前源码/动态校验证据。

## 假说及排除范围

1. **H1：快捷创建 payload 非法。已证实。** 即便标题合法、due_date 合法，仍被两个独立字段错误拒绝；只补一个字段不能解决。
2. **H2：旧文档诱导错误创建请求。当前字段冲突已核实；未证明用户历史请求来自该文档。** 另案修正文档，不扩大为 API 改造。
3. **H3：历史 Task 报告被跨领域引用。** pending 明确是 SubAgentTask；不能据此宣布 ScheduleEntry 后端坏了，也不能因错引就抹去 H1 的真实缺陷。

完整 modal 三类型 payload 通过 serializer 校验，但**不据此声称 HTTP201、数据库落盘或真实 UI 创建成功**。本轮未进行这些验证。

## 隔离验证与决定性断言

执行原命令：`python.exe kf07_probe.py`，临时目录 `C:/Users/Alicia/AppData/Local/Temp/kf07probe.GtxURV/`。

保留同字节诊断工装：`Plan/Diagnostics/v4_p3_kf07_serializer_probe.py`（copy 比较 exit 0）。可从 Desktop 执行 `python.exe Plan/Diagnostics/v4_p3_kf07_serializer_probe.py`；脚本 BACKEND 目前定位本机 `D:/Alicia/ExoCore_Project/ExoCore`。该副本未另跑一轮重复自检；本次结果对应同字节临时脚本。

test-runner 返回：**exit 0；21 assertions passed / 0 failed**，Django 6.0.2 / DRF 3.17.1。业务与隔离断言分别列出，数量不冒充场景覆盖。

| 脚本断言 / 场景 | 决定性结果 |
|---|---|
| `KF07-1-calendarwidget-payload-rejected`、`KF07-1-errors-exactly-start_date+description` | `is_valid=False`，错误键恰为 description、start_date |
| `KF07-1-start_date-required-message` | `start_date: ["This field is required."]` |
| `KF07-1-description-null-message` | `description: ["This field may not be null."]` |
| `KF07-2-date-added-description-null-still-rejected` | 仅添加 start_date 后，description null 错误仍在 |
| `KF07-3-desc-added-start_date-still-missing` | 仅替换 description 为字符串后，start_date required 错误仍在 |
| `modal-todo-full-payload-valid` / `modal-periodic-full-payload-valid` / `modal-goal-full-payload-valid` | 使用三类型完整合法 payload，各 `is_valid=True` |
| `blank-description-valid` / `omitted-description-valid` | 有合法 start_date 时，空字符串或不传 description 均可校验通过 |

快捷创建复现输入：

```json
{"title":"KF07 calendarwidget","entry_type":"todo","due_date":"2026-04-20","description":null}
```

这些结果来自**实际 serializer**，不是手写模拟后端；输入是基于当前源码构造的合成数据，不是从真实数据库取样。普通 DRF 创建流程会在保存前拒绝该输入；HTTP400 是由标准入口及上述校验推导，**没有发实际 HTTP 请求**。

### 安全证据

- Django setup **之前**直接 `settings.configure`；不导入 ExoCore.settings、不加载 .env；仅 auth/contenttypes/tasks，tasks AppConfig 无 ready 副作用。
- 唯一 DB engine 为 `django.db.backends.dummy`；无真实/测试 Postgres、无 SQLite 写入、无 migrations、无 `.save()`。
- setup 前封锁 Base/dummy DB connection/cursor 与 CursorWrapper execute/executemany；封锁 socket connect/connect_ex/create_connection/getaddrinfo。
- `no-network-during-probe`、`no-db-access-during-probe` 断言均为空调用列表；正向控制确认 DB/net 阻断器实际抛异常，不是假空计数。
- 未采用 scout 建议的 `manage.py test`、默认 test_exocore、真实库 baseline 命令或使用生产 settings 的 setup 预检；这些不满足本轮更严格的前置隔离要求。
- 未写 backend 源文件、未重启服务、未调用真实 GCal/付费接口、未触真实数据或 AgentPreset。

## 另案修复需求（待授权，不施工）

**归属：Desktop / V3 chronicle 单独 bugfix，不夹入 River。**

- 修复 CalendarWidget 快捷创建的 start_date 与 description 映射；由 Adviser/Alicia 明确所选日期与生效日期语义，不悄悄改后端必填规则。
- 创建失败应在表单可见，保留输入；增加请求期间防重入，避免修复后重复点击造成多个条目。
- 对快捷创建及完整 modal 的公共来源字段做针对性回归；至少包含空备注、非空备注、选中日期不同于今天、失败保留输入及防重入。真实 HTTP201/落盘验证若需要，应由获授权的隔离数据库环境承担，不用本轮 serializer 验证替代。
- 文档旧 §4.1 另列更正项，以现有源码为准，不把 priority 等旧字段带入 P3。
- 当前证据不要求后端修改；若后续隔离落盘暴露 backend defect，再只写 Desktop `Plan/spec/` 交对应仓处理。

## Builder 自检 / execution-log

- 已读取 Detailed Plan、只读 acceptance_spec、UI HTML/Report；保留 F1/F2 与三项 CLOSED 决策，不重选交互。
- personally 核对 CalendarWidget → shared wrapper/transport → backend view/serializer/model、完整 modal 对照、基线/历史 pending，并读完整探针源码与返回断言；确认结果仅覆盖 validation 层。
- 当前新增仅本报告及 Builder 诊断脚本；无生产修改、无提交、无 staged/untracked 清理、不修改冻结输入或历史报告。
- 未重验 LR01/C2/B2；未派生 reviewer/acceptance 子代理。
- 提交 pane5 独立处理；KF-07 FAIL 未修复，CP0 release/C3判定仍属外部责任方。等待授权，不开始 CP1。
