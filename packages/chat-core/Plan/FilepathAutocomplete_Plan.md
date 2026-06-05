# @ 文件路径自动补全 — 前端施工计划

> 关联文档：`packages/chat-core/Architecture.md` · 后端 API 同步施工中
> 日期：2026-06-05

---

## 最终效果

用户在 project 会话的输入框中：

1. 输入 `@` → 输入框上方弹出文件/目录补全面板，显示 `work_dir` 下的文件树
2. 继续输入字符做**前端模糊过滤**（同时触发子目录懒加载）
3. ↑↓ 键选中 / Enter 确认 / Esc 关闭，**文件和目录均可引用**
4. 选中后在输入框中渲染为**块级 chip token**（`[📄 src/utils/docking.py]` 或 `[📁 src/components/]`），不可编辑内部文字，退格整块删除
5. 发送时 `@[相对路径]` 作为消息文本的一部分，携带真实相对路径字符串

同时在 `ProjectFilesDrawer` 中：

6. Work Directory 区域展示真实可交互的**文件树**（不再只是占位文字）
7. 点击任意文件/目录 → **自动关闭抽屉 + 插入到输入框**（与 @ 补全共用同一套插入逻辑）
8. 树支持递归展开/折叠，懒加载子目录

无论从哪个入口进入 session（home/agent/project detail），**只要 session 关联了 project 且 project 有 work_dir，@ 补全就可用**。唯一的区别是 `📁 Project Files` 按钮只在 `from === 'project'` 时显示在 header 上。

---

## 施工顺序

### Step 0: shared API client — 新增 `listDirectory`

**文件：** `packages/shared/src/endpoints/projects.js` (Modify, ~+6 lines)

```js
// 新增方法（追加到文件末尾）
export function listDirectory(projectId, path = '') {
  const params = path ? { path } : {};
  return apiFetch(`/api/core/projects/${projectId}/tree/`, { method: 'GET', params });
}
```

- `projectId`: 项目 ID
- `path`: 相对路径（空字符串 = 根目录）
- **契约：** 对应后端 `GET /api/core/projects/{id}/tree/?path=<rel>`，返回格式见 §API Contract
- **下游影响：** ChatShell 将调用此方法；`exo-shared` 的 re-export 自动生效（`projectsApi.listDirectory`）

---

### Step 1: ChatShell — tree 数据中枢 + pendingInsert 回调线

**文件：** `packages/chat-core/src/components/chat/ChatShell.jsx` (Modify, ~+60 lines)

**当前状态（已验证）：**
- L5: `import ProjectFilesDrawer from '../project/ProjectFilesDrawer';`
- L6: `import { conversationsApi, projectsApi } from 'exo-shared';`
- L29-31: `const [project, setProject] = useState(null);` / `filesDrawerOpen` / `projectFiles`
- L44-52: `useEffect` 仅在 `state.from === 'project' && state.projectId` 时加载 project
- L57-74: 30s 轮询 `projectFiles`

**改动：**

```
// ── 新增 state ──
const [fileTree, setFileTree] = useState(null);       // { path, entries: [...] }
const [treeLoading, setTreeLoading] = useState(false);
const [pendingInsert, setPendingInsert] = useState(null); // { path, type } | null

// ── 改动: project 解析改为通用路径 ──
// 原来: 仅当 state.from === 'project' && state.projectId 时才加载
// 改为: 拿到 sessionId 后, 先查 conversation → project

useEffect(() => {
  if (!resolvedSessionId) return;
  let cancelled = false;

  // 1. 查 session 获得 project 关联
  conversationsApi.getConversation(resolvedSessionId)
    .then(conv => {
      if (cancelled) return;
      const pid = getConvProjectId(conv);
      if (pid && pid !== 0) {
        return projectsApi.getProject(pid);
      }
      return null;
    })
    .then(proj => {
      if (cancelled) return;
      if (proj) {
        setProject(proj);
      } else {
        setProject(null);
        setFileTree(null);
      }
    })
    .catch(() => { if (!cancelled) { setProject(null); setFileTree(null); } });

  return () => { cancelled = true; };
}, [resolvedSessionId]);

// ── 新增: fetch tree ──
const fetchFileTree = useCallback((relPath = '') => {
  if (!project?.id || !project?.work_dir) return;
  setTreeLoading(true);
  projectsApi.listDirectory(project.id, relPath)
    .then(data => {
      if (relPath) {
        // 子目录懒加载: 合并到已有 tree
        setFileTree(prev => mergeTreeEntry(prev, relPath, data));
      } else {
        setFileTree(data);
      }
    })
    .catch(() => {})
    .finally(() => setTreeLoading(false));
}, [project?.id, project?.work_dir]);

// ── 改动: 轮询扩展 ──
// work_dir 非空时, 首次 fetch + 30s 轮询 (和现有 projectFiles 轮询合并)
useEffect(() => {
  if (!project?.id) return;
  fetchFileTree();                                      // 首次
  const id = setInterval(() => fetchFileTree(), 30000); // 30s 轮询
  return () => clearInterval(id);
}, [project?.id, fetchFileTree]);
```

