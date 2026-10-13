---
name: lark-project
description: "飞书项目管理（Meego）。当用户给 project.feishu.cn 链接、提到 Meego 工作项、或需要读取/创建/更新/流转飞书项目工作项、登记工时时使用。通过 meegle skill（官方 meegle CLI）完成全部操作。不负责飞书云文档（走 lark-doc）、飞书任务（走 lark-task）。"
---

# lark-project：飞书项目管理（业务指引层）

飞书项目（Meego/Meegle）操作已整体迁移到 `meegle` skill（官方 meegle CLI）。本 skill 是包装 meegle 的**业务指引层**：meegle 承载 CLI 能力与参数事实（通用工具层），本 skill 叠加适配本业务的调用契约与读取纪律——业务适配写这里，不改动 meegle 自身。

命中本 skill 的请求：**把 arguments 透传调用 meegle skill**（平台原生 Skill 调用）：

<!-- nocode:platform claude -->
Use `Skill(meegle)`（官方 meegle install 装入 `~/.claude/skills/meegle`，无插件前缀；未安装时先 `npx -y @lark-project/meegle@latest install`）.
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
Use `$meegle`.
<!-- /nocode:platform -->

<!-- nocode:platform pi -->
Use `/meegle`.
<!-- /nocode:platform -->

<!-- nocode:platform deepseek -->
Use the `skill` tool with `name: "meegle"`.
<!-- /nocode:platform -->

## 分发（渐进式加载：按意图 Read 对应契约后再透传，不预加载全部）

| arguments 意图 | 透传前必读 |
|---|---|
| 流转（流转状态 / 关闭 bug / 验收 / 状态更新） | [references/transition-contract.md](./references/transition-contract.md)（三步法定型 → 模板流转页路由 → 状态流约束 → 评论/工时收尾） |
| 读取/了解工作项（读问题、看缺陷/需求、排查上下文、视图 URL 取数） | [references/read-contract.md](./references/read-contract.md)（`_all` 字段 + 评论并行 + 附件下载 + 视图取数走 MQL 复刻） |
| 工时登记（任务号 + 分钟数 + 描述） | [worklog/config.md](./worklog/config.md)（调用契约：分钟数来源与解析 → 登记纪律 → 缺 env 动态获取 + key 抓取 SOP；不走 meegle。完整 PR 工作流的 worklog/README.md 不随发布物分发） |
| 创建工作项（创建 bug / 缺陷 / 需求 / 任务） | [references/create-contract.md](./references/create-contract.md)（空间归属 → 必填字段实测值 → fx-data 版本查找 → 附件预上传 → 边界） |
| 更新/查询等常规操作 | 无附加契约，直接透传 |

## 常驻约束（全意图适用，不需加载）

> **透传前规范化工作项编号**：用户/需求单给的编号常带类型前缀（`f-` / `g-` / `m-`，如 `f-7075316211`），这是飞书界面展示格式；Meego API 的 work-item-id 只接受**纯数字 ID** 或名称，带前缀透传报 `work item: f-xxx is invalid`——先剥前缀再透传。纯数字 ID 可跨空间命中（返回的 `owned_project` 才是真实归属空间），报 invalid 时换 project-key 重试是错误方向。

- 工作项读取/创建/更新、节点与状态流转、MQL 查询、视图、待办、排期 → 全部走 meegle
- meegle CLI 未安装 / 未授权 → 按 meegle skill 的 auth-guard 流程执行（安装：`npx -y @lark-project/meegle@latest install`）
- 飞书云文档 → lark-read / lark-doc；飞书任务 → lark-task

命令与参数细节不在本 skill 展开——CLI 事实单一源在 meegle；本 skill 只写业务侧调用契约与读取纪律。模板级流转知识按需加载 [transitions/](./transitions/) 对应文档（新模板增补一页，不回填 SKILL.md）。
