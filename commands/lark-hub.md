---
description: Lark/飞书工具集聚合入口，按 URL 或意图分发到子 skill（read/project/doc/wiki/task/auth）
argument-hint: <sub-action|URL> [args]
---

# /lark-hub：飞书工具集聚合入口

统一入口，按 URL pattern 或意图关键词分发到对应的 Lark 子 skill。

## 用法

`/lark-hub <sub-action|URL>`

## URL 自动路由

| URL pattern | 分发到 | 说明 |
|---|---|---|
| `feishu.cn/docx/*` | `Skill(lark-doc)` | 飞书文档读写 |
| `feishu.cn/wiki/*` | `Skill(lark-doc)` 或 `Skill(lark-wiki)` | 内容读写走 doc，空间管理走 wiki |
| `project.feishu.cn/*` | `Skill(nocode-evolve:lark-project)` | 飞书项目工作项 |
| `doubao.com/docx/*` 或 `/wiki/*` | `Skill(lark-doc)` | 豆包文档（同 Lark API） |

## 子动作路由

| 子动作 | 做什么 | 转发到 |
|---|---|---|
| `read` | 完整读取飞书文档（含图片） | `Skill(nocode-evolve:lark-read)` |
| `project` | 飞书项目管理（MCP） | `Skill(nocode-evolve:lark-project)` |
| `doc` | 文档读写 API | `Skill(lark-doc)` |
| `wiki` | 知识空间管理 | `Skill(lark-wiki)` |
| `task` | 飞书任务管理 | `Skill(lark-task)` |
| `auth` | 认证/scope 配置 | `Skill(lark-shared)` |

## 执行

### 解析输入

1. `$ARGUMENTS` 是 URL → 按 URL pattern 路由
2. `$ARGUMENTS` 第一个词匹配子动作 → 按子动作路由
3. 无参数或不识别 → 输出用法表格

### URL 路由

识别 URL 中的域名和路径 pattern：

- `project.feishu.cn` → `project` 子动作
- `feishu.cn/docx/` 或 `feishu.cn/wiki/` → 判断意图：要"完整阅读含图片"走 `read`，否则走 `doc`
- `doubao.com/docx/` 或 `doubao.com/wiki/` → 同 feishu.cn 处理

### 子动作路由

调对应的 `Skill()`，把剩余参数传进去。

### 无参数

输出用法表格：

```
/lark-hub <sub-action|URL>

  read       完整读取飞书文档（含图片）
  project    飞书项目管理（MCP）
  doc        文档读写 API
  wiki       知识空间管理
  task       飞书任务管理
  auth       认证/scope 配置

直接贴飞书 URL 也行，自动识别。
```
