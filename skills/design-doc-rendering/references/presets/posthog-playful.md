# Preset: PostHog Playful

> Source: `hermes-agent/popular-web-designs/posthog.md` (MIT) → forked & adapted for design-doc-rendering.
> Removed: Hermes platform notes (`write_file` / `browser_vision`), Section 9 marketing prompt guide, hero/pricing/feature-card marketing components.
> Added: Map to Design Doc Components, 5 必有交互的视觉处理.

## Personality（一句话）

Warm-sage 编辑风格的「工程师的内部 wiki」——技术严肃，但语气松弛、带点 hand-drawn 的人味。

**Primary mode: dark**（理由：PostHog.com 现产品形态是 dev-friendly dark-first——暗背景 + amber/orange 品牌色暖人情味，与 dev 受众的"夜行性"工作习惯吻合；light 是 cream-toned paper fallback，保留 sage cream + olive 调色，不能滑向"医院白"）

## 何时选这个 preset

- Refactor 提案 / 新功能 PRD：作者想强调「实用、可落地」而不是「未来主义」
- 内部工程文档 / runbook / postmortem：受众是同事，需要可读性与亲和力
- 跨职能 RFC（含 PM / Design 阅读者）：避免冷峻的纯黑暗色调
- 长篇内容密集型 design doc（>3k 字）：sage cream 背景对长时间阅读最友好
- 不适合：CLI / 系统内核 / 性能 benchmark 类极客向 ADR（应选 warp-blocks）

## 字体（含 CDN 与 fallback）

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
```

- **Primary**: `'IBM Plex Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif;`
- **Mono**: `'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;`
- OpenType features: 建议正文 `font-feature-settings: "liga" 1, "calt" 1;`，表格数字 `"tnum" 1, "lnum" 1;`

CDN 失败时 fallback 到系统 UI 字体即可（IBM Plex 的 fallback stack 已足够稳）。

## 视觉系统

### Visual Theme

PostHog 的视觉语言是「逃逸到互联网上的创业公司内部 wiki」——温暖、不正经、刻意反企业。背景不是开发者工具惯用的冷白或暗黑，而是 sage-tinted cream（`#fdfdf8`），给所有表面一种 handmade、paper-like 的质感。颜色偏 earthy olive green 与 muted sage，而不是 SaaS 世界惯用的蓝紫。

人格是主角：IBM Plex Sans 在 bold 权重（700/800）上承担标题，body 给予慷慨的 1.50+ 行高。typography 说「我们是认真的工程师」，环境说「但我们不把自己当回事」。Hover 时 PostHog Orange（`#F54E00`）作为隐藏品牌色闪现——静态时不出现，交互时给人惊喜。边框使用 sage-tinted gray（`#bfc1b7`）与 olive 文本系列和谐共振。

**Key Characteristics:**
- Warm sage/olive 调色而非传统蓝
- IBM Plex Sans 700/800 标题，1.50+ 行高 body
- 隐藏 brand orange `#F54E00`——只在 hover 出现
- Sage 边框 `#bfc1b7` 与 sage 表面 `#eeefe9` 构成统一暖绿系
- 近黑 CTA `#1e1f23` 用 opacity 而非颜色切换实现 hover
- Editorial 内容密集排版

### Color Palette

**Primary**
- Olive Ink `#4d4f46`：正文主色（暖橄榄灰）
- Deep Olive `#23251d`：链接 / 高对比标题
- PostHog Orange `#F54E00`：隐藏品牌色，hover 才出现

**Surface**
- Warm Parchment `#fdfdf8`：页面背景
- Sage Cream `#eeefe9`：input / 次级表面
- Light Sage `#e5e7e0`：按钮背景 / 三级表面
- Warm Tan `#d4c9b8`：featured 按钮背景
- Hover White `#f4f4f4`：通用 hover 底色

**Neutrals & Text**
- Muted Olive `#65675e`：次级文本
- Sage Placeholder `#9ea096`：placeholder / disabled
- Sage Border `#bfc1b7`：主边框
- Light Border `#b6b7af`：次级边框

**Semantic / Accent**
- Amber Gold `#F7A501`：暗按钮 hover 文字
- Gold Border `#b17816`：featured 按钮边框
- Focus Blue `#3b82f6`（50% opacity）：键盘 focus ring（accessibility）
- Dark Text `#111827`：高对比链接文字

