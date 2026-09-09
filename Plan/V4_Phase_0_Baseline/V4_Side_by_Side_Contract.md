# V4 Side-by-Side Contract — Frozen Package/Runtime/Deployment Boundaries (P0 Task 4)

> **Artifact:** `Plan/V4_Phase_0_Baseline/V4_Side_by_Side_Contract.md`
> **Type:** names & boundaries freeze **only** — P0 creates no V4 package, no config change, no runtime.
> **Verbatim-frozen values in §2 are binding for P1A unless Alicia explicitly revises them before C0.**

---

## 1. Current V3 runtime facts (evidence)

| Item | V3 fact | Evidence |
|---|---|---|
| Packages | `packages/{chat-core, chronicle, council, shared}` (`exo-*`), workspace `packages/*` | pnpm-workspace.yaml, package.json files |
| Dev ports | 5173 / 5174 / 5175 (fixed in vite config, dev scripts add `--host --port`) | vite.config.js ×3 |
| Dev proxy | `/api` and `/media` → `http://127.0.0.1:8000` | vite.config.js ×3 |
| Prod base paths | `/chat/`, `/chronicle/`, `/council/` (SPA locations in nginx) | nginx.conf |
| PWA identities | `exocore-chat` scope `/chat/` · `exocore-chronicle` scope `/chronicle/` · `exocore-council` scope `/council/` (injectManifest `sw.js` per package) | vite.config.js ×3 |
| Root redirect | `location = / → 301 /chat/` | nginx.conf |
| Prod ports | host 8080 (http) / 8443 (https); container 80/443 | hybrid_start.ps1 (`-p 8080:80 -p 8443:443`) |
| API/media | single nginx location `/api/` + `/media/` → Django :8000; SSE-friendly (`proxy_buffering off`, 86400s read timeout) | nginx.conf |
| dist mount | nginx container bind-mounts each `packages/*/dist` → `/usr/share/nginx/html/{chat,chronicle,council}`; rebuild takes effect immediately | hybrid_start.ps1 L275–277 |
| Frontend tech | React 19 + Vite 8 + JS (no TS), three independent SPA render threads | package.json files |
| Backend | single Django :8000 shared by all SPAs (cookie credentials + CSRF header `X-CSRFToken`) | shared/src/api.js; nginx.conf |
| Client storage | no `exo:v4:` namespace exists; V3 keys observed: `exo_push_device_name`, `exo_async_<sessionId>`, `exo_agent_avatar_*` (avatar cache reads) | push.js, usePollingChat.js, TimelineView.jsx |

## 2. Frozen future package identity (P1A default — §10.1 of the Detailed Plan)

| Item | Frozen value | Rationale |
|---|---|---|
| directory | `packages/app/` | eventual canonical product app, not a disposable version-labelled package |
| package name | `exo-app` | |
| language | TypeScript strict from first source file | questionnaire Q17 |
| dev port | `5176`, strict; no automatic fallback | avoids the V3 port band 5173–5175 |
| production base | `/app/` | can coexist with V3 paths without a version-specific permanent URL |
| PWA id / scope | `exocore-app` / `/app/` | distinct identity; must never collide with V3 PWA ids/scopes |
| API transport | same-origin relative `/api/*` and `/media/*`; cookie credentials + CSRF (`X-CSRFToken`) | shared V3 transport pattern is evidence, not necessarily the final wrapper set |

## 3. Coexistence contract

