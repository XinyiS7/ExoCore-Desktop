# Chat-Core Layout Reorganization

**Date:** 2026-06-07
**Scope:** `packages/chat-core/`

## Changes

### 1. Mobile Settings Nav Collapse

**File:** `views/SettingsView.jsx`

- Add `navVisible` state (default `true`)
- On mobile (`md` breakpoint below): clicking a left nav item sets `navVisible = false`, hiding the left nav
- When nav is hidden, show a ← Back button at top of content area to restore nav visibility
- Desktop (`md`+): no change, nav always visible

### 2. Memory → Settings + Groupchat Placeholder

**Files:**

| Action | File | Detail |
|--------|------|--------|
| Delete | `components/settings/MemoryManager.jsx` | Functional memory manager no longer needed |
| Edit | `components/layout/DesktopSidebar.jsx` | Replace Memory nav item with Groupchat |
| Edit | `components/layout/MobileBottomBar.jsx` | Replace Memory nav item with Groupchat |
| Edit | `App.jsx` | Remove `/memory` route; add `/settings/memory` route; add `/groupchat` route |
| Edit | `views/SettingsView.jsx` | Add Memory to NAV_ITEMS |
| Edit | `views/Dashboard.jsx` | Add Groupchat placeholder card in Quick Links |
| Create | `views/GroupchatPlaceholder.jsx` | Placeholder page for Groupchat (Coming Soon) |
| Keep | `views/MemoryConsole.jsx` | Reused as Settings > Memory sub-route |

**Navigation after changes:**
- Desktop sidebar: Projects / Agents / Groupchat
- Mobile bottom bar: Home / Projects / Agents / Groupchat / Settings
- Settings left nav: Key Manage / Notifications / Appearance / Routine / Memory
- Dashboard Quick Links: Agent Hub / Projects / Groupchat (placeholder)

**Groupchat placeholder:** Disabled-style card with `Users` icon, "Groupchat" label, "Multi-agent group chat" desc, "soon" badge. Same disabled treatment as Routine in Settings nav.