**Gradient System**：无渐变。深度通过 layered surface + border 实现。

### Light / Dark Token Pairs

两套 token 完整对照——dark 是 primary（写在 `:root`），light 是 fallback（写在 `[data-theme="light"]`）。CSS 变量命名跨 8 个 preset 对齐。

| Variable | Dark (primary, `:root`) | Light (`[data-theme="light"]`) | 备注 |
|---|---|---|---|
| `--bg` | `#1d1f27` | `#fdfdf8` | dark：warm near-black 微带蓝灰；light：warm parchment（非纯白） |
| `--bg-panel` | `#232530` | `#fdfdf8` | sidebar / toc bg |
| `--bg-surface` | `#2a2c38` | `#f2f0e9` | metadata 卡片（light 用偏暖灰，比 cream 深一阶） |
| `--bg-hover` | `#33353f` | `#f4f4f4` | hover 底色 |
| `--text-primary` | `#fdfdf8` | `#151515` | 主标题 / 强 contrast（dark 用 warm parchment 不用纯白） |
| `--text-secondary` | `#d4c9b8` | `#4d4f46` | 正文（dark：warm tan 减灼烧；light：olive ink） |
| `--text-tertiary` | `#9ea096` | `#65675e` | metadata label |
| `--text-quat` | `#5d5f56` | `#9ea096` | 最弱 |
| `--brand` | `#F54E00` | `#F54E00` | PostHog orange——跨 mode 不变 |
| `--accent` | `#F7A501` | `#F7A501` | amber gold——dark 主用作 CTA active 与 link；light 仅 hover/blockquote 用 |
| `--border-subtle` | `rgba(253,253,248,0.06)` | `#bfc1b7` | 极细分隔 |
| `--border-std` | `rgba(253,253,248,0.1)` | `#bfc1b7` | 标准 border |
| `--border-strong` | `rgba(253,253,248,0.18)` | `#b17816` | 强调（light 用 gold border） |
| `--code-bg` | `#15171e` | `#fdfdf8` | `<pre>` 块底 |
| `--code-inline-bg` | `rgba(247,165,1,0.12)` | `#eeefe9` | 行内 code 底（dark 用 amber tint 招牌细节） |

> 完整 CSS variables `:root` / `[data-theme="light"]` 块见下方「Class Cheatsheet（drop-in CSS snippet）」节——所有 paste-ready 代码集中在 cheatsheet 一处。

**关键 mode 差异说明**
- Dark mode 不用纯黑——`#1d1f27` 保留 warm 倾向，避免冷蓝暗色调
- Light mode 不用纯白——`#fdfdf8` warm parchment + `#f2f0e9` 表面层是 PostHog.com 真实 cream-toned 风格
- Brand orange `#F54E00` 跨 mode 不变——隐藏品牌色逻辑（hover 才出现）两 mode 都保留
- Amber `#F7A501` 在 dark 上是主交互色（高频出现），在 light 上是低频强调（blockquote/hover）

### Typography

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Display Hero | IBM Plex Sans | 30px | 800 | 1.20 | -0.75px |
| Section H | IBM Plex Sans | 36px | 700 | 1.50 | 0px |
| Feature H | IBM Plex Sans | 24px | 700 | 1.33 | 0px |
| Sub H | IBM Plex Sans | 20px | 700 | 1.40 | -0.5px |
| Sub H Uppercase | IBM Plex Sans | 20px | 700 | 1.40 | 0px |
| Body Emphasis | IBM Plex Sans | 19px | 600 | 1.56 | -0.48px |
| Body | IBM Plex Sans | 16px | 400 | 1.50 | 0px |
| Body Relaxed | IBM Plex Sans | 15px | 400 | 1.71 | 0px |
| Nav / UI | IBM Plex Sans | 15px | 600 | 1.50 | 0px |
| Caption | IBM Plex Sans | 14px | 400-700 | 1.43 | 0px |
| Small Label | IBM Plex Sans | 13px | 500-700 | 1.00-1.50 | 0px |
| Micro | IBM Plex Sans | 12px | 400-700 | 1.33 | 0px |
| Code | Source Code Pro | 14px | 500 | 1.43 | 0px |

**Principles**
- 标题 700-800 自信粗壮；body 1.50-1.71 慷慨行高
- Uppercase label 作 magazine-editorial 分类信号
- 选择性 negative tracking：display 收紧 (-0.75px)，body 放开 (0px)

