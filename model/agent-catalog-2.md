# agent-catalog (续片)

> 接上一片 catalog. 同源生成, 禁手改.

### 桶: 设计与文档 (design)
**粗触发**: 写设计文档 / PRD / RFC / ADR / 重构方案 / 技术 spec / 技术选型 / 方案对比 / 架构设计
**不含 (负例)**: 写代码注释 / commit message / README / changelog

#### superpowers-brainstorming
**触发**: 即将执行 nocode:brainstorming skill (用户直接 /brainstorming 或 agent 主动调该 skill 时的 overlay); 其「写作工作流」节同样覆盖用户直接要求写 PRD / RFC / 设计文档 / ADR (绕过 brainstorming) 的路径——两条入口走同一条 worktree → write → review → render 链
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-superpowers-brainstorming.md`
**摘要**: brainstorming overlay + 设计文档写作工作流: 输出路径按 {dev_design_output} 变量 + worktree → write → review → render 四步; 不分入口——brainstorming step 5 或用户直接要求写 PRD/RFC/设计文档/ADR 均走同一条链
**生命周期**: 0 设计

#### dev-design
**触发**: devflow 路由到 Design 阶段, 或用户要完整设计流程 (设计一下/架构设计/系统设计/重构方案/技术方案/技术 spec/API 设计——把选方案+详细设计+渲染整条走完). 薄协调器: 编排 select→refine→render, 自己不选方案不写文档. 不含: 只选方案/技术选型/方案对比/预研 (走 dev-design-select); 只把已定方案写成详细设计文档 (走 dev-design-refine); 产品 PRD (走 pd-prd)
**读**: ``
**也属**: workflow
**生命周期**: 0 设计

#### dev-design-select
**触发**: 用户要选方案 / 技术选型 / 方案对比 / 出方案 / 预研 / 调研已有方案 / 看看别人怎么做 (在写详细设计文档之前先定走哪条路), 或 devflow Design 阶段的选方案子阶段. 不含: 写详细设计文档 (走 dev-design-refine); 产品 PRD (走 pd-prd)
**读**: ``
**也属**: workflow
**生命周期**: 0 设计

#### dev-design-refine
**触发**: 用户已有选定方案, 要把它写成详细设计文档 / design doc / 详细设计 (领域划分/模块/接口/业务流). 不含: 还没选方案要先对比 (走 dev-design-select); 产品 PRD (走 pd-prd)
**读**: ``
**也属**: workflow
**生命周期**: 0 设计

#### pd-prd
**触发**: 用户说「写 PRD / 产品需求 / 产品设计 / 产品 brief / 写需求文档」, 或 research 完成后衔接, 或 devflow Full 场景建议
**读**: ``
**也属**: workflow
**生命周期**: 0 设计

#### pd-ix
**触发**: 用户说「交互设计 / 信息架构 / 页面流 / 交互拆解 / IA / 用户流程」, 或 pd-prd 完成后衔接, 或 pdflow 在 PRD 后路由到交互设计阶段
**读**: ``
**也属**: workflow
**生命周期**: 0 设计

#### pd-vd
**触发**: 用户说「视觉设计 / 视觉方向 / 配色 / 原型 / wireframe / 线框图 / 设计稿 / 长什么样 / 出个原型」, 或 pd-ix 完成后衔接, 或 pdflow 在交互设计后路由到视觉设计阶段. 不含: 非 UI 语境的「长什么样」提问 (如「这个报错长什么样」「这段返回的数据长什么样」等调试/数据类提问, 按字面回答, 不是本 rule)
**读**: ``
**也属**: workflow
**生命周期**: 0 设计

#### codex-review (跨桶)
**触发**: red-blue-deep 判重档走到 Step 3 独立审查环节; 或完成分支 / 显式 review 请求; 或我卡住 / 想要第二实现 / 独立诊断 / 委派; 或各 review 细则 (dev-design-refine / dev-review / define-review / prd-review / design-review / vis-review) 自审后命中升档判据 (reviewing skeleton §1a) 派独立交叉时. 不含: 各细则的默认自审路 (自审不派本 rule); devflow Review 阶段的五轴自审 (走 dev-review skill). 注: triggers 正则与 dev-review 字面重叠 ("review 一下" / "帮我审"), 两条都会同时注入常驻 context, 不是 hook 强制互斥——命中哪条按当前是否在 devflow 流程语境判断: 在 devflow 里走 dev-review, 独立诊断/红军/委派场景走本条
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
**摘要**: 本机 Codex 当独立模型接四场景 (红蓝独立审查 / 代码 review 收尾 / 委派救援 / 设计文档审稿); 各 review 细则默认自审不派本 rule, 升档 (reviewing skeleton §1a: 自审出无法裁决的 finding / 结论有争议 / 用户显式要求) 才派; 不预先探活, 真正的 review/adversarial-review/task 调用直接派 subagent 执行 (Agent() 包一层 Bash, 不在主 agent 直接 Bash 调 vendor/codex/scripts/codex-companion.mjs); 场景 1/4 默认单跑 Codex, 调用报错才 fallback 改派独立 subagent (不再并行双跑); 不可用降级自做 + 明说; 禁改 vendored 文件
**主桶**: review (完整定义见该桶)

#### git-freshness (跨桶)
**触发**: 即将做设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计), 或即将做代码搜索 (Agent nocode:semble-search / Bash grep -r/rg/find / Explore), 或多文件 Read (≥3 文件) 探源做方案分析 — 不论主仓 or worktree (worktree 内长期工作仍可能 stale, 不被 rule-git-worktree 覆盖). 一句 node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" 调脚本拿 base/behind/ahead, gate=gate (behind ≥ 5, 或 branch+base 首次冷启动) 时停手三选, 否则继续. cache TTL 2h 内毫秒返回不 fetch
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`
**摘要**: 设计/方案动作 + 代码搜索/多文件 Read 前用 scripts/freshness-check.mjs 检查当前分支与 base 的 behind 差距; base 推断优先级: git config nocode-base (worktree 创建时写入, 不随 push -u 漂移) → upstream → origin/HEAD → origin/main; behind ≥ 5 commits 或 branch+base 首次冷启动 gate 三选 (pull --rebase / 接受 / 跳过); cache 2h TTL 不 fetch 不打扰; 离线 fetch 失败 warn 不阻塞. 主仓 + worktree 内长期工作都管 (worktree-add 那刻仍由 rule-git-worktree 覆盖)
**主桶**: git-lifecycle (完整定义见该桶)

