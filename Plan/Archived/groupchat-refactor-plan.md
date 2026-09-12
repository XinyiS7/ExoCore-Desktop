# Groupchat Structure Refactor Plan

## Goal
GroupchatRoom 的结构完全复刻 ChatArea：单层返回按钮 + textarea 布局对齐 + 双侧字数统计。

---

## 改动 1：返回按钮单层化

### 现状问题
- `GroupchatRoom.jsx` line 515：自带 `BackToUpper` 带 `md:hidden`，和 MobileHeader 在 mobile 上重复
- `GroupchatList.jsx`：desktop 无返回按钮

### 目标（复刻 ChatShell + StageHeader 模式）
- **GroupchatRoom**：删除 header 里的 `BackToUpper`，header 变成纯信息行（群名 + 参与人数 | 刷新 + 设置），对应 ChatArea v2 header
- **GroupchatList**：在 split view 容器顶部加一行 desktop back header（`hidden md:flex h-12`），"‹ Home" → `navigate('/')`
- **MobileHeader**：已正确处理，不改

### 文件
- `packages/chat-core/src/views/GroupchatRoom.jsx` — 删除 line 515 的 `BackToUpper`，删除 `BackToUpper` import
- `packages/chat-core/src/views/GroupchatList.jsx` — 顶部加 desktop back header

---

## 改动 2：GroupchatRoom textarea 布局复刻 ChatArea

### 现状
GroupchatRoom 输入区是 `flex items-end gap-3`，textarea + Zap + Send 并排，无外层容器。

### 目标（ChatArea 输入区结构）
```
<div className="flex-shrink-0 p-4 border-t ... flex flex-col gap-2">
  {sendError}
  {broadcastState}
  <div className="relative flex flex-col border rounded-[4px] ...">
    {mention popup}
    <textarea ... />
    <div className="flex items-center justify-between px-3 pb-2.5">
      <div>{字数统计}</div>
      <div className="flex items-center gap-2">
        <Zap />
        <Send />
      </div>
    </div>
  </div>
</div>
```

### 细节
- textarea 样式对齐 ChatArea：`bg-transparent` 无边框（外层容器提供边框），`px-4 pt-2.5 pb-1`，`focus` 时外层容器高亮
- 外层容器：`border rounded-[4px]`，focus/input 有内容时 `border-cinder-line-glow shadow-glow-gold`
- Zap 和 Send 按钮移到底部行右侧
- mention popup 保留，位置不变（absolute bottom-full）

### 文件
- `packages/chat-core/src/views/GroupchatRoom.jsx` — 重写 input area JSX（line 596-686）

---

## 改动 3：双侧字数统计

### ChatArea
- 位置：底部行左侧，现有控件（sliders / image / paperclip）之后
- 显示：`{inputValue.length}` 字符，muted 样式
- 文件：`packages/chat-core/src/components/chat/ChatArea.jsx` line 1396 附近

### GroupchatRoom
- 位置：底部行左侧（最底下靠左）
- 显示：`{inputValue.length}` 字符，muted 样式
- 文件：`packages/chat-core/src/views/GroupchatRoom.jsx` input area 重写时一并加入

### 样式
```
<span className="text-[0.625rem] tx-message-mute opacity-30 tracking-wider tabular-nums">
  {inputValue.length}
</span>
```

---

## 验收标准

### 返回按钮
- [ ] Mobile `/groupchat`：顶部只有 MobileHeader 一个 "‹ Home" 按钮
- [ ] Mobile `/groupchat/:id`：顶部只有 MobileHeader 一个 "‹ Groupchat" 按钮
- [ ] Desktop `/groupchat`：顶部有 "‹ Home" back header（`hidden md:flex h-12`）
- [ ] Desktop `/groupchat/:id`：split view 顶部同一 back header，右侧 room header 无 back 按钮
- [ ] GroupchatRoom 内部无任何 `BackToUpper` 组件

### Textarea 布局
- [ ] GroupchatRoom textarea 被包裹在带圆角边框的容器内（和 ChatArea 一致）
- [ ] Zap + Send 按钮在容器内底部行右侧
- [ ] textarea focus 时外层容器边框高亮
- [ ] mention popup 位置正确（absolute bottom-full，在容器内）

### 字数统计
- [ ] ChatArea 底部行左侧显示当前 `inputValue.length`
- [ ] GroupchatRoom 底部行左侧显示当前 `inputValue.length`
- [ ] 数字随输入实时变化
- [ ] 样式 muted，不抢视觉焦点

### 不破坏
- [ ] GroupchatRoom 发送 / broadcast / mention 功能正常
- [ ] ChatArea 发送 / 附件 / autocomplete 功能正常
- [ ] draft 保存/恢复正常
- [ ] 无 console error