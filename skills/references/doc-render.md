# doc-render — 已定稿 markdown 文档 → Artifact 页面

共享 reference,渲染已定稿 markdown 文档(技术设计 / PRD / RFC / ADR / 调研报告等)为 Artifact 页面时 Read 本文并照协议执行。

整个文档都渲染,章节树变成页面导航;图、表、代码怎么呈现不设协议约束,全由 artifact-design 现场设计做主。本协议返回 render receipt,输入文档一字不动。

**设计能力来自 artifact-design**:渲染前调用 CC 内置的 `Skill(artifact-design)`(原则型设计指导:角色锚定 / token 双主题 / 反模板化负面清单 / 先 design plan 再编码),为**这份文档的主题**现场设计页面——每份文档得到定制的视觉语言,而不是套同一个壳。这也是 `Artifact` 工具的硬性前置(工具说明要求发布前必须加载该 skill)。

artifact-design 按请求分两档(utilitarian / editorial),工程文档会被它默认归入 utilitarian 保守档。它的优先级规则是 user's words > project system > its choices——本协议即 project system,显式要求**充分发挥**它的设计风格:不取保守档,不因「工程文档」自我设限。

**内容忠实 ≠ 呈现镜像**(硬规则):忠实指措辞、结论、章节完整不失真;呈现(图 / 表 / 排版)全由现场设计做主。markdown 源里的 ASCII 图是为终端友好 + 版本控制可 diff 而生的**源格式**,页面上应 DOM 化重绘(流程图 → 垂直 timeline / 步骤卡,结构图 → 管道 / 卡片流 / IO 卡),不保留 pre 块镜像。

## Enter Gate

- [ ] 源文档已定稿(评审 / 用户确认已完成),路径已知

## 协议

### Step 0: TaskCreate

```
Task 1: 分析文档结构
  Sub-steps: 读源文档 → 提取章节树 + 图清单 + 表格清单
  Gate: 文档结构分析完成

Task 2: 渲染 + 发布
  Sub-steps: 调 artifact-design 现场设计 → 写页面文件 → Artifact 发布
  Gate: Artifact URL 已产出

Task 3: 验证 + 保存
  Sub-steps: 核对渲染完整性 → 产出 receipt
  Gate: 产出已保存

Task 4: 收口 — 交回主流程
  Sub-steps: 向主流程返回 render receipt(Artifact URL + 页面文件路径 + 输入文档未改动);产物关系由主流程记录
  Gate: 已交回主流程(渲染是终点分支,无下游阶段)
  metadata: {handoff: true}
```

### Step 1: 分析文档结构

**Enter Gate:**
- [ ] 源文档路径已知

**Core Actions:**

读源文档,提取:

```
章节树(生成导航用):
  ## 背景
  ## 核心流程
    ### 场景 A
  ...

图清单(标注类型与复杂度,供设计时决定 DOM 化呈现方式):
  | 位置 | 类型 | 复杂度 |
  |---|---|---|
  | ## 领域划分 | 域关系图 | 3 节点,清晰 |
  | ## 核心流程 | 流程图(带异常分支) | 8 步串行 + 4 异常 |
  | ## 跨域交互 | 时序图 | 3 角色 |

表格清单:接口表、决策速查表、TO 表(同图清单,供现场设计参考)
```

**Exit Gate:**
- [ ] 章节树提取完成
- [ ] 图清单 + 类型/复杂度标注
- [ ] 表格清单

### Step 2: 渲染 + 发布

**Enter Gate:**
- [ ] 文档结构分析完成

**Core Actions:**

先调 `Skill(artifact-design)` 加载设计原则,然后:

1. **先写 design plan 再编码**(按 artifact-design 的 Process):4-6 个命名色值 + 2+ 字体角色 + 一句布局概念——**为这份文档的主题选**(数据产品 PRD 和底层重构设计不该长一样),不落负面清单里的模板化默认。
   - **充分发挥,不取保守档**:字号跨度、字重对比、行高节奏、配色、图/表/代码的呈现方式全由现场设计做主,用足 artifact-design 的设计能力;不因「工程文档 = 实用型」自我设限,把页面做成加了配色的 markdown。
   - **图 DOM 化**:按 Step 1 的图清单逐张决定呈现方式(timeline / 管道 / 卡片流 / mermaid / 内联 SVG),源里的 ASCII 只是素材不是样式约束。
