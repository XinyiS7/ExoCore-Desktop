# V4 Agent Profile Heartbeat — CP-B Independent Acceptance

> **Checkpoint:** CP-B — Heartbeat Mailbox writes
> **Cycle:** R1
> **Date:** 2026-09-29
> **Construction baseline:** Desktop HEAD `12c5f9526cb2898ce3199376ca37154f24ed9a8c` + CP-B worktree
> **Approved Plan SHA-256:** `474a7160ce473b6a1de3e012fbb5b92e0543c0c3d5f3692c7c2f592d7f6d0b3e`
> **Prime handoff SHA-256:** `c70e0f0e32e2b5f8e3fb1fa2ac0a821e11299cb205022dc6e8af1f3de9e6fce4`
> **CP-B tracked diff hash:** `1747b2061c4d7c754b05bd50a65fd04b5fd2fd22`
> **Construction:** Alaric / Pane 8
> **Acceptance:** Solaire
> **Verdict:** **FAIL — two P1 findings**

## 1. Passing evidence

- Focused construction tests: 63/63 PASS.
- Full exo-app regression: 1264/1264 PASS.
- Typecheck, lint, build: PASS.
- Independent primary probe: 13/14 PASS.
- Note blank validation, trimmed exact POST, rapid double-click lock, success refresh, exact DELETE, 409 `already_consumed` text/refresh: PASS.
- Wakeup exact `YYYY-MM-DD HH:MM`, `resume_check=false`, blank validation, active-state cancel controls, exact DELETE, 409 `cannot_cancel` text/refresh: PASS.
- Escape/backdrop blocked while an ordinary write is in flight: PASS.
- No Prime/is_prime request and no backend/CP-C edit: PASS.
- Temporary probes were removed after execution.

## 2. Repair packet

### CPB-R1-F01 — P1 / new — dialogs claim modal semantics without a modal layer or focus containment

**Observed evidence**

- `LeaveHeartbeatNoteDialog.tsx` and `ScheduleHeartbeatDialog.tsx` render `.app-dialog-backdrop`.
- No stylesheet defines `.app-dialog-backdrop`; canonical V4 overlay is `.app-overlay`.
- Independent probe expected canonical overlay and received `app-dialog-backdrop`.
- Both dialogs set `aria-modal=true` but do not trap Tab/Shift+Tab or return focus to the trigger.

**Violated invariant**

CP-B requires accessible dialogs, backdrop dismissal and mobile usability down to 320px.

**Required outcome**

1. Both dialogs render on the canonical fixed overlay/backdrop and remain centered/reachable at 320px.
2. Backdrop click closes only while idle; dialog-body click does not close.
3. Escape/close/backdrop remain disabled while submitting.
4. Initial focus enters the dialog, Tab/Shift+Tab remains contained, and closing restores focus to the opening trigger.
5. Prefer the repository's existing `useDialogA11y`/canonical dialog pattern rather than a second implementation.

**Verification targets**

Independent overlay/focus probe for both dialogs plus 320px browser check.

### CPB-R1-F02 — P1 / new — ambiguous writes and note 404 are not reconciled

**Observed evidence**

Independent two-case probe failed 2/2:

1. malformed 201 note response left the dialog open and unlocked with no queue reconciliation; a repeat user action can issue a duplicate note. The same adapter pattern exists for wakeup creation, where duplication creates an extra heartbeat.
2. note DELETE returning `404 note_not_found` did not invalidate/refetch queue, so the stale note remained visible. Wakeup DELETE already reconciles 404/409, making behavior inconsistent.

**Violated invariant**

Approved Plan §3.1 requires definite/ambiguous-write distinction; CP-B requires queue refresh and truthful error handling.

**Required outcome**

