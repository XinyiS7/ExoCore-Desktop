# V4 P2D Closure Issues #1 / #2 — Independent Acceptance Report

**Owner:** `[gpt / Solaire]`
**Frozen Plan:** `Plan/V4_P2D_Closure_Issues_1_2_Repair_Plan.md`
**Construction baseline:** original `4a69c0f753243913248b859bd1b079a55e4c0b46`; final A+ Desktop candidate `dad2af0c894574da07a791772db8b439129c95d2`; Backend contract `aaae1336dbf925058fe2f4cb58ba4545bb243d30`
**Status:** A+ code acceptance PASS; targeted device matrix and final P2D/Core C2 closure remain pending

## Evidence pin

- Construction commits: `1e071c6`, `37dd7e9`, `4a69c0f`; not pushed when handed off.
- Construction changed eight declared/necessary files. The one Plan-list deviation is the one-line required `OptimisticUserRow` fixture update in `packages/app/src/test/p2t_voice_control.test.tsx`.
- The nine pre-existing acceptance-owned staged assets remained staged and content-identical at handoff. Their blob IDs were recorded before verification:
  - D1 Plan `db8534346bbd685135851e3f7a8b3d46438e46e3`
  - CP-D1 report `ff3caf5d3141cb69afa40d518ff4b3dddf15e3df`
  - CP-D2 report `b6ef700e32fb91a811eb02f2496a19293d548fab`
  - CP-D3 report `6d15a4a00443eeafa30cf00b5e97749a167126d7`
  - CP-D2 escalation `1c69dd0ed61362d678f62112af4f613009338b2b`
  - explicit-ignore handoff `e77dfb181902be8eed68bb169b1d5629a9f78247`
  - D1 acceptance test `eb4eed663b14df4de3984e70d1b9c419abfeeb45`
  - D2 acceptance test `d430f0ae43e7195eb9bc743e3ae0afce67098f02`
  - D3 acceptance test `e9d47e3e78740c92a9d31fdab15544567ab9f9c2`

## Frozen gate matrix

- #1: U-01 through U-07, exact route ownership, fail-closed storage behavior, successful-entry terminality, and fresh re-entry semantics.
- #2: D-01 through D-08, exact client-turn correlation, assistant-overlay preservation, ordinary-send-only ownership, Backend persistence/read parity, and unchanged operation lifecycle.
- Delivery: approved file scope and fixture convergence only; no ACK/idempotency/history gate expansion; Backend/Desktop contract copies synchronized; staged acceptance assets preserved.

## Cycle ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | P2D-closure-issues-1-2 | `4a69c0f` | FAIL | Construction 1 | `P2D-CLOSURE-R1-01` | none | 1 | D-01/D-04 ×1 |
| R2 | P2D-closure-issues-1-2 | `96f7033` | FAIL | Construction 1 | `P2D-CLOSURE-R2-01` | none | 2 | canonical replacement invariant ×2 |
| R3 | P2D-closure-issues-1-2 | `8c914f0` | FAIL / ESCALATED | Construction 1 | `P2D-CLOSURE-R3-01` | architecture decision required | 3 | trustworthy pre-send boundary ×3 |
| R4 | P2D-closure-issues-1-2 / A+ | Backend `aaae1336` + Desktop `dad2af0` | PASS | none | none | A+ supersedes index/readiness route | 0 | exact correlation satisfied |

## R1 factual summary

- **Verdict:** FAIL
- **Phase/checkpoint:** P2D closure issues #1/#2
- **Consecutive FAIL count:** 1
- **Repeated invariant IDs:** D-01/D-04 ×1
- **Baseline:** `4a69c0f`; independent acceptance assets staged separately
- **Gates:** checked 14, passed 13, failed 1, not checked 0
- **Findings:** new 1, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0
- **Independent tests:** 5 executed, 4 passed, 1 failed
- **Construction focused tests:** 40/40 passed independently
- **Static/build gates:** typecheck PASS; lint PASS; build PASS
- **Full regression:** executed before the fifth independent blocker probe was added: 92 files / 1088 tests, 66 files and 898 tests passed, 26 files and 190 tests failed with the frozen Node 25 WebStorage baseline signature. Final full regression is deferred until the blocker is repaired.
- **Unreviewed areas:** none within the frozen production/file contract.

