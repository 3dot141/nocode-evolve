# Preset: Mintlify Reading

> Source: `hermes-agent/popular-web-designs/mintlify.md` (MIT) → forked & adapted for design-doc-rendering.
> Removed: Hermes platform notes (write_file / browser_vision), Section 9 marketing prompt guide.
> Added: Map to Design Doc Components, 5 必有交互的视觉处理.

## Personality（一句话）

Documentation-as-product 的明亮 reading-first 美学——白色画布、5% opacity 极细边框、绿色品牌点缀，气质开朗、清晰、好读、适合长时间阅读。

**Primary mode: light**——Mintlify 的设计灵魂在明亮 reading-first：白底 `#ffffff` + near-black 文字 `#0d0d0d` + 5% opacity 极细 border 的"paper-like 平整感" 是这套设计**不可替代**的核心。Brand Green `#18E299` 是为了在亮色文档里点缀提示而存在。

> **NOTE：dark mode 是兼容性 fallback，Mintlify 的明亮 reading-first 灵魂在 light。** 强制提供 dark mode 是为了满足 "所有 preset 必须支持双 mode" 的全局规则与夜间用户需求。dark 配色参考 Mintlify 自家 docs site 的 dark theme（bg `#0c0d10` + surface `#15161a`）—— "paper-like 平整感" 在 dark 下会变成"dark surface 上极细 border 的克制层次感"，但失去 Mintlify 招牌的"开朗清晰"气质。如果文档目的是 long-form reading（PRD、入门 RFC），优先维持 light default。

## 何时选这个 preset

- **PRD / Product Spec**：面向 PM / 设计 / non-engineer stakeholder 的产品需求
- **公开/半公开 RFC**：要让社区或跨团队成员愿意打开读完
- **DX / Doc / SDK / API 设计文档**：与"文档好读"的主题自然一致
- **入门级 design doc**：作者还在邀请讨论而非宣告决策，需要"开放"气质
- ❌ 不适合：内部 infra 重构提案（太软）、合规/法务文档（太活泼）

## 字体（含 CDN 与 fallback）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

```css
:root {
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

权重档位：400 / 500 / 600。不用 700。Geist Mono 严格用于代码与技术 label（label 多为 uppercase + tracking 0.6px）。

## 视觉系统

### Visual Theme

Mintlify 是"文档即产品"设计的研究范本——明亮、轻盈、信息密度高，把"清晰"作为最高美学价值。页面以纯白（`#ffffff`）开场，near-black（`#0d0d0d`）文字，绿色品牌点缀（`#18E299`）传递新鲜与智能而不抢戏。

字体系统单一：Inter 承担全部排版负载。display 尺寸（40–64px）用紧 letter-spacing（-0.8 → -1.28px）+ semibold（600），headline 像写得好的文档标题——focused、compressed。正文 16–18px + 150% line-height，长时间阅读舒适。Geist Mono 只用于代码/技术 label，**uppercase + tracked-out + 小号**，是页面中的 terminal voice。

Mintlify 不依赖阴影做层次——靠 5% opacity border + 大量留白 + 大圆角（16/24/9999px）。

### Color Palette

**Primary**
- Near Black `#0d0d0d`（不是纯黑，微软化提升 reading comfort）
- Pure White `#ffffff`
- Brand Green `#18E299`（标志强调色）

**Secondary Accents**
- Brand Green Light `#d4fae8`（badge / hover surface）
- Brand Green Deep `#0fa76e`（绿底上的文字）
- Warm Amber `#c37d0d`（warning）
- Soft Blue `#3772cf`（info tag）
- Error Red `#d45656`

**Neutral Scale**
- Gray 900 `#0d0d0d` / Gray 700 `#333333` / Gray 500 `#666666` / Gray 400 `#888888`
- Gray 200 `#e5e5e5` / Gray 100 `#f5f5f5` / Gray 50 `#fafafa`

**Border**
- Subtle `rgba(0,0,0,0.05)` 默认
- Medium `rgba(0,0,0,0.08)` 交互元素

