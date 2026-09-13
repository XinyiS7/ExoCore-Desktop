# V4 Phase 2C — CP C-1 Independent Acceptance Report

> **Acceptance owner:** `[gpt-5.6-sol / Solaire]`
> **Builder:** `[gemini / Alaric]`
> **Frozen Plan:** `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`
> **Frozen Plan SHA-256:** `c72533fe1b1066f5b14793954c0e14f07d222b3b005ed279357df5caf265fa6c`
> **Checkpoint:** CP C-1 only
> **Verdict:** **PASS (R2) — CP C-1 is independently released.** P2C remains overall DRAFT/in-progress; C-2 requires Alicia's explicit release and this verdict does not authorize C-2, commit or push.

## 1. Current verdict

**PASS (R2).** CP C-1 is independently released. This checkpoint verdict does not release P2C as a whole and does not authorize C-2, commit or push.

## 2. R2 ledger

| Field | Value |
|---|---|
| Cycle | R2 |
| Checkpoint ID | P2C CP C-1 |
| Baseline | HEAD `0cfa84df97d2341d371fd21ad19041ff2bed5de7` + construction-content digest `0edeab4e32c83d022f78b8bb9ab896973187d4fe2806cc9bf56c91262f6af74c` |
| Verdict | PASS |
| Cause owners | Construction 0; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 |
| Finding IDs | closes C1-R1-F1 … C1-R1-F5 |
| Supersedes/amends | R1 |
| Consecutive FAIL count | 0 |
| Repeated invariant IDs | none |

Acceptance-owned artifacts are `packages/app/src/acceptance/p2c_c1_acceptance.test.tsx` and this report. Construction must not edit them.

## 3. R2 independent evidence

- Acceptance probe hash was unchanged across repair: `e950dc9d…05ed0`; R1 report hash `94ee1536…d9` was superseded by this R2 ledger (`c299c7b8…9755`).
- Original R1 independent probes: **4/4 PASS**.
- Builder CP C-1 focused suite: **22/22 PASS**.
- Full app regression: **75 files / 886 tests / 0 failed**.
- `typecheck`: 0 errors; `lint`: 0 errors/warnings; production `build`: PASS, PWA `injectManifest` generated.
- `git diff --check`: PASS.
- Real DB baseline independently queried after R2: `AgentPreset` IDs `[1,2,3,4,5,6,7,8]` (8 rows).
- Scope scan found no Settings route, Push/Notification runtime, `recharts`, or model-catalog coupling in CP C-1 production scope.
- R1 findings F1–F5 were each confirmed closed; no new C-1 invariant violation was found in the full sweep.

---

## 4. R1 ledger (superseded repair cycle)

| Field | Value |
|---|---|
| Cycle | R1 |
| Checkpoint ID | P2C CP C-1 |
| Baseline | HEAD `0cfa84df97d2341d371fd21ad19041ff2bed5de7` + construction-content digest `556847bf7e22a5eb3543f93efc0bcb39a11f5e675130f7fdd552cdbace90fea3` |
| Verdict | FAIL |
| Cause owners | Construction 5; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 |
| Finding IDs | C1-R1-F1, C1-R1-F2, C1-R1-F3, C1-R1-F4, C1-R1-F5 |
| Supersedes/amends | none |
| Consecutive FAIL count | 1 |
| Repeated invariant IDs | none |

## 5. R1 evidence and repair requirement record

- Builder focused suite independently rerun: `17/17 PASS`.
- Independent acceptance suite: `0/4 PASS`, each failure reproduced the intended production invariant rather than a harness error.
- `git diff --check`: FAIL at `packages/app/src/shell/PrimaryNavigation.tsx:156` (blank line at EOF).
- Forbidden scope scan: no Settings route, Push/Notification API, `recharts`, or model-catalog dependency was found in CP C-1 production scope.
- Full 877-test regression, typecheck, lint and build were not repeated after independent P1 blockers were established; Builder's reported results remain evidence claims, not the independent final gate.

## 6. R1 blocking findings — all closed in R2

### C1-R1-F1 — malformed user preset is accepted as a writable profile (`new`, P1)

**Authority:** Plan §5.2 and §7.3 require malformed preset-list truth to be distinct and non-writable.

**Observed chain:** `listVisiblePresets()` supplies unguarded rows; `resolveUserProfile()` checks only `agent_type` count. A user row with invalid identity such as `id=0` reaches the Account form instead of an explicit contract-error state.

**Required outcome:** Before Account renders a writable profile, validate the minimum real `AgentPresetRow` contract needed by Account: positive integer identity, expected string/nullable-string fields, boolean visibility and valid user identity. A malformed candidate/list must show the Account contract error and issue no PATCH. Do not guess or coerce invalid rows.

