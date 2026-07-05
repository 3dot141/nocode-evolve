---
name: dev-design-refine
description: 详细设计——把 dev-design-select 的方案（Decision Packet）细化为设计文档并做唯一评审，feat / bug / refactor 三场景。由 dev-design 协调器在方案选定后调用，或用户直接要求把已定方案写成详细设计文档时进入。Not for 选方案/技术选型/预研（use nocode:dev-design-select），渲染 HTML（use nocode:dev-design-render），code comments, PR descriptions, commit messages, or READMEs.
---

# dev-design-refine — 设计完善

**Iron Law: 详细设计不是"写文档"——领域怎么拆、模块怎么组织、接口长什么样，这些是设计决策。文档只是这些决策的载体。**

dev-design-select 选完方案（"走哪条路"，产出 Decision Packet），本 skill 做详细设计（"选定的路怎么走"）：领域划分、模块设计、接口设计、业务流、文件影响。设计文档是详细设计的自然产出物，不是额外"写"出来的。

> Leading word: **领域设计**。所有细化收敛到一份按 DDD 组织的设计文档。

## DDD 基础原则（贯穿全 skill）

- **域 = 围绕业务实体的边界**（名词不是动词）。"订单域 / Agent 域"，不是"创建 / 同步"
- **高内聚**：每个域 / 模块自包含——接口 + 业务流 + 文件影响 + 验证 + 安全/性能 都在自己的章节里
- **低耦合**：域间通过接口交互，边界显式标出
- **总分结构**：先总图（全局一屏看完）再分（各域 / 模块展开）。先图后文
- **接口四层**：对外 API / 类接口 / 事件接口 / 数据契约——按需展开，不只有 HTTP

## 非本 skill 请求

- 没有选定方案（无 Decision Packet），要先探索 / 选方案 → 回 `nocode:dev-design-select`
- 写代码注释 / PR 描述 / commit message / README / changelog → 不进
- 纯执行不需设计 → 直接做

## 协调模式：确认与回退

- **确认点**（Step 2 文档结构确认 / Review findings 逐条 fix-skip / 是否渲染）：被 `dev-design` 协调器调用时**返回 `needs_user_input`** 交协调器统一弹（envelope 单源见 select SKILL「收尾」节）；独立运行时用本地 AskUserQuestion。
- **方案级决策变更**（改数据流 / 模块边界 / 外部契约 / 关键约束）：返回 `replan_required` 回 select 重选（不是 needs_user_input）——refine 只做局部决策（P2）。
- **StageResult** = `completed | needs_user_input | replan_required`（refine 向协调器返回的三态，与 select 对齐）。

## Enter Gate

- [ ] dev-design-select 已完成（Decision Packet：选定方案 + 探索结论 + 测试目标），或用户直接要求写设计文档并已说清要做什么
- [ ] 场景类型已确定（feat / bug / refactor）

> 端到端示例见 `references/example-feat-skeleton.md`（feat）+ `example-bug-skeleton.md` / `example-refactor-skeleton.md`。

## 协议

> **消费 Decision Packet**：refine 是决策包的**消费方**——dev-design-select 产出、经协调器传入。schema（含 requiredFields / 条件必填 / replan envelope）单源在 `dev-design-select` SKILL 的「收尾」节，本 skill 只按它校验、映射、消费，不重复定义。

> **内部 Step 编号统一**（解决 P1）：通用流程步 **Step 0-5** 与场景模板 detail 步 **Step 4a/4b/…** 连续编号，不再各自从 Step 2 重启——历史上"通用 Step2 章节大纲 vs 场景 Step2 领域划分"的撞车就此消除。

### Step 0: TaskCreate

**进入后第一件事**，创建以下 task（Step 4 内部 detail 子步因场景而异，见各模板）：

