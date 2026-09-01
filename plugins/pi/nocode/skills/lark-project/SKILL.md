---
name: lark-project
description: "飞书项目管理（Meego）。当用户给 project.feishu.cn 链接、提到 Meego 工作项、或需要读取/创建/更新/流转飞书项目工作项时使用。通过 meegle skill（官方 meegle CLI）完成全部操作。不负责飞书云文档（走 lark-doc）、飞书任务（走 lark-task）。"
---

# lark-project：飞书项目管理（业务指引层）

飞书项目（Meego/Meegle）操作已整体迁移到 `meegle` skill（官方 meegle CLI）。本 skill 是包装 meegle 的**业务指引层**：meegle 承载 CLI 能力与参数事实（通用工具层），本 skill 叠加适配本业务的调用契约与读取纪律（dev-land 合并后流转、完整读取、larkhub 路由表）——业务适配写这里，不改动 meegle 自身。

命中本 skill 的请求：**把 arguments 透传调用 meegle skill**（平台原生 Skill 调用）：



Use `/meegle`.


> **透传前规范化工作项编号**：用户/需求单给的编号常带类型前缀（`f-` / `g-` / `m-`，如 `f-7075316211`），这是飞书界面展示格式；Meego API 的 work-item-id 只接受**纯数字 ID** 或名称，带前缀透传报 `work item: f-xxx is invalid`——先剥前缀再透传。纯数字 ID 可跨空间命中（返回的 `owned_project` 才是真实归属空间），报 invalid 时换 project-key 重试是错误方向。

> **状态流转透传契约（dev-land 合并后流转实测）**：arguments 含流转意图（流转状态 / 关闭 bug / 验收 / 状态更新）时，透传须带上以下约束，否则下游会撞坑停手：
> 1. 状态流转走 meegle 的 `references/sop-transition-state.md` 完整 SOP（fail-fast 流转 → 必填补填 → 重试），**不是裸调 `workflow transition-state` 就完事**。
> 2. 流转常被 confirm_form 必填字段拦截（如缺陷的「缺陷来源于需求」）；meegle CLI **不支持在 transition-state 上传字段值**（`--params` 传 `fields`/`confirm_form` 均为 unknown_params，实测无效）——正确解法是先 `workitem update` 预填必填字段，再裸 `transition-state`。
> 3. 关联类必填字段（`workitem_related_multi_select`）值为 stringified 数字数组（如 `"[7071224906]"`）；**关联对象是业务判断**：须用户提供或从该工作项上下文查实（如同分支提交所挂需求），不得 mock。「缺陷来源于 X」类来源字段例外——按团队惯例选**标题与当前工作项相同**的候选，**搜索顺序：先比对本单自身（自引用惯例）→ 按 MQL 搜字段对应类型（缺陷来源先搜缺陷）→ 无命中再搜其余类型 → 全无才问用户**（实测教训：只搜需求类型会漏检自引用、多走一轮人工；详见 meegle `sop-transition-state.md` 4.4）。
> 4. MQL 查需求关联时：FROM 项目名用中文名+反引号（simple_name 撞歧义空间报 no permission），story 类字段 key 是 `work_item_id` / `work_item_status`（非 `id`/`status`）。
> 5. **流转成功后附评论**：arguments 含修复摘要（dev-land 合并后流转传入）时，状态流转成功后调 meegle `comment add`（剥前缀纯数字 ID）把摘要落成工作项评论；评论失败不回滚流转，如实报告「已流转，评论失败」。
> 6. **工时登记走本 skill 内置 worklog 能力**（meegle `workhour` 域仅查询，无提交命令）：arguments 含工时登记意图（任务号 + 经 dev-land 全景确认的分钟数——默认为全景展示的会话任务段估算值经用户「OK」，或用户显式指定值——+ 描述）时，按 [worklog/README.md](./worklog/README.md) 执行——先经 meegle 现查身份注入（`FEISHU_SPACE_ID`=workitem get 的 owned_project.key、`FEISHU_USER_ID`=user me 的 user_key，不落配置）→ `worklog/work-log.mjs` 分配工作时段 → 展示完整批次 → 用户明确确认后 `submit --execute` 逐条写入；key 过期先跑 `worklog/refresh-worklog-key.mjs`。写入前必须展示批次获确认；部分失败即停、逐条核对，不重提成功项。配置缺失（`~/.codex/work-log.env`）→ 按 [worklog/config.md](./worklog/config.md) 指引用户创建后重试，不伪造已登记。禁止把工时提交伪装成 meegle 操作。

> **读取透传契约（完整读取工作项）**：arguments 含读取/了解工作项意图（读问题、看缺陷/需求、排查上下文）时，透传须带上完整读取约束——**不只读默认字段**，三路同步：
> 1. `workitem get --fields ["_all"]`（附件在 `multi_attachment` 字段，默认字段集不含）与 `comment list` **并行**——两者都只需 project-key + work-item-id，互不依赖
> 2. 附件按需下载：从 `multi_attachment` 字段值或评论里的附件引用取 file_url，`attachment +download <file-url>` 落盘（依赖第 1 步返回，串行在后）
>
> 业务上复现步骤常在评论、截图日志常在附件，漏读即误判。

- 工作项读取/创建/更新、节点与状态流转、MQL 查询、视图、待办、排期 → 全部走 meegle
- meegle CLI 未安装 / 未授权 → 按 meegle skill 的 auth-guard 流程执行（安装：`npx -y @lark-project/meegle@latest install`）
- 飞书云文档 → lark-read / lark-doc；飞书任务 → lark-task

命令与参数细节不在本 skill 展开——CLI 事实单一源在 meegle；本 skill 只写业务侧调用契约与读取纪律。