### Light / Dark Token Pairs

**强制双 mode 支持**——首次加载按 `new Date().getHours()` 自动选 mode（6-19 点 light，否则 dark）。**light 是 primary**，写在 `:root`；dark 是 fallback，写在 `[data-theme="dark"]`。

dark token 参考 Mintlify 自家 docs site 的 dark theme：bg `#0c0d10` 偏冷的 near-black、surface `#15161a` 微高于 bg、text `#f3f4f6` near-white、border `rgba(255,255,255,0.06)` 极细。Brand Green 在 dark 下从 `#18E299` 提亮到 `#34F2A6` 以增加 luminance，hover 与 active 状态也跟着调。

| Token | Light (`:root`, primary) | Dark (`[data-theme="dark"]`, fallback) |
|---|---|---|
| `--bg` | `#ffffff` | `#0c0d10` |
| `--bg-panel` | `#ffffff` | `#0c0d10` |
| `--bg-surface` | `#fafafa` | `#15161a` |
| `--bg-hover` | `#f5f5f5` | `#1d1f24` |
| `--text-primary` | `#0d0d0d` | `#f3f4f6` |
| `--text-secondary` | `#333333` | `#c8cad0` |
| `--text-tertiary` | `#666666` | `#888888` |
| `--text-quat` | `#888888` | `#6b6e74` |
| `--brand` | `#18E299` | `#34F2A6` |
| `--accent` | `#0fa76e` | `#34F2A6` |
| `--accent-soft-bg` | `#d4fae8` | `rgba(52,242,166,0.12)` |
| `--accent-soft-text` | `#0fa76e` | `#34F2A6` |
| `--border-subtle` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.06)` |
| `--border-std` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.1)` |
| `--border-strong` | `#e5e5e5` | `rgba(255,255,255,0.16)` |
| `--code-bg` | `#fafafa` | `#15161a` |
| `--code-inline-bg` | `#f5f5f5` | `rgba(255,255,255,0.08)` |
| `--shadow-ambient` | `rgba(0,0,0,0.03) 0px 2px 4px` | `rgba(0,0,0,0.4) 0px 2px 4px` |
| `--shadow-button-micro` | `rgba(0,0,0,0.06) 0px 1px 2px` | `rgba(0,0,0,0.5) 0px 1px 2px` |
| `--focus-ring` | `0 0 0 3px rgba(24,226,153,0.25)` + `1px solid #18E299` | `0 0 0 3px rgba(52,242,166,0.3)` + `1px solid #34F2A6` |
| `--warning-bg` | `rgba(195,125,13,0.08)` | `rgba(195,125,13,0.15)` |
| `--warning-text` | `#c37d0d` | `#e5a55c` |
| `--info-text` | `#3772cf` | `#7aa8ed` |

**Dark mode 关键校准**：
- bg 用 `#0c0d10`（Mintlify 自家 docs site 的实际 dark bg）而非 `#0d0d0d`——略微冷调，与 Linear 的 `#08090a` 区分（Mintlify 的 dark 没那么"严肃"）
- surface `#15161a` 略高于 bg——保留 Mintlify "card 浮在背景上"的层次感
- Brand Green 从 `#18E299` → `#34F2A6`：dark bg 上 `#18E299` 对比度 6.8:1 已达标但视觉略沉，提亮到 `#34F2A6` 后约 8.2:1，更接近 Mintlify dark docs 的"发光感"
- accent `--accent-soft-bg`：light 用 `#d4fae8` 实底浅绿，dark 用半透明 `rgba(52,242,166,0.12)`——dark 下实底浅绿会撞色，用半透明
- border 从 `rgba(0,0,0,0.05)` 直接翻成 `rgba(255,255,255,0.06)`——Mintlify 在 dark 下用 6% 而非 5%，因为白色在 dark bg 上需要稍微多一点 opacity 才能保持同等可见度
- code-bg dark 用 `#15161a` 与 surface 同色——保持 Mintlify "code block 不抢戏" 的低对比策略

