---
name: recall
description: "从 wiki 和 vault 检索已沉淀内容，返回按置信度排序的精简清单"
argument-hint: <搜索关键词>
---

# /recall：沉淀内容检索

从 `.agents-personal/wiki/` 和 `$USER_VAULT_PATH/Memory/` 中检索与关键词相关的已沉淀内容。

## 入参

`$ARGUMENTS` 必填——搜索关键词，支持中文/英文/多词。

无参数时报错：
```
请输入搜索关键词。用法：/recall <keyword>
示例：/recall worktree
```

## 执行

用 Agent 工具 spawn recall-search subagent：

- **subagent_type**: `nocode:recall-search`
- **prompt**:

```
搜索关键词: $ARGUMENTS

搜索目录:
- Wiki: <当前项目根>/.agents-personal/wiki/
- Vault: $USER_VAULT_PATH/Memory/

按 recall-search agent 定义的工作流执行搜索，返回精简清单。
```

其中 `<当前项目根>` 在 spawn 前解析为实际的项目根绝对路径。

## 结果处理

subagent 返回的清单直接展示给用户。

用户可以说"打开第 N 个"或"读一下第 N 个"，主 agent 根据路径 Read 对应文件。

## 和 /personal-recall 的关系

- `/recall` 搜两个源：`.agents-personal/wiki/` + `$USER_VAULT_PATH/Memory/`（通过 recall-search agent）
- `/personal-recall` 只搜 `.agents-personal/`（wiki + rules + AGENTS.md），是独立入口
- 两者各自独立，不互相调用——recall 用 recall-search agent 已能覆盖 personal 范围
