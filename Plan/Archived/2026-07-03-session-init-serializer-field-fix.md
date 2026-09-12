# Backend Fix: Session Init Returns 500 After AgentSession Elimination

**Date:** 2026-07-03
**Target repo:** `ExoCore/` (Django backend — NOT this repo)
**Severity:** Critical — all session creation broken

---

## Root Cause

Commit `72ca9c2d` ("refactor: eliminate AgentSession — merge frozen_project_ids into Conversation") changed `SuperiorSessionInitSerializer` in `agents/serializers.py` and introduced a field-mapping bug.

**Before (working):**
```python
# agents/serializers.py — SuperiorSessionInitSerializer
session_id = serializers.IntegerField(read_only=True, source='base_conversation.id')
```
`create()` returned an `AgentSession` instance. `source='base_conversation.id'` resolved to `instance.base_conversation.id` → the Conversation's primary key. ✓

**After (broken):**
```python
session_id = serializers.IntegerField(read_only=True)  # NO source= specified
session_name = serializers.CharField(source='name', read_only=True)
```
`create()` now returns a `Conversation` instance (AgentSession was deleted). Without `source=`, DRF looks for `instance.session_id` on the `Conversation` model → **AttributeError** (no such field/property).

## Symptoms

Every `POST /api/agents/sessions/init/` call:
1. Conversation IS created in the database (transaction commits before serializer.data fails)
2. Backend returns 500 error (serializer.data raises AttributeError)
3. Frontend shows error alert, no navigation to new session occurs
4. User has to manually find the empty session from agent home page
5. The session IS correctly associated with the project in the DB (project FK is set correctly) — it just appears broken because the frontend never gets a success response

## Fix (1 line)

**File:** `ExoCore/agents/serializers.py`

**Line to change:**
```python
# Current (broken):
session_id = serializers.IntegerField(read_only=True)

# Fixed:
session_id = serializers.IntegerField(read_only=True, source='id')
```

`source='id'` correctly maps to `Conversation.id` (the Django auto-increment primary key).

## Verification

```bash
cd ExoCore
python.exe manage.py shell -c "
from agents.serializers import SuperiorSessionInitSerializer
# Should not raise AttributeError when accessing .data after .save()
"
```

Or simply: create a new session from any frontend entry point. It should succeed without error alert and navigate to the new session.
