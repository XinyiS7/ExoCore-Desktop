---
name: wezterm-pane-interaction
description: Pure interaction and coordination protocols for WezTerm CLI agents across multiple panes.
---

---

# WezTerm Pane Interaction Protocol

Strict CLI operational and syntax rules for agents executing within a multi-pane WezTerm harness (supports both fully automated and human-in-the-loop modes).

---

## 1. Environment & Identity Self-Check

Before running any cross-pane commands or querying the environment:

1. **Self-Identify First**: MUST execute `echo $WEZTERM_PANE` to confirm current Pane ID (`$MY_PANE`).
2. **Context Resolution**: Run `wezterm cli list --format json` to map target panes via `pane_id`, `cwd`, or active process title (Note: UI Tab Titles are not natively exposed in CLI lists).

### 1.1 通讯触发门槛（禁止状态广播）

跨 pane 能力常驻，但消息不是例行报备。仅在以下条件同时成立时联系目标 pane：

1. 目标 pane 当前正在工作，或已明确等待本 pane 的 handoff/release；
2. 存在具体协调事项：同文件/同 scope 冲突、同一独占测试库或服务、或已建立的 Builder↔Reviewer acceptance 链。

以下情况**不得发送**：目标 pane 空闲且未等待资源；scope/文件互不重叠；只是想广播「我开始了/结束了/测试通过了」。release 只发给先前收到对应占用通知或明确等待该资源的 pane。拿不准时先读取目标状态；没有具体冲突证据就保持静默，不向所有 pane 群发。

---

## 2. Pre-Message Context & Compact Control

Before sending tasks or responses to any target pane (`$TARGET_PANE`):

1. **Read Target Tail**: Execute `wezterm cli get-text --pane-id $TARGET_PANE --start-line -10` to inspect target pane status.
2. **Check Token Ceiling**:
* Parse usage indicator at the bottom (e.g., `... 0.0%/1.0M (auto)`).
* If token count exceeds **200k** (Hard Limit: 272k):
 **ONLY in loop mode**: 
 - Issue compaction: `wezterm cli send-text --pane-id $TARGET_PANE "/compact\n"`
 - Poll target pane until compaction completes before assigning new tasks.
Otherwise let the human decide when to make a compaction.


---

## 3. Sender Prefix & Messaging Format

Prepend every message with identity metadata:

* With Persona/Name: `[<Name> from pane {$MY_PANE}]: <Message>`
* Without Name: `[Pane {$MY_PANE}]: <Message>`

---

## 4. `send-text` Syntax Guide (Direct vs Input Buffer)

Depending on whether human review is required in the loop, use the correct syntax:

> ⚠️ **关键注意**：在 WezTerm 中运行的 TUI 交互式 Agent（如 `pi`, `opencode`, `codex` 等），**回车提交键是 `\r`（Carriage Return）**。`\n` 在多行输入框中仅作为普通换行，不会触发提交，甚至可能被转义为字面量字符串 `\n`。

### A. Direct Execution (全自动 Loop / 立即发送并运行)

推荐两步式或带 `\r` 提交：
```bash
# 方式 1：Git Bash 原生两步式（管道文本 + printf 发送 \r 回车）
echo -e "[<Name> from pane $MY_PANE]: <message>" | wezterm cli send-text --pane-id $TARGET_PANE --no-paste
printf "\r" | wezterm cli send-text --pane-id $TARGET_PANE --no-paste

# 方式 2：Windows 环境防引号转义推荐（Python 一行式稳妥提交 \r）
python.exe -c "import subprocess; subprocess.run(['wezterm', 'cli', 'send-text', '--pane-id', '$TARGET_PANE', '--no-paste', '\r'])"

# 方式 3：Git Bash 尾随 $'\r' 一体化提交
wezterm cli send-text --pane-id $TARGET_PANE --no-paste "[<Name> from pane $MY_PANE]: <message>"$'\r'
```

### B. Input Buffer Staging (人类干预 / 停留在输入区待确认)

**仅发送文本，不发送 `\r`**，使提示内容停留在目标窗格输入缓冲区中，由人工复核或手动按回车：
```bash
echo -e "[<Name> from pane $MY_PANE]: <message>" | wezterm cli send-text --pane-id $TARGET_PANE --no-paste
```

