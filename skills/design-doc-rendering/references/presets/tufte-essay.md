# Preset: Tufte Essay

> Source: 原创设计——Hermes 没有对应模板。参考 Edward Tufte 的《The Visual Display of Quantitative Information》排版原则、`edwardtufte.github.io/tufte-css`、Gwern.net 长文排版习惯、Matthew Butterick《Practical Typography》。**不照搬 Tufte CSS 源码**——本 preset 是为 design doc 写的简化规范，剥掉了 epigraph、numbered marginalia 等学术专用件，加入 design doc 必需的 status badge / review log 视觉处理。
> Adapted for design-doc-rendering: 添加 Map to Design Doc Components + 4 必有交互的视觉处理（**主动放弃暗黑切换**，理由见下）+ "打印友好"额外建议项.

## Personality（一句话）

学术 essay + handout 排版——衬线字体、宽 margin、sidenote 而非 footnote、大量留白，气质像 Gwern 长文或 Tufte handout，**适合需要 narrative 阅读体验的 design doc**。

**Primary mode: light**（理由：Tufte 流派的灵魂是 paper handout——`#fffff8` warm paper + serif ink 是 essay 美学的物理本体；dark 是 "night reading" fallback——保留暖色基调（warm dark brown 不是 cool blue dark）以延续 paper handout 的温度，但承认衬线小字在 dark 上易发糊）

> ⚠️ **Dark mode warning**：dark 是 night reading fallback；Tufte 的灵魂在 paper light。Source Serif 4 / ET Book 衬线在暗底上小字（< 17px）会发糊——本 preset 的 dark mode 将正文字号上调到 18px 并把 weight 400→450 的 hint 留给浏览器渲染器；如读者主要在白天阅读，请尽可能停留在 light primary，dark 只作低光环境短读 fallback。

## 何时选这个 preset

- **长篇 thinking piece / vision doc**：内容是 narrative argument，需要读者像读论文一样从头读到尾，不是扫文档
- **系统级 RFC 早期讨论稿**：还在构建论据阶段，需要"散文式"地展开权衡
- **架构决策的复盘 / 技术随笔**：有历史叙事与 reflection 成分
- **跨领域 design doc**：读者背景差异大，需要 narrative 把 context 讲清
- ❌ 不适合：CLI / runtime 类纯工程 doc（用 terminal-mono / vercel-geist）；表格密集的对比文档；快速 lookup 用的参考型 doc；任何会反复跳读的"工具书"型 doc

## 字体（含 CDN 与 fallback）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

**字体选择说明**：原 Tufte CSS 用 ET Book（OFL）需要自托管 woff——为了符合 design-doc-rendering 的"CDN 可用"约束，本 preset 选 **Source Serif 4**（Adobe 开源，Google Fonts 收录，气质最接近 ET Book 的"学术 handout"感）作首选，ET Book 作 fallback 一档（如果 HTML 后续自托管字体可替换）。Palatino / Georgia 作系统 fallback。

```css
:root {
  --font-serif: 'Source Serif 4', 'ET Book', 'iowan old style', 'Apple Garamond', Palatino, 'Palatino Linotype', 'Hoefler Text', 'Times New Roman', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
body {
  font-family: var(--font-serif);
  font-feature-settings: "kern" 1, "liga" 1, "onum" 1;  /* oldstyle nums——日期/页码读起来更"散文" */
}
```

**没有 sans-serif**——本 preset 故意不引 Inter / system-ui；连 H1/H2 都用 serif，这是 essay 气质的核心。

## 视觉系统

### Visual Theme

想象一份装订精致的 handout：纸色微暖（不是纯白），衬线正文像被慢慢读出来，**右侧留出大约一列宽度的 margin 作 sidenote 区**，章节标题用 italic 衬线小标而不是粗体大字。代码块降级为"偶尔的注脚"——它存在，但不主导版面。链接是衬线下方一条暗红或暗蓝的细下划线，hover 时变实色。整张文档没有 box-shadow，没有 gradient，没有 pill，没有暗色模式——这些都属于"屏幕原生" UI，与 essay 美学冲突。

