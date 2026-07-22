---
name: dev-build
description: "Use to implement confirmed tasks, resume coding, or enter devflow Build."
---

# build — 读 plan 执行方式，走对应协议

Build 是编排入口：读 Plan 阶段用户选定的 `Execution` 字段，走对应的执行协议——`subagent-lite`（顺序派发 implementer，仅风险 task 派审查）、`subagent-full`（per-task spec review + checkpoint 批量 quality review）或 `executing`（主 agent 自己顺序执行 plan 已写代码）。Build skill 本身只负责 devflow 阶段编排（Enter/Exit Gate、里程碑、硬交接），具体执行细节在对应 reference 文件里。

## 非本 skill 请求

解释代码 / 知识问答 → 直接回答不进 Build。无计划无目标（"帮我做个东西"）→ 回 Define。"整个项目重构" → scope 过大回 Plan 拆。

## Enter Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Plan 已标注 `Execution` 字段（`subagent-lite` / `subagent-full` / `executing`；旧计划的 `subagent` 按 `subagent-full` 处理）
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）

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
  Sub-steps: 按 Exit Gate 硬交接报告 Build 完成（完成 task 数 + 测试 + build 状态）→ 建议进 Verify → 等用户拍板后调 Capability(workflow.skill.invoke, {"skill":"dev-verify","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})
  Gate: 用户拍板进入 Verify（这一步不勾，Build 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

调用时把上面**每一条** Task 编译成一个稳定 item：`id` 固定、`subject` 为标题、`description` 完整包含 Sub-steps + Gate、初始 `status=pending`，仅最后一项设置 `handoff`。不得只改名后继续依赖平台 task 工具，也不得传空 items：

`Capability(workflow.plan.create, {"items":[{"id":"<stable-task-id>","subject":"<task-title>","description":"<complete Sub-steps and Gate>","status":"pending","handoff":"<final-item-only; otherwise omit>"}]})`

示例只展示单项形状；真实调用必须包含本段清单的全部 items。保存返回的 `planRef`。每次状态变化都用 `Capability(workflow.plan.update, {"planRef":"<planRef>","items":[{"id":"<same-stable-id>","subject":"<same-title>","description":"<same-complete-description>","status":"<pending|in_progress|completed>","handoff":"<preserve-final-item-handoff; otherwise omit>"}]})` 提交**完整快照**（示例仍只展示单项形状）；每次 update 必须原样保留最终 item 的 `handoff`，其它 item 继续省略该字段，不得发送单项 patch。

每完成一个标 done。

### Step 1: 读 Execution 字段，分发执行

1. 读 Plan 文档 header 的 `Execution` 字段
2. `Execution: subagent-lite` / `subagent-full`（旧值 `subagent` 按 `subagent-full` 处理）→ Read `references/dev-build-subagent.md`，先拓扑排序，再逐个 task 执行。每次 graph 只含当前一个 plan task：`Capability(workflow.execute, {"tasks":[{"id":"<plan-task-id>","objective":"<完整 task 文本 + 实现纪律 + 验证命令>","profile":"implementation.general","dependsOn":[],"writeScope":"<该 task 允许修改的最小路径>","timeoutMs":600000,"continueOnError":false}],"maxParallel":1,"fallbackPolicy":"inline"})`。顺序由编排者和 review Gate 控制，不得把所有 plan task 放进同一 graph 让 scheduler 自动续派；所有 objective/写范围必须自足，不能传空数组。审查密度按档位分叉（lite：仅风险 task 派审查；full：per-task spec + checkpoint 批量 quality）
   - 保存 `executionId`；当 `status=running` 时反复执行 `Capability(workflow.wait, {"executionId":"<execution-id>","timeoutMs":600000})` 直到终态，再执行 `Capability(workflow.collect, {"executionId":"<execution-id>"})` 从 `tasks[0].result` 取得当前 task 的终态结果；不得用初始 execute 回执代替实现结果
   - 需要 spec review 时，另建单 task graph：`Capability(workflow.execute, {"tasks":[{"id":"<plan-task-id>-spec-review","objective":"独立核对当前 task 是否满足计划要求；计划要求：<complete-task-requirements>；实现结果：<collected-implementation-result>；diff 范围：<changed-files>；返回 {approved,issues[]}","profile":"review.spec","dependsOn":[],"writeScope":"none","timeoutMs":600000,"continueOnError":false}],"maxParallel":1,"fallbackPolicy":"inline"})`，同样 wait→collect 并从 `tasks[0].result` 读取 verdict
   - `approved=false` 时，把 `issues[]` 明确嵌入新的单 task 修复 objective，execute→wait→collect 后重新执行同一 review；lite 风险 task 的 quality review 与 full checkpoint 批审也使用独立 graph。前一个 task 的应派 Spec/Quality Gate 全通过（或 lite 明确记录跳过）后，才创建下一 task 的 execution
3. `Execution: executing` → Read `references/dev-build-executing.md`，主 agent 自己顺序执行 plan 已写的代码，不派 subagent

### Step 2: 编排者验证（两种协议跑完后统一执行）

不管走的是哪条协议，Build 收尾前都要独立验证（不信执行方自报）：

1. **独立查 diff**：Read 改动的文件，确认 scope 未越界
2. **独立跑测试**：跑完整测试套件，不只依赖执行方的测试输出
3. **spec 核对（抽查）**：`subagent-lite/full` 协议下抽查 1-2 个 task 的 spec reviewer 判断是否站得住（lite 档跳过审查的 task 优先抽）；`executing` 协议下抽查 1-2 个 task 的实现是否匹配 plan 声明的验收标准
4. **空壳扫描（确定性脚本，非 LLM 判断）**：用 grep/AST 模式匹配扫全量 diff——空函数体、placeholder 注释（`// TODO`、`// implement`）、`throw new Error('not implemented')`、只有类型签名没有逻辑的方法。lint + typecheck 通过不代表功能完整，空函数合法但无用。发现空壳 → 视为 task 未完成，重新处理

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
- [ ] 零空壳：无空函数体、无 TODO/implement placeholder、无 `throw not implemented`
- [ ] 全部测试通过（整个相关套件，不只新写的）
- [ ] build 通过
- [ ] 统一 commit 已完成
- [ ] 后续 Verify 可开始
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Build 完成（含完成 task 数 + 测试通过状态 + build 状态 + 各 task 审查覆盖情况——spec/quality 已审或 lite 跳过，供 Review 阶段决定增量/全量），建议下一阶段：Verify（`nocode:dev-verify`）。列出 Verify 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

**"lint + typecheck 通过" ≠ 完成。** 空函数体、未填充的方法、placeholder 注释都能过 lint 和 typecheck。Exit Gate 必须独立确认每个 task 的功能已实现，不只是语法合法。

## 核心规则（when X → do Y）

- **When** bug 不稳定复现 → 目标不是干净 repro，是**更高复现率**。循环 100×、并行、加压、收窄时序。50% flake 可调试，1% 不可调——先拉高再 debug
- **When** task 涉及 UI 样式且存在设计基线（样张 / 原型截图 / 设计稿）→ 实现循环加入设计值对齐（Read `${PLUGIN_ROOT}/skills/references/frontend-guide.md`「设计基线对齐」节）：实现 → devtools 对比设计值 → 调整 → 复检，作为样式代码的红绿等价物；对齐记录留在 task 产出里供 Verify 抽查。无基线则跳过并标注

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
