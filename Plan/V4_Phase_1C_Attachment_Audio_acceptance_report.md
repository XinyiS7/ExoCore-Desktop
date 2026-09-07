# V4 Phase 1C Attachment & Audio — Independent Acceptance Contract and Report

> **Owner:** `[gpt-5.6-sol / Solaire]` — independent acceptance
> **Checkpoint:** C1C
> **Mode:** prepare
> **Status:** **FROZEN PRE-CONSTRUCTION — NO VERDICT; construction locked pending Alicia's Builder assignment**
> **Frozen authority:** `Plan/V4_Phase_1C_Detailed_Plan.md`
> **Plan SHA-256:** `acada1930deb19d398f99cd3f6a33c6e6a411679cd9a10aee2fcba19e1a90b65`
> **Source scout SHA-256:** `4332c843d8d3af2bd8ebfdf3db9759c78d13aa5cfb18f1d01e9f9b121641f8f5`
> **Acceptance ownership:** Construction may read but must not modify this report or future `packages/app/src/test/acceptance/p1c_*` files.

---

## 1. Purpose and freeze rule

This file converts the reviewed P1C Plan into an independent, binary acceptance contract for the two frozen capabilities:

1. `attachments`;
2. `audio_record_play`.

It contains verification targets and decisive observations, not raw test implementation. Acceptance will add isolated probes only after Construction handoff; Construction must not receive or edit their implementation.

This contract and the Plan hash above are frozen before construction. If either must change, Acceptance must review the delta and Alicia must explicitly re-baseline the checkpoint. Construction changes to this report, its future independent probes, or the frozen Plan are an immediate ownership FAIL.

No verify/recheck cycle has occurred. Consecutive FAIL count is therefore zero.

---

## 2. Authority, baseline and boundaries

### 2.1 Authority order

1. Alicia's explicit scope and approvals;
2. frozen `Plan/V4_Phase_1C_Detailed_Plan.md`;
3. `Plan/V4_Spec_Freeze_Index.md` and V4 roadmap/ownership rows for P1C;
4. current read-only backend contract and `ReactSheet.md`;
5. current V4/V3 source as implementation/parity evidence.

Source-backed review corrections are attributed to `[model not provided / Astra]`; the source scout is attributed to `[gemini / Alaric]`.

### 2.2 Prepared baseline

- Desktop accepted C1B HEAD: `12e16f647a7b42760a947641b5dab56af5c1d2fc`.
- Planning-time backend HEAD: `c286a84eaad1f58180498acb7e0ce695fc5b1ef9`.
- Planning-time outer HEAD: `cf64f42649eda9c7ed4eedc373bde6de5f98d561`.
- Canonical API snapshot SHA-256: `fab3e8200837447bec3f11add903cc6f384801df85033ee112229649007e99bb`.
- Desktop `ReactSheet.md` SHA-256: `a424ba47530b450895ca13a565d09082abdff3858050fbd57e4fede310256791`.
- Prepared real AgentPreset baseline: exactly IDs 1–8.
- Known unrelated work at preparation: backend staged `Plan/gemini_empty_response_retry_downgrade_plan.md`; outer modified `ExoCoreData/AgentMemory/Agent_6/Workspace/skills/moonlight_garden/SKILL.md`; Desktop Plan/scout files untracked.

At verify intake, Acceptance records fresh HEADs, status manifests, changed-file list, staged/unstaged diff fingerprints and frozen artifact hashes. Preparation hashes do not substitute for intake evidence.

### 2.3 Hard boundaries

C1C must not introduce:

- P1D model/endpoint/thinking/cache/project-file controls;
- P2/P4 Collection, transcript, STT or durable asset management;
- backend, outer, nginx, launcher, PWA or V3 production changes;
- resumable/chunked upload, byte progress, client transcoding or waveform analysis;
- non-audio download promises without a verified same-origin URL;
- new dependency or alternate global attachment/runtime state system.

