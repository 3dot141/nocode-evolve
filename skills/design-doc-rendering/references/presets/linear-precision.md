# Preset: Linear Precision

> Source: `hermes-agent/popular-web-designs/linear.app.md` (MIT) → forked & adapted for design-doc-rendering.
> Removed: Hermes platform notes (write_file / browser_vision), Section 9 marketing prompt guide.
> Added: Map to Design Doc Components, 5 必有交互的视觉处理.

## Personality（一句话）

Dark-mode-native 精密工程美学——near-black 画布上，信息通过 white opacity 与极细 border 分层浮现，气质冷峻、严肃、克制。

## 何时选这个 preset

- **System-level Design Doc** / 架构 RFC：内容密度高、决策严肃、读者是 senior engineer
- **Refactor 提案 / 技术债清理方案**：需要"工程感"压住主观争议
- **Infra / CLI / Compiler / Runtime 类文档**：与产品自身气质（开发者工具）一致
- **ADR (Architecture Decision Record)**：决策记录天然适合 darkmode + 严谨字体
- ❌ 不适合：面向非技术 stakeholder 的 PRD（太冷）、社区 RFC 早期版本（太"权威"）

## 字体（含 CDN 与 fallback）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```css
:root {
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
body { font-feature-settings: "cv01", "ss03"; }
```

OpenType `"cv01", "ss03"` 必须全局打开——这是 Linear 字形识别度的核心，否则只是普通 Inter。Inter Variable weight 510（regular 400 与 medium 500 之间）是 Linear 的招牌权重；CDN Inter 不支持 510，用 **500 替代**即可。

## 视觉系统

### Visual Theme

Linear 是 dark-mode-first 产品设计的范本——near-black 画布（`#08090a`）上，内容如星光般从黑暗中浮现。整个系统是一套精密校准的 **luminance 阶梯**：从勉强可见的 border（`rgba(255,255,255,0.05)`）到柔和发光的文字（`#f7f8f8`）。这不是把 dark theme 套到 light design 上，而是把"黑"作为原生媒介——信息密度通过白色 opacity 的细微梯度管理，而不是色彩变化。

色彩系统几乎完全 achromatic（无彩色）：深背景 + 白/灰文字，只用一种品牌强调色——靛紫 `#5e6ad2` / `#7170ff`。Border 系统用极细半透明白边（`rgba(255,255,255,0.05)` → `0.08`），如月光下的线稿。

### Color Palette

**Background Surfaces**
- Marketing Black `#08090a`：最深背景（页面 body）
- Panel Dark `#0f1011`：sidebar / panel 背景
- Level 3 Surface `#191a1b`：cards / dropdowns
- Secondary Surface `#28282c`：hover / 最亮的 dark surface

**Text**
- Primary `#f7f8f8`（near-white，不是纯白，防眼疲劳）
- Secondary `#d0d6e0`（cool silver-gray，正文）
- Tertiary `#8a8f98`（muted，metadata）
- Quaternary `#62666d`（最弱，timestamp / disabled）

**Brand & Accent**
- Brand Indigo `#5e6ad2`（CTA 背景）
- Accent Violet `#7170ff`（链接 / active）
- Accent Hover `#828fff`

**Status**
- Success `#27a644` / `#10b981`
- Warning `#c37d0d`（借自 amber 系，补 Linear 未明确给出的 warning）
- Error `#d45656`

**Border**
- Subtle `rgba(255,255,255,0.05)`（默认）
- Standard `rgba(255,255,255,0.08)`（cards / inputs）
- Solid Primary `#23252a`

### Typography

| Role | Font | Size | Weight | Line | Letter-spacing |
|---|---|---|---|---|---|
| Display | Inter | 48px | 500 | 1.00 | -1.056px |
| H1 | Inter | 32px | 400 | 1.13 | -0.704px |
| H2 | Inter | 24px | 400 | 1.33 | -0.288px |
| H3 | Inter | 20px | 600 | 1.33 | -0.24px |
| Body Large | Inter | 18px | 400 | 1.60 | -0.165px |
| Body | Inter | 16px | 400 | 1.50 | normal |
| Body Medium | Inter | 16px | 500 | 1.50 | normal |
| Small | Inter | 15px | 400 | 1.60 | -0.165px |
| Caption | Inter | 13px | 400 | 1.50 | -0.13px |
| Label | Inter | 12px | 500 | 1.40 | normal |
| Mono Body | JetBrains Mono | 14px | 400 | 1.50 | normal |

**原则**：display 尺寸用负 letter-spacing 压缩；三档权重 400（read）/ 500（emphasize）/ 600（announce）；不用 700 bold。

### Components

**Ghost Button (Default)**：bg `rgba(255,255,255,0.02)`，text `#e2e4e7`，radius 6px，border `1px solid #24282c`
**Primary Brand Button**：bg `#5e6ad2`，text `#fff`，radius 6px，padding 8px 16px，hover → `#828fff`
**Pill / Tag**：transparent bg，text `#d0d6e0`，radius 9999px，border `1px solid #23252a`，12px weight 500

**Card / Container**：bg `rgba(255,255,255,0.02)`，border `1px solid rgba(255,255,255,0.08)`，radius 8px（标准）/ 12px（featured），永不实色背景。

**Input**：bg `rgba(255,255,255,0.02)`，text `#d0d6e0`，border `1px solid rgba(255,255,255,0.08)`，radius 6px，padding 12px 14px。

**Code block**：bg `rgba(255,255,255,0.02)`，border `1px solid rgba(255,255,255,0.08)`，radius 8px，padding 16px，JetBrains Mono 14px。

**Navigation**：sticky on `#0f1011`，links Inter 13px weight 500 `#d0d6e0`，active 提升到 `#f7f8f8`。

### Layout & Spacing

- Base unit 8px；scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Max content width ≈ 1100px（doc 比 marketing 窄一点）
- Section 间垂直 padding 64px+，dark background 本身就是分隔，不需要分割线

### Shadows / Depth

| Level | Treatment |
|---|---|
| Flat | `#08090a` bg，无 shadow |
| Surface | bg `rgba(255,255,255,0.02-0.05)` + border `rgba(255,255,255,0.08)` |
| Ring | `rgba(0,0,0,0.2) 0px 0px 0px 1px` |
| Elevated | `rgba(0,0,0,0.4) 0px 2px 4px` |
| Dialog | 多层 stack：`rgba(0,0,0,0.08) 0px 0px 1px, rgba(0,0,0,0.07) 0px 1px 1px, rgba(0,0,0,0.04) 0px 3px 2px, rgba(0,0,0,0.01) 0px 5px 2px` |

核心：dark surface 上 drop shadow 几乎看不见——用 **背景 luminance 阶梯**（white opacity 0.02 → 0.04 → 0.05）表达 elevation，不靠传统阴影。

### Do's & Don'ts

**Do**
- 全局开 `font-feature-settings: "cv01", "ss03"`
- weight 500 作为默认 emphasis 权重
- display 尺寸用负 letter-spacing
- border 用 semi-transparent 白色，不用 solid dark
- button 背景近乎透明（0.02–0.05 白色 opacity）
- primary 文字用 `#f7f8f8`，不要纯白

**Don't**
- 不要用纯白 `#ffffff` 作正文
- 不要用 solid color 填充 button 背景（brand indigo 除外）
- 不要把 indigo 用在装饰位（只用 CTA / link）
- 不要用 weight 700
- 不要在 dark surface 上用 drop shadow 表达 elevation

## Map to Design Doc Components

| Design Doc 组件 | 视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | bg `rgba(255,255,255,0.02)`，border `1px solid rgba(255,255,255,0.08)`，radius 12px，padding 20px 24px，label Inter 12px weight 500 `#8a8f98` 大写 tracking 0.5px，value Inter 14px weight 500 `#d0d6e0` |
| TOC sidebar（左 240px 固定） | bg `#0f1011`，right border `1px solid rgba(255,255,255,0.05)`，link Inter 13px weight 500 `#8a8f98`，hover `#d0d6e0`，**active text `#7170ff` + 左 2px border `#7170ff` + bg `rgba(113,112,255,0.08)`** |
| H1 文档标题 | Inter 32px weight 500，line-height 1.13，letter-spacing -0.704px，color `#f7f8f8`，bottom margin 32px |
| H2 章节 | Inter 24px weight 500，line-height 1.33，letter-spacing -0.288px，color `#f7f8f8`，top margin 56px / bottom 16px，可选下划线 `1px solid rgba(255,255,255,0.05)` |
| H3 子节 | Inter 20px weight 600，letter-spacing -0.24px，color `#f7f8f8`，top 32px / bottom 12px |
| 正文 paragraph | Inter 16px weight 400，line-height 1.65，color `#d0d6e0`，max-width 72ch |
| 行内 `code` | bg `rgba(255,255,255,0.06)`，text `#f7f8f8`，padding 2px 6px，radius 4px，JetBrains Mono 0.92em |
| 代码块 `<pre>` | bg `#0f1011`，border `1px solid rgba(255,255,255,0.08)`，radius 8px，padding 16px 20px，JetBrains Mono 14px line-height 1.55，可加 `rgba(0,0,0,0.2) 0px 0px 0px 1px` ring |
| 表格 | border `1px solid rgba(255,255,255,0.08)`，radius 8px overflow hidden；thead bg `rgba(255,255,255,0.04)`，文字 `#f7f8f8` weight 500 12px 大写 tracking 0.5px；tbody row hover bg `rgba(255,255,255,0.02)`；cell border-bottom `1px solid rgba(255,255,255,0.05)` |
| 引用块 `<blockquote>` | bg `rgba(94,106,210,0.06)`，left border `2px solid #5e6ad2`，padding 12px 20px，radius 0 6px 6px 0，文字 `#d0d6e0` |
| Mermaid / SVG 图 | 容器 bg `rgba(255,255,255,0.02)`，border `1px solid rgba(255,255,255,0.08)`，radius 8px，padding 24px；node fill `#191a1b`，stroke `#3e3e44`，arrow `#7170ff`，文字 `#d0d6e0` |
| Status badge | draft → bg `rgba(138,143,152,0.15)` text `#8a8f98`；in-review → bg `rgba(195,125,13,0.15)` text `#e5a55c`；approved → bg `rgba(16,185,129,0.15)` text `#34d399`；deprecated → bg `rgba(212,86,86,0.15)` text `#e58787`。统一 radius 9999px，padding 2px 10px，Inter 11px weight 500 大写 tracking 0.5px |
| Review Log `<details>` | summary bg `rgba(255,255,255,0.03)`，hover `rgba(255,255,255,0.05)`，padding 12px 16px，radius 6px，文字 `#d0d6e0` 14px weight 500；展开后内容 bg `rgba(255,255,255,0.01)`，left border `1px solid rgba(255,255,255,0.05)`，padding 16px 20px |
| Accent 强调（关键决策） | 文字内联用 `#7170ff` weight 500；整段警告用 `rgba(195,125,13,0.08)` bg + left `2px solid #c37d0d` |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：active item text `#7170ff` + bg `rgba(113,112,255,0.08)` + 左 2px border `#7170ff`；hover text 从 `#8a8f98` → `#d0d6e0` 配 `rgba(255,255,255,0.03)` bg；IntersectionObserver rootMargin `-20% 0px -70% 0px` 切换 active。

2. **章节折叠**（H2 `<details>`）：summary `cursor:pointer`，前置 ▸ 三角 color `#62666d`，open 时旋转 90° 变 `#7170ff`；transition `transform 180ms ease, color 150ms ease`；content fade-in 180ms。

3. **暗黑模式 toggle**：本 preset 是 **dark-only**——这是 Linear 的核心人格。toggle button 仍保留，但点击时在 dark / 略亮 dark（bg `#0f1011` → `#1a1b1d`）间切换作为"reading mode"。理由：light mode 会摧毁 luminance 阶梯系统，与 brand 冲突；强行 invert 会得到劣化的 Mintlify。

4. **代码高亮**：highlight.js 用 **`atom-one-dark`** 或 **`tokyo-night-dark`**；override 关键 token：keyword `#7170ff`，string `#10b981`，comment `#62666d` italic，function `#d0d6e0`，bg 强制 `#0f1011` 对齐代码块外框。

5. **回到顶部**：固定 right 24px / bottom 24px，circle 40px，bg `rgba(255,255,255,0.05)`，border `1px solid rgba(255,255,255,0.08)`，icon (↑) `#d0d6e0`；hover bg `rgba(113,112,255,0.15)` icon `#7170ff`；shadow `rgba(0,0,0,0.4) 0px 2px 8px`；`scrollY > viewport` 时 opacity 0→1 过渡 200ms。

## 极简反模式

- ❌ 不要保留 source "visual thesis / masterclass / starlight" 之类自吹文案
- ❌ 不要保留 source Section 9 "Agent Prompt Guide" 的任何 example prompt
- ❌ Map 表格里禁止出现"主色 / 次要色 / 强调色"这种抽象词——必须落到 hex
- ❌ 不要给 light mode 配色板——本 preset 是 dark-only
- ❌ 不要把 brand indigo 当装饰色铺满 H2 标题——只用在 active / accent / CTA
