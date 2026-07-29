---
name: dev-design
description: "\"Use for technical design, solution selection, design documents, or devflow’s Design stage for…"
---

# dev-design — 设计流程协调器

**Iron Law：协调器只编排，不做阶段领域工作；它是全局 plan 的唯一写入者，也是整个 Design 流程唯一的用户确认所有者。**

方案选择归 `decision/SKILL.md`，详细设计与唯一评审归 `writing/SKILL.md`，可选渲染归 `${PLUGIN_ROOT}/skills/references/doc-render.md`。跨 Design / Plan / Build / Verify 的基线契约统一 Read `${PLUGIN_ROOT}/skills/references/design-traceability.md`。

## 总状态机

```text
                    ┌─────────────────────────────┐
                    │ dev-design                  │
                    │ 全局计划 / 路由 / 确认 / 回退 │
                    └──────────────┬──────────────┘
                                   ▼
decision ── solution Packet ──→ writing ── reviewed doc + verdict ──→ render? ──→ final gate
   ▲                                  │
   └──────── replan_required ─────────┘

decision ── mode: research ──→ research final gate
                              writing 与 render 均跳过
```

阶段协议只能返回结果，不得直接操作平台全局计划，也不得直接向用户提问或要求确认。允许的阶段结果：

- `completed`
- `checkpoint_required`
- `needs_user_input`
- `replan_required`
- `failed`

`checkpoint_required` 与 `needs_user_input` 都由协调器呈现；前者是计划内确认，后者只用于无法由 agent 获取的信息、相互冲突且需要用户偏好或不可逆高影响决策。

## Enter Gate（宽进严出）

- 用户显式提出设计、方案或技术选型；或任务跨模块、存在多条可行路径、会改变架构边界。
- 单文件单决策可建议直接进入 Plan / Build；用户坚持设计时仍进入。
- 缺 restate 时先形成轻量罗盘：`goal / scope / constraints / nonGoals / successSignals`。

罗盘必须声明 `restateOwner`：

- `define`：来自 Define 的已确认罗盘。Design 发现要改目标、范围或硬约束时返回 Define，不能静默改写。
- `design-lite`：由本流程补出的轻量罗盘。任何修订通过 `StageCheckpoint` 交协调器确认后写回同一设计文档。

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


使用 `update_plan` 一次提交全部里程碑；更新时保持稳定顺序且最多一个 `in_progress`。

Decision 与 Writing 只维护自己的 `StagePlan`，不得调用上述平台工具。

### Step 1：执行 decision

Read `decision/SKILL.md`，传入 request、restate、`restateOwner`、场景、约束和已知 artifacts。协调器处理返回值：

1. `checkpoint_required`：校验并展示 `StageCheckpoint`，记录 `dedupeKey`；用户答复后把答案与 `resumeState` 交回 decision。
2. `needs_user_input`：同样由协调器询问；若已有可靠答案则直接注入，不重复打扰用户。
3. `completed`：校验 Packet。

合法 Packet 至少满足：

- `schemaVersion: 1`
- `packetRevision >= 1`
- `mode: solution | research`
- decision 协议列出的 `requiredFields` 与条件字段完整
- `docPath` 是唯一规范性设计文档

若 `mode: research`，校验 research Packet 后将 writing 与 render 计划项标记为跳过，直接进入 Step 4 的 research final gate；不得伪造详细设计或批准状态。

### Step 2：执行 writing

仅 `mode: solution` 执行。Read `writing/SKILL.md`，传入经校验的 Packet。

协调器只做契约验证，不重新评审正文：

- 文档 frontmatter `status: approved`
- `DesignReviewVerdict.approved: true`
- `DesignReviewVerdict.reviewedRevision == 文档 designRevision`
- `blockingOpenQuestions` 为空
- 敏感面满足 `independence: independent`，或 verdict 记录由协调器取得的显式 `riskAcceptance`
- Implementation Item Registry 存在、双向无 orphan

`checkpoint_required` / `needs_user_input` 仍由协调器统一处理。`replan_required` 进入下一节。

### Step 3：可选 render

Writing 通过 `render-choice` checkpoint 收到用户选择后，协调器 Read `${PLUGIN_ROOT}/skills/references/doc-render.md` 并按其 handoff 协议执行。协调器不复制 Open Design 的 provider 命令，也不硬编码具体工具面。

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

final gate 是 `StageCheckpoint(checkpointType: final-gate)`，仍由协调器呈现。通过后建议进入 Plan，并传入当前 request、stage、restate、constraints、设计文档路径、`designRevision`、`designDigest` 和用户决定；不得自行进入下一阶段。


Plan handoff 使用 `$dev-plan`。

## StageCheckpoint

所有计划内和例外用户交互都用同一 envelope：

```yaml
status: checkpoint_required | needs_user_input
checkpoint:
  checkpointType: packet-review | structure-review | finding-triage | render-choice | local-decision | risk-acceptance | final-gate
  question: string
  options: []
  preview: string | object
  resumeState: object
  dedupeKey: string
```

- 阶段只能返回 envelope，不能自行弹窗、在回合末尾直接提问或等待用户。
- 协调器按 `dedupeKey` 去重，并把用户答案连同 `resumeState` 送回原阶段。
- 对长文预览，协调器先完整展示，再发结构化选项；不能把骨架塞进会折叠的短字段。

## replan

只有下列变化允许 Writing 返回 `replan_required`：

- 选定 approach 失效
- 核心业务能力、限界上下文或关键数据所有权需要重划
- 已承诺的外部兼容契约失效
- 硬约束被证据推翻

模块内部拆分、接口参数、内部 schema、命名或算法细化由 Writing 本地完成，不回退 decision。

replan envelope 必须带 `originalPacketRevision / invalidatedDecision / evidence / affectedSections / resumeState`。协调器：

1. 校验当前 Packet revision 与 `originalPacketRevision` 一致。
2. 将原决策在同一文档标记 `superseded` 并保留证据。
3. 回到 decision 的 `resumeState`，不从零开始。
4. 新 Packet 保持 `schemaVersion: 1`，令 `packetRevision = originalPacketRevision + 1`。
5. 新 Packet 重新进入 Writing；旧 verdict 与旧 render receipt 全部失效。

## Exit Gate

`solution` 模式：

- [ ] Packet 合法且所有 checkpoint 已由协调器处理
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

- 阶段协议调用全局计划工具，导致同一计划被覆盖
- Decision / Writing 直接问用户，绕过协调器与去重
- 用 `version` 同时表达 schema 与内容修订
- replan 后复用旧 verdict、旧 digest 或旧渲染 receipt
- 把阻塞 Open Question 带入 `approved: true`
- 渲染回写设计正文，或只在会话里保留产物映射
- 把 research Packet 强行送入 Writing
- 为 Packet、restate、review 另建第二份规范性事实源
