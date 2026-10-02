# LR-01 V4 Chat Foreground Resume — Independent Acceptance Report

## R1 | Automated implementation checkpoint PASS | Final device release HOLD

- Baseline: Desktop `0b0d4ed5a9e5e088782aa3bc062a4ab8e26e59b0`; original `3b02e50`; frozen preparation `6f16010`.
- Owner: Solaire Acceptance / pane5; Construction: Solaire Builder / pane7.
- Frozen spec SHA-256: `26fd8936d8510e8a40a72baa8c32f00b1f464d862cbcbfd54b5e419b2a3ba1e5`, unchanged.
- No implementation P0/P1 findings. Physical-device requirement not yet verified; final LR-01/C2/P3 release not granted. If evaluated as complete end-to-end acceptance, result is FAIL solely for the unverified required device gate, not a demonstrated software failure.

### Independent logical review

Scout inspected complete production diff and all eight frozen gates. Only useChatRuntime changed; foreground event listeners reuse existing eligible resumePolling and terminal reconciliation. Synchronous operation-state updates prevent multiple poll chains. Retained token/cursor, route/current-operation checks and listener cleanup preserve isolation. A foreground event preceding old GET rejection is consumed once by its generation; replacement failure without a new event stays honestly blocked. Hidden/idle/nonrecoverable states do not blindly restart; no user rePOST or notification/backend change.

Existing HTTP-only real ConversationPage test coverage is credible and reused. Advisory limitations (mock does not consume abort signal, exact handler identity not directly asserted) were not promoted into new MUST gates; late response and cleanup behavioral assertions cover required observable behavior. No independent duplicate tests authored.

### Independently executed mechanical evidence

Node25.7.0/pnpm11.5.1; documented NODE_OPTIONS=--no-experimental-webstorage for existing Node WebStorage compatibility, not test exclusion.

- `pnpm --filter exo-app test:run src/test/chat_foreground_resume.test.tsx`: 12/12 PASS.
- Adjacent lifecycle/R4-R6/P2D arrival/reconciliation/closure eight files: 101/101 PASS.
- `pnpm --filter exo-app test:run`: 103 files, 1345/1345 PASS; zero failures/skips/exclusions.
- typecheck, lint, build: all exit0; existing media jsdom/chunk/deprecation warnings recorded, no new error.
- HEAD/worktree/staged clean and unchanged; frozen hash unchanged. Logs `/tmp/lr01-independent/`.

No real chat sends, new conversations/presets, backend/DB/Runtime probes, paid requests or service restarts were executed in this acceptance run.

### Required device observation before C2 release

Confirm the device is using the rebuilt version (reload once before reproducing; do not clear site data or force-stop Chrome). In existing V4 chat: send one normal message, lock while waiting, allow reply completion, unlock and return to the same chat without pressing Continue Polling.

Expected: full reply appears automatically exactly once; interrupted banner, stale analysis spinner and busy/Stop state clear. Foreground arrival notification behavior remains normal. If not, record displayed state/time and continue diagnosis; do not count manual recovery as automatic success.

This observation remains Alicia-owned and pending. No success release log/archive or C2/P3 release is authorized by automated PASS alone.