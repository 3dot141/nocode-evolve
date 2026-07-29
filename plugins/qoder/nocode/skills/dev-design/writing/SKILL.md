---
name: dev-design-writing
description: Private writing protocol used by dev-design to turn a validated Decision Packet into one reviewed design baseline; never invoke independently.
disable-model-invocation: true
---

# writing — 详细设计、Registry 与唯一评审

> 本协议只能由 dev-design 协调器 Read 后执行。直接设计请求必须先进入 dev-design / decision；Writing 不接受无 Packet 的旁路输入。

**Iron Law：忠实展开已确认的战略决策；正文发生任何修订都必须验证新 revision，不得沿用旧 verdict。**

Writing 负责详细模块边界、内部 API / 数据契约、业务流、文件影响、Implementation Item Registry、全文评审和批准基线。它不重新选择战略 approach，也不直接向用户提问。

进入时 Read：

- `{QODER_PLUGIN_ROOT}/skills/references/design-traceability.md`
- 场景对应的 `references/template-<scenario>.md`
- 场景对应的 `references/example-<scenario>-skeleton.md`
- `references/writing-principles.md`
- `references/cross-cutting-design.md`
- 满足触发条件时的 `references/ddd-modeling.md`

## 输入门

唯一合法输入是协调器校验过的 Decision Packet：

```yaml
schemaVersion: 1
packetRevision: <positive integer>
mode: solution
docPath: string
...
```

校验：

1. 只支持 `schemaVersion: 1`；不支持时返回 structured failure，不能猜字段。
2. `packetRevision` 必须存在且为正整数。
3. `mode` 必须是 `solution`；`research` 由协调器直接交付。
4. decision 协议的 requiredFields 与条件必填必须齐全。
5. `crossCutting.items` 与 `crossCutting.exemption` 满足互斥规则。
6. `docPath` 是唯一规范性设计文档；不得另建 Packet、restate 或补充设计作为事实源。

输入缺失时返回协调器补齐。不得从用户描述自行重造 Packet。

## StagePlan

进入阶段先建立内部阶段清单，不写平台全局计划：

```text
StagePlan {
  steps[],
  currentStep,
  checkpoints[],
  documentRevision,
  completedSteps[]
}
```

建议步骤：

1. 校验 Packet，加载模板与参考
2. 产出章节大纲和结构骨架
3. 架构审核
4. 逐章详细设计
5. 汇总 Registry 与基线元数据
6. 全文 Review
7. findings triage 与修订
8. Delta Verification / 必要时重新 Review
9. 保存、返回 verdict 和 render 选择 checkpoint

## 用户交互协议

Writing 不调用用户提问工具，也不直接结束回合等待回答。所有交互返回协调器：

```yaml
status: checkpoint_required | needs_user_input
checkpoint:
  checkpointType: structure-review | finding-triage | render-choice | local-decision | risk-acceptance
  question: string
  options: []
  preview: string | object
  resumeState: object
  dedupeKey: string
```

长大纲或图先放完整 `preview`，协调器负责可读展示，再呈现选项。用户答案必须和 `resumeState` 一起送回才能继续。

## Step 1：加载与映射

按 `scenario` Read 对应模板和骨架：

| scenario | 模板 | 骨架 |
|---|---|---|
| feat | `references/template-feat.md` | `references/example-feat-skeleton.md` |
| bug | `references/template-bug.md` | `references/example-bug-skeleton.md` |
| refactor | `references/template-refactor.md` | `references/example-refactor-skeleton.md` |

字段映射：

- `restate` → 首章罗盘；`restateOwner: define` 时原样保留
- `selectedApproach + alternatives + decisionHistory` → 方案决策
- `constraints` → 约束
- `domainDecisions` → 权威决策正文
- `crossCutting.items` → 横切 placement；只引用 `decisionRefs`，不复制权威结论
- `openQuestions` → 待消解问题
- `testObjectives + verifyStrategy` → 验证策略
- `evalSpec` → eval 设计
- `registryInputs` → Registry 候选
- `sources` → 前置证据

当设计包含多个候选限界上下文或持久化数据模型时 Read `references/ddd-modeling.md`。限界上下文按业务能力、统一语言和一致性边界判断；仓、服务和部署单元只是信号。

## Step 2：结构骨架 checkpoint

基于模板产出章节大纲和结构骨架：

- feat：业务能力 / 限界上下文 + 依赖与端到端路径
- bug：现象、复现、影响边界与问题位置
- refactor：现状与目标结构 before / after

返回协调器：

