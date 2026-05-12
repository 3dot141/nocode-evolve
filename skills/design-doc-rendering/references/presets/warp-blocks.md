# Preset: Warp Blocks

> Source: `hermes-agent/popular-web-designs/warp.md` (MIT) → forked & adapted for design-doc-rendering.
> Removed: Hermes platform notes (`write_file` / `browser_vision`), Section 9 marketing prompt guide, nature-photography & testimonial marketing components.
> Added: Map to Design Doc Components, 5 必有交互的视觉处理.

## Personality（一句话）

Warm-dark 终端美学的「夜色森林营火」——克制、极简、近乎单色暖灰，写给极客但拒绝冷峻。

## 何时选这个 preset

- CLI / 终端工具 / 系统内核 / 性能 benchmark 类 ADR
- Infra / runtime / protocol 类 RFC：读者主要在夜间长读
- 偏「冷静决策」气质的技术 design doc：没有 marketing 倾向
- 代码占比高（>30%）的设计文档：暗底 + Geist Mono 让代码 block 成主角
- 不适合：跨职能 PRD（PM / Design 读者多）、长篇散文向 doc（应选 posthog-playful）

## 字体（含 CDN 与 fallback）

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- **Primary**: `'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;`
- **Mono**: `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;`
- OpenType features: 标题 `font-feature-settings: "ss01" 1;`（Geist 的 stylistic set），数字 `"tnum" 1, "lnum" 1;`

CDN 失败时 fallback 到系统 UI 字体（Geist 的 geometric 风格在 system-ui 上虽不完全等价，但视觉破坏可控）。

## 视觉系统

### Visual Theme

Warp 的视觉语言是「深林营火旁的工作站」——温暖、暗色、安静自信。不同于多数开发者工具偏好的冷蓝近黑，Warp 把一切包在 warm near-black 里，像炭木或暗土。文字也不是纯白，而是 Warm Parchment（`#faf9f6`），一种几乎察觉不到的奶油色，softens 每个标题，让暗色画布显得邀请而非严苛。

Typography 是秘密武器：Geist（替代 Matter）以 geometric sans-serif + Regular 权重承担几乎所有文本——包括 headline。字重选择罕见地温和，配合 tight line-height 与受控的 negative letter-spacing，整体效果同时 refined 与 approachable。设计哲学是「以温暖实现克制」：颜色几乎单色（warm gray 系列），装饰极少。

**Key Characteristics:**
- Warm 暗底（非冷黑）——earthy near-black + warm gray 底
- Warm Parchment `#faf9f6` 文字（非纯白）
- Geist Regular（400）覆盖几乎一切；Medium（500）仅作 emphasis
- 近乎单色 warm-gray 调色——无强 accent
- Uppercase label + 宽 letter-spacing (2.4px) 作 editorial 分类信号
- Pill 形 dark 按钮 `#353534` radius 50px——克制、不抢眼

### Color Palette

**Primary**
- Warm Parchment `#faf9f6`：标题 / 主文本（淡奶油暖白）
- Earth Gray `#353534`：按钮背景 / 暗交互表面
- Deep Void：页面背景，warm near-black（推荐 `#121211` 或 `#1a1a18`）

**Secondary & Accent**
- Stone Gray `#868584`：次级文本 / muted 描述
- Ash Gray `#afaeac`：body 文本 / 按钮文字（workhorse 阅读色）
- Muted Purple `#666469`：链接文字（带极轻紫调）

**Surface（半透明叠加）**
- Frosted Veil `rgba(255,255,255,0.04)`：ultra-subtle 表面差异化
- Mist Border `rgba(226,226,226,0.35)`：半透明卡片边框
- Translucent Parchment `rgba(250,249,246,0.9)`：半透明主表面

**Neutrals**
- Dark Charcoal `#454545` / `#353534`：边框 / 按钮底

**Semantic**：近乎单色——无 bold accent；交互状态靠 opacity + underline 表达。

**Gradient System**：无显式渐变。深度靠半透明 layer。

### Typography

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Display Hero | Geist | 80px | 400 | 1.00 | -2.4px |
| Section Display | Geist | 56px | 400 | 1.20 | -0.56px |
| Section H | Geist | 48px | 400 | 1.20 | -0.48px |
| Feature H | Geist | 40px | 400 | 1.10 | -0.4px |
| Sub-H Large | Geist | 36px | 400 | 1.15 | -0.72px |
| Sub-H | Geist | 32px | 400 | 1.19 | 0px |
| Body Heading | Geist | 24px | 400 | 1.20 | -0.72px |
| Card Title | Geist | 22px | 500 | 1.14 | 0px |
| Body Large | Geist | 20px | 400 | 1.40 | -0.2px |
| Body | Geist | 18px | 400 | 1.30 | -0.18px |
| Nav / UI | Geist | 16px | 400 | 1.20 | 0px |
| Button | Geist | 16px | 500 | 1.20 | 0px |
| Caption (UPPER) | Geist | 14px | 400 | 1.00 | 1.4px |
| Small Label (UPPER) | Geist | 12px | 400 | 1.35 | 2.4px |
| Micro | Geist | 11px | 400 | 1.20 | 0px |
| Code UI | Geist Mono | 16px | 400 | 1.00 | 0px |
| Code Body | Geist Mono | 16px | 400 | 1.00 | -0.2px |

