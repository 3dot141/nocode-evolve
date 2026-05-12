# Preset: Stripe Purple

> Source: `hermes-agent/popular-web-designs/templates/stripe.md` (MIT) → forked & adapted for design-doc-rendering.
> Removed: Hermes platform notes (`write_file` / `browser_vision`), Section 9 "Agent Prompt Guide", marketing-only components (hero gradient decorations, ruby-magenta gradient blocks, trust bar).
> Added: Map to Design Doc Components, 5 必有交互的视觉处理.

## Personality

精致、专业、premium——金融级气质：深海军蓝标题、Stripe 紫作为唯一交互色、蓝色调阴影让 elevation 都自带品牌色。读起来像一份被 type foundry 重做过的金融机构白皮书。

**Primary mode: light**——Stripe 的视觉灵魂在白底 + 深海军蓝标题 `#061b31` + Stripe Purple `#533afd` 的对比上：blue-tinted shadow（`rgba(50,50,93,0.25)`）是品牌身份的核心元素，只在 light 模式中真正成立。dark mode 完整支持（强制提供），底色用深海军蓝 `#0d253d`、blueprint indigo `#1c1e54`，紫色 accent 提亮到 `#7c6bff` 以保持对比度，气质从"金融白皮书"切换到"夜间数据仪表盘"。

## 何时选这个 preset

- **PRD (Product Requirements Document)**：要展示给非工程 stakeholder（PM、设计、商务、高管），需要色彩引导和 premium 感
- **面向客户 / 外部的设计提案**：内容需要被"读得下去"且"看起来花了心思"
- **Cross-functional Design Doc**：跨团队协作文档，紫色 CTA 和分层 elevation 帮助层级感
- **API / SDK 公开设计 doc**：开发者也看商业方也看；代码块需要好看，数据表需要专业
- **Status 重要 / 流程化的文档**：badge 系统（成功绿、警告 lemon、purple in-review）能视觉化推动 review 流转
- **不适合**：纯内部 ADR、quick refactor proposal（太"正装"）、CLI 工具 doc（不如 vercel-geist 工程化）

## 字体（含 CDN 与 fallback）

CDN：
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600&family=Source+Code+Pro:wght@400;500;700&display=swap" rel="stylesheet">
```

CSS stacks（CDN 失败时 system 字体顶上；`sohne-var` 是 Stripe 私有字体，用 Source Sans 3 替代）：
```css
--font-sans: 'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
/* 数据表/数字列叠 "tnum" 1 */
```

> 注：原 Stripe 用 `sohne-var` + OpenType `"ss01"`，Source Sans 3 没有等价 stylistic set，因此本 preset 改用 weight 300 + 紧负字距来逼近"轻量级 luxury" feel。

## 视觉系统

### Visual Theme

Stripe 的视觉系统同时做到 technical 与 luxurious：白底 `#ffffff` + 深海军蓝标题 `#061b31` + 签名色 Stripe Purple `#533afd`——一种 confident、premium 的紫色，而非企业软件的冷紫。最具标志性的是头条字重——**weight 300 at display sizes**：当所有人都用 600-700 去 shout 时，Stripe 用 light 来表达 luxury，文字自信到无需重量。第二个招牌是 **blue-tinted shadows**——主阴影色 `rgba(50,50,93,0.25)` 是深蓝灰，让所有 elevation 都带品牌色，像悬浮在 twilight sky 里。

**关键特征**：
- Weight 300 是 display 标准字重——"lightness as luxury"
- Display 负字距：-1.4px@56px, -0.96px@48px, -0.64px@32px
- Blue-tinted multi-layer shadows: `rgba(50,50,93,0.25)` + `rgba(0,0,0,0.1)`
- 标题用 `#061b31` 深海军蓝，不用纯黑
- 保守 radius (4-8px)，绝不 pill / 大圆角
- 数据列上 `"tnum"`

### Color Palette

**Primary**
- Stripe Purple `#533afd` — 主品牌色、CTA、链接、active
- Deep Navy `#061b31` — 主标题（不是黑）
- Pure White `#ffffff` — 页背景、卡面

**Brand & Dark**
- Brand Dark `#1c1e54` — 深 indigo，dark 区块背景
- Dark Navy `#0d253d` — 最深 neutral

