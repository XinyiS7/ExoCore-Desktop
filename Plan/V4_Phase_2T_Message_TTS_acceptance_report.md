# P2T Message TTS Independent Acceptance Report

Owner: Solaire, pane 3. Builder read-only.
Frozen authority: `Plan/V4_Phase_2T_Message_TTS_acceptance_spec.md`.

## CP 2T-1 / R1 — evidence in progress

No verdict yet. Baseline HEAD 84522606631eb569c00f97778aec53a40fb83e49; tracked app diff bf64eab676d8dbc2009c75508cd0aeee9bd5c84df8a098a90df4039d8c2c34dd. Untracked production/test files separately fingerprinted in Builder evidence and independently recomputed by scout (matching). Frozen Plan SHA256 1d9536e853bdd74f2910ad7b0764f55a5468017f048eee11de9779645650e4ae; spec fe853e8840685535308a0d90838f40bd84ace67f5bf1c482cf79982d1d9bce47. Both unchanged.
## R1 verdict — CP 2T-1 FAIL

- Baseline: same pinned baseline above; no Builder repair between executions.
- Gates: checked 4, passed 3 (T1/T2/T4), failed 1 (T3), not checked 0 within CP1.
- Tests (corrected harness, latest run): 67 executed, 62 passed, 5 failed, 0 errors/skips. Independent: 23 executed / 18 passed / 5 failed. Construction: 44/44 passed. Typecheck: exit 0, both TS projects.
- Full regression: deferred by checkpoint rhythm and known blocker; no overall P2T PASS attempted. CP2/CP3 gates intentionally not yet due.
- Findings: new 1, residual 0, repair-regression 0, harness-defect 1 (corrected), acceptance-miss 0.
- Unreviewed CP1 areas: none. Current source/status/frozen hashes and real transport/projection paths swept. No UI or sibling ownership changes found.

### P2T-F1 / P1 / new — malformed generating response silently repaired

Authority: frozen Plan D3 says malformed 2xx => failed_retryable/contract; spec T3 requires malformed-success mapping and T5 requires observing backend retry_after_ms. This is not a demand for a different helper or class.

Observed: `features/chat/tts/api.ts:77-81,120-121` replaces missing/null/string/nonpositive retry_after_ms with 1500 and returns generating. All five independent wire-level cases reproduce this. Positive interval 2700 is passed through correctly.

Root cause (confirmed): Builder added an undocumented-at-freeze polling default (`TTS_RETRY_AFTER_FALLBACK_MS`) and construction test validates that reinterpretation. Recording it later in Builder evidence does not amend D3. The required generating interval is unlike duration metadata, for which the Plan explicitly allows an advisory fallback. Current backend always providing 1500 makes malformed timing a negative-path guard, not permission to invent it.

Required outcome: malformed required generating timing yields failed_retryable/contract; never report an invented valid observation schedule. Preserve valid positive finite timing, status-first error behavior, legitimate GET idle, identity-only body and abort propagation. Sweep both start and read because they share decoding. No new polling policy, retry layer or backend change.

Non-binding direction: validate required generating metadata where the success body is decoded; remove the fallback assumption. Construction tests should express the frozen negative-path behavior rather than blessing silent recovery.

Affected paths/chained effects: POST and GET success decoding, construction client boundary case, future CP2 polling consumer. Correct the shared invariant and its tests; no UI work is needed. Metadata duration fallback and optional error message handling are not part of this finding.

Verification targets: missing/null/wrong-type/nonpositive/nonfinite generating timing on both transport actions fails closed; valid timing still survives. First rerun original failing independent probe, then full CP1 construction/independent set and typecheck. No unrelated full regression required at this checkpoint.

Preserve recommendation: read normalization, existing real transport/abort path, valid outcomes and error-key handling all observed passing. Frozen Plan/spec/probes/report remain Builder read-only. If the fix requires a previously passing area outside the common decoder, pause with necessity/impact before expanding.

### P2T-H1 / harness-defect / Acceptance / corrected

Initial independent T2 assertion incorrectly demanded a relative fetch URL, whereas shared transport supplies an absolute same-origin URL. Corrected Acceptance probe to inspect pathname. Same baseline rerun proves both T2 cases pass. Initial run: 67 executed / 60 pass / 7 fail (2 invalid harness assertions plus 5 F1 cases); these totals are not added to the final unique test count or a second verdict cycle. No production change requested for H1.

### Repair release and handoff

CP1 repair only is authorized for F1. CP2/CP3 remain held; no commit/push permission. Return changed files, F1 invariant restatement, numeric tests, preserved frozen hashes and evidence delta. Do not edit independent artifacts. Mechanical execution delegated to test-runner, source-location/hash collection to scout; interpretation and verdict by Solaire.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|---|
| R1 | 2T-1 | 8452260 + bf64eab6 tracked diff + per-file hashes in evidence | FAIL | Construction 1; Acceptance 1 (corrected harness); Harness 1; Spec 0; Environment 0; Unknown 0 | P2T-F1, P2T-H1 | none; same-baseline harness correction included | 1 | T3 malformed success: 1 |
## R2 — CP 2T-1 PASS (checkpoint only)

