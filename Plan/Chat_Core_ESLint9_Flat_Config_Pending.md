# Chat Core ESLint 9 Flat Config — Pending

## 状态

**Pending / 今日不施工。** `[human / Alicia]`

chat-core 原先因缺少 ESLint 9 flat config 而无法执行 lint。M1/M1.1 已完成配置可行性验证与真实基线清点，但后续工作涉及 40 个前端文件，已超出“小型配置修复”的合理范围，因此暂停，不进行一次性清理。

## 已完成

- 创建 `packages/chat-core/eslint.config.js`。
- 使用 `@eslint/js`、`eslint-plugin-react`、`eslint-plugin-react-hooks`、`eslint-plugin-react-refresh` 与 browser globals。
- 新增开发依赖 `eslint-plugin-react`，用 `react/jsx-uses-vars` 排除 JSX 组件引用的误报。
- 未启用本项目不使用的 React Compiler 专属规则；保留适用的经典 Hooks 规则。
- 未修改任何 `src/**` 文件。

## 当前真实基线

`eslint src/ --max-warnings=0` 当前报告 **170 项（152 errors + 18 warnings），涉及 40 个文件**：

| 数量 | 规则 | 风险分类 |
|---:|---|---|
| 138 | `no-unused-vars` | 多数可机械处理，但必须区分无用 import、参数与真实死代码 |
| 18 | `react-hooks/exhaustive-deps` | 行为敏感，禁止机械补依赖 |
| 10 | `no-empty` | 必须确认应上抛、记录还是删除，不允许空 catch |
| 3 | `react-refresh/only-export-components` | 可能需要拆分模块 |
| 1 | `no-useless-escape` | 机械修复 |

高集中度文件包括 `ChatArea.jsx`（27）、`ConversationList.jsx`（7）、`RecordingWaveform.jsx`（7）、`GroupchatRoom.jsx`（7）和 `useAudioRecorder.js`（5）。

## 后续施工拆分

### M2-A：非冻结文件的机械清理

- 只处理确认无行为变化的 unused import/变量与无用转义。
- 空块逐项确认错误语义，不得静默吞错。
- 每批保持小范围并独立运行 lint、test、build。

### M2-B：行为敏感问题

- 单独审查 18 项 Hooks dependency 与 3 项 React Refresh 导出问题。
- 每项先确认真实数据流和生命周期；禁止为过 lint 盲目补 dependency 或移动代码。

### M2-C：冻结语音文件窄修订

- `ChatArea.jsx`、`useAudioRecorder.js`、`RecoverableAudioItem.jsx` 等已验收音频文件单独处理。
- 只能做经审查的最小修复；不得改变录音、恢复、SSE terminal success 或 retry-in-place 语义。
- 必须重跑 Frozen frontend acceptance 11 项、chat-core 全量测试及 build。

## 关键文件

- **已创建 / 修改但未完成验收**：
  - `packages/chat-core/eslint.config.js`
  - `packages/chat-core/package.json`
  - `pnpm-lock.yaml`
- **后续可能修改**：仅经分批 scope review 批准的 `packages/chat-core/src/**` 文件。
- **不动**：chronicle、council、shared、后端与未列入当批审批的文件。

## 恢复施工前置条件

1. 为 M2-A/B/C 分别列出精确文件、行号、rule 与修复策略。
2. 先批准当批 scope，再修改源码。
3. 冻结语音文件必须单独取得窄范围批准。
4. 不得关闭规则、添加 ignore、降低 severity 或忽略退出码来制造绿色结果。

## 最终验收目标

```bash
pnpm --filter exo-chat-core lint
pnpm --filter exo-chat-core exec eslint src/ --max-warnings=0
pnpm --filter exo-chat-core test:run
pnpm --filter exo-chat-core build
git diff --check
```

预期：lint 0 error / 0 warning，测试与 build 全部通过，且不存在未经批准的业务行为变更。

## 署名

- 暂停决策：`[human / Alicia]`
- 范围拆分与质量门：`[gpt-5.6-sol / Sol]`
- M1/M1.1 inventory：`[model / Ian]`、`[model / Alaric]`
- 日期：2026-08-01