色系是 **monochrome on warm paper**：bg 微偏暖 `#fffff8` 或 `#fbfaf6`，正文 near-black `#111111`，accent 仅用在链接（暗红 `#a00000` 或暗蓝 `#1a3a8f`，下划线 0.5px）。

### Color Palette

只有 5 个值——克制是本 preset 的纪律。

- **Paper** `#fffff8`：背景；微偏暖（黄色 8/255 偏移），模拟纸张反光
- **Ink** `#111111`：正文（near-black，避免纯黑在暖纸上的违和）
- **Faded Ink** `#666666`：sidenote / caption / metadata
- **Rule** `#d9d4c8`：分隔线、表格边框；暖灰，与 paper 同色温
- **Accent Crimson** `#a00000`：链接、链接下划线（唯一的"色彩"；克制使用）

可选第 6 个：**Margin Note Bg** `rgba(217, 212, 200, 0.25)`——sidenote 区域偶尔需要的极淡背景；不是必需。

### Light / Dark Token Pairs

两套 token 完整对照——light 是 primary（写在 `:root`），dark 是 night reading fallback（写在 `[data-theme="dark"]`）。CSS 变量命名跨 8 个 preset 对齐。

| Variable | Light (primary, `:root`) | Dark (`[data-theme="dark"]`) | 备注 |
|---|---|---|---|
| `--bg` | `#fffff8` | `#1a1814` | light：warm paper；dark：warm dark brown（**不是 cool blue dark**——保留 Tufte 暖基调） |
| `--bg-panel` | `#fffff8` | `#15130f` | TOC 侧栏 |
| `--bg-surface` | `rgba(217,212,200,0.25)` | `rgba(232,226,212,0.04)` | sidenote 区可选淡底 |
| `--bg-hover` | `rgba(17,17,17,0.04)` | `rgba(232,226,212,0.06)` | 极淡 hover——essay 不喜显眼 |
| `--text-primary` | `#111111` | `#e8e2d4` | 主 ink（dark 用 cream warm 不用纯白——纯白在 warm brown 上太冷） |
| `--text-secondary` | `#222222` | `#d4cdbb` | 正文 ink（light 与 primary 几乎一致；dark 略次） |
| `--text-tertiary` | `#666666` | `#9a9282` | faded ink / metadata / sidenote |
| `--text-quat` | `#999999` | `#6e6757` | 最弱 |
| `--brand` | `#a00000` | `#d6646e` | crimson 链接色——dark 上 lift 到 oxblood `#d6646e` 保证对比度 |
| `--accent` | `#a00000` | `#d6646e` | 同 brand，唯一的"色彩" |
| `--border-subtle` | `#d9d4c8` | `#3a342c` | 极细分隔（dark 用 warm dark brown 系列） |
| `--border-std` | `#d9d4c8` | `#3a342c` | 标准（Tufte 表格 0.5px rule 用） |
| `--border-strong` | `#111111` | `#e8e2d4` | 强（Tufte 三横线表格 top/bottom 用） |
| `--code-bg` | `transparent` | `transparent` | 两 mode 都 transparent——code 在 essay 里降权，只靠左 border |
| `--code-inline-bg` | `rgba(217,212,200,0.35)` | `rgba(232,226,212,0.1)` | 极淡 rule 色 tint |

> 完整 CSS variables `:root` / `[data-theme="dark"]` 块（含衬线发糊补救）见下方「Class Cheatsheet（drop-in CSS snippet）」节。

**关键 mode 差异说明**
- Dark mode 用 **warm dark brown** `#1a1814` 而不是 cool blue dark `#0d1117` 系——Tufte 流派的整套美学是暖纸感，dark fallback 必须延续这个温度
- Crimson link `#a00000` 在 dark 上对比度不够，**lift 到 oxblood `#d6646e`**——同色相但提亮饱和度，保留"克制的色彩"克制感
- Rule color `#3a342c` 是 paper rule `#d9d4c8` 的反相版本——保持暖灰基调
- Code block 两 mode 都 transparent（无填色卡片）——Tufte 流派的核心纪律之一
- Dark 上正文上调到 18px + 微 letter-spacing 是必要补救——衬线小字在暗底易发糊

