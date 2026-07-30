---
name: dev-design
description: "Use for technical design, solution selection, design documents, or devflow’s Design stage for non-trivial multi-module work. Not for README, comments, commit messages, or implementation."
---

# dev-design — 设计流程协调器

**Iron Law：dev-design 是单一会话流程；它是全局 plan 的唯一写入者，也是整个 Design 流程唯一的用户确认所有者。**

`decision/SKILL.md` 与 `writing/SKILL.md` 是主流程依次读取并执行的私有 playbook，不是独立 agent、子进程或可恢复运行时：它们不创建自己的计划、不返回控制信封，也不直接调用用户提问工具。可选渲染归 `{QODER_PLUGIN_ROOT}/skills/references/doc-render.md`。跨 Design / Plan / Build / Verify 的基线契约统一 Read `{QODER_PLUGIN_ROOT}/skills/references/design-traceability.md`。

## 总状态机

```text
decision ── solution Packet ──→ writing ── reviewed doc + verdict ──→ render? ──→ final-gate
   ▲                                  │
   └──────── 方案级证据推翻 ──────────┘

decision ── mode: research ──→ research final-gate
                              writing / render 跳过
```

## 确认模型：普通会话暂停

所有确认都是主流程中的普通会话暂停，不模拟一套工作流引擎。固定确认点：

- `packet-review`：确认完整 Decision Packet
- `structure-review`：确认章节与架构骨架
- `finding-triage`：决定评审问题如何处理
- `risk-acceptance`：敏感面无法独立复核时显式接受风险
- `render-choice`：选择是否渲染
- `final-gate`：确认设计完成及下一步
- `local-decision`：仅用于证据无法消解的高影响局部选择

每个确认点都按同一简单动作执行：

1. 当前 dev-design 主流程先完整展示预览、问题和可选动作。
2. 结束当前回合等待用户答复。
3. 下一回合根据用户答案更新全局计划、同一份设计文档及其 revision，然后继续。

续接依据只有当前会话、全局计划和设计文档中的显式状态；不声称存在隐藏的持久化游标或自动去重。若换了新会话，先重读设计文档和 revision，必要时重述当前确认点再继续。

## Enter Gate（宽进严出）

- 用户显式提出设计、方案或技术选型；或任务跨模块、存在多条可行路径、会改变架构边界。
- 单文件单决策可建议直接进入 Plan / Build；用户坚持设计时仍进入。
- 缺 restate 时先形成轻量罗盘：`goal / scope / constraints / nonGoals / successSignals`。

罗盘必须声明 `restateOwner`：

- `define`：来自 Define 的已确认罗盘。Design 发现要改目标、范围或硬约束时返回 Define，不能静默改写。
- `design-lite`：由本流程补出的轻量罗盘。任何修订都由主流程展示差异并取得用户确认，再写回同一设计文档。

不得为 restate、Packet 或 review 单独创建规范性文档。单一设计文档 `docPath` 始终是唯一规范性载体。

## 协议

### Step 0：创建唯一全局计划

协调器是全流程唯一允许调用平台计划工具的组件。固定维护四个稳定里程碑，不镜像阶段内部步骤：

```text
1. decision：收合法 Decision Packet
2. writing：收 reviewed doc + DesignReviewVerdict（research 模式跳过）
3. render：收 render receipt（可选；research 模式跳过）
4. final gate + handoff dev-plan
```

使用 `TaskCreate` 创建全部里程碑，状态变化时用 `TaskUpdate` 更新原 task。


### Step 1：执行 decision

Read `decision/SKILL.md`，在当前会话中按它的步骤执行，输入 request、restate、`restateOwner`、场景、约束和已知 artifacts。

- 到 `packet-review` 时，主流程展示完整 Packet、架构图、决策链、TO 与风险，结束当前回合等待答复。确认后再把 Packet 标为 confirmed。
- 只有遇到 agent 无法自行取得的信息、证据打平或不可逆高影响选择时，才使用 `local-decision`；已有可靠答案时不重复打扰用户。
- 用户要求修改或退回时，在同一文档保留决策历史，递增 `packetRevision` 后重新确认。

合法 Packet 至少满足：

- `schemaVersion: 1`
- `packetRevision >= 1`
- `mode: solution | research`
- decision 协议列出的 `requiredFields` 与条件字段完整
- `docPath` 是唯一规范性设计文档

若 `mode: research`，校验 research Packet 后将 writing 与 render 计划项标记为跳过，直接进入 Step 4 的 research final gate；不得伪造详细设计或批准状态。

### Step 2：执行 writing

仅 `mode: solution` 执行。Read `writing/SKILL.md`，传入经校验的 Packet。

主流程按 playbook 完成 `structure-review`、全文 Review、必要的 `finding-triage` / `risk-acceptance` 和 `render-choice`。确认时完整展示对应内容并按“普通会话暂停”处理。

Writing 完成后校验：

- 文档 frontmatter `status: approved`
- `DesignReviewVerdict.approved: true`
- `DesignReviewVerdict.reviewedRevision == 文档 designRevision`
- `blockingOpenQuestions` 为空
- 敏感面满足 `independence: independent`，或 verdict 记录由协调器取得的显式 `riskAcceptance`
- Implementation Item Registry 存在、双向无 orphan

若新证据推翻方案级决策，按下文 replan 处理；模块内部拆分、参数、内部 schema、命名或算法细化留在 Writing，不回退 Decision。

### Step 3：可选 render