**Principles**
- **Regular 主导**：几乎所有文本 weight 400——包括 headline。Medium (500) 仅给 card title 与 button
- **零 Bold**：从不用 700+。克制是 design philosophy
- **Uppercase + 宽 tracking**：小 label 用 uppercase 配 1.4-2.4px letter-spacing，作 magazine-editorial 分类
- **Negative tracking on display**：headline 走 -0.4 ~ -2.4px，压缩 + warm typography

### Components

**Buttons**
- Dark Pill：bg `#353534`，text `#afaeac`，radius 50px，padding 10px 20px。Hover：subtle brightness 或 opacity
- Frosted Tag：bg `rgba(255,255,255,0.16)`，text `#faf9f6`，radius 6px，padding 1px 6px。inline tag 用
- Ghost：无背景，纯 text + underline on hover
- Hover 哲学：opacity / brightness 微调，无 dramatic 色变

**Cards**
- Bordered：bg transparent 或 `rgba(255,255,255,0.04)`，1px `rgba(226,226,226,0.35)` border，radius 12-14px
- Terminal screenshot card：暗底 + 8-12px radius
- Hover：基本无变化——保留 calm aesthetic

**Inputs**
- 暗底 + warm gray text；focus 时边框 brightness 上升，无彩色 ring

**Navigation**
- 暗背景，warm parchment 品牌字
- 链接 `#868584`，hover / active `#faf9f6`
- CTA：dark pill `#353534`

**Code blocks（design-doc 场景核心）**
- 行内 `code`：bg `rgba(255,255,255,0.06)`，文字 `#faf9f6`，Geist Mono 15px，padding 2px 6px，radius 4px
- `<pre>` 块：bg `#1a1a18`（或 `rgba(255,255,255,0.04)` 叠加），1px `rgba(226,226,226,0.2)` border，radius 10px，padding 18px 22px，Geist Mono 15px line-height 1.6

### Layout & Spacing

- Base unit 8px。Scale：1 / 4 / 5 / 8 / 10 / 12 / 14 / 15 / 16 / 18 / 24 / 26 / 30 / 32 / 36
- Section padding：80-120px 垂直（cinematic）
- Card padding：16-32px
- Component gap：8-16px
- Max width ~1500px
- Radius scale：4 / 5 / 8 / 10 / 12 / 14 / 40 / 50（pill）/ 200（progress）

### Shadows / Depth

| Level | Treatment | Use |
|---|---|---|
| 0 Flat | 无 shadow，暗底 | 大部分表面 |
| 1 Veil | `rgba(255,255,255,0.04)` 叠加 | 微表面差异 |
| 2 Border | `1px rgba(226,226,226,0.35)` | 卡片 / 分隔 |
| 3 Ambient | `0 5px 15px rgba(0,0,0,0.2)` | 图片 / floating |

**哲学**：marketing 站近乎零 shadow。深度靠：
- 半透明边框（35% opacity）形成 ghostly containment
- Surface opacity 微移（4% 白叠加）
- 无 glassmorphism、无 glow——任何氛围光来自照片本身

### Do's & Don'ts

**Do**
- 文字用 warm off-white `#faf9f6`，不用纯白
- 按钮克制：dark fill `#353534` + muted text `#afaeac`
- 几乎全部用 Geist Regular (400)；Medium (500) 仅 emphasis
- Uppercase label 配 1.4-2.4px letter-spacing
- 单色 warm-gray 系——无 bold accent
- 卡片 containment 用半透明 border `rgba(226,226,226,0.35)`，不用 shadow
- Headline negative letter-spacing -0.4 ~ -2.4px

**Don't**
- 不要用纯白 `#ffffff` 文字
- 不要加蓝/红/绿等 bold accent
- 不要 700+ 字重
- 不要堆 drop shadow
- 不要做冷蓝暗底——必须 warm
- 不要塞渐变 / glow
- 不要紧凑挤压排版——保留 editorial 大间距
- 不要混入 Geist / Inter 之外的字体

## Map to Design Doc Components