## Finding P2D-CLOSURE-R1-01 — P1 / new

**Observed evidence**

1. Real production path: `ConversationPage.tsx` exposes `ChatComposer` once the conversation row exists even while message history is still pending, while `persistedRowsRef.current = merged?.rows ?? []` represents both “history not loaded” and “verified empty” as `[]`.
2. `useChatRuntime.ts` consequently captures `priorUserIndexInSession = null` for an ordinary send made before history resolves.
3. `MessageTimeline.tsx::hasCanonicalUserReplacement()` interprets `null` as “any canonical user is the replacement.” When pre-send historical rows subsequently load, an older user row therefore hides the new optimistic row even though the sent message's canonical replacement has not appeared.
4. Independent probe `packages/app/src/acceptance/p2d_closure_issues_1_2_acceptance.test.tsx` reproduces the decisive projection: optimistic visible with unloaded rows, then incorrectly absent when only an older canonical user appears.

**Violated invariant**

- Plan §2.2 / D-01: until the corresponding canonical user appears, the optimistic row remains.
- Plan D-04: canonical user rows at or before the pre-send boundary must not hide the optimistic row.

**Root cause:** confirmed. One `null` value overloads two distinct facts: verified empty history and unknown/not-yet-loaded history. The pure projection cannot distinguish the first canonical user from a late-loaded old user under that representation.

**Affected sibling paths**

- Ordinary send while newest-window history is pending.
- Ordinary send while history loading has errored but the conversation and composer remain available.
- Verified empty first-send handoff must continue to work; it cannot be fixed by treating every `null` boundary as permanently unknown.

**Required outcome**

- An ordinary send must capture a trustworthy pre-send canonical boundary or an explicit “history unknown” fact.
- Late-loaded pre-send history must keep the optimistic row visible.
- Once the actual later canonical user row appears, it must replace the optimistic row exactly once while the assistant overlay and operation lifecycle remain unchanged.

**Suggested direction (non-binding)**

- Preserve an explicit distinction between “history not loaded/unknown” and “history loaded with no prior user,” or prevent dispatch until the boundary is trustworthy. Do not use content, timestamps, attachments, or the opaque async token as identity proof.

**Chained effects**

- Recheck D-01 through D-06, particularly verified-empty first send, history-pending send, history-error send, and live newest-window reconciliation.
- Re-run typecheck/lint/build and the complete Node 25 baseline comparison after focused PASS.

**Preserve recommendation**

- Preserve the accepted #1 route-entry terminal/retry behavior and all U-01..U-07 results.
- Preserve `releaseUi()` ownership, assistant overlay behavior, edit/regenerate/branch behavior, and zero persistent/backend schema changes.

**Escalation trigger**

- `ConversationPage.tsx` is outside the frozen production allowlist. If a correct repair cannot remain within the existing #2 files, Construction must stop before editing it and return the exact necessity, proposed minimal file expansion, alternatives, and recheck impact for Alicia's approval.

## R1 preserve evidence

- Independent #1 probes pass for exact-conversation snapshot consumption, other-conversation preservation, post-success refocus terminality, write failure fail-closed behavior, and focus retry.
- Source sweep confirms route switch/unmount cleanup and distinct-ID mutation re-read behavior.
- #2 canonical later-index replacement, assistant overlay retention, verified-empty first-send projection, and unchanged release lifecycle pass outside the unknown-history path.
- The nine pre-existing staged acceptance assets retain their pinned blob IDs.

## R1 recheck boundary

1. Original failing independent probe first.
2. Entire independent closure acceptance file.
3. Both construction closure test files.
4. Typecheck, lint, build.
5. Full app regression versus the frozen Node 25 failed-file/test baseline only after no P0/P1 remains.

Frozen/do-not-modify artifacts: this report, `packages/app/src/acceptance/p2d_closure_issues_1_2_acceptance.test.tsx`, and the nine pre-existing staged acceptance assets.

## R2 factual summary

