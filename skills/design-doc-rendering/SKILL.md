---
name: design-doc-rendering
description: 把 design-doc-writing skill 生成的 markdown 设计文档渲染成 single-file HTML 展示版。当 overlay-superpowers.md 走完 design-doc-writing 后链式调用本 skill；当用户说「把这份设计文档渲染成 HTML / 转 HTML / 生成展示版 / 生成 HTML 制品」时也用。生成的 HTML 必须可双击浏览器离线打开（不引 CDN、不依赖外网），含 TOC 侧栏 / 章节折叠 / 暗黑模式切换 / 代码高亮 / 回到顶部 5 个必有交互；视觉风格要现代、专业、好看，**不能是单调的 GitHub README 黑白文字流**。不要用本 skill 渲染 README、changelog、blog 等非设计文档。
---

# 设计文档 HTML 渲染

把 markdown 设计文档渲染成 single-file HTML——一份"好看、能交互、能分享"的展示版本。

**markdown 仍是 source of truth，HTML 是派生产物**。HTML 不补充原文档没有的信息——要补改 markdown 重新 render。

## 何时使用

**应该用：**

- `overlay-superpowers.md` 里走完 design-doc-writing skill 后链式调用本 skill
- 用户说「把这份设计文档渲染成 HTML / 转 HTML / 生成展示版 / 生成 HTML 制品」
- 你即将创建一个 `*-design.html` 渲染产物

**不要用：**

- 写 markdown 设计文档本身（那是 design-doc-writing 的事）
- 渲染非设计文档的 markdown（README、changelog、blog post 等）
- 渲染未完成 / draft 状态、内容明显不全的 markdown（先写好 markdown 再 render）

## 输入

- 默认：渲染**最近写的**设计文档（路径来自 design-doc-writing 的输出，或 `docs/plans/{username}/` 下最新文件）
- 显式：用户指定 path（绝对或相对都接受）

## 输出契约

| 维度 | 要求 |
|---|---|
| 文件名 | 与 markdown **同目录、同名、换后缀 `.html`** |
| 形态 | single-file（项目内不分文件） |
| 依赖 | **CDN 可用**（Google Fonts / highlight.js / Mermaid / Tailwind 等）。但必须有降级：CDN 失败时核心阅读体验不能崩——字体用 fallback 系统字体栈，代码块即使没高亮也要可读 |
| 响应式 | 移动端 / 平板可读（用 media query 处理断点） |
| 文件大小 | 控制在 200KB 以内（含 CDN 引用不计）；超过则考虑章节折叠 |

## 必须的 5 个交互（**不可省**）

无论文档内容多简单，这 5 个交互**都要有**：

1. **TOC 侧栏**——左侧固定（移动端折叠为顶部下拉）；滚动时跟随当前章节高亮
2. **章节折叠**——`<details>` 或自写脚本；点击 H2/H3 大标题可折叠该节；默认全展开
3. **暗黑模式 toggle**——右上角按钮；切换写入 `localStorage`，下次打开记住偏好
4. **代码高亮**——按语言 token 着色。highlight.js / Prism CDN 推荐，或手写 CSS 类均可
5. **回到顶部**——滚动超过一屏时浮出 floating 按钮

## 可选加分项（看内容判断）

文档内容**有相关结构时才加**：

- **SVG 数据流图 / 架构图**——文档讲架构、调用流时画
- **方案对比 split 视图**——文档有「方案 A vs 方案 B」时用左右栏对比
- **代码 diff 视图**——文档有 before/after 代码时用并排或行内 diff
- **Alternatives Considered 折叠隐藏**——被否决方案默认折叠，点击展开
- **决策树 SVG**——文档有判定流程（如 wiki-update 的整合决策树）时画图

## Vibe 设计流程（写 CSS 前先想这些）

**Vibe rendering 的灵魂——不是凭空臆想，是为这份文档"选 flavor + 选基底 + 加个性"。**

拿到 markdown 后，**先按下面 4 步选基底再写 CSS / JS**：

### 0. 必读 manifesto（动手前的态度校准）

强制 Read 这 3 个 references——它们叠加在 preset 之上，是反 AI slop 的硬规则：

1. **`references/aesthetics.md`** — 字体 NEVER 列表（Inter / Roboto / Arial / Space Grotesk 禁用）/ 12 种 BOLD flavor / dominant + sharp accent 配色原则
2. **`references/motion.md`** — page-load staggered reveal / scroll-trigger / details 平滑展开 / hover surprise 等动效 recipe
3. **`references/background.md`** — noise texture / dot grid / gradient mesh / CRT scanline / drop cap 等背景细节

> ⚠️ **跳过本步 = 默认 AI slop**。preset 给的是骨架，但骨架默认配 Inter + solid color = 撞脸所有 SaaS。manifesto 把骨架"染色"成 distinctive。

### 1. 先选 BOLD flavor（aesthetics.md 12 种里选 1）

不是混合——committed to one：`editorial` / `brutally minimal` / `industrial` / `vintage computing` / `brutalist` / `editorial luxury` / 等。