```
Task 1: 消费 Decision Packet + 确定场景 + 加载输入 + 读 example（步 7 落笔前核对）
Task 2: 文档结构确认——章节大纲 + 结构骨架，用户确认（步 8）
Task 3: 架构审核——审结构骨架的域拆分/边界/依赖（步 9）
Task 4: 信息补全——按场景模板 4a/4b 逐节补全，遇新决策套 replan 判据（步 10）
Task 5: 汇总——文件影响总表 + 验证策略总表（步 11）
Task 6: Review（唯一评审：调 reviewing 引擎、有异议升档交叉 + 用户逐条确认 + Review Log）（步 12）
Task 7: 保存 + 渲染确认 + handoff（步 13-14）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

---

### Step 1: 消费 Decision Packet + 确定场景 + 加载输入 + 读 example

> 对应 14 步流程线的 **步 7 落笔前核对**。落笔前先校验上游交接契约完整，再确定场景、加载输入。

**Enter Gate:**
- [ ] 能拿到设计输入（dev-design-select 的 Decision Packet，或用户直接描述）

**Core Actions:**

1. **消费 + 校验 Decision Packet**（经协调器从 select 传入时必做；用户直接描述、无 Packet 时跳过校验、从描述提取）：
   - **校验 version**：不支持的 schema version → **返回错误**，不静默按当前版本硬解析（防上下游字段漂移）
   - **校验 requiredFields**（**清单单源见 `dev-design-select` SKILL「收尾」节的 schema**，本 skill 不复述字段名以防漂移）：缺任一 → 报缺、回协调器补，不带缺口硬写
   - **条件必填校验**：`isAIFeature=true` 时 `evalSpec` 必填；涉及运行时逻辑时 `domainDecisions.observability.basicLogging` 必填。**空数组 / 空占位视为缺失**，不放行
   - **字段映射到文档章节**：`selectedApproach + alternatives → 决策章节`（① 反方配平用 `alternatives`）、`constraints → 约束`、`domainDecisions → 领域/架构设计`（含可观测层 ⑥）、`openQuestions → 未决项`（进信息补全消解，遗留则进 Review 的 Open Questions）、`testObjectives + verifyStrategy → 验证策略`、`evalSpec → eval 设计节`（③）、`sources → 前置调研`

2. **确定场景**（从 devflow / Packet 继承，或按意图判断）：

   | devflow 场景 / 用户意图 | 本 skill 场景 | 用哪个模板 |
   |---|---|---|
   | Full / 新功能 / 产品设计 | **feat** | DDD 域设计（最完整） |
   | Fix / bug 修复 | **bug** | 根因 → 修复 → 影响 → 验证 |
   | 重构 / 重组 / 迁移 | **refactor** | 现状 → 目标 → 迁移 |

   > 预研 / 技术选型 / 调研（research）→ 不在本 skill，走 `dev-design-select` 的预研模式（产出 Decision Packet）。refine 只做 feat / bug / refactor 三种详细设计。

3. **读对应 example 作为参考**：
   - feat → Read `references/example-feat-skeleton.md`（多域/单域完整示例）
   - bug → Read `references/example-bug-skeleton.md`
   - refactor → Read `references/example-refactor-skeleton.md`
   学骨架和颗粒度，不照搬措辞。

4. **加载输入**：Decision Packet（选定方案 / 备选 / 约束 / 领域决策 / TO / evalSpec / 来源）、UI 设计（`.ix.md` / `.vd.md`，如有）。无 Packet 时从用户描述提取。

**Exit Gate:**
- [ ] Decision Packet 已校验（version + requiredFields + 条件必填齐；不齐已报缺回协调器）
- [ ] 场景类型已定，对应 example 已读，设计输入已加载

---

### Step 2: 文档结构确认（章节大纲 + 结构骨架）

> 对应 **步 8 文档结构确认**。一次产出"文档会有哪些章节"+"架构结构骨架"，让用户确认。结构骨架是下一步架构审核的对象。

**Enter Gate:**
- [ ] Step 1 完成

**Core Actions:**

1. **章节大纲**：基于场景生成本次设计文档的章节列表，展示给用户（不同场景章节不同，见各模板）。
2. **结构骨架**（架构审核的对象，先图后文，内容见各场景模板「结构骨架」节）：
   - **feat** → 域划分 + 域关系总图
   - **bug** → 现象 + 复现 + 影响范围（问题位置图在 Step 4a 根因分析里补细）
   - **refactor** → 现状结构图 + 目标结构图（before/after）
3. **AskUserQuestion 确认**：确认大纲 + 结构骨架 → 进入 Step 3；要调整 → 改后再确认；章节太多 → 去掉不需要的（小改动不需监控/eval 章）。

**feat 章节大纲示例**：

```
1. 背景
2. 调研（代码现状 + 竞品分析 + 已有决策）
3. 方案选择（决策速查表 + 逐 Q 反方配平）
4. 领域划分 + 总图（资源域 + Agent 域）
5. 架构设计（技术架构图 + 数据流）
6. 表现层设计（端到端业务流总图 + 各场景）
7. 领域层设计（各域展开）
8. 文件影响汇总
9. 验证策略汇总
10. 可观测设计（基础日志必写 + 生产监控按需）
11. eval 设计（AI 功能类必写）
```

**Exit Gate:**
- [ ] 章节大纲 + 结构骨架经用户确认

---

### Step 3: 架构审核（结构确认后、信息补全前）

> 对应 **步 9 架构审核**。评审拆两层的**早层**：结构定型后立刻审架构骨架——架构错了此时改动成本最低。晚层（完整性/一致性/可执行）在通用收尾的唯一评审做，各审各的不重叠。

**Enter Gate:**
- [ ] Step 2 结构骨架已确认

**Core Actions:**
- 审 Step 2 结构骨架：**域拆分按实体（名词非动词）** / **模块边界清晰** / **依赖方向单向无环** / **高内聚低耦合**
- 对照 Decision Packet 的 `selectedApproach` + `domainDecisions`：结构是否忠实落地选定方案，无偏离
- **场景轻重**：feat / refactor 重点审（域/模块拆分是架构核心）；**bug 局部修复通常无跨模块架构影响 → 快速确认影响范围不跨模块即轻过**
- 发现架构级问题（域拆错 / 边界错位 / 依赖成环）→ 就地修正结构骨架、回 Step 2 重新确认；若问题触及**方案级决策**（改数据流 / 模块边界 / 外部契约 / 关键约束）→ 按 Step 4 replan 判据返回 `replan_required` 回 select

**Exit Gate:**
- [ ] 结构骨架架构审核通过（域拆分/边界/依赖方向），或轻过（bug 无架构影响）

---

### Step 4: 信息补全（逐章补全详细设计）

> 对应 **步 10 文档信息补全**。按场景模板的 detail 子步（**Step 4a / 4b / …**）逐节补全。

**Enter Gate:**
- [ ] 架构审核通过

**通用原则**：
- 先图后文，每章有图的先画图
- 图标路径 ID / BF / 约束，文本引用 ID，互相跳转
- 每个域/场景章节自包含（接口+业务流+文件影响+验证+安全/性能）

**每遇新决策 → 套「局部 vs 方案级」判据**（钉死 P2：方案级决策只属 select，refine 只做局部决策）：
- 改动**数据流 / 模块边界 / 外部契约 / 关键约束**任一 → **方案级决策**：停下，返回结构化 `replan_required`（含 `originalPacketRevision / invalidatedDecision / evidence / affectedSections[] / resumeState`，envelope 单源见 select SKILL），由协调器回 select 重选，不带方案级变更硬写
- 都没改（接口参数 / 命名 / 模块内部实现）→ **局部决策**：refine 自己定，小问题 AskUserQuestion 当场确认，不中断

具体 detail 子步见下方各场景模板。

**Exit Gate:**
- [ ] 场景模板各 detail 子步（4a/4b/…）完成
- [ ] 遇方案级决策已返回 `replan_required`（若有）

---

### Step 5: 汇总（文档落地）

> 对应 **步 11 文档落地**。所有场景共用一次汇总。

**Enter Gate:**
- [ ] Step 4 各 detail 子步完成

**Core Actions:**
- **文件影响总表**（合并各小节，全局视图，统计 NEW / 改 数量）
- **验证策略总表**（跨场景跨域的 E2E / 集成测试；各小节内的单测/组件测试见各小节）

**Exit Gate:**
- [ ] 文件影响总表产出
- [ ] 验证策略总表产出（覆盖每条使用路径）

→ 进入「通用收尾」（Review + 保存）。

---

## feat 模板（DDD 全流程，最完整）

> 新功能 / 产品设计。按 DDD 组织：总图（域关系）→ 边（交互场景 / 表现层）→ 节点（域设计 / 领域层）→ 汇总。

**设计思路**：用 DDD 拆分业务域，域间关系图就是产品设计全貌。边（域间关系）= 交互场景（表现层），节点（域）= 领域设计。先画总图让 reviewer 30 秒看清全局，再逐个展开边和节点。每个域自包含——接口、业务流、文件影响、验证都在域章节内，读一个域不用跳来跳去。

> 产出骨架示例见 `references/example-feat-skeleton.md`

### 结构骨架（喂 Step 2 → Step 3 架构审核）

feat 的结构骨架 = **领域划分 + 总图**：

1. **划分域**——从选定方案识别业务实体，按实体划域（名词不是动词）。**讲清为什么这么拆**：按变更边界拆（改一个域不需要动另一个域）。
2. **画总图**（先图后文）：
   - **多域** → 域间关系图：节点 = 域 + 核心实体，边 = 交互场景（用户流程）
   - **单域** → 域内模块关系图：节点 = 模块，边 = 调用 / 依赖
3. **总图 = 产品设计全貌**。每条边是表现层（用户看到的流程），每条边应对应 PRD 一条使用路径。

```
多域总图示例（节点=域，边=用户流程）：
┌──────────┐   导入流程    ┌──────────┐
│  资源域   │ ───────────→ │ Agent 域  │
│ Resource │ ←─────────── │  Agent   │
└────┬─────┘   同步状态     └──────────┘
     │ 预设管理
     ↓