| Design Doc 组件 | 本 preset 的视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | bg `rgba(255,255,255,0.04)`, 1px `rgba(226,226,226,0.35)` border, radius 12px, padding 20-24px, Geist 14px weight 400, label uppercase letter-spacing 2.4px `#868584`, value `#faf9f6` |
| TOC sidebar (左侧 240px) | bg transparent, right border 1px `rgba(226,226,226,0.2)`, link `#868584` weight 400 16px, active `#faf9f6` weight 500 + 左 2px 色条 `#faf9f6`, hover `#afaeac` |
| H1 文档标题 | Geist 48-56px weight 400, line-height 1.20, letter-spacing -0.56px, color `#faf9f6`, padding-bottom 32px, border-bottom 1px `rgba(226,226,226,0.2)` |
| H2 章节 | Geist 32px weight 400, line-height 1.19, letter-spacing -0.32px, color `#faf9f6`, margin-top 64px, margin-bottom 20px |
| H3 子节 | Geist 24px weight 400, line-height 1.20, letter-spacing -0.24px, color `#faf9f6`, margin-top 40px, margin-bottom 14px |
| 正文 paragraph | Geist 18px weight 400, line-height 1.65, color `#afaeac`, max-width 72ch |
| 行内 `code` | bg `rgba(255,255,255,0.06)`, color `#faf9f6`, Geist Mono 15px, padding 2px 6px, radius 4px |
| `<pre>` 代码块 | bg `#1a1a18`, 1px `rgba(226,226,226,0.2)` border, radius 10px, padding 18px 22px, Geist Mono 15px line-height 1.6, color `#faf9f6` |
| 表格 | border 1px `rgba(226,226,226,0.2)`, 头 bg `rgba(255,255,255,0.04)` 文字 `#faf9f6` uppercase 12px letter-spacing 2.4px, 行 hover bg `rgba(255,255,255,0.03)`, 斑马 bg `rgba(255,255,255,0.02)` |
| `<blockquote>` | 左 2px 色条 `#afaeac`, bg `rgba(255,255,255,0.03)`, padding 14px 20px, 文字 `#afaeac` |
| Mermaid / SVG | bg `#1a1a18`, stroke `#afaeac`, node fill `rgba(255,255,255,0.04)` + stroke `rgba(226,226,226,0.35)`, text `#faf9f6` Geist |
| Status badge | draft: bg `rgba(255,255,255,0.06)` text `#868584`; in-review: bg `rgba(255,255,255,0.16)` text `#faf9f6`; approved: bg `#faf9f6` text `#1a1a18`——全部 radius 50px padding 4px 12px Geist 11px weight 500 uppercase letter-spacing 1.4px |
| Review Log `<details>` | summary bg `rgba(255,255,255,0.04)` text `#faf9f6` weight 500 + 箭头 `#868584`, hover bg `rgba(255,255,255,0.06)`, 展开内容 bg transparent 1px `rgba(226,226,226,0.2)` border-top |
| Accent 强调 | 关键决策：左 2px 色条 `#faf9f6` + 文字 `#faf9f6`；警告：bg `rgba(255,255,255,0.08)` 左色条 `#afaeac`；info：bg `rgba(255,255,255,0.04)` 文字 `#afaeac` |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：active `text #faf9f6 weight 500 + 左 2px 色条 #faf9f6`；hover `text #afaeac`；IntersectionObserver `rootMargin: -10% 0px -70% 0px`；transition `color 200ms ease, border-color 200ms ease`——无 bg 切换（避免破坏单色 calm）
2. **章节折叠**（H2 `<details>`）：summary 箭头 `#868584`（展开旋转 90deg，transition 200ms ease）；展开内容 fade-in 200ms ease；summary hover bg `rgba(255,255,255,0.04)`
3. **暗黑模式 toggle**：本 preset 是 **dark-only**——理由：Warp 的核心人格是「warm dark 终端美学」，强翻 light 会丢失整套 warm-near-black + 半透明 border 系统。Toggle 按钮仍保留，点击时切换 reading mode（字号 18→20、line-height 1.65→1.8），并提示「此 preset 仅暗色」
4. **代码高亮**：highlight.js 主题用 `atom-one-dark` 作 base，覆写：bg → 透明（让 `<pre>` 自身 bg 透出）、keyword `#faf9f6`、string `#afaeac`、comment `#666469` italic、function `#faf9f6` weight 500、number `#afaeac`——保持单色 warm gray 体系
5. **回到顶部按钮**：浮 right-bottom 32px，bg `#353534`，icon `#afaeac`，radius 50px（pill），size 48x48px，border 1px `rgba(226,226,226,0.2)`；hover icon `#faf9f6` + bg brightness +5%；scrollY > viewport height 时 `opacity 0 → 1 + translateY 8px → 0` transition 250ms ease

## 极简反模式

- 不照搬 marketing 套话（"campfire in the forest"、"closer to flow"）
- 不保留 Section 9 Agent Prompt Guide
- 不引入任何 nature photography / testimonial slot——design doc 不用
- 表格里不写「主色」「次要色」——必须给具体 hex 或 rgba
