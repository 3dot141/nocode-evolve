---
name: dev-design-render
description: Render design documents (from dev-design-refine) into styled interactive HTML — a browsable page with rendered diagrams, syntax-highlighted code, navigable sections. Delivery via Claude Design or local HTML. Not for UI prototypes (use pd-vd).
---

# dev-design-render — 设计文档 → HTML

把设计文档（markdown）转成可浏览的 HTML 页面。不只是图——整个文档都渲染：标题变导航、表格变交互表、图有统一渲染约定、代码块等宽排版。

参考 pd-vd 的双线方案：Claude Design 或本地 HTML，用户选。

**本地 HTML 线的设计能力来自 artifact-design**：渲染时调用 CC 内置的 `Skill(artifact-design)`（原则型设计指导：角色锚定 / token 双主题 / 反模板化负面清单 / 先 design plan 再编码），为**这份文档的主题**现场设计页面——每份文档得到定制的视觉语言，而不是套同一个壳。`templates/design-doc.html` 降级为 fallback 资产：仅当 artifact-design 调用报错（非 CC 环境 / 内置 skill 改名）时走模板填槽保底。

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

Task 2: 选交付方式
  Sub-steps: AskUserQuestion 选 Claude Design / 本地 HTML
  Gate: 交付方式已选

Task 3: 渲染
  Sub-steps: 本地线 = 调 artifact-design 现场设计（报错 fallback 模板填槽）；Claude Design 线 = 生成 brief
  Gate: HTML 产出

Task 4: 验证 + 保存
  Sub-steps: 核对内容完整性 → 保存
  Gate: 产出已保存

Task 5: 收口 — 交回调用方
  Sub-steps: 向协调器（dev-design）返回 render receipt（产出路径 + 输入文档未改动），交回主流程；产物关系由协调器记录
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

### Step 2: 选交付方式

**Enter Gate:**
- [ ] 文档结构分析完成

**Core Actions:**

AskUserQuestion（参考 pd-vd 方案）：

| 方式 | 产出 | 适用 |
|---|---|---|
| **Claude Design** | `Skill(nocode:claude-design)` → `claude-design <brief>` 生成，可在线协作浏览 | 要团队在线查看、评审协作 |
| **本地 HTML** | 单文件 `.html`，artifact-design 现场设计 | 要离线查看、单文件传播 |

**Exit Gate:**
- [ ] 交付方式已选

### Step 3: 渲染

**Enter Gate:**
- [ ] 交付方式已选

**Core Actions:**

#### Claude Design 线

`Skill(nocode:claude-design)` → `claude-design <brief>` 生成，brief 包含：
- 设计文档全文
- 渲染要求：技术文档风格、可导航章节、图用交互式渲染
- 图的 ASCII 原文 + 类型标注

#### 本地 HTML 线（artifact-design 现场设计）

```
Skill(artifact-design)
     │
     ├─ 加载成功 ──→ 主路：按其原则为本文档现场设计
     │
     └─ 报错（skill 不存在 / 非 CC 环境）──→ fallback：
         复制 templates/design-doc.html 填槽（槽位约定见模板文件头注释），
         并报告「artifact-design 不可用（原因），已走模板保底」
```

**主路流程**——先调 `Skill(artifact-design)` 加载设计原则，然后：

1. **先写 design plan 再编码**（按 artifact-design 的 Process）：4-6 个命名色值 + 2+ 字体角色 + 一句布局概念——**为这份文档的主题选**（数据产品文档和底层重构文档不该长一样），不落负面清单里的模板化默认。
2. **编码**，同时满足 render 侧的领域硬约束（artifact-design 管"好看"，这些管"是设计文档渲染物"）：
   - **单文件零外链**：CSS/JS 全内联，无 CDN / 网络字体 URL（与 artifact-design 的 CSP 原则一致）
   - **双主题**：token 三段式（`:root` + `@media prefers-color-scheme` + `data-theme` 双向覆盖）+ 主题切换按钮
   - **可导航**：章节树 → 侧边/顶部导航，锚点唯一；长文档要有当前章节高亮
   - **内容忠实**：正文一字不改；代码块内含 `</script>`、HTML 示例时必须转义，防提前闭合/内容逃逸
   - **图用 DOM 排版**：架构/流程/时序图优先用 HTML/CSS 布局（flex 行列箱图、CSS counter 步骤流、grid 泳道 + 字符箭头）——盒子自适应文本、自动换行、token 化换肤；**禁止手写 SVG path / 像素坐标**；节点多、连线交错的复杂图退回样式化 ASCII（`<figure><pre>` + 图注），不硬画
   - **表格增强**：可排序/可读的表格处理，数字列 `tabular-nums`
