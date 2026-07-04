# agent-rule-catalog-1

> 当前章节为 规则目录
> 当前是第 1 页

> 下面的文件是相对目录，相对于 {CLAUDE_PLUGIN_ROOT}

| 文件相对地址 | 描述 |
|---|---|
| rules/rule-codex-review.md | red-blue-deep 判重档走到独立审查环节; 或完成分支/显式 review 请求; 或 卡住/想要第二实现/独立诊断/委派; 或各 review 细则主路审后命中升档判据 要派异源交叉时触发——派本机 Codex (报错则 fallback subagent) 当独立 模型接手。不触发: 各细则默认的主路评审 (主路 subagent 审, 不派本 rule)、devflow Review 阶段的五轴主路评审 (走 dev-review)。 |
| rules/rule-figma-design-read.md | 用户给 figma.com/design 或 figma.com/file 链接, 要求读取设计稿、提取 设计值 (字号/颜色/间距/圆角)、对齐 UI 实现、检查样式差异时触发——走 Figma REST API, 不依赖 MCP/agent-browser 登录。不触发: 只看用户贴的 设计稿截图 (不需要 API)、Figma 原型预览链接 (无 inspect 需求)。 |
| rules/rule-git-freshness.md | 设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计) 前, 或代码搜索 (semble-search / grep -r / rg / find / Explore) 前, 或 ≥3 文件 Read 探源做方案分析前触发——跑 scripts/freshness-check.mjs 确认 当前分支未过时于 base, 落后 ≥5 commit 或首次冷启动则停手三选。不触发: 开 worktree 那一刻 (由 git-worktree 覆盖)、已知精确路径读单文件、单行 literal grep/文件名 find、用户显式跳过、2h 内已查过缓存命中。 |
| rules/rule-git-inspection.md | 连续要跑 ≥2 个 git 只读命令 (status/diff/log/show/branch/ls-files/ remote -v 等) 时触发, 默认用 && 串成一个 Bash call, 减少 turn 浪费。 不触发: 命令间有运行时依赖、需要看到中间失败步骤之后的输出、步骤之间 需要用户决策。 |
| rules/rule-git-worktree.md | 新建分支 / 开 worktree 时触发——原则: 所有分支都走 worktree, 不在主仓裸开 branch。也触发于: worktree 内跑命令报 env/config 缺失需要从主仓 cp gitignored 文件; agent 在 worktree 里找不到项目本地 .agents-personal/ 路由; 从当前仓库进入另一个物理 git repo 去改文件 (关联仓库场景, 用相同 分支名建 worktree, 已有同名分支则复用)。不触发: 已有的 main/master 主干上工作。 |
| rules/rule-superpowers-brainstorming.md | 即将执行 nocode:brainstorming skill, 或用户直接要求写 PRD/RFC/设计 文档/ADR (绕过 brainstorming) 时触发——两条入口都走同一条 worktree → write → review → render 四步链, 本文件覆盖 skill 内默认值 (冲突以本 文件为准)。 |