### Typography

| Role | Font | Size | Weight | Line | Style |
|---|---|---|---|---|---|
| H1 文档标题 | Source Serif 4 | 32px | 400 | 1.25 | 衬线，**不加粗**（用 size 区分） |
| H2 章节 | Source Serif 4 | 22px | 400 | 1.35 | **italic**（致敬学术 essay 副标题风） |
| H3 子节 | Source Serif 4 | 17px | 600 | 1.4 | 唯一用 600 weight 的层级 |
| Body | Source Serif 4 | 17px | 400 | 1.65 | 较大正文（衬线在小尺寸下糊） |
| Body emphasized | Source Serif 4 | 17px | 400 | 1.65 | **italic** 替代 bold（散文风） |
| Inline `code` | JetBrains Mono | 0.92em | 400 | inherit | 字号略缩，融入正文 |
| Code block | JetBrains Mono | 14px | 400 | 1.55 | 不是焦点，降权 |
| Sidenote / Margin Note | Source Serif 4 | 13px | 400 | 1.45 | 右栏小字 |
| Caption / Metadata | Source Serif 4 italic | 13px | 400 | 1.4 | italic + small |
| Drop Cap（可选） | Source Serif 4 | 60px | 400 | 1 | 文档第一段首字母 |

**原则**：
- 用 size 而不是 weight 做层级——H1 vs H2 靠字号差，不靠粗细差
- italic 是本 preset 的"加粗替代品"——bold 在学术 essay 里被认为是粗鲁
- 正文 17px 较大——衬线小字在屏幕上糊，给足 size 才好读
- line-height 1.65 散步式——essay 不赶时间
- old-style numerals (`onum`) 让日期、版本号看起来像"被排进散文"而不是数据

### Components

**Sidenote**（招牌组件）：右侧 margin 浮动；标记法 `<sup class="sn-ref">N</sup>` 主文里上标小数字，对应 `<aside class="sn">` 浮在右 margin。**没有 footnote**——浏览器宽足够时 sidenote 直接出现在正文段落右侧；移动端塌陷为正文下方 italic caption。

**Link**：text `#a00000`，下划线 `border-bottom: 0.5px solid #a00000`（用 border 不用 text-decoration——0.5px 不可移植但可用 `text-underline-offset: 0.18em` 兼容）；hover bg `rgba(160,0,0,0.08)` 配 0.5px → 1px 加粗下划线。**不变色**——hover 不切色相是 essay 流派的克制。

**Card**：极少使用。若需用：bg transparent，border-top + border-bottom `1px solid #d9d4c8`，padding 16px 0，无左右 border，无 radius。卡片不该存在于 essay 里——能不用就不用。

**Code block**：bg transparent（**不是浅灰 bg**——降权），left `2px solid #d9d4c8`，padding 4px 0 4px 14px，font 14px。code 在本 preset 里是"被嵌入的引用"，不是被强调的产物。

**Inline `code`**：bg `rgba(217,212,200,0.35)`（极淡 rule 色），text `#111111`，padding 0 4px，radius 1px，font 0.92em。

**Blockquote**（散文风的真 quote）：bg transparent，no border，padding-left 32px padding-right 32px，italic Source Serif 4 17px color `#444`。**没有左色条**——色条是 SaaS 风，不是 essay 风。

**Table**：极简——只有 horizontal rules（顶 / 头底 / 末三道线），no vertical rules，no row hover bg，no zebra。border-top `1px solid #111`，thead border-bottom `0.5px solid #d9d4c8`，tbody border-bottom `1px solid #111`。这就是 Tufte 经典表格的"三横线"做法。

**Drop Cap**（可选 hero 效果）：文档首段首字母 60px 衬线 float left margin-right 8px line-height 1。每篇 doc 顶多一处。

### Layout & Spacing

