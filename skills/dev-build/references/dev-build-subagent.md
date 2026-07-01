# dev-build-subagent — 顺序派发独立 subagent，per-task 三阶段验证

对应 plan `Execution` 字段值 `subagent`。dev-build 编排者用 `Agent()` 逐个 task **顺序**派发独立 subagent 执行，每个 task 走三阶段：实现 → spec 合规审查 → 代码质量审查。改编自上游 superpowers `subagent-driven-development`。

## 为什么顺序，不并行

并行派发的 subagent 共享同一个工作目录，「依赖图无依赖」≠「文件不冲突」——两个 task 改到同一个 lockfile / 快照 / 共享类型就会互相覆盖，这正是上游 superpowers 明确禁止并行 implementer 的原因。顺序执行天然规避，用少量 wall-clock 换可靠性 + 出问题能二分定位。

## 协议

1. 按依赖图拓扑把 task 排成一条**线性执行顺序**（被依赖的先跑；无依赖的 task 也排进这条线，不并行）
2. 为每个 task 组装 implementer prompt（见「Implementer Prompt 组装」）
3. 逐个 task 走完整三阶段链，**前一个 task 三阶段全部通过才进下一个**

**每个 task 的三阶段：**

1. **Implement** — 派 implementer subagent（`Agent(subagent_type: "general-purpose")`，prompt 见 `implementer-prompt.md`）。要求它按下面格式结构化报告：
   - `status`：`DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`
   - `summary` / `filesChanged` / `concerns` / `testResults`
2. **Spec Review** — 仅当 `status ∈ {DONE, DONE_WITH_CONCERNS}` 时派发（prompt 见 `spec-reviewer-prompt.md`）。reviewer 报 `{approved, issues[]}`。
3. **Quality Review** — 仅当 spec `approved === true` 时派发（prompt 见 `quality-reviewer-prompt.md`）。reviewer 报 `{approved, issues[]}`。

**gate**：任一 review `approved:false` → implementer 修复对应问题，重新走该阶段审查，循环直到通过才进下一 task。

## Handling Implementer Status

| 状态 | 处理 |
|---|---|
| **DONE** | 进入 Spec Review |
| **DONE_WITH_CONCERNS** | 先读顾虑内容——涉及正确性/scope 的顾虑，处理完再审；纯观察性的记下来直接进 Spec Review |
| **NEEDS_CONTEXT** | implementer 需要没提供的信息，补充上下文后重新派发 |
| **BLOCKED** | 评估卡点：缺 context → 补充信息重派；需要更强推理 → 换更强模型重试；任务太大 → 拆小；plan 本身有问题 → 升级给用户 |

不忽略任何一次升级，也不在不改变任何条件的情况下让同一模型重试——implementer 说卡住了，说明有什么地方需要改变。

## Implementer Prompt 组装

Build 为每个 task 组装 implementer prompt，内容来自：

1. **task 描述**（来自 Plan）：完整 task 文本、代码、验证命令——从 Plan 文档提取，不让 subagent 自己读 Plan 文件
2. **执行纪律**（来自 `implementer-disciplines.md`）：Scope Lock、Iron Law TDD、偏差分级、NOTICED BUT NOT TOUCHING、异常路径
3. **上下文注入**（按条件）：有 pd-vd 原型时注入视觉清点段落

Prompt 模板见 `implementer-prompt.md`。

## Red Flags

- 有 BLOCKED task 未处理就继续派发下一个
- spec review 不过强行跳过
- 并行派发多个 implementer subagent（共享工作目录会冲突）
- 让 subagent 读 plan 文件（应提供完整文本，不是路径）
- 用 implementer 的自我审查代替独立审查（两者都需要，缺一不可）
- spec compliance 还没通过就先跑 quality review
- 某一 review 还有未处理 issue 就进下一个 task
- 忽略 subagent 提出的问题，不澄清就催它继续