Baseline: HEAD 8452260; unchanged tracked app diff bf64eab6 plus repaired untracked `tts/api.ts` SHA256 1baf346d3c704cb3d105f597a2a59441f632dc2ba1169a0022221256c899a4ad and `p2t_voice_client.test.ts` 9402301352ee1fc065e6685bec13d9132acbff0454ec4755ea3c8d61443256d4. Evidence 430cfd318403308fd677aa88f29c541f085f366a6efd32ccf096b4fcad6a8ace. Other CP1 hashes and all six sibling dirty hashes unchanged.

- Gates: checked 4 / passed 4 / failed 0 / not checked 0 (CP1).
- Findings this cycle: new 0, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0. F1 closed; H1 remains corrected.
- Tests: unique executed 131 / passed 131 / failed 0 / errors 0 / skipped 0, across six files. Original independent probe first: 23/23. CP1 construction + neighboring API/trace/cache regression: 108/108 (60 CP1 + 48 neighbors).
- Typecheck and lint: exit 0. Full product regression/build/browser: deferred to CP3 per frozen rhythm, not claimed executed.
- Unreviewed CP1 areas: none. P2T overall is NOT PASS; CP2/CP3 outstanding.
- Consecutive CP1 FAIL count resets to 0 on checkpoint PASS; historical T3 failure remains recorded once.

### Gate evidence and repair closure

T1: actual fetchMessagePage normalization probe passes, canonical text preserved, malformed/private voice fields excluded; construction projection 17/17.
T2: real shared transport identity/body/signal and abort probes pass; no invented resource identity. Staged independent probe/report vs worktree diff exit 0, frozen plan/spec hashes unchanged.
T3: original five F1 cases now pass. Source sweep at `tts/api.ts:79-83,120-123,131-165` confirms one positive-finite validator and shared start/read decoder, no fallback. Construction expands to 7 malformed forms x POST/GET and valid non-default timing in both actions. Valid/error/idle/abort neighbors remain green. No new timing policy or optional-duration behavior change. F1 required outcome is satisfied; no symptom-keyed bypass found.
T4: repair confined to decoder, construction test and Builder evidence; prior CP1 files preserved. No UI/hook/page/CSS/backend/V3/dependency change. Frozen artifacts and sibling dirty hashes preserved; no Builder commit.

Independent execution by test-runner; source/hash fact gathering by scout; gate interpretation and release by Solaire (pane 3).

### Release

CP 2T-2 is now authorized for pane 4 under the existing frozen Plan §7 CP2 and spec T5–T8. Implement control/hook, scoped CSS, MessageTimeline conditional wiring and construction control tests; stop for independent acceptance. ConversationPage exposure, integration phase, final full pipeline and browser route checks stay CP3. CP2 focused pipeline includes cumulative contract/control probes, affected construction tests, P1C playback regression, typecheck/lint.

No commit/push permission. Frozen Plan/spec and all independent artifacts remain Builder read-only. Accepted CP1 behavior is a preserve recommendation: if later repair needs to change it, report necessity and invalidated evidence before broadening scope. CP2-specific defects may be repaired inside its authorized scope; cannot silently weaken CP1 criteria.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|---|
| R2 | 2T-1 | 8452260 + bf64eab6 + tts/api 1baf346d + client test 94023013 | PASS | Construction 0; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 | F1 closed | recheck R1 | 0 | T3: historical 1, resolved |
## R3 — CP 2T-2 FAIL

Baseline: HEAD 8452260; full tracked app diff e78f7f50f2d5…; CP2 hashes independently matched Builder evidence (`MessageTimeline` da6ad449, hook 697d0b3a, control 8cb994f6, CSS e9dc5e2f, construction test 4d9ee38b). CP1 and six preserved sibling hashes unchanged. Frozen Plan/spec SHA256 remain 1d9536e8… / fe853e88…; Acceptance-owned worktree equals staged artifacts.

- Gates: checked 4 / passed 3 (T5/T6/T7) / failed 1 (T8) / not checked 0 within CP2.
- Findings: new 1, residual 0, repair-regression 0, harness-defect 1 (corrected before verdict), acceptance-miss 0.
- Latest valid tests: independent control 5 executed / 4 passed / 1 failed / 0 errors/skips; construction control + P1C + CP1 independent 59/59 passed. Typecheck after Acceptance harness correction: exit 0; lint: exit 0. Unique valid tests: 64 executed / 63 passed / 1 failed. Full product regression/build/browser deferred by checkpoint rhythm and active blocker.
- Unreviewed CP2 areas: none. T5–T8 source/state/timing/playback/scope sweep complete. CP3-only real route/layout gates remain intentionally not due.
- Consecutive CP2 FAIL count: 1. Repeated invariant: T8 cleanup 1.

