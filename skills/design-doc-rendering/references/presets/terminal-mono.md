# Preset: Terminal Mono

> Source: 综合改造自 `hermes-agent/popular-web-designs/voltagent.md` + `ollama.md`（MIT）。从 voltagent 取 carbon-black 画布 + phosphor green accent + 1px warm-charcoal border 系统；从 ollama 取极简留白 + 单 font-family 单 weight 的克制感。两者都不是 terminal aesthetic 本身——本 preset 把它们综合成"1980s 黑白终端被升级到 2025"。
> Adapted for design-doc-rendering: removed Hermes platform notes (write_file / browser_vision / generative-widgets) 与 Section 9 marketing prompts; 抛弃 voltagent 的 system-ui 头标 / Inter 正文双字体系统——本 preset 通篇 mono 是灵魂; 加入 Map to Design Doc Components + 5 必有交互的视觉处理.

## Personality（一句话）

复古计算机美学被升级到 2025——void-black 画布上跑着 phosphor green，**通篇 mono 字体**（标题、正文、code 全是 JetBrains Mono），像在一台校准过的 ANSI 终端里阅读规范文档。

**Primary mode: dark**（理由：terminal-mono 的灵魂在 dark CRT——void black + phosphor green 是 brand metaphor 本体；light 是 "paper terminal" fallback——把同样的 mono 排版和 ASCII frame 搬到 warm paper 上，但要承认 phosphor green 必须降饱和到 emerald 才能在 light 上看见）

> ⚠️ **Light mode warning**：light 是 paper terminal fallback；terminal-mono 的灵魂在 dark CRT。Light 下不要期待"phosphor 发光感"——那是 dark-only 的物理属性。如果文档主受众必须在白天/亮屏环境阅读，请改选 vercel-geist 或 warp-blocks 而不是依赖本 preset 的 light fallback。

## 何时选这个 preset

- **CLI 工具 / shell utility / runtime 相关 design doc**：preset 气质与产品本体一致
- **极客向 RFC / 内核 / 编译器 / VM 类提案**：mono 排版的工程感压住主观争议
- **小众工具的 ADR / post-mortem**：读者就是会读 source code 的人，terminal 美学是"自己人"信号
- ❌ 不适合：面向 PM / 设计师 / 非技术 stakeholder 的 PRD；长 narrative 思考文（去看 tufte-essay）

## 字体（含 CDN 与 fallback）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

```css
:root {
  /* 本 preset 不区分 sans / mono——只有 mono */
  --font-mono: 'JetBrains Mono', 'Geist Mono', 'Fira Code',
               ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  --font-sans: var(--font-mono);  /* 故意指向同一个；保证即便 CSS 误用 var(--font-sans) 也回到 mono */
}
body {
  font-family: var(--font-mono);
  font-feature-settings: "calt" 1, "liga" 0;  /* 关 ligature——保留 -> != => 的字面感；calt 用于等宽对齐细节 */
  letter-spacing: 0.01em;  /* 轻微 tracking 给正文留呼吸 */
}
```

**字体选择理由**：JetBrains Mono 字宽稳定、0 与 O 有明显区分、有 4 档 weight，适合用 weight 替代字体切换做层级。Geist Mono / Fira Code 兜底。**禁用 ligature** 是招牌——不要把 `!=` 渲染成 `≠`，那是 IDE 不是 terminal。

**通篇 mono 的可读性补救**：放宽 `line-height: 1.7`、`letter-spacing: 0.01em`、`max-width: 68ch`、段落间距 ≥ 1.4em——把"mono 正文累"降到可接受。

## 视觉系统

### Visual Theme

一台被擦得发亮的 1980s VT220 终端，**屏幕换成了 OLED**——黑得彻底，green phosphor 没了 CRT 扫描线光晕但保留同样色温。背景 void black `#0a0a0a`（不是 `#000`——纯黑会蒸发掉景深），文字 `#ededed`，accent emerald `#10b981` 作"power-on"指示。Border `1px solid rgba(255,255,255,0.08)`，部分容器用 dashed 致敬 ASCII frame。

