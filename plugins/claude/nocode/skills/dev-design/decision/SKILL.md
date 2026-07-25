---
name: dev-design-decision
description: Private decision protocol used by dev-design to compare approaches and produce a Decision Packet; never invoke independently.
disable-model-invocation: true
---

本文写“结构化决策”时，必须带齐当前步骤的完整问题与 2–3 个互斥选项：

使用 `AskUserQuestion` 提交完整问题和全部选项。


# decision — 选方案 + 预研，产出决策包

> dev-design 内部协议，不独立注册。由 dev-design 协调器在 decision 阶段 Read 并执行。

跨阶段设计项 ID 与四态契约 Read `{NOCODE_SKILL_REF}/design-traceability.md`。Decision 阶段不生成最终 Registry，但必须把所有已确认且影响实现的决策、领域覆盖结论和测试目标标记为 writing 的 Registry 输入；已有 Q / BF / TO ID 后续必须复用。

**Iron Law: 方案未对比的设计是假设不是设计。只提一个方案就让用户确认 = 假共识。**

decision 回答"走哪条路"——**先扩散,再沿设计图至少三轮下钻收敛**:先建立多路径 + 架构节点/关系的设计图,每轮选择最承重的一组缺口,拆成 2-3 个架构切片对比,给出推荐度 / 推荐原因 / 证据 / 改选条件,由 agent 暂定后把影响传播回整张图。直到端到端设计闭环,再把完整结果交用户一次终审,产出结构化 **决策包 Decision Packet** 交给 writing 阶段忠实扩写。本阶段只做方案级决策与端到端架构收敛,不写正式详细设计、不评审;Packet 落盘为设计文档初稿(见下)。

> Leading word: **approach**。没对比过的 approach 就没有设计,只有假设。
> **决策包 Decision Packet** = decision 产出、writing 消费的结构化交接契约(带 required 字段 + 版本),schema 见「收尾」节。
> **落盘载体 = `{dev_design_output}` 设计文档本身**:Full 场景该文档已由 Define 创建(首章「罗盘」= 已确认 restate),decision 在罗盘后追加账本;文档不存在(宽进无 Define)才由 decision 首条落账时自建(Step 5)。writing 在**同一路径覆盖扩写**为完整详细设计——不另造 `decision-packet.md` / `xxx-restate.md` 之类的独立文件。

## 两种模式

- **方案选择**(feat / bug / refactor 前置):为一个待实现的需求选架构方向,产出 Decision Packet → writing 阶段。
- **独立预研 research**(技术选型 / 调研):产出 research Decision Packet 后**直接交付终止**——由用户决定下一步(进 design / plan / 放弃),**不自动进 writing**。

## 用户介入原则

沟通结构 = **agent 自主下钻 + 全程账本可见 + 1 个终审点(8a)**:方案选择模式至少完成 3 轮"拆分 → 对比 → 推荐 → 暂定 → 传播",不按固定 L1/L2/L3 逐层要求用户拍板。每轮选择是 `provisional`,后续证据可推翻;只有端到端设计闭环后才在 Step 8a 展示完整 Packet 让用户一次确认。

**例行确认只保留一个**:
- **Step 8a Packet 终审**:完整 Packet 展示给用户逐条审核。审的是经过至少三轮下钻后形成的端到端路径、架构图、决策链、领域决策和 TO。

**决策账本**(非阻塞可见,载体 = 设计文档初稿,见 Step 5):每轮把候选 / 推荐度 / 推荐原因 / 证据 / 暂定选择 / 改选条件 / 影响路径与组件增量追加到账本;状态使用 `candidate | provisional | validated | confirmed | rejected | superseded | deferred`。每轮结束给 1-2 行状态注记(第 N 轮暂定什么 / 更新哪些路径 / 下一轮钻什么),不要求确认、不阻塞。8a 终审因此审的是一份可追溯的收敛过程,不是只剩最终答案的陌生成品。

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
Task 3: 建立设计图 + 选择下钻前沿(多路径 / 架构节点与关系 / 当前最承重缺口簇)
Task 4: 对比架构切片 + 验证(每轮 2-3 个互斥切片 + 推荐度/原因/证据/改选条件 + 可选 spike)
Task 5: 暂定选择 + 传播 + 继续下钻(agent 自主,至少 3 轮;更新整张设计图,满足闭环条件才退出)
Task 6: 对齐 + 失败预演 + 领域覆盖检查(含可观测性)
Task 7: 测试目标 TO
Task 8: 落笔前核对 + 产出 Decision Packet(决策清点 + 功能覆盖 → Packet 完整性)
Task 8a: 用户终审 Decision Packet(展示完整 Packet → 用户确认/修改)
Task 9: 硬交接 — 交付 Decision Packet(方案选择模式→writing;research 模式→直接交付终止)
  metadata: {handoff: true}