┌──────────┐
│  预设域   │
│  Preset  │
└──────────┘
```

产出标准：域划分完成（每域标核心实体 + 拆分理由）+ 总图（先图后文）+ 每条边对应 PRD 使用路径。→ 交 Step 2 确认、Step 3 架构审核。

### Step 4a: 交互场景设计（边 / 表现层）

**Enter Gate:**
- [ ] 架构审核通过，边已识别

**Core Actions:**
逐条边展开。来自 pd-ix 的交互设计 → 细化为前端组件 + 消费的域接口；无 pd-ix 时从使用路径推导。

每个场景章节自包含：
- **流程图**（用户操作的串行步骤）
- **前端组件设计**（组件拆分 / 状态 / 关键交互）
- **消费哪些域的哪些接口**（连接表现层和领域层）
- **文件影响**（前端文件）
- **验证方案**（组件测试 / E2E）
- **安全 / 性能**（如涉及，如 SSRF 校验 / 大文件 streaming）

> 纯后端无 UI 时，"交互场景"变为"系统交互场景"（API 调用链 / 事件流 / 定时任务触发），结构同。

**Exit Gate:**
- [ ] 每条边展开完毕，每个场景有流程图
- [ ] 每个场景标注消费的域接口
- [ ] 每个场景有文件影响 + 验证方案

### Step 4b: 域设计（节点 / 领域层）

**Enter Gate:**
- [ ] 交互场景已定（各域的接口需求已明确）

**Core Actions:**
逐个域展开。每个域自包含，内部拆到模块：

1. **域内模块关系图**（总览，先图后文）
2. **每个模块**：
   - 类接口（public 方法签名 + 关键字段）
   - 状态机（实体有状态转换时）
   - 业务流（BF 编号，`function`/`method` 签名 + 函数体 + 每行 `//` 注释，主路径 + 异常路径）
