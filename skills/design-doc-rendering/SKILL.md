---
name: design-doc-rendering
description: 把 markdown 设计文档渲染成 single-file HTML 展示版。Workflow：read preset → 从 Class Cheatsheet 起步 → 套 manifesto。HTML 含 TOC / 章节折叠 / 双 mode toggle / 代码高亮 / 回到顶部 5 个必有交互；CDN 字体与高亮可用但必须有 system 字体栈 fallback。当 overlay-superpowers.md 走完 design-doc-writing 后链式调用；用户说「转 HTML / 生成展示版 / 渲染 HTML 制品」时也用。不要用来渲染 README / changelog / blog 等非设计文档。
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
3. **light / dark 主题（强制双 mode）**——所有 preset 必须同时提供 light + dark token；右上角 toggle 切换并写入 `localStorage`；详见下方「主题策略」节
4. **代码高亮**——按语言 token 着色。highlight.js / Prism CDN 推荐，或手写 CSS 类均可
5. **回到顶部**——滚动超过一屏时浮出 floating 按钮

## 主题策略（强制规则）

**所有 preset 不论原设计取舍，都必须同时支持 light + dark**——即使 preset 文档里说"dark-only 是灵魂"也要给完整 light token 作 fallback。理由：用户预期、屏幕环境多样、accessibility。

### 初始主题选择优先级

渲染时按以下顺序决定首次加载的主题：

1. **`localStorage.getItem('doc-theme')`** 有值（`'light'` / `'dark'`）→ 直接用，用户手动切过就尊重偏好
2. 否则按**浏览器本地时间**：`new Date().getHours()` 在 `[6, 19)` → `light`；否则 → `dark`
3. （不使用 `prefers-color-scheme`——用户明确要求按时间，不按 system 偏好）

### 标准 JS 模板（每份 HTML 必嵌）

```html
<script>
(function() {
  const KEY = 'doc-theme';
  const stored = localStorage.getItem(KEY);
  let theme;
  if (stored === 'light' || stored === 'dark') {
    theme = stored;
  } else {
    const h = new Date().getHours();
    theme = (h >= 6 && h < 19) ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
</script>
```

**关键**：这段 inline 脚本必须放在 `<head>` 内、CSS `<link>` 之后、`<body>` 之前——避免 FOUC（先按默认渲染一帧再切）。

### Toggle 按钮逻辑

```js
const toggleBtn = document.getElementById('themeToggle');
toggleBtn.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('doc-theme', next);
});
```

### CSS 选择器约定

所有 preset 用 `[data-theme="light"]` / `[data-theme="dark"]` 二选一（**不要** `prefers-color-scheme` media query 作 primary 切换源——会与 JS 控制冲突）：

```css
:root,
[data-theme="dark"] { --bg: #0f1115; --text: #f5f6f8; /* dark tokens */ }
[data-theme="light"] { --bg: #fafaf7; --text: #1a1a1f; /* light tokens */ }
```

### 单 mode 例外（已废除）

历史上 `linear-precision` / `terminal-mono` / `tufte-essay` 标过"single-mode 是设计灵魂"——**现在全部废除**。preset 文件内保留原设计取舍说明作为"primary recommendation"，但**必须提供另一 mode 的完整 token**。

> 渲染时如果选了 mode-locked preset 的 primary（如 linear-precision dark / tufte-essay light），切换到 secondary mode 时 preset 应保证"可读、不灾难"，**不强求媲美 primary**。

## MOTION_INTENSITY Dial（可选调档）

> 借鉴 taste-skill 的 dial 思路——preset 给视觉骨架，dial 调强度。preset 的 light/dark token 与 typography 不受 dial 影响，dial 只决定**动效层级**。

**默认 5**（中等）。用户在 prompt 里说"动效强一点 / 弱一点 / 静态 / 打印友好 / 演讲版"时上调或下调：

