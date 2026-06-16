## Shell Mistakes

### [2026-06-07] PWA Manifest Missing `id` — Same-Origin Multi-App Install Degrades to Shortcut
- **Context**: `packages/*/vite.config.js` — PWA manifest (vite-plugin-pwa). Three SPAs share one nginx port (8080/8443) with subdirectory routing (`/chat/`, `/chronicle/`, `/council/`).
- **Precaution**: Chrome identifies a PWA by manifest `id`. Without an explicit `id`, identity is derived from `start_url`. If `start_url` later changes (`/` → `/chat/`), installed PWAs become orphaned and the new page fails installability heuristics → Android Chrome shows "Create shortcut" instead of "Install", desktop shows generic gray icon. ALWAYS set a permanent `id` per module. Keep `scope` + `start_url` aligned with `base` (conditional on `command === 'build'`). SVG icons must NOT carry `purpose: 'maskable'` — SVGs cannot satisfy maskable safe-zone requirements; put `maskable` only on PNG icons.
- **Quick Fix**:
  ```js
  manifest: {
    id: 'exocore-chat',  // ← permanent, never changes
    start_url: command === 'build' ? '/chat/' : '/',
    scope: command === 'build' ? '/chat/' : '/',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
  ```
- **See also**: Full DEBUG entry below for root-cause analysis and Android vs Desktop behavior.

### [2026-05-12] Assuming Common Python Packages are Installed
- **Context**: Python scripts or Django codebase tools (e.g., `agents/tools.py`).
- **Precaution**: Do not assume common packages like `psutil` or `requests` are present in the virtual environment. Always check `requirements.txt` before importing them dynamically, or you might cause silent `ModuleNotFoundError`s.
- **Quick Fix**: Prefer Python standard library fallbacks (e.g., `subprocess.run(["tasklist", ...])` instead of `psutil` on Windows) if the dependency isn't explicitly required.

### [2026-04-29] WSL Path in Bash Tool **(已修复: 2026-05-30)**
- **Context**: Bash tool runs WSL bash, not Git Bash. Django management commands + file paths.
- **Status**: **已过时。** Shell 工具现统一使用 Git Bash 登录 shell（`bash.exe -l -c`），conda `exocore_project` 自动激活，`python.exe` 直接可用。
- **Quick Fix**: 直接用 `shell(command="python.exe manage.py <cmd>")` 即可，无需切 PowerShell。

### [2026-04-29] Smart Quotes in Python Source
- **Context**: Editing Python files with Chinese docstrings via Edit tool.
- **Precaution**: `"` `"` (U+201C/U+201D) and `'` `'` (U+2018/U+2019) cause `SyntaxError` in Python. The Edit tool may auto-convert typed ASCII quotes when mixed with Chinese text.
- **Quick Fix**: `$content -replace [char]0x201C, '"' -replace [char]0x201D, '"' -replace [char]0x2018, "'" -replace [char]0x2019, "'"`

### PowerShell Command Chaining
- **Precaution**: Do NOT use `&&` to chain commands (causes `ParserError`). Use `;` instead.
- **Quick Fix**: `git add . ; git commit -m "..."`

### Unix vs Windows Tools
- **Precaution**: DO NOT use `find .` for file searching; it invokes the Windows string search utility. Use `Get-ChildItem` or Claude Code's `Glob`/`Grep` tools.

### Virtual Environment Hazards
- **Precaution**: Recursive file operations often fail on `.venv/lib64` due to symlink loops. Always exclude `.venv` or target specific app directories.

### Conda Interpreter
- **Precaution**: Conda env `exocore_project` 在 WezTerm 交互环境和 shell 工具中均自动激活（shell 工具走 `bash.exe -l -c` 登录 shell）。直接用 `python.exe` 即可。不要手动 `conda activate` 或 `which python` 检查。

---

# DEBUG: Same-Origin Multi-PWA Install — Identity Collapse Without `id` and `scope` (✅ FIXED)

- **Date**: 2026-06-07
- **Phenomenon**:
  - **Android Chrome**: Previously showed "Install" prompt for `/chat/`, `/chronicle/`, `/council/`. After manifest `start_url` changed from `/` to subdirectory (`/chat/` etc.), Chrome regressed to showing "Create shortcut" instead of "Install" — PWA installability checks failed.
  - **Desktop Chrome/Edge**: Could install all three PWAs separately (scope fix worked), but installed icons showed generic gray placeholder instead of the custom SVG/PNG icons.
  - **Dev mode** (Vite dev server, separate ports 5173/5174/5175): No issues — each origin has only one PWA, so identity collision doesn't occur. PWA is disabled in dev anyway (`devOptions: { enabled: false }`).