3. **域级接口设计**（四层按需，不只 HTTP）：
   - **对外 API**：HTTP / RPC / GraphQL 端点表（Method / Path / Request / Response / 错误码）
   - **类接口**：模块间 public 方法签名（多类协作画类图）
   - **事件接口**：Event / MQ / WebSocket / SSE
   - **数据契约**：DB schema（多表外键画 ER 图）/ 配置格式 / 文件格式
4. **域文件影响**（该域改哪些文件，ASCII 树 + (改)/(NEW)）
5. **域验证方案**（单测 / 集成）
6. **域安全 / 性能考量**（如涉及）

**Exit Gate:**
- [ ] 每域展开完毕，每域有模块关系图
- [ ] 每域接口按四层覆盖（涉及的都展开）
- [ ] 每域有业务流（BF 伪代码）+ 文件影响 + 验证方案

（汇总 → 通用 Step 5）

---

## bug 模板

> 根因分析 + 修复方案。形状：现象 → 根因 → 修复 → 影响 → 验证。

**设计思路**：从现象追到根因，用代码追踪链（每步标 `[Read path:line]`）让 reviewer 能跟着走一遍推理过程。修复方案用"修复前 vs 修复后"的伪代码对比——不只说改了什么，要说"改之前是怎么走的、改之后怎么走"。总图画出问题在系统里的位置，reviewer 能判断修复会不会影响其他模块。

> 产出骨架示例见 `references/example-bug-skeleton.md`

### 结构骨架（喂 Step 2 → Step 3 架构审核）

bug 的结构骨架 = **问题现象 + 复现 + 影响范围**：
- 症状描述 + 复现步骤 + 预期 vs 实际
- 影响范围（哪些用户 / 场景受影响）—— 架构审核的对象：确认影响范围**不跨模块**（局部 bug 通常轻过）

产出标准：症状 + 复现步骤 + 影响范围已写清。→ 交 Step 2 确认、Step 3 架构审核（轻过判定）。

### Step 4a: 根因分析

**Enter Gate:**
- [ ] 复现已明确、架构审核已判定影响范围

**Core Actions:**
- **代码追踪**：从症状到根因的推理链，每步标 `[Read path:line]`
- **根因定位**：哪个模块、哪行逻辑有问题
- **问题位置图**：问题在系统中的位置（受影响的模块关系图，先图后文）

**Exit Gate:**
- [ ] 根因定位（带 `[Read path:line]` 推理链）
- [ ] 问题位置图产出

### Step 4b: 修复方案

**Enter Gate:**
- [ ] 根因已定位

**Core Actions:**
- 修复方式 + 为什么这么修（多种选择时简要对比）
- 类接口变更（如涉及）
- **业务流变更**：修复前 vs 修复后的伪代码对比
- 文件影响
- **验证方案**：回归测试（先复现 bug → 修复后验证）+ 复现用例
- 安全 / 性能影响（如涉及）

**Exit Gate:**
- [ ] 修复方案 + 理由
- [ ] 修复前后业务流对比
- [ ] 文件影响 + 回归测试方案

（汇总 → 通用 Step 5）

---

## refactor 模板

> 从 A 状态到 B 状态。形状：现状 → 目标 → before/after → 迁移。

**refactor 产出骨架示例**：

