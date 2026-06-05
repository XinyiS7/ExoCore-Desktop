# Skill: Footgun

Quick-reference catalogue of environment-specific mistakes that waste time when repeated.
**Check this before running shell commands or editing Python files.**

## Standardized Documentation Formats

## Short reminder and warnings

### [Template] ./DevelopLog/WarrningLog.md
Short Mistakes Entry
*Append to the TOP of the short Mistakes and warning section.*

```markdown
### [YYYY-MM-DD] {Short Error Name}
- **Context**: {File/Component}
- **Precaution**: {Why it happened, what to check}
- **Quick Fix**: `Code or command snippet`
```
---


## The Three-Tier Error Protocol

### [Template] ./DevelopLog/DebugLog.md
*Append new entries to the TOP.*

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
