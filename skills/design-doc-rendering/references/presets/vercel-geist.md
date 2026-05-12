# Preset: Vercel Geist

> Source: `hermes-agent/popular-web-designs/templates/vercel.md` (MIT) → forked & adapted for design-doc-rendering.
> Removed: Hermes platform notes (`write_file` / `browser_vision`), Section 9 "Agent Prompt Guide", marketing-only components (hero gradient, trust bar, metric cards, workflow pipeline).
> Added: Map to Design Doc Components, 5 必有交互的视觉处理.

## Personality

工程师写给工程师看的极简主义：白底、近黑文字、shadow-as-border、紧致负字距——所有装饰都被剥到只剩结构，像一份被 minifier 压过的源代码。

## 何时选这个 preset

- **System-level Design Doc** / **Architecture RFC**：需要长篇代码、命令行、终端输出，要求读者能专注阅读不被花哨视觉打断
- **ADR (Architecture Decision Record)**：决策类档案，气质应当克制、可归档、不喧哗
- **CLI 工具 / infrastructure / dev-tools 类 doc**：受众是工程师，preset 本身的"开发者基础设施"气质天然契合
- **重构提案 / Migration plan**：内容密度高、代码块多，需要 shadow-as-border 的低视觉重量来托住大量 `<pre>`
- **不适合**：PRD（太冷）、给非技术 stakeholder 看的提案（缺乏色彩引导）

## 字体（含 CDN 与 fallback）

CDN：
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
```

CSS stacks（CDN 失败时 system 字体自动顶上）：
```css
--font-sans: 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
font-feature-settings: "liga" 1;  /* 所有 Geist 文本全局启用 ligatures */
/* 财务/统计数字段落可叠 "tnum" 1 */
```

## 视觉系统

### Visual Theme

Vercel 的视觉系统是一种 "minimalism as engineering principle"——白底（`#ffffff`）配 near-black 文字（`#171717`），每个元素都要为自己挣到那块像素。Geist 字体在 display 尺寸上用激进的负字距（-2.4px ~ -2.88px），把标题压得像被 minifier 处理过的代码。这套系统的招牌是 **shadow-as-border**：用 `box-shadow: 0px 0px 0px 1px rgba(0,0,0,0.08)` 代替传统 CSS border，让"边框"存活在阴影层，从而获得更柔的视觉重量与更顺的圆角过渡。Depth 来自分层阴影堆叠：一层做 border，一层做 elevation，一层做 ambient，再用 `#fafafa` 内圈做微微"自发光"。

**关键特征**：
- Geist Sans display 上极端负 letter-spacing (-2.4px ~ -2.88px)
- Geist Mono 全局开 `"liga"`
- Shadow-as-border 替代所有传统边框
- Multi-layer shadow stacks（border + elevation + ambient + 内圈高光）
- `#171717` 不是纯黑——保留一丝微暖

### Color Palette

**Primary**
- Vercel Black `#171717` — 主文字、标题
- Pure White `#ffffff` — 页背景、卡片表面
- True Black `#000000` — 仅 console/code 特定上下文

**Console / Code（用于代码块文字着色）**
- Console Blue `#0070f3`
- Console Purple `#7928ca`
- Console Pink `#eb367f`

**Interactive**
- Link Blue `#0072f5` — 主链接（带下划线）
- Focus Blue `hsla(212, 100%, 48%, 1)` — focus ring
- Ring Blue `rgba(147, 197, 253, 0.5)` — tailwind ring

**Neutral Scale**
- Gray 900 `#171717` — 主文字
- Gray 600 `#4d4d4d` — 次级文字
- Gray 500 `#666666` — 三级文字
- Gray 400 `#808080` — placeholder
- Gray 100 `#ebebeb` — 边框、分割线
- Gray 50 `#fafafa` — 微表面色，shadow 内圈

**Surface & Overlay**
- Badge Blue Bg `#ebf5ff` / Text `#0068d6` — pill badge

**Shadows**
- Border Shadow `rgba(0, 0, 0, 0.08) 0px 0px 0px 1px` — 招牌
- Subtle Elevation `rgba(0, 0, 0, 0.04) 0px 2px 2px`
- Card Stack `rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, rgba(0,0,0,0.04) 0px 8px 8px -8px, #fafafa 0px 0px 0px 1px`
- Ring Border `rgb(235, 235, 235) 0px 0px 0px 1px`

### Typography

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Display | 48px | 600 | 1.00–1.17 | -2.4px ~ -2.88px | 最大压缩 |
| Section H | 40px | 600 | 1.20 | -2.4px | |
| Sub-H Large | 32px | 600 | 1.25 | -1.28px | |
| Card Title | 24px | 600 | 1.33 | -0.96px | |
| Body Large | 20px | 400 | 1.80 | normal | 引言 |
| Body | 18px | 400 | 1.56 | normal | 标准正文 |
| Body Small | 16px | 400 | 1.50 | normal | UI 文本 |
| Body Semibold | 16px | 600 | 1.50 | -0.32px | 强调标签 |
| Button / Link | 14px | 500 | 1.43 | normal | |
| Caption | 12px | 400–500 | 1.33 | normal | |
| Mono Body | 16px | 400 | 1.50 | normal | 代码块 (Geist Mono) |
| Mono Small | 12px | 500 | 1.00 | normal | uppercase 技术标签 |

