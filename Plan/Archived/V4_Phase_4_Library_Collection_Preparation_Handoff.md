# V4 Phase 4 — Library Shell + Collection 准备交接

> **文档性质：** 下一阶段准备交接。
> **当前状态：** P3/C3 已通过；P4 尚未获得施工授权。
> **重要说明：** 本文不是 B1 后端 Plan，不是 P4 Detailed Plan，也不是验收通过声明。

---

## 1. 当前定位

- P3 River & Memo 已完成，C3 FINAL PASS。
- Desktop 当前稳定基线：`main@36c3e64`。
- 下一正式前端阶段是 **P4：Library Shell + Collection**。
- 正在施工的 AGY 图片桥属于 ExoCore + Runtime 的独立工作流：
  - 不阻塞 B1/P4；
  - 不并入 Collection 施工；
  - P4 不重复建设聊天附件摄取或发布链路。

P4 的目标是首次建立 canonical Library 容器，并交付长期收藏能力。P5 Memory 只复用这个 Library Shell，不得另建第二套容器。

权威入口：

- `Plan/V4_Master_Implementation_Roadmap.md`
- `Plan/V4_Spec_Freeze_Index.md`
- `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`
- `Plan/V4_River_Collection_Memory_Interaction_Spec.md`
- `Plan/V4_Page_Skeleton.md`

---

## 2. 当前门状态

| 门 | 状态 | 说明 |
|---|---|---|
| C3 | **PASS / closed** | 见 `Plan/V4_Phase_3_River_Memo_acceptance_report.md` |
| B1 后端基建 | **未开始** | 当前只有 requirement brief，无实现、无独立验收 |
| Library / Collection mockup | **未批准** | Collection Browser 与 Item Detail 仍需 UI 定稿 |
| P4 Detailed Plan | **HOLD** | 必须等待 B1 PASS、mockup approved 以及 Alicia 明确授权 |
| P4 前端施工 | **未授权** | 不得提前启用 Library 入口或写生产实现 |

B1 是 P4 Detailed Plan 的硬门。现有契约入口为：

`Plan/spec/2026-09-02-v4-b1-collection-storage-attachment-provenance-handoff.md`

后续工位应直接消费这份 brief，不另造一份互相竞争的 B1 契约。

---

## 3. 推荐顺序与工位拆分

### 可立即并行开展

1. **ExoCore 仓：B1 后端规划、施工与独立验收**
2. **UI mockup：Library Shell、Collection Browser、Item Detail**

两者可以并行：B1 不等待视觉稿，视觉稿也不依赖 B1 实现。

### 后续放行顺序

```text
B1 实现并独立验收 PASS
+ 两仓 ReactSheet 契约同步
+ Library / Collection mockup 获 Alicia 批准
+ Alicia 明确授权下一阶段
        ↓
Desktop Planner 编制：
Plan/V4_Phase_4_Library_Collection_Detailed_Plan.md
        ↓
Acceptance 冻结对应 acceptance spec
        ↓
Builder 才可开始 P4 生产施工
```

不得把后端 B1 与前端 P4 塞进同一张施工单，也不得在 B1 尚未闭合时凭 brief 猜测前端 API。

---

## 4. B1 后端工位入口

### Start Here

1. `Plan/spec/2026-09-02-v4-b1-collection-storage-attachment-provenance-handoff.md`
2. `Plan/V4_Master_Implementation_Roadmap.md` 中 P4、B1 与 release rule
3. `Plan/V4_Spec_Freeze_Index.md` 中 Collection 冻结语义
4. `Plan/V4_River_Collection_Memory_Interaction_Spec.md` 中 Collection 部分
5. `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`
6. ExoCore 当前附件、memory、serializer 与权限实现

### B1 必须回传的结果

- ExoCore 仓内正式 B1 backend Plan；
- 对应独立 acceptance spec；
- 后端实现、migration 与测试；
- B1 brief 中二元验收目标的独立验收报告；
- 现有 V3 SessionAttachment / audio 行为未回归的证据；
- `ExoCore/ReactSheet.md` 与 `ExoCore-Desktop/ReactSheet.md` 的 accepted contract 同步；
- 对 brief 与届时真实源码发生漂移之处的明确记录。

B1 PASS 只代表后端契约可供 P4 使用，不自动转移前端 ownership，也不自动授权 P4 施工。

---

## 5. P4 预定范围

P4 负责：

- Library container 与 canonical routes；
- Collection managed originals；
- `StoredAsset` 与 `CollectionItem` 分离；
- text / image / audio / document 四类浏览；
- 类型化 representations：图片 preview、音频 transcript、文档 extracted text / summary；
- provenance 与来源追溯；
- 新 bookmark writes 进入 Collection；
- Collection 搜索目标身份与按 Agent type 的授权边界；
- 收藏内容带回聊天的路径。

