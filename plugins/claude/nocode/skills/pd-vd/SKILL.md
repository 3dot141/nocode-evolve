---
name: pd-vd
description: >-
  Use after pd-ix for visual direction, design systems, high-fidelity prototypes, or prototype iteration/fixes. Not for interaction architecture, technical design, production UI code, or work without an .ix.md.
---

> 本文写“结构化决策”时，必须提交当前步骤的完整问题与 2–3 个互斥选项。

计划使用 `TaskCreate` / `TaskUpdate`，决策使用 `AskUserQuestion`；Skill handoff 使用 `Skill(nocode:pd-ix)`、`Skill(nocode:prototype-verify)`、`Skill(nocode:reviewing)`、`Skill(nocode:devflow)`。


Open Design 线直接使用 `create_project`、`start_run`、`get_run`、`get_artifact`；保存原生 project id / run id / previewUrl，不构造统一中间回执。

# pd-vd — 视觉设计

**Iron Law: 交互骨架定了才上视觉。没有 `.ix.md` 就出原型 = 在空气上贴皮。**

独立于 devflow 的产品流视觉设计阶段。以 `.ix.md` 为输入，产出 `.vd.md` + 高保真原型。

## 产出标准：高保真，唯一档位

本 skill 固定产出**高保真可交互原型**——看得见 + 点得动。不设保真度选档，不出纯静态稿。

| 维度 | 标准 |
|---|---|
| 覆盖度 | IA 全部页面/视图 100%，无例外（「关键页先出」是违规） |
| 每页深度 | 静态渲染正常 + 每个交互点可操作（导航跳转 / 嵌入组件弹出滑出 / 按行为规格退出） |
| 控件四态 | Step 3 组件级一次定义（tokens 四态规则 + 组件卡展示），页面继承，不逐控件逐页验证 |
| **不包含**（→ devflow Build） | 逐控件四态页面级验证、边界态（empty/loading/error）实装切换、端到端链路完整验证、生产级组件代码 |

进入 skill 后首次对齐预期时（Step 2a），把「不包含」清单念给用户——预期落差在开工前暴露，不在交付后。

## 边界

| pd-vd 做 | 不做（→ 去哪） |
|---|---|
| 视觉方向、tokens、控件四态样式 | 信息架构、页面流 → pd-ix |
| 可交互原型（Open Design / HTML） | 交互拆解、状态覆盖枚举、行为规格 → pd-ix |
| 设计系统（tokens + components + 样张，按交付线落点） | 技术架构、模块划分 → dev-design |
| Playwright 验证 | 生产级组件代码 → devflow Build |

**非本 skill**：无 `.ix.md` → 先 pd-ix。要技术架构 → dev-design。要生产代码 → devflow Build。

> IX↔VD 分工判据与共享术语（状态覆盖 / 行为规格 / 控件四态、三层命名 tokens/components/patterns）单源在 `{NOCODE_SKILL_REF}/ix-vd-contract.md`——`.ix.md` 定义的行为语义不得改动；原型需要 IX 未定义的行为 → 回流登记，不就地定。

## Enter Gate

- [ ] pd-vd skill 已加载
- [ ] `.ix.md` 存在（交互阶段已完成）——无 `.ix.md` 时按上方平台语法调用 pd-ix

## 模式分流：全流程 or 迭代

Enter 时检测——**已有 `.vd.md` + 原型，且本次请求是局部修改**（改交互效果 / 修原型问题 / 调样式 / 换文案）→ 走**迭代模式**，不重走 Step 1-4：

```
迭代模式（轻路径，带回归网）
1. workflow.plan.create 轻量版：Task A「迭代: 定位→修改→重验→登记」+ Task B「Handoff」(metadata: {handoff: true})
2. 定位改动：哪个页面 / 哪个交互（引用交互 ID）
3. 修改：视觉值只用冻结 tokens；Open Design artifact 在原 project id 上用 `start_run` 提交 `<approved-local-change>`，等待 `get_run` 终态后用 `get_artifact` 读取结果；行为语义查 .ix.md 行为规格——
   需要 IX 未定义的行为 → 先回流登记再实现，不就地发明
4. 重验（修改后必重验）：受影响页面 Phase 1 + 该页相关 Phase 2 场景重跑
   （场景已从行为规格转译，断言判挂）
5. 收尾：矩阵对应行刷新 + 补充决策登记（.ix.md 回流节 / .vd.md 登记节）
```

