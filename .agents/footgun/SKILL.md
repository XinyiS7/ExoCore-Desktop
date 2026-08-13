---
name: footgun
description: Quick-reference catalogue of environment-specific mistakes that waste time when repeated — check before running shell commands or editing Python files
compatibility: pi
metadata:
  scope: exocore
---

# Skill: Footgun

Quick-reference catalogue of environment-specific mistakes that waste time when repeated.
**Check this before running shell commands or editing Python files.**

## Shell Mistakes
### [2026-07-31] WezTerm send-text 跨 pane 提交键是 \r 不是 \n
- **Context**: 多 pane WezTerm 里用 `wezterm cli send-text --pane-id <id> --no-paste` 向另一个 pi/codex agent pane（如独立验收方 Solaire）注入消息。
- **Precaution**: heredoc 尾部的 `\n`、或 `echo -ne "\n" | send-text --no-paste`，都不触发提交——消息停在 input buffer，agent 不处理（目标 pane token 水位不动、无 Working spinner）。pi/codex 的 TUI 多行输入框把 `\n` 当换行而非 Enter；各家 TUI 提交键不统一（codex/π 实测用 CR `\r`，PowerShell fallback 原本就是 `` `r ``）。
- **Quick Fix**: 先 heredoc 发消息体，再单独 `printf '\r' | wezterm cli send-text --pane-id <id> --no-paste` 提交；随后 get-text 目标 pane 看 token 上涨 / Working spinner 确认已吃进去。

### [2026-07-31] INJECTION_LOG_ENABLED 全局 True 撞 _prepare_raw_message 单测
- **Context**: `ExoCore/settings.py:280` `INJECTION_LOG_ENABLED = True`；`agents/services.py` `_prepare_raw_message` 末尾在开关为真时调 `write_injection_log(conversation.id, ctx.cache_zone, ...)`。
- **Precaution**: 用 SimpleNamespace mock conversation/ctx 跑 `_prepare_raw_message` 单测时，会进入 write_injection_log，访问 `conversation.id` / `ctx.cache_zone` / `ctx.debug_system_prompt` 等，SimpleNamespace 缺这些字段直接 AttributeError。
- **Quick Fix**: 测试用 `from django.test import override_settings` + `with override_settings(INJECTION_LOG_ENABLED=False):` 包裹调用；或给 conv/ctx 补全 write_injection_log 所需全部字段。

### [2026-07-16] Codex PowerShell Session Is Not WezTerm Git Bash
- **Context**: Codex shell commands on Windows, especially multiline patches and Django commands.
- **Precaution**: The execution tool may use PowerShell even when the user's WezTerm Git Bash has `exocore_project` activated. Do not assume `python.exe` is the project interpreter; verify `sys.executable`. Do not pipe multiline patches through PowerShell because encoding, CRLF, and nested quoting can corrupt the patch. Native `apply_patch` may also fail intermittently before parsing the patch when the Windows restricted-token sandbox cannot enforce split writable roots.
- **Quick Fix**: Use native `apply_patch` first. If it reports the split-writable-roots sandbox error, check whether the patch already landed; if not, invoke Codex's `--codex-run-as-apply-patch` entry with the same patch normalized to LF and approved for execution outside the sandbox. Never retry blindly or rewrite source with `Set-Content`. Keep PowerShell read-only, then verify strict UTF-8 decoding and `git diff --check`. For Django, use `E:\Conda\envs\exocore_project\python.exe manage.py ...` when the project environment is not active.
### [2026-05-12] Assuming Common Python Packages are Installed
- **Context**: Python scripts or Django codebase tools (e.g., `agents/tools.py`).
- **Precaution**: Do not assume common packages like `psutil` or `requests` are present in the virtual environment. Always check `requirements.txt` before importing them dynamically, or you might cause silent `ModuleNotFoundError`s.
- **Quick Fix**: Prefer Python standard library fallbacks (e.g., `subprocess.run(["tasklist", ...])` instead of `psutil` on Windows) if the dependency isn't explicitly required.

### [2026-04-29] WSL Path in Bash Tool **(已修复: 2026-05-30)**
- **Context**: Bash tool runs WSL bash, not Git Bash. Django management commands + file paths.
- **Status**: **已过时。** Shell 工具现统一使用 Git Bash 登录 shell（`bash.exe -l -c`），conda `exocore_project` 自动激活，`python.exe` 直接可用。
- **Quick Fix**: 直接用 `shell(command="python.exe manage.py <cmd>")` 即可，无需切 PowerShell。

### [2026-04-29] Smart Quotes in Python Source
- **Context**: Editing Python files with Chinese docstrings via Edit tool.
- **Precaution**: `"` `"` (U+201C/U+201D) and `'` `'` (U+2018/U+2019) cause `SyntaxError` in Python. The Edit tool may auto-convert typed ASCII quotes when mixed with Chinese text.
- **Quick Fix**: `$content -replace [char]0x201C, '"' -replace [char]0x201D, '"' -replace [char]0x2018, "'" -replace [char]0x2019, "'"`

### PowerShell Command Chaining
- **Precaution**: Do NOT use `&&` to chain commands (causes `ParserError`). Use `;` instead.
- **Quick Fix**: `git add . ; git commit -m "..."`

### Unix vs Windows Tools
- **Precaution**: DO NOT use `find .` for file searching; it invokes the Windows string search utility. Use `Get-ChildItem` or Claude Code's `Glob`/`Grep` tools.

### Virtual Environment Hazards
- **Precaution**: Recursive file operations often fail on `.venv/lib64` due to symlink loops. Always exclude `.venv` or target specific app directories.

### Conda Interpreter
- **Precaution**: Conda env `exocore_project` 在 WezTerm 交互环境和 shell 工具中均自动激活（shell 工具走 `bash.exe -l -c` 登录 shell）。直接用 `python.exe` 即可。不要手动 `conda activate` 或 `which python` 检查。

---

## Tool Loop Mistakes

### [2026-05-26] 工具回传设计原则（三收集器）

- **Context**: `engines/llm.py` — `build_gemini_tool_round` / `build_openai_tool_round`；
  `agents/services.py` — `_run_tool_loop_gemini` / `_run_tool_loop_openai`。
- **核心原则**:

  **Gemini**:
  - model turn: 增量正文（`turn_text`）+ FC parts
    → AI 翻 model 历史就能看到自己输出过的正文
  - user FR turn: FR parts + `[prior_reasoning]`（累积全量 thinking）
    → AI 在自己侧看不到 previous thoughts，必须由 user 侧回传
  - **`[prior_response]` 不需要** — Gemini 能看自己 model turn 里的正文
  - **NEVER 将 thinking 放入 model turn 的 text 中**（旧代码的 `<ExoCore>` 包装是错的）

  **OpenAI/DeepSeek**:
  - assistant turn: 增量正文（`content`）+ 增量思考（`reasoning_content`）+ FC parts
    → 三个字段天然分离，AI 翻历史全都能看到
  - tool turns: 每条工具调用独立 `role=tool` 消息
  - 不需要额外回传任何东西

  **三收集器结构**:
  ```
  collector_1 (前端/DB): 累积每个 chunk → SSE 流式 + DB 落库
    - full_response_content: 所有 content chunk
    - full_reasoning_content: 所有 thinking chunk
  collector_2 (AI 回传): 每轮工具回传时读取累积全量
    - Gemini: full_reasoning_content → user FR [prior_reasoning]
    - OpenAI: turn_thinking → assistant.reasoning_content
  tool_collector: 工具调用结果，_truncate_tool_result 截断超长内容
  ```

- **Quick Fix**: 永远使用 `LLMGateway.build_gemini_tool_round()` / `build_openai_tool_round()`
  而不是直接调用 `make_fc_assistant_turn` + `make_tool_result_turns`。
  Builder 内部处理：工具结果截断、thinking 路由到正确位置。

### [2026-05-18] Gemini/OpenAI Tool Loop Conflation (已过时，参见上方 2026-05-26)
- **Context**: `agents/services.py` — Superior tool loop (`_run_tool_loop`) and simple tool loop (`_stream_with_tools`).
- **Precaution**: Gemini and OpenAI have FUNDAMENTALLY different tool passback mechanisms:
  - **Gemini**: thinking goes in user-FR `[prior_reasoning]` text parts; response content goes in model turn as regular content. NEVER put thinking on the model turn.
  - **OpenAI/DeepSeek**: thinking MUST be `reasoning_content` on the assistant message. Content goes as `content` on the assistant message. Omitting `reasoning_content` causes 400 errors from DeepSeek.
- **Quick Fix**: Use `LLMGateway.build_gemini_tool_round()` / `build_openai_tool_round()` instead of calling `make_fc_assistant_turn` + `make_tool_result_turns` directly. The builders encapsulate all platform-specific parameter routing.
- **Design Principle**: Think of the model's flow as `.think → .say → tool → .think → .say → final`. Thinking is CoT (not output, user can't see). Response content IS output (user sees it, DB records it). The model must see its own intermediate content as proper output to continue coherently.

---

## The Three-Tier Error Protocol

### Tier 1: Known Pattern
- **Condition**: The error or a close variant already exists in this file or `./DevelopLog/DebugLog.md`.
- **Action**: Apply the documented fix directly. Do not re-investigate from scratch.
- **Logging**: If the fix required adaptation, append a brief update note.

### Tier 2: New Error - Cause is Clear
- **Condition**: The error is new but root cause is immediately apparent within 1-2 attempts.
- **Action**: Resolve, then log.
- **Logging**: Append to the top of the relevant section above. Focus on "What to avoid" and "The quick fix."

### Tier 3: Unclear Cause or Architectural Impact
- **Condition**: Root cause not apparent after 2 attempts, OR implicates system architecture, data integrity, or multiple components.
- **Action**: **STOP immediately.** Do not keep guessing.
- **Review sequence**:
  1. Check this file for related patterns.
  2. Check `./DevelopLog/DebugLog.md` for prior deep-dives.
  3. If still unresolved, consult the user.
- **Logging**: After resolution, create or update `./DevelopLog/DebugLog.md` using the template below.

---

## Standardized Documentation Formats

### [Template] Shell Mistakes Entry
*Append to the TOP of the Shell Mistakes section.*

```markdown
### [YYYY-MM-DD] {Short Error Name}
- **Context**: {File/Component}
- **Precaution**: {Why it happened, what to check}
- **Quick Fix**: `Code or command snippet`
```

### [Template] ./DevelopLog/DebugLog.md
*Append new entries to the TOP.*

```markdown
# DEBUG: {Issue Title} ({Status})
- **Date**: YYYY-MM-DD
- **Phenomenon**: {Error messages, behavior, logs}
- **Inference & Evidence**:
    1. {Inference}: {Why I think this? Evidence}
- **Correction Plan**:
    - [Plan A]: {Details}
- **Correction Result**: {What worked? Verification step}
```

## Operational Mandate
Prioritize **Persistence of Knowledge** over **Speed of Execution**. A bug solved but not recorded is technical debt.