- **Inference & Evidence**:
  1. **Missing `id` → identity drift**: The nginx config comment (line 4-7) explicitly planned `id: exocore-chat`, `id: exocore-chronicle`, `id: exocore-council` — but no `vite.config.js` ever set the `id` field. Chrome's PWA identification hierarchy: (a) explicit `id` in manifest → (b) `start_url` if `id` absent. When `start_url` changed from `/` to `/chat/`, Chrome saw a **different PWA** than the one previously installed. The old PWA (identity: `start_url="/"`) was orphaned; the new page (identity: `start_url="/chat/"`) hadn't passed the full installability gate yet.
  2. **Installability gate failure on Android**: For Chrome to show "Install" (not "Create shortcut"), the page must meet ALL criteria: valid manifest, registered SW with fetch handler, HTTPS (or localhost), `display: standalone`+, icons ≥192px. With the identity split, the new page's SW registration might not have fully propagated before the install prompt check. Android Chrome is stricter than desktop — it requires the SW to have handled a fetch before offering install. On first visit after build, no fetch has been intercepted yet → "Create shortcut".
  3. **SVG `purpose: 'any maskable'` → icon rejection**: `maskable` purpose signals the platform can crop the icon to a safe zone (80% inner radius on Android). SVG format has no intrinsic pixel dimensions, so maskable-safe-zone cropping is undefined. Chrome's manifest parser **silently drops** SVG icons with `purpose: 'maskable'` → falls back to the next valid icon. If PNG icons are also stale (cached by SW from pre-fix build), no valid icon remains → generic gray placeholder.
  4. **Why "it used to work"**: Before the `start_url` change (this session), all three manifests had `start_url: '/'`. On Android, visiting `http://192.168.x.x:8080/chat/` with `start_url: '/'` — Chrome used the origin as the PWA identity. Three different origins? No — all three share the same origin behind nginx (same port). With `start_url: '/'` for all three and no `id`, Chrome considered them **the same PWA** on Android (last-installed wins). On desktop, Chrome might have allowed multiple installs due to different heuristics, but they'd conflict.
  5. **nginx designed for this**: The nginx config always had the correct vision: `id` + `scope` per module, served from subdirectories of the same server block. The vite manifests simply weren't implementing the planned `id` field.
      6. **Absolute icon paths → 404 under nginx subdirectories** (discovered 2026-06-07, after relative-path fix): Manifest `icons[].src` with leading `/` (e.g. `"/icon-192x192.png"`) resolves against the **origin root** — `https://host:8443/icon-192x192.png`. Nginx only has subdirectory location blocks (`/chat/`, `/chronicle/`, `/council/`) plus a single root-level alias for `/favicon.svg` → `/usr/share/nginx/html/chat/favicon.svg`. There is NO root-level rule for `/icon-192x192.png` or `/icon-512x512.png` → **nginx returns 404** → Chrome shows generic gray placeholder for the installed PWA icon. Tab favicons work because `<link rel="icon">` in `index.html` points to the same `/favicon.svg` which the root alias catches — but the PWA install flow reads from `manifest.icons`, not from `<link rel="icon">`. **Solution**: use **relative** icon paths (`"icon-192x192.png"` without leading `/`) — these resolve against the manifest's own URL (`/chat/manifest.webmanifest` + `icon-192x192.png` → `/chat/icon-192x192.png`), which nginx serves correctly from the matching subdirectory `dist/` folder.
- **Correction Plan**:
  - [Plan A]: Add permanent `id` to each manifest (`exocore-chat`, `exocore-chronicle`, `exocore-council`) → identity survives any `start_url` change. ✅
  - [Plan B]: Make `start_url` and `scope` conditional on build mode (`command === 'build'` → subdirectory; dev → `/`) → matches `base` already set in vite config. ✅
  - [Plan C]: Remove `maskable` from SVG icon purpose, keep it only on PNG icons → Chrome won't reject SVGs. ✅
  - [Plan D]: Regenerate PNG icons with `scripts/convert-icons.mjs` to ensure fresh cached content. ✅
  - [Plan E]: Change manifest icon paths from absolute (`/icon-192x192.png`) to relative (`icon-192x192.png`) → resolves against manifest URL instead of origin root → nginx subdirectory routing serves the correct per-module icon. ✅