```yaml
status: checkpoint_required
checkpoint:
  checkpointType: structure-review
  question: 请确认章节大纲和结构骨架，或指出要调整的边界。
  options: [确认, 调整, 返回方案决策]
  preview: <完整大纲和结构图>
  resumeState:
    stage: writing
    step: structure
    packetRevision: <current>
  dedupeKey: writing-structure-r<packetRevision>-v1
```

调整后更新 preview 并使用新 dedupeKey；不得把用户没看清的长骨架塞进短选项。

## Step 3：架构审核

结构确认后先审战略忠实度：

- 业务能力、统一语言与一致性边界合理
- 依赖方向明确且无无意环
- 核心数据所有权与 Packet 一致
- 端到端路径覆盖约束与失败路径
- 横切 provider、consumer、enforcement point 可落位

若需 DDD 战术建模：

- 一个限界上下文可以包含多个聚合
- 每个聚合有自己的聚合根与一致性边界
- 跨上下文通过稳定 ID / API / 事件协作，不共享可变实体

结构问题若只需细化模块或内部 contract，由 Writing 就地修正并重新返回 `structure-review`。只有触发下节严格判据才允许 replan。

## Step 4：逐章详细设计

按模板的 4a / 4b / … 完成详细设计。通用要求：

- 先总图、再分域；先图、再解释
- 业务路径、决策与 Registry ID 相互引用
- 各模块写清责任、输入输出、数据所有权、失败语义、可观测与验证
- `domainDecisions` 是结论权威；横切章使用 `decisionRefs` 展示 placement
- 逐章对照罗盘，不越 scope / nonGoals

Writing 本地拥有：

- 内部模块拆分与命名
- 内部 API 参数和内部 schema
- 类、事件、存储契约的详细形态
- 不改变硬约束的算法细化

这些变化可用 `local-decision` checkpoint 确认高影响细节，但不能因为“新增了 API 字段”就回退 Decision。

### replan 严格判据

仅以下事实失效时返回 `replan_required`：

1. 选定 approach 无法成立。
2. 核心业务能力、限界上下文或关键数据所有权必须重划。
3. 已承诺的外部兼容契约必须破坏。
4. 硬约束被新证据推翻。

```yaml
status: replan_required
originalPacketRevision: <current>
invalidatedDecision: string
evidence: []
affectedSections: []
resumeState:
  writingStep: string
  preservedDraftSections: []
```

协调器回 Decision 后，新 Packet 必须保持 `schemaVersion`，令 `packetRevision + 1`。旧 draft 中失效决策标 `superseded`，旧 verdict 失效。

## Step 5：汇总与基线

在同一 `docPath` 汇总：

1. 文件影响总表
2. 跨路径验证策略
3. Implementation Item Registry
4. 非阻塞 Open Questions 与风险

Registry 收集 Q / BF / API / DATA / LOG / METRIC / ALERT / SEC / PERF / MIG / IDEM / EVAL / TO / GATE 等规范性项。每项包含：

```yaml
id: string
state: required | verify-only | deferred | n/a
sourceAnchor: string
summary: string
decisionRefs: []
verification: string
deferOrNaEvidence: string | null
```

来源章节在对应规范性段落前写稳定锚点，例如：

```html
<!-- design-item: IDEM-1 -->
```

检查 `Registry ↔ sourceAnchor` 双向无 orphan。

在 frontmatter 写入：

```yaml
status: in-review
designRevision: 1
designDigest: sha256:<canonical-markdown-digest>
packetRevision: <source packet revision>
```

规范性内容首次形成时 `designRevision: 1`；此后任何规范性内容变更都递增 revision 并重算 digest。Review Log、时间戳、render receipt 等非规范性元数据按 traceability 协议排除在 canonical digest 外。

## Step 6：唯一全文 Review

Read `references/design-doc-review.md`，按其全部维度检查当前完整文档。Step 3 只审早期结构，本步审完整性、一致性、可执行性、风险和可验证性。

### 独立性规则

默认可由主会话自查，但命中认证、敏感数据、schema / migration、资金、公开外部 API 或不可逆决策时，必须二选一：

1. 使用独立 review，记录 `independence: independent`；或
2. 返回 `risk-acceptance` checkpoint，由协调器取得用户显式接受，记录范围、理由和时间。

不得只“建议升审”后仍自动批准。

独立 review handoff 使用 `Skill(nocode:reviewing)`。


findings 使用 C / W / S / Q / SA 五档并带稳定短 ID、`sourceAnchor` 和证据。Open Question 分类：

- blocking：影响实现安全、兼容、所有权或验收，必须解决；存在时 `approved: false`。
- non-blocking：可延期，但必须记录 reason、owner、target stage 和验证方法。