### Components

**Buttons**
- Dark Primary：bg `#1e1f23`，white text，radius 6px，padding 10px 12px。Hover：opacity 0.7 + Amber Gold 文字。Active：opacity 0.8 + 微 scale
- Sage Light：bg `#e5e7e0`，text `#4d4f46`，radius 4px，padding 4px。Hover：bg `#f4f4f4` + PostHog Orange 文字
- Ghost：bg `#fdfdf8`，text Olive Ink，transparent 1px border，radius 4px
- **共有 hover pattern**：所有按钮 hover 时文字变成 `#F54E00` 或 `#F7A501`

**Cards**
- Bordered：bg `#fdfdf8` 或 white，1px `#bfc1b7` border，radius 4-6px
- Sage Surface：bg `#eeefe9`（次级容器）
- Shadow：`0px 25px 50px -12px rgba(0,0,0,0.25)`——only for floating elements

**Inputs**
- bg `#eeefe9`，placeholder `#9ea096`，1px `#b6b7af` border，radius 4px
- Focus：`#3b82f6` 50% opacity ring
- 输入文字 `#374151`（比正文更深以利可读性）

**Code blocks**
- 行内 `code`：bg `#eeefe9`，文字 `#23251d`，Source Code Pro 14px，padding 2px 6px，radius 4px
- `<pre>` 块：bg `#fdfdf8`，1px `#bfc1b7` border，radius 6px，padding 16px

**Navigation**
- 顶栏 warm 背景，IBM Plex Sans 15px weight 600
- 链接色 Deep Olive `#23251d`，hover 下划线

### Layout & Spacing

- Base unit 8px。Scale：2 / 4 / 6 / 8 / 10 / 12 / 16 / 18 / 24 / 32 / 34
- Section padding：32-48px 垂直
- Card padding：4-12px（紧凑）
- Component gap：4-8px
- Max width：1280-1536px
- Radius scale：2 / 4 / 6 / 9999px（pill）

### Shadows / Depth

| Level | Treatment | Use |
|---|---|---|
| 0 Flat | 无 shadow，warm parchment 底 | 大部分表面 |
| 1 Border | `1px solid #bfc1b7` | 卡片 / 输入 / 分隔 |
| 2 Compound | 多向 1px border | 工具栏、复合输入 |
| 3 Deep | `0 25px 50px -12px rgba(0,0,0,0.25)` | modal / dropdown / popover |

**哲学**：整个系统只有一种 shadow，且只给 floating element 用。深度靠 border + surface 色阶递进（`#fdfdf8` → `#eeefe9` → `#e5e7e0`）。无渐变、无 glassmorphism。

### Do's & Don'ts

**Do**
- 文本与边框走 olive/sage 家族（`#4d4f46` / `#23251d` / `#bfc1b7`）
- Hover 闪 PostHog Orange `#F54E00`——这是隐藏品牌签名
- 标题用 IBM Plex Sans 700/800
- body 行高 1.50-1.71
- 背景永远 `#fdfdf8`，不要纯白
- 4px radius 是大部分 UI 的默认

**Don't**
- 不要用蓝紫等 SaaS 套路色
- 不要堆 shadow——除 floating element 外，全部用 border
- 不要把 body 行高压到 1.4 以下
- 不要把 card radius 加到 12px+——保持 4-6px
- 不要去掉 orange hover——它是核心交互
- 不要用纯白背景

## Class Cheatsheet（drop-in CSS snippet）

> 借鉴 taste-skill：paste-ready 的最小骨架。PostHog 招牌：sage-cream paper + IBM Plex Sans 700/800 + hover 闪 orange `#F54E00`。

### CSS variables

```css
:root {
  --font-sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, monospace;
  /* primary: dark */
  --bg: #1d1f27;             --bg-panel: #232530;         --bg-surface: #2a2c38;       --bg-hover: #33353f;
  --text-primary: #fdfdf8;   --text-secondary: #d4c9b8;   --text-tertiary: #9ea096;    --text-quat: #5d5f56;
  --brand: #F54E00;          --accent: #F7A501;
  --border-subtle: rgba(253,253,248,0.06);  --border-std: rgba(253,253,248,0.1);  --border-strong: rgba(253,253,248,0.18);
  --code-bg: #15171e;        --code-inline-bg: rgba(247,165,1,0.12);
}
[data-theme="light"] {
  --bg: #fdfdf8;             --bg-panel: #fdfdf8;         --bg-surface: #f2f0e9;       --bg-hover: #f4f4f4;
  --text-primary: #151515;   --text-secondary: #4d4f46;   --text-tertiary: #65675e;    --text-quat: #9ea096;
  --brand: #F54E00;          --accent: #F7A501;
  --border-subtle: #bfc1b7;  --border-std: #bfc1b7;       --border-strong: #b17816;
  --code-bg: #fdfdf8;        --code-inline-bg: #eeefe9;
}
```