**传给子组件的 props 变化：**
- `ChatArea` 新增: `fileTree`, `pendingInsert`, `onInsertConsumed`, `project`
- `ProjectFilesDrawer` 新增: `fileTree`, `treeLoading`, `onFileClick`, 保留原有 `projectFiles`
- `StageHeader`: 不变

**不变：**
- `filesDrawerOpen` 状态
- `projectFiles` 轮询逻辑（保留，供 Drawer 的 "Project Files" 区域使用）
- `StageHeader` 的 `onToggleFilesDrawer` 回调

---

### Step 2: @AutocompletePopup — 新组件

**文件：** `packages/chat-core/src/components/chat/AutocompletePopup.jsx` (Create, ~150 lines)

```
┌──────────────────────────────────────────┐
│ 🔍 @src/ut                               │  ← 搜索输入行（不可编辑，仅展示当前匹配）
│ ─────────────────────────────────────── │
│ 📁 src/utils/                            │  ← 目录项
│ 📄 src/utils/docking.py                  │  ← 文件项 (hover 高亮)
│ 📄 src/utils/helpers.py                  │
│ 📁 src/utils/__pycache__/                │
│ 📄 src/utils/init.py                    │
└──────────────────────────────────────────┘
```

**Props：**
```js
{
  isOpen: bool,
  query: string,              // @ 后面的文本，如 "src/ut"
  fileTree: object | null,    // 当前已加载的 tree 数据
  position: { top, left },   // 弹出位置（相对于输入区）
  onSelect: (path, type) => void,
  onClose: () => void,
  onLoadDirectory: (path) => void,  // 懒加载回调
}
```

**核心逻辑：**

```
// 过滤逻辑（前端）
function filterTree(tree, query, loadedDirs) {
  if (!tree || !query) return [];
  const tokens = query.toLowerCase().split(/[/\\]/).filter(Boolean);
  // 递归匹配所有文件和目录
  // 目录: 匹配到目录名 → 内部文件也列入候选
  // 文件: 匹配到文件名 → 直接列入
  // 结果按类型排序: 目录优先，再按名称字母序
}

// 键盘导航
// ↑↓: 移动高亮索引
// Enter: onSelect(highlightedPath, highlightedType)
// Esc: onClose()
// Tab: 补全当前高亮项的路径到公共前缀
```

**视觉：** 紧凑列表，每项左侧类型图标 + 路径，高亮项背景 `bg-white/10`，匹配字符用 `text-chat-accent` 加亮。

**不变：** 本组件不感知 ChatArea 的 textarea 状态，仅通过 props 交互。

---

### Step 3: ChatArea 输入区改造 — @ 触发 + overlay chip 渲染

**文件：** `packages/chat-core/src/components/chat/ChatArea.jsx` (Modify, ~+120 lines)

**当前状态（已验证）：**
- L23: `const [inputValue, setInputValue] = useState("");`
- L71: `const textareaRef = useRef(null);`
- L884-910: `<textarea>` 的 onChange/onKeyDown/onPaste/placeholder
- L939: 发送按钮 disabled 逻辑