**Accent（仅用于装饰、不用于交互）**
- Ruby `#ea2261` — 图标、警示
- Magenta `#f96bee` — 渐变、装饰
- Magenta Light `#ffd7ef` — 染色表面

**Interactive**
- Primary Purple `#533afd`
- Purple Hover `#4434d4`
- Purple Deep `#2e2b8c`
- Purple Light `#b9b9f9`
- Purple Mid `#665efd`

**Neutral**
- Heading `#061b31`
- Label `#273951`
- Body `#64748d`
- Success Green `#15be53` / Success Text `#108c3d`
- Lemon `#9b6829` — warning / highlight

**Surface & Borders**
- Border Default `#e5edf5`
- Border Purple `#b9b9f9`
- Border Soft Purple `#d6d9fc`
- Border Magenta `#ffd7ef`
- Border Dashed Purple `#362baa`

**Shadow**
- Shadow Blue `rgba(50,50,93,0.25)` — 招牌
- Shadow Dark Blue `rgba(3,3,39,0.25)`
- Shadow Black `rgba(0,0,0,0.1)`
- Shadow Ambient `rgba(23,23,23,0.08)`
- Shadow Soft `rgba(23,23,23,0.06)`

### Light / Dark Token Pairs

**强制双 mode 支持**——首次加载按 `new Date().getHours()` 自动选 mode（6-19 点 light，否则 dark）。CSS 用 `:root`（light = primary）+ `[data-theme="dark"]`（dark = secondary fallback）切换。

| Token | Light (`:root`) | Dark (`[data-theme="dark"]`) |
|---|---|---|
| `--bg` | `#ffffff` | `#0d253d` |
| `--bg-panel` | `#ffffff` | `#0a1d33` |
| `--bg-surface` | `#f6f9fc` | `#1c1e54` |
| `--bg-hover` | `#f6f9fc` | `#27306b` |
| `--text-primary` | `#061b31` | `#e5edf5` |
| `--text-secondary` | `#273951` | `#b8c2d6` |
| `--text-tertiary` | `#64748d` | `#8590a8` |
| `--text-quat` | `#94a3b8` | `#6b7896` |
| `--brand` | `#533afd` | `#7c6bff` |
| `--accent` | `#533afd` | `#7c6bff` |
| `--accent-hover` | `#4434d4` | `#9c8fff` |
| `--border-subtle` | `#e5edf5` | `rgba(229,237,245,0.08)` |
| `--border-std` | `#e5edf5` | `rgba(229,237,245,0.12)` |
| `--border-strong` | `#b9b9f9` | `rgba(124,107,255,0.4)` |
| `--code-bg` | `#0d253d` | `#0d253d` |
| `--code-inline-bg` | `#f6f9fc` | `rgba(124,107,255,0.12)` |
| `--code-inline-text` | `#533afd` | `#9c8fff` |
| `--shadow-ambient` | `rgba(23,23,23,0.06) 0px 3px 6px` | `rgba(0,0,0,0.4) 0px 3px 6px` |
| `--shadow-elevated` | `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px` | `rgba(83,58,253,0.4) 0px 30px 45px -30px, rgba(0,0,0,0.5) 0px 18px 36px -18px` |
| `--focus-ring` | `#533afd` | `#7c6bff` |
| `--success-bg` | `rgba(21,190,83,0.2)` | `rgba(21,190,83,0.25)` |
| `--success-text` | `#108c3d` | `#34d39a` |

**Dark mode 关键校准**：
- bg 用 Stripe 自己的 Dark Navy `#0d253d`——这是原 palette 里的"最深 neutral"，恰好是 light mode 代码块底色，dark mode 复用形成 brand 自洽
- 面板/卡片层用 Brand Dark `#1c1e54`（原 palette 的"dark indigo 区块背景"）+ 更深的 `#27306b` 做 surface-2
- code block dark 下保持 `#0d253d`——与页面 bg 同色，仅靠 border `rgba(124,107,255,0.2)` 区隔（避免代码块在 dark 上"漂浮"）
- 紫色 accent 从 `#533afd` 提亮到 `#7c6bff`——保证 WCAG AA 对比度（≥4.5:1 on `#0d253d`）
- 招牌 blue-tinted shadow 在 dark 下变成 **purple-tinted**（`rgba(83,58,253,0.4)`）——紫味更浓，模拟"夜间品牌色发光"