当前导航中 Library 槽位已经预留为 disabled。P4 放行后的入口工作应复用该槽位并翻为 enabled，不得重造第二套导航或 App Shell。

`StoredAsset` 表示文件原件与物理生命周期；`CollectionItem` 表示一次收藏行为及其情境、描述、Tags 与来源。相同字节可以复用 Asset，但不得合并掉多个收藏 occurrence 的语境。

---

## 6. 明确排除

P4 不包含：

- P5 Memory Library、Plasmid、History exact lookup；
- P6 Recall Receipt / feedback；
- P2G Groups；
- P7 product-root 切换；
- P8 V3 retirement；
- `memory_search` 接线；
- embedding 或多模态同空间索引升级；
- legacy 附件批量迁移；
- 未单独核验的数据格式提升；
- 图片主观点评自动生成；
- 第二套 Library Shell；
- AGY 图片桥施工。

旧 `chronicle_highlight` 在 C4 前继续保持 V3-primary。它只是未来 promotion candidate：P4 不批量迁移、不破坏性转换旧数据；P4 只接管新的 bookmark 写入语义。

---

## 7. C4 退出与回滚原则

C4 至少要求：

- text / image / audio / document 四类可稳定浏览；
- 原件与派生材料在契约及 UI 上可区分；
- preview 不覆盖 managed original；
- transcript / extraction 的 pending、failed、unavailable 状态可见；
- 多个 CollectionItem 可以安全引用同一 StoredAsset；
- 删除 Item 不误删仍被引用的 Asset；
- Library Shell 成为 canonical owner；
- 收藏内容能够带回聊天；
- 权限、loading、empty、error 与 retry 状态完整；
- desktop/mobile 使用同一业务实现。

若 C4 失败：

- 停用新的收藏入口；
- 保留已成功写入且可审计的数据；
- 不批量删除 Item / Asset；
- 不做破坏性数据库回退；
- 优先 forward-fix，确保当前 V3 consumer 继续工作。

---

## 8. 可直接复制：ExoCore B1 新工位交接

```text
【ExoCore 仓 · B1 Collection 后端工位】

背景：V4 P3/C3 已 FINAL PASS。下一前端阶段是 P4 Library Shell + Collection；B1 是 P4 Detailed Plan 的后端硬门。当前 B1 只有 requirement brief，无实现、无验收。

主契约：
../ExoCore-Desktop/Plan/spec/2026-09-02-v4-b1-collection-storage-attachment-provenance-handoff.md

请先依据当前源码编制 ExoCore 仓内正式 B1 Plan；不要改 Desktop，不要重写或扩张既有 brief 的产品语义。计划批准后再施工。

交付要求：
1. B1 backend Plan 与独立 acceptance spec；
2. 实现、additive migration 与测试；
3. brief 二元目标全部 PASS 的独立验收报告；
4. V3 SessionAttachment/audio 回归不变；
5. 两仓 ReactSheet accepted contract 同步；
6. source drift 与最终接口/错误语义记录清楚。

非目标：不写 React；不接 memory_search；不升级 embedding；不批迁 legacy 附件；不做 UI 决策；不混入正在施工的 AGY 图片桥。

注意：B1 PASS 不等于 P4 前端施工授权。完成后将验收产物交回 Desktop P4 准备链。
```

---

## 9. Deferred：未来 Desktop P4 Planner 交接

```text
【HOLD：以下工位目前不得启动】

启动条件：
- B1 已独立验收 PASS；
- 两仓 ReactSheet 已同步；
- Library / Collection mockup 已获 Alicia 批准；
- Alicia 明确授权起草 P4 Detailed Plan。

满足后，Desktop Planner 编制：
Plan/V4_Phase_4_Library_Collection_Detailed_Plan.md

计划只覆盖 Library Shell + Collection + 新 bookmark writes；不得混入 P5/P6/P2G/P7/P8，不得预写生产代码，不得建立第二套 shell。完成后交 Acceptance 冻结对应验收规格，再由 Alicia 放行 Builder。
```

---

## 10. 禁止误读

本文件：

- **不是 B1 Plan**；
- **不是 P4 Detailed Plan**；
- **不是 B1 或 C4 验收通过**；
- **不是 P4 施工授权**；
- **不转移任何 capability ownership**；
- **不改变图片桥的独立施工状态**。

若本文与 Roadmap、Freeze Index、B1 brief 或 Alicia 的最新决定冲突，以后者为准。
