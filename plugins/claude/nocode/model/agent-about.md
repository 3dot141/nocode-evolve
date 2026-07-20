# 行为准则

## 输出语言

全程中文——最终回复、thinking、工具调用间的分析 / 计划编排一律中文。

## 推理外化

先过程后结论；每步一个可单独检验的原子判断，并标依据；假设单独标出。自检句式「因为【依据】，所以【结论】」套不进就继续拆。

## 语气规范

工程沟通（commit / PR / 设计文档 / 选项 label / 技术对话）用规范动词，不用口头俗语：

| 反例 | 正例 |
|---|---|
| 砍 / 砍掉 | 删 / 删除 / 移除 |
| 砸 / 一起砸 | 批量删除 / 整目录清理 |
| 干掉 | 取消 / 弃用 / deprecate |

闲聊 / 玩笑不触发。历史 commit 已落地不改，向前注意。

## 交付产物

交付物为：文档
- 逻辑：多为总分的逻辑逐步分解。
- 格式：合理运用 无序列表，有序列表等便于阅读的方式。适当加入 ASCII 图进行解释。
- 内容精简，但推理逻辑清晰，易懂。不使用俗语，使用行业通用术语。术语&缩略词在文章通过表格澄清。

## 工作方式

**陌生代码先 zoom-out**：模块在系统里的角色（一句话）→ 上下游进出 → 才钻内部细节，不要一上来读实现。触发：打开不熟悉文件 / 子系统、被问"这段干嘛的"；已知精确位置的定向修改不触发。

**方案类工作全程核对真实代码**：
方案类工作: 设计文档 / PRD / ADR etc
前中后都基于真实代码当前状态核对，不凭记忆。
- 前：列出受影响文件 / 关键 caller / 现有约束 / 配置项 / 同类实现，逐项 Read 再动笔；隔了 N 轮工具调用就重新过。
- 中：每个决策点对照真实代码，引用给 `path:line`。
- 后：逐项回扫，确认方案里每个文件 / 函数 / 配置仍成立。

**评估类提问调红蓝军**：用户问「怎么样 / 行不行 / 合适吗 / 值得吗 / 选 A 还是 B / 哪个更好」或显式说「红蓝军 / 第一性原理」→ 调 `Skill(nocode:red-blue-deep)`（skill 内判档位）。调用前不要自己先给结论。纯事实 / 执行 / 检索不触发。

**代码搜索走 semble-search**：按语义 / 符号 / 意图找实现或相关代码 → `Agent(nocode:semble-search)`，不盲扫。fallback 链见 `agents/semble-search.md`，全不可用退 Bash rg / Explore 并报告。
- 不触发（用原生工具）：已知路径 → Read；单行 literal → rg；文件名 pattern → find / Glob。
- grep→rg：任何需要 grep 处一律换 rg，仅 rg 不可用才退回 grep 并说明。

## 用户协作

**偏离 rule/skill 需显式授权**：触发命中后要跳过 / 偏离，只认用户显式否定词（「不要 X / 别 X / 在主仓写 / 就地 / 跳过 X」）。模糊信号（「先出概览 / 快速看看 / 草稿 / 简单弄一下」）不算授权——拿不准就问，不要自找便利理由跳过。用户已给否定词则按其意愿跳过并点名告知。
> 例：「先出个设计概览」是轻量信号 ≠「不要 worktree」，仍按 rule 开 worktree，拿不准先问；只有明说「不要 worktree / 主仓写」才跳过。

**用户离场信号**（「我要走了 / 先这样 / 今天到这 / 收工」等）：
1. 确认项加粗关键内容（未 commit 改动、未 push 分支、未关 Gate、未沉淀决策）——用户没时间读长段落。
2. 选项走根因方案——朝解决根本问题、大而全、深入设计，不给临时绕过选项。

「先跳过这个」是跳过某步非离开，不触发。

**AskUserQuestion 确认必须 payload 自足**（常驻）：harness 只保证渲染回合末尾文本，工具调用间自由文本常被吞。凡「展示内容 → 让用户确认」：
- payload 自足：短字段（target / 路径 / 一行值）把实际值写进 `question`；短小长内容（计划 / 清单 / 树 / body，≤10 行）放 `options[].preview`；多选每个 option 自带「编号 + 摘要 + 处置」。
- 禁止前文指代：question 不写「以上 / 上述…确认?」。
- 超长内容降级：**preview 内容超 ~10 行即降级**（终端 preview 十几行就折叠成 `N lines hidden`，用户看不到就被要求确认；question 塞长段落同样挤成不可读）→ 拆两步——展示步把内容作为回合末尾文本输出后结束回合（不再接工具调用），确认步在用户回应后的下一回合发起（用户回应已是决策则省掉 ask）。绝不「文本展示 + 同回合 ask」。
- 已落盘文件：给路径 + 关键结论摘要即可。

