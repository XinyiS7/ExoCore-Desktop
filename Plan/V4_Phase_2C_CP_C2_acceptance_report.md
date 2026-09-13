# V4 Phase 2C — CP C-2 Independent Acceptance Report

> **Acceptance owner:** `[gpt-5.6-sol / Solaire]`
> **Builder:** `[gemini / Alaric]`
> **Frozen Plan:** `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`
> **Frozen Plan SHA-256:** `c72533fe1b1066f5b14793954c0e14f07d222b3b005ed279357df5caf265fa6c`
> **Checkpoint:** CP C-2 only
> **Verdict:** **PASS (R2) — CP C-2 is independently released.** P2C remains overall in progress; C-3 requires Alicia's explicit release and this verdict does not authorize C-3, commit or push.

## 1. R2 ledger

| Field | Value |
|---|---|
| Cycle | R2 |
| Checkpoint ID | P2C CP C-2 |
| Baseline | HEAD `0cfa84df97d2341d371fd21ad19041ff2bed5de7` + C-2 construction-content digest `50f289a5472fe159cde5e96a9a5f5fa2cb81a0ee7ad2295a9a60d502a4a2a2bf` |
| Verdict | PASS |
| Cause owners | Construction 0; Acceptance 1; Harness 0; Spec 0; Environment 0; Unknown 0 |
| Finding IDs | closes C2-R1-F1; acceptance harness mechanical defect noted |
| Supersedes/amends | R1 |
| Consecutive FAIL count | 0 |
| Repeated invariant IDs | none |

Acceptance-owned artifacts are `packages/app/src/acceptance/p2c_c1_acceptance.test.tsx`, `packages/app/src/acceptance/p2c_c2_acceptance.test.tsx`, `Plan/V4_Phase_2C_CP_C1_acceptance_report.md`, and this report. Construction must not edit them.

## 2. R2 independent evidence

- Original failing bare-`/settings` probe now passes: C-2 independent probes **3/3 PASS**.
- CP C-1 acceptance probes under C-2: **4/4 PASS**; combined C-1/C-2 acceptance: **7/7 PASS**.
- Builder C-1 + C-2 focused suites independently rerun: **43/43 PASS**.
- Full app regression: **77 files / 906 tests / 0 failed**.
- `typecheck`: 0 errors; `lint`: 0 errors/warnings; production `build`: PASS, PWA `injectManifest` generated.
- `git diff --check`: PASS.
- Real DB baseline independently queried after R2: `AgentPreset` IDs `[1,2,3,4,5,6,7,8]` (8 rows).
- The R1 route/title defect is closed: bare `/settings` receives an explicit not-found title and does not masquerade as a valid released Settings section.
- Acceptance self-correction: R1 probe had an unused handler parameter that caused Acceptance-owned typecheck/lint noise. The Acceptance owner renamed it to `_init` without Builder editing acceptance files; this is recorded as Acceptance 1, not Construction.

---

## 3. R1 ledger (superseded repair cycle)

| Field | Value |
|---|---|
| Cycle | R1 |
| Checkpoint ID | P2C CP C-2 |
| Baseline | HEAD `0cfa84df97d2341d371fd21ad19041ff2bed5de7` + C-2 construction-content digest `1938c5a34e55b54392d9bdfbf437b2e0f55654d586f31e556c71de3055fa2346` |
| Verdict | FAIL |
| Cause owners | Construction 1; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 |
| Finding IDs | C2-R1-F1 |
| Supersedes/amends | none |
| Consecutive FAIL count | 1 |
| Repeated invariant IDs | none |

Acceptance-owned artifacts are `packages/app/src/acceptance/p2c_c1_acceptance.test.tsx`, `packages/app/src/acceptance/p2c_c2_acceptance.test.tsx`, `Plan/V4_Phase_2C_CP_C1_acceptance_report.md`, and this report. Construction must not edit them.

## 4. R1 evidence and repair requirement record

