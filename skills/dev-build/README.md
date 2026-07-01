# dev-build

devflow 第 5 阶段——读 Plan 的 `Execution` 字段，分发到 `dev-build-subagent`（顺序派发独立 subagent，per-task 三阶段验证：implement → spec review → quality review）或 `dev-build-executing`（主 agent 自己顺序执行 plan 已写代码）。Build skill 本身是编排入口，不执行实现代码，具体协议见对应 reference。

## 在 devflow 中的位置

```
... Plan → dev-build → Verify ...
             ↑ 你在这里
```

## 设计决策：移除 Workflow 编排，改 subagent 顺序派发

`260701` 红蓝军评审后改。

**原来的设计**：Build 生成一段 Workflow 脚本，用 `Workflow()` 按依赖图拓扑分层——同层 task 并行、跨层顺序，走 pipeline 三阶段。Plan 阶段让用户选 `workflow-parallel` / `workflow-sequential` 记到 Execution 字段。

**为什么改**：红蓝军独立审查（Claude subagent + Codex 双路）合并出一个 Critical——并行派发的 subagent 共享同一工作目录，「依赖图无依赖」≠「文件不冲突」，两个 task 改到同一个 lockfile / 快照 / 共享类型就互相覆盖。这正是上游 superpowers 明确禁止并行 implementer 的原因，Workflow 的进程隔离不解决文件系统层的冲突。并行省下的 wall-clock，换来的是"合并后才炸、无法二分定位"的语义冲突。

**现在怎么办**：Build 固定由主 agent 用 `Agent()` 逐个 task 顺序派发，走 implement → spec review → quality review 三阶段。不生成 Workflow 脚本、不读 Plan 的 `Execution` 字段、不并行。用少量 wall-clock 换可靠性 + 可二分定位。

## 设计决策：删除 Final Review

`260701` 的 devflow 多层 review 收敛审查中删除。

**原来的设计**：所有 per-task 完成后，Workflow 的最后一个 phase 是一次笼统的整体 code review（`agent(finalReviewPrompt, ...)`）。

**为什么删**：审查时发现这一步存在两个实质问题——
1. **从未真正定义过**：`finalReviewPrompt` 在整个 `skills/dev-build/` 目录里只出现一次（用到它的那一行），没有任何地方定义它的内容、维度表或 severity 映射——对比 per-task 的 spec/quality review 都有专门的 `references/spec-reviewer-prompt.md` / `references/quality-reviewer-prompt.md`。它更像一个从未补完的占位符。
2. **时机结构性偏早**：Final Review 是 Build 内部 Workflow 的最后一步，必然发生在 Verify（集成/E2E 验证）之前——审"整体代码"的时候，这些代码还没做过任何跨模块/端到端验证，价值打折。

它想做的事（全局视角看合并后的 diff）和 Review 阶段的 Five-Axis 目标重合，但 Five-Axis 有完整的维度表 + severity 映射 + Evidence Gate，方法论完整度高得多。

**现在怎么办**：Build 靠编排者独立验证（读 diff + 跑测试 + spec 抽查 + 空壳扫描）收口进 Exit Gate；全局 code review 完整交给 Review 阶段的 Five-Axis 一次做完。

## 设计决策：Quality Review 与 Five-Axis 分工，编排者验证收窄

同一轮审查还调整了两处，避免同一件事被不同环节重复做：

- **编排者 spec 核对**：从"逐条重新核对"改成"抽查 1-2 个 task"——per-task Spec Review 已经是独立 subagent 做过一次逐条核对，编排者不信的是"subagent 自报"，不是"独立 reviewer 的判断"，抽查足够。
- **空壳扫描**：从 LLM 语义判断改成确定性脚本（grep/AST）。per-task Spec Review 的 `[empty-shell]` tag 仍是 LLM 语义判断（能看出"函数体只是把参数原样返回"这类隐蔽空壳），编排者层不需要用另一个 LLM 把同一件事重新判断一遍，脚本兜底做模式匹配即可。
- **Quality Review vs Review Five-Axis**：完整 rationale 见 `dev-review/README.md`。

## 设计决策：per-task review 加轻档出口（Review Tier）

**原来的设计**：不管 task 多小（哪怕只改一行文案），per-task 都固定走 implement → spec review → quality review 三跳独立 subagent。

**为什么加**：Plan 自己的 sizing 纪律（task ≤5 文件、"and"要拆）在鼓励产出大量"可逆+单文件+易回滚"画像的小 task，而 `reviewing/skeleton.md` §1 本来就为这种画像提供了轻档出口（跳过独立交叉）——dev-build 之前没有对接这个出口，导致小 task 也要付固定的三跳 subagent 成本。

**现在怎么办**：Plan 阶段给每个 task 标 Review Tier（`light`/`heavy`），Build 按 tier 分流——`light` task 的 spec/quality review 不单独起 subagent，累积到下一个 checkpoint 批量合并审查一次；`heavy` task（多文件/碰共享接口/安全鉴权支付/HITL）走原有完整 pipeline 不受影响。这条决策在下方「拆分为 subagent / executing 两条执行协议」被反转。

## 设计决策：拆分为 subagent / executing 两条执行协议，Review Tier 移除，贴近上游

`260701` 调整。

**原来的设计**：dev-build 是单一执行路径——固定由主 agent 顺序派发 subagent 走三阶段（implement → spec review → quality review），并按 Review Tier 分档批量审查。

**为什么改**：对照 superpowers 发现 `writing-plans` 结尾本来就有 Execution Handoff 二选一（Subagent-Driven / Inline Execution），dev-build 之前只内联了前者。恢复这条二选一时发现"贴近上游"和"保留 Review Tier 等正式化包装"互相矛盾——Review Tier、reviewing 框架 tag→severity 映射这些是在上游基础上加的重量级包装，留着就没法"贴近上游措辞"。判断类领域指南的消费点也一并移到 Plan（见 `dev-plan/README.md`），因为 Plan 本来就要求逐行贴真实代码（Iron Law），这类判断该在写代码那一刻做，等 Build 阶段再查为时已晚。

**现在怎么办**：
- `SKILL.md` 瘦成分发器——Enter/Exit Gate、Step 0 里程碑、硬交接不变，Step 1 读 Plan `Execution` 字段（`subagent` / `executing`）分发到对应 reference
- 新建 `references/dev-build-subagent.md`（对应上游 `subagent-driven-development`）：三阶段派发 + 四状态协议，去掉 Review Tier 分档、reviewing 框架 tag→severity 映射这类正式化包装；implementer「Your Job」改为"忠实执行 plan 已写代码"而非从零 TDD
- 新建 `references/dev-build-executing.md`（对应上游 `executing-plans`）：主 agent 自己顺序执行 plan 已写代码，不派 subagent、无独立 review，靠后续 dev-verify/dev-review 兜底；收尾对接 devflow 的 Verify 阶段，不像上游那样接到已被 nocode-evolve 替换掉的 `finishing-a-development-branch`
- `implementer-prompt.md` 去掉技术栈配方按需注入（已移 Plan 阶段消费）

## 下游消费者

- `dev-verify` — 消费 Build 的测试/build 通过状态
- `dev-review` — Five-Axis 读取各 task 的 Quality Review verdict 避免重复扫描