**Principles**：
- **Compression as identity**：display 上 -2.4px ~ -2.88px 是全行业最激进的负字距。字距随 size 递减放松：-1.28px@32px, -0.96px@24px, -0.32px@16px, normal@14px。
- **Ligatures everywhere**：所有 Geist 文本启用 `"liga"`。
- **三档字重严守**：400 (read) / 500 (interact) / 600 (announce)，禁用 700（除 micro badge）。

### Components

**Buttons**

Primary Dark：`bg=#171717` / `text=#ffffff` / `padding=8px 16px` / `radius=6px` — 主 CTA
Secondary White：`bg=#ffffff` / `text=#171717` / `padding=0px 6px` / `radius=6px` / `shadow=rgb(235,235,235) 0px 0px 0px 1px` — 次级
Pill Badge：`bg=#ebf5ff` / `text=#0068d6` / `padding=0px 10px` / `radius=9999px` / `font=12px/500` — 状态标签

**Cards**

- bg `#ffffff`, **no CSS border**, 用 shadow stack
- radius 8px (标准) / 12px (featured)
- shadow：`rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, #fafafa 0px 0px 0px 1px`
- hover：shadow 强度微增

**Inputs**

- 无传统 border，用 shadow-border
- focus：`2px solid hsla(212, 100%, 48%, 1)` outline + ring shadow

**Code Blocks**

- bg `#fafafa` 或 `#ffffff` + shadow-border
- radius 8px
- 字体 `Geist Mono` 16px / 400 / 1.50
- token 颜色用 Console Blue / Purple / Pink

**Navigation**

- 白色 sticky header
- Links：Geist 14px / 500 / `#171717`
- 底部 shadow-border `rgba(0,0,0,0.08) 0px 0px 0px 1px`

### Layout & Spacing

- Base unit 8px
- Scale：1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 32, 36, 40px（注意：16 → 32 之间留空，无 20/24）
- Max content width ≈ 1200px
- Section padding 80–120px+（"gallery emptiness"）
- 章节间分割：`border-bottom: 1px solid #171717` 或纯白空隙

**Radius scale**：2 (inline code) / 4 (small) / 6 (button) / 8 (card) / 12 (featured) / 9999 (pill badge)

### Shadows / Depth

| Level | Treatment |
|-------|-----------|
| Flat | 无 shadow |
| Ring | `rgba(0,0,0,0.08) 0px 0px 0px 1px` — shadow-as-border |
| Subtle Card | Ring + `rgba(0,0,0,0.04) 0px 2px 2px` |
| Full Card | Ring + Subtle + `rgba(0,0,0,0.04) 0px 8px 8px -8px` + 内圈 `#fafafa 0px 0px 0px 1px` |
| Focus | `2px solid hsla(212,100%,48%,1)` outline |

**核心哲学**：多层 shadow stack 里，每层都有职能——border 层（0 spread, 1px）、ambient（2px blur）、distance（8px + 负 spread）、inner glow（`#fafafa` 内圈）。这是为什么 Vercel 卡片看起来"被造出来"而不是"漂浮着"。

### Do's & Don'ts

**Do**
- 所有 display 用负 letter-spacing
- shadow-as-border 替代传统 border
- 全局 `"liga"`
- 三字重系统：400 / 500 / 600
- `#171717` 而非 `#000000`
- 多层 shadow stack 含内圈 `#fafafa`

**Don't**
- Geist Sans 不用正 letter-spacing
- 正文不上 weight 700
- 卡片不用传统 CSS border
- 不引入暖色（橙、黄、绿）到 chrome
- shadow opacity 不超过 0.1
- 主按钮不用 pill radius（9999px）

## Map to Design Doc Components

