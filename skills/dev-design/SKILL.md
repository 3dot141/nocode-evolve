---
name: dev-design
description: Use when Define is complete and devflow routes to the Design stage, or the user wants the full design flow end-to-end (选方案 → 详细设计 → 渲染). Thin coordinator routing dev-design-select → dev-design-refine →（可选）dev-design-render；本 skill 自身不选方案、不写文档、不评审。Not for picking an approach directly (use nocode:dev-design-select), writing the design doc (use nocode:dev-design-refine), code comments, README, or commit messages.
---

# dev-design — 设计流程协调器

**Iron Law: 协调器只编排，不做任何阶段的领域工作。选方案在 select，写文档 + 评审在 refine，渲染在 render——协调器一个字的领域内容都不产出。**

dev-design 是设计流程的**薄协调器**：持有总流程图 / 阶段状态机 / 路由 / 全流程确认策略 / 异常回退 / handoff。三段领域工作各归其位——决策形成 → `dev-design-select`，文档产出 + 唯一评审 → `dev-design-refine`，渲染（可选终点）→ `dev-design-render`。

> Leading word: **协调**。协调是横切关注点（状态机 / 路由 / 确认 / 回退），和任何具体阶段的收敛工作分层——二者纠缠正是重构前"选方案 worker 和流程 coordinator 塞一个 skill"的病根。

## 新架构总图

```
                        ┌───────────────────────────────────────┐
   用户 / devflow ───→  │  dev-design（薄协调器）                 │
                        │  持: 总流程图 / 状态机 / 路由 /          │
                        │      全流程确认策略 / 异常回退 / handoff │
                        └──┬──────────┬──────────┬───────────────┘
              调用 + 收结果 │          │          │
                 ┌──────────▼──┐ ┌─────▼──────┐ ┌─▼──────────────┐
                 │select       │ │refine      │ │render          │
                 │选方案        │ │详细设计 +  │ │纯渲染           │
                 │→ Decision   │ │文档 + 唯一 │ │→ HTML + receipt │
                 │   Packet    │ │评审(verdict)│ │(不改输入文档)   │
                 └─────────────┘ └────────────┘ └────────────────┘
```

## 阶段状态机

```
select ──Decision Packet──→ refine ──reviewed doc + verdict──→ (可选) render ──receipt──→ final gate → handoff dev-plan
   ▲                            │
   └────── replan_required ──────┘（refine 遇方案级决策变更，协调器回退到 select 重选）
```

- **阶段 skill 只返回结果**（Decision Packet / reviewed doc + verdict / render receipt），不自行管流程、不自行弹确认。
- **协调器只验结果、不重做领域工作**：refine 返回 review verdict，协调器**只验 verdict 是否 approved，不重新评审**（评审的唯一所有者是 refine——历史上协调器与 refine 各审一遍，重复且结论可能冲突）。

## 非本 skill 请求

- 选方案 / 技术选型 / 方案对比 / 预研 → `dev-design-select`（直接要选方案，不必经协调器）
- 写详细设计文档 / 已有选定方案要落文档 → `dev-design-refine`
- 设计文档渲染成 HTML → `dev-design-render`
- Define 未完成（无 restate）→ 回 Define；Mini / Standard 场景跳 Design 直接进 Plan

## Enter Gate

- [ ] Define restate 存在且用户已确认
- [ ] 场景分类 = Full

## 协议

### Step 0: TaskCreate（协调里程碑，不镜像阶段内部步骤）

**进入后第一件事**，建 4 个协调里程碑（**不镜像 select/refine 的内部 Step**——那些由各阶段 skill 内部循环处理，镜像出来会打架、谎报进度）：

