# V4 Issue #32 Step 1B — Message Collect Button Acceptance Report

- **Issue:** XinyiS7/ExoCore#32
- **Mode:** verify
- **Acceptance owner:** [gpt-5.6-sol / Solaire]
- **Construction owner:** [Gemini 3.8 Flash / Alaric]
- **Baseline:** `d3f7a44d19f4a2e3f743b7358692185055161b6e`
- **Frozen contract:** ExoCore `dabe95ca`, §10.17 / §11 / §13 Step 1B
- **Cycle:** R2
- **Verdict:** **PASS**

## Review ledger

`Cycle: R1 | Checkpoint: Step 1B | Baseline: 8f21424 | Verdict: FAIL | Owners: Construction 1, Acceptance 0, Harness 1, Spec 0, Environment 0 | Findings: F-01, H-01 | Consecutive FAIL Count: 1`

`Cycle: R2 | Checkpoint: Step 1B | Baseline: d3f7a44 | Verdict: PASS | Owners: Construction 0, Acceptance 0, Harness 0, Spec 0, Environment 0 | Findings: F-01 cleared; H-01 remains a documented harness condition | Consecutive FAIL Count: 0`

## Baseline and scope integrity

- Commit `8f21424` changes only the Step 1B Plan, V4 Collection adapter/modal/timeline integration, focused tests, and the necessary existing action-count assertion.
- V3 packages and both ReactSheet contracts are untouched.
- The pre-existing dirty `ReactSheet.md` audio-contract hunk and untracked obsolete Plan are unrelated and remain outside #32.
- Production entry path is complete: persisted `MessageView` → timeline action → note modal → Collection adapter → `POST /api/collection/items/`.

## Independent evidence

| Verification | Result |
|---|---:|
| Step 1B focused tests | PASS — 35/35 |
| V4 full suite with documented Node 25 flag | PASS — 1513/1513 |
| V4 typecheck and production build | PASS |
| `git diff --check` | PASS |
| Default Node 25 full suite | Harness failure — identical 219 failures at parent `ff50a68` and current baseline |

The adapter preserves canonical `MessageView.content`, uses the trailing-slash endpoint, distinguishes `created` from `already_collected`, omits blank notes, and does not create a filled-state promise. Persisted non-empty user and assistant Messages receive the action; optimistic, streaming, empty, and attachment-only rows do not. Submission locking and API error projection are present.

## Blocking finding

### F-01 — P1 — new — Collection action does not appear on hover

**Observed evidence**

`MessageTimeline.tsx` inserts the Collection button into `.app-msg-actions`, but the current `.app-msg-actions` CSS is always visible. There is no hover/focus reveal rule for the Collection action. The button is therefore permanently displayed on every eligible persisted Message.

**Violated invariant**

Frozen spec §11 requires per-part Collection buttons to **appear on hover**. This is the explicit uncluttered timeline interaction Alicia approved for the human Collection entry point.

**Root cause**

Confirmed: Construction reused the existing always-visible action cluster and interpreted “hover action area” as a placement description rather than a visibility requirement.

**Affected sibling paths**

Both eligible user and assistant Message rows. Optimistic/streaming suppression and artifact-button scope are unaffected.

**Required outcome**

For pointer-hover Desktop use, the Message-text Collection control is hidden at rest and revealed on the owning Message row's hover. Keyboard users must still be able to reveal/reach it through focus. Non-hover/touch behavior must not make the action unreachable. No V3 or artifact action is added.

**Suggested direction**

Use a Collection-specific class and narrowly scoped `:hover` / `:focus-within` CSS, with an appropriate non-hover media fallback, rather than changing visibility of every existing Message action.

**Verification targets**

- Eligible persisted user and assistant rows: Collection control hidden at rest and visible on row hover/focus-within.
- Keyboard and non-hover devices retain an operable Collection control.
- Existing voice/edit/branch/copy action visibility and order are unchanged.
- All previously passing Step 1B adapter/modal/suppression behaviors remain unchanged.

**Preserve recommendations**

Preserve the adapter, modal, exact-content payload, 201/200 outcome handling, duplicate-submit guard, suppression rules, and V3 isolation.

## Harness finding

### H-01 — harness-defect — pre-existing Node 25 WebStorage shadow

Conda Node 25 exposes a broken experimental `globalThis.localStorage`, which shadows jsdom under Vitest. The default full run fails 219 tests at both parent `ff50a68` and Step 1B `8f21424` with an identical failure set. The repository-documented gate

```text
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test -- --run
```

passes 1513/1513. Step 1B does not modify localStorage, test setup, Vitest configuration, or relevant globals. This is not a product regression.

## Accepted non-blocking observations

- The optional callback replaces the internal modal when supplied, but no production caller supplies it.
- Malformed successful HTTP envelopes do not carry an ambiguous-write marker. The frozen contract explicitly treats accepted retries as additional collect actions, so this is not promoted into Step 1B scope.
- No read API exists for a filled state, count, or comments; the implementation correctly does not imply one.

## R2 recheck result

- **F-01 cleared:** repair `d3f7a44` adds a Collection-only action class and confines hidden-at-rest behavior to fine-pointer hover devices.
- The control is revealed by its owning Message row's hover and focus-within states, remains directly focusable, and stays visible by default on non-hover/touch devices.
- Existing copy, voice, edit, regenerate, and branch action visibility and order are unchanged.
- Independent verification passed: focused 37/37, production typecheck/build, documented-flag full V4 suite 1515/1515, and `git diff --check`.
- Frozen contract and the R1 acceptance report were not rewritten by Construction.

## Deploy and closeout handoff

`DEPLOY_STEP: none` — Step 1B is a V4 client-only feature with no schema or backend deployment action.

PASS authorizes tracked archival of `Plan/V4_Issue32_Step1B_Collect_Message_Plan.md` into `Plan/Archived/`. This small UI checkpoint does not require an `Update_log.md` entry. Issue #32 remains open because it is the umbrella tracker for unfinished Steps 2–5.
