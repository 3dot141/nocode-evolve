---
name: dev-design-decision
description: Private decision protocol used by dev-design to compare approaches and produce a Decision Packet; never invoke independently.
disable-model-invocation: true
---

# decision — 方案决策与预研协议

> 本协议只能由 dev-design 协调器 Read 后执行。它不独立注册，不持有全局流程，也不直接与用户交互。

**Iron Law：未比较真实替代方案的选择不是设计；未经协调器 checkpoint 的用户确认不是合法状态迁移。**

Decision 只负责：

- 比较方案并选定战略 approach
- 明确业务能力、限界上下文、关键数据所有权、拓扑和硬约束
- 形成测试目标与 Writing 的 Registry 输入
- 产出带版本的 Decision Packet

详细模块拆分、内部 API、内部 schema 与算法归 Writing；正式全文评审也归 Writing。

跨阶段 ID 与四态契约 Read `{NOCODE_SKILL_REF}/design-traceability.md`。

## 模式与设计深度

`mode: solution | research`

- `solution`：为 feat / bug / refactor 选方案，Packet 交 Writing。
- `research`：形成研究结论和证据后由协调器直接交付，Writing 与 render 跳过。

`designDepth: focused | full`

- `focused`：风险较低、影响范围有限。至少完成 1 轮真实的互斥方案比较。
- `full`：跨多个边界、存在敏感面、不可逆决策或外部兼容承诺。至少完成 3 轮“比较 → 验证 → 传播”。

退出不只看轮数，还必须满足：高影响缺口已关闭、端到端路径闭合、剩余风险已显式记录。不得为了凑轮次制造伪方案。

外部研究是条件步骤：涉及当前版本、外部技术选型、不熟悉 API、标准或生态成熟度时执行；纯仓内且证据充分时可跳过，并记录理由。不得把“必须联网”当成每个设计的固定税。

## 用户交互协议

阶段不得调用用户提问工具，也不得在回合末尾直接提问。计划内确认和异常输入都返回给协调器：

```yaml
status: checkpoint_required | needs_user_input
checkpoint:
  checkpointType: packet-review | local-decision
  question: string
  options: []
  preview: object
  resumeState: object
  dedupeKey: string
```

- `packet-review`：唯一例行终审点。
- `local-decision`：只用于打平手、与既有决策冲突、agent 无法取得的信息、不可逆高影响选择。
- 协调器将答案与 `resumeState` 送回后，Decision 才继续。

## StagePlan

进入阶段先建立内部 `StagePlan`，它只是返回给协调器的阶段进度，不写平台全局计划：

```text
StagePlan {
  steps[],
  currentStep,
  checkpoints[],
  evidenceCollected[],
  completedSteps[]
}
```

建议步骤：

1. 校验输入与 restate ownership
2. 探索仓内证据、既有决策及条件性外部证据
3. 建立设计图与候选 approach
4. 按 `designDepth` 比较、验证、传播
5. 失败预演、领域覆盖与横切走查
6. 形成 TO、Registry 输入和 Packet
7. 返回 `packet-review` checkpoint
8. 根据协调器答复完成或修订

## 执行协议

### Step 1：校验输入

输入至少包含 request 与 restate。restate 必须有：

```yaml
goal: string
scope: []
constraints: []
nonGoals: []
successSignals: []
restateOwner: define | design-lite
```

- `define` 所有的罗盘若需改变目标、范围或硬约束，返回协调器要求回 Define。
- `design-lite` 可提出修订，但必须返回 checkpoint，由协调器确认。

判断 `mode`、`designDepth` 和场景，并在 Packet 中记录选择理由。

### Step 2：探索证据

按需要覆盖三类证据：

1. **仓内实现**：已有 pattern、可复用能力、约束、影响面。
2. **既有决策**：ADR、项目文档、已批准设计；冲突必须显式列出。
3. **外部证据**：仅在触发条件成立时检索版本、标准、框架或已知风险；记录直接来源和获取日期。

所有关键判断标注 `evidenceRefs`。没有证据的判断标记为 assumption，不伪装为事实。

### Step 3：建立设计图

设计图至少表达：

- 使用者 / 上游 → 入口 → 业务能力 → 数据所有者 → 外部依赖 → 可观测与恢复
- 限界上下文与依赖方向
- 最承重的决策缺口
- 横切关注点穿过的 provider 与 consumer

领域边界优先按**业务能力、统一语言和一致性边界**判断。仓、服务或部署单元只是候选信号，不能直接等同限界上下文。

### Step 4：比较与收敛

每轮对一个真实决策前沿提出 2–3 个互斥切片，记录：

```yaml
decisionId: string
candidates:
  - approach: string
    recommendation: prefer | viable | reject
    reasons: []
    evidenceRefs: []
    risks: []
    changeConditions: []
provisionalChoice: string
affectedNodes: []
```

选择先记为 `provisional`，将影响传播回整张设计图。证据推翻时把旧选择记为 `superseded`，保留原因与指向，不删除历史。

`focused` 至少 1 轮，`full` 至少 3 轮。满足轮数但仍有高影响断点时继续；已闭环时不得为凑数继续。

### Step 5：失败预演、领域覆盖与横切走查

检查：

- happy path、失败路径、恢复与降级
- 数据所有权与一致性边界
- 外部兼容契约与迁移约束
- 基础日志、指标、告警与敏感数据
- AI 功能的 eval 目标

