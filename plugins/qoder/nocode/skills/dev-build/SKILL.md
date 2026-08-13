---
name: dev-build
description: Use to implement confirmed tasks, resume coding, or enter devflow Build. Not for explanation-only requests, work without a defined goal, or scopes that still need decomposition.
---

# build — 读 plan 执行方式，走对应协议

Build 是编排入口：读 Plan 阶段用户选定的 `Execution` 字段，走对应的执行协议——`subagent-lite`（顺序派发 implementer，仅风险 task 派审查）、`subagent-full`（per-task spec review + checkpoint 批量 quality review）或 `executing`（主 agent 自己顺序执行 plan 已写代码）。Build skill 本身只负责 devflow 阶段编排（Enter/Exit Gate、里程碑、硬交接），具体执行细节在对应 reference 文件里。

进入 Build 时 Read `{QODER_PLUGIN_ROOT}/skills/references/design-traceability.md` 与 `{QODER_PLUGIN_ROOT}/skills/references/source-comment-contract.md`。Plan 的 `designRevision` / `designDigest` 是不可变基线，`designCovers` 是已确认 task scope 的一部分：执行方只能实现并回报，不能自行更换基线或 Design ID。

## 非本 skill 请求

解释代码 / 知识问答 → 直接回答不进 Build。无计划无目标（"帮我做个东西"）→ 回 Define。"整个项目重构" → scope 过大回 Plan 拆。

## Enter Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Plan 已标注 `Execution` 字段（`subagent-lite` / `subagent-full` / `executing`；旧计划的 `subagent` 按 `subagent-full` 处理）
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）
- [ ] Full 场景：Plan 已有 Design → Task Coverage Matrix，且每个 task 都有 `designCovers`
- [ ] Full 场景：Plan header 与当前 approved Design 的 `designRevision` / `designDigest` 完全一致；不一致立即回 Plan

## 协议

### Step 0: 建编排里程碑

**进入后立即 workflow.plan.create**，建 3 个编排里程碑（**不镜像 plan 的每个 task**——per-task 由对应 reference 协议内部循环处理，镜像出来会和这些内部循环打架、谎报进度；这里只跟踪编排者自己的 3 步）：

```
Task 1: 读 Execution 字段，按对应协议执行
  Sub-steps: 读 plan header 的 Execution 字段 → Read 对应 reference 文件 → 按其协议逐 task 执行完
  Gate: 所有 task 按对应协议跑完，拿到每个 task 的结果

Task 2: 编排者验证
  Sub-steps: 独立查 diff + 独立跑测试 + spec 抽查 + 空壳扫描
  Gate: 全部 task 通过编排者独立验证（不信执行方自报）

Task 3: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Build 完成（完成 task 数 + 测试 + build 状态）→ 建议进 Verify → 等用户拍板后按下方平台指令调用 Verify，传入当前 request、stage、restate、artifacts、constraints、计划文件路径和用户 decision
  Gate: 用户拍板进入 Verify（这一步不勾，Build 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

Verify handoff 使用 `Skill(nocode:dev-verify)`。

调用时把上面**每一条** Task 建成稳定计划项，不得传空计划：

使用 `TaskCreate` 逐项创建三个编排里程碑并保存 task id；状态变化时使用 `TaskUpdate` 更新对应项。

每完成一个标 done。

### Step 1: 读 Execution 字段，分发执行

1. 读 Plan 文档 header 的 `Execution` 字段
2. Full 场景重新读取 Design，校验 `designRevision` / `designDigest`；把这两个字段注入每个执行与 review objective。任何时点发现变化都停止并回 Plan。
3. `Execution: subagent-lite` / `subagent-full`（旧值 `subagent` 按 `subagent-full` 处理）→ Read `references/dev-build-subagent.md`，先拓扑排序，再逐个 task 执行。**每次只派发当前一个 plan task**；不得一次把后续 task 全部派出。实现 objective 必须自足，至少包含完整 task 文本、实现纪律、允许修改的最小路径、验证命令和期望返回的证据。审查密度按档位分叉（lite：仅风险 task 派审查；full：per-task spec + checkpoint 批量 quality）。

   - 使用原生 `Agent` 派发当前 implementer，保存原生 agent 句柄，并用平台原生方式等待它进入终态。若需要追加上下文或修复要求，恢复同一 agent；若任务失控则取消它。平台无法提供独立 agent 时，由主会话执行并明确记录“未获得隔离执行”。

   - 只以 agent 的终态结果和实际 diff 为实现证据，不把“已派发”当作完成。
   - 需要 spec review 时，另派一个只读 reviewer，任务 id 使用 `<plan-task-id>-spec-review`；objective 必须显式包含完整计划要求、implementer 的终态结果、实际改动文件和返回格式 `{approved,issues[]}`。reviewer 与 implementer 必须是不同的隔离上下文；只有平台明确报告不同模型时才能称为跨模型审查。
   - `approved=false` 时，把 `issues[]` 明确放入 implementer 的修复 objective，等待修复终态后重新派发独立 reviewer。lite 风险 task 的 quality review 与 full checkpoint 批审也遵循同一原生 agent 生命周期。前一个 task 的应派 Spec/Quality Gate 全通过（或 lite 明确记录跳过）后，才派发下一 task。
4. `Execution: executing` → Read `references/dev-build-executing.md`，主 agent 自己顺序执行 plan 已写的代码，不派 subagent

无论执行协议是哪一种，每个 task 终态结果都必须显式包含：

- `completedDesignCovers`：实际完成且与 task `designCovers` 完全一致的 Design ID。
- `designRevision` / `designDigest`：必须与 Plan header 和当前 approved Design 完全一致。
- `changedFiles`：本 task 实际修改文件。
- `evidence`：本 task 测试命令与结果。

缺 ID、额外冒领 ID 或结果未带 `completedDesignCovers`，该 task 保持未完成。

### Step 2: 编排者验证（两种协议跑完后统一执行）

不管走的是哪条协议，Build 收尾前都要独立验证（不信执行方自报）：

1. **独立查 diff**：Read 改动的文件，确认 scope 未越界；按 Source Comment Contract 检查非平凡逻辑的 why-comment、过期注释和语法旁白，生成物只检查其单一源码 / 模板 / 编译器，不手改发布物
2. **独立跑测试**：跑完整测试套件，不只依赖执行方的测试输出
3. **spec 核对（抽查）**：`subagent-lite/full` 协议下抽查 1-2 个 task 的 spec reviewer 判断是否站得住（lite 档跳过审查的 task 优先抽）；`executing` 协议下抽查 1-2 个 task 的实现是否匹配 plan 声明的验收标准
4. **空壳扫描（确定性脚本，非 LLM 判断）**：用 grep/AST 模式匹配扫全量 diff——空函数体、placeholder 注释（`// TODO`、`// implement`）、`throw new Error('not implemented')`、只有类型签名没有逻辑的方法。lint + typecheck 通过不代表功能完整，空函数合法但无用。发现空壳 → 视为 task 未完成，重新处理
5. **Design 覆盖汇总**：先复核当前 Design 的 `designRevision` / `designDigest`，再以 Plan Coverage Matrix 中的 `required` Design ID 为左表，反查所有已完成 task 的 `completedDesignCovers`。基线变化、required ID 无完成结果、task 漏报或冒领都使 Build Gate 失败；基线变化回 Plan，其余点名 ID 修复。