| 档位 | 含义 | 落地到 motion.md / background.md recipe |
|---|---|---|
| **1-3 静态** | 只 hover / active，几乎无 page-load 动画 | motion.md recipe **全部跳过**；不嵌 motion library；background.md 只用 static recipe（noise / dot grid），跳过 gradient mesh 等持续动画 |
| **4-7（默认 5）** | 标准 page-load staggered reveal + scroll-trigger 选 1-2 个 | motion.md 挑 staggered reveal + details 平滑展开 + 1 个 hover surprise；不上 perpetual loop |
| **8-10 强烈** | 全 recipe + perpetual micro-interactions | motion.md 全 recipe + pulse / float / shimmer 等无限动效；hover 用 spring physics；scroll-trigger 多处触发 |

**触发判定**（按优先级取首项）：
1. 用户 prompt 明确档位词 → 直接用：「安静 / 克制 / 打印 / 静态」→ 2；「炫 / 演讲版 / 动感」→ 8
2. 文档 frontmatter 暗示场景：`*-decision` / ADR → 3；`*-feature` → 5；marketing-ish 演示 → 7
3. 都没说 → 5

> ⚠️ Dial 是**叠在 preset 之上的乘数**，不替换 preset 的视觉决策。Dial 只影响"动多少"，不影响"长什么样"。

## Vibe 设计流程（写 CSS 前先想这些）

**Vibe rendering 的灵魂——不是凭空臆想，是为这份文档"选 flavor + 选基底 + 加个性"。**

拿到 markdown 后，**先按下面 4 步选基底再写 CSS / JS**。本节子小节用描述性标题而非数字编号——避免与下方「工作流」12 步编号混淆。

### 必读 manifesto（动手前的态度校准）

强制 Read 这 3 个 references——它们叠加在 preset 之上，是反 AI slop 的硬规则：

1. **`references/aesthetics.md`** — 字体 NEVER 列表（Inter / Roboto / Arial / Space Grotesk 禁用）/ 12 种 BOLD flavor / dominant + sharp accent 配色原则 / Anti-Generic Content（Jane Doe Effect）
2. **`references/motion.md`** — page-load staggered reveal / scroll-trigger / details 平滑展开 / hover surprise 等动效 recipe
3. **`references/background.md`** — noise texture / dot grid / gradient mesh / CRT scanline / drop cap 等背景细节

> ⚠️ **跳过本步 = 默认 AI slop**。preset 给的是骨架，但骨架默认配 Inter + solid color = 撞脸所有 SaaS。manifesto 把骨架"染色"成 distinctive。

### 选 BOLD flavor（aesthetics.md 12 种里选 1）

不是混合——committed to one：`editorial` / `brutally minimal` / `industrial` / `vintage computing` / `brutalist` / `editorial luxury` / 等。

design-doc 默认偏向前 4 种。选了之后再去选 preset。

### 选 preset（视觉骨架）

`references/presets/` 下有 8 个**真实站点抽出来的设计系统** preset。**不要凭空发挥**，先按下表 + 内容性格选一个 preset 作为视觉基底，**Read 那个文件**，拿到完整的 design token（color hex / typography hierarchy / component spec / 5 必有交互的具体处理 / Class Cheatsheet）。

| Doc 性格 / 类型 | 推荐 preset | 一句话气质 |
|---|---|---|
| ADR / 严肃 decision / RFC（强调权威感） | `vercel-geist` | pure black + Geist 字体 + 极简极客 |
| 大型 PRD / 重要对外提案 | `stripe-purple` | 紫渐变 + 优雅 light + 商业感 |
| Feature design doc（产品工程） | `linear-precision` | 暗紫 dark + 精密克制 |
| **通用 design-doc（不知道选啥就这个）** | `mintlify-reading` | 绿色 accent + 双栏 reading-optimized |
| Refactor / exploration / playful 主题 | `posthog-playful` | dev-friendly 暗色 + 有人情味的色彩 |
| CLI 工具 / 终端 / 块状交互文档 | `warp-blocks` | IDE 块状 + 命令面板感 |
| 极客向 CLI / 命令行项目 ADR | `terminal-mono` | void-black + 全 mono + emerald/phosphor 强调 |
| 长篇 thinking piece / 技术随笔 | `tufte-essay` | 衬线 + sidenotes + 学术留白（light primary，dark 为 night-reading fallback）|

