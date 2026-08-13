---
name: personalhub
description: >-
  .agents-personal/ 的唯一管理入口。用于初始化、写入、搜索、健康检查、自主整理、手动快照和状态查询；也接收 distill 的结构化 personal 候选。不是项目共享 AGENTS.md/README.md 管理（走 projecthub），也不搜索用户 vault（走 recall）。
---

本文所说“结构化决策”使用 `AskUserQuestion`。

# personalhub

这是 `.agents-personal/` 的唯一公开入口。原有 personal 子能力均为本 Skill 的私有 reference，不再作为独立 Skill 路由。

## 调用契约

- 用户直接调用：把第一个词解析为 action，其余内容作为该 action 的原始请求。
- 结构化调用：优先读取 `arguments.action`；原样保留 `arguments.request`、`arguments.context` 和 `arguments.payload`，不得丢字段或改写 canonical 枚举。
- 若调用方省略 action，但 payload 中存在 `candidates[]` 且 target 属于 `wiki|rules|agents`，action 视为 `write`。

## 路由

| action | 能力 | 必须完整读取 |
|---|---|---|
| `init` | 初始化 `.agents-personal/` | `references/init.md` |
| `write` | 写入 wiki / rules / AGENTS.md | `references/write.md` |
| `search` | 检索 personal 内容 | `references/search.md` |
| `check` | 健康检查 | `references/check.md` |
| `tidy` | stale / prune / merge / promote / archive | `references/tidy.md` |
| `snap` | 创建备份快照 | `references/snap.md` |
| `status` | 状态概览 | `references/status.md` |

## 执行

1. 解析 action；无参数或无法识别时，只输出上述 action 与简短用法，不猜测。
2. 完整读取且只读取所选 action 对应的 reference，然后按其中流程执行。
3. reference 明确要求加载同一 hub 的另一份 reference 时，完整读取该文件后继续；除此之外不要预加载其它 action。
4. 最终回执必须标明 action、实际变更、校验结果和任何未执行项。