**改动分为三个子步骤：**

#### 3a. @ 检测 + 弹出面板状态

```
// ── 新增 state ──
const [autocompleteOpen, setAutocompleteOpen] = useState(false);
const [autocompleteQuery, setAutocompleteQuery] = useState('');
const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });
const [highlightedIndex, setHighlightedIndex] = useState(0);

// ── 在 onChange 中检测 @ ──
const handleInputChange = (e) => {
  const v = e.target.value;
  setInputValue(v);
  autoResize();

  // 检测光标前的 @ 符号
  const cursorPos = e.target.selectionStart;
  const textBeforeCursor = v.slice(0, cursorPos);
  const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);  // 最后一个 @ 到光标之间

  if (atMatch && project?.work_dir) {
    setAutocompleteQuery(atMatch[1]);       // @ 后面的部分
    setAutocompleteOpen(true);
    setHighlightedIndex(0);

    // 计算光标位置 → 弹出面板坐标
    const coords = getCaretCoordinates(textareaRef.current, atMatch.index);
    setAutocompletePos({ top: coords.top - 8, left: coords.left });
  } else {
    setAutocompleteOpen(false);
    setAutocompleteQuery('');
  }
};
```

**`getCaretCoordinates`** — 获取 textarea 中指定字符位置的像素坐标

> 标准做法：用隐藏 mirror div（复制 textarea 样式 + 内容）配合 `getBoundingClientRect`。或者使用已有的第三方库（如果项目里已有）。此处作为新工具函数，放在 `packages/chat-core/src/utils/caret.js`。

```
// 文件: packages/chat-core/src/utils/caret.js (Create, ~30 lines)
// 导出: getCaretCoordinates(textareaEl, charIndex) → { top, left }
```

#### 3b. Block token overlay

```
// ── 渲染 overlay ──
// 在 textarea 上方叠加一个透明层，将 @[path] 模式的文本渲染为彩色 chip
// textarea 的文本保持纯文本: "你好 @[src/main.py] 看看"
// overlay 将这个 @[src/...] 渲染为 chip 视觉

function renderOverlayContent(text) {
  // 将 text 按 @[path] 模式分割
  // 非 @[] 部分 → 透明文本（让 textarea 的实际文本透出）
  // @[path] 部分 → 彩色 chip（遮盖 textarea 的对应区域）
  const parts = text.split(/(@\[[^\]]+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^@\[([^\]]+)\]$/);
    if (m) {
      return <span key={i} className="chip-token">{m[1]}</span>;
    }
    return <span key={i} className="transparent-text">{part}</span>;
  });
}
```

**Overlay 同步：** overlay div 需要与 textarea 保持完全一致的字体、字号、行高、padding、滚动位置。通过 `useEffect` 在每次 `inputValue` 变化时同步 scrollTop。

> **技术要点：** overlay 设置 `pointer-events: none`，所有点击穿透到 textarea。退格删除时，如果光标恰好在 `@[path]` 后面，整体删除该 token（检测 textarea 的 `selectionStart` 是否紧跟在 `]` 之后）。

#### 3c. pendingInsert 消费

```
// ── 消费来自 Drawer 的 pendingInsert ──
useEffect(() => {
  if (!pendingInsert) return;
  const token = `@[${pendingInsert.path}]`;
  // 插入到当前光标位置（或末尾）
  const el = textareaRef.current;
  if (el) {
    const start = el.selectionStart;
    const v = inputValue;
    const newVal = v.slice(0, start) + token + ' ' + v.slice(start);
    setInputValue(newVal);
    // 光标移到 token 之后
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + token.length + 1;
      el.focus();
    }, 0);
  }
  onInsertConsumed();  // 通知 ChatShell 已消费
}, [pendingInsert]);
```

**不变：**
- `handleSend` 的核心逻辑（L277-L328）
- `isGenerating` / `editingMessageId` 相关逻辑
- composeAttachments 上传逻辑
- 轮询/SSE 模式切换

---

### Step 4: 发送时提取 @[path]

