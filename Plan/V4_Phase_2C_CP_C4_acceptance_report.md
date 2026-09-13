# V4 Phase 2C — CP C-4 Independent Acceptance Report

> **Acceptance owner:** `[gpt-5.6-sol / Solaire]`
> **Builder:** `[gemini / Alaric]`
> **Frozen Plan:** `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`
> **Frozen Plan SHA-256:** `c72533fe1b1066f5b14793954c0e14f07d222b3b005ed279357df5caf265fa6c`
> **Builder Evidence:** `Plan/V4_Phase_2C_Construction_Evidence.md`
> **Builder Evidence SHA-256 verified:** `5512b696da8ced1c235cc563f614a95969d0352256345c7dd0fb9b7f9999d34e`
> **Checkpoint:** CP C-4 / P2C Final Hold
> **Verdict:** **PASS (R3) — C4-R1-F1 through F5 are closed; CP C-4 and P2C Final Hold are released.**

## 1. R1 ledger

| Field | Value |
|---|---|
| Cycle | R1 |
| Checkpoint ID | P2C CP C-4 |
| Verdict | FAIL / REVISE |
| Cause owners | Construction 4; Cross-repo handoff 1; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 |
| Finding IDs | C4-R1-F1 through C4-R1-F5 |
| Consecutive FAIL count | 1 |
| Builder evidence integrity | SHA-256 matches handoff exactly |

Acceptance-owned artifact: `packages/app/src/acceptance/p2c_c4_acceptance.test.tsx`. Construction must not edit this file or this report except through an explicit acceptance-owner handoff.

## 2. Independent evidence

- Builder evidence SHA independently verified: `5512b696da8ced1c235cc563f614a95969d0352256345c7dd0fb9b7f9999d34e`.
- Existing Builder C-4 focused suite + prior C1/C2/C3 acceptance regression independently rerun: **4 files / 30 tests / 30 PASS / 0 failed**.
  - `src/test/p2c_mcp_drawers.test.tsx`: **17/17 PASS**.
  - prior independent C1/C2/C3 acceptance: **13/13 PASS**.
- Fresh C-4 independent adversarial probes: **0/4 PASS, 4/4 FAIL**.
- The failures reproduce gaps not covered by the Builder's 17 C-4 tests: preset-switch draft discard, strict MCP enum validation, `raw_secret` write-response rejection, and the frozen single all-list credential Query owner.
- Backend contract copy independently inspected: `../ExoCore/ReactSheet.md` §10 still says **`Frozen / Backend Pending`** and **`当前端点尚未实现`**, while the backend endpoints are already delivered. This leaves the explicit CP C-4 cross-repo documentation handoff incomplete.

Because independent P1 blockers are established, Builder's previously reported 80 files / 950 tests, build, and DB baseline are not disputed but are insufficient for acceptance. A full 950-test rerun is not a substitute for closing the failed acceptance invariants.

## 3. Findings

### C4-R1-F1 — unsaved MCP binding draft must be discarded on preset switch (P1 BLOCKER)

**Authority:** Frozen Plan D11; CP C-4 #4; §7.9 preset isolation and A→B stale-result requirement.

**Observed:** `McpPanel.tsx` stores binding drafts as `Record<string, string>` keyed only by `server_name`. `currentAlias` prefers `bindingDrafts[server.server_name]` over the selected preset's server truth. Switching from preset A to preset B does not clear or scope this draft. Therefore an unsaved alias selected for A is shown as B's current draft and can be submitted to B.

**Independent reproduction:** Fresh acceptance probe edits `galatea_garden` from `cred-a` to `cred-b` on preset 1, switches to preset 2 whose server truth is still `cred-a`, and observes `cred-b` leaking into preset 2. Probe FAILS on current construction.

**Required repair / human clarification:** Switching AgentPreset targets discards unsaved binding edits. Clear the outgoing unsaved draft atomically on selector change and render the newly selected preset from its saved/query truth. If the user later switches back to A, A's old unsaved draft must not reappear. Do not preserve per-preset draft caches or add a global store. The frozen §7.9 late-response identity guard remains a separate requirement.

