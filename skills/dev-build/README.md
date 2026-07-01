# dev-build

devflow 第 5 阶段——Workflow 编排 per-task 三阶段验证（implement → spec review → quality review）。Build skill 本身是编排者，不执行实现代码。

## 在 devflow 中的位置

```
... Plan → dev-build → Verify ...
             ↑ 你在这里
```

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

**现在怎么办**：Plan 阶段给每个 task 标 Review Tier（`light`/`heavy`），Build 按 tier 分流——`light` task 的 spec/quality review 不单独起 subagent，累积到下一个 checkpoint 批量合并审查一次；`heavy` task（多文件/碰共享接口/安全鉴权支付/HITL）走原有完整 pipeline 不受影响。

## 下游消费者

- `dev-verify` — 消费 Build 的测试/build 通过状态
- `dev-review` — Five-Axis 读取各 task 的 Quality Review verdict 避免重复扫描
