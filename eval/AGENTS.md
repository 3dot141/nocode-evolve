# AGENTS.md — eval/

## 这是什么

rule-eval：测**规则路由触发率**——给一句该触发某条 `rules/rule-*.md` 的话术，在重建
SessionStart 上下文（`model/*.md` + `agent-catalog-*.md`）+ 任务动量 preamble 的压力下，
隔离 subagent 是否正确把 `primary_route` 选中目标 rule（momentum-aware route-recall，
≥0.8 = PASS）。这是"措辞守门"层，不测执行质量（那是 `benchmark/` 的职责），也不等同于
"压力下是否真的遵守"——后者在设计文档"后记"里已经 pivot 到另一条路（`UserPromptSubmit`
hook 硬提醒机制），不再靠这套 eval 覆盖。

设计依据：`docs/plans/3dot141/260526-rule-trigger-eval-design.md`（judge 机制、判分公式、
fixture 格式、负样本分型、混淆矩阵、失败分型全部在这）。改判分逻辑或加 fixture 前先读。

## 跑评测的命令入口 —— 重要：不在插件分发范围内

入口是 `.claude/commands/rule-eval.md`（`/rule-eval [<rule-id> | --all]`）。**这个文件被
`.gitignore` 第 3 行 `.claude/` 整体忽略，不随插件分发**——用
`git ls-files .claude/commands/rule-eval.md` 可验证它未被 git 跟踪。只有在本仓库本地
（`.claude/commands/` 目录下手动放了这份文件）开发时才存在/可用；clone 一份干净仓库不会
自带它。

演进历史（解释为什么现状如此）：
1. 最初是插件级 `commands/rule-eval.md`（commit `ff7f36a`，v1 harness）
2. 迁移成插件级 `skills/rule-eval/SKILL.md`（commit `011f83a`，"skillify-route Task 11"）
3. 后又决定"移出插件"，回退成仓库本地 `.claude/commands/rule-eval.md`
   （commit `17ed2d2`，"rule-eval 移出插件"，同批还删了 `commands/` 目录本体）

即：**当前 nocode 插件本体（会被安装/分发的部分）不包含任何 rule-eval 的调用入口**。
`eval/cases/` 和 `eval/preambles/` 是仍然入 git 的公开素材，但驱动它们跑起来的命令只存在于
本仓库本地 dev 环境。要在别处复现，得照设计文档手动重建流程，或自己在
`.claude/commands/` 下补一份等价命令。

### 判分流程（供理解/复现）

orchestrator（主 agent）读 `model/agent-about.md` + `model/agent-personal.md` +
`model/agent-karpathy.md` + 全部 `model/agent-catalog-*.md` 分片（重建 SessionStart 载荷）
+ `eval/cases/<rule-id>.md`（fixture）+ 对应 `eval/preambles/<profile>.md`，对每条样本
× 每个 `preamble_profile` 派一个隔离 `Agent(general-purpose)` subagent（**不透露期望答案 /
不暗示该走哪条 / 不说这是测试**），subagent 只能输出严格 JSON：
`{primary_route, secondary_routes, read_files, will_do_actions, reason}`，orchestrator
只做 exact-match 机械判分，不用自然语言判断代替。

判分口径三项：
- **route-recall**（主门）= 正样本中 `primary_route == 目标 rule` 的占比，同一正样本多
  preamble 取最严，**≥0.8 PASS**。
- **steal 率** = 负样本（尤其 `[other-rule-primary]` 型）误判成本 rule 的占比，**>0.1 WARNING**。
- **intent-signal** = 命中样本里 `will_do_actions ⊇ must_action_ids` 且不含
  `forbidden_action_ids` 的占比——**只是意图信号，不是"真遵守"**，报告里必须标清这个区别，
  不能混叙成"合规率"。

## 新增 case（fixture）的格式约定

文件：`eval/cases/<rule-id>.md`，一个 rule 一个文件，Markdown 里用固定结构（不是 JSON）：

