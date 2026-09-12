# Chat-Core Layout Reorganization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two layout changes in chat-core: (1) mobile Settings nav collapses on item click, (2) move Memory to Settings menu, add Groupchat placeholder in nav + homepage.

**Architecture:** React component-level changes only — no backend. All changes confined to `packages/chat-core/src/`. Follows existing patterns: placeholder pages use the same Coming Soon layout, nav items use the same icon+label pattern, disabled items use the same muted styling as Routine in SettingsView.

**Tech Stack:** React 18, React Router v6, Tailwind CSS, lucide-react icons

**Files touched (7):**
- Delete: `components/settings/MemoryManager.jsx`
- Create: `views/GroupchatPlaceholder.jsx`
- Modify: `App.jsx`, `SettingsView.jsx`, `DesktopSidebar.jsx`, `MobileBottomBar.jsx`, `Dashboard.jsx`

---

### Task 1: Delete MemoryManager.jsx

**Files:**
- Delete: `packages/chat-core/src/components/settings/MemoryManager.jsx`

- [ ] **Step 1: Delete the file**

```bash
rm packages/chat-core/src/components/settings/MemoryManager.jsx
```

- [ ] **Step 2: Verify no broken imports**

```bash
grep -r "MemoryManager" packages/chat-core/src/
```

Expected: no results (no other file imports it).

- [ ] **Step 3: Commit**

```bash
git add packages/chat-core/src/components/settings/MemoryManager.jsx
git commit -m "chore: remove MemoryManager component, superseded by simpler structure"
```

---

### Task 2: Create GroupchatPlaceholder.jsx

**Files:**
- Create: `packages/chat-core/src/views/GroupchatPlaceholder.jsx`

- [ ] **Step 1: Create the placeholder view**

```jsx
import React from 'react';
import { Users } from 'lucide-react';

export default function GroupchatPlaceholder() {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-chat-bg">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="p-4 rounded-full bg-chat-accent/10 inline-block">
          <Users size={32} className="text-chat-accent/50" />
        </div>
        <h2 className="text-xl font-light text-chat-text">Groupchat</h2>
        <p className="text-sm text-chat-muted leading-relaxed">
          Multi-agent group chat — converse with multiple agents simultaneously
          in a shared workspace — will be available here.
        </p>
        <p className="text-[10px] font-mono text-chat-muted/40 uppercase tracking-widest">
          Coming Soon
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/views/GroupchatPlaceholder.jsx
git commit -m "feat: add Groupchat placeholder view"
```

---

### Task 3: Update DesktopSidebar — Memory → Groupchat

**Files:**
- Modify: `packages/chat-core/src/components/layout/DesktopSidebar.jsx`

- [ ] **Step 1: Replace Memory with Groupchat in NAV_ITEMS and isActive**

**Current code (lines 31-35):**
```jsx
const NAV_ITEMS = [
  { route: '/projects',  icon: FolderKanban, label: 'Projects' },
  { route: '/agent-hub', icon: BrainCircuit,  label: 'Agents' },
  { route: '/memory',    icon: Database,      label: 'Memory' },
];
```

**Replace with:**
```jsx
const NAV_ITEMS = [
  { route: '/projects',  icon: FolderKanban, label: 'Projects' },
  { route: '/agent-hub', icon: BrainCircuit,  label: 'Agents' },
  { route: '/groupchat', icon: Users,         label: 'Groupchat' },
];
```

**Also update the import line:** Add `Users` to the lucide-react import, remove `Database`:
```jsx
import {
  Hexagon, BrainCircuit, FolderKanban, Users,
  Settings
} from 'lucide-react';
```

**Update isActive function (lines 43-48):** Replace the memory check with groupchat:
```jsx
const isActive = (route) => {
  if (route === '/projects') return location.pathname.startsWith('/project');
  if (route === '/agent-hub') return location.pathname.startsWith('/agent');
  if (route === '/groupchat') return location.pathname.startsWith('/groupchat');
  return false;
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/layout/DesktopSidebar.jsx
git commit -m "feat: replace Memory with Groupchat in desktop sidebar nav"
```