`domainDecisions` 是决策正文的权威来源；`crossCutting` 只描述这些决策如何落在多层、多消费者路径中。横切条目必须用 `decisionRefs` 引用权威决策，不复制或改写结论，并做双向映射检查。

### Step 6：测试目标

每条关键使用路径至少有一个稳定 TO：

```yaml
- id: TO-1
  target: string
  observableOutcome: string
  evidenceMethod: string
  sourceDecisionRefs: []
```

TO 描述“什么结果证明设计成立”，不展开 Plan 的逐步 TDD 操作。

### Step 7：落盘初稿

唯一规范性文件为 `docPath`：

- 若已有 Define 罗盘，原样保留首章并追加决策账本。
- 若是 `design-lite`，创建同一文档并以经 checkpoint 确认的罗盘开篇。
- 不创建 `decision-packet.md`、`restate.md` 或研究附件作为第二事实源。

稳定决策与路径增加来源锚点，供 Writing 汇总 Registry。

### Step 8：Packet 终审

形成 Packet 后不直接问用户，返回：

```yaml
status: checkpoint_required
checkpoint:
  checkpointType: packet-review
  question: 请审核完整 Decision Packet，确认、修改或退回指定决策。
  options: [确认, 修改, 退回]
  preview: <完整 Packet 摘要、架构图、决策链、TO 与风险>
  resumeState:
    stage: decision
    packetRevision: 1
  dedupeKey: decision-packet-review-r1
```

协调器返回答案后：

- 确认：将相关状态转为 `confirmed`，返回 `completed`。
- 修改：更新 Packet；内容修订令 `packetRevision + 1`，重新返回新的 dedupeKey。
- 退回：按指定决策恢复，不从零开始。

## Decision Packet schema

横切字段的结构记法是 `crossCutting { items[]; exemption? }`；实际 Packet 使用下面的 YAML object：

```yaml
schemaVersion: 1
packetRevision: 1
mode: solution | research
designDepth: focused | full
scenario: feat | bug | refactor | research
docPath: string
restate:
  goal: string
  scope: []
  constraints: []
  nonGoals: []
  successSignals: []
restateOwner: define | design-lite
selectedApproach: object
alternatives: []
constraints: []
domainDecisions: []
crossCutting:
  items:
    - id: string
      concern: string
      decisionRefs: []
      providerOrOwner: string
      layerResponsibilities: []
      enforcementPoints: []
      dataOwners: []
      registryInputs: []
  exemption:
    reason: string
    evidence: []
openQuestions: []
testObjectives: []
verifyStrategy: object
evalSpec: object | null
sources: []
registryInputs: []
decisionHistory: []
```

### 校验规则

- `schemaVersion` 表示契约结构，只在 schema 不兼容时改变；当前只支持 `1`。
- `packetRevision` 表示该 Packet 实例的内容修订，从 `1` 开始。replan 或终审修改使它递增，不能改变 `schemaVersion`。
- `mode: solution` 必须有可执行的 selected approach；`mode: research` 可保留排名后的候选与建议下一步，但必须明确研究结论。
- `crossCutting.items` 非空时 `exemption` 必须缺席；无适用横切关注点时 `items` 为空且 `exemption` 必填，写明理由与证据。二者不能同时空，也不能同时成立。
- 每个横切条目的 `decisionRefs` 必须指向 `domainDecisions`，每个被声明为横切的 domain decision 也必须被至少一个 item 反向引用。
- `isAIFeature=true` 时 `evalSpec` 必填；复杂 eval 至少 3 个真实案例，普通功能不硬凑。
- 涉及运行时逻辑时必须有基础日志决策。
- 空数组占位不能代替条件必填内容。

`requiredFields` 为：`schemaVersion / packetRevision / mode / designDepth / scenario / docPath / restate / restateOwner / selectedApproach / alternatives / constraints / domainDecisions / crossCutting / openQuestions / testObjectives / verifyStrategy / sources / registryInputs / decisionHistory`；`evalSpec` 按条件必填。

## replan envelope

Writing 只有在选定 approach、核心业务能力或数据所有权、已承诺外部兼容契约、硬约束失效时才能请求 replan：

```yaml
status: replan_required
originalPacketRevision: 1
invalidatedDecision: string
evidence: []
affectedSections: []
resumeState:
  decisionId: string
  graphFrontier: []
```

Decision 收到后从 `resumeState` 恢复，保留 `superseded` 历史，输出相同 `schemaVersion` 且 `packetRevision = originalPacketRevision + 1` 的新 Packet。

## 返回结果

成功：

```yaml
status: completed
packet: <Decision Packet>
stagePlan: <StagePlan>
```

失败必须返回结构化原因，不得把不完整 Packet 伪装成 completed。

## Exit Gate

- [ ] 实际比较深度满足 `designDepth`，且无高影响断点
- [ ] 方案、战略边界、数据所有权与硬约束闭环
- [ ] domain decision 与 cross-cutting placement 双向一致
- [ ] TO、风险、sources 与 Registry 输入齐全
- [ ] Packet schema 与 revision 合法
- [ ] Packet 已通过协调器持有的 `packet-review`
- [ ] research 模式明确返回协调器直接终止，不流入 Writing

## References

- `references/example-design-session.md` — solution 模式示例
- `references/example-research-skeleton.md` — research 模式骨架