**不算迭代、要回对应阶段的**：改 IA / 页面结构 → pd-ix；换视觉方向 / 改 token 值 → Step 2b/3（样张重拍板）。

> 动机：局部改原型是最高频的返场场景，只有「重走全流程」一条路时它必然被绕开——绕开 = 裸奔迭代（v7 式七轮肉眼修 bug）。给合规轻路径，回归网（重验）不丢。

## Step 0: workflow.plan.create

**进入 pd-vd 后第一件事**，创建以下全部 task：

```
Task 1: 视觉探索
  Sub-steps: 问竞品截图 → 搜 Template
  Gate: 视觉参考集整理

Task 2: 交付线 + 视觉方向
  Sub-steps: 选交付线(Open Design / 本地 HTML，设计系统与原型同线) → 告知产出标准(含「不包含」) → 定视觉方向
  Gate: 交付线 + 视觉方向已定，产出标准已告知

Task 3: 设计系统（tokens + components + 样张 + 落点，全必做）
  Sub-steps: 取值来源决策树 → 3a 生成 tokens → 3b 生成 components + patterns 骨架 → 3c 单页样张渲染 + 用户拍板 → 3d 按交付线落点
  Gate: 样张经拍板，tokens + components 冻结，落点完成（CD 线 DS 项目可绑 / HTML 线已落盘）

Task 4: 生成原型
  Sub-steps: 回查交付线 → 用冻结组件组装（CD 线绑 DS 项目 / 本地 HTML）→ 产出原型清单
  Gate: 原型产出 + 原型清单 100% 覆盖 IA 全部页面/视图

Task 5: 验证
  Sub-steps: 测试方案(5a,审批) → Playwright 验证(5b,Phase 1/1b/2) → 页面覆盖矩阵(5c) → 交互覆盖矩阵(5d) → vis-review 自审,有异议升档交叉(5e) → 写入.vd.md(5f)
  Gate: 测试方案审批通过 + Playwright errors=0 + Gate 表全过

Task 6: 保存 + Handoff
  Sub-steps: 写 .vd.md + 保存原型 → 报告完成并交回 devflow（以 PRD + .ix.md + .vd.md 为输入）
  Gate: 文件保存，全部 Task 更新
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

调用时把上面**每一条** Task 建成稳定计划项，不得提交空计划。每次状态变化都使用上方平台原生计划工具提交稳定顺序的完整状态；Codex 同时最多一个 `in_progress`。

每完成一个标 done。

---

## Step 1: 视觉探索

> 竞品截图和模板都是"视觉起点"——找到了就不用从空白憋方向。pd-ix 的竞品探索看的是"别人怎么做"（功能 + 流程），这一步看的是"别人长什么样"（视觉 + 排版 + 调性）。

**Enter Gate:**
- [ ] Step 0 完成（Task 已创建）
- [ ] `.ix.md` 已读，IA 结构已理解

**Core Actions:**

1. **问目标竞品** — "有没有想对标 / 参考的产品？"
   - 有 → 定位到对应 IA 关键页的视觉页面，请用户截图整理
   - 没有 → 按产品类型搜同类视觉参考

2. **搜 Template** — Open Design 可用时查模板库，匹配产品类型（dashboard / landing / app 等）
   - 有匹配 → 记为起点候选，Step 2 视觉方向可直接用它定调
   - 没匹配 / 不可用 → 跳过

3. **产出视觉参考集** — 竞品截图 + 模板候选（如有），每条标来源，作为 Step 2 定方向的输入

> 展开：视觉参考集模板、竞品视觉分析方法 → `references/visual-exploration.md`

**Exit Gate:**
- [ ] 视觉参考集已整理（≥3 个竞品视觉参考，标来源）
- [ ] Template 搜索已完成（有候选或注明无匹配）

---

## Step 2: 确定交付线 + 视觉方向

**Enter Gate:**
- [ ] Step 1 完成

**Core Actions:**

**2a. 交付线**（结构化决策）——一条线管两个落点：Step 3 设计系统和 Step 4 原型同线交付，不混线：

**什么算独立页面文件，什么不算：**
- **独立页面** = 不同路径分支的落地页（首页、列表页、详情页、设置页）→ 各一个文件
- **嵌入组件** = Modal / Dialog / Drawer / Toast / Popover 等 → 不单独建文件，在宿主页面内实现（`<dialog>`、JS toggle）
- 判断标准：用户走不同路径会到达不同的独立页面；嵌入组件是同一页面内的交互分支，不是路径分支

| 线 | 设计系统落点 | 原型落点 | 交互原型（组合） | 选它当 |
|---|---|---|---|---|
| **Open Design** | 独立 DS 项目（组件卡入 Design System 面板，供绑定/复用） | 原型项目（与 DS 项目分离），每个独立页面一个文件 | 额外一个组合文件，融合所有页面代码，JS 实现 tab 切换/弹窗 | 团队 canvas 协作、设计系统跨项目复用 |
| **本地 HTML** | `tokens.css` + `styleguide.html` 落 `{pd_vd_output}` 目录 | 每个独立页面一个 `.html` 落同目录 | 多文件之间用 URL 跳转串联，不需要额外组合文件 | 版本控制、离线、无重复维护 |

**Open Design 的代价**：组合文件里的内容和独立页面文件是重复的，改了独立页面的设计，组合文件也要同步改。

**覆盖要求**：IA 中的每个页面/视图都必须在原型中实现——独立页面有自己的文件，嵌入组件在宿主页面内实现。不存在"设计覆盖但原型未实现"的中间态。

两条线 Step 3-4 步骤相同、实现不同。选定后全程走一条线。**同时告知产出标准**：高保真唯一档位，把「产出标准」节的「不包含」清单念给用户；档内内容一律做满，砍任何内容必须能引用产出标准，禁止「做不完所以不做」。

**2b. 视觉方向**：
- 有 Step 1 的 template 匹配 → 用它当起点（方向已定），可微调
- 没有 → 沿三轴给 2-3 个明显不同的方向，用户选（可混搭）：
  - 布局密度：紧凑 ↔ 宽松
  - 视觉强度：克制 ↔ 表现力
  - 调性：专业 ↔ 友好

**Exit Gate:**
- [ ] 交付线 + 视觉方向已定
- [ ] 产出标准（含「不包含」清单）已告知

> 展开：视觉方向三轴定义、方向示例（工具感/编辑器感/仪表盘感）→ `references/visual-direction.md`

---

## Step 3: 设计系统（tokens + components + 样张 + 落点，全必做）

> 设计系统三层：**tokens**（原子层：色/字/距/圆角/阴影/控件四态规则）→ **components**（分子层：按钮/卡片/表格…）→ **patterns**（组织层：页面布局 = Step 4 组装）。**tokens 和 components 全必做，无 skip 分支**——组件清单由交互清单 gap analysis 推出，小项目交互少清单自然短，成本随规模自动缩放；跳过的代价是 Step 4 并行 subagent 各自脑补值，页面互相不一致。

**Enter Gate:**
- [ ] Step 2 完成

**Core Actions:**

**3a. 生成 tokens** —— 先走取值来源决策树，再按完备 schema 逐项产出：

```
tokens 取值来源
├─ 1. 项目已有设计系统？（代码库 tokens / Open Design 项目 / Figma）
│     有 → 直接沿用，不问；gap analysis 只补缺口
├─ 2. 没有 → 结构化决策（单选）：
│     · 已有品牌资产（如探测到品牌色板，列为首选项）
│     · minimalist-ui —— 暖色极简 editorial（宽松/克制/友好）
│     · high-end-visual-design —— agency 精致感（表现力/圆角/景深）
│     · industrial-brutalist-ui —— 工业终端风（紧凑/零圆角/专业）
└─ 3. 用户不选 / 说「你定」→ 按三轴坐标 + 竞品参考集就近选，
      样张里说明选了什么、为什么（选错在样张翻案，代价一页）
