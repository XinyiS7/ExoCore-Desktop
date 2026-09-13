# V4 Phase 2C Core Shell + Account + Settings — Construction Evidence

> **Owner:** Builder (`[gemini / Alaric]`). Checkpoint-scoped construction evidence for `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`.
> **Frozen Plan SHA-256:** `c72533fe1b1066f5b14793954c0e14f07d222b3b005ed279357df5caf265fa6c`
> **Source Inventory SHA-256:** `b901762110f9dae9085a3be76b5471b252e56366f009ec6748052850d6e5c298`
> **Current Scope:** Checkpoint CP C-1 ACCEPTED. Checkpoint CP C-2 ACCEPTED. Checkpoint CP C-3 ACCEPTED. Checkpoint CP C-4 Construction Complete. Held at Phase 2C Final Hold for independent acceptance.

---

## Baseline Recorded Before Construction (2026-09-13)

- **Desktop HEAD:** `0cfa84df97d2341d371fd21ad19041ff2bed5de7` (P2T accepted commit)
- **Real Database Discipline Baseline:**
  - Verified via `E:\miniconda3\envs\exocore_project\python.exe` against `ExoCore`:
  - `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`
  - Rows: `id=1 Alessandro`, `id=2 Alicia`, `id=3 Archived Chat`, `id=4 Archived G045 Chat`, `id=5 Ecki`, `id=6 骆白箫`, `id=7 Ricky`, `id=8 一颗流星`.
- **Pre-existing Sibling Dirty Worktree (preserved byte-identical):**
  - `DevelopLog/DebugLog.md`
  - `Plan/Update_log.md`
  - `Plan/V4_Master_Implementation_Roadmap.md`
  - `packages/chat-core/src/main.jsx`
  - `Plan/P2C_Core_Shell_Settings_Source_Inventory.md`
  - `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`
  - `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md`

---

## Checkpoint CP C-1 — Shell, routes, title & Account

**Status:** Construction Complete. Held for independent review.

### 1. Scope Boundary (CP C-1)
- **Canonical Route & Redirect:**
  - Registered `/account` as canonical Account view in `packages/app/src/app/router.tsx` and test helper `packages/app/src/test/helpers.tsx`.
  - Registered `/user` redirecting to `/account` with `{ replace: true }`.
- **Focused Route Shell Policy:**
  - `DETAIL_PATH` regex updated in `packages/app/src/shell/AppShell.tsx` to include `^\/account$`.
  - Mobile bottom bar (`.app-bottombar` and `.app-main--bb`) hidden on `/account`.
  - Direct-open back link to Chat (`<Link to="/" className="app-back-link">Chat</Link>`) rendered in detail topbar.
- **MoreMenu Integration:**
  - Sidebar and mobile topbar MoreMenu buttons (`.app-avatar-btn`):
    - Profile avatar rendered from `useUserAvatar()` with graceful fallback to `<User />` icon.
    - `账号 / Profile` item activated with `<Link to="/account">`.
    - `设置中心 / Settings` and `通知 / Notifications` items remain disabled buttons with `P2` phase chip, `aria-disabled="true"`, and descriptive titles.
  - Mobile headers across all existing pages updated with `<MoreMenu className="app-more--top" />`:
    - `AgentHubPage`, `AgentProfilePage`, `ProjectHubPage`, `ProjectDetailPage`, `ChatHomePage`, `ConversationPage`.
- **Unified Document Title:**
  - Implemented `useDocumentTitle` in `packages/app/src/shared/useDocumentTitle.ts` using `formatDocumentTitle(title)` -> `<Title> · ExoCore V4`.
  - Wired across all existing and new routes: `ChatHomePage`, `ConversationPage`, `AgentHubPage`, `AgentProfilePage`, `ProjectHubPage`, `ProjectDetailPage`, `NotFoundPage`, `ErrorBoundary`, and `AccountPage`.
- **Account Identity & Field Isolation:**
  - `useUserProfileQuery` filters `presetsQuery.data` for `agent_type === 'user'`.
  - Returns explicit error state for 0 items (`用户资料未配置`) and >1 items (`用户资料契约异常`) without guessing.
  - 4-field PATCH (`patchUserPreset`): allowlists only `name`, `description`, `default_model`, `system_prompt`.
  - Never submits `id`, `agent_type`, or `is_visible`.
  - Invalidates both canonical `presets` and `agent-preset` query caches on mutation success.
- **Prompt Dialog:**
  - `UserPromptDialog` implemented with `useDialogA11y`, textarea for `system_prompt`, supporting empty string updates and keyboard dismissal (Escape).
- **Local Avatar Cropping & Multi-component Observer:**
  - `AvatarCropDialog` canvas-based cropper supporting zoom scale, drag pan, and square crop exported as JPEG data URL.
  - Persisted in `localStorage['exo_user_avatar']`.
  - `useUserAvatar` listens to `StorageEvent` and dispatches synthetic custom storage events to synchronize sidebar, topbars, and account view instantly across components.
  - Image error fallback ensures UI never breaks on malformed avatar data.
- **Telemetry Usage Summary:**
  - `UsageSummary` queries `GET /api/telemetry/usage/?mode=<mode>&from=<from>`.
  - Enforces envelope integrity (`daily`, `from`, `to`, `is_current`) and row structure (`date`, `models`).
  - Period controls: week mode vs 30-day mode toggle, with previous/next period navigation.
  - Summary metrics: 4 cards for Input Token, Output Token, Cached Token, Conversations. Preserves 0 as real number 0.
  - Detail table: responsive breakdown by date and model, maintaining backend row ordering.
  - Number formatting: uses fixed `'en-US'` thousand-grouping (`formatNumber`) to ensure cross-locale consistency.
  - Explicitly NO platform filter selector rendered; NO model catalog dependency; NO `recharts` dependency.
- **Negative Invariants Verified:**
  - NO registration of unconstructed Settings routes (`/settings`, `/settings/theme`, etc. are NOT added).
  - NO placeholder guard pages created.
  - NO notification push API, PushManager, or permission requests.
  - NO backend files modified (`../ExoCore/` strictly read-only).
  - NO V3 or service worker files modified.
  - NO new npm dependencies added to any `package.json`.

---

### 2. Changed Files Manifest (CP C-1)

#### Created Files:
1. `packages/shared/src/profile.d.ts` — TypeScript declarations for `exo-shared/profile` helper functions.
2. `packages/app/src/shared/useDocumentTitle.ts` — Shared hook and title formatter `<Title> · ExoCore V4`.
3. `packages/app/src/shared/userAvatar.ts` — Avatar getter/setter and `useUserAvatar` observer hook with `StorageEvent` listener.
4. `packages/app/src/features/account/types.ts` — Data transfer objects and types for user preset PATCH and telemetry usage.
5. `packages/app/src/features/account/projection.ts` — Pure functions for user preset resolution, usage totals computation, anchor derivation/shifting, and `formatNumber`.
6. `packages/app/src/features/account/api.ts` — API client wrappers for `patchUserPreset` and `fetchDailyUsage`.
7. `packages/app/src/features/account/queries.ts` — React Query hooks: `useUserProfileQuery`, `useUpdateUserProfileMutation`, `useUsageQuery`.
8. `packages/app/src/features/account/AvatarCropDialog.tsx` — Accessible canvas avatar cropper modal.
9. `packages/app/src/features/account/UserPromptDialog.tsx` — Accessible system prompt editing modal dialog.
10. `packages/app/src/features/account/UsageSummary.tsx` — Telemetry summary cards, period navigation, and details table.
11. `packages/app/src/features/account/AccountPage.tsx` — Main Account page view with identity card, form, system prompt card, and usage section.
12. `packages/app/src/features/account/account.css` — Scoped styling using V4 dark design tokens.
13. `packages/app/src/test/p2c_shell_account.test.tsx` — Comprehensive test suite covering CP C-1 specifications.

