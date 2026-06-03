# agent-catalog — nocode-evolve 插件级规则路由 (常驻完整路由)

> 本文件由 `hooks/generate.mjs` 从 `rules/manifest.json` 生成. **禁手改**——改 rule 改 manifest 后重新生成.
> 完整路由常驻 context (不再用 route skill 中转). 超 SHARD_LIMIT 自动切片 agent-catalog-2.md 等.

## 触发协议 (强制工序, 非"自觉")

**Step 0 — 每条用户消息收到后, 在动手前先扫下方 4 个粗桶的 trigger_summary 一次**:

- 命中桶 → 在桶内子规则按 `触发` 选具体 rule → `Read` 对应 `rules/rule-*.md` (同一规则会话只 Read 一次)
- 命中桶但落「负例」描述 → 不触发
- 全不命中 → 直接动作 (无 rule 约束)

**这是工序, 不是自觉**——不论任务大小、context 深度、是否 mid-task, Step 0 都先扫. 跳过 = 软触发漏, 这正是 catalog 常驻设计要解决的.

## 何时主动建议 /pilot

agent 视角: 用户任务命中以下任一条件时, **主动一句话建议**「这任务多步 / 跨阶段, 要不要 /pilot 看下流程?」并停下等用户拍板:

- 跨文件 + 状态未知 (不知道当前在生命周期哪一步)
- 需要 commit / PR / 设计文档 / 评审等多阶段动作
- 用户描述含「整个 / 整体 / 全流程 / 从头 / 完整跑通」等多步信号

不触发 (直接动手, 不建议 /pilot): 单文件修改、纯查询、单步明确动作.

> 项目本地资源 (`.agents-personal/`) 检索约定见 `model/agent-personal.md`. /pilot 是手动入口 skill (`disable-model-invocation`), agent 不直接调, 只建议用户调.

---

## 规则清单 (按粗桶分组, 完整路由)

### 桶: Git 生命周期 (git-lifecycle)
**粗触发**: 任何把本地改动推进到分支 / 远端协作状态的请求 (提 PR / push / 合并 / 收尾 / worktree)
**不含 (负例)**: 纯只读查询: 列 PR / 看分支 / 看 status / 看 log

#### finishing-branch
**触发**: 即将执行 superpowers:finishing-a-development-branch skill, 或用户说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 删 branch / discard worktree」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-finishing-branch.md`
**摘要**: 覆盖+扩展 superpowers skill, 4 选项 (merge/PR/keep/discard); Gate 体系 M/TB/PR/D/RD; gh 主, Bitbucket DC 读 bkt 附录
**关键约束(上浮)**: Bitbucket 用 bkt 不裸 curl; reviewer 用 bkt pr edit 不 PUT; force push 高风险二次确认。
**生命周期**: 4 收尾

#### git-worktree
**触发**: 即将执行 superpowers:using-git-worktrees skill, 或用户要求创建 worktree, 或用户要新建分支 (原则: 所有分支都走 worktree, 不在主仓裸开 branch), 或在 worktree 内跑命令报「env var missing / config 不存在」需从主仓 cp gitignored 文件, 或 agent 在 worktree 找不到项目本地 .agents-personal/ 路由
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-worktree.md`
**摘要**: 原则: 每个分支都要 worktree, 不在主仓裸开 branch (新建分支即走 worktree); worktree 落项目同级 <project>-<branch_flat>/; 建前静默 fetch + 基于 upstream 最新; 建后调 worktree-setup.mjs setup 补齐(cp env/IDE/node_modules + symlink .agents-personal, 看 needsAttention[]); 销毁走 teardown verb (先 ExitWorktree)
**生命周期**: 1 隔离

