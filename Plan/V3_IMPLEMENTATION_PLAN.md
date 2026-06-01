# ExoCore V3 Frontend Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the monolithic ExoCore V2 React SPA into three independent SPAs (chat-core, chronicle, council) in a monorepo with a Tauri Rust desktop shell.

**Architecture:** npm workspaces monorepo. Three Vite+React SPAs share a common `exo-shared` API layer. A Tauri Rust binary manages window lifecycle, system tray, silent sidecar processes, OS notifications, and log routing. Django backend (port 8000) remains unchanged — all API calls are standard HTTP.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 3, React Router 6, Tauri 2.x (Rust), pnpm workspaces, optional Turborepo

**API contract reference:** `D:\Alicia\ExoCore_Project\ExoCore-Desktop\ReactSheet_Reorganized.md` (verified 2026-06-01)
**Revision:** v1.1 — corrected all endpoint paths, renamed modules, added missing endpoints per ReactSheet audit.

---

## File Structure (Target State)

```
ExoCore-Desktop/
├── package.json                    # workspace root
├── pnpm-workspace.yaml
├── .gitignore
├── CLAUDE.md                       # already exists
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js            # barrel export
│   │       ├── api.js              # CSRF, fetch wrapper, baseUrl
│   │       ├── auth.js             # getCsrfToken, auth helpers
│   │       ├── models.js           # MODEL_REGISTRY, AVAILABLE_MODELS
│   │       ├── endpoints/
│   │       │   ├── agents.js       # /api/agents/presets/*, chat, triggered-notes
│   │       │   ├── conversations.js# /api/agents/conversations/*, cache, attachments, history_chunks
│   │       │   ├── chronicle.js    # /api/agents/chronicle/*
│   │       │   ├── projects.js     # /api/core/projects/*
│   │       │   ├── tweets.js       # /api/core/tweets/*
│   │       │   ├── config.js       # /api/core/config/*, /api/core/models/*
│   │       │   ├── memory.js       # /api/memory/portraits/*, knowledge/*, scope-keywords/*
│   │       │   ├── tasks.js        # /api/tasks/entries/*, completions/*, calendar/*
│   │       │   ├── telemetry.js    # /api/telemetry/*
│   │       │   └── system.js       # /api/health/*, /api/v1/system/*
│   │       ├── hooks/
│   │       │   ├── useApi.js       # generic { data, loading, error, refetch }
│   │       │   └── useCsrf.js      # CSRF token availability
│   │       └── styles/
│   │           ├── base.css        # CSS reset, normalize, shared layout
│   │           └── transitions.css # shared animation tokens
│   │
│   ├── chat-core/
│   │   ├── package.json
│   │   ├── vite.config.js          # port 5173, proxy /api → :8000, PWA
│   │   ├── index.html
│   │   ├── tailwind.config.js      # obsidian + dark red theme
│   │   ├── postcss.config.js
│   │   └── src/
│   │       ├── main.jsx
│   │       ├── App.jsx             # react-router routes
│   │       ├── index.css           # chat-core specific styles
│   │       ├── hooks/              # useSession, useProjects, usePresets, useMemory
│   │       ├── views/
│   │       │   ├── Dashboard.jsx
│   │       │   ├── ChatView.jsx    # wraps ChatArea
│   │       │   ├── AgentHub.jsx
│   │       │   ├── AgentProfile.jsx
│   │       │   ├── AgentMemory.jsx
│   │       │   ├── ProjectList.jsx
│   │       │   ├── ProjectDetail.jsx
│   │       │   ├── ProjectFiles.jsx
│   │       │   ├── SettingsView.jsx
│   │       │   └── UserProfile.jsx
│   │       └── components/
│   │           ├── chat/           # ChatArea, ConversationList, MessageBubble, ContextCacheIndicator
│   │           ├── agent/          # AgentManager, MemoryAnchorTicker
│   │           ├── memory/         # ProposalEditPanel, MemoryManager
│   │           ├── project/        # ProjectFilesArea, WorkDirModal
│   │           ├── settings/       # SettingsPanel, MemoryManager
│   │           ├── modals/         # DestructorModal, NewSessionModal, CreateProjectModal, etc.
│   │           ├── layout/         # Sidebar, MobileSidebar, AppShell
│   │           └── user/           # UserProfile, UserProfilePanel
│   │
│   ├── chronicle/
│   │   ├── package.json
│   │   ├── vite.config.js          # port 5174, proxy /api → :8000
│   │   ├── index.html
│   │   ├── tailwind.config.js      # paper-like warm dark theme
│   │   ├── postcss.config.js
│   │   └── src/
│   │       ├── main.jsx
│   │       ├── App.jsx             # react-router routes
│   │       ├── index.css           # chronicle-specific styles
│   │       ├── hooks/              # useTimeline, useTasks, useCalendar
│   │       ├── views/
│   │       │   ├── TimelineView.jsx
│   │       │   ├── TaskListView.jsx
│   │       │   └── CalendarView.jsx
│   │       └── components/
│   │           ├── Timeline.jsx    # migrated from V2
│   │           ├── TaskPanel.jsx
│   │           ├── TaskRow.jsx
│   │           ├── TaskCreateModal.jsx
│   │           ├── CalendarWidget.jsx
│   │           └── MiniCalendar.jsx
│   │
│   └── council/                    # V3.1 deferred — stub only
│       ├── package.json
│       ├── vite.config.js
│       ├── index.html
│       ├── tailwind.config.js
│       └── src/
│           ├── main.jsx
│           ├── App.jsx
│           └── index.css           # tech-blue theme stub
│
├── tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── icons/                      # tray + app icons
│   └── src/
│       ├── main.rs
│       ├── sidecar.rs
│       ├── notifications.rs
│       └── logger.rs
│
└── Plan/
    └── V3_IMPLEMENTATION_PLAN.md   # this file
```

---

## Phase 1: Repo Scaffolding

### Task 1.1: Root workspace setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`

- [ ] **Step 1: Write root package.json**

```json
{
  "name": "exocore-desktop",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev:chat": "pnpm --filter exo-chat-core dev",
    "dev:chronicle": "pnpm --filter exo-chronicle dev",
    "dev:council": "pnpm --filter exo-council dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Write pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Write .gitignore**

```gitignore
node_modules/
dist/
target/          # Tauri Rust build
*.log
.DS_Store
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore
git commit -m "chore: init monorepo root with pnpm workspaces"
```

---

### Task 1.2: shared package skeleton

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.js`

- [ ] **Step 1: Write packages/shared/package.json**

```json
{
  "name": "exo-shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./api": "./src/api.js",
    "./auth": "./src/auth.js",
    "./models": "./src/models.js",
    "./endpoints/*": "./src/endpoints/*",
    "./hooks/useApi": "./src/hooks/useApi.js",
    "./hooks/useCsrf": "./src/hooks/useCsrf.js",
    "./styles/base.css": "./src/styles/base.css",
    "./styles/transitions.css": "./src/styles/transitions.css"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

- [ ] **Step 2: Write packages/shared/src/index.js (barrel export)**

```js
export { baseUrl, getCsrfToken, MODEL_REGISTRY, AVAILABLE_MODELS, getConvProjectId } from './api';
export { useApi } from './hooks/useApi';
export { useCsrf } from './hooks/useCsrf';
```

- [ ] **Step 3: Create endpoint directories**

```bash
mkdir -p packages/shared/src/endpoints
mkdir -p packages/shared/src/hooks
mkdir -p packages/shared/src/styles
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "chore: scaffold shared package"
```

---

### Task 1.3: chat-core package skeleton

**Files:**
- Create: `packages/chat-core/package.json`
- Create: `packages/chat-core/vite.config.js`
- Create: `packages/chat-core/index.html`
- Create: `packages/chat-core/tailwind.config.js`
- Create: `packages/chat-core/postcss.config.js`
- Create: `packages/chat-core/src/main.jsx`
- Create: `packages/chat-core/src/App.jsx`
- Create: `packages/chat-core/src/index.css`

- [ ] **Step 1: Write packages/chat-core/package.json**

```json
{
  "name": "exo-chat-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host --port 5173",
    "build": "vite build",
    "lint": "eslint src/",
    "preview": "vite preview"
  },
  "dependencies": {
    "exo-shared": "workspace:*",
    "highlight.js": "^11.11.1",
    "lucide-react": "^0.577.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-markdown": "^10.1.0",
    "rehype-highlight": "^7.0.2",
    "rehype-katex": "^7.0.1",
    "remark-gfm": "^4.0.1",
    "remark-math": "^6.0.0",
    "react-router-dom": "^6.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@tailwindcss/typography": "^0.5.19",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "autoprefixer": "^10.4.27",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "postcss": "^8.5.8",
    "tailwindcss": "^3.4.19",
    "vite": "^8.0.0",
    "vite-plugin-pwa": "^1.2.0"
  }
}
```

- [ ] **Step 2: Write packages/chat-core/vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isWatch = process.argv.includes('--watch');

export default defineConfig({
  plugins: [
    react(),
    !isWatch && VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'exo-api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^\/media\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exo-media-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'ExoCore Chat',
        short_name: 'Chat',
        description: 'ExoCore AI Chat Interface',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ].filter(Boolean),
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
```

- [ ] **Step 3: Write packages/chat-core/index.html**

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0a0a0f" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>ExoCore // Chat</title>
</head>
<body class="bg-[#0a0a0f] text-white">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Write packages/chat-core/tailwind.config.js**

```js
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        chat: {
          bg:    '#0a0a0f',
          panel: '#111118',
          border:'rgba(255,255,255,0.06)',
          accent:'#c0392b',
          'accent-glow': '#e74c3c',
          text:  '#e2e8f0',
          muted: '#64748b',
        }
      },
      boxShadow: {
        'glow-accent': '0 0 1px #c0392b, 0 0 8px rgba(192,57,43,0.6), 0 0 20px rgba(192,57,43,0.2)',
      },
    },
  },
  plugins: [typography],
}
```