2. **写页面文件**,落源文档同目录、同 basename 的 `.html`(如 `foo-prd.md` → `foo-prd.html`),设一个简洁稳定的 `<title>`。发布载体的机制约束(页面片段不写骨架标签 / CSP 零外链 / 双主题跟随 viewer)以 `Artifact` 工具说明和 artifact-design 原则为准,本协议不重复设限。render 侧唯一领域约束是**可导航**:
   - 章节树 → 侧边/顶部导航,把文档结构解释清楚即可——不要求与章节一一对应,可按内容归组取舍;长文档要有当前章节高亮
3. **Artifact 发布**:`Artifact(file_path=<basename>.html, description=<一句话>, favicon=<见下>)`。
   - favicon:**redeploy 沿用该页面已发布的图标**(Artifact 跨 redeploy 图标稳定是工具硬规则,优先级高于本协议默认);新页面默认 `📐`
   - **更新走同一 file_path redeploy**(同路径 → 同 URL);跨会话更新已有页面,先 `Artifact(action="list")` 找到 URL,再带 `url=` 参数发布——不带就会另开新 URL

**Exit Gate:**
- [ ] design plan 已产出且不落负面清单默认
- [ ] 所有章节已渲染,导航把文档结构解释清楚
- [ ] Artifact 已发布,URL 已拿到

### Step 3: 验证 + 保存

**Enter Gate:**
- [ ] Artifact URL 已产出

**Core Actions:**

1. **渲染完整性核对**:
   - [ ] 章节数量:页面章节数 = 原文档章节数(无漏渲染)
   - [ ] 导航:结构解释清楚,读者能凭导航定位内容(不要求与章节一一对应)

2. **产出渲染回执 render receipt**(**不碰输入文档**——源文档在 render 之前已定稿,回写它会让评审/确认结论不再覆盖当前内容,"已定稿"就失效了):
   ```
   RenderReceipt {
     sourceDoc      // 输入文档路径(只读,未改动)
     htmlFile       // <basename>.html 路径(Artifact 源文件,留档 + redeploy 锚点)
     artifactUrl    // Artifact 页面 URL(可分享)
     coverage       // 章节渲染计数 + 导航核对结果
   }
   ```
   **产物关系由主流程记录**——render 只返回 receipt,输入文档一个字不动。

**Exit Gate:**
- [ ] 渲染完整性核对通过
- [ ] 页面文件已保存(源文档同目录),Artifact URL 有效
- [ ] render receipt 已产出,**输入文档 `git diff` 为空**(未改动)

## Red Flags

- 不调 `Skill(artifact-design)` 就裸写页面——设计原则是质量下限,也是 Artifact 工具的硬性前置;跳过 = 回到模板化默认
- artifact-design 调用成功却跳过 design plan 直接编码——先计划后编码是该 skill 的 Process,跳过等于没加载
- 以「工程文档 = 实用型」收着设计(层级压平、页面主体是加了配色的 markdown)——本协议要求充分发挥 artifact-design 的设计风格
- **把「内容忠实」扩大成「呈现镜像」**——保留源文件 ASCII pre 块、逐节复刻 markdown 排版(实测案例 260716:agent 把"镜像 md"当成不存在的约束,PRD 渲染成加配色的 markdown,用户纠偏后按本协议重渲染)
- 在 artifact-design 之外给呈现叠加协议约束(图必须怎么画、表必须怎么排)——render 只管导航一条领域约束,呈现全由现场设计做主
- 只落本地文件不发 Artifact、或发完不把 URL 写进 receipt——"通过 Artifact 渲染"是本协议的交付定义
- 更新时换 file_path 或不带 `url=`——会另开新 URL,旧链接失效
- redeploy 时更换 favicon——用户靠图标找 tab,跨 redeploy 稳定是 Artifact 工具硬规则
- 页面里的章节数跟原文档对不上(漏渲染了),或导航解释不清结构、凭导航找不到内容
- 没有定稿文档就直接渲染(定稿在先,渲染在后)
- **改了输入文档**(追加「## 可视化」等)——输入已定稿,render 回写会让评审/确认失效;render 必须纯输出,产物关系交主流程记录
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
