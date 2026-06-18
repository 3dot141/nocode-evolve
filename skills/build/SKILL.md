---
name: build
description: 按计划增量实现，每个 slice 闭环。Use when executing implementation tasks from a plan, writing new code, or implementing features. Use when devflow routes to Build stage, or when the user says "开始实现/写代码/执行计划/build it". Enforces test-first discipline and incremental delivery — no large batches of untested code.
---

# nocode-evolve:build — 增量实现，slice 闭环

> 双底子拼接：superpowers TDD（test-first 硬约束）+ incremental-implementation（slice 循环外壳）。
> 产出：计划中每个 task 都以「失败测试 → 最小实现 → 绿 → commit」的闭环交付。

## 核心：slice 循环

Build 的骨架是一个循环——逐个 task 推进，每个 task 是一个完整 slice，全程不积累未测代码：

```
for each task in plan:
  5a. Scope Lock      取一个 task，锁定范围 + 来源核对
  5b. Test First      Iron Law：先写失败测试
  5c. Implement + Green  最小代码过绿 + 重构
  5d. Verify & Commit   测试/构建/无回归 + 描述性 commit
  → 回到 5a（取下一个 task）
```

一次只推进一个 task。不要把多个 task 的代码一口气写完再回头补测试——那正是本 skill 要消灭的反模式。

---

### 5a. Scope Lock

锁定本 slice 的边界，**实现前**完成来源核对。

- **取 task**：从计划取一个 task，确认它 ≤ 5 个文件、且带可检验的验收标准。超过 → 计划粒度太粗，回 Plan 拆分。
- **Source check**（source-driven）：实现前 Read 所有涉及的代码/文档，每个判断标注来源：
  - `[Read path:line]` — 直接读到的事实
  - `[Doc URL]` — 官方文档确认
  - `[推断]` — 没有直接依据的推断（必须显式标，不许伪装成事实）
- **框架代码查官方文档**：用到框架/库 API，先查官方文档确认签名与行为。文档不可达 → 标 `UNVERIFIED` + 退回本地源码（node_modules / 已安装包）确认，明说"离线降级"。详见 `references/source-driven-guide.md`。
- **Simplicity check**：最简实现，不超前设计。不为"将来可能需要"加抽象。
- **Scope Discipline**：只碰本 task 声明的文件。发现计划外问题 → 记下来，不顺手改。
- **UI 变更**：本 task 含 UI/前端改动 → 参考 `references/frontend-guide.md`（组件架构 / 无障碍 / 设计系统 / 响应式）。

完成 Scope Lock 后，你应能用一句话说出：本 slice 改哪几个文件、验收标准是什么、依据是什么。

### 5b. Test First（Iron Law）

> **THE IRON LAW: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

- 已经写了产品代码、再回头补测试？**删掉代码，从测试开始。** 没有例外。
- **Red-Green-Refactor**：
  1. **Red** — 写一个表达验收标准的测试，运行它，**确认它失败**（看到红，确认失败原因是"功能没实现"而非"测试写错了"）。
  2. **Green** — 写**刚好够**让这个测试通过的代码（5c）。
  3. **Refactor** — 行为不变前提下降复杂度（5c）。
- **没看到红就不算**：测试必须先失败过。一上来就绿的测试要么没测到东西，要么功能已存在——两种都说明这个测试无效。
- **测试层级**：默认 **unit**。只有涉及外部依赖（DB / 网络 / 文件系统 / 跨进程）才升级到 integration，端到端流程才升 e2e。层级选择见 `references/test-pyramid-guide.md`。

### 5c. Implement + Green

- 写**最少代码**让 5b 的失败测试变绿。不多写一行未被测试覆盖的逻辑。
- **Refactor**：绿之后，在测试保护下重构——行为不变，降低复杂度、消除重复、改善命名。重构后重跑测试确认仍绿。
- **Feature flags**：功能未完成 / 跨多个 slice → 用 feature flag 包裹，让半成品不影响主路径。
- **Safe defaults**：新功能默认**关闭**。开关由后续 slice 或显式配置打开，不默认开启未验证的路径。

### 5d. Verify & Commit

