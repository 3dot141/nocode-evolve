---
name: dev-design
description: "Use when the user wants to design how to build something — 设计/怎么设计/技术设计/详细设计/写设计文档/出方案再写设计/设计一下/先设计/要不要先设计/需要设计吗/走设计流程/design it/how should we build this/let's design this. Also triggers when devflow routes to Design stage, when the task is non-trivial and no design exists yet, or when the user asks 怎么做/怎么实现 for a multi-module change. Does NOT require Define to be complete — handles missing context internally. Coordinates three internal phases: decision (选方案) → writing (详细设计+评审) → render (可选渲染). Not for code comments, README, commit messages."
---

# dev-design — 设计流程协调器

**Iron Law: 协调器只编排，不做任何阶段的领域工作。选方案在 decision，写文档 + 评审在 writing，渲染在 render——协调器一个字的领域内容都不产出。**

dev-design 是设计流程的**薄协调器**：持有总流程图 / 阶段状态机 / 路由 / 全流程确认策略 / 异常回退 / handoff。三段领域工作各归其位——决策形成 → `decision/SKILL.md`，文档产出 + 唯一评审 → `writing/SKILL.md`，渲染（可选终点）→ `render/SKILL.md`。三个阶段均为 dev-design 的内部协议，不独立注册，由协调器 Read 后按协议执行。

> Leading word: **协调**。协调是横切关注点（状态机 / 路由 / 确认 / 回退），和任何具体阶段的收敛工作分层。

## 架构总图

```
                        ┌───────────────────────────────────────┐
   用户 / devflow ───→  │  dev-design（薄协调器）                 │
                        │  持: 总流程图 / 状态机 / 路由 /          │
                        │      全流程确认策略 / 异常回退 / handoff │
                        └──┬──────────┬──────────┬───────────────┘
              Read + 执行  │          │          │
                 ┌──────────▼──┐ ┌─────▼──────┐ ┌─▼──────────────┐
                 │decision     │ │writing     │ │render          │
                 │选方案        │ │详细设计 +  │ │纯渲染           │
                 │→ Decision   │ │文档 + 唯一 │ │→ HTML + receipt │
                 │   Packet    │ │评审(verdict)│ │(不改输入文档)   │
                 └─────────────┘ └────────────┘ └────────────────┘
                 内部协议         内部协议         内部协议
```

## 阶段状态机

```
decision ──Decision Packet──→ writing ──reviewed doc + verdict──→ (可选) render ──receipt──→ final gate → handoff dev-plan
   ▲                              │
   └────── replan_required ───────┘（writing 遇方案级决策变更，协调器回退到 decision 重选）
```

- **阶段协议只返回结果**（Decision Packet / reviewed doc + verdict / render receipt），不自行管流程、不自行弹确认。
- **协调器只验结果、不重做领域工作**：writing 返回 review verdict，协调器**只验 verdict 是否 approved，不重新评审**（评审的唯一所有者是 writing）。

## Enter Gate（宽进严出）

**宽进**：有设计意图即可进入——不要求 Define 完成、不要求场景 = Full。1% 沾"设计"就触发。

- [ ] 用户有设计意图（显式说"设计/方案/怎么做"，或任务复杂度需要设计）

**缺上下文时的入口处理**（协调器在 Step 0 之前就地补全，不踢回 Define）：
- 无 restate → 协调器用 1-2 轮快速澄清（目标 + 范围 + 约束），形成 **轻量 restate** 后进 decision；不走完整 Define 流程
- 场景不明 / Mini / Standard → 协调器判断是否真需设计（跨模块 / 多决策点 / 有架构影响 → 需要，进 decision；单文件单决策 → 建议直接进 Plan/Build，用户坚持则仍进 decision）

## 协议

### Step 0: TaskCreate（协调里程碑，不镜像阶段内部步骤）

**进入后第一件事**，建 4 个协调里程碑（**不镜像 decision/writing 的内部 Step**——那些由各阶段协议内部循环处理，镜像出来会打架、谎报进度）：

```
Task 1: 路由 decision — 选方案，收 Decision Packet（校验 requiredFields 齐）
Task 2: 路由 writing — 传 Decision Packet 写详细设计 + 唯一评审，收 reviewed doc + review verdict
Task 3:（可选）路由 render — 收 render receipt，记录产物关系
Task 4: final gate + 硬交接 dev-plan
  metadata: {handoff: true}
```

每完成一个标 done。

### Step 1: 路由 → decision

Read `decision/SKILL.md`，按协议执行选方案。收回 **Decision Packet**：
- 校验 `requiredFields` 齐（清单单源在 decision SKILL「收尾」节）；缺 → 补完，不带缺口进 writing。
- decision 返回 `needs_user_input`（打平手 / 冲突 / 信息缺口 / 不可逆）→ 走「确认策略」统一弹，用户答复后继续。

### Step 2: 路由 → writing（传 Decision Packet）

