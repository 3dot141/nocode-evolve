# agent-catalog (续片)

> 接上一片 catalog. 同源生成, 禁手改.

### 桶: 记忆与沉淀 (memory)
**粗触发**: 总结 / 沉淀 / 归档会话产出 / push 内容 / 项目本地资源 (.agents-personal/) 操作
**不含 (负例)**: 一次性事实查询

#### push-summary
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤200字, 含基础内容(覆盖 push range 全 commit) + 重点评测(亮点 / 风险 / 未验证项)
**也属**: git-lifecycle
**生命周期**: 4 收尾

#### personal-deletion-guard
**触发**: 即将 rm / mv / find -delete / Write 覆盖 / Edit 大段删 在 .agents-personal/ 或 $USER_VAULT_PATH/ 下任何文件或子目录 (subagent 同理); 删除护栏规则文本常驻 model/agent-personal.md, 本 rule 提供 PreToolUse 硬兜底
**读**: `${CLAUDE_PLUGIN_ROOT}/model/agent-personal.md`
**摘要**: .agents-personal/ + $USER_VAULT_PATH 内容是用户沉淀的项目历史 + 当前指令, gitignored 不可恢复, 删除前必须二次确认 (rm/mv/find-delete 均视为删除等价物). PreToolUse 在命令层兜底拦 (inject 提醒, 不 block 留余地给用户授权)
**生命周期**: cross

### 桶: 飞书项目读取 (feishu)
**粗触发**: 读取飞书项目 (project.feishu.cn / Meego) 工作项内容 / 附件 / 评论 (需求 / 缺陷 / 任务)
**不含 (负例)**: 飞书云文档 docx / wiki (走 lark-doc / lark-wiki)

#### feishu-project-workitem-read
**触发**: 用户给 project.feishu.cn 链接 (或 Meego 工作项 id) 要求读取 / 总结 / 看附件 / 分析需求或缺陷内容. URL 形如 https://project.feishu.cn/<simple_name>/issue/detail/<id>
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-feishu-project-workitem-read.md`
**摘要**: 读飞书项目工作项用 FeishuProjectMcp 不用 WebFetch; get_workitem_brief 传 url + fields:["_all"] 拿全字段 (description 富文本 + multi_attachment); project_key 撞多空间改传真实 24 位 hex key; 评论另调 list_workitem_comments; 附件 get_download_url 拿 sign + curl -H X-Meego-File-Sign 下载再 Read
**关键约束(上浮)**: 下载附件必须带 X-Meego-File-Sign header, 漏了拿不到图片; 别用 WebFetch 抓 SPA 链接。
**生命周期**: cross

#### feishu-transition
**触发**: PR merge 后流转飞书 issue 状态 (组员开发 → 研发已改待BUILD); 或用户说「流转任务 / 改状态 / 标完成」; 或 dev-workflow 阶段 12 Task Transition
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-feishu-transition.md`
**摘要**: PR merge 后把飞书 issue 从组员开发流转到研发已改待BUILD; 先 update_field 填缺陷来源于缺陷(field_ecff7b, 默认自关联), 再 get_transition_required 确认必填项完成, 最后 transition_state; 多任务逐个独立流转
**关键约束(上浮)**: 非组员开发状态不强行流转, 报告让用户决定; 不猜测填充未知关联字段。
**也属**: git-lifecycle
**生命周期**: 4 收尾

