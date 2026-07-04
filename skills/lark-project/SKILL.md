---
name: lark-project
description: 飞书项目管理（FeishuProjectMcp）。当用户给 project.feishu.cn 链接、提到 Meego 工作项、或需要读取/创建/更新/流转飞书项目工作项时使用。覆盖工作项读取（含附件）、状态流转、搜索、创建更新。不负责飞书云文档（走 lark-doc）、飞书任务（走 lark-task）。
metadata:
  requires:
    mcp: ["FeishuProjectMcp"]
---

# lark-project：飞书项目管理（FeishuProjectMcp）

通过 FeishuProjectMcp 工具操作飞书项目（Meego）工作项。

## 前置 — 加载 MCP 工具

FeishuProjectMcp 工具是 deferred 的，操作前先用 ToolSearch 加载需要的工具：

```
读取:select:mcp__FeishuProjectMcp__get_workitem_brief,mcp__FeishuProjectMcp__get_download_url,mcp__FeishuProjectMcp__list_workitem_comments
流转:select:mcp__FeishuProjectMcp__update_field,mcp__FeishuProjectMcp__get_transitable_states,mcp__FeishuProjectMcp__get_transition_required,mcp__FeishuProjectMcp__transition_state
搜索:select:mcp__FeishuProjectMcp__search_by_mql,mcp__FeishuProjectMcp__search_project_info
创建/更新:select:mcp__FeishuProjectMcp__create_workitem,mcp__FeishuProjectMcp__update_field
```

按需加载，不要一次全 load。

## 快速决策

| 场景 | 做什么 |
|---|---|
| 用户给 `project.feishu.cn` URL | 读工作项 → 参考 [`references/workitem-read.md`](references/workitem-read.md) |
| PR merge 后流转状态 | 流转 → 参考 [`references/transition.md`](references/transition.md) |
| 用户说"搜索/筛选工作项" | `search_by_mql` → 见下方搜索节 |
| 用户说"创建工作项" | `create_workitem` → 见下方创建节 |
| 用户说"看评论" | `list_workitem_comments(project_key, work_item_id)` |

## 工作项读取

完整流程见 [`references/workitem-read.md`](references/workitem-read.md)。核心要点：

1. `get_workitem_brief(url, fields:["_all"])` 一次拿全部字段
2. `project_key` 多匹配时改用真实 24 位 hex key
3. 附件下载必须带 `X-Meego-File-Sign` header
4. 评论单独调 `list_workitem_comments`

## 状态流转

完整流程见 [`references/transition.md`](references/transition.md)。核心要点：

1. 先查当前状态是否为「组员开发」
2. `get_transition_required` 查必填字段
3. `update_field` 填必填项（`field_ecff7b` 默认自关联）
4. `transition_state` 执行流转

## 搜索工作项

```
search_by_mql(project_key, mql, work_item_type)
```

MQL 语法示例：`status = "组员开发"`（按状态）等

不确定 MQL 语法时，先 `search_project_info` 了解项目结构。

## 创建/更新工作项

```
# 创建
create_workitem(project_key, work_item_type, fields)

# 更新字段
update_field(work_item_id, project_key, fields)
```

字段格式因类型而异，创建前先查 `list_workitem_field_config` 了解可用字段。

## 不要

不要：WebFetch 抓 project.feishu.cn（SPA 拿不到正文）；非「组员开发」状态强行流转（报告用户决定）；猜测填充未知关联字段
