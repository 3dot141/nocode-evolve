# render — 设计文档 → Artifact 页面

> dev-design 内部协议，不独立注册。由 dev-design 协调器在 render 阶段 Read 并执行。

把设计文档（markdown）渲染成可浏览的页面，经 CC 内置 `Artifact` 工具发布为可分享 URL。整个文档都渲染，章节树变成页面导航；图、表、代码怎么呈现不设协议约束，全由 artifact-design 现场设计做主。

**设计能力来自 artifact-design**：渲染前调用 CC 内置的 `Skill(artifact-design)`（原则型设计指导：角色锚定 / token 双主题 / 反模板化负面清单 / 先 design plan 再编码），为**这份文档的主题**现场设计页面——每份文档得到定制的视觉语言，而不是套同一个壳。这也是 `Artifact` 工具的硬性前置（工具说明要求发布前必须加载该 skill）。

artifact-design 按请求分两档（utilitarian / editorial），工程文档会被它默认归入 utilitarian 保守档。它的优先级规则是 user's words > project system > its choices——本协议即 project system，显式要求**充分发挥**它的设计风格：不取保守档，不因「工程文档」自我设限。

## Enter Gate

- [ ] writing 阶段已完成，设计文档已产出（`.md` 文件）

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
  Sub-steps: 核对章节导航完整性 → 产出 receipt
  Gate: 产出已保存

Task 4: 收口 — 交回调用方
  Sub-steps: 向协调器（dev-design）返回 render receipt（Artifact URL + 页面文件路径 + 输入文档未改动），交回主流程；产物关系由协调器记录
  Gate: 已交回调用方（渲染是终点分支，无下游阶段）
  metadata: {handoff: true}
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

表格清单：接口表、TO 表、文件影响表（同图清单，供现场设计参考）
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
   - **充分发挥，不取保守档**：字号跨度、字重对比、行高节奏、配色、图/表/代码的呈现方式全由现场设计做主，用足 artifact-design 的设计能力；不因「工程文档 = 实用型」自我设限，把页面做成加了配色的 markdown。
2. **写页面文件**，落设计文档同目录 `<topic>-design.html`，设一个简洁稳定的 `<title>`。发布载体的机制约束（页面片段不写骨架标签 / CSP 零外链 / 双主题跟随 viewer）以 `Artifact` 工具说明和 artifact-design 原则为准，本协议不重复设限。render 侧唯一领域约束是**可导航**：
   - 章节树 → 侧边/顶部导航，锚点唯一、与章节一一对应；长文档要有当前章节高亮
3. **Artifact 发布**：`Artifact(file_path=<topic>-design.html, description=<一句话>, favicon="📐")`。
   - favicon 固定 `📐`，redeploy 不换（用户靠图标找 tab）
   - **更新走同一 file_path redeploy**（同路径 → 同 URL）；跨会话更新已有页面，先 `Artifact(action="list")` 找到 URL，再带 `url=` 参数发布——不带就会另开新 URL

**Exit Gate:**
- [ ] design plan 已产出且不落负面清单默认
- [ ] 所有章节已渲染，导航与章节锚点一一对应
- [ ] Artifact 已发布，URL 已拿到

### Step 3: 验证 + 保存

**Enter Gate:**
- [ ] Artifact URL 已产出

**Core Actions:**

1. **章节导航完整性核对**：
   - [ ] 章节数量：页面章节数 = 原文档章节数（无漏渲染）
   - [ ] 导航与锚点：每个章节可从导航一跳直达，锚点唯一

2. **产出渲染回执 render receipt**（**不碰输入文档**——设计文档在 render 之前已评审，回写它会让评审结论不再覆盖当前内容，"已评审"就失效了）：
   ```
   RenderReceipt {
     sourceDoc      // 输入设计文档路径（只读，未改动）
     htmlFile       // <topic>-design.html 路径（Artifact 源文件，留档 + redeploy 锚点）
     artifactUrl    // Artifact 页面 URL（可分享）
     coverage       // 章节渲染计数 + 导航锚点核对结果
   }
   ```
   **产物关系由协调器（dev-design）记录**——render 只返回 receipt，输入文档一个字不动；manifest 不承担运行产物索引。

**Exit Gate:**
- [ ] 章节导航完整性核对通过
- [ ] 页面文件已保存（设计文档同目录），Artifact URL 有效
- [ ] render receipt 已产出，**输入设计文档 `git diff` 为空**（未改动）

## Red Flags

- 不调 `Skill(artifact-design)` 就裸写页面——设计原则是质量下限，也是 Artifact 工具的硬性前置；跳过 = 回到模板化默认
- artifact-design 调用成功却跳过 design plan 直接编码——先计划后编码是该 skill 的 Process，跳过等于没加载
- 以「工程文档 = 实用型」收着设计（层级压平、页面主体是加了配色的 markdown）——本协议要求充分发挥 artifact-design 的设计风格
- 在 artifact-design 之外给呈现叠加协议约束（图必须怎么画、表必须怎么排）——render 只管导航一条领域约束，呈现全由现场设计做主
- 只落本地文件不发 Artifact、或发完不把 URL 写进 receipt——"通过 Artifact 渲染"是本 skill 的交付定义
- 更新时换 file_path 或不带 `url=`——会另开新 URL，旧链接失效
- 页面里的章节数跟原文档对不上（漏渲染了），或导航锚点与章节对不上
- 没有设计文档就直接渲染（设计在先，渲染在后）
- **改了输入设计文档**（追加「## 可视化」等）——输入已评审，render 回写会让评审失效；render 必须纯输出，产物关系交协调器记录
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