- **Correction Result**:
  - Modified `packages/{chat-core,chronicle,council}/vite.config.js`: Added `id`, conditional `start_url`/`scope`, split icon `purpose`, changed icon paths to relative.
  - Verified generated `dist/manifest.webmanifest` for all three modules: each contains correct `id`, `scope`, `start_url`, icon purposes, and relative icon paths.
  - **Desktop (round 1)**: After `id` + `scope` + `purpose` fixes, tab icons showed correctly but installed PWA icons still appeared gray. Root cause: absolute icon paths in manifest → nginx 404 on PNG icons.
  - **Desktop (round 2)**: After relative-path fix + `pnpm build`, uninstalled old PWAs and reinstalled. All three show correct custom icons in taskbar/desktop.
  - **Android**: After uninstalling old PWAs and reinstalling via HTTPS from the same host, "Install" prompt returns for each module.
  - **Key takeaway**: `id` is the PWA's permanent identity — set it ONCE, never change it. `scope` and `start_url` can vary by deploy context (dev vs build) as long as `scope` is a prefix of `start_url` and both are same-origin relative. Without `id`, you're coupling identity to routing, and every routing change risks PWA breakage. **Manifest icon paths must be relative** when the app is served from a subdirectory — absolute paths bypass nginx location routing.
  - **Forgiveness note**: Desktop Chrome is more forgiving than Android Chrome for PWA install checks. Android enforces stricter criteria (fetch-handled-by-SW requirement). Always test PWA installability on Android before declaring it fixed.

---

# DEBUG: Service Worker Precaching index.html — Build Changes Not Taking Effect After Refresh (✅ FIXED)

- **Date**: 2026-06-07
- **Phenomenon**:
  - `pnpm build` completes successfully. Nginx bind-mount immediately exposes new files. Dist files verified to contain the new code.
  - Refreshing the browser (port 8334/8443) still shows OLD code — code changes don't take effect. Requires manual SW unregistration or 2+ refreshes.
  - Dev mode (Vite dev server on port 5173) works fine and shows changes immediately on hot reload.
  - This happens **repeatedly** across multiple builds and different code changes — not a one-off build cache issue.
  - `DevTools → Application → Service Workers` shows an active SW with precached entries. The precached `index.html` has old JS hash references.
- **Inference & Evidence**:
  1. **Dev vs Prod SW difference**: `vite.config.js` has `devOptions: { enabled: false }` — Service Worker is NOT active in dev mode. In production (nginx-served), the SW IS registered and active. This explains why dev always works but prod doesn't.
  2. **SW precaches index.html**: The `sw.js` uses `precacheAndRoute(self.__WB_MANIFEST)` which includes `index.html`. On refresh, the `NavigationRoute` with `createHandlerBoundToURL` serves the PRECACHED (old) `index.html` — not the new one from nginx. Old `index.html` references old JS hashes → old code runs.
  3. **Missing `clients.claim()`**: `sw.js` had `self.skipWaiting()` but no `clients.claim()`. Without `clients.claim()`, the new SW doesn't take control of existing pages. Browser's SW update check is asynchronous — the navigation request is handled by the OLD SW immediately, before the new SW finishes installing.
  4. **No page reload on SW update**: The auto-generated `registerSW.js` (from `vite-plugin-pwa` with `injectManifest` strategy) only does a bare `navigator.serviceWorker.register()` — no `updatefound` listener, no `controllerchange` handler. Even after the new SW activates in the background, the user never sees it unless they manually refresh a SECOND time.
  5. **Why "it used to work with one build"**: Before the `injectManifest` migration (2026-06-05 for push notification fix), the `generateSW` strategy might have handled this differently, or the SW might not have been fully installed yet. Once the SW is installed and precaching `index.html`, this 2-refresh pattern becomes permanent.
- **Correction Plan**:
  - [Plan A]: Add `clients.claim()` to `sw.js` activate event → New SW claims all clients immediately after activation. Combined with `skipWaiting()`, the new SW takes full control.
  - [Plan B]: In the activate handler, broadcast `SW_UPDATED` message to all open tabs → Page can react to the update.
  - [Plan C]: In `main.jsx`, add dual listeners (`controllerchange` + `SW_UPDATED` message) → `window.location.reload()` → Instant page refresh when new SW takes over.
  - ✅ All 3 applied across chat-core, chronicle, and council.
- **Correction Result**:
  - Modified `packages/{chat-core,chronicle,council}/public/sw.js`: Replaced bare `self.skipWaiting()` with full `activate` event handler including `clients.claim()` + `SW_UPDATED` broadcast to all window clients.
  - Modified `packages/{chat-core,chronicle,council}/src/main.jsx`: Added `controllerchange` listener (triggers when new SW takes control) and `SW_UPDATED` message listener as backup, both calling `window.location.reload()`.
  - Build succeeds for all 3 packages. New SW now auto-claims clients and triggers immediate page reload on update.
  - **Verification**: After this fix, `pnpm build` + single browser refresh → changes visible immediately. DevTools Application panel shows SW version bump followed by auto-reload. No more "build didn't take effect" confusion.
  - **Note to future self**: This is the root cause of ALL "build not taking effect after Docker/nginx refresh" issues since 2026-06-05. Check SW status in DevTools before suspecting Docker, nginx, or build cache.

---