A required backend or cross-repository production change pauses C1C for Alicia adjudication; it is not silently absorbed.

---

## 3. Acceptance method and evidence hierarchy

Evidence order is:

```text
frozen contract
  > independent observable runtime behavior
  > verified production source path
  > Construction tests
  > Construction evidence/claims
```

Acceptance will:

1. pin candidate and ownership boundaries;
2. sweep every gate below against source and runtime behavior;
3. create isolated probes under `packages/app/src/test/acceptance/` without editing production or Construction tests;
4. validate each probe can fail for the intended invariant rather than a fixture accident;
5. run focused evidence first;
6. run the full required regression only when no known P0/P1 remains;
7. append one immutable ledger row per distinct candidate receiving a verdict.

Mocks isolate network timing, provider APIs, MediaRecorder, object URLs and audio playback where deterministic state/race evidence is required. Mocked behavior cannot replace the bounded live-browser gate. No external/provider call occurs without Alicia's normal authorization.

Any unmet MUST criterion below makes C1C FAIL. A skipped/xfail/swallowed assertion cannot produce PASS.

---

## 4. Frozen gate matrix

### Gate A — Intake integrity, ownership and scope

**Given** a Builder handoff for C1C,
**when** Acceptance pins the candidate,
**then all of the following MUST hold:**

1. Desktop starts from accepted C1B or an explicitly approved successor.
2. Construction changed only authorized Desktop P1C source, styles, Construction tests and Builder evidence.
3. The frozen Plan, this report and Acceptance-owned probes are unchanged by Construction.
4. No backend/outer/V3/deployment/new-dependency/P1D/P2/P4 delta is absorbed.
5. Current attachment routes, target catalog and message metadata still match the frozen contract, or an explicit pre-construction re-baseline exists.
6. Opening real AgentPreset baseline is exactly IDs 1–8.

**Decisive failure:** any unauthorized file, frozen-artifact hash change, unexplained baseline drift or scope feature.

### Gate B — Authoritative upload/result contract

**Given** one or multiple selected files,
**when** upload returns 201 all-success, 201 partial success, 422 all-failure, malformed ownership, or transport failure,
**then:**

1. multipart uses the exact Conversation route, `files`, credentials and CSRF behavior;
2. each original input owns exactly one visible state by validated `results.input_index`;
3. `results` alone determines success and positive attachment IDs;
4. compatibility `attachments`/`failures` may enrich matching diagnostics but never manufacture/override success;
5. `ok_degraded` remains sendable with visible warning;
6. failed/missing/duplicate/malformed results remain unsendable and explicit;
7. only validated positive successful IDs can enter `pending_attachments`.

**Decisive failure:** an ID recovered from compatibility fallback, filename/position guessing after mutation, hidden partial failure, or failed ID entering chat.

### Gate C — Compose ownership, cleanup and route isolation

**Given** selected/uploading/successful/failed compose entries in Conversation A,
**when** an entry is removed, upload resolves late, route changes to Conversation B, or the component unmounts,
**then:**

1. pending upload blocks turn submission;
2. removed entries cannot be resurrected by late callbacks;
3. A's response/IDs/recording cannot mutate or send from B;
4. route departure aborts/invalidates local pending work without inventing a backend delete;
5. every local preview object URL is eventually revoked exactly by its owning lifecycle;
6. ordinary accepted send consumes only successful IDs; edit/regenerate do not consume new compose IDs.

**Decisive failure:** cross-Conversation state, duplicate dispatch, stale callback resurrection or leaked sendable ID.

### Gate D — Chat runtime integration and edit boundary

**Given** text-only, text-plus-attachments, attachment-only, audio-only, edit and regenerate actions across SSE and async modes,
**when** the runtime builds and dispatches the turn,
**then:**