#### pdflow (跨桶)
**触发**: 用户说「pdflow / 产品发现 / 走产品阶段 / 先调研再写 PRD / 产品工作流」, 或 devflow Full 场景建议先走产品流
**读**: ``
**主桶**: workflow (完整定义见该桶)

#### pd-research (跨桶)
**触发**: 用户说「调研一下 / 帮我调研 / research / 竞品分析 / 市场调研 / 看看已有方案 / 看看别人怎么做」, 或 devflow Full 场景建议先走产品流
**读**: ``
**主桶**: workflow (完整定义见该桶)

### 桶: 记忆与沉淀 (memory)
**粗触发**: 总结 / 沉淀 / 归档会话产出 / push 内容 / 项目本地资源 (.agents-personal/) 操作
**不含 (负例)**: 一次性事实查询

#### push-summary
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 push / 这次 push 包含什么」. 不含: 非 push 语境的一般性总结/沉淀 (走 /distill 或 /sow)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤300字, 含背景(是什么/解决什么问题) + 方案(怎么解决的/重点评审哪些内容)
**也属**: git-lifecycle
**生命周期**: 4 收尾

#### personal-deletion-guard
**触发**: 即将 rm / mv / find -delete / Write 覆盖 / Edit 大段删 在 .agents-personal/ 或 $USER_VAULT_PATH/ 下任何文件或子目录 (subagent 同理); 删除护栏规则文本常驻 model/agent-personal.md, 本 rule 提供 PreToolUse 硬兜底
**读**: `${CLAUDE_PLUGIN_ROOT}/model/agent-personal.md`
**摘要**: .agents-personal/ + $USER_VAULT_PATH 内容是用户沉淀的项目历史 + 当前指令, gitignored 不可恢复, 删除前必须二次确认 (rm/mv/find-delete 均视为删除等价物). PreToolUse 在命令层兜底拦 (inject 提醒, 不 block 留余地给用户授权)
**生命周期**: cross