```
# Refactor: 资源同步从轮询改为事件驱动

## 现状分析
  现状结构图 + DDD 问题诊断
  问题：SyncService 轮询所有 Agent，耦合重、延迟高

## 目标设计
  Before                          After
  ┌─────────────┐                ┌─────────────┐
  │ SyncService │                │ SyncService │
  │ poll(all)   │     →          │ onEvent()   │
  │ 轮询全部     │                │ 事件驱动     │
  └─────────────┘                └─────────────┘
  变更理由 + 每个变更点说明

## 迁移策略
  Step 1: 加事件基础设施（可回滚）
  Step 2: 双写（轮询 + 事件并行）
  Step 3: 关闭轮询（一键回退到 Step 2）
  每步文件影响 + 验证 + 回滚方案

## 汇总
```

### 结构骨架（喂 Step 2 → Step 3 架构审核）

refactor 的结构骨架 = **现状结构 + 目标结构（before/after）**：

1. **现状分析**：
   - **现有结构**（总图：当前的模块 / 域关系，先图后文）
   - **问题在哪**（为什么要重构）
   - **DDD 视角审视**：域划分合理吗？高内聚低耦合吗？哪里耦合过重 / 职责混乱
2. **目标结构**：
   - **目标结构**（总图：重构后的模块 / 域关系）
   - **Before/After 对比**（两张图并排，标出每个变更点）

产出标准：现状结构图 + 问题诊断（DDD 视角）+ 目标结构图 + Before/After 对比。→ 交 Step 2 确认、Step 3 架构审核（审目标架构是否解决现状问题、依赖方向是否改善）。

### Step 4a: 变更点理由 + 细化

**Enter Gate:**
- [ ] 架构审核通过（目标结构定型）

**Core Actions:**
- 逐个变更点讲**为什么这么改**（对照现状问题，每个变更点解决哪条）
- 涉及的类接口 / 数据契约变更（如有）

**Exit Gate:**
- [ ] 每个变更点有理由（对应现状某条问题）

### Step 4b: 迁移策略

**Enter Gate:**
- [ ] 目标设计已定

**Core Actions:**
- **步骤拆解**：怎么从 A 到 B，每步可回滚
- **兼容策略**：过渡期两套共存？还是一刀切？
- 每步文件影响
- 每步验证方案
- 风险 + 回滚方案

**Exit Gate:**
- [ ] 迁移步骤（每步可回滚）
- [ ] 兼容策略
- [ ] 每步文件影响 + 验证 + 回滚方案

（汇总 → 通用 Step 5；重构尤其重回归测试——证明行为不变）

---

## 通用收尾：Review + 保存（所有场景）

### Review（唯一评审 · 调 reviewing 引擎 · 有异议升档）

> **本 Review 是整份设计文档的唯一一次全文评审**（P3：消除历史"dev-design Step9 + refine 收尾各审一遍"的重复）。协调器不再重复评审，只验证本步返回的**标准化 review verdict**。与 Step 3 架构审核**不重叠**：Step 3 是早层（结构定型时审架构骨架的域拆分/边界/依赖），本 Review 是晚层（全文写完时审完整性/一致性/可执行）。

**Enter Gate:**
- [ ] 设计文档初稿完成（含 Step 5 汇总）

**调 reviewing 引擎**：本 Review 的评审执行走 `reviewing` 引擎——Read `references/design-doc-review.md` 拿设计文档评审维度，然后 `Skill(nocode:reviewing)`，声明：

- **对象** = 设计文档
- **领域维度** = design-doc-review 的 8 维度核心审查（设计意图 / 决策 / 完整性 / 可执行 / 一致性 / 范围 / 骨架可读性 / 方案质量与验证覆盖）+ 附带检查
- **方法** = checklist（或让引擎按对象自选）
- **Context Capsule** = 已拍板决策 / 被否决方案及原因 / 非目标 / 预算（不带作者对文档的预期结论）
- **档位**（领域特化）：设计文档跨模块、含架构 / 选型决策 → 重档（7 维度全量过）；琐碎改动 / 文案修订、拿不准 → 轻档（agent 自判，命中重档信号后要降只认用户显式否定词）

引擎产 findings + verdict——主路派发 / 升档异源交叉 / CLAIM 剥离 / codex 降级 / Evidence Gate / Doubt Theater / 分级归一（五档 C/W/S/Q/SA，Q/SA 经 kind 承载不丢语义）全由引擎承载，本节不复述。dev-design-refine 拿到引擎返回的 findings（五档全保留）后，做下面的收口确认。

**收口 + 用户确认（框架步骤 7 · hard gate）**：
- 把 findings 完整呈现给用户（C / W / S / **Open Questions(Q)** / **Self-Audit(SA)** 五档全保留，后两者绝不能漏）
- 每条问题短编号（`C1 / W1 / S1 / Q1 / SA1`）
- 用户逐条勾选 fix / skip；Open Questions 三选 fix / skip / **answer**
- 快捷选项：「全修 Critical+Warning+Self-Audit」「全跳过」「自由指示」
- **Critical 不可 override**（skeleton §5）；**用户确认前不动文档主体**
- 例外：verdict `approved:true`（reviewer ✅ Pass）→ 跳过此步直接保存