- **Verdict:** FAIL
- **Phase/checkpoint:** P2D closure issues #1/#2
- **Consecutive FAIL count:** 2
- **Repeated invariant IDs:** canonical replacement invariant ×2
- **Baseline:** `96f7033`; independent acceptance assets remained staged and unchanged by Construction
- **Gates:** checked 14, passed 13, failed 1, not checked 0
- **Findings:** new 0, residual 0, repair-regression 1, harness-defect 0, acceptance-miss 0
- **Independent tests:** 6 executed, 5 passed, 1 failed
- **Focused closure tests before the sixth blocker probe:** 48/48 passed; broader P2D/P2T focus 91/91 passed
- **Static/build gates:** typecheck PASS; lint PASS; build PASS
- **Full regression:** 92 files / 1092 tests, 66 files and 902 tests passed, 26 files and 190 tests failed. Failed-file set is byte-for-name identical to R1's frozen Node 25 environment baseline. Final regression is not acceptance evidence while the P1 remains.
- **Unreviewed areas:** none within the frozen behavior and changed production paths.

R1 disposition: `P2D-CLOSURE-R1-01` is resolved. Late-loaded **pre-send-only** rows now retain the optimistic message, and the original R1 probe passes.

## Finding P2D-CLOSURE-R2-01 — P1 / repair-regression

**Observed evidence**

1. Construction explicitly leaves `'unknown'` boundaries visible until they are resolved or `releaseUi()` runs.
2. On the first post-send row set containing a user, `useChatRuntime.ts` latches the maximum visible user index as the pre-send boundary.
3. If that first response already includes the just-persisted canonical user—as can occur when the pre-send GET completes after the POST persistence—the latched boundary equals the sent canonical row's index. `MessageTimeline` then renders both the canonical row and the optimistic row until final release.
4. Independent probe `does not draw an unknown-boundary optimistic copy once the actual canonical user is already visible` observes two copies and a still-visible “发送中…” marker.

**Violated invariant**

- Plan §2.2: once the corresponding canonical user appears, the optimistic copy immediately stops drawing; one logical user message is drawn once at every moment.
- D-02: a later canonical user row during generation leaves only the canonical row.

**Root cause:** confirmed. With history unresolved at dispatch, the first later row set is information-theoretically ambiguous under the frozen index-only proof: it may be a stale pre-send window or may already contain the sent canonical row. Latching its maximum as definitely pre-send solves early hiding but creates duplicate rendering in the latter timing.

**Affected sibling paths**

- Initial newest-window GET begins before send and completes after backend user-message persistence.
- Any unresolved/error-recovery history path whose first usable rows already include the sent canonical user.
- The already-passing stale-pre-send-first response path must remain safe.

**Required outcome**

- Construction must not accept an ordinary send into a state where the pre-send canonical boundary is unknowable unless another permitted exact proof can distinguish old rows from the sent canonical row.
- Both timing orders must satisfy the frozen invariant: stale old rows never hide optimistic; actual canonical rows never coexist with optimistic.
- Content, timestamps, attachments, and opaque runtime tokens remain forbidden identity substitutes.

**Suggested direction (non-binding)**

- The smallest robust route appears to be establishing history readiness as a pre-dispatch condition rather than guessing after dispatch. If Construction finds another exact proof within the existing contract, it may use it.
- A rejected/deferred dispatch must be explicit and retryable; it must not silently drop user intent or create a lease/POST.

**Chained effects**

- Recheck loaded-nonempty, verified-empty, unresolved-with-stale-first, unresolved-with-canonical-first, and history-error timing states.
- Preserve send double-click locking, runtime lease ownership, draft/attachment ownership, assistant overlay, and release behavior.

**Preserve recommendation**

- Preserve the R1 repair for stale pre-send rows and all #1 U gates.
- Preserve the three-state semantic distinction unless the rebuilt matrix proves a simpler representation covers every frozen timing.

**Escalation trigger**

- If the repair needs `ConversationPage.tsx`, `ChatComposer.tsx`, query APIs, or any file outside the current allowlist, pause for Alicia's explicit scope approval before editing.
- If satisfying both timing orders requires changing the product rule or allowing temporary duplication, pause for Alicia; Acceptance cannot waive §2.2.

## R2 process direction

This is the second consecutive FAIL on the same broader canonical-replacement invariant. Before another production edit, Construction must return a compact state/path/timing matrix covering:

