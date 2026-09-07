---
name: builder-workflow
description: Rigorous construction workflow for implementing an approved Plan. Use before the first production edit, at construction checkpoints, after an acceptance review returns FAIL, and before handing work to an independent reviewer.
compatibility: pi
metadata:
  scope: exocore
---

# Builder Workflow

Implement an approved Plan without replacing independent acceptance. The Builder owns construction evidence, not the quality verdict.

Core decisions:

- `[Alicia / approved]` The Builder must actively challenge its own implementation and must report measured facts instead of claims such as "all green" or "zero defects".
- `[gpt-5.6-sol / Solaire]` A review finding is evidence of a potentially wider invariant failure. Repair the invariant and audit sibling paths; do not patch only the named line.
- `[Alicia / approved]` `footgun` is an error-record routing protocol, not a mistake catalogue. It decides whether an incident belongs in `DevelopLog/warnings.md` or `DevelopLog/DebugLog.md`.
- `[Alicia / approved]` **Explicit construction signal required.** Under this behavior, discussing or planning construction with Alicia is NOT authorization to start work. Even when a Plan file is frozen and staged, the Builder must not make any production or test edit until Alicia gives an explicit construction signal (e.g., "开始施工" / "开工" / "proceed" / "按计划施工"). Planning, reading, source verification, writing/staging Plan documents, and filling the Plan's Construction Evidence section remain allowed before the signal. If the signal is ambiguous or missing, ask — never infer permission from a Plan discussion, a prior checkpoint's authorization, or the absence of a "stop". The same rule applies to repair work after an acceptance FAIL: a review report is not a construction signal; wait for the explicit go.

## Invocation Modes

```text
/skill:builder-workflow start <Plan path> [acceptance spec path]
/skill:builder-workflow checkpoint
/skill:builder-workflow repair <review report or path>
/skill:builder-workflow handoff
```

If the mode is omitted, infer it from the task:

- no implementation edits yet -> `start`
- implementing an approved phase -> `checkpoint`
- reviewer returned blockers or FAIL -> `repair`
- asking to review, accept, or commit completed construction -> `handoff`

A mode does not override repository instructions, frozen-spec ownership, checkpoint gates, or the user's scope. `checkpoint`, `repair`, and `handoff` must reference a recorded `start` gate for the current Plan/checkpoint; if none exists, run `start` first.

### Risk level

Choose and record one level before editing:

- **L — documentation/skill/config only:** no runtime contract, persistence, generated data, or external interface changes. Use a compact preflight: scope, dirty-work isolation, exact files, and targeted validation.
- **M — ordinary implementation:** one module with established patterns and no concurrency/lifecycle changes. Use applicable matrix dimensions and sibling-path search.
- **H — high-risk/integration:** model/API/schema/persistence, migration, transaction, concurrency, scheduler/startup/restart, external service, cross-module ownership, or any acceptance `FAIL`. Use the full matrix and self-adversarial record.

Escalate immediately when source inspection reveals a higher-risk dimension. Never downgrade a `repair` task below H.

---

## 1. Start Gate — Before the First Production Edit

Do not call `edit` or `write` on production code until this gate is complete at the selected risk level.

### 1.1 Pin the construction boundary

1. Read the active Plan completely.
2. Read the frozen acceptance specification completely when one exists.
3. Read repository and module instructions required by `AGENTS.md`.
4. Record current `git status`; identify pre-existing staged and unstaged work that must remain untouched.
5. Confirm the current checkpoint and whether commit is permitted after construction.
6. Verify every named class, field, method, endpoint, job id, and third-party API in source. Never build against a remembered signature.
7. Run the required Insight query or equivalent impact search before changing a model, service, interface, or cross-module flow.

### 1.2 Check existing incident knowledge

For M/H work, search `DevelopLog/warnings.md` and `DevelopLog/DebugLog.md` for the affected modules, frameworks, and failure terms. Do not treat `.agents/skills/footgun/SKILL.md` as an incident database.

Use `footgun` only when a new or repeated error must be classified for documentation; incident history belongs in the two DevelopLog files, not in the skill itself:

