# rules/

`nocode` 插件的**规则单源目录**。所有「触发式规则」（agent 命中某类任务时应该按需 Read 的具体
约束）都从这里的 `manifest.json` 生成出两条下游产物：常驻的 catalog 路由表和 PreToolUse 硬拦截
规则。

## 目录职责

| 路径 | 角色 |
|---|---|
| `manifest.json` | **唯一真值源**：buckets + rules 的完整定义 |
| `rule-<id>.md` | 具体规则正文，按需 `Read`（不进 SessionStart 常驻 context） |
| `rule-references/` | 预留：单条 rule 内容过大时拆分子文件的落点（当前为空，历史用例已随对应 rule 升级为 skill 而迁走） |

生成物（**不在本目录、禁手改**，由 `hooks/generate.mjs` 从 `manifest.json` 生成）：

- `model/agent-catalog-1.md`（…体量增长会按桶大小自动分片，当前只有 1 片）——SessionStart
  常驻注入的完整规则路由表
- `hooks/pretooluse-rules.json`——PreToolUse hook 消费的 Bash 命令拦截规则（block/inject）

## 为什么要「单源生成」而不是直接写 catalog

两个约束叠加逼出这个架构：

1. **完整路由必须常驻 context**（不用按需中转的 route skill）——否则存在「软触发漏」：某条规则
   没被扫到就是没被扫到，agent 不会知道自己漏看了。
2. **rule 的结构字段（`id` / `bucket` / `read`）分散写在多处很容易漂移**——manifest 改了但
   catalog 忘了同步，或者删了一条 rule 但别处还有 `also_buckets`/`depends_on` 悬空引用它。

所以让 `manifest.json` 当唯一真值源，`generate.mjs` 机械渲染出 catalog 和 pretooluse 两份产物，
`hooks/manifest.test.mjs` 校验 rule id 唯一 / bucket 引用不悬空 / depends_on 不悬空，SessionStart
的 `generate.mjs --check` 兜底报警（漂移只 warn 不阻断 session，靠 commit 前手动 `--check`
彻底避免漂移进 main）。

> 这层间接性只覆盖**结构**（id / bucket / read 路径），不覆盖**语义**——比如某条 rule 的 `guard`
> 字段和它 `pretooluse[].note` 里的文案是分别手写的两份独立文本，manifest 不会替你同步这两处的
> 措辞。改动某条规则的具体约束描述时，两处都要看一眼。

## manifest.json 字段说明

顶层两个字段：`buckets`（粗分类，当前 6 个）、`rules`（具体规则，当前 9 条）。

### buckets（当前 6 个）

规则的粗分类，agent 先扫 bucket 的 `trigger_summary` 判断要不要往下看子规则。

| 字段 | 含义 |
|---|---|
| `id` | bucket 标识，如 `git-lifecycle` / `review` / `design` / `memory` / `lark` / `figma` |
| `title` | 中文标题 |
| `trigger_summary` | 粗触发描述——命中就往下扫桶内 rule，不命中直接跳过整个桶 |
| `negatives` | 反例——即使字面像也不算命中的场景，减少误触发 |

### rules（当前 9 条）

每条 rule 的字段：

| 字段 | 含义 |
|---|---|
| `id` | 规则标识，同时是 `rule-<id>.md` 的文件名 slug（若该规则有独立正文文件） |
| `bucket` | 所属主桶 |
| `also_buckets` | 该规则同时挂到的其他桶（跨桶可路由，catalog 里会在那些桶下重复渲染同一行索引） |
| `trigger_short` | 一行索引提示，**实际渲染进常驻 catalog 的就是这一句**（仿 personal wiki `index.md` 的极简度） |
| `trigger_type` | `regex` / `regex+skill` / `skill` / `behavior`——触发判断的性质，纯 authoring 元数据，不参与生成 |
| `trigger_desc` | 中文长描述，说明触发/不触发的边界（含具体反例），纯 authoring 元数据，不进常驻文本 |
| `triggers` | 正则数组，用于自动化 eval（如 `nocode:rule-eval`）估算触发率，不是 hook 强制匹配，也不参与生成 |
| `action` | agent 命中后应该做的具体动作：`Read rules/rule-x.md`，或 `Skill(nocode:xxx)`，或直接内联指令 |
| `read` | 要 Read 的文件路径（`${CLAUDE_PLUGIN_ROOT}/rules/rule-x.md`）；为空表示没有独立正文文件，`trigger_short` 之外的信息住在触发它的 skill 自身 description/SKILL.md 里 |
| `summary` | 一句话摘要，**不进常驻正文**，只是 manifest 内的 authoring 文档，供人读懂这条 rule 讲什么 |
| `guard` | 关键约束，**不进常驻正文**——已确认这条约束要么在对应 `rules/rule-*.md` 详情文件里，要么在触发它的 skill 自身 SKILL.md 里，要么在同一条 rule 的 `pretooluse[].note` 里，本字段只是留个 authoring 摘要，避免重复维护三份地方都改 |
| `depends_on` | 依赖的其他 rule id——**语义关联，非强制顺序**；`hooks/manifest.test.mjs` 会校验这里引用的 id 必须存在 |
| `severity` | `advisory` / `warn` / `block`——规则重要度分级，纯 authoring 元数据，不参与生成（不代表实际 PreToolUse 是否拦截，实际拦截行为看 `pretooluse[].action`） |
| `lifecycle_stage` | `0 设计` / `1 隔离` / `2 实现` / `3 评审` / `4 收尾` / `cross`（跨阶段），纯 authoring 元数据，不参与生成 |
| `pretooluse` | 数组，每项 `{ pattern, action, note }`——`pattern` 是匹配 Bash 命令的正则，`action` 是 `block`（硬拦截）或 `inject`（提醒但放行），`note` 是展示给 agent 的理由文案，扁平化进 `hooks/pretooluse-rules.json` |

