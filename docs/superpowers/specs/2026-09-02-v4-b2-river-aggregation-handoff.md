# B2 — River Aggregation Backend Handoff Brief

> **Handoff type:** backend requirement brief (not implementation)
> **ID:** B2 — River aggregation (canonical heterogeneous time read model)
> **Frontend consumer phase:** P3 (River + Memo); earliest start: after C0
> **Backend owner:** `ExoCore` (Django)
> **Hard gate:** B2 PASS is required before the P3 Detailed Plan may freeze; P0 does not implement anything.
> **Status:** Drafted in P0; advisory for backend planning, non-expanding without Alicia's approval.
> **Date:** 2026-09-02 · **Sources:** `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` (SN), frozen specs (Freeze Index §5, River spec §3–7, Architecture spec §7), Master Roadmap §9. Current-source evidence for each source domain is cited inline.

---

## 1. Status, ownership, and hard-gate statement

1. **Status:** Requirement brief only. No B2 code exists in either repository.
2. **Backend owner:** `ExoCore`. **Frontend consumer:** V4 P3 (River main axis, Open Tasks shelf, Memo, Diary preview/full-read, legacy Chronicle event time-reading). **Earliest start:** after C0 (may run in parallel with frontend P1–P2).
3. **Hard gate:** P3 Detailed Plan freeze requires B2 implementation + independent acceptance in `ExoCore` + synchronized `ReactSheet.md` pair. Backend completion never transfers frontend capability ownership by itself.

## 2. Current source facts and evidence paths

- **River is a read model, not a unified business table** (Arch spec §7.1): sources keep their CRUD; only the time-reading projection is aggregated.
- **Current source domains and their real endpoints:**
  - Task/ScheduleEntry: SN `task.entry.*` (`/api/tasks/entries/`, complete/suspend/resume/gcal, calendar snapshots file-backed). Model fields `tasks/models.py`; ordering `-is_pinned, due_date, cycle_due, start_date`; CompletionRecord is the single completion-state source.
  - Diary: backend-maintained canonical DiaryEntry (memory app domain; daily-diary acceptance suites exist under `agents/tests/acceptance/test_daily_diary_*`; no dedicated V3 SPA read UI — see ownership matrix row `diary`).
  - Heartbeat: read-only Event ledger `/api/heartbeat/events/?preset_id=&limit=&offset=` + `/events/<session_uuid>/` (ReactSheet §9, unchanged): `content` = final summary; technical ledger fields (`seed_message`, `tool_history`, `error_summary`, `attempt_number`…) stay on the detail surface only.
  - Chronicle legacy: `/api/agents/chronicle/` ModelViewSet (ChronicleEntry: preset, event_time, content, scope, kind, keywords…) — `milestone/moment` rows are legacy-event candidates; highlight rows are Collection candidates (NOT River).
  - Timeline/Tweet: `/api/core/tweets/` + `/reply/` (chronicle TimelineView consumer) — Memo source decision pending: evolve vs compatible replace (freeze before P3 Detailed Plan; Freeze Index §5.2 + questionnaire Q4).
- Rule reminder: frontend must **never** merge independently paginated source lists into the River axis (Roadmap R4/B2 hard gate).

## 3. Problem statement and frozen product semantics

