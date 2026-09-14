# Memo: V3 chat-core async 轮询 delta 类型守卫（dict 误入正文 + cursor 污染）

- **日期**: 2026-09-14
- **背景**: 原调查结论误标为 ExoCore-UI-Legacy；实际战场是 ExoCore-Desktop 的 V3 `packages/chat-core`（Legacy 同款改动未提交，处置待 Alicia 决定）。
- **目标**: async 模式下 dict 类型 delta（`telemetry` / `cache_skipped` / `assistant_trace`）不再拼进消息正文（`[object Object]`）；telemetry 正常进面板、cache_skipped 正常弹 toast（与 SSE 一致）；轮询 cursor 不再被 dict 污染成 NaN。
- **范围**: 仅 chat-core async 路径，零后端改动：
  1. `src/components/chat/applyDeltaMessage.js`（新文件）：把 `applyDeltaToMessage` 从 ChatArea.jsx 抽出（纯函数模块，eslint react-refresh 不允许多余命名导出挂在组件文件上）。新增 telemetry/cache_skipped/assistant_trace 显式 no-op 分支；兜底 else 收紧为 `typeof text === 'string'`。4 个调用点（SSE / send async / resume async / resume 回放）共享同一守卫。
  2. `src/components/chat/ChatArea.jsx`：sendMessageAsync onDelta（~L1001）与 resumePolling onDelta（~L692）各加 telemetry（面板）与 cache_skipped（toast）分支，与 SSE 逐字段一致，处理完提前 return，不碰正文。resume 回放循环（~L680）无需改动——helper 守卫自动丢弃 dict（回放段 telemetry 不补记面板，纯展示差异，非 bug）。
  3. `src/hooks/usePollingChat.js` pollLoop（~L46）：`totalDeltaLen` 只累加字符串长度；dict 仍转发 onDelta。pollLoop 为 send/resume 共用，一处修复全覆盖。
- **契约**: `sendMessageAsync` / `resumePolling` 签名与回调契约不变；SSE 模式行为不变（telemetry/cache_skipped 原本就在 helper 前拦截）；V4 app（自有 runtime + 事件数 cursor 校验，与本 bug 无关）、后端、P1D 冻结测试均不动。
- **验证**: 新增两个回归测试（`applyDeltaMessage.test.js` 单元 + `usePollingChat.test.js` cursor NaN）；`npx vitest run`（scoped）+ `npx eslint`（scoped，零新增错误）+ `pnpm --filter exo-chat-core build`；真机验证由 Alicia 用 deepseek pro 跑 V3 async 确认。