# DEBUG: Web Push `importScripts` After SW Installation (✅ FIXED)
  - **Date**: 2026-06-05
  - **Phenomenon**:
    - Backend reports push sent successfully (2/2), but NO notification appears on either PC or phone
    - Chrome DevTools → Service Worker console shows: `NetworkError: Failed to execute 'importScripts' on 'WorkerGlobalScope': Failed to import 'http://localhost:8080/push-notification.js'. importScripts() of new scripts after service worker installation is not allowed.`
    - The generated `sw.js` (Workbox `generateSW` strategy) wraps `importScripts('/push-notification.js')` inside an AMD `define()` callback → executes asynchronously after SW installation → Chrome blocks it
    - Push events reach the browser but the SW has no `push` event listener → silently dropped
  - **Inference & Evidence**:
    1. **Timing violation**: `importScripts()` is only allowed during initial SW script evaluation (synchronous top-level). Workbox's `generateSW` wraps it inside `define(["./workbox-xxx"], function(s) { importScripts(...) })` → callback runs after SW is already installed → Chrome throws NetworkError.
    2. **Silent failure**: The error is caught by Workbox's promise chain, so it doesn't crash the SW — the SW just has no push handler. Push events arrive, no listener, nothing happens. Backend still sees FCM returning 201 (message accepted), so it reports success.
    3. **Evidence**: Examining the generated `sw.js` showed `importScripts` nested inside AMD callback. The DevTools SW console confirmed the error with the exact line.
  - **Correction Plan**:
    - [Plan A]: Switch from `generateSW` to `injectManifest` strategy in vite-plugin-pwa. Create custom `public/sw.js` with `importScripts('./push-notification.js')` at the TOP LEVEL (before any Workbox imports or async code). Move `runtimeCaching` / `navigateFallback` from `workbox` config into the custom SW using direct `workbox-*` imports. → ✅ WORKED
  - **Correction Result**:
    - Created `packages/{chat-core,chronicle,council}/public/sw.js` each with synchronous top-level `importScripts('./push-notification.js')` + Workbox precaching + navigation fallback + runtime caching
    - Updated all 3 `vite.config.js`: `strategies: 'injectManifest'`, `srcDir: 'public'`, `filename: 'sw.js'`, removed `workbox` config block
    - Installed `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-core` as root devDependencies
    - Build output confirms `importScripts(\`./push-notification.js\`)` at the very beginning of `dist/sw.js`, before the Workbox bundle
    - ⏳ Pending: re-subscribe on PC + phone and test push delivery

---

# DEBUG: Nginx Subdirectory → Blank Dark Screen (✅ FIXED)

- **Date**: 2026-06-04
- **Phenomenon**: `http://localhost:8080/chat/` shows only dark background (`#0a0a0f`), no React content renders. DevTools shows 0 JS errors, all resources load 200 OK. CSS `:root` variables and `body` background color are applied — but `#root` div is empty.
- **Inference & Evidence**:
  1. **JS assets not loaded (Round 1)**: Vite built with `base: '/'` → `index.html` referenced `/assets/index-xxx.js`. Nginx only has `/chat/`, `/chronicle/`, `/council/` location blocks — no `/assets/` location. Browser requested `/assets/index-xxx.js` → **nginx returned 404** → white screen. **Fix**: Changed all 3 vite configs to `base: command === 'build' ? '/{subdir}/' : '/'`.
  2. **BrowserRouter basename missing (Round 2)**: After fixing `base`, JS loaded (200 OK) but React still didn't render. `BrowserRouter` without `basename` sees full URL pathname `/chat/`. All routes are relative (e.g., `path="settings"`), but React Router matches against `/chat/` which doesn't match any route → empty `<Routes>` → blank screen. **Silent failure — no console errors because it's not a crash, just no route matches.** **Fix**: Added `basename={import.meta.env.BASE_URL.replace(/\/$/, '')}` to all 3 `main.jsx`.
  3. **Different from TDZ**: Unlike the TDZ blank-screen pattern (which throws `ReferenceError`), this failure produces zero console errors because React Router simply renders nothing when no route matches.
- **Correction Plan**:
  - [Plan A]: Set vite `base` conditionally for production subdirectory → ✅ WORKED but not sufficient
  - [Plan B]: Add `BrowserRouter basename` from `import.meta.env.BASE_URL` → ✅ RESOLVED
- **Correction Result**: App renders successfully at `http://localhost:8080/chat/`. Verified via Playwright — `#root` contains full AppLayout DOM. Remaining API 400 errors are backend connectivity, not rendering.

# DEBUG: AvatarCropModal Touch Drag — Pointer/Touch Event Pipeline Conflict (⚠️ UNRESOLVED)

