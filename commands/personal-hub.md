---
description: .agents-personal/ 统一管理入口（hub），分发到 7 个子动作（init/write/search/check/tidy/snap/status）
argument-hint: <sub-action> [args]
---

# /personal-hub：.agents-personal/ 管理入口

统一入口，分发到 7 个子动作。每个子动作也可以直接用独立命令调用。

## 用法

`/personal-hub <sub-action> [args]`

## 子动作路由

| 子动作 | 做什么 | 转发到 | 独立命令 |
|---|---|---|---|
| `init` | 初始化 .agents-personal/ 结构 | `Skill(nocode-evolve:personal-init)` | `/personal-hub-init` |
| `write` | 写入 wiki + rules + AGENTS.md | `Skill(nocode-evolve:personal-distill)` | `/personal-hub-distill` |
| `search` | 检索 .agents-personal/ 内容 | `Skill(nocode-evolve:personal-recall)` | `/personal-hub-recall` |
| `check` | 健康检查 | `Skill(nocode-evolve:personal-lint)` | `/personal-hub-lint` |
| `tidy` | 自主维护（stale/prune/merge/promote） | `Skill(nocode-evolve:personal-dream)` | `/personal-hub-dream` |
| `snap` | 手动触发备份快照 | `node "${CLAUDE_PLUGIN_ROOT}/scripts/personal-hub-snapshot.mjs" --json` | — |
| `status` | 概览当前状态 | 内联执行（见下方） | — |

## 执行

### 解析子动作

从 `$ARGUMENTS` 取第一个词作为子动作，剩余部分作为子动作的参数传递。

无参数或不识别的子动作 → 输出用法表格：

```
/personal-hub <sub-action>

  init     初始化 .agents-personal/
  write    写入 wiki/rules/AGENTS.md
  search   检索已沉淀内容
  check    健康检查
  tidy     自主维护
  snap     手动备份快照
  status   概览当前状态
```

### init / write / search / check / tidy

调对应的 `Skill()`，把剩余参数传进去。

### snap

直接跑脚本：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/personal-hub-snapshot.mjs" --json
```

输出快照结果（committed / no_changes / error）。

### status

内联执行，输出 .agents-personal/ 的当前状态概览：

1. 检查 `.agents-personal/` 是否存在 → 不存在报 "未初始化，跑 `/personal-hub init`"
2. 统计：
   - wiki: draft/ 页数 + pages/ 页数 + 最近更新时间
   - rules: 文件数 + AGENTS.md 触发条目数
   - AGENTS.md: 变量覆盖数
3. 快速健康检查（调 personal-lint 的核心检查，只报 error/warn 数量不展开）
4. 最近 5 条 log.md 记录

输出格式：

```
📂 .agents-personal/ 状态

  wiki:    3 draft + 8 pages    最近更新: 260625
  rules:   2 文件 / 2 触发条目
  变量:    8 个覆盖
  健康:    0 error / 1 warn ✓
  
  最近操作:
    260625  distill: prompt-engineering → draft (stub)
    260624  promote: worktree-setup → pages (active)
    260624  distill: agent-catalog-rearch → pages (融合)
```
