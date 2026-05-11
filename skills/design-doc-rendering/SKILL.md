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
| 形态 | single-file（CSS / JavaScript / SVG 全部内联） |
| 依赖 | **不引入外网资源**（不用 CDN、不用 Google Fonts、不用 highlight.js）。可双击浏览器离线打开 |
| 响应式 | 移动端 / 平板可读（用 media query 处理断点） |
| 文件大小 | 控制在 100KB 以内；超过则考虑章节折叠或拆分 |

## 必须的 5 个交互（**不可省**）

无论文档内容多简单，这 5 个交互**都要有**：

1. **TOC 侧栏**——左侧固定（移动端折叠为顶部下拉）；滚动时跟随当前章节高亮
2. **章节折叠**——`<details>` 或自写脚本；点击 H2/H3 大标题可折叠该节；默认全展开
3. **暗黑模式 toggle**——右上角按钮；切换写入 `localStorage`，下次打开记住偏好
4. **代码高亮**——手写 CSS 类（按语言 token 着色），**不引 highlight.js / prism CDN**
5. **回到顶部**——滚动超过一屏时浮出 floating 按钮

## 可选加分项（看内容判断）

文档内容**有相关结构时才加**：

- **SVG 数据流图 / 架构图**——文档讲架构、调用流时画
- **方案对比 split 视图**——文档有「方案 A vs 方案 B」时用左右栏对比
- **代码 diff 视图**——文档有 before/after 代码时用并排或行内 diff
- **Alternatives Considered 折叠隐藏**——被否决方案默认折叠，点击展开
- **决策树 SVG**——文档有判定流程（如 wiki-update 的整合决策树）时画图

## 视觉风格准则

风格要像 **2024 年后的现代技术文档**，不是 2010 年的 GitHub README。

✅ 做：

- 现代 sans-serif（用 `system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif` 系统字体栈）
- 合理留白（正文 `max-width: 760px`、`line-height: 1.7`+）
- 配色专业（主色 navy / forest green / 深紫 + 强调色橙/青；不只是纯黑白）
- 代码块圆角（`border-radius: 8px`）+ 内边距 + 等宽字（`"SF Mono", Menlo, Consolas, monospace`）
- 表格有 hover 高亮 + 斑马纹
- 引用块用左边色条 + 浅色背景，不是默认灰边
- 链接有 hover 动效（underline 渐入、颜色变化）

❌ 不做：

- 默认 `<h1>`/`<p>`/`<pre>` 无样式
- Bootstrap / Tailwind / Material 全套引入——重，破坏 single-file
- jQuery / React / 重型 JS 框架——纯 vanilla JS 完成
- 一坨墙 of text、无视觉节奏

## 工作流

1. **Read** 输入的 markdown 文件全文
2. **理解结构**：扫 frontmatter（type / topic / date / author / status）+ 章节布局
3. **设计**：根据文档内容决定：
   - 主色调（设计文档严肃感建议 navy / 深绿 / 深紫 + 一个强调色）
   - 哪些章节适合用 SVG 图（架构 / 数据流 / 决策树）
   - 是否有 alternatives / 备选方案节适合折叠隐藏
4. **生成** single-file HTML：
   - `<head>` 内联 `<style>`：CSS reset + 主样式 + 响应式 media query + 暗黑模式 `[data-theme="dark"]` 选择器
   - `<body>` 渲染内容：左 TOC + 右主内容；frontmatter 转顶部 metadata 卡片
   - `<script>` 内联 vanilla JS：TOC 滚动高亮（IntersectionObserver）+ 折叠（click 监听）+ 暗黑切换（toggle + localStorage）+ 回到顶部
   - SVG 直接嵌入（不引外链）
5. **写入** 与 markdown 同目录、同名、`.html` 后缀
6. **报告**：「渲染完成：`<path>`。双击浏览器打开查看。」

## 反模式

- ❌ **依赖 CDN**——破坏 single-file 离线可用承诺。所有资源内联。
- ❌ **完全照搬 markdown 结构**——HTML 是新载体，可重组：TL;DR 放醒目位置、alternatives 折叠隐藏、frontmatter 转 metadata 卡片
- ❌ **过度 vibe 牺牲一致性**——色板和 SVG 可以变，但 5 个必有交互**永远不可省**
- ❌ **HTML 比 markdown 多新信息**——HTML 是派生不是再创作；想补充信息要改 markdown 重渲染
- ❌ **超长不切分**——20+ 章节的文档，HTML 应充分利用折叠 / TOC 跳转，不能一坨展开
- ❌ **暗黑模式只反色**——要专门设计暗黑配色（深底 + 高对比文字 + 调饱和度的强调色），不是简单 `filter: invert`
- ❌ **TOC 不跟随滚动**——TOC 必须有"当前章节高亮"，否则失去导航价值

## 边界情况

| 场景 | 处理 |
|---|---|
| markdown 文件不存在 | 报错并停止：「找不到 `<path>`，请确认路径或先调 design-doc-writing 生成 markdown」 |
| markdown 是空文件 / 只有 frontmatter | 报错并停止：「文档内容为空，无内容可渲染」 |
| markdown 章节过多（>20 个 H2） | 默认全折叠（除 TL;DR 和第一节）；TOC 加层级缩进 |
| markdown 含未关闭的代码块 | 仍尝试渲染，但在报告里提醒「markdown 第 N 行代码块未闭合，HTML 可能错位」 |
| HTML 已存在（重 render） | 直接覆盖；不询问 |
| 用户未指定路径 | 取 `docs/plans/{username}/` 下最新（按 mtime）的 `*-design.md` |