| Design Doc 组件 | 视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | `bg=#ffffff` / `shadow=rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, #fafafa 0px 0px 0px 1px` / `radius=8px` / `padding=20px 24px` / 字体 Geist 14px/500/`#171717` 标签 + 14px/400/`#4d4d4d` 值 |
| TOC sidebar (240px) | `bg=#ffffff` / 右侧分隔 `border-right: 1px solid #ebebeb` / link 默认 `color=#666666` 14px/400 / hover `color=#171717` / active `bg=#fafafa` + `color=#171717` 14px/600 + 左侧 `border-left: 2px solid #171717` |
| H1 文档标题 | Geist 40px / 600 / line-height 1.20 / letter-spacing `-2.4px` / `color=#171717` / 下方 32px 间距 |
| H2 章节 | Geist 32px / 600 / line-height 1.25 / letter-spacing `-1.28px` / `color=#171717` / 上 48px 下 16px / 下方加 `border-bottom: 1px solid #ebebeb` 分隔 |
| H3 子节 | Geist 24px / 600 / line-height 1.33 / letter-spacing `-0.96px` / `color=#171717` / 上 32px 下 12px |
| 正文 paragraph | Geist 18px / 400 / line-height 1.56 / `color=#171717` / `max-width: 72ch` / 段落间距 16px |
| 行内 `code` | `bg=#fafafa` / `color=#171717` / `padding=2px 6px` / `radius=4px` / Geist Mono 0.9em / 加 `box-shadow: 0px 0px 0px 1px rgba(0,0,0,0.08)` |
| 代码块 `<pre>` | `bg=#fafafa` / `shadow=rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px` / `radius=8px` / `padding=20px 24px` / Geist Mono 14px / 1.6 |
| 表格 | 无 border，整张表外加 shadow-border `rgba(0,0,0,0.08) 0px 0px 0px 1px` 套 `radius=8px` / `th: bg=#fafafa, color=#171717, font-weight=600, padding=12px 16px` / `td: padding=12px 16px, border-top=1px solid #ebebeb` / 行 hover `bg=#fafafa` |
| 引用块 `<blockquote>` | `border-left: 3px solid #171717` / `bg=#fafafa` / `padding=16px 20px` / `color=#4d4d4d` / 18px italic / `radius=0 6px 6px 0` |
| Mermaid / SVG 图 | 容器 `bg=#ffffff` + shadow-border `rgba(0,0,0,0.08) 0px 0px 0px 1px` / node fill `#fafafa` / node stroke `#171717` 1px / edge stroke `#666666` / 文字 Geist 14px/500 `#171717` |
| Status badge (draft) | `bg=#fafafa` / `color=#666666` / `border: 1px solid #ebebeb` / `radius=9999px` / `padding=2px 10px` / Geist Mono 12px/500 uppercase |
| Status badge (in-review) | `bg=#ebf5ff` / `color=#0068d6` / `radius=9999px` / `padding=2px 10px` / Geist Mono 12px/500 uppercase |
| Status badge (approved) | `bg=#171717` / `color=#ffffff` / `radius=9999px` / `padding=2px 10px` / Geist Mono 12px/500 uppercase |
| Review Log `<details>` | summary `bg=#ffffff` + shadow-border `rgba(0,0,0,0.08) 0px 0px 0px 1px` / `radius=8px` / `padding=12px 16px` / hover `bg=#fafafa` / 展开内容区 `bg=#fafafa` `padding=16px 20px` `radius=0 0 8px 8px` |
| Accent 强调（关键决策） | 文字加 `color=#0072f5` 不加粗；段落级 callout 用 `bg=#ebf5ff` + `color=#0068d6` + left `border: 3px solid #0068d6` + `radius=6px` + `padding=12px 16px` |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：
   - 默认 item：`color=#666666` / Geist 14px / 400
   - hover：`color=#171717`
   - active（IntersectionObserver 切换）：`bg=#fafafa` + `color=#171717` / weight 600 + 左侧 `border-left: 2px solid #171717` / 切换用 `transition: background-color 150ms ease, color 150ms ease`

2. **章节折叠**（H2 `<details>`）：
   - summary 箭头：用 `▸` 字符 `color=#666666`，展开旋转 90°
   - `transition: transform 180ms ease`
   - 展开 `<details[open]>` 时 summary 加 `border-bottom: 1px solid #ebebeb`

3. **暗黑模式**：**both**（light-first，提供 dark 切换）
   - Light：见上方 palette
   - Dark token：
     - bg `#0a0a0a` / surface `#171717` / surface-2 `#262626`
     - text-primary `#fafafa` / text-secondary `#a3a3a3` / text-tertiary `#737373`
     - border-shadow `rgba(255, 255, 255, 0.1) 0px 0px 0px 1px`
     - inner glow 改 `#262626 0px 0px 0px 1px`
     - link `#52a8ff` / focus `hsla(212, 100%, 60%, 1)`
   - 切换按钮放在 right-top fixed，圆形 `40x40` shadow-border，icon 用 ☀ / ☾

4. **代码高亮**：highlight.js 主题 **`vs`**（light）/ **`vs2015`**（dark）
   - 或自写 token 用 Console Blue `#0070f3`（keyword）/ Console Purple `#7928ca`（function）/ Console Pink `#eb367f`（string）/ `#4d4d4d`（comment）

5. **回到顶部按钮**：
   - 位置：`position: fixed; right: 32px; bottom: 32px;`
   - 尺寸：`40x40` / `radius=9999px` / `bg=#ffffff` / shadow stack 同 card
   - icon `↑` `color=#171717` 16px
   - hover：`bg=#fafafa` + shadow 强度微增
   - 显示条件：`scrollY > window.innerHeight`，淡入 `opacity 0→1 / transition 200ms ease`

## 极简反模式

- 不要把"developer infrastructure made invisible"那种自吹原话抄进 doc HTML
- 不要保留 Section 9 Agent Prompt Guide
- 不要在卡片上用传统 CSS border（违背招牌 shadow-as-border 系统）
- 不要为了"好看"给正文上彩色——色彩只在 link / focus / badge / accent callout 里出现