- **Date**: 2026-06-08
- **Phenomenon**:
  - Avatar crop modal: scroll-wheel zoom works, pinch zoom works, but **drag/pan only moves the image ~1 frame then crashes** with `TypeError: Cannot read properties of null (reading 'x')`.
  - The crash comes from `onMove` handler: `dragRef.current.x` where `dragRef.current` is `null`.
  - Same behavior on both mouse and touch — not specific to one input modality.
- **Inference & Evidence**:
  1. **Attempt 1 — `touchmove` unconditional `preventDefault()`**: Original code had `e.preventDefault()` outside the `if (e.touches.length === 2)` guard. In Chromium, calling `preventDefault()` on `touchmove` can cancel the pending `pointermove` event. **Fix**: moved `preventDefault()` inside the pinch guard. Result: **slightly better** — drag moves 1 frame instead of 0, still crashes.
  2. **Attempt 2 — Separate touch/pointer pipelines**: Rewrote event handling so touch events handle ALL touch interactions (drag + pinch), pointer events only handle mouse (`pointerType === 'mouse'` guard). Result: **same behavior** — ~1 frame of drag then crash.
  3. **Hypothesis (unconfirmed)**: `setPointerCapture(e.pointerId)` might be silently failing, causing the browser to fire `pointercancel` immediately after the first `pointermove`, which clears `dragRef.current = null`. Or, the `pointercancel` fires because the browser detects a conflicting gesture (even with `touch-action: none` on the element).
  4. **The real question**: Why does `dragRef.current` become `null` between `if (!dragRef.current) return;` (line 39) and `dragRef.current.x` (line 40) when the check is synchronous? Possibilities: stale closure in React event handler, or a race between pointer and touch event dispatches that clears the ref.
  5. **Not yet tried**: (a) using `useState` for drag position instead of `useRef`, (b) `pointermove` ONLY without `setPointerCapture`, (c) removing touch event handlers entirely and handling everything through pointer events + gesture detection, (d) using `requestAnimationFrame` throttling on move events.
- **Files involved**: `packages/chat-core/src/components/modals/AvatarCropModal.jsx`
- **Current state**: The code uses separate touch/pointer pipelines (Attempt 2 applied). Touch drag tracks via `dragRef` in `onTouchStart/onTouchMove/onTouchEnd`. Mouse drag tracks via `dragRef` in `onDown/onMove/onUp` with `pointerType === 'mouse'` guard. The ref is cleared in `onTouchEnd` (touch) and `onUp`/`pointercancel` (pointer). Something still nukes `dragRef.current` before the second move frame.
- **Next steps**: When we come back to this, instrument the handlers with `console.log` to trace the exact sequence of events. The key question: WHAT fires between frame 1 and frame 2 of a drag that sets `dragRef.current = null`?

---

# DEBUG: Inline Style `style.* = ''` → White Flash on Hover (✅ FIXED)

- **Date**: 2026-06-16
- **Phenomenon**:
  - Sidebar navigation icons + text turn white for ~200ms on hover exit
  - Project Hall cards flash white on mouse leave
  - AgentProfile buttons, BackButton, SessionActionsMenu — any element with JS `onMouseEnter`/`onMouseLeave` handlers that reset inline styles to empty string
  - Effect is a brief white flash, most visible on dark backgrounds
  - Same bug reported across 3 sessions with different attempted fixes (replacing `hover:bg-white/X`, `transition-all` → `transition-colors`, removing `filter`/`textShadow` handlers) — none resolved it
- **Inference & Evidence**:
  1. **First attempt — `hover:bg-white/X` replacement (commit `05a3163`)**: Replaced all Tailwind `hover:bg-white/X` / `hover:border-white/X` with `exo-accent` / `exo-mist` equivalents. Result: didn't fix it — the sidebar doesn't use Tailwind hover classes at all, it uses JS `onMouseEnter`/`onMouseLeave` with inline styles. Also missed `bg-white/[0.03]` in ProjectHome and HomePanel that were hiding in plain sight.
  2. **Second attempt — `transition-all` → `transition-colors` (commit `e798825`)**: Replaced `transition-all` with `transition-colors` on 24 files, reasoning that filter/textShadow interpolation causes white artifacts. Also removed `filter`/`textShadow` from JS hover handlers. Result: didn't fix it — `transition-colors` still animates `color` changes, and the inherited body color is `var(--cinder-text)` = `#cecdd6` (near-white).
  3. **Third attempt — `filter`/`textShadow` removal + duration reduction (commit `6702ec1`)**: Removed all filter/textShadow/boxShadow changes from DesktopSidebar JS handlers, reduced duration from 500ms/300ms to 200ms. Result: STILL didn't fix it.
  4. **Root cause — `e.currentTarget.style.color = ''`**: Every `onMouseLeave` handler was doing `style.color = ''`. Setting an inline style property to empty string **removes** the property from the element's inline style. The browser then falls back to CSS cascade inheritance: `body { color: var(--cinder-text) }` = `#cecdd6` (**near-white** on dark backgrounds). With `transition-colors` active, this near-white is smoothly animated for ~200ms until React's next re-render restores the correct inline style. The user sees: orange/accent → **white** → correct gray.
  5. **Why previous fixes didn't work**: They all addressed the wrong layer — changing WHAT color to transition to, or reducing WHAT properties transition. But the problem isn't the target color or the transition scope — it's that the start-of-transition color is WRONG. Setting `style.color = ''` says "I don't care what color this is, let CSS decide" — and CSS decides near-white.
  6. **Lucide-react confirmed NOT the culprit**: Lucide ships zero CSS, `fill="none"` + `stroke="currentColor"`, no hover styles. Tailwind preflight only sets `display: block` on SVGs. The active sidebar (`DesktopSidebar.jsx`) doesn't even use Lucide — it uses custom inline SVGs with `stroke="currentColor"`.
