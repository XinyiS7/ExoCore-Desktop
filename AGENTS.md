# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

**Parent spec:** `../ReactSheet_Reorganized.md` — API contract (reorganized, this is the active reference).
**API contract (legacy):** `../ExoCore/ReactSheet.txt` — original flat spec, superseded by ReactSheet_Reorganized.md.
**Cross-module context:** `../AGENT.md` and `../.agent/project.md`
**Nginx deployment:** `../nginx/nginx.conf` — reverse proxy config
**Startup script:** `../hybrid_start.ps1` — unified pgvector + Django + nginx launcher

**Shell environment:** Git Bash (Windows). Use Bash tool for shell commands, not PowerShell.

## Repository Boundaries (CRITICAL)

This repo is **ExoCore-Desktop** (React + Vite frontend).

**`../ExoCore/` (Django backend) and `../ExocoreExtension/` (Windows extensions) are separate repositories.**
You may READ their source code and docs to understand API contracts, data models, and existing behavior — but you MUST NEVER modify files in those directories.

If a task requires backend or extension changes:
1. Write a clear spec/doc in `docs/superpowers/specs/` describing what the other repo needs to change
2. Tell the user to hand it off to that repo's agent
3. Do NOT reach across and edit files yourself

## Before You Code

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
