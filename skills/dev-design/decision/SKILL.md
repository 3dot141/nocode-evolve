---
name: dev-design-decision
description: Private decision protocol used by dev-design to compare approaches and produce a Decision Packet; never invoke independently.
disable-model-invocation: true
---

本文写“结构化决策”时，必须带齐当前步骤的完整问题与 2–3 个互斥选项：

<!-- nocode:platform claude -->
使用 `AskUserQuestion` 提交完整问题和全部选项。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
在 `request_user_input` 可用时提交完整问题和全部选项；若当前模式未提供该工具，则在回合末尾直接提出同一问题并等待回答。
<!-- /nocode:platform -->

# decision — 选方案 + 预研，产出决策包

> dev-design 内部协议，不独立注册。由 dev-design 协调器在 decision 阶段 Read 并执行。

**Iron Law: 方案未对比的设计是假设不是设计。只提一个方案就让用户确认 = 假共识。**

decision 回答"走哪条路"——**先扩散再收敛**:探索 approach、多方案差异化对比,扩散结果交用户拍方向(Step 4a),再收敛下钻,产出结构化 **决策包 Decision Packet** 交给 writing 阶段写详细设计。本阶段只做决策,不做详细设计、不评审;Packet 落盘为设计文档初稿(见下)。

> Leading word: **approach**。没对比过的 approach 就没有设计,只有假设。
> **决策包 Decision Packet** = decision 产出、writing 消费的结构化交接契约(带 required 字段 + 版本),schema 见「收尾」节。
> **落盘载体 = `{dev_design_output}` 设计文档本身**:Full 场景该文档已由 Define 创建(首章「罗盘」= 已确认 restate),decision 在罗盘后追加账本;文档不存在(宽进无 Define)才由 decision 首条落账时自建(Step 5)。writing 在**同一路径覆盖扩写**为完整详细设计——不另造 `decision-packet.md` / `xxx-restate.md` 之类的独立文件。

## 两种模式

- **方案选择**(feat / bug / refactor 前置):为一个待实现的需求选架构方向,产出 Decision Packet → writing 阶段。
- **独立预研 research**(技术选型 / 调研):产出 research Decision Packet 后**直接交付终止**——由用户决定下一步(进 design / plan / 放弃),**不自动进 writing**。

## 用户介入原则

沟通结构 = **每轮方案确认(4a)+ 全程账本可见 + 1 个终审点(8a)**:每个决策层级(L1/L2/L3)的方案选定前都交用户拍方向,不静默;探索、失败预演、测试计划 agent 自主,每项决策锁定即落账本。

**例行确认每轮必过,不是例外触发**:
- **Step 4a 方案确认(每轮)**:每个决策层级(L1/L2/L3)的方案 + 权衡表成型后、选定前,交用户拍方向。L1 是杠杆最大的介入点;L2/L3 同样不静默——用户确认后才落账本。
- **Step 8a Packet 终审**:完整 Packet 展示给用户逐条审核。审的是领域决策 / TO 这层细节(方向已在 4a 定过)。

**决策账本**(非阻塞可见,载体 = 设计文档初稿,见 Step 5):Step 5 起每锁定一项决策就增量追加到账本(条目格式见 Step 5);层级边界(L1/L2/L3 锁定、6c 完成)在回合内给 1-2 行状态注记(本轮新锁 N 项 / 待定 M 项),不要求确认、不阻塞。8a 终审因此审的是一份用户看着长出来的账本,不是陌生成品。

**异常停下来问,仅限**:① 打平手(权衡相当,取决于用户主观优先级)② 冲突需拍板(与已有 ADR/wiki 决策冲突)③ 信息缺口(需 agent 拿不到的外部信息)④ 不可逆 + 高影响。

## Enter Gate（宽进严出）

**宽进**：有方案探索意图即可进入——不要求 Define 完成、不要求场景 = Full。

- [ ] 有方案探索意图（用户要选方案 / 对比方案 / 预研），或由 dev-design 协调器路由进入

**缺上下文时的入口处理**（decision 在 Step 1 探索前就地补全，不踢回 Define）：
- 无 restate → 从用户描述 / 对话上下文提取目标 + 范围 + 约束，作为探索基础；探索中发现范围模糊再追问，不前置 block
- 有 restate → 按原流程消费

> 端到端示例（restate → 方案对比 → 选定 → Decision Packet）见 `references/example-design-session.md`；预研模式骨架见 `references/example-research-skeleton.md`。

## 协议

### Step 0: workflow.plan.create

