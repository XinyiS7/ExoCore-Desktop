# Fix: `_is_g045_preset` AttributeError in SuperiorService

**Date:** 2026-07-20
**Repo:** `../ExoCore/`
**Severity:** P0 — blocks all superior conversations

## Root Cause

`_is_g045_preset` was moved from `AgentService` (or a mixin) to `KnowledgeSearchSupport`
(`agents/tool_handlers/knowledge_support.py:52`) as a `@staticmethod` during a refactoring.

`SuperiorService` inherits from `BaseChatService → AgentService`, which does NOT inherit
`KnowledgeSearchSupport`. The call at `services.py:2593` still uses `self._is_g045_preset()`,
causing `AttributeError` at runtime.

## Where the break is

```
_build_context_generator
  → _prepare_superior_context (L2323)
    → _search_similar_user_message (L2593)
      → self._is_g045_preset(conv_preset_id)  ← ❌ method doesn't exist on SuperiorService
```

The function already exists and works — `KnowledgeSearchSupport._is_g045_preset(preset_id)`
at `knowledge_support.py:52-65`. It's a `@staticmethod` that checks whether a preset_id
belongs to an `agent_type='g045'` preset. `SessionHistorySearcher` uses it correctly
(since it inherits `KnowledgeSearchSupport`).

## Fix

**File:** `../ExoCore/agents/services.py`

**L2593** — change from instance method to static call:

```diff
-                if conv_preset_id != own_preset_id and self._is_g045_preset(conv_preset_id):
+                if conv_preset_id != own_preset_id and KnowledgeSearchSupport._is_g045_preset(conv_preset_id):
```

**Add lazy import** inside `_search_similar_user_message` (matches existing style, e.g. L2557):

```diff
     def _search_similar_user_message(self, ...):
         from pgvector.django import CosineDistance
         from memory.models import MessageEmbedding
+        from agents.tool_handlers.knowledge_support import KnowledgeSearchSupport
```

Total: 2 lines added, 1 changed. Zero side effects.

## Verification

1. Start a `superior` conversation and send a message with cross-project vector similarity hits
2. Confirm no `AttributeError` in logs
3. Confirm g045 isolation still works: a g045 conversation's messages should NOT appear
   as search_back_context in a superior conversation within the same project
