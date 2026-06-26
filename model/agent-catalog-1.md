# agent-catalog — nocode-evolve 插件级规则路由 (常驻完整路由)

> 本文件由 `hooks/generate.mjs` 从 `rules/manifest.json` 生成. **禁手改**——改 rule 改 manifest 后重新生成.
> 完整路由常驻 context (不再用 route skill 中转). 超 SHARD_LIMIT 自动切片 agent-catalog-2.md 等.

## 触发协议 (强制工序, 非"自觉")

**Step 0 — 每条用户消息收到后, 在动手前先扫下方 4 个粗桶的 trigger_summary 一次**:

- 命中桶 → 在桶内子规则按 `触发` 选具体 rule → `Read` 对应 `rules/rule-*.md` (同一规则会话只 Read 一次)
- 命中桶但落「负例」描述 → 不触发
- 全不命中 → 直接动作 (无 rule 约束)

**这是工序, 不是自觉**——不论任务大小、context 深度、是否 mid-task, Step 0 都先扫. 跳过 = 软触发漏, 这正是 catalog 常驻设计要解决的.

## 何时主动调用 /devflow

agent 视角: 用户任务命中以下任一条件时, **主动调起 devflow skill** 进入流程导航 (devflow 给阶段判断 + 下一步建议, 用户拍板, 不替执行):

- 跨文件 + 状态未知 (不知道当前在生命周期哪一步)
- 需要 commit / PR / 设计文档 / 评审等多阶段动作
- 用户描述含「整个 / 整体 / 全流程 / 从头 / 完整跑通」等多步信号

不触发 (直接动手, 不建议 /devflow): 单文件修改、纯查询、单步明确动作.

> 项目本地资源 (`.agents-personal/`) 检索约定见 `model/agent-personal.md`. /devflow 可被 model 主动调起, 也可用户 `/调`; 命中上述复杂多步条件时直接进 devflow, 由 devflow 给流程建议、用户拍板.

## 何时主动建议 /distill · /sow · /task (用户主动键入 command)

这 3 个是用户主动键入 `/<name>` 的**操作型 command** (有副作用: 写文件 / 改 vault / 改 task 状态), **不自动触发**. agent 在命中以下场景时**主动一句话建议**用户键入, **不替用户键**:

- **`/distill`** — 会话末沉淀分流 (五出口: 项目 wiki / 跨项目 advisor / 项目 rules / 插件 rules / skip). 命中: 用户说「沉淀一下 / 归档这个会话 / 把刚才讨论的保留下来」且会话已有可沉淀产出
- **`/sow <意图>`** — 归档到用户 vault (`Inbox` / `Inputs` / `Outputs` 三层). 命中: 用户说「sow 到 vault / 归档到外部 / 写到 vault / 保存这个想法」+ 有明确意图
- **`/task <意图>`** — 任务管理 (8 sub-action: add / update / done / cancel / wrap-day / carry-over / breakdown / start-week). 命中: 用户说「加 task / 改 task / task 完成 / 列今天 task / 拆解 task / 周开始」等任务动作

不触发 (纯讨论 / 元讨论, 不命中): 用户说「要不要 sow 这个」「task 这块要不要重构」「distill 设计怎么改」等讨论性表达——是元讨论不是动作.

---

## 规则清单 (按粗桶分组, 完整路由)

### 桶: Git 生命周期 (git-lifecycle)
**粗触发**: 任何把本地改动推进到分支 / 远端协作状态的请求 (提 PR / push / 合并 / 收尾 / worktree)
**不含 (负例)**: 纯只读查询: 列 PR / 看分支 / 看 status / 看 log