**进入后第一件事**,创建以下全部 task:

```
Task 1: 探索 — 三层并行(代码 pattern / 外部方案 / 已有决策)
Task 2: UI 需求理解(涉及前端时)
Task 3-5: 多轮方案选定(从大到小:L1 架构 → L2 组件 → L3 细节)
Task 4a: 方案确认(每轮:两回合展示方案对比 → 用户拍方向)
Task 6: 对齐 + 失败预演 + 领域覆盖检查(含可观测性)
Task 7: 测试目标 TO
Task 8: 落笔前核对 + 产出 Decision Packet(决策清点 + 功能覆盖 → Packet 完整性)
Task 8a: 用户终审 Decision Packet(展示完整 Packet → 用户确认/修改)
Task 9: 硬交接 — 交付 Decision Packet(方案选择模式→writing;research 模式→直接交付终止)
  metadata: {handoff: true}
```

调用时把上面**每一条** Task 建成稳定计划项，不得传空计划：

<!-- nocode:platform claude -->
使用 `TaskCreate` 逐项创建全部计划项并保存 task id；状态变化时使用 `TaskUpdate` 更新对应项。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
使用 `update_plan` 提交全部计划项；每次状态变化都提交完整列表，保持稳定顺序，且同时最多一个 `in_progress`。
<!-- /nocode:platform -->

每完成一个标 done。

### Step 1: 探索(三层并行)

探索分三层——代码内部、外部方案、已有决策,全部在提方案之前完成。不凭记忆,每个判断标注来源。**在一条消息里同时发出三个调用**,结果全回来再综合。

- **1a 代码 pattern**:先收 Define 探索胶囊(restate 附录),比对 scanBase 定复用/重扫;委派 `research-workflow`(type=code, depth=targeted),提炼「已有实现 / 可复用 pattern / 影响面」
- **1b 外部方案**:委派 `research-workflow`(type=mixed, depth=targeted),提炼「开源库/框架成熟度 / 最佳实践 / 经验教训」
- **1c 对齐已有决策**:读 `.agents-personal/wiki/` + `docs/` 下 ADR;新方案与旧决策冲突要在 Packet 里说明为什么推翻;domain 词汇对齐

**综合**:三路回来输出探索总结(每条带 `[Read path:line]` / `[SOURCE: url]`),作为提方案的事实基础。落 Decision Packet 的 `sources[]`。

### Step 2: UI 需求理解(涉及前端时)

> UI 需求必须在提方案之前明确——UI 交互方式直接影响技术选型。纯后端 skip。

只搞清"UI 长什么样"(交互流 / IA / 视觉方向),不做 UI 技术方案(那在领域覆盖的前端项 + writing 详细设计里做)。有 `.ix.md`/`.vd.md` → 读它;无但有 UI → agent 自主(页面多→调 `pd-ix`;简单→选 taste model)。

### Step 3-5: 多轮方案选定(先扩散再收敛)

循环:每轮聚焦一个决策层级(L1 架构 / L2 组件 / L3 细节),选定后检查有无下一层子决策,有就再开一轮。每轮选定前必过 Step 4a 用户确认,不静默。

- **Step 3 提 2-3 方案**:首轮核心架构差异化(数据流不同,不是参数变体);后续轮上一轮架构内组件/细节。每个方案:一句话 + 优势 + 代价 + 适用条件 + `[Read]`/`[SOURCE]` 来源。YAGNI + Seam 判据。**逐维度权衡表**(成本/复杂度/可维护/可测/对 restate 约束满足度)。
- **Step 4 spike 验证(可选)**:不确定能否跑通 → 写最小可运行脚本(logic branch)或 UI 变体(UI branch),throwaway,答案才是产物。方案成熟 skip。
- **Step 4a 方案确认(每轮,例行)**:当轮方案 + 权衡表(+ spike 结论,如做)成型后、选定前,交用户拍方向。两回合模式,方案对比禁塞 结构化决策:
  - **展示回合**:方案卡片 + 逐维度权衡表 + agent 推荐及理由作为**回合末尾文本**完整输出;末尾只问**一个最承重的问题**——当轮决策选哪个。结束回合,不接任何工具调用(方案对比塞 `question` 挤成密集段落,塞 `preview` 被终端折叠)。
  - **确认回合**:用户回应即决策(采纳推荐 / 改选备选 / 注入权重偏好)→ 直接按其执行;要求补方向 → 回 Step 3 补提再走展示回合;回应含糊才 结构化决策 澄清。
  - research 模式不走 4a(预研直接交付终止,用户在交付后拍板)。
