# V4 Phase 1 — Unified C1 Chat Ownership Acceptance

Owner: [gpt-5.6-sol / Solaire]. Acceptance-only artifact; construction must not edit.

## Authority and pinned candidate

- Authority: `Plan/V4_Master_Implementation_Roadmap.md` §7 unified C1 exit gate and `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`.
- Alicia authorized unified ownership acceptance after confirming the final P1D hand-feel repairs.
- Candidate HEAD: `23dea37` (`docs(v4): finalize P1D construction evidence`).
- P1A–P1D accepted checkpoints are inputs; unified C1 verifies their composition and rollback boundary rather than adding another feature slice.
- Whole-product root remains `/chat/` until P7. C1 transfers only ordinary Chat capability ownership; it does not retire V3 or transfer Agent/Project/Group/Settings ownership.

## Frozen C1 gate matrix

| Gate | MUST condition | Decisive evidence |
|---|---|---|
| C1-01 Canonical route | Recent navigation and direct link resolve to the same V4 Conversation detail implementation; create opens that route. | Route/component integration plus production-build navigation checks. |
| C1-02 Identity/domain | Agent remains required; Project is optional; Drift is explicit and no fake Project is introduced. | Contract/component tests and source sweep. |
| C1-03 Capability composition | Every P1 row operates in one V4 Chat: create/read, SSE/async recovery/stop/edit/regenerate/branch, attachment/audio, controls/cache/Aura/Project files, AssistantRunTrace and active `memory_search`. | Full exo-app regression, accepted focused gates and one bounded live provider result. |
| C1-04 Runtime ownership | SSE/error/stop/recovery/reconcile remain distinguishable; Query does not take over operation lifecycle; route/epoch/immutable dispatch guards compose. | Runtime acceptance/invariant regression and source ownership sweep. |
| C1-05 Responsive single implementation | Desktop/mobile share production logic; timeline is the sole message scroll owner; top controls and Composer remain reachable without overflow. | Real production-build Chrome matrix and long-history check. |
| C1-06 Rollback reference | V3 Chat remains independently buildable/testable and `/chat/` remains reachable; no V3 source deletion or route overwrite. | chat-core tests/build, monorepo build, nginx/runtime route checks and diff/source sweep. |
| C1-07 Transfer record | Only after C1-01–C1-06 PASS, ordinary Chat rows are marked V4-primary with V3 chat-core as rollback reference. P2+ rows remain unchanged. | Targeted ownership-document diff. |

## Scope and accepted limitations

- No new production feature or backend/provider stress work belongs to unified C1.
- The already accepted single live provider message is sufficient; C1 must not spend another provider request.
- Existing V3 lint/configuration debt is non-P1D and Alicia explicitly approved leaving V3 alone. V3 test/build health, not unrelated lint cleanup, proves rollback viability.
- No real-device microphone, cross-browser matrix or manual attachment replay is required; accepted deterministic P1C regression remains authoritative.
- Root production cutover remains P7; legacy retirement remains P8.

## C1-R1 verification result

**Verdict: PASS. Ordinary Chat ownership transfers to V4-primary.** [gpt-5.6-sol / Solaire; Alicia approved]

### Gate disposition

| Gate | Result | Evidence |
|---|---|---|
| C1-01 | PASS | App route table has one `ConversationPage` at `chat/:conversationId`; create/recent/direct-route integration remains green in the full suite. Production `/app/` returns 200. |
| C1-02 | PASS | Accepted create/detail adapters require Agent identity, preserve nullable Project, and render Drift without fabricating a Project. |
| C1-03 | PASS | P1A–P1D compose in one exo-app build; full suite **46 files / 382 tests** passed. Prior accepted gates retained: A probes 19/19, A affected 80/80, historical runtime 59/59, backend Trace 53/53 and Alicia-authorized live Thinking + `memory_search` lifecycle. |
| C1-04 | PASS | Runtime acceptance/invariant families remain included in 382/382. Source sweep found one production page-level `useChatRuntime` owner; Query remains canonical message/cache data owner while runtime lifecycle remains in `useChatRuntime`. |
| C1-05 | PASS | Production Chrome at 320/390/767/768/1280 had no document overflow and preserved HUD focus/no-reflow, cache release, Project insertion, Aura and Trace. Long-history 320 px opened at bottom and the latest affordance had 0 px Composer overlap. Alicia manually confirmed the final scroll/keyboard/cache interactions. |
| C1-06 | PASS | V3 chat-core **12 files / 85 tests** passed. Full monorepo build passed for app, chat-core, chronicle and council. Production `/chat/` and `/app/` both returned 200; `/` intentionally remained a 301 to `/chat/`. No V3 route/package/source was removed. |
| C1-07 | PASS | Master Roadmap, capability matrix, side-by-side contract and active project guides now record C1 PASS, V4-primary ordinary Chat, V3 rollback status, unchanged P2+ ownership and unchanged P7 root cutover. |

### Static/build/database evidence

- exo-app typecheck: exit 0.
- exo-app lint: exit 0.
- `pnpm build`: exit 0 for all four SPA packages; only existing chunk-size/dynamic-import/plugin timing advisories.
- AgentPreset baseline: exactly IDs 1–8; `memory.0055_message_assistant_run_trace` applied.
- No additional live/provider request was made for unified C1.

### Adversarial razor / scope control

- No new feature, runtime abstraction, navigation redirect or deployment cutover was necessary for ownership transfer; adding one would exceed C1.
- V3 lint/configuration debt remains an explicitly accepted non-blocking baseline. V3 rollback viability is established by its passing tests/build and reachable route.
- Root `/` remains V3 until P7 by design; treating C1 as a root cutover would violate the roadmap.
- Agent/Project/Group/Settings, heartbeat mailbox and proposed TTS/VoiceProfile work remain P2-or-later work and did not hitchhike into C1.

## Ledger

| Cycle | Baseline | Verdict | Findings | Consecutive FAIL |
|---|---|---|---|---:|
| C1-R1 | `23dea37` | **PASS** | none | 0 |

## Transfer decision

The unified C1 hold is released. The capability IDs recorded in `V3_Capability_Ownership.md` §5 are now V4-primary at `/app/`; V3 chat-core is the buildable rollback reference. The whole-product production root remains unchanged until P7.