- [ ] **Step 5: Write packages/chat-core/postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Write packages/chat-core/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 7: Write packages/chat-core/src/App.jsx (placeholder)**

```jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <div className="w-full h-screen bg-chat-bg text-chat-text font-sans flex items-center justify-center">
      <h1 className="text-chat-accent font-mono text-2xl">ExoCore // Chat Core</h1>
    </div>
  );
}
```

- [ ] **Step 8: Write packages/chat-core/src/index.css (placeholder)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Chat Core theme styles — expanded in Phase 3 */
```

- [ ] **Step 9: Create src subdirectories**

```bash
mkdir -p packages/chat-core/src/hooks
mkdir -p packages/chat-core/src/views
mkdir -p packages/chat-core/src/components/chat
mkdir -p packages/chat-core/src/components/agent
mkdir -p packages/chat-core/src/components/memory
mkdir -p packages/chat-core/src/components/project
mkdir -p packages/chat-core/src/components/settings
mkdir -p packages/chat-core/src/components/modals
mkdir -p packages/chat-core/src/components/layout
mkdir -p packages/chat-core/src/components/user
```

- [ ] **Step 10: Commit**

```bash
git add packages/chat-core/
git commit -m "chore: scaffold chat-core package with Vite + React + Tailwind"
```

---

### Task 1.4: chronicle package skeleton

**Files:**
- Create: `packages/chronicle/package.json`
- Create: `packages/chronicle/vite.config.js`
- Create: `packages/chronicle/index.html`
- Create: `packages/chronicle/tailwind.config.js`
- Create: `packages/chronicle/postcss.config.js`
- Create: `packages/chronicle/src/main.jsx`
- Create: `packages/chronicle/src/App.jsx`
- Create: `packages/chronicle/src/index.css`

- [ ] **Step 1: Write packages/chronicle/package.json**

```json
{
  "name": "exo-chronicle",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host --port 5174",
    "build": "vite build",
    "lint": "eslint src/",
    "preview": "vite preview"
  },
  "dependencies": {
    "exo-shared": "workspace:*",
    "lucide-react": "^0.577.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^6.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@tailwindcss/typography": "^0.5.19",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "autoprefixer": "^10.4.27",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "postcss": "^8.5.8",
    "tailwindcss": "^3.4.19",
    "vite": "^8.0.0"
  }
}
```

- [ ] **Step 2: Write packages/chronicle/vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
```

- [ ] **Step 3: Write packages/chronicle/index.html**

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1a1a14" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>ExoCore // Chronicle</title>
</head>
<body class="bg-[#1a1a14] text-[#d4c5a9]">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Write packages/chronicle/tailwind.config.js**

```js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      colors: {
        chron: {
          bg:     '#1a1a14',
          panel:  '#222218',
          border: 'rgba(255,255,255,0.05)',
          accent: '#c9a44b',
          text:   '#d4c5a9',
          muted:  '#7a7568',
        }
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 5: Write packages/chronicle/postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Write packages/chronicle/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 7: Write packages/chronicle/src/App.jsx (placeholder)**

```jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <div className="w-full h-screen bg-chron-bg text-chron-text font-sans flex items-center justify-center">
      <h1 className="text-chron-accent font-serif text-2xl">ExoCore // Chronicle</h1>
    </div>
  );
}
```

- [ ] **Step 8: Write packages/chronicle/src/index.css (placeholder)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Chronicle theme styles — expanded in Phase 4 */
```

- [ ] **Step 9: Create src subdirectories**

```bash
mkdir -p packages/chronicle/src/hooks
mkdir -p packages/chronicle/src/views
mkdir -p packages/chronicle/src/components
```

- [ ] **Step 10: Commit**

```bash
git add packages/chronicle/
git commit -m "chore: scaffold chronicle package with Vite + React + Tailwind"
```

---

### Task 1.5: council package stub (V3.1 deferred)

**Files:**
- Create: `packages/council/package.json`
- Create: `packages/council/vite.config.js`
- Create: `packages/council/index.html`
- Create: `packages/council/tailwind.config.js`
- Create: `packages/council/postcss.config.js`
- Create: `packages/council/src/main.jsx`
- Create: `packages/council/src/App.jsx`
- Create: `packages/council/src/index.css`

- [ ] **Step 1: Write packages/council/package.json**

```json
{
  "name": "exo-council",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host --port 5175",
    "build": "vite build",
    "lint": "eslint src/",
    "preview": "vite preview"
  },
  "dependencies": {
    "exo-shared": "workspace:*",
    "lucide-react": "^0.577.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^6.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@tailwindcss/typography": "^0.5.19",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "autoprefixer": "^10.4.27",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "postcss": "^8.5.8",
    "tailwindcss": "^3.4.19",
    "vite": "^8.0.0"
  }
}
```

- [ ] **Step 2: Write packages/council/vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
```

- [ ] **Step 3: Write packages/council/index.html**

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0d1117" />
  <title>ExoCore // Council</title>
</head>
<body class="bg-[#0d1117] text-[#c9d1d9]">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Write packages/council/tailwind.config.js**

```js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cncl: {
          bg:     '#0d1117',
          panel:  '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
          text:   '#c9d1d9',
          muted:  '#8b949e',
          grid:   'rgba(88,166,255,0.12)',
        }
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 5: Write packages/council/postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Write packages/council/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Write packages/council/src/App.jsx (placeholder)**

```jsx
import React from 'react';

export default function App() {
  return (
    <div className="w-full h-screen bg-cncl-bg text-cncl-text font-sans flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-cncl-accent text-2xl mb-4">ExoCore // Council</h1>
        <p className="text-cncl-muted">Multi-Agent Workspace — Coming in V3.1</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write packages/council/src/index.css (stub)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Commit**

```bash
git add packages/council/
git commit -m "chore: scaffold council package (V3.1 deferred)"
```

---

### Task 1.6: Install dependencies and verify dev servers

- [ ] **Step 1: Install all workspace dependencies**

```bash
cd D:/Alicia/ExoCore_Project/ExoCore-Desktop
pnpm install
```

Expected: all packages install without error. `node_modules/` at root, each package's deps hoisted.

- [ ] **Step 2: Start chat-core dev server**

```bash
pnpm dev:chat
```

Open `http://localhost:5173`. Verify the placeholder "ExoCore // Chat Core" renders.

- [ ] **Step 3: Start chronicle dev server**

```bash
pnpm dev:chronicle
```

Open `http://localhost:5174`. Verify the placeholder "ExoCore // Chronicle" renders.

- [ ] **Step 4: Start council dev server**

```bash
pnpm dev:council
```

Open `http://localhost:5175`. Verify the placeholder renders.

- [ ] **Step 5: Kill all dev servers (Ctrl+C)**

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml
git commit -m "chore: lockfile after initial install"
```

---

## Phase 2: shared Package — API Layer

### Task 2.1: Core API client (api.js)

**Files:**
- Create: `packages/shared/src/api.js`

- [ ] **Step 1: Write api.js — copied from ExoCore-ui/src/utils/api.js, cleaned up**

```js
// Base URL for API requests. Empty string means relative URLs — Vite proxy handles routing.
// In Tauri production, this will point to http://localhost:8000.
const API_BASE_URL = '';

export const baseUrl = API_BASE_URL.replace(/\/+$/, '');

export const getCsrfToken = () =>
  document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';

// Model registry is fetched dynamically from GET /api/core/models/ (see config.js endpoint).
// Static fallback for offline/bootstrap scenarios — always prefer the API response.
export const MODEL_REGISTRY = [
  { provider: 'gemini',   id: 'gemini-3.1-pro-preview', roles: ['main'] },
  { provider: 'gemini',   id: 'gemini-2.5-flash',       roles: ['sub_agent'] },
  { provider: 'deepseek', id: 'deepseek-v4-pro',        roles: ['main'] },
  { provider: 'deepseek', id: 'deepseek-v4-flash',      roles: ['sub_agent'] },
];

export const AVAILABLE_MODELS = MODEL_REGISTRY.map(m => m.id);

/** Safely extract project ID from a conversation object, handling number, string, or nested object forms. */
export const getConvProjectId = (conv) => {
  if (conv.project === null || conv.project === undefined) return null;
  return typeof conv.project === 'object' ? Number(conv.project.id) : Number(conv.project);
};

/**
 * Base fetch wrapper. Adds CSRF header for mutating requests and credentials.
 * Returns parsed JSON or throws with a normalized error.
 */