- concise stable precaution -> `DevelopLog/warnings.md`;
- multi-step diagnosis, architectural impact, unclear root cause, or repeated failed attempts -> `DevelopLog/DebugLog.md`;
- transient task-local issue with no future retrieval value -> do not create a permanent record.

### 1.3 Translate prose into a construction matrix

Before editing M/H work, produce a concise matrix in the active Plan under a `Construction evidence` section. Include only applicable dimensions, but explicitly mark omitted dimensions as not applicable with a reason. For L work, record the exact files, non-runtime scope, dirty-work isolation, and validation targets instead of a full matrix.

| Dimension | Questions to freeze |
|---|---|
| Invariant | What must always be true? What is the unique fact source? |
| Entry paths | Which public, startup, retry, callback, CLI, scheduler, and migration paths can reach it? |
| State | Normal, empty, duplicate, mixed, terminal, RUNNING/in-flight, stale/legacy? |
| Timing | Before commit, after commit, rollback, restart, concurrent interleaving? |
| Failure | Validation refusal, dependency failure, partial initialization, cleanup failure, late callback? |
| Ownership | Which module owns declaration, mutation, persistence, projection, cleanup, and documentation? |
| Observation | What runtime or source evidence can disprove the implementation? |

Do not write raw acceptance test implementation into the Plan. Record verification targets, interfaces, state setup, and expected observations only.

### 1.4 Required preflight output

Before the first edit, record in the active Plan and report:

- approved Plan/checkpoint and frozen-spec paths read;
- risk level selected and escalation triggers checked;
- source/Insight scope examined;
- pre-existing dirty files to preserve;
- matrix dimensions selected, or L-level non-runtime justification;
- unresolved ambiguity or explicitly accepted boundary.

If an acceptance criterion is ambiguous or conflicts with source reality, stop and ask. Do not choose the easiest interpretation silently.

---

## 2. Construction Discipline

### 2.1 Build by invariant, not by file list

For each implementation step:

1. Restate the invariant being changed.
2. Map declaration -> handler -> service -> persistence/downstream side effects.
3. Make the smallest coherent edit that preserves the existing architecture.
4. Verify sibling entry paths before moving to the next invariant.
5. Remove only dead code made obsolete by this scope; do not perform opportunistic cleanup.

Views and adapters remain thin. Business decisions belong in the owning service. ORM and third-party details must not leak across established boundaries.

### 2.2 Generalization rule after every discovered defect

Before declaring a named defect repaired, answer:

1. What broader invariant did this defect violate?
2. Which other files or entry paths implement the same pattern?
3. Which state combinations were absent from the original reasoning?
4. Could this repair create a second-order failure in cancellation, retry, completion, rollback, restart, or cleanup?
5. What evidence would make the repair appear successful while the real behavior still fails?

Run a mechanical search for sibling patterns. Record the searched symbols/paths. A repair is not ready for review merely because the reviewer's exact reproducer now passes.

### 2.3 External side effects and concurrency

When applicable:

- establish one stable lock order for every mutation path;
- keep network, LLM, MCP, filesystem, scheduler, process, and other external side effects outside database row locks;
- project side effects only after durable commit when rollback must suppress them;
- define behavior for duplicate, concurrent, late, and already-terminal callbacks;
- treat partial initialization as failure, not a degraded success;
- preserve the original exception when cleanup also fails.

### 2.4 Scope control

If construction exposes an unrelated production issue:

1. isolate the current test or path so the approved scope can be verified honestly;
2. record the unrelated issue separately;
3. do not modify unrelated production code without explicit approval.

Never change production behavior merely to make an environmental or test-isolation failure disappear.

---

## 3. Self-Adversarial Checkpoint

Run this checkpoint after each coherent invariant and before asking for review.

The goal is to disprove the implementation, not to explain why it should work.

### 3.1 Counterexample pass

For each changed invariant, attempt applicable counterexamples:

