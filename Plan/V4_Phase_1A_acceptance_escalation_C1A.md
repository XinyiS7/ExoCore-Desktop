# V4 Phase 1A — C1A Three-FAIL Adviser Escalation

> **Owner:** `[gpt-5.6-sol / Solaire]` — independent acceptance/adviser
> **Checkpoint:** C1A
> **Escalation epoch:** 1
> **Status:** **COMPLETE — adviser intervention closed; C1A-R3-01 focused repair PASS**
> **Authority:** independent-acceptance three-FAIL rule
> **Related report:** `Plan/V4_Phase_1A_App_Shell_Conversation_Read_acceptance_report.md`

## 1. Immediate control action

C1A has received three consecutive FAIL verdicts on distinct Builder baselines. Construction must preserve the current staged Desktop and outer-repository diffs and must not:

- edit production code or construction tests;
- revert accepted work;
- commit either repository;
- begin P1B or implement adjacent P2-01;
- treat the provisional adviser direction below as authorization to repair.

Construction may read this artifact and answer through its own evidence/handoff or pane message. It must not edit this Acceptance-owned artifact.

## 2. Three-cycle timeline

| Cycle | Key evidence | Result |
|---|---|---|
| R1 | Mobile D1 phase badges had computed `display:none`; launcher and create-identity findings also open | FAIL; R1-02 opened |
| R2 | Badges became visible, but real fixed bar measured about `69.75px` while main reserved `54px`; approximately 16px overlap | FAIL; R1-02 residual |
| R3 | Shared token introduced at `65px`; app tests 51/51 and build pass, but real Edge measured bar `67px`, offset `65px`, page bottom y=779 and bar top y=777 | FAIL; R1-02 residual for third cycle; R2-01 and R2-03 closed |

Current pinned baseline:

- Desktop HEAD `f48b4fe`; staged diff `72a2531d…`; no unstaged paths.
- Outer HEAD `8836cf4`; staged diff `46585ca7…`; no unstaged paths.
- Backend checkpoint `29368bbf`; clean; real `AgentPreset` baseline 8 rows.

## 3. Builder obstacle report required before resume

Builder must answer concisely:

1. Which invariant or implementation choice is least clear?
2. Which runtime/test observation contradicts the Builder's expectation?
3. Which part of the prior repair packet was ambiguous, overly narrow, or difficult to execute?
4. Where does the Builder predict the next failure could occur?
5. Does the Builder believe the Plan, frozen criterion, CSS/browser behavior, or current architecture is internally inconsistent?

### 3.1 Builder obstacle report — received

Builder reported, before making any further edit:

- the least-clear point was the complete mobile border-box inventory and the exact acceptance predicate, not the D1 navigation requirement;
- the contradicting observation was the expected `65px / 65px` relationship versus Edge's measured `67px bar / 65px reserve`;
- the R2 packet allowed arithmetic/token matching to stand in for rendered box-model confirmation and did not pin the geometry harness strongly enough;
- the predicted repeat risk is another token-only adjustment that leaves intrinsic growth possible, or a new acceptance interpretation after the repair;
- Builder sees no D1/product architecture contradiction, but correctly requested that Acceptance freeze the numeric/geometry truth source before a fourth edit.

Acceptance agrees with that diagnosis. The three-FAIL process has served its purpose: the obstacle is now explicit and the next repair is bounded.

Two predicted-scope questions are adjudicated to prevent another moving target:

- Device-pixel ratio is not a new C1A product dimension; geometry is judged in CSS pixels by the frozen no-obscuration predicate. Acceptance nevertheless corroborated the final repair at DPR 1/2/3, all with 65px/65px and zero overlap.
- Transport-level uncertainty after a network failure is not promoted into R1-01. The frozen P1A Plan requires network failure to remain visible, while R1-01's terminal lock addressed a malformed accepted response whose write success was observable. End-to-end create idempotency would require a separate backend contract and is recorded only as adjacent future analysis, not active scope.

## 4. Preliminary balanced diagnosis

### What Construction demonstrably understands

- The D1 mobile labels must remain visible and the detail route must omit the bar.
- Bar and content offset require one shared deterministic CSS contract.
- Runtime measurement machinery would be disproportionate.
- R2-01 ambiguous-write semantics and R2-03 launcher truthfulness were corrected successfully.

### Confirmed causal factors

- **Construction:** R3's explicit arithmetic omitted the inherited top and bottom `1px` borders on each `.app-nav-item`. Disabled mobile items therefore render at 66px; the parent top border produces a 67px fixed bar.
- **Construction/test coverage:** construction tests established token reuse and visible labels but did not observe rendered bar height versus reserved offset in a real layout engine.
- **Acceptance:** R2 correctly named bar height/safe-area and required real browser widths, but the repair handoff still permitted comment-level arithmetic to stand in for measured box-model confirmation. Acceptance should require the decisive geometry relationship, not merely matching token references.
- **Harness:** no defect found. The production bundle was rebuilt before Edge measurement; 320/390/767 results agree.
- **Spec:** no inconsistency found. D1 freezes navigation behavior but intentionally does not freeze a numeric bar height.
- **Environment:** no anomaly found. Standard CSS border-box behavior and repository rules explain the result.