---

### Task 4: Update MobileBottomBar — Memory → Groupchat

**Files:**
- Modify: `packages/chat-core/src/components/layout/MobileBottomBar.jsx`

- [ ] **Step 1: Replace Memory with Groupchat in BOTTOM_ITEMS and isActive**

**Current code (lines 6-12):**
```jsx
const BOTTOM_ITEMS = [
  { route: '/',         icon: Home,          label: 'Home' },
  { route: '/projects', icon: FolderKanban,  label: 'Projects' },
  { route: '/agent-hub',icon: BrainCircuit,  label: 'Agents' },
  { route: '/memory',   icon: Database,      label: 'Memory' },
  { route: '/settings', icon: Settings,      label: 'Settings' },
];
```

**Replace with:**
```jsx
const BOTTOM_ITEMS = [
  { route: '/',          icon: Home,          label: 'Home' },
  { route: '/projects',  icon: FolderKanban,  label: 'Projects' },
  { route: '/agent-hub', icon: BrainCircuit,  label: 'Agents' },
  { route: '/groupchat', icon: Users,         label: 'Group' },
  { route: '/settings',  icon: Settings,      label: 'Settings' },
];
```

**Update import:** Replace `Database` with `Users`:
```jsx
import { Home, Settings, BrainCircuit, FolderKanban, Users } from 'lucide-react';
```

**Update isActive (lines 19-25):** Replace the memory check with groupchat:
```jsx
const isActive = (route) => {
  if (route === '/') return location.pathname === '/';
  if (route === '/projects') return location.pathname.startsWith('/project') || location.pathname === '/projects';
  if (route === '/agent-hub') return location.pathname.startsWith('/agent');
  if (route === '/groupchat') return location.pathname.startsWith('/groupchat');
  if (route === '/settings') return location.pathname.startsWith('/settings');
  return false;
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/components/layout/MobileBottomBar.jsx
git commit -m "feat: replace Memory with Groupchat in mobile bottom bar"
```

---

### Task 5: Update SettingsView — Mobile nav collapse + Memory menu item

**Files:**
- Modify: `packages/chat-core/src/views/SettingsView.jsx`

- [ ] **Step 1: Rewrite SettingsView with mobile collapse and Memory item**

Replace the entire file content:

```jsx
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Key, Clock, Bell, Palette, Database, ArrowLeft } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';

const NAV_ITEMS = [
  {
    id: 'keys',
    label: 'Key Manage',
    icon: Key,
    route: '/settings/keys',
    enabled: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    route: '/settings/notifications',
    enabled: true,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    route: '/settings/appearance',
    enabled: true,
  },
  {
    id: 'routine',
    label: 'Routine Manage',
    icon: Clock,
    route: '/settings/routine',
    enabled: false,
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Database,
    route: '/settings/memory',
    enabled: true,
  },
];

export default function SettingsView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navVisible, setNavVisible] = useState(true);

  const isActive = (route) => location.pathname === route;

  const handleNavClick = (route, enabled) => {
    if (!enabled) return;
    navigate(route);
    // On mobile: collapse nav after selection
    setNavVisible(false);
  };

  return (
    <div className="flex-1 h-full flex overflow-hidden">
      {/* Left nav — hidden on mobile when collapsed */}
      <nav className={`w-52 flex-shrink-0 border-r border-white/5 bg-chat-panel/50 py-6 flex flex-col md:flex ${navVisible ? 'flex' : 'hidden'}`}>
        <div className="px-4 mb-4">
          <h1 className="text-sm font-semibold text-chat-text/90 tracking-tight">Settings</h1>
        </div>

        <div className="flex-1 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon, route, enabled }) => (
            <button
              key={id}
              onClick={() => handleNavClick(route, enabled)}
              disabled={!enabled}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all text-left ${
                enabled && isActive(route)
                  ? 'bg-chat-accent/10 text-chat-accent border-l-2 border-chat-accent'
                  : enabled
                    ? 'text-chat-muted hover:text-chat-text hover:bg-white/5'
                    : 'text-chat-muted/25 cursor-not-allowed'
              }`}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span className="font-sans text-[13px]">{label}</span>
              {!enabled && (
                <span className="text-[9px] font-mono uppercase tracking-wider text-chat-muted/20 ml-auto">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Right content area */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Mobile back button — visible when nav is hidden on mobile */}
        {!navVisible && (
          <div className="md:hidden flex-shrink-0 h-10 bg-chat-panel border-b border-white/5 flex items-center px-3">
            <button
              onClick={() => setNavVisible(true)}
              className="p-1 text-chat-muted hover:text-chat-accent active:scale-90 transition-all flex items-center gap-2"
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span className="text-xs font-medium text-chat-text">Settings Menu</span>
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/views/SettingsView.jsx
git commit -m "feat: mobile settings nav collapse + add Memory menu item"
```

---

### Task 6: Update Dashboard — Add Groupchat placeholder card

**Files:**
- Modify: `packages/chat-core/src/views/Dashboard.jsx`

- [ ] **Step 1: Add Users icon import**

**Current line 2:**
```jsx
import { BrainCircuit, FolderKanban, Search, ArrowRight, MessageSquare } from 'lucide-react';
```

**Replace with:**
```jsx
import { BrainCircuit, FolderKanban, Search, ArrowRight, MessageSquare, Users } from 'lucide-react';
```

- [ ] **Step 2: Add Groupchat to QUICK_LINKS**

**Current lines 14-17:**
```jsx
const QUICK_LINKS = [
  { id: 'agent_hub', icon: BrainCircuit, label: 'Agent Hub', desc: 'Manage AI agents & presets' },
  { id: 'project', icon: FolderKanban, label: 'Projects', desc: 'Long-running tasks & files' },
];
```

**Replace with:**
```jsx
const QUICK_LINKS = [
  { id: 'agent_hub', icon: BrainCircuit, label: 'Agent Hub', desc: 'Manage AI agents & presets' },
  { id: 'project', icon: FolderKanban, label: 'Projects', desc: 'Long-running tasks & files' },
  { id: 'groupchat', icon: Users, label: 'Groupchat', desc: 'Multi-agent group chat', disabled: true },
];
```

- [ ] **Step 3: Handle disabled Groupchat card in render**

**Current Quick Links section (around lines 168-184):**
```jsx
{QUICK_LINKS.map(({ id, icon: Icon, label, desc }) => (
  <button
    key={id}
    onClick={() => setView(id)}
    className="group flex flex-col items-center gap-3 p-6 bg-exo-pure border border-exo-mist-10 rounded-md hover:border-exo-accent/30 transition-all text-center"
  >
    <div className="p-3 rounded-md bg-white/[0.03] border border-exo-mist-10 text-exo-accent group-hover:shadow-glow-gold transition-all">
      <Icon size={22} strokeWidth={1.5} />
    </div>
    <div>
      <p className="text-sm font-medium text-white group-hover:text-exo-accent transition-colors">{label}</p>
      <p className="text-[10px] text-exo-muted mt-0.5 font-mono uppercase tracking-wider">{desc}</p>
    </div>
  </button>
))}
```

**Replace with:**
```jsx
{QUICK_LINKS.map(({ id, icon: Icon, label, desc, disabled }) => (
  <button
    key={id}
    onClick={() => !disabled && setView(id)}
    disabled={disabled}
    className={`group flex flex-col items-center gap-3 p-6 bg-exo-pure border border-exo-mist-10 rounded-md transition-all text-center ${
      disabled
        ? 'opacity-40 cursor-not-allowed'
        : 'hover:border-exo-accent/30'
    }`}
  >
    <div className={`p-3 rounded-md border border-exo-mist-10 transition-all ${
      disabled
        ? 'bg-white/[0.02] text-exo-muted/50'
        : 'bg-white/[0.03] text-exo-accent group-hover:shadow-glow-gold'
    }`}>
      <Icon size={22} strokeWidth={1.5} />
    </div>
    <div>
      <p className={`text-sm font-medium transition-colors ${
        disabled ? 'text-exo-muted/50' : 'text-white group-hover:text-exo-accent'
      }`}>{label}</p>
      <p className="text-[10px] text-exo-muted mt-0.5 font-mono uppercase tracking-wider">{desc}</p>
      {disabled && (
        <span className="text-[9px] font-mono uppercase tracking-wider text-exo-muted/30 mt-1 block">soon</span>
      )}
    </div>
  </button>
))}
```

- [ ] **Step 4: Commit**

```bash
git add packages/chat-core/src/views/Dashboard.jsx
git commit -m "feat: add Groupchat placeholder card to Dashboard"
```

---

### Task 7: Update App.jsx — Routes

**Files:**
- Modify: `packages/chat-core/src/App.jsx`

- [ ] **Step 1: Add GroupchatPlaceholder import**

**After line 29 (MemoryConsole import), add:**
```jsx
import GroupchatPlaceholder from './views/GroupchatPlaceholder';
```

- [ ] **Step 2: Remove `/memory` route, add `/groupchat` and `/settings/memory` routes**

**Current (around line 249):**
```jsx
<Route path="memory" element={<MemoryRoute />} />
```

Remove that line.

**Add Groupchat route** (near other top-level routes):
```jsx
<Route path="groupchat" element={<GroupchatPlaceholder />} />
```

**Add settings/memory route** inside the settings Route group (around line 256):
```jsx
<Route path="memory" element={<MemoryRoute />} />
```

This goes inside the `<Route path="settings" element={<SettingsRoute />}>` block, after the routine route.

**Also remove the `MemoryRoute` component wrapper** (lines 233-235):
```jsx
function MemoryRoute() {
  return <MemoryConsole />;
}
```

This is no longer needed — we can reference MemoryConsole directly in the route or keep it as a named import.

The updated settings route block should look like:
```jsx
<Route path="settings" element={<SettingsRoute />}>
  <Route index element={<Navigate to="keys" replace />} />
  <Route path="keys" element={<KeyManageRoute />} />
  <Route path="notifications" element={<NotificationsRoute />} />
  <Route path="appearance" element={<AppearancePanel />} />
  <Route path="routine" element={<RoutinePlaceholderRoute />} />
  <Route path="memory" element={<MemoryConsole />} />
</Route>
```

The top-level routes (inside `<Route element={<AppLayout />}>`) should be:
```jsx
<Route index element={<DashboardRoute />} />
<Route path="chat/:sessionId" element={<ChatShellRoute />} />
<Route path="agent-hub" element={<AgentHubRoute />} />
<Route path="agent/:presetId" element={<AgentProfileRoute />} />
<Route path="agent/:presetId/memory" element={<AgentMemoryRoute />} />
<Route path="projects" element={<ProjectsRoute />} />
<Route path="project/:id" element={<ProjectDetailRoute />} />
<Route path="groupchat" element={<GroupchatPlaceholder />} />
<Route path="user" element={<UserRoute />} />
<Route path="settings" element={<SettingsRoute />}>
  ...
</Route>
```

- [ ] **Step 3: Commit**

```bash
git add packages/chat-core/src/App.jsx
git commit -m "feat: add /groupchat and /settings/memory routes, remove top-level /memory"
```

---

### Task 8: Build verification

- [ ] **Step 1: Run build to verify no errors**

```bash
cd packages/chat-core && pnpm build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Commit any final tweaks if needed**

---

### Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | Delete `MemoryManager.jsx` | Remove unused complex component |
| 2 | Create `GroupchatPlaceholder.jsx` | Coming Soon placeholder |
| 3 | Edit `DesktopSidebar.jsx` | Memory → Groupchat |
| 4 | Edit `MobileBottomBar.jsx` | Memory → Groupchat |
| 5 | Edit `SettingsView.jsx` | Mobile nav collapse + Memory item |
| 6 | Edit `Dashboard.jsx` | Groupchat placeholder card |
| 7 | Edit `App.jsx` | Route changes |
| 8 | Build | Verification |