- two valid records instead of one;
- mixed old/new or pending/retry/running states;
- caller-suggested keeper conflicting with an in-flight record;
- restart with persisted state from a previous process;
- transaction rollback after durable data is prepared;
- dependency failure after partial setup;
- cleanup or shutdown failure masking the original error;
- late completion after cancellation;
- concurrent entry through a sibling public path;
- disabled/ineligible owner with still-valid explicit work.

This list is a prompt, not a substitute for domain-specific reasoning.

For M/H work, append a checkpoint record to the active Plan:

| Scenario | Applicable or N/A reason | Command/inspection | Observed result | Follow-up |
|---|---|---|---|---|

Every unexecuted, unresolved, or assumption-dependent scenario must also appear in the handoff. A checked box without an observation is not evidence.

### 3.2 Test honesty pass

Confirm that verification:

- reaches the real production entry point instead of reimplementing it in the test;
- uses real transaction/commit semantics when testing locks or `on_commit`;
- uses a real persistent store when testing restart visibility or framework lifecycle;
- does not let fake behavior prove the same assumption being tested;
- has no self-referential wrapper or assertion based only on wrapper side effects;
- does not share mutable Mock/scheduler state across tests;
- leaves no uncontrolled thread, daemon, process, scheduler, socket, or connection;
- does not call real paid/external LLM or MCP services without Alicia's approval;
- fails on swallowed exceptions, unexpected error logs, or worker-thread exceptions;
- asserts the decisive state transition, not only a return string or call count.

Use real framework components only where their semantics are the subject of verification. Otherwise keep tests isolated and deterministic.

### 3.3 Claim-evidence pass

For every statement planned for handoff, identify its evidence:

| Claim type | Required evidence |
|---|---|
| file or symbol removed | exact repository search and scope |
| state invariant covered | enumerated state combinations and decisive assertions |
| transaction boundary | real commit/rollback observation |
| restart behavior | real lifecycle/store observation |
| no external call | explicit patch/fake boundary and call assertion |
| regression result | exact command and passed/executed count |
| scope isolation | `git status`, diff, and staged/unstaged boundary |

If evidence is absent, report the item as unverified. Do not convert confidence into a fact.

### 3.4 Test execution delegation (Test Runner subagent)

Mechanical test execution SHOULD be delegated to the `test-runner` subagent. The owning Builder must NOT run long test suites in its own context — "running tests" needs almost no reasoning tokens; reading failures and judging them does. Keep the expensive context for the thinking, not the waiting.

Division of labor:

| Action | Owner |
|---|---|
| choose WHICH tests / why / what PASS means | Builder (never delegated) |
| mechanical execution (run commands, collect exit code, pass/fail/error/skip, failing test names + traceback) | test-runner subagent |
| failure interpretation (production defect vs stale harness vs test DB collision vs frozen contract) | Builder (never delegated) |
| repair decision and repair itself | Builder (never delegated) |
| targeted recheck after repair | test-runner subagent (mechanical, e.g. 2/2 PASS) |
| verdict whether a checkpoint is satisfied | Builder (never delegated) |

Test Runner permissions are intentionally severed:

- MAY: run the exact commands the Builder specifies (focused suite / full suite / compileall / `manage.py check` / `makemigrations --check` / `git diff --check`); report exit code, counts, failing test names, traceback tails.
- MAY NOT: modify code or tests, "fix as a side note", judge PASS sufficiency, widen test scope, touch real DB, `manage.py shell`, migrations, commit/stage.

On FAIL, the subagent reports and STOPS; it never proposes a fix. The Builder decides the meaning.

Rule of thumb: **let the subagent be the CI, not the engineer.**

---

## 4. Repair Mode — After Acceptance FAIL

A FAIL is not a request to apply a line-by-line patch. It is a signal to reassess the invariant.

### 4.1 Build a repair map before editing

For every blocker, record:

| Field | Required content |
|---|---|
| Evidence | Reproducer, source path, or observed state supplied by reviewer |
| Verified fact | What source/runtime inspection confirms |
| Root invariant | The broader rule that failed |
| Affected paths | Every sibling path sharing the rule |
| Repair boundary | Production/test/docs files that must change |
| Chained effects | Existing behavior/tests likely affected by the repair |
| Verification target | Focused observation that can falsify the repair |

