# CP5 真实产品实测 execution-log

## 授权与安全边界

Alicia经pane5授权直接真实产品实测，取消另建mock/CDP合成服务方案。此前`CP5_Preparation.md`中的隔离工装仅是未执行提案，不再作为执行路线。

真实写入限少量明确标记的测试Memo/Task/纪事及其来源动作；不操作已有真实内容/AgentPreset、不生图/付费/真实GCal推送，不修改已绑定GCal任务（防隐式同步）。Memo无删除能力，新建会留下记录，已告知Alicia，优先她亲手输入。不为矩阵批量造数据或清理。

## 入口核查与打开

- scout只读检查监听端口与静态HTTP页面/资源：现有nginx网关`http://localhost:8080/app/river`返回200、HTML标题ExoCore V4；引用`/app/assets/index-DN-lAhTG.js`及`index-CmcaHARr.css`与本地dist文件名一致，JS资源200。
- 这是现有生产构建入口，不是HMR。5176无listener；未启动前端开发服务。
- Django8000与Runtime8766已有listener。未重启任一服务、未操作nginx，也未打断pane6图片桥施工。
- 已向Alicia给出准确URL，并调用`explorer.exe 'http://localhost:8080/app/river'`请求系统默认浏览器打开。
- **HTTP200/资源可取及已发打开命令，不等于已亲眼确认浏览器渲染、缓存版本或视觉通过。** 当前等待Alicia实际页面反馈；未采集用户正文/截图内容进日志。

## 当前实际验证状态

| 项目 | 状态 |
|---|---|
| 现有入口HTTP/静态资源可访问 | 已核实 |
| 发出默认浏览器打开命令 | 已执行 |
| 桌面/小屏明暗、实际scroll/Drawer焦点恢复 | 待现场观察 |
| Task busy focus、Calendar、Legacy/Ledger导航 | 待现场观察 |
| 测试Memo/Task/纪事实写 | 本轮尚未执行 |
| Alicia视觉确认 / C3 / ownership | pending，Builder无裁决或切换权 |

后续仅记录实际步骤、状态与问题，不把真实Diary/HB/用户正文搬入日志，不用mock PASS替代真实实测。若需服务重启，先与pane6协调，再按双端显式同步纪律执行；无必要不重启。不commit、不新增大工装。

## 获批Mockup视觉对齐施工（Alicia授权）

权威视觉输入：`Plan/V4_River_Memo_UI_Mockup.html`与`_Report.md`；真实业务语义仍以Detailed Plan/已验收代码为准。Alicia确认真实页面结构正确后，授权直接按Alaric获批原型对齐，不另做设计提案。

### 实际修改

- River保留唯一scroll owner四项约束，增加780px居中内容列与底部留白；不改AppShell/body滚动。
- Hero改20px主题感渐变标题+mono副标题；无业务按钮。
- Memo composer改为12px圆角elevated card、focus ring、52px无边正文、Tag预览/快捷键提示和accent提交；reply使用紧凑变体，所有保存/草稿/两步Tags逻辑不变。
- Shelf改计数chip、230–260px横向卡片、真实due chip与紧凑入口；只保留真实`打开详情`，未照抄prototype的priority/卡片Complete/虚假defer。
- Stream过滤/刷新改compact pills；五源主轴增加竖线、42px来源bead、分层card/header/body/footer、语义颜色；不造TODAY divider。
- Drawer增加blur/slide、16px标题/mono副标题、Markdown blockquote/code及mobile fullscreen；Memo thread target chip、真实data-depth及受限移动缩进。
- Calendar/Task只做radius/语义色/栅格视觉微调，不改snapshot/GCal/CRUD语义。
- 新视觉tokens最终**局限在`.river-page/.river-reading-overlay/.legacy-overlay/.task-overlay`**，撤出全局base，避免改变通知等其它产品域。无API/query/data/router/backend变更。

原型冲突未采纳：不存在的priority、双向GCal、Legacy软归档、Diary/HB假Calendar事件、固定月份/固定日期、硬编码身份/session、静默减少503来源、伪造字数/归档时刻。

### 机械验证

- 相关18文件（原CP4范围+Appearance/Shell）：289/289，0失败/错误/跳过；typecheck/lint/build与`git diff --check`均exit0。
- 正式全量：仅native child进程`NODE_OPTIONS=--no-experimental-webstorage`，116文件1489/1489、0失败/跳过/错误，exit0；Node25默认无flag失败事实仍按CP4报告保留。flag未持久化。
- CP2冻结probe仅执行/hash，pre/post仍为`1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2`，未读改断言。
- 构建后静态只读核验：nginx现有URL引用`index-BoNqrLUW.css`/`index-B4A5x5kf.js`，served/dist HTML/CSS/JS SHA256分别一致；served CSS可找到780px wrap、timeline bead与scope token selector。未重启nginx/后端/Runtime。

