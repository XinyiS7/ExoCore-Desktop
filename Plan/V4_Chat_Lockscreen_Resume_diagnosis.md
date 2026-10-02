# V4 Chat 锁屏后恢复 — RESOLVED（LR-01）

**历史登记状态：待诊断 / 当时未授权修复。**
**当前状态（2026-10-02）：RESOLVED / LR-01 R2 FINAL PASS。** 独立R1完整1345/1345与源码核验通过；Alicia确认传输中与完成后解锁均自动呈现进度/完整回答，无需手点继续。报告 `Plan/V4_Chat_Foreground_Resume_acceptance_report.md`（`953cae3`）；锁屏造成的effective C2 hold解除，有效C2 PASS + B2 PASS前置满足，但P3施工未授权、不启动。下文原始复现/登记时边界保留为历史。
**记录：** [gpt / Solaire]
**依据：** Alicia 的真实使用复现；不是已验证根因。

## 用户复现

1. 停留 V4 Chat，发出消息后直接锁屏。
2. 后台 arrival 通知正常送达。
3. 解锁回到页面，显示“网络连接异常或流式传输中断”，按钮“继续轮询”。
4. 页面仅有用户最新消息，Agent 侧无回复内容；头像旁仍显示“正在分析输入”及转圈。
5. 不操作则持续卡住；点击“继续轮询”后取回完整回复。

## 预期

网页后台暂停不要求保持连接；恢复到前台后，应自动核对当前运行与 canonical Message，补齐回复并清除过期的运行/错误状态，无需用户手动继续轮询。

## 登记时边界（历史）

- UI 明确属于 Chat Runtime 恢复路径，不能作为 P2D notification transport 失败的证据。
- 通知正常和手动可取回回复表明消息处理/读取可用，不足以确定所有后端细节。
- 自动恢复未触发、失败状态阻止续接、请求竞态等均尚未用源码与可执行复现确认。
- 不宣称端口/nginx 是原因，也不通过强保持后台连接预设修法。

## 门禁说明

历史门禁：`Plan/V4_Core_C2_acceptance_report.md` 的既有 PASS 早于本次明确复现，曾暂挂 effective C2 HOLD 等待修复与复验；此前通知真机观察及自动化证据保留有效。当前解除该hold的证据见 LR-01 R2报告及 Core C2报告 §7 supplemental release，不覆盖原历史。

登记时 Alicia 仅允许先保存 B2 plan，之后正式处理本 issue；当时本记录不授权生产修改。后续验证至少覆盖发送后锁屏、后台完成、解锁自动补回完整回复且不重复，并清除旧转圈/中断提示。

## LR-01 已确认源码因果

[gpt-6.1-sol / Solaire Builder；Scout定位；Alicia授权经pane5 Acceptance转交]

`useChatRuntime.startPollingLoop` 的网络失败保存 token/cursor 并进入 `blocked/poll_failed`；原源码没有前台事件监听，只有按钮调用 `resumePolling`。blocked 仍是 busy，当前会话 P2D arrival 不替代 runtime status/reconcile，因此通知正常不能清除旧运行投影。真实 ConversationPage 驱动、仅模拟 HTTP 的新增测试，在未修改生产代码时复现：visible visibilitychange 后 canonical完整回复未出现；手动续接的既有路径则已有覆盖。

修复仅加 visible前台事件到同一 resume 命令，并记录事件generation处理“先返回前台、旧GET随后才reject”的时序；GET替换前同步transition防并发，替换失败且无新事件则保留blocked。route listener绑定会话而不是每次send变化的operation epoch；请求与resume本身仍核对当前operation identity。terminal沿旧canonical fetch/apply/lease clear/UI release，未改变POST、notification或backend。

自动化与施工修正证据：`Plan/V4_Chat_Foreground_Resume_execution_log.md`；已归档施工memo：`Plan/Archived/V4_Chat_Foreground_Resume_Implementation_Memo.md`；冻结行为：`Plan/V4_Chat_Foreground_Resume_acceptance_spec.md`，最终证据：`Plan/V4_Chat_Foreground_Resume_acceptance_report.md`（两者Acceptance owns）。保留无失败响应、仍live且永不settle的GET不主动重启的窄边界；实际设备自动恢复已由Alicia按R2确认，未捏造设备级请求/去重telemetry。
