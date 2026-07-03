# agent-catalog (续片)

> 接上一片 catalog. 同源生成, 禁手改.

### 桶: 工程流程 (workflow)
**粗触发**: 需求澄清 / 目标定义 / 任务拆分 / 实现执行 / 端到端验证 / devflow 流程导航
**不含 (负例)**: 纯查询 / 已在某个 skill 内部执行中

#### dev-define
**触发**: 用户说「澄清需求 / 我们(接下来)做什么 / 目标是什么 / interview me / 定义目标 / 需求不清楚」, 或 devflow 路由到 Define 阶段. 不含: 问某段代码/函数「是做什么的」(纯代码解释, 不是需求澄清)
**读**: ``
**生命周期**: 0 设计

#### pdflow
**触发**: 用户说「pdflow / 产品发现 / 走产品阶段 / 先调研再写 PRD / 产品工作流」, 或 devflow Full 场景建议先走产品流
**读**: ``
**也属**: design
**生命周期**: 0 设计

#### pd-research
**触发**: 用户说「调研一下 / 帮我调研 / research / 竞品分析 / 市场调研 / 看看已有方案 / 看看别人怎么做」, 或 devflow Full 场景建议先走产品流
**读**: ``
**也属**: design
**生命周期**: 0 设计

#### dev-plan
**触发**: 用户说「写计划 / 拆任务 / 怎么实现 / plan it out / 拆解一下 / 实现方案」, 或 devflow 路由到 Plan 阶段. 不含: 交互拆解 / IA 拆解 (走 pd-ix)
**读**: ``
**生命周期**: 2 实现

#### dev-build
**触发**: 用户说「开始实现 / 写代码 / 执行计划 / build it / 动手」, 或 devflow 路由到 Build 阶段
**读**: ``
**生命周期**: 2 实现

#### dev-verify
**触发**: 用户说「验证一下 / 跑一下看看 / 确认能用 / verify」, 或 Build 完成后 devflow 路由到 Verify 阶段
**读**: ``
**生命周期**: 3 评审

#### dev-land
**触发**: devflow 路由到 Land 阶段, 或用户说「land / 着陆 / 准备着陆 / 走 land 阶段」(注意: 独立说「提 PR / 收尾 / 合并」不在 devflow 上下文时走 dev-finish-branch, 不走本 skill)
**读**: ``
**也属**: git-lifecycle
**生命周期**: 4 收尾

#### dev-review
**触发**: devflow 路由到 Review 阶段, 或用户说「review 一下 / 看看代码 / 评审 / check the code / 审一下 / 有没有问题 / 帮我 review / code review」. 不含: 非 devflow 上下文的独立 review 请求（红军/第二实现/委派）走 codex-review. 注: triggers 正则与 codex-review 字面重叠 ("review 一下" / "帮我审"), 两条都会同时注入常驻 context, 不是 hook 强制互斥——命中哪条按当前是否在 devflow 流程语境判断: 在 devflow 里走本条, 独立诊断/红军/委派场景走 codex-review
**读**: ``
**也属**: review
**生命周期**: 3 评审

#### dev-design (跨桶)
**触发**: devflow 路由到 Design 阶段, 或用户要完整设计流程 (设计一下/架构设计/系统设计/重构方案/技术方案/技术 spec/API 设计——把选方案+详细设计+渲染整条走完). 薄协调器: 编排 select→refine→render, 自己不选方案不写文档. 不含: 只选方案/技术选型/方案对比/预研 (走 dev-design-select); 只把已定方案写成详细设计文档 (走 dev-design-refine); 产品 PRD (走 pd-prd)
**读**: ``
**主桶**: design (完整定义见该桶)

#### dev-design-select (跨桶)
**触发**: 用户要选方案 / 技术选型 / 方案对比 / 出方案 / 预研 / 调研已有方案 / 看看别人怎么做 (在写详细设计文档之前先定走哪条路), 或 devflow Design 阶段的选方案子阶段. 不含: 写详细设计文档 (走 dev-design-refine); 产品 PRD (走 pd-prd)
**读**: ``
**主桶**: design (完整定义见该桶)

#### dev-design-refine (跨桶)
**触发**: 用户已有选定方案, 要把它写成详细设计文档 / design doc / 详细设计 (领域划分/模块/接口/业务流). 不含: 还没选方案要先对比 (走 dev-design-select); 产品 PRD (走 pd-prd)
**读**: ``
**主桶**: design (完整定义见该桶)

#### pd-prd (跨桶)
**触发**: 用户说「写 PRD / 产品需求 / 产品设计 / 产品 brief / 写需求文档」, 或 research 完成后衔接, 或 devflow Full 场景建议
**读**: ``
**主桶**: design (完整定义见该桶)

#### pd-ix (跨桶)
**触发**: 用户说「交互设计 / 信息架构 / 页面流 / 交互拆解 / IA / 用户流程」, 或 pd-prd 完成后衔接, 或 pdflow 在 PRD 后路由到交互设计阶段
**读**: ``
**主桶**: design (完整定义见该桶)

#### pd-vd (跨桶)
**触发**: 用户说「视觉设计 / 视觉方向 / 配色 / 原型 / wireframe / 线框图 / 设计稿 / 长什么样 / 出个原型」, 或 pd-ix 完成后衔接, 或 pdflow 在交互设计后路由到视觉设计阶段. 不含: 非 UI 语境的「长什么样」提问 (如「这个报错长什么样」「这段返回的数据长什么样」等调试/数据类提问, 按字面回答, 不是本 rule)
**读**: ``
**主桶**: design (完整定义见该桶)

