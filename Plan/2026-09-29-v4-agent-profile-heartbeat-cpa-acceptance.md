# V4 Agent Profile Heartbeat — CP-A Independent Acceptance

> **Checkpoint:** CP-A — typed read client + route + read ledger
> **Cycle:** R1
> **Date:** 2026-09-29
> **Construction:** Alaric / Pane 8
> **Acceptance:** Solaire
> **Verdict:** **FAIL — one P1 contract-boundary finding**

## 1. Pinned baseline

- Desktop HEAD: `8498327de3449e3238dd7a6a1f4c0a7fd6bab1d1`
- Approved Plan SHA-256: `55bace9621a68ff972c92daf08e9e4cae7d5f45ab9a5babbd3aa78cf749fee77`
- Backend handoff SHA-256: `5afd5ea53e270f17f840a5330b4a8e87e0db518695d073d14b37ceb9272825a2`
- CP-A scoped diff ID: `0f5e51e400dcabd93c563c144cf25ddb5a14397203717b8491298398bc1d075c`
- CP-A content manifest ID: `e473201e4cf142952fb6b181c1f7109c42d8734c21ff9494a6d216e9d5b9e034`
- Approved Plan/spec showed no post-dispatch write.

Pre-existing documentation rebaseline and stat-only baseline JSON entries are excluded from the CP-A diff pin.

## 2. Gate results

| Gate | Result | Evidence |
|---|---|---|
| Focused construction tests | PASS | 27/27 |
| Independent temporary probes | PASS | 8/8; removed after run |
| Full exo-app regression | PASS | 1228/1228 with `NODE_OPTIONS=--no-experimental-webstorage` |
| Typecheck | PASS | exit 0 |
| Lint | PASS | exit 0 |
| Build | PASS | exit 0 |
| GET-only / no acknowledge | PASS | independent request probe |
| Invalid/non-G045 zero heartbeat requests | PASS | independent route probe |
| Single `next_auto` primary time | PASS | independent DOM/request probe |
| Pagination offsets/detail selection | PASS | offsets `0→20→40→20→0`; lazy detail GET |
| Strict malformed-2xx boundary | **FAIL** | R1-F01 |
| Scope firewall | PASS | no CP-B writes, no CP-C Prime, no backend edit |

### Harness classification

Default Node `v25.7.0` exposes an invalid native WebStorage stub and caused 195 unrelated failures (`window.localStorage.* is not a function`). This is an established harness defect, not a CP-A regression. The same worktree under the repository-accepted temporary override:

```text
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run
```

passed 1228/1228 with zero warning.

## 3. Repair packet

### R1-F01 — P1 / new — nested malformed 2xx is silently coerced

**Observed evidence**

`packages/app/src/features/heartbeat/api.ts` currently accepts malformed nested queue data:

- `next_auto.task_id` non-number → `0`;
- `next_auto.resume_check` arbitrary truthy value → `true`;
- malformed `pending_notes[]` item → `id: 0`, empty strings;
- malformed `explicit_wakeups[]` item → `taskId: 0`, empty strings;
- arrays can pass the generic `typeof value === "object"` object check.

Relevant cluster: `api.ts:174–219`. Existing malformed tests cover only top-level failures.

**Violated invariant**

Approved Plan §3.1: boundary validation covers objects, arrays, integer IDs, date strings and enums; malformed 2xx is a contract error.

**Root cause**

Confirmed: nested normalizers use fallback/coercion instead of strict field validation.

**Affected sibling paths**

- `next_auto`;
- every `pending_notes` item;
- every `explicit_wakeups` item;
- adjacent event detail/list nested values where the same fallback pattern is used.

**Required outcome**

1. Required nested fields reject wrong type, missing values and arrays-as-objects with the existing contract-error path.
2. Null is accepted only where the backend contract explicitly permits null.
3. Integer IDs remain positive integers; booleans remain booleans; date/text/enum fields retain their declared types.
4. One malformed item rejects the response rather than injecting synthetic `0`/empty records.
5. Add focused negative tests for malformed `next_auto`, note item, wakeup item, and adjacent list/detail scalar or enum coercion.

**Suggested direction**

