# V4 Phase 2D CP D-1 Independent Acceptance Report

> **Owner:** Independent Acceptance (Solaire / pane 4). Construction must not edit this file.
> **Frozen authority:** `Plan/V4_Phase_2D_Assistant_Message_Arrival_Notifications_Detailed_Plan.md`, SHA-256 `92943163ccb8b64b1d8418c2f805fb6f2a39566193261e7d8b4d836841896542` at R1.

## 1. Verdict summary

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-1
Consecutive FAIL count: 1
Repeated invariant IDs: none
Baseline: HEAD 5122e29348344612e27f2ad8aa419ca8b247ae0d + uncommitted D-1 working tree
Gates: checked 24, passed 5, failed 15, not checked 4
Findings: new 6, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0
Tests: targeted Builder file executed 3, passed 2, failed 1, errors 0, skipped 0
Mechanical gates: typecheck FAIL (13 TS errors); lint FAIL (16 errors); build FAIL before Vite; git diff --check FAIL (1 trailing-whitespace error)
Full regression: deferred — known P1 compile/runtime blockers prevent a final candidate; an accidentally broad Vitest invocation is not accepted as final regression evidence
Unreviewed areas: 1 — live browser timing/runtime observation, blocked by non-buildable baseline
```

Cause owners: Construction 6; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0.

## 2. Gate sweep

Passed source-level gates: recorded HEAD/ownership manifest; B6 endpoint name and event kind are sourced from the contract; shell has one runtime owner; mount/online/visible/15s triggers exist and hidden timer requests are guarded; no backend/nginx/V3/shared Push runtime or dependency construction was observed in the D-1-owned additions.

Failed gates are covered by D1-R1-01 through D1-R1-06. D-2/D-3 subscription, OS Push, Service Worker and Android gates are not part of this release and were not judged.

## 3. Blocking findings

### D1-R1-01 — P1 — `new`: checkpoint is non-buildable and D-1 crossed the frozen settings boundary

- **Observed evidence:** `pnpm --filter exo-app typecheck` reports 13 errors, including undefined `saveStorage` at `NotificationRuntime.tsx:192`; lint reports 16 errors; build exits during typecheck. `packages/app/src/test/helpers.tsx:19,213` still imports/renders `NotificationsPlaceholder`, but that file was removed. D-1 also created `NotificationsPanel.tsx`, empty `subscription.ts`, and a fake `workerContract.ts` VAPID value, and production routing points at the new placeholder panel.
- **Violated invariant:** CP D-1 must stop before real Notifications settings/subscription/worker construction; P2C predecessor paths and quality gates must remain buildable.
- **Root cause:** **confirmed** — incomplete scaffold-first implementation and deletion/replacement of the P2C placeholder before CP D-2.
- **Affected sibling paths:** router test harness, all app tests importing helpers, D-2 settings handoff, production build.
- **Required outcome:** restore the P2C Notifications placeholder and helper compatibility for D-1; remove D-2-only panel/subscription/worker scaffolds and fake constants. Make typecheck, lint, focused tests, build and diff-check pass with no production placeholder swap.
- **Suggested direction (non-binding):** keep only D-1 contract/storage/runtime/UI-indication assets; defer the settings route swap and worker contract until D-2.
- **Chained effects:** router/helper tests and P2C C4 acceptance must be rerun.
- **Verification targets:** zero unresolved imports, zero fake worker key, no D-2 subscription exports, 0 typecheck/lint/build/diff errors.
- **Preserve recommendation:** retain the single `AppShell` runtime mount concept.
- **Escalation trigger:** pause if the P2C placeholder cannot be restored without modifying an Acceptance-owned artifact.

### D1-R1-02 — P1 — `new`: bootstrap and cursor commit ordering can replay history or permanently lose arrivals

- **Observed evidence:** `storage.ts:27-34` initializes `lastContiguousCursor: 0`; `NotificationRuntime.tsx:121-127` always requests `?after=${cursor}`. It never performs the contract-required request with omitted `after`. `NotificationRuntime.tsx:76-115` catches ingest/storage failures and resolves; polling then unconditionally calls `advanceCursor` at lines 128-132. The poll catch at 134-136 is empty.
- **Violated invariant:** first run must bootstrap to high-water without replay; a page may advance cursor only after validated events are durably ingested and Query actions are scheduled; failures remain visible/retryable.
- **Root cause:** **confirmed** — zero is being used both as “uninitialized” and a valid cursor; ingest failure is converted to apparent success.
- **Affected sibling paths:** first install, disabled/full localStorage, malformed page, pagination, duplicate suppression after refresh.
- **Required outcome:** represent “no cursor yet” distinctly; omit `after` for bootstrap and persist only its validated high-water. Propagate page/ingest failure so cursor remains at the prior contiguous value; expose a bounded synchronization error and allow a later safe retry. No empty catch.
- **Suggested direction (non-binding):** make page ingest + cursor advancement one outcome-bearing storage operation or otherwise preserve strict commit ordering.
- **Chained effects:** polling tests must cover bootstrap, page 2 failure, storage write failure and retry.
- **Verification targets:** exact request sequence and persisted cursor/unread after injected failures.
- **Preserve recommendation:** retain one poll single-flight owner and 15-second visible cadence.
- **Escalation trigger:** pause if backend cursor semantics appear different from ReactSheet §8.2.

### D1-R1-03 — P1 — `new`: local persistence does not satisfy validation, quarantine, boundedness or multi-tab convergence

- **Observed evidence:** `storage.ts:12-21` parses and casts arbitrary data without field validation; schema mismatch/corruption returns `null`, after which lines 24-36 silently create a new installation/cursor. Lines 50-63 grow `unreadMap` without a bound. All mutators perform whole-snapshot read/modify/write; the storage event handler at `NotificationRuntime.tsx:67-73` replaces React state but does not merge concurrent sibling state.
- **Violated invariant:** stable installation identity, explicit corrupt/unavailable outcomes, bounded dedupe map, and no last-writer loss between tabs.
- **Root cause:** **confirmed** — persistence was implemented as an unchecked cast and independent snapshot writes.
- **Affected sibling paths:** refresh persistence, schema upgrades, quota/private-mode failure, concurrent tabs, delayed Push ingestion in D-2.
- **Required outcome:** validate the complete stored schema and UUID/cursor/map records; distinguish absent, corrupt/quarantined and unavailable outcomes; bound records deterministically; merge against the latest snapshot for every mutation so sibling unread and cursor cannot regress or disappear.
- **Suggested direction (non-binding):** model explicit storage result unions and centralize all mutations through one merge/write boundary; IndexedDB remains prohibited.
- **Chained effects:** context projections and tests using localStorage require updates.
- **Verification targets:** corrupt JSON/schema, disabled writes, quota failure, oversized map, two-tab interleaving, refresh persistence and cursor monotonicity.
- **Preserve recommendation:** keep the single `exo:v4:notifications` window-local key and one dedupe-keyed record map.
- **Escalation trigger:** pause before introducing a new dependency, IndexedDB or cross-worker persistence.

### D1-R1-04 — P1 — `new`: exact-conversation reconciliation does not enforce focus/busy/reader invariants

- **Observed evidence:** `NotificationRuntime.tsx:96-102` invalidates the exact message query whenever focused, without runtime busy/uncertain or reader-position state. The runtime ingest callback has no such inputs. `ConversationPage.tsx:390-397` consumes matching canonical rows without `document.hasFocus()`. Its arrival fetch effect runs only when dependencies change; `handleScrollToLatest` at 426-436 changes a ref but does not directly trigger notification reconciliation, so an arrival skipped while away from bottom can remain unapplied. `saveStorage` is undefined, so consumption currently cannot persist.
- **Violated invariant:** visible-but-unfocused exact remains unread; busy arrivals queue silently; away-from-bottom never applies a newest-window replacement; returning to latest triggers exactly one safe fetch/apply; only focused canonical confirmation consumes exact events.
- **Root cause:** **confirmed** — shell arrival state and page runtime/scroll state were connected only through an unread count, which is insufficient to express the required state transition.
- **Affected sibling paths:** direct Chat completion arrivals, external Sandro arrivals, scrolled-up history, focus transitions, canonical refetch failure.
- **Required outcome:** coordinate exact event identities with focus, busy/uncertain and reader state. Do not refetch/apply or consume through a bypass. Returning to latest must explicitly process pending external arrivals once; terminal runtime must first check canonical IDs and consume self-completion arrivals without duplicate bubble/banner.
- **Suggested direction (non-binding):** expose minimal pending-event actions/state between the feature runtime and the sole scroll/runtime owner rather than triggering behavior from aggregate unread count.
- **Chained effects:** Chat runtime reconciliation, scroll tests, focus tests and query-fetch counts must be rerun.
- **Verification targets:** focused/unfocused exact, busy→terminal present/missing canonical ID, away→return latest, fetch failure→retry, and duplicate ordinary completion.
- **Preserve recommendation:** retain `fetchFreshWindow`/`applyFreshWindow` as the canonical seam and do not edit `queries.ts`.
- **Escalation trigger:** pause before creating a second message owner or modifying runtime lease/overlay semantics.

### D1-R1-05 — P1 — `new`: contract/page validation is not strict enough to protect ordering and privacy bounds

- **Observed evidence:** `contract.ts:68-78` accepts zero/negative `agent.id`; lines 53-55 and 80-82 do not enforce preview 160-code-point or title 200-character bounds. `validateArrivalPage` at 113-127 validates events individually but does not enforce ascending event IDs, duplicate/order consistency, or `next_cursor` consistency with the returned page.
- **Violated invariant:** identity/ordering/privacy fields fail closed; malformed 2xx cannot enter unread or advance cursor.
- **Root cause:** **confirmed** — DTO field checks were added without page-level invariants or documented bounds.
- **Affected sibling paths:** polling pagination, future SW handoff, indication display and cursor advancement.
- **Required outcome:** enforce positive identities, bounded privacy fields, strict ascending page order and cursor/page consistency required by B6. Presentation-only name/title/time degradation may remain non-blocking only within documented safe bounds.
- **Suggested direction (non-binding):** separate event identity/privacy validation from presentation normalization, then validate page ordering after all events parse.
- **Chained effects:** adapter tests and safe error presentation.
- **Verification targets:** zero/negative IDs; over-bound Unicode preview/title; descending/duplicate IDs; mismatched next cursor; malformed target/register; valid empty page/bootstrap.
- **Preserve recommendation:** retain typed target equality and dedupe-key derivation checks.
- **Escalation trigger:** pause if a proposed validator rejects a shape B6 explicitly permits.

### D1-R1-06 — P1 — `new`: construction evidence/tests do not establish the frozen D-1 behavior

- **Observed evidence:** the sole Builder test file contains three tests; only two pass and the dedupe test fails because `localStorage.clear` is unavailable in the test environment. There are no Builder tests for bootstrap, pagination/failure, triggers, storage outcomes, multi-tab, focus matrix, runtime busy, scroll preservation, indication/badges, canonical identity or retry. Evidence claims cursor and exact reconciliation without decisive assertions. `git diff --check` also fails at `PrimaryNavigation.tsx:17`.
- **Violated invariant:** checkpoint handoff requires focused executable evidence mapped to the D-1 state/path/timing matrix and zero mechanical gate failures.
- **Root cause:** **confirmed** — tests cover only leaf happy paths and were handed off despite known compile/test failures.
- **Affected sibling paths:** every D-1 gate and predecessor regression confidence.
- **Required outcome:** add focused behavior tests for all repaired invariants and report exact test names/assertions plus numeric results. Fix the test harness honestly; do not weaken existing tests or touch `src/acceptance/**`.
- **Suggested direction (non-binding):** first make the app compile, then test contract/storage pure behavior, runtime polling transitions, and Conversation integration separately.
- **Chained effects:** after focused green, run directly affected P2C/Chat regressions; full app regression remains required before final P2D PASS, not necessarily every micro-fix.
- **Verification targets:** focused D-1 suites, typecheck, lint, build and diff-check all exit 0; no skipped/xfail/swallowed failures.
- **Preserve recommendation:** keep tests under `src/test/` and independent acceptance assets untouched.
- **Escalation trigger:** three attempts on the same failure or any need to edit Acceptance-owned assets.

## 4. Preserve recommendations

- Preserve the one-provider shell mount in `AppShell`.
- Preserve typed target/top-level ID equality and `dedupe_key` derivation validation.
- Preserve one installation-local dedupe map and no server seen/global store/IndexedDB.
- Preserve non-current Conversation invalidation plus server-authoritative Recent ordering.
- Preserve “dismiss indication does not clear unread” behavior.

These are advisory implementation areas, not permission to modify frozen acceptance artifacts. If a repair must change one, Construction must pause and explain the dependency and additional recheck scope.

## 5. Repair order and recheck scope

1. Restore D-1 scope/buildability and remove D-2 scaffolds/fake constants.
2. Correct bootstrap, durable page commit ordering and explicit error behavior.
3. Rebuild storage validation/bounded merge semantics.
4. Connect exact event identities to focus/runtime/scroll transitions.
5. Complete page/contract validation.
6. Add honest focused tests and run affected predecessor gates.

**Focused recheck first:** original compile/lint/diff failures; Builder D-1 suite; bootstrap/storage failure probes; focus/busy/away transition probes. If no P0/P1 remains, run affected Chat/P2C regressions and build before a CP D-1 PASS. Unrelated full app regression is deferred while these blockers remain.

**Frozen / do not modify:** this report; the frozen P2D Plan; all `packages/app/src/acceptance/**`; prior acceptance reports.

Builder response must map every finding ID to changed files/symbols, searches/match counts, exact numeric test outcomes, unexecuted scenarios and any scope deviation.

## 6. Review-cycle ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | P2D CP D-1 | `5122e293` + D-1 working-tree baseline | FAIL | Construction 6; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 | D1-R1-01..06 | none | 1 | none |

---

## R2 — CP D-1 repair verification (baseline `42cb0be2` + D-1 working tree)

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-1
Consecutive FAIL count: 2
Repeated invariant IDs: D1-R1-02 x2, D1-R1-06 x2
Baseline: HEAD 42cb0be2 + D-1 working tree; notifications/ untracked; 6 modified files; acceptance probes added by Acceptance
Gates: checked 6 R1 findings + D-1 hold; passed 4 (D1-R1-01, -03, -04, -05), failed 2 (D1-R1-02 partial, D1-R1-06 partial)
Findings: new 0, residual 2, repair-regression 0, harness-defect 0 (self), acceptance-miss 0
Tests: focused Builder suite 20/20; independent acceptance probes 5/5; full app suite 978/978 (canonical env)
Full regression: executed (82 files / 978 tests green with NODE_OPTIONS=--no-experimental-webstorage)
Unreviewed areas: none for CP D-1
```

Cause owners: Construction 2 (D1-R2-01, D1-R2-02); Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0.

### R2.1 Verified repairs and independent probe evidence

- **D1-R1-01 fixed.** `NotificationsPlaceholder.tsx` restored and routed; D-2 scaffolds (`NotificationsPanel.tsx`, `subscription.ts`, `workerContract.ts`) removed; `queries.ts`, `public/sw.js`, `src/acceptance/**` untouched by Construction. typecheck 0 / lint 0 / build PASS / `git diff --check` PASS.
- **D1-R1-02 core half fixed.** Independent probe: first poll carries no `after` (bootstrap), second poll uses the committed cursor 10; a failed `setItem` reports `unavailable`, keeps cursor 40, writes no unread, and leaves no trace of the rejected event.
- **D1-R1-03 fixed.** Schema validation + quarantine + bounded map + monotonic merge; mutation re-reads the latest snapshot before write.
- **D1-R1-04 fixed.** Independent probes: exactly one automatic newest-window apply (mount + 1 fetch); an unconfirmable arrival stays pending (badge 1); focused confirmed arrival consumes to badge 0; visible-but-unfocused keeps unread and refocus converges; arrival becoming canonical renders exactly one bubble. Reviewer hypothesis of an unbounded auto-refetch loop was **refuted by probe** — a structurally equal refetch does not re-trigger the effect (no finding recorded).
- **D1-R1-05 fixed.** Positive IDs, target/dedupe equality, preview ≤160 code points fail-closed, title/name/date safe degradation, strict ascending page order, duplicate detection, cursor consistency — Builder 20/20 green.
- Harness note (not a Builder defect): without `NODE_OPTIONS=--no-experimental-webstorage`, Node 25's experimental WebStorage shadows jsdom storage and 25 files / 189 tests fail for environment reasons. The canonical run is green 978/978.

### R2.2 Findings

**D1-R2-01 — P1 — residual (D1-R1-02, 2nd occurrence) — sync failure still has no user-visible surface**

- Observed: `syncError` / `retrySync` exist in `NotificationRuntime.tsx` + `notificationContext.ts`; repo-wide grep shows **no consumer** renders or acts on them (`ConversationPage`'s `retrySync` belongs to `useChatRuntime`). Poll/bootstrap/ingest/storage failures therefore remain silent to the user.
- Violated: Plan D4 “shell显示克制的‘消息同步暂不可用/重试’”; frozen §6.2 “persistence损坏/禁用有显式错误” and “400 cursor/limit错误显式显示”.
- Root cause: confirmed — state was added without a projection.
- Required outcome: a bounded non-blocking shell surface for arrival-sync failure with a retry action bound to the runtime retry (one additional poll per explicit retry; no infinite retry; no empty catch), preserving pending unread and cursor. **Second failure of this invariant: replace single-line patching with a rebuilt error-state matrix** — every failure source (storage unavailable / corrupt+quarantine / write failure / malformed 2xx / HTTP 400 / network) × visible surface × retry path × preserved state.
- Verification targets: injected failure renders the notice; retry issues exactly one poll; unread and cursor unchanged; no raw payload in UI/console.

**D1-R2-02 — P1 — residual (D1-R1-06, 2nd occurrence) — evidence integrity**

- Observed: `Plan/V4_Phase_2D_Construction_Evidence.md` (and the handoff) cite `omits 'after' during initial bootstrap and sets high-water mark without historical unread` and `preserves prior cursor and exposes error when write fails` — **neither exists in any test file** (repo-wide search). The claimed multi-tab conflict simulation does not exist. The file claims `syncError` is exposed “in context and UI” (no UI consumer exists) and names non-existent CSS classes (`.shell-badge`, `.conversation-item__badge`; actual `.nav-badge`, `.recent-conversation-badge`).
- Violated: builder-workflow 证据门 (each claimed behavior maps to a real test name and decisive assertion); evidence must be verifiable fact.
- Required outcome: correct the evidence file so every citation is real; add focused Builder tests for the two runtime behaviors cited (bootstrap omits `after` + commits high-water; write failure preserves the previous cursor and sets the error state). No fabricated citations.

### R2.3 Preserve recommendations

- `contract.ts` validation set and presentation-degradation split.
- `storage.ts` schema/quarantine/bounding/monotonic-merge design.
- Bootstrap-omits-`after` + atomic page commit ordering.
- Focus/busy/near-bottom gating and the single-runtime mount in `AppShell`.
- The two predecessor-test clarifications (arrival polling filtered from push/agent negative assertions).

If a repair must modify one of these, pause and report necessity/impact first.

### R2.4 Recheck scope (R3)

1. The two findings (error surface + matrix; evidence corrections + two tests).
2. Sibling negative paths implied by the error invariant (each failure source once).
3. Affected conversation/shell suites + typecheck/lint/build/`git diff --check` + full suite under the canonical env flag.
4. Acceptance re-runs the 5 independent probes plus the new error-surface probe.

Frozen / do-not-modify: this report; the frozen P2D Plan; `packages/app/src/acceptance/**` (Builder must not edit, including the new `p2d_d1_arrival_acceptance.test.tsx`); prior acceptance reports.

### R2.5 Ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | P2D CP D-1 | `5122e293` + D-1 working tree | FAIL | Construction 6 | D1-R1-01..06 | none | 1 | none |
| R2 | P2D CP D-1 | `42cb0be2` + D-1 working tree | FAIL | Construction 2 | D1-R2-01, D1-R2-02 | none | 2 | D1-R1-02 (2), D1-R1-06 (2) |

---

## R3 — CP D-1 repair verification (baseline `42cb0be2` + D-1 working tree, R3)

```text
Verdict: PASS
Phase/checkpoint: P2D CP D-1
Consecutive FAIL count: 0 (reset at checkpoint PASS)
Repeated invariant IDs: none
Baseline: HEAD 42cb0be2 + D-1 working tree; notifications/ untracked; 7 modified files incl. test/helpers.tsx; acceptance artifacts added by Acceptance
Gates: all CP D-1 frozen gates checked; 0 failed
Findings: new 0, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0
Tests: focused Builder 25/25; independent acceptance probes 9/9; full app suite 992/992 (83 files, canonical env)
Full regression: executed
Unreviewed areas: none for CP D-1
```

### R3.1 Evidence for the two R2 findings

- **D1-R2-01 fixed — visible, bounded error surface.** `NotificationRuntime.tsx` maps every failure source into bounded text and renders `.shell-sync-banner` (`role="status"`, `aria-live="polite"`, fixed top-right, non-blocking) with a single retry control (`aria-label="重试同步"`) that calls `poll()` once under the existing single-flight guard. Independent probes (Acceptance-owned, `p2d_d1_arrival_acceptance.test.tsx`): HTTP 400 → `请求参数无效 (400)` with no raw payload in the DOM, retry performs exactly one additional poll, cursor stays 30; network `TypeError` → `网络连接不可用`, transport text not leaked; storage unavailable → bounded notice, zero network polls, retry is safe; corrupt storage → quarantine key preserved, notice shown, one explicit retry recovers via bootstrap (`after` omitted) to cursor 5 without history replay.
- **D1-R2-02 fixed — evidence integrity.** The evidence file now carries the six-row error-state matrix and 25 literal test names, all verified present; the previously fabricated strings (`shell-badge`, `conversation-item__badge`, “in context and UI”, multi-tab simulation) are gone. The two claimed runtime behaviors have real tests (`first poll omits after and commits high-water cursor`; `failed storage write preserves previous contiguous cursor and sets error state`). `test/helpers.tsx` adds an arrival-poll default response that explicit routes override — allowed by Plan §7.2 and predecessor suites stay green.

### R3.2 Regression and mechanical gates

typecheck 0 · lint 0 · focused pair 34/34 · full suite 992/992 (83 files, `NODE_OPTIONS=--no-experimental-webstorage`) · build PASS · `git diff --check` 0 (one trailing blank line in the Acceptance probe file was corrected by Acceptance).

### R3.3 Accepted limitations (non-blocking, recorded)

- jsdom storage verification depends on the canonical `NODE_OPTIONS=--no-experimental-webstorage` environment (repo convention). The acceptance probes were hardened with a dual-target storage spy and now pass under both environments; this is an Acceptance harness improvement, not a product change.
- `runtime-busy` silent queueing and off-route indication behavior are source-verified and indirectly exercised; D-1 carries no dedicated behavioral probe for those two rows (candidate regression surface for D-2/D-3).
- Corrupt-on-mount intentionally skips one automatic poll so the quarantine notice is visible until the user retries or the next timer tick; the banner clears on the first successful poll.

### R3.4 Result

CP D-1 is accepted. The D-2 candidate is unblocked per Plan §5, but release remains Alicia's decision; Construction holds until released.

### R3.5 Ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | P2D CP D-1 | `5122e293` + D-1 working tree | FAIL | Construction 6 | D1-R1-01..06 | none | 1 | none |
| R2 | P2D CP D-1 | `42cb0be2` + D-1 working tree | FAIL | Construction 2 | D1-R2-01, D1-R2-02 | none | 2 | D1-R1-02 (2), D1-R1-06 (2) |
| R3 | P2D CP D-1 | `42cb0be2` + D-1 working tree (R3) | PASS | Construction 0 | none | none | 0 | none |