- Base unit 8px；scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- 整体 layout：**正文 760-880px + 右侧 220-260px margin 区作 sidenote**；总宽约 1000-1140px 居中
- 移动端 (<900px)：sidenote 区塌陷，浮到正文下方作 italic small caption
- Section 垂直 padding 48-64px
- 段落 first-indent 1.5em（可选；如启用则 `<p>` 之间不留空行，靠首行缩进区分——这是真正的 essay 排版）；如不启用就保留段落间距 1em

### Shadows / Depth

**零 shadow**。本 preset 没有 elevation 概念——paper 上的元素都是平的，分层靠 horizontal rule + 缩进 + size。如果设计师下意识想加 `box-shadow`，那就走偏了。

### Do's & Don'ts

**Do**
- 通篇 serif（包括 H1/H2）
- italic 替代 bold 做强调
- 用 size 而不是 weight 做层级
- 链接下划线 0.5px，hover 加粗不切色相
- 表格只有 horizontal rules（三横线 Tufte 风）
- code block 用 left border 不用 bg fill——降权
- 数字用 oldstyle numerals (`onum`)

**Don't**
- 不要引入 sans-serif 作 H1/H2 / metadata
- 不要给链接换颜色 hover（只加粗下划线）
- 不要加 box-shadow / gradient / pill 任何屏幕原生 UI 元素
- 不要把 code 块做成显眼的填色卡片——code 在 essay 里是注脚
- 不要给 blockquote 加左色条——那是 SaaS 文档风
- 不要表格 hover bg / 斑马纹——干扰阅读

## Class Cheatsheet（drop-in CSS snippet）

> 借鉴 taste-skill：paste-ready 的最小骨架。Tufte 招牌：通篇 Source Serif 4（含 H1/H2）+ warm paper `#fffff8` + italic 替代 bold + crimson `#a00000` 单 accent + 三横线表格。

### CSS variables

```css
:root {
  --font-serif: 'Source Serif 4', 'ET Book', 'iowan old style', 'Apple Garamond', Palatino, 'Palatino Linotype', 'Hoefler Text', 'Times New Roman', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  /* primary: light */
  --bg: #fffff8;             --bg-panel: #fffff8;         --bg-surface: rgba(217,212,200,0.25);
  --bg-hover: rgba(17,17,17,0.04);
  --text-primary: #111111;   --text-secondary: #222222;   --text-tertiary: #666666;    --text-quat: #999999;
  --brand: #a00000;          --accent: #a00000;
  --border-subtle: #d9d4c8;  --border-std: #d9d4c8;       --border-strong: #111111;
  --code-bg: transparent;    --code-inline-bg: rgba(217,212,200,0.35);
}
[data-theme="dark"] {
  --bg: #1a1814;             --bg-panel: #15130f;         --bg-surface: rgba(232,226,212,0.04);
  --bg-hover: rgba(232,226,212,0.06);
  --text-primary: #e8e2d4;   --text-secondary: #d4cdbb;   --text-tertiary: #9a9282;    --text-quat: #6e6757;
  --brand: #d6646e;          --accent: #d6646e;
  --border-subtle: #3a342c;  --border-std: #3a342c;       --border-strong: #e8e2d4;
  --code-bg: transparent;    --code-inline-bg: rgba(232,226,212,0.1);
}
/* Dark 衬线发糊补救 */
[data-theme="dark"] body { font-size: 18px; }
[data-theme="dark"] p, [data-theme="dark"] li { letter-spacing: 0.005em; }
```

### Typography & body（招牌：size 而非 weight 做层级 + italic 替 bold）

