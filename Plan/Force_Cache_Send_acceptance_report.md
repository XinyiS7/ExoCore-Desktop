# Force Cache Send — independent acceptance

Acceptance-owned report and probes; Construction must not edit.

Checkpoint: bounded V3 Force Cache Send capability restoration (handoff from Ecki pane 4).
Baseline HEAD: 39f2c1a3d34a6d29d8c7bc23c073a9abeca9cfcc plus uncommitted packages/app patch.
No dedicated pre-frozen patch specification was located. Authority is the delivered capability-restoration scope, V3 reference, and Plan/V4_Phase_1D_Source_Scout.md cache POST requirement. This review does not accept future attachment-transport/cache-promotion work or review a Plan.

R1 verification in progress. No verdict yet.

Scope excludes sibling edits to ReactSheet.md, Plan roadmap/update/TTS handoff, DevelopLog/DebugLog.md, and packages/chat-core/src/main.jsx. No ownership attribution is inferred from shared-worktree status.

## R1 — PASS

- Consecutive FAIL count: 0; repeated invariants: none.
- Gates: checked 7, passed 7, failed 0, not checked 0.
- Findings: blocking 0; P2 reporting correction 1 (Construction wording).
- Final regression: 66 files / 741 tests passed; failed/errors/skipped 0/0/0.
- Independent probes: 7/7 (included in 741, not added again).
- Typecheck, lint, build, production diff whitespace check: PASS.
- Tests used Node v25.7.0 with NODE_OPTIONS=--no-experimental-webstorage.
- Unreviewed within bounded frontend restoration: none. Browser hand-feel and real provider cache rebuild are not verified and are outside this frontend-only verdict.

### Evidence gates

1. Explicit ice entry/shortcut and attachment eligibility: ChatComposer.tsx:135–136,196–250,306–318,549–572; builder composer tests exercise click, audio, IME, empty/no-attachment degradation and edit exclusion. Autocomplete retains existing precedence.
2. Send guards preserved: common handleSubmit checks runtime busy/active, upload, missing settings, ref-backed delete guard before all entry paths. No alternate force POST path.
3. Transport contract: client.ts:83–90 true-only serialization; useChatRuntime.ts:1586/1631 routes both SSE/async through shared client. Independent invalid-input matrix verifies five invalid values fail VALIDATION with zero network requests on both transports.
4. One-shot isolation/settings: independent real-runtime two-turn probes on SSE and async verify first force true, second omission, separate IDs and cache_enabled=false preserved. Contrasting positive/negative assertions use observed POST bodies rather than implementation reflection.
5. Historical operations: useChatRuntime.ts:1443 runtime send-only gate; public edit/regenerate/recovery callers at1684–1706. Builder replacement test supplies true deliberately and verifies omission.
6. Recorded audio/retry: audioRecoveryMachine.ts:244–249 forwards initial intent, retry rebuilds a turn without force. Builder test observes one upload, ordinary replay with original attachment set. V3 ChatArea.jsx:1667 retries via handleSend() without force options.
7. Ownership/regression: only packages/app feature files assessed; separate sibling diffs excluded. Existing frozen Plan artifacts were not changed by this patch according to captured diff. No production or Builder test edits by Acceptance. Required app pipeline passed.

### Limitations and non-blocking correction

- P2 FC-DOC-01 / new / Construction: “type-level impossible” is inaccurate. ChatTurnInput permits the optional flag; operation==='send' enforces exclusion at runtime. Use runtime-gated wording in the final handoff; no production repair required.
- Default Node WebStorage issue: green results require the explicit flag above. This review did not reproduce/count the claimed 149 default-environment failures or independently prove their complete root cause. No environment pinning authorized or performed.
- Original delivery counted 58/630; independent complete run before new probes discovered 65/734, including seven existing acceptance files. Final count adds seven independent probes: 66/741.
- One scout accidentally obtained outer-repository git status/HEAD; that git evidence was discarded. Desktop baseline was rechecked directly with git -C and remains 39f2c1a3d34a6d29d8c7bc23c073a9abeca9cfcc.
- No dedicated frozen patch spec existed; no claim of satisfying a newly invented frozen contract. PASS is limited to recovery scope, not new provider cache semantics.
- This PASS releases the patch from acceptance hold. Do not include sibling changes in a feature commit; no commit/push was performed by Acceptance.

### Ledger

Cycle: R1 | Checkpoint: Force Cache Send restoration | Baseline: HEAD above + SHA256 inventory below | Verdict: PASS | Cause owners: Construction 0, Acceptance 0, Harness 0, Spec 0, Environment 0, Unknown 0 | Findings: FC-DOC-01 (P2) | Supersedes: none | Consecutive FAIL count: 0 | Repeated invariants: none.

### Reviewed patch SHA256 inventory
- `packages/app/src/features/chat/ChatComposer.tsx`: EF6FA50F428A9A338AC897FF2F6E58DCBA4DC44C6B5FFC445770AB5585F172B2
- `packages/app/src/features/chat/audio/audioRecoveryMachine.ts`: 37B1AFABB719B06DED5A454DF84F08527820B4F548A6E131347A1BEAE6A5A83F
- `packages/app/src/features/chat/runtime/client.ts`: 158580EB25E6D9D199A40AE2398C18B0E2981BF223E4E1DF4827F0FBD6A339B1
- `packages/app/src/features/chat/runtime/types.ts`: AE497879011F161C5A92808016ED13456744499C5427B6D93893B94763EBE040
- `packages/app/src/features/chat/runtime/useChatRuntime.ts`: 312994942C119A288A5CDBD705B4B15B74ADBE50031A45089DC90782E1455148
- `packages/app/src/styles/shell.css`: A8F83E4546883CABAF36400B6203CA5F5CB1581128379EE3FB2FC89249EA44A8
- `packages/app/src/test/helpers.tsx`: B9B35BB2378EC95D96A6110474F6E8BC3626CED499FCAA9A1044AAF022525034
- `packages/app/src/test/p1d_force_cache_body.test.ts`: 373E67FEF10F58843E0D10920C8F06C58111113A72543A0C238D34AB46800BA4
- `packages/app/src/test/p1d_force_cache_composer.test.tsx`: 3EEEDDC6AAC09C6FB7174C9DC45861711EB3291EB8339BC97BEAA187F1CDFE34
- `packages/app/src/test/p1d_force_cache_runtime.test.tsx`: 09AD0DA1986DF61FB32DA4ECFE4F7394CCDDCDF67AE98AD42BD6AA9AFB8CFA4C
