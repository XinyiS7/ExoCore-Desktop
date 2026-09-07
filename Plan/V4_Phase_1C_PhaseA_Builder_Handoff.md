# V4 P1C — Phase A Builder Handoff (Ecki / deepseek v4)

> **Phase:** A — Task 1 (wire adapters) + Task 2 (compose lifecycle) + Task 3 (recorder + target gate)
> **Builder:** Ecki (pane 4)
> **Date:** 2026-09-07
> **Frozen authority:** `Plan/V4_Phase_1C_Detailed_Plan.md` (SHA `acada1930…`) + `Plan/V4_Phase_1C_Attachment_Audio_acceptance_report.md`
> **STOP markers honored:** audio recovery machine NOT built; Task 4 runtime integration NOT built; Task 5 (Pane 5 handback) NOT touched.

---

## 1. Opening baselines (verified 2026-09-07)

| Surface | State |
|---|---|
| Desktop HEAD | `12e16f647a7b42760a947641b5dab56af5c1d2fc` (accepted C1B) ✅ |
| Backend HEAD | `bfd77529` (docs-only delta since planning `c286a84e`; no attachment surface change) ✅ |
| Outer HEAD | `cf64f42` (pre-existing modified `AgentMemory/…/moonlight_garden/SKILL.md` untouched) |
| Real AgentPreset baseline (open) | `OK: 8 rows [1..8]` ✅ |
| Backend attachment contract vs scout | No drift: routes `…/attachments/`, `…/content/`, `…/delete/`; multipart `files`; 201/422 bodies with authoritative ordered `results`; 409 frozen body fields; audio allowlist `audio/webm;codecs=opus` → `audio/webm`; 10 MiB. Verified against `agents/urls.py` + `agents/views.py` §1028–1363. |

### Pre-existing sibling work preserved (NOT absorbed)
- Desktop: untracked Plan 1C docs (frozen), untracked `.agents` skills (user-requested copy).
- Backend: staged/committed Plan doc `gemini_empty_response_retry_downgrade_plan.md`.
- Outer: modified `ExoCoreData/…/moonlight_garden/SKILL.md`.
- **Sibling anomaly reported:** `ExoCore/.agents/skills/sia-telemetry/SKILL.md` disappeared from working tree during this session (12:59:47, after my read-only copy; `cp` cannot delete the source). Desktop copy exists and is complete (4157 B). Not caused by this Builder; left untouched per read-only boundary — needs Solaire/Alicia adjudication.

---

## 2. What Phase A delivers

### Task 1 — typed wire adapters (complete)
| File | Content |
|---|---|
| `packages/app/src/features/chat/attachments/types.ts` | DTOs: `AttachmentUploadPayload`, `UploadResultItem`, `UploadFailureItem`, `AttachmentListRow`, `DeleteAttachmentOutcome` (204 / 409-frozen / error), `AudioTarget`, `ComposeAttachmentEntry`. |
| `packages/app/src/features/chat/attachments/api.ts` | `uploadAttachments` (multipart + CSRF + credentials; 201 AND 422 bodies preserved whole; non-201/422 throws `AppApiError`), `listConversationAttachments` (bare mixed-source array), `deleteConversationAttachment` (exact `/delete/` route, one `{source,id}`, 409 fields preserved), `audioUploadErrorMessage` (stable mapping). |
| `packages/app/src/features/chat/runtime/client.ts` | `PostChatOptions.pendingAttachments` → `buildChatBody` serializes as `pending_attachments` ONLY after integer/positive validation (Task 1.5). Text-only sends omit the field (no C1B regression). |
| `packages/shared/src/models.d.ts` + `package.json` export | Declaration-only surface for `resolveInitialSessionTarget` + `ModelCatalog` (Plan §5.2 allowance; runtime JS untouched, no fork). |

### Task 2 — compose attachment lifecycle (complete)
| File | Content |
|---|---|
| `attachments/useComposeAttachments.ts` | Coordinator: per-input `clientId` stable identity, batch epoch + conversation guard, results keyed by validated `input_index` (never filename/position), 4 explicit states, remove-from-turn (late callbacks cannot resurrect), route-switch abort + object-URL revoke, `anyUploading`/`successfulIds`/`clearCompose` (Task 4 hook). Malformed/missing/duplicate results → explicit `failed` (never manufactured success); non-positive IDs → contract failed. |
| `attachments/ComposeAttachmentItem.tsx` / `ComposeAttachmentList.tsx` | V4-only rendering: image preview + spinner/amber/red overlays + success badge; file chip; persistent visible remove button (no hover dependency); status not color-only; aria labels. |
| `attachments/useUserAttachmentManager.ts` + `UserAttachmentManager.tsx` | Narrow user-only manager (tool_collection rows parsed, never exposed): lazy loads on expand (zero requests when closed — preserves C1B tests), single delete, 204 purges local row BEFORE list/history refresh + message-query invalidation; 409 shows frozen-cache guidance mutating nothing; 400/404/network keep row + visible error; `deletePending` blocks send, `busy` blocks delete (bidirectional exclusion, Gate H). `storage_path` never rendered. |
| `ChatComposer.tsx` | Image + file pickers, compose strip, delete-pending/uploading send lock. |

