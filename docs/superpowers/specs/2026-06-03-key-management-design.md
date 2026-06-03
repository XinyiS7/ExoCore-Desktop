# Key Management — Settings + Per-Session Key Selector

**Date:** 2026-06-03
**Status:** Approved
**Related spec:** ReactSheet_Reorganized.md §5.3–5.4

---

## 1. Overview

Two interrelated features:

1. **Settings → Key Manage** — CRUD for API keys (Gemini + DeepSeek), assign roles per platform.
2. **ChatArea expanded controls drawer** — per-session key-alias selector stored in localStorage, sent with every message.

---

## 2. API Reference

See ReactSheet_Reorganized.md §5.3–5.4 for full request/response shapes. Summary:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/core/apikeys/` | GET | List keys, optional `?platform=` filter |
| `/api/core/apikeys/` | POST | Create key `{ alias, platform, key_value }` |
| `/api/core/apikeys/<id>/` | PATCH | Update alias only `{ alias }` |
| `/api/core/apikeys/<id>/overwrite/` | PUT | Overwrite key_value `{ key_value }` |
| `/api/core/apikeys/<id>/` | DELETE | Cascade delete same-value keys |
| `/api/core/config/` | GET | Read SystemConfig (includes `key_map` for echo-back) |
| `/api/core/config/key-map/` | PUT | Assign keys to roles per platform |
| `/api/agents/chat/<sid>/` | POST | Send message; accepts optional `api_key_alias` |

**Key principle:** `key_value` is never returned by the API. Frontend only holds `{ id, alias, platform, last_four }`.

---

## 3. File Changes

| Action | File | Purpose |
|---|---|---|
| **Replace** | `views/SettingsView.jsx` | Full rewrite: left nav (A-layout) + right content area |
| **New** | `components/settings/KeyManagePanel.jsx` | Platform tabs (B-layout) + 4 role slots per platform |
| **New** | `hooks/useApiKeys.js` | Data-fetching hook for api keys list |
| **Modify** | `packages/shared/src/endpoints/config.js` | Add apikeys CRUD + key-map wrappers |
| **Modify** | `components/chat/ChatArea.jsx` | Expand `controlsExpanded` → drawer, add key-alias selector |
| **Evaluate** | `components/settings/SettingsPanel.jsx` | Remove if no remaining callers |

---

## 4. Settings Page Architecture

### 4.1 Layout (A-scheme: vertical left nav)

```
┌──────────────┬────────────────────────────────────────┐
│ ⚷ Key Manage │  [Gemini]  [DeepSeek]    ← top tabs   │
│   (active)   │                                        │
│              │  System Default (必填)                  │
│ ⏳ Routine    │  alias: [____]  key: [____] [保存]     │
│   Manage     │                                        │
│   (dimmed)   │  Session Default (选填)                 │
│              │  alias: [____]  key: [____] [保存]     │
│              │                                        │
│              │  Sub-agent Default (选填)               │
│              │  alias: [____]  key: [____] [保存]     │
│              │                                        │
│              │  Background Default (选填)              │
│              │  alias: [____]  key: [____] [保存]     │
└──────────────┴────────────────────────────────────────┘
```

- Left nav items: `Key Manage` (active, links to `/settings/keys`), `Routine Manage` (greyed out, "Coming soon" tooltip).
- Right content area: routed sub-page. For now only `/settings/keys` is implemented.

### 4.2 Routing

```
/settings            → redirect to /settings/keys
/settings/keys       → KeyManagePanel
/settings/routine    → placeholder "Coming soon" (future)
```

### 4.3 Left Nav Items

| Label | Route | State |
|---|---|---|
| Key Manage | `/settings/keys` | Active, implemented |
| Routine Manage | — | Disabled, greyed out |

---

## 5. KeyManagePanel Component

### 5.1 Layout (B-scheme: top tabs per platform)

- Platform tabs dynamically derived from model registry (`GET /api/core/models/` → unique `provider` values).
- Currently expected: **Gemini**, **DeepSeek**.
- Each tab contains **4 independent role slots**, each with its own save button.

### 5.2 Role Slots

| Role | Required | Behavior |
|---|---|---|
| System Default | **Yes** | alias + key both required on first create |
| Session Default | No | Falls back to system if unset |
| Sub-agent Default | No | Falls back to system if unset |
| Background Default | No | Falls back to system if unset |

### 5.3 State Machine (per platform tab)

```
Initial load
  ├─ GET /api/core/apikeys/?platform=<platform>
  ├─ GET /api/core/config/ (extract key_map[platform])
  │
  ├─ No key exists for this platform
  │   └─ «Empty state»: 4 blank slots, system row alias+key required
  │
  └─ Keys exist
      └─ «Echo state»: each assigned role shows alias + "...last4"
         Unassigned roles show "—"
