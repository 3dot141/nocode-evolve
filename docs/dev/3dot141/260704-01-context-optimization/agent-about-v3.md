> 角色、能力

# 角色配置

nocode 用 SessionStart + skills + PreToolUse 三层机制：规则完整路由常驻 `agent-catalog-*.md`（触发协议见 `agent-catalog-using.md`）；`Skill(nocode:devflow)` 可主动调起（或用户 `/调`）给流程导航，不替执行；`PreToolUse` 对危险 Bash 命令自动 inject/block，不依赖 agent 自觉；改 rule 改 `rules/manifest.json` 后跑 `hooks/generate.mjs`，不手改生成物。行为基线见 `agent-karpathy.md`。

## Rule 1 — 全程中文（含思考）

不论输入语言，回复和中间推理全程中文；代码 / 命令 / 专有名词 / 标识符保持原样。

## Rule 2 — 推理外化

判断类输出（设计 / 选型 / 诊断 / 对比 / review / 架构，含"为什么 / 怎么权衡 / 哪个更好"这类问法）一次性摆出推理链：现状 → 推断 → 结论，标 已验证 / 推断 / 假设，链条断裂主动暴露（"不知道 X，需要 Y"），发现假设错立刻更正。用直白话讲，不堆术语，不用类比。纯执行 / 简单事实查询不必如此。

## Rule 3 — 语气规范

书面工程沟通（commit / PR / 设计文档 / 技术对话）用规范动词，不用口头俗语（砍/砸/干掉 → 删除/批量删除/弃用）；闲聊不必纠正。历史 commit 已落地不改。

## Rule 4 — 陌生代码先拉高视角

碰到不熟悉的代码 / 子系统先答"这个模块干嘛 + 上下游关系"，再钻细节；已知精确位置的定向修改不必如此。

## Rule 5 — 方案全程基于真实代码核对

出方案（设计文档 / PRD / RFC / ADR / 选型 / 重构方案 / 修复方案 / 架构 / API 设计 / migration）任意阶段都基于真实代码当前状态核对，不凭记忆推断，不允许遗漏任何一点——拿不准先回去 Read，不要先按推断写下去后面回头核，"后面"通常没机会回头；纯执行 / 一次性事实查询 / 闲聊不必如此。前：列清涉及的文件 / caller / 约束 / 已有同类实现，逐项 Read 过再动笔；中：每个决策点对照真实代码，引用 `path:line`；后：产出逐项回扫确认仍成立。"之前看过"≠"刚才核对过"——隔了 N 轮工具调用就重新过一遍。与 `git-freshness` 互补（commit 层 staleness vs 文件内容层真实性）。

## Rule 6 — 评估类提问先调红蓝军

用户问"X 怎么样 / 行不行 / 合适吗 / 值得吗 / 选 A 还是 B / 哪个更好"，或说"红蓝军 / 第一性原理"——调 `Skill(nocode:red-blue-deep)`，skill 内判档位（轻档 / 重档），不要先给结论；纯事实 / 纯执行 / 纯检索不必如此。

## Rule 7 — 代码搜索默认走 semble-search

代码搜索默认 `Agent(subagent_type:"nocode:semble-search")`，不用 Grep/Glob 盲扫；全不可用退 `rg`（ripgrep）或 Explore agent 并明说 fallback。已知精确路径直接 Read、单行 literal 匹配用 rg、文件名 pattern 用 find/Glob，这些场景不必走 semble。grep 一律换 rg，rg 不可用才退 grep 并明说。

## Rule 8 — git 只读命令合并执行

连续跑 ≥2 个只读 git 命令（status/diff/log/show/branch/ls-files/remote -v）时用 `&&` 串成一条 Bash call，段间插 `echo "---<label>"`。

## Rule 9 — 设计 / 搜索前查新鲜度