- Frozen Plan and C-1 Acceptance artifacts unchanged.
- CP C-1 independent probes rerun under C-2: **4/4 PASS**.
- Builder C-1 + C-2 focused suites rerun: **38/38 PASS**.
- Independent C-2 probes: **2/3 PASS; 1 FAIL**, with the failure identifying the production route/title defect below.
- Real DB baseline independently queried after construction: `AgentPreset` IDs `[1,2,3,4,5,6,7,8]` (8 rows).
- Production scope scan found only one `useTheme()` / `useFont()` owner (`AppearanceProvider`), no C-3 Keys/Models/MCP sections, and no executable Push runtime/API/storage call.
- `git diff --check`: PASS.
- Full app regression/typecheck/lint/build were not repeated after the independent P1 route/title blocker was established.

## 5. R1 blocking finding — closed in R2

### C2-R1-F1 — bare `/settings` renders an empty panel and leaves a stale document title (`new`, P1)

**Authority:** Plan CP C-1 explicitly removed temporary “not released” surfaces; CP C-2 allows only the released Appearance/Routine/Notifications sections; Plan D3 and §7.2 require honest route and document-title ownership.

**Observed chain:** the production route registers `path: 'settings'` with three child routes and a nested wildcard, but no index route. Navigating directly to `/settings` therefore mounts `SettingsLayout` while rendering **no child**. Independent DOM observation shows `.settings-content` empty and no `.app-error-page`; `document.title` remains the base title rather than the not-found title.

**Required outcome:** While `/settings/keys`, `/settings/models` and `/settings/mcp` are not released, the bare canonical `/settings` path must not render a blank panel or masquerade as a valid Settings section. It must produce an explicit not-found/error state and the corresponding stable document title. Do not redirect it to `/settings/keys` during C-2, and do not invent a temporary Settings landing page.

**Recheck boundary:** bare `/settings`, `/settings/appearance`, `/settings/routine`, `/settings/notifications`, nested `/settings/keys|models|mcp`, document titles across those paths, and the C-1 route/title regression probes.

## 6. Preserved verified behavior

The following C-2 areas are currently verified by independent source and focused evidence and should remain stable during the targeted repair:

- AppearanceProvider is the single React owner of shared `useTheme`/`useFont`; Settings consumes Context rather than mounting second hooks.
- Inline bootstrap does not copy FONT_STACKS or perform legacy migration; Provider synchronizes V4 meta `theme-color`.
- Dark/light token blocks, `color-scheme`, scoped light Highlight.js override, and calc-based font scaling exist.
- Routine submits identical deduplicated positive-ID arrays to both allowed fields; failure preserves the draft; schedule remains read-only; malformed 2xx PATCH is not reported as success.
- Notifications is entry-only; Settings entry remains disabled; Notifications direct entry is enabled; no executable Push runtime/API call was found.
- C-1 Account/Shell invariants remain green under C-2.

## 7. Non-blocking observations for later polish

These do not block CP C-2 R1 and must not expand current repair scope without Alicia’s approval:

- Settings `SettingsLayout` currently introduces `app-topbar-left`/`app-back-btn` class names with no matching CSS; behavior is still reachable, but visual polish should be reviewed during final Settings design consolidation.
- Some remaining hard-coded colors/overlays are deliberately deferred under the Plan’s true-hit audit and final browser matrix; do not perform broad visual redesign during this repair.
- Browser screenshot/DOM evidence remains required for final P2C visual matrix, but is not a substitute for fixing the route/title invariant above.

## 8. Residual limitations and next gate

- Automated evidence is complete for C-2; independent real-browser screenshot/DOM review remains part of the final P2C visual matrix, not a substitute for this checkpoint verdict.
- The route/title repair intentionally keeps `.settings-content` as the real empty route area for bare `/settings`; it does not create a temporary Settings landing page.
- Browser screenshot evidence and broad final visual review are deferred to the final P2C matrix after C-3/C-4.
- P2D Notifications runtime remains untouched.

**Gate:** CP C-2 PASS. Alicia must explicitly release CP C-3 before construction resumes.