### 桶: 飞书/Lark (lark)
**粗触发**: 完整读取飞书文档（含图片）/ 飞书项目管理 (project.feishu.cn / Meego 工作项读取 / 流转 / 搜索)
**不含 (负例)**: 飞书云文档低层 API 操作 (走外部 lark-doc skill); 知识空间管理 (走外部 lark-wiki skill); 飞书任务管理 (走外部 lark-task skill)

#### lark-read
**触发**: 用户给飞书文档 URL 要求完整读取（含图片），或说「读一下这个文档 / 看看这篇文章 / 把文档内容拉下来 / 读取飞书文档」。不含: 低层 API 操作（走外部 lark-doc skill）
**读**: ``
**关键约束(上浮)**: 不要用 WebFetch 抓飞书文档(SPA); scope 未授权先试 curl 直链兜底。
**生命周期**: cross

#### lark-project
**触发**: 用户给 project.feishu.cn 链接（或 Meego 工作项 id）要求读取/总结/看附件/分析需求或缺陷内容; 或 PR merge 后流转飞书 issue 状态; 或用户说「流转任务/改状态/标完成/飞书项目/工作项」; 或 devflow Land 阶段 (8d. Task Transition). 注: PR 决策线内的 post-merge 流转由 dev-finish-branch 发起, 其内部会用到本 rule 能力. 不含: 无飞书语境的通用状态改动 (如「改一下这个组件的状态」) 或本地任务标记完成 (如「这个任务标完成了」但未提飞书/工作项/meego, 走 nocode:task 或按字面执行, 不是本 rule)
**读**: ``
**关键约束(上浮)**: 下载附件必须带 X-Meego-File-Sign header; 非组员开发状态不强行流转; 别用 WebFetch 抓 SPA 链接。
**也属**: git-lifecycle
**生命周期**: cross

#### dev-finish-branch (跨桶)
**触发**: 用户说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 删 branch / discard worktree」, 或「PR 合了 / 合并后流转」(post-merge 已并入). 不含: 无合并上下文的独立飞书工作项流转 (走 lark-project); 或 dev-land 调用
**读**: ``
**主桶**: git-lifecycle (完整定义见该桶)

### 桶: Figma 设计稿读取 (figma)
**粗触发**: 读取 Figma 设计稿节点属性 (字号 / 颜色 / 间距 / 圆角), 用户给 figma.com 链接要求提取设计值 / 对齐 UI 实现
**不含 (负例)**: 只看用户贴的设计稿截图 (不需要 API); Figma 原型预览链接 (无 inspect 需求)

#### figma-design-read
**触发**: 用户给 figma.com/design 或 figma.com/file 链接, 要求读取设计稿、提取设计值（字号/颜色/间距）、对齐 UI 实现、检查样式差异
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-figma-design-read.md`
**摘要**: 读 Figma 设计稿用 REST API (curl + $FIGMA_TOKEN 环境变量) 不依赖 MCP/agent-browser 登录; 从 URL 解析 file_key+node_id → GET /v1/files/{key}/nodes?ids={id} → python3 遍历节点树提取 TEXT(fontSize/fontWeight) + FRAME(fills/cornerRadius/padding); 颜色 RGBA 0-1 转 hex
**关键约束(上浮)**: 凭截图推断精确数值不可靠, 精确值走 API; 用 $FIGMA_TOKEN 不硬编码明文。
**生命周期**: cross