### Typography

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Display Hero | 56px | 300 | 1.03 | -1.4px | whisper-weight authority |
| Display Large | 48px | 300 | 1.15 | -0.96px | |
| Section Heading | 32px | 300 | 1.10 | -0.64px | |
| Sub-H Large | 26px | 300 | 1.12 | -0.26px | |
| Sub-H | 22px | 300 | 1.10 | -0.22px | |
| Body Large | 18px | 300 | 1.40 | normal | 引言 |
| Body | 16px | 300–400 | 1.40 | normal | 标准正文 |
| Button | 16px | 400 | 1.00 | normal | |
| Link | 14px | 400 | 1.00 | normal | |
| Caption | 13px | 400 | normal | normal | |
| Caption Tabular | 12px | 300–400 | 1.33 | -0.36px | `"tnum"` 金融数字 |
| Code Body | 12px | 500 | 2.00 | normal | Source Code Pro |
| Code Bold | 12px | 700 | 2.00 | normal | keyword |

**Principles**：
- **Lightness as signature**：display weight 300，是 Stripe 最标志的反常规选择
- **Progressive tracking**：-1.4px@56, -0.96px@48, -0.64px@32, -0.26px@26, normal@16-
- **Two-weight simplicity**：300 (body + headings) / 400 (UI/button/nav/link)
- **`"tnum"` only for tables/numbers**

### Components

**Buttons**

Primary Purple：`bg=#533afd` / `text=#fff` / `padding=8px 16px` / `radius=4px` / 16px/400 / hover `bg=#4434d4`
Ghost Outlined：`bg=transparent` / `text=#533afd` / `border=1px solid #b9b9f9` / `radius=4px` / hover `bg=rgba(83,58,253,0.05)`
Neutral Ghost (disabled)：`bg=transparent` / `text=rgba(16,16,16,0.3)` / `outline=1px solid rgb(212,222,233)` / `radius=4px`

**Cards**

- `bg=#ffffff` / `border=1px solid #e5edf5` / `radius=6px`（标准）
- 标准 shadow：`rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px`
- ambient（hover hint）：`rgba(23,23,23,0.06) 0px 3px 6px`
- featured：radius 8px + Deep shadow

**Badges**

Neutral：`bg=#fff` / `text=#000` / `border=1px solid #f6f9fc` / `padding=0px 6px` / `radius=4px` / 11px/400
Success：`bg=rgba(21,190,83,0.2)` / `text=#108c3d` / `border=1px solid rgba(21,190,83,0.4)` / `padding=1px 6px` / `radius=4px` / 10px/300

**Inputs**

- `border=1px solid #e5edf5` / `radius=4px`
- focus：`border=1px solid #533afd` + purple ring
- label `color=#273951` 14px / text `color=#061b31` / placeholder `color=#64748d`

**Code Blocks**

- `bg=#0d253d`（深海军蓝）或 `bg=#f6f9fc`（浅）
- `radius=6px` / 标准 shadow
- `Source Code Pro` 12px/500/2.00 line-height（非常宽松）

**Navigation**

- 白色 sticky + `backdrop-filter: blur(12px)`
- Links：14px/400/`#061b31`
- Container `radius=6px`
- CTA Purple 右对齐

### Layout & Spacing

- Base unit 8px
- Scale 密集：1, 2, 4, 6, 8, 10, 11, 12, 14, 16, 18, 20px（小端密集，金融 UI 精度风格）
- Max content width ≈ 1080px
- 节奏：白色区块与 dark brand `#1c1e54` 区块交替

**Radius scale**：1 / 4 (workhorse) / 5 (card) / 6 (nav, larger interactive) / 8 (featured)。**禁用 12px+ 和 pill**。

### Shadows / Depth

| Level | Treatment |
|-------|-----------|
| Flat | 无 shadow |
| Ambient | `rgba(23,23,23,0.06) 0px 3px 6px` — hover hint |
| Standard | `rgba(23,23,23,0.08) 0px 15px 35px` — 内容面板 |
| Elevated | `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px` — 招牌卡片 |
| Deep | `rgba(3,3,39,0.25) 0px 14px 21px -14px, rgba(0,0,0,0.1) 0px 8px 17px -8px` — 模态、悬浮面板 |
| Focus | `2px solid #533afd` outline |