### Typography & body（招牌：bold 700/800 标题 + 1.50-1.71 慷慨行高）

```css
body { font: 400 16px/1.71 var(--font-sans, 'IBM Plex Sans', system-ui, sans-serif);
       color: var(--text-secondary); background: var(--bg);
       font-feature-settings: "liga" 1, "calt" 1; }
h1 { font: 800 30px/1.20 var(--font-sans); letter-spacing: -0.75px; color: var(--text-primary);
     padding-bottom: 24px; border-bottom: 1px solid var(--border-std); margin: 0 0 24px; }
h2 { font: 700 36px/1.50 var(--font-sans); letter-spacing: 0; color: var(--text-primary); margin: 48px 0 16px; }
h3 { font: 700 24px/1.33 var(--font-sans); color: var(--text-primary); margin: 32px 0 12px; }
p  { max-width: 72ch; margin: 0 0 16px; }
code { font: 500 14px/inherit var(--font-mono, 'Source Code Pro', monospace);
       background: var(--code-inline-bg); color: var(--text-primary);
       padding: 2px 6px; border-radius: 4px; }
pre  { background: var(--code-bg); border: 1px solid var(--border-std); padding: 16px 20px;
       border-radius: 6px; font: 500 14px/1.6 var(--font-mono); overflow-x: auto; }
blockquote { background: var(--code-inline-bg); border-left: 4px solid var(--accent);
             padding: 12px 16px; margin: 16px 0; font-style: italic; }
a { color: var(--text-primary); text-decoration: underline; transition: color 150ms ease; }
a:hover { color: var(--brand); }   /* PostHog Orange 隐藏 hover 签名 */
```

### 5 必有交互（核心 snippet）

```css
.toc a { color: var(--text-tertiary); font: 400 15px/1.5 var(--font-sans);
         padding: 6px 12px; display: block; transition: 150ms ease; }
.toc a:hover { color: var(--brand); }   /* orange flash */
.toc a.active { color: var(--text-primary); background: var(--bg-hover);
                font-weight: 600; border-radius: 4px; }
.theme-toggle { position: fixed; top: 24px; right: 24px; width: 40px; height: 40px; border-radius: 4px;
                background: var(--bg-surface); border: 1px solid var(--border-std);
                color: var(--accent); }
.back-to-top { position: fixed; right: 24px; bottom: 24px; width: 44px; height: 44px;
               border-radius: 9999px; background: #1e1f23; color: var(--bg);
               box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
               opacity: 0; transition: opacity 200ms ease; }
.back-to-top.visible { opacity: 1; }
.back-to-top:hover { opacity: 0.85; color: var(--accent); }   /* amber flash on dark btn */
```

### 本 preset 不可让步（破红线 = 不再是 PostHog Playful）

3 条 hard red lines；其他战术性 don't 见上方「Do's & Don'ts」：

- ❌ 蓝紫 SaaS 套路色 —— PostHog 整套是 olive/sage/amber/orange 暖系，蓝紫立刻塌成普通 SaaS doc
- ❌ 去掉 orange hover —— PostHog Orange `#F54E00` 仅在 hover 出现是**隐藏品牌签名**，删了就失去人格
- ❌ 用纯白背景 —— 必须 `#fdfdf8` warm parchment（sage cream），纯白即"医院白"

## Map to Design Doc Components

