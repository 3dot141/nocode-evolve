---
name: lark-project
description: "飞书项目管理（Meego）。当用户给 project.feishu.cn 链接、提到 Meego 工作项、或需要读取/创建/更新/流转飞书项目工作项时使用。通过 meegle skill（官方 meegle CLI）完成全部操作。不负责飞书云文档（走 lark-doc）、飞书任务（走 lark-task）。"
---

# lark-project：飞书项目管理（路由壳）

飞书项目（Meego/Meegle）操作已整体迁移到 `meegle` skill（官方 meegle CLI）。本 skill 只保留入口路由，维护既有调用契约（dev-land 合并后流转、larkhub 路由表）。

命中本 skill 的请求：**把 arguments 原样透传调用 meegle skill**（平台原生 Skill 调用）：



Use `/meegle`.

Use the `skill` tool with `name: "meegle"`.

- 工作项读取/创建/更新、节点与状态流转、MQL 查询、视图、待办、排期 → 全部走 meegle
- meegle CLI 未安装 / 未授权 → 按 meegle skill 的 auth-guard 流程执行（安装：`npx -y @lark-project/meegle@latest install`）
- 飞书云文档 → lark-read / lark-doc；飞书任务 → lark-task

不要在本 skill 内展开任何操作细节——单一事实源在 meegle。