- **三连验证**：本 task 的测试 pass + build pass + 无回归（跑相关测试套件，确认没弄坏别的）。
- 三项没全绿 **不许 commit**。证据先行：先看到通过输出，再下结论。
- **描述性 commit**：message 说清 **what + why**（做了什么 + 为什么），不是"fix"/"update"这种空话。
- commit 后回到 5a 取下一个 task。

---

## 异常路径

| 触发 | 横切处理 |
|---|---|
| 同一个测试**修 3 次仍失败** | 触发 Debug 横切，参考 `../../references/debug-protocol.md`，系统化定位根因，别再盲改 |
| 卡住 / 对方向不确定 / 反复试错 | Doubt-Driven 横切：停下，写出你的不确定点 + 假设，找用户或文档确认，别硬编 |

横切处理完回到当前 slice 的对应步骤继续，不跳过 5b 的 Iron Law。

## 子调用规范

| 子调用 | 方式 | 降级 |
|---|---|---|
| TDD | `Skill(superpowers:test-driven-development)` | skill 不可用 → 内联 5b 的 Iron Law 核心（Red-Green-Refactor + 先失败） |
| Subagent 并行实现 | `Skill(superpowers:subagent-driven-development)` | skill 不可用 → 串行执行各 task，逐个走 slice 循环 |

调用子 skill 时明说降级与否，不要静默退化。

## Gate

进入下一阶段（Verify）前必须满足：

- [ ] 计划中**所有 task 完成**
- [ ] **全部测试通过**（不只是新写的，整个相关套件）
- [ ] **build 通过**

任一不满足 → 留在 Build，不许向用户宣称"实现完成"。

## Common Rationalizations

| 借口 | 反驳 |
|---|---|
| "这个改动太简单，不值得写测试" | 简单改动写测试只要一分钟。"简单"的改动出回归才最隐蔽 |
| "先把代码写出来，测试后面补" | 后补的测试是在为已有代码背书，不是在驱动设计。删掉代码，从测试开始 |
| "我先验证下思路，测试稍后" | "稍后"=永不。验证思路本身就该用测试表达 |
| "测试很难写，说明可以先跳过" | 测试难写正是设计有问题的信号，不是跳过的理由——是改设计的理由 |
| "一次多做几个 task 更快" | 批量积累的未测代码出问题时无法二分定位。一次一 slice 才能快速回滚 |
| "顺手把旁边这个也改了" | 计划外改动绕过了 Scope Lock 和验收标准。记下来，单独走 slice |
| "框架行为我记得是这样" | 记忆不是来源。查官方文档或读本地源码，标 `[Doc URL]` / `[Read path:line]` |
| "测试绿了，不用看是不是真失败过" | 没见过红的测试可能根本没测到东西。Red 是 Green 的前提 |
| "build 还没跑，但代码看着没问题" | "看着没问题"不是证据。三连验证全绿才能 commit |

## Red Flags

- 写了产品代码，还没有对应的失败测试存在
- 测试一上来就绿（没经历 Red 阶段）
- 一个 slice 改了 > 5 个文件 / 跨了多个无关 task
- 实现中用到框架 API 但没查文档、没标来源
- 把 `[推断]` 当成事实陈述，不加标注
- commit 前没跑 build / 没跑回归测试
- 同一个测试反复改 3 次以上还在硬调，没进 Debug 横切
- 新功能默认开启（没有 safe default / feature flag）
- commit message 是 "fix" / "update" / "wip" 这类无信息量文案
- 顺手改了计划外的代码

## Verification Checklist

- [ ] 每个 task 都走完整 slice 循环（5a→5d），没有跳过 5b
- [ ] 所有产品代码都有先于它存在的失败测试
- [ ] 每个测试都经历过 Red（确认失败）再 Green
- [ ] 实现涉及的框架 API 都有来源标注（`[Doc URL]` / `[Read path:line]` / `[推断]`）
- [ ] 每个 slice 改动 ≤ 5 文件、不碰计划外代码
- [ ] 每次 commit 前三连验证（test + build + 无回归）全绿
- [ ] commit message 含 what + why
- [ ] Gate 满足：所有 task 完成 + 全部测试通过 + build 通过