#### finishing-branch
**触发**: 即将执行 nocode-evolve:finishing-a-development-branch skill, 或用户说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 删 branch / discard worktree」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-finishing-branch.md`
**摘要**: 覆盖+扩展 superpowers skill, 4 选项 (merge/PR/keep/discard); Gate 体系 Merge/Title-Body/PR/Discard/Remote-Delete; gh 主, Bitbucket DC 读 bkt 附录
**关键约束(上浮)**: Bitbucket 用 bkt 不裸 curl; reviewer 用 bkt pr edit 不 PUT; force push 高风险二次确认。
**生命周期**: 4 收尾

#### git-worktree
**触发**: 即将执行 nocode-evolve:using-git-worktrees skill, 或用户要求创建 worktree, 或用户要新建分支 (原则: 所有分支都走 worktree, 不在主仓裸开 branch), 或在 worktree 内跑命令报「env var missing / config 不存在」需从主仓 cp gitignored 文件, 或 agent 在 worktree 找不到项目本地 .agents-personal/ 路由, 或从当前仓库进入另一个物理 git repo 去修改文件 (该 repo 即「关联仓库」, 需用与当前工作分支【相同的分支名】建 worktree, 已有同名分支则复用)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-worktree.md`
**摘要**: 原则: 每个分支都要 worktree, 不在主仓裸开 branch (新建分支即走 worktree); worktree 落项目同级 <project>-<branch_flat>/; 建前静默 fetch + 基于 base_ref 最新 (推断优先级: upstream remote → @{u} → origin/HEAD → origin/main, fork 场景 origin/main 只做镜像不参与推断; devflow Env 阶段升级为 Gate Base 显式确认 base + 基准状态); 建后调 worktree-setup.mjs setup 补齐(cp env/IDE + 从零 install + symlink .agents-personal, 不从主仓 cp node_modules 避免跨分支版本/缓存不一致, 看 needsAttention[]) + git config 记录 freshness base (不随 push -u 漂移); 销毁走 teardown verb (先 ExitWorktree); 跨物理分仓: 进入「关联仓库」改文件用与当前【相同的分支名】建 worktree (各落 <repo>-<branch>/, 前缀各自 repo basename, 已有同名则复用)
**生命周期**: 1 隔离

#### git-inspection
**触发**: 即将连续跑 ≥2 个 git read-only 命令 (status / diff / log / show / branch / ls-files / remote -v 等)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-inspection.md`
**摘要**: read-only inspection 命令默认用 && 串成一个 Bash call, 各段间插 echo "---<label>" 分隔, 减少 turn 浪费
**生命周期**: cross

#### git-freshness
**触发**: 即将做设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计), 或即将做代码搜索 (Agent nocode-evolve:semble-search / Bash grep -r/rg/find / Explore), 或多文件 Read (≥3 文件) 探源做方案分析 — 不论主仓 or worktree (worktree 内长期工作仍可能 stale, 不被 rule-git-worktree 覆盖). 一句 node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" 调脚本拿 base/behind/ahead, gate=gate (behind ≥ 5, 或 branch+base 首次冷启动) 时停手三选, 否则继续. cache TTL 2h 内毫秒返回不 fetch
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`
**摘要**: 设计/方案动作 + 代码搜索/多文件 Read 前用 scripts/freshness-check.mjs 检查当前分支与 base 的 behind 差距; base 推断优先级: git config nocode-evolve-base (worktree 创建时写入, 不随 push -u 漂移) → upstream → origin/HEAD → origin/main; behind ≥ 5 commits 或 branch+base 首次冷启动 gate 三选 (pull --rebase / 接受 / 跳过); cache 2h TTL 不 fetch 不打扰; 离线 fetch 失败 warn 不阻塞. 主仓 + worktree 内长期工作都管 (worktree-add 那刻仍由 rule-git-worktree 覆盖)
**关键约束(上浮)**: fetch 失败 (离线) 不阻塞, warn 继续; 不替用户决定 pull-rebase / 接受 / 跳过, gate 时停手等用户回复。
**也属**: design, review
**生命周期**: cross

#### push-summary (跨桶)
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤200字, 含基础内容(覆盖 push range 全 commit) + 重点评测(亮点 / 风险 / 未验证项)
**主桶**: memory (完整定义见该桶)

#### lark-project (跨桶)
**触发**: 用户给 project.feishu.cn 链接（或 Meego 工作项 id）要求读取/总结/看附件/分析需求或缺陷内容; 或 PR merge 后流转飞书 issue 状态; 或用户说「流转任务/改状态/标完成/飞书项目/工作项」; 或 devflow Land 阶段 (8d. Task Transition)
**读**: ``
**摘要**: 飞书项目管理(FeishuProjectMcp): 工作项读取(含附件 X-Meego-File-Sign) + 状态流转(组员开发→研发已改待BUILD) + 搜索(search_by_mql) + 创建更新; project_key 撞多空间改传真实 24 位 hex key; 详细流程见 skill 内 references/
**主桶**: lark (完整定义见该桶)