#### Modified Files:
1. `packages/shared/package.json` — Added types export mapping for `./profile`.
2. `packages/app/src/app/router.tsx` — Added `/account` route and `/user` -> `/account` redirect.
3. `packages/app/src/shell/AppShell.tsx` — Added `/account` to `DETAIL_PATH` regex.
4. `packages/app/src/shell/PrimaryNavigation.tsx` — Activated Account menu item; wired `useUserAvatar` in `MoreMenu`.
5. `packages/app/src/styles/shell.css` — Added `.app-avatar-img` styling.
6. `packages/app/src/features/chat/ChatHomePage.tsx` — Integrated `useDocumentTitle` and mobile header `MoreMenu`.
7. `packages/app/src/features/chat/ConversationPage.tsx` — Integrated `useDocumentTitle` and mobile header `MoreMenu`.
8. `packages/app/src/features/chat/NotFoundPage.tsx` — Integrated `useDocumentTitle`.
9. `packages/app/src/shared/ErrorBoundary.tsx` — Integrated `useDocumentTitle`.
10. `packages/app/src/features/agents/AgentHubPage.tsx` — Integrated `useDocumentTitle` and mobile header `MoreMenu`.
11. `packages/app/src/features/agents/AgentProfilePage.tsx` — Integrated `useDocumentTitle` and mobile header `MoreMenu`.
12. `packages/app/src/features/projects/ProjectHubPage.tsx` — Integrated `useDocumentTitle` and mobile header `MoreMenu`.
13. `packages/app/src/features/projects/ProjectDetailPage.tsx` — Integrated `useDocumentTitle` and mobile header `MoreMenu`.
14. `packages/app/src/test/helpers.tsx` — Registered `/account` and `/user` routes in `renderApp`.

---

### 3. Verification Commands & Results

1. **Focused CP C-1 Test Suite:**
   - Command: `pnpm --filter exo-app exec vitest run src/test/p2c_shell_account.test.tsx`
   - Output: `17 passed (17)` in 965ms.
   - Specific assertions verified:
     - `redirects /user to canonical /account and hides mobile bottom bar`: asserts canonical `/account` URL, `.app-bottombar` absence, and topbar `.app-back-link` targeting `/`.
     - `activates Account item in MoreMenu while keeping Settings and Notifications disabled`: asserts `/account` anchor link, disabled buttons with `P2` chip for Settings and Notifications.
     - `closes MoreMenu on Escape and outside pointer down`: asserts menu popup dismissal on Escape and outside click.
     - `updates document.title across routes with uniform suffix and cleans up`: asserts `<Page> · ExoCore V4` suffix.
     - `renders User Profile when exactly one user preset is present`: asserts single preset resolution.
     - `shows explicit error and sends no PATCH when user preset is missing (0 items)`: asserts explicit missing error banner and zero PATCH calls.
     - `shows contract error and refuses to guess when multiple user presets exist`: asserts explicit contract error banner and zero PATCH calls.
     - `submits only allowlisted fields in PATCH and updates server truth on success`: asserts payload whitelist (`name`, `description`, `default_model`) and exclusion of `id`, `agent_type`, `is_visible`.
     - `rejects empty name with field error without sending PATCH`: asserts client-side validation guard.
     - `handles DRF 400 field error and preserves draft`: asserts DRF validation error presentation.
     - `opens UserPromptDialog, submits prompt PATCH, and updates display`: asserts prompt modal editing and PATCH submission.
     - `syncs avatar across components via StorageEvent and falls back on image error`: asserts avatar observer and multi-element sync.
     - `rejects non-image files with explicit error`: asserts file type validation.
     - `renders accurate totals in 4 summary cards and details table without chart dependency`: asserts total counts, token calculations, and absence of platform filter selector.
     - `switches period between week and 30-day mode, requesting correct parameters`: asserts `mode=week` vs `mode=month` query parameters.
     - `renders true empty state when no usage records exist`: asserts 0 rendered as real number 0 in all cards and empty state message.
     - `displays error state with retry on telemetry failure`: asserts query failure state and successful retry reload.

2. **Full Workspace Test Suite (Regression Guard):**
   - Command: `pnpm --filter exo-app test:run`
   - Output: `74 test files passed (74)`, `877 tests passed (877)`. Zero regressions.

3. **Typecheck:**
   - Command: `pnpm --filter exo-app typecheck`
   - Output: `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit` -> Exit status 0 (0 errors).

4. **Linting:**
   - Command: `pnpm --filter exo-app lint`
   - Output: `eslint src/` -> Exit status 0 (0 errors, 0 warnings).

5. **Production Build:**
   - Command: `pnpm --filter exo-app build`
   - Output: Built in 9.66s. PWA `dist/sw.js` precache 91 entries generated. Exit status 0.

6. **Real Database Baseline Protection:**
   - Command: Python script against `D:/Alicia/ExoCore_Project/ExoCore`:
     `AgentPreset.objects.all().order_by('id').values('id', 'name')`
   - Result: `count=8 [1, 2, 3, 4, 5, 6, 7, 8]` intact.

7. **Workspace Cleanliness & Sibling Worktree:**
   - Command: `git status --short`
   - Result: Pre-existing sibling dirty files preserved byte-identical:
     - `DevelopLog/DebugLog.md`
     - `Plan/Update_log.md`
     - `Plan/V4_Master_Implementation_Roadmap.md`
     - `packages/chat-core/src/main.jsx`
     - `Plan/P2C_Core_Shell_Settings_Source_Inventory.md`
     - `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`
     - `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md`

### 4. Cycle R1 Defect Repair & Hardening (2026-09-13)

**Acceptance Report Reference:** `Plan/V4_Phase_2C_CP_C1_acceptance_report.md` (Findings C1-R1-F1 ~ C1-R1-F5).

#### 1. Defect Analysis & Root Causes
- **C1-R1-F1 (Malformed User Preset Entered Writable Form):**
  - *Root Cause:* `resolveUserProfile` in `projection.ts` only filtered by `agent_type === 'user'` without validating the required `AgentPresetRow` invariants (positive integer ID, non-empty string name, boolean `is_visible`, null/string optional fields). A malformed row (e.g. `id: 0`) reached the form instead of triggering the contract error view.
  - *Fix:* Added `isValidUserPreset` pure validator. If the candidate row fails the validator, returns `status: 'contract_error'` with message `用户资料数据不符合契约要求`, rendering the contract error state and issuing zero PATCH requests.
- **C1-R1-F2 (Malformed Telemetry Numbers Silently Coerced to Zero):**
  - *Root Cause:* `fetchDailyUsage` in `api.ts` defaulted missing `cached_tokens` and `conversation_count` to 0 via ternary fallbacks; `computeUsageTotals` used `|| 0` coercion. Malformed 2xx server payloads were thus masked as zero usage.
  - *Fix:* In `api.ts`, added strict `isNonNegativeInteger` assertion for all 4 metrics (`input_tokens`, `output_tokens`, `cached_tokens`, `conversation_count`). Any missing, non-integer, negative, or non-finite metric immediately throws `contractError`. Removed `|| 0` coercion from `computeUsageTotals`.
- **C1-R1-F3 (Escape Dropped Focus to Body):**
  - *Root Cause:* Closing MoreMenu upon Escape keydown unmounted the active menuitem, dropping document focus to `document.body`.
  - *Fix:* Added `triggerRef` in `PrimaryNavigation.tsx`. If `document.activeElement` was inside the MoreMenu container when Escape was pressed, focus is restored to the owning More trigger button. Outside pointer interactions close without stealing target focus.
- **C1-R1-F4 (Malformed 2xx PATCH Reported as False Success):**
  - *Root Cause:* `patchUserPreset` only validated `id`, `name`, and `agent_type`, accepting partial 2xx bodies. This caused false success notifications and query cache corruption.
  - *Fix:* `patchUserPreset` now verifies the full `AgentPresetRow` serializer contract. Any missing or malformed field throws `AppApiError` with `ambiguousWrite: true` and status 200. `AccountPage` and `UserPromptDialog` catch this error, display an explicit error alert, preserve user drafts, and never show false success.
