---
name: debug
description: Systematic debugging workflow — read the failing code path end-to-end, confirm root cause with diagnostics, then apply minimal fix
compatibility: pi
metadata:
  scope: exocore-backend
---

# Debug Skill

1. Read the failing code path end-to-end before making changes
2. Add logging/print diagnostics to confirm the root cause
3. Only after confirming root cause, implement the minimal fix
4. Verify the fix doesn't break adjacent functionality (especially file uploads, existing API contracts)
5. Check changes apply at the correct abstraction level (shared vs agent-specific)