### C4-R1-F2 — MCP GET validators normalize malformed server facts instead of failing closed (P1 BLOCKER)

**Authority:** Frozen Plan D11; §5.2; §7.9 strict five-envelope validation; `ReactSheet.md` §10.1/§10.2/§10.4/§10.5 enum contracts.

**Observed:** Although `validateDrawerCatalog` validates `credential_strategy`, the other MCP validators are materially looser:

- `validatePresetDrawers` casts/defaults `credential_strategy`, boolean-coerces `credential_required`, and converts invalid `credential_mode` to `null`;
- `validateMcpServers` casts/defaults `credential_strategy` to `none` and boolean-coerces `credential_required`;
- `validatePresetMcpServers` casts/defaults strategy, converts invalid `mode` to `null`, and converts invalid `resolved_source` to `none`.

Malformed 2xx truth can therefore be presented as a legitimate `none`/`null` state rather than a contract failure.

**Independent reproduction:** Fresh probe supplies illegal strategy/mode values and expects `AppApiError`; current validators accept/normalize them. Probe FAILS.

**Required repair:** Strictly validate every rendered/decision-bearing required field and enum. Reuse `VALID_STRATEGIES`; enforce `dedicated | inherit_public | null` only where the contract permits null; enforce `public | preset | none` for `resolved_source`; reject malformed booleans/strings instead of Boolean/default coercion. No schema framework is needed.

### C4-R1-F3 — write-response secret guard omits `raw_secret` despite claimed fail-closed hygiene (P1 SECURITY/CONTRACT BLOCKER)

**Authority:** Frozen Plan D11 and §7.9 secret hygiene; Builder Evidence §C4 claims `credential_value/secret/raw_secret` all fail closed.

**Observed:** `validateMcpCredentials` correctly rejects all three names, but successful create/rename/overwrite response paths check only `credential_value` and `secret`. A 2xx object containing `raw_secret` is accepted and projected as a successful write response.

**Independent reproduction:** Fresh probe returns `raw_secret: 'LEAK'` from create, rename, and overwrite success responses. Current implementation does not reject them as ambiguous contract writes. Probe FAILS.

**Required repair:** Use one narrow secret-field guard for `credential_value`, `secret`, and `raw_secret` across read and all MCP credential write responses. For a secret-bearing malformed 2xx write, throw existing `AppApiError` with `code='CONTRACT'` and `ambiguousWrite=true`; never claim success or retry automatically.

### C4-R1-F4 — MCP credential Query seam violates frozen single all-list fact owner (P2 ARCHITECTURE DRIFT)

**Authority:** Frozen Plan §5.1: `MCP credentials（单一 all-list Query；server filter只在前端派生）`; D11 single typed fact owner.

**Observed:** `settingsQueryKeys.mcpCredentials(serverName?)` produces separate keys such as `['mcp-credentials', 'all']` and `['mcp-credentials', '<server>']`; `useMcpCredentialsQuery(serverName?)` and `fetchMcpCredentials(serverName?)` expose the same split. `McpPanel` currently calls the all-list form and filters in `useMemo`, so the present screen usually behaves correctly, but the frozen owner seam itself permits multiple cached truths. Builder Evidence also documents the split as the delivered design.

**Independent reproduction:** Fresh probe requires server-specific calls to resolve to the same all-list key; current key factory differs. Probe FAILS.

**Required repair:** Keep one canonical MCP credential Query key/fetch owner for the full list and derive server subsets locally. Backend may support `?server_name=`; P2C frontend architecture intentionally does not make that a second Query truth.

### C4-R1-F5 — required backend ReactSheet handoff is still incomplete (P1 FINAL-CLOSEOUT BLOCKER, backend owner)

