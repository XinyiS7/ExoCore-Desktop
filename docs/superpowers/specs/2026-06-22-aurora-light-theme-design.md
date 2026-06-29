# Aurora 浅色主题适配 + 调色板管理优化

## 背景

ExoCore 现已实现全局浅色/深色主题切换（`data-theme` 属性驱动，CSS 变量覆盖）。
Aurora 呼吸背景是独立的调色板系统（`palettes.js` + `AuroraBackground.css`），
当前只有深色系预设（6 个），不参与主题切换，且预设过多不便翻找。

另外发现两个体验问题需要一并解决：
1. **自定义调色板不可编辑** — 只能删了重建，无法修改名称或颜色
2. **预设模板过多** — 6 个深色预设太长，用户主要用自定义，预设只需作为起点

## 设计决策

| 决策点 | 选择 |
|--------|------|
| Aurora 方向 | 换浅色系调色板（非隐藏/减弱） |
| 浅色视觉概念 | 晨光金雾 — 暖金色主导，琥珀/蜂蜜辅助，柔和桃色点缀 |
| Aurora 切换机制 | 自动跟随 `data-theme`，用户无需手动操作 |
| 调色板可见性 | 按主题过滤：深色模式显示深色预设，浅色模式显示浅色预设 |
| Vignette | 极淡暖色辉光，从中心向外扩散 |
| 预设数量 | 深色 3 个 + 浅色 3 个，精简够用 |
| 自定义编辑 | 支持原地更新名称和颜色，不再需要删了重建 |

## 预设精简

### 深色预设（保留 3 个，移除 3 个）

| 保留 | 移除 |
|------|------|
| Burning Sunset（默认，暖红/火） | ~~Emerald Haze~~（绿色，使用率低） |
| Deep Ocean（冷蓝/海洋） | ~~Arctic Frost~~（蓝白，与 Deep Ocean 接近） |
| Void Amethyst（紫罗兰） | ~~Neon Noir~~（霓虹，过于花哨） |

保留的三款覆盖了暖色/冷色/紫色的基本需求，其余交给自定义。

### 浅色预设（新增 3 个）

| ID | 名称 | 色调 |
|----|------|------|
| `morning-mist` | 晨光金雾 | 暖金色、蜂蜜、杏桃 |
| `spring-dew` | 春露 | 淡薄荷绿、嫩芽色、奶油白 |
| `peach-cloud` | 桃云 | 柔粉、浅珊瑚、暖杏 |

## 技术方案

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/chat-core/src/components/chat/palettes.js` | 精简预设 + 新增 3 个浅色预设 + 合并自定义/内置查找 + `updateCustomPalette` |
| `packages/chat-core/src/components/chat/AuroraBackground.jsx` | 引入 `useTheme()`，自动选择主题默认调色板 |
| `packages/chat-core/src/components/chat/AuroraBackground.css` | `[data-theme="light"]` 覆盖 blend mode / grain / vignette / opacity |
| `packages/chat-core/src/components/chat/ChatArea.jsx` | 默认 paletteId 逻辑适配，区分深色/浅色默认值 |
| `packages/chat-core/src/components/chat/ControlsDrawer.jsx` | 主题过滤 + 自定义编辑按钮 + 更新/另存为分离 |

### palettes.js — 预设重构

```js
// 深色预设（精简至 3 个）
const DARK_PRESETS = {
  'burning-sunset': {
    name: 'Burning Sunset',
    theme: 'dark',
    colors: { /* 不变 */ }
  },
  'deep-ocean': {
    name: 'Deep Ocean',
    theme: 'dark',
    colors: { /* 不变 */ }
  },
  'void-amethyst': {
    name: 'Void Amethyst',
    theme: 'dark',
    colors: { /* 不变 */ }
  },
};

