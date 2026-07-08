# Skill 使用纪律 + 触发协议（常驻）

> 吸收自 superpowers v5.1.0 `using-superpowers`（MIT, github.com/obra/superpowers, commit e4a2375c），融合 nocode catalog Step 0 触发协议 + devflow/command 主动调用条件。

## 触发协议（强制工序，非"自觉"）

**Step 0 — 每条用户消息收到后，动手前先扫 catalog 各粗桶 trigger_summary 一次**：命中桶 → 按 `触发` 选具体 rule → `Read` 对应 `rules/rule-*.md`（同一规则会话只 Read 一次）；命中但落「负例」→ 不触发；全不命中 → 直接动作。**这是工序不是自觉**——不论任务大小 / context 深度 / 是否 mid-task，都先扫，跳过 = 软触发漏。

**Fork/subagent 触发降级**：只按其 **prompt 意图** 匹配，不按执行中读到的内容匹配（读到 UI 内容 ≠ 要做 UI 设计，读到测试代码 ≠ 要跑 TDD）。执行中遇到与 prompt 无关的命中 → 跳过，不触发，也不在 prompt 范围外 TaskCreate / 调 workflow skill（devflow/pdflow/pd-ix/pd-vd 等）。

## Skill 调用纪律

**动手前先检查有没有 skill 匹配**，哪怕 1% 可能性也先调 `Skill()` 看一眼——调了发现不对可以不用，跳过了就回不来。顺序：收到消息 → 扫桶 → 命中调 `Skill()` → 多个匹配时**流程类先**（brainstorming/debugging/devflow）**实现类后**（frontend/TDD/MCP）。

### Red Flags — 跳过 skill 的心理借口

| 想法 | 现实 |
|---|---|
| "就一个简单问题 / 这不算一个任务" | 问题也是任务，有动作就算，先查 skill |
| "我先了解一下背景 / 先看看代码 / 快速查一下 git" | skill 会告诉你**怎么**看，文件没有对话上下文，先查再看 |
| "这不需要正式流程 / 杀鸡用牛刀了" | 有 skill 就用，不论正式与否；简单的事会变复杂 |
| "我记得这个 skill / 我知道那是什么意思" | skill 会迭代，读当前版本；知道概念 ≠ 用了 skill |
| "我先做完这一步 / 我在推进啊很高效" | 先查再做；没有纪律的推进是浪费时间 |

### 进了 skill 就走完——不跳步

调了 skill 只是开始。**进了 skill 就要走完它每个 Step，一步不跳**——这和"要不要调 skill"是两件事。刚性 skill（devflow / pdflow 名下全部 workflow skill）尤其严：Step 有顺序、有 Enter/Exit Gate，跳一步后面整条链就少了它的产出。

四条硬约束：

1. **Step 0 TaskCreate 必须调用**——不建 = 漏步没有刹车，后面跳了无人察觉。
2. **走完所有 Step，不因"轻"而省**——"任务简单 / 还在概览阶段 / 用户说了'继续'"都不是跳步授权，快 ≠ 跳，Exit Gate 不看任务大小。
3. **最后一个 task = 调用下一阶段 skill（或终点 skill 的完成报告）**——workflow skill 的 task 列表最后一项，显式写成"调用下一阶段 skill"（如 dev-plan 末尾 → 调 dev-build）；没有下一阶段可调的终点 workflow（如 dev-land），写成终点 skill 的完成报告。进入本阶段前这个 task 不预先勾，但真正执行完成后必须立即标 completed，不留作永久占位符。
4. **收口 / 交接前跑一次 TaskList 核对**——本 skill 名下不该还有 in_progress 残留，收口靠记忆报账（"应该都勾了"）是漏标的直接成因。

> fork/subagent 例外：上述四条约束针对**主 agent** 进入 workflow skill 的情形，fork 内不主动建 task、不强制交接，不算跳步违规。

| 跳步的借口 | 现实 |
|---|---|
| "任务简单 / 就是串接调用，跳过 red-blue 和自检吧" / "还在概览 / 草稿阶段，不用走全套" | 进了 skill 就走完所有 Step，"简单"不是跳 Gate 的授权，阶段轻 ≠ 步骤可省 |
| "用户说了'继续'，就是让我跳到执行" | "继续"是推进当前 Step，不是跳过剩余 Step，跳步要用户显式说「跳过 X」才算授权 |
| "TaskCreate 太啰嗦，我记得住要做啥" / "做完实质步骤就行，交接是多余的" | task 列表是漏步的唯一刹车，尤其 context 被压缩后；硬交接固化成 task 才不会断在原地 |
| "这批 TaskUpdate 顺手勾了，应该没漏" | 完成物即产出内容时最容易忘记回头勾"正在完成的那个自己"，收口前跑 TaskList 核对，不靠"应该" |

> ❌ dev-plan 进到一半，判断"就是串接 4 个 API，简单"，跳过 Step 6/8 的 red-blue-deep、Step 9 的执行模式确认，用户说"继续"就直接改代码。
> ✅ 同样简单的任务，仍走完 Step 6 骨架审视 + Step 8 自检 + Step 9 确认执行模式 + 最后一个 task 硬交接。

## Skill 类型

**刚性**（TDD / debugging / devflow 工序）：严格按步骤走，不自行简化。**弹性**（pattern / guide / reference）：按原则适配上下文。skill 本身会说明自己是哪种，拿不准当刚性处理。

## 用户指令优先级

**用户显式指令**（CLAUDE.md / AGENTS.md / 直接要求）> **Skill 内容** > **系统默认**。用户说"不要 TDD"，skill 说"必须 TDD"→ 听用户的。用户说"加个功能"不等于跳过 brainstorming / worktree，指令说 WHAT 不说 HOW。

## 何时主动调用 /devflow

命中以下任一 → 主动调起 devflow（给阶段判断 + 下一步建议，用户拍板，不替执行）：跨文件 + 状态未知（不知道当前在生命周期哪一步）、需要 commit / PR / 设计文档 / 评审等多阶段动作、用户描述含「整个 / 整体 / 全流程 / 从头 / 完整跑通」等多步信号。不触发：单文件修改、纯查询、单步明确动作。项目本地资源（`.agents-personal/`）检索约定见 `agent-personal.md`。

## 何时主动建议 /distill · /sow · /task

这 3 个是用户主动键入 `/<name>` 的**操作型 command**（有副作用：写文件 / 改 vault / 改 task 状态），**不自动触发**。命中以下场景**主动一句话建议**，不替用户键：

- **`/distill`** — 会话末沉淀分流（五出口：项目 wiki / 跨项目 advisor / 项目 rules / 插件 rules / skip）。命中：用户说「沉淀一下 / 归档这个会话」且会话已有可沉淀产出。
- **`/sow <意图>`** — 归档到用户 vault（`Inbox` / `Inputs` / `Outputs` 三层）。命中：用户说「sow 到 vault / 归档到外部 / 保存这个想法」+ 有明确意图。
- **`/task <意图>`** — 任务管理（8 sub-action：add / update / done / cancel / wrap-day / carry-over / breakdown / start-week）。命中：用户说「加 task / 改 task / task 完成 / 列今天 task / 拆解 task / 周开始」等任务动作。

不触发（纯讨论 / 元讨论）：用户说「要不要 sow 这个」「task 这块要不要重构」等讨论性表达。
