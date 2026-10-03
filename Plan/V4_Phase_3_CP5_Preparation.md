# P3 CP5 — Builder证据清单与隔离浏览器验证方案（待授权）

责任方：Builder pane7。依据CP4独立R1 PASS后CP5有限release。

**本文只整理证据并提出方案。未执行浏览器验证、未启动服务/浏览器、未新增工装。C3 verdict、视觉接受与ownership仍由Alicia/指定验收方决定。本文不作任何最终PASS或ownership切换。**

## 1. 现有证据索引

| 范围 | Builder证据 | 独立裁决来源（只读） |
|---|---|---|
| CP0 / KF07 | `Plan/V4_Phase_3_KF07_Diagnosis.md`、`Plan/V4_Phase_3_KF07_Repair_Execution_Log.md` | `Plan/V4_Phase_3_KF07_acceptance_report.md` |
| CP1 五源只读/分页/长文 | `Plan/V4_Phase_3_CP1_Execution_Log.md`；scroll修复`Plan/V4_Phase_3_CP1_F01_Repair_Log.md` | `Plan/V4_Phase_3_CP1_acceptance_report.md` |
| CP2 Memo/Tags/回复 | `Plan/V4_Phase_3_CP2_Execution_Log.md`；同页草稿生命周期修复`Plan/V4_Phase_3_CP2_F01_Repair_Log.md` | `Plan/V4_Phase_3_CP2_acceptance_report.md` |
| CP3 Task/Shelf/Calendar | `Plan/V4_Phase_3_CP3_Execution_Log.md` | `Plan/V4_Phase_3_CP3_acceptance_report.md` |
| CP4 Legacy/Ledger/入口 | `Plan/V4_Phase_3_CP4_Execution_Log.md` | `Plan/V4_Phase_3_CP4_acceptance_report.md` |
| 冻结行为依据 | `Plan/V4_Phase_3_River_Memo_Detailed_Plan.md`、`Plan/V4_Phase_3_River_Memo_acceptance_spec.md` | Acceptance所有，只读 |
| UI参考而非运行证据 | `Plan/V4_River_Memo_UI_Mockup.html`、`Plan/V4_River_Memo_UI_Mockup_Report.md` | 不代替真实渲染或Alicia视觉确认 |

目前CP0–CP4实施门状态均引用上述Acceptance报告，不由本文重裁。未更改任何报告/spec/probe、Roadmap/Freeze/ownership/根跳转；没有commit。

### 机械测试证据（明确来源与运行条件）

- Builder CP4：16个相关文件247/247，typecheck/lint/build各exit0；具体命令、逐文件数与断言在CP4执行记录。
- 独立CP4：相同16文件247/247与静态/构建通过，报告已记载。
- 独立最终全量：**Node v25.7.0 / pnpm 11.5.1，仅该测试进程及其子进程设置`NODE_OPTIONS=--no-experimental-webstorage`，执行`pnpm --filter exo-app test:run`：116文件1489/1489，0failed/skipped/errors，exit0。** 此为Acceptance报告转引，Builder本轮没有再跑全量。
- **默认无flag命令仍FAIL：26失败文件/211失败测试，90文件/1278测试通过。不能把有条件的全量PASS写成默认脚本PASS。**
- A/B诊断：默认Node25实验global localStorage stub的getItem/setItem未定义，污染jsdom；runtime_storage A13/13失败，只有进程flag改变后的B13/13通过。没有改产品/测试断言来消除失败。浏览器原生localStorage不受该Node进程flag影响。
- 后续若获得测试执行授权，此环境必须显式设置**native child**的process.env.NODE_OPTIONS，确认子进程继承；不能靠Git Bash前缀假设Windows子进程已经收到。不改系统/user env、仓库config/package脚本或聊天代码。
- CP3 API/日期原生TZ证据：Shanghai offset=-480、Los_Angeles offset=420，各18项通过；不把jsdom日期测试当真机视觉证据。
- CP2冻结probe hash引用报告：`1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2`。本轮不执行/修改/读取其断言。

## 2. 仍需验证与明确不覆盖