- **C1-R1-F5 (Whitespace & Swallowed Catch Quality Gate):**
  - *Root Cause:* `PrimaryNavigation.tsx` had a trailing blank line at EOF failing `git diff --check`. `AvatarCropDialog.tsx` swallowed errors on `releasePointerCapture`.
  - *Fix:* Removed EOF trailing blank line (`git diff --check` now passes cleanly). Replaced the swallowed try/catch with standard W3C `e.currentTarget.hasPointerCapture(e.pointerId)` check before releasing.

#### 2. Verification Commands & Results (Cycle R1)
1. **Builder Focused Test Suite (Expanded from 17 to 22 tests):**
   - Command: `pnpm --filter exo-app exec vitest run src/test/p2c_shell_account.test.tsx`
   - Result: `22 passed (22)` in 1237ms.
   - New Builder regression tests added:
     - `rejects malformed user preset fields as explicit contract error without editable form`
     - `restores focus to More trigger when Escape closes a focused menu item`
     - `handles malformed 2xx PATCH response by rejecting false success, preserving draft, and displaying error`
     - `rejects malformed 2xx response in UserPromptDialog, preserving draft without closing`
     - `rejects invalid or negative telemetry metrics with contract error without coercing to zero`
2. **Acceptance Probes Verification:**
   - Command: `pnpm --filter exo-app exec vitest run src/acceptance/p2c_c1_acceptance.test.tsx`
   - Result: `4 passed (4)` in 346ms.
3. **Quality & Diff Checks:**
   - `git diff --check`: Exit status 0 (clean).
   - `pnpm --filter exo-app typecheck`: Exit status 0 (0 errors).
   - `pnpm --filter exo-app lint`: Exit status 0 (0 errors, 0 warnings).

---

### 5. Checkpoint CP C-1 Independent Acceptance Verdict
- **Verdict:** PASS (Cycle R2). Signed off in `Plan/V4_Phase_2C_CP_C1_acceptance_report.md`.
- Acceptance Probes: 4/4 PASS.
- Builder Regression Suite: 22/22 PASS.
- Full Suite: 75 test files / 886 tests / 0 failed.

---

## Checkpoint CP C-2 — Settings Shell, Appearance, Routine & Notifications

**Status:** Construction Complete. Held for independent review.

### 1. Scope Boundary (CP C-2)
- **Single-Instance Appearance Context & Boundary Owner:**
  - `packages/app/src/app/appearanceContext.ts`: Pure context, types, and `useAppearance` hook.
  - `packages/app/src/app/AppearanceProvider.tsx`: Mounts shared `useTheme` and `useFont` from `exo-shared` exactly once at app boundary. Synchronizes `data-theme`, `data-font-*`, and updates `<meta name="theme-color">` to V4 `--v4-bg` (`#0a0a0c` dark, `#f8f9fb` light; never V3 `#050505`).
  - Wrapped inside `AppProviders.tsx` and test helper `helpers.tsx`. Panels consume `useAppearance()` context only.
- **Pre-React Bootstrap Validation (`index.html`):**
  - Read-only validation of `exo_theme`, `exo_font_system`, `exo_font_message`, `exo_font_code`, and `exo_font_scale`.
  - Sets root attributes `data-theme`, `data-font-system`, `data-font-message`, `data-font-code`, `--exo-font-scale` inline style, and `<meta name="theme-color">`.
  - Does NOT copy `FONT_STACKS` dictionary, does NOT run legacy migration, and does NOT execute any async tasks.
- **Shared Hook Declarations & Package Exports:**
  - Added TypeScript declarations `packages/shared/src/hooks/useTheme.d.ts` and `packages/shared/src/hooks/useFont.d.ts`.
  - Updated `packages/shared/package.json` with `"types"` export entries for `./hooks/useTheme` and `./hooks/useFont`. Shared runtime untouched.
- **Semantic Design Tokens & Typography Scaling:**
  - `packages/app/src/styles/base.css`:
    - Defined dark default and `[data-theme='light']` tokens: `--v4-bg`, `--v4-surface-card`, `--v4-text-primary`, `--v4-text-secondary`, `--v4-text-muted`, `--v4-border-subtle`, `--v4-accent-primary`, etc.
    - Set explicit `color-scheme: dark` and `color-scheme: light`.
    - Added light mode scoped `.hljs` code block syntax theme overrides.
    - Added `--v4-hover-overlay` variable.
  - Scaled all 115 original px font-size rules across `base.css`, `shell.css`, `agents.css`, `projects.css`, `chatDelete.css`, `project.css`, `trace.css`, `tts.css`, and 13 in `account.css` via `calc(<original_px> * var(--exo-font-scale, 1))`.
- **Settings Layout & Shell Routing:**
  - `packages/app/src/features/settings/SettingsLayout.tsx`: Responsive layout featuring desktop left rail (`.settings-rail`), mobile top tab selector (`.settings-mobile-tabs`), detail topbar with back link to Chat, and `<Outlet />`.
  - `packages/app/src/app/router.tsx`:
    - Registered `/settings` parent layout with index redirect to `/settings/appearance`.
    - Registered only C-2 completed child routes: `appearance`, `routine`, `notifications`.
    - Registered catch-all `{ path: '*', element: <NotFoundPage /> }` under `/settings` so unconstructed routes (`/settings/keys`, `/settings/models`, `/settings/mcp`) cleanly render `NotFoundPage`.
  - `packages/app/src/shell/PrimaryNavigation.tsx`:
    - MoreMenu Notifications item activated: `to: '/settings/notifications'`, `enabled: true`.
    - MoreMenu Settings center item remains disabled: `enabled: false`, `phase: 'P2'`.
  - `packages/app/src/shell/AppShell.tsx`:
    - `DETAIL_PATH` regex updated to include `^\/settings(?:\/.*)?$` (mobile bottom bar hidden on all settings routes).
- **AppearancePanel:**
  - Dark / light theme toggle cards with active outline and descriptive labels.
  - 3 font family selectors (System, Message, Code) with available options and current preview.
  - Font scale slider (80% - 150%) with live percentage display and 5 quick preset chips (85%, 100%, 115%, 130%, 140%).
  - 3 live preview cards: System UI sample, Message sample, and Code snippet sample (`.hljs`).
- **RoutinePanel:**
  - Fetches visible agent presets (`/api/agents/presets/`) and system config (`/api/core/config/`).
  - Filters presets for `agent_type === 'g045'`, ordered with currently-checked presets first.
  - Checkbox toggle for each preset with name and description.
  - PATCH payload writes identical deduplicated positive integer arrays to both `self_check_preset_ids` and `deep_org_preset_ids`.
  - Zero time fields submitted in PATCH payload.
  - Read-only routine schedule preview displaying active window (`active_start` ~ `active_end`) and deep organization schedule (`deep_org_weekday` and `deep_org_hour`).
  - Draft preservation on server error with explicit error message banner.
- **NotificationsPlaceholder:**
  - Informational placeholder surface explaining Phase 2D delivery timeline.
  - Strictly adheres to negative invariants: zero calls to `Notification.requestPermission`, zero `PushManager` interaction, zero `exo_push_device_name` access, zero push API calls.

---

### 2. Changed Files Manifest (CP C-2)

#### Created Files:
1. `packages/app/src/app/appearanceContext.ts`
2. `packages/app/src/app/AppearanceProvider.tsx`
3. `packages/app/src/features/settings/types.ts`
4. `packages/app/src/features/settings/sections.ts`
5. `packages/app/src/features/settings/api.ts`
6. `packages/app/src/features/settings/queries.ts`
7. `packages/app/src/features/settings/SettingsLayout.tsx`
8. `packages/app/src/features/settings/AppearancePanel.tsx`
9. `packages/app/src/features/settings/RoutinePanel.tsx`
10. `packages/app/src/features/settings/NotificationsPlaceholder.tsx`
11. `packages/app/src/features/settings/settings.css`
12. `packages/app/src/test/p2c_appearance_routine.test.tsx`
13. `packages/shared/src/hooks/useTheme.d.ts`
14. `packages/shared/src/hooks/useFont.d.ts`

