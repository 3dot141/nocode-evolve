---
name: lark-project
description: "\"飞书项目管理（Meego）。当用户给 project.feishu.cn 链接、提到 Meego 工作项、或需要读取/创建/更新/流转飞书项目工作项时使用。通过 meegle skill（…"
---

# lark-project：飞书项目管理（路由壳）

飞书项目（Meego/Meegle）操作已整体迁移到 `meegle` skill（官方 meegle CLI）。本 skill 只保留入口路由，维护既有调用契约（dev-land 合并后流转、larkhub 路由表）。

命中本 skill 的请求：**把 arguments 透传调用 meegle skill**（平台原生 Skill 调用）：


Use `$meegle`.



> **透传前规范化工作项编号**：用户/需求单给的编号常带类型前缀（`f-` / `g-` / `m-`，如 `f-7075316211`），这是飞书界面展示格式；Meego API 的 work-item-id 只接受**纯数字 ID** 或名称，带前缀透传报 `work item: f-xxx is invalid`——先剥前缀再透传。纯数字 ID 可跨空间命中（返回的 `owned_project` 才是真实归属空间），报 invalid 时换 project-key 重试是错误方向。

> **状态流转透传契约（dev-land 合并后流转实测）**：arguments 含流转意图（流转状态 / 关闭 bug / 验收 / 状态更新）时，透传须带上以下约束，否则下游会撞坑停手：
> 1. 状态流转走 meegle 的 `references/sop-transition-state.md` 完整 SOP（fail-fast 流转 → 必填补填 → 重试），**不是裸调 `workflow transition-state` 就完事**。
> 2. 流转常被 confirm_form 必填字段拦截（如缺陷的「缺陷来源于需求」）；meegle CLI **不支持在 transition-state 上传字段值**（`--params` 传 `fields`/`confirm_form` 均为 unknown_params，实测无效）——正确解法是先 `workitem update` 预填必填字段，再裸 `transition-state`。
> 3. 关联类必填字段（`workitem_related_multi_select`）值为 stringified 数字数组（如 `"[7071224906]"`）；**关联对象是业务判断**：须用户提供或从该工作项上下文查实（如同分支提交所挂需求），不得 mock。
> 4. MQL 查需求关联时：FROM 项目名用中文名+反引号（simple_name 撞歧义空间报 no permission），story 类字段 key 是 `work_item_id` / `work_item_status`（非 `id`/`status`）。

- 工作项读取/创建/更新、节点与状态流转、MQL 查询、视图、待办、排期 → 全部走 meegle
- meegle CLI 未安装 / 未授权 → 按 meegle skill 的 auth-guard 流程执行（安装：`npx -y @lark-project/meegle@latest install`）
- 飞书云文档 → lark-read / lark-doc；飞书任务 → lark-task

不要在本 skill 内展开任何操作细节——单一事实源在 meegle。
