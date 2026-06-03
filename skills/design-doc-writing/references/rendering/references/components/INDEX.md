# Components Index

design-doc 渲染时**重复出现的内容块**——每个 component 是一份 paste-ready 的 HTML + CSS snippet，**preset-agnostic**（颜色用 preset 提供的 CSS variables，不写死 hex）。

> **角色**：preset 给"全局视觉骨架"（color tokens / typography / shadow / 5 必有交互）；component 给"局部内容卡片"（problem-block / timeline / callout 等）。两者**正交**——任意 preset × 任意 component 都能组合。

## Agent 使用流程

1. **扫 markdown** —— 识别命中哪些 component 的触发 pattern（见下方索引表）
2. **Read 命中的 component md** —— 拿 HTML 结构 + CSS Cheatsheet
3. **合并 cheatsheet 进 `<style>`** —— 紧跟 preset CSS Cheatsheet 后面 paste
4. **包裹 markdown 渲染输出** —— 把命中段落用 component 的 HTML 结构包起来

> ⚠️ component 假定 preset 提供了下方「**CSS Variables 契约**」列出的 var。如果选的 preset 没提供某 var，agent 要么在 `<style>` 里兜底定义，要么改选 preset。

## 索引表（触发 → component → 用途）

| Markdown 触发 pattern | Component | 一句话用途 |
|---|---|---|
| **必触发**（每份 design-doc 都有 frontmatter） | `frontmatter-card` | type/date/status/author 元数据卡 |
| **推荐触发**（ADR 短决策 / < 500 字文档可省，其他都加） | `hero-svg` | 顶部数据流 SVG（3:1 横向） |
| `#### 问题 N：xxx` + 说明/方案对比/结论 | `problem-block` | 问题三件套结构容器 |
| `### 逻辑 N：xxx` + 业务流/关键契约/异常 | `logic-block` | 逻辑三子节结构容器 |
| 标注 "**业务流**" 下的 `<pre>` 块 | `pseudocode-block` | 顶部 PSEUDOCODE label 的伪代码块 |
| 「方案 A vs B」表格 / 列表 | `split-compare` | 左右栏对比卡 + 推荐 badge |
| 含 "场景 / 触发 / 处理 / 上抛吞" 的表格 | `failure-table` | 失败模式表（按严重度 color-coded） |
| 「阶段一/二/三」「迁移步骤」「Phase 1/2/3」 | `timeline` | 横/纵向时间线 |
| if-else / 决策树文字描述 | `decision-tree` | 决策树 SVG |
| 状态转换 / "进入 X 态 → Y 态" 描述 | `state-machine` | 状态机 SVG |
| ASCII 流程图（`节点 ↓ 节点`） | `flow-figure` | SVG 主视觉 + `<details>` ASCII fallback |
| 「Alternatives Considered」节 | `alternatives-fold` | 默认折叠的备选方案容器 |
| 「注意 / 警告 / 提示 / 风险」段 | `callout` | info/warning/danger/success 4 色横条 |
| 散布的强调标签 / 快捷键 / 分隔 | `primitives` | badge / chip / eyebrow / kbd / divider |

## 命名约定

- **不加 `dd-` 前缀** —— 沿用 SKILL.md 行 305-388 已经定义的 `.problem-block` / `.logic-block` / `.three-piece-*` / `.hero` / `.flow-figure` 等命名；不引入外部 UI 库时无撞名风险
- **kebab-case** —— `.problem-block`、`.failure-table`、`.alt-fold` 等
- **修饰子类用 `__` 或 `-`** —— `.problem-block__title` 或 `.three-piece-conclusion` 都接受，保持单文件内一致即可

## CSS Variables 契约

所有 component 期望 preset 提供以下 CSS variables。preset 已全部就位（vercel-geist 行 220-238 是参考实现）：

**色彩**
- `--bg`, `--bg-surface`, `--bg-panel`, `--bg-hover`
- `--text-primary`, `--text-secondary`, `--text-tertiary`
- `--accent`, `--brand`
- `--border-subtle`, `--border-std`, `--border-strong`

**code**
- `--code-bg`, `--code-inline-bg`

**shadow**
- `--shadow-ring`, `--shadow-card`

**status（component 可选用，preset 不强制提供，缺则 component 内兜底）**
- `--status-info-bg`, `--status-info-text`
- `--status-warn-bg`, `--status-warn-text`
- `--status-danger-bg`, `--status-danger-text`
- `--status-success-bg`, `--status-success-text`

**字体**
- `--font-sans`, `--font-mono`

## 与 preset 的协作

- preset 决定**全局**：body / h1-h3 / p / pre / code / a / table 基础样式
- component 决定**局部容器**：`.problem-block` / `.callout` / `.timeline` 等结构性卡片
- 冲突时 preset 优先；component 不重定义已被 preset 覆盖的元素，只补容器和子元素 class

## 与 5 必有交互的协作

components **不取代** 5 必有交互（TOC / 折叠 / 主题切换 / 高亮 / 回到顶部）——那些由 preset 提供。components 内出现 `<details>`（如 alternatives-fold / flow-figure）借用 preset 已定义的 `<details>` 样式，不重写。

## 文件清单

```
components/
├── INDEX.md                  # 本文件
├── frontmatter-card.md
├── hero-svg.md
├── problem-block.md
├── logic-block.md
├── pseudocode-block.md
├── split-compare.md
├── failure-table.md
├── timeline.md
├── decision-tree.md
├── state-machine.md
├── flow-figure.md
├── alternatives-fold.md
├── callout.md
└── primitives.md
```