用户在 `render-choice` 选择渲染后，主流程 Read `{QODER_PLUGIN_ROOT}/skills/references/doc-render.md` 并按其 handoff 协议执行。主流程不复制 Open Design 的 provider 命令，也不硬编码具体工具面。

调用共享协议时必须传入下面的技术设计 `renderBrief`。渲染目标是让需要理解、评审或实施方案的**人类读者**独立看懂完整思路，不是把设计文档改写成 Agent prompt、执行轨迹或控制协议：

```yaml
renderBrief:
  documentType: technical-design
  audience: human
  communicationGoal: 不依赖会话上下文，读懂为什么这样选、系统如何协作、关键场景怎样运行、失败时如何恢复以及怎样验证
  readingOrder:
    - 一屏摘要：问题、选定方案、范围、关键取舍
    - 端到端主流程与参与者
    - 系统边界、组件职责、依赖和数据所有权
    - 关键场景的调用时序、分支与返回
    - 状态变化、失败恢复、可观测与验证
    - 契约、Registry 和审计元数据附录
  diagramRequirements:
    - 用流程图解释端到端主路径、分支、异常与恢复
    - 用架构图解释系统边界、组件、部署关系、依赖方向与数据所有权
    - 跨两个及以上参与者或部署单元的关键场景逐个使用时序图
    - 有生命周期时使用状态图；有重要数据变换或模型关系时使用数据流图或实体关系图
    - refactor 补 before/after，bug 补故障传播与修复后路径，feat 补用户入口到结果的完整路径
  presentationRules:
    - 先图后文；每张图紧邻标题、图例和一段“这张图说明什么”
    - 节点先写人类可读名称，ID、method、path、事件名和 Registry ID 作为次级细节保留
    - 大图按场景或边界拆分，避免微小字号、线条交叉和把整份 Markdown 塞进单张图
    - 正文讲设计思路与因果关系；Packet schema、Review Log、Registry 全表和 Agent 工作流信息降到附录
```

图表不是装饰：只要源文档中存在对应关系，就必须生成适合页面阅读的 DOM / SVG / Mermaid 图；文字说明不能代替应有的图。不得为了视觉效果新增设计结论、隐藏失败路径或丢失规范性 ID。

渲染不得改规范性 Markdown。成功必须得到并持久化标准 receipt：

```text
{
  sourceDoc, sourceDigest, projectId, conversationId, runId,
  previewUrl, entryFile, coverage, receiptPath
}
```

receipt 写入与设计文档同目录的 `<basename>.render-receipt.json`，是非规范性 sidecar。Markdown 仍是设计事实源；渲染不可用或用户跳过时不伪造 receipt。

### Step 4：final gate 与 handoff

`solution` 模式报告：选定方案、关键取舍、测试目标、文档路径、`designRevision`、`designDigest`、未决风险及渲染结果。

`research` 模式报告：研究结论、候选方案、证据、未决问题和 Packet 路径；明确 writing 与 render 已跳过，由用户选择继续 Design、进入 Plan 或结束。

在 `final-gate` 完整展示上述结果并结束当前回合等待用户答复。用户确认进入 Plan 后，传入当前 request、stage、restate、constraints、设计文档路径、`designRevision`、`designDigest` 和用户决定；不得在确认前自行进入下一阶段。

Plan handoff 使用 `Skill(nocode:dev-plan)`。


## replan

只有下列变化允许从 Writing 回到 Decision：

- 选定 approach 失效
- 核心业务能力、限界上下文或关键数据所有权需要重划
- 已承诺的外部兼容契约失效
- 硬约束被证据推翻

模块内部拆分、接口参数、内部 schema、命名或算法细化由 Writing 本地完成，不回退 decision。

在同一设计文档记录：

```yaml
replan:
  originalPacketRevision: integer
  invalidatedDecision: string
  evidence: []
  affectedSections: []
  preservedContext: []
```

主流程随后：

1. 校验当前 Packet revision 与 `originalPacketRevision` 一致。
2. 将原决策在同一文档标记 `superseded` 并保留证据。
3. 把全局计划切回 decision，依据文档中的失效决策、证据和保留上下文继续，不从零开始。
4. 新 Packet 保持 `schemaVersion: 1`，令 `packetRevision = originalPacketRevision + 1`。
5. 新 Packet 重新进入 Writing；旧 verdict 与旧 render receipt 全部失效。

## Exit Gate

`solution` 模式：

- [ ] Packet 合法且所有确认点已由主流程处理
- [ ] 文档有唯一 `designRevision` 与 `designDigest`
- [ ] verdict 审的是当前 revision，`blockingOpenQuestions` 为空
- [ ] Registry ↔ 稳定来源锚点双向无 orphan
- [ ] 敏感面独立审查或显式风险接受已记录
- [ ] render（如选）receipt sidecar 已落盘且 sourceDigest 匹配
- [ ] final gate 通过，已建议 handoff dev-plan

`research` 模式：

- [ ] research Packet 合法
- [ ] writing / render 明确跳过
- [ ] research final gate 已完成，下一步由用户决定

## Red Flags

- 私有 playbook 创建第二份计划或假装自己是可恢复进程
- 为确认发明控制信封、隐藏游标或自动去重语义
- 未展示完整预览就让用户在短选项中拍板
- 用 `version` 同时表达 schema 与内容修订
- replan 后复用旧 verdict、旧 digest 或旧渲染 receipt
- 把阻塞 Open Question 带入 `approved: true`
- 渲染回写设计正文，或只在会话里保留产物映射
- 把 research Packet 强行送入 Writing
- 为 Packet、restate、review 另建第二份规范性事实源
