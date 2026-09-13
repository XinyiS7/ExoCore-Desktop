# V4 Phase 2C — CP C-3 Independent Acceptance Report

> **Acceptance owner:** `[gpt-5.6-sol / Solaire]`
> **Builder:** `[gemini / Alaric]`
> **Frozen Plan:** `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`
> **Frozen Plan SHA-256:** `c72533fe1b1066f5b14793954c0e14f07d222b3b005ed279357df5caf265fa6c`
> **Checkpoint:** CP C-3 only
> **Verdict:** **PASS (R2) — C3-R1-F1 through F6 are closed; CP C-3 is released.**

## 1. R1 ledger

| Field | Value |
|---|---|
| Cycle | R1 |
| Checkpoint ID | P2C CP C-3 |
| Baseline | HEAD `0cfa84df97d2341d371fd21ad19041ff2bed5de7` + C-3 owned-file digest `082509a53a292a9553cb7f9be150f30cd7e34242b5e863446dff517e0f37acbd` |
| Verdict | FAIL |
| Cause owners | Construction 6; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 |
| Finding IDs | C3-R1-F1 through C3-R1-F6 |
| Supersedes/amends | none |
| Consecutive FAIL count | 1 |
| Repeated invariant IDs | none |

Acceptance-owned artifacts are `packages/app/src/acceptance/p2c_c1_acceptance.test.tsx`, `p2c_c2_acceptance.test.tsx`, `p2c_c3_acceptance.test.tsx`, and the corresponding CP acceptance reports. Construction must not edit them.

## 2. R2 ledger

| Field | Value |
|---|---|
| Cycle | R2 |
| Checkpoint ID | P2C CP C-3 |
| Verdict | PASS |
| Recheck scope | C3-R1-F1 through F6, preserved behavior, full regression/build, DB baseline |
| Closed findings | C3-R1-F1 through C3-R1-F6 |
| New blocker IDs | none |
| Cause owners | Construction 0; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 |
| Consecutive FAIL count | reset to 0 |

R2 independently confirmed:

- six adversarial C-3 probes: **6/6 PASS**;
- full `exo-app` regression: **79 files / 933 tests / 0 failed**;
- previously timing-out P2B Project test, isolated: **13/13 PASS**;
- typecheck and lint: PASS;
- production build and PWA injectManifest: PASS, 91 precache entries;
- `git diff --check`: PASS;
- real DB `AgentPreset` baseline: 8 rows, IDs `[1,2,3,4,5,6,7,8]`;
- Acceptance probe hash remained `017edf7e17891c0449b33c0a82c11c33732d60a6bb28486ef7c6663c4d7bf517` throughout Builder repair.

The first full-suite attempt was run concurrently with build/typecheck and produced one timeout in the unrelated P2B Project test while its page remained in loading state. The same test passed **13/13** in isolation, and the subsequent non-competing full run passed **933/933**; this is classified as verifier resource contention, not a construction defect.

## 3. R1 evidence

- C-3 Builder focused suite plus C-1/C-2 Acceptance regressions: **23/23 PASS**.
- Independent C-3 adversarial probes: **0/6 PASS**.
- Acceptance probe itself passes `typecheck`, `lint`, and `git diff --check` hygiene.
- Real DB baseline independently queried: `AgentPreset` IDs `[1,2,3,4,5,6,7,8]` (8 rows).
- C-4 scope scan: no MCP/Drawer production implementation found.
- Existing C-1/C-2 acceptance assets remain staged and were not modified by the Builder.
- Builder reported full regression **78 files / 922 tests / 0 failed** and build/typecheck/lint PASS before Acceptance probes were added. The full pipeline was not repeated after independent P1 blockers were established.

## 4. Closed R1 findings

### C3-R1-F1 — shared model catalog validator admits incomplete Settings truth (P1, CLOSED R2)

**Authority:** Plan D10, CP C-3 #1, §7.1 and §7.8; `ReactSheet.md` §3.3 identifies `providers` as the sole Endpoint ProviderProfile fact source and freezes four support roles.

**Observed:** `validateModelCatalog` accepts a missing `providers` collection, missing endpoint execution fields, and a support object missing required roles. `KeysPanel` then falls back to `DEFAULT_PLATFORMS`, while `ModelRolesPanel` fabricates missing support values as empty/zero drafts.

**Required:** Validate every fact consumed by Settings, including required provider metadata, endpoint execution pair, and exactly/presently required support-role keys. Malformed catalog truth must surface as a contract error. Remove static provider fallback; Endpoint provider choices must come only from catalog truth. Preserve the single `['model-catalog']` owner/key.