// 浅色预设（新增 3 个）
const LIGHT_PRESETS = {
  'morning-mist': {
    name: '晨光金雾',
    theme: 'light',
    colors: {
      '--obsidian':   '#fef9f0',
      '--garnet-600': '#e8b86d',
      '--oxblood-400': '#f5d4a8',
      '--oxblood-500': '#f0c78e',
      '--rusty-500':  '#eeb86b',
      '--rusty-600':  '#f2a65a',
      '--orange-400': '#f7d6a0',
      '--orange-500': '#fbe5c0',
    }
  },
  'spring-dew': {
    name: '春露',
    theme: 'light',
    colors: {
      '--obsidian':   '#f8faf6',
      '--garnet-600': '#b8cc9e',
      '--oxblood-400': '#d4e4c4',
      '--oxblood-500': '#c5daaa',
      '--rusty-500':  '#a8c78a',
      '--rusty-600':  '#9bb878',
      '--orange-400': '#dcecc8',
      '--orange-500': '#eaf2de',
    }
  },
  'peach-cloud': {
    name: '桃云',
    theme: 'light',
    colors: {
      '--obsidian':   '#fef8f5',
      '--garnet-600': '#f0b8a8',
      '--oxblood-400': '#f8d4c8',
      '--oxblood-500': '#f4c4b4',
      '--rusty-500':  '#eea890',
      '--rusty-600':  '#e8987c',
      '--orange-400': '#fadcd0',
      '--orange-500': '#fceae2',
    }
  },
};

const ALL_PRESETS = { ...DARK_PRESETS, ...LIGHT_PRESETS };
```

### palettes.js — 新增 updateCustomPalette

```js
/**
 * 原地更新自定义调色板（名称和/或颜色）。
 * @param {string} id - palette id (custom-xxx)
 * @param {object} updates - { label?, colors? }
 * @returns {object|null} 更新后的 palette，id 不存在时返回 null
 */
export function updateCustomPalette(id, updates) {
  const list = getCustomPalettes();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return null;

  if (updates.label !== undefined) list[idx].label = updates.label;
  if (updates.colors !== undefined) list[idx].colors = { ...list[idx].colors, ...updates.colors };

  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return list[idx];
}
```

### AuroraBackground.jsx — 主题感知（不变）

### AuroraBackground.jsx — 主题感知

```jsx
import { useTheme } from 'exo-shared';

// 现有 props: active, paletteId, colors
// 新增逻辑：
const { theme } = useTheme();

// 如果未传入 paletteId 或传入的是默认值，自动选择主题默认
const themeDefaultPalette = theme === 'light' ? 'morning_mist' : 'burning_sunset';
const effectivePaletteId = paletteId || themeDefaultPalette;
```

- 当用户**未手动选择**调色板时：自动跟随主题切换
- 当用户**手动选择**了调色板时：覆盖自动选择（该选择跨主题记忆）
- `GroupchatRoom` 不传 `paletteId`，自动获得主题默认效果

### ChatArea.jsx — 默认值适配

```jsx
import { useTheme } from 'exo-shared';

const { theme } = useTheme();

const getThemeDefault = (t) => {
  return t === 'light' ? 'morning_mist' : 'burning_sunset';
};

// 初始化：从 localStorage 读取，但需验证是否匹配当前主题
const [paletteId, setPaletteId] = useState(() => {
  const stored = activeSessionId
    ? localStorage.getItem(`exo_session_theme_${activeSessionId}`)
    : null;
  // 验证存储的调色板是否兼容当前主题
  if (stored) {
    const preset = getPalette(stored);
    if (preset && (!preset.theme || preset.theme === theme)) {
      return stored; // 存储值兼容，保留用户选择
    }
  }
  return getThemeDefault(theme);
});
```

**关键**：初始化时验证存储的 paletteId 是否与当前 theme 兼容。
如果用户在深色下选了 Deep Ocean，切到浅色后 Deep Ocean 不兼容（`theme: 'dark'`），
自动回退到 `morning_mist`。切回深色时，Deep Ocean 仍然有效（从 localStorage 读取且兼容），恢复用户偏好。

此外，监听 `theme` 变化：当 `theme` 改变时，若当前 `paletteId` 的预设与新模式不兼容，
自动切换到新模式默认值（通过 `useEffect` 实现）。

### AuroraBackground.css — 浅色覆盖

通过 `[data-theme="light"]` 选择器微调，不修改现有深色规则：

```css
/* 浅色模式 — 混合模式改为 multiply（screen 在白底上不可见） */
[data-theme="light"] .aurora-ribbon {
  mix-blend-mode: multiply;
}

