# agent-catalog (续片)

> 接上一片 catalog. 同源生成, 禁手改.

### 桶: 设计与文档 (design)
**粗触发**: 写设计文档 / PRD / RFC / ADR / 重构方案 / 技术 spec / 技术选型 / 方案对比 / 架构设计
**不含 (负例)**: 写代码注释 / commit message / README / changelog

#### superpowers-brainstorming
**触发**: 即将执行 superpowers:brainstorming skill (用户直接 /brainstorming 或 agent 主动调该 skill 时的 overlay). 不含: 用户要求写设计文档等设计阶段动作(走 design rule, 不走本 overlay)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-superpowers-brainstorming.md`
**摘要**: superpowers:brainstorming 执行时的 overlay: 输出路径按 {dev_design_output} 变量 + worktree → write → review → render 四步; 仅在 brainstorming skill 已在执行时生效, 用户直接要求设计文档走 design rule
**生命周期**: 0 设计

#### dev-design
**触发**: 用户要求写设计文档 / RFC / Design Doc / ADR / 重构方案 / 技术 spec / API 设计, 或 devflow 路由到 Design 阶段. 不含: 产品 PRD (走 pd-prd skill, 不走本 rule)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-design.md`
**摘要**: Design 阶段: 方案探索(brainstorming发散解法空间) + 测试目标推导 + 设计文档(design-doc-writing); adversarial review + 设计六轴(可行性/清晰度/架构合理性/安全/性能/可扩展性) + source-driven 前置检查 + 轻量 threat model
**也属**: workflow
**生命周期**: 0 设计

#### pd-prd
**触发**: 用户说「写 PRD / 产品需求 / 产品设计 / 产品 brief / 写需求文档」, 或 research 完成后衔接, 或 devflow Full 场景建议
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pd-prd.md`
**摘要**: 独立产品流 PRD 阶段: 读 research-memo(可选) + clarify gate + 写结构化 .prd.md 文档(6 核心要素 + 扩展字段); [TBD]/[ASSUMED] 双标注; Go/No-Go 结尾
**也属**: workflow
**生命周期**: 0 设计

#### pd-vis
**触发**: 用户说「交互设计 / 视觉设计 / 界面设计 / 原型 / wireframe / 线框图 / 设计稿 / 长什么样」, 或 pd-prd 完成后衔接, 或 pdflow 在 PRD 后路由到交互视觉设计阶段
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pd-vis.md`
**摘要**: 独立产品流交互视觉设计阶段: 读 PRD(可选) + 选保真度(默认低保真 wireframe) + 低保真 IA/交互流/wireframe(approve gate) + 2-3 视觉方向发散 + 可选高保真原型 + 对照 PRD 逐条走查; 产出 .design.md; 只做产品交互+视觉不碰技术架构(那是 dev-design)
**也属**: workflow
**生命周期**: 0 设计

#### codex-review (跨桶)
**触发**: red-blue-deep 判重档走到红军环节; 或完成分支 / 显式 review 请求; 或我卡住 / 想要第二实现 / 独立诊断 / 委派; 或 design-doc-writing 走到 review 环节. 不含: devflow Review 阶段的五轴评审 (走 dev-review skill, 不走本 rule)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
**摘要**: 本机 Codex 当独立模型接四场景 (红蓝红军 / 代码 review 收尾 / 委派救援 / 设计文档审稿); 直接 Bash 调 codex-companion.mjs; 先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendored 文件
**主桶**: review (完整定义见该桶)

#### git-freshness (跨桶)
**触发**: 即将做设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计), 或即将做代码搜索 (Agent semble-search / Bash grep -r/rg/find / Explore), 或多文件 Read (≥3 文件) 探源做方案分析 — 不论主仓 or worktree (worktree 内长期工作仍可能 stale, 不被 rule-git-worktree 覆盖). 一句 node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" 调脚本拿 base/behind/ahead, gate=gate (behind ≥ 5, 或 branch+base 首次冷启动) 时停手三选, 否则继续. cache TTL 2h 内毫秒返回不 fetch
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`
**摘要**: 设计/方案动作 + 代码搜索/多文件 Read 前用 scripts/freshness-check.mjs 检查当前分支与 base 的 behind 差距; base 推断优先级: git config nocode-evolve-base (worktree 创建时写入, 不随 push -u 漂移) → upstream → origin/HEAD → origin/main; behind ≥ 5 commits 或 branch+base 首次冷启动 gate 三选 (pull --rebase / 接受 / 跳过); cache 2h TTL 不 fetch 不打扰; 离线 fetch 失败 warn 不阻塞. 主仓 + worktree 内长期工作都管 (worktree-add 那刻仍由 rule-git-worktree 覆盖)
**主桶**: git-lifecycle (完整定义见该桶)

#### pdflow (跨桶)
**触发**: 用户说「pdflow / 产品发现 / 走产品阶段 / 先调研再写 PRD / 产品工作流」, 或 devflow Full 场景建议先走产品流
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pdflow.md`
**摘要**: 产品发现工作流领航(Research → PRD · 2 场景路由); 独立于 devflow, 通过 .prd.md 文档衔接; Full(Research→PRD) / Light(PRD-only); Handoff 建议进 devflow
**主桶**: workflow (完整定义见该桶)

#### pd-research (跨桶)
**触发**: 用户说「调研一下 / 帮我调研 / research / 竞品分析 / 市场调研 / 看看已有方案 / 看看别人怎么做」, 或 devflow Full 场景建议先走产品流
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-pd-research.md`
**摘要**: 独立产品流 Research 阶段: 并行多切面探索(竞品/代码/市场/已有方案), 产出 research-memo.md; 可独立调起也可串联 prd skill
**主桶**: workflow (完整定义见该桶)

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
**触发**: PR merge 后流转飞书 issue 状态 (组员开发 → 研发已改待BUILD); 或用户说「流转任务 / 改状态 / 标完成」; 或 devflow Land 阶段 (8d. Task Transition)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-feishu-transition.md`
**摘要**: PR merge 后把飞书 issue 从组员开发流转到研发已改待BUILD; 先 update_field 填缺陷来源于缺陷(field_ecff7b, 默认自关联), 再 get_transition_required 确认必填项完成, 最后 transition_state; 多任务逐个独立流转
**关键约束(上浮)**: 非组员开发状态不强行流转, 报告让用户决定; 不猜测填充未知关联字段。
**也属**: git-lifecycle
**生命周期**: 4 收尾

### 桶: Figma 设计稿读取 (figma)
**粗触发**: 读取 Figma 设计稿节点属性 (字号 / 颜色 / 间距 / 圆角), 用户给 figma.com 链接要求提取设计值 / 对齐 UI 实现
**不含 (负例)**: 只看用户贴的设计稿截图 (不需要 API); Figma 原型预览链接 (无 inspect 需求)

#### figma-design-read
**触发**: 用户给 figma.com/design 或 figma.com/file 链接, 要求读取设计稿、提取设计值（字号/颜色/间距）、对齐 UI 实现、检查样式差异
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-figma-design-read.md`
**摘要**: 读 Figma 设计稿用 REST API (curl + $FIGMA_TOKEN 环境变量) 不依赖 MCP/agent-browser 登录; 从 URL 解析 file_key+node_id → GET /v1/files/{key}/nodes?ids={id} → python3 遍历节点树提取 TEXT(fontSize/fontWeight) + FRAME(fills/cornerRadius/padding); 颜色 RGBA 0-1 转 hex
**关键约束(上浮)**: 凭截图推断精确数值不可靠, 精确值走 API; 用 $FIGMA_TOKEN 不硬编码明文。
**生命周期**: cross