> `trigger_type`/`triggers`/`severity`/`lifecycle_stage`/`depends_on` 目前没有任何生成逻辑读取
> （`renderBucketBody` 只用 `id`/`trigger_short`/`read`/`bucket`/`also_buckets`；`genPretooluse`
> 只用 `id`/`pretooluse`），纯粹是 authoring 阶段留下的字段。新增 rule 时可以照抄现有条目填，
> 但不要指望它们驱动任何行为。

## 生成链路

```
rules/manifest.json  (唯一真值源, 改这里)
        │
        │  node hooks/generate.mjs
        ▼
  ┌─────────────────────────────────────────────┐
  │ model/agent-catalog-1.md (体量增长会自动分片) │  按桶切分, SHARD_LIMIT=9000 字符/片,
  │   (SessionStart 常驻注入的完整规则路由)        │  单条 rule 不跨片, 超 MAX_CATALOG_SHARDS(5)
  │                                               │  片直接 throw
  │ hooks/pretooluse-rules.json                  │  PreToolUse hook 拦截规则
  │   (Bash 命令 block / inject)                  │
  └─────────────────────────────────────────────┘
```

一致性校验：`node hooks/generate.mjs --check`（比对生成物与 manifest 重新渲染的结果，drift 就
exit 1 并列出哪些文件不一致）。SessionStart hook 会跑一次这个 check，漂移只 warn（不阻断
session）；commit 前建议手动跑一遍确保为 0 drift。

## rule 文件命名约定

`rules/rule-<id>.md`，`<id>` 与 manifest 里该 rule 的 `id` 字段严格一致。不是所有 rule 都有对应
文件——`action` 直接是 `Skill(nocode:xxx)` 的规则（如 `lark-project`）没有独立 `rule-*.md`，
`read` 字段为空，正文住在对应 skill 的 `SKILL.md` 里，manifest 只负责把用户意图路由过去。

当前 `rules/` 目录下有 7 个 `rule-*.md` 正文文件，对应 manifest 里的 7 条 rule：
`codex-review` / `figma-design-read` / `git-freshness` / `git-inspection` / `git-worktree` /
`push-summary` / `superpowers-brainstorming`（最后一条是覆盖 vendor 进来的 superpowers skill
默认行为）。`personal-deletion-guard` 的 `read` 指向 `model/agent-personal.md`（不在本目录）；
`lark-project` 没有 `read` 文件，正文住在 `skills/lark-project/SKILL.md` 里。

> 曾经 `dev-define`/`dev-design`/`dev-plan`/`dev-build`/`dev-verify`/`dev-land`/`dev-review`/
> `dev-finish-branch`/`pd-*`/`pdflow`/`red-blue-deep`/`lark-read` 等 17 条 rule 也在这个 manifest
> 里，但它们的 `trigger_desc` 只是把对应 skill 自身 description 又抄一遍，`guard` 要么为空要么
> 已被 pretooluse/skill 文档覆盖——纯重复，已在 9.3.0/9.4.0 两轮改动中从 manifest 里彻底删除。

## rule-*.md 正文的常见结构

不是强制 schema，但现有文件普遍遵循：

1. 标题 + 一段话点明这条规则相对哪个 skill/默认行为是覆盖，还是独立流程
2. `## 触发` / `## 不触发`——展开 manifest `trigger_desc` 没写完的边界细节
3. 规则正文（流程步骤 / 路径模板 / 决策表，视复杂度而定）
4. `## 不要`——反模式清单

## 与 model/ catalog 分片的关系

`model/` 目录下的 SessionStart segment 里，`model-catalog-1` 对应 `model/agent-catalog-1.md`
（`model-catalog-2` ~ `model-catalog-5` 预留，体量小时空段静默跳过）。这个分片是**索引**，不是
详情页——每条 rule 只有一行「`trigger_short` + 读路径指针」，仿 personal wiki `index.md` 的
极简度。`rules/rule-*.md` 本身**不**在 SessionStart 注入范围内——agent 看到 catalog 里某条规则
命中后，按 `read` 字段指的路径按需 `Read` 对应 `rule-*.md` 取完整触发条件和约束。

这是本插件「规则知识 (reactive)」与「编排知识 (proactive)」两类知识分离架构的一半——另一半是
`nocode:devflow` 等 workflow skill（编排知识，需要主动调起或用户 `/调`，不走 manifest/catalog
这条生成链路，也不再需要在 manifest 里登记白名单）。

## 相关命令

- `node hooks/generate.mjs` —— 重新生成 catalog 分片 + pretooluse-rules
- `node hooks/generate.mjs --check` —— 只校验一致性，不写文件，drift 则 exit 1
- `node --test 'hooks/*.test.mjs'` —— 跑全部 hooks 测试（含 `generate.test.mjs` /
  `manifest.test.mjs`，直接覆盖本目录生成逻辑）
- `nocode:rule-eval` skill —— 用 manifest 里每条 rule 的 `triggers` 正则跑触发率 eval（route-recall
  + 混淆矩阵），评估规则路由质量
