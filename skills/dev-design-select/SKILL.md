---
name: dev-design-select
description: Use when Define is complete and you need to explore and pick an approach before writing a detailed design — 选方案/技术选型/方案对比/怎么做/出方案/预研/调研/看看别人怎么做. Produces a Decision Packet consumed by dev-design-refine. Use when devflow routes to Design (select stage). Not for writing the detailed design document (use nocode:dev-design-refine), interaction/visual design (use pd-ix/pd-vd), or writing code (use dev-build).
---

# select — 选方案 + 预研，产出决策包

**Iron Law: 方案未对比的设计是假设不是设计。只提一个方案就让用户确认 = 假共识。**

select 回答"走哪条路"——探索 approach、多方案差异化对比后选一个，产出结构化 **决策包 Decision Packet** 交给 `dev-design-refine` 写详细设计。本 skill 只做决策,不写文档、不评审。

> Leading word: **approach**。没对比过的 approach 就没有设计,只有假设。
> **决策包 Decision Packet** = select 产出、refine 消费的结构化交接契约(带 required 字段 + 版本),schema 见「收尾」节。

## 两种模式

- **方案选择**(feat / bug / refactor 前置):为一个待实现的需求选架构方向,产出 Decision Packet → `dev-design-refine`。
- **独立预研 research**(技术选型 / 调研):产出 research Decision Packet 后**直接交付终止**——由用户决定下一步(进 design / plan / 放弃),**不自动进 refine**。

## 用户介入原则

select 全程默认 agent 自主决策——探索、方案对比、方案选定、测试计划都不因"要不要问用户"而停顿,决策连同理由 + 备选记入决策表,留到 Decision Packet 一并交付。

**例行确认**:Step 8a——Packet 产出后写入文件,用户逐条审核编辑,改完 agent 读回应用。每次必过,不是例外触发。

**异常停下来问,仅限**:① 打平手(权衡相当,取决于用户主观优先级)② 冲突需拍板(与已有 ADR/wiki 决策冲突)③ 信息缺口(需 agent 拿不到的外部信息)④ 不可逆 + 高影响。

**协调模式区分**:被 `dev-design`(协调器)调用时,遇上述例外返回 `needs_user_input`(由协调器统一弹确认,不自行弹);独立运行时用本地 AskUserQuestion。

## 非本 skill 请求

写详细设计文档 → `dev-design-refine`。写代码 → `dev-build`。Define 未完成(无 restate)→ 回 Define。交互/视觉设计 → `pd-ix` / `pd-vd`。

## Enter Gate

- [ ] Define restate 存在且用户已确认(方案选择模式),或有明确预研主题(research 模式)
- [ ] 场景分类 = Full(方案选择),或独立预研请求

> 端到端示例（restate → 方案对比 → 选定 → Decision Packet）见 `references/example-design-session.md`；预研模式骨架见 `references/example-research-skeleton.md`。

## 协议

### Step 0: TaskCreate

**进入后第一件事**,创建以下全部 task:

```
Task 1: 探索 — 三层并行(代码 pattern / 外部方案 / 已有决策)
Task 2: UI 需求理解(涉及前端时)
Task 3-5: 多轮方案选定(从大到小:L1 架构 → L2 组件 → L3 细节)
Task 6: 对齐 + Pre-mortem + 领域覆盖检查(含可观测性)
Task 7: 测试目标 TO
Task 8: 落笔前核对 + 产出 Decision Packet(决策清点 + 功能覆盖 → Packet 完整性)
Task 8a: 用户审核 Decision Packet(写文件 → 用户编辑 → 读回比对应用)
Task 9: 硬交接 — 交付 Decision Packet(方案选择模式→refine;research 模式→直接交付终止)
  metadata: {handoff: true}
```

每完成一个标 done。

### Step 1: 探索(三层并行)

探索分三层——代码内部、外部方案、已有决策,全部在提方案之前完成。不凭记忆,每个判断标注来源。**在一条消息里同时发出三个调用**,结果全回来再综合。

- **1a 代码 pattern**:先收 Define 探索胶囊(restate 附录),比对 scanBase 定复用/重扫;委派 `research-workflow`(type=code, depth=targeted),提炼「已有实现 / 可复用 pattern / 影响面」
- **1b 外部方案**:委派 `research-workflow`(type=mixed, depth=targeted),提炼「开源库/框架成熟度 / 最佳实践 / 经验教训」
- **1c 对齐已有决策**:读 `.agents-personal/wiki/` + `docs/` 下 ADR;新方案与旧决策冲突要在 Packet 里说明为什么推翻;domain 词汇对齐

