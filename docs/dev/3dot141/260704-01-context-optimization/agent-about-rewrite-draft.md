> 角色、能力

# 角色配置

## 架构总览

nocode 用 SessionStart + skills + PreToolUse 三层机制:

- **规则**: SessionStart 常驻注入完整路由到 `agent-catalog-*.md`。每条消息先扫 catalog 各粗桶 trigger_summary, 命中 → `Read` 对应 `rules/rule-*.md`(完整触发协议见 `agent-catalog-using.md`, 不重复)。
- **编排**: `Skill(nocode:devflow)` 可被主动调起(或用户 `/调`)给流程导航, 不替执行, 触发条件见 `agent-catalog-using.md`。
- **硬护栏**: `PreToolUse` 对危险 Bash 命令自动 inject/block, 不依赖 agent 自觉。

行为基线见 `agent-karpathy.md` 12 条工程准则。

# 行为准则

### 全程中文(含思考)

不论输入语言, 回复和中间推理全程中文; 代码 / 命令 / 专有名词 / 标识符保持原样。

### 推理外化

判断类输出(设计 / 选型 / 诊断 / 对比 / review / 架构)一次性摆出推理链: 现状 → 推断 → 结论, 标 已验证 / 推断 / 假设, 链条断裂主动暴露("不知道 X, 需要 Y"), 不堆术语不类比。触发: 含"为什么 / 怎么权衡"。不触发: 纯执行 / 事实查询。

### 陌生代码先拉高视角

碰到不熟悉的代码 / 子系统先答"这个模块干嘛 + 上下游关系", 再钻细节。不触发: 已知精确位置的定向修改。

### 方案类工作全程基于真实代码核对

出方案(设计文档 / PRD / 选型 / 重构 / API 设计)前中后都基于真实代码当前状态核对, 不凭记忆推断。前: 列清涉及的文件 / caller / 约束, 逐项 Read 过再动笔; 中: 每个决策点对照真实代码, 引用 `path:line`; 后: 产出逐项回扫确认仍成立。与 `git-freshness` 互补(commit 层 vs 文件内容层)。触发: 出方案任意阶段。

### 评估类提问调红蓝军

用户问"X 行不行 / 选 A 还是 B", 或说"红蓝军 / 第一性原理"——调 `Skill(nocode:red-blue-deep)`, 不要先给结论。

### 代码搜索默认走 semble-search

默认 `Agent(subagent_type:"nocode:semble-search")`, 不用 Grep/Glob 盲扫。全不可用退 `rg` 并明说 fallback。不触发(用原生工具): 已知精确路径直接 Read、单行 literal 匹配用 rg、文件名 pattern 用 find/Glob。grep 一律换 rg, rg 不可用才退 grep 并明说。

### 常驻 git 习惯(无需触发, 始终生效)

- **git-inspection**: 连续跑 ≥2 个只读 git 命令时用 `&&` 串成一条 Bash call, 段间插 `echo "---<label>"`。
- **git-freshness**: 即将做设计动作 / 代码搜索(含 `Agent(semble-search)`, PreToolUse hook 只拦裸 grep/rg, 这条不靠 hook)/ 多文件 Read 探源前, 跑:
  ```
  node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" --max-behind=5 --ttl=7200
  ```
  exit 2(behind≥5)→ 停手三选(pull-rebase / 接受 / 跳过)。cache TTL 2h 内不 fetch。`git worktree add` 那刻由 `rule-git-worktree` 覆盖, 之后长期动作归本条。

### 偏离 rule/skill 触发需用户显式授权

命中后要跳过, 只认显式否定词("不要 X / 别 X / 跳过 X")。模糊信号("先出概览 / 草稿 / 简单弄一下")不算授权, 拿不准就问。

> ❌ 用户说"先出个设计概览"≠"弃用 worktree"的授权, 仍要走 worktree。
> ✅ 识别模糊信号 ≠ 显式弃用, 拿不准先问, 用户明说"不要 worktree"才跳过。

### 用户离场信号

用户说"我要走了 / 先这样 / 收工"时: 1) 待确认事项(未 commit / 未 push / 未关 Gate)**加粗**呈现; 2) 给的选项都朝根因方案设计, 不给临时绕过项。

### AskUserQuestion 确认内容必须 payload 自足

harness 只保证渲染回合末尾文本, 工具调用之间的自由文本经常被吞。所以:

- 待确认内容写进 AskUserQuestion 自身——短字段把实际值写进 `question`; 长内容(计划 / 清单)放 `options[].preview`。
- 不写"以上 / 上述…确认?"这类前文指代——可能根本没渲染。
- 超长内容(数百行)拆两步: 展示步作为回合末尾文本输出后**结束回合**; 确认步在用户回应后的下一回合发起。

> ❌ 收集完命令同回合接着输出百行计划 + 紧跟 AskUserQuestion——文本被吞, 用户没看到就被要求确认。
> ✅ 计划作为回合末尾文本完整输出后停手, 用户回应后下一回合才发确认。

已落盘文件的确认给路径 + 摘要即可, 不必全文进 payload。

# 全局占位符

| 占位符 | 默认值 | 说明 |
|---|---|---|
| `{username}` | `3dot141` | 路径分目录 / 归属标记 |
| `{NOCODE_SKILL_REF}` | `${NOCODE_SKILL_REF}` | 共享指南绝对路径(env 自动写入) |

产出路径变量(`{yymmdd}` 当日日期, `{serial}` 两位序号, `{topic}` kebab-case, 同 topic 共享目录):

| 变量 | 默认值 | 对应 skill |
|---|---|---|
| `{pd_research_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/research-report.md` | pd-research |
| `{pd_prd_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.prd.md` | pd-prd |
| `{pd_ix_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.ix.md` | pd-ix |
| `{pd_vd_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.vd.md` | pd-vd |
| `{dev_design_output}` | `docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-design.md` | dev-design |
| `{dev_plan_output}` | `docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-plan.md` | dev-plan |

工程可在 `.agents-personal/AGENTS.md` 或 `CLAUDE.md` 覆盖任意条, 优先级: 项目 `.agents-personal/AGENTS.md` > 项目 `CLAUDE.md`/`AGENTS.md` > 本文件兜底。

# 全局约定

主分支 `main`; 文档产出按流程 + topic 聚合, 路径见上表; 时间格式 `yymmdd`。旧路径(`docs/superpowers/*` / `docs/plans/`)已废弃, 既有文档不迁移。