整个系统是 **achromatic + 单一 accent**：除了 emerald 之外全是 black / white opacity 阶梯。没有 secondary brand color，没有 gradient（会破坏硬件感），没有 macOS 圆点窗口 chrome（那是 IDE cosplay terminal）。

### Color Palette

**Background Surfaces**
- Void Black `#0a0a0a`：页面 body，比纯黑深了 4%
- Pit `#050505`：可选更深背景（适合用作 code block 强对比时）
- Carbon `#141414`：cards / panels，比 void 高一阶
- Hover Surface `#1c1c1c`：interactive hover
- Code Surface `#0f0f0f`：代码块（介于 void 与 carbon 之间，刻意拉低）

**Text**
- Phosphor White `#ededed`（默认正文；故意不用 `#fff`——纯白在 mono 上会刺眼）
- Primary `#d4d4d4`（次要正文 / 长段落）
- Muted `#8a8a8a`（metadata / caption）
- Disabled `#525252`（最弱）

**Accent**
- Emerald `#10b981`（默认 accent；柔和不刺）
- Phosphor Green `#39ff14`（**仅在 hover / active 时启用**——这是真正的 CRT 绿，平时太亮会累，用作"激活态"完美）
- Emerald Dim `#0d8e63`（visited link / 已读状态）

**Border**
- Subtle `rgba(255,255,255,0.06)`（默认）
- Standard `rgba(255,255,255,0.08)`（cards / code）
- Strong `rgba(255,255,255,0.12)`（hover / 强调）
- Dashed Vintage `rgba(255,255,255,0.12) dashed`（致敬 ASCII frame）

**Semantic（用 mono 风的低饱和）**
- Success `#10b981`（与 accent 共用）
- Warning `#f0b400`（amber，不用 orange——orange 太"web"）
- Error `#ef4444`
- Info `#67e8f9`（cyan；致敬终端 ANSI color 6）

### Light / Dark Token Pairs

两套 token 完整对照——dark 是 primary（写在 `:root`），light 是 paper terminal fallback（写在 `[data-theme="light"]`）。CSS 变量命名跨 8 个 preset 对齐。

| Variable | Dark (primary, `:root`) | Light (`[data-theme="light"]`) | 备注 |
|---|---|---|---|
| `--bg` | `#0a0a0a` | `#f7f4ec` | dark：void black；light：warm paper（不是冷白） |
| `--bg-panel` | `#050505` | `#efeadf` | sidebar / TOC bg（light 用更深一阶纸色） |
| `--bg-surface` | `#141414` | `#ffffff` | cards / panels（light 用纯白浮起 + border） |
| `--bg-hover` | `#1c1c1c` | `#ece6d8` | hover 状态 |
| `--text-primary` | `#ededed` | `#1a1a18` | 主标题 ink（light 不用纯黑——纸上太硬） |
| `--text-secondary` | `#d4d4d4` | `#2e2e2a` | 正文 |
| `--text-tertiary` | `#8a8a8a` | `#5e5e58` | metadata / caption |
| `--text-quat` | `#525252` | `#9a9690` | 最弱 / disabled |
| `--brand` | `#10b981` | `#059669` | dark 用 emerald；light **必须**降饱和到 deeper emerald `#059669`——`#39ff14` 在 light 上完全失效 |
| `--accent` | `#39ff14` (hover-only) / `#10b981` (默认) | `#059669` (默认) / `#047857` (hover) | phosphor green 在 light 上不存在；用 deeper emerald 两档替代 |
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(26,26,24,0.08)` | 极细分隔 |
| `--border-std` | `rgba(255,255,255,0.08)` | `rgba(26,26,24,0.12)` | 标准（ASCII frame 用） |
| `--border-strong` | `rgba(255,255,255,0.16)` | `rgba(26,26,24,0.2)` | 强调 / hover |
| `--code-bg` | `#0f0f0f` | `#efeadf` | `<pre>` 块底——比正文背景深一阶 |
| `--code-inline-bg` | `rgba(16,185,129,0.08)` | `rgba(5,150,105,0.1)` | emerald tint 招牌细节，两 mode 都保留 |