3. 图清单逐张过：每张图按上面约定选呈现方式；增强图在 `<details>` 里保留 ASCII 原文。

**Exit Gate:**
- [ ] 主路：design plan 已产出且不落负面清单默认；或 fallback：已按模板填槽并报告原因
- [ ] 所有章节已渲染，导航与章节锚点一一对应
- [ ] 所有图已按约定处理（DOM 排版 / 样式化 ASCII，无手写坐标 SVG）
- [ ] 单文件零外链、双主题、代码块已转义

### Step 4: 验证 + 保存

**Enter Gate:**
- [ ] HTML 已产出

**Core Actions:**

1. **内容完整性核对**：
   - [ ] 章节数量：HTML 章节数 = 原文档章节数
   - [ ] 图数量：渲染的图数（DOM 图 + ASCII）= 原文档图数
   - [ ] 表格数量：HTML 表格数 = 原文档表格数
   - [ ] 文字内容：抽查 3-5 段，渲染结果 vs 原文一致
   - [ ] 无外链：`http(s)://` 资源引用为零（正文超链接除外）
   - [ ] 双主题可用：`data-theme` 切换后文字/边框/图形仍可读

2. **保存**：
   - Claude Design 线：记 projectId
   - HTML 线：保存到设计文档同目录（`<topic>-design.html`）

3. **产出渲染回执 render receipt**（**不碰输入文档**——设计文档在 render 之前已评审，回写它会让评审结论不再覆盖当前内容，"已评审"就失效了）：
   ```
   RenderReceipt {
     sourceDoc      // 输入设计文档路径（只读，未改动）
     output         // <topic>-design.html 路径 / Claude Design projectId
     deliveryMode   // local-html | claude-design
     designPath     // artifact-design | template-fallback（本地线记录走了哪条路）
     coverage       // 章节 / 图 / 表 渲染计数（完整性核对结果）
   }
   ```
   **产物关系由协调器（dev-design）记录**——render 只返回 receipt，输入文档一个字不动；manifest 不承担运行产物索引。

**Exit Gate:**
- [ ] 完整性核对通过
- [ ] HTML / Claude Design 产出已保存
- [ ] render receipt 已产出，**输入设计文档 `git diff` 为空**（未改动）

## Red Flags

- 本地线不调 `Skill(artifact-design)` 就裸写 HTML——设计原则是主路的质量下限，跳过 = 回到模板化默认
- artifact-design 调用成功却跳过 design plan 直接编码——先计划后编码是该 skill 的 Process，跳过等于没加载
- 手写 SVG path / 像素坐标画图——图走 DOM 排版或样式化 ASCII
- fallback 时不报告原因、或在主路可用时擅自走模板——fallback 只接调用报错
- HTML 里的章节数跟原文档对不上（漏渲染了）
- 没有设计文档就直接做 HTML（设计在先，渲染在后）
- **改了输入设计文档**（追加「## 可视化」等）——输入已评审，render 回写会让评审失效；render 必须纯输出，产物关系交协调器记录
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task

## templates 索引

- `templates/design-doc.html` — **fallback 资产**（artifact-design 调用报错时的保底）：左导航 + 双主题 token + 表格排序 + 数据驱动图渲染函数。其视觉按 artifact-design 原则设计；升级它 = 调 `Skill(artifact-design)` 重审设计后发新版
