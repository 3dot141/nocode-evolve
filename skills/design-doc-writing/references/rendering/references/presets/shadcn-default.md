# Preset: shadcn Default

> Source: shadcn/ui default theme (https://ui.shadcn.com/themes, Zinc base) → adapted for design-doc-rendering.
> Adaptations: HSL token 重新映射到本仓库 `--bg`/`--text-primary`/`--accent` 标准 var；字体从 Inter 换成 Plus Jakarta Sans（aesthetics.md NEVER 列表合规）；补 status-* token 给 callout / failure-table 用。

## Personality

shadcn 的"中性主义"——zinc 灰阶 + 高对比文字 + 4px / 6px / 8px 阶梯式 radius + 极轻 elevation。**没有色彩 brand**，accent 就是文字色本身（black-on-white / white-on-black），让内容自己说话。视觉风格中性偏 SaaS-friendly，但通过紧凑 spacing + 高对比 + scientific neutral 色板抹掉了"消费级 SaaS 的甜腻"。

**Primary mode: light**——shadcn 的设计语言在 light 上 mature 最久，dark 是社区一等公民同样支持（实际上 shadcn.com 本身默认 dark）。本 preset 给完整双 mode token，dark 跟 shadcn.com 实际配色对齐。

## 何时选这个 preset

- **中短文档 + 跨团队流转**——< 8 个 H2 / < 3000 字 / 多人传阅；shadcn 视觉是业界最大公约数，不触怒任何审美
- **管理后台 / 工具类 / 内部 SaaS 文档**——shadcn 本身就是为这类产品造的，气质天然契合
- **PRD / 中性提案 / 评审材料**——无 brand 色 = 内容自己说话，不被视觉带节奏
- **vs `mintlify-reading`**：mintlify 是**长文阅读首选**（双栏 reading + 绿色 brand accent + Bricolage Grotesque）；shadcn 是**短中文档跨团队首选**（单栏 + 无 brand 色 + 紧凑 spacing）——看文档要让人"坐下来读完"还是"作为工件流转"
- **不适合**：
  - 严肃 ADR / 极客 CLI 文档（用 `vercel-geist` / `terminal-mono` 更有气质）
  - 长篇 thinking piece（用 `tufte-essay`）
  - playful 内部 wiki（用 `posthog-playful`）
  - 长文知识库 / 大型 PRD（用 `mintlify-reading` 双栏 reading 更舒服）

## 字体（含 CDN 与 fallback）

shadcn 默认 Inter——**本 preset 替换为 Plus Jakarta Sans**（aesthetics.md NEVER 列表禁 Inter）：

CDN：
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

CSS stacks：
```css
--font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

> 为什么 Plus Jakarta Sans：现代 grotesk、neutral 度高、x-height 大易读、shadcn 社区 Inter 之外最常用的替代选。

## 视觉系统

### Visual Theme

shadcn 的视觉哲学是 **"every element earns its place"**：
- 圆角统一在 **6px / 8px** 两档（按尺寸递增），不混用 4 / 10 / 12 / 14 等"装饰性"半径
- elevation 极轻——card 默认 0 shadow，hover 才出 `0 1px 3px rgba(0,0,0,0.1)`，emphasis 用 `border` 而不是 `shadow`
- 色彩单 brand color = `--primary`（zinc-900），accent 不是另一种色而是 primary 的派生
- 间距严格按 4 / 6 / 8 / 12 / 16 / 24 / 32 / 48 阶梯

**关键特征**：
- HSL color token 体系（shadcn 标志，但本 preset 透传到本仓库 hex var）
- 1px solid border 替代 shadow-as-border 作主分隔
- focus-visible 用 2px ring（shadcn `--ring`）
- 圆角 6px(`--radius`) / 8px(`calc(--radius + 2px)`) / 4px(`calc(--radius - 2px)`) 三档计算式

### Color Palette（zinc 中性主轴 + 4 档语义）

**Light mode**

| Token | HSL | hex 近似 | 用途 |
|---|---|---|---|
| background | `0 0% 100%` | `#ffffff` | 主背景 |
| foreground | `240 10% 3.9%` | `#09090b` | 主文字（zinc-950）|
| muted | `240 4.8% 95.9%` | `#f4f4f5` | 二级表面 |
| muted-foreground | `240 3.8% 46.1%` | `#71717a` | 次级文字 |
| border | `240 5.9% 90%` | `#e4e4e7` | 边框 / 分割 |
| primary | `240 5.9% 10%` | `#18181b` | 主 CTA / strong text |
| secondary | `240 4.8% 95.9%` | `#f4f4f5` | 次级 CTA |
| destructive | `0 84.2% 60.2%` | `#ef4444` | error / danger |
| ring | `240 5.9% 10%` | `#18181b` | focus ring |

**Dark mode**

| Token | HSL | hex 近似 |
|---|---|---|
| background | `240 10% 3.9%` | `#09090b` |
| foreground | `0 0% 98%` | `#fafafa` |
| muted | `240 3.7% 15.9%` | `#27272a` |
| muted-foreground | `240 5% 64.9%` | `#a1a1aa` |
| border | `240 3.7% 15.9%` | `#27272a` |
| primary | `0 0% 98%` | `#fafafa` |
| destructive | `0 62.8% 30.6%` | `#7f1d1d` |

### Light / Dark Token Pairs（映射到本仓库标准 var）

**强制双 mode 支持**——首次加载按 `new Date().getHours()` 自动选 mode。

| 本仓库 var | Light (`:root`) | Dark (`[data-theme="dark"]`) | 对应 shadcn |
|---|---|---|---|
| `--bg` | `#ffffff` | `#09090b` | background |
| `--bg-panel` | `#ffffff` | `#09090b` | background |
| `--bg-surface` | `#f4f4f5` | `#27272a` | muted |
| `--bg-hover` | `#fafafa` | `#1f1f23` | muted (hover) |
| `--text-primary` | `#09090b` | `#fafafa` | foreground |
| `--text-secondary` | `#3f3f46` | `#d4d4d8` | zinc-700 / zinc-300 |
| `--text-tertiary` | `#71717a` | `#a1a1aa` | muted-foreground |
| `--text-quat` | `#a1a1aa` | `#71717a` | zinc-400 / zinc-500 |
| `--brand` | `#18181b` | `#fafafa` | primary |
| `--accent` | `#18181b` | `#fafafa` | primary（accent = primary）|
| `--border-subtle` | `#e4e4e7` | `#27272a` | border |
| `--border-std` | `#d4d4d8` | `#3f3f46` | zinc-300 / zinc-700 |
| `--border-strong` | `#18181b` | `#fafafa` | primary |
| `--code-bg` | `#f4f4f5` | `#18181b` | muted / zinc-900 |
| `--code-inline-bg` | `#f4f4f5` | `#27272a` | muted |
| `--shadow-ring` | `0 0 0 1px #e4e4e7` | `0 0 0 1px #27272a` | border-as-ring |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | `0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)` | sm card |
| `--focus-ring` | `hsl(240 5.9% 10%)` | `hsl(0 0% 98%)` | ring |
| `--status-info-bg` | `#eff6ff` | `rgba(59,130,246,0.15)` | blue-50 / blue-500@15 |
| `--status-info-text` | `#1d4ed8` | `#60a5fa` | blue-700 / blue-400 |
| `--status-warn-bg` | `#fef3c7` | `rgba(245,158,11,0.15)` | amber-100 / amber-500@15 |
| `--status-warn-text` | `#b45309` | `#fbbf24` | amber-700 / amber-400 |
| `--status-danger-bg` | `#fee2e2` | `rgba(239,68,68,0.15)` | red-100 / red-500@15 |
| `--status-danger-text` | `#b91c1c` | `#f87171` | red-700 / red-400 |
| `--status-success-bg` | `#dcfce7` | `rgba(34,197,94,0.15)` | green-100 / green-500@15 |
| `--status-success-text` | `#15803d` | `#4ade80` | green-700 / green-400 |

**Dark mode 关键校准**：
- bg 用 `#09090b`（zinc-950）不是 pure black——保留微微紫调，shadcn 招牌
- muted 在 dark 下提升到 zinc-800 而不是 zinc-900——和 bg 拉开 1 档层次
- destructive 在 dark 用更深的 zinc-rose（`#7f1d1d`）避免炫光
- primary 在 dark 翻成 `#fafafa`——延续 "accent = primary inverse" 原则

### Typography

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Display | 36px | 700 | 1.1 | -0.025em | H1 |
| Section H | 30px | 700 | 1.2 | -0.025em | H2 |
| Sub-H Large | 24px | 600 | 1.3 | -0.02em | H3 |
| Card Title | 20px | 600 | 1.3 | -0.015em | H4 |
| Body Large | 18px | 400 | 1.65 | normal | 引言 |
| Body | 16px | 400 | 1.6 | normal | 标准正文 |
| Body Small | 14px | 400 | 1.55 | normal | UI 文本 |
| Caption | 12px | 500 | 1.4 | 0.04em | label / eyebrow |
| Mono Body | 14px | 400 | 1.5 | normal | 代码块 |
| Mono Small | 11px | 600 | 1 | 0.1em | uppercase 技术标签 |

**Principles**：
- 字号阶 16 / 18 / 20 / 24 / 30 / 36——和 shadcn Typography 文档一致
- 字重 400 / 500 / 600 / 700 全开放（区别于 vercel-geist 的三字重严守）
- 标题用 `-0.025em` 轻负字距——比 Geist 的激进 `-2.4px` 克制得多

### Components

**Buttons**

Primary：`bg=var(--brand)` / `text=var(--bg)` / `padding=8px 16px` / `radius=6px` / `font-weight=500` / hover：`bg=color-mix(var(--brand) 90%, transparent)` —— 主 CTA
Secondary：`bg=var(--bg-surface)` / `text=var(--text-primary)` / `border=1px solid var(--border-subtle)` / `radius=6px` —— 次级
Ghost：`bg=transparent` / `text=var(--text-primary)` / hover `bg=var(--bg-surface)` —— 工具栏按钮

**Cards**

- bg `var(--bg-panel)`, 1px border `var(--border-subtle)`, radius 8px
- 默认无 shadow（border 作主分隔）
- hover：`box-shadow: var(--shadow-card)`

**Inputs**

- `bg=transparent` / `border=1px solid var(--border-subtle)` / `radius=6px` / `padding=8px 12px`
- focus：`outline: 2px solid var(--focus-ring); outline-offset: 2px`

**Code Blocks**

- bg `var(--code-bg)` / `border=1px solid var(--border-subtle)` / radius 8px
- 字体 JetBrains Mono 14px / 400 / 1.5

**Navigation**

- 顶部 sticky `bg=var(--bg)/95` + `backdrop-filter: blur(8px)` + `border-bottom: 1px solid var(--border-subtle)`

### Layout & Spacing

- Base unit 4px
- Scale：1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64px
- Max content width 1280px
- Section padding 48–96px

**Radius scale**：4 (inline code) / 6 (button, input) / 8 (card, default) / 12 (featured) / 9999 (pill)

### Shadows / Depth

| Level | Treatment |
|-------|-----------|
| Flat | 无 shadow |
| Border | `1px solid var(--border-subtle)` — 主分隔 |
| Card | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` — sm |
| Elevated | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` — md |
| Floating | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` — lg |
| Focus | `2px solid var(--focus-ring), outline-offset: 2px` |

**核心哲学**：shadcn 的 elevation 是"克制的暗示"——大部分时候 border 已经够了，shadow 只在 emphasize（hover / floating panel）时引入。

### Do's & Don'ts

**Do**
- 用 HSL token 系统（透传到本仓库 hex var）
- radius 严守 6 / 8 阶梯
- emphasis 用 border 不用 shadow
- accent = primary（不发明独立 accent 色）
- destructive / success / warn 用业界 red/green/amber 共识

**Don't**
- 不要用 Inter（aesthetics.md NEVER）
- 不要发明独立 brand 色——shadcn 的中性正是它的"色"
- 不要用 12px / 14px 圆角——破坏 4/6/8 阶梯
- 不要重 shadow（避免 SaaS 卡片悬浮感）
- 不要双 mode 都用同 destructive 色——dark 下用 zinc-rose 而不是亮红

## CSS Cheatsheet（drop-in CSS snippet）

### CSS variables

```css
:root {
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --bg: #ffffff;             --bg-panel: #ffffff;     --bg-surface: #f4f4f5;    --bg-hover: #fafafa;
  --text-primary: #09090b;   --text-secondary: #3f3f46;  --text-tertiary: #71717a;  --text-quat: #a1a1aa;
  --brand: #18181b;          --accent: #18181b;
  --border-subtle: #e4e4e7;  --border-std: #d4d4d8;  --border-strong: #18181b;
  --code-bg: #f4f4f5;        --code-inline-bg: #f4f4f5;
  --shadow-ring: 0 0 0 1px #e4e4e7;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --focus-ring: hsl(240 5.9% 10%);
  --radius: 0.5rem;

  --status-info-bg: #eff6ff;     --status-info-text: #1d4ed8;
  --status-warn-bg: #fef3c7;     --status-warn-text: #b45309;
  --status-danger-bg: #fee2e2;   --status-danger-text: #b91c1c;
  --status-success-bg: #dcfce7;  --status-success-text: #15803d;
}

[data-theme="dark"] {
  --bg: #09090b;             --bg-panel: #09090b;     --bg-surface: #27272a;    --bg-hover: #1f1f23;
  --text-primary: #fafafa;   --text-secondary: #d4d4d8;  --text-tertiary: #a1a1aa;  --text-quat: #71717a;
  --brand: #fafafa;          --accent: #fafafa;
  --border-subtle: #27272a;  --border-std: #3f3f46;  --border-strong: #fafafa;
  --code-bg: #18181b;        --code-inline-bg: #27272a;
  --shadow-ring: 0 0 0 1px #27272a;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
  --focus-ring: hsl(0 0% 98%);

  --status-info-bg: rgba(59,130,246,0.15);    --status-info-text: #60a5fa;
  --status-warn-bg: rgba(245,158,11,0.15);    --status-warn-text: #fbbf24;
  --status-danger-bg: rgba(239,68,68,0.15);   --status-danger-text: #f87171;
  --status-success-bg: rgba(34,197,94,0.15);  --status-success-text: #4ade80;
}
```

### Typography & body

```css
body {
  font: 400 16px/1.6 var(--font-sans);
  color: var(--text-primary);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
h1 { font: 700 36px/1.1 var(--font-sans); letter-spacing: -0.025em; margin: 0 0 24px; }
h2 { font: 700 30px/1.2 var(--font-sans); letter-spacing: -0.025em; margin: 48px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle); }
h3 { font: 600 24px/1.3 var(--font-sans); letter-spacing: -0.02em; margin: 32px 0 12px; }
h4 { font: 600 20px/1.3 var(--font-sans); letter-spacing: -0.015em; margin: 24px 0 12px; }
p  { max-width: 90ch; margin: 0 0 16px; }
code { font: 400 0.9em/inherit var(--font-mono); background: var(--code-inline-bg); padding: 1px 6px; border-radius: 4px; }
pre  { background: var(--code-bg); padding: 16px 20px; border-radius: 8px; border: 1px solid var(--border-subtle); font: 400 14px/1.5 var(--font-mono); overflow-x: auto; }
a { color: var(--text-primary); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--text-tertiary); }
a:hover { text-decoration-color: var(--text-primary); }
```

### 5 必有交互（核心 snippet）

```css
.toc a {
  display: block;
  padding: 6px 12px;
  font: 500 13px/1.5 var(--font-sans);
  color: var(--text-tertiary);
  text-decoration: none;
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  transition: all 150ms ease;
}
.toc a:hover { background: var(--bg-hover); color: var(--text-primary); }
.toc a.active {
  background: var(--bg-surface);
  color: var(--text-primary);
  border-left-color: var(--text-primary);
  font-weight: 600;
}