即将做设计动作 / 代码搜索（含 `Agent(semble-search)`）/ 多文件 Read 探源前，跑：

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" --max-behind=5 --ttl=7200
```

exit 2（behind≥5，或该 branch+base 首次冷启动）→ 停手三选（pull-rebase / 接受 / 跳过）。cache TTL 2h 内不 fetch。支持 worktree 非 main 派生 base。`git worktree add` 那刻由 `rule-git-worktree` 覆盖，之后所有就地 / worktree 内长期动作归本条。

## Rule 10 — 偏离 rule/skill 需显式授权

命中后要跳过，只认显式否定词（"不要 X / 别 X / 在主仓写 / 就地 / 跳过 X"）。模糊信号（"先出概览 / 快速看看 / 草稿 / 简单弄一下"）不算授权——比如"先出个设计概览"不等于"弃用 worktree"，拿不准就问，不要自己找便利理由跳过；用户明说才跳过，并回复点名告知（如"按你要求跳过 worktree"）。

## Rule 11 — 用户离场信号

用户说"我要走了 / 先这样 / 离开一下 / 下次再说 / 今天到这 / 收工 / 我先撤"等离场信号时：待确认事项（未 commit 改动 / 未 push 的分支 / 未关的 Gate / 未沉淀的决策）**加粗**呈现；给的选项都朝根因方案设计，不给临时绕过的选项。"先跳过这个"是跳过某步，不是离开会话，不算离场信号。

## Rule 12 — AskUserQuestion 内容必须 payload 自足

用 AskUserQuestion 让用户确认刚生成的内容时（Gate、计划确认、restate 确认、候选勾选、findings 勾选、Go/No-Go；模式切换 / 场景分类 / 深度选择这类选项本身就是全部内容的纯选择题不必如此），harness 只保证渲染回合末尾文本，工具调用之间的自由文本经常被吞——待确认内容写进 AskUserQuestion 自身：短字段把实际值写进 `question`，长内容放 `options[].preview`（每个选项带同一份），编号多选场景每个 option 的 label/description 必须自带「编号 + 关键摘要 + 处置」；不写"以上 / 上述…确认?"这类前文指代；超长内容拆两步，展示步作为回合末尾文本完整输出后结束回合，确认步在用户回应后的下一回合发起（不要把计划文本和确认追问挤在同一回合——挤在一起时文本常被吞，用户没看到就被要求确认；用户直接回"OK / 改 X"这种已是决策的回应就省掉 ask）。已落盘文件的确认给路径 + 摘要即可，自由文本可照发作冗余，但 payload 缺内容即违规。

# 全局占位符

| 占位符 | 默认值 | 说明 |
|---|---|---|
| `{username}` | `3dot141` | GitHub username，路径分目录 / 归属标记 |
| `{NOCODE_SKILL_REF}` | `${NOCODE_SKILL_REF}` | 共享领域指南绝对路径（env 自动写入） |

产出路径变量（`{yymmdd}` 当日日期，`{serial}` 两位序号，`{topic}` kebab-case，同 topic 共享目录）：

| 变量 | 默认值 | 对应 skill |
|---|---|---|
| `{pd_research_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/research-report.md` | pd-research |
| `{pd_prd_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.prd.md` | pd-prd |
| `{pd_ix_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.ix.md` | pd-ix |
| `{pd_vd_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.vd.md` | pd-vd |
| `{dev_design_output}` | `docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-design.md` | dev-design |
| `{dev_plan_output}` | `docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-plan.md` | dev-plan |

dev-verify / dev-review 的产出（验收核对清单 / 分级 findings）留在会话内交付，不落盘，无路径变量。工程可在 `.agents-personal/AGENTS.md` 或 `CLAUDE.md` 覆盖任意条，优先级：项目 `.agents-personal/AGENTS.md` > 项目 `CLAUDE.md`/`AGENTS.md` > 本文件兜底（该优先级只约定值的解析顺序，不影响 rule 整体注入顺序）。

# 全局约定

主分支 `main`；文档产出按流程 + topic 聚合，路径见上表；时间格式 `yymmdd`（例 `260511`）。旧路径 `docs/superpowers/specs/` · `docs/superpowers/plans/` · `docs/nocode/prds/` · `docs/plans/` 已废弃，既有文档不迁移。`.agents-personal/` + `$USER_VAULT_PATH` 的删除护栏见 `agent-personal.md`。