**文件：** `packages/chat-core/src/components/chat/ChatArea.jsx` (Modify, handleSend 内部改动, ~+10 lines)

**当前 `handleSend` 的 content 构造（L290 / L311）：**

```
content: inputValue,
```

**改为：**

```
// 提取所有 @[path], 构建 file_refs 数组
const fileRefs = [];
const cleanContent = inputValue.replace(/@\[([^\]]+)\]/g, (match, path) => {
  fileRefs.push(path);
  return `@${path}`;  // 发送时去掉方括号，保留 @ 前缀
});

// 发送 body 新增 file_refs 字段（可选）
{
  content: cleanContent,
  file_refs: fileRefs,          // ← 新增: 相对路径数组
  thinking_level: thinkingLevel,
  temperature: temperature,
  ...
}
```

> **后端对齐：** `file_refs` 是否作为独立字段由后端决定。如果后端暂不需要，`cleanContent` 中的 `@相对路径` 已经足够让 agent 解析。先按 `cleanContent` 走，`file_refs` 预留为可选字段。

**不变：**
- `handleSend` 其他逻辑（编辑模式、轮询模式、SSE 流式渲染）
- `handleStop` / `handleRetry` 逻辑

---

### Step 5: 退格删除 chip token

**文件：** `packages/chat-core/src/components/chat/ChatArea.jsx` (Modify, onKeyDown 改动, ~+15 lines)

在 `onKeyDown` 中新增：

```
// Backspace: 检测光标是否紧跟在 @[path] 后面
if (e.key === 'Backspace') {
  const cursorPos = e.target.selectionStart;
  const textBeforeCursor = inputValue.slice(0, cursorPos);
  const tokenMatch = textBeforeCursor.match(/@\[[^\]]+\]$/);  // 光标紧跟在 ] 后

  if (tokenMatch) {
    e.preventDefault();
    const newVal = inputValue.slice(0, tokenMatch.index) + inputValue.slice(cursorPos);
    setInputValue(newVal);
    // 光标移到删除位置
    setTimeout(() => {
      e.target.selectionStart = e.target.selectionEnd = tokenMatch.index;
    }, 0);
    return;
  }
}
```

---

### Step 6: ProjectFilesDrawer — 真实文件树 + 点击插入

**文件：** `packages/chat-core/src/components/project/ProjectFilesDrawer.jsx` (Modify, ~+80 lines)

**当前状态（已验证）：**
- L2: `import { X, FolderOpen, FileText } from 'lucide-react';`
- L9: 接收 `{ isOpen, onClose, project, projectFiles }` props
- L40-49: Work Directory 区域 — 占位文字 "Directory listing will be fetched in real-time."
- L53-75: Project Files 区域 — 已上传文件列表

**Props 变更：**
```
新增: fileTree, treeLoading, onFileClick(relPath, type)
保留: isOpen, onClose, project, projectFiles
```

**改动：**

```
// ── Work Directory 区域改为 FileTree ──
{hasWorkDir ? (
  <div>
    <p className="text-[10px] font-mono text-chat-muted/30 mb-2 truncate">{project.work_dir}</p>
    {treeLoading && !fileTree ? (
      <div className="text-xs text-chat-muted/40 italic">Loading...</div>
    ) : fileTree ? (
      <FileTree
        entries={fileTree.entries}
        basePath={fileTree.path || ''}
        onFileClick={handleFileClick}
        onExpand={fetchSubDir}
        expandedDirs={expandedDirs}
      />
    ) : (
      <div className="text-xs text-chat-muted/40 italic">无法读取目录</div>
    )}
  </div>
) : (
  <p className="text-xs text-chat-muted/30 italic">未绑定工作目录</p>
)}

// handleFileClick:
//   onFileClick(relPath, type);  → ChatShell.setPendingInsert({ path: relPath, type })
//   onClose();                   → 关闭抽屉
```

**FileTree 子组件：** `packages/chat-core/src/components/project/FileTree.jsx` (Create, ~80 lines)