### 真实浏览器代表截图（非mock、无写操作）

直接加载现有真实产品URL/API，临时全新Chrome profile；没有合成服务或CDP API interception。仅用CDP做真实viewport/theme设置和截图，不发POST/PATCH/DELETE。截图可能包含真实来源内容，仅供Alicia本地看效果，本文不转录正文：

- `Plan/Diagnostics/P3_River_Visual/river-desktop-dark.png`（1280×900）
- `Plan/Diagnostics/P3_River_Visual/river-desktop-light.png`（1280×900）
- `Plan/Diagnostics/P3_River_Visual/river-mobile-dark.png`（390×844）
- `Plan/Diagnostics/P3_River_Visual/river-mobile-light.png`（390×844）

几何记录：四场景document宽度=viewport；desktop River client/scrollWidth=1054/1054，mobile=390/390，无页面横向溢出。首次Chrome CLI `--window-size=390`受Chrome最小innerWidth=500限制而截图裁剪，已识别并用真实CDP device metrics=390重做覆盖，不能把旧裁剪图当移动端问题。

当前真实查看URL：`http://localhost:8080/app/river?visual=20261003`。已再次请求系统浏览器打开。

## Alicia视觉确认

Alicia在真实产品页面查看本版后明确反馈：**“可以，这版挺好了”**。据此，本轮River视觉对齐的用户视觉确认已取得。该确认只闭合视觉待确认项；C3总验收、ownership切换与commit仍由负责方另行判定/执行。

## C3最后只读浏览器证据（C14）

执行方式：系统Chrome真实加载`http://localhost:8080/app/river`及现有真实API；CDP仅用于viewport、键盘、点击、几何与状态读取。未拦截/伪造API，未启动模拟服务，未截图或转录正文。Network事件核对为**0个非GET `/api/`请求**；没有新增/修改/删除Memo、Task、纪事或GCal数据。

### River长流与分页可达

- 桌面viewport 1280×900；`.river-page` clientHeight=900、scrollHeight=7664、maxScroll=6764。
- 首屏遍历含20张真实River卡片；滚至scrollTop=6764后，`加载更早记录`控件与River滚动viewport相交，实际可见。该证据只证明长流末端与分页入口可达，不把一次额外GET是否增加页数冒称为条件。

### Drawer真实交互

| 场景 | Settled drawer几何 | 内部滚动 | 背景scrollTop | Focus/关闭 |
|---|---|---|---|---|
| Desktop Heartbeat 1280×720 | left=700, top=0, 580×720 | 该条正文适配当前高度，body 645/645，无需滚动 | open/internal/close均499 | 打开后focus在dialog；Tab/Shift+Tab均留在dialog；关闭按钮后focus回`阅读全文` |
| Desktop Heartbeat低高度反例 1280×500 | left=700, top=0, 580×500 | body client/scroll=425/452，实际scrollTop 0→27 | open/internal/close均609 | Tab/Shift+Tab受限；关闭按钮恢复触发器focus与scrollTop |
| Mobile Diary 390×844 | left=0, top=0, 390×844（full viewport） | body client/scroll=752/755，实际scrollTop 0→3 | open/internal/close均7353 | Tab/Shift+Tab受限；关闭按钮恢复触发器focus与scrollTop |

- 三个settled场景打开时App root均`inert=true`且`aria-hidden=true`；关闭后均恢复，背景没有因内部滚动移动。
- 另以真实Desktop Heartbeat和390 Diary各执行一次Escape关闭：两者均关闭drawer、恢复原`阅读全文`触发器focus及打开前River scrollTop（desktop 409→409；mobile 7353→7353），背景inert/aria-hidden清除。
- 首轮几何采样落在250ms CSS进入动画中（表现为drawer尚在移入），未作为settled尺寸证据；随后在动画完成后重测得到上表。来源筛选切换期间的旧卡片也未作为focus证据，等待新GET稳定后重测。未发现产品缺陷。

### 顺路只读链路

- Calendar：从Shelf打开成功；从全量任务列表打开Task详情成功；关闭详情返回同一Calendar，再关闭Calendar成功。未触发任何任务动作。
- Ledger：从真实Heartbeat卡片进入带`session`参数的深链；浏览器刷新后详情仍存在；浏览器返回成功回到River。
- Legacy：真实历史纪事详情打开、关闭成功；未进入删除确认、未PATCH/DELETE。
- Task busy-focus：按授权未构造真实写入或延迟工装，现场只读链路无法观察busy transition，继续作为非阻塞未实测边界，不影响C14闭合。

结论：C14所需真实drawer/scroll/focus/restore与长流分页可达证据已取得；没有发现明确功能缺陷。此处仍不代替Acceptance负责人作C3裁决，不改ownership、不commit。
