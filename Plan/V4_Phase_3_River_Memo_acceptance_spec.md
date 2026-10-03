# V4 P3 River & Memo — Frozen Behavior Acceptance Input

> 状态：行为输入冻结；不是验收PASS，不授权越过KF-07准备门。
> 所有者：Solaire。Builder只读；具体独立验收工装由Alicia指定责任方另行实现，不内嵌测试代码。
> 范围依据：Master Roadmap §9、ReactSheet §3.11–3.13、获批D1–D5/Heartbeat全文、`V4_Phase_3_River_Memo_Detailed_Plan.md`中的已批准技术映射。
> Alicia已将代码施工指派pane7；当前release CP0诊断，不release生产代码。G-DELETE/G-DEFER/G-FORM已批准；KF-07仍无闭合证据。

## 1. 判定与证据边界

- C3只在以下行为满足、KF-07闭合、相关前端自动化与最终exo-app回归通过、获批桌面/小屏呈现经确认后才可PASS。
- 环境/历史阻塞单独记录，不假称实现FAIL/PASS；Builder不得替验收方判定C3。
- 不重验LR-01/C2/B2，不将B2三个既有migration replay问题纳入本期修复。
- 本文是唯一行为验收输入；Detailed Plan的V表仅为覆盖索引。发现冲突先报告，不改写冻结输入或选择有利断言。

## 2. 外部可观察行为

### A. 五源主轴与读取状态

1. `/app/river`具备Memo/Heartbeat/Diary/Task/legacy milestone-moment标识；展示沿后端排序，复合identity不把同任务created/completed折叠。
2. 主轴仅消费River聚合接口；opaque cursor完整编码回传、末页停止；重复加载操作不产生并发续页；切换筛选或刷新从首页重新遍历。
3. preset过滤不声称Memo/Task成为Agent专属；G1已翻过区间新增需刷新，不承诺历史快照。
4. 首次加载、空流、首次失败、续页失败、末页可辨。503不伪装四源完整页；续页失败保留已成功页并说明未完成；无前端merge/静默剔除来源降级。
5. malformed_cursor可重新刷新；来源动作认证/权限/404错误显式处理，无假成功。

### B. Memo与Tags

6. 无标题/目录即可创建，正文Markdown展示；无正文编辑、删除、附件假入口；`#task/#todo`不产生ScheduleEntry。
7. 根与回复composer预览Tags，语法按Detailed Plan CP2：边界/字符集、去前导#、精确去重、Unicode codepoints≤50，长tag显式校验；正文原样保留。
8. POST正文与PATCH Tags分步；POST成功后不再POST同次正文。PATCH失败显示“记录已保存，标签未保存”，独立重试正确memoId；新草稿不覆盖旧重试目标，手动Tags更新不被旧待重试上下文覆盖。
9. POST失败保留草稿且不自动重试；保存结果不确定（网络/响应丢失、5xx、无法确认新id的异常成功响应）显示核对提示，不宣称普通手动重试保证不重复。
10. Accordion只在卡片内部呈现完整后代；parentId绑定真实回复对象，任意深度关系保留，小屏浅缩进+彩线+@Target可辨。
11. 卡片reply_count仅是root直接子回复数，来自River投影或已载thread直接parent计数，不从MemoSerializer期待该字段；回复不进入全局主轴或移动root事件时间。
12. Tags可独立替换/清除，失败有明确状态；无全局Tag自动归一/合并能力。

### C. 长文阅读与Heartbeat追溯

13. Diary通过target preset/day读取canonical全文；canonical day与03:00排序锚点说明清晰，不显示未经证实的真实归档时间。
14. Diary/Heartbeat桌面580px阅读Drawer，小屏全屏；独立滚动、关闭回原流位置/焦点，键盘操作不穿透背景，明暗主题可读。
15. Heartbeat主轴为280字符级preview，主操作阅读全文；读取现有detail.content完整最终总结，非preview扩充/重新生成摘要；技术seed/tool/error不进入生活流正文，Ledger仅辅助入口。
16. 未读全文无假字数；读取错误不拿preview冒充全文；只读请求不ack/消费/唤醒Agent。
17. Ledger辅助深链定位真实preset/session，刷新保定位，无效UUID/404显式处理，不硬编码preset1。

### D. Tasks与Calendar

18. KF-07存在独立诊断证据并闭合；诊断或必要修复不夹带进River迁移，真实库无探针写入。
19. todo/periodic/goal字段CRUD、entry_type不可改及readonly字段保护符合来源契约；Shelf“新建待办”默认为todo且传title/entry_type/start_date。
20. Shelf按来源pinned/date顺序、计数/空状态正确；首屏约3–5卡，可横向浏览；主轴筛选不隐去全局Shelf，无客户端urgency重排。
21. todo快捷延期PATCH due_date；periodic/goal进入原生日期编辑并解释周期基准/cycle滚动影响，不用无效due_date伪延期。
22. complete/suspend/resume/archive走真实来源动作；todo完成归档，periodic/goal不一律移除或标终结；完成记录GET `/api/tasks/completions/?entry=<id>`为裸数组。
23. 创建/完成/日期或字段变更后来源详情/list/completions、Shelf、River一致刷新；新事件重新首页遍历，原created事件不改发生时间。
24. 无虚构priority字段；is_pinned沿来源协议；GCal单向push/unlink错误可见，PATCH200不保证远端更新成功，不宣称双向同步。
25. Calendar与新建入口仅在Shelf头部，主题句不挂业务按钮。月份/选日清单消费真实快照，exo事件定位同一Task详情，纯GCal事件不伪装成可编辑Task。
26. Calendar显示fetched_at/window_start/window_end；未覆盖≠空，503≠空；不新增Heartbeat/Diary假日历事件；goal未入快照与periodic仅下次单日限制清晰。
27. 任务本地来源操作可刷新，但后台快照未重建时不伪报即时同步；query refetch不宣称触发后台job。不扩展历史回溯/date-range接口或RRULE。

### E. Legacy、导航与回撤

28. Legacy详情/编辑限milestone/moment，PATCH保留身份；event_time变化重启遍历。highlight/bookmark仍V3-owned，无隐式promotion。
29. Legacy DELETE为永久删除，二次确认明确不可恢复，无“软归档”文案；取消不请求，确认成功再刷新，失败不得伪移除。ScheduleEntry archive与此语义不混用。
30. River入口按获批施工阶段暴露；不改变Chat/Groups/Library状态、根站点跳转或删除V3兼容入口。C3 FAIL可撤V4 River入口，canonical新Memo/Task数据保持可读，不删数据。

## 3. 最终交付证据

- 每条覆盖能落到实际用户交互/请求/状态或测试目标，不用笼统“全绿”代替行为证据。
- 相关CP自动化及最终exo-app全量测试、typecheck/lint/build提供exit code、范围、数量、决定性失败摘录（如有）；机械动作由test-runner执行。
- 真机/视觉确认由Alicia及其指定验收方给出；Builder不改此spec、不改验收工装/报告、不自行生成验收结论。

**署名：** gpt / Solaire — 2026-10-02
**批准输入：** Alicia；交互贡献 Gemini / Alaric；事实纠错 deepseek/deepseek-flash / pruning reviewer。
