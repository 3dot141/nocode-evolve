---
name: dev-build
description: Use when executing implementation tasks from a plan, writing new code, or implementing features. Use when devflow routes to Build stage, or when the user says "开始实现/写代码/执行计划/build it/动手/实现这个功能/把X加上/继续写/implement". Also use when resuming implementation work after a break or switching back from debugging.
---

# build — 增量实现，slice 闭环

**Iron Law: 没有失败测试就没有产品代码。先写了代码？删掉，从测试开始。**

每个 task 走一个 **red-green** 循环闭环：失败测试(red) → 最小实现(green) → 重构 → commit。一次只推一个 slice，不积累未测代码。

> Leading word: **red-green**。没见过红就不知道绿是不是真的。

**头号反模式：horizontal slicing**——"先写所有 model，再写所有 service，再写所有 handler"。每层做完都不可验证，集成风险堆到最后才爆。同理"先写所有测试再写所有实现"也是 horizontal——批量写的测试测的是想象行为不是真实行为，会测 shape 不测 user-facing behavior。用 tracer bullet 垂直切：一个 slice = 一个失败测试 + 它的最小实现 + commit。

## 非本 skill 请求

解释代码 / 知识问答 → 直接回答不进 Build。无计划无目标（"帮我做个东西"）→ 回 Define。"整个项目重构" → scope 过大回 Plan 拆。

## Entry Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）
- [ ] 执行模式已选（subagent 并行 / 当前会话顺序）

## 领域指南（实现时按需 Read）

| 领域 | 何时 Read | 用来做什么 |
|---|---|---|
| `{NOCODE_SKILL_REF}/testing-guide.md` | 写测试时 | TDD 循环 / 替身选择 / DAMP 原则 |
| `{NOCODE_SKILL_REF}/security-guide.md` | 碰用户输入/认证/数据时 | 防注入写法 / 输入校验 / 密钥管理 |
| `{NOCODE_SKILL_REF}/performance-guide.md` | 碰数据库查询/前端渲染时 | N+1 / 缓存 / 懒加载模式 |
| `{NOCODE_SKILL_REF}/frontend-guide.md` | 碰 UI 组件时 | 组件模式 / 无障碍 / 设计系统 |
| `{NOCODE_SKILL_REF}/ui-taste-skills.md` | 实现 UI 视觉层时 | 按设计文档推荐（或 plan task 的 `[taste-skill: ...]` 标注）`Skill()` 加载对应 taste skill，按其规范写具体视觉代码 |
| `{NOCODE_SKILL_REF}/architecture-principles.md` | 拿不准模块边界时 | Deep Module / Seam / 依赖分类 |

**技术栈配方**：当项目技术栈命中以下场景时，Read 对应 reference 拿可粘贴代码样例：

| 场景 | 触发特征 | Read |
|---|---|---|
| TS/JS 测试 | package.json 含 jest/vitest/@playwright | `references/ts-test-patterns.md` |
| Go 开发 | 有 go.mod | `references/go-patterns.md`（惯用法/测试/审查/构建排错） |
| TS 构建排错 | tsconfig.json 且 tsc/build 失败 | `references/ts-build-fix.md` |

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

> 端到端示例（一个完整 slice：5a Scope Lock → 5b 失败测试 → 5c 实现 → 5d commit）见 `references/examples/example-build-slice.md`

### 5a. Scope Lock

- 取 task，确认 ≤ 5 文件 + 验收标准。超过 → 回 Plan 拆
- **HITL task**：停下等用户决策再继续。**AFK task**：连续推进
- **Source check**：Read 所有涉及代码/文档，标注 `[Read path:line]` / `[Doc URL]` / `[推断]`
- 框架 API 查官方文档确认。文档不可达 → 标 `UNVERIFIED` + 退回本地源码
- 只碰本 task 声明的文件。计划外发现用 **NOTICED BUT NOT TOUCHING** 模式：显式记录发现 + 位置 + 原因，问用户是否建 task。具体：不顺手清理相邻代码、不重构只读文件的 import、不删不懂的注释、不加 spec 外"看起来有用"的功能、不现代化只读文件语法

### 5b. Test First (Iron Law)

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

1. **Red** — 写表达验收标准的测试，运行确认失败（失败原因是"功能没实现"不是"测试写错"）。即使在询问验收标准阶段，也先示范测试签名让用户看到你理解了需求
2. **Green** — 写刚好够过绿的代码
3. **Refactor** — 行为不变降复杂度

已经写了产品代码再补测试？**删掉代码，从测试开始。** 没例外。不是"留着参考"——直接删，重新从测试出发。

**回归测试有效性验证**：写完回归测试后走一遍完整红绿循环证明它真能抓 bug——写 → 跑(过) → 还原 fix → 跑(必须红) → 恢复 → 跑(过)。"写了个回归测试"不算，亲眼看它在没有 fix 时失败才算。