**Recheck boundary:** malformed identity/type/nullability cases, 0/multiple user cases, normal profile render, and zero-PATCH behavior.

### C1-R1-F2 — malformed Telemetry numbers are silently converted to zero (`new`, P1)

**Authority:** Plan D6, §5.2 and §7.4 require malformed 2xx, true zero and true empty to remain distinct.

**Observed chain:** `fetchDailyUsage()` requires only input/output numbers; missing or invalid `cached_tokens` and `conversation_count` become `0`. Numeric guards also accept non-finite or invalid count values. The UI therefore reports invented zero usage from malformed server truth.

**Required outcome:** Validate every rendered metric before cache/render. Token and conversation counts must satisfy the real non-negative numeric/count contract; missing, non-finite, wrong-type or otherwise invalid values produce the explicit Telemetry contract-error state. `computeUsageTotals()` may rely on validated rows but must not provide a second silent-coercion path.

**Recheck boundary:** all four metrics, zero preservation, malformed row/envelope, true empty, retry, and valid totals/order.

### C1-R1-F3 — Escape leaves focus on an unmounted More menu item (`new`, P1)

**Authority:** Plan CP C-1 and §7.2 require Escape closure without focus loss to invisible content.

**Observed chain:** when a menu item owns focus, the document Escape handler only sets `open=false`. The focused link is removed and focus falls to `<body>` rather than the owning More trigger.

**Required outcome:** Escape closure from inside the menu restores focus to that More instance's trigger. Outside-pointer closure must continue to close without stealing focus from the pointer target. Preserve route-selection closure and existing desktop/mobile instances.

**Recheck boundary:** trigger open, focused item + Escape, outside pointer, route selection, and multiple More instances.

### C1-R1-F4 — accepted-but-malformed profile PATCH is reported as success (`new`, P1)

**Authority:** Plan D4, §5.2 and §7.3 require malformed successful writes to be distinguished from success and prohibit false success.

**Observed chain:** `patchUserPreset()` validates only `id/name/agent_type`. A 2xx row missing the rest of the serializer contract is accepted; Account displays `资料保存成功` and invalidates queries. This loses the required ambiguous-write truth.

**Required outcome:** Guard the returned profile row against the actual serializer shape consumed by Account. A malformed 2xx write must use the existing sole `AppApiError` identity with ambiguous-write semantics, preserve the draft, display an explicit non-success state, and never show the success banner. Do not automatically repeat the write. Apply the same mutation behavior to inline profile and System Prompt saves.

**Recheck boundary:** valid PATCH, malformed 2xx PATCH, DRF field error, network failure, strict request allowlist, draft preservation, and refetched server truth.

### C1-R1-F5 — mandatory whitespace/source-quality gate is not clean (`new`, P1 mechanical)

**Authority:** Plan §7.1/§7.10 and project error-handling rules.

**Observed chain:** `git diff --check` reports a blank line at EOF in `PrimaryNavigation.tsx`. `AvatarCropDialog` also uses an avoidable swallowed `releasePointerCapture()` exception path.

**Required outcome:** Make `git diff --check` clean. Avoid the swallowed pointer-capture exception by checking the real capture state or otherwise handling the expected lifecycle explicitly; do not add logging or speculative abstraction.

**Recheck boundary:** diff check, focused lint/typecheck, pointer cancel/up behavior, and unchanged avatar crop lifecycle.

## 7. Preserved verified behavior

The following reviewed areas currently align with CP C-1 and should remain stable unless a required repair genuinely touches them:

- `/account` canonical route and `/user` replace redirect;
- Settings/Notifications still disabled and no temporary Settings route;
- Account field request allowlist;
- canonical preset Query reuse and targeted invalidation;
- no Telemetry platform/model-catalog coupling;
- local avatar key and image-error fallback;
- title seam and route-level title coverage;
- no backend/V3/service-worker/new-dependency scope expansion.

## 8. Residual limitations and next gate

- Automated jsdom evidence is complete for C-1; browser-width screenshot evidence was produced during construction but independent real-browser visual review remains a final P2C matrix responsibility, not a C-1 blocker.
- `UserPromptDialog` is intentionally mounted only while open and therefore initializes its draft at mount; route switching unmounts it and clears the secret-free draft as required.
- Shared runtime (`exo-shared/profile`) remains unchanged; only its consumption declaration was added.
- The avatar crop control currently uses pointer drag/wheel/slider semantics comparable to the accepted V3 behavior; platform-specific touch polish may be revisited as a later UI refinement, not a CP C-1 contract defect.

**Gate:** CP C-1 PASS. Alicia must explicitly release CP C-2 before construction resumes.
