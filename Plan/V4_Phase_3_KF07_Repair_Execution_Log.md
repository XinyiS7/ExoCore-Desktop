# KF-07 独立 Desktop/V3 bugfix — execution-log

日期：2026-10-02；Builder pane7。授权：Alicia经pane5明确release，仅 KF07-F01/F02；依据只读 `Plan/V4_Phase_3_KF07_acceptance_report.md`。本文件为施工证据，不是Acceptance verdict、CP0闭合或CP1 release。

## 1. 施工范围

- 生产修改仅 `packages/chronicle/src/components/CalendarWidget.jsx`：当前 `addTask` 位于72–104行；表单/错误/pending约248–285行。
- `start_date` 每次提交时计算运行时**本地今天**，不使用UTC切日；selectedDate/deadline仍决定due_date，互不替代。description发送字符串（当前无note输入，正常为`''`），未增加备注UI。
- 首次日历选择也使用相同本地日期，避免“今日任务”与日历月份/日期、创建生效日错位。
- 创建中使用同步ref锁+状态：click/Enter不重复POST；标题、截止日、添加/取消/表单开关禁用；成功后加来源返回项并清空/关闭表单。
- 明确4xx失败显示`role=alert`，保留标题及deadline，释放pending供用户主动重提。
- 网络/5xx/无法确认新id的成功响应，提示“保存结果不确定，请先刷新核对任务列表，再决定是否重新提交，避免重复创建”；不自动POST重试，不保证重提安全。
- 未修改完整TaskCreateModal三类型、shared传输、后端契约、ReactSheet、River或P3入口；无commit、无他人文件清理。

## 2. 施工偏差与优化

- 使用chat-core已有Vitest/jsdom/RTL运行新增的**V3跨包测试**：`packages/chat-core/src/components/calendarWidget.kf07.test.jsx`直接导入真实chronicle组件。chronicle没有测试依赖；不引新依赖、不将V3组件导入V4 app。
- 日期 helper 同时用于此组件初始selectedDate及提交start_date，确保局部语义一致。完整modal自身UTC默认日期未顺手调整；本次授权明确要求快捷创建本地今天。
- 对异常成功响应检查正整数id，避免把无法确认结果的对象当成创建成功；沿现有ScheduleEntry integer pk，不改变公开协议。
- 新增创建/截止日可访问名称与alert角色；输入法组合输入的Enter不触发POST。这些是局部防御，不重制日历。

## 3. 回归证据

测试文件：`packages/chat-core/src/components/calendarWidget.kf07.test.jsx`，describe `KF07 V3 CalendarWidget quick create`；展开参数化后**10个用例**。

| 用例名 | 决定性断言 |
|---|---|
| `maps runtime local today and blank description at %s`（02:30Z / 22:30Z） | createTask收到完整title/todo/start_date本地日期/due_date本地日期/description空字符串；成功可见条目，表单关闭；fetch未调用 |
| `keeps selected day as due_date, not start_date; custom deadline overrides selection` | 选25日仍用本地今天start_date，due_date=04-25；重开后标题已清空，自选05-09只改due_date |
| `computes start_date at submission even when the form spans midnight` | 表单跨本地午夜，提交start_date=04-21而已选due_date=04-20 |
| `blocks click/Enter reentry and editing/cancel while pending; success clears the form` | 延迟Promise期间重复Enter/点击只产生1次POST；输入/取消/开关禁用；resolve后显示条目、关闭表单、解锁 |
| `shows rejected POST visibly, retains title/deadline, and releases guard for explicit resubmission` | 400显示alert；未trim草稿及自选日期原样保留；无自动再发；用户主动再提后成功，调用数2 |
| `warns uncertain %s results without automatic POST retry or input loss`（network / server503） | 显示不确定/先刷新核对/避免重复提示；保留输入，调用数1 |
| `does not treat an unconfirmed success response as a created entry` | 返回{}显示不确定，保留输入，不伪造条目，仅调用1次 |
| `rejects whitespace titles and ignores Enter during composition` | 空白标题不请求；输入法Enter不请求 |

**超原复现边界：** 跨午夜提交、自选截止、并发防重、400后用户主动重提、网络/503不确定结果、异常成功响应、输入法Enter。修复不是只给原非法JSON填两字段。

机械结果由test-runner执行，本人阅读当前diff/完整测试与返回结果完成连贯自检；未派生reviewer/acceptance。

| 命令 | 结果 / 有界说明 |
|---|---|
| `pnpm --filter exo-chat-core test:run -- src/components/calendarWidget.kf07.test.jsx` | exit0，实际执行15文件/102 tests全部通过，包含上述KF07文件。尾随`--`未收窄Vitest范围，runner如实记录；额外执行的是已有V3开发测试，不是LR01/C2/B2验收 |
| `pnpm --filter exo-chronicle build` | exit0，1772 modules，PWA构建完成；非致命警告：shared静态/动态混用、plugin timing、inlineDynamicImports deprecated |
| `python.exe Plan/Diagnostics/v4_p3_kf07_serializer_probe.py` | exit0，21/21；仍证明原非法payload被真实serializer拒绝，以及三类型合法payload校验通过；dummy设置，DB/net计数为空，阻断正向控制通过。冻结工装未修改 |

本轮未跑chronicle lint（没有flat config，已有基线债务，未为此扩大修复）；没有TypeScript变更。未重复主模型测试或进行多轮自评。

## 4. 安全与未验证边界

- DOM开发测试mock `tasksApi`，fetch设禁止访问；build不启动服务。隔离serializer工装不使用生产settings/真实DB/HTTP/save。
- **没有实际浏览器对后端HTTP201、DB落盘或真实GCal成功证据**；mock成功响应仅证明组件提交/状态逻辑。未启动、重启或隐藏运行服务。
- chat-core中另有近似CalendarWidget副本，scout核查其HomePanel当前无importers；不据此删除/修改它，本次仅修获授权的chronicle实际Calendar路径。
- ReactSheet旧§4.1字段漂移只保留为独立文档建议，不在此修复。
- 诊断/Acceptance报告、冻结River plan/spec/UI全部只读保留。

## 5. 交付状态

施工/开发验证完成，提交pane5独立复核。KF07是否闭合、CP0 PASS及后续CP1 release由外部责任方判定；**P3继续HOLD，不进入CP1，不自行重制River或日历。**
