---
name: dev-build
description: Use when executing implementation tasks from a plan, writing new code, or implementing features. Use when devflow routes to Build stage, or when the user says "开始实现/写代码/执行计划/build it/动手/实现这个功能/把X加上/继续写/implement". Also use when resuming implementation work after a break or switching back from debugging. Not for explaining code or answering questions directly, tasks with no plan or goal (use dev-define), or scope too large like whole-project refactors (use dev-plan to break down).
---

# build — 读 plan 执行方式，走对应协议

Build 是编排入口：读 Plan 阶段用户选定的 `Execution` 字段，走对应的执行协议——`subagent`（顺序派发独立 subagent，per-task 三阶段验证）或 `executing`（主 agent 自己顺序执行 plan 已写代码）。Build skill 本身只负责 devflow 阶段编排（Enter/Exit Gate、里程碑、硬交接），具体执行细节在对应 reference 文件里。

## 非本 skill 请求

解释代码 / 知识问答 → 直接回答不进 Build。无计划无目标（"帮我做个东西"）→ 回 Define。"整个项目重构" → scope 过大回 Plan 拆。

## Enter Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Plan 已标注 `Execution` 字段（`subagent` / `executing`）
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）

## 协议

### Step 0: 建编排里程碑

**进入后立即 TaskCreate**，建 3 个编排里程碑（**不镜像 plan 的每个 task**——per-task 由对应 reference 协议内部循环处理，镜像出来会和这些内部循环打架、谎报进度；这里只跟踪编排者自己的 3 步）：

```
Task 1: 读 Execution 字段，按对应协议执行
  Sub-steps: 读 plan header 的 Execution 字段 → Read 对应 reference 文件 → 按其协议逐 task 执行完
  Gate: 所有 task 按对应协议跑完，拿到每个 task 的结果

Task 2: 编排者验证
  Sub-steps: 独立查 diff + 独立跑测试 + spec 抽查 + 空壳扫描
  Gate: 全部 task 通过编排者独立验证（不信执行方自报）

Task 3: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Build 完成（完成 task 数 + 测试 + build 状态）→ 建议进 Verify → 等用户拍板后调 Skill(nocode:dev-verify)
  Gate: 用户拍板进入 Verify（这一步不勾，Build 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: 读 Execution 字段，分发执行

1. 读 Plan 文档 header 的 `Execution` 字段
2. `Execution: subagent` → Read `references/dev-build-subagent.md`，按其协议主 agent 用 `Agent()` 逐个 task 顺序派发独立 subagent
3. `Execution: executing` → Read `references/dev-build-executing.md`，主 agent 自己顺序执行 plan 已写的代码，不派 subagent

### Step 2: 编排者验证（两种协议跑完后统一执行）

不管走的是哪条协议，Build 收尾前都要独立验证（不信执行方自报）：

1. **独立查 diff**：Read 改动的文件，确认 scope 未越界
2. **独立跑测试**：跑完整测试套件，不只依赖执行方的测试输出
3. **spec 核对（抽查）**：`subagent` 协议下抽查 1-2 个 task 的 spec reviewer 判断是否站得住；`executing` 协议下抽查 1-2 个 task 的实现是否匹配 plan 声明的验收标准
4. **空壳扫描（确定性脚本，非 LLM 判断）**：用 grep/AST 模式匹配扫全量 diff——空函数体、placeholder 注释（`// TODO`、`// implement`）、`throw new Error('not implemented')`、只有类型签名没有逻辑的方法。lint + typecheck 通过不代表功能完整，空函数合法但无用。发现空壳 → 视为 task 未完成，重新处理

### Step 3: 统一 Commit

编排者验证通过后，一次性 commit 覆盖本轮 Build 全部 task 改动——一条 message 概括整体功能，不按 task 拆分。

## 异常路径（编排者层面）

| 触发 | 处理 |
|---|---|
| task 卡住无法推进 | 收集 blocker 信息，提供更多 context 重新执行；或升级到更强 model；或回 Plan 拆分 |
| 多个 task 互相冲突 | 停手报告，可能需要回 Plan 调整依赖图 |

`subagent` 协议内部的 spec/quality review 循环见 `references/dev-build-subagent.md`。

## Exit Gate

- [ ] 所有 plan task 完成
- [ ] 编排者独立验证通过（diff + 测试 + spec 核对 + 空壳扫描）
- [ ] 零空壳：无空函数体、无 TODO/implement placeholder、无 `throw not implemented`
- [ ] 全部测试通过（整个相关套件，不只新写的）
- [ ] build 通过
- [ ] 统一 commit 已完成
- [ ] 后续 Verify 可开始
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Build 完成（含完成 task 数 + 测试通过状态 + build 状态），建议下一阶段：Verify（`nocode:dev-verify`）。列出 Verify 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

**"lint + typecheck 通过" ≠ 完成。** 空函数体、未填充的方法、placeholder 注释都能过 lint 和 typecheck。Exit Gate 必须独立确认每个 task 的功能已实现，不只是语法合法。

## 核心规则（when X → do Y）

- **When** bug 不稳定复现 → 目标不是干净 repro，是**更高复现率**。循环 100×、并行、加压、收窄时序。50% flake 可调试，1% 不可调——先拉高再 debug

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "太简单不用测" | 简单改动写测试只要一分钟。"简单"的改动出回归才最隐蔽 |
| "先把代码写出来，测试后面补" | 后补的测试为已有代码背书，不是在驱动设计。删掉重来 |
| "我先验证下思路，测试稍后" | "稍后"= 永不。验证思路本身就该用测试表达 |
| "事后测试达到同样目的" | tests-after 回答"代码做什么"，tests-first 回答"代码应该做什么"。前者被实现带偏 |
| "这个改动简单，跳过某 Step 或不建 TaskCreate" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权（详见 agent-catalog-using.md「进了 skill 就走完」） |

## Red Flags

- 有 task 卡住未处理就继续下一个
- 编排者没有独立跑测试就报完成
- commit message 是 "fix" / "update" / "wip"
- 执行方越界改了计划外文件
- 报"Build 完成"但留有空壳函数/未实现方法/TODO placeholder（lint+typecheck 通过 ≠ 功能完整）
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
