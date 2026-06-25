# agent-catalog (续片)

> 接上一片 catalog. 同源生成, 禁手改.

### 桶: 工程流程 (workflow)
**粗触发**: 需求澄清 / 目标定义 / 任务拆分 / 实现执行 / 端到端验证 / devflow 流程导航
**不含 (负例)**: 纯查询 / 已在某个 skill 内部执行中

#### dev-define
**触发**: 用户说「澄清需求 / 做什么 / 目标是什么 / interview me / 定义目标 / 需求不清楚」, 或 devflow 路由到 Define 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-define.md`
**摘要**: 从模糊任务到明确问题边界的收敛循环; 融合 interview-me 一次一问+置信度 + spec-driven 可量化成功标准; brainstorming 用于发散问题空间(不延伸到解法选择); 产出结构化 restate + 场景分类(Full/Standard/Fix/Mini)
**生命周期**: 0 设计

#### pdflow
**触发**: 用户说「pdflow / 产品发现 / 走产品阶段 / 先调研再写 PRD / 产品工作流」, 或 devflow Full 场景建议先走产品流
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pdflow.md`
**摘要**: 产品发现工作流领航(Research → PRD · 2 场景路由); 独立于 devflow, 通过 .prd.md 文档衔接; Full(Research→PRD) / Light(PRD-only); Handoff 建议进 devflow
**也属**: design
**生命周期**: 0 设计

#### pd-research
**触发**: 用户说「调研一下 / 帮我调研 / research / 竞品分析 / 市场调研 / 看看已有方案 / 看看别人怎么做」, 或 devflow Full 场景建议先走产品流
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pd-research.md`
**摘要**: 独立产品流 Research 阶段: 并行五切面探索(竞品/代码/用户信号/市场空间/已有方案) + 逐切面校验(1-3轮), 产出 research-report.md; 可独立调起也可串联 prd skill
**也属**: design
**生命周期**: 0 设计

#### dev-plan
**触发**: 用户说「写计划 / 拆任务 / 怎么实现 / plan it out / 拆解一下 / 实现方案」, 或 devflow 路由到 Plan 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-plan.md`
**摘要**: 融合 writing-plans 硬约束(每步贴代码/禁占位符/HARD-GATE) + planning-and-task-breakdown 方法论(垂直切片/sizing ≤5文件/checkpoint/依赖图); 产出可执行任务列表
**生命周期**: 2 实现

#### dev-build
**触发**: 用户说「开始实现 / 写代码 / 执行计划 / build it / 动手」, 或 devflow 路由到 Build 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-build.md`
**摘要**: 双底子: superpowers TDD Iron Law + incremental-implementation slice 循环; 每 slice: Scope Lock(≤5文件) → Test First → Implement → Verify → Commit; source-driven 来源标注; 3次失败→Debug横切
**生命周期**: 2 实现

#### dev-verify
**触发**: 用户说「验证一下 / 跑一下看看 / 确认能用 / verify」, 或 Build 完成后 devflow 路由到 Verify 阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-verify.md`
**摘要**: 证明功能真的能用: 证据收集(Iron Law 无证据不宣称完成) + 集成测试 + E2E/Browser + 性能检查 + 验收标准逐条核对; 失败→Debug横切或回Build
**生命周期**: 3 评审

#### dev-land
**触发**: devflow 路由到 Land 阶段, 或用户说「land / 着陆 / 准备着陆 / 走 land 阶段」(注意: 独立说「提 PR / 收尾 / 合并」不在 devflow 上下文时走 finishing-branch, 不走本 skill)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-land.md`
**摘要**: Landing 收尾: Pre-flight(Review Gate + 分支状态) → Disposition(4选项 merge/PR/keep/discard) → 执行(rule-finishing-branch) → Task Transition(rule-feishu-transition) → Cleanup; Mini 走 Land-lite(commit only)
**也属**: git-lifecycle
**生命周期**: 4 收尾

#### dev-review
**触发**: devflow 路由到 Review 阶段, 或用户说「review 一下 / 看看代码 / 评审 / check the code / 审一下 / 有没有问题 / 帮我 review / code review」. 不含: 非 devflow 上下文的独立 review 请求（红军/第二实现/委派）走 codex-review
**读**: ``
**摘要**: devflow Review 阶段五轴评审 + Spec 轴路径覆盖检查; 产出分级 findings 报告 (Critical/Warning/Suggestion); Critical 不可 override; 与 codex-review 分工: dev-review = devflow 五轴评审, codex-review = 独立红军/第二实现/委派
**也属**: review
**生命周期**: 3 评审

#### dev-design (跨桶)
**触发**: 用户要求写设计文档 / RFC / Design Doc / ADR / 重构方案 / 技术 spec / API 设计, 或 devflow 路由到 Design 阶段. 不含: 产品 PRD (走 pd-prd skill, 不走本 rule)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-design.md`
**摘要**: Design 阶段: 方案探索(brainstorming发散解法空间) + 测试目标推导 + 设计文档(design-doc-writing); adversarial review + 设计六轴(可行性/清晰度/架构合理性/安全/性能/可扩展性) + source-driven 前置检查 + 轻量 threat model
**主桶**: design (完整定义见该桶)

#### pd-prd (跨桶)
**触发**: 用户说「写 PRD / 产品需求 / 产品设计 / 产品 brief / 写需求文档」, 或 research 完成后衔接, 或 devflow Full 场景建议
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pd-prd.md`
**摘要**: 独立产品流 PRD 阶段: 读 research-report(可选) + clarify gate + 写结构化 .prd.md 文档(6 核心要素 + 扩展字段); [TBD]/[ASSUMED] 双标注; Go/No-Go 结尾
**主桶**: design (完整定义见该桶)

#### pd-vis (跨桶)
**触发**: 用户说「交互设计 / 视觉设计 / 界面设计 / 原型 / wireframe / 线框图 / 设计稿 / 长什么样」, 或 pd-prd 完成后衔接, 或 pdflow 在 PRD 后路由到交互视觉设计阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pd-vis.md`
**摘要**: 独立产品流交互视觉设计阶段: 读 PRD(可选) + 选保真度(默认低保真 wireframe) + 低保真 IA/交互流/wireframe(approve gate) + 2-3 视觉方向发散 + 可选高保真原型 + 对照 PRD 逐条走查; 产出 .design.md; 只做产品交互+视觉不碰技术架构(那是 dev-design)
**主桶**: design (完整定义见该桶)