选不准时默认 `mintlify-reading`——它最通用、阅读门槛最低（**注意**：mintlify 已切到 Bricolage Grotesque，不再用 Inter）。

> ⚠️ **不要"自己想一套配色 + 自己挑字体"**——所有"凭空发挥"的产物都会回到平庸的浅蓝/灰白。preset 的"是天花板"角色见下方「视觉风格准则」节，本节不重复。

### 调 accent（在 preset 上染色）

preset 给骨架，**accent 用来在骨架上"染色"**，依 frontmatter 的 type + 内容情感微调：

| type / 内容性质 | accent 倾向 | 在 preset 上怎么用 |
|---|---|---|
| `*-decision` / ADR | 克制中性 | 用 preset 默认 accent，不要换 |
| `*-feature` | 活力 | accent 用 preset 调色板里**最亮**的那个 |
| `*-refactor` | 阶段感 | 用 preset 的 status color（绿=完成/橙=进行中/红=阻塞）|
| `*-bugfix` | 警示但专业 | accent 用 preset 调色板里的 warning/danger 色 |

### 内容定制视觉处理（按文档独特结构上视觉）

扫文档章节，看到这些**主动加视觉处理**（视觉定制总表；按文档内容触发）：

| 内容特征 | 视觉处理 |
|---|---|
| 架构 / 数据流描述 | 画 inline SVG（节点 + 箭头）|
| 「方案 A vs B」表格 | split 视图（左右栏对比） |
| 阶段步骤 / 迁移路径 | 横向或纵向时间线 |
| 失败模式表 | color-coded 行（按严重度上色）|
| 决策树 / if-else 流程 | SVG 决策树 |
| 大量代码引用 | 双栏布局（左 TOC + 右代码主导）|
| Alternatives Considered | 默认折叠隐藏，点击展开 |

### 展示亮点（1-2 个为本文档定制的视觉处理）

**每份文档应该有 1-2 个特别为它定制的视觉处理**——不是套通用模板。

例：

- 「rules 注入机制」文档 → 顶部一张数据流 SVG（hook → rules → context）作 hero
- 「wiki-update 命令」文档 → 整合判断决策树 SVG + 折叠的整合 examples 表格
- 「ADR：选 PG 不选 SQLite」 → Consequences 节用 ✅⚠️❌ 三色 grid

**Vibe 不等于乱来**——preset 与「5 必有交互」是地基（见下方「视觉风格准则」），亮点是在地基上发挥个性。

## 视觉风格准则

**核心准则：preset 是天花板。** 选了 preset 就老老实实抄它的 color / typography / component / shadow，不要"觉得自己审美更好"就乱改——所有"凭空发挥"的产物会回到平庸的浅蓝/灰白。本节是这一准则的**唯一规范出处**，前面 Vibe 节里的提醒都指回这里。

每个 preset 已经给了：
- 字体 CDN + fallback stack（Geist / IBM Plex / JetBrains Mono / Source Serif 4 / Bricolage Grotesque 等都已在 preset 内定好；**Inter 已按 manifesto NEVER 列表禁用**——若 preset 文档历史用 Inter，cheatsheet 里已切到推荐替代）
- 完整 color token（不是"navy/teal"抽象词，是具体 hex）
- Typography hierarchy（H1/H2/H3/body/code 的 size/weight/line-height/letter-spacing）
- 组件规格（buttons / cards / inputs / code blocks / tables）
- 阴影与边框系统
- "5 必有交互"在该 preset 下的具体落实方案
- **Class Cheatsheet（drop-in CSS snippet）**——paste-ready 的 `<style>` 骨架（CSS variables + typography + 5 必有交互核心 snippet），agent 拿到直接 copy 扩展，不用从 token 表反向手写

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