### Typography

| Role | Font | Size | Weight | Line | Letter-spacing |
|---|---|---|---|---|---|
| Display | Inter | 48px | 600 | 1.10 | -0.96px |
| H1 | Inter | 40px | 600 | 1.10 | -0.8px |
| H2 | Inter | 28px | 600 | 1.25 | -0.4px |
| H3 | Inter | 20px | 600 | 1.30 | -0.2px |
| Body Large | Inter | 18px | 400 | 1.55 | normal |
| Body | Inter | 16px | 400 | 1.65 | normal |
| Body Medium | Inter | 16px | 500 | 1.65 | normal |
| Small | Inter | 14px | 400 | 1.55 | normal |
| Label Uppercase | Inter | 13px | 500 | 1.50 | 0.65px |
| Mono Code | Geist Mono | 13.5px | 500 | 1.55 | normal |
| Mono Badge | Geist Mono | 11px | 600 | 1.50 | 0.6px |

**原则**：tight tracking 只在 display；body 走 relaxed 150–165% line-height；uppercase + 正向 tracking 作为段落与技术标签的分隔信号；三档权重 400 / 500 / 600，不用 700。

### Components

**Primary Button**：bg `#0d0d0d`，text `#fff`，radius **9999px**，padding 8px 24px，Inter 15px weight 500，shadow `rgba(0,0,0,0.06) 0px 1px 2px`，hover opacity 0.9。

**Secondary / Ghost**：bg `#fff`，text `#0d0d0d`，radius 9999px，border `1px solid rgba(0,0,0,0.08)`，padding 8px 24px。

**Brand Accent Button**：bg `#18E299`，text `#0d0d0d`，radius 9999px。

**Card**：bg `#fff`，border `1px solid rgba(0,0,0,0.05)`，radius **16px**（标准）/ **24px**（featured），padding 24px–32px，shadow `rgba(0,0,0,0.03) 0px 2px 4px`，hover border → `rgba(0,0,0,0.08)`。

**Input**：bg `#fff`，border `1px solid rgba(0,0,0,0.08)`，radius 9999px（pill）/ 12px（textarea），focus outline `1px solid #18E299`。

**Code block**：bg `#fafafa`，border `1px solid rgba(0,0,0,0.05)`，radius 12px，padding 16px 20px，Geist Mono 13.5px。

**Navigation**：sticky on white + `backdrop-filter: blur(12px)`，bottom border `1px solid rgba(0,0,0,0.05)`，links Inter 15px weight 500 `#0d0d0d`，hover color → `#18E299`。

### Layout & Spacing

- Base 8px；scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- Section vertical padding 64–96px desktop / 48px mobile
- Max content width ≈ 1100px；正文段落 max-width 72ch
- 不要换灰底分隔 section——靠 border + 留白

### Shadows / Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | 无 shadow，无 border | body 背景 / 段落 |
| Subtle Border | `1px solid rgba(0,0,0,0.05)` | card / divider |
| Medium Border | `1px solid rgba(0,0,0,0.08)` | input / interactive |
| Ambient | `rgba(0,0,0,0.03) 0px 2px 4px` | card lift |
| Button Micro | `rgba(0,0,0,0.06) 0px 1px 2px` | button depth |
| Focus Ring | `0 0 0 3px rgba(24,226,153,0.25)` + `1px solid #18E299` | 可访问性焦点 |

哲学：几乎不用 shadow。depth 由 border opacity 渐变（5% → 8%）+ 留白驱动，保持 paper-like 平整感。

### Do's & Don'ts

**Do**
- buttons / inputs / badges 用 9999px 全圆角——这是 Mintlify 标志形状
- border 保持在 5% opacity；超过 8% 会破坏轻盈感
- display 尺寸用负 letter-spacing，body 保持 normal
- 三档权重 400 / 500 / 600
- brand green 只用于 CTA / link hover / focus ring / accent badge
- Geist Mono uppercase 用于技术 label，Inter 用于一切人类阅读内容
- section 间用慷慨垂直留白（64–96px）

