# V4 Agent Profile — CP-C Prime UI Independent Acceptance

> **Checkpoint:** CP-C — Prime Conversation UI
> **Cycle:** R1
> **Date:** 2026-09-29
> **Backend contract:** ExoCore Gate 0 `7f4a1adb`
> **Construction:** Alaric / Pane 8
> **Acceptance:** Solaire
> **Verdict:** **FAIL — two narrow P1 wire-boundary findings**

## 1. Passing evidence

Independent probe: **14/16 PASS**.

Passed behavior includes:

- G045 profile renders one filled current-Prime star and hollow alternatives;
- non-G045 profiles render no Prime controls;
- clicking the active star sends zero requests;
- exact confirmation copy, cancel with zero PATCH, confirm with exact `{ "is_prime": true }`;
- ordinary pending dismissal/focus lock and duplicate prevention;
- malformed successful response and lost response reconciliation;
- failed reconciliation GET terminal lock and GET-only recheck;
- canonical star truth after transfer;
- current-Prime DELETE 409 warning and repeat-delete disable;
- old Prime deletion succeeds after transfer;
- canonical modal/focus behavior and 320px viewport probe;
- CP-A/B heartbeat/note preserve guard.

Builder evidence: Prime suite 11/11, focused 111/111, full 1292/1292, typecheck/lint/build PASS.

Temporary acceptance probe was removed after execution.

## 2. Repair packet

### CPC-R1-F01 — P1 / new — conversation list coerces malformed `is_prime`

`normalizeConversationRow` uses `Boolean(row.is_prime)`. Consequently:

- string `"false"` becomes a filled Prime star;
- missing, null or other malformed values silently become hollow;
- the Agent Profile presents false canonical state instead of a contract error.

**Required outcome**

1. `ConversationRow.is_prime` and `ConversationSummary.isPrime` are required booleans.
2. List/detail normalization rejects missing, null and every non-boolean value through `AppApiError(code="CONTRACT")`.
3. No Prime controls render from an off-contract list; the existing load-error/retry surface is used.
4. Keep PATCH response validation equally strict.

### CPC-R1-F02 — P1 / new — HTTP 5xx PATCH is incorrectly treated as a definite non-write

A server 5xx may occur after the Prime transfer committed. Current code marks only network/no-status errors ambiguous, so the dialog shows the 500 message and does not re-read canonical conversations.

Independent probe returned PATCH 500 while the canonical list already showed the target Prime; the dialog remained open instead of reconciling and closing.

**Required outcome**

1. Prime PATCH network/no-status errors, HTTP 5xx, and malformed successful responses are ambiguous writes.
2. HTTP 4xx remains a definite rejection and preserves backend field errors.
3. Ambiguous writes always re-read canonical conversations:
   - target Prime => update cache and close;
   - target not Prime after successful GET => explicit safe retry;
   - GET failure => terminal dismissal/POST lock with GET-only recheck.
4. Never issue a blind second PATCH.

## 3. R2 release condition

Run the two strict-boundary probes first, then preserve the prior 14 independent behaviors, focused Prime/heartbeat/delete tests, full regression and mechanical gates. No backend or post-CP-C scope.


---

# CP-C R2 Focused Recheck

**Date:** 2026-09-29
**Verdict:** **FAIL — two same-boundary residuals**

Independent probe: **8/10 PASS**. The original F01 malformed `is_prime` matrix and F02 5xx/network/malformed-response taxonomy all pass. Two adjacent strict-wire cases remain.

## CPC-R2-F03 — P1 / F01 residual — null list row leaks raw TypeError

`listConversations()` now rejects primitive rows through the `is_prime` check, but `null` is dereferenced before an object guard. A list containing `null` (including valid rows followed by null) throws native `TypeError`, bypassing the standard contract-error UI semantics.

**Required repair**

- Normalize each list row from `unknown`.
- Require a non-null, non-array object before reading any field.
- Reject null, arrays and all primitives as `AppApiError(code="CONTRACT")`; never leak native TypeError.
- Preserve strict required boolean `is_prime` validation.

## CPC-R2-F04 — P1 / F02 residual — mismatched PATCH response ID is accepted

A PATCH targeting conversation 102 can return a strict-looking 2xx row for conversation 103 and currently avoid malformed-response classification. The dialog must not accept another entity's response as proof of the requested transfer.

**Required repair**

- Require the successful response ID to equal the requested conversation ID.
- A mismatched ID is malformed successful output and therefore `ambiguousWrite=true`.
- Re-read canonical conversations and close only when the requested target is Prime; otherwise expose safe retry after the successful GET.
- Never issue an automatic second PATCH.

## R3 release condition

Run these two residual probes plus the eight R2 preserve cases, then focused/full/mechanical gates. No new scope.


---

# CP-C R3 — Final Acceptance

**Date:** 2026-09-29
**Verdict:** **PASS**

## Residual closure

- Conversation list normalization accepts `unknown`, guards non-null/non-array record shape before field access, and maps null/array/primitives to `AppApiError(code="CONTRACT")` without leaking native `TypeError`.
- Required strict boolean `is_prime` remains intact.
- Prime PATCH requires the response ID to equal the requested conversation ID.
- A mismatched-ID 2xx response is treated as malformed ambiguous output and reconciled against the requested target only.
- Canonical committed truth closes/updates cache; canonical absence permits explicit retry; GET failure retains terminal GET-only lock; no blind second PATCH.

## Independent evidence

```text
R3 independent probe                  6/6 PASS
Prime + Heartbeat focused suite    101/101 PASS
full exo-app regression           1308/1308 PASS (102 files)
typecheck / lint / production build       PASS
```

The first full run had one unrelated voice `play()` timing miss. That exact test passed twice in isolation and the complete suite then passed 1308/1308; no Prime/Heartbeat call-chain relation exists.

Temporary probe was removed with no other worktree delta.

## Final CP-C disposition

- CPC-R1-F01/F02: closed.
- CPC-R2-F03/F04: closed.
- G045-only Prime display, active no-op, confirmation/PATCH, ambiguous reconciliation, canonical cache truth, current-Prime delete 409, transfer-then-delete, a11y and CP-A/B preservation are accepted.

CP-C is released. CP-D joint regression and documentation closure may begin.