## Performance Guardrails（强制规则）

> 借鉴 taste-skill 节 5——HTML 单文件场景的硬性能约束，独立成节方便检索。

- **Hardware Acceleration**：永远 animate `transform` / `opacity`；**绝不**直接 animate `top` / `left` / `width` / `height`（会触发 layout / paint，移动端立刻卡）
- **Mobile Safari Viewport**：full-height 区块用 `min-height: 100dvh` 而非 `100vh`，避免 iOS 工具栏伸缩抖动；hero 区也用 `dvh`
- **Grain / Noise 滤镜挂载**：grain / noise overlay **只能**挂在 `position: fixed; inset: 0; pointer-events: none` 的伪元素或独立层上；**严禁**挂在滚动容器内部（GPU 持续重绘 = 移动端卡死）
- **Scroll 监听禁用 raw**：`window.addEventListener('scroll', ...)` 主线程阻塞——用 `IntersectionObserver`（视区进入触发）或 CSS `@supports (animation-timeline: scroll())`（原生 scroll-tied 动画）
- **Z-Index 节制**：z-index 只为 sticky nav / modal / toast / 浮动 floating button 等系统层级保留；正文严禁随意散布 `z-50` / `z-10`
- **CDN 失败兜底**：Google Fonts / highlight.js CDN 必须有 system 字体栈 fallback（写在 `font-family` 完整 fallback 链）；CDN 挂掉时核心可读不能崩
- **文件大小 ≤ 200KB**（与「输出契约」节的同名约束指向同一规则；以此为准）
- **Perpetual animation 隔离**（当 MOTION_INTENSITY ≥ 8）：无限循环动画（pulse / float / shimmer）必须挂独立元素、避免与其他 animated 元素共享 stacking context；GPU 层不能无限扩张

### Snippet 速查

```css
/* full-height 区块——iOS 工具栏伸缩友好 */
.hero { min-height: 100dvh; }   /* NOT 100vh */

/* noise overlay 正确挂载——独立 fixed 层 */
.noise-layer {
  position: fixed; inset: 0; z-index: 9999;
  pointer-events: none;
  background-image: url("data:image/png;base64,...");
  opacity: 0.02;
}
/* ❌ 错误：把 .noise-layer 挂在 <main> 或 <article> 滚动容器内 */

/* TOC 高亮——用 IntersectionObserver 不要 scroll listener */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    const link = document.querySelector(`.toc a[href="#${e.target.id}"]`);
    if (e.isIntersecting) link?.classList.add('active');
    else link?.classList.remove('active');
  });
}, { rootMargin: '-20% 0px -70% 0px' });
document.querySelectorAll('h2, h3').forEach(h => observer.observe(h));
```

## 工作流

1. **Read** 输入的 markdown 文件全文
2. **理解结构**：扫 frontmatter（type / topic / date / author / status）+ 章节布局
3. **必读 manifesto**（反 AI slop 校准）：依次 Read `references/aesthetics.md` + `references/motion.md` + `references/background.md`
4. **选 BOLD flavor**（aesthetics.md 12 种选 1，commit 到底，不要混合）
5. **选 preset 骨架**：按 Vibe 节「选 preset」决策表选一个 preset
6. **Read 选中的 preset**：`references/presets/<name>.md` 全文——重点是 **Class Cheatsheet 节**（drop-in CSS 起点）+ Map to Design Doc Components + 5 必有交互
7. **字体 sanity check**：若 preset 默认字体 ∈ NEVER 列表 → 查 `aesthetics.md` 「例外：preset 内已选定字体」表——若 preset 在例外表 → 保留；不在 → 按候选表替换（如 mintlify 已切到 Bricolage Grotesque）
8. **确定 MOTION_INTENSITY 档位**（1-10，默认 5）——按上方「MOTION_INTENSITY Dial」节的触发判定决定，**显式记下数字**，后续 step 9 引用
9. **在 preset 上做局部决策**：
   - accent 倾向（依文档 type，见 Vibe 节「调 accent」）
   - 哪些章节适合 SVG 图（架构 / 数据流 / 决策树，见 Vibe 节「内容定制视觉处理」表）
   - 是否有 alternatives 节适合折叠隐藏
   - 1-2 个为这份文档定制的视觉亮点（Vibe 节「展示亮点」）
   - 按 step 8 的 MOTION_INTENSITY 档位 → 从 `motion.md` 选对应数量 recipe（dial ≤ 3 → 0 个；4-7 → 1-2 个；8-10 → 全部 + perpetual）
   - 从 `background.md` 选 1-2 个 recipe（按 flavor 推荐表，dial ≤ 3 时跳过动态 recipe）