#### dev-land (跨桶)
**触发**: devflow 路由到 Land 阶段, 或用户说「land / 着陆 / 准备着陆 / 走 land 阶段」(注意: 独立说「提 PR / 收尾 / 合并」不在 devflow 上下文时走 finishing-branch, 不走本 skill)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-dev-land.md`
**摘要**: Landing 收尾: Pre-flight(Review Gate + 分支状态) → Disposition(4选项 merge/PR/keep/discard) → 执行(rule-finishing-branch) → Task Transition(lark-project) → Cleanup; Mini 走 Land-lite(commit only)
**主桶**: workflow (完整定义见该桶)

### 桶: 评审 (review)
**粗触发**: 对已有改动或设计求评审 / 挑错 / 独立验证 / 第二实现
**不含 (负例)**: 纯执行: 直接改代码而未求评审

#### codex-review
**触发**: red-blue-deep 判重档走到红军环节; 或完成分支 / 显式 review 请求; 或我卡住 / 想要第二实现 / 独立诊断 / 委派; 或 design-doc-writing 走到 review 环节. 不含: devflow Review 阶段的五轴评审 (走 dev-review skill, 不走本 rule)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
**摘要**: 本机 Codex 当独立模型接四场景 (红蓝红军 / 代码 review 收尾 / 委派救援 / 设计文档审稿); 直接 Bash 调 codex-companion.mjs; 先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendored 文件
**关键约束(上浮)**: 先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendor/codex/ 文件。
**也属**: design
**生命周期**: 3 评审

#### red-blue-deep
**触发**: 用户问「X 怎么样 / 行不行 / 合适吗 / 值得吗 / 选 A 还是 B / 哪个更好」等评估 / 拍板类, 或显式说红蓝军 / 第一性原理. 不含: 话术含「选型 / 设计 / 架构」的设计阶段动作(走 design rule, 不走 red-blue-deep)
**读**: `(skill, 无 rule 文件)`
**摘要**: 评估 / 拍板类提问的红蓝军框架; skill 内判轻档 (一句表态) / 重档 (第一性原理→蓝军→红军→结论, 重档红军默认交 Codex)
**生命周期**: cross

#### git-freshness (跨桶)
**触发**: 即将做设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计), 或即将做代码搜索 (Agent nocode-evolve:semble-search / Bash grep -r/rg/find / Explore), 或多文件 Read (≥3 文件) 探源做方案分析 — 不论主仓 or worktree (worktree 内长期工作仍可能 stale, 不被 rule-git-worktree 覆盖). 一句 node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" 调脚本拿 base/behind/ahead, gate=gate (behind ≥ 5, 或 branch+base 首次冷启动) 时停手三选, 否则继续. cache TTL 2h 内毫秒返回不 fetch
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`
**摘要**: 设计/方案动作 + 代码搜索/多文件 Read 前用 scripts/freshness-check.mjs 检查当前分支与 base 的 behind 差距; base 推断优先级: git config nocode-evolve-base (worktree 创建时写入, 不随 push -u 漂移) → upstream → origin/HEAD → origin/main; behind ≥ 5 commits 或 branch+base 首次冷启动 gate 三选 (pull --rebase / 接受 / 跳过); cache 2h TTL 不 fetch 不打扰; 离线 fetch 失败 warn 不阻塞. 主仓 + worktree 内长期工作都管 (worktree-add 那刻仍由 rule-git-worktree 覆盖)
**主桶**: git-lifecycle (完整定义见该桶)

#### dev-review (跨桶)
**触发**: devflow 路由到 Review 阶段, 或用户说「review 一下 / 看看代码 / 评审 / check the code / 审一下 / 有没有问题 / 帮我 review / code review」. 不含: 非 devflow 上下文的独立 review 请求（红军/第二实现/委派）走 codex-review
**读**: ``
**摘要**: devflow Review 阶段五轴评审 + Spec 轴路径覆盖检查; 产出分级 findings 报告 (Critical/Warning/Suggestion); Critical 不可 override; 与 codex-review 分工: dev-review = devflow 五轴评审, codex-review = 独立红军/第二实现/委派
**主桶**: workflow (完整定义见该桶)

