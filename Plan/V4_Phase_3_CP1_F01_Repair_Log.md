# CP1-F01 — 页面滚动所有者修复 execution-log

日期：2026-10-02；Builder pane7；依据只读 `Plan/V4_Phase_3_CP1_acceptance_report.md` R1 / CP1-F01。原CP1授权内单点修复，不扩展CP2、router/nav或全局shell。

## 范围 / 原因 / 修改

Acceptance指出的实际约束链成立：body本身禁止滚动，AppShell只提供有限高度flex main，每个Outlet页须自行提供受约束滚动容器。原River根没有flex收缩与overflow，长流内容溢出到body后被裁切。

本轮生产修改**仅** `packages/app/src/features/river/river.css:1–2`：

```css
/* Direct AppShell Outlet child: this is the sole page scroll owner. */
.river-page { flex: 1; min-height: 0; min-width: 0; overflow-y: auto; overscroll-behavior: contain; /* 其余原样 */ }
```

选择私有等效容器而非新增app-page/app-scroll包装：原main成为唯一纵向页面scroll owner，无额外DOM、重复padding、CSS导入顺序依赖或第二个纵向流滚动框。未改RiverPage/query/API/重试/Drawer数据逻辑；横向Shelf仍独立，阅读Drawer的正文滚动与页面滚动处于互斥交互状态。

新增自有开发测试 `packages/app/src/test/river_scroll.test.tsx`。未改既有通过的99条测试、冻结验收资产、生产router/navigation/global shell、后端或V3修复；无commit、无他人文件清理。

## 真正shell CSS链证据（不是jsdom尺寸证明）

| 当前源位置 | 实际约束 |
|---|---|
| `styles/base.css:64–68` | html/body/#root全高100% |
| `styles/base.css:70–79` | body overflow:hidden，不能代替页面滚动 |
| `styles/shell.css:5–9` | .app-shell display:flex / height:100% / min-height:0 |
| `styles/shell.css:51–58` | .app-main flex column / flex:1 / min-width:0 / min-height:0，无overflow |
| `shell/AppShell.tsx:38–40` | Outlet直接位于app-main；页面是其直接flex child |
| `features/river/river.css:2`（本次修复） | 页面flex:1 / min-height:0 / min-width:0使高度受main可用空间约束，overflow-y:auto使超过页面高度的内容可滚动到尾部 |
| `styles/shell.css:62–70,176–199` | 移动main padding-bottom与固定bottom-bar height使用同一`--v4-bb-offset + safe-area`；≥768px main padding恢复0、bottom-bar隐藏，无需River再重复预留 |
| `features/river/river.css:40,47–53` | Drawer正文自身滚动；小屏全屏规则不覆盖页面flex/min-height/overflow约束 |

桌面及小屏页面采用同一个私有滚动所有者；原≤640px media仅改padding/gap，不取消修复约束。由上述真实CSS链保证长流/尾卡/续页控件处于受约束滚动区，而不是body裁切区域。**没有实际浏览器layout/真机视觉PASS声明。**

## 自有回归 / 具体断言

`src/test/river_scroll.test.tsx`，describe `CP1-F01 real shell scroll contract (structure, not jsdom layout)`：

1. `has a viewport-bounded scroll owner; shell reserves its real mobile bottom-bar height`：读取实际repo CSS源，断言root100%、body隐藏、shell全高、main flex column/1/min-height0、River flex1/min-height0/min-width0/overflow-y:auto；mobile main padding与bar height同一token，desktop取消padding；Drawer正文overflow保持。
2. `keeps a long stream, its last card and pagination inside the same scroller; drawer preserves its deep position`：**真实AppShell + 测试私有Routes**，模拟两个服务端20-item页（39条Memo加1条Diary），不是默认limit20下虚构40条首页。断言：main.river-page直接挂app-main--bb、bottom-bar存在、恰一个River page owner、无嵌套app-scroll；第39条与load-more均是该owner后代。模拟`scrollHeight9000/clientHeight600/scrollTop7300`后打开Diary，background container inert/aria-hidden及body锁成立；关闭后owner仍同一DOM节点、scrollTop仍7300、trigger焦点恢复、尾部load-more保留，River GET恰两次（没有关闭后重取或重建流）。
3. `keeps empty page/shelf states inside that same scroll owner`：空Shelf/空流提示均位于真实shell内同一owner，不掉到页面滚动区之外。
4. `keeps error page/shelf states inside that same scroll owner`：两类失败重试入口同样属于owner。

DOM模拟scrollTop仅验证状态/节点不重置与背景隔离，**不证明真实scrollHeight、viewport尺寸或Alicia视觉效果**。测试不向生产router或renderApp增加River入口。

## 机械验证 / 开发修正轨迹

全部由test-runner执行，本人核对Acceptance原因、真实shell样式及Outlet、CSS最小修改、测试断言与结果；不派生reviewer、不扩大修复范围。

- 首轮native scoped五文件：103 tests，102通过/1失败；新增三项DOM长流/空/error已通过，原99保持通过。失败仅CSS ?raw import被Vitest CSS禁用策略stub，无法读到#root声明。同期typecheck/lint/build均exit0。
- 工装第一次改用文件读取时，jsdom将import.meta.url重写为http，fileURLToPath导致collection失败；同期typecheck/lint仍exit0。生产CSS未再次修改。
- 最终自有工装固定使用**package-native runner cwd**，仅读取三份明确的repo CSS文件；runner验证cwd=`packages/app`。native命令 `pnpm --filter exo-app exec vitest run src/test/river_scroll.test.tsx`：**1 file /4 tests通过，exit0**；typecheck/lint均exit0。
- 未在最终修正后重复原99条或build：生产CSS及这些测试与首轮通过时相同，最后修改仅自有CSS源读取工装。组合证据为原99通过+新4通过，不伪称最终一次103/103整组运行。
- Build非致命warning仍为既有大chunk与PWA inlineDynamicImports deprecated；Vitest有既有Node localstorage-file warning。未为了工装修复扩大生产代码或试第4次盲改。

## 安全 / 未验证 / 交付

- 合成mock数据，未读取.env/真实Diary/真实DB，未HTTP写探针/GCal/付费调用、跨仓编辑、启动/重启生产服务或隐藏后台进程。
- 源码约束链及DOM位置保持已有证据；真机layout、视觉与滚动体验仍待Alicia/独立验收方确认，不拿jsdom冒充实际浏览器。
- 交pane5仅请求CP1-F01聚焦复核。CP1是否PASS与下一release仍属外部责任方；已停止施工，不进CP2、不启导航、不声明C3通过。
