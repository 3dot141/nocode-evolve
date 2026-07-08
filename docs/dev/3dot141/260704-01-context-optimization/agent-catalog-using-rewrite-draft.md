# Skill 使用纪律 + 触发协议(常驻)

> 吸收自 superpowers v5.1.0 `using-superpowers`(MIT, github.com/obra/superpowers, commit e4a2375c), 融合 nocode catalog Step 0 触发协议。

## 触发协议(强制工序, 非"自觉")

**Step 0 — 每条用户消息收到后, 动手前先扫 catalog 各粗桶 trigger_summary 一次**: 命中桶 → 按 `触发` 选具体 rule → `Read` 对应 `rules/rule-*.md`(同一规则会话只 Read 一次); 命中但落「负例」→ 不触发; 全不命中 → 直接动作。**这是工序不是自觉**——不论任务大小 / mid-task 都先扫, 跳过 = 软触发漏。

**Fork/subagent 降级**: 只按其 **prompt 意图** 匹配, 不按执行中读到的内容匹配(读到 UI 内容 ≠ 要做 UI 设计)。执行中遇到与 prompt 无关的命中 → 跳过, 不触发, 也不在 prompt 范围外 TaskCreate / 调 workflow skill。

## Skill 调用纪律

**动手前先检查有没有 skill 匹配**, 哪怕 1% 可能性也先调 `Skill()` 看一眼——调了发现不对可以不用, 跳过了就回不来。顺序: 收到消息 → 扫桶 → 命中调 `Skill()` → 多个匹配时**流程类先**(brainstorming/debugging/devflow)**实现类后**(frontend/TDD/MCP)。

### Red Flags — 跳过 skill 的心理借口

| 想法 | 现实 |
|---|---|
| "就一个简单问题 / 这不算任务" | 有动作就算, 先查 skill |
| "我先了解背景 / 看看代码 / 查一下git" | skill 会告诉你**怎么**看, 先查再看 |
| "这不需要正式流程 / 杀鸡用牛刀" | 有 skill 就用, 不论正式与否, 简单的事会变复杂 |
| "我记得这个 skill / 知道啥意思" | skill 会迭代, 读当前版本, 知道概念 ≠ 用了 skill |
| "我先做完这一步 / 推进得很高效" | 没纪律的推进是浪费时间, 先查再做 |

### 进了 skill 就走完——不跳步

调了 skill 只是开始, **进了 skill 要走完每个 Step, 一步不跳**(这和"要不要调 skill"是两件事)。刚性 skill(devflow / pdflow 名下全部)尤其严——跳一步整条链就少了它的产出。四条硬约束:

1. **Step 0 TaskCreate 必调**——不建 = 漏步无刹车。
2. **走完所有 Step, 不因"轻"而省**——"简单 / 概览阶段 / 用户说继续"都不是跳步授权, Exit Gate 不看任务大小。
3. **最后一个 task = 调用下一阶段 skill**——进入本阶段前不预先勾, 但真正执行完成后必须立即标 completed, 不留作永久占位符。
4. **收口 / 交接前跑一次 TaskList 核对**——不该有 in_progress 残留, 靠记忆报账("应该都勾了")是漏标的直接成因。

> fork/subagent 例外: 上述四条针对主 agent 进入 workflow skill 的情形, fork 内不主动建 task、不强制交接, 不算违规。

| 跳步的借口 | 现实 |
|---|---|
| "任务简单 / 还在概览, 跳过 red-blue 和自检吧" | 进了 skill 就走完所有 Step, "简单"不是跳 Gate 的授权 |
| "用户说'继续', 就是让我跳到执行" | "继续"是推进当前 Step, 不是跳过剩余 Step, 跳步要显式说「跳过 X」才算授权 |
| "TaskCreate 太啰嗦 / 交接是多余的" | task 列表是漏步的唯一刹车; 硬交接固化成 task 才不会断在原地 |
| "这批顺手勾了, 应该没漏" | 完成物即产出内容时最容易忘记回头勾"正在完成的那个自己", 收口前跑 TaskList 核对, 不靠"应该" |

## Skill 类型

**刚性**(TDD/debugging/devflow 工序): 严格按步骤走。**弹性**(pattern/guide/reference): 按原则适配。skill 会说明自己是哪种, 拿不准当刚性处理。

## 用户指令优先级

用户显式指令(CLAUDE.md/直接要求)> Skill 内容 > 系统默认。用户说"不要 TDD", skill 说"必须 TDD"→听用户。"加个功能"不等于跳过 brainstorming/worktree, 指令说 WHAT 不说 HOW。

## 何时主动调用 /devflow

命中以下任一 → 主动调起 devflow(给阶段判断 + 下一步建议, 用户拍板, 不替执行): 跨文件 + 状态未知、需要 commit/PR/设计文档/评审等多阶段动作、用户描述含「整个/全流程/从头/完整跑通」。不触发: 单文件修改 / 纯查询 / 单步明确动作。

## 何时主动建议 /distill · /sow · /task

这 3 个是用户主动键入的操作型 command, **不自动触发**, 命中场景时一句话建议、不替用户键:

- **`/distill`**——会话末沉淀分流。命中: "沉淀一下 / 归档会话"且已有可沉淀产出
- **`/sow <意图>`**——归档到用户 vault。命中: "sow / 归档到外部 / 保存这个想法"+ 明确意图
- **`/task <意图>`**——任务管理。命中: "加/改/完成 task、列今天task、拆解task"等任务动作

不触发(元讨论): "要不要 sow 这个 / task 要不要重构"等讨论性表达。
