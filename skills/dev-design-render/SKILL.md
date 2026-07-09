---
name: dev-design-render
description: Render design documents (from dev-design-refine) into a styled interactive page published via the Artifact tool — browsable sections, rendered diagrams, shareable URL. Not for UI prototypes (use pd-vd).
---

# dev-design-render — 设计文档 → Artifact 页面

把设计文档（markdown）渲染成可浏览的页面，经 CC 内置 `Artifact` 工具发布为可分享 URL。不只是图——整个文档都渲染：标题变导航、表格变交互表、图有统一渲染约定、代码块等宽排版。

**设计能力来自 artifact-design**：渲染前调用 CC 内置的 `Skill(artifact-design)`（原则型设计指导：角色锚定 / token 双主题 / 反模板化负面清单 / 先 design plan 再编码），为**这份文档的主题**现场设计页面——每份文档得到定制的视觉语言，而不是套同一个壳。这也是 `Artifact` 工具的硬性前置（工具说明要求发布前必须加载该 skill）。

## 非本 skill 请求

UI 原型 → pd-vd。写设计文档 → dev-design-refine。

## Enter Gate

- [ ] dev-design-refine 已完成，设计文档已产出（`.md` 文件）

## 协议

### Step 0: TaskCreate

```
Task 1: 分析文档结构
  Sub-steps: 读设计文档 → 提取章节树 + 图清单 + 表格清单
  Gate: 文档结构分析完成

Task 2: 渲染 + 发布
  Sub-steps: 调 artifact-design 现场设计 → 写页面文件 → Artifact 发布
  Gate: Artifact URL 已产出

Task 3: 验证 + 保存
  Sub-steps: 核对内容完整性 → 产出 receipt
  Gate: 产出已保存

Task 4: 收口 — 交回调用方
  Sub-steps: 向协调器（dev-design）返回 render receipt（Artifact URL + 页面文件路径 + 输入文档未改动），交回主流程；产物关系由协调器记录
  Gate: 已交回调用方（渲染是终点分支，无下游阶段 skill）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

### Step 1: 分析文档结构

**Enter Gate:**
- [ ] 设计文档路径已知

**Core Actions:**

读设计文档，提取：

```
章节树（生成导航用）：
  ## 背景
  ## 前置调研
  ## 资源域
    ### 模块关系图
    ### ImportParser
  ...

图清单（标注类型与复杂度，供设计时决定呈现方式）：
  | 位置 | 类型 | 复杂度 |
  |---|---|---|
  | ## 领域划分 | 域关系图 | 3 节点,清晰 |
  | ## 资源域.BF1 | 流程图 | 4 步串行 |
  | ## 跨域交互 | 时序图 | 3 角色 |
  | ## 迁移策略 | 复杂混合图 | 12+ 节点连线交错 |

