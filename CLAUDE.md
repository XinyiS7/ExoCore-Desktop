# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

**Parent spec:** `../ExoCore-ui/Plan/V3_FRONTEND_SPLIT_DESIGN.md` — approved V3 frontend split design.
**API contract reference:** `../ExoCore/ReactSheet.txt` and (when available) `../ExoCore/.agent/insight/backend.yaml`
**Cross-module context:** `../.agent/project.md` and `../AGENT.md`

**Shell environment:** Git Bash (Windows). Use Bash tool for shell commands, not PowerShell.

# V3 Frontend Split

ExoCore-Desktop is a **monorepo** containing three independent SPAs + a Rust/Tauri desktop shell. All data is served by a single Django backend (port 8000).

## Architecture

### Three Web Modules (packages/)

| Package | Tauri Window | Purpose |
|---|---|---|
| `chat-core` | MainWindow | Agent hub, conversations, projects, files, settings, memory, user profile |
| `chronicle` | TrayPanel (ToolWindow) | Timeline/BBS feed, task management, Google Calendar |
| `council` | CouncilWindow (on-demand) | Multi-agent workspace — **deferred to V3.1** |

### Shared Package

`packages/shared` (`exo-shared`) — API client, CSRF handling, endpoint wrappers, generic `useApi`/`useCsrf` hooks, CSS reset. **No visual design tokens** — each module owns its theme.

### Tauri Shell (tauri/)

- Rust desktop application managing window lifecycle, system tray, sidecar spawning
- Django + wez_bridge run as silent sidecars (no terminal windows — `CREATE_NO_WINDOW` on Windows)
- System tray: left-click toggles MainWindow, right-click menu for all actions
- Council entry point: tray right-click menu only (not inside Chat Core)

### API Communication

- All web modules use `exo-shared` API client → HTTP → Django :8000
- Tauri does NOT proxy API traffic
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
