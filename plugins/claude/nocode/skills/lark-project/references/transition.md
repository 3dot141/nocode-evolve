# 飞书项目工作项状态流转 (PR merge 后)

PR merge 后把飞书 issue 从「组员开发」流转到「研发已改待BUILD」。适用一体化产研团队空间 (`67d7ba04296cba3d3ece0694`) 的 issue (缺陷) 类型工作项。

## 触发

- devflow Land 阶段 (8d. Task Transition); 或
- 用户 push/merge 后说「流转任务 / 改状态 / 标完成」; 或
- commit message 含飞书任务号 (`#f-xxx` / `#g-xxx` / `#m-xxx`) 且用户要求流转

**不触发**: 纯查看工作项 (走 `lark-project` SKILL.md 的工作项读取流程); 纯讨论不执行流转。

## 前置: 加载 MCP 工具

`FeishuProjectMcp__*` 是 deferred 工具, 先 ToolSearch 加载:

```
select:mcp__FeishuProjectMcp__get_workitem_brief,mcp__FeishuProjectMcp__update_field,mcp__FeishuProjectMcp__get_transitable_states,mcp__FeishuProjectMcp__get_transition_required,mcp__FeishuProjectMcp__transition_state
```

## 流程

### 1. 从 commit 提取任务号

从 push range 的 commit messages 中提取 `#f-xxx` / `#g-xxx` / `#m-xxx`。前缀不等于 project_key,后续用 `get_workitem_brief` 返回的 `owned_project.key` 作为 project_key。

### 2. 查工作项当前状态

```
get_workitem_brief(work_item_id="<数字部分>", project_key="67d7ba04296cba3d3ece0694")
```

确认:
- `work_item_status.key` == `_vGKyEw62` (组员开发)。若不是,报告当前状态,不强行流转。
- `work_item_type.key` == `issue`。非 issue 类型本 rule 不覆盖。

若 project_key 未知或 simple_name 撞多空间,先用 `search_project_info` 定位,再取 `owned_project.key`。

### 3. 查可流转目标

```
get_transitable_states(work_item_id, work_item_type="issue", user_key="<当前用户>", project_key)
```

找 `state_name == "研发已改待BUILD"` 的 `transition.id` (已知值: `20862226`)。

### 4. 填必填字段

```
get_transition_required(work_item_id, state_key="zBCdJmDgv", project_key, mode="unfinished")
```

返回未完成的必填字段。常见 4 个:

| field_key | 字段名 | 关联类型 | 默认策略 |
|---|---|---|---|
| `field_ad7bdc` | 缺陷来源于需求 | story | 通常留空 |
| `field_2fd406` | 缺陷来源于产研任务 | 产研任务 | 通常留空 |
| `field_ecff7b` | 缺陷来源于缺陷 | issue | **默认填本 issue 自身 id(自关联)** |
| `field_630746` | 缺陷来源于子任务 | sub_task | 通常留空 |

**实操**: 一般只填 `field_ecff7b`(缺陷来源于缺陷)。若用户指定了源缺陷 id 则填指定值,否则自关联(填自身 work_item_id)。

```
update_field(
  work_item_id,
  project_key,
  fields=[{ field_key: "field_ecff7b", field_value: "[\"<source_issue_id>\"]" }]
)
```

`workitem_related_multi_select` 值格式: JSON 字符串化数组 `["id1","id2"]`。

填完后**再查一次** `get_transition_required(mode="unfinished")` 确认:
- 返回空 → 可流转
- 仍有未完成 → 报告给用户,让用户手动补或指定值,**不猜测填充**

### 5. 执行流转

```
transition_state(work_item_id, transition_id="20862226", project_key)
```

### 6. 确认

流转后再 `get_workitem_brief` 确认 `work_item_status.name` == `研发已改待BUILD`。

## 多任务批量

一次 push 可能含多个任务号。逐个走步骤 2-6,每个独立报告成功/失败。一个失败不阻塞其他。

## 不要

- ❌ 跳过 `get_transition_required` 直接流转 — 必填项未填会 400 报错
- ❌ 猜测「缺陷来源于需求/产研任务/子任务」的关联值 — 不确定就留空,报告用户
- ❌ 非「组员开发」状态时强行流转 — 报告当前状态,让用户决定
- ❌ 把任务号前缀 (f/g/m) 当 project_key — 用 `owned_project.key` 拿真实值
- ❌ 用 WebFetch 操作飞书项目 — 走 FeishuProjectMcp 工具
