---
name: projecthub
description: "项目子目录 AGENTS.md + README.md 聚合入口（hub），分发到 6 个子动作（init/write/search/check/dream/status）"
argument-hint: <sub-action> [args]
---

本文所说“调用 `<skill>` Skill”使用 `Skill(nocode:<skill>)`；“结构化决策”使用 `AskUserQuestion`。



# /projecthub：项目子目录文档管理入口

统一入口，管理项目子目录的 AGENTS.md（agent 工作约束）和 README.md（人类可读文档）。每个子动作也可以直接用独立命令调用。

## 与 personalhub 的区别

| | personalhub | projecthub |
|---|---|---|
| 管什么 | `.agents-personal/`（私有知识库） | 项目子目录的 AGENTS.md + README.md |
| 入仓 | gitignored | 版本控制，共享 |
| 受众 | 仅当前用户的 agent | 所有协作者的 agent + 人类 |
| 文件 | wiki/ + rules/ + AGENTS.md | 各子目录的 AGENTS.md + README.md |

## 用法

`/projecthub <sub-action> [args]`

## 子动作路由

| 子动作 | 做什么 | 转发到 | 独立命令 |
|---|---|---|---|
| `write` | 为指定目录写入/更新 AGENTS.md + README.md | 调用 `project-distill` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/project-distill` |
| `dream` | 递归：选定目录，逐层扫子目录，批量生成 | 调用 `project-dream` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/project-dream` |
| `search` | 搜索项目内所有子目录 AGENTS.md / README.md | 调用 `project-recall` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/project-recall` |
| `check` | 健康检查（stale 引用 / 覆盖缺口） | 调用 `project-lint` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` | `/project-lint` |
| `init` | TBD | — | `/project-init` |
| `status` | 覆盖率概览 | 内联执行（见下方） | — |

## 执行

### 解析子动作

从 `$ARGUMENTS` 取第一个词作为子动作，剩余部分作为子动作的参数传递。

无参数或不识别的子动作 → 输出用法表格：

```
/projecthub <sub-action>

  write    为指定目录写入/更新 AGENTS.md + README.md
  dream    递归扫描目录树，批量生成文档
  search   搜索所有子目录文档内容
  check    健康检查
  init     TBD
  status   覆盖率概览
```

### write / dream / search / check

调对应的 `Skill()`，把剩余参数传进去。

### init

当前输出提示：

```
/project-init 尚未设计。可用替代方案：
  /project-dream [dir]    递归扫描目录树批量生成
  /project-distill <dir>  为单个目录生成
```

### status

内联执行，输出项目子目录文档覆盖率概览：

1. 扫描项目所有一级子目录（排除 .git / node_modules / dist / build / .agents-personal / 隐藏目录）
2. 统计覆盖情况
3. 列出详情

```bash
find . -maxdepth 1 -type d ! -name '.*' ! -name node_modules ! -name dist ! -name build ! -name coverage | sort
```

对每个目录检查 AGENTS.md 和 README.md 是否存在。

输出格式：

```
项目子目录文档覆盖率

  总目录数:  12
  全覆盖:    3 (AGENTS.md + README.md)
  仅 AGENTS: 2
  仅 README: 1
  未覆盖:    6

  详情:
    ++ hooks/          AGENTS.md + README.md
    ++ rules/          AGENTS.md + README.md
    ++ vendor/         AGENTS.md + README.md
    +· skills/         仅 AGENTS.md
    +· model/          仅 AGENTS.md
    ·+ examples/       仅 README.md
    ·· commands/       无文档
    ·· agents/         无文档
    ·· scripts/        无文档
```
