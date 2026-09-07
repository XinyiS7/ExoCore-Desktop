---
name: commit
description: 规范化 git 提交流程 — 先看改动统计、按 conventional commits 汇总、跑相关测试、分阶段 add 并提交。Use when committing changes or asked to commit.
compatibility: pi
metadata:
  scope: exocore
---

# Commit Skill

规范化的提交流程，避免随手 `git add -A` 和一句话 commit message。

1. 先运行 `git diff --stat` 查看改动文件清单，确认改动范围符合预期
2. **提交前先看 stage**：运行 `git status --short`（或 `git diff --cached --stat`），检查 index 里是否已有**别人 staged 的内容**（其他 pane/agent 的施工文件）。**不是自己的东西不要碰**——除非 Alicia 明确说「请帮忙一起提交」，否则不得把它们带进自己的提交
3. **带 path 提交**：`git commit <pathspec>` 只提交自己 scope 的文件，禁止不带 pathspec 的 `git commit`（会把整个 index 全部卷走）。例：`git commit -m "..." -- path/to/file`
4. 用 conventional commit 格式（`type(scope): summary`）汇总本次改动
5. 运行相关测试（后端 `python.exe manage.py test <app>` 或 `test_*.py`，前端 `pnpm lint`）
6. 只 `git add` 与本次改动相关的文件，禁止无差别 `git add -A`
7. 提交时使用当前模型署名：`git commit --author="$PI_MODEL <agent@exocore.local>"`（人工提交署名 `Alicia`）
8. 确认提交成功（`git log -1 --oneline`），并复查 `git status --short`：除 untracked 外，别人的 staged 文件应保持原状