### Step 3: 统一 Commit

编排者验证通过后，一次性 commit 覆盖本轮 Build 全部 task 改动——一条 message 概括整体功能，不按 task 拆分。

## 异常路径（编排者层面）

| 触发 | 处理 |
|---|---|
| task 卡住无法推进 | 收集 blocker 信息，提供更多 context 重新执行；或升级到更强 model；或回 Plan 拆分 |
| 多个 task 互相冲突 | 停手报告，可能需要回 Plan 调整依赖图 |

`subagent-lite/full` 协议内部的 spec/quality review 循环与分档判定见 `references/dev-build-subagent.md`。

## Exit Gate

- [ ] 所有 plan task 完成
- [ ] 编排者独立验证通过（diff + 测试 + spec 核对 + 空壳扫描）
- [ ] Full 场景所有 required Design ID 均由完成 task 的 `completedDesignCovers` 报告，零漏报/冒领
- [ ] Full 场景所有 task 结果与当前 Design / Plan 的 `designRevision` / `designDigest` 一致
- [ ] 零空壳：无空函数体、无 TODO/implement placeholder、无 `throw not implemented`
- [ ] 全部测试通过（整个相关套件，不只新写的）
- [ ] build 通过
- [ ] Source Comment Contract 已通过：必要理由未丢失、既有注释未过期、无为凑数量添加的语法旁白
- [ ] 统一 commit 已完成
- [ ] 后续 Verify 可开始
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Build 完成（含完成 task 数 + 测试通过状态 + build 状态 + 各 task 审查覆盖情况——spec/quality 已审或 lite 跳过，供 Review 阶段决定增量/全量），建议下一阶段：Verify（`nocode:dev-verify`）。列出 Verify 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

**"lint + typecheck 通过" ≠ 完成。** 空函数体、未填充的方法、placeholder 注释都能过 lint 和 typecheck。Exit Gate 必须独立确认每个 task 的功能已实现，不只是语法合法。

## 核心规则（when X → do Y）

- **When** bug 不稳定复现 → 目标不是干净 repro，是**更高复现率**。循环 100×、并行、加压、收窄时序。50% flake 可调试，1% 不可调——先拉高再 debug
- **When** task 涉及 UI 样式且存在设计基线（样张 / 原型截图 / 设计稿）→ 实现循环加入设计值对齐（Read `{QODER_PLUGIN_ROOT}/skills/references/frontend-guide.md`「设计基线对齐」节）：实现 → devtools 对比设计值 → 调整 → 复检，作为样式代码的红绿等价物；对齐记录留在 task 产出里供 Verify 抽查。无基线则跳过并标注

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "太简单不用测" | 简单改动写测试只要一分钟。"简单"的改动出回归才最隐蔽 |
| "先把代码写出来，测试后面补" | 后补的测试为已有代码背书，不是在驱动设计。删掉重来 |
| "我先验证下思路，测试稍后" | "稍后"= 永不。验证思路本身就该用测试表达 |
| "事后测试达到同样目的" | tests-after 回答"代码做什么"，tests-first 回答"代码应该做什么"。前者被实现带偏 |
| "这个改动简单，跳过某 Step 或不建 workflow.plan.create" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权 |

## Red Flags

- 有 task 卡住未处理就继续下一个
- 编排者没有独立跑测试就报完成
- commit message 是 "fix" / "update" / "wip"
- 执行方越界改了计划外文件
- 报"Build 完成"但留有空壳函数/未实现方法/TODO placeholder（lint+typecheck 通过 ≠ 功能完整）
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 workflow.plan.create、或漏掉最后的交接 task