```
Task 1: 路由 select — 选方案，收 Decision Packet（校验 requiredFields 齐）
Task 2: 路由 refine — 传 Decision Packet 写详细设计 + 唯一评审，收 reviewed doc + review verdict
Task 3:（可选）路由 render — 收 render receipt，记录产物关系
Task 4: final gate + 硬交接 dev-plan
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: 路由 → select

调 `Skill(nocode:dev-design-select)`，选方案。收回 **Decision Packet**：
- 校验 `requiredFields` 齐（清单单源在 select SKILL「收尾」节）；缺 → 让 select 补，不带缺口进 refine。
- select 返回 `needs_user_input`（打平手 / 冲突 / 信息缺口 / 不可逆）→ 走「确认策略」统一弹，用户答复后回传 select 续跑。

### Step 2: 路由 → refine（传 Decision Packet）

调 `Skill(nocode:dev-design-refine)`，传入 Decision Packet。收回 **reviewed 文档 + review verdict**：
- **只验 verdict**（`approved: true` + 无 Critical）——不重新评审。
- refine 返回 `replan_required` → 走「replan 处理」回退 select。
- refine 返回 `needs_user_input` → 走「确认策略」统一弹。

### Step 3:（可选）路由 → render

用户在 refine 收尾选了渲染 → 调 `Skill(nocode:dev-design-render)`。收回 **render receipt**：
- render **不改输入文档**（已评审文档不可变——render 回写会让评审结论不再覆盖当前内容）；协调器**记录产物关系**（见「产物记录」）。
- 用户不渲染 → 跳过，markdown 即最终交付。

### Step 4: final gate + 硬交接

final gate = 本轮设计流程的**计划内总确认窗口**：向用户报告方案摘要（← Packet `selectedApproach`）+ 关键决策（← `alternatives` 反方 + `[已确认]/[假定]`）+ 测试目标（← `testObjectives`）+ 文档路径 + 渲染产物（如有）。用户可对任意决策提异议要求回退。通过后建议进 Plan，等用户拍板调 `Skill(nocode:dev-plan)`。

## 确认策略（单一所有者：协调器）

早期设计承诺的"全流程唯一确认窗口"兜不住（阶段 skill 内部本就有确认点）。改为**协调器持有一张确认点清单**，诚实列举，不假装只有一个：

1. **计划内总窗口**：Step 4 final gate（方案摘要 + 关键决策 + 测试目标 + 文档，一次性过目）。
2. **列举的阶段内确认**（协调器已知、不隐藏）：refine 的文档结构确认（Step 2 章节大纲 + 结构骨架）、refine 唯一评审的 findings 逐条 fix/skip、render 的"是否渲染"选择。
3. **异常确认**：阶段 skill 返回 `needs_user_input`（打平手 / 冲突需拍板 / 信息缺口 / 不可逆 + 高影响）时，**协调器统一弹**（阶段 skill 不自行弹）——同一 `dedupeKey` 的确认不重复弹。

**单一所有者** = 协调器。阶段 skill 被协调器调用时遇确认返回 `needs_user_input`，不自行承诺"唯一窗口"、不自行弹。

## replan 处理（方案级决策回退）

refine 在信息补全遇**方案级决策**（改数据流 / 模块边界 / 外部契约 / 关键约束）→ 返回 `replan_required`（envelope 单源见 select SKILL）。协调器：
1. **覆盖旧 Decision Packet + 递增 revision**（`originalPacketRevision` + 1）。
2. **保留决策历史**（旧 Packet 不删，留痕供审计——与设计文档 superseded 留痕同理：旧版不删、指向新版）。
3. 按 `resumeState` **回退到 select 对应阶段重选**，带上 `invalidatedDecision` + `evidence`，select 不从零重来。
4. 重选产出新 Packet → 回 Step 2 refine。

## 产物记录（已评审文档不可变）

render 纯输出、不碰输入文档；**产物关系由协调器在 final gate 报告里给出**（会话内交付，不落盘、不改已评审文档、不进 manifest——manifest 不承担运行产物索引）。报告内容 = render receipt 的 `sourceDoc`（未改动）↔ `output`（HTML 路径 / Claude Design projectId）↔ `deliveryMode` 映射。这是会话级记录，不是持久化索引——要持久化产物索引是另一个 feature，本次不做。

## Exit Gate

- [ ] select 产出合法 Decision Packet（requiredFields 齐），协调器已校验
- [ ] refine 返回 reviewed 文档 + review verdict（`approved`），协调器只验未重审
- [ ] replan（如有）已处理：旧 Packet 留痕 + revision 递增 + 回 select 重选完成
- [ ] render（如选）receipt 已收，输入文档未被改动，产物关系已在 final gate 报告 `sourceDoc`↔`output` 映射
- [ ] 全流程确认按「确认策略」清单落实（总窗口 + 列举确认 + 异常统一弹），无阶段 skill 自行弹确认
- [ ] **硬交接**：final gate 通过后向用户报告 Design 完成（方案摘要 + 关键决策 + 测试目标 + 文档路径），建议进 Plan（`nocode:dev-plan`），列出 Plan sub-steps。等用户拍板，不自行进入下一阶段

## Red Flags

- 协调器自己选方案 / 自己写文档 / 自己评审——领域工作全在阶段 skill，协调器越界就是重构前的病复发
- 收到 refine 的 verdict 又重新评审一遍——协调器只验 verdict，重审 = "双所有者各审一遍"的历史病灶回潮
- 阶段 skill 自行弹确认而不返回 `needs_user_input`——确认的单一所有者是协调器
- replan 时直接让 select 从零重来 / 不保留旧 Packet——丢了 `invalidatedDecision + evidence` 和决策历史
- render 改了输入设计文档 / 协调器不记录产物关系——已评审文档不可变，产物映射只在 final gate 报告里给
- 因"任务简单 / 用户说了'继续'"跳过某阶段路由、不建 Step 0 TaskCreate、或漏掉最后的交接 task