**Don't**
- 不要用纯黑 `#000000` 当文字色——`#0d0d0d` 提升舒适度
- 不要给 section 换灰底色——全部白色，靠 border 分隔
- 不要把 brand green 用作装饰填充
- 不要用 weight 700
- 不要让 shadow 抢戏

## Map to Design Doc Components

| Design Doc 组件 | 视觉处理 |
|---|---|
| Frontmatter metadata 卡片 | bg `#fafafa`，border `1px solid rgba(0,0,0,0.05)`，radius 16px，padding 20px 24px；label Geist Mono 12px weight 500 大写 tracking 0.6px `#666666`；value Inter 15px weight 500 `#0d0d0d` |
| TOC sidebar（左 240px 固定） | bg `#fff`，right border `1px solid rgba(0,0,0,0.05)`，link Inter 14px weight 500 `#666666`，hover `#0d0d0d`，**active text `#0fa76e` + bg `#d4fae8` radius 8px padding 6px 12px**，section label 用 13px uppercase tracking 0.65px `#888888` |
| H1 文档标题 | Inter 40px weight 600，line-height 1.10，letter-spacing -0.8px，color `#0d0d0d`，bottom margin 24px |
| H2 章节 | Inter 28px weight 600，line-height 1.25，letter-spacing -0.4px，color `#0d0d0d`，top margin 56px / bottom 12px |
| H3 子节 | Inter 20px weight 600，letter-spacing -0.2px，color `#0d0d0d`，top 32px / bottom 8px |
| 正文 paragraph | Inter 16px weight 400，line-height 1.65，color `#333333`，max-width 72ch |
| 行内 `code` | bg `#f5f5f5`，text `#0d0d0d`，padding 2px 6px，radius 6px，Geist Mono 0.9em weight 500 |
| 代码块 `<pre>` | bg `#fafafa`，border `1px solid rgba(0,0,0,0.05)`，radius 12px，padding 16px 20px，Geist Mono 13.5px line-height 1.55；可选 top label "bash / ts" Geist Mono 11px uppercase tracking 0.6px `#888888` |
| 表格 | border `1px solid rgba(0,0,0,0.05)`，radius 12px overflow hidden；thead bg `#fafafa`，文字 `#0d0d0d` weight 600 13px uppercase tracking 0.65px；tbody row border-bottom `1px solid rgba(0,0,0,0.05)`，hover bg `#fafafa` |
| 引用块 `<blockquote>` | bg `#d4fae8`（绿浅）/ `rgba(24,226,153,0.08)`，left border `3px solid #18E299`，padding 12px 20px，radius 0 12px 12px 0，文字 `#0d0d0d` |
| Mermaid / SVG 图 | 容器 bg `#fff`，border `1px solid rgba(0,0,0,0.05)`，radius 16px，padding 24px；node fill `#fff`，stroke `#0d0d0d`，arrow `#18E299` 或 `#0fa76e`，文字 `#0d0d0d` |
| Status badge | draft → bg `#f5f5f5` text `#666666`；in-review → bg `rgba(195,125,13,0.12)` text `#c37d0d`；approved → bg `#d4fae8` text `#0fa76e`；deprecated → bg `rgba(212,86,86,0.12)` text `#d45656`。统一 radius 9999px，padding 4px 12px，Geist Mono 11px weight 600 uppercase tracking 0.6px |
| Review Log `<details>` | summary bg `#fafafa`，hover `#f5f5f5`，padding 12px 16px，radius 12px，文字 `#0d0d0d` 14px weight 500；展开内容 bg `#fff`，left border `1px solid rgba(0,0,0,0.05)`，padding 16px 20px |
| Accent 强调 | 关键决策：内联文字 `#0fa76e` weight 500；整段警告：bg `rgba(195,125,13,0.08)` + left `3px solid #c37d0d`，文字 `#0d0d0d` |