**CSS 实现骨架**

```css
:root {
  /* primary: dark */
  --bg: #0a0a0a;
  --bg-panel: #050505;
  --bg-surface: #141414;
  --bg-hover: #1c1c1c;
  --text-primary: #ededed;
  --text-secondary: #d4d4d4;
  --text-tertiary: #8a8a8a;
  --text-quat: #525252;
  --brand: #10b981;
  --accent: #10b981;
  --accent-hover: #39ff14;  /* phosphor green only on dark hover */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-std: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.16);
  --code-bg: #0f0f0f;
  --code-inline-bg: rgba(16, 185, 129, 0.08);
}
[data-theme="light"] {
  --bg: #f7f4ec;
  --bg-panel: #efeadf;
  --bg-surface: #ffffff;
  --bg-hover: #ece6d8;
  --text-primary: #1a1a18;
  --text-secondary: #2e2e2a;
  --text-tertiary: #5e5e58;
  --text-quat: #9a9690;
  --brand: #059669;
  --accent: #059669;
  --accent-hover: #047857;  /* phosphor green 在 light 上不存在；只用 deeper emerald 两档 */
  --border-subtle: rgba(26, 26, 24, 0.08);
  --border-std: rgba(26, 26, 24, 0.12);
  --border-strong: rgba(26, 26, 24, 0.2);
  --code-bg: #efeadf;
  --code-inline-bg: rgba(5, 150, 105, 0.1);
}
```

**关键 mode 差异说明**
- **Phosphor green `#39ff14` 是 dark-only 的**——在 light paper 底上完全失效（饱和度太高、对比度太低）。Light mode 用 deeper emerald `#059669` 替代默认 accent，`#047857` 替代 hover 态——降饱和到能用，但承认这是妥协
- Dark `#0a0a0a` 不是纯黑（差 4%），light `#f7f4ec` 不是纯白——两端都保留"warm 纸感/灰感"
- ASCII dashed frame（招牌细节）在两 mode 都保留——dashed border 颜色随 `--border-std` 自动切换
- Inline code 的 emerald tint 在 light 上 opacity 提高到 0.1（dark 0.08 在白底上看不见）

### Typography

通篇 JetBrains Mono。层级靠 **size + weight + line-height + 大小写**，不靠字体切换。

| Role | Font | Size | Weight | Line | Letter-spacing | Notes |
|---|---|---|---|---|---|---|
| H1 文档标题 | JetBrains Mono | 32px | 700 | 1.2 | -0.02em | 顶部唯一一处用 700 weight |
| H2 章节 | JetBrains Mono | 22px | 600 | 1.3 | -0.01em | 可选前缀 `## ` 模拟 markdown 原貌 |
| H3 子节 | JetBrains Mono | 17px | 600 | 1.4 | normal | 可选前缀 `### ` |
| Body | JetBrains Mono | 14.5px | 400 | 1.7 | 0.01em | 比常规 sans 正文略小（mono 字宽大） |
| Body emphasized | JetBrains Mono | 14.5px | 500 | 1.7 | 0.01em | 加粗替代 italic（mono italic 通常很丑） |
| Inline `code` | JetBrains Mono | 0.95em | 500 | inherit | normal | 与正文同字体，靠 bg 区分 |
| Code block | JetBrains Mono | 13.5px | 400 | 1.55 | normal | line-height 收紧——code 不需要 1.7 |
| Caption / Metadata | JetBrains Mono | 12px | 400 | 1.5 | 0.04em | 大字距 + 可选 UPPERCASE |
| Tag / Label | JetBrains Mono | 11px | 600 | 1.3 | 0.08em UPPERCASE | 大写 + 大字距给"label"感 |