### P2T-F2 / P1 / new — detached playing audio is not physically stopped

Authority: spec T8 requires cleanup to release playback; INV-6 requires one effective playback owner. The observable invariant is that audio cannot continue after its control disappears, regardless of manager bookkeeping.

Observed: independent real-component probe clicks through POST playable, observes the native play event and active `暂停朗读` state, clears prior pause calls, then unmounts. Result: `pause.mock.instances=[]`; the owned audio element was never paused. The other four independent CP2 probes pass. Source at `MessageVoiceControl.tsx:113-164` removes listeners and calls `globalAudioPlaybackManager.stop(playbackId)`, but `audioPlaybackManager.ts:35-40` only clears `activeId/activePause` and never invokes the pause callback. React has already cleared `audioRef.current` by passive unmount cleanup, so the subscriber cannot compensate. The detached media element may continue sounding outside manager control.

Root cause (confirmed): cleanup equates ownership-record release with media cessation. The construction cleanup test asserts only manager state, not physical pause, so it blessed the incomplete invariant.

Required outcome: whenever this TTS control owning/playing an audio element unmounts or loses its playable resource/identity, that exact element is physically paused before/while ownership is released. Subsequent players must not coexist with detached sound. Cleanup must remain idempotent when already paused or not owner.

Suggested direction (non-binding): cleanup retains `owned`; explicitly stop that owned element before releasing manager bookkeeping. Keep the fix local to TTS unless evidence proves the shared manager contract itself must change.

Affected paths/chained effects: control media lifecycle, unmount/identity/content-resource replacement, construction cleanup assertion and future CP3 route test. Recheck exact unmount probe first, then two-TTS and attachment mutual exclusion, full CP2 construction/P1C/CP1 probes, typecheck/lint.

Preserve recommendations: T5 lazy/in-flight/timing/abort behavior, T6 five-state/failure/media-policy truth, T7 directed-only class and compact semantics, active-player mutual exclusion, CP1 decoder, P1C implementation and manager API all currently pass. `NotAllowedError` staying playable is accepted as the frozen “recorded/not confused” outcome; no telemetry/logging is required by this checkpoint.

Escalation trigger: if physical stop requires modifying shared manager/P1C files, pause before editing and provide necessity, alternatives, invalidated P1C evidence and expanded recheck scope. Do not make that scope expansion silently.

### P2T-H2 / harness-defect / Acceptance / corrected

Initial independent CP2 run supplied the fetch route handler with the wrong parameter shape and omitted media-mock TypeScript `this` annotations, producing three network-state failures and typecheck errors unrelated to Construction. Acceptance corrected only its staged probe and reran the same Builder baseline. Four probes then passed and the physical-stop probe alone failed. H2 does not count as Builder FAIL and requires no production change.

### Repair release

Authorize F2-only repair within CP2. CP3, commit and push remain held. Builder must not edit Plan/spec/independent probe/report. Return causal invariant, exact changed files, physical-pause and mutual-exclusion evidence, cumulative counts, frozen hashes and any requested scope expansion.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|---|
| R3 | 2T-2 | 8452260 + app diff e78f7f50 + CP2 per-file hashes | FAIL | Construction 1; Acceptance 1 (corrected harness); Harness 1; Spec 0; Environment 0; Unknown 0 | P2T-F2, P2T-H2 | same-baseline harness correction included | 1 | T8 cleanup: 1 |
## R4 — CP 2T-2 PASS (checkpoint only)

Baseline: HEAD 8452260; tracked app diff e78f7f50…; repaired `MessageVoiceControl.tsx` SHA256 5562732e8… and construction control test becd2e04…; hook 697d0b3a…, timeline da6ad449…, CSS e9dc5e2f… unchanged. CP1, P1C, frozen Plan/spec and sibling dirty hashes preserved.

- Gates: checked 4 / passed 4 / failed 0 / not checked 0 (T5–T8).
- Findings: new 0, residual 0, repair-regression 0, harness-defect 1 (Acceptance cleanup order corrected), acceptance-miss 0. F2 closed.
- Tests: valid unique executed 65 / passed 65 / failed 0 / errors 0 / skipped 0: independent CP2 5/5; construction control + P1C + independent CP1 60/60. Typecheck and lint exit 0. Final independent probe rerun emitted no media warnings after Acceptance cleanup-order correction.
- Full product regression/build/browser: deferred to CP3 as frozen; P2T overall is not yet PASS.
- Unreviewed CP2 areas: none. Consecutive CP2 FAIL count resets to 0; historical T8 failure recorded once.

### F2 closure evidence

