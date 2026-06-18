---
name: build
description: 按计划增量实现，每个 slice 闭环。Use when executing implementation tasks from a plan, writing new code, or implementing features. Use when devflow routes to Build stage, or when the user says "开始实现/写代码/执行计划/build it". Enforces test-first discipline and incremental delivery — no large batches of untested code.
---

# build — 增量实现，slice 闭环

双底子：superpowers TDD（test-first 硬约束）+ incremental-implementation（slice 循环外壳）。每个 task 以「失败测试 → 最小实现 → 绿 → commit」闭环交付。

## Entry Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）
- [ ] 执行模式已选（subagent 并行 / 当前会话顺序）

## Checklist (TaskCreate)

1. **加载计划** — 读 Plan 任务序列 + Design 测试目标
2. **逐 task 执行 slice** — 每个 plan task 走 5a→5d 闭环，完成后标 completed
3. **Gate 检查** — 所有 task 完成 + 全部测试通过 + build 通过

## 核心：slice 循环

一次推进一个 task，不积累未测代码：

```
for each task in plan:
  5a. Scope Lock     锁范围 + 来源核对 + HITL 停 / AFK 继续
  5b. Test First     Iron Law: 先写失败测试
  5c. Implement      最小代码过绿 + 重构
  5d. Verify & Commit  test+build+无回归 → 描述性 commit
```

### 5a. Scope Lock

- 取 task，确认 ≤ 5 文件 + 验收标准。超过 → 回 Plan 拆
- **HITL task**：停下等用户决策再继续。**AFK task**：连续推进
- **Source check**：Read 所有涉及代码/文档，标注 `[Read path:line]` / `[Doc URL]` / `[推断]`
- 框架 API 查官方文档确认。文档不可达 → 标 `UNVERIFIED` + 退回本地源码
- 只碰本 task 声明的文件。计划外问题记下来，不顺手改

### 5b. Test First (Iron Law)

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

1. **Red** — 写表达验收标准的测试，运行确认失败（失败原因是"功能没实现"不是"测试写错"）
2. **Green** — 写刚好够过绿的代码
3. **Refactor** — 行为不变降复杂度

已经写了产品代码再补测试？**删掉代码，从测试开始。** 没例外。
测试层级默认 unit，涉及外部依赖才升 integration，端到端才升 e2e。

### 5c. Implement + Green

最少代码让测试变绿。不多写一行未被测试覆盖的逻辑。
Feature flags 包裹未完成功能。新功能默认关闭。

### 5d. Verify & Commit

test pass + build pass + 无回归，三项没全绿不许 commit。
commit message 说清 what + why。

## 异常路径

| 触发 | 处理 |
|---|---|
| 同一测试修 3 次仍失败 | Debug 横切：先列 3-5 排序假设再逐个验证（见 `references/debug-protocol.md`） |
| 卡住/方向不确定 | Doubt-Driven：停下写出不确定点+假设，找用户或文档确认 |

## Exit Gate

- [ ] 所有 plan task 完成
- [ ] 全部测试通过（整个相关套件，不只新写的）
- [ ] build 通过
- [ ] 后续 Verify 可开始

## 核心反模式

| 反模式 | 正确做法 |
|---|---|
| 先写代码后补测试 | 删掉代码，从测试开始 |
| 一次多做几个 task | 批量未测代码无法二分定位 |
| 顺手改计划外代码 | 记下来，单独走 slice |
| "框架行为我记得是这样" | 查文档标来源，记忆不是来源 |
| 三次失败还在盲改 | Debug 横切：列假设再验证 |

## Red Flags

- 写了产品代码但没有对应的失败测试
- 一个 slice 改了 > 5 文件
- commit 前没跑 build / 回归测试
- commit message 是 "fix" / "update" / "wip"