### WezTerm cross-pane protocol (read → send → verify → submit):
**Primary**: Git Bash (Priority):
```bash
echo $WEZTERM_PANE                                               # 0. Know where you are
wezterm cli list                                                 # 1. discover pane IDs
wezterm cli get-text --pane-id <id> | tail -n 20                 # 2. READ before acting
echo -e "[<Name> from pane $MY_PANE]: <message>" | wezterm cli send-text --pane-id <id> --no-paste
                                                                 # 3. SEND (no Enter yet)
wezterm cli get-text --pane-id <id> | tail -n 10                 # 4. VERIFY text landed
printf "\r" | wezterm cli send-text --pane-id <id> --no-paste   # 5. SUBMIT (Enter; pi/opencode/codex TUI 必须用 \r，\n 只换行不提交)
# 或用 Python 提交 \r 防止 Windows Shell 嵌套引号转义踩坑：
python.exe -c "import subprocess; subprocess.run(['wezterm', 'cli', 'send-text', '--pane-id', '<id>', '--no-paste', '\r'])"
```
Fallback: PowerShell (Only if Bash is unavailable):
```powershell
wezterm cli list                                                 # 1. discover pane IDs
(wezterm cli get-text --pane-id <id>) -split "`n" | Select-Object -Last 20 
                                                                 # 2. READ before acting
Write-Output "[<Name> from pane $MY_PANE]: <message>" | wezterm cli send-text --pane-id <id> --no-paste
                                                                 # 3. SEND (no Enter yet)
(wezterm cli get-text --pane-id <id>) -split "`n" | Select-Object -Last 10 
                                                                 # 4. VERIFY text landed
wezterm cli send-text --pane-id <id> --no-paste "`r"             # 5. SUBMIT (Enter)
```

---

## 5. Multi-Phase Loop & Sign-off Protocol

1. **Phase Boundary Lock**: Worker panes MUST NOT proceed to the next phase unilaterally.
2. **Explicit Report Requirement**: Builder outputs phase execution logs to the Reviewer pane.
3. **Independent Decision**: Reviewer evaluates and sends explicit approval (`PASS`/放行) back to the Builder pane before execution resumes.

---

## 6. Loop 节奏与消息礼仪（异步消息循环）

本节只适用于§1.1门槛已经满足、协作关系已经建立的双方，不要求向无关或空闲 pane 汇报状态。协作双方遵循「发送前检查 → 忙则等待 → 发送后不轮询」的异步节奏：

1. **发送前检查**：发送前必须 `wezterm cli get-text --pane-id $TARGET_PANE` 读取目标状态（见 §2）。若对方**正在忙**（输出仍在滚动 / busy indicator / 处理中），**poll 等待**（间隔数秒重试 get-text）直到空闲再发送；等待超时仍 busy 则通知人类协调，不硬塞消息。
2. **发送后不轮询**：消息发送并 verify（text landed）后**停止轮询**，转入等待状态，不得持续 get-text 监视对方。等待回复期间可做本地准备，但不得再次向对方发消息。
3. **Builder 节奏**：
   - 完成一个 checkpoint 后**主动**向 Reviewer 发阶段进度报告（带阶段标识与执行结果）。
   - 发出后等待 Reviewer 消息，**不轮询**。
   - 收到 Reviewer 消息后：**有异议 → 回复讨论**；**无异议 → 直接开工下一阶段**，无需再发确认消息（避免冗余往返）。
4. **Reviewer 节奏**：
   - 收到 Builder 进度后主动检查该阶段产物。
   - 结论**主动**发给 Builder：`FAIL + 理由`（指出问题并说明期望修正）或 `PASS + 继续/等待` 指令。
   - 同样无需等待 Builder 确认收到。

---

## 7. 重复排查升级协议（三次原则）

单机排查同一问题容易钻牛角尖，不一定是能力问题——施工/构建过程中同样适用（不只是 debug 场景）。满足以下条件时必须**停止同一方向的盲目排查**，向协作方/Reviewer 发结构化求助：

1. **触发条件**：同一问题已做 **≥3 次独立排查实验**（不同假设/不同实验设计）仍无确定结论；或同一假设验证 3 次结果矛盾。
2. **停止动作**：立即停止继续实验；恢复工作区到已知状态（移除临时 patch/调试输出）；不再尝试第 4 种猜测。
3. **求助消息格式**（发给对方必须包含）：
   - 问题一句话 + 影响范围；
   - 已做的 3 组实验及其结果（带证据：日志/退出码/对照 commit）；
   - 已排除的假设（一句话一个）；
   - 需要对方判断的具体问题点（给出可选项，方便对方拍板）。
4. **等待期间**：只做低风险本地准备（如跑组合验证、整理报告），不得继续同一方向的盲试；对方回复后按判定执行。
5. **收尾**：无论结果如何，把根因与判定记入对应 Plan/施工记录（含双方署名），避免他人重踩。