1. 真浏览器下桌面/小屏明暗主题可读性、横向溢出与实际AppShell/底栏约束；不能用jsdom scrollTop赋值证明真实layout。
2. 长River实际滚动到尾部/分页；Diary与Heartbeat**阅读Drawer**关闭后位置和焦点恢复、背景隔离。Memo是内联thread，不误当阅读Drawer。
3. Task写入在途所有操作disabled时，Tab/Shift+Tab焦点是否仍停留dialog/fallback容器；Escape/点击背景不能退出。现为非阻塞观察，需实测，不先改通用focus框架。
4. 来源弹窗/永久删除确认、Calendar→Task→返回、River→Ledger的真实交互和视觉；真实API写入不在本方案内。
5. 后台Calendar快照延迟、GCal可能缺项、PATCH只保证本地更新、unlink远端尽力而为仍是来源限制，不应因mock观察而宣布远端正确。
6. 默认Node25无flag全量失败是已诊断运行环境条件，不在本轮顺手永久修复。
7. C3、Alicia视觉接受、ownership/Roadmap/根站点切换均pending。mock-backed浏览器结果也不等于真实服务/真实DB写入验收。

## 3. 最小可行浏览器方案（Proposal，不是已执行事实）

### 3.1 复用范围与成本控制

现有Builder `packages/app/scripts/p2b_cp4_browser_probe.mjs`已有系统Chrome+原生CDP/Node WebSocket拦截先例，`packages/app/scripts/p2a_serve_dist.mjs`有静态dist `/app/`映射先例。可参考设计，**不原样执行旧探针、不修改任何旧验收资产**；旧脚本的隐藏spawn/固定端口不继承。

项目现有测试主要Vitest/jsdom，无已配置Playwright/MSW浏览器工装；`installFetch`依赖vi.stubGlobal，不能直接塞进Chrome。复用的是自有`river_fixtures.ts`、`memo_test_server.ts`、`task_test_server.ts`的**合成契约形状**，不是引入Vitest runtime或真实数据。

获批后最多一个Builder-owned一次性CDP观察脚本（含少量合成API路由/记录），一个本地静态服务，复用已安装系统Chrome/Node，无新依赖/测试框架/大工装。截图与机械观察输出到新的Builder目录，例如`Plan/Diagnostics/P3_CP5_Browser/`；不写`src/acceptance`或Acceptance截图目录。只实现下面矩阵必需fixture/延迟控制，不重建完整模拟后端。

### 3.2 Fail-closed隔离前提

必须在真正导航前证明这些条件；任一不满足就停止，不降级访问真实服务：

1. **专用临时Chrome profile**，无用户cookie/localStorage/token/cache；不连接已有个人浏览器，不复用现有服务worker。浏览器与本地静态服务均需授权后显式前台启动并在独立可见Pane记录日志，不使用隐藏后台spawn。
2. 静态服务只绑定`127.0.0.1`临时空闲端口，只提供指定dist目录和`/app/`SPA映射；**无proxy/upstream/backend连接逻辑**，任何`/api/*`直达服务一律拒绝，路径越界拒绝。不用当前带8000代理的Vite dev server、不碰nginx/Django/Runtime。若后续竟需真实backend，停止另报并遵守双端显式重启纪律。
3. CDP在about:blank阶段启用拦截再导航：所有请求默认拒绝；仅放行该静态origin的已知静态资源，合成API请求通过`Fetch.fulfillRequest`就地返回。未知API/外部origin/第三方图片/fonts/链接目标均阻断并记为待解释请求，不使用fallback真实fetch。独立profile内禁用/绕过SW，不能有SW绕开拦截。
4. POST/PATCH/DELETE只允许明确列出的**memory-only fixture动作**（下述必要场景）；绝不能`continueRequest`到服务。未知写操作立即中止场景。CDP失联后静态服务仍拒绝全部API，形成第二层无代理防线。
5. 先做隔离自检：已知fixture GET成功；未知API与外部请求被拒；合成写只改变内存计数、静态server API请求计数为0。保留请求method/path/处理方式统计，不记录用户真实内容。不得测试真实paid/GCal网址跳转。
6. theme通过新profile的`exo_theme`在文档加载前设置，并验证html data-theme，不能只改prefers-color-scheme假设主题已变。
7. dist来源在执行前核对源码/构建状态；不把mtime自动当产物一致性证明。若需重建，只在获批的本地build范围内执行并记录，不持久改环境。

### 3.3 合成数据最小集

