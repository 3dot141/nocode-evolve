# Skill 使用纪律 + 触发协议 (常驻)

> 吸收自 superpowers v5.1.0 `using-superpowers` skill (MIT, github.com/obra/superpowers, commit e4a2375c).
> 融合 nocode catalog Step 0 触发协议 + devflow/command 主动调用条件.

## 触发协议 (强制工序, 非"自觉")

**Step 0 — 每条用户消息收到后, 在动手前先扫 catalog 粗桶的 trigger_summary 一次**:

- 命中桶 → 在桶内子规则按 `触发` 选具体 rule → `Read` 对应 `rules/rule-*.md` (同一规则会话只 Read 一次)
- 命中桶但落「负例」描述 → 不触发
- 全不命中 → 直接动作 (无 rule 约束)

**这是工序, 不是自觉**——不论任务大小、context 深度、是否 mid-task, Step 0 都先扫. 跳过 = 软触发漏, 这正是 catalog 常驻设计要解决的.

**Fork/subagent 触发降级**: fork/subagent 的 Step 0 扫桶只按其 **prompt 意图** 匹配, 不按执行中读到的内容匹配. 读到 UI 内容 ≠ 用户要求做 UI 设计; 读到测试代码 ≠ 用户要求跑 TDD. 执行中遇到与 prompt 无关的 skill 命中 → 跳过, 不触发. 同理, 不在 prompt 范围外 TaskCreate / 调 workflow skill (devflow/pdflow/pd-ix/pd-vd 等).

## Skill 调用纪律

**动手前先检查有没有 skill 匹配。** 哪怕只有 1% 的可能性也先调 Skill() 看一眼——调了发现不对可以不用, 但跳过了就回不来.

调用顺序:
1. 收到用户消息 → Step 0 扫 catalog 粗桶
2. 命中 skill → 调 `Skill()` 加载 → 按 skill 内容执行
3. 多个 skill 匹配 → **流程类先** (brainstorming / debugging / devflow) → **实现类后** (frontend / TDD / MCP)

### Red Flags — 跳过 skill 的心理借口

以下想法出现时, 停下来——你在找理由绕开纪律:

| 想法 | 现实 |
|---|---|
| "就一个简单问题" | 问题也是任务, 先查 skill |
| "我先了解一下背景" | 查 skill 在了解背景**之前** |
| "让我先看看代码" | skill 会告诉你**怎么**看代码 |
| "我快速查一下 git" | 文件没有对话上下文, 先查 skill |
| "这不需要正式流程" | 有 skill 就用, 不论正式不正式 |
| "我记得这个 skill" | skill 会迭代, 读当前版本 |
| "这不算一个任务" | 有动作就算, 先查 skill |
| "杀鸡用牛刀了" | 简单的事会变复杂, 用 |
| "我先做完这一步" | 先查, 再做 |
| "我在推进啊很高效" | 没有纪律的推进是浪费时间 |
| "我知道那是什么意思" | 知道概念 ≠ 用了 skill, 调一下 |

### 进了 skill 就走完——不跳步

调了 skill 只是开始。**进了 skill 就要走完它每个 Step, 一步不跳**——这和"要不要调 skill"是两件事: 上面那张表管前者 (别跳过触发), 这节管后者 (进了别跳步).

刚性 skill (devflow / pdflow 名下全部 workflow skill) 尤其严: Step 有顺序、有 Enter/Exit Gate, 跳一步后面整条链就少了它的产出 (没对抗审视过的计划、没覆盖的路径) 直接往下流.

三条硬约束:

1. **Step 0 TaskCreate 必须调用.** 进了 workflow skill 第一件事就是按它的 Step 0 把所有 task 建出来. 不建 = 漏步没有刹车, 后面跳了无人察觉. 跳过 TaskCreate 本身就是跳步.
2. **走完所有 Step, 不因"轻"而省.** "任务简单 / 还在概览阶段 / 用户说了'继续'"都不是跳步授权. 快 ≠ 跳——每步可以简洁, 不能省步. Exit Gate 不看任务大小.
3. **最后一个 task = 调用下一步要 handoff 的 skill.** workflow skill 的 task 列表最后一项, 显式写成"调用下一阶段 skill" (如 dev-plan 末尾 → 调 dev-build). 把硬交接固化成一个没勾的 task, context 丢了也不会断在原地. 终点 skill 没有下游阶段, 最后 task 写"向调用方 / 用户报告完成并交回控制"——是有实际动作的交接, 不是占位的空 task.