Read `writing/SKILL.md`，按协议执行，传入 Decision Packet。收回 **reviewed 文档 + review verdict**：
- **只验 verdict**（`approved: true` + 无 Critical）——不重新评审。
- writing 返回 `replan_required` → 走「replan 处理」回退 decision。
- writing 返回 `needs_user_input` → 走「确认策略」统一弹。

### Step 3:（可选）路由 → render

用户在 writing 收尾选了渲染 → Read `render/SKILL.md`，按协议执行。收回 **render receipt**：
- render **不改输入文档**（已评审文档不可变——render 回写会让评审结论不再覆盖当前内容）；协调器**记录产物关系**（见「产物记录」）。
- 用户不渲染 → 跳过，markdown 即最终交付。

### Step 4: final gate + 硬交接

final gate = 本轮设计流程的**计划内总确认窗口**：向用户报告方案摘要（← Packet `selectedApproach`）+ 关键决策（← `alternatives` 反方 + `[已确认]/[假定]`）+ 测试目标（← `testObjectives`）+ 文档路径 + 渲染产物（如有）。用户可对任意决策提异议要求回退。通过后建议进 Plan，等用户拍板调 `Skill(nocode:dev-plan)`。

## 确认策略（单一所有者：协调器）

协调器持有一张确认点清单，诚实列举：

1. **计划内总窗口**：Step 4 final gate（方案摘要 + 关键决策 + 测试目标 + 文档，一次性过目）。
2. **列举的阶段内确认**（协调器已知、不隐藏）：decision 的每轮方案确认（Step 4a——每个决策层级 L1/L2/L3 两回合展示方案对比,用户拍方向）与 Decision Packet 终审（Step 8a——完整 Packet 展示 → 用户审核确认）,每次必过、由 decision 自行执行；writing 的文档结构确认（Step 2 章节大纲 + 结构骨架）、writing 唯一评审的 findings 逐条 fix/skip、render 的"是否渲染"选择。
3. **异常确认**：阶段协议返回 `needs_user_input`（打平手 / 冲突需拍板 / 信息缺口 / 不可逆 + 高影响）时，**协调器统一弹**——同一 `dedupeKey` 的确认不重复弹。

**单一所有者** = 协调器。阶段协议遇确认返回 `needs_user_input`，不自行弹。

## replan 处理（方案级决策回退）

writing 在信息补全遇**方案级决策**（改数据流 / 模块边界 / 外部契约 / 关键约束）→ 返回 `replan_required`（envelope 单源见 `decision/SKILL.md`）。协调器：
1. **覆盖旧 Decision Packet + 递增 revision**（`originalPacketRevision` + 1）。
2. **保留决策历史**（旧 Packet 不删，留痕供审计——与设计文档 superseded 留痕同理：旧版不删、指向新版）。
3. 按 `resumeState` **回退到 decision 对应阶段重选**，带上 `invalidatedDecision` + `evidence`，decision 不从零重来。
4. 重选产出新 Packet → 回 Step 2 writing。

## 产物记录（已评审文档不可变）

render 纯输出、不碰输入文档；**产物关系由协调器在 final gate 报告里给出**（会话内交付，不落盘、不改已评审文档）。报告内容 = render receipt 的 `sourceDoc`（未改动）↔ `htmlFile`（页面文件路径）+ `artifactUrl`（Artifact 页面 URL）映射。

## Exit Gate

- [ ] decision 产出合法 Decision Packet（requiredFields 齐），协调器已校验
- [ ] writing 返回 reviewed 文档 + review verdict（`approved`），协调器只验未重审
- [ ] replan（如有）已处理：旧 Packet 留痕 + revision 递增 + 回 decision 重选完成
- [ ] render（如选）receipt 已收，输入文档未被改动，产物关系已在 final gate 报告 `sourceDoc`↔`output` 映射
- [ ] 全流程确认按「确认策略」清单落实（总窗口 + 列举确认 + 异常统一弹）
- [ ] **硬交接**：final gate 通过后向用户报告 Design 完成（方案摘要 + 关键决策 + 测试目标 + 文档路径），建议进 Plan（`nocode:dev-plan`），列出 Plan sub-steps。等用户拍板，不自行进入下一阶段

## Red Flags

- 协调器自己选方案 / 自己写文档 / 自己评审——领域工作全在阶段协议，协调器越界就是重构前的病复发
- 收到 writing 的 verdict 又重新评审一遍——协调器只验 verdict，重审 = "双所有者各审一遍"的历史病灶回潮
- replan 时直接让 decision 从零重来 / 不保留旧 Packet——丢了 `invalidatedDecision + evidence` 和决策历史
- render 改了输入设计文档 / 协调器不记录产物关系——已评审文档不可变，产物映射只在 final gate 报告里给
- 因"任务简单 / 用户说了'继续'"跳过某阶段路由、不建 Step 0 TaskCreate、或漏掉最后的交接 task
