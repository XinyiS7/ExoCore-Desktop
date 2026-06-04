# Skill: WezTerm Pane Interaction (wezterm_coop)

## 1. Description

通过 `wezterm_cli` 工具观察 WezTerm 终端窗格内容并向窗格发送文本。轻量级的跨窗格状态检查与交互。

## 2. 核心原则

**`wezterm_cli` 是观察窗，不是控制台。** 用于查看终端窗格的当前状态、向窗格发送简短指令，不替代 shell 或执行复杂脚本。

## 3. 常用操作

### 3.1 查看窗格列表

```
wezterm_cli(action="list")
→ 返回 pane_id、标题、cwd 等
```

### 3.2 读取窗格内容

```
wezterm_cli(action="get-text", pane_id="<id>")
→ 返回窗格当前可见区域的文本快照
```

用于检查终端输出、确认命令执行结果。

### 3.3 向窗格发送文本

```
wezterm_cli(action="send-text", pane_id="<id>", text="<要发送的内容>")
```

### 3.4 新建窗格

```
wezterm_cli(action="spawn", command="<cmd>", cwd="<dir>")
wezterm_cli(action="split-pane", direction="bottom|right", command="<cmd>")
```

## 4. 典型工作流

```
用户: "看一下终端在干什么"
  → wezterm_cli list → 找到目标 pane_id
  → wezterm_cli get-text → 读当前输出
  → 汇报给用户

用户: "往终端发条消息"
  → wezterm_cli send-text(pane_id, text="...")
```

## 5. 约束

- **只读为主**。get-text 是主要操作，send-text 仅在明确需要时使用
- **不替代 shell**。`wezterm_cli` 没有命令执行能力——需要跑命令用 `shell` 或 `workspace_run`
- **WezTerm socket 自动检测**。工具在 Windows 下自动查找活跃 socket，无需手动配置