```

- **决策框架恒加载**：无论走哪条分支，`frontend-design`（token-plan 取值方法）与 `design-taste-frontend`（AI 套路反模式禁令）都生效
- **风格预设包一次最多一个**（minimalist / high-end / brutalist 互斥，同载必打架），其死值作 token 初值
- IA 含图表/dashboard → 加载 `dataviz` 预留分类色/状态色槽位（图表色域独立于整站 accent）
- 改造已有产品场景 → 加载 `redesign-existing-projects`（审计流程，与风格正交）

**tokens 完备 schema**（逐项产出，缺一不过）：色板（4-6 具名 hex）/ 字体角色（≥2）/ 字号刻度 / 间距基 / 圆角 / 阴影 / 控件四态通用规则 / signature 元素。全部以 CSS 变量落地。

**3b. 生成 components + patterns 骨架**：
- 组件清单 ← 对照 IA 逐交互 gap analysis（复用去重）
- 每组件覆盖交互会用到的变体 + 控件四态，**只许引用 token 变量，禁硬编码 hex/px**（收口时机械校验，一处硬编码打回）
- patterns 骨架 = 页面级布局的灰块示意（真实内容组装留给 Step 4，本步不吞）

**3c. 单页样张渲染 + 用户拍板**：

```
┌─ Tokens      色板 / 字体样例 / 间距刻度 ────────────┐
│  Components  全部组件 × 关键变体 × 控件四态          │
│  Patterns    布局骨架缩略（灰块示意，不填真实内容）    │
└──────────────────────────────────────────────────┘
```

- 调性不对 → 改 token 变量，样张自动刷新，原地迭代
- 组件不对 → 重做该组件，其它不动
- **拍板后 tokens + components 一起冻结**，成为 Step 4-6 唯一取值来源
- 样张是持久产物：存 `{pd_vd_output}` 同目录 `styleguide.html`，Step 5 截图作组件基线，devflow Build 作组件参考

**3d. 按交付线落点**（回查 2a，冻结后执行）：

| | Open Design 线 | 本地 HTML 线 |
|---|---|---|
| **落点** | **独立 DS 项目**（与 Step 4 原型项目分离） | `{pd_vd_output}` 目录 |
| **动作** | `create_project` 建 DS project → `start_run` 传入冻结的 tokens/components/styleguide brief → `get_run` 等终态 → `get_artifact` 读取并落盘；保存 project id | `tokens.css` + components + `styleguide.html` 落盘 |
| **复用已有** | 已有 DS 项目 → gap analysis 增量推缺口 | 已有代码库 tokens → 提取对齐后落盘冻结快照 |

**交付线 = Open Design ⇒ 设计系统必须落成 DS 项目，设计真源在代码库也不豁免**——推送物是冻结时点快照（标注上游来源 + 冻结日期，单向同步，不构成双主）。tokens 内联进原型文件只解决渲染；DS 面板可浏览、跨项目可绑定、协作可见，靠的是 DS 项目——内联不能替代落点。

**Exit Gate:**
- [ ] tokens 按 schema 完备（八项齐）
- [ ] components 覆盖 gap analysis 全部清单，零硬编码
- [ ] 样张经用户拍板，tokens + components 已冻结
- [ ] 复用已有设计系统时：标识已记录，缺口已补齐
- [ ] 落点完成——Open Design 线：DS 项目已建（DS 类型）+ 组件卡已入索引 + dsProjectId 已记录 / 本地 HTML 线：tokens + 样张已落 `{pd_vd_output}`

> 展开：gap analysis、并行创建、样张构成、两线落点、open-design 操作 → `references/design-system-build.md`

---

## Step 4: 生成原型

> 把交互结构 + 视觉方向 + 设计系统拼成可看可走的原型。**回查 Step 2 交付线，不凭记忆判断。**

**Enter Gate:**
- [ ] Step 3 完成（tokens + components + 样张已冻结，3d 落点完成）
- [ ] 回查交付线：Open Design / 本地 HTML
- [ ] Open Design 线：Step 3d 的 DS project id 已保存且可复用

**Core Actions:**

| | Open Design 线 | 本地 HTML 线 |
|---|---|---|
| **怎么出** | `create_project` 建 prototype project → `start_run` 传入已批准 brief 与 DS project id → `get_run` 等终态 → `get_artifact` 读取产物 | 本地写多个 `.html` 文件 |
| **喂什么** | brief = IA + 交互清单 + 场景脚本 + 视觉方向；绑 Step 3d 的 DS 项目（design_system_id）+ 挂 template | IA + 交互清单 + 场景脚本 + 视觉方向 + Step 3 冻结的 tokens/components/样张 |
| **结构** | 每个独立页面一个文件（含宿主内的嵌入组件）+ 一个组合文件（融合全部主链路页面，JS tab 切换/弹窗） | 每个独立页面一个 `.html`（含宿主内的嵌入组件），多文件之间用 URL 跳转，每个文件内做弹窗 |
| **产物** | claude.ai 原型项目（记 projectId，与 DS 项目分离） | `{pd_vd_output}` 目录 |

行为语义以 `.ix.md` 的行为规格为准（触发/规则/退出/反馈）；原型需要 IX 未定义的行为 → 在 `.ix.md`「下游澄清回流」节登记后再实现，时序参数（如浮层退出缓冲时长）由原型定值并同步登记。

**Open Design 线并行生成（≥3 个独立页面时推荐）：**

页面数少（≤2）时一个 brief 一次出完；≥3 时拆分并行：

```
拆分 page-brief → 并行 subagent 本地生成 → 选合流策略 → batch push
```

1. **拆分 brief**：IA 每个独立页面 → 独立 page-brief（共享：视觉方向 + 设计系统 + 公共样式约定；独有：该页 IA 结构 + 该页交互清单 + 该页嵌入组件）
2. **并行生成**：每页一个 subagent，本地产出 `.html`（纯文件产出，不调 API），嵌入组件在宿主页面内实现
3. **合流判定**（基于导航链路连通性）：
   - 分析 IA 导航图，找出**连通子图**
   - **连通的页面** → 融合到同一 prototype
   - **孤立页面** → 保留为独立文件
4. **提交**：所有文件在同一 Open Design project 中用一次 `start_run` 提交，等待终态后保存原生 project id、run id 与 previewUrl

> 展开：并行流程、page-brief 模板、合流策略 → `references/prototype-gen.md`

**两条线共同要求：**

| 项 | 要求 |
|---|---|
| **视觉值** | 引用 Step 3 冻结 tokens（CSS 变量），禁硬编码、禁改名 |
| **嵌入组件** | 可触发（点击弹出/滑出），按行为规格退出、关闭后状态回归 |
| **导航** | 页面间可跳转（CD 线组合文件 tab 切换 / HTML 线 URL 跳转） |
| **test-id** | 所有可操作元素加 `data-testid` |
| **基线** | 在 `.ix.md` ASCII 骨架上落视觉 + 交互，不改 IA / 页面结构 |

**test-id**：每个可操作元素加 `data-testid`，命名 `<页面>-<组件>[-<变体>]` kebab-case。Playwright 用 `[data-testid="xxx"]` 定位。

> 展开：命名规则示例 → `references/playwright-verify.md`

**原型清单（Step 5 验证的输入）：**

Step 4 产出后、进 Step 5 前，列一份原型清单：每个 IA 页面/视图的实现位置 + 交互入口。IA 中每个页面/视图都必须有实现位置，无遗漏。Step 5 矩阵基于这份清单核对。

> 展开：原型清单模板 → `references/prototype-gen.md`

**Exit Gate:**
- [ ] 原型已产出，交互可操作（嵌入组件可弹出/滑出，页面间可跳转）
- [ ] 原型清单 100% 覆盖 IA 全部页面/视图
- [ ] Open Design 线：原型项目已绑 DS 项目 + projectId 已记录 / HTML 线：文件已保存

> 展开：brief 完整写法、两条线详细操作 → `references/prototype-gen.md`

---

## Step 5: 验证

**Enter Gate:**
- [ ] Step 4 完成（含原型清单）

**三表关系：** PRD 路径覆盖 → 页面覆盖矩阵 → 交互覆盖矩阵，是同一条链的三个粒度递进，不是重复核对：
- PRD 路径覆盖：每条使用路径能走通吗（端到端）
- 页面覆盖矩阵：每个 IA 页面/视图都画出来了吗（逐页）
- 交互覆盖矩阵：每个交互点都能操作吗（逐交互）

PRD 路径覆盖的状态必须由下面两个矩阵聚合得出，不能单独手填 ✅——矩阵里有 ❌，路径就不能标 ✅。

**Iron Rule: 矩阵里的 ✅ 必须基于实际渲染结果（截图 + 交互验证），不允许手填。**

**Core Actions:**

### 5a. 测试方案（先审后跑）

基于原型清单输出测试方案，用户审批后才写脚本执行。不允许跳过方案直接跑。

测试方案必须包含三部分：
1. **页面层级图**（ASCII 树）：IA 全部页面/视图的树状结构
2. **导航链路图**（ASCII 流程）：前端可达路径
3. **分层验证表**：Phase 1/1b/2 列出具体场景

测试方案分三层 Phase（全部必做）：
- **Phase 1**：每个页面截图，确认渲染正常
- **Phase 1b**：UI 细节审核——遮挡/溢出/截断/层叠/间距一致性 + 对照样张核组件一致性
- **Phase 2**：交互场景——按 `.ix.md` 行为规格逐条验证（触发/规则/退出都要试到，浮层的维持与退出是重点）

**审批 Gate**：用户确认测试方案后才进 5b。

> 展开：测试方案模板、各 Phase 详细内容 → `references/playwright-verify.md`

### 5b. Playwright 渲染验证（两条线都做）

基于审批通过的测试方案写 `interactions.json`，再按上方平台语法调用 prototype-verify，传入 prototype 目录、交互文件、已批准方案和 `data-testid` 约束。Open Design 线先用 `get_artifact` 取得本地文件；需要人工预览时直接打开 `get_run` 返回的 previewUrl。

产出：`verify-output/screenshots/` + `verify-report.json`。errors > 0 → 修原型后重跑。

**Phase 2 场景从 `.ix.md` 行为规格逐字段机械转译**（触发/规则/退出 100% 场景化，每场景带断言）；**修改后必重验**——原型任何改动（含用户反馈迭代）→ 受影响页面 Phase 1 + 相关 Phase 2 重跑，矩阵刷新。

> 展开：转译规则、action 集合（含 press/assert）、interactions.json 示例、验证失败处理 → `references/playwright-verify.md`

### 5c. 页面覆盖矩阵（必做）

真值源：`.ix.md` 的 IA（页面/视图清单）。矩阵行从 IA 逐条搬，每行核对该页面在各层产出中是否存在。

```
## 页面覆盖矩阵