1. A successful-status response with malformed body is classified as ambiguous for note and wakeup creation.
2. The UI prevents duplicate resubmission until canonical queue reconciliation completes.
3. Re-read the queue after an ambiguous create; close/resolve if the write is visible, otherwise provide an explicit safe retry after reconciliation—not an immediate blind retry.
4. Note DELETE `404 note_not_found` is treated as an already-converged state and invalidates/refetches the queue, matching wakeup cancellation behavior.
5. Preserve explicit 409 `already_consumed` / `cannot_cancel` messages and refresh behavior.

**Verification targets**

- malformed 201 note and wakeup create followed by a second click never issues a duplicate POST;
- queue refetch occurs after ambiguous create;
- note DELETE 404 removes stale UI after refetch;
- existing success/409/duplicate-click probes remain green.

## 3. Non-blocking observations

- Use `app-banner--error` rather than undefined `app-banner--danger` when touching dialog error styling.
- Some chip modifiers remain undefined; cosmetic only.
- Wakeup POST tests should include the real backend response shape without `effective_*` fields.
- Normalise any browser-provided seconds before submitting `wake_up_at`; current `step=60` makes this low risk.

## 4. R2 boundary

R2 runs F01/F02 focused probes first, then 63+ focused tests, full regression, typecheck, lint and build. Preserve every passing write payload, 409 and scope-isolation behavior. CP-C remains blocked.


---

# CP-B R2 Focused Recheck

**Date:** 2026-09-29
**Verdict:** **FAIL — two narrow residuals**

## Passing evidence

- Independent R2 probe: 18 executed, 14 passed.
- Canonical overlay/dialog, idle backdrop/body behavior, ordinary locked Escape/backdrop, focus entry/wrap/restore: PASS.
- Malformed note/wakeup 201 classification, ordered queue re-read, no duplicate before successful reconciliation, close when exact item is visible, explicit retry after successful absence: PASS.
- Note DELETE 404 reconciliation, minimal real wakeup response, minute normalization, existing 409 behavior: PASS.
- Builder focused 72/72, full 1273/1273, typecheck/lint/build: PASS.
- Temporary probe removed after execution.

## CPB-R2-F03 — P1 / F02 residual — failed or lossy reconciliation can still permit duplicate writes

Four independent cases failed:

1. note malformed 201 + queue GET failure unlocks the submit button;
2. wakeup malformed 201 + queue GET failure unlocks the submit button;
3. a newly appearing note whose text was transformed by backend filtering is not recognised as the committed write;
4. a wakeup outside the 20-row projection cap is not recognised when `unshown_explicit_count` increases.

**Required outcome**

- Capture the pre-write queue identity baseline.
- After malformed success, treat a newly appearing note ID or wakeup task ID as committed even if message text changed.
- For wakeups, an increased `unshown_explicit_count` also proves a committed write outside the visible cap.
- Exact message/time matching may remain an additional signal, not the sole identity test.
- If queue re-read fails, keep POST terminally disabled. Offer only a queue recheck action until reconciliation succeeds; never turn a failed GET directly into an enabled POST retry.
- After a successful re-read with no commit evidence, the existing explicit safe retry is permitted.

## CPB-R2-F04 — P1 / F01 residual — locked dialog has no stable focus anchor

During POST/reconciliation every focusable control is disabled. In a real browser the focused submit button may lose focus to `body`, while the dialog still claims `aria-modal=true`. `useDialogA11y` explicitly requires callers to provide a stable pending anchor; canonical repository dialogs move focus to the dialog container while locked.

**Required outcome**

- Give each dialog container a programmatically focusable anchor (`tabIndex=-1`).
- On transition to locked/reconciling/unresolved state, move focus to that container (or another enabled stable in-dialog anchor).
- Keep Tab/Shift+Tab inside the dialog and preserve trigger focus restoration on final close.
- Add tests for focus ownership during ordinary POST, reconciliation, and reconciliation-GET failure.

## R3 release condition

Run only these two residual matrices first, then preserve the 18 prior behaviors, 72 focused tests, full regression and mechanical gates. No CP-C/backend scope.