**综合**:三路回来输出探索总结(每条带 `[Read path:line]` / `[SOURCE: url]`),作为提方案的事实基础。落 Decision Packet 的 `sources[]`。

### Step 2: UI 需求理解(涉及前端时)

> UI 需求必须在提方案之前明确——UI 交互方式直接影响技术选型。纯后端 skip。

只搞清"UI 长什么样"(交互流 / IA / 视觉方向),不做 UI 技术方案(那在领域覆盖的前端项 + refine 详细设计里做)。有 `.ix.md`/`.vd.md` → 读它;无但有 UI → agent 自主(页面多→调 `pd-ix`;简单→选 taste model)。

### Step 3-5: 多轮方案选定(从大到小)

循环:每轮聚焦一个决策层级(L1 架构 / L2 组件 / L3 细节),选定后检查有无下一层子决策,有就再开一轮。

- **Step 3 提 2-3 方案**:首轮核心架构差异化(数据流不同,不是参数变体);后续轮上一轮架构内组件/细节。每个方案:一句话 + 优势 + 代价 + 适用条件 + `[Read]`/`[SOURCE]` 来源。YAGNI + Seam 判据。**逐维度权衡表**(成本/复杂度/可维护/可测/对 restate 约束满足度)。
- **Step 4 spike 验证(可选)**:不确定能否跑通 → 写最小可运行脚本(logic branch)或 UI 变体(UI branch),throwaway,答案才是产物。方案成熟 skip。
- **Step 5 方案选定 + 层级下钻**:agent 按权衡表 + restate 约束自主选定,记录理由 + 备选到决策表(例外触发才问);层级下钻检查(展开一层列子决策,跟 PRD 功能领域交叉)→ 有子决策回 Step 3,全无进 Step 6。

### Step 6: 对齐 + Pre-mortem + 领域覆盖检查

- **6a 回检 restate**:无冲突继续;有冲突建议回 Define 修正(最多 2 轮)
- **6b Pre-mortem(事前验尸)**:"假设这方案上线 3 个月后彻底失败,top 3 死因是什么?" 反向检验,死因无应对就补措施或标风险
- **6c 领域覆盖检查**:8 领域(架构/测试/安全/API/性能/前端/**可观测**/迁移)逐项过,涉及的强制展开为决策表(决策点/选了什么/为什么/备选)。
  - **可观测性分两层**:**基础日志**(关键路径 / 异常分支 / 模块出入口打 log)是**每个功能默认必过项**,不设条件——历史教训是基础日志落在"要不要上监控"门槛之下成三不管地带;**生产监控**(Metrics/告警/Trace)按需触发。基础日志决策落 Decision Packet 的 `domainDecisions.observability.basicLogging`
  - 决策表是 Decision Packet `domainDecisions{}` 的直接来源（按领域 keyed）
  - **数据库场景速查**(方案涉及时 Read)：PostgreSQL（有 `.sql`/migrations 或连 PG/Supabase）→ `references/postgres-patterns.md`；ClickHouse（做分析）→ `references/clickhouse-patterns.md`

### Step 7: 测试目标 TO(Test Objective)

从 restate 路径清单 + SC 绑定 + 选定方案 + UI 推导:每条路径 → ≥1 TO,每条约束 → ≥1 TO,UI 路径 → Browser TO。标测试层级(单测/集成/E2E)。5 维自审(路径覆盖/约束覆盖/层级合理/不测项风险/跨域不重复)+ 路径覆盖状态表。落 Decision Packet `testObjectives[]` + `verifyStrategy`。

### Step 8: 落笔前核对 + 产出 Decision Packet

> 这是 select 侧的 gate:**Decision Packet 完整性核对**(与 refine 的「文档落笔前核对」是两个不同 gate)。

- **决策清点**:从 6c 决策表提取所有决策点,逐个确认状态(✅ 已定 / ⚠️ 反复过需确认 / ❌ 未讨论回 6c)。全 ✅ 才能产出
- **功能覆盖核对**:restate 路径/SC/约束逐条对照,确认每个功能点有落点
- **产出 Decision Packet**(schema — 交给 refine 消费):