- **Step 5 方案选定 + 落账 + 层级下钻**:按 4a 用户拍板结果选定(每轮 L1/L2/L3 均需用户确认,不静默)。每项选定即追加**决策账本**,条目格式:

  `决策点 | 结论 | 依据/置信度 | 否决备选及原因 | P0 还是延后`

  **首条落账时落盘**(路径 `{dev_design_output}`,变量解析含项目本地覆盖):文档已存在(Full 场景 Define 已落首章罗盘)→ 在罗盘章节后追加账本,罗盘不动;文档不存在(宽进无 Define)→ 自建文档,把 Enter Gate 提取的轻量 restate 写成首章「罗盘」再落账本。账本增量写入该文件——这就是 Packet 的落盘载体,不另造独立文件。账本是收敛进度的度量,也是 8a 终审的骨架。层级下钻检查(展开一层列子决策,跟 PRD 功能领域交叉)→ 有子决策回 Step 3,全无进 Step 6。

### Step 6: 对齐 + 失败预演 + 领域覆盖检查

- **6a 回检罗盘**(文档首章 restate):无冲突继续;有冲突建议回 Define 修正罗盘(最多 2 轮)——decision 无权自己改罗盘
- **6b 失败预演(pre-mortem)**:"假设这方案上线 3 个月后彻底失败,top 3 失败原因是什么?" 反向检验,失败原因无应对就补措施或标风险
- **6c 领域覆盖检查**:8 领域(架构/测试/安全/API/性能/前端/**可观测**/迁移)逐项过,涉及的强制逐项落决策账本(条目格式见 Step 5)。
  - **可观测性分两层**:**基础日志**(关键路径 / 异常分支 / 模块出入口打 log)是**每个功能默认必过项**,不设条件——历史教训是基础日志落在"要不要上监控"门槛之下成三不管地带;**生产监控**(Metrics/告警/Trace)按需触发。基础日志决策落 Decision Packet 的 `domainDecisions.observability.basicLogging`
  - 账本中的领域决策是 Decision Packet `domainDecisions{}` 的直接来源（按领域 keyed）
  - **数据库场景速查**(方案涉及时 Read)：PostgreSQL（有 `.sql`/migrations 或连 PG/Supabase）→ `references/postgres-patterns.md`；ClickHouse（做分析）→ `references/clickhouse-patterns.md`

### Step 7: 测试目标 TO(Test Objective)

从 restate 路径清单 + SC 绑定 + 选定方案 + UI 推导:每条路径 → ≥1 TO,每条约束 → ≥1 TO,UI 路径 → Browser TO。标测试层级(单测/集成/E2E)。5 维自审(路径覆盖/约束覆盖/层级合理/不测项风险/跨域不重复)+ 路径覆盖状态表。落 Decision Packet `testObjectives[]` + `verifyStrategy`。

### Step 8: 落笔前核对 + 产出 Decision Packet

> 这是 decision 侧的 gate:**Decision Packet 完整性核对**(与 writing 的「文档落笔前核对」是两个不同 gate)。

- **决策清点**:通读决策账本,逐项确认状态(✅ 已定 / ⚠️ 反复过需确认 / ❌ 未讨论回 6c / ⏸ 延后已入 openQuestions)。除 ⏸ 外全 ✅ 才能产出
- **功能覆盖核对**:restate 路径/SC/约束逐条对照,确认每个功能点有落点
- **产出 Decision Packet**(schema — 交给 writing 消费):

```
DecisionPacket {
  version            // schema 版本号(writing 校验;不支持的 version 返回错误)
  selectedApproach   // 选定方案
  alternatives[]     // 备选 + 否决理由(writing 决策章节做反方配平要用)
  constraints[]      // 约束
  isAIFeature        // bool:是否 AI 功能类(LLM生成/分类/抽取/Agent决策);gate evalSpec 条件必填
  domainDecisions{}  // 领域覆盖决策(按领域 keyed,非数组):domainDecisions.observability.basicLogging 必填(基础日志是默认必过项);其余 architecture/security/api/... 按需
  openQuestions[]    // 未决项 + 延后口子(每条标 待定|延后;允许空数组)
  testObjectives[]   // TO 表
  verifyStrategy     // 验证策略
  evalSpec?          // AI 功能类(isAIFeature=true)必填:eval 设计(维度/指标/用例/baseline)
  sources[]          // [Read]/[SOURCE] 来源
  docPath            // 设计文档路径(= {dev_design_output}):Define 落罗盘时创建(无则 decision 自建),writing 同一路径覆盖扩写
}
requiredFields = [version, selectedApproach, alternatives, constraints, domainDecisions, testObjectives, verifyStrategy, docPath]
```