**原则**：
- H1/H2/H3 用 letter-spacing 负值压缩（与 voltagent 一脉相承的密度感）
- 正文 letter-spacing **正值** `0.01em` 给呼吸（mono 正文唯一的"放宽"）
- weight 阶梯只有 4 档（400 / 500 / 600 / 700），不存在 light 与 black
- italic 替换成 weight 500——mono 字体的 italic 一般丑

### Components

**Default Button**（borderless）：bg transparent，text `#ededed`，padding 8px 16px，radius 0，hover bg `rgba(16,185,129,0.08)` text `#10b981`，active text `#39ff14`。

**Primary Button**：bg `#10b981`，text `#0a0a0a`（反转读），padding 8px 16px，radius 0，weight 600 UPPERCASE tracking 0.08em。

**Bracket Button**（招牌）：text `#10b981`，前后包 `[` `]` 字符（作为文字不是 border）：`[ EXECUTE ]`。

**Card**：bg `#141414`，border `1px solid rgba(255,255,255,0.08)`，radius 2px（极小圆角——不要 8px），padding 16px 20px。hover 只推 border 到 `rgba(255,255,255,0.16)`。

**Dashed Card**（ASCII frame）：bg transparent，border `1px dashed rgba(255,255,255,0.12)`，radius 0。用在 callout。

**Code block**：bg `#0f0f0f`，border `1px solid rgba(255,255,255,0.08)`，radius 2px，padding 14px 18px，13.5px。禁用 ligature。

**Inline `code`**：bg `rgba(16,185,129,0.08)`（emerald tint，非传统 white opacity——招牌细节）, text `#ededed`，padding 1px 6px，radius 2px。

**Blockquote**：left `2px solid #10b981`，padding 4px 0 4px 18px，text `#d4d4d4` weight 500（替代 italic）。

**Status Pill**：radius 2px（不是 9999px），padding 1px 8px，11px weight 600 UPPERCASE tracking 0.08em。

### Layout & Spacing

- Base unit 8px；scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Max content width **68ch** ≈ 700px（mono 字宽偏大，68 char 等于 sans 72 char 的视觉宽度）
- Section 垂直 padding 48px，比 sans 流派略紧——mono 自带"密度"
- TOC 侧栏宽 240px，左边右 border `1px solid rgba(255,255,255,0.08)`

### Shadows / Depth

| Level | Treatment |
|---|---|
| Flat | `#0a0a0a` bg，无 shadow，无 border |
| Surface | bg `#141414` + border `1px solid rgba(255,255,255,0.08)` |
| Strong | bg `#141414` + border `1px solid rgba(255,255,255,0.16)`（hover） |
| Accent | bg `#141414` + border `1px solid #10b981`（active / 当前 section） |
| Glow（限用 hero / 决策块） | + `0 0 16px rgba(16,185,129,0.18)` |

**核心**：和 voltagent 一脉相承——**depth 靠 border weight + color 表达，不靠 box-shadow**。glow 仅用在极少数 hero 位（如顶部 H1 旁的状态 badge）。

### Do's & Don'ts

**Do**
- 全篇 JetBrains Mono，包括正文
- 正文 line-height 1.7、letter-spacing 0.01em 救可读性
- radius 用 0 或 2px——保持"硬件感"
- accent 默认 emerald `#10b981`，phosphor `#39ff14` 仅 hover/active
- border 用 `rgba(255,255,255,0.08)`，dashed border 用于 callout
- 大写 + 大字距给 label / tag / status

**Don't**
- 不要混入 sans-serif（Inter / system-ui 等）作为副字体
- 不要 macOS 圆点窗口 chrome（红绿黄圆点）——那是 IDE
- 不要 pill 形（9999px radius）
- 不要 gradient
- 不要在 inline code 上加圆角 8px——保持 2px
- 不要把 phosphor green `#39ff14` 大面积铺——它只在 hover/active 时短暂显形

## Map to Design Doc Components