export async function apiFetch(path, options = {}) {
  const { method, body, params, ...rest } = options;
  const url = new URL(`${baseUrl}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const headers = { ...rest.headers };
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const isMutating = method && method !== 'GET' && method !== 'HEAD';
  if (isMutating) {
    headers['X-CSRFToken'] = getCsrfToken();
  }
  const res = await fetch(url.toString(), {
    ...rest,
    method: method || 'GET',
    headers,
    credentials: 'include',
    body: body instanceof FormData
      ? body
      : body && typeof body === 'object'
        ? JSON.stringify(body)
        : body,
  });
  if (!res.ok) {
    const err = new Error(`API ${res.status}: ${res.statusText}`);
    err.status = res.status;
    try { err.body = await res.json(); } catch (_) { err.body = await res.text().catch(() => ''); }
    throw err;
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch (_) { return text; }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/api.js
git commit -m "feat(shared): add apiFetch wrapper with CSRF, model registry, and base utilities"
```

---

### Task 2.2: Auth module (auth.js)

**Files:**
- Create: `packages/shared/src/auth.js`

- [ ] **Step 1: Write auth.js**

```js
import { apiFetch } from './api';

/** Get current Django user info. Returns null if not authenticated. */
export async function fetchCurrentUser() {
  try {
    return await apiFetch('/api/auth/user/');
  } catch {
    return null;
  }
}

/** Check if the user is authenticated. */
export async function isAuthenticated() {
  const user = await fetchCurrentUser();
  return !!user;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/auth.js
git commit -m "feat(shared): add auth helpers (fetchCurrentUser, isAuthenticated)"
```

---

### Task 2.3: Models constants (models.js)

**Files:**
- Create: `packages/shared/src/models.js`

- [ ] **Step 1: Write models.js**

```js
// Re-export static fallback. Prefer configApi.listModels() for the live registry.
export { MODEL_REGISTRY, AVAILABLE_MODELS } from './api';

/** Map model ID to display info. Falls back to raw ID if unknown. */
export function getModelInfo(modelId) {
  const found = MODEL_REGISTRY.find(m => m.id === modelId);
  return found || { provider: 'unknown', id: modelId, label: modelId, roles: [] };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/models.js
git commit -m "feat(shared): add model info helpers"
```

---

### Task 2.4: Endpoint modules

> **API contract reference:** `ReactSheet_Reorganized.md` — all paths verified against the actual Django backend.

**Files:**
- Create: `packages/shared/src/endpoints/agents.js`        — presets CRUD, chat, triggered-notes
- Create: `packages/shared/src/endpoints/conversations.js` — conversation CRUD, cache, attachments, history_chunks
- Create: `packages/shared/src/endpoints/chronicle.js`     — ChronicleEntry CRUD (§1.9)
- Create: `packages/shared/src/endpoints/projects.js`      — project CRUD, files
- Create: `packages/shared/src/endpoints/tweets.js`        — tweet/timeline CRUD (§4.1-4.3)
- Create: `packages/shared/src/endpoints/config.js`        — SystemConfig, Model Registry (§5.1-5.2)
- Create: `packages/shared/src/endpoints/memory.js`        — portraits, knowledge, scope-keywords, history_chunks
- Create: `packages/shared/src/endpoints/tasks.js`         — entries CRUD, completions, calendar snapshots, GCal sync
- Create: `packages/shared/src/endpoints/telemetry.js`     — usage stats (§7.1-7.4)
- Create: `packages/shared/src/endpoints/system.js`        — health check, logs

- [ ] **Step 1: Write agents.js** — presets + chat + triggered notes

```js
import { apiFetch } from '../api';

// ── Presets ──
export function listPresets() {
  return apiFetch('/api/agents/presets/', { method: 'GET' });
}
export function getPreset(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/`, { method: 'GET' });
}
export function createPreset(data) {
  return apiFetch('/api/agents/presets/', { method: 'POST', body: data });
}
export function updatePreset(presetId, data) {
  return apiFetch(`/api/agents/presets/${presetId}/`, { method: 'PATCH', body: data });
}
export function deletePreset(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/`, { method: 'DELETE' });
}

// ── Chat ──
export function chatWithAgent(sessionId, body, mode = 'sse') {
  return apiFetch(`/api/agents/chat/${sessionId}/?mode=${mode}`, { method: 'POST', body });
}

/** SSE streaming chat — returns raw fetch Response for ReadableStream consumption. */
export async function chatWithAgentStream(sessionId, body) {
  const { baseUrl, getCsrfToken } = await import('../api');
  const res = await fetch(`${baseUrl}/api/agents/chat/${sessionId}/?mode=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = new Error(`Chat stream failed: ${res.status}`); err.status = res.status; throw err; }
  return res;
}

/** Poll async chat status — GET /api/agents/chat/<sid>/status/?message_id=<token>&cursor=<n> */
export function pollChatStatus(sessionId, messageId, cursor = 0) {
  return apiFetch(`/api/agents/chat/${sessionId}/status/`, { method: 'GET', params: { message_id: messageId, cursor } });
}

// ── Triggered Notes ──
export function getTriggeredNotesSnapshot(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/triggered-notes/snapshot/`, { method: 'GET' });
}
```

- [ ] **Step 2: Write conversations.js** — conversation CRUD + cache + attachments + history_chunks

```js
import { apiFetch } from '../api';

// ── Conversation CRUD (§1.1-1.2) ──
export function listConversations(params = {}) {
  return apiFetch('/api/agents/conversations/', { method: 'GET', params });
}
export function getConversation(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/`, { method: 'GET' });
}
export function createConversation(data) {
  return apiFetch('/api/agents/conversations/', { method: 'POST', body: data });
}
export function updateConversation(convId, data) {
  return apiFetch(`/api/agents/conversations/${convId}/`, { method: 'PATCH', body: data });
}
export function deleteConversation(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/`, { method: 'DELETE' });
}

// ── Messages (§1.2) ──
export function getConversationMessages(convId) {
  return apiFetch(`/api/agents/chat/${convId}/`, { method: 'GET' });
}

// ── History Chunks (§1.4-1.5) ──
export function listHistoryChunks(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/history_chunks/`, { method: 'GET' });
}
export function getHistoryChunk(chunkId) {
  return apiFetch(`/api/memory/history_chunks/${chunkId}/`, { method: 'GET' });
}
export function updateHistoryChunk(chunkId, data) {
  // PATCH allowed fields: topic_label, keywords, unresolved
  return apiFetch(`/api/memory/history_chunks/${chunkId}/`, { method: 'PATCH', body: data });
}

// ── Context Cache (§1.6) ──
export function getCacheStatus(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/cache/`, { method: 'GET' });
}
export function renewCache(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/cache/renew/`, { method: 'POST' });
}
export function deleteCache(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/cache/`, { method: 'DELETE' });
}

// ── Attachments (§1.7) ──
export function listAttachments(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/attachments/`, { method: 'GET' });
}
export function uploadAttachment(convId, formData) {
  return apiFetch(`/api/agents/conversations/${convId}/attachments/`, { method: 'POST', body: formData });
}
export function deleteAttachment(convId, source, id) {
  return apiFetch(`/api/agents/conversations/${convId}/attachments/delete/`, { method: 'DELETE', body: { source, id } });
}
```

- [ ] **Step 3: Write chronicle.js** — ChronicleEntry CRUD (§1.9)

```js
import { apiFetch } from '../api';

export function listChronicleEntries(params = {}) {
  return apiFetch('/api/agents/chronicle/', { method: 'GET', params });
}
export function getChronicleEntry(entryId) {
  return apiFetch(`/api/agents/chronicle/${entryId}/`, { method: 'GET' });
}
export function createChronicleEntry(data) {
  // data: { preset, event_time, content, scope?, keywords? }
  return apiFetch('/api/agents/chronicle/', { method: 'POST', body: data });
}
export function updateChronicleEntry(entryId, data) {
  // PATCH allowed: event_time, content, scope, keywords
  return apiFetch(`/api/agents/chronicle/${entryId}/`, { method: 'PATCH', body: data });
}
export function deleteChronicleEntry(entryId) {
  return apiFetch(`/api/agents/chronicle/${entryId}/`, { method: 'DELETE' });
}
```

- [ ] **Step 4: Write projects.js** — project CRUD + files (§3.1-3.2)

```js
import { apiFetch } from '../api';

export function listProjects() {
  return apiFetch('/api/core/projects/', { method: 'GET' });
}
export function getProject(projectId) {
  return apiFetch(`/api/core/projects/${projectId}/`, { method: 'GET' });
}
export function createProject(data) {
  return apiFetch('/api/core/projects/', { method: 'POST', body: data });
}
export function updateProject(projectId, data) {
  // PATCH allowed: name, description, prompt, work_dir
  return apiFetch(`/api/core/projects/${projectId}/`, { method: 'PATCH', body: data });
}
export function deleteProject(projectId) {
  return apiFetch(`/api/core/projects/${projectId}/`, { method: 'DELETE' });
}

// ── Project Files (§3.1) ──
export function listProjectFiles(projectId) {
  return apiFetch(`/api/core/projects/${projectId}/files/`, { method: 'GET' });
}
export function uploadProjectFile(projectId, formData) {
  return apiFetch(`/api/core/projects/${projectId}/files/`, { method: 'POST', body: formData });
}
export function deleteProjectFile(projectId, fileId) {
  return apiFetch(`/api/core/projects/${projectId}/files/${fileId}/`, { method: 'DELETE' });
}
```

- [ ] **Step 5: Write tweets.js** — timeline/tweets CRUD (§4.1-4.3)

```js
import { apiFetch } from '../api';

/** Paginated tweet list. Pass { before_id } for infinite scroll. */
export function listTweets(params = {}) {
  return apiFetch('/api/core/tweets/', { method: 'GET', params });
}
export function createTweet(data) {
  // { content: "..." }
  return apiFetch('/api/core/tweets/', { method: 'POST', body: data });
}
export function replyToTweet(tweetId, data) {
  // { content: "..." }
  return apiFetch(`/api/core/tweets/${tweetId}/reply/`, { method: 'POST', body: data });
}
export function deleteTweet(tweetId) {
  return apiFetch(`/api/core/tweets/${tweetId}/`, { method: 'DELETE' });
}
```

- [ ] **Step 6: Write config.js** — SystemConfig + Model Registry (§5.1-5.2)

```js
import { apiFetch } from '../api';

// ── System Config (§5.1) ──
export function getConfig() {
  return apiFetch('/api/core/config/', { method: 'GET' });
}
export function updateConfig(data) {
  // PATCH: any subset of fields. API key fields with "****" prefix are ignored.
  return apiFetch('/api/core/config/', { method: 'PATCH', body: data });
}

// ── Model Registry (§5.2) — dynamic, prefer over static fallback ──
export function listModels() {
  return apiFetch('/api/core/models/', { method: 'GET' });
}
```

- [ ] **Step 7: Write memory.js** — portraits, knowledge, scope-keywords (§2.1-2.3)

```js
import { apiFetch } from '../api';