**修订 + Review Log**：
- 据用户决定 in-place 改主体；不在清单里的问题不顺手修
- 把本轮 findings 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`
- 询问「再来一轮 review？」是 → 回 Review 调引擎（是否重跑异源交叉由引擎按 delta 判据定：纯修复不重跑，结构性变更 / 用户要求才重跑）；否 → 保存

**返回标准化 review verdict（交协调器）**：本 Review 收口后向协调器返回 verdict（`approved: true|false` + 未决 Open Questions + 剩余风险），schema 套 `findings-contract` 的 verdict 层。**协调器只验这个 verdict、不重新评审**（评审的唯一所有者是本步，P3）。

**Exit Gate:**
- [ ] 评审已调 reviewing 引擎（传 design-doc-review 维度）
- [ ] 引擎返回 findings（升档时含异源交叉，或引擎记录未升档）
- [ ] findings 套统一契约（五档；Q/SA 经 kind）
- [ ] 用户逐条确认 fix / skip
- [ ] 修订完成 + Review Log 已追加
- [ ] 标准化 review verdict 已产出（交协调器，供其验证不重审）

### 保存 + 渲染确认

**Core Actions:**
1. 保存到 `{dev_design_output}`（见 `model/agent-about.md`「文档产出路径变量」）
2. **AskUserQuestion：是否渲染成 HTML？**
   - 是 → 调 `Skill(nocode:dev-design-render)` 把设计文档转成可浏览的 HTML（架构图/流程图/时序图渲染为 SVG，表格可交互）
   - 否 → 设计文档（markdown）即最终交付
3. **硬交接**：向调用方/用户报告 dev-design-refine 完成 + 文档保存路径 + **review verdict**——若由协调器（dev-design）调入，返回 reviewed 文档 + verdict，协调器**只验 verdict 不重审**，继续状态机（→ render / final gate）；独立进入则向用户报告完成并建议下一步（评审已在本步做过，不再走 dev-review；直接进 dev-plan）

**Exit Gate:**
- [ ] 文档已保存到正确路径
- [ ] 渲染确认已完成（渲染 / 跳过）
- [ ] 全部 Task 状态已更新

---

## 写作准则（核心）

> **同源 note**：本节准则与 `references/design-doc-review.md`《核心审查》是同一套规则的两个视角——writer 视角"做什么" vs reviewer 视角"挑什么"。改一处务必同步检查另一处。

理解原则比死守章节更重要。

### 1. DDD：域按实体拆，每域自包含

域名是名词（订单 / Agent / 会话），不是动词（创建 / 同步 / 更新）。同一实体被拆到多个"域" = 拆错了。每个域 / 模块章节自包含：接口 + 业务流 + 文件影响 + 验证 + 安全/性能 都在自己的章节里，reviewer 读一个域不用跳来跳去。

> ✅「资源域 / Agent 域」（实体）
> ❌「导入解析 / 存储去重 / 同步」（动词 = 流水线阶段，不是 DDD 域）

### 2. 总分结构：先总图再分，先图后文

文档先给总图（全局一屏看完），再逐节展开。每节内也先图后文——图放前面让读者先理解结构，文字补充图里没传达的细节。**禁止**"5 段文字 + 1 张图作总结"反向布局。

> ✅ 总图（域关系）→ 边展开 → 节点展开 → 汇总
> ❌ 直接跳进第一个模块的代码细节，读者不知道整体长什么样

### 3. 接口四层，不只 HTTP

接口设计覆盖：对外 API（HTTP/RPC/GraphQL）/ 类接口（public 方法签名 + 类图）/ 事件接口（Event/MQ/SSE）/ 数据契约（DB schema + ER 图 / 配置格式）。涉及哪层展开哪层。

> ✅ 资源域：类接口（ImportParser.parse 签名）+ 数据契约（Resource 表 + ImportManifest 格式）+ 对外 API（/api/import）
> ❌ 只列了 HTTP 端点，类怎么协作、数据怎么存只字未提

### 4. 视觉化优先：内容形态匹配视觉媒介

≥3 个并列项 / 对比 / 流程 / 状态转换 / 矩阵关系**禁止**写成长段，必须用对应媒介：

| 内容形态 | 用什么 |
|---|---|
| 多个对比维度（≥3 cell） | 表格 |
| 时序流程 / pipeline | ASCII 流程图（节点 + ↓） |
| 组件拓扑 / 数据流 | ASCII 架构图（方框 + 连线） |
| 状态转换 | 状态机图（节点 + 标条件的箭头） |
| 决策分支 | 决策树 |
| 层级 / 文件结构 | ASCII 树（`├─` `└─`） |

**图密度**：普通设计至少 1 张总图 + 各域 1 张模块图；长文档（>10 屏）平均 1-2 屏 1 张图作节奏锚点。

**图粒度**：总图组件 ≤ 7 / 流程节点 ≤ 10 / 时序角色 ≤ 5，超了下沉到子图，不靠把总图画大。

### 5. 小黄鸭式讲解：把"为什么"讲透

把读者当成完全没看过项目的小黄鸭——每个决策、每个数字都要 explain。遇到「显然」「众所周知」→ 信号说明跳步了，回去补"为什么"。数字 / 阈值 / 模块名 / 行号 都要交代来源，不允许 magic number。

> ✅「`HOLD_SIZE = 64` 字符。来源：最长入口点 30 字符 + LLM chunk 容差 → 64 字符滑窗才能稳定捕获跨 chunk 拼接。」
> ❌「`HOLD_SIZE = 64`（显然够用）。」

### 6. 直白讲 + 项目术语首次解释

一句话讲不清的概念说明你没真懂，回去搞懂再写。先讲直觉再补细节，不堆术语，不硬塞类比。项目内自创词 / 缩写首次出现一句话 inline 解释；业界通用名词（HTTP / TDD / retry）不解释。

> ✅「dogfood（用自己产出的工具实测）本插件历史决策……」
> ❌ 通篇用自创词却没告诉读者是什么

### 7. pain point 分主次

「背景」列多条问题时显式标主因 vs 辅因，不平铺 bullet 让读者自己排序。

> ✅「核心问题：迁移要手动 20+ 次。附带的格式不统一、缺校验——本设计顺带解决。」
> ❌「问题：1. 重复操作 2. 格式乱 3. 没校验 4. 没进度」（平铺不知哪条最痛）

### 8. 决策 ↔ 业务流交叉引用

域设计里的关键决策（如有多种选择），如果直接影响某条业务流，在决策处标注 `→ 影响 BFx`，reviewer 能跳到对应 BF 验证决策落地。

### 9. 业务流伪代码硬规则

- `function` / `method` 签名 + 函数体行，每行一句意图
- **每行 `//` 注释**（小黄鸭式，复杂逻辑 / 数字阈值必须讲来源）
- 真实类名 / 方法名（`AgentLoop.callLlmForTurn`），不用 placeholder
- **不是**文件结构树、**不是**层次列表、**不是**散文（那些属「文件影响」节）