1. text-only behavior remains C1B-compatible and need not emit `pending_attachments`;
2. attachment-bearing ordinary turns emit exactly the validated complete ID set;
3. empty content is allowed only with at least one valid ID;
4. click/Enter/audio-send/retry cannot create duplicate chat POSTs;
5. original historical attachments remain on edit/regenerate;
6. newly selected compose attachments are neither sent nor consumed by edit/regenerate and remain for the next ordinary send;
7. C1B durable operation, stop, reconciliation, branch, scroll and route locks remain authoritative;
8. optimistic UI never fabricates persisted message/attachment identity.

**Decisive failure:** request-only evidence claiming edited-message attachment persistence, accidental compose consumption, invalid blank send, or weakened C1B uncertainty lock.

### Gate E — Audio target gate and recorder lifecycle

**Given** supported and unsupported browser/target states,
**when** record, stop, cancel, 60-second cap, error, route change and send are exercised,
**then:**

1. secure context, media APIs and MIME support are checked before recording;
2. MIME priority is `audio/webm;codecs=opus`, then `audio/webm`;
3. current model/endpoint is resolved automatically from live catalog/current preset without a P1D selector;
4. target must advertise audio ability and `file_uri` transport;
5. unsupported/unresolved target blocks only recording/audio upload and emits zero such requests;
6. permission/no-device/zero-byte/recorder/size errors are explicit and stable;
7. 10 MiB is rejected before network dispatch;
8. cancel/error/unmount/route switch releases tracks, revokes URLs and ignores delayed recorder callbacks;
9. valid audio upload includes exact non-empty `model` and integer `endpoint`.

**Decisive failure:** microphone leak, late clip resurrection, audio upload without target fields, or unsupported target blocking ordinary text/file use.

### Gate F — Complete and non-destructive audio recovery

**Given** a mixed turn containing original text, ordinary attachment IDs and audio IDs,
**when** chat ends in done, error, stopped, interrupted EOF, safe rejection, unknown write or reconciliation failure,
**then:**

1. recovery was snapshotted before dispatch with Conversation ID, attempt key, original text, complete ordered IDs and audio subset;
2. only explicit clean `done` clears it automatically;
3. all other terminal/uncertain cases retain the snapshot but do not automatically enable Retry;
4. canonical reconciliation classifies exact persistence, proven absence or unknown without text/latest/timestamp guessing;
5. proven-absent retry sends the complete original turn as an ordinary send;
6. exact-persisted retry is enabled only when the bound user Message contains the attempt IDs and no later user-authored turn exists on the active branch;
7. exact-persisted retry uses that `edit_message_id` and complete snapshot so the failed turn is replaced, not duplicated;
8. unknown/ambiguous persistence or any later user turn disables one-click Retry with an explicit-edit explanation;
9. every allowed retry makes zero additional audio upload requests;
10. route change or deletion of a required ID makes the old recovery unsendable.

**Decisive failure:** partial snapshot retry, guessed Message binding, destructive retry across later dialogue, duplicate audio upload, or retry while C1B remains uncertain.

### Gate G — Historical rendering, lightbox and playback

**Given** canonical `attachments_meta` containing image, audio and other-file rows,
**when** history renders and media controls are used,
**then:**

1. no P1C placeholder or empty-message marker replaces a pure attachment/audio message;
2. image uses validated `file_uri`, has filename fallback, and opens an accessible lightbox;
3. audio uses same-origin `content_url`, never remote `file_uri`;
4. audio 404/load/play failure remains visible;
5. starting one audio pauses the prior owner; pause/end/error/unmount releases ownership;
6. seek works by pointer and keyboard with an accessible label/control;
7. other-file card exposes safe name/type/size only, never `storage_path`, and does not promise unsupported download.

**Decisive failure:** server-path leak, remote audio URL use, simultaneous playback or inaccessible/unrecoverable media UI.

### Gate H — Bidirectional delete exclusion and convergence

**Given** a user-uploaded attachment that may also be referenced by compose, history or audio recovery,
**when** delete is attempted during runtime activity, followed immediately by Send/Retry, or resolves as 204/409/error,
**then:**

