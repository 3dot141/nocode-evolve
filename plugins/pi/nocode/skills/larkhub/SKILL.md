---
name: larkhub
description: "当用户提供飞书/Lark/豆包文档或飞书项目 URL，或请求文档、Markdown、画板、知识库、项目与认证能力分流时使用。不是具体业务实现；非飞书内容不触发。"
---

# larkhub：飞书工具集聚合入口

仓库内目标使用 `/skill:lark-read`、`/skill:lark-project`、`/skill:lark-doc`、`/skill:lark-wiki`、`/skill:lark-shared`、`/skill:lark-markdown`、`/skill:lark-whiteboard`。

每次 handoff 传入原始 request、URL、stage、restate、artifacts、constraints 和用户 decision。目标 Skill 或连接器不可用时，明确报告缺失能力，不经过私有 fallback。

统一入口，按 URL pattern 或意图关键词分发到对应的 Lark 子 skill。可由用户 `/larkhub` 显式调用，也可被 Claude 识别到飞书链接 / 意图时主动调起。

## 用法

`/larkhub <sub-action|URL>`

## URL 自动路由

| URL pattern | 分发到 | 说明 |
|---|---|---|
| `feishu.cn/docx/*` | lark-doc | 飞书文档读写 |
| `feishu.cn/wiki/*` | lark-doc 或 lark-wiki | 内容读写走 doc，空间管理走 wiki |
| `project.feishu.cn/*` | lark-project | 飞书项目工作项 |
| `doubao.com/docx/*` 或 `/wiki/*` | lark-doc | 豆包文档（同 Lark API） |

## 子动作路由

| 子动作 | 做什么 | 转发到 |
|---|---|---|
| `read` | 完整读取飞书文档（含图片） | lark-read |
| `project` | 飞书项目管理（MCP） | lark-project |
| `doc` | 文档读写 API | lark-doc |
| `wiki` | 知识空间管理 | lark-wiki |
| `markdown` | Markdown 文件读写与比较 | lark-markdown |
| `whiteboard` | 画板查询、导出与编辑 | lark-whiteboard |
| `task` | 飞书任务管理 | **待接入/暂不可用**——当前没有可转发目标；命中时如实告知用户该能力暂缺 |
| `auth` | 认证/scope 配置 | lark-shared |

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
  markdown   Markdown 文件读写与比较
  whiteboard 画板查询、导出与编辑
  task       飞书任务管理（待接入/暂不可用）
  auth       认证/scope 配置

直接贴飞书 URL 也行，自动识别。
```
