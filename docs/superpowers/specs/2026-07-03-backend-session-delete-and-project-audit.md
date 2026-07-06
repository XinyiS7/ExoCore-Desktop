# Backend Fixes Needed: Session Delete + Project Deletion Audit

**Date:** 2026-07-03
**Target repo:** `ExoCore/` (Django backend — NOT this repo)

---

## 1. Conversation Delete Triggers Management Command Error

**File:** `ExoCore/agents/views.py` lines 679-683

**Bug:** `ConversationDetailView.perform_destroy()` calls:
```python
subprocess.Popen([python_exe, 'manage.py', 'compact_conversations', '--prune', '--yes'])
```

But `compact_conversations` only supports `--all` and `--force` (see `memory/management/commands/compact_conversations.py:127-139`).

**Error seen:**
```
manage.py compact_conversations: error: unrecognized arguments: --prune --yes
```

**Fix options:**
1. Add `--prune` and `--yes` arguments to the management command
2. Or change the subprocess call to use supported arguments
3. Or remove the subprocess call entirely if prune-on-delete is not needed

---

## 2. Project Deletion: Misleading Frontend Copy

**File:** `ExoCore/core/views.py` lines 332-427

**What backend does:** `ProjectViewSet.destroy()` archives sessions (reassigns to "Archived Project" + "Archived Chat" preset). Does NOT delete sessions.

**What frontend says:** "Delete project and all its sessions. This cannot be undone."

**Fix:** Either:
- Update frontend description to say "Archive project and move sessions to archive" (if archiving is the intended behavior)
- Or actually delete related conversations in the backend (if the frontend text is the intended behavior)

**Also:** Backend reads `keep_file_ids` from request body but frontend `deleteProject()` sends no body. This may be intentional (empty = keep nothing) but should be explicitly acknowledged.