| IA 页面/视图 | 类型 | 原型实现位置 | 原型中可达 | 截图证据 | 状态 |
|---|---|---|---|---|---|
| 首页 | 独立页面 | home.html | tab "首页" / URL 跳转 | home.png | ✅ |
| 资源详情 | 嵌入组件 | library.html 内 (Drawer) | 行点击滑出 | detail-drawer-open.png | ✅ |
```

**无截图不允许标 ✅。Gate 要求全部 ✅，不接受部分覆盖。**

### 5d. 交互覆盖矩阵（必做）

真值源：`.ix.md` 的交互清单（每条交互带 ID）。逐条核对每个交互在原型中是否可操作。

```
## 交互覆盖矩阵

| 交互 ID | 交互描述 | 原型中的实现 | 行为规格验证（触发/规则/退出） | 截图证据 | 状态 |
|---|---|---|---|---|---|
| 订单.P1.1 | 浏览商品列表 | 资源库 tab | 触发✓ 规则✓ 退出 N/A | library.png | ✅ |
```

**无截图不允许标 ✅。Gate 只认 ✅，不存在中间态通过。**「行为规格验证」列：触发 / 规则 / 退出三字段 **100% 转译成带断言的场景且跑过**才打 ✓（字段为 N/A 的跳过）——转译规则见 `references/playwright-verify.md`。

### 5e. vis-review 评审

按 `references/vis-review.md`（视觉 9 维度 + 档位判据）做视觉评审——Read 它拿维度，然后按上方平台语法调用 reviewing。传入 `.ix.md` + `.vd.md`、全部 9 个维度、checklist、完整 Context Capsule，以及 `<full-heavy|iteration-light>` 深度。**对象** = 设计文档；**档位** = 全流程默认重档，迭代模式单页局部修改 → 轻档。引擎按 reviewing 流程产 findings + verdict。

本步把以下材料连同 `.ix.md` / `.vd.md` 一起喂给 vis-review 评审：
- 5c/5d 矩阵完整性
- PRD 路径走查结果
- Playwright 截图 vs 设计意图

vis-review 的 9 维度已含原五维自审（信息层级 / 一致性 / 交互流连贯=交互完整性 / 可行性 / PRD 路径覆盖=PRD 对齐），并补 4 维（竞品参考充分度 / 状态完整性 / 方向发散 / 简化检查）。

findings 套统一契约（C/W/S），**Critical 必须全部修复后重跑 Playwright 验证**。

### 5f. 验证记录写入 .vd.md

在 `.vd.md` 中新建 `## 验证记录` 节，包含：
1. 测试方案（5a 审批通过的版本）
2. 页面覆盖矩阵
3. 交互覆盖矩阵
4. PRD 路径走查结果
5. vis-review 视觉 9 维度评审结果（含原五维自审）
6. vis-review findings 摘要（套 findings 契约 C/W/S，升档时含交叉审）
7. Playwright verify-report.json 摘要