| Design Doc 组件 | 视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | bg `#0f0f0f`，border `1px dashed rgba(255,255,255,0.12)`（致敬 ASCII frame），radius 2px，padding 16px 20px。label JetBrains Mono 11px weight 600 UPPERCASE tracking 0.08em color `#8a8a8a`，value JetBrains Mono 13px weight 500 color `#ededed`。label 前可选 `// ` 前缀作注释 vibe |
| TOC sidebar（左 240px 固定） | bg `#0a0a0a`，right border `1px solid rgba(255,255,255,0.06)`，link JetBrains Mono 12.5px weight 400 color `#8a8a8a`，hover color `#ededed` bg `rgba(255,255,255,0.03)`，**active text `#10b981` + 左 2px solid border `#10b981` + bg `rgba(16,185,129,0.06)` + 前缀 `▸ ` 字符** |
| H1 文档标题 | JetBrains Mono 32px weight 700，line-height 1.2，letter-spacing -0.02em，color `#ededed`。可选前缀 `# ` color `#10b981` 致敬 markdown。bottom margin 28px |
| H2 章节 | JetBrains Mono 22px weight 600，line-height 1.3，letter-spacing -0.01em，color `#ededed`，top margin 48px / bottom 14px。可选前缀 `## ` color `#525252` 作"水印" |
| H3 子节 | JetBrains Mono 17px weight 600，line-height 1.4，color `#ededed`，top 28px / bottom 10px。可选前缀 `### ` color `#525252` |
| 正文 paragraph | JetBrains Mono 14.5px weight 400，line-height 1.7，letter-spacing 0.01em，color `#d4d4d4`，max-width 68ch |
| 行内 `code` | bg `rgba(16,185,129,0.08)`（emerald tint，非传统 white opacity）, text `#ededed`，padding 1px 6px，radius 2px，font-weight 500 |
| 代码块 `<pre>` | bg `#0f0f0f`，border `1px solid rgba(255,255,255,0.08)`，radius 2px，padding 14px 18px，JetBrains Mono 13.5px line-height 1.55，禁用 ligature。**可选左上角小标签 `bash` / `python` weight 600 UPPERCASE 11px color `#8a8a8a`** |
| 表格 | border `1px solid rgba(255,255,255,0.08)` 外围，radius 2px，overflow hidden。thead bg `#141414`，文字 `#10b981` weight 600 UPPERCASE 11px tracking 0.08em。tbody row hover bg `rgba(16,185,129,0.04)`；cell border-bottom `1px dashed rgba(255,255,255,0.06)` |
| 引用块 `<blockquote>` | bg transparent，left `2px solid #10b981`，padding 4px 0 4px 18px，color `#d4d4d4` weight 500（替代 italic）。可选首字符前缀 `> ` color `#525252` |
| Mermaid / SVG 图 | 容器 bg `#0f0f0f`，border `1px dashed rgba(255,255,255,0.12)`（ASCII frame），radius 2px，padding 24px。node fill `#141414`，stroke `#10b981`，arrow `#39ff14`（phosphor 在图里允许全面用——图本身就是"激活"内容），文字 JetBrains Mono 12px color `#d4d4d4` |
| Status badge | draft → bg `rgba(138,138,138,0.12)` text `#a3a3a3`；in-review → bg `rgba(240,180,0,0.12)` text `#f0b400`；approved → bg `rgba(16,185,129,0.12)` text `#10b981`；deprecated → bg `rgba(239,68,68,0.12)` text `#ef4444`。统一 radius 2px，padding 2px 8px，JetBrains Mono 11px weight 600 UPPERCASE tracking 0.08em。可选包 `[` `]` 字符： `[ DRAFT ]` |
| Review Log `<details>` | summary bg `#141414`，hover bg `#1c1c1c`，padding 10px 16px，radius 2px，文字 JetBrains Mono 13px weight 500 color `#ededed`，前缀箭头 `▸` color `#10b981`（open 时旋转 90°）；展开后内容 bg `#0f0f0f`，left border `1px solid rgba(255,255,255,0.06)`，padding 14px 18px |
| Accent 强调（关键决策） | 文字内联：color `#10b981` weight 600。整段警告：bg `rgba(240,180,0,0.06)` + left `2px solid #f0b400` + 首前缀 `! ` color `#f0b400` |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：active item text `#10b981` + bg `rgba(16,185,129,0.06)` + 左 2px solid `#10b981` + **前缀 `▸ ` 字符** 替代传统 dot indicator。hover text 从 `#8a8a8a` → `#ededed` 配 `rgba(255,255,255,0.03)` bg。IntersectionObserver `rootMargin: '-15% 0px -75% 0px'`。过渡 `color 120ms linear, background 120ms linear`（**linear 不是 ease**——terminal 应"瞬切"不"加速"）。