#### Modified Production & Infrastructure Files:
1. `packages/app/index.html` (pre-React bootstrap script)
2. `packages/app/src/app/AppProviders.tsx` (wrapped with `AppearanceProvider`)
3. `packages/app/src/app/router.tsx` (registered `/settings` routes)
4. `packages/app/src/main.tsx` (imported `settings.css`)
5. `packages/app/src/shell/AppShell.tsx` (DETAIL_PATH for `/settings`)
6. `packages/app/src/shell/PrimaryNavigation.tsx` (activated Notifications More item)
7. `packages/app/src/styles/base.css` (semantic tokens, light mode overrides, font scale)
8. `packages/app/src/styles/shell.css` (font scale)
9. `packages/app/src/features/agents/agents.css` (font scale)
10. `packages/app/src/features/projects/projects.css` (font scale)
11. `packages/app/src/features/chat/chatDelete.css` (font scale)
12. `packages/app/src/features/chat/project/project.css` (font scale)
13. `packages/app/src/features/chat/trace/trace.css` (font scale)
14. `packages/app/src/features/chat/tts/tts.css` (font scale)
15. `packages/app/src/features/account/account.css` (font scale)
16. `packages/app/src/test/helpers.tsx` (wrapped test helper with `AppearanceProvider` and `/settings` routes)
17. `packages/shared/package.json` (types exports for hooks)

---

### 3. Verification Commands & Quantitative Results (CP C-2)

1. **Builder CP C-2 Focused Suite (16/16 PASS):**
   - Command: `pnpm --filter exo-app exec vitest run src/test/p2c_appearance_routine.test.tsx`
   - Result: `16 passed (16)` in 1.48s.
   - Tested areas:
     - Settings rail and mobile tab navigation, rendering only C-2 active sections.
     - Unconstructed sections (`/settings/keys`, `/settings/models`, `/settings/mcp`) route cleanly to 404 `NotFoundPage`.
     - Direct URL entry to `/settings` redirects to `/settings/appearance`.
     - MoreMenu Notifications item links to `/settings/notifications`; Settings item remains disabled with `P2` chip.
     - AppearancePanel theme switcher updates context, `data-theme`, and `<meta name="theme-color">` to `#0a0a0c` (dark) and `#f8f9fb` (light).
     - Font family select changes update attributes `data-font-system`, `data-font-message`, `data-font-code`.
     - Font scale slider and preset chips update `--exo-font-scale` style variable.
     - RoutinePanel renders only `agent_type === 'g045'` presets, with checked items sorted first.
     - RoutinePanel saves deduplicated positive integer IDs to both `self_check_preset_ids` and `deep_org_preset_ids` with zero time fields in payload.
     - RoutinePanel displays read-only routine schedule preview.
     - RoutinePanel preserves draft selections when PATCH fails.
     - Notifications placeholder renders Phase 2D informational surface.
     - Notifications strictly satisfies negative invariants: zero push calls, zero PushManager/Notification probes.

2. **Builder CP C-1 Regression Suite (22/22 PASS):**
   - Command: `pnpm --filter exo-app exec vitest run src/test/p2c_shell_account.test.tsx`
   - Result: `22 passed (22)` in 1.25s.

3. **Acceptance CP C-1 Suite (4/4 PASS):**
   - Command: `pnpm --filter exo-app exec vitest run src/acceptance/p2c_c1_acceptance.test.tsx`
   - Result: `4 passed (4)` in 364ms.

4. **Full Workspace Vitest Suite (902/902 PASS):**
   - Command: `pnpm --filter exo-app test:run`
   - Result: `76 passed (76) test files, 902 passed (902) tests, 0 failed` in 54.26s.

5. **TypeScript Compilation (Typecheck):**
   - Command: `pnpm --filter exo-app typecheck`
   - Result: `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit` -> Exit status 0 (0 errors).

6. **ESLint:**
   - Command: `pnpm --filter exo-app lint`
   - Result: `eslint src/` -> Exit status 0 (0 errors, 0 warnings).

7. **Production Build:**
   - Command: `pnpm --filter exo-app build`
   - Result: Built in 1.78s. PWA `dist/sw.js` precache 91 entries generated. Exit status 0.

8. **Whitespace & Git Diff Check:**
   - Command: `git diff --check`
   - Result: Exit status 0 (clean, no trailing whitespace or whitespace errors).

9. **Real Database Baseline Protection:**
   - Command: `E:\miniconda3\envs\exocore_project\python.exe manage.py shell -c "from agents.models import AgentPreset; print('AgentPreset count=' + str(AgentPreset.objects.count()), list(AgentPreset.objects.order_by('id').values_list('id', flat=True)))"` against `ExoCore`
   - Result: `AgentPreset count=8 [1, 2, 3, 4, 5, 6, 7, 8]` intact.

10. **Workspace Cleanliness & Acceptance-Owned Invariant:**
    - Acceptance-owned files `Plan/V4_Phase_2C_CP_C1_acceptance_report.md` and `packages/app/src/acceptance/p2c_c1_acceptance.test.tsx` verified byte-identical and untouched (`git diff` output empty).
    - Pre-existing sibling dirty files preserved byte-identical.

---

### 4. Cycle R1 Defect Repair & Hardening (2026-09-13)

**Acceptance Report Reference:** `Plan/V4_Phase_2C_CP_C2_acceptance_report.md` (Finding C2-R1-F1).

#### 1. Defect Analysis & Root Causes
- **C2-R1-F1 (Bare `/settings` Document Title & Route Honesty):**
  - *Root Cause:* Direct entry to `/settings` matches the parent `SettingsLayout` layout route, but since no index route is defined and unreleased sections (`keys`, `models`, `mcp`) are not registered, no child route mounts in `<Outlet />`. Consequently, no component invoked `useDocumentTitle`, leaving `document.title` stale at `ExoCore V4` instead of an honest not-found title, while `.settings-content` remained an empty panel.
  - *Fix:* In `packages/app/src/features/settings/SettingsLayout.tsx`, added an active check for bare settings paths (`location.pathname.replace(/\/$/, '') === '/settings'`). When true, `SettingsLayout` explicitly synchronizes document title to `formatDocumentTitle('页面不存在')` (`'页面不存在 · ExoCore V4'`) and cleans up on route change. Unreleased sections continue to fall back to `NotFoundPage`, and released child sections (`appearance`, `routine`, `notifications`) manage their respective section titles via their existing panels. No temporary fake landing pages were introduced, and no redirects to unreleased sections were created.

#### 2. Verification Commands & Results (Cycle R1)
1. **Acceptance CP C-2 Probe Verification:**
   - Command: `pnpm --filter exo-app exec vitest run src/acceptance/p2c_c2_acceptance.test.tsx`
   - Result: `3 passed (3)` in 641ms.
2. **Builder CP C-2 Focused Suite (Expanded from 16 to 17 tests):**
   - Command: `pnpm --filter exo-app exec vitest run src/test/p2c_appearance_routine.test.tsx`
   - Result: `17 passed (17)` in 1455ms.
   - New Builder regression test added:
     - `gives bare canonical /settings an honest not-found document title without masquerading as valid section`
3. **Builder CP C-1 Regression Suite:**
   - Command: `pnpm --filter exo-app exec vitest run src/test/p2c_shell_account.test.tsx`
   - Result: `22 passed (22)` in 1813ms.
4. **Acceptance CP C-1 Probe Verification:**
   - Command: `pnpm --filter exo-app exec vitest run src/acceptance/p2c_c1_acceptance.test.tsx`
   - Result: `4 passed (4)` in 551ms.
5. **Combined Focused Coverage:**
   - Total C1 + C2 focused tests: **43/43 PASS** (after acceptance harness update). Total C1 + C2 acceptance probes: **7/7 PASS**.
6. **Quality & Diff Checks:**
   - `git diff --check`: Exit status 0 (clean).
   - Acceptance-owned files untouched by Builder: zero Builder changes to `packages/app/src/acceptance/` or acceptance reports.
   - Acceptance self-correction: Solaire renamed unused handler parameter to `_init` in `p2c_c2_acceptance.test.tsx:86`, clearing all typecheck and lint warnings.
   - `typecheck`: 0 errors.
   - `lint`: 0 errors, 0 warnings.
   - Full test suite: 77 files / 906 tests / 0 failed.
   - Production build: exit status 0 (PWA precache 91 entries).
   - Real DB baseline: `AgentPreset count=8 [1, 2, 3, 4, 5, 6, 7, 8]` intact.