1. active/uncertain send or pending target upload prevents delete;
2. once delete starts, ordinary Send and recovery Retry remain disabled until the delete request settles;
3. the request uses the exact trailing `/delete/` route and one `{source,id}` body;
4. on 204, local compose/recovery references are removed immediately before history/list refresh begins;
5. if post-204 history/list refresh fails, the deleted ID stays absent and unsendable while the refresh error remains visible/retryable;
6. canonical history/list refetch eventually reflects backend detachment;
7. if deletion breaks a recovery snapshot, that retry is retired explicitly rather than sent partially;
8. on 409 `frozen_in_cache:true`, no list/history/compose/recovery state changes and friendly cache guidance is shown;
9. 400/404/network delete failure likewise preserves those states and remains visible.

**Required race probes:**

- initiate delete and immediately attempt ordinary Send and audio Retry: zero chat POST until delete settles;
- return delete 204, then fail both refresh paths: deleted ID is already absent from compose/recovery and cannot be dispatched.

**Decisive failure:** either direction of the race is open, local purge waits for successful refetch, or 409 mutates canonical/client references.

### Gate I — Responsive and accessible operation

**Given** widths 320, 390, 767 and 768+,
**when** compose items, recorder, recovery, manager, lightbox and player are used by keyboard and touch,
**then:**

1. no horizontal overflow hides an in-scope control;
2. removal and delete do not require hover;
3. state is not communicated by color alone;
4. all interactive controls have stable accessible names;
5. lightbox has focus entry/containment/restoration, Escape and safe backdrop behavior;
6. seek is keyboard operable;
7. timeline remains the only scroll owner and C1B near-bottom/scrolled-reader behavior does not regress.

**Decisive failure:** unreachable action, focus escape/loss, unlabeled control or timeline scroll ownership regression.

### Gate J — Regression, live corroboration and data discipline

**Given** all focused gates have no open P0/P1,
**when** final verification runs,
**then:**

1. app typecheck, lint, tests and build pass;
2. all four workspaces build and V3 chat-core tests do not regress;
3. accepted known-dirty V3 lint fingerprint does not worsen;
4. shared runtime changes, if any, receive focused regressions for every importing workspace found by search;
5. `git diff --check` and staged equivalent pass;
6. a production-built real browser completes the frozen bounded mixed image/document/audio path and same-origin playback;
7. at most one provider generation is used, only with Alicia authorization; without authorization C1C cannot PASS unless Alicia explicitly re-baselines that omission;
8. live 409/interruption/unsupported cases remain deterministic probes rather than manufactured production state;
9. temporary Conversation/messages/attachments are removed through ORM, archived preset fields are restored/hidden, and closing AgentPreset baseline is exactly IDs 1–8.

Blanket Django migration/unspecified backend suites are not gates for this frontend-only checkpoint. A focused backend test is run only to resolve a named contract doubt.

**Decisive failure:** any required regression, browser path, cleanup or real-data baseline failure.

---

## 5. Harness validity and anti-gaming checks

Before using an independent probe as evidence, Acceptance MUST confirm:

1. it exercises the production entry path, not a test-only helper substitute;
2. request observations include route, method, body/FormData, Conversation identity and ordering where relevant;
3. delayed promises are controlled so the race would fail if guards were absent;
4. the delete-refresh-failure probe distinguishes immediate local purge from successful refetch;
5. recovery probes distinguish complete snapshot replay from audio-ID-only replay;
6. later-turn probes prove that one-click retry is disabled rather than merely hidden while still dispatchable;
7. playback probes observe actual pause/ownership behavior, not only icon state;
8. object-URL/track cleanup probes cannot pass through global reset alone;
9. no production branch detects Vitest/jsdom/mock/sample data;
10. assertions target observable invariants, not preferred helper/class/file shape.

Harness defects are corrected and recorded without counting as Builder failures. A malformed probe cannot support PASS or FAIL.

---

## 6. Required verification pipeline