.theme-toggle, .back-to-top {
  position: fixed;
  width: 40px; height: 40px;
  border-radius: 9999px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 200ms ease;
}
.theme-toggle { top: 20px; right: 20px; }
.theme-toggle:hover { background: var(--bg-surface); }

.back-to-top {
  right: 24px; bottom: 24px;
  opacity: 0;
  pointer-events: none;
  box-shadow: var(--shadow-card);
}
.back-to-top.visible { opacity: 1; pointer-events: auto; }

details summary {
  cursor: pointer;
  padding: 8px 12px;
  font-weight: 600;
  list-style: none;
}
details summary::-webkit-details-marker { display: none; }
details summary::before {
  content: "▸";
  display: inline-block;
  margin-right: 8px;
  color: var(--text-tertiary);
  transition: transform 180ms ease;
}
details[open] summary::before { transform: rotate(90deg); }
```

### 本 preset 不可让步

3 条 hard red lines：

- ❌ 用 Inter 字体（违反 aesthetics.md NEVER）—— 用 Plus Jakarta Sans
- ❌ 发明独立 brand 色（违反 "accent = primary" 原则）—— 保持中性
- ❌ 卡片用重 shadow（变成消费级 SaaS）—— elevation 用 border 优先

## Map to Design Doc Components

| Design Doc 组件 | 视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | `bg=var(--bg-surface)` / `border=1px solid var(--border-subtle)` / `radius=8px` / `padding=16px 20px` / key Mono 11px/600 uppercase 0.1em / val 14px/500 |
| TOC sidebar (260px) | `bg=var(--bg)` / right border `var(--border-subtle)` / link 默认 `var(--text-tertiary)` 13px/500 / hover `bg=var(--bg-hover)` / active `bg=var(--bg-surface)` + 左 2px border `var(--text-primary)` |
| H1 文档标题 | Plus Jakarta Sans 36px/700 / `letter-spacing -0.025em` |
| H2 章节 | 30px/700 / 下方 `border-bottom: 1px solid var(--border-subtle)` |
| H3 子节 | 24px/600 / `-0.02em` |
| 正文 paragraph | 16px/400 / 1.6 / `max-width: 90ch` |
| 行内 `code` | `bg=var(--code-inline-bg)` / `padding=1px 6px` / `radius=4px` / JetBrains Mono 0.9em |
| 代码块 `<pre>` | `bg=var(--code-bg)` / `border=1px solid var(--border-subtle)` / `radius=8px` / `padding=16px 20px` |
| 表格 | `border=1px solid var(--border-subtle)` / `radius=8px overflow hidden` / `th: bg=var(--bg-surface), Mono 11px/600 uppercase` / `td: padding=10px 14px, border-top=1px solid var(--border-subtle)` |
| 引用块 `<blockquote>` | `border-left: 3px solid var(--text-tertiary)` / `padding=12px 16px` / `color=var(--text-secondary)` / italic |
| Mermaid / SVG 图 | 容器 `border=1px solid var(--border-subtle)` / `radius=8px` / node fill `var(--bg-surface)` stroke `var(--text-primary)` / edge stroke `var(--text-secondary)` / text `var(--text-primary)` |
| Status badge (draft) | `bg=var(--bg-surface)` / `border=1px solid var(--border-subtle)` / `color=var(--text-secondary)` / radius 9999 / Mono 11px |
| Status badge (in-review) | `bg=var(--status-info-bg)` / `color=var(--status-info-text)` |
| Status badge (approved) | `bg=var(--brand)` / `color=var(--bg)` |
| Review Log `<details>` | summary `bg=var(--bg-surface)` / `border=1px solid var(--border-subtle)` / `radius=8px` / hover `bg=var(--bg-hover)` / 展开 body `padding=16px 20px` |
| Accent 强调（关键决策） | inline 文字 `font-weight=600` 即可（没独立 accent 色）；段落级用 `callout` info 类 |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：默认 `color=var(--text-tertiary)` 13px/500；hover `bg=var(--bg-hover)`；active `bg=var(--bg-surface)` + `color=var(--text-primary)` + 左 2px border + weight 600
2. **章节折叠**：`<details>` summary 用 `▸` 字符 transition 180ms 旋转 90°；展开内容跟着 H2/H3 自然布局
3. **暗黑模式**：**both（强制）**——primary mode light，dark 完整支持
   - bg：`#ffffff` ↔ `#09090b`（zinc-950 不是纯黑）
   - text：`#09090b` ↔ `#fafafa`
   - 切换按钮：right-top fixed 40x40 圆形 + 1px border + hover `bg=var(--bg-surface)`
4. **代码高亮**：highlight.js 主题 **`github`**（light）/ **`github-dark`**（dark）—— 和 shadcn 中性 zinc 调最契合
5. **回到顶部**：right 24 bottom 24 / 40x40 圆形 / `bg=var(--bg)` + 1px border + `--shadow-card`；fade-in 200ms ease

## 反模式

- ❌ 引入紫色 / 蓝绿 gradient —— shadcn 招牌是"无 brand 色"
- ❌ 卡片 shadow 厚（`0 8px 32px`）—— 用 1px border 替代
- ❌ 圆角混用 4/6/10/12/14 —— 严守 4/6/8 阶梯
- ❌ 用 Inter / Helvetica —— Plus Jakarta Sans 是合规替代
- ❌ accent 用单独色（紫 / 蓝 / 红）—— accent = primary，destructive 是独立通道