/* 浅色模式 — 降低噪点强度 */
[data-theme="light"] .aurora-grain {
  opacity: 0.018;
}

/* 浅色模式 — vignette 改为暖色辉光从中心扩散 */
[data-theme="light"] .aurora-vignette {
  background: radial-gradient(
    ellipse 62% 52% at 50% 38%,
    rgba(254, 249, 240, 0.25) 0%,
    rgba(254, 249, 240, 0.08) 50%,
    transparent 100%
  );
}

/* 浅色模式 — 降低动画整体 opacity 范围 */
[data-theme="light"] .aurora-stage.aurora-active {
  /* 飘带 keyframes 中的 opacity 峰值从 0.50 降到 0.32 */
  /* 通过 animation 层面的 filter 或直接覆盖 keyframes */
}

/* 非激活时的环境光晕适配 */
[data-theme="light"] .aurora-stage::after {
  background: radial-gradient(
    ellipse 65% 45% at 50% 42%,
    rgba(240, 199, 142, 0.06) 0%,
    transparent 70%
  );
}
```

**关于 keyframes 覆盖**：`@keyframes` 是全局的，无法嵌套在选择器内，
且同一 keyframe 名不能定义两次（后定义的会覆盖先定义的）。

**采用 CSS 变量方案**：在 keyframes 中的 opacity 值改用 CSS 变量，
通过 `[data-theme]` 切换变量值即可自动适配所有 7 组 keyframes：

```css
/* 深色默认 */
.aurora-stage {
  --aurora-opacity-min: 0.10;
  --aurora-opacity-max: 0.50;
}

/* 浅色覆盖 */
[data-theme="light"] .aurora-stage {
  --aurora-opacity-min: 0.06;
  --aurora-opacity-max: 0.32;
}
```

keyframes 内部引用变量：
```css
@keyframes aurora-drift-right {
  0%   { transform: translate(-20vw, 0) scale(1);       opacity: var(--aurora-opacity-min); }
  25%  { transform: translate(5vw, -8vh) scale(1.12);   opacity: var(--aurora-opacity-max); }
  ...
}
```

CSS 变量在 `@keyframes` 中的支持：Chrome 85+, Firefox 80+, Safari 14+（满足项目要求）。

### ControlsDrawer.jsx — 主题过滤 + 编辑功能

**预设过滤：**

```jsx
const { theme } = useTheme();

// 预设列表按当前主题过滤（深色 3 个 / 浅色 3 个）
const filteredPresets = Object.entries(ALL_PRESETS).filter(
  ([, p]) => p.theme === theme
);
```

- 深色模式显示：Burning Sunset、Deep Ocean、Void Amethyst（3 个）
- 浅色模式显示：晨光金雾、春露、桃云（3 个）
- 自定义调色板不参与过滤，始终可见

**编辑功能 —— 按钮逻辑：**

当前 `isDirty` 检测到颜色修改后，根据选中调色板的类型显示不同按钮：

| 选中类型 | isDirty | 显示按钮 |
|----------|---------|----------|
| 内置预设 | false | 无按钮 |
| 内置预设 | true | `+ 另存为新调色板` |
| 自定义 | false | 无按钮 |
| 自定义 | true | `↻ 更新` + `+ 另存为新调色板` |

```jsx
const isCustomSelected = paletteId?.startsWith('custom-');

// 更新按钮：原地保存到当前自定义调色板
const handleUpdate = () => {
  if (!isCustomSelected || !liveStops) return;
  updateCustomPalette(paletteId, {
    label: customName || currentPalette.label,  // 可选：允许同时改名
    colors: liveStops,
  });
  setCustomPalettes(getCustomPalettes());
  setIsDirty(false);
  onPaletteChange(paletteId); // 触发重新渲染
};