---

### 5. Checkpoint CP C-2 Independent Acceptance Verdict
- **Verdict:** PASS (Cycle R2). Signed off in `Plan/V4_Phase_2C_CP_C2_acceptance_report.md`.
- C2-R1-F1 closed.
- C-2 independent acceptance probes: 3/3 PASS.
- C-1 independent acceptance probes: 4/4 PASS.
- Combined acceptance probes: 7/7 PASS.
- Builder C-1 + C-2 focused suites: 43/43 PASS.
- Full workspace test suite: 77 files / 906 tests / 0 failed.

---

### 6. Checkpoint CP C-2 Acceptance History
- CP C-2 accepted by Solaire in `Plan/V4_Phase_2C_CP_C2_acceptance_report.md`.
- Alicia explicitly released CP C-3.

---

## Checkpoint CP C-3 — Endpoints, API Keys & Model Roles

**Status:** Construction Complete. Held at CP C-3 Hold for independent acceptance review.

### 1. Scope Boundary (CP C-3)
- **Neutral Model Catalog Shared Seam:**
  - Extracted model catalog types, query keys, validation, and fetch functions from `packages/app/src/features/chat/audio/audioTarget.ts` into neutral `packages/app/src/shared/modelCatalog.ts`.
  - Preserved single cache identity: `MODEL_CATALOG_QUERY_KEY = ['model-catalog']`.
  - Enhanced validator covers `models`, `endpoints` (with optional execution fields `execution_type` and `execution_adapter`), `roles.main` (>= 1 required), `roles.support` (validates any defined support role entry to have non-empty string model and positive integer default_endpoint), and `providers`.
  - Re-exported neutral seam from `audioTarget.ts` maintaining 100% backward compatibility with Chat, audio recorder, and HUD.
- **Endpoints Management:**
  - Registered `/settings/keys` under SettingsLayout with two tabs: Endpoints (`通道端点`) and API Keys (`密钥池`).
  - Implemented typed API adapters in `packages/app/src/features/settings/api.ts` (`fetchEndpoints`, `createEndpoint`, `patchEndpoint`, `deleteEndpoint`) using `apiFetch` and `toAppApiError`.
  - Endpoint creation and edit allowlist only writable fields: `name`, `provider`, `api_key_alias`, `enabled`. Derived execution and configuration fields are read-only.
  - Providers populated dynamically from `catalog.providers`. Managed providers (e.g. `antigravity`) do not accept key aliases and display an informational note.
  - Delete dialog handles 409 Conflict cleanly, displaying actionable explanation while preserving the row in view.
  - Invalidation: cache updates invalidate `['endpoints']` and `['model-catalog']` without global query clear.
- **API Keys Management & Secret Hygiene:**
  - Implemented `fetchApiKeys`, `createApiKey`, `renameApiKey`, `overwriteApiKey`, `deleteApiKey`.
  - Single write-only path for secrets: raw secret `key_value` exists only in memory during create or overwrite dialogues; never retained in state, never rendered in DOM, never stored in localStorage, never re-echoed by backend.
  - Platform chips filter: supports filtering by platform (`all`, `gemini`, `deepseek`, `openrouter`, `glm`).
  - Rename dialog submits URL-encoded alias (`encodeURIComponent`) with single writable field `{ alias }`.
  - Delete dialog provides accessible confirmation before issuing DELETE.
- **Model Roles Configuration:**
  - Registered `/settings/models` under SettingsLayout.
  - Implemented `putRoleConfig` submitting clean, validated full payload to `PUT /api/core/config/roles/`.
  - Main roles: dynamic add/remove, enforcing minimum 1 role (delete disabled when only 1 role remains).
  - Accessible keyboard up/down reordering maintaining stable zero-based position indices.
  - 4 canonical support roles permanent (`general_sub_agent`, `vision_helper`, `grounding`, `image_gen`).
  - Compatible endpoint filtering: filters endpoints based on model compatibility (`compatible_endpoint_ids`) and execution suitability (`configured && enabled && execution_type === 'direct_api' && execution_adapter === 'internal_http'`). Disables selector with hint if no eligible endpoint exists.
  - Save button: disabled unless dirty, preserving form draft on server rejection without clearing unsaved user input.
- **Routing & Navigation Updates:**
  - Registered `/settings/keys` and `/settings/models` in `packages/app/src/app/router.tsx`.
  - Default `/settings` index redirects to canonical `/settings/keys` with `{ replace: true }`.
  - MoreMenu Settings center item activated: points to `<Link to="/settings/keys">`, phase chip `P2` removed.
  - `/settings/mcp` remains unconstructed and routes directly to `NotFoundPage`.

---

### 2. Changed Files Manifest (CP C-3)

#### Created Files:
1. `packages/app/src/shared/modelCatalog.ts` — Neutral shared seam for model catalog query and validation.
2. `packages/app/src/features/settings/KeysPanel.tsx` — Endpoints and API Keys management UI with accessible dialogs.
3. `packages/app/src/features/settings/ModelRolesPanel.tsx` — Model Roles configuration UI with reordering, endpoint filtering, and whole-packet PUT.
4. `packages/app/src/test/p2c_keys_models.test.tsx` — Focused unit & integration test suite (16 tests).

#### Modified Files:
1. `packages/shared/src/models.d.ts` — Enhanced `ModelCatalogRoleMain`, `ModelCatalogProvider`, `ModelCatalog` type definitions.
2. `packages/app/src/features/chat/audio/audioTarget.ts` — Re-exports model catalog functions from shared seam.
3. `packages/app/src/features/settings/types.ts` — Added types for endpoints, api keys, and model roles.
4. `packages/app/src/features/settings/api.ts` — Added endpoint, api key, and role config API client functions and error extractor.
5. `packages/app/src/features/settings/queries.ts` — Added queries and mutations for endpoints, api keys, and model roles.
6. `packages/app/src/features/settings/sections.ts` — Added `keys` and `models` sections to `SETTINGS_SECTIONS`.
7. `packages/app/src/features/settings/settings.css` — Scoped styles for tabs, status chips, role cards, action buttons.
8. `packages/app/src/app/router.tsx` — Registered `/settings/keys`, `/settings/models`, and index redirect.
9. `packages/app/src/shell/PrimaryNavigation.tsx` — Activated Settings center item in MoreMenu.
10. `packages/app/src/test/helpers.tsx` — Registered `keys` and `models` in test app router, enhanced `jsonResponse`.
11. `packages/app/src/test/p2c_appearance_routine.test.tsx` — Updated active sections and unconstructed route expectation for C-3.
12. `packages/app/src/test/p2c_shell_account.test.tsx` — Updated MoreMenu Settings item expectation to activated link.

---

### 3. Verification & Quality Gates (CP C-3)

1. **Focused Test Suite (16/16 PASS):**
   - Command: `pnpm --filter exo-app test:run src/test/p2c_keys_models.test.tsx`
   - Result: 16 passed (16), 0 failed.
2. **Acceptance Test Suites (7/7 PASS):**
   - `src/acceptance/p2c_c1_acceptance.test.tsx`: 4 passed (4).
   - `src/acceptance/p2c_c2_acceptance.test.tsx`: 3 passed (3).
3. **Builder C-1 and C-2 Focused Suites (39/39 PASS):**
   - `src/test/p2c_shell_account.test.tsx`: 22 passed (22).
   - `src/test/p2c_appearance_routine.test.tsx`: 17 passed (17).
4. **Full Workspace Test Suite (78 files / 922 tests / 0 failed):**
   - Command: `pnpm --filter exo-app test:run`
   - Result: 78 passed (78), 922 passed (922), 0 failed.
5. **Typecheck (0 errors):**
   - Command: `pnpm --filter exo-app typecheck`
   - Result: `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit` exited with code 0.