design-doc 默认偏向前 4 种。选了之后再去选 preset。

### 2. 选 preset（视觉骨架）

`references/presets/` 下有 8 个**真实站点抽出来的设计系统** preset。**不要凭空发挥**，先按下表 + 内容性格选一个 preset 作为视觉基底，**Read 那个文件**，拿到完整的 design token（color hex / typography hierarchy / component spec / 5 个必有交互的具体处理）。

| Doc 性格 / 类型 | 推荐 preset | 一句话气质 |
|---|---|---|
| ADR / 严肃 decision / RFC（强调权威感） | `vercel-geist` | pure black + Geist 字体 + 极简极客 |
| 大型 PRD / 重要对外提案 | `stripe-purple` | 紫渐变 + 优雅 light + 商业感 |
| Feature design doc（产品工程） | `linear-precision` | 暗紫 dark + 精密克制 |
| **通用 design-doc（不知道选啥就这个）** | `mintlify-reading` | 绿色 accent + 双栏 reading-optimized |
| Refactor / exploration / playful 主题 | `posthog-playful` | dev-friendly 暗色 + 有人情味的色彩 |
| CLI 工具 / 终端 / 块状交互文档 | `warp-blocks` | IDE 块状 + 命令面板感 |
| 极客向 CLI / 命令行项目 ADR | `terminal-mono` | void-black + 全 mono + emerald/phosphor 强调 |
| 长篇 thinking piece / 技术随笔 | `tufte-essay` | 衬线 + sidenotes + 学术留白（light-only） |

选不准时默认 `mintlify-reading`——它最通用、阅读门槛最低。

> ⚠️ 不要"自己想一套配色 + 自己挑字体"——所有"凭空发挥"的产物都会回到平庸的浅蓝/灰白。Preset 是天花板抬升器。

### 3. 这份文档的 personality 是什么？（在 preset 上调 accent / 强调色）

preset 给骨架，**accent 用来在骨架上"染色"**，依 frontmatter 的 type + 内容情感微调：

| type / 内容性质 | accent 倾向 | 在 preset 上怎么用 |
|---|---|---|
| `*-decision` / ADR | 克制中性 | 用 preset 默认 accent，不要换 |
| `*-feature` | 活力 | accent 用 preset 调色板里**最亮**的那个 |
| `*-refactor` | 阶段感 | 用 preset 的 status color（绿=完成/橙=进行中/红=阻塞）|
| `*-bugfix` | 警示但专业 | accent 用 preset 调色板里的 warning/danger 色 |

### 4. 内容里有什么独特结构需要为它定制？

扫文档章节，看到这些**主动加视觉处理**：

| 内容特征 | 视觉处理 |
|---|---|
| 架构 / 数据流描述 | 画 inline SVG（节点 + 箭头）|
| 「方案 A vs B」表格 | split 视图（左右栏对比） |
| 阶段步骤 / 迁移路径 | 横向或纵向时间线 |
| 失败模式表 | color-coded 行（按严重度上色）|
| 决策树 / if-else 流程 | SVG 决策树 |
| 大量代码引用 | 双栏布局（左 TOC + 右代码主导）|
| Alternatives Considered | 默认折叠隐藏，点击展开 |

### 5. 这份文档的「展示亮点」是什么？

**每份文档应该有 1-2 个特别为它定制的视觉处理**——不是套通用模板。

例：

- 「rules 注入机制」文档 → 顶部一张数据流 SVG（hook → rules → context）作 hero
- 「wiki-update 命令」文档 → 整合判断决策树 SVG + 折叠的整合 examples 表格
- 「ADR：选 PG 不选 SQLite」 → Consequences 节用 ✅⚠️❌ 三色 grid

**Vibe 不等于乱来。**preset（视觉骨架）和"5 个必有交互"是地基，亮点是在地基上发挥个性。

## 视觉风格准则

**核心准则：preset 是天花板。** 选了 preset 就老老实实抄它的 color / typography / component / shadow，不要"觉得自己审美更好"就乱改——所有"凭空发挥"的产物会回到平庸的浅蓝/灰白。

每个 preset 已经给了：
- 字体 CDN + fallback stack（Inter / Geist / IBM Plex / JetBrains Mono / ET Book 等都已在 preset 内定好）
- 完整 color token（不是"navy/teal"抽象词，是具体 hex）
- Typography hierarchy（H1/H2/H3/body/code 的 size/weight/line-height/letter-spacing）
- 组件规格（buttons / cards / inputs / code blocks / tables）
- 阴影与边框系统
- "5 个必有交互"在该 preset 下的具体落实方案

**全局兜底（与 preset 无关，永远成立）：**

✅ 做：

- 合理留白（正文 `max-width: 760-880px`、行高在 preset 给的范围内）
- 表格 hover 高亮 + 斑马纹（preset 没说就用 `rgba(0,0,0,0.02)` 兜底）
- 链接 hover 动效（underline 渐入 / 颜色微变）

❌ 不做：