```
DecisionPacket {
  version            // schema 版本号(refine 校验;不支持的 version 返回错误)
  selectedApproach   // 选定方案
  alternatives[]     // 备选 + 否决理由(refine 决策章节做反方配平要用)
  constraints[]      // 约束
  isAIFeature        // bool:是否 AI 功能类(LLM生成/分类/抽取/Agent决策);gate evalSpec 条件必填
  domainDecisions{}  // 领域覆盖决策(按领域 keyed,非数组):domainDecisions.observability.basicLogging 必填(基础日志是默认必过项);其余 architecture/security/api/... 按需
  openQuestions[]    // 未决项(允许空数组)
  testObjectives[]   // TO 表
  verifyStrategy     // 验证策略
  evalSpec?          // AI 功能类(isAIFeature=true)必填:eval 设计(维度/指标/用例/baseline)
  sources[]          // [Read]/[SOURCE] 来源
}
requiredFields = [version, selectedApproach, alternatives, constraints, domainDecisions, testObjectives, verifyStrategy]
```

**阶段返回 StageResult** = `completed | needs_user_input`(select 是首阶段,只这两态;`replan_required` 是 refine 的返回态,select 不产出——下方 replan envelope schema 在此定义,仅供 refine 单源引用)。

**条件必填规则**(refine 校验 Packet 时按此判缺失,不是只看字段名在不在):
- `domainDecisions.observability.basicLogging`:涉及运行时逻辑的功能**必填**(基础日志不设"要不要上监控"的条件)
- `evalSpec`:`isAIFeature=true` 时**必填**
- 空数组 / 空对象 / 空占位**视为缺失**(报缺,不放行)
- 不支持的 `version`:refine **返回错误**,不静默降级

**replan envelope**(refine 详细设计中遇方案级决策变更时返回,协调器据此回 select 重选):
```
ReplanRequired {
  originalPacketRevision   // 原 Packet 版本
  invalidatedDecision      // 失效的方案级决策
  evidence                 // 失效证据(为什么这条路走不通)
  affectedSections[]       // 受影响的设计文档章节
  resumeState              // 协调器回到哪个 select 阶段重选
}
```

**needs_user_input envelope**(被协调器调用、遇用户介入例外时返回,协调器据此统一弹确认):
```
NeedsUserInput {
  question                 // 问什么
  options[]                // 备选(推荐放第一)
  resumeState              // 用户答复后从哪继续
  dedupeKey                // 重复确认去重键(防同一决策反复弹)
}
```

### Step 8a: 用户审核 Decision Packet

将 Packet 以 markdown 格式写入文件（与 `{dev_design_output}` 同目录,文件名 `{topic}-decision-packet.md`）。格式要求：

- 每个 requiredField 独立章节（selectedApproach / alternatives / constraints / domainDecisions / testObjectives / verifyStrategy）
- 决策点标注当前状态（`[已定]` / `[假定]`）
- domainDecisions 按领域分小节,每条决策带「决策点 / 选了什么 / 为什么 / 备选」
- openQuestions 单独章节（空则标"无"）

告知用户文件路径,请用户直接在编辑器中审核、修改、批注。用户确认改完后 Read 文件,与原 Packet **逐字段比对**,识别变更:

- **方案级变更**（selectedApproach 改变 / 架构方向推翻）→ 回 Step 3 重选,用户修改作为新约束带入
- **领域/细节调整**（domainDecisions / testObjectives / constraints / verifyStrategy 等）→ 直接更新 Packet,不回选
- **无实质修改** → 进 Step 9

本步是**例行确认**,无论独立运行还是被协调器调用都由 select 自行执行（不返回 `needs_user_input`——这不是异常确认,是流程内置步骤）。

### Step 9: 硬交接

- **方案选择模式** → 返回 Decision Packet 给协调器(`dev-design`),由其调 `dev-design-refine` 写详细设计
- **独立预研 research 模式** → **直接交付 research Decision Packet 终止**,向用户报告预研结论 + 建议下一步(进 design / plan / 放弃),不自动进 refine `[假定:终止而非续 refine]`

## Exit Gate

- [ ] 方案已选定(agent 自主 + 理由入决策表;例外时用户确认)
- [ ] Pre-mortem top 3 死因已列 + 应对
- [ ] 8 领域逐项 ✅/跳过,可观测基础日志层已决策
- [ ] TO 覆盖每条路径和约束,5 维自审通过
- [ ] 决策清点全 ✅,功能覆盖全 ✅
- [ ] Decision Packet 产出,requiredFields 齐
- [ ] Step 8a 用户审核通过（文件已写 → 用户已编辑 → 变更已读回应用;方案级变更已回 Step 3 重选）
- [ ] **硬交接**:方案选择→交 Packet 给协调器进 refine;research→直接交付终止
