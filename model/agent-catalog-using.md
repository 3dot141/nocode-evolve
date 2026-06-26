# Skill 使用纪律 + 触发协议 (常驻)

> 吸收自 superpowers v5.1.0 `using-superpowers` skill (MIT, github.com/obra/superpowers, commit e4a2375c).
> 融合 nocode-evolve catalog Step 0 触发协议 + devflow/command 主动调用条件.

## 触发协议 (强制工序, 非"自觉")

**Step 0 — 每条用户消息收到后, 在动手前先扫 catalog 粗桶的 trigger_summary 一次**:

- 命中桶 → 在桶内子规则按 `触发` 选具体 rule → `Read` 对应 `rules/rule-*.md` (同一规则会话只 Read 一次)
- 命中桶但落「负例」描述 → 不触发
- 全不命中 → 直接动作 (无 rule 约束)

**这是工序, 不是自觉**——不论任务大小、context 深度、是否 mid-task, Step 0 都先扫. 跳过 = 软触发漏, 这正是 catalog 常驻设计要解决的.

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
