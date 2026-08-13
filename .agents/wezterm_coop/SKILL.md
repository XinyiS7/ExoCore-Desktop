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

### A. Direct Execution (全自动 Loop / 立即发送并运行)

Append `\n` at the end of the text string to trigger immediate shell/agent submission.

```bash
# Direct Execution: Sends text and presses Enter immediately
wezterm cli send-text --pane-id $TARGET_PANE "[Solaire from pane $MY_PANE]: Phase 1 approved. Proceed to Phase 2.\n"

```

### B. Input Buffer Staging (人类干预 / 停留在输入区待确认)

**Omit `\n**` (and optionally add `--no-paste` if necessary) so the prompt lands in the target pane's input buffer without auto-submitting. This allows a human operator to review, edit, or press Enter manually.

### WezTerm cross-pane protocol (read → send → verify → submit):
**Primary**: Git Bash (Priority):
```bash
echo $WEZTERM_PANE                                               # 0. Know where you are
wezterm cli list                                                 # 1. discover pane IDs
wezterm cli get-text --pane-id <id> | tail -n 20                 # 2. READ before acting
echo -e "[<Name> from pane {$MY_PANE}: ] <message>" | wezterm cli send-text --pane-id <id> --no-paste 
                                                                 # 3. SEND (no Enter yet)
wezterm cli get-text --pane-id <id> | tail -n 10                 # 4. VERIFY text landed
printf '\r' | wezterm cli send-text --pane-id <id> --no-paste  # 5. SUBMIT (Enter; pi/codex TUI 用 \r，\n 只换行不提交)
```
Fallback: PowerShell (Only if Bash is unavailable):
```powershell
wezterm cli list                                                 # 1. discover pane IDs
(wezterm cli get-text --pane-id <id>) -split "`n" | Select-Object -Last 20 
                                                                 # 2. READ before acting
Write-Output "[<Name> from pane {$MY_PANE}: ] <message>" | wezterm cli send-text --pane-id <id> --no-paste 
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