```css
body { font: 400 17px/1.65 var(--font-serif, 'Source Serif 4', Palatino, Georgia, serif);
       color: var(--text-primary); background: var(--bg);
       font-feature-settings: "kern" 1, "liga" 1, "onum" 1; }   /* oldstyle nums */
h1 { font: 400 32px/1.25 var(--font-serif); color: var(--text-primary); margin: 0 0 40px;
     text-align: center; }   /* 学术 paper 居中 */
h2 { font: 400 22px/1.35 var(--font-serif); font-style: italic; color: var(--text-primary); margin: 56px 0 16px; }
h3 { font: 600 17px/1.4 var(--font-serif); color: var(--text-primary); margin: 28px 0 10px; }   /* 唯一允许 600 */
p  { max-width: 880px; margin: 0 0 1em; }
em, .emphasized { font-style: italic; font-weight: 400; }   /* italic 替代 bold */
code { font: 400 0.92em/inherit var(--font-mono, 'JetBrains Mono', monospace);
       background: var(--code-inline-bg); padding: 0 4px; border-radius: 1px; }
pre  { background: transparent; border-left: 2px solid var(--border-std); padding: 4px 0 4px 14px;
       font: 400 14px/1.55 var(--font-mono); color: var(--text-secondary); margin: 1em 0; overflow-x: auto; }
blockquote { background: transparent; border: none; padding: 8px 32px;
             font-style: italic; color: var(--text-secondary); margin: 16px 0; }
a { color: var(--accent); border-bottom: 0.5px solid var(--accent); text-decoration: none;
    text-underline-offset: 0.18em; }
a:hover { background: rgba(160,0,0,0.08); border-bottom-width: 1px; }

/* Tufte 三横线表格 */
table { border-collapse: collapse; }
table { border-top: 1px solid var(--border-strong); border-bottom: 1px solid var(--border-strong); }
thead { border-bottom: 0.5px solid var(--border-std); }
thead th { font-style: italic; font-weight: 400; color: var(--text-tertiary); }
/* no vertical rules, no row hover, no zebra — Tufte 纪律 */

/* Sidenote */
.sidenote { float: right; clear: right; width: 220px; margin-right: -260px;
            font-size: 13px; color: var(--text-tertiary); line-height: 1.45; }
@media (max-width: 900px) {
  .sidenote { float: none; width: auto; margin: 0.5em 0; font-style: italic; }
}

[data-theme="dark"] body { font-size: 18px; letter-spacing: 0.005em; }   /* 衬线 dark 救糊 */
```

### 5 必有交互（核心 snippet）

```css
.toc a { color: var(--text-tertiary); font: 400 14px/1.5 var(--font-serif);
         padding-left: 4px; display: block; transition: color 200ms ease; }
.toc a:hover { color: var(--text-primary); }
.toc a.active { color: var(--accent); font-style: italic; padding-left: 8px; }   /* 无 bg/border */
.theme-toggle { position: fixed; top: 24px; right: 24px; background: transparent; border: none;
                color: var(--text-tertiary); font-style: italic; font-size: 14px;
                border-bottom: 0.5px solid var(--text-tertiary); padding: 2px 4px; }
.back-to-top { position: fixed; right: 32px; bottom: 32px; background: transparent; border: none;
               color: var(--text-tertiary); font: italic 400 14px/1 var(--font-serif);
               border-bottom: 0.5px solid var(--border-std); padding: 2px 4px;
               opacity: 0; transition: opacity 300ms ease; }
.back-to-top.visible { opacity: 1; }
.back-to-top:hover { color: var(--accent); border-bottom-color: var(--accent); }

/* 打印友好（Tufte handout 应该可印） */
@media print {
  body { background: #fff; color: #000; font-size: 11pt; }
  .toc-sidebar, .back-to-top, .theme-toggle { display: none; }
  .sidenote { float: none; width: auto; margin: 0.5em 0; font-style: italic; }
  pre, blockquote { page-break-inside: avoid; }
  a { color: #000; text-decoration: underline; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; }
}
```

### 本 preset 不可让步（破红线 = 不再是 Tufte Essay）

3 条 hard red lines；其他战术性 don't 见上方「Do's & Don'ts」：

- ❌ 任何 sans-serif 用在 H1 / H2 / metadata（包括 Inter / system-ui）—— **通篇 serif 是灵魂**
- ❌ box-shadow / gradient / pill 任何元素 —— 屏幕原生 UI 与 paper handout 美学根本冲突
- ❌ 表格加 hover bg / 斑马纹 / vertical rules —— 三横线 (top / thead-bottom / bottom) 是 Tufte 表格纪律