**学派选择（outside-in vs inside-out）**：默认 **outside-in**——先写切片最外层的失败测试，下层用 fake 顶住，逐层向内替换真实现。这和 Plan 的 tracer bullet 同向（从外切到里）。当切片核心是纯领域逻辑（算法/状态机/计算）时切回 **inside-out**（先把 domain 写对再包外层）。按切片形状选，不是信仰。

测试层级、DAMP/DRY、替身偏好序（real > fake > stub > mock）、测行为不测交互 → 见 `{NOCODE_SKILL_REF}/testing-guide.md` + `references/test-pyramid-guide.md`，不在此重述。

**测试难写 = 设计难**（build 独有的设计反馈）：不知怎么测 → 先写期望 API / 先写断言；测试太复杂 → 设计太复杂，简化接口；必须 mock 一切 → 耦合太重，用依赖注入；setup 巨大 → 抽 helper 或简化设计

### 5c. Implement + Green

最少代码让测试变绿。不多写一行未被测试覆盖的逻辑。
Feature flags 包裹未完成功能。新功能默认关闭。

### 5d. Verify & Commit

test pass + build pass + 无回归，三项没全绿不许 commit。
commit message 说清 what + why。
**同一命令成功后不重复跑**——成功跑过的验证命令在代码未变前不要再跑，只在后续编辑后重跑。重复跑无信息增量。

## 异常路径

| 触发 | 处理 |
|---|---|
| 同一测试修 3 次仍失败 | Debug 横切（见 `../../references/debug-protocol.md`）。**第一步不是列假设，是建 tight 反馈回路**：一条已跑过、能因此 bug 变红、确定性、秒级的命令。没有这条命令，禁止进假设阶段——读代码猜根因正是这个纪律要防的 |
| 卡住/方向不确定 | Doubt-Driven：停下写出不确定点+假设，找用户或文档确认。上下文冲突（spec 说 X 但代码是 Y）→ 不静默选一个，显式列选项让用户拍板 |
| 实现偏离计划 | **偏差分级处置**（见下） |

### 偏差分级处置

slice 执行中发现实现路径和计划不完全对得上——不是所有偏差都要回 Plan：

| 偏差程度 | 信号 | 处置 |
|---|---|---|
| **小** — 路径不同但目标不变 | 换了个等价 API / 文件内位置微调 / 顺序略不同 | 记录偏差理由（commit message 或 NOTICED），继续 |
| **中** — task scope 需调整 | 发现要多改 1-2 个文件 / 验收标准要补一条 | 暂停，在当前 task 补 scope 说明，不回 Plan。如果超出 ≤5 文件 → 升级为大偏差 |
| **大** — 设计假设错误 | 依赖的接口不存在 / 架构方向不可行 / 核心数据结构需重新定义 | 停手，走回流路径 Build → Design → Plan |

不要硬做也不要轻易回退——大多数偏差是小偏差，记下就好。

### Subagent 产出验证

用 subagent 并行执行 task 时，不信 subagent 自报的"完成"：

1. **独立查 diff**：Read subagent 改动的文件，确认 scope 未越界
2. **独立跑测试**：在主 agent 跑完整测试套件，不只依赖 subagent 的测试输出
3. **spec 核对**：subagent 交付的 vs task 验收标准逐条核对

这是 superpowers 两段评审（spec → quality）的轻量版——先看"做的对不对"再看"做的好不好"。

## Exit Gate

- [ ] 所有 plan task 完成
- [ ] 全部测试通过（整个相关套件，不只新写的）
- [ ] build 通过
- [ ] 后续 Verify 可开始

## 核心规则（when X → do Y）

- **When** bug 不稳定复现 → 目标不是干净 repro，是**更高复现率**。循环 100×、并行、加压、收窄时序。50% flake 可调试，1% 不可调——先拉高再 debug

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "太简单不用测" | 简单改动写测试只要一分钟。"简单"的改动出回归才最隐蔽 |
| "先把代码写出来，测试后面补" | 后补的测试为已有代码背书，不是在驱动设计。删掉重来 |
| "我先验证下思路，测试稍后" | "稍后"= 永不。验证思路本身就该用测试表达 |
| "事后测试达到同样目的" | tests-after 回答"代码做什么"，tests-first 回答"代码应该做什么"。前者被实现带偏 |
| "一次多做几个 task 更快" | 批量的速度是假的——出问题时无法二分定位 |

## Red Flags

- 写了产品代码但没有对应的失败测试
- 一个 slice 改了 > 5 文件
- commit 前没跑 build / 回归测试
- commit message 是 "fix" / "update" / "wip"
- 顺手改了计划外代码（NOTICED BUT NOT TOUCHING 缺失）
- 测试一上来就绿（没经历 Red 阶段）
- 框架 API 引用没有来源标注
