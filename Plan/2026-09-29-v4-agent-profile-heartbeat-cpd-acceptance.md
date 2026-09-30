# V4 Agent Profile — CP-D Joint Regression & Final Acceptance

> **Checkpoint:** CP-D — Joint regression and documentation closure
> **Date:** 2026-09-30
> **Accepted Desktop implementation:** `4395b2c`
> **Accepted backend:** `7f4a1adb` + ReactSheet sync `3226f0ae`
> **Acceptance:** Solaire
> **Verdict:** **PASS**

## 1. Accepted scope

- CP-A Heartbeat read page and Ledger.
- CP-B note/wakeup writes, reconciliation, accessible dialogs and normal-Chat navigation.
- CP-C G045-only Prime display/transfer/delete protection.
- CP-D singleton-G045 Routine configuration, cross-repo contract sync and preserve regression.
- No River implementation or post-companion product scope was introduced.

## 2. Independent mechanical evidence

```text
P2A/P2C singleton-focused tests       39/39 PASS
full exo-app regression            1305/1305 PASS (101 files)
typecheck / lint / exo-app build           PASS
exo-chat-core independent build             PASS
exo-chronicle independent build             PASS
exo-council independent build               PASS
Desktop / ExoCore git diff --check          PASS
```

Backend companion evidence on the final chain:

```text
Gate 0 focused regression            197/197 PASS
manage.py check                              PASS
makemigrations --check --dry-run              PASS
real AgentPreset baseline                    PASS (8 rows [1..8])
```

Read-only real API smoke returned HTTP 200 and verified shapes only:

- conversation list: every row has boolean `is_prime`, exactly one current Prime;
- Heartbeat queue: canonical queue envelope and list fields;
- Heartbeat events: `{events,total_count,has_more}` with correct scalar types.

No POST, PATCH or DELETE was used in the real API smoke.

## 3. Browser matrix

Existing nginx served the final built V4 dist at `http://127.0.0.1:8080/app/`. A temporary external raw-CDP probe used installed system Chrome without adding dependencies or modifying the repository.

Final run:

```text
viewports: 320x568, 390x844, 768x1024, 1280x800
checks:    141 PASS / 0 FAIL / 41 INFO
writes:    0 POST / PUT / PATCH / DELETE
```

At every viewport it verified:

- G045 Profile and visible Prime stars;
- hollow-star Prime confirmation dialog without confirming;
- Heartbeat page;
- note and wakeup dialogs without submitting;
- no document/dialog horizontal overflow;
- canonical overlay/dialog bounds;
- trigger not covered at click point;
- Tab and Shift+Tab boundary containment;
- idle Escape close and focus restoration.

The first diagnostic runs exposed probe/PWA reload timing, not fixed product failures. The final strict run retained coverage checks and passed with zero write requests. Chrome and its isolated temporary profile were removed after execution.

## 4. Contract and closure audit

- Desktop and ExoCore ReactSheet Prime/Heartbeat contracts agree, including `launch_source=user` and Project-delete `409 prime_conversation_transfer_required`.
- Routine configuration exposes one canonical G045 toggle; payload arrays are only `[]` or `[canonical_id]`; zero/multiple/invalid-G045 states cannot write.
- CP-A/B/C acceptance reports and singleton rebaseline records are included in the closure bundle.
- Main companion Plan and consumed Prime handoff are archived under `Plan/Archived/`.
- Ownership/Roadmap files require no factual update and do not claim River or a new Core C2 closure.

## 5. Final disposition

CP-A through CP-D are accepted. The accepted Desktop and ExoCore ranges may be pushed only after this report and corrected archived references are committed and the final worktrees are verified free of companion-scope drift.