**核心哲学**：chromatic depth——主阴影色不是中性灰，而是 brand 化的蓝灰 `rgba(50,50,93,...)`。多层 stack 里，远层带品牌色，近层是 neutral 黑，形成 parallax 似的深度。

### Do's & Don'ts

**Do**
- 标题全部 weight 300
- 所有 elevated element 用 blue-tinted shadow `rgba(50,50,93,0.25)`
- 标题 `color=#061b31`（不是黑）
- radius 锁在 4-8px
- 数字/财务/数据用 `"tnum"`
- `#533afd` 紫只用于主交互/CTA/链接

**Don't**
- 标题不用 weight 600+
- 不用 12px+ radius 或 pill 形
- 不用中性灰阴影（必须加 blue tint）
- 不用纯黑做标题（用 `#061b31`）
- ruby/magenta 不用于按钮/链接（仅装饰）
- 不在 display 上用正字距

## Class Cheatsheet（drop-in CSS snippet）

> 借鉴 taste-skill：paste-ready 的最小骨架。Stripe 招牌：weight 300 标题 + blue-tinted shadow + Purple `#533afd`。

### CSS variables

```css
:root {
  --font-sans: 'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, monospace;
  --bg: #ffffff;             --bg-surface: #f6f9fc;
  --text-primary: #061b31;   --text-secondary: #273951;   --text-tertiary: #64748d;
  --brand: #533afd;          --accent: #533afd;           --accent-hover: #4434d4;
  --border-subtle: #e5edf5;  --border-std: #e5edf5;
  --code-bg: #0d253d;        --code-inline-bg: #f6f9fc;   --code-inline-text: #533afd;
  --shadow-elevated: rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px;
  --shadow-ambient: rgba(23,23,23,0.06) 0px 3px 6px;
}
[data-theme="dark"] {
  --bg: #0d253d;             --bg-surface: #1c1e54;
  --text-primary: #e5edf5;   --text-secondary: #b8c2d6;   --text-tertiary: #8590a8;
  --accent: #7c6bff;         --accent-hover: #9c8fff;
  --border-subtle: rgba(229,237,245,0.08);  --border-std: rgba(229,237,245,0.12);
  --code-bg: #0d253d;        --code-inline-bg: rgba(124,107,255,0.12);  --code-inline-text: #9c8fff;
  --shadow-elevated: rgba(83,58,253,0.4) 0px 30px 45px -30px, rgba(0,0,0,0.5) 0px 18px 36px -18px;
}
```

### Typography & body（招牌：weight 300 display）

```css
body { font: 400 16px/1.6 var(--font-sans); color: var(--text-secondary); background: var(--bg); }
h1 { font: 300 48px/1.15 var(--font-sans); letter-spacing: -0.96px; color: var(--text-primary); margin: 0 0 32px; }
h2 { font: 300 32px/1.10 var(--font-sans); letter-spacing: -0.64px; margin: 48px 0 16px;
     border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; }
h3 { font: 400 22px/1.10 var(--font-sans); letter-spacing: -0.22px; margin: 32px 0 12px; }
p  { max-width: 72ch; margin: 0 0 14px; }
code { font: 500 0.9em/inherit var(--font-mono); background: var(--code-inline-bg);
       color: var(--code-inline-text); padding: 2px 6px; border-radius: 4px;
       border: 1px solid var(--border-subtle); }
pre  { background: var(--code-bg); color: #e5edf5; padding: 20px 24px; border-radius: 6px;
       box-shadow: var(--shadow-elevated); font: 500 13px/1.7 var(--font-mono); overflow-x: auto; }
a { color: var(--accent); }
table { font-feature-settings: "tnum" 1; }
```

### 5 必有交互（核心 snippet）