10. **生成** single-file HTML：
    - `<head>` 内联 `<style>`：字体 CDN `<link>` + **粘贴 preset 的 Class Cheatsheet 作起点** + flavor 染色 + motion keyframes（按 step 8 档位）+ background recipe + 响应式 media query
    - `<body>` 渲染内容：preset 指定的 layout；frontmatter 转顶部 metadata 卡片
    - `<script>` 内联 vanilla JS：TOC 滚动高亮（用 `IntersectionObserver`）+ 折叠 + 暗黑切换 + 回到顶部 + motion 触发
    - SVG 直接嵌入；fill / stroke 用 preset 调色板
11. **写入** 与 markdown 同目录、同名、`.html` 后缀
12. **过 Pre-Flight Check 自检表**（见下方独立节）——任何一项不勾 → 改完再 ship；不许跳
13. **报告**：「渲染完成：`<path>`，flavor：`<flavor>`，preset：`<name>`，motion：`<dial 数值>`。双击浏览器打开查看。」

## 反模式

> **本节 vs Pre-Flight Check 的分工**：反模式 = **陈述性 don't**（理念层；提醒"为什么不能这样"）；Pre-Flight Check = **actionable checkbox**（gate 层；ship 前逐项打勾）。两者覆盖重叠但角色不同，**两节都要过**——反模式让你写之前理解禁区，Pre-Flight 让你 ship 前实际检验。

- ⚠️ **CDN 没有 fallback**——CDN 可用，但字体要有 system-ui fallback，代码即使没高亮也要可读；不要假设网络永远好
- ❌ **完全照搬 markdown 结构**——HTML 是新载体，可重组：TL;DR 放醒目位置、alternatives 折叠隐藏、frontmatter 转 metadata 卡片
- ❌ **过度 vibe 牺牲一致性**——色板和 SVG 可以变，但 5 必有交互（见「必须的 5 个交互」节）**永远不可省**
- ❌ **HTML 比 markdown 多新信息**——HTML 是派生不是再创作；想补充信息要改 markdown 重渲染
- ❌ **超长不切分**——20+ 章节的文档，HTML 应充分利用折叠 / TOC 跳转，不能一坨展开
- ❌ **暗黑模式只反色**——要专门设计暗黑配色（深底 + 高对比文字 + 调饱和度的强调色），不是简单 `filter: invert`
- ❌ **TOC 不跟随滚动**——TOC 必须有"当前章节高亮"，否则失去导航价值
- ❌ **跳过 vibe 流程直接套通用模板**——拿到文档不思考 personality 就开始写 CSS——所有文档长一样就失去 HTML 的核心价值
- ❌ **不读 preset 凭印象写**——选了 `vercel-geist` 不去 Read preset 文件、靠"我大概记得 Vercel 是黑白"就开始写——preset 的精华在 hex / hierarchy 表 + Class Cheatsheet 里，不读等于没选
- ❌ **不用 Class Cheatsheet 反向手写 CSS**——选了 preset 不从其 Class Cheatsheet 起步、自己从 token 表反向凑 `:root` 块——直接 ROI 倒退
- ❌ **挑选 preset 时凭"我喜欢"而非 doc personality**——`tufte-essay` 适合长篇 thinking 不适合 CLI 工具 ADR；选错 preset 比平庸更糟