1. **V3 stays untouched** on dev ports 5173–5175 and production paths `/chat/`, `/chronicle/`, `/council/` for the entire side-by-side period.
2. **P1A may later add** `dev:v4`/`dev:app` script(s), the `packages/app` package config, and an **additive** `/app/` nginx location. **P0 must not add any of these now.**
3. **Root production redirect remains `/chat/` through P6.** Only P7 may switch `/` to `/app/`. P8 remains the only phase allowed to remove legacy routes/packages.
4. V4 must **not overwrite** V3 `dist/`, service workers, PWA scopes, route bases, or package scripts. `packages/app` has its own dist and its own `sw.js` under `/app/`.
5. **Authentication cookies and backend data are shared intentionally** — same Django, same cookies, same data. No second login or second database.
6. New V4 local-storage keys use the `exo:v4:` namespace unless a separately documented cross-app profile key is intentionally shared (e.g. avatar/user profile keys that already follow `exo_*` conventions).
7. V4 API wrappers may reuse the generic `exo-shared` transport (`apiFetch`), but V3 endpoint wrappers are **evidence, not automatically trusted canonical interfaces** — P1A must consult `Canonical_API_Snapshot.json`.
8. Adding `packages/app` later causes workspace discovery through `packages/*` — it must not change current package resolution or the lockfile before P1A; the lockfile changes only in the P1A commit that actually adds the package.

## 4. Checkpoint and rollback contract

| Gate | V4 exposure | V3 role | Rollback semantics |
|---|---|---|---|
| **C0** (this P0) | none — documents only | sole production owner | remove/revise only unaccepted P0 documents; never reset sibling changes |
| **P1A–P1D** (C1A–C1D checkpoints) | directly accessible at dev 5176 or additive `/app/` | **V3 remains primary** (all P1A–P1D capability rows stay V3-primary until unified C1; V4 exposes only dev/additive surfaces) | sub-gate failure hides/stops only the V4 exposure and returns to the latest accepted construction checkpoint; **no user data is deleted** |
| **C1 (unified) — PASS** | ordinary Chat **V4-primary** at canonical `/app/` routes | V3 chat is the buildable rollback reference | whole-product root still waits for P7 |
| **P7** | production cutover of entire product | kept as complete rollback artifact (buildable, same routes) | rollback switches root/nginx/deployment artifact back to V3; no user-data rollback |
| **P8** | legacy retirement | removed only per capability row, after observation period + Alicia approval | C7 git/artifact checkpoint restores source surfaces; user business data never rolled back |

Unified C1 transfer was accepted on candidate `23dea37`. [gpt-5.6-sol / Solaire; Alicia approved] This changes capability ownership only: the additive paths, PWA identities, V3 rollback routes and P7 root-cutover boundary remain unchanged.

## 5. Config-change ownership by phase (so P0 is not misread as authorization)

| Config file / surface | Change | Owning phase | Notes |
|---|---|---|---|
| root `package.json` scripts | add `dev:v4`/`dev:app` | P1A | P0 changes nothing |
| `pnpm-workspace.yaml` | none needed (already `packages/*`) | P1A (first `packages/app` commit) | lockfile changes land with the package add |
| `packages/app/*` | create package (TS strict, vite config, PWA id `exocore-app`, base `/app/`, port 5176) | P1A | P1B–P1D only add files inside it |
| `../nginx/nginx.conf` | additive `location /app/` block | **P1A** (sole owner; lands with the first `packages/app` commit) | never edit the three V3 locations; `/` redirect changes only at P7; P0 is not authorized to edit this file |
| `../hybrid_start.ps1` | mount `packages/app/dist` for `/app/` | **P1A** (sole owner; additive fourth mount) | additive only; V3 dist mounts untouched; P0 is not authorized to edit this file |
| V3 package scripts/vite configs | none ever | — | P8-only retirement path |
| `ReactSheet.md` | already reconciled at C0 (provenance header added) | C0 done; future edits by owning phases | both repos must stay in sync |
| localStorage keys of V4 | `exo:v4:*` namespace | P1A onward | cross-app profile keys documented separately |

## 6. Cross-references

- Package identity questionnaire decision: `Plan/V4_Frontend_Refactor_Decision_Questionnaire.md` Q16–Q19 (Q16: new independent package `packages/app`/`exocore-app`; Q17 TS strict; Q18 vertical slices; Q19 bottom bar deferred to mockup).
- Architecture rationale: `Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md` §10.1–10.4, §12.
- Names must appear identically in every P0 artifact: **`packages/app` · `exo-app` · port 5176 · base/scope `/app/`** (C0 reconciliation check §16.1).

---

*This contract freezes names and boundaries only. It does not create or configure anything in P0.*
