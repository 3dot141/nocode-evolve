---
name: projecthub
description: >-
  项目子目录 AGENTS.md 和 README.md 的唯一管理入口。用于初始化、写入、递归批量生成、搜索、健康检查和覆盖率查询；不负责 .agents-personal/ 私有知识（走 personalhub）。
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

# projecthub

这是项目子目录 AGENTS.md + README.md 的唯一公开入口。原有 project-* 子能力均为本 Skill 的私有 reference，不再作为独立 Skill 路由。

## 调用契约

- 用户直接调用：把第一个词解析为 action，其余内容作为该 action 的原始请求。
- 结构化调用：优先读取 `arguments.action`；原样保留 `arguments.request`、`arguments.context` 和 `arguments.payload`，不得丢字段或改写 canonical 枚举。
- 若调用方省略 action，但 payload 中存在 `candidates[]` 且包含 `target_dir` / `target_file`，action 视为 `write`。

## 路由

| action | 能力 | 必须完整读取 |
|---|---|---|
| `init` | 初始化入口（当前为待设计占位） | `references/init.md` |
| `write` | 为指定目录写入/更新 AGENTS.md + README.md | `references/write.md` |
| `search` | 搜索项目子目录文档 | `references/search.md` |
| `check` | 健康检查 | `references/check.md` |
| `dream` | 递归扫描目录树并批量生成/更新文档 | `references/dream.md` |
| `status` | 覆盖率概览 | `references/status.md` |

## 执行

1. 解析 action；无参数或无法识别时，只输出上述 action 与简短用法，不猜测。
2. 完整读取且只读取所选 action 对应的 reference，然后按其中流程执行。
3. reference 明确要求加载同一 hub 的另一份 reference 时，完整读取该文件后继续；除此之外不要预加载其它 action。
4. 最终回执必须标明 action、实际变更、校验结果和任何未执行项。
