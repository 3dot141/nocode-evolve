# 视觉美学校准（manifesto，必读）

> Forked & adapted from `anthropics/claude-code · plugins/frontend-design/skills/frontend-design/SKILL.md` (Anthropic, License: see upstream LICENSE.txt)
> 中文化 + design-doc 场景适配。**叠加在 preset 之上**——preset 给 token，本文档校准态度。

## Iron Law

> "AI slop" 是默认；distinctive 是选择。

每次渲染 design doc，**必须**主动反"AI slop"。preset 库给了"安全骨架"，但默认安全 = 默认平庸——光靠 preset 容易撞脸所有 SaaS 网站。本文档是态度校准器，先过这道关，再写 CSS。

## 先选 BOLD flavor（动手前必做）

从下面 12 种 flavor 选**一种**——不是混合：

| flavor | 关键词 | design-doc 适合度 |
|---|---|---|
| `editorial` | magazine / 长篇阅读 / 多列 / drop cap | ★★★★ |
| `brutally minimal` | 极简 / 无装饰 / 字距精算 / 留白即设计 | ★★★★ |
| `industrial` | 工程感 / 网格 / 蓝图线 / 测量标尺 | ★★★★ |
| `vintage computing` | 复古终端 / mono / CRT 扫描线 / phosphor | ★★★（CLI doc） |
| `brutalist` | 粗野 / 单色 / 大字号 / 不对称 | ★★★ |
| `art deco / geometric` | 几何 / 对称 / 金色线条 / 装饰边 | ★★ |
| `retro-futuristic` | Y2K / 1980s sci-fi / chrome / 渐变 grid | ★★ |
| `editorial luxury` | 衬线 / 大量留白 / 单色 + 一个 accent | ★★★ |
| `maximalist chaos` | 信息密度爆炸 / 多字体 / 多色 | ★ |
| `organic / natural` | 圆角 / 暖色 / 手绘元素 | ★（doc 不适合） |
| `playful / toy-like` | 弹跳 / 表情 / 圆角粗体 | ★（doc 不适合） |
| `pastel / soft` | 低饱和 / 圆边 / 模糊 | ★（doc 不适合） |

design-doc 默认偏向前 4 种。**playful / pastel / organic 慎用**——文档不是 marketing landing。

> ⚠️ **重要**：选 1 个并 commit 到底。混合（"editorial + playful"）= 设计稀释 = AI slop。

选了之后再去 preset 库选骨架——`flavor × preset` 的组合是落地：

- `editorial × mintlify-reading` → 长篇 PRD，serif drop cap，宽留白
- `industrial × linear-precision` → 系统级 design doc，蓝图线 + 测量刻度
- `brutally minimal × vercel-geist` → ADR，pure black + Geist + 极致克制
- `vintage computing × terminal-mono` → CLI 工具 doc，CRT 扫描线 + phosphor
- `editorial luxury × tufte-essay` → thinking piece，衬线 + sidenotes

## 字体（NEVER 列表）

**禁用**（这些字体已经在所有 AI 生成产物里）：

- `Inter`（最常见 AI 默认）
- `Roboto`
- `Arial`
- 仅 `system-ui` 兜底
- `Space Grotesk`（被官方点名为陷阱）

**替代候选**（OFL / CDN 可用，design-doc 场景测试过）：

### Display（标题用）
- `Instrument Serif` — editorial luxury / tufte 衬线感
- `Bricolage Grotesque` — variable，带 distinctive 字距，**优雅替代 Inter**
- `Departure Mono` — vintage computing，1970s 复古终端
- `EB Garamond` — 学术 essay
- `Big Shoulders Display` — brutalist / industrial 大字号
- `Fraunces` — variable serif，有 grade / weight / opsz / softness 四轴
- `Bricolage Grotesque`（也可作 display）

### Body（正文用）
- `DM Sans` — Inter-like 但更圆润 distinct
- `IBM Plex Sans` — enterprise terminal feel
- `Source Serif 4` — Tufte handout 感
- `Söhne` — 付费，写在 fallback 链作软目标
- `Fraunces` — opsz=8 时作正文
- `Bricolage Grotesque` — 变体丰富

### Mono（代码用）
- `JetBrains Mono` — 工程默认，**仍可用**（不是禁用列表）
- `IBM Plex Mono` — enterprise terminal
- `Geist Mono` — vercel 自家
- `Berkeley Mono` — 付费，复古计算机美学之神（fallback 链作软目标）
- `Departure Mono` — display + 极客双重身份

### Pair 配对原则

**强制 display + body 配对**，不要单字体走天下：

| 组合 | flavor 适配 |
|---|---|
| Instrument Serif + DM Sans | editorial / 长篇 PRD |
| Bricolage Grotesque + Bricolage Grotesque | brutally minimal / playful（同字体多 axis 变化）|
| EB Garamond + Source Serif 4 | editorial luxury / Tufte |
| Big Shoulders Display + IBM Plex Sans | brutalist / industrial |
| Departure Mono + JetBrains Mono | vintage computing / terminal |
| Fraunces + Inter Tight | editorial 现代派 |