## 5 个必有交互的视觉处理

1. **TOC 跟随**：active item text `#0fa76e` + bg `#d4fae8` radius 8px，**整块没有左边竖线**（用纯 bg pill 表达 active 是 Mintlify 招牌）；hover text 从 `#666666` → `#0d0d0d`；IntersectionObserver rootMargin `-15% 0px -70% 0px` 切 active。

2. **章节折叠**（H2 `<details>`）：summary `cursor:pointer`，前置 ▸ 三角 `#888888`，open 时旋转 90° 变 `#0fa76e`；transition `transform 180ms cubic-bezier(0.2,0.8,0.2,1), color 150ms ease`；展开内容 fade-in 200ms。

3. **暗黑模式 toggle**：**both（强制）**——primary mode 是 **light**（Mintlify 的明亮 reading-first 灵魂）；dark 是强制完整支持的兼容性 fallback，参考 Mintlify 自家 docs site dark theme
   - 完整 token 见上方「Light / Dark Token Pairs」表
   - 关键差异速览：
     - bg：`#ffffff` ↔ `#0c0d10`（Mintlify 自家 docs dark bg）
     - surface：`#fafafa` ↔ `#15161a`
     - text-primary：`#0d0d0d` ↔ `#f3f4f6`
     - brand green：`#18E299` ↔ `#34F2A6`（提亮，dark 下增加 luminance 与发光感）
     - accent-soft-bg：实底 `#d4fae8` ↔ 半透明 `rgba(52,242,166,0.12)`
     - border：`rgba(0,0,0,0.05)` ↔ `rgba(255,255,255,0.06)`（dark 多 1pp opacity 维持等价可见度）
   - toggle 按钮：nav 右上，pill shape `40x40` radius 9999px，light 下 `bg #ffffff` border `rgba(0,0,0,0.08)` icon `#0d0d0d`；dark 下 `bg #15161a` border `rgba(255,255,255,0.1)` icon `#f3f4f6`；icon ☀ / ☾
   - 首次加载逻辑：`new Date().getHours()` 在 [6,19] 用 light，否则 dark；之后 `localStorage` 记忆用户选择
   - **设计取舍提示**：如果文档目的是 long-form reading（PRD、入门 RFC、教程式 doc），建议把 default 锁死为 light 而非按小时切换——dark mode 在 Mintlify 里始终是 fallback，"明亮、轻盈、reading-first"的人格在 dark 下不可能完全成立

4. **代码高亮**：light 用 highlight.js **`github-light`** 或 **`atom-one-light`**；dark 用 **`github-dark-dimmed`**。override：light keyword `#0fa76e`，string `#c37d0d`，comment `#888888` italic，function `#0d0d0d` weight 500；dark keyword `#18E299`，comment `#888888` italic。

5. **回到顶部**：固定 right 24px / bottom 24px，**pill shape**（radius 9999px）40px×40px，bg `#fff`，border `1px solid rgba(0,0,0,0.08)`，shadow `rgba(0,0,0,0.06) 0px 4px 12px`，icon (↑) `#0d0d0d`；hover bg `#d4fae8` icon `#0fa76e` + shadow `rgba(24,226,153,0.2) 0px 4px 16px`；`scrollY > viewport` 时 opacity 0→1 + translateY 8px→0 过渡 200ms。

## 极简反模式

- ❌ 不要保留 source "documentation-as-product / atmospheric gradient / ethereal intelligence" 营销腔
- ❌ 不要保留 source Section 9 "Agent Prompt Guide" 的 example prompt
- ❌ 不要给 section 换灰色背景区分——全白靠 border 与留白
- ❌ Map 表格里禁止出现"主色 / accent / 中性灰"抽象词，全部落 hex
- ❌ 不要把 brand green `#18E299` 用作装饰大色块——只在 CTA / hover / focus / accent badge / quote left-border 出现
- ❌ button radius 不要回退到 6/8px——9999px pill 是 Mintlify 不可替代的形状人格