### 10. 可观测分两层 + AI 功能带 eval（⑥③）

**可观测分两层，不再一刀切**：
- **基础日志（默认必写）**：关键路径 / 异常分支 / 模块出入口都要打 log，是每个功能的默认项，不设"要不要上监控"的条件。来源 Decision Packet 的 `domainDecisions.observability.basicLogging`。（⑥ 的根因：基础日志落在门槛之下成三不管地带 = "很多 `logger.info` 都没有"。）
- **生产监控（按需触发）**：Metrics / 告警 / Trace 三支柱，功能上生产、需整体健康度 / 告警 / 链路追踪时才展开。小改动 / 内部工具可不展开。

**AI 功能类带 eval 设计节（③）**：LLM 生成 / 分类 / 抽取 / Agent 决策等"对错单测覆盖不了"的功能，必须有一节 eval 设计——评估维度 / 指标 + baseline / 用例集 / 分级判定 L1-L4。来源 Decision Packet 的 `evalSpec`（select 在 AI 场景产出，refine 展开为设计节）。非 AI 功能此节省略。

> ✅ 关键路径每步 info、异常分支 warn/error、AI 功能有 eval 维度 + baseline
> ❌ 通篇无 `logger`、AI 功能只有功能设计没有"怎么评估好不好"

### 11. 决策章节：结论先行 + 反方配平 + 确认状态（①）

「方案选择」章节按此写（消费 Decision Packet 的 `alternatives`）：

- **结论先行·决策速查表**：章节**开头**先放一张速查表，列全所有决策点（Q1/Q2/…）+ 定了什么 + 确认状态 + 影响哪个 BF/约束。读者一眼看完所有拍板，再逐 Q 展开。
- **反方配平**：逐 Q 展开时，**每个否决项配与推荐项同等篇幅的理由**——不是"选 B，因为 B 好"，而是"否决 A：A 的代价是 X（展开），换不到的收益是 Y"。避免只夸推荐项、一句话带过否决项的假对比。
- **确认状态标注**：每个决策标 `[已确认]`（用户 / 评审拍板）或 `[假定]`（agent 自主定，待用户复核）。让读者知道哪些是拍死的、哪些还能推翻。

> 速查表 + 配平 + 标注三件套，本 skill 的重构设计文档自身「方案选择」节即样板。

