# B3 — Memory Search / Filter Backend Handoff Brief

> **Handoff type:** backend requirement brief (not implementation)
> **ID:** B3 — MemoryPlasmid server-side search/filter + History grep-like exact lookup
> **Frontend consumer phase:** P5 (Memory Library); earliest start: after C0
> **Backend owner:** `ExoCore` (Django)
> **Hard gate:** B3 PASS is required before the P5 Detailed Plan may freeze; P0 does not implement anything.
> **Status:** Drafted in P0; advisory for backend planning, non-expanding without Alicia's approval.
> **Date:** 2026-09-02 · **Sources:** `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` (SN), frozen specs (Freeze Index §7, River spec §5–6, Architecture spec §6.1–6.2), Master Roadmap §11.

---

## 1. Status, ownership, and hard-gate statement

1. **Status:** Requirement brief only. No B3 code exists in either repository.
2. **Backend owner:** `ExoCore`. **Frontend consumer:** V4 P5 (Memory Library inside the P4 Library shell). **Earliest start:** after C0 (may run in parallel with frontend P1–P4).
3. **Hard gate:** P5 Detailed Plan freeze requires B3 implementation + independent acceptance in `ExoCore` + synchronized `ReactSheet.md` pair. Backend completion never transfers frontend capability ownership by itself.

## 2. Current source facts and evidence paths

- MemoryPlasmid list: `GET /api/memory/plasmids/?preset_id=<required>&scope=&source=&is_processed=` — bare array, ordering `-created_at`, **always unions global preset 2 rows**; filters are exact-match scope/source and the `is_processed`→`ready` compat mapping; **no q/full-text, no tag-combination filter, no cursor pagination** (SN `memory.plasmid.list`).
- Create: `preset_id` path creates `user_manual` plasmid (starts `pending`, async embedding → `ready`/`failed`); `message_id` path creates a ChronicleEntry highlight, not a plasmid (SN `memory.plasmid.create`).
- Detail: PATCH mutables `content` (only preset 2 global rows; others 403), `scope`, `tags`, `trigger_keywords`, `weight`; processing fields read-only; content edit resets index and re-enqueues embedding → `pending` until ready; DELETE gated by optional `X-Preset-ID` caller header (SN `memory.plasmid.detail`).
- Tags: `GET /api/memory/plasmids/tags/?preset_id=` → bare sorted string list (no preset-2 union) — today **zero SPA consumers**.
- Processing states: `pending | processing | ready | failed`; `is_processed` read-only compat bool; `embedding`/`indexed_content_hash` never serialized. Failure explicit with `processing_error`/`processing_attempts`/retry scheduling (VB §8 tests, `test_plasmid_lifecycle`).
- HistoryChunk: list `?conversation_id=` (parents only, envelope), detail PATCH accepts **only keywords** (SN `memory.history_chunk.list_detail`); no grep-like query surface exists.
- KnowledgeFragment (Project Knowledge): separate paginated list (page_size 50, `topic`/`project` filters), PATCH `keywords`/`abstract` only (SN `memory.knowledge`) — a **separate domain** from plasmids and history chunks.
- Consumers: AgentHub marquee reads `listPlasmids` for g045 presets; MemoryConsole manages history chunks; no SPA uses tags/search surfaces today (V3 management gaps).

## 3. Problem statement and frozen product semantics

- **Frozen (River spec §5.1, Freeze Index §7):** P5 first release prioritizes: Plasmid browse & search; Trigger Keywords management; Tags management; scope/weight/source/status viewing; Recall-result visibility (B4); and **History exact (grep-like) lookup** as a secondary entry: `query → total hit count → keyword context snippets → expandable source`. History is not a second full semantic-ranking experiment bench.
- **Frozen:** Library → Memory = `MemoryPlasmid / Trigger & Tags / Recall Lab / History` (History = exact lookup); the Library shell already exists from P4 — B3 must not invent a second shell or a second Memory implementation for Agent deep links (Arch §6.1: same implementation, Agent filter applied).
- **Frozen (Arch §6.2):** MemoryPlasmid (long-term memory), HistoryChunk (conversation summaries) and KnowledgeFragment/Project files (Project Knowledge) must stay distinguishable in naming, status, and operable fields — the API must not blur them.
- **Frozen:** the system may *suggest* tag merges/trigger changes/weight changes but must never auto-apply them without Alicia's confirmation (River spec §5.3).

## 4. In-scope interface requirements

