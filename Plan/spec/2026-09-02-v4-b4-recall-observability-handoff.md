# B4 — Recall Observability Backend Handoff Brief

> **Handoff type:** backend requirement brief (not implementation)
> **ID:** B4 — Recall run identity / observability (generation attempts, candidates, feedback)
> **Frontend consumer phase:** P6 (Recall Receipt + feedback + Recall Lab runtime observability; inherits P1 canonical chat); earliest start: after C0
> **Backend owner:** `ExoCore` (Django)
> **Hard gate:** B4 PASS is required before the P6 Detailed Plan may freeze; P0 does not implement anything.
> **Status:** Drafted in P0; advisory for backend planning, non-expanding without Alicia's approval.
> **Date:** 2026-09-02 · **Sources:** `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` (SN), frozen specs (Freeze Index §7, River spec §6–7, questionnaire Q6/Q14/Q15), Master Roadmap §12.

---

## 1. Status, ownership, and hard-gate statement

1. **Status:** Requirement brief only. No B4 code exists in either repository.
2. **Backend owner:** `ExoCore`. **Frontend consumer:** V4 P6 (Recall Receipt under User Message, four-way feedback, Recall Lab) — P6 inherits the P1 canonical chat. **Earliest start:** after C0 (may run in parallel with frontend P1–P5).
3. **Hard gate:** P6 Detailed Plan freeze requires B4 implementation + independent acceptance in `ExoCore` + synchronized `ReactSheet.md` pair. Backend completion never transfers frontend capability ownership by itself.

## 2. Current source facts and evidence paths

- Today's runtime has **no durable generation-attempt identity, no structured candidate/injected plasmid records, no hit-path/score/rejection persistence, and no feedback store** (SN `unavailable_or_deferred.recall.observability`; R8). The frontend cannot derive or fake a Recall Receipt from existing data.
- Automatic memory recall is injected from the user-turn side of chat; the active `memory_search` ToolCall is a normal assistant-side tool event. Both surface inside `agents/services.py` / `memory` recall machinery today without attempt-scoped records.
- Chat identity primitives that DO exist and should anchor attempt records: Conversation + Message (`role='user'`, `index_in_session`), edit/regenerate truncation semantics (`runtime.edit_regenerate`), branch conversations (`parent_conversation`, `conversation.branch`), SSE terminal exclusivity (`runtime.chat.sse`). MemoryPlasmid rows carry `preset/scope/tags/trigger_keywords/weight/processing_status` (SN `memory.plasmid.*`).
- Frontend consumption baseline: ChatArea renders thinking/status; async polling replays events; regenerate/branch flows exist in chat-core (SN runtime + VB extraction).

## 3. Problem statement and frozen product semantics

- **Frozen (River spec §6.1, Freeze Index §7.3):** automatic MemoryPlasmid recall receipt sits under the **User Message** that triggered it (never inside Assistant Thinking text); expanding it shows: plasmid id + content summary, hit path (trigger/semantic etc.), whether it was actually injected, understandable score/rank where applicable, and the reason when not injected (rejected candidates default-collapsed).
- **Frozen:** the UI defaults to the attempt matching the **currently visible assistant answer**; on regenerate/branch the backend must distinguish what each generation attempt actually saw; **Alicia is never required to understand internal run IDs** (Receipt read surface hides them).
- **Frozen (Q6):** feedback = `相关 / 无关 / 内容有误 / 本轮漏召回` (persisted only; **no silent automatic changes** to weight/Tags/trigger keywords or answer semantics in the first release). "内容有误" deep-links to the plasmid detail; "漏召回" allows searching/selecting an existing plasmid or starting a new one (UI flows; the API only needs stable identities).
- **Frozen (Q15):** strict separation — automatic recall records belong to the User Message; active `memory_search` remains a normal ToolCall in the P1 `AssistantRunTrace`. P6 adds recall-specific observability only; it never redesigns the generic Thinking/Tool events shell (Roadmap §12).
- **Frozen:** Recall Lab is the precision-improvement evaluation place (mark should-hit / should-not-hit / missed-correct); History stays P5's grep-like exact lookup (B3), not a B4 ranking bench.

## 4. In-scope interface requirements