```css
.toc a { color: var(--text-tertiary); font: 400 14px/1.5 var(--font-sans);
         padding: 6px 12px; display: block; border-left: 2px solid transparent;
         transition: 180ms ease; }
.toc a.active { color: var(--accent); background: rgba(83,58,253,0.05); border-left-color: var(--accent); }
.theme-toggle { position: fixed; top: 24px; right: 24px; width: 40px; height: 40px; border-radius: 9999px;
                background: var(--bg); box-shadow: rgba(50,50,93,0.25) 0px 6px 12px -6px;
                color: var(--accent); }
.back-to-top { position: fixed; right: 32px; bottom: 32px; width: 48px; height: 48px; border-radius: 8px;
               background: var(--accent); color: #fff;
               box-shadow: rgba(50,50,93,0.25) 0px 8px 16px -8px, rgba(0,0,0,0.1) 0px 4px 8px -4px;
               opacity: 0; transition: opacity 240ms ease; }
.back-to-top.visible { opacity: 1; }
```

### 本 preset 不可让步

- ❌ 标题用 weight ≥ 600（违背 weight-300 luxury 招牌）
- ❌ radius > 8px 或 pill 形（破坏保守气质）
- ❌ 中性灰 shadow（必须 `rgba(50,50,93,...)` 蓝调）
- ❌ ruby / magenta 用于按钮或链接（仅装饰）

## Map to Design Doc Components

| Design Doc 组件 | 视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | `bg=#ffffff` / `border=1px solid #e5edf5` / `radius=6px` / `padding=20px 24px` / shadow `rgba(23,23,23,0.06) 0px 3px 6px` / 字段 label 14px/400/`#273951` + 值 14px/400/`#061b31` |
| TOC sidebar (240px) | `bg=#ffffff` / `border-right: 1px solid #e5edf5` / link 默认 `color=#64748d` 14px/400 / hover `color=#061b31` / active `bg=rgba(83,58,253,0.05)` + `color=#533afd` weight 400 + 左侧 `border-left: 2px solid #533afd` |
| H1 文档标题 | Source Sans 3 48px / 300 / line-height 1.15 / letter-spacing `-0.96px` / `color=#061b31` / 下方 32px |
| H2 章节 | Source Sans 3 32px / 300 / line-height 1.10 / letter-spacing `-0.64px` / `color=#061b31` / 上 48px 下 16px / 下方加 `border-bottom: 1px solid #e5edf5` |
| H3 子节 | Source Sans 3 22px / 400 / line-height 1.10 / letter-spacing `-0.22px` / `color=#061b31` / 上 32px 下 12px |
| 正文 paragraph | Source Sans 3 16px / 400 / line-height 1.60 / `color=#273951` / `max-width: 72ch` / 段落间距 14px |
| 行内 `code` | `bg=#f6f9fc` / `color=#533afd` / `padding=2px 6px` / `radius=4px` / Source Code Pro 0.9em/500 / `border=1px solid #e5edf5` |
| 代码块 `<pre>` | `bg=#0d253d` / `color=#e5edf5` / `radius=6px` / `padding=20px 24px` / Source Code Pro 13px / 1.7 / shadow `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px` |
| 表格 | `border-collapse: separate` / 外层 `border: 1px solid #e5edf5` `radius=6px` / `th: bg=#f6f9fc, color=#061b31, font-weight=400, padding=12px 16px, border-bottom=1px solid #e5edf5` / `td: padding=12px 16px, border-top=1px solid #e5edf5, color=#273951` / 行 hover `bg=#f6f9fc` / 数字列加 `font-feature-settings: "tnum"` |
| 引用块 `<blockquote>` | `border-left: 3px solid #533afd` / `bg=rgba(83,58,253,0.04)` / `padding=16px 20px` / `color=#273951` / 16px / `radius=0 6px 6px 0` |
| Mermaid / SVG 图 | 容器 `bg=#ffffff` / `border=1px solid #e5edf5` / `radius=6px` / shadow `rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px` / node fill `#f6f9fc` / node stroke `#533afd` 1.5px / edge stroke `#64748d` 1px / 文字 14px/400 `#061b31` |
| Status badge (draft) | `bg=#f6f9fc` / `color=#64748d` / `border=1px solid #e5edf5` / `radius=4px` / `padding=2px 8px` / 12px/400 |
| Status badge (in-review) | `bg=rgba(83,58,253,0.1)` / `color=#533afd` / `border=1px solid #b9b9f9` / `radius=4px` / `padding=2px 8px` / 12px/400 |
| Status badge (approved) | `bg=rgba(21,190,83,0.2)` / `color=#108c3d` / `border=1px solid rgba(21,190,83,0.4)` / `radius=4px` / `padding=2px 8px` / 12px/400 |
| Review Log `<details>` | summary `bg=#ffffff` / `border=1px solid #e5edf5` / `radius=6px` / `padding=12px 16px` / hover `bg=#f6f9fc` / 展开后内容区 `bg=#f6f9fc` `padding=16px 20px` `radius=0 0 6px 6px` `border=1px solid #e5edf5` `border-top=none` |
| Accent 强调（关键决策 / callout） | `bg=rgba(83,58,253,0.05)` / `border-left: 3px solid #533afd` / `border-radius=4px` / `padding=12px 16px` / `color=#273951`；warning 版换 `border-left: 3px solid #9b6829` + `bg=rgba(155,104,41,0.05)` |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：
   - 默认 item：`color=#64748d` / 14px / 400
   - hover：`color=#061b31`
   - active（IntersectionObserver）：`bg=rgba(83,58,253,0.05)` + `color=#533afd` + 左侧 `border-left: 2px solid #533afd`
   - `transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease`