The original decisive unmount probe now passes: the exact owned, actively playing element receives physical pause. Source at `MessageVoiceControl.tsx:154-170` captures the effect element, removes listeners, calls `owned.pause()`, then releases the exact manager id. Media-error path likewise pauses before release. Construction adds unmount, identity-change and media-error physical-stop probes; two-TTS and TTS/attachment exclusion remain green. Shared manager and P1C files are unchanged. This satisfies the observable cessation invariant without broadening architecture.

T5 click-only lifecycle/finite observation/late-response guard, T6 failure and autoplay-policy truth, T7 visual-only directed state/compact semantic control, and CP1 contract remain green. `NotAllowedError` remaining playable is accepted; it does not claim successful playback and no telemetry requirement is promoted post-freeze.

Acceptance harness note: after the valid repair pass, auto-cleanup occurred after restored media spies and emitted jsdom pause warnings. Acceptance changed only its own probe to call RTL cleanup before restoring mocks; same Builder baseline reran 5/5 with no warnings. This amends harness evidence and does not add a Builder cycle/finding.

### Release

CP 2T-3 is authorized under frozen Plan CP3 and acceptance spec T9–T12: ConversationPage exposure, real-entry route/reconciliation/isolation integration tests, frontend ReactSheet D14 correction, construction evidence, full exo-app regression/typecheck/lint/build and 320/390/1280 real-browser measurement. Stop for final independent acceptance. No backend/V3/dependency/P1C refactor.

No commit/push permission yet. Frozen Plan/spec and Acceptance report/probes/evidence directory remain Acceptance-owned. If browser geometry requires changing a preserve-recommended CP2 surface, pause with measured evidence and proposed recheck scope before editing outside CP3's listed integration/doc surfaces.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|---|
| R4 | 2T-2 | 8452260 + e78f7f50 + control 5562732e + test becd2e04 | PASS | Construction 0; Acceptance 0; Harness 1 corrected; Spec 0; Environment 0; Unknown 0 | F2 closed; harness cleanup amended | recheck R3 | 0 | T8: historical 1, resolved |
## R5 — CP 2T-3 / final P2T FAIL

Baseline: HEAD 8452260; tracked app diff 7623d8c8…; CP3 hashes independently matched Builder evidence (`ConversationPage` fc63638a, construction integration 9c775747, responsive CSS 5dfbe966, ReactSheet a80005fc). Frozen Plan/spec and Acceptance-owned prior artifacts unchanged; CP1/CP2/P1C/sibling hashes preserved.

- Gates: checked 11 / passed 9 / failed 2 (T6 mobile failure truth; T7 real seek) / not checked 1 (T12 final full regression withheld after blockers). T1–T5 and T8–T11 otherwise pass.
- Findings: new 1 (F3), residual 0, repair-regression 1 (F4), harness-defect 1 corrected (H3), acceptance-miss 0. Mechanical/P2 observations: 2.
- Focused tests: 7 files / 118 executed / 118 passed / 0 failed/errors/skips, including two Acceptance real-page integration probes. Typecheck exit 0. Production build exit 0 (4370 modules; only existing chunk/deprecation warnings). Builder-reported pre-probe full suite was 72 files / 857 green, but it predates the new independent files and cannot satisfy final T12.
- Independent browser: 3 widths executed / 0 passed / 3 failed. Geometry/center and 25/50/75% hit targets themselves fit, but all widths fail faithful-contract seek; 320/390 also fail visible retry reason. Final complete run is recorded in `Plan/evidence/p2t-acceptance/p2t-final-browser.json` plus three screenshots.
- Full regression: deferred because P1 blockers leave no final candidate. Build was run because a production bundle was required for browser evidence. Unreviewed in-scope areas: none.
- Consecutive CP3 FAIL count: 1. Repeated invariants: T7 seek 1; T6 mobile truth 1.

### P2T-F3 / P1 / new — seek UI depends on backend Range behavior that the frozen contract excludes

Authority: Plan D8 and acceptance T7 promise pointer and keyboard seeking from the real media element; final acceptance must use the real B5 content contract. Plan §3.1/D8 explicitly records HTTP 200 FileResponse with no Range/206.

Observed: Acceptance served the production bundle and a complete valid 4-second WAV with a faithful content response: HTTP 200, full Content-Length, no `Accept-Ranges` and never 206. Chrome requested `Range: bytes=0-` at 320/390/1280; the server truthfully returned the full 200 response. Before pointer seek at every width: duration 4, `readyState=4`, complete buffered range `[0,4]`, but browser `seekable=[0,0]`. A 50% slider click produced currentTime 0 at 390/1280 and removed the media after an error at 320; never ~2 seconds. Thus the rendered seek control promises an operation the accepted backend cannot provide.

Builder evidence is invalid for this invariant: `D:/tmp/p2t_geometry_probe.mjs:95-108` explicitly fabricated `206`, `Accept-Ranges: bytes` and `Content-Range`, stating Chrome could not seek without them. That probes a different endpoint contract.