1. **Server-side MemoryPlasmid body query and combined filters** for: Agent (preset), scope, Tags, source, processing status, trigger state/keywords (has-trigger vs none), plus a body text query — executed server-side.
2. **Deterministic pagination/cursor and total/count semantics** for combined filters; stable ordering; explicit no-result pages. Frontend full-load filtering disguised as pagination is forbidden.
3. **Exact editable vs read-only fields + permission errors** — preserve today's rules (content edits only on preset-2 rows; processing fields read-only; scope/tags/trigger_keywords/weight editable with list-type validation; delete ownership via caller identity) and make permission failures stable codes.
4. **Processing transitions after content edits** — content edits return the row to `pending` with visible reprocessing; `pending/failed` never disguised as ready; failed derivation states readable with error + retryability.
5. **Tag list semantics and combinations** — tags endpoint semantics extended for filter combination; tag list per Agent (preset-2 union rule for list vs tags endpoint must be made explicit and consistent).
6. **History grep-like exact query** — total hit count, context snippets around the hit, stable source identity (conversation/chunk), expandable source read; exact-match (not semantic) semantics frozen for P5.
7. **Explicit separation** of MemoryPlasmid / HistoryChunk / Project Knowledge in every list/detail/search surface.

## 5. Data / lifecycle invariants

- Plasmids remain keyed to a preset (or global preset 2) with source provenance (`highlight / self_archived / user_manual / superior_archived`).
- Content edits invalidate the index and require reprocessing before the row is `ready` again; metadata edits (scope/tags/trigger_keywords/weight) preserve the current ready index.
- Embedding internals stay server-side (never serialized); processing attempts/errors visible but bounded.
- Deleting a plasmid is a real delete today; B3 must not change delete semantics without explicit backend-plan justification.

## 6. Authorization and privacy boundary

- Content mutation restricted as today (preset-2-only content edits; caller-identity delete gate) — extended to any new bulk/query endpoints.
- Search must not leak rows of presets the caller may not read (today the API is preset-scoped; the preset-2 union is a product fact — document it in the contract).
- History snippet surfaces must not leak full message content beyond the expandable-source contract.

## 7. Stable errors and states

- `malformed_filter`, `unknown_tag`, `bad_scope`, `permission_denied`, `processing_pending`/`failed` visible states; stable codes frozen in the backend plan.
- No pseudo-success on combined-filter pages; total/count must be filter-true.

## 8. V3 compatibility and migration/non-migration boundary

- **Compatibility rule (Roadmap §15):** current plasmid CRUD keeps working for V3 consumers; new query/filter/pagination surfaces are **additive**. Existing `is_processed` compat filter remains valid.
- **Non-migration:** no semantic History ranking experiment, no automatic tag merge, no automatic parameter tuning, no change to KnowledgeFragment import pipelines, no full-load pagination.

## 9. Backend acceptance targets (binary, externally observable)

1. **Combined filters:** any combination of Agent/scope/Tags/source/status/trigger-state/body-query returns exactly the matching rows with filter-true totals across pages.
2. **No-result pages:** a valid query with zero matches returns an explicit empty result with total 0 — never an error, never a fallback full list.
3. **Stable ordering:** identical query + cursor replay over unchanged data returns identical identity sequences.
4. **Body-edit reprocessing:** editing a plasmid body moves it to a visible pending state and back to ready after successful reprocessing; failed reprocessing is visible with a stable error.
5. **Failed processing:** a plasmid whose embedding fails is excluded from ready searches and is visibly `failed` with error + retry state.
6. **Exact-match context boundaries:** History grep-like query returns the correct total hit count and context snippets that do not leak beyond the frozen context window; expandable source returns the full chunk.
7. **Unauthorized edits:** mutating content of a non-global plasmid and deleting a plasmid of another caller identity both fail with stable permission errors.

## 10. Non-goals and handoff completion checklist

### Non-goals

- Recall Receipt / feedback persistence (B4), automatic recall weighting, Recall Lab runtime observability.
- Semantic ranking of History; automatic tag merge; automatic weight/trigger tuning; embedding model change.
- Collection search (B1 target identity); River aggregation (B2).
- Any React/Memory-Library UI work.

### Handoff completion checklist

- [ ] Accepted backend Plan in `ExoCore/Plan/` with independent acceptance spec
- [ ] Implementation + tests in `ExoCore`; additive migrations; V3 plasmid CRUD unchanged
- [ ] `ExoCore/ReactSheet.md` + `ExoCore-Desktop/ReactSheet.md` synchronized (plasmid query + History grep sections)
- [ ] All 7 acceptance targets PASS in the backend repo
- [ ] Requirements re-verified against then-current source before the P5 Detailed Plan freezes

---

*Advisory note: reviewer/backend suggestions may refine implementation but cannot expand product scope without Alicia's approval.*
