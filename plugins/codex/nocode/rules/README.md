# rules/

`nocode` 插件的**规则单源目录**。每条「触发式规则」（agent 命中某类任务时应该按需 `Read` 的具体
约束）直接以 **frontmatter + 正文** 的形式活在自己的 `rule-<id>.md` 文件里——没有 `manifest.json`
这层中转，一个文件就是一条规则的完整单源。

## 目录职责

| 路径 | 角色 |
|---|---|
| `rule-<id>.md` | 唯一真值源：顶部 frontmatter（`name` / `description` / `skip`）+ 正文（agent 命中后按需 `Read` 的具体约束，不进 SessionStart 常驻 context） |
| `rule-references/` | 预留：单条 rule 内容过大时拆分子文件的落点（当前为空，历史用例已随对应 rule 升级为 skill 而迁走） |

生成物（**不在本目录、禁手改**）：

- `model/agent-rule-catalog-1.md`（…体量增长会自动分片）——由 `scripts/compile.rule.js` 扫描本
  目录全部 `rule-*.md` 的 frontmatter 编译出的扁平规则目录表，SessionStart 常驻注入
- `hooks/pretooluse-rules.json`——由 `scripts/compile.hooks.js` 编译，PreToolUse hook 消费的 Bash
  命令拦截规则（block/inject）。**这条链与本目录完全独立**——规则硬编码在 `compile.hooks.js`
  内，不读本目录任何文件

## 为什么是「每文件自带 frontmatter」而不是「桶 + manifest」

早期版本用 `rules/manifest.json` 当唯一真值源、按「桶」（bucket）把多条规则分组、`generate.mjs`
机械渲染出 catalog。这层间接性解决了「完整路由必须常驻 context」的问题，但引入了新的维护成本：
manifest 的字段（`id`/`bucket`/`read`/`trigger_short`…）与实际文件内容分居两处，容易漂移；桶级的
`trigger_summary`/`negatives` 是独立维护的一段文本，跟桶内每条规则自己的边界描述重复。

现在改成仿 SKILL.md 的做法——每个 `rule-<id>.md` 顶部自带 `name`/`description`/`skip`
frontmatter，`description` 一句话内同时承担粗筛（值不值得往下看）和细筛（具体触发/不触发边界）
两个职责，不再需要「桶」这层中间抽象。`scripts/compile.rule.js` 只做一件事：glob 全部
`rule-*.md`，读 frontmatter，渲染成扁平表格。改一条规则的触发条件，只改这一个文件，不用同步
manifest。

## frontmatter 字段说明

```yaml
---
name: git-worktree
description: >-
  新建分支 / 开 worktree 时触发——原则: ... 不触发: ...
skip: false
---
```

| 字段 | 含义 |
|---|---|
| `name` | 规则标识，同时是渲染进 catalog 表格「文件相对地址」列对应的规则名 |
| `description` | 一句话触发描述，含正例边界和「不触发」负例——**这是渲染进常驻 catalog 表格的唯一内容**，仿 skill description 的密度自筛，不再有单独的详情/索引两层文本 |
| `skip` | `true` 时该规则不渲染进 catalog（数据仍是一份完整文件，只是不进常驻路由表），用于触发条件已被 skill 自身 description 完整覆盖、或该规则本身就常驻在别处（非按需触发）的场景 |

`description` 用 YAML 折叠标量（`>-`）书写多行——解析时单换行会折成空格，最终变成表格里的一行
文本，不需要手动把长描述压成一行再粘贴。

## 不是所有规则都需要 `rule-*.md` 文件

两类规则不进本目录的编译链，各有各的理由：

- **纯 `$xxx` 路由的规则**（如飞书项目管理）——Claude Code 原生的 skill 发现机制
  已经会把每个 skill 自己 `SKILL.md` frontmatter 的 `description` 曝光给 model 做调用判断，本目录
  再放一条重复的路由规则是纯冗余。这类触发条件写在对应 skill 自己的 `description` 里就够，不建
  `rule-*.md`。
- **本来就常驻、不需要「按需触发」的规则**（如 `.agents-personal/` 删除护栏）——内容永久活在
  `model/agent-personal.md` 里（每次 SessionStart 都注入，不需要 catalog 指路才能被看到）；它的
  PreToolUse 硬拦截 pattern 直接写进 `scripts/compile.hooks.js`（与本目录规则的编译链彻底独立）。

## 当前规则清单

`rules/` 目录下 6 个 `rule-*.md` 正文文件，均会被 `scripts/compile.rule.js` 编译进
`model/agent-rule-catalog-1.md`：

`codex-review` / `figma-design-read` / `git-freshness` / `git-inspection` / `git-worktree` /
`superpowers-brainstorming`（最后一条是覆盖 vendor 进来的 superpowers skill 默认行为）。

> `push-summary`（PR title/body 内容契约）已迁出本目录，内容搬到
> `skills/dev-land/references/pr-body-contract.md`——它只在 `dev-land` 这一个
> skill 的流程内使用，不是通用的插件级触发规则，不适合再放在这里跟全局路由绑在一起。

> 曾经 `dev-define`/`dev-design`/`dev-plan`/`dev-build`/`dev-verify`/`dev-land`/`dev-review`/
> `dev-land`/`pd-*`/`pdflow`/`red-blue-deep`/`lark-read`/`lark-project`/
> `personal-deletion-guard` 等条目也在旧 manifest 里，但它们要么纯重复 skill 自身 description，
> 要么根本不该走「按需触发」这条编译链——已在历次改动中从这份清单里彻底删除（`personal-deletion-guard`
> 的 PreToolUse pattern 仍在，只是搬到了 `scripts/compile.hooks.js` 独立维护）。

## rule-*.md 正文的常见结构

不是强制 schema，但现有文件普遍遵循：

1. frontmatter（`name`/`description`/`skip`）
2. 标题 + 一段话点明这条规则相对哪个 skill/默认行为是覆盖，还是独立流程
3. `## 触发` / `## 不触发`——展开 frontmatter `description` 没写完的边界细节
4. 规则正文（流程步骤 / 路径模板 / 决策表，视复杂度而定）
5. `## 不要`——反模式清单

## 与 model/ catalog 分片的关系

`model/` 目录下的 SessionStart segment 里，`model-rule-catalog-1` 对应
`model/agent-rule-catalog-1.md`（`model-rule-catalog-2` ~ `model-rule-catalog-5` 预留，体量小时
空段静默跳过）。这个分片是**索引**，不是详情页——每条规则只有一行「文件相对地址 + description」，
仿 personal wiki `index.md` 的极简度。`rules/rule-*.md` 本身**不**在 SessionStart 注入范围
内——agent 看到 catalog 表格里某条规则命中后，按「文件相对地址」列（相对 `{PLUGIN_ROOT}`）
按需 `Read` 对应文件取完整触发条件和约束。

这是本插件「规则知识 (reactive)」与「编排知识 (proactive)」两类知识分离架构的一半——另一半是
`nocode:devflow` 等 workflow skill（编排知识，需要主动调起或用户 `/调`，不走本目录的编译链）。

## 相关命令

- `node scripts/compile.rule.js` —— 重新生成 `model/agent-rule-catalog-N.md`
- `node scripts/compile.rule.js --check` —— 只校验一致性，不写文件，drift 则 `exit 1`
- `node scripts/compile.hooks.js` / `--check` —— PreToolUse 拦截规则那条独立链，同上用法
- `node --test 'hooks/*.test.mjs'` —— 跑全部 hooks 测试（含覆盖两条编译链的用例）