- **Correction Plan**:
  - [Plan A]: Replace ALL `style.* = ''` in every `onMouseLeave` handler with explicit values matching the element's `style={{}}` prop. ✅
  - [Plan B]: For properties not in the base style (e.g., `filter` only set on hover), reset to CSS default (`'none'`). ✅
  - [Plan C]: Also convert remaining `transition-all` → `transition-colors`, remove `filter`/`textShadow`/`boxShadow` changes from JS hover handlers. ✅
- **Correction Result**:
  - Fixed 33 occurrences across 7 files:
    - `DesktopSidebar.jsx`: 4 handlers (logo, nav items × 2, settings, avatar)
    - `AgentProfile.jsx`: 8 handlers (IconBtn, headings, buttons, session rows)
    - `ProjectDetail.jsx`: 8 handlers (IconBtn, ThreadRow, menu buttons, upload)
    - `ProjectList.jsx`: 5 handlers (New Project button, cards, menu, empty state, session rows)
    - `AgentHub.jsx`: 2 handlers (drag handle)
    - `Dashboard.jsx`: 1 handler (session row)
    - `SessionActionsMenu.jsx`: 1 handler (actions button)
    - `BackButton.jsx`: 1 handler (back navigation)
  - Verified: `grep -rn "style\.[a-zA-Z]*\s*=\s*''" packages/chat-core/src/` returns **zero matches**
  - Also committed `transition-all` → `transition-colors` + `filter`/`textShadow`/`boxShadow` handler removals for all affected elements
- **Prevention rule**:
  ```js
  // ❌ NEVER do this — removes the property, CSS cascade takes over
  onMouseLeave={e => { e.currentTarget.style.color = ''; }}
  
  // ✅ ALWAYS set the explicit target value
  onMouseLeave={e => { e.currentTarget.style.color = 'var(--cinder-text-faint)'; }}
  ```
  Same rule applies to `background`, `borderColor`, `borderImage`, `opacity`, `filter`, `textShadow`, `boxShadow`, `transform` — never set to `''`, always to the explicit desired CSS value. **Empty string is not "reset to default" — it's "let the cascade decide, and on dark themes the cascade usually picks white."**
- **Footgun doc**: `.agents/footgun/SidebarWhiteHover.md` — full root cause analysis, fix pattern, and checklist

---

## Frontend JavaScript Mistakes

### [2026-06-04] `const` TDZ — Accessing Variable Before Declaration in React Components
- **Context**: React function components — `useState` initializer referencing a `const` declared on a later line.
- **Symptom**: Entire React component tree silently crashes (blank page / background color only). No visible error in the terminal/build output because the crash is at runtime.
- **Precaution**: JavaScript `const` is hoisted but **not initialized** — it exists in the Temporal Dead Zone (TDZ) from the top of the function until its declaration line. Accessing it throws `ReferenceError: Cannot access 'X' before initialization`. This is especially easy to miss when `useState(expr)` is placed before the variable it references.
- **Example (BROKEN)**:
  ```jsx
  function CodeBlock({ children, className }) {
    const [tab, setTab] = useState(lang === 'xml' ? 'code' : 'preview'); // 💥 TDZ!
    const lang = (className || '').split(' ')...
  ```
- **Quick Fix**: Declare `const` variables **before** any `useState` that references them:
  ```jsx
  function CodeBlock({ children, className }) {
    const lang = (className || '').split(' ')...
    const [tab, setTab] = useState(lang === 'xml' ? 'code' : 'preview'); // ✅ safe
  ```
- **Debugging**: Open browser DevTools (F12) → Console. If you see `ReferenceError: Cannot access '...' before initialization` but the build compiled fine, check the declaration order of all `const`/`let` variables in the crashing component.
- **Why builds can't catch this**: Vite/Rollup's build passes because TDZ is a runtime check, not a syntax error. The code is syntactically valid — it just fails when executed.