## 例外：preset 内已选定字体

某些 preset 的字体本身就是**反 AI slop 的选择**：

| preset | 字体 | 状态 |
|---|---|---|
| `vercel-geist` | Geist + Geist Mono | ✅ 保留——Vercel 自家字体，非通用 Inter |
| `tufte-essay` | Source Serif 4 | ✅ 保留——衬线、distinctive |
| `terminal-mono` | JetBrains Mono | ✅ 保留——可叠加 Departure Mono 作 display |

其它 preset 默认用 Inter——**渲染时主动替换**为本文档候选列表之一。

## 配色

**禁用**：
- 紫渐变（`linear-gradient(purple → pink/blue)`）+ 白底
- 灰白主调 + 撒一点蓝 / 绿 accent（最常见 SaaS 平庸配色）
- 所有色饱和度均匀分布（"温吞水"）

**要求**：dominant color + sharp accent。
- dominant = 占 70%+ 视觉面积（背景 + 边框 + muted text）
- accent = 占 < 5% 视觉面积但**对比刺眼**

举例（每对 = dominant / accent）：
- 严肃 ADR：deep slate `#1a1d23` + 单一 amber `#f59e0b`
- editorial PRD：warm paper `#faf8f3` + 一点 oxblood `#722f37`
- industrial：steel `#2d3748` + 蓝图青 `#06b6d4`
- vintage computing：phosphor black `#0a0a0a` + 单一 emerald `#10b981`

不要给 design doc 用：粉红 / 黄绿 / 渐变流光 / 多 accent 平铺。

## Spatial Composition

design-doc 默认 layout = 两栏 + 居中阅读区——这是 **AI slop 安全区**。在这之上必须**主动引入差异**：

- **metadata 卡片**：可以 grid-breaking，宽度超出 prose 列（占满 content 宽）
- **TL;DR / 引用块**：可以左侧拉到 margin，形成"飞出"效果
- **章节 H2**：可以加左边小标号（`§ 03`）或 sidenote 形式的章节摘要
- **表格 / 代码块**：允许溢出 prose 宽度
- **Hero 处理**：H1 / TL;DR 用 hero treatment（大字 + 多余留白 + 背景细节），不要被当普通段落

**对称是 default，不对称才是 design**：把 TOC / metadata / 章节标号其中一个打破对称。

## Motion（详见 `motion.md`）

一个高质量 page-load staggered reveal > 5 个散落 micro-interaction。

design-doc 鼓励：
- 首屏 H1 + metadata 卡片淡入（150-300ms 错开）
- 章节滚动到视口时淡入
- 折叠展开过渡（180ms ease）

**不要**：
- 弹跳 / 旋转
- 抢眼 hover（文档不是 demo）
- 自动播放视频背景

## Backgrounds & Visual Details（详见 `background.md`）

`solid color` 是 AI slop 默认。要在 design doc 里加：

- 极轻噪点（PNG base64，1-2% opacity）
- gradient mesh 作 hero / metadata 卡片背景（极淡，不抢戏）
- ASCII frame / dashed border 给 terminal-mono / brutalist 类 preset
- 章节分隔不用 `<hr>` 默认线——用测量标尺 / 对角线 / 双线 / 装饰元素

**禁用**：大面积 gradient / 动态渐变流光 / video 背景。

## NEVER 清单（一句话过)

- ❌ Inter / Roboto / Arial / Space Grotesk
- ❌ 紫渐变 + 白底
- ❌ purely solid color 背景
- ❌ 单字体走天下（display = body = Inter）
- ❌ 圆角统一 8px（特征化失败）
- ❌ "predictable layout"——header + sidebar + content + footer 默认排
- ❌ 套通用模板凑数

## 实施复杂度匹配美学

maximalist 设计 → 大量动画 / 效果 / 装饰代码可接受
minimalist 设计 → 克制、精确、留白、字体细节

不要给 brutally minimal preset 加一堆 motion；也不要给 maximalist 写 50 行 vanilla CSS 凑事。**Elegance comes from executing the vision well**。

## Workflow（落地步骤）

1. **选 BOLD flavor**（上面 12 种选 1）
2. **选 preset 骨架**（按 SKILL.md preset 决策表）
3. **Read** preset 文件 + 本文档 + `motion.md` + `background.md`
4. **替换 NEVER 字体**——若 preset 默认是 Inter / Roboto / Arial，按候选表换
5. 写 HTML（preset token 为基底 + manifesto 准则覆盖 + flavor 染色）
6. 写完检视：过一遍本 NEVER 清单——任何一条命中 → 改

## 引用 frontend-design 原文（结尾警告）

> "Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision."

——这是上游 SKILL.md 最后一句。design-doc 是技术文档，不需要 "extraordinary creative"——需要的是**克制中的个性**。"distinctive vision" 在 design doc 里 = 精准的字体、克制的 accent、不打架的 motion、有性格的背景纹理。
