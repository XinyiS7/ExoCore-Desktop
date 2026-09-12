# V4 P2 — Single Conversation Delete — Construction Evidence

Single evidence file for the V4 single-conversation-delete supplement
(Target: `Plan/V4_P2_Conversation_Delete_Target.md`). Update record only;
frontend construction NOT started (T0 dependency hold).

## 1. T0 — dependency check + disposition corrections (2026-09-11)

### 1.1 Submitted fact corrections (Acceptance disposition, accepted)

- **no-other-FK claim was FALSE.** Verified current source deletion graph:
  CASCADE = Message(159), HistoryChunk(285), SessionAttachment(495),
  scheduler MessageActivity, bridge RuntimeBinding,
  **council CouncilSession.phase0_conversation (OneToOne — deleting phase0
  removes the ENTIRE CouncilSession)**, council CouncilParticipant
  (OneToOne). SET_NULL = parent_conversation(branches), MemoryPlasmid,
  CouncilSession.synthesis_conversation, HeartbeatEvent.source_conversation.
  `agents.PrivateLog.conversation_id` is a raw IntegerField (no FK). The
  endpoint excludes bridge rows but not other special ownership.
- Frontend calibration (recorded, not actioned): canonical Home route is `/`
  (`/chat` is a compat redirect); ProjectHub renders only Project cards (no
  rows edit justified); per-ID local draft + preferences ownership must be
  inspected (runtime/storage.ts, control/prefs.ts) — never bulk-clear storage
  or erase a lease to unlock deletion; generic AppApiError does NOT auto-flag
  network errors as ambiguous (deletion must classify uncertain explicitly);
  one adapter/mutation/dialog owner; no global RiskState or new runtime
  framework on list rows.

### 1.2 Backend handoff (authorized deliverable, not a fix)

`docs/superpowers/specs/2026-09-11-v4-conversation-delete-prerequisites.md`
— four bounded questions for the backend owner:
1. ordinary-conversation eligibility + special-ownership protection (Council
   phase0 case); 2. delete-versus-generation policy at the real backend write
   boundary (local lease is NOT an atomic guard); 3. invalid `--prune` flag in
   `perform_destroy` subprocess vs current compact_conversations args;
   4. agreed response/error contract + isolated test evidence. No real-data
   destructive probes, provider calls, or AgentPreset row changes authorized.

### 1.3 Status

T0 dependency hold. Production frontend edits blocked until the backend owner
settles the handoff and Acceptance clears construction. P2B stays closed (this
is a P2/C2 supplement, not a reopening).
---

## 2. T1 Construction — single-session delete (frontend)

### 2.0 Authorization

Backend prerequisites CLEARED (Alaric R3 PASS, 17/17 + 262/262). T1 frontend
construction authorized per frozen Target + T0-disposition calibrations.
Settled DELETE contract used verbatim: 204=confirmed; 400
conversation_protected (Council/Bridge) = protected explanation; 404
conversation_not_found = absent (already-gone, safe success, list sync);
409 conversation_busy = blocked (explanation + recovery path, no auto-retry);
500 safety_check_failed = fail-closed definitive non-deletion (keep state, NO
ambiguous read-back); network failure = ambiguous (read-back then re-arm).

### 2.1 Files (production)

- `features/chat/chatDelete.ts` — single owned adapter. `deleteConversation`
  classifies per the frozen contract via `toAppApiError` (status+body):
  confirmed/absent/protected/busy/safety_failed/ambiguous. Never parses a 204
  body; network TypeError and unclassified non-2xx → ambiguous.
- `features/chat/ConversationDeleteConfirmDialog.tsx` — shared confirm dialog.
  Captures immutable `{id, name}` at open; busy gate via `deleteBusyReason`
  (lease dispositions pending/active/uncertain with timestamps, or storage
  unavailable/corrupt quarantine → disabled confirm + explanation; absence is
  NOT idle proof — backend 409 stays authoritative); at most one DELETE per
  pending confirmation (submittedIdRef + pending lock); settled branches:
  confirmed/absent → retire ONLY that conversation's families
  (`retireConversationCaches` removes conversation/messages/control-cache
  keys, never bulk) + invalidate conversations + `onDeleted(id)`;
  protected/busy/safety_failed → keep state/explanation, no notify, no retry;
  ambiguous → `onReadBack` probe then re-arm (dialog stays open, DELETE can
  be retried after a confirmed follow-up). Default adapter binding via lazy
  import so call sites need no wiring. Uses `useDialogA11y` for focus/trap,
  pending anchor on the dialog container.