- 用默认 `<h1>`/`<p>`/`<pre>` 无样式
- 重型 UI 框架全套引入（Bootstrap / Material / 整套 React）——但 Tailwind CDN utility 可用作补丁
- jQuery / React / Vue 等运行时框架——vanilla JS 已够用
- **绕过 preset 自己选字体 / 调色板**（除非用户明确说"换个主色"）
- 一坨墙 of text、无视觉节奏

## 工作流

1. **Read** 输入的 markdown 文件全文
2. **理解结构**：扫 frontmatter（type / topic / date / author / status）+ 章节布局
3. **必读 manifesto**（反 AI slop 校准）：依次 Read `references/aesthetics.md` + `references/motion.md` + `references/background.md`
4. **选 BOLD flavor**（aesthetics.md 12 种选 1，commit 到底，不要混合）
5. **选 preset 骨架**：按 Vibe step 2 决策表选一个 preset
6. **Read 选中的 preset**：`references/presets/<name>.md` 全文，拿到完整 design token
7. **字体 sanity check**：若 preset 默认字体 ∈ NEVER 列表（Inter / Roboto / Arial / Space Grotesk）→ 按 `aesthetics.md` 候选表替换；否则保留 preset 字体
8. **在 preset 上做局部决策**：
   - accent 倾向（依文档 type，见 Vibe step 3）
   - 哪些章节适合 SVG 图（架构 / 数据流 / 决策树）
   - 是否有 alternatives 节适合折叠隐藏
   - 1-2 个为这份文档定制的视觉亮点（Vibe step 5）
   - 从 `motion.md` 选 2-3 个 recipe（默认 1 + 2）
   - 从 `background.md` 选 1-2 个 recipe（按 flavor 推荐表）
9. **生成** single-file HTML：
   - `<head>` 内联 `<style>`：字体 CDN `<link>` + CSS reset + preset token + flavor 染色 + motion keyframes + background recipe + 响应式 media query + 暗黑模式（除非 preset 明示 light-only）
   - `<body>` 渲染内容：preset 指定的 layout；frontmatter 转顶部 metadata 卡片
   - `<script>` 内联 vanilla JS：TOC 滚动高亮 + 折叠 + 暗黑切换 + 回到顶部 + motion 触发
   - SVG 直接嵌入；fill / stroke 用 preset 调色板
10. **写入** 与 markdown 同目录、同名、`.html` 后缀
11. **过 NEVER 清单**：aesthetics.md 末尾的 NEVER 清单逐条检视——任何一条命中 → 改
12. **报告**：「渲染完成：`<path>`，flavor：`<flavor>`，preset：`<name>`。双击浏览器打开查看。」

## 反模式

- ⚠️ **CDN 没有 fallback**——CDN 可用，但字体要有 system-ui fallback，代码即使没高亮也要可读；不要假设网络永远好
- ❌ **完全照搬 markdown 结构**——HTML 是新载体，可重组：TL;DR 放醒目位置、alternatives 折叠隐藏、frontmatter 转 metadata 卡片
- ❌ **过度 vibe 牺牲一致性**——色板和 SVG 可以变，但 5 个必有交互**永远不可省**
- ❌ **HTML 比 markdown 多新信息**——HTML 是派生不是再创作；想补充信息要改 markdown 重渲染
- ❌ **超长不切分**——20+ 章节的文档，HTML 应充分利用折叠 / TOC 跳转，不能一坨展开
- ❌ **暗黑模式只反色**——要专门设计暗黑配色（深底 + 高对比文字 + 调饱和度的强调色），不是简单 `filter: invert`
- ❌ **TOC 不跟随滚动**——TOC 必须有"当前章节高亮"，否则失去导航价值
- ❌ **跳过 vibe 流程直接套通用模板**——拿到文档不思考 personality 就开始写 CSS——所有文档长一样就失去 HTML 的核心价值
- ❌ **不读 preset 凭印象写**——选了 `vercel-geist` 不去 Read preset 文件、靠"我大概记得 Vercel 是黑白"就开始写——preset 的精华在 hex / hierarchy 表里，不读等于没选
- ❌ **挑选 preset 时凭"我喜欢"而非 doc personality**——`tufte-essay` 适合长篇 thinking 不适合 CLI 工具 ADR；选错 preset 比平庸更糟

## 边界情况

| 场景 | 处理 |
|---|---|
| markdown 文件不存在 | 报错并停止：「找不到 `<path>`，请确认路径或先调 design-doc-writing 生成 markdown」 |
| markdown 是空文件 / 只有 frontmatter | 报错并停止：「文档内容为空，无内容可渲染」 |
| markdown 章节过多（>20 个 H2） | 默认全折叠（除 TL;DR 和第一节）；TOC 加层级缩进 |
| markdown 含未关闭的代码块 | 仍尝试渲染，但在报告里提醒「markdown 第 N 行代码块未闭合，HTML 可能错位」 |
| HTML 已存在（重 render） | 直接覆盖；不询问 |
| 用户未指定路径 | 取 `docs/plans/{username}/` 下最新（按 mtime）的 `*-design.md` |