### DesignReviewVerdict

```yaml
DesignReviewVerdict:
  approved: true | false
  reviewedRevision: <designRevision>
  reviewedDigest: <designDigest>
  findings: []
  blockingOpenQuestions: []
  deferredOpenQuestions: []
  remainingRisks: []
  independence: self | independent
  riskAcceptance: null | object
```

`approved: true` 必须同时满足：

- 无 Critical
- `blockingOpenQuestions` 为空
- Registry 双向无 orphan
- verdict revision / digest 与当前文档一致
- 敏感面满足独立性规则

## Step 7：findings triage

若有 findings，返回协调器：

```yaml
status: checkpoint_required
checkpoint:
  checkpointType: finding-triage
  question: 请决定每条 finding 的 fix、answer 或 defer/skip。
  options: [修复所有阻塞项, 逐条处理, 退回重写]
  preview: <C/W/S/Q/SA 完整清单>
  resumeState:
    reviewedRevision: <current>
    findingIds: []
  dedupeKey: writing-findings-r<designRevision>-<review-round>
```

Critical 和 blocking Q 不提供 skip；非阻塞项 defer / skip 时记录理由与 owner。协调器返回决定前不改正文。

## Step 8：修订与 Delta Verification

按用户决定修订并 append Review Log。正文发生任何修订：

1. `designRevision + 1`
2. 重算 `designDigest`
3. 将旧 `DesignReviewVerdict` 标记过期，**不得沿用旧 verdict**
4. 执行 **Delta Verification**，逐条核对 finding → patch → sourceAnchor → Registry → TO 的闭环

若变更触及结构、Critical、blocking Q、外部契约、数据模型、边界或影响其他规范性章节，必须对新 revision 重新执行完整 Review，生成新 verdict。

纯局部措辞或明确范围内的 finding fix 也必须对新 revision 执行 Delta Verification，并生成绑定新 `reviewedRevision` / `reviewedDigest` 的新 verdict；不能复制旧 verdict。

最终把 findings、决定、修订摘要、Delta Verification 证据和 verdict 追加到 `## Review Log`。Review Log 自身是非规范性审计记录，不触发新 revision。

## Step 9：批准、保存与 render 选择

只有当前 verdict 合法时，才在同一事务中把 frontmatter 改为 `status: approved` 并保存到原 `docPath`。任一失败都返回 `approved: false`。

随后返回 render 选择 checkpoint：

```yaml
status: checkpoint_required
checkpoint:
  checkpointType: render-choice
  question: 是否将已批准 Markdown 忠实渲染为 Open Design 页面？
  options: [渲染, 跳过]
  preview:
    docPath: string
    designRevision: integer
    designDigest: string
  resumeState:
    stage: writing
    step: complete
  dedupeKey: writing-render-choice-<designDigest>
```

协调器返回选择后，Writing 返回：

```yaml
status: completed
docPath: string
designRevision: integer
designDigest: string
packetRevision: integer
reviewVerdict: <DesignReviewVerdict>
renderRequested: boolean
stagePlan: <StagePlan>
```

Writing 自己不执行 render。

## Exit Gate

- [ ] Packet `schemaVersion` / `packetRevision` 合法且 mode 为 solution
- [ ] 结构 checkpoint 已由协调器确认
- [ ] 详细设计忠实落地 Packet，局部细化未误触 replan
- [ ] crossCutting placement 与 domain decision 双向一致
- [ ] Registry 与 sourceAnchor 双向无 orphan
- [ ] 当前 `designRevision` / `designDigest` 已写入 frontmatter
- [ ] verdict 绑定当前 revision / digest，阻塞问题为空
- [ ] 正文修订后已做 Delta Verification，必要时已完整重审
- [ ] 敏感面独立审查或风险接受已记录
- [ ] render 选择由协调器取得

## 写作边界

Design doc 回答“为什么这样设计、边界与契约是什么、关键路径如何工作、怎样证明成立”。Plan 才回答实施顺序和逐步 TDD；ops doc 才承载部署脚本、dashboard 与 runbook。

## References

- `references/template-{feat,bug,refactor}.md`
- `references/example-{feat,bug,refactor}-skeleton.md`
- `references/writing-principles.md`
- `references/cross-cutting-design.md`
- `references/ddd-modeling.md`
- `references/design-doc-review.md`
- `{QODER_PLUGIN_ROOT}/skills/references/design-traceability.md`
- `{QODER_PLUGIN_ROOT}/skills/references/doc-render.md`