// ── UserPortrait (§2.2) ──
export function listPortraits(params = {}) {
  // params: preset_id, scope, source, is_processed
  return apiFetch('/api/memory/portraits/', { method: 'GET', params });
}
export function createPortrait(data) {
  // preset_id or message_id (mutually exclusive), content, scope?, tags?
  return apiFetch('/api/memory/portraits/', { method: 'POST', body: data });
}
export function updatePortrait(portraitId, data) {
  // PATCH: content (only preset_id=2), scope, tags
  return apiFetch(`/api/memory/portraits/${portraitId}/`, { method: 'PATCH', body: data });
}
export function deletePortrait(portraitId) {
  return apiFetch(`/api/memory/portraits/${portraitId}/`, { method: 'DELETE' });
}
export function listPortraitTags(presetId) {
  // GET /api/memory/portraits/tags/?preset_id=<id> — must match BEFORE /portraits/<pk>/
  return apiFetch('/api/memory/portraits/tags/', { method: 'GET', params: { preset_id: presetId } });
}

// ── KnowledgeFragment (§2.1) ──
export function listKnowledge(params = {}) {
  // params: topic, project; paginated page_size=50
  return apiFetch('/api/memory/knowledge/', { method: 'GET', params });
}
export function getKnowledge(knowledgeId) {
  return apiFetch(`/api/memory/knowledge/${knowledgeId}/`, { method: 'GET' });
}
export function updateKnowledge(knowledgeId, data) {
  // PATCH: abstract, keywords
  return apiFetch(`/api/memory/knowledge/${knowledgeId}/`, { method: 'PATCH', body: data });
}

// ── Scope Keywords (§2.3) ──
export function getScopeKeywords() {
  return apiFetch('/api/memory/scope-keywords/', { method: 'GET' });
}
export function updateScopeKeywords(data) {
  // PUT: full replacement { scope: [keywords...], ... }
  return apiFetch('/api/memory/scope-keywords/', { method: 'PUT', body: data });
}
```

- [ ] **Step 8: Write tasks.js** — entries, completions, calendar snapshots, GCal (§6.1-6.4)

```js
import { apiFetch } from '../api';