1. history loaded with prior user;
2. history loaded and empty;
3. history unresolved, first rows stale/pre-send only;
4. history unresolved, first rows already contain the sent canonical user;
5. history load error;
6. for each state: whether dispatch is accepted, exact boundary fact available, optimistic visibility before/after rows, and whether POST/lease exists.

After Acceptance confirms the matrix and any required scope decision, the recheck order remains: original R2 probe → entire independent closure file → construction closure tests → static/build gates → full Node 25 baseline comparison.

### R2 matrix disposition / harness amendment

`[gpt / Solaire]` accepts Construction's five-state matrix and authorizes the pre-dispatch readiness route within the existing allowlist, with these constraints:

- unresolved/no-data history rejects explicitly before epoch, optimistic/runtime overlays, lease, attachment transfer, or POST;
- rejected text/draft remains retryable and the visible error identifies history readiness;
- readiness and the pre-send boundary must come from one coherent query-cache snapshot. Construction must not read readiness from query cache while deriving the boundary from a potentially lagging `persistedRowsRef` render snapshot;
- loaded stale data remains admissible only when the boundary is derived from that same admitted snapshot;
- the R1 render-phase latch is removed; no content/time/attachment/token identity heuristic is introduced;
- no `ConversationPage` / `ChatComposer` scope expansion is approved or currently required.

Acceptance corrected its own R2 harness before resumed construction: the initial helper annotation omitted the then-current `'unknown'` union member. More importantly, the synthetic unknown-projection probe was replaced with the decisive real entry-path contract: unresolved history must reject before POST/lease/optimistic state and preserve the draft. This is a same-baseline harness amendment, not an additional verdict cycle or Builder finding. The amended six-test file intentionally remains 5 PASS / 1 FAIL on `96f7033`, and typecheck passes.

Construction may simplify away the `'unknown'` type/projection if it becomes unreachable; frozen acceptance does not require dead metadata solely to satisfy an old probe shape.

## R3 factual summary

- **Verdict:** FAIL / ESCALATED
- **Phase/checkpoint:** P2D closure issues #1/#2
- **Consecutive FAIL count:** 3
- **Repeated invariant IDs:** trustworthy pre-send boundary ×3
- **Baseline:** `8c914f0`; independent acceptance assets remained staged and unchanged by Construction
- **Gates checked:** focused independent/construction behavior, source contract, typecheck, lint, diff hygiene
- **Focused behavior:** 3 files / 49 tests PASS, including the amended independent file 6/6
- **Static gates:** typecheck PASS; lint PASS; `git diff --check 96f7033..8c914f0` PASS
- **Builder-reported broader evidence:** 10 files / 119 tests PASS; build PASS; full suite remains at the frozen 26-file / 190-test Node 25 failure set
- **Findings:** new 0, residual 1, repair-regression 0, harness-defect 0, acceptance-miss 0
- **Unreviewed areas:** final independent build/full regression were not rerun after the blocking source-contract finding; they cannot overturn it.

R2 disposition: the production `ConversationPage` path now rejects while its registered history query has no data, derives readiness and boundary from one `getQueryState` snapshot, preserves the draft, and creates no optimistic/lease/POST. The render-phase latch and `'unknown'` state are removed. The original R2 entry-path probe passes.

## Finding P2D-CLOSURE-R3-01 — P1 / residual invariant breach

**Observed evidence**

`useChatRuntime.executeTurn` rejects only when the message query state exists and `state.data === undefined`. When `getQueryState(...)` returns `undefined`, it deliberately proceeds with a fabricated `null` boundary. Construction confirms this exception exists solely to keep standalone P1D harnesses dispatching without registering the production history contract.

**Violated invariant**

