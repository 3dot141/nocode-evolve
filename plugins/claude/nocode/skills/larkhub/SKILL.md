---
name: larkhub
description: "Lark/飞书工具集聚合入口，按 URL 或意图分发到子 skill（read/project/doc/wiki/task/auth）"
---

# larkhub：飞书工具集聚合入口

统一入口，按 URL pattern 或意图关键词分发到对应的 Lark 子 skill。可由用户 `/larkhub` 显式调用，也可被 Claude 识别到飞书链接 / 意图时主动调起。

## 用法

`/larkhub <sub-action|URL>`

## URL 自动路由

| URL pattern | 分发到 | 说明 |
|---|---|---|
| `feishu.cn/docx/*` | `Capability(workflow.skill.invoke, {"skill":"lark-doc","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` | 飞书文档读写 |
| `feishu.cn/wiki/*` | `Capability(workflow.skill.invoke, {"skill":"lark-doc","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` 或 `Capability(workflow.skill.invoke, {"skill":"lark-wiki","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` | 内容读写走 doc，空间管理走 wiki |
| `project.feishu.cn/*` | `Capability(workflow.skill.invoke, {"skill":"lark-project","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` | 飞书项目工作项 |
| `doubao.com/docx/*` 或 `/wiki/*` | `Capability(workflow.skill.invoke, {"skill":"lark-doc","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` | 豆包文档（同 Lark API） |

## 子动作路由

| 子动作 | 做什么 | 转发到 |
|---|---|---|
| `read` | 完整读取飞书文档（含图片） | `Capability(workflow.skill.invoke, {"skill":"lark-read","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` |
| `project` | 飞书项目管理（MCP） | `Capability(workflow.skill.invoke, {"skill":"lark-project","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` |
| `doc` | 文档读写 API | `Capability(workflow.skill.invoke, {"skill":"lark-doc","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` |
| `wiki` | 知识空间管理 | `Capability(workflow.skill.invoke, {"skill":"lark-wiki","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` |
| `task` | 飞书任务管理 | **待接入/暂不可用**——`Capability(workflow.skill.invoke, {"skill":"lark-task","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` 当前未安装（外部 lark 系插件只提供 `lark-doc`/`lark-wiki`/`lark-shared`），命中时如实告知用户该能力暂缺，不要假装调用 |
| `auth` | 认证/scope 配置 | `Capability(workflow.skill.invoke, {"skill":"lark-shared","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` |

## 执行

### 解析输入

两种进入方式归一到「识别 URL/意图 → 按路由表分发」：

1. 用户 `/larkhub <参数>` 显式调用 → `$ARGUMENTS` 是 URL 按 URL pattern 路由；第一个词匹配子动作则按子动作路由
2. Claude 主动调起（识别到对话里的飞书链接 / 意图）→ 从当前上下文取该 URL / 意图，按同一张路由表分发
3. 无参数且上下文无飞书线索 → 输出用法表格

### URL 路由

识别 URL 中的域名和路径 pattern：

- `project.feishu.cn` → `project` 子动作
- `feishu.cn/docx/` 或 `feishu.cn/wiki/` → 判断意图：要"完整阅读含图片"走 `read`，否则走 `doc`
- `doubao.com/docx/` 或 `doubao.com/wiki/` → 同 feishu.cn 处理

### 子动作路由

调对应的 `Skill()`，把剩余参数传进去。`task` 子动作当前无对应 skill 可转发（见上表），命中时直接告知用户"飞书任务管理暂未接入，需要先安装提供 `lark-task` 的插件"，不要尝试调用不存在的 skill。

### 无参数

输出用法表格：

```
/larkhub <sub-action|URL>

  read       完整读取飞书文档（含图片）
  project    飞书项目管理（MCP）
  doc        文档读写 API
  wiki       知识空间管理
  task       飞书任务管理（待接入/暂不可用）
  auth       认证/scope 配置

直接贴飞书 URL 也行，自动识别。
```
