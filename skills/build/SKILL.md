---
name: build
description: Use when executing implementation tasks from a plan, writing new code, or implementing features. Use when devflow routes to Build stage, or when the user says "开始实现/写代码/执行计划/build it".
---

# build — 增量实现，slice 闭环

每个 task 走一个 **red-green** 循环闭环：失败测试(red) → 最小实现(green) → 重构 → commit。一次只推一个 slice，不积累未测代码。

> Leading word: **red-green**。没见过红就不知道绿是不是真的。

**头号反模式：horizontal slicing**——"先写所有 model，再写所有 service，再写所有 handler"。每层做完都不可验证，集成风险堆到最后才爆。用 tracer bullet 垂直切。

## Entry Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）
- [ ] 执行模式已选（subagent 并行 / 当前会话顺序）

## 领域指南（实现时按需 Read）

| 领域 | 何时 Read | 用来做什么 |
|---|---|---|
| `references/testing-guide.md` | 写测试时 | TDD 循环 / 替身选择 / DAMP 原则 |
| `references/security-guide.md` | 碰用户输入/认证/数据时 | 防注入写法 / 输入校验 / 密钥管理 |
| `references/performance-guide.md` | 碰数据库查询/前端渲染时 | N+1 / 缓存 / 懒加载模式 |
| `references/frontend-guide.md` | 碰 UI 组件时 | 组件模式 / 无障碍 / 设计系统 |
| `references/architecture-principles.md` | 拿不准模块边界时 | Deep Module / Seam / 依赖分类 |

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
- 只碰本 task 声明的文件。计划外发现用 **NOTICED BUT NOT TOUCHING** 模式：显式记录发现 + 位置 + 原因，问用户是否建 task。既防 scope creep 又不丢信息

### 5b. Test First (Iron Law)

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

1. **Red** — 写表达验收标准的测试，运行确认失败（失败原因是"功能没实现"不是"测试写错"）
2. **Green** — 写刚好够过绿的代码
3. **Refactor** — 行为不变降复杂度

已经写了产品代码再补测试？**删掉代码，从测试开始。** 没例外。
测试层级默认 unit，涉及外部依赖才升 integration，端到端才升 e2e。

**测试原则**：
- **DAMP over DRY**：测试代码宁可重复也要可读。DRY 的测试共享 setup 一改全断、出错时看不懂哪个在测什么
- **测试替身偏好序**：real > fake > stub > mock。能用真实对象就用，mock 是最后手段
- **测试行为不测交互**：assert 输出状态，不 assert 调用了哪个内部方法

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

## 核心规则（when X → do Y）

- **When** 你发现已经写了产品代码但还没有失败测试 → **删掉代码**，从测试开始。不是"保留代码补测试"——那是 tests-after，不是 TDD
- **When** 你想一口气推进多个 task → **STOP**，一次只推一个 slice。批量未测代码出问题时无法二分定位哪个 task 引入的
- **When** 你发现计划外的问题想顺手改 → **NOTICED BUT NOT TOUCHING**：记录位置+原因，问用户是否建 task。不碰
- **When** 你"记得"某个框架 API 的行为 → **不信记忆**。查官方文档标 `[Doc URL]`，或读本地源码标 `[Read path:line]`
- **When** 同一个测试修了 3 次还不过 → **进 Debug 横切**，先列 3-5 排序假设，不再盲改

## Red Flags

- 写了产品代码但没有对应的失败测试
- 一个 slice 改了 > 5 文件
- commit 前没跑 build / 回归测试
- commit message 是 "fix" / "update" / "wip"