## Map to Design Doc Components

| Design Doc 组件 | 视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | bg transparent，**没有 card box**——直接 italic 列表 "*Type: Decision · Author: Harrison · Status: Draft · 2026-05-12*" 排在 H1 下方，font Source Serif 4 italic 14px color `#666666`，居中（致敬学术 byline） |
| TOC sidebar（左 220px 固定） | bg transparent，right border `1px solid #d9d4c8`，link Source Serif 4 14px color `#666666`，hover color `#111111`，**active text `#a00000` italic + 左侧 4px padding 提示**（不用 bg / border 强调） |
| H1 文档标题 | Source Serif 4 32px weight 400，line-height 1.25，color `#111111`，**居中** + 下面 italic byline 行（学术 paper 风），bottom margin 40px |
| H2 章节 | Source Serif 4 22px weight 400 **italic**，color `#111111`，top margin 56px / bottom 16px。可选小写文字（"introduction" 而非 "Introduction"——更 essay） |
| H3 子节 | Source Serif 4 17px weight 600（**唯一允许 600 的层级**），color `#111111`，top 28px / bottom 10px |
| 正文 paragraph | Source Serif 4 17px weight 400，line-height 1.65，color `#111111`，max-width 760-880px。可选首行 1.5em indent + 段落间无空 |
| 行内 `code` | bg `rgba(217,212,200,0.35)`，text `#111111`，padding 0 4px，radius 1px，JetBrains Mono 0.92em |
| 代码块 `<pre>` | bg transparent（**故意降权**），left `2px solid #d9d4c8`，padding 4px 0 4px 14px，JetBrains Mono 14px line-height 1.55 color `#444444` |
| 表格 | **Tufte 三横线**：border-top `1px solid #111`，thead border-bottom `0.5px solid #d9d4c8`，tbody border-bottom `1px solid #111`，no vertical rules，no row hover，no zebra。thead text Source Serif 4 italic 14px color `#666666` |
| 引用块 `<blockquote>` | bg transparent，无左色条，padding 8px 32px，Source Serif 4 17px italic color `#444444`。文末可选 `— Author` em-dash attribution，small italic |
| Sidenote / Margin Note | 浮在右 margin（用 `float: right; clear: right; width: 220px; margin-right: -260px;`），Source Serif 4 13px color `#666666` line-height 1.45。移动端塌陷为正文下方 italic small caption |
| Mermaid / SVG 图 | 容器 bg transparent，无 border 无 padding 直接嵌入；node fill transparent，stroke `#111111` 0.5-1px，arrow `#111111`，文字 Source Serif 4 13px color `#111111`。整体走"blueprint hand-drawn"风 |
| Status badge | draft → text `#666666` italic ; in-review → text `#a00000` italic ; approved → text `#111111` italic ; deprecated → text `#999999` italic strikethrough。**没有 bg / pill / radius**——全部用 italic 字处理，气质对齐 essay |
| Review Log `<details>` | summary 文字 Source Serif 4 14px italic color `#666666` "*Review Log →*"，hover color `#111111`，无 bg；open 时三角变 `▼`，展开后内容左 border `1px solid #d9d4c8` padding 12px 20px |
| Accent 强调 | 文字内联：text `#a00000` weight 400（**不加粗**）。整段警告：italic + 段前小段 em-dash + caption「*Caveat:* 」起头，文字 color `#666666` |

## 5 个必有交互的视觉处理

> **历史声明（保留作 design rationale）**：本 preset 原稿主动放弃 #3 暗黑模式切换，理由是 Tufte handout 没有 dark mode、衬线美学反色后塌成廉价 dark blog。该判断在视觉上至今成立——但 design-doc-rendering skill 现已强制要求 light + dark 双 mode；本 preset 按规则补齐了 night reading dark fallback，并通过"warm dark brown + 字号上调 + oxblood crimson"三处补救尽量缓和衬线发糊问题。Light 仍是 primary——dark 只作低光环境短读 fallback。**附加项：打印友好（@media print）**——essay 应该可以印出来读。

