# dev-plan

devflow 第 4 阶段——把目标拆成 tracer bullet 任务序列，Round 1 定骨架、Round 2 填真实代码，两轮 red-blue-deep 对抗审视。

## 在 devflow 中的位置

```
... Design → dev-plan → Build ...
              ↑ 你在这里
```

## 设计决策：Round 2 审查从整段 heavy red-blue 降为 checklist + 窄化 red-blue

`260701` 的 devflow 多层 review 收敛审查中调整。

**原来的设计**：Round 2 填充真实代码后，整段调 `Skill(nocode-evolve:red-blue-deep)` 走 heavy 档（sequential-thinking 强制 gate + subagent + codex 并行），评估"代码能不能跑通、测试覆盖够不够、执行顺序对不对"。

**为什么改**：
1. **方法用错了**——`{NOCODE_SKILL_REF}/reviewing/methods/red-blue-adversarial.md` 自己声明"不适合：逐项缺陷核查、固定维度遍历"，但"API 签名对不对/测试覆盖够不够"正是这类逐项核查题。`{NOCODE_SKILL_REF}/reviewing/skeleton.md` §3 方法选择表里代码类对象该走的组合是 `checklist + red-blue-adversarial`，不是单独 red-blue。
2. **审查对象寿命短**——这份代码从未真正运行过（Round 2 只要求手写，不要求执行测试命令），到 Build 阶段 implementer 还要重新走一遍完整 TDD（RED 步骤一跑，API 签名错、import 路径错立刻暴露）。花全流程最贵的资源组合（heavy 档 + codex 并行）审一份注定被重新验证、且方法论不对口的草稿，投入产出比低。

**现在怎么办**：Step 8a 拆成两步——checklist 逐项核查代码能不能跑（不派 codex，成本低）+ 窄化后的 red-blue 只审跨 task 一致性/执行顺序这类真正的决策题（这部分本来就是 red-blue-adversarial 擅长的）。省下的 codex 配额移给 Review 阶段审最终会交付的 diff。

Round 1（骨架审视：切片策略/依赖图/任务粒度）不受影响，仍走完整 heavy 档——这是唯一的 pre-code 决策关卡，一旦 Build 逐个扇出 subagent 执行，事后没有"再拦一道"的机会，值得砸最贵资源。

## 设计决策：task 骨架加 Review Tier 字段（已废弃，见下方新决策）

见 `dev-build/README.md`「per-task review 加轻档出口」——dev-plan 负责在 task 骨架阶段打上 `light`/`heavy` 标签，Build 阶段消费这个标签决定怎么审。这条决策在下方「Review Tier 字段移除」被反转。

## 设计决策：Review Tier 字段移除，Execution 字段恢复，Round 2 引入领域指南消费

`260701` dev-build 拆分为 subagent/executing 两种执行协议后调整。

**原来的设计**：Plan 给每个 task 标 Review Tier（light/heavy），Build 按 tier 分流审查粒度；Execution 字段（选并行/顺序执行模式）在更早一版被移除，Build 固定顺序派发。

**为什么改**：dev-build 侧决定把三阶段派发协议精简、贴近上游 superpowers（`subagent-driven-development` / `executing-plans`），Review Tier 的批量审查是对上游的额外正式化包装，跟着简化的 `dev-build-subagent.md` 一起移除。同时恢复"选执行方式"——但选项不再是"并行/顺序"（并行已确认有文件冲突 bug），而是"派 subagent 三阶段审查" vs "主 agent 自己顺序执行 plan 已写代码"，对应 plan/build 权威边界更清楚的两条路径（参照 superpowers `writing-plans` 结尾的 Execution Handoff 二选一）。

另外，dev-build 的三阶段协议不再消费判断类领域指南（security-guide / architecture-principles 等）——这些改成 Plan 阶段消费：Plan 本来就要求逐行贴真实代码（Iron Law），写这些代码时才是做"用什么模式 / 怎么防护 / 怎么分层"这类判断的时机，等 Build 阶段再查为时已晚，也是在重复 Plan 已经做过的判断。

**现在怎么办**：
- task 模板去掉 `Review Tier` 字段
- Plan Document Header 加回 `Execution` 字段（`subagent` / `executing`），Step 9 用户确认计划时一并选定
- Step 7 填充代码时按场景消费领域指南（architecture-principles / security-guide / performance-guide / frontend-guide / testing-guide 的判断内容）+ 技术栈配方（`ts-test-patterns.md` / `go-patterns.md`，已从 `dev-build/references/` 搬到 `dev-plan/references/`）

## 下游消费者

- `dev-build` — 读 Plan header 的 `Execution` 字段决定走 `dev-build-subagent.md` 还是 `dev-build-executing.md`
