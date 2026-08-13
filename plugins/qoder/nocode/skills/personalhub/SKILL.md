---
name: personalhub
description: ".agents-personal/ 聚合入口（hub），分发到 7 个子动作（init/write/search/check/tidy/snap/status）"
argument-hint: <sub-action> [args]
---

本文所说“调用 `<skill>` Skill”使用 `Skill(nocode:<skill>)`；“结构化决策”使用 `AskUserQuestion`。


# /personalhub：.agents-personal/ 管理入口

统一入口，分发到 7 个子动作。每个子动作也可以直接用独立命令调用。

## 用法

`/personalhub <sub-action> [args]`

## 子动作路由

| 子动作 | 做什么 | 转发到 | 独立命令 |
|---|---|---|---|
| `init` | 初始化 .agents-personal/ 结构 | 调用 `personal-init` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/personal-init` |
| `write` | 写入 wiki / rules / AGENTS.md（变量·语气·命名·约定） | 调用 `personal-distill` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/personal-distill` |
| `search` | 检索 .agents-personal/ 内容（wiki + rules + AGENTS.md 各分节） | 调用 `personal-recall` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/personal-recall` |
| `check` | 健康检查 | 调用 `personal-lint` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/personal-lint` |
| `tidy` | 自主维护（stale/prune/merge/promote） | 调用 `personal-dream` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/personal-dream` |
| `snap` | 手动触发备份快照 | 调用 `personal-snapshot` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/personal-snapshot` |
| `status` | 概览当前状态 | 内联执行（见下方） | — |

## 执行

### 解析子动作

从 `$ARGUMENTS` 取第一个词作为子动作，剩余部分作为子动作的参数传递。

无参数或不识别的子动作 → 输出用法表格：

```
/personalhub <sub-action>

  init     初始化 .agents-personal/
  write    写入 wiki/rules/AGENTS.md（变量·语气·命名·约定）
  search   检索已沉淀内容（wiki + rules + AGENTS.md 各分节）
  check    健康检查
  tidy     自主维护
  snap     手动备份快照
  status   概览当前状态
```

### init / write / search / check / tidy / snap

调对应的 `Skill()`，把剩余参数传进去。

### status

内联执行，输出 .agents-personal/ 的当前状态概览：

1. 检查 `.agents-personal/` 是否存在 → 不存在报 "未初始化，跑 `/personalhub init`"
2. 统计：
   - wiki: draft/ 页数 + pages/ 页数 + 最近更新时间
   - rules: 文件数 + AGENTS.md 触发条目数
   - AGENTS.md: 变量覆盖数 + 自定义分节列表（语气风格 / 命名惯例 / 协作约定等）
3. 快速健康检查（调 personal-lint 的核心检查，只报 error/warn 数量不展开）
4. 最近 5 条 log.md 记录

输出格式：

```
📂 .agents-personal/ 状态

  wiki:    3 draft + 8 pages    最近更新: 260625
  rules:   2 文件 / 2 触发条目
  AGENTS:  8 变量 / 3 分节 (命名惯例, 语气风格, 协作约定)
  健康:    0 error / 1 warn ✓
  
  最近操作:
    260625  distill: prompt-engineering → draft (stub)
    260624  promote: worktree-setup → pages (active)
    260624  distill: agent-catalog-rearch → pages (融合)
```
