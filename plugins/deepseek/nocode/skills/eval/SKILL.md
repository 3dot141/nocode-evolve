---
name: eval
description: "eval-driven development 工作流管理（定义/检查/生成报告/列出 eval）"
argument-hint: "[define|check|report|list|clean] [feature-name]"
---

本文所说“调用 `<skill>` Skill”使用 `/<skill>`；“结构化决策”在回合末写出完整问题与 2–3 个互斥选项，等待用户下一条消息。


# /eval：eval-driven development 工作流

统一入口，转发到 `eval-harness` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` 执行 EDD（eval-driven development）方法论——定义能力/回归 eval、跑 eval、生成报告、列出所有 eval 定义。

## 用法

`/eval [define|check|report|list|clean] [feature-name]`

## 执行

调用 `eval-harness` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}`，把 `用户本次调用参数` 原样传入：

- `define <name>` — 创建新的 eval 定义
- `check <name>` — 跑并检查 eval
- `report <name>` — 生成完整报告
- `list` — 列出全部 eval 定义
- `clean` — 清理旧 eval 日志（保留最近 10 次）

具体的 eval 定义模板、判分标准（pass@k 指标）、报告格式，见 `skills/eval-harness/SKILL.md`，不在本文件重复。
