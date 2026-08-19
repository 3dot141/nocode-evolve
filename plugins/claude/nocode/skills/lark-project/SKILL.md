---
name: lark-project
description: "飞书项目管理（Meego）。当用户给 project.feishu.cn 链接、提到 Meego 工作项、或需要读取/创建/更新/流转飞书项目工作项时使用。通过 meegle skill（官方 meegle CLI）完成全部操作。不负责飞书云文档（走 lark-doc）、飞书任务（走 lark-task）。"
---

# lark-project：飞书项目管理（路由壳）

飞书项目（Meego/Meegle）操作已整体迁移到 `meegle` skill（官方 meegle CLI）。本 skill 只保留入口路由，维护既有调用契约（dev-land 合并后流转、larkhub 路由表）。

命中本 skill 的请求：**把 arguments 透传调用 meegle skill**（平台原生 Skill 调用）：

Use `Skill(nocode:meegle)`.




> **透传前规范化工作项编号**：用户/需求单给的编号常带类型前缀（`f-` / `g-` / `m-`，如 `f-7075316211`），这是飞书界面展示格式；Meego API 的 work-item-id 只接受**纯数字 ID** 或名称，带前缀透传报 `work item: f-xxx is invalid`——先剥前缀再透传。纯数字 ID 可跨空间命中（返回的 `owned_project` 才是真实归属空间），报 invalid 时换 project-key 重试是错误方向。

- 工作项读取/创建/更新、节点与状态流转、MQL 查询、视图、待办、排期 → 全部走 meegle
- meegle CLI 未安装 / 未授权 → 按 meegle skill 的 auth-guard 流程执行（安装：`npx -y @lark-project/meegle@latest install`）
- 飞书云文档 → lark-read / lark-doc；飞书任务 → lark-task

不要在本 skill 内展开任何操作细节——单一事实源在 meegle。