> **fork/subagent 例外**: 上面三条约束针对**主 agent** 进入 workflow skill 的情形. 按本文件触发协议, fork/subagent 不在其 prompt 范围外 TaskCreate / 调 workflow skill——fork 内不主动建 task、不强制交接, 不算跳步违规.

| 跳步的借口 | 现实 |
|---|---|
| "任务简单 / 就是串接调用, 跳过 red-blue 和自检吧" | 进了 skill 就走完所有 Step. "简单"是你的判断, 不是跳 Gate 的授权 |
| "还在概览 / 草稿阶段, 不用走全套" | 阶段轻 ≠ 步骤可省. Exit Gate 不看任务大小 |
| "用户说了'继续', 就是让我跳到执行" | "继续"是推进**当前 Step**, 不是跳过剩余 Step. 跳步要用户显式说「跳过 X」才算授权 |
| "TaskCreate 太啰嗦, 我记得住要做啥" | 记得住也建. task 列表是漏步的唯一刹车, 尤其 context 被压缩后 |
| "做完实质步骤就行, 交接是多余的" | 最后那个交接 task 防的就是"做完停在原地". 硬交接固化成 task 才不会断 |

> ❌ 反例: dev-plan 进到一半, 判断"就是串接 4 个 API, 简单", 跳过 Step 6/8 的 red-blue-deep、Step 9 的执行模式确认, 用户说"继续"就直接改代码. 结果: 没对抗审视过、没确认覆盖路径的计划直接进了 Build.
> ✅ 正例: 同样简单的任务, 仍走完 Step 6 骨架审视 + Step 8 自检 + Step 9 用 AskUserQuestion 确认执行模式 + 最后一个 task 调 dev-build 硬交接. 简单任务走完整流程多花几分钟, 但不会把没验过的计划往下游推.

## Skill 类型

- **刚性** (TDD / debugging / devflow 工序): 严格按步骤走, 不自行简化
- **弹性** (pattern / guide / reference): 按原则适配上下文

skill 本身会说明自己是哪种. 拿不准 → 当刚性处理.

## 用户指令优先级

1. **用户显式指令** (CLAUDE.md / AGENTS.md / 直接要求) — 最高
2. **Skill 内容** — 覆盖默认行为
3. **系统默认** — 最低

用户说"不要 TDD", skill 说"必须 TDD" → 听用户的.
用户说"加个功能" → 不等于跳过 brainstorming / worktree, 指令说 WHAT 不说 HOW.

## 何时主动调用 /devflow

agent 视角: 用户任务命中以下任一条件时, **主动调起 devflow skill** 进入流程导航 (devflow 给阶段判断 + 下一步建议, 用户拍板, 不替执行):

- 跨文件 + 状态未知 (不知道当前在生命周期哪一步)
- 需要 commit / PR / 设计文档 / 评审等多阶段动作
- 用户描述含「整个 / 整体 / 全流程 / 从头 / 完整跑通」等多步信号

不触发 (直接动手, 不建议 /devflow): 单文件修改、纯查询、单步明确动作.

> 项目本地资源 (`.agents-personal/`) 检索约定见 `model/agent-personal.md`. /devflow 可被 model 主动调起, 也可用户 `/调`; 命中上述复杂多步条件时直接进 devflow, 由 devflow 给流程建议、用户拍板.

## 何时主动建议 /distill · /sow · /task (用户主动键入 command)

这 3 个是用户主动键入 `/<name>` 的**操作型 command** (有副作用: 写文件 / 改 vault / 改 task 状态), **不自动触发**. agent 在命中以下场景时**主动一句话建议**用户键入, **不替用户键**:

- **`/distill`** — 会话末沉淀分流 (五出口: 项目 wiki / 跨项目 advisor / 项目 rules / 插件 rules / skip). 命中: 用户说「沉淀一下 / 归档这个会话 / 把刚才讨论的保留下来」且会话已有可沉淀产出
- **`/sow <意图>`** — 归档到用户 vault (`Inbox` / `Inputs` / `Outputs` 三层). 命中: 用户说「sow 到 vault / 归档到外部 / 写到 vault / 保存这个想法」+ 有明确意图
- **`/task <意图>`** — 任务管理 (8 sub-action: add / update / done / cancel / wrap-day / carry-over / breakdown / start-week). 命中: 用户说「加 task / 改 task / task 完成 / 列今天 task / 拆解 task / 周开始」等任务动作

不触发 (纯讨论 / 元讨论, 不命中): 用户说「要不要 sow 这个」「task 这块要不要重构」「distill 设计怎么改」等讨论性表达——是元讨论不是动作.
