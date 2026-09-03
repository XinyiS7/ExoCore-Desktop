# P1A — Canonical Conversation Create Identity Backend Handoff

> **Handoff type:** narrow backend contract correction (not backend implementation)
> **ID:** P1A-B0 — Conversation create identity
> **Frontend consumer checkpoint:** V4 P1A / C1A
> **Backend owner:** `ExoCore` (Django)
> **Status:** **FROZEN FOR HANDOFF** — contract resolved from Alicia's domain clarification plus completed read-only archaeology; implementation remains a separate backend-repository task
> **Route retained:** `POST /api/agents/sessions/init/`
> **Authority:** `[Alicia / approved]` domain semantics and compatibility criterion; `[opencode-go/deepseek-v4-flash / Ecki]` read-only archaeology; `[gpt-5.6-sol / Solaire]` acceptance/handoff freeze
> **Supersedes:** the final-contract recommendation in `2026-07-03-session-init-serializer-field-fix.md`; that historical brief correctly located the mapping defect but must not define `session_id` as the canonical domain name

---

## 1. Gate and ownership

1. P1A-B0 is a blocker for C1A. Create success must carry the exact identity of the newly created durable local container.
2. Backend implementation belongs exclusively to the `ExoCore` repository. This Desktop repository contains only the consumer contract/handoff.
3. V4 frontend repair may remove its list/name/max-ID fallback only against the accepted backend contract below.
4. This handoff does not authorize route renaming, runtime-binding redesign, AgentSession restoration, or broader session terminology cleanup.

## 2. Frozen domain semantics

- `Conversation` is the durable local history/context container and the canonical navigation identity.
- Runtime/external `Session` means continuity state, such as `Conversation.external_session_id` or `bridge.RuntimeBinding.provider_session_id`; it is not a second durable local container.
- Switching model, endpoint, provider session, account, or runtime binding must not create a new local Conversation merely because runtime continuity changed.
- The canonical create-response identity is therefore `conversation_id`.
- The existing `/api/agents/sessions/init/` route remains unchanged in P1A to avoid widening scope.

## 3. Confirmed current facts

- `agents/urls.py` mounts `sessions/init/` to `SuperiorSessionCreateView`.
- The view calls `serializer.save()` and returns `{msg, data: serializer.data}` with HTTP 201.
- `SuperiorSessionInitSerializer.create()` returns a `Conversation` instance.
- `session_name` works through `source='name'`.
- The declared read-only `session_id` has no source; DRF resolves a nonexistent `Conversation.session_id` and omits the field through `SkipField`.
- Controlled runtime evidence is 201 `{msg, data:{session_name}}`, with neither canonical nor compatibility identity.
- No backend test currently pins this response envelope.

## 4. Archaeology result and compatibility decision

### 4.1 Active compatibility dependency

The V3 production `NewSessionModal.jsx` reads `data.session_id` and passes it through `ModalContext.jsx` to activate/navigate to the created Conversation. Because the field is currently absent, V3 silently closes the dialog without navigating. This is an active consumer, not a historical-only reference.

No backend, extension, or TUI consumer depends on init's `session_id`. V4's current dependency is construction code being repaired in the same checkpoint.

### 4.2 Existing precedent

Conversation branch output already emits both `session_id` and `conversation_id`, with both equal to the newly created Conversation primary key. No init-envelope field collides with adding `conversation_id`.

### 4.3 Frozen compatibility contract

The init success envelope must dual-emit:

```text
201 {
  msg,
  data: {
    conversation_id: integer,  # canonical
    session_id: integer,       # deprecated compatibility alias
    session_name: string
  }
}
```

Required equality:

```text
data.conversation_id == data.session_id == created Conversation.id
```

`session_id` is retained solely because archaeology proved the active V3 dependency. It has no independent persisted-local semantic and must be marked deprecated in serializer/API documentation. New consumers must use `conversation_id`.

## 5. Backend implementation boundary

### In scope

