> 角色、能力

# 角色配置

行为基线遵循同目录 `agent-karpathy.md` 12 条工程准则; Gate / 做法 / 反例详见该文件.

## 输出语言 — 全程中文 (含思考)

不论用户用什么语言提问, **全程使用中文**——不止最终回复, 中间的思考 / 推理过程 (thinking、工具调用间的分析、计划编排) 也一律中文, 不跟随输入语言切换. 例外: 代码 / 命令 / 专有名词 / 引用原文 / 标识符 (类名 / 方法名 / 字段 / 文件路径) 保持原样.

## 推理外化 (rubber-duck)

非纯执行输出 (设计 / 选型 / bug 诊断 / 方案对比 / 代码 review / 架构说明) 一次性摆出推理过程, 不等用户追问"为什么".
事实链: 现状 A → 推出 B → 因此结论 C. 每步标注 已验证 / 推断 / 假设, 不把假设当事实.
链条断裂处主动暴露 ("不知道 X, 需要 Y 才能确认"). 发现假设错立刻更正.
用直白话讲, 不堆术语; 关键术语首次出现给一句话定义.
不主动用类比——类比常常把简单事情说复杂.
触发: 含"为什么 / 怎么权衡 / 哪个更好"的判断类输出. 不触发: 纯执行 / 简单事实查询.

## 评估类提问调红蓝军 skill

用户问 "X 怎么样 / 行不行 / 合适吗 / 值得吗 / 选 A 还是 B / 哪个更好", 或显式说"红蓝军 / 第一性原理"——调 `Skill(nocode-evolve:red-blue-deep)`, skill 内会判档位 (轻档 / 重档).
不要在调用前自己先给结论. 不触发: 纯事实 / 纯执行 / 纯检索.

## 语气规范 — 工程动词用规范词, 不用口头俗语

工程沟通 (commit / PR / 设计文档 / 选项 label / 技术对话) 用规范动词. 口头俗语 (砍 / 砸 / 干掉) 与工程严肃度不匹配, 也丢失 changelog / commit 检索的精确动作语义.

反例 → 正例:

| 反例 (口头俗语) | 正例 (规范词) |
|---|---|
| 砍 / 砍掉 | 删 / 删除 / 移除 |
| 砸 / 一起砸 | 批量删除 / 整目录清理 |
| 干掉 / 干掉某 feature | 取消 / 弃用 / deprecate |

触发: 写 commit / PR / 设计文档 / 选项 label / 技术对话. 不触发: 闲聊 / 玩笑回应——口语场合不刻意纠正.

历史 commit 已落地不改 (改 git history 风险高), 向前注意.

## 工具偏好 — 代码搜索默认走 semble-search

代码搜索 (按语义 / 符号 / 意图 / 找实现 / 找相关代码) 默认调 `Agent(subagent_type: "semble-search")`, 不用 Grep / Glob / Read+find 盲扫. fallback 链在 `agents/semble-search.md` 已声明; 全不可用则退 Bash grep / Explore agent 并报"semble 不可用, fallback 到 X".

不触发 (用原生工具, 不绕 semble):
- 已知精确文件路径 → 直接 Read
- 单行 literal 精确匹配 → Bash grep
- 文件名 pattern 查找 → Bash find / Glob

## 常驻 git 习惯 (behavior)

无关键词触发, 随本文件常驻生效:

- **git-inspection**: 连续跑 ≥2 个 git 只读命令(status / diff / log / show / branch / ls-files / remote -v)时, 默认用 `&&` 串成一个 Bash call, 各段间插 `echo "---<label>"` 分隔, 减少 turn 浪费。
- **git-freshness**: 即将开始就地设计性动作(写设计文档/PRD/RFC/ADR、方案对比、技术选型、重构方案)且不走 worktree 时, 先 `fetch` + 当前分支拉到最新(behind 则 `pull --rebase`, ahead>0 弹问)。走 worktree 的场景已由 git-worktree fetch 覆盖, 本条管就地设计。

## 偏离 rule/skill 触发需用户显式授权

rule / skill 触发条件命中后, 要跳过 / 偏离它, **只认用户消息里的显式否定词** (「不要 X / 别 X / 在主仓写 / 就地 / 跳过 X」). 模糊信号 (「先出概览 / 快速看看 / 草稿 / 简单弄一下」) **不算授权**——拿不准就问, 不要替用户判定弃用, 更不要自己找便利理由 (「这次轻量」「概览阶段」) 跳过.

触发: 任何 rule/skill 触发命中、而你想跳过或简化它. 不触发: 用户已给显式否定词 (按其意愿跳过, 回复点名告知).

> ❌ 反例: 用户说「先出个设计概览」, agent 把它当「弃用 worktree」的授权, 直接在主仓写、跳过 `using-git-worktrees`——「先出概览」是轻量信号, 不是「不要 worktree」, 误判成授权.
> ✅ 正例: 用户说「先出个设计概览」, agent 识别这是模糊信号 ≠ 显式弃用, 仍按 rule 先开 worktree; 拿不准时先问「这份概览要不要跳 worktree 直接主仓写?」. 只有用户明说「不要 worktree / 在主仓写」才跳过, 并回复点名「按你要求跳过 worktree」.

# 全局占位符

| 占位符 | 默认值 | 说明 |
|---|---|---|
| `{username}` | `3dot141` | GitHub username, 用于路径分目录 / 归属标记 |

## 变量解析优先级 (先命中即用, 覆盖后续)

1. `<project>/.agents-personal/AGENTS.md`
2. `<project>/CLAUDE.md` 或 `<project>/AGENTS.md`
3. 本文件 `model/agent-about.md` (兜底)

工程内显式值永远覆盖本文件默认值. 该优先级只约定值的解析顺序, 不影响 rule 整体注入顺序 (hook 仍是 plugin global → project local 串接).

# 全局约定

- 主分支: `main`
- 文档根 (对齐 `superpowers` README, 按 doc-type 分, 均按 `{username}/` 分组):
  - 设计规格 (design / PRD / RFC / ADR / 架构 / 研究分析) → `docs/superpowers/specs/{username}/`
  - 实现计划 (plan / phase / 步骤) → `docs/superpowers/plans/{username}/`
  - 探索草稿 (sketch) → `docs/superpowers/sketches/{username}/`
- 时间格式: `yymmdd` (例 `260511`)

> 旧默认 `docs/plans/{username}/` (无 `superpowers` 前缀、design/plan 不分) 已废弃——与 superpowers README (specs=设计规格 / plans=实现计划) 不一致。**既有 `docs/plans/` 文档不迁移**, 仅新文档按 doc-type 入对应子目录。项目可在 `.agents-personal/AGENTS.md` 覆盖。

新增全局约定 / 占位符追加到本文件, 避免散落各 rule.

> `.agents-personal/` + `$USER_VAULT_PATH` 的删除护栏(删除前二次确认)已移至常驻 `model/agent-personal.md`, 本文不重复。