## CPB-R2-F05 — P1 / usability — normal V4 Chat has no discoverable path to Profile/Heartbeat

**Authorized by Alicia:** 2026-09-29.

The conversation header renders Agent and Project chips as inert spans. The only Hub entries are dim ghost links on Chat Home, so the normal daily flow cannot reach Agent Profile → Heartbeat → note delivery.

**Construction boundary**

1. In `ConversationPage`, make the Agent chip link to `/agents/:presetId`.
2. Make a non-null Project chip link to `/projects/:projectId`; keep Drift non-interactive.
3. Make Chat Home Agent Hub / Project Hub actions visually obvious as links/buttons.
4. Add a production-route journey test: normal V4 conversation → Agent Profile → G045 Heartbeat → open leave-note dialog. Also cover Project chip → Project Detail and Drift remaining inert.
5. Preserve existing route table and four-item primary navigation; do not add new global IA or touch backend/CP-C.

This authorized navigation repair is included in the CP-B R3 acceptance boundary.


---

# CP-B R3 Focused Recheck

**Date:** 2026-09-29
**Verdict:** **FAIL — one exact cross-instance lock bypass**

Independent probe: 16 executed, 14 passed, 2 failed (same behavior for note and wakeup). Probe removed after execution.

## Passed

- malformed-201 + failed GET keeps submit absent/disabled within the current dialog;
- GET-only recheck, then safe retry after successful absence;
- transformed note resolved by new ID;
- wakeup resolved by new task ID or increased `unshown_explicit_count`;
- pending/reconciling/unresolved focus ownership and final trigger restoration;
- normal Chat → Agent Profile → Heartbeat → leave-note dialog journey;
- Project chip → Project Detail; Drift inert; Hub buttons non-ghost;
- prior 404/409/payload/scope behavior.

## CPB-R3-F06 — P1 / F03 residual — unresolved dialog can be dismissed and reopened unlocked

After malformed 201 and a failed reconciliation GET, submit is disabled only inside that mounted dialog. Close X, Cancel, Escape and backdrop remain active. Closing and reopening discards `reconciliationFailed`, enabling a second POST without successful reconciliation.

**Required repair**

- Treat unresolved reconciliation as dismissal-locked for close X, Cancel, Escape and backdrop.
- Keep the dialog mounted and focus anchored inside it.
- The only enabled action while unresolved is `重新核对信箱`; this action performs GET only.
- Do not disable the recheck action itself when adding unresolved to the lock predicate.
- Apply symmetrically to note and wakeup dialogs.

**R4 release condition:** the two cross-instance bypass probes pass, all prior 14 R3 probe behaviors remain green, then focused/full/mechanical gates. No further scope.


---

# CP-B R4 — Final Acceptance

**Date:** 2026-09-29
**Verdict:** **PASS**

## F06 closure

- unresolved malformed-write state locks Close X, Cancel, Escape and backdrop for both note and wakeup dialogs;
- dialog remains mounted with focus ownership;
- `重新核对信箱` is the sole enabled action and performs GET only;
- forced submit cannot issue a duplicate POST;
- a successful absence recheck releases dismissal lock and permits exactly one explicit safe retry;
- the retry POST occurs only after the successful reconciliation GET and preserves the exact payload.

## Independent evidence

```text
R4 independent probe                 4/4 PASS
heartbeat focused suite            80/80 PASS
full exo-app regression          1285/1285 PASS (101 files)
typecheck / lint / production build      PASS
```

Temporary probe was removed. Desktop-only scope was preserved; backend and CP-C were untouched during CP-B construction.

## Final CP-B disposition

- CPB-R1-F01/F02: closed.
- CPB-R2-F03/F04/F05: closed.
- CPB-R3-F06: closed.
- Alicia-authorized normal Chat → Profile/Project navigation and Chat → Heartbeat → leave-note journey: accepted.

CP-B is released. CP-C Prime UI may begin against the accepted backend Gate 0 contract.
