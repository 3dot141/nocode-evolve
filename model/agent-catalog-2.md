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
**触发**: PR merge 后流转飞书 issue 状态 (组员开发 → 研发已改待BUILD); 或用户说「流转任务 / 改状态 / 标完成」; 或 dev-workflow 阶段 11 Task Transition
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-feishu-transition.md`
**摘要**: PR merge 后把飞书 issue 从组员开发流转到研发已改待BUILD; 先 update_field 填缺陷来源于缺陷(field_ecff7b, 默认自关联), 再 get_transition_required 确认必填项完成, 最后 transition_state; 多任务逐个独立流转
**关键约束(上浮)**: 非组员开发状态不强行流转, 报告让用户决定; 不猜测填充未知关联字段。
**也属**: git-lifecycle
**生命周期**: 4 收尾

### 桶: 工程流程 (workflow)
**粗触发**: 需求澄清 / 目标定义 / 任务拆分 / 实现执行 / 端到端验证 / devflow 流程导航
**不含 (负例)**: 纯查询 / 已在某个 skill 内部执行中

#### define
**触发**: 用户说「澄清需求 / 做什么 / 目标是什么 / interview me / 定义目标 / 需求不清楚」, 或 devflow 路由到 Define 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-define.md`
**摘要**: 从模糊任务到明确目标+方案的收敛循环; 融合 interview-me 一次一问+置信度 + spec-driven 可量化成功标准 + brainstorming 方案探索; 产出结构化 restate + 场景分类(Full/Standard/Fix/Mini)
**生命周期**: 0 设计

#### plan
**触发**: 用户说「写计划 / 拆任务 / 怎么实现 / plan it out / 拆解一下 / 实现方案」, 或 devflow 路由到 Plan 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-plan.md`
**摘要**: 融合 writing-plans 硬约束(每步贴代码/禁占位符/HARD-GATE) + planning-and-task-breakdown 方法论(垂直切片/sizing ≤5文件/checkpoint/依赖图); 产出可执行任务列表
**生命周期**: 2 实现

#### build
**触发**: 用户说「开始实现 / 写代码 / 执行计划 / build it / 动手」, 或 devflow 路由到 Build 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-build.md`
**摘要**: 双底子: superpowers TDD Iron Law + incremental-implementation slice 循环; 每 slice: Scope Lock(≤5文件) → Test First → Implement → Verify → Commit; source-driven 来源标注; 3次失败→Debug横切
**生命周期**: 2 实现

#### verify
**触发**: 用户说「验证一下 / 跑一下看看 / 确认能用 / verify」, 或 Build 完成后 devflow 路由到 Verify 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-verify.md`
**摘要**: 证明功能真的能用: 证据收集(Iron Law 无证据不宣称完成) + 集成测试 + E2E/Browser + 性能检查 + 验收标准逐条核对; 失败→Debug横切或回Build
**生命周期**: 3 评审

#### design (跨桶)
**触发**: 用户要求写设计文档 / PRD / RFC / Design Doc / ADR / 重构方案 / 技术 spec / API 设计, 或 devflow 路由到 Design 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-design.md`
**摘要**: Design 阶段增强: adversarial review + 设计五轴(可行性/清晰度/一致性/安全/可扩展性) + 统一 Findings Schema + source-driven 前置检查 + 轻量 threat model + API 契约指南 + HTML 渲染输出
**主桶**: design (完整定义见该桶)