### 12. 术语规范：「中文 英文全称 - 缩写」+ 文末术语表（⑤）

- **首次出现**：所有缩写 / 项目自创词首次出现用「中文 英文全称 - 缩写」三段式（如「测试目标 Test Objective - TO」「领域驱动设计 Domain-Driven Design - DDD」）。业界通用名词（HTTP / JSON / TDD）不展开。
- **文末术语表**：文档**最后**必带一张「术语与缩略语」表，集中列全所有缩写 + 一句话解释。读者不必回翻正文找定义。

> ✅「事前验尸 Pre-mortem（假设方案已失败倒推死因）……」+ 文末术语表
> ❌ 通篇 TO / BF / SC 缩写却没有一处解释、没有术语表

## 实现的边界：design-doc vs plan vs ops doc

**判据**：design doc 回答"为什么这么设计 + 关键路径长什么样"；plan 回答"按什么顺序写代码"；ops doc 回答"出问题怎么操作"。

留给 **plan**（dev-plan skill）：class 内部具体实现（私有方法 / 循环 / retry 退避算法）、TDD 步骤化清单、每步验证命令、mock 工具具体用法。

留给 **ops doc**：详细部署脚本 / K8s manifest / Helm chart、监控 dashboard 配置、告警 runbook。

设计文档的「业务流」止于"足以让 reviewer 判断设计合理"的粒度，不进 class 内部细节。「单测设计」按 BF 分组列 case（Given/When/Then 三行），**不写代码**（不写 `@Test` / mock setup / assertion 语法）。

## 「文件影响」节硬格式

多模块 ASCII 树 + (改)/(NEW) + ①②③ 编号要点。路径完整到包名（不缩略）；同一文件多处改动用 ①②③ 编号；行号 / 函数名能给就给。

```
src/services/import/
  ├── parser.ts                 (NEW)  三种格式解析
  └── validator.ts              (NEW)  资源校验
src/services/
  └── resource.ts               (改)   ① batchCreate() 方法
                                       ② findByNameAndType() 查询
```

## 常见反模式

- ❌ **域按动词拆**：把流水线阶段（解析 / 存储 / 同步）当 DDD 域——应按实体（资源 / Agent）拆
- ❌ **跳过总图**：直接进细节，读者不知道整体长什么样
- ❌ **接口只写 HTTP**：类怎么协作、数据怎么存只字未提
- ❌ **章节空话**：「需要保证安全性、性能」「未来可扩展」——无具体内容的填充
- ❌ **跳过 reviewer**：不 spawn reviewer 直接交付——review 是 hard gate
- ❌ **代用户拍板**：拿到 Report 自己挑修哪些——用户确认是 hard gate
- ❌ **吞 Review Log**：只改主体不 append Review Log——审计轨迹断
- ❌ **把 plan 内容塞进来**：class 内部 / TDD 步骤 / 具体 catch 块写法
- ❌ 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉收尾交接——进了 skill 就走完所有 Step（详见 agent-catalog-using.md「进了 skill 就走完」）

## 看 example skeleton 学结构，不照搬措辞

`references/example-{feat,bug,refactor}-skeleton.md` 三种场景各一份骨架示例。**看 example 学骨架，不照搬措辞 / 不套业务情境**。措辞按你的语境调；决策数量按设计复杂度（核心只有 1 个关键决策就写 1 个，不硬凑）；伪代码注释密度按复杂度（简单流程不必每行讲来源）。

## 状态机 + 文档生命周期（②）

- **Design Doc**：`draft → in-review → approved → implemented → archived`（**living**，approved 后仍可修改）

**推翻式修订：保持单一有效版**——当前有效内容就是正文，读者不需要在"顶部 banner + 正文 + 尾部 Review Log"三处对账才知道"现在到底信哪段"。大改时直接改正文，把旧结论移入 Review Log 留痕，正文只留当前有效版。

**superseded 留痕**——整份文档被另一份取代时：顶部标注 `> ⚠ superseded by <当前权威版路径>` 指向当前权威版；**保留原文不删**（供审计追溯），不靠删除或放任 stale 误导读者。

> ✅ 正文永远是当前有效版；被取代时顶部一行指向新版，原文留底
> ❌ 顶部 banner 说 A、正文写 B、尾部 Log 说 C，读者三处对账

## 输出路径

路径由 `{dev_design_output}` 变量定义（见 `model/agent-about.md`「文档产出路径变量」）。同 topic 的 plan 等文档落同一目录。

## references 索引

- `references/example-{feat,bug,refactor}-skeleton.md` — 三种场景的骨架示例
- `references/design-doc-review.md` — 设计文档评审维度（调 reviewing 引擎时传入）
- `references/cards/{quick-view,prerequisites}.md` — 骨架驱动型内容的可选锚点节
- `Skill(nocode:dev-design-render)` — 设计文档 → HTML 可视化