### Structural assessment

No architecture rewrite, Plan rewrite, new dependency, or user product decision is indicated. The repeated failure is a narrow CSS box-model accounting/test-observability problem, not evidence that D1 is infeasible.

## 5. Research disposition

Local production CSS, the rebuilt bundle, and installed Edge provide decisive evidence. External documentation/community research is **deemed unnecessary** for this epoch: no unresolved browser/framework behavior remains, and additional research would not improve the causal diagnosis.

## 6. Rebuilt invariant/state/path/timing matrix

| State/path | Required observation | Current R3 |
|---|---|---|
| Home/non-detail at 320px | Four slots fit; labels visible; no horizontal overflow; reserved offset ≥ rendered fixed-bar outer height | Labels/width PASS; geometry FAIL (`65 < 67`) |
| Home/non-detail at 390px | Same | Labels/width PASS; geometry FAIL (`65 < 67`) |
| Home/non-detail at 767px | Same | Labels/width PASS; geometry FAIL (`65 < 67`) |
| Desktop at 768px | Bottom bar hidden; main offset 0 | PASS |
| Conversation detail at 390px | Bottom bar absent; main offset 0; no overflow | PASS |
| Mobile safe area | The same base geometry on both expressions, plus equivalent safe-area inset treatment | Base mismatch proves FAIL before inset; formula shape otherwise aligned |
| Future label unlock | No navigation reorder or fake route | Preserve; unaffected |

Decisive invariant:

```text
for every mobile non-detail shell route:
computed main bottom padding >= rendered fixed bottom-bar outer height
```

## 7. Adviser route — RESUME AUTHORIZED

### Required outcome

Close only C1A-R3-01: one deterministic CSS contract must reserve at least the rendered bar outer height while preserving labels, M1 order, disabled semantics, no horizontal overflow, and zero offset/bar on desktop/detail routes.

### Authorized repair boundary

Acceptance freezes the geometry truth source for this repair:

- the acceptance harness is the existing rebuilt Edge layout at CSS widths `320 / 390 / 767`, with the existing `768` desktop and `390` detail exclusions; device-pixel-ratio variation is not a new P1A acceptance dimension;
- the decisive product/layout predicate is **no obscured bottom content**; numerically, the computed/reserved main bottom offset must be greater than or equal to the rendered fixed bottom-bar outer height in CSS pixels;
- implementation comments or matching token references are not evidence by themselves — the rebuilt browser geometry is the final truth source;
- Acceptance will not introduce a new numeric bar-height target after this repair if the frozen predicate passes.

The authorized implementation route is the narrow deterministic-box approach already identified by Builder: remove the inherited mobile nav-item vertical border contribution in the bottom projection and lock the bottom bar to the shared deterministic height contract (rather than relying on an intrinsically growing `min-height`). Preserve the existing `65px` base contract unless rendered evidence proves this exact bounded change cannot satisfy it. Directly affected comments/tests may be updated.

Do not add JavaScript measurement, ResizeObserver, new dependencies, navigation restructuring, visual redesign, a new magic-number ladder, or changes to any closed R2 finding.

## 8. Revised sequence after obstacle response

1. **RESUME AUTHORIZED** against the pinned R3 baseline: Desktop staged diff `72a2531d…`, outer staged diff `46585ca7…`, backend checkpoint `29368bbf`.
2. Construction changes only the owning mobile CSS/comments and directly affected focused tests/evidence under the authorized geometry route above.
3. Acceptance first rebuilds the app and reruns real 320/390/767/768 plus 390-detail geometry.
4. If focused geometry closes, run final required V3/root/backend/deployment regression; do not perform another real create unless needed to establish a changed path.
5. Final DB baseline and dual-repository cleanliness/checkpoint evidence remain mandatory before C1A PASS.

## 9. Preserve recommendations

Preserve all closed behavior:

- R2-01 positive-integer identity and terminal ambiguous-write lock;
- R2-03 exact mount normalization and unified final readiness gate;
- removed `rehype-raw` and CopyButton;
- D1 M1 labels/order/detail hiding;
- backend `29368bbf`, V3 source, `/app/` side-by-side topology and P2-01 exclusion.

## 10. Decisions and resume conditions

No Alicia product/architecture decision is required for this escalation. Resume conditions are satisfied:

- [x] Builder obstacle report received and recorded;
- [x] local causal research complete;
- [x] external research explicitly deemed unnecessary;
- [x] rebuilt matrix recorded;
- [x] scope remains inside existing C1A contract;
- [x] Acceptance records `RESUME AUTHORIZED` with the pinned R3 baseline and narrow geometry recheck scope.

**ADVISER EPOCH COMPLETE.** The authorized C1A-R3-01 repair passed focused Acceptance: the deterministic mobile geometry now satisfies the frozen no-overlap predicate and the repeated invariant is closed. Final full C1A regression subsequently passed; Alicia's C1A confirmation and paired checkpoint authorization remain separate. This completion is not authorization for P1B, P2-01, adjacent visual redesign, or changes to already closed findings.