2. **章节折叠**（H2 `<details>`）：summary `cursor:pointer`，前置 `▸` 字符（不是 unicode triangle，用 ASCII 风 `▸` 或 `>`）color `#525252`，open 时变 `#10b981` 并旋转 90°；transition `transform 120ms linear, color 120ms linear`（同上，linear）；content 无 fade-in，**直接显示**——terminal 输出从来不 fade。

3. **暗黑模式 toggle**：本 preset 是 **both（强制）**，**primary 为 dark**——首次加载按 `new Date().getHours()` 自动选（6-19 点 light，否则 dark）。点击 toggle 在 `:root` 与 `[data-theme="light"]` 间切换 CSS variable，transition `background 120ms linear, color 120ms linear`（**linear 不是 ease**——terminal 应"瞬切"）。Light mode 是 paper terminal fallback：保留 mono + ASCII frame 招牌，但 phosphor green `#39ff14` 必须降到 `#059669` deeper emerald（高饱和绿在 light 上看不见）。Toggle 按钮形态：dark bg `#141414` border `#10b981` icon `#10b981` ↔ light bg `#ffffff` border `#059669` icon `#059669`。HTML 内可保留注释：「Terminal aesthetic is dark-first; light mode is a paper-terminal fallback — phosphor green degrades to emerald and the CRT metaphor is lost. Prefer dark for full fidelity.」

4. **代码高亮**：highlight.js 用 **`atom-one-dark`** 或 **`base16/eighties`**（后者更复古，与 preset 匹配度更高）；override 关键 token 对齐 palette：keyword `#10b981`，string `#67e8f9`（cyan / ANSI 6），comment `#525252` weight 500（**不用 italic**——mono italic 丑），function `#ededed`，number `#f0b400`，bg 强制 `#0f0f0f` 对齐代码块外框，无 border。

5. **回到顶部**：固定 right 24px / bottom 24px，**方形 36px** 不是圆形（pill 在本 preset 里禁用），bg `#141414`，border `1px solid rgba(255,255,255,0.08)`，radius 2px，icon 用文字 `▲` JetBrains Mono 14px weight 600 color `#8a8a8a`；hover bg `#1c1c1c` border `#10b981` icon `#10b981`；active 闪一下 icon `#39ff14`。`scrollY > 100vh` 时 opacity 0→1，过渡 120ms linear。

## 极简反模式

- ❌ 不要混入 sans-serif（Inter / system-ui / Geist）——通篇 mono 是灵魂，破了就不是这个 preset 了
- ❌ 不要 macOS 圆点窗口 chrome（红绿黄圆点）——那是"代码截图组件"，不是 terminal；保留就太 cosplay
- ❌ 不要 pill 形（9999px radius）任何元素，包括 badge——radius 永远是 0 或 2px
- ❌ 不要让 phosphor green `#39ff14` 当默认 accent——它只在 hover/active 瞬间出现；默认 accent 是更柔的 emerald `#10b981`
- ❌ 不要加 gradient / 渐变 hero——硬件感不允许；分隔靠 border 与 bg shift
- ❌ 不要把 inline code 圆角 ≥ 4px——radius 2px 是天花板