1. **TOC 跟随**：active item text `#a00000` italic + 左 4px padding（**不用 bg、不用 border**——essay 不喜欢矩形高亮）；hover text 从 `#666666` → `#111111` 不变样式。IntersectionObserver `rootMargin: '-25% 0px -65% 0px'`。过渡 `color 200ms ease`（比 terminal preset 略慢——essay 不赶）。

2. **章节折叠**（H2 `<details>`）：summary `cursor:pointer`，前置 small `›` 字符 color `#666666`，open 时变 `‹`（**用方向变化而不是旋转**——避免"加载"机械感）；no transition on the marker（即时切换），content fade-in 240ms ease。

3. **暗黑模式 toggle**：本 preset 是 **both（强制）**，**primary 为 light**——首次加载按 `new Date().getHours()` 自动选（6-19 点 light，否则 dark）。点击 toggle 在 `:root` 与 `[data-theme="dark"]` 间切换 CSS variable，transition `background 320ms ease, color 320ms ease`（**比其他 preset 慢一档**——essay 不赶时间，缓慢淡入更符合 paper-to-night 的隐喻）。Dark mode 是 night reading fallback：warm dark brown `#1a1814` + cream ink `#e8e2d4` + oxblood crimson `#d6646e` + rule color `#3a342c`，正文字号上调到 18px 缓解衬线发糊。Toggle 按钮形态：light 上是纯文字 italic 链接 "*night reading*" color `#666666` 下划线 0.5px ↔ dark 上 "*paper*" color `#9a9282`——按钮本体也走 essay 风（无 bg / 无 border / 无 icon）。HTML 内可保留注释：「Dark mode is a night-reading fallback; serif at small sizes degrades on dark. Prefer light primary for full Tufte fidelity.」

4. **代码高亮**：highlight.js 用 **`atom-one-light`** 或 **`github-light`**；override：keyword `#a00000`，string `#666666`（**不用绿色 / 紫色** 等鲜艳色——essay 不允许彩虹 syntax），comment `#999999` italic，function `#111111`，bg 强制 transparent 对齐降权的 code block。整体让 code 看起来像被印刷在 paper 上而不是发光的 IDE。

5. **回到顶部**：固定 right 32px / bottom 32px，**纯文字按钮**（不要 circle 不要 square），text "↑ Top" Source Serif 4 italic 14px color `#666666`，下划线 0.5px `#d9d4c8`；hover color `#a00000` 下划线变 `#a00000`。`scrollY > 100vh` 时 opacity 0→1 过渡 300ms ease。**没有 bg、没有 border、没有 shadow**——它应该看起来像 essay 末页的 "back to top" 文字链接。

### 补充建议项：打印友好（@media print）

```css
@media print {
  body { background: #fff; color: #000; font-size: 11pt; }
  .toc-sidebar, .back-to-top, .theme-toggle { display: none; }
  .sidenote { float: none; width: auto; margin: 0.5em 0; font-style: italic; }
  pre, blockquote { page-break-inside: avoid; }
  a { color: #000; text-decoration: underline; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; }
}
```

Tufte handout 本来就是为印刷设计的——HTML 渲染产物应该让用户能 `Cmd-P` 拿到一份可读的 PDF。

## 极简反模式

- ❌ 不要给 H1/H2/metadata 引入 sans-serif（Inter / system-ui）——通篇 serif 是灵魂
- ❌ 不要给 blockquote 加左色条 / 浅色填底——那是 SaaS 文档风，不是 essay 风
- ❌ 不要把 code block 设计成显眼的填色卡片——code 在本 preset 里只是被嵌入的注脚
- ❌ 不要给链接 hover 切色相（不要 `#a00000` → `#ff4444` 这种"互联网式" hover）——只加粗下划线即可
- ❌ 不要保留暗黑模式 toggle——本 preset 明示放弃该交互；放一个 disabled 按钮比直接移除更糟
- ❌ 不要给表格加 hover bg / 斑马纹 / vertical rules——三横线表格是 Tufte 流派纪律