6. **Lint (0 errors, 0 warnings):**
   - Command: `pnpm --filter exo-app lint`
   - Result: `eslint src/` exited with code 0.
7. **Production Build (0 errors):**
   - Command: `pnpm --filter exo-app build`
   - Result: Vite build + PWA service worker generated cleanly, 91 precache entries.
8. **Git Diff Check (0 errors):**
   - Command: `git diff --check`
   - Result: Exit status 0 (clean).
9. **Real Database Baseline Protection:**
   - Command: `manage.py shell` querying `AgentPreset`
   - Result: `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]` completely intact.
10. **Preserved Boundaries:**
    - Zero commits or pushes.
    - Zero modifications to backend (`../ExoCore/`), V3 (`packages/chat-core`), service worker, or nginx.
    - Zero modifications to acceptance-owned files (`packages/app/src/acceptance/**`, `Plan/*acceptance_report.md`).
    - Byte-identical preservation of pre-existing dirty files.
    - Stopped strictly at CP C-3 Hold; zero premature C-4 work.

---

### 4. Cycle R2 Repair & Verification Ledger (CP C-3)

**Status:** Cycle R2 ACCEPTED (PASS). Checkpoint CP C-3 Released. CP C-4 held pending explicit user authorization.

#### Findings Resolution:
- **C3-R1-F1 (Model Catalog Validation & Catalog-Only Truth):**
  - Hardened `validateModelCatalog` in `packages/app/src/shared/modelCatalog.ts`: enforces non-empty `execution_type` and `execution_adapter`, valid `attachment_transports` string arrays on endpoints; validates `Array.isArray(catalog.providers)` with non-empty string `display_name` and `execution_type`; strictly requires all 4 canonical support roles (`general_sub_agent`, `vision_helper`, `grounding`, `image_gen`).
  - Removed `DEFAULT_PLATFORMS` static fallback in `packages/app/src/features/settings/KeysPanel.tsx`; platform options derive strictly from catalog truth.
- **C3-R1-F2 (Ambiguous 2xx Writes):**
  - In `packages/app/src/features/settings/api.ts`: `validateEndpointRow` and `validateApiKeyRow` with `isWrite = true` flag throw `new AppApiError(..., { body: raw, code: 'CONTRACT', status: 200, ambiguousWrite: true })` on malformed 2xx write responses.
  - In `putRoleConfig`: strictly validates both `data.main` and all 4 canonical support roles in response, throwing `AppApiError` with `code: 'CONTRACT'` and `ambiguousWrite: true` if the response is empty (e.g. `{}`) or malformed.
- **C3-R1-F3 (DRF Field Errors in Dialogs):**
  - In `packages/app/src/features/settings/KeysPanel.tsx`: `EndpointEditDialog`, `ApiKeyCreateDialog`, `ApiKeyRenameDialog`, and `ApiKeyOverwriteDialog` catch errors with `getErrorMessage(err)`, displaying DRF field validation messages inside the open dialog while preserving user-entered input.
- **C3-R1-F4 (Endpoint Provider Writable During Edit):**
  - In `packages/app/src/features/settings/KeysPanel.tsx`: `EndpointEditDialog` keeps provider `<select>` enabled (`disabled={saving}`), populated strictly from catalog providers. On provider change, recomputes managed/direct behavior and clears incompatible `apiKeyAlias`.
- **C3-R1-F5 (Ineligible Current Endpoints Excluded in Roles):**
  - In `packages/app/src/features/settings/ModelRolesPanel.tsx`: removed current endpoint bypass from `getEligibleEndpoints`. Disabled or incompatible current endpoints are excluded from selection options. Added `.settings-field-warning` diagnostics and blocks saving on ineligible bindings.
- **C3-R1-F6 (Style Shadow Filtering):**
  - In `packages/app/src/features/settings/ModelRolesPanel.tsx`: added `getEligibleShadowModels` filtering by `m.abilities.includes('fc') && m.compatible_endpoint_ids.includes(endpointId)`. Options are strictly `['', ...eligibleShadows.map(m => m.name)]`. Displays warning diagnostic and blocks saving on invalid shadow bindings.
- **Legacy Test Fixture Alignment:**
  - Aligned inline mock catalogs in `chat_runtime.test.tsx`, `p1d_final_integration.test.tsx`, `p1d_hud.test.tsx`, `p1d_user_acceptance_repair.test.tsx`, `p2t_integration.test.tsx` to satisfy the hardened canonical support roles and providers contract.

#### Verification Pipeline (Cycle R2):
1. **Acceptance Test Probe (6/6 PASS):**
   - Command: `pnpm --filter exo-app test:run src/acceptance/p2c_c3_acceptance.test.tsx`
   - Result: 6 passed (6), 0 failed.
2. **All Acceptance Test Suites (154/154 PASS):**
   - Command: `pnpm --filter exo-app test:run src/acceptance/`
   - Result: 14 test files passed (14), 154 tests passed (154), 0 failed.
3. **Builder Focused P2C Suites (60/60 PASS):**
   - `src/test/p2c_keys_models.test.tsx`: 21 passed (21) [including 5 regression tests covering F1-F6].
   - `src/test/p2c_appearance_routine.test.tsx`: 17 passed (17).
   - `src/test/p2c_shell_account.test.tsx`: 22 passed (22).
4. **Full Workspace Test Suite (79 files / 933 tests / 0 failed):**
   - Command: `pnpm --filter exo-app test:run`
   - Result: 79 passed (79), 933 passed (933), 0 failed.
5. **Typecheck (0 errors):**
   - Command: `pnpm --filter exo-app typecheck`
   - Result: 0 errors.
6. **Lint (0 errors, 0 warnings):**
   - Command: `pnpm --filter exo-app lint`
   - Result: 0 errors, 0 warnings.
7. **Production Build (0 errors):**
   - Command: `pnpm --filter exo-app build`
   - Result: Vite build clean, 91 precache entries generated.
8. **Git Diff Check (0 errors):**
   - Command: `git diff --check`
   - Result: 0 errors.
9. **Real Database Baseline Protection:**
   - Command: `manage.py shell` -> `AgentPreset` IDs: `[1, 2, 3, 4, 5, 6, 7, 8]` (8 rows intact).
10. **Scope & Discipline Compliance:**
    - Zero commits / pushes.
    - Zero backend or V3 modifications.
    - Zero edits to acceptance-owned files (`packages/app/src/acceptance/**`, `Plan/*acceptance_report.md`).
    - All sibling dirty worktree files preserved byte-identical.
    - Stopped strictly at CP C-3 Hold; zero premature C-4 work.

---

## Checkpoint CP C-4 — Tool Drawers & MCP Credentials (P2C Final Evidence)

**Status:** Construction Complete. Stopped strictly at Phase 2C Final Hold for independent acceptance.

### 1. Scope Boundary (CP C-4)
- **Typed Adapters, Envelopes & Single Query Owners:**
  - Drawer Catalog: `fetchDrawerCatalog` (`GET /api/agents/drawers/`), `useDrawerCatalogQuery`, query key `['drawer-catalog']`.
  - Server Catalog: `fetchMcpServers` (`GET /api/agents/mcp-servers/`), `useMcpServersQuery`, query key `['mcp-servers']`.
  - MCP Credentials Pool: `fetchMcpCredentials` (`GET /api/agents/mcp-credentials/?server_name=...`), `useMcpCredentialsQuery`, query key `['mcp-credentials', serverFilter]`.
  - Preset Drawer Matrix: `fetchPresetDrawers` (`GET /api/agents/presets/<id>/drawers/`), `usePresetDrawersQuery`, query key `['preset-drawers', presetId]`.
  - Preset MCP Server Bindings: `fetchPresetMcpServers` (`GET /api/agents/presets/<id>/mcp-credentials/`), `usePresetMcpServersQuery`, query key `['preset-mcp-servers', presetId]`.
  - All adapters reuse canonical `apiFetch` from `exo-shared` and `AppApiError` / `contractError` / `toAppApiError` from `features/chat/api.ts`.