- `features/chat/ConversationDeleteMenu.tsx` — row affordance wrapper that
  opens the shared dialog per row; keyboard/mouse/touch reachable, always
  visible (no hover-only); `onDeleted` passthrough.
- `features/chat/chatDelete.css` — new rules only; row layout
  (flex + shrink:0 trigger), danger hover, dialog sizing, banner spacing.
- Entrances: `RecentConversationList` (Home), `AgentProfilePage` rows,
  `ProjectDetailPage` lens rows — each renders `<li class="app-recent-item">`
  with the Link + `ConversationDeleteMenu`. No ProjectHub per-row affordance
  (rows are projects); no delete-all/rename/archive; per-ID draft/prefs
  preserved (no lease-clearing tricks).

### 2.2 Tests (new: `src/test/p2_conversation_delete.test.tsx`, 22 tests)

- Adapter: 204→confirmed, 404+code→absent, 404-no-code→ambiguous, 409→busy,
  400→protected, 500→safety_failed, network→ambiguous; DELETE URL carries the
  exact id; never parses a 204 body.
- Pure copy: deriveDeleteDisplay maps each verdict to irreversible/permanent,
  already-gone, protected (Council/Bridge), fail-closed non-deletion wording.
- Busy gate: active lease blocks with explanation + disabled confirm and NO
  DELETE; corrupt lease quarantines (removed) and maps to blocking reason;
  absent-after-quarantine returns null (backend 409 authoritative).
- Settlement: cancel sends no DELETE; confirmed retires ONLY target families
  (102 untouched), invalidates list, notifies parent; 409 keeps dialog open
  with exactly one DELETE (no auto-retry), no notify; 400 protected shows
  explanation, no notify; ambiguous network triggers read-back, no success
  claim; double-click fires at most one DELETE.
- Entrances: triggers per row open the shared dialog; Home deletion fires
  DELETE for exact id, list refetch excludes the row, row leaves the DOM.

### 2.3 Regression & verification

- `pnpm exec tsc -p tsconfig.json --noEmit` — 0 errors.
- Focused: p2_conversation_delete 22/22; project/projections/stage_c/
  controls-ownership prologue 90/90.
- Full app suite: **61 files / 689 tests / 0 failures** (667 baseline + 22 new).
- Scope scan: P2B files untouched; only the three entrance files + main.tsx
  (css import) modified; new chatDelete.* files all under features/chat.
- DB baseline unchanged (read-only work; no AgentPreset writes).

### 2.4 Honest evidence notes

- One construction test initially encoded a wrong expectation (404-without-
  code → absent); corrected to ambiguous and the stub makes 107 (404, no code)
  exercise that branch — the classifier is asserted, not assumed.
- jsdom cannot intercept `localStorage.getItem` (Storage methods are native
  bound); the busy-unavailable path is covered by the corrupt/quarantine pure
  gate instead, and active-lease blocking is asserted at the dialog level.
- Timeout-safe: every network assertion uses waitFor; no unbounded promises.

---

## 3. T1 cycle-1 repairs (F1 / F2 / M03)

### F1 — ambiguous recovery now fully wired and re-armed

- `readBack` default: explicit `listConversations()` fetch + `setQueryData`
  into the canonical conversations cache (NOT TanStack refetch scheduling —
  its timing is not part of the contract). Menu passes `onReadBack` =
  invalidate; both paths produce one observable GET per ambiguous settle.
- Settle's ambiguous branch: banner → `setReadBackPending(true)` → read-back
  starts after a short async gap (real network round-trip semantics; the GET
  is observable as its own step) → on settle, `settledRef` and
  `submittedIdRef` are cleared → re-arm: the confirm button returns enabled
  and a SECOND click fires a fresh DELETE and settles (probe-verified).