- **Frozen:** River = unified time reading of heterogeneous sources (Memo / Heartbeat final summary / Diary / legacy Chronicle milestone-moment / Task events), single vertical time axis, per-type visual distinction; business actions stay per-type (River spec §3.2; Freeze Index §5.1).
- **Frozen:** `River flows in you.` sits at the top of the River homepage (long-term display).
- **Frozen:** Memo = low-friction, no-title-required, Markdown + inline Tags, default reverse-chronological; reply tree is a Memo-local capability and **only thread roots participate in River global ordering**.
- **Frozen:** Heartbeat shows the final summary with agent/time/optional source link; the technical ledger stays on the Heartbeat ledger surface and must remain traceable from the River item (no default ledger pollution of River).
- **Frozen:** Diary = short preview of the day's canonical DiaryEntry (~09:00 formation) + full read; preview may be a canonical-content excerpt — no River-specific second summary.
- **Frozen:** Task events keep original event positions on the main axis; Open Tasks shelf derives from the same Task source; Calendar is a companion view over the same data.
- **Frozen:** Chronicle is not a new V4 product domain; legacy archive remains auditable; nothing un-promoted may auto-enter River (spec River#4.6/#12-16).

## 4. In-scope interface requirements

1. **One canonical heterogeneous River read interface** — backend aggregation endpoint (or interface family) that yields the unified axis.
2. **Source identity** — `source type + source id` composite identity per item, plus stable deeplink/capability metadata (what each item can do: open/read/edit where the source domain allows).
3. **Canonical timezone-aware `occurred_at`** for every source; per-source mapping rules frozen at the backend plan (Diary formation time, Heartbeat `started_at`/`completed_at` choice, Task event time, Memo creation/update time, Chronicle `event_time`).
4. **Deterministic total ordering and global cursor/pagination** — no duplicates and no skips across pages; cursor must survive new items arriving between pages (tie-timestamp policy explicit: secondary key + stable tiebreak).
5. **Diary read contract** — preview/full-read from canonical content.
6. **Memo source decision + reply-tree contract** — the Memo domain (evolve Timeline/Tweet vs compatible replace) is frozen before the P3 Detailed Plan; the interface must expose thread-root items on the main axis and replies as a local capability.
7. **Task events + Open Tasks shelf** — same Task source; event projection + open-items projection consistent.
8. **Empty / partial-source failure / permission / malformed-cursor / unavailable-source semantics** — stable, explicit states (the specs leave presentation open, but the API must distinguish "source has no items", "source unavailable", "cursor invalid", "not permitted" with stable codes).
9. **No production fallback asking the frontend to merge source lists** — the interface is the only supported path for the River axis.

## 5. Data / lifecycle invariants

- Source CRUD remains owned by Task/Memo/Diary/Heartbeat/legacy Chronicle domains; River never writes back into sources.
- Deleting or updating a source item must produce a consistent, explainable River behavior (removal or stale-until-refresh policy frozen at backend plan; no dangling pagination).
- Replies never occupy the main-axis ordering space (only thread roots do).
- River pagination determinism holds under concurrent inserts (stable cursor), and replay of the same cursor sequence yields the same items.

## 6. Authorization and privacy boundary

- Same auth model as V3 (cookie/CSRF, DRF defaults) unless a backend plan justifies a change; permission on River items follows each source domain's visibility.
- Unavailable/permission cases must not leak other sources' existence beyond the item set the caller may read.

## 7. Stable errors and async states

- `malformed_cursor`, `source_unavailable`, `permission_denied`, `empty_page` semantics with stable codes (backend plan freezes the exact codes).
- No pseudo-success: a partial source failure is reported explicitly (item-level `source_status` or page-level flag per backend plan), never silently merged.

## 8. V3 compatibility and migration/non-migration boundary

- **Compatibility rule (Roadmap §15):** all source CRUD endpoints keep working for V3 consumers; the aggregation surface is **additive**.
- **Non-migration:** no destructive Chronicle migration; no auto-promotion of semantic-uncertain history into River; legacy archive stays queryable; Chronicle `highlight/bookmark` stays entirely V3-owned until P4 (this brief excludes them).
- Chronicle `milestone/moment` may project to River as legacy events while uncertain history remains auditable (promotion policy frozen at P3 planning).

## 9. Backend acceptance targets (binary, externally observable)

1. **Tie timestamps:** two items with identical `occurred_at` sort deterministically and paginate without duplicates/skips across the boundary.
2. **Page boundaries:** walking cursor pages forward from an empty-to-populated timeline yields every item exactly once (including items inserted between two page requests).
3. **Source deletion/update:** deleting/updating a source item yields the documented River behavior and no pagination corruption on subsequent pages.
4. **Empty sources:** a source domain with zero items contributes nothing and never errors the axis; a fully empty River returns the frozen empty semantics.
5. **Reply exclusion:** Memo replies never appear on the main axis ordering; thread roots do.
6. **Deterministic replay:** replaying the same cursor sequence over an unchanged dataset returns identical item identity sequences.
7. **Regression:** V3 source tests (tasks/groupchat/memory/diary/heartbeat focused sets) still pass; V3 consumers unaffected.

## 10. Non-goals and handoff completion checklist

### Non-goals

- A unified source-of-truth table for all River sources; second Memo service/database/login.
- Frontend multi-source merge fallbacks; River write-back into sources.
- Chronicle highlight/bookmark projection (P4/Collection); Council; Recall observability.
- Destroying or archiving legacy Chronicle data.

### Handoff completion checklist

- [ ] Memo source decision (evolve Timeline/Tweet vs compatible replace) frozen with Alicia before P3 Detailed Plan
- [ ] Accepted backend Plan in `ExoCore/Plan/` with independent acceptance spec; `occurred_at`/cursor contract frozen there
- [ ] Implementation + tests in `ExoCore`; additive migrations; no V3 source behavior change
- [ ] `ExoCore/ReactSheet.md` + `ExoCore-Desktop/ReactSheet.md` synchronized
- [ ] All 7 acceptance targets PASS in the backend repo
- [ ] Requirements re-verified against then-current source before the P3 Detailed Plan freezes

---

*Advisory note: reviewer/backend suggestions may refine implementation but cannot expand product scope without Alicia's approval.*