## Pre-Flight Check（输出前自检表）

> 借鉴 taste-skill 节 10——最后一道 gate。写完 HTML、写入文件**之前**，逐项过一遍。任何一项不勾 → 改完再 ship，不许跳。

**视觉与字体**
- [ ] 字体不在 NEVER 列表（无 Inter / Roboto / Arial / 仅 system-ui / Space Grotesk）？
- [ ] preset 选定后没自己换调色板？accent 选自 preset 内已定义的 hex？
- [ ] light & dark token 都齐全（不论 preset 原始 mode-locked 与否）？
- [ ] 没用纯黑 `#000000`？（用 zinc-950 / charcoal / off-black）
- [ ] 没用紫色 gradient on white（"AI Purple"）默认配色？

**交互**
- [ ] 5 个必有交互齐全（TOC 侧栏 + 章节折叠 + light/dark toggle + 代码高亮 + 回到顶部）？
- [ ] TOC 滚动时跟随当前章节高亮？
- [ ] light/dark toggle 写入 `localStorage`、刷新后保留？
- [ ] 初始 theme 选择按"localStorage → 时间"两步走，**不用** `prefers-color-scheme` 作 primary？

**性能**（Performance Guardrails 对应）
- [ ] 没动画 `top` / `left` / `width` / `height`？
- [ ] full-height 用 `min-height: 100dvh`？
- [ ] grain / noise 挂在 `fixed + pointer-events: none` 元素上？
- [ ] 没 raw `window.addEventListener('scroll')`？
- [ ] 文件 ≤ 200KB（不含 CDN）？

**反 AI slop**（aesthetics.md "Anti-Generic Content" 对应）
- [ ] 没用 generic placeholder 名（John Doe / Acme / SmartFlow / Nexus）？
- [ ] 没用 AI 文案套话（Elevate / Seamless / Unleash / Next-Gen / 深入探讨 / 核心要素）？
- [ ] 没用整数百分比假数据（99.99% / 50% / 100%）？

**结构性**
- [ ] HTML 没补充 markdown 原文档没有的信息？
- [ ] frontmatter 转的顶部 metadata 卡片实际呈现 type / date / status / author？
- [ ] 章节折叠默认状态合理（>20 H2 时默认全折叠，TL;DR 和第一节除外）？
- [ ] **`<head>` 内的 CSS 起点是从 preset 的 Class Cheatsheet 粘贴的**（不是自己反向手写 `:root` 块）？

**MOTION_INTENSITY 档位（dial-specific）**
- [ ] 已显式 commit dial 数值（1-10），与文档场景匹配（ADR ≤ 3，feature/演示 ≥ 5）？
- [ ] 档位 ≤ 3：motion.md / background.md 的动态 recipe 全部跳过、未引 motion library？
- [ ] 档位 ≥ 8：perpetual animation 已隔离到独立元素、未与其他 animated 元素共享 stacking context？

## 边界情况

| 场景 | 处理 |
|---|---|
| markdown 文件不存在 | 报错并停止：「找不到 `<path>`，请确认路径或先调 design-doc-writing 生成 markdown」 |
| markdown 是空文件 / 只有 frontmatter | 报错并停止：「文档内容为空，无内容可渲染」 |
| markdown 章节过多（>20 个 H2） | 默认全折叠（除 TL;DR 和第一节）；TOC 加层级缩进 |
| markdown 含未关闭的代码块 | 仍尝试渲染，但在报告里提醒「markdown 第 N 行代码块未闭合，HTML 可能错位」 |
| HTML 已存在（重 render） | 直接覆盖；不询问 |
| 用户未指定路径 | 取 `docs/plans/{username}/` 下最新（按 mtime）的 `*-design.md` |