- R2 Required outcome: Construction must not accept an ordinary send where the pre-send canonical boundary is unknowable.
- Accepted matrix disposition: unresolved/**no-data** history rejects before epoch, optimistic/runtime overlays, lease, attachment transfer, or POST.
- Project test contract: tests must preserve the real production shape rather than weaken production behavior to accommodate a permissive harness.

An absent query state contains less evidence than a registered pending query, not more. Treating absence as verified empty history converts “unknown” into `null`, recreating the exact unproven boundary category this repair was required to eliminate.

**Root cause:** confirmed scope/test-compatibility compromise. Two older standalone harnesses do not establish the production message-query precondition, so production logic contains an exception rather than bringing those harnesses up to the real contract.

**Required outcome**

- `undefined` query state and registered query state with undefined data both reject fail-closed.
- A dispatch is admitted only from concrete loaded query data; the number/null boundary is derived from that same snapshot.
- Standalone runtime tests that intend to exercise a dispatch must seed an explicit loaded message-query snapshot (empty or populated according to the scenario).

**Preserve recommendation**

Preserve all other `8c914f0` changes: atomic same-snapshot derivation, explicit retryable error, draft retention, no pre-readiness side effects, removal of render-phase latch/unknown metadata, and numeric/null projection.

## Third-FAIL escalation

Construction is blocked. The Repair Plan is marked **验收升级暂停**. No further production or test edits are authorized until Alicia chooses the runtime contract:

1. **Strict production-shaped contract — recommended `[gpt / Solaire]`:** missing query state is no-data and rejects. Approve narrow test-scope expansion for `p1d_dispatch_target_precedence.test.tsx` and `p1d_force_cache_runtime.test.tsx` to seed loaded history snapshots; any additional directly failing standalone `useChatRuntime` harness must be reported before expansion.
2. **Explicit unregistered-query bypass:** accept the current exception as a formal runtime contract and waive the no-data fail-closed requirement. Not recommended: it embeds a test seam in production and makes future non-`ConversationPage` callers unsafe by default.
3. **UI-level readiness gate:** expand into `ConversationPage` / `ChatComposer`. Rejected by the current razor check as unnecessary because option 1 closes the contract locally.

After Alicia's decision, Acceptance will issue an explicit resume packet. The next recheck remains focused: strict missing-state probe/affected P1D harnesses → independent closure file → construction closure tests → static/build gates → frozen full-suite comparison.

## Architecture decision after R3 escalation

`[human / Alicia]` rejected coupling ordinary-send availability to the frontend history-query cache and approved A+ exact client-turn correlation. The earlier strict-readiness recommendation is superseded, not implemented.

Frozen replacement:

- Desktop generates a UUID correlation for the ordinary optimistic row and sends it as `client_turn_id`;
- Backend persists that UUID on the exact canonical user Message and returns it in history rows;
- Timeline handoff uses exact equality only;
- the index boundary, history-readiness gate, unknown/latch logic, and fuzzy fallbacks are removed;
- no SSE/async ACK or idempotency subsystem is added.

Canonical handoff: `Plan/spec/2026-09-20-v4-client-turn-correlation-handoff.md`. Backend pane 12 proceeds first in the independent `ExoCore` repository; Desktop pane 8 remains paused until the Backend contract commit is handed off. This architecture decision resolves the escalation route but is not an R4 acceptance verdict.

## A+ Backend checkpoint — PASS

**Accepted commit:** Backend `aaae1336` (`feat(agents): bind ordinary-send client_turn_id to canonical user Message`). `[gpt / Solaire]` independently accepted this backend checkpoint; it was subsequently pushed as an unchanged ancestor of `origin/main` by the alias-table delivery bundle (`origin/main` at verification: `1e5245d1`). Cross-repository Issue #2 remains open until Desktop A+ and final regression pass.

Evidence:

- source review confirms request validation/409 conflict occurs before preference write and runtime reservation; the UUID propagates through direct text, attachment/audio anchor, initial runtime, and managed-runtime atomic user-message seams;
- `Message.client_turn_id` is nullable UUID with non-null uniqueness and user-only database constraints; migration `memory.0059` is additive from `0058` with no backfill;
- paginated and legacy history use the same serializer and return `client_turn_id: string | null`;
- no SSE/poll event, ACK, async opaque-token, arrival, stop, or index contract changed;
- independent isolated PostgreSQL run: 16/16 focused backend tests PASS;
- `manage.py check` PASS; `makemigrations --check --dry-run` reports no changes; migration plan is linear with `memory.0059` as the pending leaf;
- real non-test DB baseline before and after independent verification: `AgentPreset` rows exactly `[1..8]`;
- commit attribution `deepseek-v4-flash <agent@exocore.local>` is correct under Backend AGENTS.md and must not be amended to a model that did not construct it.

The reported project-rules runtime-restore observation is adjacent pre-existing debt recorded in the Backend Plan §10; it is not added to this closure.

Acceptance then revised its frozen Desktop probe to A+ behavior. On Desktop baseline `8c914f0`, the five-test file is intentionally 2 PASS / 3 FAIL: exact correlation handoff fails twice and history-independent POST fails once, while typecheck remains green. This is the expected pre-construction red state for pane 8, not a new verdict cycle.

### A+ Desktop scope expansion decision

`[human / Alicia]` approved the necessary `ConversationPage.tsx` expansion and directly affected test-fixture type synchronization. The page may mount `MessageTimeline` with empty canonical rows when history is pending or errored but an accepted runtime overlay exists; existing Loading/Error states remain, stale canonical rows are not newly exposed, and ordinary no-overlay behavior is unchanged. `MessageView.clientTurnId` becomes a normalized required `string | null`; the seven declared test files may receive mechanical `clientTurnId: null` fixture additions only. Acceptance also requires removal of the speculative `Math.random` UUID fallback: missing `crypto.randomUUID` must reject safely before optimistic/lease/POST rather than weaken global identity.

## R4 A+ final code acceptance

- **Verdict:** PASS
- **Phase/checkpoint:** P2D closure issues #1/#2 — A+ cross-repository repair
- **Consecutive FAIL count:** 0 (checkpoint passed)
- **Repeated invariant IDs:** exact correlation satisfied
- **Baseline:** Backend `aaae1336`; Desktop `dad2af0`; frozen acceptance assets remained outside the Construction commit
- **Gates:** checked 18, passed 18, failed 0, not checked 0 within the code checkpoint
- **Findings:** new 0, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0
- **Independent focused tests:** 11 files / 154 tests PASS
- **Static/build gates:** typecheck PASS; lint PASS; production/PWA build PASS
- **Full regression:** executed — 92 files / 1093 tests; 66 files / 903 tests PASS and the same frozen 26 files / 190 tests FAIL under Node 25 WebStorage masking. No failed-file or failed-test-count delta.
- **Backend evidence:** previously accepted isolated 16/16 correlation/migration tests remain authoritative for unchanged, pushed commit `aaae1336`. A later re-run attempt was not evidence because the shared `test_exocore` resource was occupied; it made no production-database change.
- **Unreviewed areas:** no code gate. Targeted real-device evidence remains a separate final-closure prerequisite.

### Gate evidence

1. U-01..U-07 remain green, including successful-entry terminality and fail-closed focus retry.
2. Each ordinary send obtains one `crypto.randomUUID()` before optimistic creation and shares it across SSE/async POST and the optimistic row. Missing UUID capability rejects before epoch, overlay, lease, or POST and retains the draft.
3. History parsing always normalizes the additive wire field to required `MessageView.clientTurnId: string | null`; absent, null, and malformed values cannot match.
4. `MessageTimeline` suppresses only an optimistic row whose exact non-null correlation appears on a canonical `role === 'user'` row. Same content, sequence, inserted assistant rows, missing/different IDs, and assistant rows carrying the value do not hand off.
5. Pending/error history no longer gates sending. The approved page seam displays the runtime overlay with an empty canonical set while preserving the existing loading/error surface; canonical recovery performs exact handoff without disturbing the assistant overlay.
6. Source sweep finds no remaining `priorUserIndexInSession`, `HISTORY_NOT_READY`, unknown-boundary latch, query-snapshot boundary, or fuzzy identity fallback.
7. Backend direct, audio-anchor, initial-runtime, and managed-runtime user creation paths retain the same correlation; uniqueness, user-only persistence, serializer output, and pre-side-effect validation were accepted at `aaae1336`.
8. Desktop and Backend `ReactSheet.md` §1.3.2 contract text is synchronized. No SSE/poll ACK, response token change, idempotency subsystem, or history-readiness dependency was introduced.

### Accepted limitations / remaining closure work

- On the local Node 25 environment, 26 files / 190 tests remain red due to the pre-existing incomplete WebStorage global; this task neither worsens nor repairs that infrastructure issue.
- A canonical correlation that never appears remains subject to the existing terminal `releaseUi()` cleanup; no fuzzy fallback is permitted.
- This PASS authorizes acceptance/Plan closure packaging for the code checkpoint. It does **not** by itself close GitHub issues, declare P2D Final, or grant Core C2; the frozen targeted device matrix remains outstanding.