1. **Durable generation-attempt identity** linked to the triggering user message AND to the currently visible assistant answer (regenerate/branch produce distinct attempts; isolation between original answer, regenerate attempts, and branch copies is mandatory).
2. **Separate candidate and injected MemoryPlasmid records** — every candidate considered for the attempt, its hit path, explainable score/rank where applicable, and explicit rejection reason or "unavailable" semantics; whether it was injected.
3. **A read contract for the Receipt** — frontend fetches the Receipt for the visible answer without exposing internal IDs as user concepts (attempt/run ids may be opaque tokens; the UI surfaces plasmid ids + summaries only).
4. **Persistent feedback** with the frozen enum (`relevant`, `irrelevant`, `content_incorrect`, `missed_recall` — display maps to 相关/无关/内容有误/本轮漏召回), idempotency/replacement/duplicate-submit semantics, and authorization.
5. **Additive records** that older V3 consumers can ignore (no chat semantics change; new tables/fields additive).

## 5. Data / lifecycle invariants

- Attempt records are immutable snapshots of what that attempt saw (candidates + injection decision) — later plasmid edits must not rewrite history.
- Regenerate/branch isolation: each visible answer maps to exactly one attempt; navigating attempts (UI "other attempts history") reads distinct records.
- Feedback is per-attempt (or per candidate-in-attempt, per backend plan) and replaceable by the same user, with duplicate submits idempotent; feedback never mutates plasmid rows in release one.
- Missing observability data (attempt not found, receipt expired/deleted, plasmid deleted) yields explicit `unavailable`, never guessed content.

## 6. Authorization and privacy boundary

- Feedback and Receipt writes are caller-scoped (same preset/cookie model as V3); a user cannot read or mutate another agent's attempt/feedback records.
- Receipt content respects plasmid visibility (global vs per-preset); internal run ids are not user concepts; no raw internal logs exposed.

## 7. Stable errors and states

- `attempt_not_found`, `receipt_unavailable`, `feedback_duplicate` (idempotent success or stable code per backend plan), `permission_denied`, `candidate_missing` — stable codes frozen at the backend plan.
- No pseudo-success on feedback; no silent drop of late feedback after answer replacement.

## 8. V3 compatibility and migration/non-migration boundary

- **Compatibility rule (Roadmap §15):** records and endpoints are **additive**; unchanged V3 chat consumers keep working; message/SSE shapes unchanged.
- **Non-migration:** no change to answer semantics, MemoryPlasmid parameters, or automatic recall behavior in release one; no merging of automatic recall with active `memory_search` ToolCall records.

## 9. Backend acceptance targets (binary, externally observable)

1. **Regenerate/branch isolation:** regenerate and branch of the same user message produce distinct attempt records, each readable for its own visible answer without cross-contamination.
2. **No-candidate runs:** a turn with zero recall candidates yields an explicit empty/unavailable Receipt (never a fabricated one).
3. **Rejected candidates:** when candidates exist but were not injected, the Receipt exposes each with its rejection reason/unavailable semantics.
4. **Repeated feedback:** submitting the same feedback twice is idempotent (one stored record or a stable duplicate response); replacing feedback overwrites the previous value for that attempt.
5. **Current-answer lookup:** the Receipt read for the currently visible answer returns that answer's attempt without the caller needing an internal run id.
6. **Authorization:** feedback/Receipt access by another preset identity fails with a stable permission error.
7. **Missing data:** after source data is removed (plasmid deleted, attempt pruned), the Receipt shows explicit unavailable rather than stale or guessed content.
8. **Regression:** V3 chat focused suites (SN runtime families; VB §8 tests) pass unchanged; no chat stream shape changes.

## 10. Non-goals and handoff completion checklist

### Non-goals

- Automatic weight/Tag/trigger adjustment from feedback; answer semantic changes; semantic History ranking (B3 keeps exact lookup).
- Redesigning the P1 `AssistantRunTrace` shell; merging automatic recall with `memory_search` ToolCall records; Recall Lab UI.
- Collection search (B1), River aggregation (B2), plasmid search/filter (B3).

### Handoff completion checklist

- [ ] Accepted backend Plan in `ExoCore/Plan/` with independent acceptance spec
- [ ] Implementation + tests in `ExoCore`; additive migrations; V3 chat unchanged
- [ ] `ExoCore/ReactSheet.md` + `ExoCore-Desktop/ReactSheet.md` synchronized (attempt/Receipt/feedback contract)
- [ ] All 8 acceptance targets PASS in the backend repo
- [ ] Requirements re-verified against then-current source before the P6 Detailed Plan freezes

---

*Advisory note: reviewer/backend suggestions may refine implementation but cannot expand product scope without Alicia's approval.*