**Authority:** CP C-4 #5 explicitly requires the Desktop copy to remove obsolete Backend Pending status **and verify the backend owner has synchronized its copy** before final closeout. The Detailed Plan also forbids Desktop Builder from modifying `../ExoCore/ReactSheet.md` directly.

**Observed:** Desktop `ReactSheet.md` §10 is correctly updated to `Frozen`, but backend `../ExoCore/ReactSheet.md` §10 still reads `Frozen / Backend Pending` and states that the endpoints are not implemented. Builder Evidence itself records the backend copy as unmodified / awaiting handoff.

**Required repair:** Backend owner must make the documentation-only status correction in `ExoCore/ReactSheet.md` §10, without changing API shapes. Desktop Builder must not cross-repo edit it. Acceptance then rechecks both copies.

## 4. Preserved verified behavior

Repair must preserve the parts already independently green:

- C1/C2/C3 acceptance remains **13/13 PASS**;
- C-4 Builder focused coverage remains **17/17 PASS**;
- `/settings/mcp` routing/title and user-preset exclusion/ID labels;
- independent `available`, `enabled`, and `credential_ready` presentation;
- target-row lock for existing drawer/binding mutations;
- per-preset public binding kept read-only for current servers;
- alias `/` guard and URL encoding;
- credential create/overwrite secret request value remains verbatim (no trim);
- 409 credential deletion keeps the row/dialog and exposes backend error;
- no public-binding PUT UI, no assigned-preset fan-out, no backend/runtime dispatch changes.

## 5. R2 repair gate

R2 is deliberately narrow. Required before re-acceptance:

1. close C4-R1-F1 through F4 in `packages/app` without touching acceptance-owned assets;
2. backend owner closes C4-R1-F5 in `../ExoCore/ReactSheet.md` only;
3. Builder adds regression coverage for the repaired invariants to its own `src/test/**` suite;
4. rerun the fresh C-4 acceptance probe and obtain **4/4 PASS**;
5. rerun C1/C2/C3 acceptance + C-4 Builder tests, typecheck, lint, build, `git diff --check`, full `exo-app` regression, and real DB 8-row baseline;
6. update Construction Evidence with the repair ledger and accurate final architecture description.

**Final R1 ruling:** **CP C-4 REVISE / FAIL. P2C is not PASS. No commit/push is authorized by this acceptance.**

---

## 6. Cycle R2 independent re-acceptance — frontend repair accepted, Final Hold remains closed

> **Cycle:** R2
> **Verdict:** **FRONTEND REPAIR PASS / FINAL HOLD — C4-R1-F1 through F4 are closed; C4-R1-F5 remains open.**
> **Cause owner:** Cross-repo handoff 1; Construction 0; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0.

### 6.1 Independent R2 verification

- Clarified human UX contract for F1 is enforced: switching AgentPreset targets discards unsaved MCP binding drafts. Independent A → B → A probe returns to saved/query truth and passes.
- Fresh CP C-4 acceptance: **1 file / 4 tests / 4 PASS / 0 failed**.
- All acceptance probes: **15 files / 158 tests / 158 PASS / 0 failed**.
- Builder C-4 regression: **1 file / 21 tests / 21 PASS / 0 failed**.
- Full `exo-app` regression: **81 files / 958 tests / 958 PASS / 0 failed**.
- `typecheck`, `lint`, production `build`, and `git diff --check`: **PASS**.
- Real database baseline independently rechecked: `AgentPreset` IDs remain **[1, 2, 3, 4, 5, 6, 7, 8]**.
- Builder handoff hashes independently matched before this R2 report update:
  - `packages/app/src/acceptance/p2c_c4_acceptance.test.tsx`: `bc8e3fd5fb94af7677d4af3b99d614b7899a4b9f1bcf445eac06546baa03d925`;
  - this acceptance report at Builder handoff: `edece42869b9062b836028d184fc8253efd55d4051d58284b6f658bb9d308589`.
  The report hash necessarily changes after this acceptance-owner R2 append; this is not a Builder modification.