### [2026-06-07] localStorage/React State Dual-Source — Resolving Default Without Syncing Back to localStorage
- **Context**: Components that derive defaults from config/API but persist user overrides to localStorage. Specifically `key_alias` in `ControlsDrawer.jsx` / `ChatArea.jsx`. Also applies to per-session theme, memory injection, and any setting with "session-level localStorage override + platform-level default from key_map".
- **Symptom**: UI shows correct resolved value (React state updated), but the next action sends the OLD value to the backend → 401 or wrong API key. DevTools shows React DevTools correct, but Application → Local Storage is stale. Most confusing: switching within the same platform works (because `handleAliasChange` persists to localStorage), but switching platform (Gemini → DeepSeek) silently fails (because `loadKeyData` only updates React state, not localStorage).
- **Precaution**: When an async loader function resolves a NEW default (because the old stored value is no longer valid in the current context — e.g., platform changed), **always persist the resolved value back to localStorage**, not just to React state. Other code paths that read directly from localStorage at action-time (e.g., `ChatArea` builds POST body at send-time) will use the stale value otherwise.
- **Pattern (BROKEN)**:
  ```js
  // loadKeyData: old key "g-key-1" is not in new platform's aliasList
  // Falls through → resolves new default → updates UI state only
  setSelectedAlias(def);  // ✅ UI shows DeepSeek default key
  // ❌ localStorage.getItem(`exo_session_key_${sessionId}`) still "g-key-1"
  // → ChatArea sends "g-key-1" to backend → Gemini key for DeepSeek model → 401
  ```
- **Pattern (FIXED)**:
  ```js
  setSelectedAlias(def);
  if (def) {
    localStorage.setItem(`exo_session_key_${sessionId}`, def);
  }
  ```
- **Debugging tip**: If UI and backend disagree on a persisted config value, check both React DevTools (Components → state) AND Application → Local Storage. A divergence means one code path updates React state while another reads from localStorage. The fix is ALWAYS to keep them in sync at every resolution/derivation point.

---

### [2026-06-09] Tailwind Typography `prose` — CSS Pseudo-Elements Inject Backtick Characters on Inline `<code>`

