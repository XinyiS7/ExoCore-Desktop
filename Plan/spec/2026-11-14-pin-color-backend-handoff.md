# Spec Handoff：`<pin color="...">` 预设色系扩展契约（ExoCore Backend）

> **来源**：前端需求 [REQ_20261114_Composer_Toy_Drawer_Dice_Tray_and_Timer_UI.md](../需求/REQ_20261114_Composer_Toy_Drawer_Dice_Tray_and_Timer_UI.md)  
> **目标实施仓**：`ExoCore`（`inline_tags` 模块）  
> **兼容性**：**完全向后兼容、非阻塞**。前端对缺失或未知的 `color` 字段统一回退至 `"butter"`，因此前后端可独立分步合入。

---

## 1. 语义预设白名单

为避免直接暴露任意 HEX 色值破坏暗色/亮色对比度，`<pin>` 的 `color` 属性采用固定语义预设词（Preset Slug）：

- 允许值：`("butter", "mint", "blush", "sky", "lavender", "crimson")`
- 默认值：`"butter"`（沿用现版鹅黄便利贴样式）
- **适用范围**：User 与 Assistant 双向可用（如 `<pin color="crimson">乖乖喝汤</pin>`）。

---

## 2. 后端改动清单（`ExoCore/inline_tags`）

1. **`models.py` (`ConversationPin`)**：
   - 新增字段 `color = models.CharField(max_length=16, default="butter", blank=True)`（附独立小迁移，注意与其余迁移隔离开）。
2. **`parser.py` (`_head`)**：
   - `name == "pin"` 且 `value is None` 时，读取 `attrs.get("color")`。
   - 若命中预设白名单则存入 `params = {"color": color}`；未传或不在白名单中时，依然接受该 `<pin>` 标签并将 `color` 置为 `"butter"`（绝不因未知 color 丢弃便签本身）。
3. **`effects.py` (`_apply_pin_tag`)**：
   - `ConversationPin.objects.get_or_create` 的 `defaults` 中写入 `"color": tag.params.get("color") or "butter"`。
4. **`serializers.py` (`pin_payload`)**：
   - 返回体追加 `"color": pin.color or "butter"`，随 `Conversation.inline_state.pins` 输出。
5. **Ephemera 注入（可选）**：
   - 保持对模型注入的简洁，颜色主要用于前端视觉展示，Ephemera 提示中可不传或仅作轻量标注。
