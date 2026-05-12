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

某些 preset 的字体本身就是**反 AI slop 的选择**，或通过 OpenType stylistic set 把 Inter "去通用化"成 distinctive 身份——这些**保留原 preset 字体不替换**：

| preset | 字体 | 状态 |
|---|---|---|
| `vercel-geist` | Geist + Geist Mono | ✅ 保留——Vercel 自家字体，非通用 Inter |
| `linear-precision` | Inter + OpenType `cv01, ss03` | ✅ 保留——Inter 本身在 NEVER 列表，但配上 Linear 招牌的 `cv01, ss03` stylistic set 后字形与 default Inter 显著不同，构成 Linear distinctive 身份；**前提是 `font-feature-settings: "cv01", "ss03"` 必须全局打开**，否则降级为普通 Inter，回到 NEVER 状态 |
| `tufte-essay` | Source Serif 4 | ✅ 保留——衬线、distinctive |
| `terminal-mono` | JetBrains Mono | ✅ 保留——可叠加 Departure Mono 作 display |
| `warp-blocks` | Geist + Geist Mono | ✅ 保留——同 vercel-geist 字体家族，distinctive |
| `posthog-playful` | IBM Plex Sans | ✅ 保留——IBM enterprise terminal feel，distinctive |
| `stripe-purple` | Source Sans 3 | ✅ 保留——Stripe 招牌的 weight-300 light luxury feel 已经 distinctive |

其它 preset（**`mintlify-reading`**）历史默认用 Inter——**渲染时主动替换**为本文档候选列表之一（推荐 `Bricolage Grotesque` 作 Inter 优雅替代）。

> ⚠️ **若 OpenType feature 没开**：linear-precision 的 Inter 例外失效。Cheatsheet 已经在 `body { font-feature-settings: "cv01", "ss03"; }` 里写了，**确认 body 规则已应用**再判定是否 distinctive。

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

## Motion（详见 `motion.md` + SKILL.md「MOTION_INTENSITY Dial」）

> ⚠️ **本节的具体 recipe 选取已由 dial 决定**——见 `SKILL.md` 的「MOTION_INTENSITY Dial（可选调档）」节。本节仅保留**全档位通用**的硬规则。

通用硬规则（任何 dial 档位都成立）：

- **不要**：弹跳 / 旋转过度 / 抢眼 hover / 自动播放视频背景 / Easter-egg 类装饰
- **一个高质量 page-load > 5 个散落 micro-interaction**：dial 4-7 默认只做 1 个 staggered reveal + 章节进入视区淡入；不要堆叠
- **details 折叠过渡**：永远是 `180-240ms ease`——这是 5 必有交互的一部分，与 dial 无关

## Backgrounds & Visual Details（详见 `background.md`）

`solid color` 是 AI slop 默认。要在 design doc 里加：

- 极轻噪点（PNG base64，1-2% opacity）
- gradient mesh 作 hero / metadata 卡片背景（极淡，不抢戏）
- ASCII frame / dashed border 给 terminal-mono / brutalist 类 preset
- 章节分隔不用 `<hr>` 默认线——用测量标尺 / 对角线 / 双线 / 装饰元素

**禁用**：大面积 gradient / 动态渐变流光 / video 背景。

## Anti-Generic Content（"Jane Doe Effect"）

> 借鉴 taste-skill 节 7 - Content & Data。设计文档的视觉做对了、但**示例内容**仍是 generic 占位时，整体仍掉档。

渲染时如果文档里出现以下"AI placeholder 信号"，**应在 HTML 渲染层加视觉警示**（如 `data-anti-slop="placeholder"` 灰化处理）或在报告中提醒作者改 markdown：

### 占位方案名 / 系统名

- ❌ `方案 A / 方案 B / 方案 C` —— 各方案应有反映其性质的命名
  > ✅ 替代：「PG-backed scheme」/「SQLite-only scheme」/「外置 Redis cache scheme」
- ❌ `Component X / Service Foo / Module Bar / Acme Inc / Nexus Corp / SmartFlow`
  > ✅ 替代：用真实路径或与项目主题契合的命名

### 假人名 / 假账号

- ❌ `John Doe / Sarah Chan / Jack Su` —— 示例用户
- ❌ `user@example.com / test@test.com` —— 示例邮箱  
- ❌ 标准 SVG "egg" 头像 / Lucide user 图标
  > ✅ 替代：用与文档主题相关的具体场景化命名；头像用具体风格化占位（如 [picsum.photos](https://picsum.photos/seed/x/40/40)）

### 假数据 / 整数百分比

- ❌ `99.99% / 50% / 100%` —— 太整齐 = AI 拍脑袋
- ❌ `1234567 / 12345 / 99999` —— 阶梯数字
- ❌ 性能表里 P99 都是整百整千（`100ms / 200ms / 500ms`）
  > ✅ 替代：用有机不规则数字 `47.2% / 187ms / P99 213ms / 1,847 RPS`
- ❌ SLA 承诺写 `99.99%` 而无 SLO budget 推导
  > ✅ 替代：`99.9%（误差预算 8.76 小时/年），实测 99.94%`

### AI 文案套话（与 design-doc-reviewer agent.md 的 AI Writing Patterns 互补）

视觉渲染层不修改 markdown 文本，但**渲染前过一遍这些字**——出现 = 在 Pre-Flight 提示作者改 markdown：

- ❌ `Elevate / Seamless / Unleash / Next-Gen / Leverage / Synergy`
- ❌ `深入探讨 / 核心要素 / 至关重要 / 值得一提 / 展望未来`
- ❌ `灵活、可扩展、易维护`（凑三式）
- ❌ `行业领先 / 业界标杆 / 最佳实践`（无引用）

### 外部资源

- ❌ **Unsplash 直链**（半年内大批量被裁，链接会 broken；且 Unsplash 改 license 限制商用 hot link）
- ❌ Lorem Ipsum 文字（design-doc 不应该有未填内容）
- ✅ **`picsum.photos/seed/{topic}/{w}/{h}` 是 OK 的**——不要和 Unsplash 混为一谈：picsum 是基于 seed 的**确定性**占位图（同 seed 永远拿到同张图），上游 Lorem Picsum 服务多年稳定、不依赖授权图库；用法举例 `https://picsum.photos/seed/design-doc-rendering/800/600`
- ✅ 文档主题相关具体内容、SVG inline 占位、纯文字 `data:` URI 占位都比 hot link 稳

## NEVER 清单（一句话过)

视觉层：
- ❌ Inter / Roboto / Arial / Space Grotesk
- ❌ 紫渐变 + 白底
- ❌ purely solid color 背景
- ❌ 单字体走天下（display = body = Inter）
- ❌ 圆角统一 8px（特征化失败）
- ❌ "predictable layout"——header + sidebar + content + footer 默认排
- ❌ 套通用模板凑数
- ❌ 纯黑 `#000000`（用 off-black / zinc-950 / charcoal）

内容层（"Jane Doe Effect"）：
- ❌ `方案 A / B / C` 占位名
- ❌ `John Doe / Acme Inc / SmartFlow` 通用占位人/产品
- ❌ `99.99% / 50% / 100%` 整数假数据
- ❌ `Elevate / Seamless / Unleash / 深入探讨` AI 文案套话
- ❌ Lorem Ipsum / Unsplash hot link

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