Root cause (confirmed structural conflict): frontend implements native currentTime seek while the frozen B5 endpoint is non-range. Fully buffering the response does not make Chrome report a seekable interval under this transport. The Plan simultaneously promised seeking and accepted no Range, an assumption not validated before construction.

Required outcome: pointer and D8 keyboard seek must move the actual message TTS media to the requested bounded position under the production content-delivery contract, without fabricating test-only server capability. Browser evidence must prove an unconfounded before/after position and truthful nonzero duration.

Adjudication required before repair (scope is currently paused):
A. Backend owner adds and freezes authenticated Range/206 support, updates both ReactSheet copies, and B5/P2T rechecks the revised contract. This preserves native media URL playback and is the cleaner transport contract, but crosses repository/gate ownership.
B. Frontend explicitly downloads the complete authenticated audio into a managed Blob/object URL before playback, with abort/revoke/error/memory lifecycle and same-origin identity preserved; then independently proves seek against the unchanged backend. This stays in Desktop but materially expands D10/resource lifecycle and invalidates part of CP2 playback evidence.
C. Remove/disable seeking and re-baseline the product requirement. This is a product downgrade and requires Alicia's explicit approval.

No Builder repair is authorized for F3 until Alicia selects/rejects these routes. Non-binding preference: A is architecturally simpler and avoids duplicate browser memory; B is viable only if backend change is undesirable and must be fully lifecycle-bounded.

Affected paths: backend content view/contract/tests (A), or TTS media acquisition/control/hook/tests (B), plus ReactSheet, browser probe, T7/T10/T11 and full regression. Preserve identity-only POST, click-only playback, no unsolicited autoplay, failure isolation and one playback owner.

### P2T-F4 / P1 / repair-regression — narrow-screen fitting hides the retry reason

Authority: D3 requires the retry control plus bounded whitelist copy; T6 requires truthful five-state UI. A touch-width user must be able to see the failure truth, not rely on hover-only title or inspect the DOM.

Observed: CP3 `tts.css` responsive rule applies `font-size:0` to every `.app-voice-btn` at ≤420px. At 390px the failure button still contains “语音服务未就绪” but computed font size is 0; only the refresh icon is visible. At 320 the same state is icon-only in screenshot. `title` is not a reliable touch affordance, and the unchanged ARIA label says only “重试生成语音”, not the reason. At 1280 the copy is visibly rendered at 11px. This regression was introduced by the CP3 geometry repair after CP2 had passed.

Required outcome: at 320/390, retryable failure retains visible bounded reason text while the header/control remains non-overflowing and hit-test reachable. Do not expose backend free-form message. Preserve directed visual-only semantics and compact idle/generating/playable controls.

Suggested direction (non-binding): distinguish the failure control with a state modifier rather than zeroing typography for every button; use a compact visible reason arrangement whose measured geometry fits. Recheck runtime_offline plus artifact/network/error variants, 320/390/1280 geometry and screen-reader names.

### P2T-H3 / harness-defect / Acceptance / corrected

The Acceptance browser harness initially threw after seek because it assumed the audio/slider remained present; subsequent attempts also assumed retry/scroller nodes remained present after the failure transition. Acceptance changed only its own staged probe to record null/error outcomes instead of throwing. The final same-Builder-baseline run completed all widths and captured readiness, buffered/seekable, requests, screenshots and violations. These harness corrections do not count as Builder failures or repair targets.

### P2T-P3 / P2 / scope deviation — accepted CSS surface changed without required pause

R4 explicitly required a pause with measurements before changing preserve-recommended CP2 surfaces for geometry. Builder instead changed `tts.css` and disclosed the before/after measurements only at delivery. Evidence establishes a real 320px overflow and the need for a geometry adjustment, so Acceptance now approves the scope expansion for rework/recheck rather than demanding revert; however F4 shows why the pause mattered. Do not repeat this pattern.

### P2T-P4 / P2 / adjacent usability debt

Independent Chrome records 20×16px voice buttons at 320/390 and two-line wrapping of the existing branch label; controls remain hit-test reachable, so frozen T11 is satisfied and these do not independently block this checkpoint. Repair should avoid worsening them. Any product-wide touch-target policy belongs to shell/accessibility scope, not a hidden P2T gate.

### Preserve recommendations and next control action

Preserve: T1–T5 and T8–T11 behaviors proven so far; real-page route departure physically pauses A and exposes only B; offline TTS remains row-local with raw backend prose absent and composer usable; non-destructive reconciliation construction path remains green; no query/attachment/runtime ownership leakage; geometry overflow/hit checks pass; D14 frontend correction is present.