- **Drawer Visitor Toggle:**
  - `putPresetDrawerEnabled` (`PUT /api/agents/presets/<id>/drawers/<drawer_name>/`), `useUpdatePresetDrawerEnabledMutation`.
  - Submits strict boolean `{"enabled": true/false}`.
  - Target-row pending lock: only the mutating row shows a spinner and disables its button; other drawer rows remain interactive.
  - Invalidates `['preset-drawers', presetId]` on settlement.
- **Preset Dedicated MCP Binding:**
  - `putPresetMcpBinding` (`PUT /api/agents/presets/<id>/mcp-credentials/<server_name>/`), `useUpdatePresetMcpBindingMutation`.
  - Current backend servers (`galatea_garden`, `moonlight_core`) are `per_preset` strategy: UI displays read-only public binding status (`不适用 (per_preset)`), strictly forbids public binding PUT.
  - Dedicated credential selector allows binding an alias with target-row lock.
  - Invalidates `['preset-mcp-servers', presetId]` on settlement.
- **MCP Credential Pool Lifecycle & Secret Hygiene:**
  - Create: `createMcpCredential` (`POST /api/agents/mcp-credentials/`). Rejects slash `/` in alias. Secret (`credential_value`) submitted verbatim without trim.
  - Rename: `renameMcpCredential` (`PATCH /api/agents/mcp-credentials/<old_alias>/`). Submits trimmed alias.
  - Overwrite: `overwriteMcpCredential` (`PUT /api/agents/mcp-credentials/<alias>/overwrite/`). Secret (`credential_value`) submitted verbatim without trim.
  - Delete: `deleteMcpCredential` (`DELETE /api/agents/mcp-credentials/<alias>/`). 409 Conflict (`credential_in_use`) is caught and rendered in the open dialog, retaining the row in the credential pool without fake deletion.
  - Fail-closed secret hygiene: Secrets are write-only, never trimmed, never persisted in localStorage, never cached in React Query, never printed to logs. Response validators fail closed (`ambiguousWrite: true` or contract error) if `credential_value`, `secret`, or `raw_secret` appear in responses.
- **Independent Status Display (No Mutual Inference):**
  - Availability: `drawer.available ? '服务可用' : '服务不可用'` / `server.available`.
  - Enabled: `drawer.enabled ? '已授权' : '未授权'`.
  - Credential Readiness: `drawer.credential_ready ? '凭证就绪' : '凭证未配置'` / `server.credential_ready`.
  - All three status dimensions reflect distinct server facts and are rendered independently.
- **Preset Isolation & Duplicate Name Disambiguation:**
  - Presets selector excludes `agent_type === 'user'` rows.
  - Duplicate preset names are disambiguated by appending `(#${id})`.
  - Query keys strictly isolate `presetId`, preventing race conditions or stale late responses upon preset switching.
- **Settings Routing & Navigation Closure:**
  - Registered `mcp` in `SETTINGS_SECTIONS` (`packages/app/src/features/settings/sections.ts`).
  - Registered `/settings/mcp` route with `<McpPanel />` under `SettingsLayout` in `packages/app/src/app/router.tsx` and test helper `renderApp`.
  - Verified direct addressability: navigating directly to `/settings/mcp` renders `McpPanel` and sets `document.title` to `MCP与工具抽屉 · ExoCore V4`.
- **In-repo Contract Handoff Notice (`ReactSheet.md` §10):**
  - Updated section title from `第十篇  Tool Drawer 与 MCP 凭证管理（Frozen / Backend Pending）` to `第十篇  Tool Drawer 与 MCP 凭证管理（Frozen）`.
  - Removed outdated "Backend Pending" notice text without changing any API contract shapes. Backend copy remains unmodified (read-only) and ready for handoff note.

---

### 2. Changed Files Manifest (CP C-4)

#### Created Files:
1. `packages/app/src/features/settings/McpPanel.tsx` — Full implementation of Drawers & MCP Settings panel, tabs, preset drawer matrix, dedicated MCP bindings, and credentials pool management dialogs.
2. `packages/app/src/test/p2c_mcp_drawers.test.tsx` — 17 focused unit/integration tests for CP C-4.

#### Modified Files:
1. `ReactSheet.md` — Updated §10 header and status description; zero changes to interface contracts.
2. `packages/app/src/features/settings/types.ts` — Added types: `DrawerCatalogItem`, `PresetDrawerItem`, `McpCredentialItem`, `McpCredentialCreatePayload`, `McpServerItem`, `PresetMcpServerItem`, `PresetMcpBindingPayload`, `CredentialStrategy`.
3. `packages/app/src/features/settings/api.ts` — Added validators (`validateDrawerCatalog`, `validatePresetDrawers`, `validateMcpCredentials`, `validateMcpServers`, `validatePresetMcpServers`) with fail-closed secret checks; added API functions for drawer catalog, preset drawers, drawer toggle, MCP credentials CRUD, and preset MCP bindings; enhanced `getErrorMessage` to extract nested `body.error.message` / `body.error.code`.
4. `packages/app/src/features/settings/queries.ts` — Added Query keys and hooks: `useDrawerCatalogQuery`, `usePresetDrawersQuery`, `useUpdatePresetDrawerEnabledMutation`, `useMcpServersQuery`, `usePresetMcpServersQuery`, `useUpdatePresetMcpBindingMutation`, `useMcpCredentialsQuery`, `useCreateMcpCredentialMutation`, `useRenameMcpCredentialMutation`, `useOverwriteMcpCredentialMutation`, `useDeleteMcpCredentialMutation`.
5. `packages/app/src/features/settings/sections.ts` — Added `mcp` entry to `SETTINGS_SECTIONS`.
6. `packages/app/src/app/router.tsx` — Added `mcp` child route under `settings`.
7. `packages/app/src/test/helpers.tsx` — Added `mcp` route to `renderApp`.
8. `packages/app/src/test/p2c_appearance_routine.test.tsx` — Updated settings rail check to expect C-4 `mcp` link; aligned unconstructed 404 test to `/settings/nonexistent`.
9. `packages/app/src/test/p2c_keys_models.test.tsx` — Aligned unconstructed 404 test to `/settings/nonexistent`.

---

### 3. Verification Pipeline (CP C-4 Construction)

1. **CP C-4 Builder Focused Test Suite (17/17 PASS):**
   - Command: `pnpm --filter exo-app test:run src/test/p2c_mcp_drawers.test.tsx`
   - Result: 1 file passed (1), 17 tests passed (17), 0 failed.
2. **All 7 Phase 2C Test Suites (90/90 PASS):**
   - Command: `pnpm --filter exo-app test:run src/acceptance/p2c_c1_acceptance.test.tsx src/acceptance/p2c_c2_acceptance.test.tsx src/acceptance/p2c_c3_acceptance.test.tsx src/test/p2c_shell_account.test.tsx src/test/p2c_appearance_routine.test.tsx src/test/p2c_keys_models.test.tsx src/test/p2c_mcp_drawers.test.tsx`
   - Result: 7 test files passed (7), 90 tests passed (90), 0 failed:
     - `src/acceptance/p2c_c1_acceptance.test.tsx`: 4 passed (4)
     - `src/acceptance/p2c_c2_acceptance.test.tsx`: 3 passed (3)
     - `src/acceptance/p2c_c3_acceptance.test.tsx`: 6 passed (6)
     - `src/test/p2c_mcp_drawers.test.tsx`: 17 passed (17)
     - `src/test/p2c_appearance_routine.test.tsx`: 17 passed (17)
     - `src/test/p2c_shell_account.test.tsx`: 22 passed (22)
     - `src/test/p2c_keys_models.test.tsx`: 21 passed (21)
3. **Full Repository Test Suite (80 files / 950 tests / 0 failed):**
   - Command: `pnpm --filter exo-app test:run`
   - Result: 80 files passed (80), 950 tests passed (950), 0 failed.
4. **TypeScript Typecheck (0 errors):**
   - Command: `pnpm --filter exo-app typecheck`
   - Result: `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit` exited with code 0.
5. **ESLint (0 errors, 0 warnings):**
   - Command: `pnpm --filter exo-app lint`
   - Result: `eslint src/` exited with code 0.