// 另存为按钮：保持现有 saveCustomPalette 逻辑不变
const handleSaveAsNew = () => {
  // ... 现有保存逻辑
};
```

**编辑时的交互细节：**
- 选中自定义调色板 + 修改颜色 → 显示 "更新" 和 "另存为" 两个按钮
- "更新" 覆盖当前调色板（原地编辑，ID 不变）
- "另存为" 创建新调色板（原调色板保留，不删除）
- 当自定义调色板数量已达上限（3 个），"另存为" 按钮禁用但 "更新" 仍可用
- 选中内置预设 + 修改颜色 → 只显示 "另存为" 按钮（内置不可编辑）
- 可选增强：编辑模式下允许同时修改调色板名称（在 name input 中预填当前名称）

### 主题切换时的状态迁移

- 每个预设标注 `theme` 标签（`'dark'` | `'light'`）
- 初始化时：读取 localStorage 存储的 paletteId → 检查其预设的 `theme` 是否与当前 `data-theme` 兼容 → 兼容则用，不兼容则回退主题默认
- 运行时切换主题：`useEffect` 监听 `theme` 变化 → 检查当前 `paletteId` 兼容性 → 不兼容则自动切入新模式默认
- 用户在 ControlsDrawer 中选择调色板 → 写入 localStorage（覆盖自动选择）
- 切换回之前的主题时，如果 localStorage 中仍保留着该主题下的选择，自动恢复

**无需拆分 localStorage key**——用预设的 `theme` 标签验证兼容性即可。

## 动画参数对比

| 参数 | 深色 Aurora | 浅色 Aurora |
|------|------------|------------|
| 飘带 opacity 范围 | 0.10 ~ 0.52 | 0.06 ~ 0.32 |
| mix-blend-mode | screen | multiply |
| vignette | 深色边缘渐暗 | 暖色辉光扩散 |
| grain opacity | 0.045 | 0.018 |
| ::after 环境光晕 | rgba(148,27,12,0.04) | rgba(240,199,142,0.06) |
| goo filter | blur(48px) contrast(1.2) | 不变 |

## 不变部分

- `AuroraBackground.jsx` 的 DOM 结构和 props 接口不变
- `palettes.js` 的 `computeStops` / `getPalette` / `saveCustomPalette` / `deleteCustomPalette` / 自定义存储逻辑不变
- CSS 飘带形状、动画时长、`animation-delay` 交错误差不变
- `GroupchatRoom.jsx` 无需修改（不传 paletteId，自动继承主题默认）
- `--obsidian` ~ `--orange-500` 变量名不变（CSS 仍引用这些变量，只是值变了）
- 自定义调色板 localStorage key `exo_custom_palettes` 不变
- 调色板数据形状不变（新增 `theme` 字段可选，自定义不设 `theme`）

## 验证

1. **深色模式回归**：切换深色 → 3 个深色预设可选，Burning Sunset 默认，动画/颜色/vignette 与改动前一致
2. **浅色 Aurora**：切换浅色 → 晨光金雾默认显示，飘带为暖金色调，在暖白背景上柔和可见
3. **浅色预设切换**：在 ControlsDrawer 中选择春露/桃云 → Aurora 立即切换，效果正确
4. **自动跟随**：Settings → Appearance 切换主题 → Aurora 自动切换对应主题的默认调色板
5. **ControlsDrawer 过滤**：深色下显示 3 个深色预设，浅色下显示 3 个浅色预设（+ 自定义）
6. **手动覆盖**：选择调色板 → Aurora 立即更新，该选择跨会话保留
7. **FOUC 防护**：切换主题时无闪烁（CSS 变量 + keyframes opacity 同步切换）
8. **GroupchatRoom**：始终显示当前主题默认的环境光晕，不触发动画
9. **自定义编辑 — 更新**：选中自定义调色板 → 修改 3 个关键点 → 点击"更新" → 原地保存，ID 不变，名称不变（除非手动修改）
10. **自定义编辑 — 另存为**：修改后点击"另存为" → 创建新的自定义调色板，原调色板保留
11. **内置不可编辑**：选中内置预设 → 修改颜色 → 只显示"另存为"按钮，无"更新"按钮
12. **编辑上限**：自定义已达 3 个时，"更新"仍可用，"另存为"禁用
13. **跨主题兼容**：深色下选 Deep Ocean → 切到浅色 → 自动回退 morning-mist → 切回深色 → 恢复 Deep Ocean