Construction is PAUSED pending Alicia's F3 architecture/product decision. This is not a request for pane 4 to improvise. After decision, Acceptance will record the authorized scope and exact recheck boundary; F4 may then be repaired in the same controlled cycle. CP3, commit, push and P2C remain held. Frozen Plan/spec and independent tests/report/evidence are Builder read-only.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|---|
| R5 | 2T-3/final | 8452260 + app diff 7623d8c8 + CP3 hashes | FAIL | Construction 1 (F4/process); Acceptance 1 (H3); Harness 1; Spec 1 (F3 conflict); Environment 0; Unknown 0 | F3, F4, H3, P3, P4 | none | 1 | T7 seek:1; T6 mobile truth:1 |
## R6 — Route A backend Range repair, first acceptance FAIL

Authorization/rebaseline: Alicia explicitly selected Route A after R5. Acceptance released pane 6 to modify only the backend Message TTS content endpoint, backend tests, and backend ReactSheet; frontend stays paused until backend PASS. This supersedes R5's “pending adjudication” hold but does not supersede F3's required outcome. Existing access posture is preserved; “authenticated” in the option text does not introduce a new DRF permission model.

Backend baseline: ExoCore HEAD 6fd26b4a; pre/post real-DB guard both `OK: AgentPreset baseline 8 rows`; no DB writes, paid synthesis, daemon, frontend, model, migration, URL, nginx, commit or push. In-scope source hashes match handoff. Existing B5 independent artifacts are byte-identical.

- Backend gates checked 8 / passed 5 / failed 2 / coordination-pending 1: ordinary 200 PASS; normal single-range 206 PASS; ordinary 416 PARTIAL/FAIL on unbounded numeric input; malformed/multi fallback PASS; gate ordering PASS; bounded streaming PARTIAL/FAIL on pre-first-read close; targeted regression PASS; cross-repo contract sync PENDING frontend owner.
- Independent mechanical tests: new Range module 12/12 PASS; existing B5 group 25/25 PASS; `manage.py check` PASS. Temporary resource-close probe 2 executed / 1 passed / 1 failed. Full `agents.tests` not independently rerun after blockers; Builder's 1541 run is informative only.
- Findings: new 2 (BR1, BR2), residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0. Documentation/process observations: 3.
- Consecutive Route-A FAIL count: 1. Repeated invariants: bounded parser 1; deterministic close 1.

### P2T-BR1 / P1 — unbounded decimal conversion turns a legal Range into HTTP 500

Evidence: `../ExoCore/agents/views.py:2023-2040` accepts unbounded `\d+` then calls `int()` without a guard. The deployed Python has the default 4300-digit conversion limit; a header such as `bytes=` + 5000 ASCII digits + `-` raises `ValueError` before the view can return 416. This length fits common forwarded header limits and is client-controlled. The new 12-test module has no oversized-numeric case.

Required outcome: parsing must stay total for arbitrary accepted header text. Normalize leading zeros and compare decimal strings or otherwise bound conversion without changing normal semantics: huge start-only is unsatisfiable 416; huge end with a satisfiable start clamps to size-1; huge suffix returns the whole resource; `last < first` remains malformed/full 200; no traceback/500. Add helper and full-route cases beyond Python's digit limit, including leading-zero forms.

### P2T-BR2 / P1 — response.close before first iteration does not explicitly close the range handle

Evidence: `_iter_bounded_file` closes in generator `finally` (`../ExoCore/agents/views.py:2046-2061`). Django registers `generator.close` as the StreamingHttpResponse closer. Closing an unstarted generator discards its frame without entering `finally`; an independent production-helper probe observed `response.closed=True` but the opened handle remained `closed=False` when retained for inspection. Existing test starts the generator before closing, so it misses this window.

Required outcome: the 206 body owner must have an idempotent `close()` that closes the file even before the first `next()`, as well as after drain, started interruption and read exception. Prefer a small explicit bounded iterator/resource owner rather than private Django internals or GC/refcount reliance. Add a real response-close-before-first-read test and preserve bounded read sizes/exact slices.

### Documentation/process corrections

- Backend ReactSheet §12.3 currently claims every conversation/message 404 includes `code: audio_artifact_missing`; the unchanged missing-message branch returns only `error: not_found`. Narrow the wording to distinguish identity absence from artifact invalidity. This is a doc correction, not a permission/API expansion.
- Desktop ReactSheet and the old no-Range statements in the P2T Plan remain stale. Backend PASS may precede their edit, but frontend final PASS may not; pane 4 will receive that synchronization only after backend acceptance.
- `../ExoCore/Plan/B5_F3_Range_Repair_Plan.md` was created and staged although the repair packet explicitly said no Detailed Plan was required. The user authorization and this acceptance ledger are canonical; remove the redundant one-off Plan before re-delivery unless an existing backend rule independently requires it.

### P2 / preserve and deferred risks

