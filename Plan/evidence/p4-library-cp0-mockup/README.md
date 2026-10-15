# P4 Library CP0 mockup — approved

- **Issue:** XinyiS7/ExoCore#61 · **Plan:** `Plan/V4_Phase_4_Library_Collection_Detailed_Plan.md` R6
- **Approved by:** Alicia, 2026-10-15 (“正是我想要的那个样子”, functions no objection; narrow expanded view “可以！”)
- **Source canvas:** https://claude.ai/artifact/TCvRUUWZweku8cCBHD97tN (private), version `1792093963-f8cb`
- **Drawn by:** 砚 / claude-opus-5-5

This folder is the frozen export of that canvas: `canvas.json` (board layout) plus one `.dc.html` source per board. The repo copy is authoritative for acceptance; the artifact URL is a convenience only.

| Board | File | Content |
|---|---|---|
| ① | `Main.dc.html` | Polaroid wall, wide: six filters (kind tabs, Tag chips, keyword, last 30 days, month, has-link), intersection note, 6-column grid, reason dot |
| ② | `WallNarrow.dc.html` | Polaroid wall, narrow: one card at a time, swipe plus prev/next buttons, bottom nav |
| ③ | `Expanded.dc.html` | Expanded view, wide: polaroid left; reason, description, Tags, source, per-viewer stats, comments right; bring back / edit / delete |
| ③b | `ExpandedNarrow.dc.html` | Expanded view, narrow: sticky top bar (back, kind/id, ⋯ edit/delete), whole page scrolls, bring-back button pinned to bottom |
| ④ | `MultiSelect.dc.html` | Multi-select for bring-back: ordered numbering, 5-item cap, dimmed rest, floating action bar (interactive) |
| ⑤ | `DeleteDialog.dc.html` | Delete confirm, frozen copy, default focus on Cancel |
| ⑥ | `Picker.dc.html` | G045 conversation picker (Prime default, recent first) and its empty state |
| ⑦ | `Composer.dc.html` | Composer pending cards: normal / rejected by `item_id` / disabled while editing |
| ⑧ | `MessageCards.dc.html` | Message-side cards: human card-only text card, human text + media cards, Agent text card, deleted-item notice |

Visual decisions taken with the approval: V4 dark tokens; polaroid paper `#ece8df`; card titles in LXGW WenKai; slight random tilt on polaroids; text cards capped at ~150px with internal scroll.