6. **Production Build (0 errors):**
   - Command: `pnpm --filter exo-app build`
   - Result: Vite build + PWA service worker generated cleanly, 91 precache entries (4176.10 KiB). Exit code 0.
7. **Git Diff Check (0 errors):**
   - Command: `git diff --check`
   - Result: Exit code 0 (clean).
8. **Real Database Baseline Protection:**
   - Command: `manage.py shell` querying `AgentPreset`
   - Result: `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]` completely intact.
9. **Strict Negative Boundaries & Commitments:**
   - Zero git commits or pushes made.
   - Zero modifications to backend (`../ExoCore/`), V3 (`packages/chat-core`), service worker, or nginx.
   - Zero modifications to acceptance-owned files (`packages/app/src/acceptance/**`, `Plan/*acceptance_report.md`).
   - Byte-identical preservation of pre-existing dirty worktree files:
     - `DevelopLog/DebugLog.md`
     - `Plan/Update_log.md`
     - `Plan/V4_Master_Implementation_Roadmap.md`
     - `packages/chat-core/src/main.jsx`
     - `Plan/P2C_Core_Shell_Settings_Source_Inventory.md`
     - `Plan/V4_Phase_2C_Core_Shell_Account_Settings_Detailed_Plan.md`
     - `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md`
   - Stopped strictly at Phase 2C Final Hold. Standing by for independent acceptance from Pane 3 (`[gpt-5.6-sol / Solaire]`).

---

### 4. Cycle R2 Defect Repair & Hardening (2026-09-13)

**Acceptance Report Reference:** `Plan/V4_Phase_2C_CP_C4_acceptance_report.md` (Findings C4-R1-F1 ~ C4-R1-F5).

#### 1. Defect Analysis & Root Causes
- **C4-R1-F1 (AgentPreset Switch Discards Unsaved Binding Edits & Mutation Feedback Guard):**
  - *Clarified UX Contract:* Per Alicia and Solaire clarification, switching AgentPreset targets explicitly discards unsaved MCP binding edits (no per-preset draft persistence across switches; editing A to unsaved `cred-b` -> switch to B => shows B query truth; switch back to A => shows A query truth, unsaved `cred-b` does not reappear).
  - *Fix:* In `McpPanel.tsx`, `bindingDrafts` is keyed simply by `server_name -> alias`; on preset select change (`onChange`), immediately executes `setBindingDrafts({})` alongside clearing banner messages. In `handleToggleDrawer` and `handleSaveBinding`, captures `const targetPresetId = effectivePresetId`, tracks active preset with `effectivePresetIdRef = useRef<number | null>(effectivePresetId)`, and guards settlement banners with `if (effectivePresetIdRef.current === targetPresetId)`.
- **C4-R1-F2 (MCP GET Validators Normalized Invalid Strategy/Mode/Source Enums):**
  - *Root Cause:* `validatePresetDrawers`, `validateMcpServers`, and `validatePresetMcpServers` fell back to `'none'` or coerced invalid values instead of throwing `contractError`.
  - *Fix:* In `api.ts`, added `VALID_RESOLVED_SOURCES = ['public', 'preset', 'none'] as const`. Strictly asserted that `credential_strategy` is in `VALID_STRATEGIES`, `credential_required` is `typeof item.credential_required === 'boolean'`, `mode` / `credential_mode` is strictly `null | undefined | 'dedicated' | 'inherit_public'`, `resolved_source` is in `VALID_RESOLVED_SOURCES`, and aliases are strictly `string | null | undefined`. Malformed enums now fail closed immediately with `AppApiError` (`code: 'CONTRACT'`).
- **C4-R1-F3 (`raw_secret` Leakage Check Omitted in Write Responses):**
  - *Root Cause:* `createMcpCredential`, `renameMcpCredential`, and `overwriteMcpCredential` only checked `'credential_value' in item || 'secret' in item`.
  - *Fix:* Updated all three write functions in `api.ts` to check `if ('credential_value' in item || 'secret' in item || 'raw_secret' in item)`, throwing `AppApiError` with `code: 'CONTRACT'`, `status: 200`, and `ambiguousWrite: true`.
- **C4-R1-F4 (Single All-List Query Key for MCP Credentials):**
  - *Root Cause:* `settingsQueryKeys.mcpCredentials(serverName)` generated per-server cache owners `['mcp-credentials', serverName ?? 'all']`.
  - *Fix:* In `queries.ts`, updated `settingsQueryKeys.mcpCredentials` to `(_serverName?: string) => ['mcp-credentials'] as const`. Updated `useMcpCredentialsQuery` to always call `fetchMcpCredentials()` under this key, keeping all credential facts under one single all-list Query owner and filtering in memory.
- **C4-R1-F5 (Backend `ReactSheet.md` §10 Handoff Note):**
  - *Status:* Desktop repo `ReactSheet.md` §10 was updated in CP C-4 construction. Per strict repository boundaries, Desktop Builder NEVER touches `../ExoCore/`. Backend copy `../ExoCore/ReactSheet.md` §10 still says "Frozen / Backend Pending". This handoff is formally recorded for the backend agent to synchronize.

#### 2. Verification Pipeline (Cycle R2)
1. **Acceptance Probe Verification (`src/acceptance/p2c_c4_acceptance.test.tsx`):**
   - Command: `pnpm --filter exo-app test:run src/acceptance/p2c_c4_acceptance.test.tsx`
   - Result: 1 test file passed (1), 4 tests passed (4), 0 failed (224ms).
2. **All Acceptance Probes (`src/acceptance/`):**
   - Command: `pnpm --filter exo-app test:run src/acceptance/`
   - Result: 15 test files passed (15), 158 tests passed (158), 0 failed (8.36s).
3. **Builder Regression Suite (`src/test/p2c_mcp_drawers.test.tsx`):**
   - Command: `pnpm --filter exo-app test:run src/test/p2c_mcp_drawers.test.tsx`
   - Result: 1 test file passed (1), 21 tests passed (21), 0 failed (869ms).
4. **Full Test Suite (`81 files / 958 tests / 0 failed`):**
   - Command: `pnpm --filter exo-app test:run`
   - Result: 81 test files passed (81), 958 tests passed (958), 0 failed (32.80s).
5. **TypeScript Typecheck:**
   - Command: `pnpm --filter exo-app typecheck`
   - Result: Exit status 0 (0 errors).
6. **ESLint:**
   - Command: `pnpm --filter exo-app lint`
   - Result: Exit status 0 (0 errors, 0 warnings).
7. **Production Build:**
   - Command: `pnpm --filter exo-app build`
   - Result: Vite build + PWA service worker generated cleanly, 91 precache entries (4177.28 KiB). Exit code 0.
8. **Git Diff Check:**
   - Command: `git diff --check`
   - Result: Exit status 0 (clean).
9. **Real Database Baseline Protection:**
   - Command: `conda run -n exocore_project python manage.py shell -c "from agents.models import AgentPreset; print('AgentPreset IDs:', list(AgentPreset.objects.order_by('id').values_list('id', flat=True)))"`
   - Result: `AgentPreset IDs: [1, 2, 3, 4, 5, 6, 7, 8]` completely intact.
10. **Acceptance-Owned Assets Preservation:**
    - `packages/app/src/acceptance/p2c_c4_acceptance.test.tsx`: SHA-256 `BC8E3FD5FB94AF7677D4AF3B99D614B7899A4B9F1BCF445EAC06546BAA03D925` (untouched by Builder).
    - `Plan/V4_Phase_2C_CP_C4_acceptance_report.md`: SHA-256 `EDECE42869B9062B836028D184FC8253EFD55D4051D58284B6F658BB9D308589` (untouched by Builder).

#### 3. Commitments & Negative Boundaries
- Zero git commits or pushes (`git commit` / `git push` forbidden).
- Zero modifications to backend (`../ExoCore/`), V3 (`packages/chat-core`), service worker, or nginx.
- Untouched byte-identical dirty worktree files preserved.
- Builder stopped strictly at Phase 2C Final Hold, requesting Cycle R2 independent acceptance review from Solaire in Pane 3.