```
// 递归组件
// Props: { entries, basePath, indent, onFileClick, onExpand, expandedDirs }
// 每项: [▸/▾] [📁/📄] name  ← onClick → dir: toggle expand; file: onFileClick
// 展开: onExpand(dirPath) 触发 ChatShell.fetchFileTree(dirPath)
// 缩进: indent * 12px, 参考 VSCode 风格
```

**不变：**
- Project Files 区域（已上传文件列表）
- 抽屉的 Backdrop + slide-out 动画
- 关闭按钮行为

---

### Step 7: StageHeader — 按钮保持现有逻辑

**文件：** `packages/chat-core/src/components/chat/StageHeader.jsx` (不变)

当前逻辑：`showFilesButton = from === 'project'` — 仅在从 project detail 进入时显示 `📁 Project Files` 按钮。

**确认：无需改动。** @ 补全功能不受 `from` 限制，header 按钮仅影响 drawer 入口的可见性。

---

## API Contract

```
GET /api/core/projects/{project_id}/tree/?path=<relative_path>
```

**Response (200)：**
```json
{
  "path": "",
  "entries": [
    {
      "name": "src",
      "type": "dir",
      "path": "src"
    },
    {
      "name": "README.md",
      "type": "file",
      "path": "README.md",
      "size": 2048
    },
    {
      "name": "package.json",
      "type": "file",
      "path": "package.json",
      "size": 1024
    }
  ]
}
```

**后端 exclude 规则（必须在后端过滤）：**
`node_modules`, `.git`, `__pycache__`, `.venv`, `venv`, `dist`, `.next`, `build`, `target`, `*.pyc`, `.DS_Store`, `Thumbs.db`

**参数：** `path` 为空时返回根目录；非空时返回指定子目录的 entries。

---

## 关键文件清单

| 文件 | 操作 | 行数估计 |
|------|------|----------|
| `packages/shared/src/endpoints/projects.js` | Modify | +6 |
| `packages/chat-core/src/components/chat/ChatShell.jsx` | Modify | +60 |
| `packages/chat-core/src/components/chat/AutocompletePopup.jsx` | **Create** | ~150 |
| `packages/chat-core/src/components/chat/ChatArea.jsx` | Modify | +130 |
| `packages/chat-core/src/components/project/ProjectFilesDrawer.jsx` | Modify | +50 |
| `packages/chat-core/src/components/project/FileTree.jsx` | **Create** | ~80 |
| `packages/chat-core/src/utils/caret.js` | **Create** | ~30 |

## 不变部分

- `StageHeader.jsx` — 按钮逻辑不变
- `ChatArea` 的消息渲染区（MessageBubble / SSE 流 / Polling）
- `ChatArea` 的 composeAttachments 上传逻辑
- `ProjectDetail.jsx` — 项目详情页不变
- `WorkDirModal.jsx` — 工作目录设置弹窗不变
- `ConversationList.jsx` / `Sidebar.jsx` — 会话列表不变
- 后端 `core/views.py` `ProjectViewSet` / `ProjectFileViewSet` — 不变（新 API 是新增 action）
- 所有现有 API 端点格式不变

## 验证

```bash
# 1. shared API 编译
pnpm build

# 2. 前端 lint
pnpm lint

# 3. 手动测试清单
# - 进入 project session → 确认 header 显示 📁 Project Files 按钮
# - 点击按钮 → ProjectFilesDrawer 展开，显示 work_dir 文件树
# - 点击 drawer 中的文件 → 自动关闭 drawer + 输入框插入 @[path]
# - 输入框输入 @ 字符 → 弹出 AutocompletePopup
# - 继续输入 → 模糊过滤生效
# - ↑↓ + Enter 选中 → 插入 @[path] chip token
# - 退格 → @[path] 整体删除
# - 发送消息 → 确认 @path 作为文本发送
# - 从非 project 入口进入 session（如 home）→ @ 补全仍可用（只要 session 有 project + work_dir）

# 4. 后端 API 验证（与 DS 对齐）
# curl -s http://localhost:8000/api/core/projects/3/tree/ | jq
# curl -s http://localhost:8000/api/core/projects/3/tree/?path=src | jq
```
