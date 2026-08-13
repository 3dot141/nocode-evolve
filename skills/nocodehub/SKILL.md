---
name: nocodehub
description: >-
  nocode 插件源码仓库的唯一自维护入口。用于新增或优化 plugin rule/skill、执行仓库自维护巡检，或查看插件健康状态；也接收 distill 的 rules:plugin 结构化候选。不是个人知识库管理（走 personalhub），也不是项目子目录文档管理（走 projecthub）。
---

<!-- nocode:platform claude -->
本文所说“结构化决策”使用 `AskUserQuestion`。
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
本文所说“结构化决策”使用 `request_user_input`。
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
本文所说“结构化决策”在回合末写出完整问题与 2–3 个互斥选项，等待用户下一条消息。
<!-- /nocode:platform -->

# nocodehub

这是 nocode 插件自身维护的唯一公开入口。原有 plugin 子能力均为本 Skill 的私有 reference，不再作为独立 Skill 路由。

## 调用契约

- 用户直接调用：把第一个词解析为 action，其余内容作为该 action 的原始请求。
- 结构化调用：优先读取 `arguments.action`；原样保留 `arguments.request`、`arguments.context` 和 `arguments.payload`。
- 若调用方省略 action，但 payload 中存在 plugin rule/skill `candidates[]`，action 视为 `write`。

## 路由

| action | 能力 | 必须完整读取 |
|---|---|---|
| `write` | 新增、融合或优化 plugin rule / skill | `references/write.md` |
| `dream` | 插件仓库漂移与边界巡检 | `references/dream.md` |
| `status` | 插件健康概览 | `references/status.md` |

## 执行

1. 解析 action；无参数或无法识别时，只输出上述 action 与简短用法，不猜测。
2. 完整读取且只读取所选 action 对应的 reference，然后按其中流程执行。
3. `dream` 需要修复 plugin rule 时，完整读取 `references/write.md`；其它 action 不预加载无关 reference。
4. 最终回执必须标明 action、实际变更、校验结果和任何未执行项。