**Exit Gate:**
- [ ] Playwright Phase 1（截图）+ Phase 1b（UI 细节审核）全过
- [ ] Playwright Phase 2（行为规格逐条）全过
- [ ] 页面覆盖矩阵 100%（有截图证据）
- [ ] 交互覆盖矩阵 100%（有截图证据）
- [ ] PRD 路径走查过
- [ ] vis-review 无 Critical（升档时含交叉）

verify-report.json errors = 0 才过 Gate。

---

## Step 6: 保存 + Handoff

**Core Actions:**
1. `.vd.md` → `{pd_vd_output}`（按 `references/vd-doc-template.md`）
2. 原型：Open Design 线记 projectId（原型项目）+ dsProjectId（DS 项目）/ HTML → `{pd_vd_output}` 同目录下 `{topic}.prototype.html`；样张 `styleguide.html` 同目录保存
3. **回流检查**：原型阶段新产生的设计决策（行为补充、时序参数）已登记——行为类回 `.ix.md`「下游澄清回流」节，视觉类落 `.vd.md`「原型阶段补充决策」节；原型内 token 名与 Step 3 冻结表逐一一致（**禁改名**，下游 devflow 按名继承）
4. 提示用户进入 devflow；用户确认后按上方平台语法调用 devflow，传入 PRD、`.ix.md`、`.vd.md`、prototype artifact、确认范围和“保留冻结 token 名”约束。