Verify reviewer-referenced APIs and line locations against current source before editing. If evidence is wrong or stale, report the discrepancy neutrally; do not invent a compatible API.

### 4.2 Same-invariant stop rule

If the same invariant fails independent review a second time:

1. stop micro-fixes;
2. reread the frozen criterion and all related source paths;
3. rebuild the complete state/path/timing matrix;
4. inspect whether current construction tests encode the implementation's assumption;
5. report the revised design before editing further.

Do not issue another completion claim until the wider audit is recorded.

### 4.3 Verification order after repair

1. Static/source audit of every sibling path.
2. Focused reproducer for the reported failure.
3. Neighboring negative and error-path verification.
4. Relevant module regression.
5. Full construction regression only when the checkpoint is otherwise ready for handoff or the reviewer explicitly requests it.

Repeatedly running the entire suite does not compensate for an incomplete state matrix.

### 4.4 Repair report

After applying the repair, report only measured or directly inspectable facts:

- reviewer blocker count and exact identifiers received;
- blocker identifiers with corresponding changed file/symbol names;
- repository searches executed, search scope, and match counts inspected;
- files changed and diff insertions/deletions;
- focused commands with passed/failed/error/skipped/executed counts and exit codes;
- commands or scenarios not executed;
- newly declared or accepted boundaries;
- staged/unstaged/untracked counts and exact paths.

Do not say blockers were "addressed", paths were "covered", or repair was "complete". Then stop for independent recheck. Commit authority comes from `AGENTS.md`, the active Plan/checkpoint, and the `commit` skill—not from this workflow itself.

---

## 5. Handoff Mode — Evidence Without a Verdict

The Builder must not award its own PASS or describe its work with quality verdicts. Independent acceptance owns those conclusions.

### 5.1 Forbidden evaluative language

Do not use these as Builder conclusions, including close variants:

- "全绿" / "all green"
- "零漏洞" / "zero defects"
- "彻底闭环" / "fully closed"
- "完全正确"
- "所有路径已覆盖"
- "无任何问题"
- "生产安全"
- "最终完成"
- "验收通过" / "PASS"

Do not replace them with celebratory emojis or synonyms. A successful command is evidence about that command, not a verdict about the feature.

### 5.2 Required factual handoff format

```text
Construction evidence

Scope
- Plan/checkpoint: <exact path/section>
- Risk level: <L/M/H>
- Files changed: <count and exact paths>
- Diff stat: <insertions>/<deletions>
- Pre-existing dirty paths preserved: <count and exact paths>

Implementation facts
- <file :: symbol>: <old observable behavior -> new observable behavior>
- Reviewer blockers received: <count and identifiers, or 0>
- Repository searches: <query, scope, match count inspected>

Verification executed
- <exact command>: passed <n>, failed <n>, errors <n>, skipped <n>, executed <n>, exit code <code>
- <exact inspection>: <numeric/directly observable result>

Not executed / not independently verified
- <count and exact items>

Declared boundaries
- <count and exact limitations/deferred issues>

Repository state
- staged: <count and exact paths>
- unstaged: <count and exact paths>
- untracked: <count and exact paths>

Independent acceptance requested; Builder verdict: not issued.
```

Use the test runner's unique executed count. If command arguments repeat labels or modules, disclose the duplication rather than presenting the inflated total.

For a failed command, report the exact failed/error/skipped counts and relevant failure identity. Never reduce a mixed result to a positive adjective.

### 5.3 Commit boundary

Before commit, load and follow the `commit` skill. Commit authority and timing come from `AGENTS.md` and the active Plan/checkpoint. Stage only the authorized files; do not stage frozen specs, independent acceptance assets, or unrelated dirty work.

---

## 6. Exit Criteria

The Builder may hand off a checkpoint only when:

- the construction matrix is recorded;
- changed invariants received a self-adversarial pass;
- review repairs were generalized to sibling paths;
- verification is reported numerically and reproducibly;
- unverified items and scope boundaries are explicit;
- the Builder issued no quality verdict;
- independent review has been requested and construction has stopped.