| Design Doc 组件 | 本 preset 的视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | bg `#eeefe9`, 1px `#bfc1b7` border, radius 6px, padding 16-20px, IBM Plex Sans 14px weight 500, label uppercase letter-spacing 0px |
| TOC sidebar (左侧 240px) | bg `#fdfdf8`, right border 1px `#bfc1b7`, link color `#65675e` weight 400, active bg `#e5e7e0` + text `#23251d` weight 600, hover text `#F54E00` |
| H1 文档标题 | IBM Plex Sans 30px weight 800, line-height 1.20, letter-spacing -0.75px, color `#23251d`, padding-bottom 24px, border-bottom 1px `#bfc1b7` |
| H2 章节 | IBM Plex Sans 36px weight 700, line-height 1.50, letter-spacing 0px, color `#23251d`, margin-top 48px, margin-bottom 16px |
| H3 子节 | IBM Plex Sans 24px weight 700, line-height 1.33, color `#23251d`, margin-top 32px, margin-bottom 12px |
| 正文 paragraph | IBM Plex Sans 16px weight 400, line-height 1.71, color `#4d4f46`, max-width 72ch |
| 行内 `code` | bg `#eeefe9`, color `#23251d`, Source Code Pro 14px weight 500, padding 2px 6px, radius 4px |
| `<pre>` 代码块 | bg `#fdfdf8`, 1px `#bfc1b7` border, radius 6px, padding 16px 20px, Source Code Pro 14px line-height 1.6 |
| 表格 | border 1px `#bfc1b7`, 头 bg `#eeefe9` 文字 `#23251d` weight 700 uppercase 13px letter-spacing 0px, 行 hover bg `#f4f4f4`, 斑马纹 bg `#fbfbf6` |
| `<blockquote>` | 左 4px 色条 `#F7A501`, bg `#eeefe9`, padding 12px 16px, 文字 `#4d4f46` italic |
| Mermaid / SVG | bg `#fdfdf8`, stroke `#4d4f46`, node fill `#eeefe9`, accent stroke `#F54E00`, font IBM Plex Sans |
| Status badge | draft: bg `#e5e7e0` text `#65675e`; in-review: bg `#d4c9b8` text `#23251d`; approved: bg `#23251d` text `#fdfdf8`——都 radius 9999px padding 4px 10px Plex 13px weight 600 uppercase |
| Review Log `<details>` | summary bg `#eeefe9`, hover bg `#f4f4f4`, summary 文字 `#23251d` weight 600 + 三角箭头 `#65675e`, 展开后内容 bg `#fdfdf8` 1px `#bfc1b7` border-top |
| Accent 强调 | 关键决策：`#F54E00` 文字 + 左 3px 色条；警告：bg `#d4c9b8` 文字 `#23251d`；info：bg `#eeefe9` 文字 `#4d4f46` |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：active item `bg #e5e7e0 + text #23251d weight 600`；hover `text #F54E00`；IntersectionObserver 在 H2/H3 进入 viewport 上半（rootMargin: `-10% 0px -70% 0px`）时切换 active；transition `background-color 150ms ease`
2. **章节折叠**（H2 click 包成 `<details>`）：summary 左侧三角箭头 `#65675e`（展开旋转 90deg，transition 180ms ease）；展开内容 `max-height` 动画 200ms ease；summary hover bg `#f4f4f4`
3. **暗黑模式 toggle**：本 preset 是 **both（强制）**，**primary 为 dark**——首次加载按 `new Date().getHours()` 自动选（6-19 点 light，否则 dark）。点击 toggle 在 `:root` 与 `[data-theme="light"]` 间切换 CSS variable，transition `background 200ms ease, color 200ms ease`。两 mode 都遵守"hover 闪 orange/amber"的招牌交互——dark 上 amber 是默认 link 色，light 上 amber 仅 hover 显现。Toggle 按钮形态：dark 上 bg `#2a2c38` + icon `#F7A501`；light 上 bg `#e5e7e0` + icon `#65675e`
4. **代码高亮**：highlight.js 主题用 `github`（light, warm 调），关键字色覆写为 `#23251d`，字符串 `#65675e`，注释 `#9ea096` italic——避免 highlight.js 默认蓝色破坏 sage 体系
5. **回到顶部按钮**：浮 right-bottom 24px，bg `#1e1f23`，icon `#fdfdf8`，radius 9999px，size 44x44px，box-shadow `0 25px 50px -12px rgba(0,0,0,0.25)`；hover opacity 0.7 + icon `#F7A501`；scrollY > viewport height 时 `opacity 0 → 1` transition 200ms

## 极简反模式

- 不照搬 marketing 套话（"build faster"、"unlock insights"）
- 不保留 Section 9 Agent Prompt Guide
- 表格里不写「主色」「次要色」——必须给具体 hex