#### git-inspection
**触发**: 即将连续跑 ≥2 个 git read-only 命令 (status / diff / log / show / branch / ls-files / remote -v 等)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-inspection.md`
**摘要**: read-only inspection 命令默认用 && 串成一个 Bash call, 各段间插 echo "---<label>" 分隔, 减少 turn 浪费
**生命周期**: cross

#### git-freshness
**触发**: 即将开始设计性动作 (写设计文档/PRD/RFC/ADR、方案对比、技术选型、重构方案、架构设计) 且不走 worktree (就地在当前分支); 开/将开 worktree 的场景由 git-worktree fetch 覆盖, 本 rule 不重复触发
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`
**摘要**: 设计/方案动作前确保当前分支基于最新远程 (fetch + behind 则 pull --rebase, ahead>0 弹问); 防基于过时代码做设计返工。走 worktree 的场景已由 git-worktree fetch 覆盖, 本 rule 管就地设计 (behavior 触发, 无强机制保证)
**也属**: design
**生命周期**: 0 设计

#### push-summary (跨桶)
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤200字, 含基础内容(覆盖 push range 全 commit) + 重点评测(亮点 / 风险 / 未验证项)
**主桶**: memory (完整定义见该桶)

### 桶: 评审 (review)
**粗触发**: 对已有改动或设计求评审 / 挑错 / 独立验证 / 第二实现
**不含 (负例)**: 纯执行: 直接改代码而未求评审

#### codex-review
**触发**: red-blue-deep 判重档走到红军环节; 或完成分支 / 显式 review 请求; 或我卡住 / 想要第二实现 / 独立诊断 / 委派; 或 design-doc-writing 走到 review 环节
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
**摘要**: 本机 Codex 当独立模型接四场景 (红蓝红军 / 代码 review 收尾 / 委派救援 / 设计文档审稿); 直接 Bash 调 codex-companion.mjs; 先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendored 文件
**关键约束(上浮)**: 先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendor/codex/ 文件。
**也属**: design
**生命周期**: 3 评审

#### red-blue-deep
**触发**: 用户问「X 怎么样 / 行不行 / 合适吗 / 值得吗 / 选 A 还是 B / 哪个更好」等评估 / 拍板类, 或显式说红蓝军 / 第一性原理
**读**: `(skill, 无 rule 文件)`
**摘要**: 评估 / 拍板类提问的红蓝军框架; skill 内判轻档 (一句表态) / 重档 (第一性原理→蓝军→红军→结论, 重档红军默认交 Codex)
**生命周期**: cross

### 桶: 设计与文档 (design)
**粗触发**: 写设计文档 / PRD / RFC / ADR / 重构方案 / 技术 spec
**不含 (负例)**: 写代码注释 / commit message / README / changelog

#### superpowers-brainstorming
**触发**: 即将执行 superpowers:brainstorming skill, 或用户要求写设计文档 / PRD / RFC / Design Doc / ADR / 重构方案 / 技术 spec, 或 brainstorming 走到 step 5
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-superpowers-brainstorming.md`
**摘要**: 写设计文档统一 worktree → write → review → render 四步, 落 docs/superpowers/specs/{username}/ (按 doc-type 分 specs/plans/sketches); 两条入口 (brainstorming step5 / 用户直接要求) 一致
**生命周期**: 0 设计

#### codex-review (跨桶)
**触发**: red-blue-deep 判重档走到红军环节; 或完成分支 / 显式 review 请求; 或我卡住 / 想要第二实现 / 独立诊断 / 委派; 或 design-doc-writing 走到 review 环节
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
**摘要**: 本机 Codex 当独立模型接四场景 (红蓝红军 / 代码 review 收尾 / 委派救援 / 设计文档审稿); 直接 Bash 调 codex-companion.mjs; 先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendored 文件
**主桶**: review (完整定义见该桶)

#### git-freshness (跨桶)
**触发**: 即将开始设计性动作 (写设计文档/PRD/RFC/ADR、方案对比、技术选型、重构方案、架构设计) 且不走 worktree (就地在当前分支); 开/将开 worktree 的场景由 git-worktree fetch 覆盖, 本 rule 不重复触发
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`
**摘要**: 设计/方案动作前确保当前分支基于最新远程 (fetch + behind 则 pull --rebase, ahead>0 弹问); 防基于过时代码做设计返工。走 worktree 的场景已由 git-worktree fetch 覆盖, 本 rule 管就地设计 (behavior 触发, 无强机制保证)
**主桶**: git-lifecycle (完整定义见该桶)

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