### C3-R1-F2 — malformed successful writes are not consistently classified as ambiguous (P1, CLOSED R2)

**Authority:** Plan D10, CP C-3 #6, §7.7 and rollback semantics.

**Observed:** A 2xx-but-partial Endpoint response throws an ordinary `contractError` with `ambiguousWrite=false`; API Key create behaves the same; Role PUT accepts `{}` as success. These writes may already have committed server-side, so ordinary retry or a success state is unsafe.

**Required:** Strictly validate successful Endpoint, API Key, and full Role response shapes. Every malformed 2xx write response must throw the existing `AppApiError` with `code='CONTRACT'`, `ambiguousWrite=true`, and no automatic retry. Preserve the user's current dialog/draft and do not claim success.

### C3-R1-F3 — DRF field errors are hidden behind a generic transport message (P1, CLOSED R2)

**Authority:** Plan CP C-3 #6 and §7.7/§7.8 require field/general errors to be visible.

**Observed:** Endpoint and key dialogs catch errors with `toAppApiError(err).message`; a backend body such as `{name: ['This endpoint name is already in use.']}` displays only the generic HTTP error. The existing `getErrorMessage` projection already extracts field errors but is not used by these dialogs.

**Required:** Show the backend's actionable field/general message inside the still-open dialog while preserving entered values. Apply consistently to Endpoint create/edit and API Key create/rename/overwrite; do not invent another error mapper.

### C3-R1-F4 — Endpoint provider is incorrectly read-only during edit (P1, CLOSED R2)

**Authority:** The verified Endpoint serializer permits `provider` updates; Plan D10 and CP C-3 #2 freeze Endpoint create/edit across the four writable fields.

**Observed:** `EndpointEditDialog` uses `disabled={saving || isEdit}` on the Provider selector, so a valid provider change cannot be performed. This silently contracts an existing backend capability.

**Required:** Keep Provider editable using catalog-only options. On provider change, recompute managed/direct behavior and clear an incompatible alias before submission. Continue sending only `name/provider/api_key_alias/enabled`.

### C3-R1-F5 — disabled current endpoints remain selectable and saveable in Model Roles (P1, CLOSED R2)

**Authority:** Plan D10 and §7.8 explicitly forbid selecting disabled, unconfigured, incompatible, or non-`direct_api + internal_http` endpoints.

**Observed:** `getEligibleEndpoints` unconditionally preserves `currentEndpointId`; therefore a disabled current endpoint appears as a normal option and can be resubmitted after unrelated edits.

**Required:** Never include an ineligible endpoint in selectable candidates. If server truth contains a stale invalid binding, show an explicit invalid/current diagnostic and force selection of a valid candidate before save; do not silently drop or normalize server truth.

### C3-R1-F6 — Style Shadow lists models the backend will reject (P1, CLOSED R2)

**Authority:** Plan §7.8 requires style shadow to be an acceptable model or null; backend `ModelRoleBindingService.validate_binding` requires enabled, `fc`, and compatibility with the selected Endpoint.

**Observed:** Every catalog model is offered as Style Shadow, including models without `fc` and models incompatible with the selected endpoint.

**Required:** Derive Style Shadow options from catalog facts: `fc` capability plus compatibility with the role's selected eligible endpoint; retain null. If an existing shadow is no longer valid, represent that explicitly and require repair before save rather than treating it as valid.

## 5. Preserved verified behavior

Repair must preserve:

- unique shared `MODEL_CATALOG_QUERY_KEY` identity and Chat/audio import through the shared seam;
- precise key/endpoint/role invalidation rather than global QueryClient clearing;
- API Key response projection that never retains or renders `key_value`;
- secret values confined to current password-dialog component state and cleared on unmount/close;
- endpoint request-body allowlist and alias URL encoding;
- 409 Endpoint deletion behavior preserving the visible row;
- `/settings -> /settings/keys`, enabled More Settings entry, and `/settings/mcp` remaining NotFound;
- C-1/C-2 accepted behavior and the C-4 boundary.

## 6. Ablation / scope control

These repairs require no new abstraction family, dependency, backend change, static registry, generic CRUD framework, or UI redesign. Reuse the existing validator, `AppApiError`, `getErrorMessage`, catalog compatibility projection, and dialogs. Do not broaden this cycle into MCP/Drawer, cosmetic Settings cleanup, or unrelated CSS refactoring. `[gpt-5.6-sol / Solaire]`

## 7. R2 gate

CP C-3 is **PASS** and released. C-4 remains unstarted and still requires Alicia's explicit construction release; this acceptance result does not authorize it automatically. `[gpt-5.6-sol / Solaire]`