**阶段返回 StageResult** = `completed | needs_user_input`(decision 是首阶段,只这两态;`replan_required` 是 writing 的返回态,decision 不产出——下方 replan envelope schema 在此定义,仅供 writing 单源引用)。

**条件必填规则**(writing 校验 Packet 时按此判缺失,不是只看字段名在不在):
- `domainDecisions.observability.basicLogging`:涉及运行时逻辑的功能**必填**(基础日志不设"要不要上监控"的条件)
- `evalSpec`:`isAIFeature=true` 时**必填**
- 空数组 / 空对象 / 空占位**视为缺失**(报缺,不放行)
- 不支持的 `version`:writing **返回错误**,不静默降级

**replan envelope**(writing 详细设计中遇方案级决策变更时返回,协调器据此回 decision 重选):
```
ReplanRequired {
  originalPacketRevision   // 原 Packet 版本
  invalidatedDecision      // 失效的方案级决策
  evidence                 // 失效证据(为什么这条路走不通)
  affectedSections[]       // 受影响的设计文档章节
  resumeState              // 协调器回到哪个 decision 阶段重选
}
```

**needs_user_input envelope**(遇用户介入例外时返回,协调器据此统一弹确认):
```
NeedsUserInput {
  question                 // 问什么
  options[]                // 备选(推荐放第一)
  resumeState              // 用户答复后从哪继续
  dedupeKey                // 重复确认去重键(防同一决策反复弹)
}
```

### Step 8a: 用户终审 Decision Packet

决策账本已从 Step 5 起增量累积在设计文档初稿(`docPath`)中;本步将其补全为完整 Packet 结构**覆盖写回初稿**(首章罗盘保留不动),并作为**回合末尾文本**展示交用户终审(用户的修改同步更新初稿)。格式要求：

- 每个 requiredField 独立章节（selectedApproach / alternatives / constraints / domainDecisions / testObjectives / verifyStrategy）
- 决策条目沿用账本格式（决策点 / 结论 / 依据置信度 / 否决备选及原因 / P0 还是延后）,标注当前状态（`[已定]` / `[假定]` / `[延后]`）
- domainDecisions 按领域分小节
- openQuestions 单独章节,区分「待定 / 延后」（空则标"无"）

展示回合末尾问「内容可以吗，有要改的吗？」,**结束回合**。用户回应即决策：

- **方案级变更**（selectedApproach 改变 / 架构方向推翻）→ 回 Step 3 重选,用户修改作为新约束带入（方向已在 4a 确认过,此处仍被推翻说明 4a 展示的信息不充分——重走 4a 时补上缺口）
- **领域/细节调整**（domainDecisions / testObjectives / constraints / verifyStrategy 等）→ 直接更新 Packet,不回选
- **无实质修改** → 进 Step 9

本步是**例行确认**,由 decision 阶段自行执行（不返回 `needs_user_input`——这不是异常确认,是流程内置步骤）。

### Step 9: 硬交接

- **方案选择模式** → 返回 Decision Packet(含 `docPath`)给协调器(`dev-design`),由其进入 writing 阶段——writing 在 `docPath` 初稿上覆盖扩写详细设计
- **独立预研 research 模式** → **直接交付 research Decision Packet 终止**:预研结论按 `references/example-research-skeleton.md` 骨架落盘 `docPath`(初稿即最终交付物),向用户报告结论 + 建议下一步(进 design / plan / 放弃),不自动进 writing

## Exit Gate

- [ ] 方案已选定(每轮 L1/L2/L3 均经 Step 4a 用户确认后选定;理由入决策账本)
- [ ] 失败预演 top 3 失败原因已列 + 应对
- [ ] 8 领域逐项 ✅/跳过,可观测基础日志层已决策
- [ ] TO 覆盖每条路径和约束,5 维自审通过
- [ ] 账本清点除 ⏸ 延后外全 ✅(延后项已入 openQuestions),功能覆盖全 ✅
- [ ] Decision Packet 产出,requiredFields 齐,已落盘为设计文档初稿(`docPath` = `{dev_design_output}`)
- [ ] Step 8a 用户终审通过（Packet 已展示 → 用户确认/修改 → 变更已应用;方案级变更已回 Step 3 重选）
- [ ] **硬交接**:方案选择→交 Packet 给协调器进 writing;research→直接交付终止
