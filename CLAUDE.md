# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

**Parent spec:** `../ReactSheet_Reorganized.md` — API contract (reorganized, this is the active reference).
**API contract (legacy):** `../ExoCore/ReactSheet.txt` — original flat spec, superseded by ReactSheet_Reorganized.md.
**Cross-module context:** `../AGENT.md` and `../.agent/project.md`
**Nginx deployment:** `../nginx/nginx.conf` — reverse proxy config
**Startup script:** `../hybrid_start.ps1` — unified pgvector + Django + nginx launcher

**Shell environment:** Git Bash (Windows). Use Bash tool for shell commands, not PowerShell.

# Communication Principles

**1. First Principles Thinking:**
  1. Identify the scope and scalability of the requirements.
  2. Break down the requirements into the most basic steps or specific problems.
  3. Rebuild a more scalable and maintainable solution from the ground up.

**2. Abstraction and decoupling:**
  In complex systems, maintain decoupling of sub-modules and abstract functionality to improve maintenance and update performance.
  Possess long-term and holistic thinking; never adopt a simple, fragile, single solution for the sake of quick problem-solving. Prioritize maintaining the system's scalability and robustness.

# Development Protocol

**1. Plan First, Work Later:**
- Before any implementation, think through the approach and identify all files that will be touched.
- **Surgical Implementation:** Follow the plan strictly. Avoid "scope creep" or unrelated refactoring during a feature task.
- **Review & Refine:** After coding, perform a self-review. Check for:
  - **Functional Partitioning:** Is the logic in the right layer? (Components handle UI, hooks handle state, shared handles API). Zero tolerance for spaghetti logic crossing boundaries.
  - **Decoupling:** Are modules too tightly bound? Use interfaces/abstractions where appropriate.
  - **Robustness:** No silent failures. Avoid "empty" catch blocks. Errors must be logged or surfaced correctly.
  - **No Shortcuts:** Resist the urge to "hack" a quick fix.

**2. State Management & Collaboration:**
- **Atomic Commits:** Commit at each logical milestone.
- **Per-File Checkpointing:** When executing a multi-step plan, commit immediately after completing each file's staged changes.

**3. Elegant Programming & Anti-Spaghetti:**
- **Strict Layer Integrity:** Components handle UI rendering; hooks manage state and side effects; shared package handles API communication. NEVER leak API calls directly into view components.
- **Clarity > Cleverness:** Write code that is easy for the next agent (or human) to understand.
- **Standardization:** Use the project's established patterns (e.g., `exo-shared` API client, Cinder CSS variables for theming, ModalShell for modals).
- **Minimalism:** Remove dead code, unused imports, and redundant comments immediately.

**4. Grounding & Anti-Hallucination (CRITICAL):**
- **NO INVENTION:** NEVER assume a component, hook, API endpoint, or data field exists. You MUST empirically verify its exact name and signature by reading the source code or using Grep before writing code that interacts with it.
- **No Mocking/Stubbing Data:** Do not invent mock data structures, fake API responses, or "stub" implementations unless explicitly directed. Always use the actual API contracts and data shapes present in the project.
- **Prove It Before You Write It:** If you are unsure about an API response shape or component interface, read the defining file or `ReactSheet_Reorganized.md` first. Hallucinating API shapes or component props causes critical system failures and is strictly forbidden.

**5. String Quotes:**
- Prefer double quotes as the outermost string delimiter in JavaScript/JSX.
- Always verify quotes are ASCII `"` (U+0022), not Chinese curly quotes `“` / `”` (U+201C / U+201D).

## Repository Boundaries (CRITICAL)

This repo is **ExoCore-Desktop** (React + Vite frontend).

**`../ExoCore/` (Django backend) and `../ExocoreExtension/` (Windows extensions) are separate repositories.**
You may READ their source code and docs to understand API contracts, data models, and existing behavior — but you MUST NEVER modify files in those directories.

If a task requires backend or extension changes:
1. Write a clear spec/doc in `docs/superpowers/specs/` describing what the other repo needs to change
2. Tell the user to hand it off to that repo's agent
3. Do NOT reach across and edit files yourself

## Before You Code

- **Plan first, work later.** Think through the approach before writing any code. Identify all files that will be touched and verify assumptions by reading source files.
- **Evaluate necessity.** Not every request needs to be implemented exactly as stated. Think about whether the ask is reasonable, whether a simpler approach exists, and whether the benefit justifies the complexity. Push back on over-engineering.
- **Check the API contract first.** `ReactSheet_Reorganized.md` defines the data shapes. If a proposed change doesn't match the spec, discuss before coding.
- **Respect existing patterns.** This monorepo has established conventions — match them. Don't introduce new patterns without a reason.

# V3 Frontend Split

ExoCore-Desktop is a **monorepo** containing three independent SPAs. Each runs on its own port as a standalone PWA, sharing a single Django backend (port 8000).

## Architecture

### Three Web Modules (packages/)

| Package | Purpose |
|---|---|
| `chat-core` | Agent hub, conversations, projects, files, settings, memory, user profile |
| `chronicle` | Timeline/BBS feed, task management, Google Calendar |
| `council` | Multi-agent workspace — **deferred to V3.1** |

### Shared Package

`packages/shared` (`exo-shared`) — API client, CSRF handling, endpoint wrappers, generic `useApi`/`useCsrf` hooks, CSS reset. **No visual design tokens** — each module owns its theme.

### API Communication

- All web modules use `exo-shared` API client → HTTP → Django :8000
- Vite dev servers proxy `/api` to `localhost:8000`
- SSE streaming unchanged

### Key Design Decisions

- Three separate Vite projects, three separate render threads
- No cross-module navigation — each SPA is self-contained
- No more `useAppState` monolith — each module owns its state
- No more v1/v2 dual layout — each module has one routing scheme
- Visual themes are module-level: exo-* palette deprecated

## Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm dev:chat         # Start chat-core dev server (:5173)
pnpm dev:chronicle    # Start chronicle dev server (:5174)
pnpm dev:council      # Start council dev server (:5175)
pnpm build            # Build all packages
```