- Network-layer catch path (transport rejection before any HTTP verdict)
  follows the same re-arm: read-back → clear refs → re-enabled.
- Origin-loss settlement: even when `submittedId !== conversationId`, retire
  submitted-id caches + canonical list refresh still happen (never
  paint/redirect the new view).

### F2 — no more enabled-but-dead terminal states

- safety_failed (500): confirm button stays labeled 确认删除 but is DISABLED
  (no retry inside this session); the error banner carries the direction
  「请关闭此窗口后重试」. No read-back (fail-closed).
- protected (400) / busy (409): keep dialog open, confirm disabled, no retry,
  no parent notify; exactly one DELETE per pending confirmation.
- ambiguous: button remains enabled only after re-arm (never enabled-but-dead).

### M03 — lint clean

- Pure helpers (`deleteBusyReason`, `deriveDeleteDisplay`,
  `retireConversationCaches`, `reconcileConversationList`, `DeleteDisplayState`)
  moved to `chatDeleteUi.ts`; the component module now exports ONLY the
  component (react-refresh/only-export-components satisfied without weakening
  rules). `exhaustive-deps` satisfied (queryClient/client listed).
- Test file: explicit `import React from 'react'`; helper imports moved to
  `chatDeleteUi`. `eslint "src/**/*.{ts,tsx}"` = 0 problems; the 12 remaining
  repo-wide errors are all in the Acceptance-owned `p2b_r11_demo_spotcheck.mjs`
  (pre-existing node-script no-undef, not T1 scope, untouched).

### Verification

- Construction: 26/26 (`p2_conversation_delete.test.tsx`), including two new
  F1 re-arm discriminators (second confirm fires; default read-back GET
  happens) and F2 terminal-state checks (safety/protected/busy disabled).
- Acceptance probes: 9/9 `p2_delete_acceptance.test.tsx` (was 6/9).
- Full suite: **702/702, 0 failures, 0 unhandled errors** (was 700/2 + 1
  unhandled rejection — caught by wrapping the delayed read-back in try/catch).
- typecheck 0; eslint (ts/tsx) 0; P2B files untouched; no commit.

---

## 4. T1 cycle-1 recheck — PASS (independent)

- 9/9 acceptance probes exit 0 (re-arm second DELETE verified at dialog and
  composition level; observable canonical read-back GET on every ambiguous
  settle; final copy no longer stuck in transient state; safety_failed
  confirm disabled with direction — no enabled-but-dead; all R1-passing
  behavior preserved).
- Full suite 62 files / 702 tests exit 0; typecheck 0; lint 0 (Acceptance
  resolved its own R11 .mjs lint debt on its side).
- Candidate frozen. Remaining before final: five-width dev+prod
  browser/keyboard matrix and full-repo backend suite (final phase).
- No commit until cutover call.
- Non-blocking notes (quarantine branch dead-code defensive; double
  reconcile idempotent) — recorded, no action required.

---

## 5. Final matrix — GREEN (independent)

- Browser probe (new Acceptance-owned script): dev :5176 151/151, prod
  :5177 (fresh dist incl. T1) 151/151 = **302/302** across
  320/390/767/768/1280 × home/agent/project. Covered: trigger reachability
  incl. long names, dialog focus/Escape/Tab-trap, cancel 0-DELETE, 204
  one-DELETE + canonical refetch + sibling intact, busy-lease gate, 409
  no-auto-retry, zero document overflow.
- Full suite 702 + typecheck/lint 0 preserved; DB baseline 8 rows.
- Backend final: 1879/1881 on the 5 touched packages; the 2 non-passing
  tests (memory migration 0053 reverse DDL + agents test_use_drawer catalog)
  reproduce in isolation and are causally unrelated to the delete footprint
  (no migrations/models/drawer changes) — suite debt for owners, not this
  gate.
- Full record incl. harness notes in the Acceptance report final-phase
  section. Candidates frozen; dist rebuilt (artifact only). No commit until
  Alicia's cutover call.