### 6.2 Finding disposition

- **C4-R1-F1 CLOSED:** `bindingDrafts` is local to the current target and cleared on preset selector change; `effectivePresetIdRef` still prevents late mutation feedback from projecting onto a newly selected preset. No per-preset unsaved draft persistence remains.
- **C4-R1-F2 CLOSED:** MCP GET decision-bearing enum/boolean facts are strictly validated and malformed 2xx envelopes fail closed.
- **C4-R1-F3 CLOSED:** `credential_value`, `secret`, and `raw_secret` are rejected across MCP credential read/write success responses; malformed 2xx writes remain ambiguous contract failures.
- **C4-R1-F4 CLOSED:** MCP credential Query ownership is a single all-list cache identity; server filtering remains a frontend derivation.
- **C4-R1-F5 OPEN:** `../ExoCore/ReactSheet.md` §10 still reads `Frozen / Backend Pending` and `当前端点尚未实现`; `git status --short -- ReactSheet.md` is clean, confirming the backend copy has not yet been synchronized.

### 6.3 Final Hold disposition

No further Desktop construction repair is requested. **Do not change F1–F4 again.** The only remaining release gate is the backend-owner documentation-only synchronization of `../ExoCore/ReactSheet.md` §10. Desktop Builder must not perform that cross-repo edit.

After the backend owner updates §10 without changing API shapes, acceptance only needs a narrow docs handoff recheck; repeating the 958-test frontend regression is not required unless code changes again.

**Final R2 ruling:** **CP C-4 frontend construction is accepted, but P2C Final Hold remains CLOSED solely on C4-R1-F5. No commit/push is authorized yet.**


---

## 7. Cycle R3 narrow documentation recheck — P2C Final PASS

> **Cycle:** R3
> **Verdict:** **PASS — C4-R1-F5 is closed; P2C Final Hold is released.**
> **Cause owners:** Construction 0; Cross-repo handoff 0; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0.

### 7.1 Independent narrow evidence

- Backend §10 correction is durably committed at `9826b4e4` with scope exactly `ReactSheet.md` plus its archived 9-line behavior memo; `git show --check 9826b4e4` passes and no API or production file changed.
- Backend HEAD and Desktop worktree §10 now carry the same delivered-status heading and notice, including the authoritative `agents/tests/test_drawer_mcp_api.py` reference.
- Desktop B6 §8 synchronization is committed at `5122e29` with scope exactly `ReactSheet.md` §8 plus `Plan/spec/2026-09-13-b6-section-8-contract-sync.md`; `git show --check 5122e29` passes.
- Independently extracted backend/desktop HEAD §8 blocks are byte-identical: 12,435 UTF-8 bytes, SHA-256 `f4ad0067a123e2ff6a89e0c42c7ac3a15f60f4591c77184f6b6c0b78cac11d1c`.
- Desktop's remaining `ReactSheet.md` worktree diff is exactly the pre-existing P2C §10 delivered-status hunk. The isolated-index handoff did not absorb, overwrite, or stage unrelated P2C/sibling work.
- B6 C1–C6 backend Final PASS was handed off with closure commits `d8e2abf6`, `f0443e46`, acceptance evidence `55d2df6e`, and archived final report `cc6453c4`. P2D construction remains separately gated.

### 7.2 Final disposition

**C4-R1-F5 CLOSED.** All C4-R1-F1 through F5 are closed. CP C-4 and P2C are **FINAL PASS**.

No frontend production code changed after the R2 full regression, so the previously accepted **81 files / 958 tests**, typecheck, lint, build, diff-check, and real-DB baseline evidence remain authoritative; this docs-only R3 correctly used a narrow recheck.

This PASS confirms the prerequisite for P2D planning together with B6 Final PASS. It does **not** authorize P2D construction, commit/push of remaining P2C work, or unified Core C2 acceptance. Alicia's explicit approval remains required. `[gpt-5.6-sol / Solaire]`