Preserve all passing ordinary 200, `bytes=0-`, start/end/open/suffix, clamping, 416 bounded JSON, malformed/multi fallback, gate-before-Range, exact headers/slices and no-whole-file-read behavior. The stat/open size race is a theoretical P2 under the current immutable-ready artifact lifecycle; do not broaden this repair unless a focused test proves a reachable mismatch. HEAD, multipart, If-Range and new authentication remain out of scope.

Repair release: only BR1, BR2, their tests, the backend ReactSheet wording correction, and redundant Plan cleanup. No pane 4/frontend release, commit or push. After focused re-delivery, Acceptance rechecks parser taxonomy, response closure, all 37 prior tests, system check and DB baseline before running a real backend+Chrome seek gate.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|
| R6 | Route A backend R0 | ExoCore 6fd26b4a + views c328e37b | FAIL | Construction 2; Spec/docs 2; Environment 0; Harness 0 | BR1, BR2 + doc/process corrections | 1 | parser:1; close:1 |
## R7 — Route A backend focused recheck PASS

Baseline: ExoCore HEAD 6fd26b4a; views 28e0ad5b, backend ReactSheet afcb551a, construction Range tests db2b933d (20 tests). Pre/post real-DB guard both pass at exactly AgentPreset ids 1–8. Redundant repair Plan is removed; no unrelated backend surface changed.

- BR1 PASS: independent 29-check temporary probe proves >5000-digit start/end/suffix, huge `last < first`, padded normal ranges and zero suffix remain total with exact 416/206/200 taxonomy; no unbounded `int()` path.
- BR2 PASS: explicit `_BoundedRangeReader` is registered as Django's response closer at construction and independently closes before first iteration, after started interruption and on read exception; repeat close is safe. No generator-GC reliance remains.
- Backend tests: 45 executed / 45 passed / 0 failed/errors/skips (20 Range + prior B5 25). `manage.py check` clean.
- Real browser gate: temporary Django `LiveServerTestCase` used only the Django test database and real `MessageTTSContentView`; raw CDP Chrome 152 requested `Range: bytes=0-`. Network response was 206 with `Accept-Ranges: bytes`, `Content-Range: bytes 0-192043/192044`, exact Content-Length, no disk cache/service worker/other TTS request. Media reached readyState 4, duration 6, `seekable=[[0,6]]`; setting 50% moved from ~0.045s to 3.0s and advanced without media error. One test executed / passed. No mock/proxy/handcrafted content response was used.
- Harness note: first temporary LiveServer run had a cleanup-only `proc.stderr is None` bug after the browser assertions; the TEMP harness was corrected and the same candidate reran green. It is not a backend finding.
- Gates: backend Route A 8 checked / 8 passed. Findings new 0, residual 0, repair-regression 0, harness-defect 1 corrected, acceptance-miss 0. Full `agents.tests` rerun is not required for this focused repair: Builder's package baseline showed unchanged historical failures, while Acceptance reran every changed/new test and all B5 contract/acceptance modules.

Nonblocking observations: parser regex accepts Unicode `\d` although real HTTP header decoding does not expose those code points as decimal digits; strict `[0-9]` may be adopted in later hardening. Sync streaming is bounded under the current WSGI deployment; a future ASGI deployment would need review because Django adapts sync iterators by materializing them. Existing stat/open race, HEAD, multipart and If-Range remain explicitly out of scope.

Verdict: backend Route A PASS. Preserve the exact 200/206/416 taxonomy, headers, access/artifact gate ordering and explicit resource owner. Backend commit/push remains held until the product-level P2T final checkpoint.

Frontend release condition now satisfied: pane 4 may repair only F4, synchronize Desktop ReactSheet §12.3 with the accepted backend contract (including identity-404 vs artifact-404 distinction), update construction evidence/tests, and rerun its focused/full/build/browser checks. The frozen P2T Plan's old no-Range statements are superseded by Alicia's Route A decision plus R6/R7; do not rewrite the frozen Plan. Acceptance-owned report/tests/browser probe/evidence remain read-only.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|
| R7 | Route A backend R1 | ExoCore 6fd26b4a + views 28e0ad5b | PASS | Construction 0; Acceptance 0; Harness 1 corrected | none blocking | 0 | parser closed; close closed |
## R8 — CP3 focused frontend recheck FAIL (documentation only)

Baseline: Desktop HEAD 8452260; production hashes match handoff (`MessageVoiceControl` 4b29a36e, `tts.css` b0e07dfd, control test 3efb6c59, ReactSheet 1fbe531a); tracked app diff remains 7623d8c8. Backend Route A R7 artifacts remain unchanged.