表格清单：接口表、TO 表、文件影响表（渲染时做交互增强）
```

**Exit Gate:**
- [ ] 章节树提取完成
- [ ] 图清单 + 类型/复杂度标注
- [ ] 表格清单

### Step 2: 渲染 + 发布

**Enter Gate:**
- [ ] 文档结构分析完成

**Core Actions:**

先调 `Skill(artifact-design)` 加载设计原则，然后：

1. **先写 design plan 再编码**（按 artifact-design 的 Process）：4-6 个命名色值 + 2+ 字体角色 + 一句布局概念——**为这份文档的主题选**（数据产品文档和底层重构文档不该长一样），不落负面清单里的模板化默认。
2. **写页面文件**，落设计文档同目录 `<topic>-design.html`。同时满足 render 侧的领域硬约束（artifact-design 管"好看"，这些管"是设计文档渲染物"）：
   - **Artifact 页面片段，不是完整 HTML 文档**：发布时会被包进 `<!doctype html>…<head>…</head><body>` 骨架——文件里**不写** DOCTYPE / `<html>` / `<head>` / `<body>`，直接写内容 + 内联 `<style>` / `<script>`，并设置一个简洁稳定的 `<title>`
   - **零外链**：CSS/JS 全内联，无 CDN / 网络字体 / fetch——Artifact 的 CSP 拦截一切外部请求，外链资源直接加载失败
   - **双主题跟随 viewer**：`@media (prefers-color-scheme: dark)` 为默认信号 + `:root[data-theme="dark"]` / `:root[data-theme="light"]` 双向覆盖（viewer 的主题切换 stamp `data-theme`，必须两个方向都压得过 media query）。**不要自己做主题切换按钮**——viewer 自带
   - **可导航**：章节树 → 侧边/顶部导航，锚点唯一；长文档要有当前章节高亮
   - **内容忠实**：正文一字不改；代码块内含 `</script>`、HTML 示例时必须转义，防提前闭合/内容逃逸
   - **图用 DOM 排版**：架构/流程/时序图优先用 HTML/CSS 布局（flex 行列箱图、CSS counter 步骤流、grid 泳道 + 字符箭头）——盒子自适应文本、自动换行、token 化换肤；**禁止手写 SVG path / 像素坐标**；节点多、连线交错的复杂图退回样式化 ASCII（`<figure><pre>` + 图注），不硬画
   - **宽内容自滚动**：表格/图/代码块套 `overflow-x: auto` 容器，页面 body 不出现横向滚动
   - **表格增强**：可排序/可读的表格处理，数字列 `tabular-nums`
3. 图清单逐张过：每张图按上面约定选呈现方式；增强图在 `<details>` 里保留 ASCII 原文。
4. **Artifact 发布**：`Artifact(file_path=<topic>-design.html, description=<一句话>, favicon="📐")`。
   - favicon 固定 `📐`，redeploy 不换（用户靠图标找 tab）
   - **更新走同一 file_path redeploy**（同路径 → 同 URL）；跨会话更新已有页面，先 `Artifact(action="list")` 找到 URL，再带 `url=` 参数发布——不带就会另开新 URL

**Exit Gate:**
- [ ] design plan 已产出且不落负面清单默认
- [ ] 所有章节已渲染，导航与章节锚点一一对应
- [ ] 所有图已按约定处理（DOM 排版 / 样式化 ASCII，无手写坐标 SVG）
- [ ] 零外链、双主题双向覆盖、代码块已转义
- [ ] Artifact 已发布，URL 已拿到

### Step 3: 验证 + 保存

**Enter Gate:**
- [ ] Artifact URL 已产出

**Core Actions:**

1. **内容完整性核对**：
   - [ ] 章节数量：页面章节数 = 原文档章节数
   - [ ] 图数量：渲染的图数（DOM 图 + ASCII）= 原文档图数
   - [ ] 表格数量：页面表格数 = 原文档表格数
   - [ ] 文字内容：抽查 3-5 段，渲染结果 vs 原文一致
   - [ ] 无外链：`http(s)://` 资源引用为零（正文超链接除外）
   - [ ] 双主题可用：`data-theme` 两个方向切换后文字/边框/图形仍可读

2. **产出渲染回执 render receipt**（**不碰输入文档**——设计文档在 render 之前已评审，回写它会让评审结论不再覆盖当前内容，"已评审"就失效了）：
   ```
   RenderReceipt {
     sourceDoc      // 输入设计文档路径（只读，未改动）
     htmlFile       // <topic>-design.html 路径（Artifact 源文件，留档 + redeploy 锚点）
     artifactUrl    // Artifact 页面 URL（可分享）
     coverage       // 章节 / 图 / 表 渲染计数（完整性核对结果）
   }
   ```
   **产物关系由协调器（dev-design）记录**——render 只返回 receipt，输入文档一个字不动；manifest 不承担运行产物索引。

**Exit Gate:**
- [ ] 完整性核对通过
- [ ] 页面文件已保存（设计文档同目录），Artifact URL 有效
- [ ] render receipt 已产出，**输入设计文档 `git diff` 为空**（未改动）

## Red Flags

- 不调 `Skill(artifact-design)` 就裸写页面——设计原则是质量下限，也是 Artifact 工具的硬性前置；跳过 = 回到模板化默认
- artifact-design 调用成功却跳过 design plan 直接编码——先计划后编码是该 skill 的 Process，跳过等于没加载
- 页面文件写了 `<!doctype html>` / `<html>` / `<head>` / `<body>`——Artifact 发布时会再包一层骨架，双重包裹结构错乱
- 引用 CDN / 网络字体 / 外部图片——CSP 全拦，页面缺字体缺样式还不报错
- 自己做主题切换按钮、或只写单向 `data-theme` 覆盖——viewer 自带切换，单向覆盖会在一个方向失效
- 只落本地文件不发 Artifact、或发完不把 URL 写进 receipt——"通过 Artifact 渲染"是本 skill 的交付定义
- 更新时换 file_path 或不带 `url=`——会另开新 URL，旧链接失效
- 手写 SVG path / 像素坐标画图——图走 DOM 排版或样式化 ASCII
- 页面里的章节数跟原文档对不上（漏渲染了）
- 没有设计文档就直接渲染（设计在先，渲染在后）
- **改了输入设计文档**（追加「## 可视化」等）——输入已评审，render 回写会让评审失效；render 必须纯输出，产物关系交协调器记录
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