```markdown
# rule-<id>
primary_route: <rule-id>
acceptable_alternates: []        # 真两可才填；进"歧义桶"，不进 route-recall 分子
preamble_profiles: [cold, mid-task-momentum]

default_intent:
  must_action_ids: [...]
  forbidden_action_ids: [...]

# action-id 词表(含干扰/反例项，供 will_do_actions 选择空间对齐):
#   ...

## positive
- 该触发到这条 rule 的话术，一行一条

## negative
- [other-rule-primary] 该去别的 rule 的话术          # → 目标 rule（行尾注释）
- [near-miss]          形似但不该触发的话术
- [explicit-exclusion] 显式排除场景
- [tool-only]          纯查询/只读操作
```

负样本要求**每种分型标签 ≥2 条**（设计文档 W3 项）。`## positive` / `## negative` 下面
每条都是纯文本话术，不要额外套 JSON 或加序号。

## 重要漂移：fixture 里的 `primary_route` 已经和 `rules/manifest.json` 对不上

`rules/manifest.json` 当前 24 条 rule 的 id 已全部改成 `dev-*` 前缀
（`dev-define` / `dev-design` / `dev-plan` / `dev-build` / `dev-verify` /
`dev-finish-branch` 等，`model/agent-catalog-*.md` 里展示的 section 标题也是这些
`dev-*` 名字）。但 `eval/cases/` 下现存的 6 个 fixture——`build.md` / `define.md` /
`design.md` / `finish-branch.md` / `plan.md` / `verify.md`——里的 `primary_route`
字段写的还是旧的短 id（`build` / `define` / `design` / `finish-branch` / `plan` /
`verify`，**没有** `dev-` 前缀）。这批 fixture 是 v1 harness 时代（commit `ff7f36a`，
260526）的产物，早于 rule 改名。

判分是严格 exact-match：如果 subagent 现在真的输出 `dev-build`，而 fixture 期望的是
`build`，两者永远对不上，会得到"route-recall = 0"的**假阴性**——不代表触发措辞真的失效，
只代表 fixture 没跟着 rule 改名同步更新。**用这批 fixture 出报告前，先确认
subagent 实际会吐出什么 id**（读一遍 `model/agent-catalog-*.md` 对应 section 的标题），
必要时把 fixture 的 `primary_route` 同步改成当前的 `dev-*` 命名，再跑判分。

## 覆盖缺口

`rules/manifest.json` 里有 24 条 rule，`eval/cases/` 只覆盖 6 条（约 25%）：
build / define / design / finish-branch / plan / verify。其余 18 条（如
`push-summary` / `codex-review` / `git-worktree` / `pd-research` / `pd-prd` /
`pd-ix` / `pd-vd` / `dev-land` / `dev-review` 等）都没有 fixture。`--all` 模式
（读 `eval/cases/` 下全部 fixture + 汇总混淆矩阵 + 列出 catalog 有条目但无 fixture 的
rule）在设计文档和命令文件里都已经设计好了，只是没有人持续补新 rule 的 fixture——
新增/大改某条 rule 的触发措辞时，按设计文档 S3 段的软门约定，理应配一份 fixture。

## preambles/ 是共享情境铺垫，不是 case

`preambles/cold.md`（冷启动，无前情）和 `preambles/mid-task-momentum.md`（模拟深陷另一
任务动量中的压力场景，复现"该触发但没被认出"这一真实失败模式）是被所有 fixture 共享引用
的情境文本，不放正负样本。新增 profile 时：
1. 在 `eval/preambles/<new-profile>.md` 写情境铺垫（格式对齐现有两份：一句话场景设定）。
2. 要在需要用到它的 fixture 的 `preamble_profiles: [...]` 里手动登记，否则不会被跑到。

## 不要乱动

`cases/*.md` 和 `preambles/*.md` 都是手写 fixture（非生成物），不是脚本产出。改动时保持
既有的头部字段结构（`primary_route` / `acceptable_alternates` / `preamble_profiles` /
`default_intent` / action-id 词表注释）和负样本分型标签格式，否则 orchestrator 按固定
结构解析 fixture 时会读不出字段。