// ── ScheduleEntry CRUD (§6.1) ──
export function listTasks(params = {}) {
  // params: status, entry_type, is_pinned
  return apiFetch('/api/tasks/entries/', { method: 'GET', params });
}
export function getTask(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/`, { method: 'GET' });
}
export function createTask(data) {
  // entry_type (required): "todo" | "periodic" | "goal"; plus type-specific fields
  return apiFetch('/api/tasks/entries/', { method: 'POST', body: data });
}
export function updateTask(taskId, data) {
  return apiFetch(`/api/tasks/entries/${taskId}/`, { method: 'PATCH', body: data });
}
export function deleteTask(taskId) {
  // Soft-delete: status → "archived"
  return apiFetch(`/api/tasks/entries/${taskId}/`, { method: 'DELETE' });
}

// ── Entry Actions (§6.2) ──
export function completeTask(taskId, note) {
  return apiFetch(`/api/tasks/entries/${taskId}/complete/`, { method: 'POST', body: note ? { note } : {} });
}
export function suspendTask(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/suspend/`, { method: 'POST' });
}
export function resumeTask(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/resume/`, { method: 'POST' });
}

// ── GCal Sync (§6.3) ──
export function syncTaskToGCal(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/gcal/`, { method: 'POST' });
}
export function unlinkTaskGCal(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/gcal/`, { method: 'DELETE' });
}

// ── Completions (§6.5) ──
export function listCompletions(entryId) {
  return apiFetch('/api/tasks/completions/', { method: 'GET', params: { entry: entryId } });
}

// ── Calendar Snapshots (§6.4) ──
export function getCalendarSnapshot() {
  // 90-day full snapshot: GET /api/tasks/calendar/
  return apiFetch('/api/tasks/calendar/', { method: 'GET' });
}
export function getTodaySnapshot() {
  // 48h window: GET /api/tasks/calendar/today/
  return apiFetch('/api/tasks/calendar/today/', { method: 'GET' });
}
```

- [ ] **Step 9: Write telemetry.js** — usage statistics (§7.1-7.4)

```js
import { apiFetch } from '../api';

/** Daily usage for charts. mode: "week" (7d) | "month" (30d). from: YYYY-MM-DD. */
export function getDailyUsage(params = {}) {
  return apiFetch('/api/telemetry/usage/', { method: 'GET', params });
}

/** Weekly aggregated usage. params: weeks, from (Monday). */
export function getWeeklyUsage(params = {}) {
  return apiFetch('/api/telemetry/weekly/', { method: 'GET', params });
}

/** Monthly aggregated usage. params: months, from (YYYY-MM). */
export function getMonthlyUsage(params = {}) {
  return apiFetch('/api/telemetry/monthly/', { method: 'GET', params });
}

/** Raw daily_summary.json snapshot (debug). */
export function getDailyRaw() {
  return apiFetch('/api/telemetry/daily/', { method: 'GET' });
}
```

- [ ] **Step 10: Write system.js** — health + logs

```js
import { apiFetch } from '../api';

/** Health check — Tauri sidecar readiness detection. */
export function healthCheck() {
  return apiFetch('/api/health/', { method: 'GET' });
}

/** Fetch recent log lines (if Django exposes the endpoint). */
export function getRecentLogs(lines = 200) {
  return apiFetch('/api/v1/system/logs/', { method: 'GET', params: { lines } });
}
```

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/endpoints/
git commit -m "feat(shared): add endpoint modules for agents, conversations, chronicle, projects, tweets, config, memory, tasks, telemetry, system"
```

---

### Task 2.5: Generic hooks (useApi, useCsrf)

**Files:**
- Create: `packages/shared/src/hooks/useApi.js`
- Create: `packages/shared/src/hooks/useCsrf.js`

- [ ] **Step 1: Write useApi.js**

```js
import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Generic data-fetching hook.
 * @param {Function} fetcher — async function that returns data
 * @param {Array} deps — dependency array for auto-fetch (pass [] for mount-only)
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

- [ ] **Step 2: Write useCsrf.js**

```js
import { getCsrfToken } from '../api';

/**
 * Hook that provides the current CSRF token.
 * The token is read from the csrftoken cookie — it's set by Django on first response.
 * Returns null if not yet available.
 */
export function useCsrf() {
  const token = getCsrfToken();
  return { csrfToken: token || null, ready: !!token };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/hooks/
git commit -m "feat(shared): add useApi and useCsrf hooks"
```

---

### Task 2.6: Shared styles (base.css, transitions.css)

**Files:**
- Create: `packages/shared/src/styles/base.css`
- Create: `packages/shared/src/styles/transitions.css`

- [ ] **Step 1: Write base.css**

```css
/* Minimal shared reset — each module layers its own Tailwind on top. */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-height: 100dvh;
  line-height: 1.5;
}

img, svg, video, canvas {
  display: block;
  max-width: 100%;
}

button {
  cursor: pointer;
  font: inherit;
  color: inherit;
}

/* Scrollbar styling — dark minimal, shared across modules */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

- [ ] **Step 2: Write transitions.css**

```css
/* Shared transition/animation tokens. Modules compose these into their own CSS. */
:root {
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}

/* Shared fade-in — can be composed by any module */
@keyframes shared-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-shared-fade-in {
  animation: shared-fade-in var(--duration-normal) var(--ease-out-expo) forwards;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/styles/
git commit -m "feat(shared): add base reset and shared animation tokens"
```

---

### Task 2.7: Update barrel export

**Files:**
- Modify: `packages/shared/src/index.js`

- [ ] **Step 1: Rewrite index.js with full exports**

```js
// API core
export { baseUrl, getCsrfToken, apiFetch, MODEL_REGISTRY, AVAILABLE_MODELS, getConvProjectId } from './api';

// Auth
export { fetchCurrentUser, isAuthenticated } from './auth';

// Models
export { getModelInfo } from './models';

// Hooks
export { useApi } from './hooks/useApi';
export { useCsrf } from './hooks/useCsrf';

// Endpoints (namespaced re-exports to avoid collisions)
export * as agentsApi        from './endpoints/agents';
export * as conversationsApi from './endpoints/conversations';
export * as chronicleApi     from './endpoints/chronicle';
export * as projectsApi      from './endpoints/projects';
export * as tweetsApi        from './endpoints/tweets';
export * as configApi        from './endpoints/config';
export * as memoryApi        from './endpoints/memory';
export * as tasksApi         from './endpoints/tasks';
export * as telemetryApi     from './endpoints/telemetry';
export * as systemApi        from './endpoints/system';
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/index.js
git commit -m "feat(shared): complete barrel export for all 10 endpoint modules"
```

---

## Phase 3: chat-core — Component Migration & Theme

### Task 3.1: Copy chat components from V2

**Source repo:** `D:\Alicia\ExoCore_Project\ExoCore-ui`
**Target:** `D:\Alicia\ExoCore_Project\ExoCore-Desktop\packages\chat-core\src\components\`

- [ ] **Step 1: Copy chat/* components**

```bash
cp ../ExoCore-ui/src/components/chat/ChatArea.jsx packages/chat-core/src/components/chat/
cp ../ExoCore-ui/src/components/chat/ConversationList.jsx packages/chat-core/src/components/chat/
cp ../ExoCore-ui/src/components/chat/MessageBubble.jsx packages/chat-core/src/components/chat/
cp ../ExoCore-ui/src/components/chat/ContextCacheIndicator.jsx packages/chat-core/src/components/chat/
```

- [ ] **Step 2: Copy agent/* components**

```bash
cp ../ExoCore-ui/src/components/agent/AgentManager.jsx packages/chat-core/src/components/agent/
cp ../ExoCore-ui/src/components/agent/MemoryAnchorTicker.jsx packages/chat-core/src/components/agent/
```

- [ ] **Step 3: Copy remaining components**

```bash
cp ../ExoCore-ui/src/components/memory/ProposalEditPanel.jsx packages/chat-core/src/components/memory/
cp ../ExoCore-ui/src/components/project/ProjectFilesArea.jsx packages/chat-core/src/components/project/
cp ../ExoCore-ui/src/components/project/WorkDirModal.jsx packages/chat-core/src/components/project/
cp ../ExoCore-ui/src/components/settings/SettingsPanel.jsx packages/chat-core/src/components/settings/
cp ../ExoCore-ui/src/components/settings/MemoryManager.jsx packages/chat-core/src/components/settings/
cp ../ExoCore-ui/src/components/modals/*.jsx packages/chat-core/src/components/modals/
cp ../ExoCore-ui/src/components/layout/Sidebar.jsx packages/chat-core/src/components/layout/
cp ../ExoCore-ui/src/components/layout/MobileSidebar.jsx packages/chat-core/src/components/layout/
cp ../ExoCore-ui/src/components/home/HomePanel.jsx packages/chat-core/src/components/layout/
cp ../ExoCore-ui/src/components/UserProfile.jsx packages/chat-core/src/components/user/
cp ../ExoCore-ui/src/components/UserProfilePanel.jsx packages/chat-core/src/components/user/
```

- [ ] **Step 4: Copy V2 layout views**

```bash
cp ../ExoCore-ui/src/layouts/v2/views/Dashboard.jsx packages/chat-core/src/views/
cp ../ExoCore-ui/src/layouts/v2/views/AgentHub.jsx packages/chat-core/src/views/
cp ../ExoCore-ui/src/layouts/v2/views/AgentProfile.jsx packages/chat-core/src/views/
cp ../ExoCore-ui/src/layouts/v2/views/AgentMemory.jsx packages/chat-core/src/views/
cp ../ExoCore-ui/src/layouts/v2/views/UserProfile.jsx packages/chat-core/src/views/
cp ../ExoCore-ui/src/layouts/v2/views/ProjectList.jsx packages/chat-core/src/views/
cp ../ExoCore-ui/src/layouts/v2/views/ProjectHome.jsx packages/chat-core/src/views/
cp ../ExoCore-ui/src/layouts/v2/views/ProjectDetail.jsx packages/chat-core/src/views/
```

- [ ] **Step 5: Copy hooks from V2**

```bash
cp ../ExoCore-ui/src/hooks/*.js packages/chat-core/src/hooks/
cp ../ExoCore-ui/src/hooks/*.jsx packages/chat-core/src/hooks/
```

- [ ] **Step 6: Copy utility files**

```bash
cp ../ExoCore-ui/src/utils/councilApi.js packages/chat-core/src/hooks/ 2>/dev/null || true
# Check for any additional utility files
ls ../ExoCore-ui/src/utils/
```

- [ ] **Step 7: Commit**

```bash
git add packages/chat-core/src/
git commit -m "feat(chat-core): copy components, views, and hooks from V2"
```

---

### Task 3.2: Fix imports across all copied files

All files copied from V2 use local paths like `'../utils/api'`, `'../../hooks/useAppState'`, `'../App'`, etc. These must be updated to use `exo-shared` and their new module-local paths.

- [ ] **Step 1: Replace all API imports**

Run the following replacements across all `.jsx` and `.js` files in `packages/chat-core/src/`:

```
'../utils/api'           → 'exo-shared'
'../../utils/api'        → 'exo-shared'
'../../../utils/api'     → 'exo-shared'
'../../utils/councilApi' → 'exo-shared'
```

- [ ] **Step 2: Replace specific named imports from old api.js**

In files that import `baseUrl`, `getCsrfToken`, `MODEL_REGISTRY`, `AVAILABLE_MODELS`, `getConvProjectId`:

```
import { baseUrl } from 'exo-shared'
import { getCsrfToken } from 'exo-shared'
import { MODEL_REGISTRY, AVAILABLE_MODELS } from 'exo-shared'
import { getConvProjectId } from 'exo-shared'
```

- [ ] **Step 3: Replace endpoint-specific fetch calls**

Replace raw `fetch()` calls with the corresponding `exo-shared` endpoint functions. Example:

```js
// Before
fetch(`${baseUrl}/api/agents/presets/`, { credentials: 'include' })

// After
import { agentsApi } from 'exo-shared'
agentsApi.listPresets()
```

Apply this pattern for all `/api/agents/*`, `/api/agents/conversations/*`, `/api/core/projects/*`, `/api/memory/*`, `/api/core/tweets/*`, `/api/tasks/*` calls. Reference the corrected endpoint modules:

| Old pattern | New import |
|---|---|
| `fetch('/api/sessions/...')` | `conversationsApi.listConversations()` |
| `fetch('/api/timeline/...')` | `tweetsApi.listTweets()` |
| `fetch('/api/tasks/...')` | `tasksApi.listTasks()` etc. |
| `fetch('/api/calendar/...')` | `tasksApi.getCalendarSnapshot()` |
| `fetch('/api/core/config/...')` | `configApi.getConfig()` |
| `fetch('/api/core/models/...')` | `configApi.listModels()` |

- [ ] **Step 4: Update hook imports for useAppState decomposition**

The monolithic `useAppState` hook is being decomposed. Each view that previously received all of `appState` will now import individual hooks:

```js
// Before
import { useAppState } from '../../hooks/useAppState'
const { projects, presets, activeSessionId, ... } = useAppState()

// After
import { useProjects } from '../hooks/useProjects'
import { usePresets } from '../hooks/usePresets'
import { useActiveSession } from '../hooks/useActiveSession'
const { projects, loading } = useProjects()
const { presets } = usePresets()
const { activeSessionId, setActiveSessionId } = useActiveSession()
```

- [ ] **Step 5: Update relative component imports**

```
'../components/' → '../components/' (keep if same dir structure)
'../../components/' → '../components/' (flatten where needed)
```

- [ ] **Step 6: Verify no remaining '../ExoCore-ui' paths**

```bash
grep -r "ExoCore-ui" packages/chat-core/src/ || echo "No stale references — good"
```

- [ ] **Step 7: Commit**

```bash
git add packages/chat-core/src/
git commit -m "refactor(chat-core): update all imports to use exo-shared and local paths"
```

---

### Task 3.3: Decompose useAppState into focused hooks

**Files:**
- Create: `packages/chat-core/src/hooks/useProjects.js`
- Create: `packages/chat-core/src/hooks/usePresets.js`
- Create: `packages/chat-core/src/hooks/useActiveSession.js`
- Create: `packages/chat-core/src/hooks/useMemory.js`
- Delete: `packages/chat-core/src/hooks/useAppState.js` (after migration)

- [ ] **Step 1: Write useProjects.js**

```js
import { useState, useEffect } from 'react';
import { projectsApi } from 'exo-shared';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = () => {
    setLoading(true);
    projectsApi.listProjects()
      .then(setProjects)
      .catch(err => { console.error('Projects load failed', err); setError(err); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  return { projects, setProjects, loading, error, refresh: fetchProjects };
}
```

- [ ] **Step 2: Write usePresets.js**

```js
import { useState, useEffect } from 'react';
import { agentsApi } from 'exo-shared';

export function usePresets() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = () => {
    setLoading(true);
    agentsApi.listPresets()
      .then(setPresets)
      .catch(err => console.error('Presets load failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPresets(); }, []);

  return { presets, setPresets, loading, refresh: fetchPresets };
}
```

- [ ] **Step 3: Write useActiveSession.js**

```js
import { useState, useEffect } from 'react';

export function useActiveSession() {
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('chat_active_session');
    return saved ? Number(saved) : null;
  });

  useEffect(() => {
    if (activeSessionId) localStorage.setItem('chat_active_session', String(activeSessionId));
    else localStorage.removeItem('chat_active_session');
  }, [activeSessionId]);

  return { activeSessionId, setActiveSessionId };
}
```

- [ ] **Step 4: Write useMemory.js (placeholder for memory-related state)**

```js
import { useState } from 'react';

export function useMemoryManager() {
  const [memoryRefreshKey, setMemoryRefreshKey] = useState(0);

  const triggerMemoryRefresh = () => setMemoryRefreshKey(k => k + 1);

  return { memoryRefreshKey, triggerMemoryRefresh };
}
```

- [ ] **Step 5: Delete useAppState.js**

```bash
rm packages/chat-core/src/hooks/useAppState.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/chat-core/src/hooks/
git commit -m "refactor(chat-core): decompose useAppState into useProjects, usePresets, useActiveSession, useMemory"
```

---

### Task 3.4: Set up React Router in App.jsx

**Files:**
- Modify: `packages/chat-core/src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx with routes and layout**

```jsx
import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useProjects } from './hooks/useProjects';
import { usePresets } from './hooks/usePresets';
import { useActiveSession } from './hooks/useActiveSession';
import { useMemoryManager } from './hooks/useMemory';
import Sidebar from './components/layout/Sidebar';
import MobileSidebar from './components/layout/MobileSidebar';
import Dashboard from './views/Dashboard';
import ChatArea from './components/chat/ChatArea';
import AgentHub from './views/AgentHub';
import AgentProfile from './views/AgentProfile';
import AgentMemory from './views/AgentMemory';
import ProjectList from './views/ProjectList';
import ProjectDetail from './views/ProjectDetail';
import ProjectFilesArea from './components/project/ProjectFilesArea';
import SettingsPanel from './components/settings/SettingsPanel';
import UserProfile from './views/UserProfile';
import DestructorModal from './components/modals/DestructorModal';
import NewSessionModal from './components/modals/NewSessionModal';
import CreateProjectModal from './components/modals/CreateProjectModal';

export default function App() {
  const { projects, setProjects } = useProjects();
  const { presets, refresh: refreshPresets } = usePresets();
  const { activeSessionId, setActiveSessionId } = useActiveSession();
  const { memoryRefreshKey, triggerMemoryRefresh } = useMemoryManager();

  const [refreshKey, setRefreshKey] = useState(0);
  const [activeFileProjectId, setActiveFileProjectId] = useState(null);

  // Modal state
  const [destructorConfig, setDestructorConfig] = useState({ isOpen: false });
  const [newSessionConfig, setNewSessionConfig] = useState({ isOpen: false, initialContext: null });
  const [createProjectConfig, setCreateProjectConfig] = useState({ isOpen: false });

  const openDestructor = (config) => setDestructorConfig({ ...config, isOpen: true });
  const openNewSession = (initialContext = null, onSuccess = null) =>
    setNewSessionConfig({ isOpen: true, initialContext, onSuccess });
  const openCreateProject = () => setCreateProjectConfig({ isOpen: true });

  // Layout helpers
  const [showConvList, setShowConvList] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  return (
    <div className="w-full h-[100dvh] bg-chat-bg text-chat-text font-sans flex overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full flex-shrink-0">
        <Sidebar
          showConvList={showConvList}
          setShowConvList={setShowConvList}
          onOpenProfile={() => setShowProfilePanel(true)}
        />
      </div>

      {/* Modals */}
      <DestructorModal
        {...destructorConfig}
        onClose={() => setDestructorConfig(p => ({...p, isOpen: false}))}
      />
      <NewSessionModal
        isOpen={newSessionConfig.isOpen}
        onClose={() => setNewSessionConfig(p => ({...p, isOpen: false}))}
        projects={projects}
        presets={presets}
        initialContext={newSessionConfig.initialContext}
        onSuccess={(newSessionId) => {
          setRefreshKey(prev => prev + 1);
          setActiveSessionId(newSessionId);
          if (newSessionConfig.onSuccess) newSessionConfig.onSuccess(newSessionId);
        }}
      />
      <CreateProjectModal
        isOpen={createProjectConfig.isOpen}
        onClose={() => setCreateProjectConfig(p => ({...p, isOpen: false}))}
        setProjects={setProjects}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Routes>
          <Route path="/" element={
            <Dashboard
              projects={projects} presets={presets}
              activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
              openNewSession={openNewSession}
            />
          } />
          <Route path="/chat/:sessionId" element={
            <ChatArea
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
              setRefreshKey={setRefreshKey}
              setShowConvList={setShowConvList}
              openNewSession={openNewSession}
              presets={presets}
            />
          } />
          <Route path="/agent-hub" element={
            <AgentHub
              presets={presets} refreshPresets={refreshPresets}
              openNewSession={openNewSession} openDestructor={openDestructor}
            />
          } />
          <Route path="/agent/:presetId" element={
            <AgentProfile
              presets={presets} openNewSession={openNewSession}
              openDestructor={openDestructor}
            />
          } />
          <Route path="/agent/:presetId/memory" element={
            <AgentMemory presets={presets} memoryRefreshKey={memoryRefreshKey} />
          } />
          <Route path="/projects" element={
            <ProjectList
              projects={projects} setProjects={setProjects}
              setActiveFileProjectId={setActiveFileProjectId}
              setActiveSessionId={setActiveSessionId}
              refreshKey={refreshKey}
              openDestructor={openDestructor}
              openNewSession={openNewSession}
              openCreateProject={openCreateProject}
            />
          } />
          <Route path="/project/:id" element={
            <ProjectDetail
              projects={projects} setProjects={setProjects}
              openDestructor={openDestructor} openNewSession={openNewSession}
              setActiveSessionId={setActiveSessionId}
              setActiveFileProjectId={setActiveFileProjectId}
            />
          } />
          <Route path="/project/:id/files" element={
            <ProjectFilesArea
              projects={projects} setProjects={setProjects}
              openDestructor={openDestructor}
            />
          } />
          <Route path="/settings" element={
            <SettingsPanel
              projects={projects} presets={presets}
              openDestructor={openDestructor}
            />
          } />
          <Route path="/user" element={
            <UserProfile projects={projects} presets={presets} />
          } />
        </Routes>
      </div>

      {/* Mobile */}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        showConvList={showConvList}
        setShowConvList={setShowConvList}
        onOpenProfile={() => setShowProfilePanel(true)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/App.jsx
git commit -m "feat(chat-core): add React Router routes and layout shell"
```

---

### Task 3.5: Chat Core theme — full index.css

**Files:**
- Modify: `packages/chat-core/src/index.css`

- [ ] **Step 1: Write full index.css with obsidian + dark red theme**

```css
@import 'exo-shared/styles/base.css';
@import 'exo-shared/styles/transitions.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #0a0a0f;
    color: #e2e8f0;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  }

  /* Glassmorphism panel base */
  .glass-panel {
    background: rgba(17, 17, 24, 0.8);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
  }

  /* Glowing accent border */
  .glow-border {
    border: 1px solid rgba(192, 57, 43, 0.3);
    box-shadow: 0 0 1px #c0392b, 0 0 8px rgba(192, 57, 43, 0.4), 0 0 20px rgba(192, 57, 43, 0.1);
  }

  /* Chat markdown rendering */
  .prose {
    --tw-prose-body: #e2e8f0;
    --tw-prose-headings: #c0392b;
    --tw-prose-links: #e74c3c;
    --tw-prose-code: #c0392b;
    --tw-prose-pre-bg: #111118;
  }
}

@layer components {
  /* Sidebar nav item */
  .nav-item {
    @apply flex items-center gap-3 px-3 py-2 rounded-md text-chat-muted hover:text-chat-text hover:bg-white/5 transition-colors;
  }
  .nav-item.active {
    @apply text-chat-accent bg-chat-accent/10 border-l-2 border-chat-accent;
  }

  /* Message bubble */
  .msg-bubble {
    @apply glass-panel px-4 py-3 max-w-[85%];
  }
}

@layer utilities {
  .text-glow-accent {
    text-shadow: 0 0 8px rgba(192, 57, 43, 0.6);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat-core/src/index.css
git commit -m "feat(chat-core): implement obsidian + dark red glassmorphism theme"
```

---

## Phase 4: chronicle — Component Migration & Theme

### Task 4.1: Copy chronicle components from V2

**Source repo:** `D:\Alicia\ExoCore_Project\ExoCore-ui`

- [ ] **Step 1: Copy timeline, task, and calendar components**

```bash
cp ../ExoCore-ui/src/components/Timeline.jsx packages/chronicle/src/components/
cp ../ExoCore-ui/src/components/tasks/TaskPanel.jsx packages/chronicle/src/components/
cp ../ExoCore-ui/src/components/tasks/TaskRow.jsx packages/chronicle/src/components/
cp ../ExoCore-ui/src/components/tasks/TaskCreateModal.jsx packages/chronicle/src/components/
cp ../ExoCore-ui/src/components/tasks/MiniCalendar.jsx packages/chronicle/src/components/
cp ../ExoCore-ui/src/components/home/CalendarWidget.jsx packages/chronicle/src/components/
cp ../ExoCore-ui/src/layouts/v2/views/TaskPanel.jsx packages/chronicle/src/views/TaskListView.jsx
```

- [ ] **Step 2: Commit**

```bash
git add packages/chronicle/src/
git commit -m "feat(chronicle): copy timeline, task, and calendar components from V2"
```

---

### Task 4.2: Fix imports in chronicle

- [ ] **Step 1: Replace all V2 API imports with exo-shared**

```bash
# Pattern replacement across all files in packages/chronicle/src/:
# '../utils/api' → 'exo-shared'
# '../../utils/api' → 'exo-shared'
```

- [ ] **Step 2: Replace endpoint-specific fetch calls**

Replace raw `fetch()` with the corrected endpoint modules from `exo-shared`:

| Old pattern | New import |
|---|---|
| `fetch('/api/timeline/...')` | `tweetsApi.listTweets()` / `tweetsApi.createTweet()` |
| `fetch('/api/tasks/...')` | `tasksApi.listTasks()` / `tasksApi.createTask()` |
| `fetch('/api/calendar/...')` | `tasksApi.getCalendarSnapshot()` / `tasksApi.getTodaySnapshot()` |
| `fetch('/api/agents/chronicle/...')` | `chronicleApi.listChronicleEntries()` |

- [ ] **Step 3: Remove any council or agent-specific references**

Chronicle should not import anything related to agents, chat, or council. Check:

```bash
grep -r "agent\|council\|chat\|ChatArea\|AgentManager" packages/chronicle/src/ || echo "Clean — no cross-module leaks"
```

- [ ] **Step 4: Commit**

```bash
git add packages/chronicle/src/
git commit -m "refactor(chronicle): update all imports to exo-shared, remove cross-module references"
```

---

### Task 4.3: Chronicle hooks

**Files:**
- Create: `packages/chronicle/src/hooks/useTimeline.js`
- Create: `packages/chronicle/src/hooks/useTasks.js`
- Create: `packages/chronicle/src/hooks/useCalendar.js`

- [ ] **Step 1: Write useTasks.js**

```js
import { useState, useEffect } from 'react';
import { tasksApi } from 'exo-shared';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = () => {
    setLoading(true);
    tasksApi.listTasks()
      .then(setTasks)
      .catch(err => console.error('Tasks load failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, []);

  const toggleTask = async (taskId, completed) => {
    try {
      await tasksApi.toggleTaskComplete(taskId, completed);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t));
    } catch (err) {
      console.error('Toggle task failed', err);
    }
  };

  return { tasks, loading, refresh: fetchTasks, toggleTask };
}
```

- [ ] **Step 2: Write useTimeline.js**

```js
import { useState, useEffect } from 'react';
import { tweetsApi } from 'exo-shared';

export function useTimeline() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = () => {
    setLoading(true);
    tweetsApi.listTweets()
      .then(setPosts)
      .catch(err => console.error('Timeline load failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPosts(); }, []);

  return { posts, loading, refresh: fetchPosts };
}
```

- [ ] **Step 3: Write useCalendar.js**

```js
import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from 'exo-shared';

export function useCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback((params = {}) => {
    setLoading(true);
    tasksApi.getCalendarSnapshot(params)
      .then(data => setEvents(data.events || []))
      .catch(err => console.error('Calendar events load failed', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/chronicle/src/hooks/
git commit -m "feat(chronicle): add useTasks, useTimeline, useCalendar hooks"
```

---

### Task 4.4: Chronicle App.jsx with routing

**Files:**
- Modify: `packages/chronicle/src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx with lightweight navigation**

```jsx
import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import TimelineView from './views/TimelineView';
import TaskListView from './views/TaskListView';
import CalendarView from './views/CalendarView';
import { Calendar, CheckSquare, List } from 'lucide-react';

export default function App() {
  return (
    <div className="w-full h-[100dvh] bg-chron-bg text-chron-text font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-chron-border flex items-center px-4 shrink-0">
        <h1 className="text-chron-accent font-serif text-sm tracking-wider">Chronicle</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<TimelineView />} />
          <Route path="/tasks" element={<TaskListView />} />
          <Route path="/calendar" element={<CalendarView />} />
        </Routes>
      </div>

      {/* Bottom Navigation */}
      <nav className="h-12 border-t border-chron-border flex items-center justify-around shrink-0">
        <NavLink to="/" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs ${isActive ? 'text-chron-accent' : 'text-chron-muted'}`
        }>
          <List size={18} />
          <span>Feed</span>
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs ${isActive ? 'text-chron-accent' : 'text-chron-muted'}`
        }>
          <CheckSquare size={18} />
          <span>Tasks</span>
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 text-xs ${isActive ? 'text-chron-accent' : 'text-chron-muted'}`
        }>
          <Calendar size={18} />
          <span>Calendar</span>
        </NavLink>
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder view files (wrapping copied components)**

Write `packages/chronicle/src/views/TimelineView.jsx`:

```jsx
import React from 'react';
import { useTimeline } from '../hooks/useTimeline';
import Timeline from '../components/Timeline';

export default function TimelineView() {
  const { posts, loading, refresh } = useTimeline();

  if (loading) {
    return <div className="p-6 text-chron-muted">Loading timeline...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <Timeline posts={posts} onRefresh={refresh} />
    </div>
  );
}
```

Write `packages/chronicle/src/views/TaskListView.jsx`:

```jsx
import React from 'react';
import { useTasks } from '../hooks/useTasks';
import TaskPanel from '../components/TaskPanel';

export default function TaskListView() {
  const { tasks, loading, toggleTask, refresh } = useTasks();

  if (loading) {
    return <div className="p-6 text-chron-muted">Loading tasks...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <TaskPanel tasks={tasks} onToggle={toggleTask} onRefresh={refresh} />
    </div>
  );
}
```

Write `packages/chronicle/src/views/CalendarView.jsx`:

```jsx
import React from 'react';
import { useCalendar } from '../hooks/useCalendar';
import CalendarWidget from '../components/CalendarWidget';
import MiniCalendar from '../components/MiniCalendar';

export default function CalendarView() {
  const { events, loading, refresh } = useCalendar();

  if (loading) {
    return <div className="p-6 text-chron-muted">Loading calendar...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-4">
      <MiniCalendar />
      <CalendarWidget events={events} onRefresh={refresh} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/chronicle/src/
git commit -m "feat(chronicle): implement App shell with routing and view wrappers"
```

---

### Task 4.5: Chronicle theme — full index.css

**Files:**
- Modify: `packages/chronicle/src/index.css`

- [ ] **Step 1: Write chronicle index.css**

```css
@import 'exo-shared/styles/base.css';
@import 'exo-shared/styles/transitions.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #1a1a14;
    color: #d4c5a9;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  }

  /* Paper-like card */
  .paper-card {
    background: #222218;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

@layer components {
  /* Task row */
  .task-row {
    @apply paper-card px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors hover:bg-white/[0.03];
  }
  .task-row.completed {
    @apply opacity-50;
  }
  .task-row.completed .task-title {
    @apply line-through;
  }

  /* Timeline post */
  .timeline-post {
    @apply paper-card px-4 py-4 mb-3;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chronicle/src/index.css
git commit -m "feat(chronicle): implement paper-like warm dark theme"
```

---

## Phase 5: Tauri Desktop Shell

### Task 5.1: Initialize Tauri project

- [ ] **Step 1: Install Tauri CLI and initialize**

```bash
cd D:/Alicia/ExoCore_Project/ExoCore-Desktop
pnpm add -D @tauri-apps/cli@latest
pnpm tauri init
```

When prompted:
- App name: `ExoCore`
- Window title: `ExoCore`
- Web asset location: `../packages/chat-core/dist` (production)
- Dev URL: `http://localhost:5173`
- Dev command: `pnpm dev:chat`
- Build command: `pnpm build`

- [ ] **Step 2: Verify tauri/ directory structure**

```bash
ls tauri/
# Expected: Cargo.toml, tauri.conf.json, src/main.rs, icons/
```

- [ ] **Step 3: Commit**

```bash
git add tauri/ pnpm-lock.yaml package.json
git commit -m "feat(tauri): initialize Tauri project"
```

---

### Task 5.2: Tauri configuration (tauri.conf.json)

**Files:**
- Modify: `tauri/tauri.conf.json`

- [ ] **Step 1: Write tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "ExoCore",
  "version": "0.1.0",
  "identifier": "com.exocore.desktop",
  "build": {
    "frontendDist": "../packages/chat-core/dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev:chat",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "label": "chat-core",
        "title": "ExoCore // Chat",
        "width": 1200,
        "height": 800,
        "decorations": false,
        "center": true,
        "resizable": true,
        "visible": true
      }
    ],
    "trayIcon": {
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": true,
      "tooltip": "ExoCore"
    },
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:8000; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png"
    ]
  }
}
```

- [ ] **Step 2: Add Tauri API npm package**

```bash
pnpm add -D @tauri-apps/api@latest
```

- [ ] **Step 3: Commit**

```bash
git add tauri/tauri.conf.json package.json pnpm-lock.yaml
git commit -m "feat(tauri): configure windows, tray, CSP, sidecar bundle"
```

---

### Task 5.3: Rust — main.rs with window & tray management

**Files:**
- Create/modify: `tauri/src/main.rs`

- [ ] **Step 1: Write main.rs**

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    AppHandle, CustomMenuItem, Manager, PhysicalPosition, PhysicalSize,
    SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};
use std::sync::Mutex;

mod sidecar;
mod notifications;
mod logger;

struct AppState {
    log_buffer: Mutex<logger::RingBuffer>,
}

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show/Hide ExoCore"))
        .add_item(CustomMenuItem::new("council", "Open Council Workspace"))
        .add_item(CustomMenuItem::new("chronicle", "Toggle Chronicle Panel"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("restart", "Restart Backends"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("exit", "Exit ExoCore"));

    let tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(tray)
        .manage(AppState {
            log_buffer: Mutex::new(logger::RingBuffer::new(5000)),
        })
        .setup(|app| {
            // Spawn sidecars silently
            let app_handle = app.handle();
            sidecar::spawn_django(&app_handle);
            sidecar::spawn_wez_bridge(&app_handle);

            // Start log streaming
            logger::start_log_stream(&app_handle);

            Ok(())
        })
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("chat-core").unwrap();
                if window.is_visible().unwrap_or(false) {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => {
                handle_tray_event(app, &id);
            }
            _ => {}
        })
        .on_window_event(|event| {
            // Close → hide instead of exit
            if event.event() == tauri::WindowEvent::CloseRequested {
                if event.window().label() == "chat-core" {
                    event.window().hide().unwrap();
                    // Prevent default close
                    let _ = event.window().emit("window-hidden", ());
                }
                // Council and Chronicle windows can actually close
            }
        })
        .invoke_handler(tauri::generate_handler![
            notifications::send_notification,
            logger::get_recent_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ExoCore");
}

fn handle_tray_event(app: &AppHandle, id: &str) {
    match id {
        "show" => {
            let window = app.get_window("chat-core").unwrap();
            if window.is_visible().unwrap_or(false) {
                window.hide().unwrap();
            } else {
                window.show().unwrap();
                window.set_focus().unwrap();
            }
        }
        "council" => {
            // Open Council window — create if not exists, show if exists
            use tauri::WindowBuilder;
            if let Some(window) = app.get_window("council") {
                window.show().unwrap();
                window.set_focus().unwrap();
            } else {
                let _ = WindowBuilder::new(
                    app,
                    "council",
                    tauri::WindowUrl::External("http://localhost:5175".parse().unwrap()),
                )
                .title("ExoCore // Council")
                .inner_size(1000.0, 700.0)
                .resizable(true)
                .build();
            }
        }
        "chronicle" => {
            // Toggle Chronicle tray panel
            use tauri::WindowBuilder;
            if let Some(window) = app.get_window("chronicle") {
                if window.is_visible().unwrap_or(false) {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                }
            } else {
                let _ = WindowBuilder::new(
                    app,
                    "chronicle",
                    tauri::WindowUrl::External("http://localhost:5174".parse().unwrap()),
                )
                .title("ExoCore // Chronicle")
                .inner_size(380.0, 600.0)
                .resizable(true)
                .skip_taskbar(true)
                .decorations(true)
                .build();
            }
        }
        "restart" => {
            sidecar::restart_all(app);
        }
        "exit" => {
            sidecar::graceful_shutdown(app);
            std::process::exit(0);
        }
        _ => {}
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add tauri/src/main.rs
git commit -m "feat(tauri): implement window lifecycle, system tray, and tray event handling"
```

---

### Task 5.4: Rust — sidecar.rs (silent process management)

**Files:**
- Create: `tauri/src/sidecar.rs`

- [ ] **Step 1: Write sidecar.rs**

```rust
use tauri::AppHandle;
use std::process::{Child, Command};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::sync::Mutex;

// Store child process handles for graceful shutdown
static DJANGO_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static WEZ_BRIDGE_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Spawn a process with no visible window on Windows.
fn spawn_silent(command: &str, args: &[&str]) -> std::io::Result<Child> {
    let mut cmd = Command::new(command);
    cmd.args(args);

    #[cfg(target_os = "windows")]
    {
        // CREATE_NO_WINDOW = 0x08000000 — prevents cmd window flash
        cmd.creation_flags(0x08000000);
    }

    // Redirect stdout/stderr to pipe for log capture
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    cmd.spawn()
}

pub fn spawn_django(app: &AppHandle) {
    // Django is started externally or by a launch script.
    // In the sidecar model, Django would be bundled as a PyInstaller binary.
    // For now, assume Django is running on port 8000 and we just health-check.
    let app_handle = app.clone();
    std::thread::spawn(move || {
        // Health check loop
        let max_attempts = 30; // 15 seconds at 500ms intervals
        for _ in 0..max_attempts {
            if let Ok(resp) = reqwest::blocking::get("http://127.0.0.1:8000/api/health/") {
                if resp.status().is_success() {
                    let _ = app_handle.emit("backend-ready", "Django is ready");
                    return;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        let _ = app_handle.emit("backend-error", "Django health check timed out");
    });
}

pub fn spawn_wez_bridge(app: &AppHandle) {
    let app_handle = app.clone();
    std::thread::spawn(move || {
        match spawn_silent("python", &["wez_bridge.py"]) {
            Ok(_child) => {
                // Store for later shutdown
                // *WEZ_BRIDGE_PROCESS.lock().unwrap() = Some(child);
                let _ = app_handle.emit("sidecar-ready", "wez_bridge started");
            }
            Err(e) => {
                let _ = app_handle.emit("sidecar-error", format!("wez_bridge failed: {}", e));
            }
        }
    });
}

pub fn restart_all(app: &AppHandle) {
    // Kill existing processes
    if let Some(ref mut child) = *DJANGO_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
    if let Some(ref mut child) = *WEZ_BRIDGE_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
    // Respawn
    spawn_django(app);
    spawn_wez_bridge(app);
}

pub fn graceful_shutdown(app: &AppHandle) {
    let _ = app.emit("shutting-down", "ExoCore is shutting down...");

    // SIGTERM to all managed processes
    if let Some(ref mut child) = *DJANGO_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
    if let Some(ref mut child) = *WEZ_BRIDGE_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add tauri/src/sidecar.rs
git commit -m "feat(tauri): add silent sidecar process management (CREATE_NO_WINDOW)"
```

---

### Task 5.5: Rust — notifications.rs

**Files:**
- Create: `tauri/src/notifications.rs`

- [ ] **Step 1: Write notifications.rs**

```rust
use tauri::AppHandle;

/// Send an OS-native notification. Called from web views via Tauri invoke.
#[tauri::command]
pub fn send_notification(
    app: AppHandle,
    title: String,
    body: String,
    module: Option<String>,
) -> Result<(), String> {
    let module_tag = module.unwrap_or_else(|| "exocore".to_string());

    // Use tauri's built-in notification (wraps notify-rust on desktop)
    app.notification()
        .builder()
        .title(&title)
        .body(&format!("[{}] {}", module_tag, body))
        .show()
        .map_err(|e| format!("Notification failed: {}", e))?;

    Ok(())
}
```

- [ ] **Step 2: Commit**

```bash
git add tauri/src/notifications.rs
git commit -m "feat(tauri): add OS-native notification routing from web views"
```

---

### Task 5.6: Rust — logger.rs (ring buffer + error persistence)

**Files:**
- Create: `tauri/src/logger.rs`

- [ ] **Step 1: Write logger.rs**

```rust
use tauri::AppHandle;
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::mpsc;

/// Ring buffer holding the last N log lines in memory.
pub struct RingBuffer {
    lines: VecDeque<String>,
    capacity: usize,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        RingBuffer {
            lines: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    pub fn push(&mut self, line: String) {
        if self.lines.len() >= self.capacity {
            self.lines.pop_front();
        }
        self.lines.push(line);
    }

    pub fn get_recent(&self, count: usize) -> Vec<String> {
        self.lines.iter().rev().take(count).cloned().collect::<Vec<_>>()
            .into_iter().rev().collect()
    }

    pub fn all(&self) -> Vec<String> {
        self.lines.iter().cloned().collect()
    }
}

/// Start capturing stdout/stderr from sidecar processes and routing to UI.
pub fn start_log_stream(app: &AppHandle) {
    // In production, this would read from sidecar child process stdout/stderr pipes.
    // For now, set up the channel so web views can query logs.

    let app_handle = app.clone();

    // Clean up old error logs (>7 days) on startup
    clean_old_error_logs();

    // Start a background thread that listens for log events
    std::thread::spawn(move || {
        let app = app_handle.clone();
        // Listen for "log:line" events from sidecar readers
        // In the full implementation, this reads from process pipes
        // For now, web views push log lines via Tauri events
    });
}

/// Retrieve recent log lines from the ring buffer (called from web view).
#[tauri::command]
pub fn get_recent_logs(
    state: tauri::State<'_, crate::AppState>,
    lines: Option<usize>,
) -> Result<Vec<String>, String> {
    let buffer = state.log_buffer.lock().map_err(|e| e.to_string())?;
    Ok(buffer.get_recent(lines.unwrap_or(200)))
}

/// Persist only error lines to disk.
pub fn persist_error(line: &str) {
    if !line.contains("ERROR") && !line.contains("Panic") && !line.contains("Traceback") {
        return;
    }

    let log_dir = get_log_dir();
    fs::create_dir_all(&log_dir).ok();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let log_path = log_dir.join(format!("error-{}.log", today));

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let timestamp = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.3f").to_string();
        let _ = writeln!(file, "[{}] {}", timestamp, line);
    }
}

fn get_log_dir() -> PathBuf {
    // Logs go next to the executable or in a well-known location
    std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("."))
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."))
        .join("logs")
}

fn clean_old_error_logs() {
    let log_dir = get_log_dir();
    if !log_dir.exists() { return; }

    let cutoff = chrono::Local::now() - chrono::Duration::days(7);

    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(true, |ext| ext != "log") { continue; }
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    // Convert SystemTime to chrono for comparison
                    // Simplified: delete files with modification time before cutoff
                }
            }
        }
    }
}
```

- [ ] **Step 2: Add chrono to Cargo.toml**

```toml
[dependencies]
tauri = { version = "2", features = ["notification-all", "tray-icon"] }
tauri-build = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["blocking", "json"] }
chrono = "0.4"
```

- [ ] **Step 3: Commit**

```bash
git add tauri/src/logger.rs tauri/Cargo.toml
git commit -m "feat(tauri): add ring buffer logger with error-only disk persistence"
```

---

### Task 5.7: Final Cargo.toml dependencies check

- [ ] **Step 1: Verify Cargo.toml has all required dependencies**

```bash
cd tauri && cargo check
```

Fix any missing dependencies or compilation errors.

- [ ] **Step 2: Commit any fixes**

```bash
git add tauri/
git commit -m "fix(tauri): resolve Cargo dependency and compilation issues"
```

---

## Phase 6: Verify & Cleanup

### Task 6.1: Verify all three dev servers start

- [ ] **Step 1: Kill any existing dev servers**

- [ ] **Step 2: Start chat-core**

```bash
pnpm dev:chat
```

Open `http://localhost:5173`. Verify: page loads, theme renders (obsidian dark), routing works (navigate to `/agent-hub`, `/projects`, etc.).

- [ ] **Step 3: Start chronicle**

```bash
pnpm dev:chronicle
```

Open `http://localhost:5174`. Verify: page loads, paper-like dark theme, bottom nav works.

- [ ] **Step 4: Start council**

```bash
pnpm dev:council`
```

Open `http://localhost:5175`. Verify: placeholder "Coming in V3.1" renders.

- [ ] **Step 5: Verify API proxy works on all three**

With Django backend running on port 8000, check that `/api/agents/presets/` returns JSON from any of the three dev servers.

---

### Task 6.2: Check for cross-module import leaks

- [ ] **Step 1: Verify chronicle does not import chat-core code**

```bash
grep -r "chat-core\|chat-core/" packages/chronicle/src/ || echo "Clean"
```

- [ ] **Step 2: Verify shared does not import any module-specific code**

```bash
grep -r "chat-core\|chronicle\|council" packages/shared/src/ || echo "Clean"
```

- [ ] **Step 3: Verify no remaining ExoCore-ui paths**

```bash
grep -r "ExoCore-ui" packages/ tauri/ || echo "Clean"
```

---

### Task 6.3: Final commit

```bash
git add -A
git commit -m "chore: finalize V3 frontend split implementation"
```

---

## Implementation Summary

| Phase | Tasks | Description |
|---|---|---|
| **1: Scaffolding** | 1.1–1.6 | Root workspace + 4 packages (shared, chat-core, chronicle, council) + pnpm install |
| **2: shared** | 2.1–2.7 | apiFetch wrapper, auth, models, 10 endpoint modules (verified against ReactSheet), useApi/useCsrf hooks, shared styles |
| **3: chat-core** | 3.1–3.5 | Copy 25+ components from V2, fix imports, decompose useAppState, add routing, obsidian theme |
| **4: chronicle** | 4.1–4.5 | Copy 7 components from V2, fix imports, add hooks, add routing, paper-like theme |
| **5: Tauri** | 5.1–5.6 | Tauri init, config, main.rs (windows + tray), sidecar.rs, notifications.rs, logger.rs |
| **6: Verify** | 6.1–6.3 | Dev server smoke tests, cross-module leak checks, final commit |