- Runtime gates T1–T11: PASS. F3 real seek PASS and F4 narrow-screen visible truth PASS.
- Focused tests: 7 files / 119 executed / 119 passed / 0 failed/errors/skips. Typecheck and full package lint pass after Acceptance corrected its own script globals/comments.
- Independent Chrome production-bundle gate after PWA warm-up: 320/390/1280 all PASS with zero violations. Each real media request uses `Range: bytes=0-` and receives faithful 206 + `Content-Range: bytes 0-64043/64044`; seekable is `[0,4]`, 50% pointer seek lands ~1.93–2.0s. Retry copy is visibly rendered at 10px on 320/390 and 11px on 1280; 320 copy occupies a non-clipped 51×26.5 box. Document/scroller/headers/controls fit and all sampled hit points resolve to the intended control.
- Harness defect corrected: the first independent 320 run was interrupted by first-install service-worker `controllerchange` reload. Acceptance added the same controlled-PWA warm-up used by the accepted P2B browser probe; same Builder candidate then passed all three widths. This is H4, not a Construction FAIL.
- Finding: one documentation contract mismatch (F5). Full T12 suite/build is held until the final document candidate. Consecutive CP3 FAIL count: 2; repeated invariant count: contract sync 1.

### P2T-F5 / P1 documentation gate — Desktop §12.3 is not yet an exact accepted-contract mirror

`ReactSheet.md:1174` states 416 only as `Content-Range` and no bytes, omitting the actual bounded JSON `error: range_not_satisfiable` and the required `Accept-Ranges: bytes`. `ReactSheet.md:1175` says “response headers” contain both Content-Disposition and Cache-Control without status scoping; actual accepted backend semantics are: all 200/206/416 advertise Accept-Ranges and no-cache, but Content-Disposition exists only on 200/206. The 416 path does not open a delivery handle, though the earlier validity gate necessarily reads/validates the WAV; wording should not imply otherwise.

Required exact edit only: document bounded 416 JSON; scope Accept-Ranges and Cache-Control to 200/206/416; scope Content-Disposition to 200/206; say 416 does not open the delivery stream/return audio bytes. Preserve all other §12.3 text, D14, B5 dirty lines and every production/test file.

Repair release: pane 4 may edit only `ReactSheet.md` §12.3 and append construction evidence. No code/test/CSS/Plan/frozen/Acceptance/backend/commit/push changes. After hash/diff recheck, Acceptance runs final full test suite, typecheck, lint and build; browser evidence from this unchanged production candidate remains valid unless code/assets change.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Consecutive CP3 FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|
| R8 | CP3 R1 | Desktop 8452260 + app 7623d8c8 | FAIL (docs only) | Construction 1; Acceptance 0; Harness 1 corrected | F5, H4 | 2 | contract sync:1 |
## R9 — CP3 final focused recheck PASS / P2T PASS

Baseline: Desktop HEAD 8452260; app diff fingerprint 7623d8c8; backend HEAD 6fd26b4a with accepted Route-A worktree hashes. F5 reverse reconstruction exactly reproduces pre-repair ReactSheet hash 1fbe531a, proving only the authorized two-to-three-line §12.3 edit; Construction Evidence §26 is the only accompanying change. Production/test/frozen/sibling hashes remain accepted and unchanged.

- Gates T1–T12: checked 12 / passed 12 / failed 0 / not checked 0.
- Findings: new 0, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0. Consecutive CP3 FAIL count resets to 0; no repeated invariant remains open.
- Final full frontend tests: 73 files / 860 executed / 860 passed / 0 failed/errors/skips.
- Typecheck: PASS. Lint: PASS. Production build: PASS (4370 app modules; 59 service-worker modules; only existing chunk-size and PWA deprecation warnings).
- Independent production-bundle Chrome: 320/390/1280 all PASS, zero overflow/hit/visibility/seek violations; evidence hashes are bound in the staged JSON/screenshots from the PWA-controlled rerun.
- Backend Route A: 45/45 tests, 29/29 boundary/resource checks, system check, and real Django LiveServer + Chrome Range seek PASS. Real AgentPreset baseline remains exactly ids 1–8.
- Scope review: complete. No unreviewed in-scope area. No backend/frontend cross-owner leakage, P1C edits, shared-shell CSS edits, dependency changes, hidden skips, raw backend message rendering, extra query family, unsolicited generation/autoplay, or unrelated staged sibling changes.

Preserve: identity-only click generation; fail-closed projection/contract decoder; five-state row-local lifecycle; truthful retry copy; directed visual-only modifier; one global audio owner and physical pause on detach; canonical reconciliation continuity; route-late-response isolation; compact responsive controls; real media timing/seek through accepted 206; exact 200/206/416 contract and gate ordering.

Verdict: **P2T PASS**. The backend B5/Route-A addition and Desktop P2T addition are independently releasable as separate repository commits. Push remains prohibited. Alicia's earlier commit authorization may now be applied to the final accepted scope only; unrelated dirty/staged files remain excluded.

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|
| R9 | CP3 R2 / final P2T | Desktop 8452260 + app 7623d8c8; Backend 6fd26b4a + Route A | PASS | none | none | 0 | none |