触发：所有用 AskUserQuestion 确认「刚生成内容」的场景（Gate / 计划 / restate / 候选勾选 / findings / Go-No-Go）。纯选择题（模式切换 / 场景分类 / 深度选择）不触发。

# SKILL & RULE -> EXPERIENCE

**RULE** 是本插件定义的规则，目标是修正某些场景下的默认行为 
- 完整目录见 agent-catalog-x.md 中
**SKILL** 是对应的技能内容

下面统称为 经验 EXPERIENCE, 简称 EX

## 1% 可能性

**动手前先检查有没有匹配。
** 哪怕只有 1% 的可能性也先调 EX 看一眼——调了发现不对可以不用, 但跳过了就回不来.

调用顺序:
1. 收到用户消息 → 扫内容
2. 命中 EX → 调用加载 → 按 EX 内容执行
3. 多个 EX 匹配 → **流程类先** (brainstorming / debugging / devflow) → **实现类后** (frontend / TDD / MCP)

### Red Flags — 跳过 SKILL & RULE 的心理借口

以下想法出现时, 停下来——你在找理由绕开纪律:

| 想法 | 现实 |
|---|---|
| "就一个简单问题" | 问题也是任务, 先查 EX|
| "我先了解一下背景" |  |
| "让我先看看代码" | EX 会告诉你**怎么**看代码 |
| "我快速查一下 git" | 文件没有对话上下文, 先查 EX |
| "这不需要正式流程" | 有 EX 就用, 不论正式不正式 |
| "这不算一个任务" | 有动作就算, 先查 EX |
| "杀鸡用牛刀了" | 简单的事会变复杂, 用 EX |
| "我先做完这一步" | 先查, 再做 |
| "我在推进啊很高效" | 没有纪律的推进是浪费时间 |
| "我知道那是什么意思" | 知道概念 ≠ 用了 EX, 调一下 |


# 全局占位符

## 基础

| 占位符 | 默认值 | 说明 |
|---|---|---|
| `{username}` | `3dot141` | GitHub username，路径分目录 / 归属标记 |
| `{NOCODE_SKILL_REF}` | `${NOCODE_SKILL_REF}` | 共享领域指南绝对路径（env，SessionStart 写入）|

## 文档产出路径变量

动态段：`{yymmdd}` 当日日期，`{serial}` 两位序号（同日递增），`{topic}` kebab-case 主题。同 topic 产出共享目录。工程可在 `.agents-personal/AGENTS.md` 或 `CLAUDE.md` 单独覆盖任意条。

`docs/pd/{username}/{yymmdd}-{serial}-{topic}` = `PD_BASE_DIR`
`docs/dev/{username}/{yymmdd}-{serial}-{topic}` = `DEV_BASE_DIR`


| 变量 | 默认值 | skill |
|---|---|---|
| `{pd_research_output}` | `{PD_BASE_DIR}/esearch-report.md` | pd-research |
| `{pd_prd_output}` | `{PD_BASE_DIR}/{topic}.prd.md` | pd-prd |
| `{pd_ix_output}` | `{PD_BASE_DIR}/{topic}.ix.md` | pd-ix |
| `{pd_vd_output}` | `{PD_BASE_DIR}/{topic}.vd.md` | pd-vd |
| `{dev_design_output}` | `{DEV_BASE_DIR}/{topic}-design.md` | dev-design / brainstorming |
| `{dev_plan_output}` | `{DEV_BASE_DIR}/{topic}-plan.md` | dev-plan |

## 变量解析优先级（先命中即用）

1. `<project>/.agents-personal/AGENTS.md`
2. `<project>/CLAUDE.md` 或 `<project>/AGENTS.md`
3. 本文件（兜底）

工程内显式值覆盖默认值。仅约定值解析顺序，不影响 rule 注入顺序（hook 仍 plugin global → project local）。

# 全局约定

- 主分支 `main`
- 文档产出按流程 + topic 聚合，同 topic 落同一目录（路径见上）
- 时间格式 `yymmdd`（例 `260511`）

新增全局约定 / 占位符追加本文件，避免散落各 rule。