Use small strict `requireObject/requireString/requireBoolean/requirePositiveInt` helpers shared by the heartbeat normalizers. This is advisory; observable rejection behavior is mandatory.

**Verification targets**

- focused heartbeat API tests including new nested-malformed cases;
- existing 27 focused tests;
- independent malformed-response probe;
- typecheck/lint/build;
- full 1228 regression under the valid Node 25 WebStorage override.

**Preserve recommendations**

Do not change:

- GET-only endpoint paths;
- route/G045 gating;
- single `next_auto` presentation;
- read-only mailbox;
- event pagination/detail behavior;
- CP-A/CP-B/CP-C boundaries.

## 4. Non-blocking observations

- If a later page becomes empty after ledger shrink, pagination controls disappear; low priority because event deletion is not part of this flow.
- Several cosmetic chip variants are undefined and a very long unbroken domain may stress 320px layout; address only if convenient during the narrow repair.

## 5. Recheck boundary

R2 begins with R1-F01 focused negative probes. Full regression runs only after strict nested rejection passes. CP-B remains blocked until R2 PASS.


---

## Cycle R2 — Focused Recheck

> **Baseline diff ID:** `7d7b541f6daed821d7f2204ed5430b994de3e569076f504865a550dcc2464f87`
> **Content manifest ID:** `3ec7d1ad4dca93631c2c54fc5208bca27facce58cc423ef979c23c7d3a12185a`
> **Verdict:** **FAIL — R1-F01 residual**

### Passing evidence

- Builder focused heartbeat tests: 45/45.
- Full exo-app regression: 1246/1246 under the valid Node 25 WebStorage override.
- Typecheck, lint and build: PASS.
- R1 synthetic `0`/empty/`Boolean(value)` coercions and arrays-as-records: repaired.
- Scope firewall: only `api.ts` and `heartbeat_api.test.ts` changed since R1; no CP-B/CP-C/backend expansion.

### Independent acceptance probe

Temporary probe was authored independently, executed, and removed after the run:

```text
17 executed
8 passed
9 failed
```

All nine failures had the same decisive observation: the normalizer returned successfully, so no `AppApiError(code="CONTRACT")` existed.

Residual cases:

1. unknown `cadence_mode`;
2. unknown event `status`;
3. unknown event `launch_source`;
4. unknown `next_auto.status`;
5. unknown explicit wakeup `status`;
6. unknown non-null `finalization_reason`;
7. `seed_message=null` although backend emits string;
8. `error_summary=null` although backend emits string;
9. `tool_history=null` although backend emits array.

### R2 required outcome

- Validate enum membership against the actual ExoCore enum sets, not merely non-empty string type.
- Require `seed_message` and `error_summary` to be strings (blank allowed), and `tool_history` to be an array; explicit null must reject.
- Rebaseline the existing builder fixture that incorrectly treats those three nulls as valid.
- Preserve all R2 passing strict nested validation and CP-A behavior.

### R3 verification boundary

Run the same 17-case independent probe first, then focused heartbeat tests, full regression, typecheck, lint and build. CP-B remains blocked until PASS.


---

## Cycle R3 — Final Recheck

> **Verdict:** **PASS**
> **Finding status:** R1-F01 closed
> **Consecutive FAIL count:** reset

### Independent evidence

| Gate | Result |
|---|---|
| Independent 17-case strict-contract probe | 17/17 PASS |
| Focused heartbeat API + page tests | 50/50 PASS |
| Full exo-app regression including temporary probe | 1268/1268 PASS |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |
| Scope firewall | PASS |

The temporary acceptance probe was removed after execution and left no worktree residue.

### Closed outcomes

- Runtime enum membership exactly matches ExoCore cadence, event status, launch source, wake task status and finalization reason definitions.
- `seed_message`, `error_summary` and `tool_history` reject explicit null and accept their valid blank/empty wire values.
- All R1 nested object/array/integer/boolean strictness remains intact.
- No CP-B writes, CP-C Prime implementation or backend edit entered CP-A.

## CP-A release decision

**CP-A is independently accepted.** Pane 8 may commit only its CP-A source/test scope and proceed to CP-B. CP-C remains blocked on Gate 0 PASS.