```

### 5.4 Independent Save per Slot

Each of the 4 slots has its own **[Save]** button. Three operations per slot:

**Create (first time):**
1. `POST /api/core/apikeys/` with `{ alias, platform, key_value }`
2. On 201 → `PUT /api/core/config/key-map/` with updated role→id mapping
3. Both 200 → show "保存成功" ✅, refresh display

**Update alias:**
1. `PATCH /api/core/apikeys/<id>/` with `{ alias }`
2. On 200 → show "修改成功" ✅

**Overwrite key:**
1. Click to reveal key input, paste full key value (masked on screen as `...last4`)
2. `PUT /api/core/apikeys/<id>/overwrite/` with `{ key_value }`
3. On 200 → show "修改成功" ✅, new `last_four` reflected

**Delete:**
1. Click red delete button → confirmation dialog
2. `DELETE /api/core/apikeys/<id>/`
3. Cascade deletes same-value keys, clears from key_map
4. On 200 → show "删除成功" ✅, refresh display

### 5.5 Key Input Masking

- As user types/pastes the key, the input field immediately masks it: `...` + last 4 characters.
- The full key value is held in component state (never persisted to localStorage) and sent on save.
- After save, the full key value is discarded from component state.

---

## 6. ChatArea Controls Drawer

### 6.1 Expansion

Replace the current inline `controlsExpanded` row with a **drawer panel** that slides open above the input area when the SlidersHorizontal button is clicked.

### 6.2 Contents

```
┌──────────────────────────────────────────────────┐
│ Model & Thinking          │ Telemetry (collapsed)│
│ [model ▼] [thinking ▼] [temp ▼]                  │
│                                                   │
│ Key Alias     [session默认alias ▼]                │
│ Color Scheme  [Coming soon...]   (disabled)       │
└──────────────────────────────────────────────────┘
```

### 6.3 Key Alias Selector

**Data source:**
- `GET /api/core/config/` → `key_map`
- `GET /api/core/apikeys/` → all aliases per platform

**Filtering:**
- Determine platform from `currentModel` (lookup in model registry).
- Dropdown shows all aliases for that platform (all roles: system, session, sub_agent, background).

**Default value:**
- `key_map[platform].session` alias if set, otherwise `key_map[platform].system` alias.
- If user previously selected a different alias for this session, use that instead (from localStorage).

**Persistence:**
- `localStorage` key: `exo_session_key_${sessionId}` → alias string.
- Survives page refresh and browser close.

**Usage:**
- Sent as `api_key_alias` field in POST body to `/api/agents/chat/<sid>/`.
- If the user selects the default (system) alias, still send it explicitly.

### 6.4 Color Scheme Row

- Disabled/greyed out.
- Shows "Coming soon" placeholder text.
- Will be implemented in a follow-up.

---

## 7. localStorage Strategy

New key:

| Key | Value | Scope |
|---|---|---|
| `exo_session_key_${sessionId}` | alias string | Per-session key selection |

Existing keys unchanged.

Security note: **Never** store `key_value` in localStorage. Only alias is stored.

---

## 8. Data Flow Summary

```
                    Settings Page
                    ─────────────
                    GET /apikeys/ → [{ id, alias, platform, last_four }]
                    GET /config/  → { key_map: { gemini: {...}, deepseek: {...} } }
                    
                    User creates/edits/deletes keys
                    → POST/PATCH/PUT/DELETE /apikeys/*
                    → PUT /config/key-map/

                    ChatArea
                    ────────
                    GET /config/  → key_map
                    currentModel  → platform
                    
                    key_map[platform].session ?? system → default alias
                    
                    User may override via dropdown
                    → localStorage: exo_session_key_${sid} = alias
                    
                    On send:
                    POST /chat/<sid>/ { ..., api_key_alias }
```

---

## 9. Component Tree

```
App.jsx
├─ DesktopSidebar
│   └─ Settings icon → /settings
│
├─ /settings
│   └─ SettingsView.jsx          (new, A-layout)
│       ├─ LeftNav
│       │   ├─ Key Manage        → /settings/keys
│       │   └─ Routine Manage    (disabled)
│       │
│       └─ <Outlet>
│           └─ /settings/keys
│               └─ KeyManagePanel.jsx   (B-layout platform tabs)
│                   └─ RoleSlot ×4      (per platform)
│
└─ /chat/:sessionId
    └─ ChatArea.jsx
        └─ ControlsDrawer         (expanded from SlidersHorizontal)
            ├─ Model/Thinking/Temp selectors
            ├─ KeyAliasSelector   (dropdown, localStorage-backed)
            └─ ColorSchemeRow     (disabled placeholder)
```

---

## 10. Non-Goals (explicitly out of scope)

- Google Calendar key management (backend handles unavailability).
- Color scheme implementation (placeholder only).
- Routine Manage page.
- Mobile-specific layout adaptations (desktop-first; mobile can follow existing patterns).
- Sub-agent / background key validation on session send (backend accepts any valid alias).