**Exit Gate:**
- [ ] `.vd.md` + 原型 + 样张已保存
- [ ] 回流检查过（补充决策已登记，token 名零漂移）
- [ ] 全部 Task 已更新

---

## Exit Gate (Global)

- [ ] 视觉参考集已整理
- [ ] 交付线 + 视觉方向已定，产出标准（含「不包含」清单）已告知
- [ ] 设计系统已冻结（tokens 八项 schema + components + 样张经拍板）+ 落点完成（CD 线 DS 项目 / HTML 线落盘）
- [ ] 原型已产出，覆盖 IA 全部页面/视图（100%）
- [ ] 验证通过（Step 5 Gate 全过）
- [ ] 回流检查过（补充决策已登记，token 名零漂移）
- [ ] `.vd.md` + 原型 + 样张已保存到 `{pd_vd_output}`

## AI 能力边界

| AI 能做 | AI 不能做（标 `[ASSUMED]`） |
|---|---|
| 视觉方向 / 配色排版建议 | 品牌战略决策 |
| 可交互原型 | 像素级还原手稿 |
| 设计系统搭建 | 真实用户可用性测试 |
| Playwright 渲染验证 | A/B 测试预判 |

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "先出静态稿给用户看一眼再说" | 本 skill 无静态档——Phase 1 截图同样确认视觉观感，交互一次做到位比补两轮快 |
| "原型不可能全都做" | 对 AI 没有做不完，只有演示方式问题（状态切换按钮）。砍内容必须能引用产出标准，「做不完所以不做」不是理由 |
| "控件四态是开发的事，设计系统不用定" | 控件四态是组件属性，Step 3 定一次全站继承——开发阶段逐处补的成本远高于此 |
| "真源在代码库，Open Design 的 DS 项目只是二次镜像，不用推" | 镜像正是要推的东西——冻结快照落 DS 项目才有面板可浏览、跨项目可绑定、协作可见；tokens 内联进原型只解决渲染，替代不了落点 |
| "视觉方向凭感觉定一个" | 2-3 个方向让人选，比赌一个返工率低 |
| "小项目跳过设计系统" | tokens + components 必做——组件清单由交互驱动，小项目清单自然短；跳过的代价是并行生成各页漂移 |
| "Open Design 不可用就没法做" | 本地 HTML 是完整备选 |
| "Modal 太简单不用做原型" | IA 里列了就要实现，在宿主页面里加一个 `<dialog>` 不费事 |
| "截图看了没问题就行" | Playwright 跑一遍比看一眼靠谱 |
| "没有 .ix.md 但我知道交互是什么" | 凭记忆出视觉 = 在空气上贴皮，先跑 pd-ix |
| "这个改动简单，跳过某 Step 或不建 workflow.plan.create" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权 |

## Red Flags

- 没建 workflow.plan.create 就开始做
- 没有 .ix.md 就开始出视觉
- 只出「关键页」（覆盖度恒 100%，砍页面数不是选项）
- 开工前没告知产出标准的「不包含」清单
- 只给一个视觉方向
- Step 3 没走完就出稿：tokens schema 缺项 / 样张没经拍板 / 组件硬编码 hex/px / 3d 落点没完成
- Open Design 线设计系统没落 DS 项目（tokens 只内联进原型项目——「真源在代码库」不是豁免）
- 同时加载两个风格预设包
- Step 4 没回查交付线
- 原型 token 名与冻结表不一致（禁改名）
- 原型实现了 `.ix.md` 未定义的行为且未回流登记
- 覆盖矩阵手填 ✅ 没跑 Playwright 验证
- Phase 2 场景没从行为规格转译（触发/规则/退出有字段未场景化）、场景无断言
- 改了原型没重跑受影响场景就请求用户再看（迭代模式第 4 步不可省）
- 用户要改原型时绕开本 skill 直接改 HTML（应进迭代模式）
- 嵌入组件单独建了文件（应在宿主页面内实现）
- IA 中有页面/视图但原型里没实现
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 workflow.plan.create、或漏掉最后的交接 task
