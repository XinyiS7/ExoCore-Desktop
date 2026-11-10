# V4 Cloudflare Access 过期自救验收报告

> **Issue：** XinyiS7/ExoCore#123  
> **Plan：** `Plan/V4_Cloudflare_Access_Reauth_Plan.md`  
> **Desktop baseline：** `af79aae`  
> **Umbrella baseline：** `9f7895f`  
> **验收方：** [gpt-5.6-sol / Solaire]  
> **日期：** 2026-11-10

## 1. Verdict

**PASS**

Cycle: R1 | Checkpoint: FINAL | Baseline: Desktop `af79aae` + acceptance probe update；Umbrella `9f7895f` | Verdict: PASS  
Owners: Construction 0, Acceptance 0, Harness 0, Spec 0, Environment 0  
Findings: none | Consecutive FAIL Count: 0

`DEPLOY_STEP: none` — 无数据库迁移；Alicia 已重启 nginx/tunnel，并在生产域名确认 `/reauth` 跳转至 `/app/`。

## 2. Frozen Gates 与证据

| Gate | 结果 | 决定性证据 |
|---|---|---|
| 真离线显示“设备已离线”，不提供重认证 | PASS | `cloudflare_access_reauth.test.tsx` 对离线分支的驻留回归 |
| 在线网络失败显示“连接被中断（可能是登录已过期）”并提供重认证 | PASS | 驻留回归通过；冻结 arrival acceptance 探针已同步到 #123 的新契约 |
| 重认证执行浏览器级 `/reauth` 导航 | PASS | 驻留回归精确验证目标；生产域名 `https://exocore.g045.dev/reauth` 已由 Alicia 实测跳转 `/app/` |
| 不自动跳转、不清 SW/cache、不注销 SW | PASS | 源码路径核查；无测试环境分支或替代恢复路径 |
| `/app/` navigation 使用 NetworkFirst | PASS | 真实 `public/sw.js` harness 驻留回归通过 |
| 只缓存同源、basic、HTTP 200 文档响应 | PASS | 同源允许与跨源/non-basic/non-200 拒绝分支均有驻留回归 |
| runtime cache 不可用时回退 precache shell | PASS | 两级回退驻留回归通过 |
| `/api/`、`/media/` 继续排除 | PASS | route 注册回归通过 |
| nginx 精确 `/reauth` 路由 | PASS | Umbrella `9f7895f`；重启后生产域名无尾斜杠路径实测成功 |
| DebugLog 记录误判链条与 302 证据 | PASS | `DevelopLog/DebugLog.md` 已记录 Access 过期、跨域重定向失败及排障入口 |
| Desktop 全量回归与构建门 | PASS | Vitest `1658/1658`；TypeScript、ESLint、Vite production build 均通过 |

## 3. 独立验收执行记录

### 3.1 冻结探针修订

`packages/app/src/acceptance/p2d_d1_arrival_acceptance.test.tsx` 属 Acceptance-owned 文件。施工方未改动；验收方将其在线网络失败期望从旧文案同步为 #123 冻结的新文案。

- 聚焦复查：1 file，9/9 PASS。
- 全量 Vitest：138 files，1658/1658 PASS。
- 非阻断噪声：jsdom `HTMLMediaElement.pause()` 未实现警告；不影响断言或退出码。

### 3.2 静态与构建门

- `npx tsc -p tsconfig.json --noEmit`：PASS。
- `npx tsc -p tsconfig.node.json --noEmit`：PASS。
- `npx eslint src/`：PASS。
- `npx vite build`：PASS；生成 V4 client 与 SW 产物。

### 3.3 生产环境门

- Alicia 已在 Mac 新设备首次访问时观察到 Cloudflare Access 邮箱验证，证明生产域名的 Access challenge 与认证后放行有效。
- Issue 诊断证据已确认过期请求 302 至 `wandering-dream-37db.cloudflareaccess.com`。
- nginx/tunnel 重启后，Alicia 访问 `https://exocore.g045.dev/reauth`，确认跳转至 `/app/`。

## 4. 用户批准的验收替代

冻结 Plan 原要求再次制造 Access 会话过期，完整观察“已打开应用 → 提示 → 重认证 → 轮询自愈”。该操作会给 Alicia 的多设备登录带来不必要干扰。

Alicia 于本轮明确同意不再重复制造过期会话。验收改用以下组合证据覆盖同一真实链路：[Alicia / user-approved rebaseline]

1. 历史 curl 证据覆盖“过期请求被 Access 302 接管”；
2. 驻留回归覆盖“在线 fetch 失败 → 过期提示 → `/reauth` 动作”；
3. Mac 新设备登录覆盖真实 Access challenge 与认证放行；
4. 生产 `/reauth` 实测覆盖 nginx scope 外跳转及回到 `/app/`；
5. SW 回归覆盖真实网络优先、缓存污染防护和离线壳回退。

此替代不降低产品行为要求，只取消会干扰真实设备会话的重复人工重演。

## 5. Scope 与风险收口

- V3 `chat-core`、`chronicle`、`council` 未纳入本次改动，符合冻结范围。
- 未新增认证探针、通用 auth store、自动跳转、SW unregister 或全缓存清理。
- 验收期间发现伞仓 index 曾暂存删除 `/reauth` 的反向补丁；已在 Alicia 授权下仅清理暂存状态，未触碰 #115 工作树内容。最终 index 为空，HEAD 与工作树均保留 `/reauth`。
- `/reauth/` 带尾斜杠路径返回 404；这是 nginx `location = /reauth` 精确匹配的预期行为，公开入口为无尾斜杠 `/reauth`。

## 6. Closeout

- P0/P1：0。
- Deferred：0。
- Deploy pending：无。
- Issue #123 可关闭。

登记：[gpt-5.6-sol / Solaire] — 2026-11-10