2. **章节折叠**（H2 `<details>`）：
   - summary 箭头：`▸` `color=#64748d`，展开旋转 90° + `color=#533afd`
   - `transition: transform 200ms ease, color 200ms ease`
   - 展开 `<details[open]> > summary` 加 `border-bottom: 1px solid #e5edf5`

3. **暗黑模式**：**both（强制）**——primary mode 是 **light**（金融白皮书气质 + Stripe Purple `#533afd` 在白底上对比最强）；dark 是强制完整支持的 fallback
   - 完整 token 见上方「Light / Dark Token Pairs」表
   - 关键差异速览：
     - bg：`#ffffff` ↔ `#0d253d`（Stripe 自家 Dark Navy）
     - surface：`#f6f9fc` ↔ `#1c1e54`（Brand Dark Indigo）
     - accent：`#533afd` ↔ `#7c6bff`（提亮以保对比度）
     - code-bg：`#0d253d` 两种 mode 不变（dark 时与页面 bg 同色，靠 `rgba(124,107,255,0.2)` border 区隔）
     - shadow：blue-tinted `rgba(50,50,93,0.25)` ↔ purple-tinted `rgba(83,58,253,0.4)`
   - toggle 按钮：right-top fixed 圆形 `40x40`，light 下 `bg=#ffffff` shadow `rgba(50,50,93,0.25) 0px 6px 12px -6px`，dark 下 `bg=#1c1e54` shadow `rgba(83,58,253,0.4) 0px 6px 12px -6px`，icon ☀ / ☾ `color=var(--accent)`
   - 首次加载逻辑：`new Date().getHours()` 在 [6,19] 用 light，否则 dark；之后 `localStorage` 记忆用户选择

4. **代码高亮**：highlight.js 主题 **`atom-one-light`**（light）/ **`atom-one-dark`**（dark）
   - 或自写：keyword `#533afd` / function `#ea2261` / string `#108c3d` / number `#9b6829`（`"tnum"`）/ comment `#64748d`

5. **回到顶部按钮**：
   - 位置：`position: fixed; right: 32px; bottom: 32px;`
   - 尺寸：`48x48` / `radius=8px`（不用 pill，呼应 Stripe 保守 radius）/ `bg=#533afd` / `color=#fff` / shadow `rgba(50,50,93,0.25) 0px 8px 16px -8px, rgba(0,0,0,0.1) 0px 4px 8px -4px`
   - icon `↑` 18px
   - hover：`bg=#4434d4` + shadow 强度增
   - 显示条件：`scrollY > window.innerHeight`，淡入 `opacity 0→1 / transition 240ms ease`

## 极简反模式

- 不要把"gold standard of fintech design"那种自吹原话抄进 doc HTML
- 不要保留 Section 9 Agent Prompt Guide
- 不要在 doc 里塞 ruby/magenta 渐变 hero 装饰——这套色是 marketing 用，doc 里只在图标/极少 callout 里出现
- 不要用大 radius（>8px）或 pill 形——破坏 Stripe 保守气质
- shadow 不要用中性灰；必须 blue-tinted（`rgba(50,50,93,...)`），否则视觉立刻塌陷成普通卡片