- **Context**: `packages/chat-core/src/components/chat/MessageBubble.jsx` — `ReactMarkdown` rendered inside `prose prose-invert` container from `@tailwindcss/typography`.
- **Symptom**: Every inline `<code>` element displayed literal `` ` `` characters around the code text. Block code (fenced code blocks) worked correctly. The same markdown content rendered correctly in Obsidian, confirming the source content was valid.
- **Inference & Evidence**:
  1. **Initial misdiagnosis — rehype-highlight**: First suspected `rehype-highlight` was adding `hljs` class to inline `<code>`, making `isInline = !className` return `false`. While `rehype-highlight` DOES add `hljs` to all `<code>` elements (not just block), this was NOT the root cause — it only affected the component selection (inline vs block rendering path), but wouldn't cause backticks to appear.
  2. **Second misdiagnosis — Unicode fullwidth characters**: Suspected the LLM (DeepSeek) was emitting fullwidth grave accent (`｀` U+FF40) which react-markdown doesn't recognize as a code delimiter. Added `normalizeMarkdown()` to convert U+FF40 → U+0060. This was a valid defensive measure but NOT the root cause.
  3. **Third misdiagnosis — HTML entities**: Suspected the backend was HTML-escaping backticks to `&#96;`. Added entity unescaping to `normalizeMarkdown()`. Also not the root cause.
  4. **Root cause — `@tailwindcss/typography` `prose` plugin**: The `prose` class from Tailwind Typography applies these default styles to inline `<code>` elements:
     ```css
     .prose code::before { content: "`"; }
     .prose code::after  { content: "`"; }
     ```
     The "backtick" characters the user saw were **CSS-generated pseudo-element content**, not rendered markdown. They appeared because the message container had `prose` (and `prose-invert`) classes. Obsidian doesn't use Tailwind Typography, which is why the same content worked there.
  5. **Why only inline code was affected**: Block code is wrapped in `<pre><code>`, and the `pre` component handler intercepts before the `prose` class applies. Only inline `<code>` elements are direct children of the prose container, so only they received the CSS pseudo-elements.
- **Correction Plan**:
  - [Plan A]: Add `prose-code:before:content-none prose-code:after:content-none` to the prose container's className. This uses Tailwind's `content-none` utility (`content: none`) to override the pseudo-element content injected by the prose plugin. ✅
  - [Plan B]: Move `normalizeMarkdown()` call before `ReactMarkdown` — already in place as a defense layer against Unicode lookalikes and HTML entities. ✅ (not the root fix, but worth keeping)
- **Correction Result**:
  - Added `prose-code:before:content-none prose-code:after:content-none` to both user message bubble (`max-w-[92%]` div) and AI message container (`w-full` div) in `MessageBubble.jsx`.
  - Added same fix to `GroupchatMessage.jsx` AI message containers.
  - Also fixed `isInline` detection from `!className` to `!className?.includes('language-')` in both files — this was a real secondary bug: `rehype-highlight` adds `hljs` class to inline `<code>`, which made the component treat inline code as block code, skipping the inline styling (different symptom from the CSS backtick issue, but same root confusion).
  - **Verification**: Inline code now renders correctly — no visible backtick characters around code text. The CSS pseudo-elements are suppressed, and the markdown parser handles the actual backtick delimiters correctly.
- **Lessons learned**:
  - When debugging "extra characters appearing in rendered output," check CSS pseudo-elements in DevTools BEFORE investigating markdown parsing or character encoding. `::before` and `::after` are invisible in the DOM tree but visible to the user.
  - `@tailwindcss/typography`'s `prose` class is opinionated about code styling — it adds visual backtick decorations that look like bugs if you don't know they're there. Always audit what the prose plugin injects when using it with a custom markdown renderer.
  - Multiple bugs with the same symptom (inline code rendering wrong) can coexist: (a) CSS pseudo-elements adding backticks, (b) `isInline` detection broken by `rehype-highlight`'s `hljs` class. Fix them all, not just the first one you find.
  - The `normalizeMarkdown()` function (Unicode + HTML entity normalization) is a useful defense layer even though it wasn't the root cause here — LLMs can and do emit non-standard characters.

---

## Tool Loop Mistakes

### [2026-05-26] 工具回传设计原则（三收集器）

- **Context**: `engines/llm.py` — `build_gemini_tool_round` / `build_openai_tool_round`；
  `agents/services.py` — `_run_tool_loop_gemini` / `_run_tool_loop_openai`。
- **核心原则**:

  **Gemini**:
  - model turn: 增量正文（`turn_text`）+ FC parts
    → AI 翻 model 历史就能看到自己输出过的正文
  - user FR turn: FR parts + `[prior_reasoning]`（累积全量 thinking）
    → AI 在自己侧看不到 previous thoughts，必须由 user 侧回传
  - **`[prior_response]` 不需要** — Gemini 能看自己 model turn 里的正文
  - **NEVER 将 thinking 放入 model turn 的 text 中**（旧代码的 `<ExoCore>` 包装是错的）

  **OpenAI/DeepSeek**:
  - assistant turn: 增量正文（`content`）+ 增量思考（`reasoning_content`）+ FC parts
    → 三个字段天然分离，AI 翻历史全都能看到
  - tool turns: 每条工具调用独立 `role=tool` 消息
  - 不需要额外回传任何东西

  **三收集器结构**:
  ```
  collector_1 (前端/DB): 累积每个 chunk → SSE 流式 + DB 落库
    - full_response_content: 所有 content chunk
    - full_reasoning_content: 所有 thinking chunk
  collector_2 (AI 回传): 每轮工具回传时读取累积全量
    - Gemini: full_reasoning_content → user FR [prior_reasoning]
    - OpenAI: turn_thinking → assistant.reasoning_content
  tool_collector: 工具调用结果，_truncate_tool_result 截断超长内容
  ```

- **Quick Fix**: 永远使用 `LLMGateway.build_gemini_tool_round()` / `build_openai_tool_round()`
  而不是直接调用 `make_fc_assistant_turn` + `make_tool_result_turns`。
  Builder 内部处理：工具结果截断、thinking 路由到正确位置。

### [2026-05-18] Gemini/OpenAI Tool Loop Conflation (已过时，参见上方 2026-05-26)
- **Context**: `agents/services.py` — Superior tool loop (`_run_tool_loop`) and simple tool loop (`_stream_with_tools`).
- **Precaution**: Gemini and OpenAI have FUNDAMENTALLY different tool passback mechanisms:
  - **Gemini**: thinking goes in user-FR `[prior_reasoning]` text parts; response content goes in model turn as regular content. NEVER put thinking on the model turn.
  - **OpenAI/DeepSeek**: thinking MUST be `reasoning_content` on the assistant message. Content goes as `content` on the assistant message. Omitting `reasoning_content` causes 400 errors from DeepSeek.
- **Quick Fix**: Use `LLMGateway.build_gemini_tool_round()` / `build_openai_tool_round()` instead of calling `make_fc_assistant_turn` + `make_tool_result_turns` directly. The builders encapsulate all platform-specific parameter routing.
- **Design Principle**: Think of the model's flow as `.think → .say → tool → .think → .say → final`. Thinking is CoT (not output, user can't see). Response content IS output (user sees it, DB records it). The model must see its own intermediate content as proper output to continue coherently.