- Expose canonical `conversation_id` from the created `Conversation.id`.
- Restore `session_id` as an equal, deprecated compatibility alias sourced from the same `Conversation.id`.
- Preserve `session_name` and the existing top-level `{msg, data}` envelope.
- Add focused backend response-contract regression coverage.
- Update the backend-owned API contract documentation to name `conversation_id` canonical and `session_id` deprecated.

### Out of scope

- Renaming or duplicating `/api/agents/sessions/init/`.
- Reintroducing an `AgentSession` model or table.
- Changing `Conversation.external_session_id`, `RuntimeBinding`, SSE registries, streaming tokens, or provider-session lifecycle.
- Changing create request fields, validation, project/Drift/g045 semantics, status codes, or transaction behavior.
- Editing V3 frontend code; it must recover through the compatibility alias without a V3 patch.
- Removing `session_id`; removal is a future P8 candidate only after V3 retirement and a fresh consumer audit.

## 6. Request and error compatibility

The request contract remains unchanged:

- `preset_id` required;
- `name` optional;
- `project_id` optional with `0` sentinel for Drift;
- `frozen_project_ids` remains the g045-only extension list behavior;
- `thinking_level` remains optional under current serializer validation.

Existing 400/404 validation behavior and 201 success status remain unchanged. The repair must not create a second Conversation, perform a lookup by name, or infer identity after the write.

## 7. Backend verification targets

P1A-B0 passes only when backend evidence demonstrates all of the following:

1. A successful init returns integer `data.conversation_id`, integer `data.session_id`, and `data.session_name`.
2. Both IDs equal the exact primary key of the single Conversation created by that request.
3. Drift, Project-bound, Standard, and g045-supported request branches retain their existing persistence/validation semantics and return their own created identity.
4. The compatibility alias and canonical field cannot diverge.
5. Invalid requests preserve existing status/error behavior and create no Conversation.
6. No `AgentSession` persistence or new runtime-binding side effect is introduced.
7. Existing focused backend regressions pass, including migration-drift checks.
8. Real-database discipline remains intact: no AgentPreset create/delete/PK rewrite; any authorized probe uses archived preset 3 or 4, restores touched fields, removes the probe Conversation through ORM, and closes on the 8-row baseline.

Test implementation details are intentionally not prescribed; backend Construction owns test structure while Acceptance owns the observable targets above.

## 8. Consumer/document handback

After backend PASS, the Desktop P1A repair must:

- require `data.conversation_id` as the canonical create result;
- delete subsequent-list/name/max-ID identity inference;
- navigate to `/chat/<conversation_id>` once;
- treat missing/invalid canonical identity as an explicit contract failure;
- update V4 DTO names/tests from `sessionId` to `conversationId` where they represent local Conversation identity;
- keep V3 source unchanged and verify its existing `session_id` reader now navigates correctly;
- amend `ReactSheet.md`, the P0 canonical API snapshot and P1A contract wording through the acceptance-approved correction path, marking the alias deprecated.

## 9. Rollback and compatibility

- Backend change is additive at the wire level; rollback is the backend checkpoint revert.
- V4 must not be released against a rolled-back backend because it requires canonical `conversation_id`.
- V3 remains compatible because the alias is preserved.
- Neither implementation nor rollback changes user Conversation data or runtime bindings.

## 10. Completion checklist

- [ ] Separate backend task accepted in `ExoCore`
- [ ] Canonical/alias response contract implemented
- [ ] Backend verification targets PASS
- [ ] Backend API documentation synchronized
- [ ] Backend checkpoint identified
- [ ] Desktop contract artifacts corrected through the approved amendment path
- [ ] V4 fallback removed and focused frontend checks PASS
- [ ] V3 create-navigation compatibility verified
- [ ] Corrected controlled live probe cleaned through ORM
- [ ] Closing AgentPreset baseline is exactly IDs 1–8

---

This brief freezes only the identity contract needed to unblock P1A. Adjacent session/runtime naming cleanup remains outside scope.