```

调用时把上面**每一条** Task 建成稳定计划项，不得传空计划：

使用 `TaskCreate` 逐项创建全部计划项并保存 task id；状态变化时使用 `TaskUpdate` 更新对应项。


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

### Step 3: 建立设计图 + 选择下钻前沿

方案选择模式先把 restate 展开为**设计图**，而不是先锁一个抽象架构：

- **路径面**：列出所有用户 / 系统 / 运维路径，至少包含主路径与适用的失败、取消、恢复、重试、审计路径；已有路径 ID 原样复用。
- **架构面**：画出系统拓扑、领域/模块边界、数据所有权、关键接口/事件、运行时/部署节点；未知处用 `?` 标成缺口，不拿猜测填满。
- **关系面**：路径经过哪些组件、跨边界箭头依赖什么契约、哪个决策会影响哪些路径/组件。

每轮从整张设计图选择**最可能推翻整体设计的一组耦合缺口**作为下钻前沿，例如"领域边界 + 数据所有权"、"数据流 + 一致性 + 审计"、"状态机 + 取消 + 恢复 + 重试"。禁止按预设 L1/L2/L3 机械分层，也禁止只沿一条调用链越钻越细。

research 模式用"问题 / 证据 / 风险 / 结论"图代替端到端设计图，后续仍执行至少三轮收敛，但不强套业务路径或运行时架构。

### Step 4: 对比架构切片 + 验证

针对本轮前沿提出 2-3 个**互斥的完整架构切片**，每个切片必须说明它如何同时改变相关路径、组件和契约，不得只是参数变体。逐项输出：

`选项 | 推荐度(1-5) | 推荐原因 | 主要代价/风险 | 证据 | 改选条件 | 影响路径/组件`

推荐度使用有证据含义的五档，禁止伪精确百分比：

| 推荐度 | 含义 |
|---|---|
| 5 强烈推荐 | 满足硬约束,证据充分,无关键阻断 |
| 4 推荐 | 整体最优,代价与风险可控 |
| 3 条件推荐 | 取决于尚未确认的条件 |
| 2 不推荐 | 有明显结构性代价 |
| 1 淘汰 | 违反硬约束或验证失败 |

**推荐原因必须闭环**：对应哪些目标/约束 → 由什么 `[Read]`/`[SOURCE]`/spike 证据支持 → 相比其它选项为何更合适 → 要承担什么代价 → 哪条新证据会降级推荐或触发改选。用成本/复杂度/可维护/可测/约束满足度 + 本轮实际的路径覆盖/架构影响做权衡；YAGNI + Seam 判据仍适用。

**spike 验证(可选)**：不确定切片能否跑通 → 写最小可运行脚本(logic branch)或 UI 变体(UI branch),throwaway,答案才是产物。方案成熟 skip。

### Step 5: 暂定选择 + 传播 + 继续下钻

agent 依据推荐度和证据作出本轮**暂定选择**，不弹例行确认；命中打平手 / 既有决策冲突 / 外部信息缺口 / 不可逆高影响时才返回 `needs_user_input`。每轮完成四件事：

1. **落账**：把本轮候选、推荐度/原因、证据、暂定选择、代价、改选条件和影响面写入决策账本；未完成终审前状态最高只能到 `validated`，不能提前写 `confirmed`。
2. **传播**：把选择同步更新到所有受影响的路径、架构节点/边、数据所有权、契约、状态/失败路径和运行时关系；不能只更新当前局部。
3. **反证回退**：后续证据推翻前轮时，把旧项标 `superseded` 并指向新项 + evidence，回到受影响前沿重选；这是 decision 内部正常收敛，不算 writing 的 `replan_required`。
4. **继续下钻**：从更新后的整张图重新选最承重缺口，回 Step 3 开下一轮。

**首轮落账时落盘**(路径 `{dev_design_output}`,变量解析含项目本地覆盖):文档已存在(Full 场景 Define 已落首章罗盘)→ 在罗盘章节后追加设计图 + 决策账本,罗盘不动;文档不存在(宽进无 Define)→ 自建文档,把 Enter Gate 提取的轻量 restate 写成首章「罗盘」再落设计图/账本。它就是 Packet 的落盘载体,不另造独立文件。

**退出下钻必须同时满足**：

- 至少完成 3 轮拆分/对比/暂定/传播，不能用"方案简单"跳过；
- restate 的每条适用路径都映射到明确架构组件，主路径 + 失败/取消/恢复/重试/审计等相关分支闭环；
- 每个跨组件箭头有接口 / 事件 / 数据契约，每类核心数据有唯一所有者；
- 系统拓扑、领域/模块边界、关键数据流与一致性、运行时/部署和故障边界已有结论；
- 不再存在可能推翻整体设计的高影响缺口；剩余项明确进入 `deferred/openQuestions`。

任一不满足 → 继续 Round 4/5/...；满足后才进 Step 6。

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
  selectedApproach   // 选定方案摘要 + 至少三轮 decisionRounds[] + 端到端 designGraph(路径/架构/契约/数据所有权/失败与运行时关系)
  alternatives[]     // 备选 + 推荐度/推荐原因/证据/代价/改选条件/否决理由(writing 决策章节做反方配平要用)
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
- `selectedApproach.decisionRounds[]`:至少 3 轮,每轮含前沿 / 2-3 个选项 / 推荐度与原因 / 证据 / 暂定选择 / 改选条件 / 影响路径与组件
- `selectedApproach.designGraph`:方案选择模式必填,含路径图 + 架构图 + 关键契约/数据所有权/失败与运行时关系;research 模式不强制
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

- **方案级变更**（selectedApproach 改变 / 架构方向推翻）→ 回 Step 3 重选,用户修改作为新约束带入,至少补跑受影响的对比/传播轮次后再终审
- **领域/细节调整**（domainDecisions / testObjectives / constraints / verifyStrategy 等）→ 直接更新 Packet,不回选
- **无实质修改** → 进 Step 9

本步是**例行确认**,由 decision 阶段自行执行（不返回 `needs_user_input`——这不是异常确认,是流程内置步骤）。

### Step 9: 硬交接

- **方案选择模式** → 返回 Decision Packet(含 `docPath`)给协调器(`dev-design`),由其进入 writing 阶段——writing 在 `docPath` 初稿上覆盖扩写详细设计
- **独立预研 research 模式** → **直接交付 research Decision Packet 终止**:预研结论按 `references/example-research-skeleton.md` 骨架落盘 `docPath`(初稿即最终交付物),向用户报告结论 + 建议下一步(进 design / plan / 放弃),不自动进 writing

## Exit Gate

- [ ] 已建立多路径 + 架构关系的设计图,完成至少 3 轮拆分/对比/推荐/暂定/传播
- [ ] 每轮 2-3 个候选均有推荐度、推荐原因、证据、代价、改选条件和影响面
- [ ] 所有适用路径与架构边闭环,无可能推翻整体方案的高影响缺口
- [ ] 失败预演 top 3 失败原因已列 + 应对
- [ ] 8 领域逐项 ✅/跳过,可观测基础日志层已决策
- [ ] TO 覆盖每条路径和约束,5 维自审通过
- [ ] 账本清点除 ⏸ 延后外全 ✅(延后项已入 openQuestions),功能覆盖全 ✅
- [ ] Decision Packet 产出,requiredFields 齐,已落盘为设计文档初稿(`docPath` = `{dev_design_output}`)
- [ ] Step 8a 用户终审通过（Packet 已展示 → 用户确认/修改 → 变更已应用;方案级变更已回 Step 3 重选）
- [ ] **硬交接**:方案选择→交 Packet 给协调器进 writing;research→直接交付终止