### 6.1 Focused-first

1. ownership/hash/status pin;
2. focused source sweep for upload, runtime, recorder, recovery, delete and rendering boundaries;
3. isolated Acceptance probes by Gates B–I;
4. focused Construction tests and app static checks;
5. real browser geometry/media/upload checks once deterministic blockers are absent.

If a P0/P1 already blocks the candidate, unrelated full regression is deferred and reported. It does not create a partial PASS.

### 6.2 Final regression for PASS

```bash
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run
pnpm --filter exo-app build
pnpm --filter exo-chat-core test:run
pnpm build
pnpm --filter exo-chat-core lint
pnpm --filter exo-chronicle lint
pnpm --filter exo-council lint
git diff --check
git diff --cached --check
```

The Node flag is used only if the known Node 25/jsdom web-storage collision still reproduces and is documented as environment handling. Numeric unique test totals, failures, errors and skips are recorded.

Real database discipline:

```bash
cd ../ExoCore
bash .agent/check_real_db_baseline.sh
```

Opening and closing checks are mandatory around any live probe. Acceptance does not create/delete AgentPreset or alter primary keys.

---

## 7. Accepted limitations and explicit non-tests

The following do not block C1C because they are outside the frozen capability:

- no model/endpoint selector or cache/project-file workflow;
- no non-audio same-origin download guarantee;
- no resumable/chunked upload or byte progress;
- no transcript/STT/transcoding/real waveform analysis;
- no bulk delete or filesystem-delete promise;
- no live manufacture of frozen-cache 409, network interruption, stop races or unsupported browser state;
- no cross-tab/offline upload recovery;
- no attempt to add new attachments during historical edit/regenerate.

These limitations cannot be used to waive an in-scope gate.

---

## 8. Verdict/report template

At each distinct verify/recheck baseline, Acceptance appends a ledger row and factual summary.

### 8.1 Review-cycle ledger

| Cycle | Checkpoint | Baseline/fingerprint | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| — | C1C prepare | no Builder candidate | no verdict | — | — | — | 0 | none |

### 8.2 Factual summary

```text
Verdict: PASS | FAIL
Phase/checkpoint: V4 P1C / C1C
Consecutive FAIL count: <n>
Repeated invariant IDs: <IDs/counts or none>
Baseline: <HEAD + diff fingerprint + frozen hashes>
Gates: checked <n>, passed <n>, failed <n>, not checked <n>
Findings: new <n>, residual <n>, repair-regression <n>, harness-defect <n>, acceptance-miss <n>
Tests: executed <unique n>, passed <n>, failed <n>, errors <n>, skipped <n>
Full regression: executed | deferred with reason
Unreviewed areas: <exact list or none>
Provider/live calls: <none or exact bounded count/authorization>
Real DB baseline/cleanup: <opening and closing result>
```

Any FAIL includes source/runtime evidence, violated gate, confirmed root cause or labelled hypothesis, affected sibling paths, required observable outcome, non-binding direction, chained effects, preserve recommendation, escalation trigger and exact recheck scope.

A third consecutive C1C FAIL invokes the independent-acceptance adviser escalation; Construction pauses until the required diagnosis/resume conditions are met.

---

## 9. Binary exit conditions

### C1C FAIL

Issue FAIL when any checked MUST criterion fails, ownership is violated, required evidence is unavailable, a live/data cleanup gate fails, or any P0/P1 remains. Do not grant partial checkpoint permission.

### C1C PASS

C1C PASS requires:

1. Gates A–J all PASS with independent evidence;
2. all required focused and final pipelines complete;
3. no P0/P1, silent skip, harness defect or unreviewed in-scope area remains;
4. frozen artifacts remain Construction-clean;
5. live probe/data cleanup and opening/closing real baseline pass;
6. accepted limitations are reported exactly;
7. Alicia approves checkpoint commit/archive permission.

Until those conditions are met, V3 remains production-primary and no C1C commit is authorized by Acceptance.
