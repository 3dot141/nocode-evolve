---
name: dev-design-render
description: Render design documents (from dev-design-refine) into styled interactive HTML. Converts the full markdown document into a browsable HTML page — ASCII diagrams become Canvas/SVG, code blocks get syntax highlighting, sections become navigable. Delivery via Claude Design or local HTML (references pd-vd's dual-track approach). Not for UI prototypes (use pd-vd).
---

# dev-design-render — 设计文档 → HTML

把设计文档（markdown）转成可浏览的 HTML 页面。不只是图——整个文档都渲染：标题变导航、表格变交互表、ASCII 图变 Canvas/SVG、代码块加语法高亮。

参考 pd-vd 的双线方案：Claude Design 或本地 HTML，用户选。

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
  Sub-steps: 按交付方式生成 HTML
  Gate: HTML 产出

Task 4: 验证 + 保存
  Sub-steps: 核对内容完整性 → 保存
  Gate: 产出已保存

Task 5: 收口 — 交回调用方
  Sub-steps: 向 dev-design-refine / dev-design 报告渲染产出路径，交回主流程继续
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
    ### Validator
  ## Agent 域
  ...

图清单（需特殊渲染）：
  | 位置 | 类型 | 渲染方式 |
  |---|---|---|
  | ## 领域划分 | 域关系图 | Canvas/SVG 交互图 |
  | ## 资源域 | 模块关系图 | SVG |
  | ## 资源域.BF1 | 流程图 | SVG 流程 |
  | ## 跨域交互 | 时序图 | SVG 时序 |

表格清单（交互增强）：
  接口表、TO 表、文件影响表 → 可排序/可筛选 HTML 表格
```

**Exit Gate:**
- [ ] 章节树提取完成
- [ ] 图清单 + 渲染方式标注
- [ ] 表格清单

### Step 2: 选交付方式

**Enter Gate:**
- [ ] 文档结构分析完成

**Core Actions:**

AskUserQuestion（参考 pd-vd 方案）：

| 方式 | 产出 | 适用 |
|---|---|---|
| **Claude Design** | `Skill(nocode-evolve:claude-design)` → `claude-design <brief>` 生成，可在线协作浏览 | 要团队在线查看、评审协作 |
| **本地 HTML** | 单文件 `.html` 落 repo | 要版本控制、离线查看、归档 |

**Exit Gate:**
- [ ] 交付方式已选

### Step 3: 渲染

**Enter Gate:**
- [ ] 交付方式已选

**Core Actions:**

#### Claude Design 线

`Skill(nocode-evolve:claude-design)` → `claude-design <brief>` 生成，brief 包含：
- 设计文档全文
- 渲染要求：技术文档风格、可导航章节、图用交互式渲染
- 图的 ASCII 原文 + 类型标注

#### 本地 HTML 线

生成单文件 HTML，包含：

**整体结构**：
- 左侧导航栏（从章节树生成，点击跳转）
- 右侧内容区（渲染后的文档）
- 技术文档风格：白底、清晰排版、等宽代码

**文本渲染**：
- Markdown → HTML（标题/列表/粗体/链接）
- 代码块 → 语法高亮（内联 highlight.js 或纯 CSS）
- 引用块 → 样式化侧边栏

**图渲染**（ASCII → Canvas/SVG）：
- 架构图 / 域关系图 → SVG 方框 + 箭头连线
- 流程图 → SVG 节点 + 箭头串联
- 时序图 → SVG 生命线 + 横向消息箭头
- 状态机 → SVG 圆角节点 + 标条件的转换箭头
- 每张图保留可折叠的 ASCII 原文（`<details>`）

**表格渲染**：
- 接口表 / TO 表 → 可排序 HTML 表格
- 文件影响表 → 可折叠目录树
- 覆盖状态表 → 带颜色标记（✅ 绿 / ❌ 红）

**交互增强**（可选）：
- 搜索（Ctrl+F 全文搜索）
- 暗色模式切换
- 图的缩放/平移

**产出路径**：设计文档同目录 `<topic>-design.html`

**Exit Gate:**
- [ ] HTML 产出
- [ ] 所有章节已渲染
- [ ] 所有图已从 ASCII 转成 Canvas/SVG
- [ ] 所有表格已增强

### Step 4: 验证 + 保存

**Enter Gate:**
- [ ] HTML 已产出

**Core Actions:**

1. **内容完整性核对**：
   - [ ] 章节数量：HTML 章节数 = 原文档章节数
   - [ ] 图数量：渲染的图数 = ASCII 图数
   - [ ] 表格数量：HTML 表格数 = 原文档表格数
   - [ ] 文字内容：抽查 3-5 段，渲染结果 vs 原文一致

2. **保存**：
   - Claude Design 线：记 projectId
   - HTML 线：保存到设计文档同目录

3. **更新设计文档**：末尾追加
   ```markdown
   ## 可视化
   渲染产出：`<topic>-design.html` / Claude Design projectId
   ```

**Exit Gate:**
- [ ] 完整性核对通过
- [ ] 产出已保存
- [ ] 设计文档已追加引用

## Red Flags

- HTML 里的章节数跟原文档对不上（漏渲染了）
- 图渲染跟 ASCII 原文节点/连线对不上
- 没有设计文档就直接做 HTML（设计在先，渲染在后）
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
