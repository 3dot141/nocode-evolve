# agent-rule-catalog-1

> 当前章节为 规则目录
> 当前是第 1 页

> 下面的文件是相对目录，相对于 {DSH_NOCODE_ROOT}

| 文件相对地址 | 描述 |
|---|---|
| rules/rule-codex-review.md | 独立 review 路由规则。仅在 reviewing 引擎或上游流程明确要求独立审查时触发， 使用当前平台的原生 agent 请求隔离 reviewer，并如实记录实际独立性。 默认自审、普通代码检查、未获用户授权的升审不触发。 |
| rules/rule-cross-repo-lookup.md | 从当前仓库进入另一个物理 git repo 只读检查代码 (Read / rg / git log / 对照实现) 前触发——同一逻辑仓库磁盘上常有主仓 + 多份平级 worktree 拷贝, 先 git worktree list 枚举唯一候选集, 与当前分支同名的 worktree 优先, 进入后 branch --show-current 验证再读, 不沿用记忆/上下文残留路径。 不触发: 在当前仓库内部检索、要去改那个仓库的文件 (走 rule-git-worktree 关联仓库节)、本会话已按本流程验证过且分支未切换的路径复用。 |
| rules/rule-database-logical-relations.md | 设计或修改数据库表结构、DDL、migration、ORM model/entity，且涉及表间关系时触发—— 默认不创建物理外键约束 (FOREIGN KEY)，通过关联字段和应用层逻辑维护关系；仅当用户明确要求时 才创建物理外键。不触发: 只读查询数据、查看既有 schema、或不涉及表间关系的单表改动。 |
| rules/rule-git-freshness.md | 设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计) 前, 或代码搜索 (semble-search / grep -r / rg / find / Explore) 前, 或 ≥3 文件 Read 探源做方案分析前触发——跑 scripts/freshness-check.mjs 确认 当前分支未过时于 base, 落后 ≥5 commit 或首次冷启动则停手三选; 同会话 30min 内重复命中 gate 自动放行 (节流)。不触发: 开 worktree 那一刻 (由 git-worktree 覆盖)、已知精确路径读单文件、单行 literal grep/文件名 find、用户显式跳过、2h 内已查过缓存命中、gate 节流窗口内。 |
| rules/rule-git-inspection.md | 连续要跑 ≥2 个 git 只读命令 (status/diff/log/show/branch/ls-files/ remote -v 等) 时触发, 默认用 && 串成一个 Bash call, 减少 turn 浪费。 不触发: 命令间有运行时依赖、需要看到中间失败步骤之后的输出、步骤之间 需要用户决策。 |
| rules/rule-git-worktree.md | 新建分支 / 开 worktree 时触发——原则: 所有分支都走 worktree, 不在主仓裸开 branch。也触发于: worktree 内跑命令报 env/config 缺失需要从主仓 cp gitignored 文件; agent 在 worktree 里找不到项目本地 .agents-personal/ 路由; 从当前仓库进入另一个物理 git repo 去改文件 (关联仓库场景, 用相同 分支名建 worktree, 已有同名分支则复用)。不触发: 已有的 main/master 主干上工作。 |