- 两页五源River（足够长使实际滚动）、全局Shelf约5条真实形状任务；包含长中文、长英文无断词、Markdown/code、空/错误状态。
- Diary与Heartbeat全文详情；Heartbeat Ledger使用非1 preset（如6）与2个合法UUID，Agent read/queue/ledger最小fixture，不ack。
- Memo一个root及两层reply，POST/PATCH通过memory-only记录；Task三类型canonical详情/list/completions；一份明确fetched_at/实际window快照，含exo与纯GCal；Legacy milestone/moment及source-changed例。
- AppShell通知poll空响应等必要只读启动请求。未知依赖不静默放通，记录后再决定是否属于场景必需。
- busy观测用**显式释放的deferred fixture响应**，不是任意sleep掩盖时序；通过/失败各一条即可，业务分支已由现有单测覆盖，不复制42项Task用例为浏览器矩阵。

## 4. 有界验证矩阵与证据

基准尺寸：桌面1280×900、小屏390×844；两者dark/light共4个主场景。补320px窄屏一组溢出/Drawer smoke即可；不强制扩成所有像素断点组合。模拟viewport明确标注，不冒充实体手机。

| 场景 | 观察/机械检查 | 最小证据 |
|---|---|---|
| 实际Shell与主题（4格） | `/app/river`真route，desktop sidebar/mobile bottom bar；首屏Shelf与Hero、文本/按钮/边界/对比；scrollWidth≤viewport，无底栏遮住末项 | 4张首屏图、实际rect/主题属性 |
| 长流scroll（桌面+小屏） | 滚动`.river-page`到底，实际末项/加载更早可见可点击；body不滚替身；第二页末项可达，滚动owner节点不换 | scroll/clientHeight/scrollHeight+末项rect、2张尾部图 |
| Diary/HB阅读Drawer | 深处打开全文，desktop约580px/mobile全可用宽高；Tab/ShiftTab在dialog内，背景无法点击/聚焦；Esc/close恢复原触发器与同一scrollTop（允许1px舍入） | 每种Drawer至少一次；深色desktop/浅色mobile截图及activeElement序列 |
| Task busy focus（重点） | 从Shelf进入Task后释放前暂停complete/保存响应；当前focus/button disabled后连续Tab/ShiftTab不得掉到页面；Esc/背景不关闭；合成503后note/错误仍在，最终close恢复焦点 | before/pending/error截图、键盘activeElement路径、exact1模拟写统计 |
| 来源操作与状态 | Memo root+reply；Task todo/periodic/goal表单/原生日期入口；Calendar exo→同Task、pureGCal无Task edit；Legacy取消删除0模拟DELETE、确认仅1模拟DELETE并刷新；GCal只模拟502错误不真实推送 | 不需4格重复所有业务；一桌面一路径+小屏代表路径，截图与request-summary |
| Ledger/导航 | River真实preset/session链接、刷新/后退后URL与选择一致；非法/404明确；River返回；Groups/Library仍disabled、root/V3未改 | URL/选择/GET-only记录、desktop/mobile各一次导航 |
| 明暗补充 | Drawer、Task错误态、Calendar在两主题至少各有代表图，确保不是只首屏颜色切换 | 复用上述截图，避免冗余全排列 |

**Task busy focus若真实失败：**只提交具体复现（viewport、主题、focus序列、DOM目标、截图），停止该点并交pane5；不自动扩修通用dialog或借非阻塞观察扩全产品scope。

## 5. 结果记录与停机规则

获批执行后输出独立Builder观察记录：
- 实际命令/版本/临时origin/profile、是否headful或headless、viewport/theme、产物来源；
- 每条scenario的执行/通过/失败/未执行，截图索引与rect/focus/scroll数据；
- intercepted read/mutation/blocked request统计，**真实后端0请求**的隔离证据；不得把mock写称真实落盘；
- 最多约10–14张有代表性截图，明确哪些由Alicia/指定责任方看过，未看不填视觉PASS；
- 执行后关闭本次专用浏览器/静态服务，保留日志/截图，不清理他人进程/文件。

出现未知外部请求、拦截失效、端口占用、服务安全无法证明或API形状冲突即停报。不为了完成截图去启动后端、查询真实DB、打开真实GCal或扩新框架。

## 6. 本次execution-log / 请求授权

本轮只读核对最终Acceptance报告、子代理定位现有工装与fixtures，并新增本文。**未跑测试、未重建、未启动服务/浏览器、未写工装、未操作真实数据/环境、未提交。** 不修Node25全局环境或任何已通过产品代码。

请Alicia/指定责任方确认是否授权上述**临时静态服务+专用Chrome+CDP fail-closed合成API**方案，以及观察执行人/截图视觉确认人。未授权前保持停止；不执行CP5浏览器阶段、不改C3 verdict/ownership/Roadmap。