### Task 3 — recorder + automatic target gate (complete; recovery machine STOPPED)
| File | Content |
|---|---|
| `audio/types.ts` | Recorder states, stable error codes/messages, frozen MIME constants, 10 MiB mirror. |
| `audio/useAudioRecorder.ts` | Full AUD-F TS port: secure-context, getUserMedia, frozen-MIME preflight (opus→webm), epoch token, zero-byte rejection, 60 s cap, unmount track+URL release, stable error mapping. |
| `audio/audioTarget.ts` | `fetchModelCatalog` (live `GET /api/core/model-catalog/`), `resolveAudioTarget` (shared resolver + audio ability + `file_uri` transport), `useModelCatalogQuery`, `useAudioTargetGate`, retryable reason text. No P1D selector. |
| `audio/AudioComposeBar.tsx` | recording (live seconds + stop) / recorded (preview + cancel; Send omitted until Task 4 wires it — no dead buttons) / error (stable message + close). |

### Integration
- `ConversationPage.tsx`: wires compose coordinator (conversation-keyed), lazy manager, recorder (cancel on route switch), catalog query + target gate.
- `styles/shell.css`: V4 `--v4-*`/`app-*` only; no V3 classes or tokens.

---

## 3. Verification — Phase A focused + regression

| Check | Result |
|---|---|
| `pnpm --filter exo-app typecheck` | PASS |
| `pnpm --filter exo-app lint` | PASS |
| `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` | **213 passed (24 files), 0 failed** |
| `pnpm --filter exo-app build` | PASS |
| `pnpm --filter exo-chat-core test:run` | 85 passed (12 files) |
| `pnpm build` (all 4 packages) | PASS |
| `pnpm --filter exo-chat-core/chronicle/council lint` | Known-dirty fingerprint only (no V3 file modified by this slice) |
| `git diff --check` + `--cached --check` | PASS |
| New test coverage (Phase A) | `p1c_attachments_api`, `p1c_compose_attachments`, `p1c_audio_recorder` (AUD-F contract), `p1c_audio_target`, `p1c_pending_attachments_body`, `p1c_attachment_manager` |
| Real DB baseline (closing) | `OK: 8 rows [1..8]` ✅ |
| Provider/live calls | **None** (no live browser, no provider spend) |

### State/race invariants proven by tests
- 201 all/partial + 422 all-failed bodies kept whole; `results` sole ownership source; malformed/missing/duplicate results → explicit failed.
- Removed entry cannot be resurrected by late callback; route switch clears + aborts + revokes; late cross-conversation responses ignored.
- Only positive validated IDs enter `successfulIds`; `anyUploading` blocks send.
- Delete: 204 purge-before-refresh + message invalidation; 409 no state mutation + guidance; 404 keeps row.
- AUD-F: insecure context / missing getUserMedia / MIME reject; delayed onstop after cancel ignored; zero-byte rejected; 60 s cap; unmount releases track + URL.

---

## 4. Handoff to Task 4 (Pane 3 / next Builder) — exact seams

Task 4 must (per frozen Plan §6.4) — nothing here pre-empts it:
1. Change runtime send interface from `(content: string)` to typed turn input `{content, pendingAttachments}`; attach `compose.successfulIds` + recorder upload (with resolved `audioGate.target`) before dispatch.
2. Empty-text send allowed only when valid attachment/audio IDs exist; keep send disabled during retained uploads / unresolved delete.
3. Wire `AudioComposeBar` recorded-state **Send** button (`onSend` prop exists but is intentionally unwired in Phase A).
4. Audio recovery machine (snapshot/retry/abandon) + `audioRecoveryMachine`/recovery UI + playback manager: **not built** (STOP marker; belongs to Task 3.3 remainder / Task 5).
5. Attempt-keyed outcome/persistence bridge from C1B runtime to recovery — untouched.

## 5. Scope exclusions honored
- No model/endpoint selector, cache/project controls, tool_collection UI, transcript/STT, waveform, resumable upload, new dependency, backend/outer/V3/deployment change, PWA identity change.
- No commit created (Plan §12: commit only after independent C1C PASS + Alicia approval).
- Frozen Plan / acceptance report / acceptance probes untouched.

## 6. Files changed (desktop only)
```
M packages/app/src/features/chat/ChatComposer.tsx
M packages/app/src/features/chat/ConversationPage.tsx
M packages/app/src/features/chat/runtime/client.ts
M packages/app/src/styles/shell.css
M packages/shared/package.json            (exports types map, declaration-only)
A packages/shared/src/models.d.ts          (declaration-only)
A packages/app/src/features/chat/attachments/{types.ts, api.ts, useComposeAttachments.ts, ComposeAttachmentItem.tsx, ComposeAttachmentList.tsx, useUserAttachmentManager.ts, UserAttachmentManager.tsx}
A packages/app/src/features/chat/audio/{types.ts, useAudioRecorder.ts, audioTarget.ts, AudioComposeBar.tsx}
A packages/app/src/test/p1c_*.test.{ts,tsx} (6 files)
```
Plus user-requested `.agents/skills` copies (not P1C code): `builder-workflow`, `commit`, `exocore-workflow`, `get_exocore_insight`, `sia-telemetry`, `wezterm_coop` refresh.

**Phase A complete. Awaiting feedback from Pane 3 (Solaire) and Pane 5; no further autonomous work.**